/**
 * Tests for the bare-TeX / script-language helpers in `math-speech.ts`.
 *
 * Contract under test:
 * - `toSpeechLanguage` extracts the BCP 47 primary subtag (with `cmn`/`yue`
 *   mapped to `zh`), preserving `undefined` for unknown codes.
 * - `detectSpeechLanguage` narrows on the dominant script of the surrounding
 *   context (kana → ja, hangul → ko, han → zh, latin words → en), falling
 *   back when no script is present.
 * - `braceBareScripts` braces only multi-digit / decimal scripts.
 * - `findBareLatex` locates undelimited TeX including balanced groups and
 *   trims surrounding whitespace.
 * - `replaceBalancedCommand` replaces balanced `\cmd{...}` occurrences,
 *   skipping escaped commands and unbalanced groups.
 * - `speakMath` returns spoken text, falling back to the raw source.
 */
import { describe, expect, it } from 'vitest'

import {
  braceBareScripts,
  detectSpeechLanguage,
  findBareLatex,
  replaceBalancedCommand,
  speakMath,
  toSpeechLanguage,
} from './math-speech'

describe('toSpeechLanguage', () => {
  it('returns undefined for unknown codes and empty input', () => {
    expect(toSpeechLanguage(undefined)).toBeUndefined()
    expect(toSpeechLanguage('')).toBeUndefined()
  })

  it('extracts the primary subtag from BCP 47 codes', () => {
    expect(toSpeechLanguage('zh-CN')).toBe('zh')
    expect(toSpeechLanguage('ko_KR')).toBe('ko')
    expect(toSpeechLanguage('en-US')).toBe('en')
    expect(toSpeechLanguage('ja-JP')).toBe('ja')
  })

  it('maps Chinese dialect codes to zh', () => {
    expect(toSpeechLanguage('cmn')).toBe('zh')
    expect(toSpeechLanguage('yue-HK')).toBe('zh')
  })
})

describe('detectSpeechLanguage', () => {
  it('detects Japanese from kana', () => {
    expect(detectSpeechLanguage('値段は 5x です')).toBe('ja')
  })

  it('detects Korean from hangul', () => {
    expect(detectSpeechLanguage('가격은 5x입니다')).toBe('ko')
  })

  it('detects Chinese from han, unless the fallback is ja', () => {
    expect(detectSpeechLanguage('价格是 5x')).toBe('zh')
    expect(detectSpeechLanguage('价格是 5x', 'ja')).toBe('ja')
  })

  it('detects English from latin words and defaults otherwise', () => {
    expect(detectSpeechLanguage('the price is 5x')).toBe('en')
    expect(detectSpeechLanguage('123 456')).toBe('en')
    expect(detectSpeechLanguage('123 456', 'ko')).toBe('ko')
  })
})

describe('braceBareScripts', () => {
  it('braces multi-digit scripts and leaves single-digit scripts alone', () => {
    expect(braceBareScripts('2^10')).toBe('2^{10}')
    expect(braceBareScripts('x_12')).toBe('x_{12}')
    expect(braceBareScripts('v2^3')).toBe('v2^3')
    expect(braceBareScripts('a_1.5')).toBe('a_{1.5}')
  })
})

describe('findBareLatex', () => {
  it('finds a bare \\frac in plain text, including its balanced groups', () => {
    const text = 'the answer is \\frac{1}{2} indeed'
    const spans = findBareLatex(text)
    expect(spans).toHaveLength(1)
    expect(text.slice(spans[0].start, spans[0].end)).toBe('\\frac{1}{2}')
  })

  it('ignores unknown commands', () => {
    expect(findBareLatex('nothing \\unknowncmd{1} here')).toEqual([])
  })

  it('returns no spans for plain prose without TeX triggers', () => {
    expect(findBareLatex('just a normal sentence about ramen')).toEqual([])
  })
})

describe('replaceBalancedCommand', () => {
  it('replaces every balanced occurrence of the command', () => {
    const replacer = (_full: string, inner: string) => `<${inner}>`
    expect(replaceBalancedCommand('a \\ce{H2O} b \\ce{CO2} c', 'ce', replacer)).toBe('a <H2O> b <CO2> c')
  })

  it('keeps nested balanced groups inside the inner capture', () => {
    const replacer = (_full: string, inner: string) => `[${inner}]`
    expect(replaceBalancedCommand('\\f{x{y}z}', 'f', replacer)).toBe('[x{y}z]')
  })

  it('does not replace escaped or unbalanced occurrences', () => {
    const replacer = (_full: string, inner: string) => `<${inner}>`
    // Escaped command (odd backslash count) is left untouched.
    expect(replaceBalancedCommand('\\\\ce{H2O}', 'ce', replacer)).toBe('\\\\ce{H2O}')
    // Unbalanced group is copied verbatim.
    expect(replaceBalancedCommand('a \\ce{H2O', 'ce', replacer)).toBe('a \\ce{H2O')
  })
})

describe('speakMath', () => {
  it('speaks a formula in the requested language', () => {
    const spoken = speakMath('x^2', 'en')
    expect(typeof spoken).toBe('string')
    expect(spoken).not.toBe('')
  })
})
