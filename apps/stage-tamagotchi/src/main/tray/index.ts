import type { LocaleDetector } from '@intlify/core'
import type { BrowserWindow } from 'electron'

import type { I18n } from '../libs/i18n'
import type { ServerChannel } from '../services/airi/channel-server'
import type { setupBeatSync } from '../windows/beat-sync'
import type { setupCaptionWindowManager } from '../windows/caption'
import type { CustomizerWindowManager } from '../windows/customizer'
import type { OnboardingWindowManager } from '../windows/onboarding'
import type { SettingsWindowManager } from '../windows/settings'
import type { WidgetsWindowManager } from '../windows/widgets'

import { effect } from 'alien-signals'
import { app, ipcMain, Menu, nativeImage, Tray } from 'electron'
import { debounce, once } from 'es-toolkit'
import { isMacOS } from 'std-env'

import icon from '../../../resources/icon.png?asset'
import macOSTrayIcon from '../../../resources/tray-icon-macos.png?asset'

import { onAppBeforeQuit } from '../libs/bootkit/lifecycle'
import { toggleWindowShow } from '../windows/shared/window'

export function setupTray(params: {
  mainWindow: BrowserWindow
  settingsWindow: SettingsWindowManager
  onboardingWindow: OnboardingWindowManager
  captionWindow: ReturnType<typeof setupCaptionWindowManager>
  widgetsWindow: WidgetsWindowManager
  beatSyncBgWindow: Awaited<ReturnType<typeof setupBeatSync>>
  aboutWindow: () => Promise<BrowserWindow>
  chatWindow?: () => Promise<BrowserWindow>
  stageWindow: BrowserWindow
  customizerWindow: CustomizerWindowManager
  serverChannel: ServerChannel
  i18n: I18n
  getConfig: () => any
  updateConfig: (config: any) => void
}): void {
  once(() => {
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
            const chatWin = await params.chatWindow?.()
            if (chatWin) {
              toggleWindowShow(chatWin)
            }
          },
        },
        {
          label: 'Toggle Character Stage',
          click: () => {
            if (params.stageWindow && !params.stageWindow.isDestroyed()) {
              toggleWindowShow(params.stageWindow)
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
        { label: 'Customizer...', click: () => void params.customizerWindow.toggleVisibility() },
        { label: 'Show Setup Wizard', click: () => void params.onboardingWindow.openWindow('/onboarding') },
        { label: 'Show Setup Wizard (V2 Preview)', click: () => void params.onboardingWindow.openWindow('/onboarding?v=2') },
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

      appTray.setContextMenu(contextMenu)
    }, 50)

    rebuildContextMenu()

    effect(() => {
      const locale = params.i18n.locale as (() => string | LocaleDetector<any[]> | undefined)
      locale()
      rebuildContextMenu()
    })

    appTray.setToolTip('Project AIRI')
    if (!isMacOS) {
      appTray.addListener('click', () => {
        params.mainWindow.show()
        params.mainWindow.focus()
      })
    }

    // On macOS, there's a special double-click event
    if (isMacOS) {
      appTray.addListener('double-click', () => {
        params.mainWindow.show()
        params.mainWindow.focus()
      })
    }
  })()
}
