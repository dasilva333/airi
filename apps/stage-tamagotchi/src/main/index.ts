import type { Rectangle } from 'electron'

import { dirname } from 'node:path'
import { env, platform, stderr, stdout } from 'node:process'
import { fileURLToPath } from 'node:url'

// @ts-ignore
import messages from '@proj-airi/i18n-bundle'

import { electronApp, optimizer } from '@electron-toolkit/utils'
import { Format, LogLevel, setGlobalFormat, setGlobalLogLevel, useLogg } from '@guiiai/logg'
import { defineInvokeHandler } from '@moeru/eventa'
import { createContext } from '@moeru/eventa/adapters/electron/main'
import { initScreenCaptureForMain } from '@proj-airi/electron-screen-capture/main'
import { app, BrowserWindow, ipcMain, Notification, screen, session } from 'electron'
import { createLoggLogger, injeca, lifecycle } from 'injeca'
import { isLinux } from 'std-env'

import icon from '../../resources/icon.png?asset'

import {
  electronApplySizePreset,
  electronCaptionSetFollowWindow,
  electronCaptionSyncDocking,
  electronCaptionToggleVisibility,
  electronGetCaptionWindowState,
  electronGetChatWindowState,
  electronGetMonitorCount,
  electronResetWindowPositions,
  electronSetIgnoreMouseEvents,
  electronShowToast,
  electronShowToastEvent,
  electronStageSetAlwaysOnTop,
  electronStageToggleVisibility,
} from '../shared/eventa'
import { openDebugger, setupDebugger } from './app/debugger'
import { createGlobalAppConfig } from './configs/global'
import { emitAppBeforeQuit, emitAppReady, emitAppWindowAllClosed } from './libs/bootkit/lifecycle'
import { setElectronMainDirname } from './libs/electron/location'
import { flushAllConfigs } from './libs/electron/persistence'
import { createI18n } from './libs/i18n'
import { createServerChannelService, setupServerChannel } from './services/airi/channel-server'
import { setupDiscordService } from './services/airi/discord'
import { createI18nService } from './services/airi/i18n'
import { createMcpServersService, setupMcpStdioManager } from './services/airi/mcp-servers'
import { setupPluginHost } from './services/airi/plugins'
import { createMicToggleService } from './services/airi/shortcuts/mic-toggle'
import { setupAutoUpdater } from './services/electron/auto-updater'
import { createVisionService } from './services/electron/vision'
import { createSensorsService } from './services/sensors'
import { cleanupMicToggleShortcut } from './services/shortcuts/mic-toggle'
import { setupTray } from './tray'
import { setupAboutWindowReusable } from './windows/about'
import { setupBeatSync } from './windows/beat-sync'
import { setupCaptionWindowManager } from './windows/caption'
import { setupChatWindowReusableFunc } from './windows/chat'
import { setupCustomizerWindowManager } from './windows/customizer'
import { setupDevtoolsWindow } from './windows/devtools'
import { setupMainWindow } from './windows/main'
import { setupNoticeWindowManager } from './windows/notice'
import { setupOnboardingWindowManager } from './windows/onboarding'
import { setupSettingsWindowReusableFunc } from './windows/settings'
import { ensureWindowInVisibleBounds } from './windows/shared/display'
import { setStageVisibleState, setupActorStageWindow } from './windows/stage'
import { setupWidgetsWindowManager } from './windows/widgets'

// Guard BrowserWindow prototype methods against destroyed window objects to prevent "Object has been destroyed" exceptions
const dummyWebContents = new Proxy({} as any, {
  get(_target, prop) {
    if (prop === 'isDestroyed')
      return () => true
    if (prop === 'isCrashed')
      return () => false
    if (prop === 'getURL')
      return () => ''
    return () => {}
  },
})

const webContentsDescriptor = Object.getOwnPropertyDescriptor(BrowserWindow.prototype, 'webContents')
if (webContentsDescriptor && webContentsDescriptor.get) {
  const originalGet = webContentsDescriptor.get
  Object.defineProperty(BrowserWindow.prototype, 'webContents', {
    ...webContentsDescriptor,
    get(this: BrowserWindow) {
      if (this.isDestroyed()) {
        return dummyWebContents
      }
      try {
        return originalGet.call(this)
      }
      catch {
        return dummyWebContents
      }
    },
  })
}

const proto = BrowserWindow.prototype as any
const methodsToGuard = ['show', 'hide', 'close', 'focus', 'restore', 'minimize', 'maximize', 'setBounds', 'setAlwaysOnTop', 'setMovable', 'setResizable', 'getBounds'] as const
for (const method of methodsToGuard) {
  const original = proto[method]
  if (typeof original === 'function') {
    proto[method] = function (this: BrowserWindow, ...args: any[]) {
      if (this.isDestroyed()) {
        console.warn(`[WindowManager] Guarded call to ${method} on a destroyed window.`)
        if (method === 'getBounds') {
          return { x: 0, y: 0, width: 0, height: 0 }
        }
        return
      }
      return original.apply(this, args)
    }
  }
}

function installStreamErrorGuards() {
  const guard = (error: NodeJS.ErrnoException) => {
    // Ignore broken pipe style errors from detached/closed console streams.
    if (error?.code === 'EPIPE' || error?.code === 'ERR_STREAM_DESTROYED') {
      return
    }

    // NOTICE: Attaching an 'error' listener marks the error as handled.
    // Re-throw unexpected stream errors so they still surface during development and crash reporting.
    throw error
  }

  stdout?.on('error', guard)
  stderr?.on('error', guard)
}

// TODO: once we refactored eventa to support window-namespaced contexts,
// we can remove the setMaxListeners call below since eventa will be able to dispatch and
// manage events within eventa's context system.
ipcMain.setMaxListeners(100)

installStreamErrorGuards()
setElectronMainDirname(dirname(fileURLToPath(import.meta.url)))
setGlobalFormat(Format.Pretty)
setGlobalLogLevel(LogLevel.Log)
setupDebugger()

const log = useLogg('main').useGlobalConfig()
const forceHighPerformanceGpu = env.AIRI_FORCE_HIGH_PERFORMANCE_GPU === '1'

if (isLinux) {
  app.commandLine.appendSwitch('enable-features', 'SharedArrayBuffer')
  app.commandLine.appendSwitch('enable-unsafe-webgpu')
  app.commandLine.appendSwitch('enable-features', 'Vulkan')

  if (env.XDG_SESSION_TYPE === 'wayland') {
    app.commandLine.appendSwitch('enable-features', 'GlobalShortcutsPortal')
    app.commandLine.appendSwitch('enable-features', 'UseOzonePlatform')
    app.commandLine.appendSwitch('enable-features', 'WaylandWindowDecorations')
  }
}

if (forceHighPerformanceGpu) {
  // NOTICE: These switches can materially change GPU selection, power draw, and
  // driver compatibility. Keep them opt-in so default desktop behavior stays
  // close to upstream unless the local launcher explicitly asks for them.
  app.commandLine.appendSwitch('force-high-performance-gpu')
  app.commandLine.appendSwitch('enable-gpu-rasterization')
  app.commandLine.appendSwitch('ignore-gpu-blocklist')
  console.log('[AIRI] High-performance GPU overrides enabled via AIRI_FORCE_HIGH_PERFORMANCE_GPU=1')
}

app.dock?.setIcon(icon)
electronApp.setAppUserModelId('ai.moeru.airi')

initScreenCaptureForMain()

app.whenReady().then(async () => {
  // NOTICE: Deepgram and Qwen Portal APIs do not send CORS headers for browser-origin requests
  // authenticated with project API keys or OAuth tokens. Since the renderer is a
  // Chromium context, we inject permissive CORS response headers at the Electron
  // session level for these specific domains. This avoids needing a dedicated proxy backend.
  session.defaultSession.webRequest.onHeadersReceived(
    {
      urls: [
        'https://api.deepgram.com/*',
        'https://chat.qwen.ai/*',
        'https://portal.qwen.ai/*',
      ],
    },
    (details, callback) => {
      const headers = { ...details.responseHeaders }
      headers['access-control-allow-origin'] = ['*']
      headers['access-control-allow-headers'] = ['Authorization, Content-Type, x-request-id']
      headers['access-control-allow-methods'] = ['GET, POST, OPTIONS']

      // NOTICE: Deepgram returns 401/405 for preflight OPTIONS requests.
      // The browser requires a 2xx status on the preflight response in addition
      // to the CORS headers, so we force 200 OK for OPTIONS.
      if (details.method === 'OPTIONS') {
        callback({ responseHeaders: headers, statusLine: 'HTTP/1.1 200 OK' })
        return
      }

      callback({ responseHeaders: headers })
    },
  )

  session.defaultSession.on('will-download', async (_event, item, webContents) => {
    const filename = item.getFilename()
    const ext = filename.split('.').pop()?.toLowerCase()

    if (ext === 'png' || ext === 'json') {
      const fs = await import('node:fs/promises')
      const path = await import('node:path')

      const tempDir = app.getPath('temp')
      const tempFilePath = path.join(tempDir, `airi-card-${Date.now()}-${filename}`)
      item.setSavePath(tempFilePath)

      item.once('done', async (_e, state) => {
        if (state === 'completed') {
          try {
            const buffer = await fs.readFile(tempFilePath)
            const base64Data = buffer.toString('base64')

            const targetWebContents = webContents.hostWebContents || webContents
            targetWebContents.send('chara-card-downloaded', {
              base64Data,
              filename,
              ext,
            })
          }
          catch (err) {
            console.error('[Download Interception] Failed to read temporary file:', err)
          }
          finally {
            await fs.unlink(tempFilePath).catch(() => {})
          }
        }
      })
    }
  })

  injeca.setLogger(createLoggLogger(useLogg('injeca').useGlobalConfig()))

  const appConfig = injeca.provide('configs:app', () => createGlobalAppConfig())
  const electronApp = injeca.provide('host:electron:app', () => app)
  const autoUpdater = injeca.provide('services:auto-updater', () => setupAutoUpdater())

  const i18n = injeca.provide('libs:i18n', {
    dependsOn: { appConfig },
    build: ({ dependsOn }) => {
      const language = dependsOn.appConfig.get()?.language ?? 'en'
      const i18n = createI18n({ messages, locale: language })
      return i18n
    },
  })

  const serverChannel = injeca.provide('modules:channel-server', {
    dependsOn: { app: electronApp, lifecycle },
    build: async ({ dependsOn }) => setupServerChannel(dependsOn),
  })

  const mcpStdioManager = injeca.provide('modules:mcp-stdio-manager', {
    build: async () => setupMcpStdioManager(),
  })

  const pluginHost = injeca.provide('modules:plugin-host', {
    dependsOn: { serverChannel },
    build: () => setupPluginHost(),
  })

  const beatSync = injeca.provide('windows:beat-sync', () => setupBeatSync())
  const devtoolsMarkdownStressWindow = injeca.provide('windows:devtools:markdown-stress', () => setupDevtoolsWindow())

  const onboardingWindowManager = injeca.provide('windows:onboarding', {
    dependsOn: { serverChannel, i18n },
    build: ({ dependsOn }) => setupOnboardingWindowManager(dependsOn),
  })
  const noticeWindow = injeca.provide('windows:notice', {
    dependsOn: { i18n, serverChannel },
    build: ({ dependsOn }) => setupNoticeWindowManager(dependsOn),
  })

  const widgetsManager = injeca.provide('windows:widgets', {
    dependsOn: { serverChannel, i18n },
    build: ({ dependsOn }) => setupWidgetsWindowManager(dependsOn),
  })

  const aboutWindow = injeca.provide('windows:about', {
    dependsOn: { autoUpdater, i18n, serverChannel },
    build: ({ dependsOn }) => setupAboutWindowReusable(dependsOn),
  })

  const settingsWindow = injeca.provide('windows:settings', {
    dependsOn: { widgetsManager, beatSync, autoUpdater, devtoolsMarkdownStressWindow, serverChannel, mcpStdioManager, i18n },
    build: async ({ dependsOn }) => setupSettingsWindowReusableFunc(dependsOn),
  })

  const chatWindow = injeca.provide('windows:chat', {
    dependsOn: { widgetsManager, serverChannel, mcpStdioManager, i18n, appConfig, settingsWindow },
    build: ({ dependsOn }) => setupChatWindowReusableFunc(dependsOn),
  })

  const stageWindow = injeca.provide('windows:stage', {
    dependsOn: { appConfig, serverChannel, i18n },
    build: async ({ dependsOn }) => setupActorStageWindow(dependsOn),
  })

  const mainWindow = injeca.provide('windows:main', {
    dependsOn: { settingsWindow, stageWindow, chatWindow, widgetsManager, noticeWindow, beatSync, autoUpdater, serverChannel, mcpStdioManager, i18n, onboardingWindowManager, appConfig },
    build: async ({ dependsOn }) => setupMainWindow(dependsOn),
  })

  const captionWindow = injeca.provide('windows:caption', {
    dependsOn: { mainWindow, stageWindow, serverChannel, i18n, appConfig },
    build: async ({ dependsOn }) => setupCaptionWindowManager(dependsOn),
  })

  const customizerWindow = injeca.provide('windows:customizer', {
    dependsOn: { mainWindow, serverChannel, i18n },
    build: async ({ dependsOn }) => setupCustomizerWindowManager(dependsOn),
  })

  const tray = injeca.provide('app:tray', {
    dependsOn: { mainWindow, settingsWindow, captionWindow, widgetsWindow: widgetsManager, serverChannel, beatSyncBgWindow: beatSync, aboutWindow, i18n, appConfig },
    build: async ({ dependsOn }) => {
      const configHelper = dependsOn.appConfig
      return setupTray({
        ...dependsOn,
        getConfig: () => configHelper.get(),
        updateConfig: config => configHelper.update(config),
      })
    },
  })

  injeca.invoke({
    dependsOn: { mainWindow, tray, serverChannel, pluginHost, mcpStdioManager, onboardingWindow: onboardingWindowManager, appConfig, i18n, captionWindow, stageWindow, chatWindow, customizerWindow },
    callback: (deps) => {
      const context = createContext(ipcMain).context
      createServerChannelService({ serverChannel: deps.serverChannel })
      createMcpServersService({ context, manager: deps.mcpStdioManager })
      createI18nService({ context, window: deps.mainWindow, i18n: deps.i18n })
      createMicToggleService({ context, window: deps.mainWindow })
      createVisionService({ context })
      const sensorsServicePromise = createSensorsService({ context })
      setupDiscordService()
      defineInvokeHandler(context, electronCaptionToggleVisibility, async (enabled?: boolean) => {
        console.log('[@proj-airi/stage-tamagotchi] [Main] Caption visibility toggle triggered via Control Island. enabled:', enabled)
        await deps.captionWindow.toggleVisibility(enabled)
      })
      defineInvokeHandler(context, electronGetChatWindowState, async () => {
        const win = await deps.chatWindow()
        const isOpen = Boolean(win && !win.isDestroyed() && win.isVisible())
        console.log('[@proj-airi/stage-tamagotchi] [Main] Retrieved chat window state:', isOpen)
        return isOpen
      })
      defineInvokeHandler(context, electronGetCaptionWindowState, async () => {
        const winEnabled = deps.appConfig.get()?.windows?.find((w: any) => w.tag === 'caption')?.enabled
        const winVisible = deps.captionWindow.isVisible()
        const isOpen = Boolean(winEnabled || winVisible)
        console.log('[@proj-airi/stage-tamagotchi] [Main] Retrieved caption window state:', isOpen, 'enabled:', winEnabled, 'visible:', winVisible)
        return isOpen
      })
      defineInvokeHandler(context, electronCaptionSyncDocking, async (dock) => {
        console.log('[@proj-airi/stage-tamagotchi] [Main] Caption docking sync triggered via Control Island:', dock)
        const appConfig = deps.appConfig.get()
        if (appConfig) {
          const windows = appConfig.windows ?? []
          const index = windows.findIndex((w: any) => w.tag === 'caption')
          if (index !== -1) {
            windows[index] = { ...windows[index], dock }
          }
          else {
            windows.push({ tag: 'caption', enabled: deps.captionWindow.isVisible(), dock })
          }
          deps.appConfig.update({
            ...appConfig,
            windows,
          })
        }
        await deps.captionWindow.triggerMove(dock)
      })
      defineInvokeHandler(context, electronCaptionSetFollowWindow, async (shouldFollow) => {
        console.log('[@proj-airi/stage-tamagotchi] [Main] Caption set follow window triggered:', shouldFollow)
        await deps.captionWindow.setFollowWindow(shouldFollow)
      })
      defineInvokeHandler(context, electronSetIgnoreMouseEvents, async (ignore) => {
        // @ts-ignore - window might be undefined if context is global, but here it's window-specific
        context.window?.setIgnoreMouseEvents(ignore, { forward: true })
      })
      defineInvokeHandler(context, electronStageToggleVisibility, async (enabled) => {
        console.log('[@proj-airi/stage-tamagotchi] [Main] Actor Stage visibility changed:', enabled)
        setStageVisibleState(enabled)
        if (deps.stageWindow && !deps.stageWindow.isDestroyed()) {
          if (enabled) {
            deps.stageWindow.show()
          }
          else {
            deps.stageWindow.hide()
          }
        }
      })
      defineInvokeHandler(context, electronStageSetAlwaysOnTop, async (flag) => {
        console.log('[@proj-airi/stage-tamagotchi] [Main] Actor Stage always-on-top changed:', flag)
        if (deps.stageWindow && !deps.stageWindow.isDestroyed()) {
          if (flag) {
            deps.stageWindow.setAlwaysOnTop(true, 'screen-saver', 1)
          }
          else {
            deps.stageWindow.setAlwaysOnTop(false)
          }
        }
      })

      defineInvokeHandler(context, electronShowToast, async (payload) => {
        if (!payload)
          return

        let targetWin = await deps.chatWindow()
        if (!targetWin || targetWin.isDestroyed() || !targetWin.isVisible()) {
          targetWin = deps.stageWindow
        }
        if (!targetWin || targetWin.isDestroyed() || !targetWin.isVisible()) {
          targetWin = deps.mainWindow
        }

        if (targetWin && !targetWin.isDestroyed()) {
          const { context: winContext, dispose } = createContext(ipcMain, targetWin)
          winContext.emit(electronShowToastEvent, payload)
          dispose()
        }
      })

      ipcMain.on('show-os-notification', (_event, payload: { title: string, body: string, silent?: boolean }) => {
        if (!payload)
          return
        try {
          if (Notification.isSupported()) {
            const notification = new Notification({
              title: payload.title,
              body: payload.body,
              silent: payload.silent !== false,
            })
            notification.show()
          }
          else {
            console.warn('[Notification] Native notifications are not supported on this platform.')
          }
        }
        catch (error) {
          console.error('[Notification] Failed to show native notification:', error)
        }
      })

      defineInvokeHandler(context, electronApplySizePreset, async (payload) => {
        if (!payload)
          return
        const { target, preset, monitorIndex, alignment } = payload
        console.log(`[@proj-airi/stage-tamagotchi] [Main] Apply size preset: ${preset} for target: ${target}, monitor: ${monitorIndex}, align: ${alignment}`)

        let targetWin: BrowserWindow | null = null
        if (target === 'actor') {
          targetWin = deps.stageWindow
        }
        else if (target === 'chat') {
          targetWin = await deps.chatWindow()
        }

        if (!targetWin || targetWin.isDestroyed())
          return

        const bounds = targetWin.getBounds()

        // Get fallback from config or default if bounds are invalid
        const presetAppConfig = deps.appConfig.get()
        const winConfig = presetAppConfig?.windows?.find((w: any) => w.tag === target)

        let width = bounds?.width || winConfig?.width || (target === 'actor' ? 450 : 600)
        let height = bounds?.height || winConfig?.height || (target === 'actor' ? 600 : 800)

        // Ensure they are valid numbers
        if (!width || isNaN(width) || width <= 0)
          width = target === 'actor' ? 450 : 600
        if (!height || isNaN(height) || height <= 0)
          height = target === 'actor' ? 600 : 800

        let targetDisplay: Electron.Display | undefined
        if (monitorIndex !== undefined && monitorIndex !== null) {
          const displays = screen.getAllDisplays()
          targetDisplay = displays[monitorIndex - 1]
        }
        if (!targetDisplay) {
          try {
            targetDisplay = screen.getDisplayMatching(bounds)
          }
          catch (e) {
            targetDisplay = screen.getPrimaryDisplay()
          }
        }
        if (!targetDisplay) {
          targetDisplay = screen.getPrimaryDisplay()
        }

        const workArea = targetDisplay.workArea || screen.getPrimaryDisplay().workArea

        if (preset && (preset as any) !== 'undefined') {
          if (target === 'actor') {
            switch (preset) {
              case 'mini':
                width = 220
                height = 315
                break
              case 'medium':
                width = 450
                height = 600
                break
              case 'large':
                width = 800
                height = 1000
                break
              case 'full':
                width = workArea.width
                height = workArea.height
                break
            }
          }
          else if (target === 'chat') {
            switch (preset) {
              case 'mini':
                width = 400
                height = 500
                break
              case 'medium':
                width = 600
                height = 800
                break
              case 'large':
                width = 900
                height = 900
                break
              case 'full':
                width = Math.max(400, workArea.width - 80)
                height = Math.max(500, workArea.height - 80)
                break
            }
          }
        }

        let newX = bounds?.x
        let newY = bounds?.y
        if (newX === undefined || isNaN(newX))
          newX = workArea.x
        if (newY === undefined || isNaN(newY))
          newY = workArea.y

        if (alignment) {
          switch (alignment) {
            case 'top-left':
              newX = workArea.x
              newY = workArea.y
              break
            case 'top':
              newX = workArea.x + (workArea.width - width) / 2
              newY = workArea.y
              break
            case 'top-right':
              newX = workArea.x + workArea.width - width
              newY = workArea.y
              break
            case 'left':
              newX = workArea.x
              newY = workArea.y + (workArea.height - height) / 2
              break
            case 'center':
              newX = workArea.x + (workArea.width - width) / 2
              newY = workArea.y + (workArea.height - height) / 2
              break
            case 'right':
              newX = workArea.x + workArea.width - width
              newY = workArea.y + (workArea.height - height) / 2
              break
            case 'bottom-left':
              newX = workArea.x
              newY = workArea.y + workArea.height - height
              break
            case 'bottom':
              newX = workArea.x + (workArea.width - width) / 2
              newY = workArea.y + workArea.height - height
              break
            case 'bottom-right':
              newX = workArea.x + workArea.width - width
              newY = workArea.y + workArea.height - height
              break
          }
        }
        else {
          if (monitorIndex !== undefined && monitorIndex !== null) {
            newX = workArea.x + (workArea.width - width) / 2
            newY = workArea.y + (workArea.height - height) / 2
          }
          else {
            const currentX = (bounds?.x === undefined || isNaN(bounds.x)) ? workArea.x : bounds.x
            const currentY = (bounds?.y === undefined || isNaN(bounds.y)) ? workArea.y : bounds.y
            const currentW = (bounds?.width === undefined || isNaN(bounds.width) || bounds.width <= 0) ? width : bounds.width
            const currentH = (bounds?.height === undefined || isNaN(bounds.height) || bounds.height <= 0) ? height : bounds.height
            newX = currentX + (currentW - width) / 2
            newY = currentY + (currentH - height) / 2
          }
        }

        // Final safety check against NaN/undefined
        if (newX === undefined || isNaN(newX))
          newX = workArea.x + (workArea.width - width) / 2
        if (newY === undefined || isNaN(newY))
          newY = workArea.y + (workArea.height - height) / 2

        const newBounds = ensureWindowInVisibleBounds({
          x: Math.round(newX),
          y: Math.round(newY),
          width: Math.round(width),
          height: Math.round(height),
        })

        console.log(`[@proj-airi/stage-tamagotchi] [Main] Final calculated newBounds:`, newBounds)

        const appConfigToSave = deps.appConfig.get()
        if (appConfigToSave) {
          const windows = appConfigToSave.windows || []
          const idx = windows.findIndex((w: any) => w.tag === target)
          if (idx !== -1) {
            windows[idx] = {
              ...windows[idx],
              x: newBounds.x,
              y: newBounds.y,
              width: newBounds.width,
              height: newBounds.height,
            }
          }
          else {
            windows.push({
              title: target === 'actor' ? 'AIRI' : 'AIRI',
              tag: target,
              x: newBounds.x,
              y: newBounds.y,
              width: newBounds.width,
              height: newBounds.height,
            })
          }
          appConfigToSave.windows = windows
          deps.appConfig.update(appConfigToSave)
        }

        if (targetWin && !targetWin.isDestroyed()) {
          if (targetWin.isMaximized()) {
            targetWin.unmaximize()
          }
          targetWin.setBounds(newBounds)
        }
      })

      const handleResetWindowPositions = async () => {
        console.log('[@proj-airi/stage-tamagotchi] [Main] Resetting all window positions...')
        const primaryDisplay = screen.getPrimaryDisplay()
        const workArea = primaryDisplay.workArea

        const orientation = deps.appConfig.get()?.windows?.find((w: any) => w.tag === 'main')?.orientation || 'vertical'
        const mainW = orientation === 'vertical' ? 56 : 300
        const mainH = orientation === 'vertical' ? 300 : 56

        const mainBounds = ensureWindowInVisibleBounds({
          x: Math.round(workArea.x + (workArea.width - mainW) / 2),
          y: Math.round(workArea.y + (workArea.height - mainH) / 2),
          width: mainW,
          height: mainH,
        })

        const actorBounds = ensureWindowInVisibleBounds({
          x: Math.round(workArea.x + (workArea.width - 450) / 2),
          y: Math.round(workArea.y + (workArea.height - 600) / 2),
          width: 450,
          height: 600,
        })

        const chatBounds = ensureWindowInVisibleBounds({
          x: Math.round(workArea.x + (workArea.width - 600) / 2),
          y: Math.round(workArea.y + (workArea.height - 800) / 2),
          width: 600,
          height: 800,
        })

        const captionBounds = ensureWindowInVisibleBounds({
          x: Math.round(workArea.x + (workArea.width - 480) / 2),
          y: Math.round(workArea.y + (workArea.height - 180) / 2),
          width: 480,
          height: 180,
        })

        const appConfig = deps.appConfig.get()
        if (appConfig) {
          const windows = appConfig.windows || []
          const updateWin = (tag: string, bounds: Rectangle, extra = {}) => {
            const idx = windows.findIndex((w: any) => w.tag === tag)
            if (idx !== -1) {
              windows[idx] = {
                ...windows[idx],
                ...bounds,
                ...extra,
              }
            }
            else {
              windows.push({
                title: 'AIRI',
                tag,
                ...bounds,
                ...extra,
              })
            }
          }
          updateWin('main', mainBounds, { orientation })
          updateWin('actor', actorBounds)
          updateWin('chat', chatBounds)
          updateWin('caption', captionBounds)
          appConfig.windows = windows
          deps.appConfig.update(appConfig)
        }

        if (deps.mainWindow && !deps.mainWindow.isDestroyed()) {
          deps.mainWindow.setBounds(mainBounds)
        }
        if (deps.stageWindow && !deps.stageWindow.isDestroyed()) {
          deps.stageWindow.setBounds(actorBounds)
        }
        const chatWin = await deps.chatWindow()
        if (chatWin && !chatWin.isDestroyed() && chatWin.isVisible()) {
          chatWin.setBounds(chatBounds)
        }
        const capWin = await deps.captionWindow.getWindow()
        if (capWin && !capWin.isDestroyed()) {
          capWin.setBounds(captionBounds)
        }
      }

      ipcMain.on('reset-window-positions-action', handleResetWindowPositions)

      // NOTICE: ControlStrip.vue calls `ipcRenderer.invoke('eventa:invoke:electron:windows:get-monitor-count')
      // directly (via the raw Electron IPC invoke path, which requires ipcMain.handle).
      // defineInvokeHandler routes over Eventa's 'eventa-message' channel instead, so it
      // cannot satisfy a raw ipcRenderer.invoke call. We register both to cover both paths.
      defineInvokeHandler(context, electronGetMonitorCount, async () => {
        return screen.getAllDisplays().length
      })
      ipcMain.handle('eventa:invoke:electron:windows:get-monitor-count', async () => {
        return screen.getAllDisplays().length
      })

      defineInvokeHandler(context, electronResetWindowPositions, handleResetWindowPositions)

      if (deps.stageWindow && !deps.stageWindow.isDestroyed()) {
        deps.stageWindow.on('show', () => {
          if (deps.captionWindow.getIsFollowingWindow()) {
            deps.captionWindow.toggleVisibility(true)
          }
        })
        deps.stageWindow.on('hide', () => {
          if (deps.captionWindow.getIsFollowingWindow()) {
            deps.captionWindow.toggleVisibility(false)
          }
        })
      }

      const restoreCaption = () => {
        // Auto-restore caption window if enabled in config
        if (deps.appConfig.get()?.windows?.find((w: any) => w.tag === 'caption')?.enabled) {
          deps.captionWindow.toggleVisibility()
        }
      }

      if (deps.mainWindow.isVisible()) {
        restoreCaption()
      }
      else {
        deps.mainWindow.once('ready-to-show', restoreCaption)
      }

      import('./libs/bootkit/lifecycle').then((m) => {
        m.onAppBeforeQuit(async () => {
          console.log('[@proj-airi/stage-tamagotchi] App is quitting, flushing all configs...')
          const sensorsService = await sensorsServicePromise
          sensorsService.stop()
          flushAllConfigs()
        })
      })

      ipcMain.handle('save-backup-bundle', async (_event, data: { timestamp: string, files: Record<string, string>, customPath?: string }) => {
        console.log('[Backup] Received backup bundle request')
        const fs = await import('node:fs/promises')
        const path = await import('node:path')

        const defaultPath = path.join(app.getPath('documents'), 'AIRI-Backups')
        const savePath = data.customPath || defaultPath

        try {
          await fs.mkdir(savePath, { recursive: true })

          // Save files into a folder named with timestamp
          const bundleDir = path.join(savePath, `backup-${data.timestamp}`)
          await fs.mkdir(bundleDir, { recursive: true })

          for (const [filename, content] of Object.entries(data.files)) {
            await fs.writeFile(path.join(bundleDir, filename), content)
          }

          console.log(`[Backup] Backup saved to ${bundleDir}`)
          return { success: true, path: bundleDir }
        }
        catch (error) {
          console.error('[Backup] Failed to save backup:', error)
          throw error
        }
      })

      ipcMain.on('provider-validation-result', (_, data: { providerId: string, valid: boolean, reason: string, config: any }) => {
        if (data.valid)
          return

        const status = 'FAIL'
        const color = '\x1B[31m'
        const reset = '\x1B[0m'
        console.log(`${color}[Provider Validation]${reset} [${data.providerId}] ${status}`)
        if (!data.valid) {
          console.log(`  └─ Reason: ${data.reason}`)
        }
        if (data.config && (data.valid || !data.reason?.includes('required'))) {
          console.log(`  └─ Config: ${JSON.stringify(data.config)}`)
        }
      })

      ipcMain.on('llm-raw-output', (_, data: { type: 'delta' | 'full', text: string, sessionId: string }) => {
        const reset = '\x1B[0m'
        const cyan = '\x1B[36m'
        // const yellow = '\x1B[33m'
        if (data.type === 'delta') {
          /*
          // Log deltas in yellow, but only if they are not just whitespace (too noisy otherwise)
          if (data.text.trim()) {
            console.log(`${yellow}[LLM Delta]${reset} ${data.text}`)
          }
          */
        }
        else {
          console.log(`${cyan}[LLM Final Output]${reset} Session: ${data.sessionId}`)
          console.log(`----------------------------------------`)
          console.log(data.text)
          console.log(`----------------------------------------`)
        }
      })
    },
  })

  injeca.start().catch(err => console.error(err))

  emitAppReady()
  openDebugger()

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })
}).catch((err) => {
  log.withError(err).error('Error during app initialization')
})

app.on('window-all-closed', () => {
  emitAppWindowAllClosed()
  if (platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', (event) => {
  event.preventDefault()
  const allWindows = BrowserWindow.getAllWindows()

  // 1. Settings Window (if it exists and is visible)
  const settingsWin = allWindows.find(w => !w.isDestroyed() && w.getTitle() === 'AIRI - Settings' && w.isVisible())
  if (settingsWin) {
    settingsWin.focus()
    return
  }

  // 2. Chat Window (if it exists and is visible)
  const chatWin = allWindows.find(w => !w.isDestroyed() && w.getTitle() === 'AIRI - Chat Window' && w.isVisible())
  if (chatWin) {
    chatWin.focus()
    return
  }

  // 3. Actor Stage Window (if it exists and is visible)
  const stageWin = allWindows.find(w => !w.isDestroyed() && w.getTitle() === 'AIRI - Actor Stage' && w.isVisible())
  if (stageWin) {
    stageWin.focus()
    return
  }

  // 4. Fallback to Control Strip / Main Window
  const mainWin = allWindows.find(w => !w.isDestroyed() && (w as any).__is_main_window === true)
  if (mainWin) {
    mainWin.show()
    mainWin.focus()
  }
})

let isQuitting = false
app.on('before-quit', async (event) => {
  if (isQuitting)
    return

  event.preventDefault()
  isQuitting = true

  console.log('[@proj-airi/stage-tamagotchi] Shutdown sequence started...')

  try {
    // NOTICE: We await the initialization-level hooks and the DI container stop
    // sequence to ensure all services have a chance to flush state or close handles.
    await emitAppBeforeQuit()
    await injeca.stop()
    cleanupMicToggleShortcut()
    console.log('[@proj-airi/stage-tamagotchi] Shutdown complete. Quitting...')
  }
  catch (err) {
    console.error('[@proj-airi/stage-tamagotchi] Error during shutdown sequence:', err)
  }
  finally {
    app.quit()
  }
})

// NOTICE: Handle termination signals to ensure Electron's quit sequence is triggered
// even when the app is started from a terminal that is subsequently closed.
process.on('SIGINT', () => app.quit())
process.on('SIGTERM', () => app.quit())
process.on('SIGHUP', () => app.quit())
