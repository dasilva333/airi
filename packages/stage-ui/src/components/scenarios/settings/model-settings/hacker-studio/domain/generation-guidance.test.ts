import { describe, expect, it } from 'vitest'

import { UV_GUIDANCE, withUvGuidance } from './generation-guidance'

describe('hacker-studio: generation guidance characterization', () => {
  it('returns an empty prompt unchanged', () => {
    expect(withUvGuidance('')).toBe('')
    expect(withUvGuidance('   ')).toBe('')
  })

  it('appends guidance once at request time', () => {
    expect(withUvGuidance('Midnight navy fabric')).toBe(`Midnight navy fabric\n\n${UV_GUIDANCE}`)
  })

  it('does not mutate the caller-provided prompt', () => {
    const prompt = 'Midnight navy fabric'
    withUvGuidance(prompt)
    expect(prompt).toBe('Midnight navy fabric')
  })

  it('does not append when UV-layout guidance is already present', () => {
    const prompt = 'Keep the UV layout intact'
    expect(withUvGuidance(prompt)).toBe(prompt)
  })

  it('recognizes seams and transparent-areas guidance variants', () => {
    expect(withUvGuidance('Preserve seams')).toBe('Preserve seams')
    expect(withUvGuidance('Keep TRANSPARENT AREAS')).toBe('Keep TRANSPARENT AREAS')
  })
})
