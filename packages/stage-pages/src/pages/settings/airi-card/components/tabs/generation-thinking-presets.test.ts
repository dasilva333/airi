import { describe, expect, it } from 'vitest'

import {
  isThinkingPresetActive,
  THINKING_PRESETS,
  toggleThinkingPreset,
} from './generation-thinking-presets'

describe('generation thinking presets', () => {
  it('defines the three requested variant presets', () => {
    expect(THINKING_PRESETS).toHaveLength(3)
    expect(THINKING_PRESETS.map(p => p.label)).toEqual([
      'thinking.type:disabled',
      'variants.thinking.off',
      'reasoningEffort',
    ])
  })

  describe('isThinkingPresetActive', () => {
    it('returns false for empty or invalid input', () => {
      expect(isThinkingPresetActive('', THINKING_PRESETS[0].value)).toBe(false)
      expect(isThinkingPresetActive(undefined, THINKING_PRESETS[0].value)).toBe(false)
      expect(isThinkingPresetActive('{ invalid json', THINKING_PRESETS[0].value)).toBe(false)
      expect(isThinkingPresetActive('{}', THINKING_PRESETS[0].value)).toBe(false)
    })

    it('returns true when matching preset keys and values exist', () => {
      const json = JSON.stringify({ thinking: { type: 'disabled' } })
      expect(isThinkingPresetActive(json, THINKING_PRESETS[0].value)).toBe(true)
      expect(isThinkingPresetActive(json, THINKING_PRESETS[2].value)).toBe(false)
    })

    it('returns true even if additional custom keys are present', () => {
      const json = JSON.stringify({
        temperature: 0.7,
        thinking: { type: 'disabled' },
      })
      expect(isThinkingPresetActive(json, THINKING_PRESETS[0].value)).toBe(true)
    })
  })

  describe('toggleThinkingPreset', () => {
    it('applies preset to empty or default {} JSON', () => {
      const result = toggleThinkingPreset('{}', THINKING_PRESETS[0].value)
      expect(JSON.parse(result)).toEqual({ thinking: { type: 'disabled' } })

      const resultFromEmpty = toggleThinkingPreset('', THINKING_PRESETS[2].value)
      expect(JSON.parse(resultFromEmpty)).toEqual({ reasoningEffort: 'low' })
    })

    it('merges preset into existing JSON without losing other fields', () => {
      const existing = JSON.stringify({ top_k: 40 })
      const result = toggleThinkingPreset(existing, THINKING_PRESETS[2].value)
      expect(JSON.parse(result)).toEqual({
        top_k: 40,
        reasoningEffort: 'low',
      })
    })

    it('toggles off active preset key, leaving other keys intact', () => {
      const existing = JSON.stringify({
        top_k: 40,
        reasoningEffort: 'low',
      })
      const result = toggleThinkingPreset(existing, THINKING_PRESETS[2].value)
      expect(JSON.parse(result)).toEqual({
        top_k: 40,
      })
    })

    it('returns {} when toggling off the sole remaining preset key', () => {
      const existing = JSON.stringify({ reasoningEffort: 'low' })
      const result = toggleThinkingPreset(existing, THINKING_PRESETS[2].value)
      expect(result).toBe('{}')
    })

    it('applies the variants.thinking.off preset structure properly', () => {
      const result = toggleThinkingPreset('{}', THINKING_PRESETS[1].value)
      expect(JSON.parse(result)).toEqual({
        variants: {
          thinking: { reasoningEffort: 'high' },
          fast: { reasoningEffort: 'low' },
          off: { disabled: true },
        },
      })
    })
  })
})
