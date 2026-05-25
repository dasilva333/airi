import type { InvokeEventa } from '@moeru/eventa'

import { defineInvoke } from '@moeru/eventa'
import { createContext } from '@moeru/eventa/adapters/electron/renderer'
import { ref } from 'vue'

type EventaContext = ReturnType<typeof createContext>['context']
type IpcRendererLike = Parameters<typeof createContext>[0]

let sharedContext: EventaContext | undefined

function resolveIpcRenderer(ipcRenderer?: IpcRendererLike): IpcRendererLike | undefined {
  if (ipcRenderer) {
    return ipcRenderer
  }

  return (globalThis as { window?: { electron?: { ipcRenderer?: IpcRendererLike } } }).window?.electron?.ipcRenderer
}

export function getElectronEventaContext(ipcRenderer?: IpcRendererLike): EventaContext | undefined {
  const resolved = resolveIpcRenderer(ipcRenderer)
  if (!resolved) {
    return undefined
  }

  sharedContext ??= createContext(resolved).context
  return sharedContext
}

export function useElectronEventaContext(ipcRenderer?: IpcRendererLike) {
  return ref(getElectronEventaContext(ipcRenderer))
}

export function useElectronEventaInvoke<Res, Req = undefined, ResErr = Error, ReqErr = Error>(
  invoke: InvokeEventa<Res, Req, ResErr, ReqErr>,
  context?: EventaContext,
) {
  const ctx = context ?? getElectronEventaContext()

  if (!ctx) {
    return (async () => {
      console.warn('Electron IPC is not available in this environment. This invoke will do nothing.')
      throw new Error('Electron IPC not available')
    }) as any
  }

  return defineInvoke(ctx, invoke)
}

export function resetElectronEventaContextForTesting() {
  sharedContext = undefined
}
