export type TextJournalEntrySource = 'tool' | 'chat' | 'proactivity' | 'dream' | 'user' | 'seed' | 'episode'
export type TextJournalEntryType = 'message' | 'episode'

export interface TextJournalEntry {
  id: string
  userId: string
  characterId: string
  characterName: string
  title: string
  content: string
  source: TextJournalEntrySource
  type?: TextJournalEntryType

  // FSRS fields
  stability: number
  difficulty: number
  elapsed_days: number
  scheduled_days: number
  last_review: number
  surprise?: number

  // Search fields
  embedding?: number[]
  version?: string

  universeId?: string
  sessionId?: string

  createdAt: number
  updatedAt: number
}
