import type { VarFloat, VarFloatMutation } from '../src/dsl/types'

import { describe, expect, it } from 'vitest'

import { ReactiveVarStore } from '../src/dsl/var-store'

describe('reactiveVarStore — Type 1 guards (operator superset)', () => {
  const ops: Array<[string, number, number, boolean]> = [
    // [code op, current, target, expected]
    ['equal', 5, 5, true],
    ['equal', 5, 4, false],
    ['not_equal', 5, 4, true],
    ['not_equal', 5, 5, false],
    ['greater', 6, 5, true],
    ['greater', 5, 5, false],
    ['greater_equal', 5, 5, true],
    ['greater_equal', 4, 5, false],
    ['less', 4, 5, true],
    ['less', 5, 5, false],
    ['lower', 4, 5, true],
    ['lower', 5, 5, false],
    ['lower_equal', 0, 0, true],
    ['lower_equal', 1, 0, false],
  ]

  for (const [op, current, target, expected] of ops) {
    it(`${op}: ${current} vs ${target} -> ${expected}`, () => {
      const store = new ReactiveVarStore()
      store.set('x', current)
      expect(store.evaluateCondition({ Name: 'x', Type: 1, Code: `${op} ${target}` })).toBe(expected)
    })
  }

  it('reads absent variables as 0 (manifest convention)', () => {
    const store = new ReactiveVarStore()
    expect(store.get('NeverSet')).toBe(0)
    expect(store.evaluateCondition({ Name: 'NeverSet', Type: 1, Code: 'equal 0' })).toBe(true)
  })
})

describe('reactiveVarStore — Type 2 mutations', () => {
  it('assign sets a literal', () => {
    const s = new ReactiveVarStore()
    s.executeMutation({ Name: 'act', Type: 2, Code: 'assign 1' })
    expect(s.get('act')).toBe(1)
  })

  it('assign rand() is inclusive of both bounds and floors', () => {
    // Force RNG to extremes.
    expect(new ReactiveVarStore(() => 0).randInt(20, 25)).toBe(20)
    expect(new ReactiveVarStore(() => 0.999999).randInt(20, 25)).toBe(25)
    const mid = new ReactiveVarStore(() => 0.5).randInt(0, 10)
    expect(mid).toBe(5)
  })

  it('assign rand(20,25) via Code string stays within [20,25] across many rolls', () => {
    const s = new ReactiveVarStore()
    for (let i = 0; i < 500; i++) {
      s.executeMutation({ Name: 'ChatTimer', Type: 2, Code: 'assign rand(20,25)' })
      const v = s.get('ChatTimer')
      expect(v).toBeGreaterThanOrEqual(20)
      expect(v).toBeLessThanOrEqual(25)
      expect(Number.isInteger(v)).toBe(true)
    }
  })

  it('add / subtract apply deltas from current', () => {
    const s = new ReactiveVarStore()
    s.set('Affinity', 10)
    s.executeMutation({ Name: 'Affinity', Type: 2, Code: 'add 15' })
    expect(s.get('Affinity')).toBe(25)
    s.executeMutation({ Name: 'Affinity', Type: 2, Code: 'subtract 0.5' })
    expect(s.get('Affinity')).toBe(24.5)
  })

  it('init sets only-if-absent (flag heap idiom) and preserves existing values', () => {
    const s = new ReactiveVarStore()
    s.executeMutation({ Name: 'OpenChat', Type: 2, Code: 'init 1' })
    expect(s.get('OpenChat')).toBe(1)
    // Second init must NOT overwrite the toggled value.
    s.executeMutation({ Name: 'OpenChat', Type: 2, Code: 'assign 0' })
    s.executeMutation({ Name: 'OpenChat', Type: 2, Code: 'init 1' })
    expect(s.get('OpenChat')).toBe(0)
  })

  it('rejects malformed codes without throwing (no-op, returns false)', () => {
    const s = new ReactiveVarStore()
    expect(s.executeMutation({ Name: 'x', Type: 2, Code: 'assign notanumber' })).toBe(false)
    const bogus = { Name: 'x', Type: 2, Code: 'frobnicate 3' } as VarFloatMutation
    expect(s.executeMutation(bogus)).toBe(false)
  })
})

describe('reactiveVarStore — atomic guard→mutate entries', () => {
  it('toggle idiom applies mutation only when guard passes (OpenChat OFF->ON)', () => {
    const s = new ReactiveVarStore()
    s.set('OpenChat', 0)
    const ok = s.applyAll([
      { Name: 'OpenChat', Type: 1, Code: 'not_equal 1' },
      { Name: 'OpenChat', Type: 2, Code: 'assign 1' },
    ])
    expect(ok).toBe(true)
    expect(s.get('OpenChat')).toBe(1)
  })

  it('toggle idiom rejects entry when guard fails (already ON: ON-variant must not run)', () => {
    const s = new ReactiveVarStore()
    s.set('OpenChat', 1) // already on
    const ok = s.applyAll([
      { Name: 'OpenChat', Type: 1, Code: 'not_equal 1' },
      { Name: 'OpenChat', Type: 2, Code: 'assign 1' },
    ])
    expect(ok).toBe(false)
    expect(s.get('OpenChat')).toBe(1) // unchanged
  })

  it('is atomic: guards all pass before any mutation; failing guard blocks ALL mutations', () => {
    const s = new ReactiveVarStore()
    s.set('DoubleClickTimer', 0)
    // Mirrors Update1#98: guard says timer must be > 0; then subtract + reset debug.
    const ok = s.applyAll([
      { Name: 'DoubleClickTimer', Type: 1, Code: 'greater 0' },
      { Name: 'DoubleClickTimer', Type: 2, Code: 'subtract 1' },
      { Name: 'InDebug', Type: 2, Code: 'assign 0' },
    ])
    expect(ok).toBe(false)
    expect(s.get('DoubleClickTimer')).toBe(0)
    expect(s.get('InDebug')).toBe(0) // init-required var not written
  })

  it('promise animation toggle (model live2d_2883004043 guard pair) flips var 1<->0 correctly', () => {
    const s = new ReactiveVarStore()
    // Group A entry: var equal 1 -> assign 0
    // Group B entry: var equal 0 -> assign 1
    const A: VarFloat[] = [
      { Name: 'var', Type: 1, Code: 'equal 1' },
      { Name: 'var', Type: 2, Code: 'assign 0' },
    ]
    const B: VarFloat[] = [
      { Name: 'var', Type: 1, Code: 'equal 0' },
      { Name: 'var', Type: 2, Code: 'assign 1' },
    ]
    expect(s.applyAll(A)).toBe(false) // var=0 initially, guard fails
    expect(s.applyAll(B)).toBe(true)
    expect(s.get('var')).toBe(1)
    expect(s.applyAll(A)).toBe(true)
    expect(s.get('var')).toBe(0)
    expect(s.applyAll(B)).toBe(true)
    expect(s.get('var')).toBe(1)
  })

  it('dateFlag bitmask accumulation across festival toggles (Valentine on/off)', () => {
    const s = new ReactiveVarStore()
    s.applyAll([
      { Name: 'InValentine', Type: 1, Code: 'not_equal 1' },
      { Name: 'InValentine', Type: 2, Code: 'assign 1' },
      { Name: 'DateFlag', Type: 2, Code: 'add 4' },
    ])
    expect(s.get('InValentine')).toBe(1)
    expect(s.get('DateFlag')).toBe(4)

    // Guard now fails (already on), so DateFlag must NOT be incremented again.
    expect(s.applyAll([
      { Name: 'InValentine', Type: 1, Code: 'not_equal 1' },
      { Name: 'InValentine', Type: 2, Code: 'assign 1' },
      { Name: 'DateFlag', Type: 2, Code: 'add 4' },
    ])).toBe(false)
    expect(s.get('DateFlag')).toBe(4)

    // Turn off path.
    expect(s.applyAll([
      { Name: 'InValentine', Type: 1, Code: 'not_equal 0' },
      { Name: 'InValentine', Type: 2, Code: 'assign 0' },
      { Name: 'DateFlag', Type: 2, Code: 'subtract 4' },
    ])).toBe(true)
    expect(s.get('DateFlag')).toBe(0)
  })
})
