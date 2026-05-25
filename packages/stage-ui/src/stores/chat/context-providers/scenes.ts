import { ContextUpdateStrategy } from '@proj-airi/server-sdk'
import { nanoid } from 'nanoid'
import type { ContextMessage } from '../../../types/chat'

import { useBackgroundStore } from '../../background'
import { useAiriCardStore } from '../../modules/airi-card'

const SCENES_CONTEXT_ID = 'system:scenes'

/**
 * Creates a context message containing the current background/scene information.
 * This allows the LLM to be aware of its visual environment.
 */
export function createScenesContext(): ContextMessage {
  const backgroundStore = useBackgroundStore()
  const airiCardStore = useAiriCardStore()

  const activeBackgroundId = airiCardStore.activeCard?.extensions?.airi?.modules?.activeBackgroundId
  const background = activeBackgroundId ? backgroundStore.entries.get(activeBackgroundId) : null

  // NOTICE: Scoping the visible scenes available to only items intended as environmental backgrounds.
  // We exclude 'selfie' and other image types to prevent roleplay confusion.
  const isValidScene = background && ['builtin', 'scene', 'journal'].includes(background.type)

  let sceneInfo = 'Unknown Location'
  if (background && isValidScene) {
    sceneInfo = background.title
    if (background.prompt) {
      // For generated backgrounds, the prompt often contains more descriptive detail
      sceneInfo += ` (Vibe: ${background.prompt})`
    }
  }

  return {
    contextId: SCENES_CONTEXT_ID,
    createdAt: Date.now(),
    id: nanoid(),
    strategy: ContextUpdateStrategy.ReplaceSelf,
    text: `Current Scene: ${sceneInfo}`,
  }
}
