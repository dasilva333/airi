import { join, resolve } from 'node:path'
import { BrowserWindow, shell } from 'electron'
import icon from '../../../../resources/icon.png?asset'
import { baseUrl, getElectronMainDirname, load, withHashRoute } from '../../libs/electron/location'
import { createReusableWindow } from '../../libs/electron/window-manager'
import type { I18n } from '../../libs/i18n'
import type { ServerChannel } from '../../services/airi/channel-server'
import type { AutoUpdater } from '../../services/electron/auto-updater'
import { setupAboutWindowElectronInvokes } from './rpc/index.electron'

export function setupAboutWindowReusable(params: {
  autoUpdater: AutoUpdater
  i18n: I18n
  serverChannel: ServerChannel
}) {
  return createReusableWindow(async () => {
    const window = new BrowserWindow({
      height: 730,
      icon,
      maximizable: false,
      minimizable: false,
      resizable: true,
      show: false,
      title: 'About AIRI',
      webPreferences: {
        preload: join(getElectronMainDirname(), '../preload/index.cjs'),
        sandbox: true,
      },
      width: 670,
    })

    window.on('ready-to-show', () => window.show())
    window.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url)
      return { action: 'deny' }
    })

    await load(window, withHashRoute(baseUrl(resolve(getElectronMainDirname(), '..', 'renderer')), '/about'))

    await setupAboutWindowElectronInvokes({
      autoUpdater: params.autoUpdater,
      i18n: params.i18n,
      serverChannel: params.serverChannel,
      window,
    })

    return window
  }).getWindow
}
