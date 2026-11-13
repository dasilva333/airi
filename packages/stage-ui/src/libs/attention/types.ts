export interface MirageBoundingBoxLike {
  top: number
  left: number
  bottom: number
  right: number
  label?: string
  confidence?: number
  type?: 'object' | 'text'
  text?: string
}

export interface SpatialCandidate {
  id: string
  label: string
  category: 'macro_window' | 'sub_panel' | 'action_control' | 'text_banner' | 'control_pill'
  zone: string
  bbox: [number, number, number, number] // [xmin, ymin, xmax, ymax] normalized 0..1000
  width: number
  height: number
  areaPercent: number
  confidence: number
  color?: string
  textSnippet?: string
  tags: string[]
  box: MirageBoundingBoxLike
}

export interface VerifiedCandidate extends SpatialCandidate {
  ocrText: string
  ocrConfidence: number
  ocrLatencyMs: number
  cropDataUrl?: string
}

export interface System1TriageResult {
  winningCandidate: VerifiedCandidate | SpatialCandidate | null
  triggered: boolean
  triggerConfidence: number
  triageReason: string
  latencyMs: number
  usedFallback: boolean
}

export interface FovealCropRect {
  sx: number
  sy: number
  sw: number
  sh: number
}

export interface ObservationPayloadInput {
  windowTitle?: string
  question: string
  triage: System1TriageResult
  fovealDimensions?: { width: number, height: number }
  fovealSceneDescription: string
  verifiedCandidates: VerifiedCandidate[]
  totalCandidatesCount: number
}
