import { join, resolve } from 'node:path'
import { defineInvokeHandler } from '@moeru/eventa'
import { createContext } from '@moeru/eventa/adapters/electron/main'
import { BrowserWindow, ipcMain, shell } from 'electron'
import icon from '../../../../resources/icon.png?asset'
import { electronOnboardingClose, electronOnboardingCompleted, electronOnboardingSkipped } from '../../../shared/eventa'
import { baseUrl, getElectronMainDirname, load, withHashRoute } from '../../libs/electron/location'
import { createReusableWindow } from '../../libs/electron/window-manager'
import type { I18n } from '../../libs/i18n'
import type { ServerChannel } from '../../services/airi/channel-server'
import { toggleWindowShow } from '../shared'
import { setupBaseWindowElectronInvokes } from '../shared/window'

export interface OnboardingWindowManager {
  getWindow: () => Promise<BrowserWindow>
  getAndToggleWindow: () => Promise<BrowserWindow>
}

export function setupOnboardingWindowManager(params: {
  serverChannel: ServerChannel
  i18n: I18n
}): OnboardingWindowManager {
  async function getOnboardingWindow(getWindow: () => Promise<BrowserWindow>) {
    const window = await getWindow()
    await toggleWindowShow(window)

    return window
  }

  const reusableWindow = createReusableWindow(async () => {
    const newWindow = new BrowserWindow({
      backgroundColor: '#0f0f0f',
      frame: false,
      height: 600,
      icon,
      minHeight: 500,
      minWidth: 400,
      resizable: true,
      show: false,
      title: 'Welcome to AIRI',
      titleBarStyle: 'hidden',
      transparent: false,
      webPreferences: {
        preload: join(getElectronMainDirname(), '../preload/index.cjs'),
        sandbox: true,
      },
      width: 1200,
    })

    newWindow.on('ready-to-show', () => newWindow.show())
    newWindow.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url)
      return { action: 'deny' }
    })

    // TODO: once we refactored eventa to support window-namespaced contexts,
    // we can remove the setMaxListeners call below since eventa will be able to dispatch and
    // manage events within eventa's context system.
    ipcMain.setMaxListeners(0)

    const { context } = createContext(ipcMain, newWindow)

    defineInvokeHandler(context, electronOnboardingClose, async () => newWindow.close())
    defineInvokeHandler(context, electronOnboardingCompleted, async () => newWindow.close())
    defineInvokeHandler(context, electronOnboardingSkipped, async () => newWindow.close())

    await setupBaseWindowElectronInvokes({
      context,
      i18n: params.i18n,
      serverChannel: params.serverChannel,
      window: newWindow,
    })

    await load(newWindow, withHashRoute(baseUrl(resolve(getElectronMainDirname(), '..', 'renderer')), '/onboarding'))

    return newWindow
  })

  return {
    getAndToggleWindow: async () => await getOnboardingWindow(reusableWindow.getWindow),
    getWindow: async () => reusableWindow.getWindow(),
  }
}
