import { ContextUpdateStrategy } from '@proj-airi/server-sdk'
import { useLive2d } from '@proj-airi/stage-ui-live2d'
import { useModelStore } from '@proj-airi/stage-ui-three'
import { nanoid } from 'nanoid'
import type { ContextMessage } from '../../../types/chat'

const EXPRESSIONS_CONTEXT_ID = 'system:expressions'

/**
 * Creates a context message containing currently active visual expressions, props, and accessories.
 * This allows the LLM to know its current visual state (e.g., "Wearing Glasses", "Blushing").
 */
export function createExpressionsContext(): ContextMessage {
  const live2dStore = useLive2d()
  const vrmStore = useModelStore()

  const active = new Set<string>()

  // Collect from Live2D
  if (live2dStore.activeExpressions) {
    for (const [name, weight] of Object.entries(live2dStore.activeExpressions)) {
      if (typeof weight === 'number' && weight > 0.1) {
        active.add(name)
      }
    }
  }

  // Collect from VRM
  if (vrmStore.activeExpressions) {
    for (const [name, weight] of Object.entries(vrmStore.activeExpressions)) {
      if (typeof weight === 'number' && weight > 0.1) {
        active.add(name)
      }
    }
  }

  const list = Array.from(active)
  const text =
    list.length > 0
      ? `Active Visual Expressions/Props: [${list.join(', ')}]`
      : 'No special expressions or props currently active.'

  return {
    contextId: EXPRESSIONS_CONTEXT_ID,
    createdAt: Date.now(),
    id: nanoid(),
    strategy: ContextUpdateStrategy.ReplaceSelf,
    text,
  }
}
