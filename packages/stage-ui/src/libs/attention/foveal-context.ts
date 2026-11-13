import type { FovealCropRect, ObservationPayloadInput } from './types'

export function computeFovealCropRect(
  bbox: [number, number, number, number],
  imageWidth: number,
  imageHeight: number,
  paddingPx = 300,
): FovealCropRect {
  const [x1, y1, x2, y2] = bbox
  const rawX = Math.floor((x1 / 1000) * imageWidth)
  const rawY = Math.floor((y1 / 1000) * imageHeight)
  const rawW = Math.max(1, Math.floor(((x2 - x1) / 1000) * imageWidth))
  const rawH = Math.max(1, Math.floor(((y2 - y1) / 1000) * imageHeight))

  const sx = Math.max(0, rawX - paddingPx)
  const sy = Math.max(0, rawY - paddingPx)
  const ex = Math.min(imageWidth, rawX + rawW + paddingPx)
  const ey = Math.min(imageHeight, rawY + rawH + paddingPx)

  return {
    sx,
    sy,
    sw: Math.max(1, ex - sx),
    sh: Math.max(1, ey - sy),
  }
}

export function assembleObservationPayload(input: ObservationPayloadInput): string {
  const winner = input.triage.winningCandidate
  const winnerText = winner
    ? (('ocrText' in winner && winner.ocrText) ? winner.ocrText : (winner.textSnippet || 'None'))
    : 'None'

  const dims = input.fovealDimensions
    ? `${input.fovealDimensions.width}x${input.fovealDimensions.height}px`
    : 'N/A'

  const ocrLines = input.verifiedCandidates.slice(0, 6).map(v =>
    `- [${v.id}] ${v.label} (${v.zone}): "${v.ocrText || v.textSnippet || 'N/A'}"`,
  ).join('\n')

  const questionText = input.triage.matchedQuestion?.question || input.question || 'N/A'

  return `[REAL-TIME SCREEN OBSERVATION]
Active Window: ${input.windowTitle || 'Unknown'}
Tripwire Question: "${questionText}"
System-1 Verdict: ${input.triage.triggered ? 'TRIGGERED' : 'QUIET'} (${Math.round(input.triage.triggerConfidence * 100)}% confidence)
Focal Target: ${winner ? `${winner.id} (${winner.label} in ${winner.zone})` : 'None'}
Focal OCR Text: "${winnerText}"
Foveal Context (${dims}):
${input.fovealSceneDescription || '(No scene description)'}

Verified Peripheral Candidates (${input.verifiedCandidates.length}/${input.totalCandidatesCount}):
${ocrLines || '(None)'}`
}
