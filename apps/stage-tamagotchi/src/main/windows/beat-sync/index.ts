import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { initScreenCaptureForWindow } from '@proj-airi/electron-screen-capture/main'
import { BrowserWindow } from 'electron'

import { baseUrl, getElectronMainDirname, load } from '../../libs/electron/location'
import { createReusableWindow } from '../../libs/electron/window-manager'

export interface BeatSyncWindowManager {
  getWindow: () => Promise<BrowserWindow>
}

export function setupBeatSync(): BeatSyncWindowManager {
  const reusable = createReusableWindow(async () => {
    const window = new BrowserWindow({
      show: false,
      webPreferences: {
        preload: join(dirname(fileURLToPath(import.meta.url)), '../preload/index.cjs'),
        sandbox: true,
      },
    })

    await load(window, baseUrl(resolve(getElectronMainDirname(), '..', 'renderer'), 'beat-sync.html'))
    initScreenCaptureForWindow(window)
    return window
  })

  return {
    getWindow: reusable.getWindow,
  }
}
