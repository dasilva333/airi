import type { ComposerTranslation } from 'vue-i18n'

import type { ProviderDefinition } from '../../libs/providers/types'
import type { ProviderValidationPlan } from '../../libs/providers/validators/run'
import type { ProviderMetadata } from './types'

import { merge } from '@moeru/std'
import { listModels } from '@xsai/model'

import { isModelProvider } from '../../libs/providers/types'
import { getValidatorsOfProvider, validateProvider, validateProviderManual } from '../../libs/providers/validators/run'

function getCategoryFromTasks(tasks: string[]): ProviderMetadata['category'] {
  if (tasks.some(task => ['speech-to-text', 'automatic-speech-recognition', 'asr', 'stt'].includes(task.toLowerCase()))) {
    return 'transcription'
  }
  if (tasks.some(task => ['text-to-speech', 'speech', 'tts'].includes(task.toLowerCase()))) {
    return 'speech'
  }
  if (tasks.some(task => ['embed', 'embedding'].includes(task.toLowerCase()))) {
    return 'embed'
  }
  if (tasks.some(task => ['vision', 'image-to-text'].includes(task.toLowerCase()))) {
    return 'vision'
  }

  return 'chat'
}

function resolveEffectiveConfig(
  schemaDefaults: Record<string, unknown>,
  fallbackDefaults: (() => Record<string, unknown>) | undefined,
  config: unknown,
): Record<string, unknown> {
  const defaults = Object.keys(schemaDefaults).length > 0
    ? schemaDefaults
    : (fallbackDefaults?.() || {})
  const raw = (config && typeof config === 'object') ? (config as Record<string, unknown>) : {}
  const merged = merge(defaults, raw) as Record<string, unknown>
  if (typeof merged.baseUrl === 'string' && !merged.baseUrl.trim() && typeof defaults.baseUrl === 'string' && defaults.baseUrl.trim()) {
    merged.baseUrl = defaults.baseUrl
  }
  return merged
}

function extractSchemaDefaults(definition: ProviderDefinition<any>, t: ComposerTranslation) {
  const defaults: Record<string, unknown> = {}

  try {
    const schema = definition.createProviderConfig({ t }) as any
    const shape = schema?.shape

    // Zod object-level parsing fails when required fields (for example apiKey) are missing.
    // Extract each field default individually to preserve default base URLs.
    if (shape && typeof shape === 'object') {
      for (const [key, fieldSchema] of Object.entries(shape)) {
        const parsedField = (fieldSchema as any)?.safeParse?.(undefined)
        if (parsedField?.success) {
          defaults[key] = parsedField.data
        }
      }
    }

    const parsed = schema?.safeParse?.({})
    if (parsed?.success && typeof parsed.data === 'object' && parsed.data !== null) {
      Object.assign(defaults, parsed.data as Record<string, unknown>)
    }
  }
  catch {
  }

  return defaults
}

function buildConfigValidationResult(plan: ProviderValidationPlan) {
  const invalidSteps = plan.steps.filter(step => step.kind === 'config' && step.status === 'invalid')
  if (invalidSteps.length === 0) {
    return {
      errors: [],
      reason: '',
      valid: true,
    }
  }

  const reasons = invalidSteps.map(step => step.reason).filter(Boolean)
  return {
    errors: invalidSteps.map(step => new Error(step.reason || `${step.id} is invalid`)),
    reason: reasons.join('; '),
    valid: false,
  }
}

function mapModelsToMetadataModels(providerId: string, models: any[]) {
  return models.map((model: any) => {
    const capabilities: string[] = []

    // Strict VLM detection based on explicit modalities (OpenRouter/Standard format)
    const inputModalities = model.input_modalities || model.architecture?.input_modalities || []
    const outputModalities = model.output_modalities || model.architecture?.output_modalities || []

    const hasVisionModality = model.architecture?.modality?.includes('image')
      || (inputModalities.includes('image') && outputModalities.includes('text'))

    const isVision = hasVisionModality || (model.capabilities?.vision === true)

    if (typeof localStorage !== 'undefined' && localStorage.getItem('airi:debug') === '1') {
      console.log(`[VLM Check] ${model.id}: input=[${inputModalities.join(', ')}] output=[${outputModalities.join(', ')}] modality=${model.architecture?.modality} isVision=${isVision}`)
    }

    if (isVision) {
      capabilities.push('vision')
    }

    return {
      id: model.id,
      name: model.name || model.display_name || model.id,
      provider: providerId,
      description: model.description || '',
      contextLength: model.context_length || 0,
      capabilities,
      deprecated: false,
    }
  })
}

function appendUniqueReason(reasons: string[], next: string) {
  if (!next)
    return
  if (!reasons.includes(next))
    reasons.push(next)
}

export function convertProviderDefinitionToMetadata(
  definition: ProviderDefinition<any>,
  t: ComposerTranslation,
  options: {
    fallbackDefaultOptions?: ProviderMetadata['defaultOptions']
  } = {},
): ProviderMetadata {
  const keyExtractor = (input: string): string => input
  const category = getCategoryFromTasks(definition.tasks)
  const schemaDefaults = extractSchemaDefaults(definition, t)
  const allValidators = (definition.validators?.validateProvider || []).map(creator => creator({ t }))
  const hasManualValidators = allValidators.some(v => v.manualOnly)

  const business = definition.business?.({ t })
  const pricing = business?.pricing
  const deployment = business?.deployment
  const beginnerRecommended = business?.beginnerRecommended
  const consoleUrl = business?.consoleUrl

  return {
    id: definition.id,
    order: definition.order,
    category,
    tasks: definition.tasks,
    nameKey: definition.nameLocalize({ t: keyExtractor }),
    name: definition.name,
    descriptionKey: definition.descriptionLocalize({ t: keyExtractor }),
    description: definition.description,
    icon: definition.icon,
    iconColor: definition.iconColor,
    iconImage: definition.iconImage,
    isAvailableBy: definition.isAvailableBy,
    pricing,
    deployment,
    requiresCredentials: definition.requiresCredentials ?? (deployment === 'local' ? false : undefined),
    beginnerRecommended,
    consoleUrl,
    defaultOptions: () => {
      if (Object.keys(schemaDefaults).length > 0) {
        return { ...schemaDefaults }
      }

      return options.fallbackDefaultOptions?.() || {}
    },
    createProvider: async (config) => {
      const effectiveConfig = resolveEffectiveConfig(schemaDefaults, options.fallbackDefaultOptions, config)
      return await definition.createProvider(effectiveConfig as any) as any
    },
    capabilities: {
      listModels: definition.extraMethods?.listModels
        ? async (config) => {
          const effectiveConfig = resolveEffectiveConfig(schemaDefaults, options.fallbackDefaultOptions, config)
          const provider = await definition.createProvider(effectiveConfig as any)
          try {
            const models = await definition.extraMethods!.listModels!(effectiveConfig as any, provider)
            return mapModelsToMetadataModels(definition.id, models as any[])
          }
          finally {
            await (provider as { dispose?: () => Promise<void> | void }).dispose?.()
          }
        }
        : async (config) => {
          const effectiveConfig = resolveEffectiveConfig(schemaDefaults, options.fallbackDefaultOptions, config)
          const provider = await definition.createProvider(effectiveConfig as any)
          try {
            if (isModelProvider(provider)) {
              const models = await listModels(provider.model())
              return mapModelsToMetadataModels(definition.id, models as any[])
            }

            const baseUrl = typeof effectiveConfig.baseUrl === 'string' ? effectiveConfig.baseUrl.trim() : ''
            const apiKey = typeof effectiveConfig.apiKey === 'string' ? effectiveConfig.apiKey.trim() : ''
            if (!baseUrl)
              return []

            const models = await listModels({
              baseURL: baseUrl,
              ...(apiKey ? { apiKey } : {}),
            })
            return mapModelsToMetadataModels(definition.id, models as any[])
          }
          catch {
            return []
          }
          finally {
            await (provider as { dispose?: () => Promise<void> | void }).dispose?.()
          }
        },
      listVoices: definition.extraMethods?.listVoices
        ? async (config) => {
          const effectiveConfig = resolveEffectiveConfig(schemaDefaults, options.fallbackDefaultOptions, config)
          const provider = await definition.createProvider(effectiveConfig as any)
          try {
            return await definition.extraMethods!.listVoices!(effectiveConfig as any, provider)
          }
          finally {
            await (provider as { dispose?: () => Promise<void> | void }).dispose?.()
          }
        }
        : undefined,
      loadModel: definition.extraMethods?.loadModel
        ? async (config, hooks) => {
          const effectiveConfig = resolveEffectiveConfig(schemaDefaults, options.fallbackDefaultOptions, config)
          const provider = await definition.createProvider(effectiveConfig as any)
          try {
            await definition.extraMethods!.loadModel!(effectiveConfig as any, provider, hooks)
          }
          finally {
            await (provider as { dispose?: () => Promise<void> | void }).dispose?.()
          }
        }
        : undefined,
    },
    validators: {
      validateProviderConfig: async (config) => {
        const plan = getValidatorsOfProvider({
          definition,
          config,
          schemaDefaults,
          contextOptions: { t },
        })

        // Run full validation pipeline (config + provider validators) only when required.
        // This preserves strict config checks while avoiding unnecessary network checks.
        if (plan.shouldValidate) {
          await validateProvider(plan, { t })
          const invalidSteps = plan.steps.filter(step => step.status === 'invalid')
          if (invalidSteps.length === 0) {
            return {
              errors: [],
              reason: '',
              valid: true,
            }
          }

          const reasons = invalidSteps.map(step => step.reason).filter(Boolean)
          const hasMissingBaseUrlError = reasons.some(reason => reason.includes('Base URL is required'))
          const defaultBaseUrl = typeof schemaDefaults.baseUrl === 'string' ? schemaDefaults.baseUrl.trim() : ''
          if (hasMissingBaseUrlError && defaultBaseUrl) {
            appendUniqueReason(reasons, `Default to ${defaultBaseUrl}.`)
          }

          const connectivityFailed = invalidSteps.some(step => step.id === 'openai-compatible:check-connectivity')
          if (connectivityFailed) {
            const troubleshooting = definition.business?.({ t })?.troubleshooting?.validators?.openaiCompatibleCheckConnectivity?.content || ''
            if (troubleshooting) {
              appendUniqueReason(reasons, troubleshooting)
            }
          }

          return {
            errors: invalidSteps.map(step => new Error(step.reason || `${step.id} is invalid`)),
            reason: reasons.join('; '),
            valid: false,
          }
        }

        await validateProvider(plan, { t })
        return buildConfigValidationResult(plan)
      },
      runManualValidation: hasManualValidators
        ? async (config) => {
          const plan = getValidatorsOfProvider({
            definition,
            config,
            schemaDefaults,
            contextOptions: { t },
          })

          const steps = await validateProviderManual(plan, { t })
          const invalidSteps = steps.filter(step => step.status === 'invalid')
          if (invalidSteps.length === 0) {
            return {
              errors: [],
              reason: '',
              valid: true,
            }
          }

          const reasons = invalidSteps.map(step => step.reason).filter(Boolean)
          return {
            errors: invalidSteps.map(step => new Error(step.reason || `${step.id} is invalid`)),
            reason: reasons.join('; '),
            valid: false,
          }
        }
        : undefined,
    },
    transcriptionFeatures: definition.capabilities?.transcription
      ? {
          supportsGenerate: definition.capabilities.transcription.generateOutput,
          supportsStreamOutput: definition.capabilities.transcription.streamOutput,
          supportsStreamInput: definition.capabilities.transcription.streamInput,
        }
      : undefined,
  }
}

export function convertProviderDefinitionsToMetadata(
  definitions: ProviderDefinition<any>[],
  t: ComposerTranslation,
  currentMetadata: Record<string, ProviderMetadata>,
) {
  const translated: Record<string, ProviderMetadata> = {}

  for (const definition of definitions) {
    translated[definition.id] = convertProviderDefinitionToMetadata(definition, t, {
      fallbackDefaultOptions: currentMetadata[definition.id]?.defaultOptions,
    })
  }

  return translated
}
