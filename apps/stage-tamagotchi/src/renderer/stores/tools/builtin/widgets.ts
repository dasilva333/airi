import { defineInvoke } from '@moeru/eventa'
import { createContext } from '@moeru/eventa/adapters/electron/renderer'
import { useArtistryStore } from '@proj-airi/stage-ui/stores/modules/artistry'
import type { Tool } from '@xsai/shared-chat'
import { tool } from '@xsai/tool'
import { z } from 'zod'

import {
  widgetsAdd,
  widgetsClear,
  widgetsOpenWindow,
  widgetsPrepareWindow,
  widgetsRemove,
  widgetsUpdate,
} from '../../../../shared/eventa'
import { getIpcRenderer } from '../../../utils/electron'

type SizePreset = 's' | 'm' | 'l'

type WidgetActionInput =
  | {
      action: 'spawn'
      id: string
      componentName: string
      componentProps: string | Record<string, any>
      size: SizePreset
      ttlSeconds: number
    }
  | {
      action: 'update'
      id: string
      componentProps: string | Record<string, any>
      componentName?: string
      size?: SizePreset
      ttlSeconds?: number
    }
  | {
      action: 'remove'
      id: string
      componentName?: string
      componentProps?: string | Record<string, any>
      size?: SizePreset
      ttlSeconds?: number
    }
  | {
      action: 'clear'
      id: string
      componentName?: string
      componentProps?: string | Record<string, any>
      size?: SizePreset
      ttlSeconds?: number
    }
  | {
      action: 'open'
      id: string
      componentName?: string
      componentProps?: string | Record<string, any>
      size?: SizePreset
      ttlSeconds?: number
    }

export type WidgetInvokers = ReturnType<typeof createInvokers>

let cachedInvokers: WidgetInvokers | undefined

function createInvokers() {
  const { context } = createContext(getIpcRenderer())

  return {
    addWidget: defineInvoke(context, widgetsAdd),
    clearWidgets: defineInvoke(context, widgetsClear),
    openWindow: defineInvoke(context, widgetsOpenWindow),
    prepareWindow: defineInvoke(context, widgetsPrepareWindow),
    removeWidget: defineInvoke(context, widgetsRemove),
    updateWidget: defineInvoke(context, widgetsUpdate),
  }
}

function resolveInvokers(override?: WidgetInvokers): WidgetInvokers {
  if (override) return override
  if (!cachedInvokers) cachedInvokers = createInvokers()
  return cachedInvokers
}

const widgetParams = z
  .object({
    action: z
      .enum(['spawn', 'update', 'remove', 'clear', 'open'])
      .describe('Choose one: spawn, update, remove, clear, open'),
    componentName: z.string().describe('Widget component to render, e.g. weather (required for spawn)'),
    componentProps: z.string().describe('Widget props as JSON string (e.g. {"city":"Tokyo"})'),
    id: z.string().describe('Widget id; required for update/remove, optional for spawn/open'),
    size: z.enum(['s', 'm', 'l']),
    ttlSeconds: z.number().int().nonnegative().describe('Auto-close timer in seconds (spawn only)'),
  })
  .strict()

export function normalizeComponentProps(raw?: string | Record<string, any>) {
  if (raw === undefined || raw === null) return {}

  if (typeof raw === 'string') {
    const payload = raw.trim()
    if (!payload) return {}
    try {
      const parsed = JSON.parse(payload)
      return typeof parsed === 'object' && parsed !== null ? parsed : {}
    } catch (error) {
      throw new Error(`Invalid JSON for componentProps: ${(error as Error).message}`)
    }
  }

  if (typeof raw === 'object') return raw

  return {}
}

function getArtistryConfig() {
  try {
    const store = useArtistryStore()
    const config = {
      Globals: {
        comfyuiActiveWorkflow: store.comfyuiActiveWorkflow,
        comfyuiSavedWorkflows: store.comfyuiSavedWorkflows,
        comfyuiServerUrl: store.comfyuiServerUrl,
        replicateApiKey: store.replicateApiKey,
        replicateAspectRatio: store.replicateAspectRatio,
        replicateDefaultModel: store.replicateDefaultModel,
        replicateInferenceSteps: store.replicateInferenceSteps,
      },
      model: store.activeModel,
      options: store.providerOptions,
      promptPrefix: store.defaultPromptPrefix,
      provider: store.activeProvider,
    }
    return JSON.parse(JSON.stringify(config))
  } catch {
    return {}
  }
}

export async function executeWidgetAction(input: WidgetActionInput, deps?: { invokers?: WidgetInvokers }) {
  const invokers = resolveInvokers(deps?.invokers)
  const normalizedId = input.id?.trim() || undefined

  switch (input.action) {
    case 'spawn': {
      if (!input.componentName?.trim()) throw new Error('componentName is required to spawn a widget.')

      const rawProps = normalizeComponentProps(input.componentProps)
      if ((input.componentName === 'comfy' || input.componentName === 'artistry') && !rawProps.status) {
        rawProps.status = 'generating'
      }

      const componentProps = { ...rawProps, _artistryConfig: getArtistryConfig() }
      const ttlMs = input.ttlSeconds ? Math.floor(input.ttlSeconds * 1000) : 0
      const id = await invokers.addWidget({
        componentName: input.componentName,
        componentProps,
        id: normalizedId,
        size: input.size ?? 'm',
        ttlMs,
      })

      return `Spawned widget${id ? ` (${id})` : ''}.`
    }
    case 'update': {
      if (!normalizedId) throw new Error('id is required to update a widget.')

      const componentProps = { ...normalizeComponentProps(input.componentProps), _artistryConfig: getArtistryConfig() }
      const looksLikeArtistryGeneration =
        componentProps.prompt ||
        componentProps.remixId ||
        componentProps.payload?.prompt ||
        componentProps.payload?.remixId

      if (
        (input.componentName === 'comfy' || input.componentName === 'artistry' || looksLikeArtistryGeneration) &&
        !componentProps.status
      ) {
        componentProps.status = 'generating'
      }

      await invokers.updateWidget({
        componentProps,
        id: normalizedId,
      })

      return `Updated widget (${normalizedId}).`
    }
    case 'remove': {
      if (!normalizedId) throw new Error('id is required to remove a widget.')

      await invokers.removeWidget({ id: normalizedId })
      return `Removed widget (${normalizedId}).`
    }
    case 'clear': {
      await invokers.clearWidgets()
      return 'Cleared all widgets.'
    }
    case 'open': {
      const id = await invokers.prepareWindow(normalizedId ? { id: normalizedId } : {})
      await invokers.openWindow(normalizedId ? { id: normalizedId } : {})
      return `Opened widget window${id ? ` (${id})` : ''}.`
    }
    default:
      return 'No action performed.'
  }
}

const tools: Promise<Tool>[] = [
  tool({
    description:
      'Manage overlay widgets in the Stage desktop app (spawn, update, remove, clear, or open the widgets window).',
    execute: (params) => executeWidgetAction(params as WidgetActionInput),
    name: 'stage_widgets',
    parameters: widgetParams,
  }),
]

export const widgetsTools = async () => Promise.all(tools)
