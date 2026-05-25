import { defineInvokeHandler } from '@moeru/eventa'
import { createContext } from '@moeru/eventa/adapters/electron/main'
import type { BrowserWindow } from 'electron'
import { ipcMain } from 'electron'
import {
  electronOpenChat,
  electronOpenMainDevtools,
  electronOpenSettings,
  noticeWindowEventa,
} from '../../../../shared/eventa'
import type { I18n } from '../../../libs/i18n'
import type { ServerChannel } from '../../../services/airi/channel-server'
import type { NoticeWindowManager } from '../../notice'
import type { SettingsWindowManager } from '../../settings'
import { toggleWindowShow } from '../../shared'
import { setupBaseWindowElectronInvokes } from '../../shared/window'

export async function setupDashboardWindowElectronInvokes(params: {
  window: BrowserWindow
  settingsWindow: SettingsWindowManager
  chatWindow: () => Promise<BrowserWindow>
  noticeWindow: NoticeWindowManager
  i18n: I18n
  serverChannel: ServerChannel
}) {
  // TODO: once we refactored eventa to support window-namespaced contexts,
  // we can remove the setMaxListeners call below since eventa will be able to dispatch and
  // manage events within eventa's context system.
  ipcMain.setMaxListeners(0)

  const { context } = createContext(ipcMain, params.window)

  await setupBaseWindowElectronInvokes({
    context,
    i18n: params.i18n,
    serverChannel: params.serverChannel,
    window: params.window,
  })

  defineInvokeHandler(context, electronOpenMainDevtools, () =>
    params.window.webContents.openDevTools({ mode: 'detach' }),
  )
  defineInvokeHandler(context, electronOpenSettings, (payload) => params.settingsWindow.openWindow(payload?.route))
  defineInvokeHandler(context, electronOpenChat, async () => toggleWindowShow(await params.chatWindow()))
  defineInvokeHandler(context, noticeWindowEventa.openWindow, (payload) => params.noticeWindow.open(payload))
}
