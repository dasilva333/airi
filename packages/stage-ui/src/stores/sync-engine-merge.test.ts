import assert from 'node:assert/strict'

import { describe, it } from 'vitest'

import { mergeVoiceProfiles } from './sync-engine-merge'

describe('mergeVoiceProfiles', () => {
  it('merges distinct voice profiles from local and remote without losing any', () => {
    const local = {
      value: JSON.stringify([
        { id: 'voice_profile_Butter_auto', name: 'Butter', baseProvider: 'custom', createdAt: 1000 },
      ]),
      originalKey: 'settings/speech/voice-profiles',
    }

    const remote = {
      value: JSON.stringify([
        { id: 'voice_profile_Kommy_auto', name: 'Kommy', baseProvider: 'custom', createdAt: 2000 },
      ]),
      originalKey: 'settings/speech/voice-profiles',
    }

    const result = mergeVoiceProfiles(local, remote)
    assert.equal(result.originalKey, 'settings/speech/voice-profiles')

    const mergedList = JSON.parse(result.value)
    assert.equal(mergedList.length, 2)
    assert.ok(mergedList.some((p: any) => p.id === 'voice_profile_Butter_auto'))
    assert.ok(mergedList.some((p: any) => p.id === 'voice_profile_Kommy_auto'))
  })

  it('updates profile using last-writer-wins on updatedAt/createdAt for matching IDs', () => {
    const local = {
      value: JSON.stringify([
        { id: 'voice_profile_Kommy_auto', name: 'Kommy Old', updatedAt: 1000 },
      ]),
      originalKey: 'settings/speech/voice-profiles',
    }

    const remote = {
      value: JSON.stringify([
        { id: 'voice_profile_Kommy_auto', name: 'Kommy Updated', updatedAt: 5000 },
      ]),
      originalKey: 'settings/speech/voice-profiles',
    }

    const result = mergeVoiceProfiles(local, remote)
    const mergedList = JSON.parse(result.value)
    assert.equal(mergedList.length, 1)
    assert.equal(mergedList[0].name, 'Kommy Updated')
    assert.equal(mergedList[0].updatedAt, 5000)
  })

  it('handles null or empty local/remote gracefully', () => {
    const remote = {
      value: JSON.stringify([
        { id: 'voice_profile_Kommy_auto', name: 'Kommy' },
      ]),
      originalKey: 'settings/speech/voice-profiles',
    }

    assert.deepEqual(mergeVoiceProfiles(null, remote), remote)
    assert.deepEqual(mergeVoiceProfiles(undefined, remote), remote)
    assert.deepEqual(mergeVoiceProfiles(remote, null), remote)
  })
})
