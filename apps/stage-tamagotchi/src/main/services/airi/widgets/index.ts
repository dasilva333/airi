import { defineInvokeHandlers } from '@moeru/eventa'
import type { createContext } from '@moeru/eventa/adapters/electron/main'
import { artistryComfyHealthCheck, artistryGenerateHeadless } from '@proj-airi/stage-shared'
import type { BrowserWindow, IpcMainEvent } from 'electron'
import {
  widgetsAdd,
  widgetsClear,
  widgetsFetch,
  widgetsHideWindow,
  widgetsOpenWindow,
  widgetsPrepareWindow,
  widgetsRemove,
  widgetsUpdate,
} from '../../../../shared/eventa'
import type { WidgetsWindowManager } from '../../../windows/widgets'
import { generateHeadless } from './artistry-bridge'

interface InvokeOptions {
  raw?: { ipcMainEvent?: IpcMainEvent }
}

function isFromWindow(options: InvokeOptions | undefined, window: BrowserWindow) {
  const sender = options?.raw?.ipcMainEvent?.sender
  if (!sender) return false

  if (sender.id !== window.webContents.id) {
    console.warn(
      `[WidgetsService] Window mismatch detected. Sender: ${sender.id}, Target Window: ${window.webContents.id}. Allowing anyway for dev tools support.`,
    )
  }

  return true
}

export function createWidgetsService(params: {
  context: ReturnType<typeof createContext>['context']
  widgetsManager: WidgetsWindowManager
  window: BrowserWindow
}) {
  defineInvokeHandlers(
    params.context,
    {
      artistryComfyHealthCheck,
      artistryGenerateHeadless,
      widgetsAdd,
      widgetsClear,
      widgetsFetch,
      widgetsHideWindow,
      widgetsOpenWindow,
      widgetsPrepareWindow,
      widgetsRemove,
      widgetsUpdate,
    },
    {
      artistryComfyHealthCheck: async (payload: { url: string }) => {
        const url = payload?.url
        if (!url) throw new Error('Missing URL')
        try {
          const resp = await fetch(`${url}/system_stats`)
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
          const data = await resp.json()
          const gpus = data.devices?.map((d: any) => d.name).join(', ') || 'Unknown GPU'
          const vram = data.devices?.[0]?.vram_total
          const vramStr = vram ? `${(vram / 1024 / 1024 / 1024).toFixed(1)} GB` : ''
          return { gpus, vramStr }
        } catch (e: any) {
          if (
            e.message.includes('fetch') ||
            e.message.includes('CORS') ||
            e.message.includes('Forbidden') ||
            e.message.includes('fetch failed')
          ) {
            throw new Error('CORS')
          }
          throw e
        }
      },
      artistryGenerateHeadless: async (payload, options) => {
        if (!isFromWindow(options as InvokeOptions, params.window)) return { error: 'Unauthorized window' }
        if (!payload) return { error: 'Payload missing' }
        try {
          return await generateHeadless(payload)
        } catch (error: any) {
          return { error: error.message }
        }
      },
      widgetsAdd: async (payload, options) => {
        if (!isFromWindow(options as InvokeOptions, params.window)) return undefined
        return payload ? params.widgetsManager!.pushWidget(payload) : undefined
      },
      widgetsClear: async (_payload, options) => {
        if (!isFromWindow(options as InvokeOptions, params.window)) return undefined
        return params.widgetsManager!.clearWidgets()
      },
      widgetsFetch: async (payload, options) => {
        if (!isFromWindow(options as InvokeOptions, params.window)) return undefined
        return payload?.id ? params.widgetsManager!.getWidgetSnapshot(payload.id) : undefined
      },
      widgetsHideWindow: async (payload, options) => {
        if (!isFromWindow(options as InvokeOptions, params.window)) return undefined
        return params.widgetsManager!.hideWindow(payload ?? undefined)
      },
      widgetsOpenWindow: async (payload, options) => {
        if (!isFromWindow(options as InvokeOptions, params.window)) return undefined
        return params.widgetsManager!.openWindow(payload ?? undefined)
      },
      widgetsPrepareWindow: async (payload, options) => {
        if (!isFromWindow(options as InvokeOptions, params.window)) return undefined
        return params.widgetsManager!.prepareWidgetWindow(payload ?? undefined)
      },
      widgetsRemove: async (payload, options) => {
        if (!isFromWindow(options as InvokeOptions, params.window)) return undefined
        return payload?.id ? params.widgetsManager!.removeWidget(payload.id) : undefined
      },
      widgetsUpdate: async (payload, options) => {
        if (!isFromWindow(options as InvokeOptions, params.window)) return undefined
        return payload ? params.widgetsManager!.updateWidget(payload) : undefined
      },
    },
  )
}
