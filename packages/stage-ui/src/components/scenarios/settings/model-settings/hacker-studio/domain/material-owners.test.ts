import { describe, expect, it } from 'vitest'

import { prettyMaterialName, uniqueOwnerNames } from './material-owners'

describe('hacker-studio: material owner labeling characterization', () => {
  it('removes the VRM Instance suffix', () => {
    expect(prettyMaterialName('N00_000_00_Body_00_SKIN (Instance)')).toBe('Body_00_SKIN')
  })

  it('marks outline materials', () => {
    // Characterization: the Instance pass runs before the Outline pass, so the
    // suffix is retained in the current label output.
    expect(prettyMaterialName('N00_000_00_Body_00_SKIN (Instance) (Outline)')).toBe('Body_00_SKIN (Instance) outline')
  })

  it('strips the VRoid numeric prefix', () => {
    expect(prettyMaterialName('N00_001_02_Bottoms_01_CLOTH (Instance)')).toBe('Bottoms_01_CLOTH')
  })

  it('deduplicates owners while preserving first-seen order', () => {
    expect(uniqueOwnerNames([
      'Body (Instance)',
      'Hair (Instance)',
      'Body',
      'Hair (Instance) (Outline)',
    ])).toEqual(['Body', 'Hair', 'Hair (Instance) outline'])
  })

  it('ignores empty strings but preserves whitespace-only labels (current behavior)', () => {
    expect(uniqueOwnerNames(['', '  '])).toEqual(['  '])
  })
})
