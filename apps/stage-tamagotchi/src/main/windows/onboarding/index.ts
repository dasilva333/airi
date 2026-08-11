import type { I18n } from '../../libs/i18n'
import type { ServerChannel } from '../../services/airi/channel-server'

import { join, resolve } from 'node:path'

import { defineInvokeHandler } from '@moeru/eventa'
import { createContext } from '@moeru/eventa/adapters/electron/main'
import { BrowserWindow, ipcMain, shell } from 'electron'

import icon from '../../../../resources/icon.png?asset'

import { electronOnboardingClose, electronOnboardingCompleted, electronOnboardingSkipped } from '../../../shared/eventa'
import { baseUrl, getElectronMainDirname, load, withHashRoute } from '../../libs/electron/location'
import { createReusableWindow } from '../../libs/electron/window-manager'
import { toggleWindowShow } from '../shared'
import { setupBaseWindowElectronInvokes } from '../shared/window'

export interface OnboardingWindowManager {
  getWindow: () => Promise<BrowserWindow>
  getAndToggleWindow: () => Promise<BrowserWindow>
  openWindow: (route?: string) => Promise<void>
}

export function setupOnboardingWindowManager(params: {
  serverChannel: ServerChannel
  i18n: I18n
}): OnboardingWindowManager {
  const rendererBase = baseUrl(resolve(getElectronMainDirname(), '..', 'renderer'))

  async function getOnboardingWindow(getWindow: () => Promise<BrowserWindow>) {
    const window = await getWindow()
    await toggleWindowShow(window)

    return window
  }

  const reusableWindow = createReusableWindow(async () => {
    const newWindow = new BrowserWindow({
      title: 'AIRI — Onboarding',
      width: 1200,
      height: 600,
      minWidth: 400,
      minHeight: 500,
      show: false,
      icon,
      resizable: true,
      frame: false,
      titleBarStyle: 'hidden',
      transparent: false,
      backgroundColor: '#0f0f0f',
      webPreferences: {
        preload: join(getElectronMainDirname(), '../preload/index.cjs'),
        sandbox: true,
      },
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

    await setupBaseWindowElectronInvokes({ context, window: newWindow, i18n: params.i18n, serverChannel: params.serverChannel })

    await load(newWindow, withHashRoute(rendererBase, '/onboarding'))

    return newWindow
  })

  async function openWindow(route: string = '/onboarding') {
    const window = await reusableWindow.getWindow()

    if (window.webContents) {
      await load(window, withHashRoute(rendererBase, route))
    }

    if (window.isVisible()) {
      window.show()
      window.focus()
    }
    else {
      toggleWindowShow(window)
    }
  }

  return {
    getWindow: async () => reusableWindow.getWindow(),
    getAndToggleWindow: async () => await getOnboardingWindow(reusableWindow.getWindow),
    openWindow,
  }
}
