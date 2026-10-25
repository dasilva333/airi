import { describe, expect, it } from 'vitest'

import { linearizeRgba, SRGB_LINEAR_LUT, srgbToLinearByte } from './preview-gamma'

describe('hacker-studio: preview gamma characterization', () => {
  it('builds a 256-entry sRGB linearization table', () => {
    expect(SRGB_LINEAR_LUT).toHaveLength(256)
    expect(SRGB_LINEAR_LUT[0]).toBe(0)
    expect(SRGB_LINEAR_LUT[255]).toBe(255)
  })

  it('maps midtones to their linear equivalents', () => {
    expect(srgbToLinearByte(128)).toBe(55)
    expect(srgbToLinearByte(64)).toBe(13)
  })

  it('is monotonic', () => {
    for (let i = 1; i < SRGB_LINEAR_LUT.length; i++)
      expect(SRGB_LINEAR_LUT[i]).toBeGreaterThanOrEqual(SRGB_LINEAR_LUT[i - 1])
  })

  it('linearizes RGB while preserving alpha', () => {
    const data = new Uint8ClampedArray([
      255,
      128,
      0,
      128,
      64,
      255,
      128,
      255,
    ])
    linearizeRgba(data)
    expect([...data]).toEqual([
      255,
      55,
      0,
      128,
      13,
      255,
      55,
      255,
    ])
  })
})
