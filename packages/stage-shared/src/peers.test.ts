import { describe, expect, it } from 'vitest'

import { extractHandleAlias, isCompanionAllowedForFriend, MAX_TAGLINE_LENGTH, resolveAmbassadorTagline, resolveEmbassyCompanionId, sanitizeTaglineMessage } from './peers'

describe('extractHandleAlias', () => {
  it('extracts subdomain from 4-part workers.dev handles', () => {
    expect(extractHandleAlias('airi-stage-edge.richard-pinedo.workers.dev')).toBe('richard-pinedo')
    expect(extractHandleAlias('https://airi-stage-edge.r1ch4rd.workers.dev/ws')).toBe('r1ch4rd')
    expect(extractHandleAlias('airi-cors-proxy.my-user.workers.dev')).toBe('my-user')
  })

  it('handles airi- prefix domains', () => {
    expect(extractHandleAlias('airi-embassy.alice.io')).toBe('alice')
    expect(extractHandleAlias('stage-edge.bob.net')).toBe('bob')
  })

  it('falls back cleanly for custom domains or single handles', () => {
    expect(extractHandleAlias('richy.workers.dev')).toBe('richy')
    expect(extractHandleAlias('companion.local')).toBe('companion')
    expect(extractHandleAlias('')).toBe('')
    expect(extractHandleAlias(undefined)).toBe('')
  })
})

describe('isCompanionAllowedForFriend', () => {
  const baseFriend: any = {
    id: 'f1',
    relationship: 'external-friend',
    trustState: 'trusted',
    allowedCapabilities: { canNapChat: true },
    allowedCompanionIds: [],
  }

  it('allows all companions when allowedCompanionIds is empty', () => {
    expect(isCompanionAllowedForFriend(baseFriend, 'card-1')).toBe(true)
    expect(isCompanionAllowedForFriend(baseFriend, 'card-2')).toBe(true)
  })

  it('restricts to allowlisted companions when specified', () => {
    const restricted = { ...baseFriend, allowedCompanionIds: ['card-1', 'card-3'] }
    expect(isCompanionAllowedForFriend(restricted, 'card-1')).toBe(true)
    expect(isCompanionAllowedForFriend(restricted, 'card-2')).toBe(false)
    expect(isCompanionAllowedForFriend(restricted, 'card-3')).toBe(true)
  })
})

describe('sanitizeTaglineMessage', () => {
  it('strips markup and caps length', () => {
    expect(sanitizeTaglineMessage('  <b>Quiet</b> companion  ')).toBe('Quiet companion')
    expect(sanitizeTaglineMessage('x'.repeat(200))).toHaveLength(MAX_TAGLINE_LENGTH)
    expect(sanitizeTaglineMessage(null)).toBe('')
    expect(sanitizeTaglineMessage(undefined)).toBe('')
  })
})

describe('resolveEmbassyCompanionId', () => {
  const ids = ['card-a', 'card-b']
  it('prefers an override that names a known companion', () => {
    expect(resolveEmbassyCompanionId(ids, 'card-a', 'card-b')).toBe('card-b')
  })
  it('ignores unknown overrides and falls back to the active card', () => {
    expect(resolveEmbassyCompanionId(ids, 'card-a', 'nope')).toBe('card-a')
  })
  it('falls back to the first companion, then to airi', () => {
    expect(resolveEmbassyCompanionId(ids, undefined, '')).toBe('card-a')
    expect(resolveEmbassyCompanionId([], undefined, '')).toBe('airi')
  })
})

describe('resolveAmbassadorTagline', () => {
  it('prefers the explicit tagline', () => {
    expect(resolveAmbassadorTagline({ tagline: '  Quiet conversations  ', greetings: ['Hello!'] })).toBe('Quiet conversations')
  })

  it('falls back to the first non-blank greeting', () => {
    expect(resolveAmbassadorTagline({ tagline: '  ', greetings: ['  ', 'Hey there!'] })).toBe('Hey there!')
    expect(resolveAmbassadorTagline({ greetings: ['Hey!'] })).toBe('Hey!')
  })

  it('returns blank when nothing is set', () => {
    expect(resolveAmbassadorTagline({ tagline: null, greetings: [] })).toBe('')
    expect(resolveAmbassadorTagline(null)).toBe('')
    expect(resolveAmbassadorTagline(undefined)).toBe('')
  })
})
