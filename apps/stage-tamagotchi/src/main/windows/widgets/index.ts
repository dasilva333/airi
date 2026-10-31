import type { BrowserWindow, Rectangle } from 'electron'
import type { InferOutput } from 'valibot'

import type { WidgetsAddPayload, WidgetSnapshot } from '../../../shared/eventa'
import type { I18n } from '../../libs/i18n'
import type { ServerChannel } from '../../services/airi/channel-server'

import { join, resolve } from 'node:path'

import { createContext } from '@moeru/eventa/adapters/electron/main'
import { BrowserWindow as ElectronBrowserWindow, ipcMain, Menu, screen, shell } from 'electron'
import { isMacOS } from 'std-env'
import { number, object, optional } from 'valibot'

import icon from '../../../../resources/icon.png?asset'

import { widgetsClearEvent, widgetsRemoveEvent, widgetsRenderEvent, widgetsUpdateEvent } from '../../../shared/eventa'
import { baseUrl, getElectronMainDirname, load, withHashRoute } from '../../libs/electron/location'
import { createConfig } from '../../libs/electron/persistence'
import { createReusableWindow } from '../../libs/electron/window-manager'
import { setupArtistryBridge } from '../../services/airi/widgets/artistry-bridge'
import { showWindowOnAllWorkspaces } from '../shared/app-icon'
import { spotlightLikeWindowConfig, transparentWindowConfig } from '../shared/window'
import { setupWidgetsWindowInvokes } from './rpc/index.electron'

export interface WidgetsWindowManager {
  getWindow: () => Promise<BrowserWindow>
  openWindow: (params?: { id?: string }) => Promise<void>
  pushWidget: (payload: WidgetsAddPayload) => Promise<string>
  updateWidget: (payload: { id: string, componentProps?: Record<string, any> }) => Promise<void>
  removeWidget: (id: string) => Promise<void>
  clearWidgets: () => Promise<void>
  getWidgetSnapshot: (id: string) => WidgetSnapshot | undefined
  prepareWidgetWindow: (options?: { id?: string }) => string
  resizeWidgetWindow: (payload: { id?: string, width?: number, height?: number, window?: BrowserWindow }) => Promise<void>
}

const widgetsWindowConfigSchema = object({
  bounds: optional(object({
    x: number(),
    y: number(),
    width: number(),
    height: number(),
  })),
})

type WidgetsWindowConfig = InferOutput<typeof widgetsWindowConfigSchema>

function computeDefaultBounds(): Rectangle {
  const primary = screen.getPrimaryDisplay().workArea
  const width = Math.min(500, Math.floor(primary.width * 0.35))
  const height = Math.min(500, Math.floor(primary.height * 0.6))
  const x = primary.x + primary.width - width - 16
  const y = primary.y + 16
  return { x, y, width, height }
}

function computeStickerBounds(weight?: number, pos?: string): Rectangle {
  const primary = screen.getPrimaryDisplay().workArea
  const clampedWeight = Math.max(0.1, Math.min(1.0, typeof weight === 'number' && !Number.isNaN(weight) ? weight : 0.5))
  // Size range: 160px (at 0.1) to 300px (at 1.0)
  const size = Math.round(160 + (clampedWeight - 0.1) * (140 / 0.9))

  // Random jitter (+/- 20px) to prevent multiple stickers from stacking exactly
  const jitterX = Math.round((Math.random() - 0.5) * 40)
  const jitterY = Math.round((Math.random() - 0.5) * 40)
  const margin = 36

  const validPositions = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight']
  const targetPos = (!pos || pos === 'random' || !validPositions.includes(pos))
    ? validPositions[Math.floor(Math.random() * validPositions.length)]
    : pos

  let x: number
  let y: number

  switch (targetPos) {
    case 'topLeft':
      x = primary.x + margin + jitterX
      y = primary.y + margin + jitterY
      break
    case 'topRight':
      x = primary.x + primary.width - size - margin + jitterX
      y = primary.y + margin + jitterY
      break
    case 'bottomLeft':
      x = primary.x + margin + jitterX
      y = primary.y + primary.height - size - margin + jitterY
      break
    case 'bottomRight':
    default:
      x = primary.x + primary.width - size - margin + jitterX
      y = primary.y + primary.height - size - margin + jitterY
      break
  }

  return {
    x: Math.max(primary.x, Math.min(x, primary.x + primary.width - size)),
    y: Math.max(primary.y, Math.min(y, primary.y + primary.height - size)),
    width: size,
    height: size,
  }
}

function createStickerWindow(bounds: Rectangle): ElectronBrowserWindow {
  const window = new ElectronBrowserWindow({
    title: 'AIRI — Sticker',
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    show: false,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    type: 'panel',
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(getElectronMainDirname(), '../preload/index.cjs'),
      sandbox: true,
    },
    ...transparentWindowConfig(),
  })

  window.setAlwaysOnTop(true, 'screen-saver', 1)
  window.setFullScreenable(false)
  showWindowOnAllWorkspaces(window)
  if (isMacOS)
    window.setWindowButtonVisibility(false)

  window.on('ready-to-show', () => {
    if (!window.isDestroyed())
      window.showInactive()
  })

  return window
}

function createWidgetsWindow(options?: Electron.BrowserWindowConstructorOptions & { spotlight?: boolean }) {
  const { spotlight = true, ...rest } = options ?? {}
  const window = new ElectronBrowserWindow({
    title: 'AIRI — Widgets',
    width: 620,
    height: 760,
    show: false,
    icon,
    webPreferences: {
      preload: join(getElectronMainDirname(), '../preload/index.cjs'),
      sandbox: true,
    },
    // Top-level overlay style like other overlay windows
    type: 'panel',
    ...transparentWindowConfig(),
    ...(spotlight ? spotlightLikeWindowConfig() : {}),
    backgroundColor: '#00000000',
    ...rest,
  })

  // Keep on top like caption/main overlays
  window.setAlwaysOnTop(true, 'screen-saver', 1)
  window.setFullScreenable(false)
  showWindowOnAllWorkspaces(window)
  if (isMacOS)
    window.setWindowButtonVisibility(false)

  // DevTools toggle shortcut & input handling (F12, Ctrl+Shift+I, Cmd+Alt+I)
  window.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown')
      return

    const isF12 = input.key === 'F12'
    const isDevToolsShortcut = ((input.control || input.meta) && input.shift && input.key.toLowerCase() === 'i')
      || (input.alt && input.meta && input.key.toLowerCase() === 'i')

    if (isF12 || isDevToolsShortcut) {
      event.preventDefault()
      if (window.webContents.isDevToolsOpened()) {
        window.webContents.closeDevTools()
      }
      else {
        window.webContents.openDevTools({ mode: 'detach' })
      }
    }
  })

  // Right-click context menu with Inspect Element & Toggle Developer Tools
  window.webContents.on('context-menu', (_event, params) => {
    const menu = Menu.buildFromTemplate([
      {
        label: 'Inspect Element',
        click: () => {
          window.webContents.inspectElement(params.x, params.y)
          if (!window.webContents.isDevToolsOpened()) {
            window.webContents.openDevTools({ mode: 'detach' })
          }
        },
      },
      {
        label: 'Toggle Developer Tools',
        click: () => {
          if (window.webContents.isDevToolsOpened()) {
            window.webContents.closeDevTools()
          }
          else {
            window.webContents.openDevTools({ mode: 'detach' })
          }
        },
      },
    ])
    menu.popup()
  })

  window.on('ready-to-show', () => window.show())
  window.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  return window
}

interface WidgetRecord extends WidgetSnapshot {
  timer?: ReturnType<typeof setTimeout>
}

interface WidgetWindowContext {
  widgetId: string
  windowBuilder: () => Promise<BrowserWindow>
  window?: BrowserWindow
}

export function setupWidgetsWindowManager(params: {
  serverChannel: ServerChannel
  i18n: I18n
}): WidgetsWindowManager {
  const { setup, get: getConfigRaw, update } = createConfig('windows-widgets', 'config.json', widgetsWindowConfigSchema, {
    default: {},
    autoHeal: true,
  })
  const getConfig = (): WidgetsWindowConfig => getConfigRaw() ?? {}
  setup()

  let eventaContext: ReturnType<typeof createContext>['context'] | undefined
  const widgetRecords = new Map<string, WidgetRecord>()
  const windowContexts = new Map<string, WidgetWindowContext>()
  const standaloneWindows = new Map<string, BrowserWindow>()

  const rendererBase = baseUrl(resolve(getElectronMainDirname(), '..', 'renderer'))
  const defaultRoute = '/widgets'

  let pendingRoute: string | undefined
  let currentRoute: string | undefined

  let widgetsManager: WidgetsWindowManager | undefined

  const reusable = createReusableWindow(async () => {
    // TODO: once we refactored eventa to support window-namespaced contexts,
    // we can remove the setMaxListeners call below since eventa will be able to dispatch and
    // manage events within eventa's context system.
    ipcMain.setMaxListeners(0)

    const window = createWidgetsWindow()
    const { context } = createContext(ipcMain, window, { onlySameWindow: true })
    eventaContext = context

    const saved = getConfig().bounds
    if (saved) {
      const work = screen.getDisplayMatching(saved).workArea
      const clamped: Rectangle = {
        x: Math.min(Math.max(saved.x, work.x), work.x + work.width - saved.width),
        y: Math.min(Math.max(saved.y, work.y), work.y + work.height - saved.height),
        width: Math.min(saved.width, work.width),
        height: Math.min(saved.height, work.height),
      }
      window.setBounds(clamped)
    }
    else {
      window.setBounds(computeDefaultBounds())
    }

    const persist = () => {
      if (!window.isDestroyed()) {
        update({ bounds: window.getBounds() })
      }
    }
    window.on('resize', () => {
      if (!window.isDestroyed()) {
        persist()
      }
    })
    window.on('move', () => {
      if (!window.isDestroyed()) {
        persist()
      }
    })

    await setupWidgetsWindowInvokes({
      widgetWindow: window,
      widgetsManager: widgetsManager!,
      i18n: params.i18n,
      serverChannel: params.serverChannel,
      context,
    })

    const initialRoute = pendingRoute ?? defaultRoute
    await loadWithRoute(window, initialRoute)

    pendingRoute = undefined

    window.on('closed', () => {
      eventaContext = undefined
      currentRoute = undefined
      windowContexts.forEach((context) => {
        if (context.window === window)
          context.window = undefined
      })
    })
    return window
  })

  function prepareWidgetWindow(options?: { id?: string }): string {
    const id = options?.id ?? Math.random().toString(36).slice(2, 10)
    if (!windowContexts.has(id)) {
      windowContexts.set(id, {
        widgetId: id,
        windowBuilder: () => getWindow(),
        window: undefined,
      })
    }
    return id
  }

  function toSnapshot(record: WidgetRecord): WidgetSnapshot {
    const { timer: _timer, ...snapshot } = record
    return snapshot
  }

  function upsertRecord(snapshot: WidgetSnapshot) {
    const existing = widgetRecords.get(snapshot.id)
    if (existing?.timer)
      clearTimeout(existing.timer)

    const record: WidgetRecord = { ...snapshot }

    if (snapshot.ttlMs > 0) {
      record.timer = setTimeout(() => removeWidgetInternal(snapshot.id), snapshot.ttlMs)
    }

    widgetRecords.set(snapshot.id, record)
  }

  function removeWidgetInternal(id: string, emitEvent = true) {
    const existing = widgetRecords.get(id)
    if (!existing)
      return

    if (existing.timer)
      clearTimeout(existing.timer)

    widgetRecords.delete(id)
    windowContexts.delete(id)
    const standalone = standaloneWindows.get(id)
    if (standalone && !standalone.isDestroyed()) {
      standalone.close()
    }
    standaloneWindows.delete(id)

    if (emitEvent) {
      eventaContext?.emit(widgetsRemoveEvent, { id })
    }
  }

  async function loadWithRoute(window: BrowserWindow, route: string) {
    await load(window, withHashRoute(rendererBase, route))
    currentRoute = route
  }

  async function getWindowFromContext(context?: WidgetWindowContext): Promise<BrowserWindow> {
    if (!context)
      return getWindow()
    if (context.window && !context.window.isDestroyed())
      return context.window
    const resolved = await context.windowBuilder()
    context.window = resolved
    return resolved
  }

  async function showWindowWithRoute(route: string, context?: WidgetWindowContext) {
    pendingRoute = route
    const window = await getWindowFromContext(context)
    pendingRoute = undefined
    if (currentRoute !== route)
      await loadWithRoute(window, route)
    window.showInactive()
    if (context)
      context.window = window
    return window
  }

  async function getWindow(): Promise<BrowserWindow> {
    return reusable.getWindow()
  }

  async function openWindow(params?: { id?: string }) {
    const id = params?.id ? prepareWidgetWindow({ id: params.id }) : undefined
    const route = id ? `${defaultRoute}?id=${id}` : defaultRoute
    const context = id ? windowContexts.get(id) : undefined
    await showWindowWithRoute(route, context)
  }

  async function hideWindow(params?: { id?: string }) {
    const id = params?.id
    const context = id ? windowContexts.get(id) : undefined
    if (context?.window) {
      context.window.close()
    }
    else {
      const window = await getWindow()
      window.close()
    }
  }

  async function pushWidget(payload: WidgetsAddPayload): Promise<string> {
    const id = prepareWidgetWindow({ id: payload.id })
    const snapshot: WidgetSnapshot = {
      id,
      componentName: payload.componentName,
      componentProps: payload.componentProps ?? {},
      size: payload.size ?? 'm',
      ttlMs: payload.ttlMs ?? 0,
    }
    upsertRecord(snapshot)
    const context = windowContexts.get(id)
    const isSticker = payload.componentName === 'sticker'

    let window: BrowserWindow
    if (isSticker) {
      const bounds = payload.bounds
        ? {
            x: payload.bounds.x ?? 0,
            y: payload.bounds.y ?? 0,
            width: payload.bounds.width ?? 220,
            height: payload.bounds.height ?? 220,
          }
        : computeStickerBounds(payload.componentProps?.weight, payload.componentProps?.pos)

      window = createStickerWindow(bounds)
      standaloneWindows.set(id, window)

      window.on('closed', () => {
        standaloneWindows.delete(id)
        removeWidgetInternal(id, true)
      })

      const rendererDir = resolve(getElectronMainDirname(), '..', 'renderer')
      const target = baseUrl(rendererDir, 'sticker.html')
      const query: Record<string, string> = {
        id,
        stickerId: String(payload.componentProps?.stickerId || 'airi-happy'),
        src: String(payload.componentProps?.src || ''),
        weight: String(payload.componentProps?.weight ?? 0.5),
        ttlMs: String(payload.ttlMs ?? 0),
        pos: String(payload.componentProps?.pos || 'random'),
      }

      if (typeof target === 'object' && 'url' in target && target.url) {
        const u = new URL(target.url)
        for (const [k, v] of Object.entries(query)) {
          if (v)
            u.searchParams.set(k, v)
        }
        await window.loadURL(u.toString())
      }
      else if (typeof target === 'object' && 'file' in target && target.file) {
        await window.loadFile(target.file, { query })
      }
    }
    else {
      window = await showWindowWithRoute(`${defaultRoute}?id=${id}`, context)
      eventaContext?.emit(widgetsRenderEvent, snapshot)
    }

    if (payload.bounds && !isSticker) {
      window.setBounds({
        x: payload.bounds.x ?? window.getBounds().x,
        y: payload.bounds.y ?? window.getBounds().y,
        width: payload.bounds.width ?? window.getBounds().width,
        height: payload.bounds.height ?? window.getBounds().height,
      })
    }

    eventaContext?.emit(widgetsRenderEvent, snapshot)

    return id
  }

  async function updateWidget(payload: { id: string, componentProps?: Record<string, any> }) {
    if (!payload?.id)
      return

    const existing = widgetRecords.get(payload.id)
    if (!existing)
      return

    const nextSnapshot: WidgetSnapshot = {
      ...toSnapshot(existing),
      componentProps: payload.componentProps
        ? { ...existing.componentProps, ...payload.componentProps }
        : existing.componentProps,
    }

    upsertRecord(nextSnapshot)

    eventaContext?.emit(widgetsUpdateEvent, { id: nextSnapshot.id, componentProps: nextSnapshot.componentProps })
  }

  async function removeWidget(id: string) {
    if (!id)
      return
    removeWidgetInternal(id, false)
    eventaContext?.emit(widgetsRemoveEvent, { id })
  }

  async function clearWidgets() {
    const ids = [...widgetRecords.keys()]
    for (const id of ids)
      removeWidgetInternal(id, false)

    eventaContext?.emit(widgetsClearEvent, undefined)
    windowContexts.clear()
  }

  function getWidgetSnapshot(id: string) {
    const record = widgetRecords.get(id)
    if (!record)
      return undefined

    return toSnapshot(record)
  }

  const emit = (event: any, payload: any) => {
    eventaContext?.emit(event, payload)
  }

  async function resizeWidgetWindow(payload: { id?: string, width?: number, height?: number, window?: BrowserWindow }) {
    let targetWin: BrowserWindow | undefined = payload.window

    if (!targetWin || targetWin.isDestroyed()) {
      if (payload.id) {
        targetWin = standaloneWindows.get(payload.id)
        if (!targetWin || targetWin.isDestroyed()) {
          const ctx = windowContexts.get(payload.id)
          if (ctx?.window && !ctx.window.isDestroyed()) {
            targetWin = ctx.window
          }
        }
      }
    }

    if (!targetWin || targetWin.isDestroyed()) {
      targetWin = await getWindow()
    }

    if (!targetWin || targetWin.isDestroyed())
      return

    const currentBounds = targetWin.getBounds()
    const primary = screen.getDisplayMatching(currentBounds).workArea

    const newWidth = payload.width != null ? Math.round(payload.width) : currentBounds.width
    const newHeight = payload.height != null ? Math.round(payload.height) : currentBounds.height

    const clampedWidth = Math.min(Math.max(160, newWidth), primary.width)
    const clampedHeight = Math.min(Math.max(80, newHeight), primary.height)

    if (currentBounds.width !== clampedWidth || currentBounds.height !== clampedHeight) {
      targetWin.setBounds({
        x: currentBounds.x,
        y: currentBounds.y,
        width: clampedWidth,
        height: clampedHeight,
      })
    }
  }

  widgetsManager = {
    getWindow,
    openWindow,
    pushWidget,
    updateWidget,
    removeWidget,
    clearWidgets,
    getWidgetSnapshot,
    prepareWidgetWindow,
    hideWindow,
    resizeWidgetWindow,
    emit,
  }

  // Initialize Artistry Bridge (handles ComfyUI + Replicate image generation)
  setupArtistryBridge({ widgetsManager: widgetsManager! })

  return widgetsManager!
}

export interface WidgetsWindowManager {
  getWindow: () => Promise<BrowserWindow>
  openWindow: (params?: { id?: string }) => Promise<void>
  hideWindow: (params?: { id?: string }) => Promise<void>
  pushWidget: (payload: WidgetsAddPayload) => Promise<string>
  updateWidget: (payload: { id: string, componentProps?: Record<string, any> }) => Promise<void>
  removeWidget: (id: string) => Promise<void>
  clearWidgets: () => Promise<void>
  getWidgetSnapshot: (id: string) => WidgetSnapshot | undefined
  prepareWidgetWindow: (options?: { id?: string }) => string
  resizeWidgetWindow: (payload: { id?: string, width?: number, height?: number, window?: BrowserWindow }) => Promise<void>
  emit: (event: any, payload: any) => void
}
