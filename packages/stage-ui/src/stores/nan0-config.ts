export const NAN0_PROCESSOR_ID = 'local_nan0' as const
export const NAN0_COGNITION_SCHEMA_VERSION = 1 as const
export const NAN0_STATE_STORAGE_KEY = 'nan0/kernel-state/v1' as const

export type CognitionProcessorId = 'none' | typeof NAN0_PROCESSOR_ID | (string & {})

export interface AiriCognitionConfig {
  schemaVersion?: typeof NAN0_COGNITION_SCHEMA_VERSION
  enabled: boolean
  processor: CognitionProcessorId
  provider?: string
  model?: string
  outputGuidance?: string
}

export interface Nan0ReasoningRoute {
  providerId: string
  model: string
}

export interface Nan0CognitionMigrationResult {
  config: AiriCognitionConfig | undefined
  changed: boolean
}

export function migrateNan0CognitionConfig(params: {
  config: AiriCognitionConfig | undefined
  legacyStatePresent: boolean
  isActiveCard: boolean
  fallback: Nan0ReasoningRoute
}): Nan0CognitionMigrationResult {
  if (params.config) {
    if (params.config.schemaVersion === NAN0_COGNITION_SCHEMA_VERSION)
      return { config: params.config, changed: false }

    return {
      config: {
        ...params.config,
        schemaVersion: NAN0_COGNITION_SCHEMA_VERSION,
      },
      changed: true,
    }
  }

  if (!params.legacyStatePresent || !params.isActiveCard)
    return { config: undefined, changed: false }

  return {
    config: {
      schemaVersion: NAN0_COGNITION_SCHEMA_VERSION,
      enabled: true,
      processor: NAN0_PROCESSOR_ID,
      provider: params.fallback.providerId,
      model: params.fallback.model,
    },
    changed: true,
  }
}

export function isNan0ProcessorEnabled(config: AiriCognitionConfig | null | undefined): boolean {
  return config?.enabled === true && config.processor === NAN0_PROCESSOR_ID
}

export function resolveNan0ReasoningRoute(
  config: AiriCognitionConfig | null | undefined,
  fallback: Nan0ReasoningRoute,
): Nan0ReasoningRoute {
  if (!config || !isNan0ProcessorEnabled(config))
    return fallback

  return {
    providerId: config.provider?.trim() || fallback.providerId,
    model: config.model?.trim() || fallback.model,
  }
}
