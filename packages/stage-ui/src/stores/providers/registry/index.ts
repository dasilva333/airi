import type { ComposerTranslation } from 'vue-i18n'
import { listProviders as listDefinedProviders } from '../../../libs/providers'
import { convertProviderDefinitionsToMetadata } from '../converters'
import type { ProviderMetadata } from '../types'

export function createProviderRegistry(
  t: ComposerTranslation,
  currentMetadata: Record<string, ProviderMetadata>,
): Record<string, ProviderMetadata> {
  const translatedProviderMetadata = convertProviderDefinitionsToMetadata(listDefinedProviders(), t, currentMetadata)

  const resolvedMetadata = { ...currentMetadata }

  for (const [providerId, existing] of Object.entries(resolvedMetadata)) {
    if (existing.category !== 'speech' && existing.category !== 'transcription') {
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
