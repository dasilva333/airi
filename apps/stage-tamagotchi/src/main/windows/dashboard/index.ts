import { dirname, join, resolve } from 'node:path'
import { env } from 'node:process'
import { fileURLToPath } from 'node:url'
import { is } from '@electron-toolkit/utils'
import { defineInvokeHandler } from '@moeru/eventa'
import { createContext } from '@moeru/eventa/adapters/electron/main'
import { initScreenCaptureForWindow } from '@proj-airi/electron-screen-capture/main'
import { defu } from 'defu'
import type { Rectangle } from 'electron'
import { BrowserWindow, ipcMain, shell } from 'electron'
import clickDragPlugin from 'electron-click-drag-plugin'
import { throttle } from 'es-toolkit'
import { isLinux } from 'std-env'
import type { InferOutput } from 'valibot'
import { array, number, object, optional, string } from 'valibot'
import icon from '../../../../resources/icon.png?asset'
import { electronStartDraggingWindow } from '../../../shared/eventa'
import { baseUrl, getElectronMainDirname, load, withHashRoute } from '../../libs/electron/location'
import { createConfig } from '../../libs/electron/persistence'
import type { I18n } from '../../libs/i18n'
import type { ServerChannel } from '../../services/airi/channel-server'
import type { NoticeWindowManager } from '../notice'
import type { SettingsWindowManager } from '../settings'
import { setupDashboardWindowElectronInvokes } from './rpc/index.electron'

const appConfigSchema = object({
  windows: optional(
    array(
      object({
        height: optional(number()),
        tag: string(),
        title: optional(string()),
        width: optional(number()),
        x: optional(number()),
        y: optional(number()),
      }),
    ),
  ),
})

type AppConfig = InferOutput<typeof appConfigSchema>

export async function setupDashboardWindow(params: {
  settingsWindow: SettingsWindowManager
  chatWindow: () => Promise<BrowserWindow>
  noticeWindow: NoticeWindowManager
  onWindowCreated?: (window: BrowserWindow) => void
  serverChannel: ServerChannel
  i18n: I18n
}) {
  const {
    setup: setupConfig,
    get: getConfigRaw,
    update: updateConfig,
  } = createConfig('app', 'config.json', appConfigSchema, {
    autoHeal: true,
    default: { windows: [] },
  })
  const getConfig = (): AppConfig => getConfigRaw() ?? { windows: [] }

  setupConfig()

  const windowConfig = getConfig().windows?.find((w) => w.title === 'AIRI Dashboard' && w.tag === 'dashboard')

  const window = new BrowserWindow({
    height: windowConfig?.height ?? 600.0,
    icon,
    show: false,
    title: 'AIRI Dashboard',
    webPreferences: {
      preload: join(dirname(fileURLToPath(import.meta.url)), '../preload/index.cjs'),
      sandbox: true,
    },
    width: windowConfig?.width ?? 1200.0,
    x: windowConfig?.x,
    y: windowConfig?.y,
  })

  if (params.onWindowCreated) {
    params.onWindowCreated(window)
  }

  // NOTICE: in development mode, open devtools by default
  if (is.dev || env.MAIN_APP_DEBUG || env.APP_DEBUG) {
    try {
      window.webContents.openDevTools({ mode: 'detach' })
    } catch (err) {
      console.error('failed to open devtools:', err)
    }
  }

  // Always allow F12 to toggle dev tools
  window.webContents.on('before-input-event', (_event, input) => {
    if (input.type === 'keyDown' && input.key === 'F12') {
      window.webContents.toggleDevTools()
    }
  })

  function handleNewBounds(newBounds: Rectangle) {
    if (window.isDestroyed()) return

    const config = getConfig()
    if (!config.windows || !Array.isArray(config.windows)) {
      config.windows = []
    }

    const existingConfigIndex = config.windows.findIndex((w) => w.title === 'AIRI Dashboard' && w.tag === 'dashboard')

    if (existingConfigIndex === -1) {
      config.windows.push({
        height: newBounds.height,
        tag: 'dashboard',
        title: 'AIRI Dashboard',
        width: newBounds.width,
        x: newBounds.x,
        y: newBounds.y,
      })
    } else {
      const windowConfig = defu(config.windows[existingConfigIndex], { tag: 'dashboard', title: 'AIRI Dashboard' })

      windowConfig.x = newBounds.x
      windowConfig.y = newBounds.y
      windowConfig.width = newBounds.width
      windowConfig.height = newBounds.height

      config.windows[existingConfigIndex] = windowConfig
    }

    updateConfig(config)
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

  window.on('ready-to-show', () => {
    if (!window.isDestroyed()) {
      window.show()
    }
  })
  window.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  await load(window, withHashRoute(baseUrl(resolve(getElectronMainDirname(), '..', 'renderer')), '/dashboard'))

  await setupDashboardWindowElectronInvokes({
    chatWindow: params.chatWindow,
    i18n: params.i18n,
    noticeWindow: params.noticeWindow,
    serverChannel: params.serverChannel,
    settingsWindow: params.settingsWindow,
    window,
  })

  /**
   * This is a know issue (or expected behavior maybe) to Electron.
   * We don't use this approach on Linux because it's not working.
   *
   * Discussion: https://github.com/electron/electron/issues/37789
   * Workaround: https://github.com/noobfromph/electron-click-drag-plugin
   */
  if (!isLinux) {
    function handleStartDraggingWindow(_payload: any, handlerOptions: any) {
      try {
        const sender = handlerOptions?.raw?.ipcMainEvent?.sender
        const win = sender ? (BrowserWindow.fromWebContents(sender) ?? window) : window
        const windowId = win.getNativeWindowHandle()
        clickDragPlugin.startDrag(windowId)
      } catch (error) {
        console.error(error)
      }
    }

    // TODO: once we refactored eventa to support window-namespaced contexts,
    // we can remove the setMaxListeners call below since eventa will be able to dispatch and
    // manage events within eventa's context system.
    ipcMain.setMaxListeners(0)

    const { context } = createContext(ipcMain, window)
    const cleanUpWindowDraggingInvokeHandler = defineInvokeHandler(
      context,
      electronStartDraggingWindow,
      handleStartDraggingWindow,
    )

    window.on('closed', () => {
      cleanUpWindowDraggingInvokeHandler()
    })
  }

  initScreenCaptureForWindow(window)

  return window
}
