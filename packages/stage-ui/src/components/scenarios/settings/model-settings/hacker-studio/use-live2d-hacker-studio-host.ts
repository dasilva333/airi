import type { HackerAdapter } from './adapters/types'
import type { useHackerStudio } from './composables/use-hacker-studio'

import { useLive2d } from '@proj-airi/stage-ui-live2d'
import { effectScope, watch } from 'vue'

import { useLive2dHackerAdapter } from './adapters/live2d/use-live2d-hacker-adapter'
import { useHackerStudio as createHackerStudio } from './composables/use-hacker-studio'

type HackerStudioController = ReturnType<typeof useHackerStudio>

let hostScope: ReturnType<typeof effectScope> | null = null
let adapter: HackerAdapter | null = null
let studio: HackerStudioController | null = null

/**
 * Session host for the Live2D Hacker Studio.
 *
 * Like the VRM host, the adapter/controller outlive the collapsible Appearance
 * section. Live2D textures are Pixi objects, so they cannot be serialized; the
 * host keeps them alive for the session instead.
 */
export function useLive2dHackerStudioHost() {
  if (!adapter || !studio) {
    hostScope = effectScope(true)
    hostScope.run(() => {
      const live2dStore = useLive2d()
      adapter = useLive2dHackerAdapter()
      studio = createHackerStudio(adapter)
      watch(
        () => adapter!.identity,
        () => studio!.reset(),
      )
      watch(
        () => live2dStore.model,
        () => studio!.reset(),
      )
    })
  }

  return {
    adapter: adapter!,
    studio: studio!,
  }
}
