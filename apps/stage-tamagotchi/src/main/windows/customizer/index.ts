import type { BrowserWindowConstructorOptions } from 'electron'

import type { I18n } from '../../libs/i18n'
import type { ServerChannel } from '../../services/airi/channel-server'

import { join, resolve } from 'node:path'

import { defineInvokeHandler } from '@moeru/eventa'
import { createContext } from '@moeru/eventa/adapters/electron/main'
import { BrowserWindow as ElectronBrowserWindow, ipcMain, shell } from 'electron'
import { isMacOS } from 'std-env'

import icon from '../../../../resources/icon.png?asset'

import { electronCustomizerToggleVisibility, electronGetCustomizerWindowState } from '../../../shared/eventa'
import { baseUrl, getElectronMainDirname, load, withHashRoute } from '../../libs/electron/location'
import { createReusableWindow } from '../../libs/electron/window-manager'
import { setupBaseWindowElectronInvokes, transparentWindowConfig } from '../shared/window'

function createCustomizerWindow(options?: BrowserWindowConstructorOptions) {
  const window = new ElectronBrowserWindow({
    title: 'Customizer',
    width: 780,
    height: 620,
    show: false,
    icon,
    webPreferences: {
      preload: join(getElectronMainDirname(), '../preload/index.cjs'),
      sandbox: true,
    },
    type: 'panel',
    ...transparentWindowConfig(),
    ...options,
  })

  window.setAlwaysOnTop(true, 'screen-saver', 2)
  window.setFullScreenable(false)
  window.setVisibleOnAllWorkspaces(true)
  if (isMacOS) {
    window.setWindowButtonVisibility(false)
  }

  window.on('ready-to-show', () => window.show())
  window.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  return window
}

export function setupCustomizerWindowManager(params: {
  mainWindow: ElectronBrowserWindow
  serverChannel: ServerChannel
  i18n: I18n
}) {
  let currentWindow: ElectronBrowserWindow | undefined
  const visibilityListeners = new Set<() => void>()

  const emitVisibilityChanged = () => {
    for (const listener of visibilityListeners) {
      try {
        listener()
      }
      catch {}
    }
  }

  const reusable = createReusableWindow(async () => {
    ipcMain.setMaxListeners(0)
    const window = createCustomizerWindow()
    currentWindow = window
    const { context } = createContext(ipcMain, window)

    await setupBaseWindowElectronInvokes({ context, window, serverChannel: params.serverChannel, i18n: params.i18n })

    window.on('show', () => {
      emitVisibilityChanged()
      console.log('[@proj-airi/stage-tamagotchi] [Main] Customizer window shown, broadcasting state')
      if (params.mainWindow && !params.mainWindow.isDestroyed()) {
        params.mainWindow.webContents.send('customizer-window-state', true)
      }
    })
    window.on('hide', () => {
      emitVisibilityChanged()
      console.log('[@proj-airi/stage-tamagotchi] [Main] Customizer window hidden, broadcasting state')
      if (params.mainWindow && !params.mainWindow.isDestroyed()) {
        params.mainWindow.webContents.send('customizer-window-state', false)
      }
    })

    await load(window, withHashRoute(baseUrl(resolve(getElectronMainDirname(), '..', 'renderer')), '/customizer'))

    window.on('closed', () => {
      if (currentWindow === window) {
        currentWindow = undefined
      }
      emitVisibilityChanged()
      console.log('[@proj-airi/stage-tamagotchi] [Main] Customizer window closed, broadcasting state')
      if (params.mainWindow && !params.mainWindow.isDestroyed()) {
        params.mainWindow.webContents.send('customizer-window-state', false)
      }
    })

    return window
  })

  function isVisible(): boolean {
    return Boolean(currentWindow && !currentWindow.isDestroyed() && currentWindow.isVisible())
  }

  async function toggleVisibility(payload?: boolean | { enabled?: boolean, group?: string }) {
    const enabled = typeof payload === 'object' ? payload.enabled : payload
    const group = typeof payload === 'object' ? payload.group : undefined

    if (enabled === undefined) {
      if (isVisible()) {
        currentWindow?.hide()
      }
      else {
        const window = await reusable.getWindow()
        if (window.isMinimized()) {
          window.restore()
        }
        window.show()
        window.focus()
      }
    }
    else if (enabled) {
      const window = await reusable.getWindow()
      if (window.isMinimized()) {
        window.restore()
      }
      window.show()
      window.focus()
    }
    else {
      currentWindow?.hide()
    }

    if (group && currentWindow && !currentWindow.isDestroyed() && isVisible()) {
      currentWindow.webContents.send('set-customizer-group', group)
    }
  }

  // Bind Eventa Invokes to this manager
  const { context: mainContext } = createContext(ipcMain, params.mainWindow)
  defineInvokeHandler(mainContext, electronCustomizerToggleVisibility, async (payload) => {
    await toggleVisibility(payload)
  })
  defineInvokeHandler(mainContext, electronGetCustomizerWindowState, async () => {
    return isVisible()
  })

  return {
    getWindow: reusable.getWindow,
    isVisible,
    toggleVisibility,
    onVisibilityChanged: (listener: () => void) => {
      visibilityListeners.add(listener)
      return () => {
        visibilityListeners.delete(listener)
      }
    },
  }
}

export type CustomizerWindowManager = ReturnType<typeof setupCustomizerWindowManager>
