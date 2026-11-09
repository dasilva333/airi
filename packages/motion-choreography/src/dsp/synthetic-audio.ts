/**
 * In-memory synthetic audio generator for deterministic acoustic DSP testing
 * and live browser playback in the Motion Choreography Studio.
 * Generates pure PCM signals with known BPM, metric cadences, and frequency profiles.
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
    const isSnare = b % 2 === 1

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
    const beatInMeasure = b % 3

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
 * Generates a Latin Dembow / Reggaeton groove (96 BPM).
 * Characteristic boom-ch-boom-ch syncopated tresillo pattern.
 */
export function generateSyntheticDembow(
  bpm = 96,
  durationSeconds = 6,
  sampleRate = 44100,
): SyntheticAudioTrack {
  const totalSamples = Math.floor(durationSeconds * sampleRate)
  const mono = new Float32Array(totalSamples)
  const beatInterval = (60 / bpm) * sampleRate
  const totalBeats = Math.floor(totalSamples / beatInterval)

  // Subdivided into 16th notes
  const sixteenth = beatInterval / 4

  for (let b = 0; b < totalBeats; b++) {
    const beatStart = Math.floor(b * beatInterval)

    // Four-on-the-floor kick
    const kickLen = Math.min(Math.floor(0.07 * sampleRate), totalSamples - beatStart)
    for (let i = 0; i < kickLen; i++) {
      const t = i / sampleRate
      const freq = 55 + 85 * Math.exp(-t / 0.02)
      mono[beatStart + i] += 0.9 * Math.exp(-t / 0.03) * Math.sin(2 * Math.PI * freq * t)
    }

    // Dembow syncopated snares at 16th positions: 3rd sixteenth (dotted eighth)
    const snare1Offset = Math.floor(beatStart + 3 * sixteenth)
    if (snare1Offset + 800 < totalSamples) {
      const sLen = Math.min(Math.floor(0.04 * sampleRate), totalSamples - snare1Offset)
      for (let i = 0; i < sLen; i++) {
        const t = i / sampleRate
        const noise = (Math.random() * 2 - 1) * 0.4
        const snap = Math.sin(2 * Math.PI * 400 * t) * 0.3
        mono[snare1Offset + i] += Math.exp(-t / 0.015) * (noise + snap)
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
    expectedRhythm: 'four_on_the_floor',
  }
}

/**
 * Generates a 90s Boom-Bap Hip-Hop beat (92 BPM) with heavy swung kicks and crisp snares.
 */
export function generateSyntheticBoomBap(
  bpm = 92,
  durationSeconds = 6,
  sampleRate = 44100,
): SyntheticAudioTrack {
  const totalSamples = Math.floor(durationSeconds * sampleRate)
  const mono = new Float32Array(totalSamples)
  const beatInterval = (60 / bpm) * sampleRate
  const totalBeats = Math.floor(totalSamples / beatInterval)

  for (let b = 0; b < totalBeats; b++) {
    const beatStart = Math.floor(b * beatInterval)
    const barBeat = b % 4

    // Kicks on beat 1 and swung beat 2.7
    if (barBeat === 0 || barBeat === 2) {
      const kLen = Math.min(Math.floor(0.09 * sampleRate), totalSamples - beatStart)
      for (let i = 0; i < kLen; i++) {
        const t = i / sampleRate
        const freq = 50 + 70 * Math.exp(-t / 0.03)
        mono[beatStart + i] += 0.95 * Math.exp(-t / 0.04) * Math.sin(2 * Math.PI * freq * t)
      }
    }

    // Fat snare on beats 2 and 4
    if (barBeat === 1 || barBeat === 3) {
      const sLen = Math.min(Math.floor(0.06 * sampleRate), totalSamples - beatStart)
      for (let i = 0; i < sLen; i++) {
        const t = i / sampleRate
        const noise = (Math.random() * 2 - 1) * 0.5
        const pop = Math.sin(2 * Math.PI * 180 * t) * 0.4
        mono[beatStart + i] += Math.exp(-t / 0.02) * (noise + pop)
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
    expectedRhythm: 'four_on_the_floor',
  }
}

/**
 * Generates a Modern Trap beat (140 BPM) with half-time snare and deep 808 sub bass.
 */
export function generateSyntheticTrap(
  bpm = 140,
  durationSeconds = 6,
  sampleRate = 44100,
): SyntheticAudioTrack {
  const totalSamples = Math.floor(durationSeconds * sampleRate)
  const mono = new Float32Array(totalSamples)
  const beatInterval = (60 / bpm) * sampleRate
  const totalBeats = Math.floor(totalSamples / beatInterval)

  for (let b = 0; b < totalBeats; b++) {
    const beatStart = Math.floor(b * beatInterval)
    const barBeat = b % 4

    // Deep 808 kick on beat 1
    if (barBeat === 0) {
      const kLen = Math.min(Math.floor(0.18 * sampleRate), totalSamples - beatStart)
      for (let i = 0; i < kLen; i++) {
        const t = i / sampleRate
        const freq = 38 + 50 * Math.exp(-t / 0.04)
        mono[beatStart + i] += 0.9 * Math.exp(-t / 0.09) * Math.sin(2 * Math.PI * freq * t)
      }
    }

    // Half-time clap/snare on beat 3 (barBeat === 2)
    if (barBeat === 2) {
      const sLen = Math.min(Math.floor(0.05 * sampleRate), totalSamples - beatStart)
      for (let i = 0; i < sLen; i++) {
        const t = i / sampleRate
        const noise = (Math.random() * 2 - 1) * 0.45
        const snap = Math.sin(2 * Math.PI * 320 * t) * 0.3
        mono[beatStart + i] += Math.exp(-t / 0.015) * (noise + snap)
      }
    }

    // Fast 1/16th hi-hat ticks
    for (let h = 0; h < 4; h++) {
      const hOffset = Math.floor(beatStart + (h * beatInterval) / 4)
      if (hOffset + 200 < totalSamples) {
        for (let i = 0; i < 150; i++) {
          const t = i / sampleRate
          const noise = (Math.random() * 2 - 1) * 0.15
          mono[hOffset + i] += Math.exp(-t / 0.003) * noise
        }
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
    expectedRhythm: 'four_on_the_floor',
  }
}

/**
 * Generates an Afro-Cuban Salsa track (185 BPM) with 3:2 Son Clave rhythm.
 */
export function generateSyntheticSalsa(
  bpm = 185,
  durationSeconds = 6,
  sampleRate = 44100,
): SyntheticAudioTrack {
  const totalSamples = Math.floor(durationSeconds * sampleRate)
  const mono = new Float32Array(totalSamples)
  const beatInterval = (60 / bpm) * sampleRate
  const totalBeats = Math.floor(totalSamples / beatInterval)

  // 3:2 Son Clave pulses relative to 8 beats (2 bars of 4/4):
  // Bar 1 (3-side): Beat 1, Beat 2.5 (and of 2), Beat 4
  // Bar 2 (2-side): Beat 6 (beat 2 of bar 2), Beat 7 (beat 3 of bar 2)
  const claveBeats = [0, 1.5, 3, 5, 6]

  const totalTwoBarPhrases = Math.ceil(totalBeats / 8)
  for (let p = 0; p < totalTwoBarPhrases; p++) {
    for (const cb of claveBeats) {
      const beatNum = p * 8 + cb
      if (beatNum >= totalBeats)
        continue
      const startSample = Math.floor(beatNum * beatInterval)

      // High-pitched woodblock clave strike (~2200 Hz)
      const cLen = Math.min(Math.floor(0.03 * sampleRate), totalSamples - startSample)
      for (let i = 0; i < cLen; i++) {
        const t = i / sampleRate
        const tone = Math.sin(2 * Math.PI * 2250 * t) * 0.6 + Math.sin(2 * Math.PI * 4500 * t) * 0.2
        mono[startSample + i] += Math.exp(-t / 0.006) * tone
      }
    }
  }

  // Tumbao bass on 4 and 4&
  for (let b = 0; b < totalBeats; b++) {
    if (b % 4 === 3) {
      const startSample = Math.floor(b * beatInterval)
      const bLen = Math.min(Math.floor(0.08 * sampleRate), totalSamples - startSample)
      for (let i = 0; i < bLen; i++) {
        const t = i / sampleRate
        mono[startSample + i] += 0.7 * Math.exp(-t / 0.03) * Math.sin(2 * Math.PI * 90 * t)
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
    expectedRhythm: 'four_on_the_floor',
  }
}

/**
 * Generates a low-amplitude ambient soundscape without distinct beat transients.
 */
export function generateSyntheticAmbient(
  durationSeconds = 6,
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
