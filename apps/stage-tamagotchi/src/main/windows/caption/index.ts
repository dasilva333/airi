import type { BrowserWindow, BrowserWindowConstructorOptions, Rectangle } from 'electron'
import type { InferOutput } from 'valibot'

import type { globalAppConfigSchema } from '../../configs/global'
import type { Config } from '../../libs/electron/persistence'
import type { I18n } from '../../libs/i18n'
import type { ServerChannel } from '../../services/airi/channel-server'

import { createHash } from 'node:crypto'
import { join, resolve } from 'node:path'

import { defineInvokeHandler } from '@moeru/eventa'
import { createContext } from '@moeru/eventa/adapters/electron/main'
import { BrowserWindow as ElectronBrowserWindow, ipcMain, screen, shell } from 'electron'
import { debounce, throttle } from 'es-toolkit'
import { isMacOS } from 'std-env'
import { boolean, number, object, optional, record, string } from 'valibot'

import icon from '../../../../resources/icon.png?asset'

import { captionGetIsFollowingWindow, captionIsFollowingWindowChanged } from '../../../shared/eventa'
import { onAppBeforeQuit } from '../../libs/bootkit/lifecycle'
import { baseUrl, getElectronMainDirname, load, withHashRoute } from '../../libs/electron/location'
import { createConfig } from '../../libs/electron/persistence'
import { createReusableWindow } from '../../libs/electron/window-manager'
import { mapForBreakpoints, resolutionBreakpoints, widthFrom } from '../shared/display'
import { setupBaseWindowElectronInvokes, transparentWindowConfig } from '../shared/window'

const captionConfigSchema = object({
  isFollowing: boolean(),
  matrices: record(string(), object({
    bounds: object({
      x: number(),
      y: number(),
      width: number(),
      height: number(),
    }),
    relativeToMain: optional(object({
      dx: number(),
      dy: number(),
    })),
  })),
})
type CaptionConfig = InferOutput<typeof captionConfigSchema>

function computeDisplayMatrixHash(): string {
  const displays = screen.getAllDisplays()
  const signature = displays
    .slice()
    .sort((a, b) => (a.bounds.x - b.bounds.x) || (a.bounds.y - b.bounds.y))
    .map(d => [d.bounds.x, d.bounds.y, d.bounds.width, d.bounds.height, d.scaleFactor ?? 1].join(','))
    .join('|')

  return createHash('sha256').update(signature).digest('hex').slice(0, 16)
}

function clampBoundsWithinRect(bounds: Rectangle, rect: Rectangle): Rectangle {
  const x = Math.min(Math.max(bounds.x, rect.x), rect.x + rect.width - bounds.width)
  const y = Math.min(Math.max(bounds.y, rect.y), rect.y + rect.height - bounds.height)
  return { x, y, width: bounds.width, height: bounds.height }
}

function computeInitialCaptionBounds(params: { stageWindow: BrowserWindow, captionOptions?: Partial<Rectangle> }): Rectangle {
  const mainBounds = params.stageWindow.getBounds()
  const displayWorkArea = screen.getDisplayMatching(mainBounds).workArea

  // Base sizing from display width with sensible caps
  const width = mapForBreakpoints(
    displayWorkArea.width,
    {
      '720p': widthFrom(displayWorkArea, { percentage: 0.9, max: { actual: 560 }, min: { actual: 280 } }),
      '1080p': widthFrom(displayWorkArea, { percentage: 0.5, max: { actual: 640 }, min: { actual: 320 } }),
      '2k': widthFrom(displayWorkArea, { percentage: 0.4, max: { actual: 720 }, min: { actual: 360 } }),
      '4k': widthFrom(displayWorkArea, { percentage: 0.33, max: { actual: 768 }, min: { actual: 420 } }),
    },
    { breakpoints: resolutionBreakpoints },
  )
  const height = Math.max(Math.floor(width / 3.2), 120)

  const margin = 16
  // Prefer to the right of stage window, else to the left, else bottom centered
  let x = mainBounds.x + mainBounds.width + margin
  let y = mainBounds.y + mainBounds.height - height

  const rightEdge = x + width
  const displayRight = displayWorkArea.x + displayWorkArea.width

  if (rightEdge > displayRight) {
    // Place to the left
    x = mainBounds.x - width - margin
  }

  // If still out of bounds horizontally, fallback to bottom center
  if (x < displayWorkArea.x || (x + width) > displayRight) {
    x = displayWorkArea.x + Math.floor((displayWorkArea.width - width) / 2)
  }

  // Clamp vertically
  if (y < displayWorkArea.y) {
    y = displayWorkArea.y + margin
  }

  const initial = clampBoundsWithinRect({ x, y, width, height }, displayWorkArea)

  return { ...initial, ...params.captionOptions }
}

function createCaptionWindow(options?: BrowserWindowConstructorOptions) {
  const window = new ElectronBrowserWindow({
    title: 'Caption',
    width: 480,
    height: 180,
    show: false,
    icon,
    webPreferences: {
      preload: join(getElectronMainDirname(), '../preload/index.cjs'),
      sandbox: true,
    },
    // Thanks to [@HeartArmy](https://github.com) for the tip implementation.
    //
    // https://github.com/electron/electron/issues/10078#issuecomment-3410164802
    // https://stackoverflow.com/questions/39835282/set-browserwindow-always-on-top-even-other-app-is-in-fullscreen-electron-mac
    type: 'panel',
    ...transparentWindowConfig(),
    ...options,
  })

  // Click-through is controlled by caller via setIgnoreMouseEvents
  // Avoid window buttons on macOS frameless windows
  // Thanks to [@HeartArmy](https://github.com) for the tip implementation.
  //
  // https://github.com/electron/electron/issues/10078#issuecomment-3410164802
  // https://stackoverflow.com/questions/39835282/set-browserwindow-always-on-top-even-other-app-is-in-fullscreen-electron-mac
  window.setAlwaysOnTop(true, 'screen-saver', 2)
  window.setFullScreenable(false)
  window.setVisibleOnAllWorkspaces(true)
  if (isMacOS) {
    window.setWindowButtonVisibility(false)
  }

  window.on('ready-to-show', () => window.show())
  window.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  return window
}

export function setupCaptionWindowManager(params: {
  mainWindow: BrowserWindow
  stageWindow: BrowserWindow
  serverChannel: ServerChannel
  i18n: I18n
  appConfig: Config<typeof globalAppConfigSchema>
}) {
  const matrixHash = computeDisplayMatrixHash()

  const {
    setup: setupConfig,
    get: getConfigRaw,
    update: updateConfig,
  } = createConfig('windows-caption', 'config.json', captionConfigSchema, {
    default: { isFollowing: true, matrices: {} },
    autoHeal: true,
  })
  const getConfig = (): CaptionConfig => getConfigRaw() ?? { isFollowing: true, matrices: {} }

  setupConfig()

  let isFollowing = getConfig().isFollowing ?? true
  let lastProgrammaticMoveAt = 0

  // Keep references to listeners so we can detach when toggling
  let detachMainMoveListener: (() => void) | undefined

  // Note: when following window, we compute and persist the current relative offset
  // and start following without docking, so no immediate reposition is needed here.

  function computeRelativeOffset(win: BrowserWindow): { dx: number, dy: number } {
    const caption = win.getBounds()
    const main = params.stageWindow.getBounds()
    return { dx: caption.x - main.x, dy: caption.y - main.y }
  }

  function calculateDockingBounds(win: BrowserWindow, dock?: 'top' | 'bottom'): Rectangle {
    const main = params.stageWindow.getBounds()
    const b = win.getBounds()

    if (dock === 'bottom') {
      return {
        x: main.x,
        y: Math.round(main.y + main.height), // Flush with bottom of Stage
        width: main.width,
        height: 300,
      }
    }

    if (dock === 'top') {
      const topHeight = 240
      return {
        x: main.x,
        y: Math.round(main.y - topHeight), // Flush with top of Stage
        width: main.width,
        height: topHeight,
      }
    }

    return b
  }

  function syncGlobalConfig() {
    const currentEnabled = isVisible()
    const appConfig = params.appConfig.get()
    const windows = appConfig?.windows ?? []
    const index = windows.findIndex((w: any) => w.tag === 'caption')

    const captionEntry = {
      tag: 'caption',
      enabled: currentEnabled,
    }

    if (index !== -1) {
      windows[index] = { ...windows[index], ...captionEntry }
    }
    else {
      windows.push(captionEntry)
    }
    params.appConfig.update({
      ...appConfig,
      language: appConfig?.language ?? 'en',
      microphoneToggleHotkey: appConfig?.microphoneToggleHotkey ?? 'Scroll',
      windows,
    })
  }

  function applyBounds(win: BrowserWindow, bounds: Rectangle, options: { programmatic?: boolean, resizable?: boolean } = {}) {
    if (win.isDestroyed())
      return

    const current = win.getBounds()
    if (Math.abs(current.x - bounds.x) < 1 && Math.abs(current.y - bounds.y) < 1 && Math.abs(current.width - bounds.width) < 1 && Math.abs(current.height - bounds.height) < 1)
      return

    if (options.programmatic) {
      lastProgrammaticMoveAt = Date.now()
    }

    // Force resizable to true during move to overcome shaping constraints
    win.setResizable(true)

    try {
      win.setBounds({
        x: Math.round(bounds.x),
        y: Math.round(bounds.y),
        width: Math.round(bounds.width),
        height: Math.round(bounds.height),
      })
    }
    catch (err: any) {
      console.error('[@proj-airi/stage-tamagotchi] [CaptionManager] applyBounds failed:', err.message)
    }
    finally {
      // Lock resizable state for docked windows
      if (options.resizable !== undefined) {
        win.setResizable(options.resizable)
      }
      else {
        win.setResizable(false)
      }
    }
  }

  function followStageWindow(win: BrowserWindow) {
    const cfg = getConfig() ?? { isFollowing, matrices: {} }
    const initialOffset = cfg?.matrices?.[matrixHash]?.relativeToMain ?? computeRelativeOffset(win)

    const cfgToSave = getConfig() ?? { isFollowing, matrices: {} }
    cfgToSave.matrices[matrixHash] = { ...cfgToSave.matrices[matrixHash], relativeToMain: initialOffset }
    updateConfig(cfgToSave)

    const syncNow = () => {
      if (win.isDestroyed() || params.stageWindow.isDestroyed())
        return

      const config = params.appConfig.get()
      const dock = config?.windows?.find((w: any) => w.tag === 'caption')?.dock as 'top' | 'bottom' | undefined

      let target: Rectangle
      if (dock) {
        target = calculateDockingBounds(win, dock)
      }
      else {
        const stored = getConfig()?.matrices[matrixHash]?.relativeToMain ?? initialOffset
        const main = params.stageWindow.getBounds()
        const b = win.getBounds()
        target = {
          x: main.x + stored.dx,
          y: main.y + stored.dy,
          width: b.width,
          height: b.height,
        }
      }

      const workArea = screen.getDisplayMatching(target).workArea
      const clamped = clampBoundsWithinRect(target, workArea)

      if (lastTarget && Math.abs(lastTarget.x - clamped.x) < 1 && Math.abs(lastTarget.y - clamped.y) < 1 && Math.abs(lastTarget.width - clamped.width) < 1 && Math.abs(lastTarget.height - clamped.height) < 1)
        return

      lastTarget = clamped
      applyBounds(win, clamped, { programmatic: true, resizable: !dock })
    }

    let lastTarget: Rectangle | undefined
    const moveThrottled = throttle(syncNow, 1000 / 60)
    const settleDebounced = debounce(() => {
      if (lastTarget)
        applyBounds(win, lastTarget, { programmatic: true })
    }, 200)

    const onMainChange = () => {
      moveThrottled()
      settleDebounced()
    }
    triggerMoveInternal = () => {
      syncNow()
      onMainChange()
    }
    onMainChange()
    params.stageWindow.on('move', onMainChange)
    params.stageWindow.on('resize', onMainChange)
    detachMainMoveListener = () => {
      moveThrottled.cancel()
      settleDebounced.cancel()
      if (params.stageWindow && !params.stageWindow.isDestroyed()) {
        params.stageWindow.removeListener('move', onMainChange)
        params.stageWindow.removeListener('resize', onMainChange)
      }
      triggerMoveInternal = undefined
    }

    onAppBeforeQuit(() => detachFromMain())
  }

  function detachFromMain() {
    detachMainMoveListener?.()
    detachMainMoveListener = undefined
    triggerMoveInternal = undefined
  }

  let triggerMoveInternal: (() => void) | undefined
  let eventaContext: ReturnType<typeof createContext>['context'] | undefined
  let currentWindow: BrowserWindow | undefined
  const visibilityListeners = new Set<() => void>()

  const emitVisibilityChanged = () => {
    for (const listener of visibilityListeners) {
      try {
        listener()
      }
      catch {}
    }
  }

  const reusable = createReusableWindow(async () => {
    ipcMain.setMaxListeners(0)
    const window = createCaptionWindow()
    currentWindow = window
    const { context } = createContext(ipcMain, window)
    eventaContext = context

    await setupBaseWindowElectronInvokes({ context, window, serverChannel: params.serverChannel, i18n: params.i18n })

    const cfg = getConfig()
    const saved = cfg?.matrices?.[matrixHash]?.bounds

    if (saved) {
      const workArea = screen.getDisplayMatching(saved).workArea
      const clamped = clampBoundsWithinRect(saved, workArea)
      window.setBounds(clamped)
    }
    else {
      const initialBounds = computeInitialCaptionBounds({ stageWindow: params.stageWindow })
      window.setBounds(initialBounds)
    }

    const persistBounds = () => {
      if (window.isDestroyed())
        return
      const config = getConfig() ?? { isFollowing, matrices: {} }
      const b = window.getBounds()
      config.matrices[matrixHash] = { ...config.matrices[matrixHash], bounds: b }
      config.isFollowing = isFollowing
      if (isFollowing && Date.now() - lastProgrammaticMoveAt > 100) {
        const rel = computeRelativeOffset(window)
        config.matrices[matrixHash] = { ...config.matrices[matrixHash], bounds: b, relativeToMain: rel }
      }
      updateConfig(config)
    }

    window.on('resize', persistBounds)
    window.on('move', persistBounds)
    window.on('show', () => {
      emitVisibilityChanged()
      syncGlobalConfig()
      console.log('[@proj-airi/stage-tamagotchi] [Main] Caption window shown, broadcasting state')
      if (params.mainWindow && !params.mainWindow.isDestroyed()) {
        params.mainWindow.webContents.send('caption-window-state', true)
      }
    })
    window.on('hide', () => {
      emitVisibilityChanged()
      syncGlobalConfig()
      console.log('[@proj-airi/stage-tamagotchi] [Main] Caption window hidden, broadcasting state')
      if (params.mainWindow && !params.mainWindow.isDestroyed()) {
        params.mainWindow.webContents.send('caption-window-state', false)
      }
    })

    await load(window, withHashRoute(baseUrl(resolve(getElectronMainDirname(), '..', 'renderer')), '/caption'))

    const cleanupGetAttached = defineInvokeHandler(context, captionGetIsFollowingWindow, async () => isFollowing)
    try {
      context.emit(captionIsFollowingWindowChanged, isFollowing)
    }
    catch {}

    if (isFollowing) {
      followStageWindow(window)
    }

    window.on('closed', () => {
      detachFromMain()
      try {
        cleanupGetAttached()
      }
      catch {}

      if (currentWindow === window) {
        currentWindow = undefined
      }
      eventaContext = undefined
      emitVisibilityChanged()
      console.log('[@proj-airi/stage-tamagotchi] [Main] Caption window closed, broadcasting state')
      if (params.mainWindow && !params.mainWindow.isDestroyed()) {
        params.mainWindow.webContents.send('caption-window-state', false)
      }
    })

    // Captions are click-through by default so you can click whatever is behind them.
    // We use { forward: true } so the renderer can still detect mouseover for fading.
    window.setIgnoreMouseEvents(true, { forward: true })

    return window
  })

  async function getWindow(): Promise<BrowserWindow> {
    return reusable.getWindow()
  }

  async function setFollowWindow(isFollowingWindow: boolean) {
    isFollowing = isFollowingWindow
    const window = await reusable.getWindow()
    if (isFollowing) {
      const rel = computeRelativeOffset(window)
      const cfg = getConfig() ?? { isFollowing, matrices: {} }
      cfg.matrices[matrixHash] = { ...cfg.matrices[matrixHash], relativeToMain: rel }
      updateConfig(cfg)
      followStageWindow(window)
    }
    else {
      detachFromMain()
    }

    const config = getConfig() ?? { isFollowing, matrices: {} }
    config.isFollowing = isFollowing
    updateConfig(config)
    window.show()

    try {
      eventaContext?.emit(captionIsFollowingWindowChanged, isFollowing)
    }
    catch {}

    syncGlobalConfig()
  }

  async function toggleFollowWindow() {
    await setFollowWindow(!isFollowing)
  }

  function getIsFollowingWindow(): boolean {
    return isFollowing
  }

  async function resetToSide() {
    const window = await reusable.getWindow()
    lastProgrammaticMoveAt = Date.now()
    const initialBounds = computeInitialCaptionBounds({ stageWindow: params.stageWindow })
    window.setBounds(initialBounds)

    const config = getConfig() ?? { isFollowing, matrices: {} }
    const b = window.getBounds()
    const rel = computeRelativeOffset(window)
    config.matrices[matrixHash] = { ...config.matrices[matrixHash], bounds: b, relativeToMain: rel }
    config.isFollowing = isFollowing
    updateConfig(config)
  }

  function isVisible(): boolean {
    return Boolean(currentWindow && !currentWindow.isDestroyed() && currentWindow.isVisible())
  }

  async function toggleVisibility(enabled?: boolean) {
    if (enabled === undefined) {
      if (isVisible()) {
        currentWindow?.hide()
      }
      else {
        const window = await reusable.getWindow()
        if (window.isMinimized()) {
          window.restore()
        }
        window.show()
        window.focus()
      }
      return
    }

    if (enabled) {
      const window = await reusable.getWindow()
      if (window.isMinimized()) {
        window.restore()
      }
      window.show()
      window.focus()
    }
    else {
      currentWindow?.hide()
    }
  }

  function onVisibilityChanged(listener: () => void): () => void {
    visibilityListeners.add(listener)
    return () => {
      visibilityListeners.delete(listener)
    }
  }

  async function triggerMove(forcedDock?: 'top' | 'bottom') {
    const window = await reusable.getWindow()
    if (window.isDestroyed())
      return

    if (triggerMoveInternal) {
      triggerMoveInternal()
      return
    }

    const config = params.appConfig.get()
    const dock = forcedDock || (config?.windows?.find((w: any) => w.tag === 'caption')?.dock as 'top' | 'bottom' | undefined)

    if (dock) {
      const target = calculateDockingBounds(window, dock)
      const workArea = screen.getDisplayMatching(target).workArea
      const clamped = clampBoundsWithinRect(target, workArea)
      applyBounds(window, clamped, { programmatic: true, resizable: false })
    }
  }

  return {
    getWindow,
    setFollowWindow,
    toggleFollowWindow,
    getIsFollowingWindow,
    resetToSide,
    isVisible,
    toggleVisibility,
    onVisibilityChanged,
    triggerMove,
  }
}
