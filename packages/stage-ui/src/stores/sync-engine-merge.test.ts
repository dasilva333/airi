import assert from 'node:assert/strict'

import { describe, it } from 'vitest'

import { mergeByIdLww, mergeChatSessions, mergeVoiceProfiles } from './sync-engine-merge'

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

describe('mergeChatSessions', () => {
  it('merges object-shaped sessions on messages with last-writer-wins', () => {
    const local = {
      id: 's1',
      meta: { characterId: 'sylvia' },
      messages: [
        { id: 'm1', content: 'old', updatedAt: 1000 },
        { id: 'm2', content: 'local-only', updatedAt: 500 },
      ],
    }
    const remote = {
      id: 's1',
      meta: { characterId: 'bronya' },
      messages: [
        { id: 'm1', content: 'new', updatedAt: 2000 },
      ],
    }

    const merged = mergeChatSessions(local, remote)
    assert.equal(merged.messages.length, 2)
    assert.equal(merged.messages.find((m: any) => m.id === 'm1').content, 'new')
    assert.equal(merged.messages.find((m: any) => m.id === 'm2').content, 'local-only')
    assert.equal(merged.meta.characterId, 'bronya') // remote spread wins for scalar fields
    assert.equal(typeof merged.updatedAt, 'number')
  })

  it('merges legacy array-shaped sessions by message id', () => {
    const merged = mergeChatSessions(
      [{ id: 'm1', updatedAt: 1000 }],
      [{ id: 'm1', updatedAt: 2000, content: 'remote' }, { id: 'm2', updatedAt: 500 }],
    )
    assert.ok(Array.isArray(merged))
    assert.equal(merged.length, 2)
    assert.equal(merged.find((m: any) => m.id === 'm1').content, 'remote')
  })

  it('falls back to whichever payload exists', () => {
    const remote = { id: 's1', messages: [] }
    assert.equal(mergeChatSessions(null, remote), remote)
    assert.equal(mergeChatSessions(undefined, remote), remote)
    const local = [{ id: 'm1', updatedAt: 1 }]
    assert.deepEqual(mergeChatSessions(local, null), [{ id: 'm1', updatedAt: 1 }])
  })

  it('keeps distinct messages from both sides of a conflict', () => {
    const local = { id: 's1', messages: [{ id: 'a', content: 'a', updatedAt: 100 }] }
    const remote = { id: 's1', messages: [{ id: 'b', content: 'b', updatedAt: 200 }] }
    const merged = mergeChatSessions(local, remote)
    assert.deepEqual(merged.messages.map((m: any) => m.id).sort(), ['a', 'b'])
  })

  it('drops a tombstoned remote-only message id and keeps a non-tombstoned one', () => {
    const local = { id: 's1', updatedAt: 1000, messages: [{ id: 'a', content: 'a', updatedAt: 100 }] }
    const remote = { id: 's1', updatedAt: 5000, messages: [{ id: 'b', content: 'deleted', updatedAt: 200 }, { id: 'c', content: 'keep', updatedAt: 300 }] }
    const merged = mergeChatSessions(local, remote, new Set(['b']))
    assert.deepEqual(merged.messages.map((m: any) => m.id).sort(), ['a', 'c'])
  })

  it('merged updatedAt is the max of both sides, not wall-clock now', () => {
    const local = { id: 's1', updatedAt: 1000, messages: [] }
    const remote = { id: 's1', updatedAt: 9000, messages: [] }
    const merged = mergeChatSessions(local, remote)
    assert.equal(merged.updatedAt, 9000)
  })
})

describe('mergeByIdLww', () => {
  it('drops tombstoned ids that only exist remotely and never re-adds them', () => {
    const local = [{ id: 'x', updatedAt: 1000 }]
    const remote = [{ id: 'x', updatedAt: 1000 }, { id: 'y', updatedAt: 2000 }]
    const merged = mergeByIdLww(local, remote, new Set(['y']))
    assert.deepEqual(merged.map(m => m.id), ['x'])
  })

  it('drops a tombstoned id even when present locally', () => {
    const merged = mergeByIdLww([{ id: 'x', updatedAt: 1000 }], [], new Set(['x']))
    assert.deepEqual(merged, [])
  })

  it('passes a non-tombstoned remote-only id through', () => {
    const merged = mergeByIdLww([{ id: 'x', updatedAt: 1000 }], [{ id: 'y', updatedAt: 2000 }], new Set(['unrelated']))
    assert.deepEqual(merged.map(m => m.id).sort(), ['x', 'y'])
  })

  it('keeps last-writer-wins for ids present on both sides', () => {
    const merged = mergeByIdLww([{ id: 'x', v: 'local', updatedAt: 1000 }], [{ id: 'x', v: 'remote', updatedAt: 2000 }])
    assert.equal(merged[0].v, 'remote')
  })
})
