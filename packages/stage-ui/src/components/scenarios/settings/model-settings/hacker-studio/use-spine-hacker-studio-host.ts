import type { HackerAdapter } from './adapters/types'
import type { useHackerStudio } from './composables/use-hacker-studio'

import { useSpineHackerRuntime } from '@proj-airi/stage-ui-spine'
import { effectScope, watch } from 'vue'

import { useSpineHackerAdapter } from './adapters/spine/use-spine-hacker-adapter'
import { useHackerStudio as createHackerStudio } from './composables/use-hacker-studio'

type HackerStudioController = ReturnType<typeof useHackerStudio>

let hostScope: ReturnType<typeof effectScope> | null = null
let adapter: HackerAdapter | null = null
let studio: HackerStudioController | null = null

/**
 * Session host for the Spine Hacker Studio. Live TextureAtlas/WebGL handles
 * live in the Spine runtime bridge; the controller/host survive Appearance
 * section remounts for the session.
 */
export function useSpineHackerStudioHost() {
  if (!adapter || !studio) {
    hostScope = effectScope(true)
    hostScope.run(() => {
      const runtime = useSpineHackerRuntime()
      adapter = useSpineHackerAdapter()
      studio = createHackerStudio(adapter)
      watch(
        () => adapter!.identity,
        () => studio!.reset(),
      )
      watch(
        runtime,
        () => studio!.reset(),
      )
    })
  }

  return {
    adapter: adapter!,
    studio: studio!,
  }
}
