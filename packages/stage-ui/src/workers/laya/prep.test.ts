import { describe, expect, it } from 'vitest'

import {
  decodeOpenJevAnswers,
  OPENJEV_INSUFFICIENT_EVIDENCE_DESC,
  OPENJEV_INSUFFICIENT_EVIDENCE_ID,
  OPENJEV_MAX_SUBSTANTIVE_CANDIDATES,
  prepareOpenJevItem,
} from './prep'

describe('openJev GLiClass prompt preparation and decoding', () => {
  it('formats choice questions with <<LABEL>> delimiters and appends abstention slot', () => {
    const q = {
      type: 'choice',
      instructions: 'Select category',
      criteria: ['literal', 'temporal', 'multihop', 'detective'],
    }
    const state = { scene: 'desktop', user_intent: 'greeting' }
    const item = prepareOpenJevItem(q, state)

    expect(item.qtype).toBe('choice')
    expect(item.ids).toEqual(['literal', 'temporal', 'multihop', 'detective', OPENJEV_INSUFFICIENT_EVIDENCE_ID])
    expect(item.labels).toEqual(['literal', 'temporal', 'multihop', 'detective', OPENJEV_INSUFFICIENT_EVIDENCE_DESC])
    expect(item.prompt).toContain('<<LABEL>>literal<<LABEL>>temporal<<LABEL>>multihop<<LABEL>>detective<<LABEL>>insufficient evidence<<SEP>>')
    expect(item.prompt).toContain('Question: Select category\n\nContext:\n')
    expect(item.prompt).toContain('"scene": "desktop"')
  })

  it('caps choice candidates to 24 substantive options + 1 abstention slot', () => {
    const criteria = Array.from({ length: 47 }, (_, i) => `option_${i}`)
    const q = {
      type: 'choice',
      instructions: 'Choose motion',
      criteria,
    }
    const item = prepareOpenJevItem(q, 'some context')

    expect(item.ids).toHaveLength(OPENJEV_MAX_SUBSTANTIVE_CANDIDATES + 1)
    expect(item.ids[OPENJEV_MAX_SUBSTANTIVE_CANDIDATES]).toBe(OPENJEV_INSUFFICIENT_EVIDENCE_ID)
    expect(item.ids[0]).toBe('option_0')
    expect(item.ids[23]).toBe('option_23')
  })

  it('formats score questions with level descriptions and value indices', () => {
    const q = {
      type: 'score',
      instructions: 'Rate valence',
      criteria: ['negative', 'neutral', 'warm', 'enthusiastic'],
      min: 0,
      max: 3,
    }
    const item = prepareOpenJevItem(q, 'context')

    expect(item.qtype).toBe('score')
    expect(item.ids).toEqual(['0', '1', '2', '3', OPENJEV_INSUFFICIENT_EVIDENCE_ID])
    expect(item.labels[0]).toBe('negative (Value: 0)')
    expect(item.labels[3]).toBe('enthusiastic (Value: 3)')
    expect(item.prompt).toContain('<<LABEL>>negative (Value: 0)')
    expect(item.prompt).toContain('<<LABEL>>insufficient evidence<<SEP>>')
  })

  it('formats noul questions with true/false propositions and abstention', () => {
    const q = {
      type: 'noul',
      instructions: 'Should companion initiate proactive dialogue?',
    }
    const item = prepareOpenJevItem(q, 'screen description')

    expect(item.qtype).toBe('noul')
    expect(item.ids).toEqual(['true', 'false', OPENJEV_INSUFFICIENT_EVIDENCE_ID])
    expect(item.labels[0]).toBe('true: Should companion initiate proactive dialogue?')
    expect(item.labels[1]).toBe('false: not Should companion initiate proactive dialogue?')
    expect(item.prompt).toContain('Evaluate proposition: Should companion initiate proactive dialogue?')
  })

  it('decodes choice logits accurately with temperature calibration', () => {
    const q = {
      type: 'choice',
      instructions: 'Select category',
      criteria: ['literal', 'temporal', 'multihop', 'detective'],
    }
    const prep = prepareOpenJevItem(q, 'context')
    // 25 classes output dim; logits give highest score to 'temporal' (index 1)
    const logits = new Float32Array(25)
    logits[0] = 0.5
    logits[1] = 4.2 // temporal
    logits[2] = 0.1
    logits[3] = 0.3
    logits[4] = -1.0 // abstention

    const answers = decodeOpenJevAnswers(logits, [prep], ['triage'])
    expect(answers.triage).toBeDefined()
    expect(answers.triage.type).toBe('choice')
    expect(answers.triage.choice).toBe('temporal')
    expect(answers.triage.probabilities.temporal).toBeGreaterThan(0.45)
    expect(answers.triage.confidence).toBeGreaterThan(0)
  })

  it('decodes score logits into expected value within bounds', () => {
    const q = {
      type: 'score',
      instructions: 'Rate valence',
      criteria: ['negative', 'neutral', 'warm', 'enthusiastic'],
      min: 0,
      max: 3,
    }
    const prep = prepareOpenJevItem(q, 'context')
    const logits = new Float32Array(25)
    logits[3] = 5.0 // enthusiastic (value 3)

    const answers = decodeOpenJevAnswers(logits, [prep], ['valence'])
    expect(answers.valence.type).toBe('score')
    expect(answers.valence.score).toBeGreaterThan(2.0)
  })
})
