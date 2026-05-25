import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineInvokeHandler } from '@moeru/eventa'
import { createContext } from '@moeru/eventa/adapters/electron/main'
import { BrowserWindow, ipcMain } from 'electron'
import clickDragPlugin from 'electron-click-drag-plugin'
import { throttle } from 'es-toolkit'
import { isLinux } from 'std-env'
import icon from '../../../../resources/icon.png?asset'
import { electronControlStripSyncState, electronStartDraggingWindow } from '../../../shared/eventa'
import type { globalAppConfigSchema } from '../../configs/global'
import { baseUrl, load, withHashRoute } from '../../libs/electron/location'
import type { Config } from '../../libs/electron/persistence'
import type { I18n } from '../../libs/i18n'
import type { ServerChannel } from '../../services/airi/channel-server'
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
  const getConfig = () =>
    params.appConfig.get() ?? { language: 'en', microphoneToggleHotkey: 'Scroll' as const, windows: [] }
  const actorConfig = getConfig().windows?.find((w: any) => w.title === 'AIRI' && w.tag === 'actor')

  let initialWidth = actorConfig?.width ?? 450.0
  let initialHeight = actorConfig?.height ?? 600.0
  let initialX = actorConfig?.x
  let initialY = actorConfig?.y

  if (initialX !== undefined && initialY !== undefined) {
    const valid = ensureWindowInVisibleBounds({
      height: Math.round(initialHeight),
      width: Math.round(initialWidth),
      x: Math.round(initialX),
      y: Math.round(initialY),
    })
    initialX = valid.x
    initialY = valid.y
    initialWidth = valid.width
    initialHeight = valid.height
  }

  const window = new BrowserWindow({
    alwaysOnTop: true,
    height: initialHeight,
    icon,
    show: false,
    title: 'AIRI - Actor Stage',
    type: 'panel',
    webPreferences: {
      preload: resolve(dirname(fileURLToPath(import.meta.url)), '../preload/index.cjs'),
      sandbox: true,
    },
    width: initialWidth,
    x: initialX,
    y: initialY,
    ...transparentWindowConfig(),
  })

  window.setMovable(true)
  window.setResizable(true)

  const { context } = createContext(ipcMain, window)
  await setupBaseWindowElectronInvokes({ context, i18n: params.i18n, serverChannel: params.serverChannel, window })

  if (!isLinux) {
    defineInvokeHandler(context, electronStartDraggingWindow, (_payload, handlerOptions: any) => {
      try {
        const sender = handlerOptions?.raw?.ipcMainEvent?.sender
        const win = sender ? (BrowserWindow.fromWebContents(sender) ?? window) : window
        const windowId = win.getNativeWindowHandle()
        clickDragPlugin.startDrag(windowId)
      } catch (error) {
        console.error(error)
      }
    })
  }

  defineInvokeHandler(context, electronControlStripSyncState, (payload) => {
    if (payload) {
      const config = getConfig()
      if (config) {
        if (!config.windows) {
          config.windows = []
        }
        const existingConfigIndex = config.windows.findIndex(
          (w: { tag?: string; orientation?: string }) => w.tag === 'actor',
        )
        if (existingConfigIndex !== -1) {
          config.windows[existingConfigIndex].orientation = payload.orientation
          params.appConfig.update(config)
        } else {
          config.windows.push({
            orientation: payload.orientation,
            tag: 'actor',
            title: 'AIRI - Actor Stage',
          })
          params.appConfig.update(config)
        }
      }
    }
  })

  function restoreBounds() {
    const config = getConfig()
    const currentActorConfig = config.windows?.find((w: any) => w.title === 'AIRI' && w.tag === 'actor')
    const x = currentActorConfig?.x
    const y = currentActorConfig?.y
    const width = currentActorConfig?.width ?? 450.0
    const height = currentActorConfig?.height ?? 600.0
    if (x !== undefined && y !== undefined) {
      const valid = ensureWindowInVisibleBounds({
        height: Math.round(height),
        width: Math.round(width),
        x: Math.round(x),
        y: Math.round(y),
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

  function handleNewBounds(newBounds: { x: number; y: number; width: number; height: number }) {
    if (window.isDestroyed()) return

    const config = getConfig()
    if (!config.windows || !Array.isArray(config.windows)) {
      config.windows = []
    }

    const existingConfigIndex = config.windows.findIndex((w: any) => w.title === 'AIRI' && w.tag === 'actor')

    if (existingConfigIndex === -1) {
      config.windows.push({
        height: Math.round(newBounds.height),
        tag: 'actor',
        title: 'AIRI',
        width: Math.round(newBounds.width),
        x: Math.round(newBounds.x),
        y: Math.round(newBounds.y),
      })
    } else {
      const currentConfig = config.windows[existingConfigIndex]
      config.windows[existingConfigIndex] = {
        ...currentConfig,
        height: Math.round(newBounds.height),
        width: Math.round(newBounds.width),
        x: Math.round(newBounds.x),
        y: Math.round(newBounds.y),
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

  await load(
    window,
    withHashRoute(baseUrl(resolve(dirname(fileURLToPath(import.meta.url)), '..', 'renderer')), '/actor'),
  )

  return window
}
