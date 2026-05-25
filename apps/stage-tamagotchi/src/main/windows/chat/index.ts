import { join, resolve } from 'node:path'
import { BrowserWindow, shell } from 'electron'
import { throttle } from 'es-toolkit'
import icon from '../../../../resources/icon.png?asset'
import type { globalAppConfigSchema } from '../../configs/global'
import { baseUrl, getElectronMainDirname, load, withHashRoute } from '../../libs/electron/location'
import type { Config } from '../../libs/electron/persistence'
import { createReusableWindow } from '../../libs/electron/window-manager'
import type { I18n } from '../../libs/i18n'
import type { ServerChannel } from '../../services/airi/channel-server'
import type { McpStdioManager } from '../../services/airi/mcp-servers'
import { ensureWindowInVisibleBounds } from '../shared/display'
import type { WidgetsWindowManager } from '../widgets'
import { setupChatWindowElectronInvokes } from './rpc/index.electron'

export function setupChatWindowReusableFunc(params: {
  widgetsManager: WidgetsWindowManager
  serverChannel: ServerChannel
  mcpStdioManager: McpStdioManager
  i18n: I18n
  appConfig: Config<typeof globalAppConfigSchema>
}) {
  return createReusableWindow(async () => {
    const getConfig = () =>
      params.appConfig.get() ?? { language: 'en', microphoneToggleHotkey: 'Scroll' as const, windows: [] }
    const chatConfig = getConfig().windows?.find((w: any) => w.title === 'AIRI' && w.tag === 'chat')

    let initialWidth = chatConfig?.width ?? 600.0
    let initialHeight = chatConfig?.height ?? 800.0
    let initialX = chatConfig?.x
    let initialY = chatConfig?.y

    if (initialX !== undefined && initialY !== undefined) {
      const valid = ensureWindowInVisibleBounds({
        height: Math.round(initialHeight),
        width: Math.round(initialWidth),
        x: Math.round(initialX),
        y: Math.round(initialY),
      })
      initialX = valid.x
      initialY = valid.y
      initialWidth = valid.width
      initialHeight = valid.height
    }

    const window = new BrowserWindow({
      height: initialHeight,
      icon,
      show: false,
      title: 'AIRI - Chat Window',
      webPreferences: {
        preload: join(getElectronMainDirname(), '../preload/index.cjs'),
        sandbox: true,
      },
      width: initialWidth,
      x: initialX,
      y: initialY,
    })

    function restoreBounds() {
      const config = getConfig()
      const currentChatConfig = config.windows?.find((w: any) => w.title === 'AIRI' && w.tag === 'chat')
      const x = currentChatConfig?.x
      const y = currentChatConfig?.y
      const width = currentChatConfig?.width ?? 600.0
      const height = currentChatConfig?.height ?? 800.0
      if (x !== undefined && y !== undefined) {
        const valid = ensureWindowInVisibleBounds({
          height: Math.round(height),
          width: Math.round(width),
          x: Math.round(x),
          y: Math.round(y),
        })
        window.setBounds(valid)
      }
    }

    window.on('ready-to-show', () => {
      restoreBounds()
      console.log('[Main Process] [Chat Window] Event: "ready-to-show" triggered. Displaying window...')
      window.show()
      setTimeout(() => restoreBounds(), 500)
    })
    window.on('show', () => {
      console.log('[Main Process] [Chat Window] Event: "show" triggered.')
      const allWins = BrowserWindow.getAllWindows()
      const mainWin = allWins.find((w) => (w as any).__is_main_window === true)
      console.log(
        `[Main Process] [Chat Window] Searching for main window. Total windows: ${allWins.length}, Main window found: ${!!mainWin}`,
      )
      if (mainWin && !mainWin.isDestroyed()) {
        console.log('[Main Process] [Chat Window] Sending "chat-window-state" -> true to main window webContents')
        mainWin.webContents.send('chat-window-state', true)
      }
    })
    window.on('hide', () => {
      console.log('[Main Process] [Chat Window] Event: "hide" triggered.')
      const allWins = BrowserWindow.getAllWindows()
      const mainWin = allWins.find((w) => (w as any).__is_main_window === true)
      console.log(
        `[Main Process] [Chat Window] Searching for main window. Total windows: ${allWins.length}, Main window found: ${!!mainWin}`,
      )
      if (mainWin && !mainWin.isDestroyed()) {
        console.log('[Main Process] [Chat Window] Sending "chat-window-state" -> false to main window webContents')
        mainWin.webContents.send('chat-window-state', false)
      }
    })
    window.on('closed', () => {
      console.log('[Main Process] [Chat Window] Event: "closed" triggered.')
      const allWins = BrowserWindow.getAllWindows()
      const mainWin = allWins.find((w) => (w as any).__is_main_window === true)
      console.log(
        `[Main Process] [Chat Window] Searching for main window. Total windows: ${allWins.length}, Main window found: ${!!mainWin}`,
      )
      if (mainWin && !mainWin.isDestroyed()) {
        console.log('[Main Process] [Chat Window] Sending "chat-window-state" -> false to main window webContents')
        mainWin.webContents.send('chat-window-state', false)
      }
    })

    function handleNewBounds(newBounds: { x: number; y: number; width: number; height: number }) {
      if (window.isDestroyed()) return

      const config = getConfig()
      if (!config.windows || !Array.isArray(config.windows)) {
        config.windows = []
      }

      const existingConfigIndex = config.windows.findIndex((w: any) => w.title === 'AIRI' && w.tag === 'chat')

      if (existingConfigIndex === -1) {
        config.windows.push({
          height: Math.round(newBounds.height),
          tag: 'chat',
          title: 'AIRI',
          width: Math.round(newBounds.width),
          x: Math.round(newBounds.x),
          y: Math.round(newBounds.y),
        })
      } else {
        const currentConfig = config.windows[existingConfigIndex]
        config.windows[existingConfigIndex] = {
          ...currentConfig,
          height: Math.round(newBounds.height),
          width: Math.round(newBounds.width),
          x: Math.round(newBounds.x),
          y: Math.round(newBounds.y),
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

    window.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url)
      return { action: 'deny' }
    })

    await load(window, withHashRoute(baseUrl(resolve(getElectronMainDirname(), '..', 'renderer')), '/chat'))

    await setupChatWindowElectronInvokes({
      i18n: params.i18n,
      mcpStdioManager: params.mcpStdioManager,
      serverChannel: params.serverChannel,
      widgetsManager: params.widgetsManager,
      window,
    })

    return window
  }).getWindow
}
