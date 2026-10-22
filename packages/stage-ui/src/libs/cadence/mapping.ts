export interface CadenceSegmentRecord {
  segmentId: string
  sourceStart?: number
  sourceEnd?: number
  special: string | null
}

export interface CadenceBubbleRange {
  start: number
  end: number
}

export interface CadenceSegmentAssignment {
  /** segmentId -> bubble index. Specials map by their point the same way. */
  bubbleOfSegment: Map<string, number>
  failed: boolean
  failureReason?: string
}

/**
 * Assigns TTS segments to virtual bubbles using source offsets.
 *
 * Segments arrive in literal-stream order and the newline hard-split
 * invariant guarantees no text segment straddles a bubble boundary, so a
 * forward cursor over the bubble ranges suffices (repeated identical lines
 * resolve by occurrence). A text segment that cannot be placed — missing
 * offsets or a span outside the classified content — fails the mapping so
 * the driver can fall back to reveal-all instead of staggering visuals
 * independently of unmappable audio.
 */
export function assignSegmentsToBubbles(
  segments: CadenceSegmentRecord[],
  ranges: CadenceBubbleRange[],
  contentLength: number,
): CadenceSegmentAssignment {
  const bubbleOfSegment = new Map<string, number>()

  if (ranges.length === 0)
    return { bubbleOfSegment, failed: segments.length > 0, failureReason: segments.length > 0 ? 'no-bubble-ranges' : undefined }

  let cursor = 0
  for (const seg of segments) {
    const { sourceStart: start, sourceEnd: end } = seg
    const isPoint = start === end

    if (start == null || end == null || start < 0 || end < start) {
      // Specials carry no audio; attach best-effort without failing.
      if (seg.special != null) {
        bubbleOfSegment.set(seg.segmentId, Math.min(cursor, ranges.length - 1))
        continue
      }
      return { bubbleOfSegment, failed: true, failureReason: `missing-offsets:${seg.segmentId}` }
    }

    if (!isPoint && end > contentLength) {
      return { bubbleOfSegment, failed: true, failureReason: `out-of-content:${seg.segmentId}` }
    }

    // First bubble at/after the cursor whose range extends past the point.
    // Points in inter-bubble gaps (e.g. a special on a blank line) fall
    // through to the next bubble; points past the final range attach to it.
    let index = cursor
    while (index < ranges.length && ranges[index].end <= start)
      index++
    if (index >= ranges.length)
      index = ranges.length - 1
    bubbleOfSegment.set(seg.segmentId, index)
    cursor = index
  }

  return { bubbleOfSegment, failed: false }
}
