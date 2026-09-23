export type EchoChipType = 'mood' | 'flavor' | 'journal_candidate'

export interface PCLClaim {
  subject: string
  predicate: string
  object: string
  action: 'new' | 'reinforce' | 'update' | 'invalidate'
  date?: string
  supersededPrevious?: string
}

export interface DreamMoodShift {
  valence: number // -1.0 to 1.0
  arousal: number // -1.0 to 1.0
  sentiment: string // e.g. "tender", "amused", "wistful", "flustered"
}

export interface EchoChip {
  id: string
  userId: string
  characterId: string
  /** Anchor date for the dream window this chip was generated from (YYYY-MM-DD) */
  date: string
  content: string
  type: EchoChipType
  relevanceScore: number
  /** Optional indices of the facts/evidence that led to this chip */
  evidenceIndices?: number[]
  /** Verbatim evidence quotes/lines cited from conversation and historical anchors */
  citedText?: string[]
  /** PCL Knowledge Graph triples generated during this dream consolidation pass */
  claims?: PCLClaim[]
  /** Emotional exhaust sentiment delta emitted during this dream consolidation pass */
  moodShift?: DreamMoodShift
  createdAt: number
  universeId?: string
  sessionId?: string
}
