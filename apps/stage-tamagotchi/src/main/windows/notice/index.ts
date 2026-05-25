import { join, resolve } from 'node:path'
import { defineInvokeHandler } from '@moeru/eventa'
import { safeClose } from '@proj-airi/electron-vueuse/main'
import type { BrowserWindow } from 'electron'
import { BrowserWindow as ElectronBrowserWindow, shell } from 'electron'
import icon from '../../../../resources/icon.png?asset'
import type { RequestWindowPayload } from '../../../shared/eventa'
import { noticeWindowEventa } from '../../../shared/eventa'
import { baseUrl, getElectronMainDirname, load, withHashRoute } from '../../libs/electron/location'
import type { I18n } from '../../libs/i18n'
import type { ServerChannel } from '../../services/airi/channel-server'
import { createReferencedWindowManager } from '../shared/referenced-window'

export interface NoticeWindowManager {
  open: (payload: RequestWindowPayload) => Promise<boolean>
}

export function setupNoticeWindowManager(params: { i18n: I18n; serverChannel: ServerChannel }): NoticeWindowManager {
  const rendererBase = baseUrl(resolve(getElectronMainDirname(), '..', 'renderer'))

  function createWindow(_id: string): BrowserWindow {
    const window = new ElectronBrowserWindow({
      height: 600,
      icon,
      show: false,
      title: 'Notice',
      webPreferences: {
        preload: join(getElectronMainDirname(), '../preload/index.cjs'),
        sandbox: true,
      },
      width: 1020,
    })

    window.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url)
      return { action: 'deny' }
    })

    return window
  }

  async function loadNoticeRoute(window: BrowserWindow, payload: RequestWindowPayload & { id: string }) {
    const routeWithId = `${payload.route}?id=${payload.id}`
    await load(window, withHashRoute(rendererBase, routeWithId))
  }

  const manager = createReferencedWindowManager({
    createWindow,
    eventa: noticeWindowEventa,
    i18n: params.i18n,
    loadRoute: loadNoticeRoute,
    serverChannel: params.serverChannel,
  })

  return {
    open: async (payload: RequestWindowPayload) => {
      const handle = await manager.open(payload)
      return await new Promise<boolean>((resolve) => {
        defineInvokeHandler(handle.context, noticeWindowEventa.windowAction, (action) => {
          if (!action?.id || action.id !== handle.id) return
          resolve(action.action === 'confirm')
          safeClose(handle.window)
        })
      })
    },
  }
}
