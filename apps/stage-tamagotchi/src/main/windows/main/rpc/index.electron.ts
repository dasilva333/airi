import type { I18n } from '../../../libs/i18n'
import type { ServerChannel } from '../../../services/airi/channel-server'
import type { McpStdioManager } from '../../../services/airi/mcp-servers'
import type { AutoUpdater } from '../../../services/electron/auto-updater'
import type { ChatWindowManager } from '../../chat'
import type { NoticeWindowManager } from '../../notice'
import type { OnboardingWindowManager } from '../../onboarding'
import type { SettingsWindowManager } from '../../settings'
import type { WidgetsWindowManager } from '../../widgets'

import clickDragPlugin from 'electron-click-drag-plugin'

import { defineInvokeHandler } from '@moeru/eventa'
import { createContext } from '@moeru/eventa/adapters/electron/main'
import { BrowserWindow, ipcMain } from 'electron'
import { isLinux } from 'std-env'

import {
  electronControlStripSyncState,
  electronGetMainWindowConfig,
  electronOpenChat,
  electronOpenMainDevtools,
  electronOpenSettings,
  electronStartDraggingWindow,
  noticeWindowEventa,
} from '../../../../shared/eventa'
import { createMcpServersService } from '../../../services/airi/mcp-servers'
import { createOnboardingService } from '../../../services/airi/onboarding'
import { createWidgetsService } from '../../../services/airi/widgets'
import { createAutoUpdaterService } from '../../../services/electron'
import { createDockModeService } from '../../../services/electron/dock-mode'
import { setupBaseWindowElectronInvokes } from '../../shared/window'

export async function setupMainWindowElectronInvokes(params: {
  window: BrowserWindow
  settingsWindow: SettingsWindowManager
  chatWindow: ChatWindowManager
  widgetsManager: WidgetsWindowManager
  noticeWindow: NoticeWindowManager
  autoUpdater: AutoUpdater
  serverChannel: ServerChannel
  mcpStdioManager: McpStdioManager
  i18n: I18n
  onboardingWindowManager: OnboardingWindowManager
  appConfig: any
}) {
  // TODO: once we refactored eventa to support window-namespaced contexts,
  // we can remove the setMaxListeners call below since eventa will be able to dispatch and
  // manage events within eventa's context system.
  ipcMain.setMaxListeners(0)

  const { context } = createContext(ipcMain, params.window)

  await setupBaseWindowElectronInvokes({ context, window: params.window, serverChannel: params.serverChannel, i18n: params.i18n })
  createWidgetsService({ context, widgetsManager: params.widgetsManager, window: params.window })
  createAutoUpdaterService({ context, window: params.window, service: params.autoUpdater })
  createMcpServersService({ context, manager: params.mcpStdioManager })
  createOnboardingService({ context, onboardingWindowManager: params.onboardingWindowManager })
  createDockModeService({ context, window: params.window })

  defineInvokeHandler(context, electronOpenMainDevtools, () => params.window.webContents.openDevTools({ mode: 'detach' }))
  defineInvokeHandler(context, electronOpenSettings, async payload => params.settingsWindow.openWindow(payload?.route))
  defineInvokeHandler(context, electronOpenChat, async (enabled?: boolean) => {
    await params.chatWindow.openChat(enabled)
  })
  defineInvokeHandler(context, noticeWindowEventa.openWindow, payload => params.noticeWindow.open(payload))

  defineInvokeHandler(context, electronGetMainWindowConfig, () => {
    return (params.window as any).__airi_config
  })

  defineInvokeHandler(context, electronControlStripSyncState, (payload) => {
    if (payload) {
      // console.log('[Main RPC] electronControlStripSyncState received payload:', JSON.stringify(payload, null, 2))
      ;(params.window as any).__control_strip_state = payload

      const config = params.appConfig.get()
      if (config) {
        if (!config.windows) {
          config.windows = []
        }
        const existingConfigIndex = config.windows.findIndex((w: any) => w.title === 'AIRI' && w.tag === 'main')
        if (existingConfigIndex !== -1) {
          config.windows[existingConfigIndex].orientation = payload.orientation
          config.windows[existingConfigIndex].collapsed = payload.collapsed
          config.windows[existingConfigIndex].backgroundColor = payload.backgroundColor
          params.appConfig.update(config)
          ;(params.window as any).__airi_config = config.windows[existingConfigIndex]
        }
        else {
          const newWin = {
            title: 'AIRI',
            tag: 'main',
            orientation: payload.orientation,
            collapsed: payload.collapsed,
            backgroundColor: payload.backgroundColor,
          }
          config.windows.push(newWin)
          params.appConfig.update(config)
          ;(params.window as any).__airi_config = newWin
        }
        // console.log('[Main RPC] Updated window config after sync:', JSON.stringify((params.window as any).__airi_config, null, 2))
      }
    }
  })

  if (!isLinux) {
    defineInvokeHandler(context, electronStartDraggingWindow, (_payload, handlerOptions: any) => {
      try {
        const sender = handlerOptions?.raw?.ipcMainEvent?.sender
        const win = sender ? (BrowserWindow.fromWebContents(sender) ?? params.window) : params.window
        const windowId = win.getNativeWindowHandle()
        clickDragPlugin.startDrag(windowId)
      }
      catch (error) {
        console.error(error)
      }
    })
  }

  ipcMain.on('main-window-config-updated', (_event, config) => {
    params.window.webContents.send('eventa:event:electron:windows:main:config-changed', config)
  })
}
