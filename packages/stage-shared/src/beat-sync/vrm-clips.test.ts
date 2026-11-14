import { describe, expect, it } from 'vitest'

import { selectBeatSyncVrmClipForEnergy } from './vrm-clips'

describe('selectBeatSyncVrmClipForEnergy', () => {
  it('picks from requested tier and avoids repeating the current clip', () => {
    const clipsByTier = {
      calm: ['calm-1'],
      medium: ['med-1', 'med-2'],
      intense: ['hi-1'],
    }
    const result = selectBeatSyncVrmClipForEnergy({
      tier: 'medium',
      clipsByTier,
      currentClipKey: 'med-1',
      random: () => 0,
    })
    expect(result).toEqual({
      clipKey: 'med-2',
      resolvedTier: 'medium',
    })
  })

  it('falls back to nearest populated tier when requested tier is empty', () => {
    const clipsByTier = {
      calm: ['calm-1'],
      medium: [],
      intense: ['hi-1'],
    }
    expect(selectBeatSyncVrmClipForEnergy({
      tier: 'medium',
      clipsByTier,
      random: () => 0,
    })).toEqual({
      clipKey: 'calm-1',
      resolvedTier: 'calm',
    })

    expect(selectBeatSyncVrmClipForEnergy({
      tier: 'intense',
      clipsByTier: { calm: ['calm-1'], medium: [], intense: [] },
      random: () => 0,
    })).toEqual({
      clipKey: 'calm-1',
      resolvedTier: 'calm',
    })
  })

  it('returns null when all tiers are empty', () => {
    expect(selectBeatSyncVrmClipForEnergy({
      tier: 'calm',
      clipsByTier: { calm: [], medium: [], intense: [] },
    })).toEqual({
      clipKey: null,
      resolvedTier: null,
    })
  })
})
