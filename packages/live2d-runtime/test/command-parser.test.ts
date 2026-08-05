import { describe, expect, it } from 'vitest'

import { parseCommandChain, parseMotionRef } from '../src/dsl/command-parser'

describe('parseMotionRef — Group[#lane][:item] grammar', () => {
  it('plain group', () => {
    expect(parseMotionRef('B40')).toEqual({ group: 'B40', lane: undefined, item: undefined, raw: 'B40' })
  })

  it('group with lane hint (Sound#1)', () => {
    expect(parseMotionRef('Sound#1')).toEqual({ group: 'Sound', lane: 1, item: undefined, raw: 'Sound#1' })
  })

  it('group with lane and item (Sound#1:011501_051_01_01)', () => {
    expect(parseMotionRef('Sound#1:011501_051_01_01')).toEqual({
      group: 'Sound',
      lane: 1,
      item: '011501_051_01_01',
      raw: 'Sound#1:011501_051_01_01',
    })
  })

  it('group with item but no lane (Next:011501_002_05_02)', () => {
    expect(parseMotionRef('Next:011501_002_05_02')).toEqual({
      group: 'Next',
      lane: undefined,
      item: '011501_002_05_02',
      raw: 'Next:011501_002_05_02',
    })
  })

  it('high lane numbers are parsed (RepairTimer#99)', () => {
    expect(parseMotionRef('RepairTimer#99')).toEqual({ group: 'RepairTimer', lane: 99, item: undefined, raw: 'RepairTimer#99' })
  })

  it('item with lane and Chinese name (送礼#99:香水)', () => {
    expect(parseMotionRef('送礼#99:香水')).toEqual({
      group: '送礼',
      lane: 99,
      item: '香水',
      raw: '送礼#99:香水',
    })
  })

  it('non-numeric # suffix is kept in group, lane undefined', () => {
    // Defensive: a '#' that is not followed by digits should not produce a NaN lane.
    const ref = parseMotionRef('Face#abc:07')
    expect(ref.group).toBe('Face')
    expect(ref.lane).toBeUndefined()
    expect(ref.item).toBe('07')
  })
})

describe('parseCommandChain — verbs', () => {
  it('parses the Flandre Start chain into parallel lanes', () => {
    // docs 2262182171 Start Entry 0
    const cmds = parseCommandChain('start_mtn B10;start_mtn Sound#1:011501_051_01_01;start_mtn Face#2:07;clear_exp')
    expect(cmds).toHaveLength(4)
    expect(cmds[0]).toMatchObject({ kind: 'start_mtn', target: { group: 'B10', lane: undefined, item: undefined } })
    expect(cmds[1]).toMatchObject({ kind: 'start_mtn', target: { group: 'Sound', lane: 1, item: '011501_051_01_01' } })
    expect(cmds[2]).toMatchObject({ kind: 'start_mtn', target: { group: 'Face', lane: 2, item: '07' } })
    expect(cmds[3]).toMatchObject({ kind: 'clear_exp' })
  })

  it('clear_exp is order-preserved mid-chain', () => {
    const cmds = parseCommandChain('clear_exp;start_mtn Face#2:01')
    expect(cmds.map(c => c.kind)).toEqual(['clear_exp', 'start_mtn'])
  })

  it('change_cos carries the model file', () => {
    const cmds = parseCommandChain('change_cos model1.json')
    expect(cmds).toEqual([{ kind: 'change_cos', modelFile: 'model1.json', raw: 'change_cos model1.json' }])
  })

  it('motions enable/disable parse with target group', () => {
    expect(parseCommandChain('motions enable Leave60_70_80')[0]).toMatchObject({
      kind: 'motions',
      enabled: true,
      target: { group: 'Leave60_70_80' },
    })
    expect(parseCommandChain('motions disable Leave60_70_80')[0]).toMatchObject({
      kind: 'motions',
      enabled: false,
      target: { group: 'Leave60_70_80' },
    })
  })

  it('mouse_tracking / eye_blink toggles', () => {
    expect(parseCommandChain('mouse_tracking enable')[0]).toMatchObject({ kind: 'mouse_tracking', enabled: true })
    expect(parseCommandChain('mouse_tracking disable')[0]).toMatchObject({ kind: 'mouse_tracking', enabled: false })
    expect(parseCommandChain('eye_blink enable')[0]).toMatchObject({ kind: 'eye_blink', enabled: true })
    expect(parseCommandChain('eye_blink disable')[0]).toMatchObject({ kind: 'eye_blink', enabled: false })
  })

  it('stop_sound parses the channel', () => {
    expect(parseCommandChain('stop_sound 2')[0]).toMatchObject({ kind: 'stop_sound', channel: 2 })
    expect(parseCommandChain('stop_sound 1')[0]).toMatchObject({ kind: 'stop_sound', channel: 1 })
  })

  it('replace_tex parses index + file', () => {
    expect(parseCommandChain('replace_tex 0 Motions_normal_0.png')[0]).toMatchObject({
      kind: 'replace_tex',
      textureIndex: 0,
      file: 'Motions_normal_0.png',
    })
  })

  it('standalone replace_tex chain from skin-select model', () => {
    // docs 3348681028 正常版: two replace_tex on PostCommand
    const cmds = parseCommandChain('replace_tex 0 a.png;replace_tex 1 b.png')
    expect(cmds).toHaveLength(2)
    expect(cmds[0]).toMatchObject({ kind: 'replace_tex', textureIndex: 0, file: 'a.png' })
    expect(cmds[1]).toMatchObject({ kind: 'replace_tex', textureIndex: 1, file: 'b.png' })
  })

  it('unknown verbs become noop (preserved, not dropped)', () => {
    const cmds = parseCommandChain('start_mtn B10;frobnicate the_thing;clear_exp')
    expect(cmds.map(c => c.kind)).toEqual(['start_mtn', 'noop', 'clear_exp'])
    expect(cmds[1]).toMatchObject({ raw: 'frobnicate the_thing' })
  })

  it('handles empty / undefined / whitespace gracefully', () => {
    expect(parseCommandChain(undefined)).toEqual([])
    expect(parseCommandChain('')).toEqual([])
    expect(parseCommandChain('  ;  ; ')).toEqual([])
  })

  it('is case-insensitive on verbs', () => {
    expect(parseCommandChain('START_MTN B10')[0]).toMatchObject({ kind: 'start_mtn' })
    expect(parseCommandChain('Clear_Exp')[0]).toMatchObject({ kind: 'clear_exp' })
    expect(parseCommandChain('MOUSE_TRACKING ENABLE')[0]).toMatchObject({ kind: 'mouse_tracking', enabled: true })
  })

  it('multi-token file args are joined (spaces in file names)', () => {
    expect(parseCommandChain('change_cos model with spaces.json')[0]).toMatchObject({
      modelFile: 'model with spaces.json',
    })
  })
})
