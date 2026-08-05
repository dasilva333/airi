import type { ComposerTranslation } from 'vue-i18n'

import type { ProviderMetadata } from '../types'

import { listProviders as listDefinedProviders } from '../../../libs/providers'
import { convertProviderDefinitionsToMetadata } from '../converters'
import { localEngineMetadata } from './local-engines'
import { createSpeechMetadata } from './speech'
import { transcriptionMetadata } from './transcription'

export function createProviderRegistry(
  t: ComposerTranslation,
  currentMetadata: Record<string, ProviderMetadata>,
): Record<string, ProviderMetadata> {
  const mergedMetadata: Record<string, ProviderMetadata> = {
    ...transcriptionMetadata,
    ...createSpeechMetadata(t),
    ...localEngineMetadata,
    ...currentMetadata,
  }

  const translatedProviderMetadata = convertProviderDefinitionsToMetadata(
    listDefinedProviders(),
    t,
    mergedMetadata,
  )

  const resolvedMetadata = { ...mergedMetadata }

  for (const [providerId, existing] of Object.entries(resolvedMetadata)) {
    if (existing.category !== 'speech' && existing.category !== 'transcription' && providerId !== 'web-rwkv' && providerId !== 'blip-local') {
      delete resolvedMetadata[providerId]
    }
  }

  for (const [providerId, translated] of Object.entries(translatedProviderMetadata)) {
    if (translated.category === 'speech' || translated.category === 'transcription') {
      continue
    }
    resolvedMetadata[providerId] = translated
  }

  return resolvedMetadata
}
