import type { AcousticFeatures } from '../src/types.js'

import { describe, expect, it } from 'vitest'

import {
  ALL_GENRES_CRITERIA,
  formatAcousticTelemetry,
  resolveGenreWithJev,
} from '../src/dsp/jev-genre-resolver.js'

describe('typeSafe Jev System-1 Musical Genre Resolver', () => {
  it('defines the unpruned 17-genre open taxonomy with criteria descriptions', () => {
    const keys = Object.keys(ALL_GENRES_CRITERIA)
    expect(keys).toHaveLength(17)
    expect(keys).toContain('classical_waltz')
    expect(keys).toContain('modern_trap')
    expect(keys).toContain('reggaeton_latin_urban')
    expect(keys).toContain('salsa_afrocuban')
    expect(keys).toContain('bachata')
    expect(keys).toContain('military_march')
    expect(keys).toContain('ragtime')
    expect(keys).toContain('electro_house_edm')
    expect(keys).toContain('hip_hop_boombap')
    expect(keys).toContain('drum_and_bass')
    expect(keys).toContain('jungle_breakbeat')
  })

  it('formats acoustic telemetry into a descriptive prompt', () => {
    const dummyFeatures: AcousticFeatures = {
      bpm: 84,
      confidence: 0.9,
      energyRms: 0.1027,
      energyTier: 'moderate',
      spectralCentroid: 1127,
      timbreBrightness: 'warm',
      rhythmStructure: 'waltz_triple',
      durationSeconds: 120,
      beatTimestamps: [0.71, 1.42, 2.13],
    }

    const telemetry = formatAcousticTelemetry(dummyFeatures, {
      subDb: 21.7,
      lowDb: 18.4,
      midDb: 8.8,
      highDb: -17.1,
    })

    expect(telemetry).toContain('84 BPM')
    expect(telemetry).toContain('waltz_triple')
    expect(telemetry).toContain('moderate')
    expect(telemetry).toContain('warm (Spectral Centroid: 1127 Hz)')
    expect(telemetry).toContain('3/4 triple meter')
    expect(telemetry).toContain('Sub-Bass: 21.7 dB')
  })

  it('gracefully handles missing API keys without throwing', async () => {
    const dummyFeatures: AcousticFeatures = {
      bpm: 128,
      confidence: 0.8,
      energyRms: 0.22,
      energyTier: 'high',
      spectralCentroid: 2400,
      timbreBrightness: 'balanced',
      rhythmStructure: 'four_on_the_floor',
      durationSeconds: 30,
      beatTimestamps: [],
    }

    const result = await resolveGenreWithJev(dummyFeatures, { apiKey: ' ' })
    expect(result).toBeNull()
  })
})
