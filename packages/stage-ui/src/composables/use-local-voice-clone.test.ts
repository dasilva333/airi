import { describe, expect, it } from 'vitest'
import { ref } from 'vue'

import { normalizeCloneProviderId, useLocalVoiceClone } from './use-local-voice-clone'

describe('useLocalVoiceClone', () => {
  describe('normalizeCloneProviderId', () => {
    it('normalizes pocket provider ids', () => {
      expect(normalizeCloneProviderId('pocket')).toBe('pocket-tts-local')
      expect(normalizeCloneProviderId('pocket-tts-local')).toBe('pocket-tts-local')
    })

    it('normalizes moss provider ids', () => {
      expect(normalizeCloneProviderId('moss')).toBe('moss-nano-local')
      expect(normalizeCloneProviderId('moss-nano-local')).toBe('moss-nano-local')
    })

    it('preserves other provider ids', () => {
      expect(normalizeCloneProviderId('kokoro-local')).toBe('kokoro-local')
      expect(normalizeCloneProviderId('elevenlabs')).toBe('elevenlabs')
    })
  })

  describe('supportsVoiceCloning', () => {
    it('reports true for pocket-tts and moss-nano', () => {
      const provider = ref('pocket')
      const { supportsVoiceCloning } = useLocalVoiceClone(provider)
      expect(supportsVoiceCloning.value).toBe(true)

      provider.value = 'moss'
      expect(supportsVoiceCloning.value).toBe(true)

      provider.value = 'pocket-tts-local'
      expect(supportsVoiceCloning.value).toBe(true)

      provider.value = 'moss-nano-local'
      expect(supportsVoiceCloning.value).toBe(true)
    })

    it('reports false for non-cloning providers', () => {
      const provider = ref('kokoro-local')
      const { supportsVoiceCloning } = useLocalVoiceClone(provider)
      expect(supportsVoiceCloning.value).toBe(false)

      provider.value = 'elevenlabs'
      expect(supportsVoiceCloning.value).toBe(false)
    })
  })

  describe('cloning operations', () => {
    it('rejects cloning for unsupported providers', async () => {
      const provider = ref('kokoro-local')
      const { cloneVoiceFromFile } = useLocalVoiceClone(provider)
      const fakeBlob = new Blob(['mock audio'], { type: 'audio/wav' })

      await expect(cloneVoiceFromFile(fakeBlob)).rejects.toThrow(
        'Provider "kokoro-local" does not support zero-shot voice cloning',
      )
    })

    it('rejects empty or oversized files', async () => {
      const provider = ref('pocket')
      const { cloneVoiceFromFile } = useLocalVoiceClone(provider)
      const emptyBlob = new Blob([], { type: 'audio/wav' })

      await expect(cloneVoiceFromFile(emptyBlob)).rejects.toThrow('Audio file is empty or missing.')
    })
  })
})
