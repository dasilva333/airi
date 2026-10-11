import { describe, expect, it } from 'vitest'

import { appendDraftText } from './composer-draft-bridge'

describe('appendDraftText', () => {
  it('uses the text as the draft when the draft is empty', () => {
    expect(appendDraftText('', ' hello ')).toBe('hello')
  })

  it('appends with a single space', () => {
    expect(appendDraftText('first phrase  ', 'second phrase')).toBe('first phrase second phrase')
  })

  it('ignores blank text', () => {
    expect(appendDraftText('keep me', '   ')).toBe('keep me')
  })
})
