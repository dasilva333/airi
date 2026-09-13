import type { MaybeRef } from 'vue'

import localforage from 'localforage'

import { computed, ref, toValue } from 'vue'

export interface LocalVoiceCloneItem {
  id: string
  name: string
  createdAt: number
  provider: string
  sourceFilename?: string
}

export interface CloneVoiceOptions {
  name?: string
}

export function normalizeCloneProviderId(providerId: string): string {
  if (providerId === 'pocket' || providerId === 'pocket-tts-local')
    return 'pocket-tts-local'
  if (providerId === 'moss' || providerId === 'moss-nano-local')
    return 'moss-nano-local'
  return providerId
}

/**
 * Stores mapping for local voice cloning engines.
 *
 * Pocket-TTS uses `pocket-voice-profiles-metadata` and `pocket-voice-profiles-blobs`.
 * MOSS-TTS uses `moss-voice-profiles-metadata` and `voice-profile-blobs`.
 */
function getCloneStores(providerId: string) {
  const norm = normalizeCloneProviderId(providerId)
  if (norm === 'pocket-tts-local') {
    return {
      metaStore: localforage.createInstance({ name: 'pocket-voice-profiles-metadata' }),
      blobStore: localforage.createInstance({ name: 'pocket-voice-profiles-blobs' }),
      provider: norm,
    }
  }
  if (norm === 'moss-nano-local') {
    return {
      metaStore: localforage.createInstance({ name: 'moss-voice-profiles-metadata' }),
      blobStore: localforage.createInstance({ name: 'voice-profile-blobs' }),
      provider: norm,
    }
  }
  throw new Error(`Provider "${providerId}" does not support local zero-shot voice cloning.`)
}

/**
 * Unified composable for local zero-shot voice cloning across Pocket-TTS and MOSS-TTS.
 */
export function useLocalVoiceClone(providerIdSource: MaybeRef<string>) {
  const isCloning = ref(false)
  const cloneError = ref<string | null>(null)

  const activeProviderId = computed(() => normalizeCloneProviderId(toValue(providerIdSource)))

  const supportsVoiceCloning = computed(() => {
    return activeProviderId.value === 'pocket-tts-local' || activeProviderId.value === 'moss-nano-local'
  })

  /**
   * Clone a voice from an audio File or Blob and persist to localforage.
   */
  async function cloneVoiceFromFile(file: File | Blob, options?: CloneVoiceOptions): Promise<LocalVoiceCloneItem> {
    isCloning.value = true
    cloneError.value = null

    try {
      const provider = activeProviderId.value
      if (!supportsVoiceCloning.value) {
        throw new Error(`Provider "${provider}" does not support zero-shot voice cloning.`)
      }

      if (!file || file.size === 0) {
        throw new Error('Audio file is empty or missing.')
      }

      if (file.size > 30 * 1024 * 1024) {
        throw new Error('Audio file exceeds maximum size limit of 30MB.')
      }

      const { metaStore, blobStore } = getCloneStores(provider)
      const timestamp = Date.now()
      const randomSuffix = Math.random().toString(36).substring(2, 8)
      const id = `voice-profile-${timestamp}-${randomSuffix}`

      let filename = 'audio_sample.wav'
      let name = options?.name?.trim()

      if ('name' in file && typeof file.name === 'string' && file.name) {
        filename = file.name
        if (!name) {
          name = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')
        }
      }

      if (!name) {
        name = `Cloned Voice (${new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`
      }

      // 1. Save audio binary into localforage blob store
      await blobStore.setItem(id, file)

      // 2. Save voice metadata
      const metaItem: LocalVoiceCloneItem = {
        id,
        name,
        createdAt: timestamp,
        provider,
        sourceFilename: filename,
      }
      await metaStore.setItem(id, metaItem)

      return metaItem
    }
    catch (err: any) {
      const msg = err?.message || 'Failed to clone voice from audio sample.'
      cloneError.value = msg
      throw err
    }
    finally {
      isCloning.value = false
    }
  }

  /**
   * List custom cloned voices for the active provider.
   */
  async function listClonedVoices(): Promise<LocalVoiceCloneItem[]> {
    if (!supportsVoiceCloning.value)
      return []

    try {
      const { metaStore, provider } = getCloneStores(activeProviderId.value)
      const items: LocalVoiceCloneItem[] = []

      await metaStore.iterate((val: any) => {
        if (val && val.id && val.name) {
          items.push({
            id: val.id,
            name: val.name,
            createdAt: val.createdAt || 0,
            provider,
            sourceFilename: val.sourceFilename,
          })
        }
      })

      return items.sort((a, b) => b.createdAt - a.createdAt)
    }
    catch (err) {
      console.warn('[useLocalVoiceClone] Failed to list cloned voices:', err)
      return []
    }
  }

  /**
   * Remove a custom voice clone and its associated audio blob.
   */
  async function removeClonedVoice(id: string): Promise<void> {
    if (!supportsVoiceCloning.value || !id)
      return

    try {
      const { metaStore, blobStore } = getCloneStores(activeProviderId.value)
      await Promise.all([
        metaStore.removeItem(id),
        blobStore.removeItem(id),
      ])
    }
    catch (err) {
      console.warn('[useLocalVoiceClone] Failed to remove cloned voice:', err)
      throw err
    }
  }

  return {
    isCloning,
    cloneError,
    supportsVoiceCloning,
    activeProviderId,
    cloneVoiceFromFile,
    listClonedVoices,
    removeClonedVoice,
  }
}
