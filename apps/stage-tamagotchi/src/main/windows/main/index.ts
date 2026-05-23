import type { Rectangle } from 'electron'
import type { InferOutput } from 'valibot'

import type { globalAppConfigSchema } from '../../configs/global'
import type { Config } from '../../libs/electron/persistence'
import type { I18n } from '../../libs/i18n'
import type { ServerChannel } from '../../services/airi/channel-server'
import type { McpStdioManager } from '../../services/airi/mcp-servers'
import type { AutoUpdater } from '../../services/electron/auto-updater'
import type { NoticeWindowManager } from '../notice'
import type { OnboardingWindowManager } from '../onboarding'
import type { SettingsWindowManager } from '../settings'
import type { WidgetsWindowManager } from '../widgets'

import { dirname, resolve } from 'node:path'
import { env } from 'node:process'
import { fileURLToPath } from 'node:url'

import { is } from '@electron-toolkit/utils'
import { defu } from 'defu'
import { BrowserWindow, ipcMain, screen, shell } from 'electron'
import { debounce, throttle } from 'es-toolkit'

import icon from '../../../../resources/icon.png?asset'

import { baseUrl, load } from '../../libs/electron/location'
import { transparentWindowConfig } from '../shared'
import { ensureWindowInVisibleBounds } from '../shared/display'
import { setupMainWindowElectronInvokes } from './rpc/index.electron'

export async function setupMainWindow(params: {
  settingsWindow: SettingsWindowManager
  chatWindow: () => Promise<BrowserWindow>
  widgetsManager: WidgetsWindowManager
  noticeWindow: NoticeWindowManager
  autoUpdater: AutoUpdater
  onWindowCreated?: (window: BrowserWindow) => void
  serverChannel: ServerChannel
  mcpStdioManager: McpStdioManager
  i18n: I18n
  onboardingWindowManager: OnboardingWindowManager
  appConfig: Config<typeof globalAppConfigSchema>
}) {
  const getConfig = (): InferOutput<typeof globalAppConfigSchema> => params.appConfig.get() ?? { language: 'en', windows: [], microphoneToggleHotkey: 'Scroll' }
  const updateConfig = (newData: InferOutput<typeof globalAppConfigSchema>) => params.appConfig.update(newData)

  const mainWindowConfig = getConfig().windows?.find((w: any) => w.title === 'AIRI' && w.tag === 'main')
  const orientation = mainWindowConfig?.orientation || 'vertical'
  let width = mainWindowConfig?.width ?? mainWindowConfig?.snapshot?.width ?? (orientation === 'vertical' ? 56.0 : 300.0)
  let height = mainWindowConfig?.height ?? mainWindowConfig?.snapshot?.height ?? (orientation === 'vertical' ? 300.0 : 56.0)
  let x = mainWindowConfig?.x ?? mainWindowConfig?.snapshot?.x
  let y = mainWindowConfig?.y ?? mainWindowConfig?.snapshot?.y
  if (x !== undefined && y !== undefined) {
    const valid = ensureWindowInVisibleBounds({
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(width),
      height: Math.round(height),
    })
    x = valid.x
    y = valid.y
    width = valid.width
    height = valid.height
  }

  const window = new BrowserWindow({
    title: 'AIRI',
    width,
    height,
    x,
    y,
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

  // Elevate Control Strip window layering above the Stage window
  window.setAlwaysOnTop(true, 'screen-saver', 2)

  // Attach config for RPC sync
  ;(window as any).__airi_config = mainWindowConfig
  ;(window as any).__is_main_window = true

  window.setMovable(!mainWindowConfig?.locked)
  window.setResizable(!mainWindowConfig?.locked)

  if (params.onWindowCreated) {
    params.onWindowCreated(window)
  }

  ipcMain.on('main-window-config-updated', (_event, config) => {
    window.webContents.send('eventa:event:electron:windows:main:config-changed', config)
  })

  if (is.dev || env.MAIN_APP_DEBUG || env.APP_DEBUG) {
    try {
      window.webContents.openDevTools({ mode: 'detach' })
    }
    catch {}
  }

  function restoreBounds() {
    const mainWindow = getConfig().windows?.find((w: any) => w.title === 'AIRI' && w.tag === 'main')
    const x = mainWindow?.x ?? mainWindow?.snapshot?.x
    const y = mainWindow?.y ?? mainWindow?.snapshot?.y
    const orientation = mainWindow?.orientation || 'vertical'
    const width = mainWindow?.width ?? (orientation === 'vertical' ? 56.0 : 300.0)
    const height = mainWindow?.height ?? (orientation === 'vertical' ? 300.0 : 56.0)
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
    window.show()
    // NOTICE: on some platforms/transparency settings, first bounds application might be ignored
    setTimeout(() => restoreBounds(), 500)
  })

  window.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  load(window, baseUrl(resolve(dirname(fileURLToPath(import.meta.url)), '..', 'renderer')))

  await setupMainWindowElectronInvokes({
    window,
    settingsWindow: params.settingsWindow,
    chatWindow: params.chatWindow,
    widgetsManager: params.widgetsManager,
    noticeWindow: params.noticeWindow,
    autoUpdater: params.autoUpdater,
    serverChannel: params.serverChannel,
    mcpStdioManager: params.mcpStdioManager,
    i18n: params.i18n,
    onboardingWindowManager: params.onboardingWindowManager,
    appConfig: params.appConfig,
  })

  function handleNewBounds(newBounds: Rectangle) {
    if (window.isDestroyed())
      return

    const config = getConfig()
    if (!config.windows || !Array.isArray(config.windows)) {
      config.windows = []
    }

    const existingConfigIndex = config.windows.findIndex((w: any) => w.title === 'AIRI' && w.tag === 'main')
    const existingConfig = existingConfigIndex !== -1 ? config.windows[existingConfigIndex] : null

    if (existingConfig?.locked) {
      return
    }

    const state = (window as any).__control_strip_state
    if (!state) {
      // Skip saving bounds if the renderer hasn't synced the control strip state yet.
      // This prevents startup and shutdown bounds-changed events from overwriting
      // the correct collapsed size/orientation with default fallback values (like stripLength = 300).
      return
    }

    let savedX = newBounds.x
    let savedY = newBounds.y
    const orientation = state.orientation || existingConfig?.orientation || 'vertical'
    const stripLength = state?.stripLength || 300
    const activePopover = state?.activePopover || null
    const placement = state?.lastPlacement || 'bottom'

    const savedW = orientation === 'vertical' ? 56 : stripLength
    const savedH = orientation === 'vertical' ? stripLength : 56

    if (activePopover) {
      if (orientation === 'vertical') {
        savedX = newBounds.x + (placement === 'left' ? 268 : 0)
        savedY = newBounds.y + (newBounds.height - stripLength) / 2
      }
      else {
        savedX = newBounds.x + (newBounds.width - stripLength) / 2
        savedY = newBounds.y + (placement === 'top' ? 280 : 0)
      }
    }

    if (existingConfigIndex === -1) {
      const newWin = {
        title: 'AIRI',
        tag: 'main',
        x: Math.round(savedX),
        y: Math.round(savedY),
        width: Math.round(savedW),
        height: Math.round(savedH),
        orientation,
      }
      config.windows.push(newWin)
      ;(window as any).__airi_config = newWin
    }
    else {
      const currentConfig = config.windows[existingConfigIndex]
      const updatedWin = defu({
        x: Math.round(savedX),
        y: Math.round(savedY),
        width: Math.round(savedW),
        height: Math.round(savedH),
        orientation,
      }, currentConfig)
      config.windows[existingConfigIndex] = updatedWin
      ;(window as any).__airi_config = updatedWin
    }

    updateConfig(config)
    window.webContents.send('eventa:event:electron:windows:main:config-changed', (window as any).__airi_config)
  }

  const throttledHandleNewBounds = throttle(handleNewBounds, 200)

  const debouncedSnap = debounce(() => {
    if (window.isDestroyed())
      return

    const bounds = window.getBounds()
    const display = screen.getDisplayMatching(bounds)
    const workArea = display.workArea
    const displayBounds = display.bounds

    const isVertical = bounds.height > bounds.width
    const isHorizontal = bounds.width > bounds.height

    const SNAP_THRESHOLD = 25
    let newX = bounds.x
    let newY = bounds.y
    let snapped = false

    const snapTargetsX = [
      workArea.x,
      workArea.x + workArea.width,
      displayBounds.x,
      displayBounds.x + displayBounds.width,
    ]
    const snapTargetsY = [
      workArea.y,
      displayBounds.y,
    ]

    if (isVertical) {
      // Check left edge snap
      let minDiffLeft = Infinity
      let targetLeft = bounds.x
      for (const tx of snapTargetsX) {
        const diff = Math.abs(bounds.x - tx)
        if (diff < minDiffLeft) {
          minDiffLeft = diff
          targetLeft = tx
        }
      }

      // Check right edge snap
      let minDiffRight = Infinity
      let targetRight = bounds.x
      for (const tx of snapTargetsX) {
        const diff = Math.abs((bounds.x + bounds.width) - tx)
        if (diff < minDiffRight) {
          minDiffRight = diff
          targetRight = tx - bounds.width
        }
      }

      if (minDiffLeft <= SNAP_THRESHOLD && minDiffLeft <= minDiffRight) {
        newX = targetLeft
        snapped = true
      }
      else if (minDiffRight <= SNAP_THRESHOLD) {
        newX = targetRight
        snapped = true
      }
    }
    else if (isHorizontal) {
      // Check top edge snap only
      let minDiffTop = Infinity
      let targetTop = bounds.y
      for (const ty of snapTargetsY) {
        const diff = Math.abs(bounds.y - ty)
        if (diff < minDiffTop) {
          minDiffTop = diff
          targetTop = ty
        }
      }

      if (minDiffTop <= SNAP_THRESHOLD) {
        newY = targetTop
        snapped = true
      }
    }

    if (snapped && (Math.round(newX) !== bounds.x || Math.round(newY) !== bounds.y)) {
      window.setBounds({
        x: Math.round(newX),
        y: Math.round(newY),
        width: bounds.width,
        height: bounds.height,
      })
    }
  }, 150)

  window.on('resize', () => {
    if (!window.isDestroyed()) {
      throttledHandleNewBounds(window.getBounds())
    }
  })
  window.on('move', () => {
    if (!window.isDestroyed()) {
      throttledHandleNewBounds(window.getBounds())
      debouncedSnap()
    }
  })

  return window
}
