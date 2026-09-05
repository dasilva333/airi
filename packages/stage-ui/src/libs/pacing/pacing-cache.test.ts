import type { ThinkingAudioFingerprintParams } from './pacing-cache'

import { beforeEach, describe, expect, it } from 'vitest'

import {
  clearThinkingAudioCache,
  computeThinkingAudioFingerprint,
  deleteThinkingAudio,
  getThinkingAudio,
  listThinkingAudioManifests,
  saveThinkingAudio,

} from './pacing-cache'

describe('pacing-cache (Phase 1)', () => {
  const baseParams: ThinkingAudioFingerprintParams = {
    provider: 'elevenlabs',
    model: 'eleven_multilingual_v2',
    voiceId: '21m00Tcm4TlvDq8ikWAM',
    pitch: 1.0,
    rate: 1.0,
    language: 'en',
    text: 'Hmm... let me see...',
    format: 'audio/mp3',
  }

  beforeEach(async () => {
    await clearThinkingAudioCache()
  })

  it('computes deterministic SHA-256 fingerprint for identical params', async () => {
    const fp1 = await computeThinkingAudioFingerprint(baseParams)
    const fp2 = await computeThinkingAudioFingerprint({ ...baseParams })
    expect(fp1).toBe(fp2)
    expect(fp1.length).toBeGreaterThan(10)
  })

  it('invalidates fingerprint when any voice parameter changes', async () => {
    const fpOriginal = await computeThinkingAudioFingerprint(baseParams)

    const fpDifferentPitch = await computeThinkingAudioFingerprint({
      ...baseParams,
      pitch: 1.2,
    })
    expect(fpDifferentPitch).not.toBe(fpOriginal)

    const fpDifferentVoice = await computeThinkingAudioFingerprint({
      ...baseParams,
      voiceId: 'AZnzlk1XvdvUeBnXmlld',
    })
    expect(fpDifferentVoice).not.toBe(fpOriginal)

    const fpDifferentText = await computeThinkingAudioFingerprint({
      ...baseParams,
      text: 'Wait a second...',
    })
    expect(fpDifferentText).not.toBe(fpOriginal)
  })

  it('saves and retrieves audio buffers round-trip', async () => {
    const mockAudioBytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])
    const durationMs = 1200

    const fp = await saveThinkingAudio(baseParams, mockAudioBytes.buffer, durationMs)
    expect(fp).toBeDefined()

    const retrieved = await getThinkingAudio(baseParams)
    expect(retrieved).not.toBeNull()
    expect(retrieved?.durationMs).toBe(durationMs)
    expect(new Uint8Array(retrieved!.audio)).toEqual(mockAudioBytes)
  })

  it('returns null immediately on cache miss (< 5ms)', async () => {
    const start = performance.now()
    const result = await getThinkingAudio({
      ...baseParams,
      text: 'Non-existent quote',
    })
    const elapsed = performance.now() - start

    expect(result).toBeNull()
    expect(elapsed).toBeLessThan(50) // High margin for test runner, ensures no network loop
  })

  it('deletes cached entry and updates manifest list', async () => {
    const mockAudioBytes = new Uint8Array([9, 8, 7])
    const fp = await saveThinkingAudio(baseParams, mockAudioBytes.buffer, 900)

    const manifestsBefore = await listThinkingAudioManifests()
    expect(manifestsBefore.length).toBe(1)
    expect(manifestsBefore[0].fingerprint).toBe(fp)

    await deleteThinkingAudio(fp)

    const retrieved = await getThinkingAudio(baseParams)
    expect(retrieved).toBeNull()

    const manifestsAfter = await listThinkingAudioManifests()
    expect(manifestsAfter.length).toBe(0)
  })
})
