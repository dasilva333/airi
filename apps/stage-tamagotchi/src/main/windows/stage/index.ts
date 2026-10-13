import type { BrowserWindow, Rectangle } from 'electron'

import type { globalAppConfigSchema } from '../../configs/global'
import type { Config } from '../../libs/electron/persistence'
import type { I18n } from '../../libs/i18n'
import type { ServerChannel } from '../../services/airi/channel-server'

import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineInvokeHandler } from '@moeru/eventa'
import { createContext } from '@moeru/eventa/adapters/electron/main'
import { app, BrowserWindow as ElectronBrowserWindow, ipcMain, screen } from 'electron'
import { throttle } from 'es-toolkit'
import { isLinux } from 'std-env'

import icon from '../../../../resources/icon.png?asset'

import { electronStartDraggingWindow } from '../../../shared/eventa'
import { startDraggingWindow } from '../../libs/electron/drag'
import { baseUrl, load, withHashRoute } from '../../libs/electron/location'
import { ensureWindowInVisibleBounds } from '../shared/display'
import { setupBaseWindowElectronInvokes, transparentWindowConfig } from '../shared/window'

let isAppQuitting = false
app.on('before-quit', () => {
  isAppQuitting = true
})

let isStageVisible = true

export function isStageDisabledByFlag(): boolean {
  return process.argv.includes('--disable-webgl-stage') || process.env.AIRI_DISABLE_WEBGL_STAGE === 'true'
}

export function setStageVisibleState(visible: boolean) {
  isStageVisible = visible
}

// NOTICE: Renderer-driven show calls (splash dismiss, backstop, late ensure)
// must consult this intent instead of showing unconditionally. Otherwise a
// hidden stage pops back on every Control Strip reload, and the stray `show`
// event flips persisted `stageEnabled` false→true as a side effect.
export function getStageVisibleState(): boolean {
  return isStageVisible
}

export type StageLifecycleEvent = 'show' | 'hide' | 'minimize' | 'restore'

export interface ActorStageWindowManager {
  ensureWindow: () => Promise<BrowserWindow | null>
  hasWindow: () => boolean
  getExistingWindow: () => BrowserWindow | undefined
  isDestroyed: () => boolean
  isVisible: () => boolean
  show: () => void
  hide: () => void
  showInactive: () => void
  setAlwaysOnTop: (flag: boolean, level?: string, relativeLevel?: number) => void
  setBounds: (bounds: Rectangle) => void
  getBounds: () => Rectangle | undefined
  on: (event: 'move' | 'resize', listener: () => void) => () => void
  removeListener: (event: 'move' | 'resize', listener: () => void) => void
  onWindowCreated: (listener: (window: BrowserWindow) => void) => () => void
  onLifecycle: (event: StageLifecycleEvent, listener: () => void) => () => void
  capturePage: () => Promise<Buffer | null>
  destroy: () => void
}

// NOTICE: `ipcMain.handle` throws when registering the same channel twice.
// The handler is registered once per process so repeated `ensureWindow()`
// calls (card switches between text-only and avatar companions) stay safe.
let stageBoundsHandlerRegistered = false

function ensureStageBoundsHandler() {
  if (stageBoundsHandlerRegistered)
    return
  stageBoundsHandlerRegistered = true
  ipcMain.handle('stage-window-set-bounds', (event, payload) => {
    const sender = event.sender
    const window = ElectronBrowserWindow.fromWebContents(sender)
    if (!window || window.isDestroyed())
      return
    if (payload?.width && payload?.height) {
      window.setSize(Math.round(payload.width), Math.round(payload.height), true)
    }
    if (payload?.center) {
      window.center()
    }
  })
}

function notifyMainWindow(visible: boolean) {
  const mainWin = ElectronBrowserWindow.getAllWindows().find(w => (w as any).__is_main_window === true)
  if (mainWin && !mainWin.isDestroyed()) {
    mainWin.webContents.send('stage-window-state', visible)
  }
}

export function setupActorStageWindowManager(params: {
  appConfig: Config<typeof globalAppConfigSchema>
  serverChannel: ServerChannel
  i18n: I18n
}): ActorStageWindowManager {
  ensureStageBoundsHandler()

  const getConfig = () => params.appConfig.get() ?? { language: 'en', windows: [], microphoneToggleHotkey: 'Scroll' as const }

  let currentWindow: BrowserWindow | undefined
  const createdListeners = new Set<(window: BrowserWindow) => void>()
  const lifecycleListeners: Record<StageLifecycleEvent, Set<() => void>> = {
    show: new Set(),
    hide: new Set(),
    minimize: new Set(),
    restore: new Set(),
  }
  // Tracks per-window disposers so a destroyed window never leaks listeners.
  let windowDisposers: Array<() => void> = []

  function emitLifecycle(event: StageLifecycleEvent) {
    for (const listener of lifecycleListeners[event]) {
      try {
        listener()
      }
      catch {}
    }
  }

  function handleNewBounds(window: BrowserWindow, newBounds: { x: number, y: number, width: number, height: number }) {
    if (window.isDestroyed())
      return

    if ((window as any).__is_programmatic_resize)
      return

    const config = getConfig()
    if (!config.windows || !Array.isArray(config.windows)) {
      config.windows = []
    }

    const updatedBounds = {
      x: Math.round(newBounds.x),
      y: Math.round(newBounds.y),
      width: Math.round(newBounds.width),
      height: Math.round(newBounds.height),
    }

    // Always update 'actor' as it represents the active state
    const existingConfigIndex = config.windows.findIndex((w: any) => w.title === 'AIRI' && w.tag === 'actor')
    if (existingConfigIndex === -1) {
      config.windows.push({
        title: 'AIRI',
        tag: 'actor',
        ...updatedBounds,
      })
    }
    else {
      config.windows[existingConfigIndex] = {
        ...config.windows[existingConfigIndex],
        ...updatedBounds,
      }
    }

    // If dating sim is active, also save to 'actor-dating-sim'
    if ((window as any).__is_dating_sim_active) {
      const dsConfigIndex = config.windows.findIndex((w: any) => w.title === 'AIRI' && w.tag === 'actor-dating-sim')
      if (dsConfigIndex === -1) {
        config.windows.push({
          title: 'AIRI',
          tag: 'actor-dating-sim',
          ...updatedBounds,
        })
      }
      else {
        config.windows[dsConfigIndex] = {
          ...config.windows[dsConfigIndex],
          ...updatedBounds,
        }
      }
    }

    params.appConfig.update(config)
  }

  async function createStageWindow(): Promise<BrowserWindow> {
    const actorConfig = getConfig().windows?.find((w: any) => w.title === 'AIRI' && w.tag === 'actor')

    let initialWidth = actorConfig?.width ?? 450.0
    let initialHeight = actorConfig?.height ?? 600.0
    let initialX = actorConfig?.x
    let initialY = actorConfig?.y

    if (initialX !== undefined && initialY !== undefined && !isNaN(initialX) && !isNaN(initialY)) {
      const valid = ensureWindowInVisibleBounds({
        x: Math.round(initialX),
        y: Math.round(initialY),
        width: Math.round(initialWidth),
        height: Math.round(initialHeight),
      })
      initialX = valid.x
      initialY = valid.y
      initialWidth = valid.width
      initialHeight = valid.height
    }
    else {
      try {
        const primaryDisplay = screen.getPrimaryDisplay()
        const workArea = primaryDisplay.workArea
        initialX = Math.round(workArea.x + workArea.width - initialWidth - 32)
        initialY = Math.round(workArea.y + workArea.height - initialHeight - 32)
      }
      catch (e) {
        console.warn('Failed to calculate default Stage window position:', e)
      }
    }

    const window = new ElectronBrowserWindow({
      title: 'AIRI - Actor Stage',
      width: initialWidth,
      height: initialHeight,
      x: initialX,
      y: initialY,
      show: false,
      icon,
      webPreferences: {
        preload: resolve(dirname(fileURLToPath(import.meta.url)), '../preload/index.cjs'),
        sandbox: true,
      },
      type: 'panel',
      alwaysOnTop: true,
      maximizable: false,
      ...transparentWindowConfig(),
    })

    window.setMovable(true)
    window.setResizable(true)

    ;(window as any).on('maximize', (e: any) => {
      e.preventDefault()
      window.unmaximize()
    })

    const { context } = createContext(ipcMain, window)
    await setupBaseWindowElectronInvokes({ context, window, serverChannel: params.serverChannel, i18n: params.i18n })

    if (!isLinux) {
      defineInvokeHandler(context, electronStartDraggingWindow, (_payload, handlerOptions: any) => {
        try {
          const sender = handlerOptions?.raw?.ipcMainEvent?.sender
          const win = sender ? (ElectronBrowserWindow.fromWebContents(sender) ?? window) : window
          const windowId = win.getNativeWindowHandle()
          startDraggingWindow(windowId)
        }
        catch (error) {
          console.error(error)
        }
      })
    }

    function restoreBounds() {
      const config = getConfig()
      const currentActorConfig = config.windows?.find((w: any) => w.title === 'AIRI' && w.tag === 'actor')
      const x = currentActorConfig?.x
      const y = currentActorConfig?.y
      const width = currentActorConfig?.width ?? 450.0
      const height = currentActorConfig?.height ?? 600.0
      if (x !== undefined && y !== undefined && !isNaN(x) && !isNaN(y)) {
        const valid = ensureWindowInVisibleBounds({
          x: Math.round(x),
          y: Math.round(y),
          width: Math.round(width),
          height: Math.round(height),
        })
        if (!window.isDestroyed())
          window.setBounds(valid)
      }
    }

    const throttledHandleNewBounds = throttle((bounds: { x: number, y: number, width: number, height: number }) => handleNewBounds(window, bounds), 200)

    const onResize = () => {
      if (!window.isDestroyed()) {
        throttledHandleNewBounds(window.getBounds())
      }
    }
    const onMove = () => {
      if (!window.isDestroyed()) {
        throttledHandleNewBounds(window.getBounds())
      }
    }
    const onReadyToShow = () => {
      restoreBounds()
      if (isStageVisible && !window.isDestroyed()) {
        window.show()
      }
      setTimeout(() => restoreBounds(), 500)
    }
    const onClose = (event: Electron.Event) => {
      if (isAppQuitting) {
        return
      }
      event.preventDefault()
      window.hide()
    }
    const onShow = () => {
      isStageVisible = true
      notifyMainWindow(true)
      emitLifecycle('show')
    }
    const onHide = () => {
      isStageVisible = false
      notifyMainWindow(false)
      emitLifecycle('hide')
    }
    const onMinimize = () => emitLifecycle('minimize')
    const onRestore = () => emitLifecycle('restore')
    const onClosed = () => {
      for (const dispose of windowDisposers)
        dispose()
      windowDisposers = []
      if (currentWindow === window)
        currentWindow = undefined
      inFlightEnsurePromise = null
    }

    window.on('resize', onResize)
    window.on('move', onMove)
    window.on('ready-to-show', onReadyToShow)
    window.on('close', onClose)
    window.on('show', onShow)
    window.on('hide', onHide)
    window.on('minimize', onMinimize)
    window.on('restore', onRestore)
    window.on('closed', onClosed)
    windowDisposers = [
      () => window.removeListener('resize', onResize),
      () => window.removeListener('move', onMove),
      () => window.removeListener('ready-to-show', onReadyToShow),
      () => window.removeListener('close', onClose),
      () => window.removeListener('show', onShow),
      () => window.removeListener('hide', onHide),
      () => window.removeListener('minimize', onMinimize),
      () => window.removeListener('restore', onRestore),
      () => window.removeListener('closed', onClosed),
    ]

    currentWindow = window
    await load(window, withHashRoute(baseUrl(resolve(dirname(fileURLToPath(import.meta.url)), '..', 'renderer')), '/actor'))

    for (const listener of createdListeners) {
      try {
        listener(window)
      }
      catch {}
    }

    return window
  }

  let inFlightEnsurePromise: Promise<BrowserWindow | null> | null = null

  async function ensureWindow(): Promise<BrowserWindow | null> {
    if (isStageDisabledByFlag()) {
      console.info('[@proj-airi/stage-tamagotchi] [Stage] WebGL Actor Stage disabled via --disable-webgl-stage flag.')
      return null
    }
    if (currentWindow && !currentWindow.isDestroyed())
      return currentWindow

    if (inFlightEnsurePromise)
      return inFlightEnsurePromise

    inFlightEnsurePromise = (async () => {
      try {
        const window = await createStageWindow()
        return window
      }
      finally {
        inFlightEnsurePromise = null
      }
    })()

    return inFlightEnsurePromise
  }

  return {
    ensureWindow,
    hasWindow: () => !!currentWindow && !currentWindow.isDestroyed(),
    getExistingWindow: () => (currentWindow && !currentWindow.isDestroyed() ? currentWindow : undefined),
    isDestroyed: () => !currentWindow || currentWindow.isDestroyed(),
    isVisible: () => !!currentWindow && !currentWindow.isDestroyed() && currentWindow.isVisible(),
    show: () => {
      if (currentWindow && !currentWindow.isDestroyed())
        currentWindow.show()
    },
    hide: () => {
      if (currentWindow && !currentWindow.isDestroyed())
        currentWindow.hide()
    },
    showInactive: () => {
      if (currentWindow && !currentWindow.isDestroyed())
        currentWindow.showInactive()
    },
    setAlwaysOnTop: (flag, level = 'screen-saver', relativeLevel = 1) => {
      if (currentWindow && !currentWindow.isDestroyed()) {
        if (flag) {
          currentWindow.setAlwaysOnTop(true, level as any, relativeLevel)
        }
        else {
          currentWindow.setAlwaysOnTop(false)
        }
      }
    },
    setBounds: (bounds) => {
      if (currentWindow && !currentWindow.isDestroyed())
        currentWindow.setBounds(bounds)
    },
    getBounds: () => {
      if (currentWindow && !currentWindow.isDestroyed())
        return currentWindow.getBounds()
      return undefined
    },
    on: (event, listener) => {
      if (currentWindow && !currentWindow.isDestroyed())
        currentWindow.on(event as any, listener as any)
      return () => {
        if (currentWindow && !currentWindow.isDestroyed())
          currentWindow.removeListener(event as any, listener as any)
      }
    },
    removeListener: (event, listener) => {
      if (currentWindow && !currentWindow.isDestroyed())
        currentWindow.removeListener(event as any, listener as any)
    },
    onWindowCreated: (listener) => {
      createdListeners.add(listener)
      return () => {
        createdListeners.delete(listener)
      }
    },
    onLifecycle: (event, listener) => {
      lifecycleListeners[event].add(listener)
      return () => {
        lifecycleListeners[event].delete(listener)
      }
    },
    capturePage: async () => {
      if (currentWindow && !currentWindow.isDestroyed())
        return (await currentWindow.webContents.capturePage()).toPNG()
      return null
    },
    destroy: () => {
      if (currentWindow && !currentWindow.isDestroyed()) {
        currentWindow.removeAllListeners()
        currentWindow.destroy()
      }
      currentWindow = undefined
      inFlightEnsurePromise = null
    },
  }
}
