import type { globalAppConfigSchema } from '../../configs/global'
import type { Config } from '../../libs/electron/persistence'
import type { I18n } from '../../libs/i18n'
import type { ServerChannel } from '../../services/airi/channel-server'

import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import clickDragPlugin from 'electron-click-drag-plugin'

import { defineInvokeHandler } from '@moeru/eventa'
import { createContext } from '@moeru/eventa/adapters/electron/main'
import { app, BrowserWindow, ipcMain } from 'electron'
import { throttle } from 'es-toolkit'
import { isLinux } from 'std-env'

import icon from '../../../../resources/icon.png?asset'

import { electronStartDraggingWindow } from '../../../shared/eventa'
import { baseUrl, load, withHashRoute } from '../../libs/electron/location'
import { ensureWindowInVisibleBounds } from '../shared/display'
import { setupBaseWindowElectronInvokes, transparentWindowConfig } from '../shared/window'

let isAppQuitting = false
app.on('before-quit', () => {
  isAppQuitting = true
})

let isStageVisible = true

export function setStageVisibleState(visible: boolean) {
  isStageVisible = visible
}

export async function setupActorStageWindow(params: {
  appConfig: Config<typeof globalAppConfigSchema>
  serverChannel: ServerChannel
  i18n: I18n
}) {
  const getConfig = () => params.appConfig.get() ?? { language: 'en', windows: [], microphoneToggleHotkey: 'Scroll' as const }
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

  const window = new BrowserWindow({
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
        const win = sender ? (BrowserWindow.fromWebContents(sender) ?? window) : window
        const windowId = win.getNativeWindowHandle()
        clickDragPlugin.startDrag(windowId)
      }
      catch (error) {
        console.error(error)
      }
    })
  }

  // Handle stage window resizing and centering
  ipcMain.handle('stage-window-set-bounds', (_e, payload) => {
    if (payload?.width && payload?.height) {
      window.setSize(Math.round(payload.width), Math.round(payload.height), true)
    }
    if (payload?.center) {
      window.center()
    }
  })

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
      window.setBounds(valid)
    }
  }

  window.on('ready-to-show', () => {
    restoreBounds()
    if (isStageVisible) {
      window.show()
    }
    setTimeout(() => restoreBounds(), 500)
  })

  window.on('close', (event) => {
    if (isAppQuitting) {
      return
    }
    event.preventDefault()
    window.hide()
  })

  window.on('show', () => {
    isStageVisible = true
    const mainWin = BrowserWindow.getAllWindows().find(w => (w as any).__is_main_window === true)
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.webContents.send('stage-window-state', true)
    }
  })

  window.on('hide', () => {
    isStageVisible = false
    const mainWin = BrowserWindow.getAllWindows().find(w => (w as any).__is_main_window === true)
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.webContents.send('stage-window-state', false)
    }
  })

  function handleNewBounds(newBounds: { x: number, y: number, width: number, height: number }) {
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

  const throttledHandleNewBounds = throttle(handleNewBounds, 200)

  window.on('resize', () => {
    if (!window.isDestroyed()) {
      throttledHandleNewBounds(window.getBounds())
    }
  })
  window.on('move', () => {
    if (!window.isDestroyed()) {
      throttledHandleNewBounds(window.getBounds())
    }
  })

  await load(window, withHashRoute(baseUrl(resolve(dirname(fileURLToPath(import.meta.url)), '..', 'renderer')), '/actor'))

  return window
}
