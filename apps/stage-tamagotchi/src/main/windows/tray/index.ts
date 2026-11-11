import type { BrowserWindowConstructorOptions, Rectangle } from 'electron'

import type { I18n } from '../../libs/i18n'
import type { ServerChannel } from '../../services/airi/channel-server'

import { join, resolve } from 'node:path'

import { defineInvokeHandler } from '@moeru/eventa'
import { createContext } from '@moeru/eventa/adapters/electron/main'
import { BrowserWindow as ElectronBrowserWindow, ipcMain, screen, shell } from 'electron'
import { isMacOS } from 'std-env'

import icon from '../../../../resources/icon.png?asset'

import {
  electronTrayPopoverClose,
  electronTrayPopoverGetPinState,
  electronTrayPopoverTogglePin,
} from '../../../shared/eventa'
import { baseUrl, getElectronMainDirname, load, withHashRoute } from '../../libs/electron/location'
import { createReusableWindow } from '../../libs/electron/window-manager'
import { showWindowOnAllWorkspaces } from '../shared/app-icon'
import { setupBaseWindowElectronInvokes, transparentWindowConfig } from '../shared/window'

export interface TrayWindowManager {
  getWindow: () => Promise<ElectronBrowserWindow>
  hasWindow: () => boolean
  getExistingWindow: () => ElectronBrowserWindow | undefined
  isVisible: () => boolean
  toggle: (bounds?: Rectangle) => Promise<void>
  show: (bounds?: Rectangle) => Promise<void>
  hide: () => void
  isPinned: () => boolean
}

export function calculatePopoverPosition(
  trayBounds: Rectangle,
  windowSize: { width: number, height: number } = { width: 390, height: 580 },
): { x: number, y: number, notchOffset: number } {
  const display = screen.getDisplayNearestPoint({ x: trayBounds.x, y: trayBounds.y })
  const { workArea, bounds } = display

  const x = Math.round(trayBounds.x + trayBounds.width / 2 - windowSize.width / 2)
  let y = 0

  if (isMacOS) {
    y = Math.round(trayBounds.y + trayBounds.height + 4)
  }
  else {
    const isTaskbarBottom = workArea.y === 0 && workArea.height < bounds.height
    if (isTaskbarBottom) {
      y = Math.round(trayBounds.y - windowSize.height - 4)
    }
    else {
      y = Math.round(trayBounds.y + trayBounds.height + 4)
    }
  }

  const minX = workArea.x + 8
  const maxX = workArea.x + workArea.width - windowSize.width - 8
  const clampedX = Math.max(minX, Math.min(x, maxX))

  const iconCenter = trayBounds.x + trayBounds.width / 2
  const notchOffset = Math.round(iconCenter - clampedX)

  return { x: clampedX, y, notchOffset }
}

function createTrayWindow(options?: BrowserWindowConstructorOptions): ElectronBrowserWindow {
  const window = new ElectronBrowserWindow({
    title: 'AIRI Pocket',
    width: 390,
    height: 580,
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

  window.setAlwaysOnTop(true, 'screen-saver', 3)
  window.setFullScreenable(false)
  showWindowOnAllWorkspaces(window)
  if (isMacOS) {
    window.setWindowButtonVisibility(false)
  }

  window.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  return window
}

export function setupTrayWindowManager(params: {
  serverChannel: ServerChannel
  i18n: I18n
}): TrayWindowManager {
  let isPinned = false
  let currentWindow: ElectronBrowserWindow | undefined

  const reusable = createReusableWindow(async () => {
    const window = createTrayWindow()
    currentWindow = window

    const { context } = createContext(ipcMain, window)
    await setupBaseWindowElectronInvokes({
      context,
      window,
      serverChannel: params.serverChannel,
      i18n: params.i18n,
    })

    defineInvokeHandler(context, electronTrayPopoverTogglePin, (pinned) => {
      isPinned = typeof pinned === 'boolean' ? pinned : !isPinned
      return isPinned
    })

    defineInvokeHandler(context, electronTrayPopoverGetPinState, () => isPinned)

    defineInvokeHandler(context, electronTrayPopoverClose, () => {
      if (window && !window.isDestroyed()) {
        window.hide()
      }
    })

    window.on('blur', () => {
      if (!isPinned && window && !window.isDestroyed() && window.isVisible()) {
        window.hide()
      }
    })

    window.on('closed', () => {
      if (currentWindow === window) {
        currentWindow = undefined
      }
    })

    await load(window, withHashRoute(baseUrl(resolve(getElectronMainDirname(), '..', 'renderer')), '/tray'))

    return window
  })

  const show = async (bounds?: Rectangle) => {
    const window = await reusable.getWindow()
    if (bounds) {
      const pos = calculatePopoverPosition(bounds, { width: 390, height: 580 })
      window.setPosition(pos.x, pos.y, false)
    }
    window.show()
    window.focus()
  }

  const hide = () => {
    const window = reusable.getExistingWindow()
    if (window && !window.isDestroyed() && window.isVisible()) {
      window.hide()
    }
  }

  const toggle = async (bounds?: Rectangle) => {
    const existing = reusable.getExistingWindow()
    if (existing && !existing.isDestroyed() && existing.isVisible()) {
      existing.hide()
      return
    }
    await show(bounds)
  }

  return {
    getWindow: reusable.getWindow,
    hasWindow: reusable.hasWindow,
    getExistingWindow: reusable.getExistingWindow,
    isVisible: reusable.isVisible,
    toggle,
    show,
    hide,
    isPinned: () => isPinned,
  }
}
