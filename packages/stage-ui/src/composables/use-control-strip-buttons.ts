import type { ComputedRef, Ref } from 'vue'

import { computed } from 'vue'

import { CUSTOMIZER_CATALOG } from '../constants'

interface StripButton {
  id: string
  enabled: boolean
}

interface UseControlStripButtonsOptions {
  mode: Ref<'desktop' | 'mobile'>
  buttons: Ref<StripButton[]>
  isSandboxAllowed: Ref<boolean> | ComputedRef<boolean>
  powerState: Ref<string>
}

const desktopOnlyById: Map<string, boolean> = new Map(
  CUSTOMIZER_CATALOG.flatMap(g => g.items).map(i => [i.id, !!i.desktopOnly]),
)

// Verbatim extraction of button-visibility + badge state from ControlStrip.vue.
// Icon/title/short-label `if`-chains stay in the strip for P1 (constants extraction
// by the parallel agent); this module owns only enabled-filtering + dot classes.
export function useControlStripButtons(options: UseControlStripButtonsOptions) {
  const { mode, buttons, isSandboxAllowed, powerState } = options

  const activeButtons = computed(() => {
    const isMobile = mode.value === 'mobile'
    return buttons.value.filter((btn) => {
      if (!btn.enabled)
        return false
      if (isMobile && desktopOnlyById.get(btn.id))
        return false
      if (btn.id === 'workspace' && !isSandboxAllowed.value)
        return false
      return true
    })
  })

  const geminiDotClasses = computed(() => {
    if (powerState.value === 'busy') {
      return 'bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.8)] animate-pulse'
    }
    if (powerState.value === 'active') {
      return 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.7)]'
    }
    if (powerState.value === 'connecting') {
      return 'bg-sky-400 animate-pulse'
    }
    if (powerState.value === 'ambient') {
      return 'bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.6)]'
    }
    return 'bg-neutral-400/50'
  })

  return {
    activeButtons,
    geminiDotClasses,
  }
}
