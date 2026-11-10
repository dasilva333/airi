/**
 * Attention Ecology & Gated Visual Perception Shared Types.
 */

export interface PerceptualHash {
  bits: Uint8Array
  hex: string
}

export interface PixelDeltaResult {
  hasChanged: boolean
  hammingDistance: number
  normalizedDistance: number
  hashA?: string
  hashB?: string
}

export interface DeltaBBox {
  left: number
  top: number
  width: number
  height: number
}

export type SalienceDecision = 'PROMOTE' | 'NOTE' | 'IGNORE' | 'BASELINE'

export type SalienceLabel
  = | 'terminal_error'
    | 'terminal_normal'
    | 'code_editor'
    | 'video_player'
    | string

export interface ZeroShotResult {
  scores: Record<string, number>
  topLabel: string
  errorMargin: number
}

export interface SalienceThresholds {
  ocrErrorPatternsMin?: number
  interestKeywordsMin?: number
  noveltyThreshold?: number
}

export interface PromotionSignals {
  ocrErrorPatternHits: number
  ocrErrorPatterns: string[]
  interestKeywordHits: number
  interestKeywords: string[]
  ocrSnippet: string
  errorMargin?: number
  redAlertRatio?: number
  zeroShotScores?: Record<string, number>
  [key: string]: any
}

export interface PromotionPacket {
  type: 'PROMOTION_PACKET'
  frameId: string
  timestamp: string
  caption: string
  novelty: number
  signals: PromotionSignals
  summary?: string
  reason: string
}

export interface SalienceEvaluation {
  decision: SalienceDecision
  reason: string
  packet?: PromotionPacket
}

export interface MirageObject {
  id?: number
  name: string
  bbox: [number, number, number, number]
  score: number
  mask?: number[]
  position?: string
  description?: Record<string, any>
}

export interface MirageTextItem {
  string: string
  bbox: [number, number, number, number]
  score: number
}

export interface MirageVisionResult {
  sceneSetting?: string
  sceneBackground?: string
  sceneStyle?: string
  reasoning: string
  ocrText: string
  objects: MirageObject[]
  textItems: MirageTextItem[]
  latencyMs: number
  rawJson: string
}

export interface VisualEventSummaryOptions {
  windowTitle?: string
  theme?: string
  sceneReasoning?: string
  ocrSnippet?: string
  tags?: string[]
}

export interface ChronoLogItem {
  timestamp: number
  activeWindow?: string
  caption: string
  rawOcrSnippet?: string
}
