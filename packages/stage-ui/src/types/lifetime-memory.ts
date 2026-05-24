export interface LifetimeMemoryArtifact {
  id: string
  characterId: string
  version: number
  /** The foundation: summarized chunks used for synthesis */
  chunkSummaries: any[]
  /** Structured archive object before markdown render */
  baseArchive?: Record<string, any>
  /** The "heavy" summarized base (~7k tokens) */
  baseContent: string
  /** Structured distill pass 1 pack before final render */
  distillPass1Pack?: Record<string, any>
  /** The compressed, distilled relational essence (~1k tokens) */
  distilledContent: string
  sourceManifest: {
    rawTurnCount: number
    stmmBlockCount: number
    ltmmEntryCount: number
  }
  createdAt: number
  updatedAt: number
  metadata: {
    model: string
    totalElapsedMs: number
    chunkCount: number
    targetTokens?: number
  }
}
