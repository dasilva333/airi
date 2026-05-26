import { join, resolve } from 'node:path'
import { createContext } from '@moeru/eventa/adapters/electron/main'
import type { BrowserWindow, Rectangle } from 'electron'
import { BrowserWindow as ElectronBrowserWindow, ipcMain, screen, shell } from 'electron'
import { isMacOS } from 'std-env'
import type { InferOutput } from 'valibot'
import { number, object, optional } from 'valibot'
import icon from '../../../../resources/icon.png?asset'
import type { WidgetSnapshot, WidgetsAddPayload } from '../../../shared/eventa'
import { widgetsClearEvent, widgetsRemoveEvent, widgetsRenderEvent, widgetsUpdateEvent } from '../../../shared/eventa'
import { baseUrl, getElectronMainDirname, load, withHashRoute } from '../../libs/electron/location'
import { createConfig } from '../../libs/electron/persistence'
import { createReusableWindow } from '../../libs/electron/window-manager'
import type { I18n } from '../../libs/i18n'
import type { ServerChannel } from '../../services/airi/channel-server'
import { setupArtistryBridge } from '../../services/airi/widgets/artistry-bridge'
import { spotlightLikeWindowConfig, transparentWindowConfig } from '../shared/window'
import { setupWidgetsWindowInvokes } from './rpc/index.electron'

export interface WidgetsWindowManager {
  getWindow: () => Promise<BrowserWindow>
  openWindow: (params?: { id?: string }) => Promise<void>
  pushWidget: (payload: WidgetsAddPayload) => Promise<string>
  updateWidget: (payload: { id: string; componentProps?: Record<string, any> }) => Promise<void>
  removeWidget: (id: string) => Promise<void>
  clearWidgets: () => Promise<void>
  getWidgetSnapshot: (id: string) => WidgetSnapshot | undefined
  prepareWidgetWindow: (options?: { id?: string }) => string
}

const widgetsWindowConfigSchema = object({
  bounds: optional(
    object({
      height: number(),
      width: number(),
      x: number(),
      y: number(),
    }),
  ),
})

type WidgetsWindowConfig = InferOutput<typeof widgetsWindowConfigSchema>

function computeDefaultBounds(): Rectangle {
  const primary = screen.getPrimaryDisplay().workArea
  const width = Math.min(500, Math.floor(primary.width * 0.35))
  const height = Math.min(500, Math.floor(primary.height * 0.6))
  const x = primary.x + primary.width - width - 16
  const y = primary.y + 16
  return { height, width, x, y }
}

function createWidgetsWindow(options?: Electron.BrowserWindowConstructorOptions & { spotlight?: boolean }) {
  const { spotlight = true, ...rest } = options ?? {}
  const window = new ElectronBrowserWindow({
    height: 760,
    icon,
    show: false,
    title: 'Widgets',
    // Top-level overlay style like other overlay windows
    type: 'panel',
    webPreferences: {
      preload: join(getElectronMainDirname(), '../preload/index.cjs'),
      sandbox: true,
    },
    width: 620,
    ...transparentWindowConfig(),
    ...(spotlight ? spotlightLikeWindowConfig() : {}),
    backgroundColor: '#00000000',
    ...rest,
  })

  // Keep on top like caption/main overlays
  window.setAlwaysOnTop(true, 'screen-saver', 1)
  window.setFullScreenable(false)
  window.setVisibleOnAllWorkspaces(true)
  if (isMacOS) window.setWindowButtonVisibility(false)

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

export function setupWidgetsWindowManager(params: { serverChannel: ServerChannel; i18n: I18n }): WidgetsWindowManager {
  const {
    setup,
    get: getConfigRaw,
    update,
  } = createConfig('windows-widgets', 'config.json', widgetsWindowConfigSchema, {
    autoHeal: true,
    default: {},
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
    const { context } = createContext(ipcMain, window)
    eventaContext = context

    const saved = getConfig().bounds
    if (saved) {
      const work = screen.getDisplayMatching(saved).workArea
      const clamped: Rectangle = {
        height: Math.min(saved.height, work.height),
        width: Math.min(saved.width, work.width),
        x: Math.min(Math.max(saved.x, work.x), work.x + work.width - saved.width),
        y: Math.min(Math.max(saved.y, work.y), work.y + work.height - saved.height),
      }
      window.setBounds(clamped)
    } else {
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

    const initialRoute = pendingRoute ?? defaultRoute
    await loadWithRoute(window, initialRoute)

    await setupWidgetsWindowInvokes({
      i18n: params.i18n,
      serverChannel: params.serverChannel,
      widgetsManager: widgetsManager!,
      widgetWindow: window,
    })

    pendingRoute = undefined

    window.on('closed', () => {
      eventaContext = undefined
      currentRoute = undefined
      windowContexts.forEach((context) => {
        if (context.window === window) context.window = undefined
      })
    })
    return window
  })

  function prepareWidgetWindow(options?: { id?: string }): string {
    const id = options?.id ?? Math.random().toString(36).slice(2, 10)
    if (!windowContexts.has(id)) {
      windowContexts.set(id, {
        widgetId: id,
        window: undefined,
        windowBuilder: () => getWindow(),
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
    if (existing?.timer) clearTimeout(existing.timer)

    const record: WidgetRecord = { ...snapshot }

    if (snapshot.ttlMs > 0) {
      record.timer = setTimeout(() => removeWidgetInternal(snapshot.id), snapshot.ttlMs)
    }

    widgetRecords.set(snapshot.id, record)
  }

  function removeWidgetInternal(id: string, emitEvent = true) {
    const existing = widgetRecords.get(id)
    if (!existing) return

    if (existing.timer) clearTimeout(existing.timer)

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
    if (!context) return getWindow()
    if (context.window && !context.window.isDestroyed()) return context.window
    const resolved = await context.windowBuilder()
    context.window = resolved
    return resolved
  }

  async function showWindowWithRoute(route: string, context?: WidgetWindowContext) {
    pendingRoute = route
    const window = await getWindowFromContext(context)
    pendingRoute = undefined
    if (currentRoute !== route) await loadWithRoute(window, route)
    window.showInactive()
    if (context) context.window = window
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
    } else {
      const window = await getWindow()
      window.close()
    }
  }

  async function pushWidget(payload: WidgetsAddPayload): Promise<string> {
    const id = prepareWidgetWindow({ id: payload.id })
    const snapshot: WidgetSnapshot = {
      componentName: payload.componentName,
      componentProps: payload.componentProps ?? {},
      id,
      size: payload.size ?? 'm',
      ttlMs: payload.ttlMs ?? 0,
    }
    upsertRecord(snapshot)
    const context = windowContexts.get(id)
    const isSticker = payload.componentName === 'sticker'

    let window: BrowserWindow
    if (isSticker && payload.bounds) {
      window = await createWidgetsWindow({
        ...payload.bounds,
        alwaysOnTop: true,
        skipTaskbar: true,
        spotlight: false,
      })
      standaloneWindows.set(id, window)
      const { context: evCtx } = createContext(ipcMain, window)
      // For standalone windows, we need to load the route directly
      await loadWithRoute(window, `${defaultRoute}?id=${id}`)

      // Since standalone windows have their own eventa context, we need to emit render through it
      // but wait for ready-to-show
      window.once('ready-to-show', () => {
        evCtx.emit(widgetsRenderEvent, snapshot)
      })
    } else {
      window = await showWindowWithRoute(`${defaultRoute}?id=${id}`, context)
      eventaContext?.emit(widgetsRenderEvent, snapshot)
    }

    if (payload.bounds && !isSticker) {
      window.setBounds({
        height: payload.bounds.height ?? window.getBounds().height,
        width: payload.bounds.width ?? window.getBounds().width,
        x: payload.bounds.x ?? window.getBounds().x,
        y: payload.bounds.y ?? window.getBounds().y,
      })
    }

    eventaContext?.emit(widgetsRenderEvent, snapshot)

    return id
  }

  async function updateWidget(payload: { id: string; componentProps?: Record<string, any> }) {
    if (!payload?.id) return

    const existing = widgetRecords.get(payload.id)
    if (!existing) return

    const nextSnapshot: WidgetSnapshot = {
      ...toSnapshot(existing),
      componentProps: payload.componentProps
        ? { ...existing.componentProps, ...payload.componentProps }
        : existing.componentProps,
    }

    upsertRecord(nextSnapshot)

    eventaContext?.emit(widgetsUpdateEvent, { componentProps: nextSnapshot.componentProps, id: nextSnapshot.id })
  }

  async function removeWidget(id: string) {
    if (!id) return
    removeWidgetInternal(id, false)
    eventaContext?.emit(widgetsRemoveEvent, { id })
  }

  async function clearWidgets() {
    const ids = [...widgetRecords.keys()]
    for (const id of ids) removeWidgetInternal(id, false)

    eventaContext?.emit(widgetsClearEvent, undefined)
    windowContexts.clear()
  }

  function getWidgetSnapshot(id: string) {
    const record = widgetRecords.get(id)
    if (!record) return undefined

    return toSnapshot(record)
  }

  const emit = (event: any, payload: any) => {
    eventaContext?.emit(event, payload)
  }

  widgetsManager = {
    clearWidgets,
    emit,
    getWidgetSnapshot,
    getWindow,
    hideWindow,
    openWindow,
    prepareWidgetWindow,
    pushWidget,
    removeWidget,
    updateWidget,
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
  updateWidget: (payload: { id: string; componentProps?: Record<string, any> }) => Promise<void>
  removeWidget: (id: string) => Promise<void>
  clearWidgets: () => Promise<void>
  getWidgetSnapshot: (id: string) => WidgetSnapshot | undefined
  prepareWidgetWindow: (options?: { id?: string }) => string
  emit: (event: any, payload: any) => void
}
