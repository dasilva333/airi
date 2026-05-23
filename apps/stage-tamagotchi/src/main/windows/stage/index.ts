import type { globalAppConfigSchema } from '../../configs/global'
import type { Config } from '../../libs/electron/persistence'
import type { I18n } from '../../libs/i18n'
import type { ServerChannel } from '../../services/airi/channel-server'

import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import clickDragPlugin from 'electron-click-drag-plugin'

import { defineInvokeHandler } from '@moeru/eventa'
import { createContext } from '@moeru/eventa/adapters/electron/main'
import { BrowserWindow, ipcMain } from 'electron'
import { throttle } from 'es-toolkit'
import { isLinux } from 'std-env'

import icon from '../../../../resources/icon.png?asset'

import { electronStartDraggingWindow } from '../../../shared/eventa'
import { baseUrl, load, withHashRoute } from '../../libs/electron/location'
import { ensureWindowInVisibleBounds } from '../shared/display'
import { setupBaseWindowElectronInvokes, transparentWindowConfig } from '../shared/window'

let isStageVisible = true

export function setStageVisibleState(visible: boolean) {
  isStageVisible = visible
}

export async function setupActorStageWindow(params: {
  appConfig: Config<typeof globalAppConfigSchema>
  serverChannel: ServerChannel
  i18n: I18n
}) {
  const getConfig = () => params.appConfig.get() ?? { language: 'en', windows: [], microphoneToggleHotkey: 'Scroll' as const }
  const actorConfig = getConfig().windows?.find((w: any) => w.title === 'AIRI' && w.tag === 'actor')

  let initialWidth = actorConfig?.width ?? 450.0
  let initialHeight = actorConfig?.height ?? 600.0
  let initialX = actorConfig?.x
  let initialY = actorConfig?.y

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
    title: 'AIRI - Actor Stage',
    width: initialWidth,
    height: initialHeight,
    x: initialX,
    y: initialY,
    show: false,
    icon,
    webPreferences: {
      preload: resolve(dirname(fileURLToPath(import.meta.url)), '../preload/index.cjs'),
      sandbox: true,
    },
    type: 'panel',
    alwaysOnTop: true,
    ...transparentWindowConfig(),
  })

  window.setMovable(true)
  window.setResizable(true)

  const { context } = createContext(ipcMain, window)
  await setupBaseWindowElectronInvokes({ context, window, serverChannel: params.serverChannel, i18n: params.i18n })

  if (!isLinux) {
    defineInvokeHandler(context, electronStartDraggingWindow, (_payload, handlerOptions: any) => {
      try {
        const sender = handlerOptions?.raw?.ipcMainEvent?.sender
        const win = sender ? (BrowserWindow.fromWebContents(sender) ?? window) : window
        const windowId = win.getNativeWindowHandle()
        clickDragPlugin.startDrag(windowId)
      }
      catch (error) {
        console.error(error)
      }
    })
  }

  function restoreBounds() {
    const config = getConfig()
    const currentActorConfig = config.windows?.find((w: any) => w.title === 'AIRI' && w.tag === 'actor')
    const x = currentActorConfig?.x
    const y = currentActorConfig?.y
    const width = currentActorConfig?.width ?? 450.0
    const height = currentActorConfig?.height ?? 600.0
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
    if (isStageVisible) {
      window.show()
    }
    setTimeout(() => restoreBounds(), 500)
  })

  function handleNewBounds(newBounds: { x: number, y: number, width: number, height: number }) {
    if (window.isDestroyed())
      return

    const config = getConfig()
    if (!config.windows || !Array.isArray(config.windows)) {
      config.windows = []
    }

    const existingConfigIndex = config.windows.findIndex((w: any) => w.title === 'AIRI' && w.tag === 'actor')

    if (existingConfigIndex === -1) {
      config.windows.push({
        title: 'AIRI',
        tag: 'actor',
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

  await load(window, withHashRoute(baseUrl(resolve(dirname(fileURLToPath(import.meta.url)), '..', 'renderer')), '/actor'))

  return window
}
