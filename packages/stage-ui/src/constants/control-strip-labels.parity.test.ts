import type { ControlStripPresentationContext } from './control-strip-labels'

/**
 * Differential parity between `ControlStrip.vue`'s original presentation
 * functions and the extracted `control-strip-labels.ts`.
 *
 * This is the proof that adopting the extracted module is a no-op: it lifts the
 * four `if`-chains straight out of the SFC, transpiles them, runs them against a
 * state matrix, and compares every result with the extracted resolver.
 *
 * SELF-RETIRING: once the component stops defining `getButtonIcon` & friends
 * (i.e. the popover cutover adopts the module), there is nothing left to compare
 * against and the test skips. That is intentional — parity is only meaningful
 * while both implementations coexist.
 *
 * The matrix is deliberately full-cross-product over the values that change a
 * label, plus an `'nope'` sentinel in each enum to cover the fallback paths.
 */
import { readFileSync } from 'node:fs'

import { transform } from 'sucrase'
import { describe, expect, it } from 'vitest'

import {
  resolveControlStripIcon,
  resolveControlStripIconColor,
  resolveControlStripShortLabel,
  resolveControlStripTitle,
} from './control-strip-labels'

const SFC_SOURCE = readFileSync(
  new URL('../components/scenarios/layout/ControlStrip.vue', import.meta.url),
  'utf8',
)

const EXTRACTED_START = SFC_SOURCE.indexOf('function getButtonIcon')
const HAS_ORIGINALS = EXTRACTED_START !== -1

interface OriginalResolvers {
  getButtonIcon: (id: string, icon: string) => string
  getButtonIconColor: (id: string) => string
  getButtonTitle: (id: string, label: string) => string
  getShortLabel: (id: string) => string
}

/**
 * Build the original four functions with the component's refs and stores
 * replaced by plain stand-ins, so they can run outside a Vue component.
 */
function bindOriginals(): (ctx: ControlStripPresentationContext) => OriginalResolvers {
  const body = SFC_SOURCE.slice(EXTRACTED_START, SFC_SOURCE.indexOf('</script>'))
  const js = transform(body, { transforms: ['typescript'] }).code

  const factory = new Function(
    'themeMode',
    'isDark',
    'settingsStore',
    'stageModelSettings',
    'controlStripStore',
    'chatOpen',
    'stageEnabled',
    'stageMateEnabled',
    'captionOpen',
    'micEnabled',
    'powerState',
    'activeAtmosphereId',
    'activeBackgroundId',
    'chatboxActiveAtmosphereId',
    'chatboxActiveBackgroundId',
    'isStageTamagotchi',
    `${js}\nreturn { getButtonIcon, getButtonIconColor, getButtonTitle, getShortLabel }`,
  ) as (...args: unknown[]) => OriginalResolvers

  return (ctx: ControlStripPresentationContext) => factory(
    { value: ctx.themeMode },
    { value: ctx.isDark },
    {
      captionDocking: ctx.captionDocking,
      captionLayoutMode: ctx.captionLayoutMode,
      controlStripInteractionMode: ctx.interactionMode,
      captionFollowStagePosition: ctx.captionFollowStagePosition,
      captionFollowStageVisibility: ctx.captionFollowStageVisibility,
      headTetheredCaptionEnabled: ctx.headTetheredCaptionEnabled,
    },
    { gunslingerStance: ctx.gunslingerStance },
    { stageDisabled: ctx.stageDisabled, workspaceOpen: ctx.workspaceOpen },
    { value: ctx.chatOpen },
    { value: ctx.stageEnabled },
    { value: ctx.stageMateEnabled },
    { value: ctx.captionOpen },
    { value: ctx.micEnabled },
    { value: ctx.powerState },
    { value: ctx.activeAtmosphereId },
    { value: ctx.activeBackgroundId },
    { value: ctx.chatboxActiveAtmosphereId },
    { value: ctx.chatboxActiveBackgroundId },
    () => ctx.stageTamagotchi,
  )
}

/** Every button id the original chains special-case, plus pass-through ids. */
const IDS = [
  'actor-gunslinger',
  'viewport-cycle-modes',
  'viewport-tactile',
  'viewport-drag',
  'viewport-orbit',
  'viewport-positioning',
  'theme-mode',
  'caption-docking',
  'caption-layout-mode',
  'caption-sync-position',
  'caption-sync-visibility',
  'head-tethered-caption',
  'stage',
  'stage-mate',
  'chat',
  'mic',
  'caption',
  'gemini-session',
  'stage-atmosphere',
  'workspace',
  'settings',
  'actor-characters',
]

function* contexts(): Generator<ControlStripPresentationContext> {
  for (const themeMode of ['auto', 'light', 'dark']) {
    for (const isDark of [true, false]) {
      for (const gunslingerStance of ['off', 'cat', 'blk', 'gray', 'nope']) {
        for (const interactionMode of ['tactile', 'drag', 'positioning', 'orbit', 'nope']) {
          for (const powerState of ['off', 'connecting', 'active', 'busy', 'ambient', 'nope']) {
            for (const captionDocking of ['none', 'bottom', 'top', 'head', 'nope']) {
              for (const stageTamagotchi of [true, false]) {
                for (const flags of [true, false]) {
                  yield {
                    themeMode,
                    isDark,
                    stageTamagotchi,
                    workspaceOpen: flags,
                    stageDisabled: !flags,
                    stageEnabled: flags,
                    stageMateEnabled: flags,
                    chatOpen: flags,
                    captionOpen: flags,
                    interactionMode,
                    stageMode: flags ? 'dragMode' : 'tactileMode',
                    captionDocking,
                    captionLayoutMode: flags ? 'multi' : 'single',
                    captionFollowStagePosition: flags,
                    captionFollowStageVisibility: flags,
                    headTetheredCaptionEnabled: flags,
                    micEnabled: flags,
                    powerState,
                    fadeOnHoverEnabled: flags,
                    alwaysOnTop: flags,
                    gunslingerStance,
                    activeAtmosphereId: flags ? 'snow' : 'none',
                    activeBackgroundId: flags ? 'bg-1' : 'none',
                    chatboxActiveAtmosphereId: flags ? 'rain' : 'none',
                    chatboxActiveBackgroundId: flags ? 'bg-2' : 'none',
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}

describe('control strip labels: parity with the original component', () => {
  it.skipIf(!HAS_ORIGINALS)('resolves identical icon, colour, title and short label in every state', () => {
    const originals = bindOriginals()
    const mismatches: string[] = []
    let compared = 0

    for (const ctx of contexts()) {
      const original = originals(ctx)
      for (const id of IDS) {
        compared++
        const pairs: Array<[string, string, string]> = [
          ['icon', original.getButtonIcon(id, 'fallback-icon'), resolveControlStripIcon(id, ctx, 'fallback-icon')],
          ['iconColor', original.getButtonIconColor(id), resolveControlStripIconColor(id, ctx)],
          ['title', original.getButtonTitle(id, 'stored label'), resolveControlStripTitle(id, ctx, 'stored label')],
          ['shortLabel', original.getShortLabel(id), resolveControlStripShortLabel(id, ctx)],
        ]
        for (const [field, expected, actual] of pairs) {
          if (expected !== actual)
            mismatches.push(`${id}.${field}: original=${JSON.stringify(expected)} extracted=${JSON.stringify(actual)}`)
        }
      }
    }

    // Guards against the matrix silently collapsing to nothing.
    expect(compared).toBeGreaterThan(10_000)
    expect(mismatches.slice(0, 10)).toEqual([])
  }, 60_000)
})
