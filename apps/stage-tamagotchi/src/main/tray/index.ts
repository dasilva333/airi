import type { LocaleDetector } from '@intlify/core'
import type { BrowserWindow } from 'electron'

import type { I18n } from '../libs/i18n'
import type { ServerChannel } from '../services/airi/channel-server'
import type { setupBeatSync } from '../windows/beat-sync'
import type { setupCaptionWindowManager } from '../windows/caption'
import type { SettingsWindowManager } from '../windows/settings'
import type { WidgetsWindowManager } from '../windows/widgets'

import { env } from 'node:process'

import { is } from '@electron-toolkit/utils'
import { effect } from 'alien-signals'
import { app, Menu, nativeImage, screen, Tray } from 'electron'
import { debounce, once } from 'es-toolkit'
import { isMacOS } from 'std-env'

import icon from '../../../resources/icon.png?asset'
import macOSTrayIcon from '../../../resources/tray-icon-macos.png?asset'

import { onAppBeforeQuit } from '../libs/bootkit/lifecycle'
import { setupInlayWindow } from '../windows/inlay'
import { toggleWindowShow } from '../windows/shared/window'

function alignWindow(window: BrowserWindow, position: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right', display?: Electron.Display): void {
  const { width: windowWidth, height: windowHeight } = window.getBounds()
  const targetDisplay = display || screen.getDisplayMatching(window.getBounds())
  const { x: areaX, y: areaY, width: areaWidth, height: areaHeight } = targetDisplay.workArea

  switch (position) {
    case 'center':
      window.center()
      break
    case 'top-left':
      window.setPosition(areaX, areaY)
      break
    case 'top-right':
      window.setPosition(areaX + areaWidth - windowWidth, areaY)
      break
    case 'bottom-left':
      window.setPosition(areaX, areaY + areaHeight - windowHeight)
      break
    case 'bottom-right':
      window.setPosition(areaX + areaWidth - windowWidth, areaY + areaHeight - windowHeight)
      break
  }
  window.show()
}

function isPositionMatch(window: BrowserWindow, targetX: number, targetY: number): boolean {
  const { x, y } = window.getBounds()
  return Math.abs(x - targetX) <= 5 && Math.abs(y - targetY) <= 5
}

export function setupTray(params: {
  mainWindow: BrowserWindow
  settingsWindow: SettingsWindowManager
  captionWindow: ReturnType<typeof setupCaptionWindowManager>
  widgetsWindow: WidgetsWindowManager
  beatSyncBgWindow: Awaited<ReturnType<typeof setupBeatSync>>
  aboutWindow: () => Promise<BrowserWindow>
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

      const { width: windowWidth, height: windowHeight } = params.mainWindow.getBounds()
      const currentDisplay = screen.getDisplayMatching(params.mainWindow.getBounds())
      const { x: curX, y: curY, width: curW, height: curH } = currentDisplay.workArea

      const t = params.i18n.t
      const config = params.getConfig() ?? { windows: [] }
      const mainWindowConfig = config.windows?.find((w: any) => w.title === 'AIRI' && w.tag === 'main')

      const contextMenu = Menu.buildFromTemplate([
        { label: params.i18n.t('tamagotchi.electron.tray.menu.labels.label.show'), click: () => toggleWindowShow(params.mainWindow) },
        { type: 'separator' },
        {
          label: params.i18n.t('tamagotchi.electron.tray.menu.labels.label.align_to'),
          submenu: [
            {
              label: params.i18n.t('tamagotchi.electron.tray.menu.labels.label.center'),
              type: 'checkbox',
              checked: isPositionMatch(params.mainWindow, curX + Math.floor((curW - windowWidth) / 2), curY + Math.floor((curH - windowHeight) / 2)),
              click: () => alignWindow(params.mainWindow, 'center'),
            },
            { type: 'separator' },
            {
              label: params.i18n.t('tamagotchi.electron.tray.menu.labels.label.top_left'),
              type: 'checkbox',
              checked: isPositionMatch(params.mainWindow, curX, curY),
              click: () => alignWindow(params.mainWindow, 'top-left'),
            },
            {
              label: params.i18n.t('tamagotchi.electron.tray.menu.labels.label.top_right'),
              type: 'checkbox',
              checked: isPositionMatch(params.mainWindow, curX + curW - windowWidth, curY),
              click: () => alignWindow(params.mainWindow, 'top-right'),
            },
            {
              label: params.i18n.t('tamagotchi.electron.tray.menu.labels.label.bottom_left'),
              type: 'checkbox',
              checked: isPositionMatch(params.mainWindow, curX, curY + curH - windowHeight),
              click: () => alignWindow(params.mainWindow, 'bottom-left'),
            },
            {
              label: params.i18n.t('tamagotchi.electron.tray.menu.labels.label.bottom_right'),
              type: 'checkbox',
              checked: isPositionMatch(params.mainWindow, curX + curW - windowWidth, curY + curH - windowHeight),
              click: () => alignWindow(params.mainWindow, 'bottom-right'),
            },
          ],
        },
        {
          label: t('tamagotchi.electron.tray.menu.labels.label.position'),
          submenu: [
            {
              label: t('tamagotchi.electron.tray.menu.labels.label.lock'),
              type: 'checkbox',
              checked: !!mainWindowConfig?.locked,
              click: (item) => {
                const config = params.getConfig() ?? { windows: [] }
                if (!config.windows)
                  config.windows = []
                let index = config.windows.findIndex((w: any) => w.title === 'AIRI' && w.tag === 'main')
                if (index === -1) {
                  index = config.windows.push({ title: 'AIRI', tag: 'main' }) - 1
                }
                config.windows[index].locked = item.checked
                params.updateConfig(config)
                params.mainWindow.setMovable(!item.checked)
                params.mainWindow.setResizable(!item.checked)
                params.mainWindow.webContents.send('eventa:event:electron:windows:main:config-changed', config.windows[index])
                rebuildContextMenu()
              },
            },
            {
              // Snapshot the current window position as 'Home'
              // Allows users to snap back to their favorite position after moving the window consciously (e.g. for a temporary task) without manual repositioning.
              label: t('tamagotchi.electron.tray.menu.labels.label.snapshot'),
              click: () => {
                // Save the current window bounds as the "Home" position for future restoration.
                const config = params.getConfig() ?? { windows: [] }
                if (!config.windows)
                  config.windows = []
                let index = config.windows.findIndex((w: any) => w.title === 'AIRI' && w.tag === 'main')
                if (index === -1) {
                  index = config.windows.push({ title: 'AIRI', tag: 'main' }) - 1
                }
                const bounds = params.mainWindow.getBounds()
                config.windows[index].snapshot = {
                  x: bounds.x,
                  y: bounds.y,
                  width: bounds.width,
                  height: bounds.height,
                }
                params.updateConfig(config)
                params.mainWindow.webContents.send('eventa:event:electron:windows:main:config-changed', config.windows[index])
                rebuildContextMenu()
              },
            },
            {
              // Restore the window to the previously saved 'Home' position.
              label: t('tamagotchi.electron.tray.menu.labels.label.restore'),
              enabled: !!mainWindowConfig?.snapshot,
              click: () => {
                // Return the window to its previously saved "Home" position.
                const config = params.getConfig() ?? { windows: [] }
                const mainWindow = config.windows?.find((w: any) => w.title === 'AIRI' && w.tag === 'main')
                if (mainWindow?.snapshot) {
                  params.mainWindow.setBounds(mainWindow.snapshot)
                }
              },
            },
          ],
        },
        { type: 'separator' },
        { label: params.i18n.t('tamagotchi.electron.tray.menu.labels.label.settings'), click: () => void params.settingsWindow.openWindow('/settings') },
        { label: params.i18n.t('tamagotchi.electron.tray.menu.labels.label.about'), click: () => params.aboutWindow().then(window => toggleWindowShow(window)) },
        { type: 'separator' },
        { label: params.i18n.t('tamagotchi.electron.tray.menu.labels.label.open_inlay'), click: () => setupInlayWindow({ i18n: params.i18n, serverChannel: params.serverChannel }) },
        { label: params.i18n.t('tamagotchi.electron.tray.menu.labels.label.open_widgets'), click: () => params.widgetsWindow.getWindow().then(window => toggleWindowShow(window)) },
        {
          label: params.i18n.t(params.captionWindow.isVisible()
            ? 'tamagotchi.electron.tray.menu.labels.label.close_caption'
            : 'tamagotchi.electron.tray.menu.labels.label.open_caption'),
          click: async () => {
            await params.captionWindow.toggleVisibility()
            const config = params.getConfig() ?? { windows: [] }
            if (!config.windows)
              config.windows = []
            let index = config.windows.findIndex((w: any) => w.tag === 'caption')
            if (index === -1) {
              index = config.windows.push({ title: 'Caption', tag: 'caption' }) - 1
            }
            config.windows[index].enabled = params.captionWindow.isVisible()
            params.updateConfig(config)
            rebuildContextMenu()
          },
        },
        {
          type: 'submenu',
          label: params.i18n.t('tamagotchi.electron.tray.menu.labels.label.caption_overlay'),
          submenu: Menu.buildFromTemplate([
            { type: 'checkbox', label: params.i18n.t('tamagotchi.electron.tray.menu.labels.label.follow_window'), checked: params.captionWindow.getIsFollowingWindow(), click: async menuItem => await params.captionWindow.setFollowWindow(Boolean(menuItem.checked)) },
            { label: params.i18n.t('tamagotchi.electron.tray.menu.labels.label.reset_position'), click: async () => await params.captionWindow.resetToSide() },
            { type: 'separator' },
            {
              type: 'checkbox',
              label: params.i18n.t('tamagotchi.electron.tray.menu.labels.label.dock_bottom'),
              checked: config.windows?.find((w: any) => w.tag === 'caption')?.dock === 'bottom',
              click: (item) => {
                const config = params.getConfig() ?? { windows: [] }
                let index = config.windows.findIndex((w: any) => w.tag === 'caption')
                if (index === -1)
                  index = config.windows.push({ title: 'Caption', tag: 'caption' }) - 1
                config.windows[index].dock = item.checked ? 'bottom' : undefined
                console.log('[@proj-airi/stage-tamagotchi] [Tray] Dock Bottom Clicked:', item.checked, 'Index:', index)
                params.updateConfig(config)
                params.captionWindow.triggerMove()
                rebuildContextMenu()
              },
            },
            {
              type: 'checkbox',
              label: params.i18n.t('tamagotchi.electron.tray.menu.labels.label.dock_top'),
              checked: config.windows?.find((w: any) => w.tag === 'caption')?.dock === 'top',
              click: (item) => {
                const config = params.getConfig() ?? { windows: [] }
                let index = config.windows.findIndex((w: any) => w.tag === 'caption')
                if (index === -1)
                  index = config.windows.push({ title: 'Caption', tag: 'caption' }) - 1
                config.windows[index].dock = item.checked ? 'top' : undefined
                console.log('[@proj-airi/stage-tamagotchi] [Tray] Dock Top Clicked:', item.checked, 'Index:', index)
                params.updateConfig(config)
                params.captionWindow.triggerMove()
                rebuildContextMenu()
              },
            },
          ]),
        },
        { type: 'separator' },
        ...is.dev || env.MAIN_APP_DEBUG || env.APP_DEBUG
          ? [
              { type: 'header', label: params.i18n.t('tamagotchi.electron.tray.menu.labels.label.devtools') },
              { label: params.i18n.t('tamagotchi.electron.tray.menu.labels.label.troubleshoot_beatsync'), click: () => params.beatSyncBgWindow.webContents.openDevTools() },
              { type: 'separator' },
            ] as const
          : [],
        { label: params.i18n.t('tamagotchi.electron.tray.menu.labels.label.quit'), click: () => app.quit() },
      ])

      appTray.setContextMenu(contextMenu)
    }, 50)

    params.mainWindow.on('resize', rebuildContextMenu)
    params.mainWindow.on('move', rebuildContextMenu)
    params.captionWindow.onVisibilityChanged(rebuildContextMenu)

    rebuildContextMenu()

    effect(() => {
      const locale = params.i18n.locale as (() => string | LocaleDetector<any[]> | undefined)
      locale()
      rebuildContextMenu()
    })

    appTray.setToolTip('Project AIRI')
    appTray.addListener('click', () => toggleWindowShow(params.mainWindow))

    // On macOS, there's a special double-click event
    if (isMacOS) {
      appTray.addListener('double-click', () => toggleWindowShow(params.mainWindow))
    }
  })()
}
