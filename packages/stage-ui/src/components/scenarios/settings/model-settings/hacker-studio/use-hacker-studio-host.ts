import type { HackerAdapter } from './adapters/types'
import type { useHackerStudio } from './composables/use-hacker-studio'

import { useModelStore } from '@proj-airi/stage-ui-three'
import { effectScope, watch } from 'vue'

import { useVrmHackerAdapter } from './adapters/vrm/use-vrm-hacker-adapter'
import { useHackerStudio as createHackerStudio } from './composables/use-hacker-studio'

type HackerStudioController = ReturnType<typeof useHackerStudio>

let hostScope: ReturnType<typeof effectScope> | null = null
let adapter: HackerAdapter | null = null
let studio: HackerStudioController | null = null

/**
 * Session host for the VRM Hacker Studio.
 *
 * The adapter/controller must outlive the collapsible Appearance section so
 * replacements and the mutation registry survive a remount. They are created in
 * a detached effect scope so the adapter's model watchers keep running while
 * the section is collapsed or the settings page is temporarily unmounted.
 *
 * NOTICE: this is intentionally a host singleton, not a Pinia store. The
 * controller state is serializable, but the adapter owns live Three textures and
 * original images that cannot be serialized. A future format registry can
 * replace this factory without changing the shell.
 */
export function useHackerStudioHost() {
  if (!adapter || !studio) {
    hostScope = effectScope(true)
    hostScope.run(() => {
      const modelStore = useModelStore()
      adapter = useVrmHackerAdapter()
      studio = createHackerStudio(adapter)
      watch(
        () => adapter!.identity,
        () => studio!.reset(),
      )
      // A same-URL reload changes activeVrm without changing identity; reset the
      // replacement history so the UI cannot claim a mutation that the fresh
      // adapter no longer owns.
      watch(
        () => modelStore.activeVrm,
        () => studio!.reset(),
      )
    })
  }

  return {
    adapter: adapter!,
    studio: studio!,
  }
}
