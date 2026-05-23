import type { globalAppConfigSchema } from '../../configs/global'
import type { Config } from '../../libs/electron/persistence'
import type { I18n } from '../../libs/i18n'
import type { ServerChannel } from '../../services/airi/channel-server'
import type { McpStdioManager } from '../../services/airi/mcp-servers'
import type { WidgetsWindowManager } from '../widgets'

import { join, resolve } from 'node:path'

import { BrowserWindow, shell } from 'electron'
import { throttle } from 'es-toolkit'

import icon from '../../../../resources/icon.png?asset'

import { baseUrl, getElectronMainDirname, load, withHashRoute } from '../../libs/electron/location'
import { createReusableWindow } from '../../libs/electron/window-manager'
import { ensureWindowInVisibleBounds } from '../shared/display'
import { setupChatWindowElectronInvokes } from './rpc/index.electron'

export function setupChatWindowReusableFunc(params: {
  widgetsManager: WidgetsWindowManager
  serverChannel: ServerChannel
  mcpStdioManager: McpStdioManager
  i18n: I18n
  appConfig: Config<typeof globalAppConfigSchema>
}) {
  return createReusableWindow(async () => {
    const getConfig = () => params.appConfig.get() ?? { language: 'en', windows: [], microphoneToggleHotkey: 'Scroll' as const }
    const chatConfig = getConfig().windows?.find((w: any) => w.title === 'AIRI' && w.tag === 'chat')

    let initialWidth = chatConfig?.width ?? 600.0
    let initialHeight = chatConfig?.height ?? 800.0
    let initialX = chatConfig?.x
    let initialY = chatConfig?.y

    if (initialX !== undefined && initialY !== undefined) {
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
      title: 'AIRI - Chat Window',
      width: initialWidth,
      height: initialHeight,
      x: initialX,
      y: initialY,
      show: false,
      icon,
      webPreferences: {
        preload: join(getElectronMainDirname(), '../preload/index.cjs'),
        sandbox: true,
      },
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
      console.log('[Main Process] [Chat Window] Event: "ready-to-show" triggered. Displaying window...')
      window.show()
      setTimeout(() => restoreBounds(), 500)
    })
    window.on('show', () => {
      console.log('[Main Process] [Chat Window] Event: "show" triggered.')
      const allWins = BrowserWindow.getAllWindows()
      const mainWin = allWins.find(w => (w as any).__is_main_window === true)
      console.log(`[Main Process] [Chat Window] Searching for main window. Total windows: ${allWins.length}, Main window found: ${!!mainWin}`)
      if (mainWin && !mainWin.isDestroyed()) {
        console.log('[Main Process] [Chat Window] Sending "chat-window-state" -> true to main window webContents')
        mainWin.webContents.send('chat-window-state', true)
      }
    })
    window.on('hide', () => {
      console.log('[Main Process] [Chat Window] Event: "hide" triggered.')
      const allWins = BrowserWindow.getAllWindows()
      const mainWin = allWins.find(w => (w as any).__is_main_window === true)
      console.log(`[Main Process] [Chat Window] Searching for main window. Total windows: ${allWins.length}, Main window found: ${!!mainWin}`)
      if (mainWin && !mainWin.isDestroyed()) {
        console.log('[Main Process] [Chat Window] Sending "chat-window-state" -> false to main window webContents')
        mainWin.webContents.send('chat-window-state', false)
      }
    })
    window.on('closed', () => {
      console.log('[Main Process] [Chat Window] Event: "closed" triggered.')
      const allWins = BrowserWindow.getAllWindows()
      const mainWin = allWins.find(w => (w as any).__is_main_window === true)
      console.log(`[Main Process] [Chat Window] Searching for main window. Total windows: ${allWins.length}, Main window found: ${!!mainWin}`)
      if (mainWin && !mainWin.isDestroyed()) {
        console.log('[Main Process] [Chat Window] Sending "chat-window-state" -> false to main window webContents')
        mainWin.webContents.send('chat-window-state', false)
      }
    })

    function handleNewBounds(newBounds: { x: number, y: number, width: number, height: number }) {
      if (window.isDestroyed())
        return

      const config = getConfig()
      if (!config.windows || !Array.isArray(config.windows)) {
        config.windows = []
      }

      const existingConfigIndex = config.windows.findIndex((w: any) => w.title === 'AIRI' && w.tag === 'chat')

      if (existingConfigIndex === -1) {
        config.windows.push({
          title: 'AIRI',
          tag: 'chat',
          x: Math.round(newBounds.x),
          y: Math.round(newBounds.y),
          width: Math.round(newBounds.width),
          height: Math.round(newBounds.height),
        })
      }
      else {
        const currentConfig = config.windows[existingConfigIndex]
        config.windows[existingConfigIndex] = {
          ...currentConfig,
          x: Math.round(newBounds.x),
          y: Math.round(newBounds.y),
          width: Math.round(newBounds.width),
          height: Math.round(newBounds.height),
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
      window,
      widgetsManager: params.widgetsManager,
      serverChannel: params.serverChannel,
      mcpStdioManager: params.mcpStdioManager,
      i18n: params.i18n,
    })

    return window
  }).getWindow
}
