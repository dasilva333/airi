/**
 * In-memory synthetic audio generator for deterministic, zero-network DSP tests.
 * Generates pure PCM signals with known BPM, meters, and energy profiles.
 */

export interface SyntheticAudioTrack {
  channelData: Float32Array[]
  sampleRate: number
  duration: number
  expectedBpm: number
  expectedRhythm: string
}

/**
 * Generates a synthetic 4/4 dance groove with kick and snare transients.
 */
export function generateSynthetic44Beat(
  bpm = 120,
  durationSeconds = 5,
  sampleRate = 44100,
): SyntheticAudioTrack {
  const totalSamples = Math.floor(durationSeconds * sampleRate)
  const mono = new Float32Array(totalSamples)
  const beatInterval = (60 / bpm) * sampleRate

  const totalBeats = Math.floor(totalSamples / beatInterval)

  for (let b = 0; b < totalBeats; b++) {
    const startSample = Math.floor(b * beatInterval)
    const isSnare = b % 2 === 1 // Snare on beats 2 and 4

    // 60ms kick transient: sine pitch-drop 140Hz -> 45Hz
    const kickLen = Math.min(Math.floor(0.06 * sampleRate), totalSamples - startSample)
    for (let i = 0; i < kickLen; i++) {
      const t = i / sampleRate
      const freq = 45 + 95 * Math.exp(-t / 0.015)
      const env = Math.exp(-t / 0.018)
      mono[startSample + i] += 0.8 * env * Math.sin(2 * Math.PI * freq * t)
    }

    // On off-beats (snare), add bright noise transient
    if (isSnare) {
      const snareLen = Math.min(Math.floor(0.04 * sampleRate), totalSamples - startSample)
      for (let i = 0; i < snareLen; i++) {
        const t = i / sampleRate
        const env = Math.exp(-t / 0.012)
        const noise = (Math.random() * 2 - 1) * 0.35
        const tone = Math.sin(2 * Math.PI * 220 * t) * 0.25
        mono[startSample + i] += env * (noise + tone)
      }
    }
  }

  // Soft clip to [-1.0, 1.0]
  for (let i = 0; i < totalSamples; i++) {
    mono[i] = Math.tanh(mono[i])
  }

  return {
    channelData: [mono],
    sampleRate,
    duration: durationSeconds,
    expectedBpm: bpm,
    expectedRhythm: 'four_on_the_floor',
  }
}

/**
 * Generates a synthetic 3/4 waltz with heavy downbeat and two lighter accents (Oom-pah-pah).
 */
export function generateSyntheticWaltz(
  bpm = 84,
  durationSeconds = 6,
  sampleRate = 44100,
): SyntheticAudioTrack {
  const totalSamples = Math.floor(durationSeconds * sampleRate)
  const mono = new Float32Array(totalSamples)
  const beatInterval = (60 / bpm) * sampleRate
  const totalBeats = Math.floor(totalSamples / beatInterval)

  for (let b = 0; b < totalBeats; b++) {
    const startSample = Math.floor(b * beatInterval)
    const beatInMeasure = b % 3 // 0 = heavy downbeat (Oom), 1,2 = lighter chord (pah)

    if (beatInMeasure === 0) {
      // Heavy bass downbeat
      const len = Math.min(Math.floor(0.08 * sampleRate), totalSamples - startSample)
      for (let i = 0; i < len; i++) {
        const t = i / sampleRate
        const freq = 60 + 80 * Math.exp(-t / 0.02)
        const env = Math.exp(-t / 0.025)
        mono[startSample + i] += 0.85 * env * Math.sin(2 * Math.PI * freq * t)
      }
    }
    else {
      // Lighter chord hit
      const len = Math.min(Math.floor(0.04 * sampleRate), totalSamples - startSample)
      for (let i = 0; i < len; i++) {
        const t = i / sampleRate
        const env = Math.exp(-t / 0.012)
        const tone1 = Math.sin(2 * Math.PI * 330 * t) * 0.25
        const tone2 = Math.sin(2 * Math.PI * 392 * t) * 0.2
        mono[startSample + i] += env * (tone1 + tone2)
      }
    }
  }

  for (let i = 0; i < totalSamples; i++) {
    mono[i] = Math.tanh(mono[i])
  }

  return {
    channelData: [mono],
    sampleRate,
    duration: durationSeconds,
    expectedBpm: bpm,
    expectedRhythm: 'waltz_triple',
  }
}

/**
 * Generates a low-amplitude ambient soundscape without distinct beat transients.
 */
export function generateSyntheticAmbient(
  durationSeconds = 4,
  sampleRate = 44100,
): SyntheticAudioTrack {
  const totalSamples = Math.floor(durationSeconds * sampleRate)
  const mono = new Float32Array(totalSamples)

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate
    const pad = Math.sin(2 * Math.PI * 110 * t) * 0.015
      + Math.sin(2 * Math.PI * 164.81 * t) * 0.01
      + Math.sin(2 * Math.PI * 220 * t) * 0.008
    mono[i] = pad * (0.8 + 0.2 * Math.sin(2 * Math.PI * 0.2 * t))
  }

  return {
    channelData: [mono],
    sampleRate,
    duration: durationSeconds,
    expectedBpm: 80,
    expectedRhythm: 'ambient_free',
  }
}
