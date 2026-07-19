import { describe, expect, it } from 'vitest'

import {
  isNan0ProcessorEnabled,
  migrateNan0CognitionConfig,
  NAN0_COGNITION_SCHEMA_VERSION,
  NAN0_PROCESSOR_ID,
  resolveNan0ReasoningRoute,
} from './nan0-config'

describe('nan0 processor configuration', () => {
  it('activates only for the enabled official Nan0 processor', () => {
    expect(isNan0ProcessorEnabled(undefined)).toBe(false)
    expect(isNan0ProcessorEnabled({ enabled: false, processor: NAN0_PROCESSOR_ID })).toBe(false)
    expect(isNan0ProcessorEnabled({ enabled: true, processor: 'none' })).toBe(false)
    expect(isNan0ProcessorEnabled({ enabled: true, processor: NAN0_PROCESSOR_ID })).toBe(true)
  })

  it('uses the card-selected AIRI provider and model for Nan0 thought', () => {
    expect(resolveNan0ReasoningRoute({
      enabled: true,
      processor: NAN0_PROCESSOR_ID,
      provider: 'card-provider',
      model: 'card-model',
    }, {
      providerId: 'fallback-provider',
      model: 'fallback-model',
    })).toEqual({
      providerId: 'card-provider',
      model: 'card-model',
    })
  })

  it('falls back to the active AIRI route for blank or inactive card settings', () => {
    const fallback = { providerId: 'fallback-provider', model: 'fallback-model' }

    expect(resolveNan0ReasoningRoute({
      enabled: true,
      processor: NAN0_PROCESSOR_ID,
      provider: ' ',
      model: '',
    }, fallback)).toEqual(fallback)
    expect(resolveNan0ReasoningRoute({
      enabled: true,
      processor: 'none',
      provider: 'generic-provider',
      model: 'generic-model',
    }, fallback)).toEqual(fallback)
  })

  it('migrates only the active card when legacy Nan0 state exists', () => {
    const fallback = { providerId: 'card-provider', model: 'card-model' }

    expect(migrateNan0CognitionConfig({
      config: undefined,
      legacyStatePresent: true,
      isActiveCard: true,
      fallback,
    })).toEqual({
      changed: true,
      config: {
        schemaVersion: NAN0_COGNITION_SCHEMA_VERSION,
        enabled: true,
        processor: NAN0_PROCESSOR_ID,
        provider: 'card-provider',
        model: 'card-model',
      },
    })
    expect(migrateNan0CognitionConfig({
      config: undefined,
      legacyStatePresent: true,
      isActiveCard: false,
      fallback,
    })).toEqual({ changed: false, config: undefined })
  })

  it('does not opt a fresh install into Nan0', () => {
    expect(migrateNan0CognitionConfig({
      config: undefined,
      legacyStatePresent: false,
      isActiveCard: true,
      fallback: { providerId: 'provider', model: 'model' },
    })).toEqual({ changed: false, config: undefined })
  })

  it('preserves explicit none and other processors while stamping the schema', () => {
    for (const processor of ['none', 'future_processor']) {
      expect(migrateNan0CognitionConfig({
        config: { enabled: false, processor },
        legacyStatePresent: true,
        isActiveCard: true,
        fallback: { providerId: 'provider', model: 'model' },
      })).toEqual({
        changed: true,
        config: {
          schemaVersion: NAN0_COGNITION_SCHEMA_VERSION,
          enabled: false,
          processor,
        },
      })
    }
  })

  it('is idempotent after the current schema is persisted', () => {
    const config = {
      schemaVersion: NAN0_COGNITION_SCHEMA_VERSION,
      enabled: true,
      processor: NAN0_PROCESSOR_ID,
      provider: 'provider',
      model: 'model',
    } as const

    expect(migrateNan0CognitionConfig({
      config,
      legacyStatePresent: true,
      isActiveCard: true,
      fallback: { providerId: 'other', model: 'other' },
    })).toEqual({ changed: false, config })
  })
})
