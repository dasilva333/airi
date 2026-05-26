import { ContextUpdateStrategy } from '@proj-airi/server-sdk'
import { nanoid } from 'nanoid'
import type { ContextMessage } from '../../../types/chat'

import { useStickersStore } from '../../stickers'

/**
 * Creates context about the available stickers that the assistant can use.
 */
export function createStickersContext(): ContextMessage {
  const stickersStore = useStickersStore()
  const availableStickers = stickersStore.currentLibrary.map((s: any) => s.label).join(', ')

  return {
    contextId: 'stickers',
    createdAt: Date.now(),
    id: nanoid(),
    strategy: ContextUpdateStrategy.ReplaceSelf,
    text: availableStickers
      ? `CRITICAL: You have access to a "Kawaii Sticker System". You can ONLY spawn stickers with the following labels: ${availableStickers}. Do not attempt to use any other labels as they do not exist in your library. Use the spawn_sticker tool with exactly one of these labels.`
      : 'No stickers are currently available in your character-specific library. You cannot use the Kawaii Sticker System at this time.',
  }
}
