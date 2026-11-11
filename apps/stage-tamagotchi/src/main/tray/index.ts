import type { BrowserWindow } from 'electron'

import type { globalAppConfigSchema } from '../configs/global'
import type { Config } from '../libs/electron/persistence'
import type { I18n } from '../libs/i18n'
import type { ServerChannel } from '../services/airi/channel-server'
import type { BeatSyncWindowManager } from '../windows/beat-sync'
import type { setupCaptionWindowManager } from '../windows/caption'
import type { ChatWindowManager } from '../windows/chat'
import type { CustomizerWindowManager } from '../windows/customizer'
import type { OnboardingWindowManager } from '../windows/onboarding'
import type { SettingsWindowManager } from '../windows/settings'
import type { ActorStageWindowManager } from '../windows/stage'
import type { TrayWindowManager } from '../windows/tray'
import type { WidgetsWindowManager } from '../windows/widgets'

import { defineInvokeHandler } from '@moeru/eventa'
import { createContext } from '@moeru/eventa/adapters/electron/main'
import { effect } from 'alien-signals'
import { app, ipcMain, Menu, nativeImage, Tray } from 'electron'
import { debounce, once } from 'es-toolkit'
import { isMacOS } from 'std-env'

import icon from '../../../resources/icon.png?asset'
import macOSTrayIcon from '../../../resources/tray-icon-macos.png?asset'

import { electronAppIconGet, electronAppIconSet } from '../../shared/eventa'
import { onAppBeforeQuit } from '../libs/bootkit/lifecycle'
import { AppIconVisibility } from '../windows/shared/app-icon'
import { toggleWindowShow } from '../windows/shared/window'

export interface SetupTrayParams {
  mainWindow: BrowserWindow
  settingsWindow: SettingsWindowManager
  onboardingWindow: OnboardingWindowManager
  captionWindow: ReturnType<typeof setupCaptionWindowManager>
  widgetsWindow: WidgetsWindowManager
  beatSyncBgWindow: BeatSyncWindowManager
  aboutWindow: () => Promise<BrowserWindow>
  chatWindow?: ChatWindowManager
  stageWindow?: ActorStageWindowManager | BrowserWindow | null
  customizerWindow: CustomizerWindowManager
  trayWindow?: TrayWindowManager
  serverChannel: ServerChannel
  i18n: I18n
  appConfig: Config<typeof globalAppConfigSchema>
  getConfig: () => any
  updateConfig: (config: any) => void
}

const setupTrayOnce = once((params: SetupTrayParams) => {
  const trayImage = nativeImage.createFromPath(isMacOS ? macOSTrayIcon : icon).resize({ width: 16 })
  trayImage.setTemplateImage(isMacOS)

  const appTray = new Tray(trayImage)
  onAppBeforeQuit(() => {
    rebuildContextMenu.cancel()
    appTray.destroy()
  })

  const rebuildContextMenu = debounce((): void => {
    if (!appTray || appTray.isDestroyed() || !params.mainWindow || params.mainWindow.isDestroyed())
      return

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Toggle Chat',
        click: async () => {
          await params.chatWindow?.openChat()
        },
      },
      {
        label: 'Toggle Character Stage',
        // NOTICE: The stage is lazily managed (text-only companions have no
        // window). Resolve the live window; spawn on demand when absent.
        enabled: Boolean(params.stageWindow),
        click: () => {
          const stageWindow = params.stageWindow
          if (!stageWindow)
            return
          if (typeof (stageWindow as ActorStageWindowManager).getExistingWindow === 'function') {
            const manager = stageWindow as ActorStageWindowManager
            const existing = manager.getExistingWindow()
            if (existing && !existing.isDestroyed()) {
              toggleWindowShow(existing)
            }
            else {
              void manager.ensureWindow().then(window => window?.show())
            }
            return
          }
          const window = stageWindow as BrowserWindow
          if (!window.isDestroyed()) {
            toggleWindowShow(window)
          }
        },
      },
      {
        label: 'Reset Window Positions',
        click: () => {
          ipcMain.emit('reset-window-positions-action')
        },
      },
      { type: 'separator' },
      { label: 'Control Strip Settings', click: () => void params.customizerWindow.toggleVisibility() },
      { label: 'Companion Wizard', click: () => void params.onboardingWindow.openWindow('/onboarding-v3') },
      { label: 'AnimaDex Wizard', click: () => void params.settingsWindow.openWindow('/settings/airi-card/guided').catch(err => console.error('[Tray] Failed to open AnimaDex wizard:', err)) },
      { label: params.i18n.t('tamagotchi.electron.tray.menu.labels.label.settings'), click: () => void params.settingsWindow.openWindow('/settings').catch(err => console.error('[Tray] Failed to open settings window:', err)) },
      { label: params.i18n.t('tamagotchi.electron.tray.menu.labels.label.about'), click: () => params.aboutWindow().then(window => toggleWindowShow(window)) },
      { type: 'separator' },
      {
        label: 'Toggle Developer Tools',
        click: () => {
          if (params.mainWindow && !params.mainWindow.isDestroyed()) {
            if (params.mainWindow.webContents.isDevToolsOpened()) {
              params.mainWindow.webContents.closeDevTools()
            }
            else {
              params.mainWindow.webContents.openDevTools({ mode: 'detach' })
            }
          }
        },
      },
      { type: 'separator' },
      { label: params.i18n.t('tamagotchi.electron.tray.menu.labels.label.quit'), click: () => app.quit() },
    ])

    cachedContextMenu = contextMenu
    // NOTICE: On macOS, attaching setContextMenu directly to appTray causes AppKit
    // to hijack single left-clicks. Keep context menu for right-click popup on macOS.
    if (!isMacOS) {
      appTray.setContextMenu(contextMenu)
    }
  }, 50)

  let cachedContextMenu: Menu | undefined
  rebuildContextMenu()

  effect(() => {
    const locale = params.i18n.locale as (() => string | undefined)
    locale()
    rebuildContextMenu()
  })

  const appIcon = new AppIconVisibility(params.appConfig)
  const { context } = createContext(ipcMain)
  defineInvokeHandler(context, electronAppIconGet, () => appIcon.hidden)
  defineInvokeHandler(context, electronAppIconSet, async (payload) => {
    await appIcon.setHidden(Boolean(payload))
    return appIcon.hidden
  })

  appTray.setToolTip('Project AIRI')

  // Left click toggles the rich Tray Popover window (AIRI Pocket)
  appTray.addListener('click', (_event, bounds) => {
    if (params.trayWindow) {
      void params.trayWindow.toggle(bounds)
    }
    else {
      params.mainWindow.show()
      params.mainWindow.focus()
    }
  })

  // Right click pops the OS-native context menu (Emergency safety fallback)
  appTray.addListener('right-click', () => {
    if (cachedContextMenu) {
      cachedContextMenu.popup()
    }
  })

  // On macOS, preserve double-click to focus the primary Control Strip window
  if (isMacOS) {
    appTray.addListener('double-click', () => {
      params.mainWindow.show()
      params.mainWindow.focus()
    })
  }
})

export function setupTray(params: SetupTrayParams): void {
  setupTrayOnce(params)
}
