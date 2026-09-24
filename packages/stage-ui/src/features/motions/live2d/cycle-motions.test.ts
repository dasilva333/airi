import { parseCycleMotions } from '@proj-airi/stage-ui-live2d'
import { describe, expect, it } from 'vitest'

describe('live2d parseCycleMotions', () => {
  const sampleMotions = [
    { motionName: 'Idle', motionIndex: 0, fileName: 'motions/idle_01.motion3.json' },
    { motionName: 'Idle', motionIndex: 1, fileName: 'motions/idle_02.motion3.json' },
    { motionName: 'TapBody', motionIndex: 0, fileName: 'motions/tap_01.motion3.json' },
  ]

  // ROOT CAUSE / BUG REPORT:
  // ModelCustomizer.vue writes `live2d:${mot.key}` into card.extensions.airi.acting.idleAnimations,
  // where key is the relative file path like "motions/idle_01.motion3.json".
  // The parser previously did `k.split(':')` expecting `live2d:<group>:<index>`, which yielded
  // NaN for index and dropped every motion, breaking Live2D idle loops completely.
  it('resolves customizer file-path format (live2d:<filePath>) against availableMotions', () => {
    const input = [
      'live2d:motions/idle_01.motion3.json',
      'live2d:motions/tap_01.motion3.json',
    ]
    const result = parseCycleMotions(input, sampleMotions)
    expect(result).toEqual([
      { group: 'Idle', index: 0 },
      { group: 'TapBody', index: 0 },
    ])
  })

  it('matches file basename if full path differs in separators or directories', () => {
    const input = ['live2d:idle_02.motion3.json']
    const result = parseCycleMotions(input, sampleMotions)
    expect(result).toEqual([
      { group: 'Idle', index: 1 },
    ])
  })

  it('supports legacy group and index format (live2d:<group>:<index>) without availableMotions', () => {
    const input = ['live2d:Idle:0', 'live2d:TapBody:2']
    const result = parseCycleMotions(input, [])
    expect(result).toEqual([
      { group: 'Idle', index: 0 },
      { group: 'TapBody', index: 2 },
    ])
  })

  it('ignores foreign keys intended for other model types (vrm, spine, mmd)', () => {
    const input = [
      'vrm:idle_loop',
      'spine:walk',
      'mmd:circulation.vmd',
      'live2d:Idle:0',
    ]
    const result = parseCycleMotions(input, sampleMotions)
    expect(result).toEqual([
      { group: 'Idle', index: 0 },
    ])
  })

  it('returns empty array when input is undefined, empty, or unmatched', () => {
    expect(parseCycleMotions(undefined, sampleMotions)).toEqual([])
    expect(parseCycleMotions([], sampleMotions)).toEqual([])
    expect(parseCycleMotions(['live2d:nonexistent.motion3.json'], sampleMotions)).toEqual([])
  })
})
