import type { ElectronWindow } from '@proj-airi/stage-shared'

import { electronAPI } from '@electron-toolkit/preload'
import { contextBridge, ipcRenderer } from 'electron'

// Bypass strict eslint rules for the process global in sandboxed scripts
/* eslint-disable eslint-comments/no-unlimited-disable */
/* eslint-disable */
const _process = process
/* eslint-enable */

export function expose() {
  // TODO: once we refactored eventa to support window-namespaced contexts,
  // we can remove the setMaxListeners call below since eventa will be able to dispatch and
  // manage events within eventa's context system.
  ipcRenderer.setMaxListeners(0)

  // Use `contextBridge` APIs to expose Electron APIs to
  // renderer only if context isolation is enabled, otherwise
  // just add to the DOM global.
  if (_process.contextIsolated) {
    try {
      contextBridge.exposeInMainWorld('electron', electronAPI)
      contextBridge.exposeInMainWorld('platform', _process.platform)
    }
    catch (error) {
      console.error(error)
    }
  }
  else {
    window.electron = electronAPI
    window.platform = _process.platform
  }
}

export function exposeWithCustomAPI<CustomAPI>(customAPI: CustomAPI) {
  expose()

  // Use `contextBridge` APIs to expose Electron APIs to
  // renderer only if context isolation is enabled, otherwise
  // just add to the DOM global.
  if (_process.contextIsolated) {
    try {
      contextBridge.exposeInMainWorld('api', customAPI)
    }
    catch (error) {
      console.error(error)
    }
  }
  else {
    (window as ElectronWindow<CustomAPI>).api = customAPI
  }
}
