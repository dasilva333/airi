import type { CadenceSegmentRecord } from './mapping'

import { describe, expect, it } from 'vitest'

import { assignSegmentsToBubbles } from './mapping'

const grocery = 'Hey dont forget to bring the grocery list tonight\n\nmake sure to bring\n-bananas\n-pears\n-lettuce\n-milk\n-eggs\n\nlove ya see you soon'
const groceryRanges = [
  { start: 0, end: 44 },
  { start: 46, end: 117 },
  { start: 119, end: grocery.length },
]

function textSeg(id: string, start: number, end: number): CadenceSegmentRecord {
  return { segmentId: id, sourceStart: start, sourceEnd: end, special: null }
}

describe('assignSegmentsToBubbles', () => {
  it('assigns ordered segments to the grocery bubbles', () => {
    const segments = [
      textSeg('s0', 0, 44),
      textSeg('s1', 46, 63),
      textSeg('s2', 64, 72),
      textSeg('s3', 73, 79),
      textSeg('s4', 119, grocery.length),
    ]
    const res = assignSegmentsToBubbles(segments, groceryRanges, grocery.length)
    expect(res.failed).toBe(false)
    expect([...res.bubbleOfSegment.entries()]).toEqual([
      ['s0', 0],
      ['s1', 1],
      ['s2', 1],
      ['s3', 1],
      ['s4', 2],
    ])
  })

  it('resolves repeated identical lines by occurrence via cursor', () => {
    const text = 'hi\nhi\nhi'
    const ranges = [{ start: 0, end: 2 }, { start: 3, end: 5 }, { start: 6, end: 8 }]
    const res = assignSegmentsToBubbles(
      [textSeg('a', 0, 2), textSeg('b', 3, 5), textSeg('c', 6, 8)],
      ranges,
      text.length,
    )
    expect(res.failed).toBe(false)
    expect([...res.bubbleOfSegment.values()]).toEqual([0, 1, 2])
  })

  it('attaches specials by point, gap points to the next bubble', () => {
    const text = 'hello\n\nworld'
    const ranges = [{ start: 0, end: 5 }, { start: 7, end: 12 }]
    const res = assignSegmentsToBubbles(
      [
        textSeg('t0', 0, 5),
        { segmentId: 'fx', sourceStart: 5, sourceEnd: 5, special: '<|ACTOR:foo|>' },
        textSeg('t1', 7, 12),
      ],
      ranges,
      text.length,
    )
    expect(res.failed).toBe(false)
    expect(res.bubbleOfSegment.get('fx')).toBe(1)
  })

  it('fails on text segments with missing offsets', () => {
    const res = assignSegmentsToBubbles(
      [{ segmentId: 's0', special: null }],
      [{ start: 0, end: 5 }],
      5,
    )
    expect(res.failed).toBe(true)
  })

  it('fails when a span exceeds the classified content', () => {
    const res = assignSegmentsToBubbles(
      [textSeg('s0', 0, 500)],
      [{ start: 0, end: 5 }],
      5,
    )
    expect(res.failed).toBe(true)
    expect(res.failureReason).toBe('out-of-content:s0')
  })

  it('attaches offset-less specials best-effort without failing', () => {
    const res = assignSegmentsToBubbles(
      [{ segmentId: 'fx', special: '<|ACTOR:foo|>' }],
      [{ start: 0, end: 5 }],
      5,
    )
    expect(res.failed).toBe(false)
    expect(res.bubbleOfSegment.get('fx')).toBe(0)
  })

  it('handles empty segments without failing', () => {
    const res = assignSegmentsToBubbles([], [{ start: 0, end: 5 }], 5)
    expect(res.failed).toBe(false)
    expect(res.bubbleOfSegment.size).toBe(0)
  })
})
