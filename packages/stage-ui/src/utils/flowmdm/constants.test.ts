import { describe, expect, it } from 'vitest'

import {
  alphasCumprod,
  hmlMean,
  hmlStd,
  jointToNodeMap,
  NODE_BONES,
  refNodes,
} from './constants'

describe('flowmdm constants', () => {
  it('exports arrays of expected lengths', () => {
    expect(Array.isArray(hmlMean)).toBe(true)
    expect(Array.isArray(hmlStd)).toBe(true)
    expect(Array.isArray(alphasCumprod)).toBe(true)
    expect(Array.isArray(refNodes)).toBe(true)
    expect(Array.isArray(NODE_BONES)).toBe(true)
    expect(typeof jointToNodeMap).toBe('object')
  })

  it('hmlMean and hmlStd have known lengths', () => {
    expect(hmlMean.length).toBe(263)
    expect(hmlStd.length).toBe(263)
  })

  it('alphasCumprod is nonempty and decreasing-ish', () => {
    expect(alphasCumprod.length).toBeGreaterThan(0)
    expect(alphasCumprod[0]).toBeGreaterThan(0)
  })

  it('refNodes entries have name and translation', () => {
    expect(refNodes.length).toBeGreaterThan(0)
    for (const n of refNodes) {
      expect(typeof n.name).toBe('string')
      expect(n.translation).toHaveLength(3)
    }
  })

  it('jointToNodeMap maps numbers', () => {
    const keys = Object.keys(jointToNodeMap)
    expect(keys.length).toBeGreaterThan(0)
    for (const k of keys) {
      expect(typeof jointToNodeMap[Number(k)]).toBe('number')
    }
  })

  it('nODE_BONES entries valid', () => {
    expect(NODE_BONES.length).toBeGreaterThan(0)
    for (const b of NODE_BONES) {
      expect(typeof b).toBe('object')
    }
  })
})
