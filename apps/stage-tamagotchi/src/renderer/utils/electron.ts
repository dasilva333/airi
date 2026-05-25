import type { IpcRenderer } from 'electron'

/**
 * Safely retrieves the Electron IPC renderer if available.
 * Returns a no-op mock in browser-only environments to prevent crashes.
 */
export function getIpcRenderer(): any {
  if (typeof window !== 'undefined' && window.electron?.ipcRenderer) {
    return window.electron.ipcRenderer
  }

  // No-op mock for browser environments
  const noop = () => {}
  const noopPromise = async () => {}
  const noopListeners = () => () => {}

  return {
    addListener: noop,
    emit: () => false,
    eventNames: () => [],
    getMaxListeners: () => 0,
    invoke: noopPromise,
    listenerCount: () => 0,
    listeners: () => [],
    off: noop,
    on: noopListeners,
    once: noopListeners,
    postMessage: noop,
    prependListener: noopListeners,
    prependOnceListener: noopListeners,
    rawListeners: () => [],
    removeAllListeners: noop,
    removeListener: noop,
    send: noop,
    sendSync: noop,
    sendTo: noop,
    sendToHost: noop,
    setMaxListeners: noop,
  } as unknown as IpcRenderer
}

/**
 * Safely retrieves the platform name.
 * Returns 'web' in browser-only environments.
 */
export function getPlatform(): string {
  if (typeof window !== 'undefined' && window.platform) {
    return window.platform
  }

  return 'web'
}
