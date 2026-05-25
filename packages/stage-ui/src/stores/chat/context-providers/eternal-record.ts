import { ContextUpdateStrategy } from '@proj-airi/server-sdk'
import { nanoid } from 'nanoid'
import type { ContextMessage } from '../../../types/chat'

const ETERNAL_RECORD_CONTEXT_ID = 'character:eternal-record'

/**
 * Creates a context message containing the character's eternal record (milestones and lore).
 */
export function createEternalRecordContext(eternalRecord?: {
  relational_milestones?: string[]
  lore_bits?: string[]
}): ContextMessage | null {
  if (!eternalRecord) return null

  let text = '[ETERNAL RECORD]\n'

  if (eternalRecord.relational_milestones?.length) {
    text += `Relational Milestones:\n${eternalRecord.relational_milestones.map((m) => `- ${m}`).join('\n')}\n`
  }

  if (eternalRecord.lore_bits?.length) {
    text += `Lore Bits:\n${eternalRecord.lore_bits.map((l) => `- ${l}`).join('\n')}\n`
  }

  if (text === '[ETERNAL RECORD]\n') return null

  return {
    contextId: ETERNAL_RECORD_CONTEXT_ID,
    createdAt: Date.now(),
    id: nanoid(),
    strategy: ContextUpdateStrategy.ReplaceSelf,
    text: text.trim(),
  }
}
