import { describe, expect, it } from 'vitest'

import { processNarrative } from './tts-chunker'

describe('processNarrative', () => {
  it('should not strip narrative if stripNarrative is false', () => {
    const text = 'Hello [laughs] world'
    expect(processNarrative(text, { stripNarrative: false })).toBe(text)
    expect(processNarrative(text, {})).toBe(text)
  })

  it('should strip narrative if stripNarrative is true', () => {
    const text = 'Hello [laughs] world'
    expect(processNarrative(text, { stripNarrative: true })).toBe('Hello  world')
  })

  it('should keep narrative text if keepNarrativeText is true', () => {
    const text = 'Hello [laughs] world'
    expect(processNarrative(text, { keepNarrativeText: true, stripNarrative: true })).toBe('Hello laughs world')
  })

  it('should handle multiple brackets and types', () => {
    const text = 'Hi *waves* [smiling] (quietly)'
    expect(processNarrative(text, { keepNarrativeText: false, stripNarrative: true })).toBe('Hi   ')
    expect(processNarrative(text, { keepNarrativeText: true, stripNarrative: true })).toBe('Hi waves smiling quietly')
  })

  it('should handle CJK brackets', () => {
    const text = 'こんにちは（笑）【重要】'
    expect(processNarrative(text, { keepNarrativeText: false, stripNarrative: true })).toBe('こんにちは')
    expect(processNarrative(text, { keepNarrativeText: true, stripNarrative: true })).toBe('こんにちは笑重要')
  })

  it('should handle mixed bracket types with keepNarrativeText', () => {
    const text = 'Start <hidden> [box] (round) *star* End'
    expect(processNarrative(text, { keepNarrativeText: true, stripNarrative: true })).toBe(
      'Start hidden box round star End',
    )
  })
})
