import type { BrowserWindow } from 'electron'

import { isRendererUnavailable } from '@proj-airi/electron-vueuse/main'

export function createReusableWindow(setupFn: () => BrowserWindow | Promise<BrowserWindow>): {
  getWindow: () => Promise<BrowserWindow>
  hasWindow: () => boolean
  getExistingWindow: () => BrowserWindow | undefined
  isVisible: () => boolean
} {
  let window: BrowserWindow | undefined
  let windowSetupFnPromise: Promise<BrowserWindow> | undefined

  const ensureWindow = async () => {
    if (window && !isRendererUnavailable(window))
      return window

    if (windowSetupFnPromise)
      return windowSetupFnPromise

    windowSetupFnPromise = Promise.resolve(setupFn()).then((created) => {
      window = created
      windowSetupFnPromise = undefined
      ;(created as any).__created_at = Date.now()

      created.on?.('closed', () => {
        if (window === created)
          window = undefined
      })

      return created
    }).catch((error) => {
      windowSetupFnPromise = undefined
      throw error
    })

    return windowSetupFnPromise
  }

  const hasWindow = () => Boolean(window && !isRendererUnavailable(window))
  const getExistingWindow = () => hasWindow() ? window : undefined
  const isVisible = () => Boolean(hasWindow() && window?.isVisible())

  return {
    getWindow: async () => ensureWindow(),
    hasWindow,
    getExistingWindow,
    isVisible,
  }
}
