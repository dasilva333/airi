import { describe, expect, it } from 'vitest'

import { textureIdentitiesMatch, textureKeyForIdentity } from './texture-identity'

describe('hacker-studio: texture identity characterization', () => {
  it('uses the glTF image index as the primary key', () => {
    expect(textureKeyForIdentity({ index: 3, fingerprint: 'abc' })).toBe(3)
  })

  it('falls back to the stable fingerprint when there is no index', () => {
    expect(textureKeyForIdentity({ index: null, fingerprint: 'abc' })).toBe('abc')
    expect(textureKeyForIdentity({ index: null, fingerprint: null })).toBeNull()
  })

  it('matches by image index when both sides have one', () => {
    expect(textureIdentitiesMatch(
      { index: 3, fingerprint: 'left' },
      { index: 3, fingerprint: 'right' },
    )).toBe(true)
  })

  it('does not match different indices even if fingerprints align', () => {
    expect(textureIdentitiesMatch(
      { index: 2, fingerprint: 'same' },
      { index: 3, fingerprint: 'same' },
    )).toBe(false)
  })

  it('falls back to fingerprint matching when one index is unknown', () => {
    expect(textureIdentitiesMatch(
      { index: null, fingerprint: 'same' },
      { index: 3, fingerprint: 'same' },
    )).toBe(true)
    expect(textureIdentitiesMatch(
      { index: 3, fingerprint: 'same' },
      { index: null, fingerprint: 'same' },
    )).toBe(true)
  })

  it('refuses to match when the target fingerprint is empty', () => {
    expect(textureIdentitiesMatch(
      { index: null, fingerprint: null },
      { index: null, fingerprint: null },
    )).toBe(false)
  })
})
