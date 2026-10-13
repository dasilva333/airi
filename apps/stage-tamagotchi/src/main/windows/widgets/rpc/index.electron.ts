import type { BrowserWindow } from 'electron'

import type { I18n } from '../../../libs/i18n'
import type { ServerChannel } from '../../../services/airi/channel-server'
import type { WidgetsWindowManager } from '../../widgets'

import { defineInvokeHandler } from '@moeru/eventa'
import { createContext } from '@moeru/eventa/adapters/electron/main'
import { ipcMain } from 'electron'

import { electronOpenMainDevtools } from '../../../../shared/eventa'
import { createWidgetsService } from '../../../services/airi/widgets'
import { setupBaseWindowElectronInvokes } from '../../shared/window'

export async function setupWidgetsWindowInvokes(params: {
  widgetWindow: BrowserWindow
  widgetsManager: WidgetsWindowManager
  i18n: I18n
  serverChannel: ServerChannel
  context?: ReturnType<typeof createContext>['context']
}) {
  // TODO: once we refactored eventa to support window-namespaced contexts,
  // we can remove the setMaxListeners call below since eventa will be able to dispatch and
  // manage events within eventa's context system.
  ipcMain.setMaxListeners(0)

  const context = params.context ?? createContext(ipcMain, params.widgetWindow, { onlySameWindow: true }).context

  setupBaseWindowElectronInvokes({ context, window: params.widgetWindow, i18n: params.i18n, serverChannel: params.serverChannel })

  createWidgetsService({ context, widgetsManager: params.widgetsManager, window: params.widgetWindow })

  defineInvokeHandler(context, electronOpenMainDevtools, () => {
    if (params.widgetWindow.isDestroyed())
      return

    if (params.widgetWindow.webContents.isDevToolsOpened()) {
      params.widgetWindow.webContents.closeDevTools()
    }
    else {
      params.widgetWindow.webContents.openDevTools({ mode: 'detach' })
    }
  })

  return { context }
}
