import type { ModelInfo } from '../../types'

import z from 'zod'

import { createOpenAI } from '@xsai-ext/providers/create'

import { createOpenAICompatibleValidators } from '../../validators/openai-compatible'
import { defineProvider } from '../registry'

const kiloConfigSchema = z.object({
  apiKey: z
    .string('API Key')
    .optional()
    .default(''),
  baseUrl: z
    .string('Base URL')
    .optional()
    .default('https://api.kilo.ai/api/gateway/v1'),
})

type KiloConfig = z.input<typeof kiloConfigSchema>

const KILO_GATEWAY_MODELS_URL = 'https://api.kilo.ai/api/gateway/models'

/**
 * Shape of a single gateway listing entry. Only the fields this provider
 * consumes are declared; the rest of the payload passes through unknown.
 */
const kiloGatewayModelSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  isFree: z.boolean().optional(),
  context_length: z.number().int().nonnegative().nullable().optional(),
  top_provider: z.object({ context_length: z.number().int().nonnegative().nullable().optional() }).optional(),
  architecture: z.object({ input_modalities: z.array(z.string()).optional() }).optional(),
})

/**
 * Gateway free-model detection. `isFree` is the authoritative marker, but not
 * every free id carries the `:free` suffix (e.g. `kilo-auto/free`), so the
 * suffix checks are kept as a secondary signal.
 */
function isFreeGatewayModel(model: z.infer<typeof kiloGatewayModelSchema>): boolean {
  if (model.isFree === true)
    return true

  return model.id.includes(':free') || /(^|\/)free$/.test(model.id)
}

function toKiloModelInfo(model: z.infer<typeof kiloGatewayModelSchema>): ModelInfo {
  const contextLength = model.context_length ?? model.top_provider?.context_length ?? undefined
  const capabilities = model.architecture?.input_modalities?.includes('image') ? ['vision'] : undefined

  return {
    id: model.id,
    name: model.name || model.id,
    provider: 'kilo',
    description: model.description || 'Kilo Gateway free model',
    contextLength,
    capabilities,
  }
}

/**
 * Verified Kilo Gateway free models. Provenance: live listing from
 * https://api.kilo.ai/api/gateway/models (2026-11-08).
 *
 * These are a fallback: listModels() returns the live listing first and only
 * merges these in for IDs the live call did not return. Preset rows carry a
 * friendly name, context window, and vision flag the raw listing omits.
 */
const kiloPresetModels: ModelInfo[] = [
  {
    id: 'kilo-auto/free',
    name: 'Kilo Auto Free',
    provider: 'kilo',
    description: 'Auto-routes to the best available free coding model',
    contextLength: 256_000,
  },
  {
    id: 'dots-studio/dots-3-note-preview:free',
    name: 'Dots3-Note Preview',
    provider: 'kilo',
    description: 'Dots Studio preview model, 512K context',
    contextLength: 512_000,
    capabilities: ['vision'],
  },
  {
    id: 'nvidia/nemotron-3.5-super-vl:free',
    name: 'Nemotron 3.5 Super VL',
    provider: 'kilo',
    description: 'NVIDIA vision-language reasoning model, 1M context',
    contextLength: 1_000_000,
    capabilities: ['vision'],
  },
  {
    id: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
    name: 'Nemotron 3 Nano Omni Reasoning',
    provider: 'kilo',
    description: 'NVIDIA omni-modal reasoning model, 256K context',
    contextLength: 256_000,
    capabilities: ['vision'],
  },
  {
    id: 'nvidia/nemotron-3-ultra-550b-a55b:free',
    name: 'Nemotron 3 Ultra 550B',
    provider: 'kilo',
    description: 'NVIDIA frontier reasoning model, 1M context',
    contextLength: 1_000_000,
  },
  {
    id: 'nvidia/nemotron-3.5-lightning:free',
    name: 'Nemotron 3.5 Lightning',
    provider: 'kilo',
    description: 'NVIDIA fast frontier model, 1M context',
    contextLength: 1_000_000,
  },
  {
    id: 'reflection/beam-free',
    name: 'Reflection Beam 1.0',
    provider: 'kilo',
    description: 'Reflection reasoning model, 1M context',
    contextLength: 1_048_576,
  },
  {
    id: 'cohere/north-mini-code:free',
    name: 'Cohere North Mini Code',
    provider: 'kilo',
    description: 'Cohere coding model, 256K context',
    contextLength: 256_000,
  },
  {
    id: 'openrouter/free',
    name: 'OpenRouter Free Router',
    provider: 'kilo',
    description: 'OpenRouter free-tier auto router, 200K context',
    contextLength: 200_000,
    capabilities: ['vision'],
  },
  {
    id: 'stealth/glyph-cluster',
    name: 'Glyph Cluster',
    provider: 'kilo',
    description: 'Stealth preview model, 256K context',
    contextLength: 256_000,
  },
]

export const providerKilo = defineProvider<KiloConfig>({
  id: 'kilo',
  name: 'Kilo',
  nameLocalize: ({ t }) => t('settings.pages.providers.provider.kilo.title'),
  description: 'Coding-optimized free gateway — auto-routes to best model',
  descriptionLocalize: ({ t }) => t('settings.pages.providers.provider.kilo.description'),
  tasks: ['chat', 'vision'],
  icon: 'i-solar:code-bold',
  requiresCredentials: {
    // Kilo serves free models keyless, but a key unlocks paid Kilo models
    // (keyless calls to them answer 401 PAID_MODEL_AUTH_REQUIRED).
    optional: true,
  },
  business: () => ({
    pricing: 'free',
    deployment: 'cloud',
    consoleUrl: 'https://kilo.ai',
  }),

  createProviderConfig: ({ t }) => kiloConfigSchema.extend({
    apiKey: kiloConfigSchema.shape.apiKey.meta({
      labelLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.api-key.label'),
      descriptionLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.api-key.description'),
      placeholderLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.api-key.placeholder'),
      type: 'password',
    }),
    baseUrl: kiloConfigSchema.shape.baseUrl.meta({
      labelLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.base-url.label'),
      descriptionLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.base-url.description'),
      placeholderLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.base-url.placeholder'),
    }),
  }),
  createProvider(config) {
    return createOpenAI(config.apiKey || '', config.baseUrl)
  },

  extraMethods: {
    listModels: async () => {
      try {
        const response = await fetch(KILO_GATEWAY_MODELS_URL)
        if (!response.ok) {
          throw new Error(`Failed to fetch models: ${response.status}`)
        }
        const data: unknown = await response.json()
        // Expected format: { data: [{ id: string, ... }] } or a bare array.
        // Entries stay `unknown` here: a single malformed row must not discard
        // the whole live listing and degrade the picker to the presets.
        const envelope = z.union([
          z.array(z.unknown()),
          z.object({ data: z.array(z.unknown()) }),
        ]).safeParse(data)

        const rows: unknown[] = envelope.success
          ? (Array.isArray(envelope.data) ? envelope.data : envelope.data.data)
          : []

        const gatewayModels = rows.flatMap((model) => {
          const parsed = kiloGatewayModelSchema.safeParse(model)
          return parsed.success ? [parsed.data] : []
        })

        const live = gatewayModels
          .filter(isFreeGatewayModel)
          .map(toKiloModelInfo)

        // Live listing takes precedence. Merge presets only for IDs the live
        // call did not surface, and keep preset metadata when the ID matches.
        const presetById = new Map(kiloPresetModels.map(m => [m.id, m]))
        const merged = live.map((model) => {
          const preset = presetById.get(model.id)
          if (!preset)
            return model
          presetById.delete(model.id)
          return {
            ...model,
            name: preset.name,
            description: preset.description ?? model.description,
            contextLength: model.contextLength ?? preset.contextLength,
            capabilities: model.capabilities?.length ? model.capabilities : preset.capabilities,
          }
        })
        for (const preset of presetById.values())
          merged.push(preset)

        return merged
      }
      catch {
        // Live fetch failed (offline, CORS, provider outage): the preset list
        // keeps the model picker non-empty instead of returning [].
        return kiloPresetModels
      }
    },
  },

  validationRequiredWhen() {
    return true
  },
  validators: {
    ...createOpenAICompatibleValidators({
      checks: ['connectivity'],
      skipApiKeyCheck: true,
    }),
  },
})
