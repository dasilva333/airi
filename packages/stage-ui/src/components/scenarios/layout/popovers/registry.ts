/**
 * Registry of Control Strip popovers that have been extracted into their own
 * components.
 *
 * The shell renders whichever id is active through `<component :is>` instead of
 * holding one `v-if` branch per popover. Extracted popovers are self-serving:
 * they read the stores they need and emit `close`, so the parent keeps only the
 * shared concerns (which popover is open, placement, the Electron bounds
 * contract, and the caption relay).
 *
 * Popovers NOT listed here are still inline `v-if` branches in
 * `ControlStrip.vue`; the two forms coexist until the cutover finishes, and
 * `ControlStrip.contract.test.ts` unions both when checking registry integrity.
 */
import type { Component } from 'vue'

import EmotionsPopover from './EmotionsPopover.vue'
import MacaronPopover from './MacaronPopover.vue'
import VfxPopover from './VfxPopover.vue'
import WardrobePopover from './WardrobePopover.vue'

export const STRIP_POPOVER_COMPONENTS: Record<string, Component> = {
  'actor-all-emotions': EmotionsPopover,
  'actor-macaron': MacaronPopover,
  'actor-vfx': VfxPopover,
  'actor-wardrobe': WardrobePopover,
}
