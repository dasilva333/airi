/**
 * Per-button presentation descriptors for the Control Strip.
 *
 * Today the button row resolves five independent things per button — icon,
 * icon colour, tooltip, hover short label and status dot — through five
 * separate `if`-chains in `ControlStrip.vue`'s setup plus 21 inline badge
 * branches in the template. Each chain has to agree with the others, which is
 * what makes adding a button a five-place edit.
 *
 * This composable collapses that into one descriptor per button, so the
 * template becomes a single `v-for` with one icon span, one label span and one
 * dot span.
 *
 * NOT WIRED INTO THE COMPONENT YET. Deliberately store-free: the caller passes
 * a context snapshot, so this can be unit-tested without Pinia, Electron or a
 * mounted component.
 */
import type { ComputedRef, MaybeRefOrGetter } from 'vue'

import type { ControlStripPresentationContext } from '../constants/control-strip-labels'

import { computed, toValue } from 'vue'

import {
  resolveControlStripDot,
  resolveControlStripIcon,
  resolveControlStripIconColor,
  resolveControlStripShortLabel,
  resolveControlStripTitle,
} from '../constants/control-strip-labels'

/** The subset of a stored control-strip button the presentation layer needs. */
export interface ControlStripButtonLike {
  id: string
  label: string
  icon: string
}

export interface ControlStripButtonPresentation {
  id: string
  /** Iconify class, already state-adjusted. */
  icon: string
  /** Text-colour class, empty when the button keeps the default colour. */
  iconColor: string
  /** Full tooltip text. */
  title: string
  /** Label shown in place of the icon while hovered. */
  shortLabel: string
  /** Complete status-dot class list, or `null` when the button has no dot. */
  dot: string | null
}

export interface UseControlStripButtonPresentationOptions {
  /** Buttons to describe, in render order (typically `activeButtons`). */
  buttons: MaybeRefOrGetter<readonly ControlStripButtonLike[]>
  /** Reactive context snapshot; read inside the computed, so it stays live. */
  context: () => ControlStripPresentationContext
}

export function useControlStripButtonPresentation(
  options: UseControlStripButtonPresentationOptions,
): { presentation: ComputedRef<ControlStripButtonPresentation[]> } {
  const presentation = computed<ControlStripButtonPresentation[]>(() => {
    const ctx = options.context()
    return toValue(options.buttons).map(button => ({
      id: button.id,
      icon: resolveControlStripIcon(button.id, ctx, button.icon),
      iconColor: resolveControlStripIconColor(button.id, ctx),
      title: resolveControlStripTitle(button.id, ctx, button.label),
      shortLabel: resolveControlStripShortLabel(button.id, ctx),
      dot: resolveControlStripDot(button.id, ctx),
    }))
  })

  return { presentation }
}
