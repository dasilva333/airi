/**
 * Unit coverage for the Control Strip presentation layer.
 *
 * This is the first time the strip's per-button labels, tooltips, icons and
 * status dots are testable at all: they used to live inside `<script setup>` of
 * a 3,952-line component and could only be observed through a mounted DOM.
 *
 * The tests intentionally assert the *exact* strings and class names carried
 * over from the component, so adopting these helpers at the popover cutover is
 * a provable no-op.
 */
import type { ControlStripPresentationContext } from './control-strip-labels'

import { describe, expect, it } from 'vitest'
import { ref } from 'vue'

import { useControlStripButtonPresentation } from '../composables/use-control-strip-button-presentation'
import { CUSTOMIZER_CATALOG } from './control-customizer'
import {
  CAPTION_DOCKING_SHORT_LABELS,
  CARD_INITIAL_PALETTE,
  cardInitialColor,
  CONTROL_STRIP_DOT_IDS,
  CONTROL_STRIP_SHORT_LABELS,
  FEATURED_MACARONS,
  INTERACTION_MODE_SHORT_LABELS,
  MACARON_HEART_OPTIONS,
  MACARON_SHELL_OPTIONS,
  MACARON_WHIP_OPTIONS,
  resolveControlStripDot,
  resolveControlStripIcon,
  resolveControlStripIconColor,
  resolveControlStripShortLabel,
  resolveControlStripTitle,
  STOCK_MMD_MOTIONS,
  WINDOW_SIZE_PRESETS,
} from './control-strip-labels'

const CATALOG_IDS = new Set(CUSTOMIZER_CATALOG.flatMap(group => group.items.map(item => item.id)))

function makeContext(
  overrides: Partial<ControlStripPresentationContext> = {},
): ControlStripPresentationContext {
  return {
    themeMode: 'dark',
    isDark: true,
    stageTamagotchi: false,
    workspaceOpen: false,
    stageDisabled: false,
    stageEnabled: true,
    stageMateEnabled: true,
    chatOpen: true,
    captionOpen: true,
    interactionMode: 'tactile',
    stageMode: 'tactileMode',
    captionDocking: 'none',
    captionLayoutMode: 'single',
    captionFollowStagePosition: true,
    captionFollowStageVisibility: true,
    headTetheredCaptionEnabled: true,
    micEnabled: true,
    powerState: 'off',
    fadeOnHoverEnabled: true,
    alwaysOnTop: true,
    gunslingerStance: 'off',
    activeAtmosphereId: 'none',
    activeBackgroundId: 'none',
    chatboxActiveAtmosphereId: 'none',
    chatboxActiveBackgroundId: 'none',
    ...overrides,
  }
}

describe('control strip labels: colour palette', () => {
  it('hashes a card name to a stable palette entry', () => {
    expect(cardInitialColor('AIRI')).toBe(cardInitialColor('AIRI'))
    expect(CARD_INITIAL_PALETTE).toContain(cardInitialColor('AIRI'))
    expect(CARD_INITIAL_PALETTE).toContain(cardInitialColor(''))
  })

  it('spreads different names across more than one entry', () => {
    const seen = new Set(['AIRI', 'Hiyori', 'Kaguya', 'Miku', 'Nekomimi'].map(cardInitialColor))
    expect(seen.size).toBeGreaterThan(1)
  })
})

describe('control strip labels: icon', () => {
  const ctx = makeContext()

  it('applies fixed overrides', () => {
    expect(resolveControlStripIcon('actor-gunslinger', ctx, 'fallback')).toBe('i-ph:crosshair-bold')
    expect(resolveControlStripIcon('viewport-cycle-modes', ctx, 'fallback')).toBe('i-solar:cursor-bold-duotone')
    expect(resolveControlStripIcon('stage-atmosphere', ctx, 'fallback')).toBe('i-solar:magic-stick-3-bold-duotone')
  })

  it('follows the three-way theme mode', () => {
    expect(resolveControlStripIcon('theme-mode', makeContext({ themeMode: 'auto', isDark: true }), '')).toBe('i-solar:laptop-minimalistic-linear')
    expect(resolveControlStripIcon('theme-mode', makeContext({ themeMode: 'dark', isDark: true }), '')).toBe('i-solar:moon-linear')
    expect(resolveControlStripIcon('theme-mode', makeContext({ themeMode: 'light', isDark: false }), '')).toBe('i-solar:sun-linear')
  })

  it('mirrors caption docking and layout direction', () => {
    expect(resolveControlStripIcon('caption-docking', makeContext({ captionDocking: 'top' }), '')).toBe('i-solar:align-top-line-duotone')
    expect(resolveControlStripIcon('caption-docking', makeContext({ captionDocking: 'bottom' }), '')).toBe('i-solar:align-bottom-line-duotone')
    expect(resolveControlStripIcon('caption-layout-mode', makeContext({ captionLayoutMode: 'multi' }), '')).toBe('i-solar:layers-linear')
    expect(resolveControlStripIcon('caption-layout-mode', makeContext({ captionLayoutMode: 'single' }), '')).toBe('i-solar:window-frame-linear')
  })

  it('falls back to the stored icon', () => {
    expect(resolveControlStripIcon('chat', ctx, 'i-solar:chat-line-linear')).toBe('i-solar:chat-line-linear')
  })
})

describe('control strip labels: icon colour', () => {
  it('maps every gunslinger stance', () => {
    expect(resolveControlStripIconColor('actor-gunslinger', makeContext({ gunslingerStance: 'cat' }))).toBe('text-pink-400 dark:text-pink-300')
    expect(resolveControlStripIconColor('actor-gunslinger', makeContext({ gunslingerStance: 'blk' }))).toBe('text-emerald-400 dark:text-emerald-300')
    expect(resolveControlStripIconColor('actor-gunslinger', makeContext({ gunslingerStance: 'gray' }))).toBe('text-cyan-400 dark:text-cyan-300')
    expect(resolveControlStripIconColor('actor-gunslinger', makeContext({ gunslingerStance: 'off' }))).toBe('text-neutral-500 opacity-50')
  })

  it('maps every interaction mode', () => {
    const expectations: Array<[string, string]> = [
      ['tactile', 'text-rose-500 dark:text-rose-400'],
      ['drag', 'text-orange-500 dark:text-orange-400'],
      ['positioning', 'text-emerald-500 dark:text-emerald-400'],
      ['orbit', 'text-indigo-500 dark:text-indigo-400'],
    ]
    for (const [interactionMode, expected] of expectations)
      expect(resolveControlStripIconColor('viewport-cycle-modes', makeContext({ interactionMode }))).toBe(expected)
  })

  it('lights up the atmosphere icon for either surface', () => {
    expect(resolveControlStripIconColor('stage-atmosphere', makeContext())).toBe('text-neutral-500 opacity-50')
    expect(resolveControlStripIconColor('stage-atmosphere', makeContext({ activeAtmosphereId: 'snow' }))).toBe('text-amber-500 dark:text-amber-400')
    expect(resolveControlStripIconColor('stage-atmosphere', makeContext({ activeBackgroundId: 'bg-1' }))).toBe('text-amber-500 dark:text-amber-400')
    // Chatbox activity only counts on the desktop multi-window build.
    expect(resolveControlStripIconColor('stage-atmosphere', makeContext({ chatboxActiveAtmosphereId: 'snow' }))).toBe('text-neutral-500 opacity-50')
    expect(resolveControlStripIconColor('stage-atmosphere', makeContext({ stageTamagotchi: true, chatboxActiveAtmosphereId: 'snow' }))).toBe('text-amber-500 dark:text-amber-400')
  })

  it('colours the workspace icon by open state and leaves others uncoloured', () => {
    expect(resolveControlStripIconColor('workspace', makeContext({ workspaceOpen: true }))).toBe('text-primary-500 dark:text-primary-400')
    expect(resolveControlStripIconColor('workspace', makeContext({ workspaceOpen: false }))).toBe('text-neutral-500 opacity-70')
    expect(resolveControlStripIconColor('chat', makeContext())).toBe('')
  })
})

describe('control strip labels: tooltips', () => {
  it('describes toggles by state', () => {
    expect(resolveControlStripTitle('chat', makeContext({ chatOpen: true }), 'x')).toBe('Chat Toggle: Open (Green)')
    expect(resolveControlStripTitle('chat', makeContext({ chatOpen: false }), 'x')).toBe('Chat Toggle: Closed (Red)')
    expect(resolveControlStripTitle('mic', makeContext({ micEnabled: false }), 'x')).toBe('Microphone: Muted (Red)')
    expect(resolveControlStripTitle('caption', makeContext({ captionOpen: false }), 'x')).toBe('Captions: Disabled (Red)')
    expect(resolveControlStripTitle('stage-mate', makeContext({ stageMateEnabled: false }), 'x')).toBe('Stage Mate: Disabled (Red)')
  })

  it('reports the disabled-renderer startup flag ahead of the toggle state', () => {
    expect(resolveControlStripTitle('stage', makeContext({ stageDisabled: true, stageEnabled: true }), 'x'))
      .toBe('Actor Stage: Disabled (--disable-webgl-stage)')
    expect(resolveControlStripTitle('stage', makeContext({ stageEnabled: false }), 'x'))
      .toBe('Actor Stage: Hidden (Red)')
  })

  it('maps every speech-session state', () => {
    const expectations: Array<[string, string]> = [
      ['off', 'Disconnected (Gray)'],
      ['connecting', 'Connecting (Sky Blue)'],
      ['active', 'Listening / Idle (Red)'],
      ['busy', 'Transmitting / Speaking (Purple)'],
      ['ambient', 'Witness Mode Active (Amber)'],
    ]
    for (const [powerState, expected] of expectations)
      expect(resolveControlStripTitle('gemini-session', makeContext({ powerState }), 'x')).toBe(`Speech Session: ${expected}`)
    expect(resolveControlStripTitle('gemini-session', makeContext({ powerState: 'weird' }), 'x')).toBe('Speech Session: Disconnected (Gray)')
  })

  it('spells out caption docking and layout', () => {
    for (const docking of ['none', 'bottom', 'top', 'head'])
      expect(resolveControlStripTitle('caption-docking', makeContext({ captionDocking: docking }), 'x')).toBe(`Caption Docking: ${docking.toUpperCase()}`)
    expect(resolveControlStripTitle('caption-layout-mode', makeContext({ captionLayoutMode: 'multi' }), 'x')).toBe('Caption Layout: Multi-line History (Indigo)')
    expect(resolveControlStripTitle('caption-layout-mode', makeContext({ captionLayoutMode: 'single' }), 'x')).toBe('Caption Layout: Standard Bubble (Teal)')
  })

  it('describes the atmosphere popover per platform', () => {
    expect(resolveControlStripTitle(
      'stage-atmosphere',
      makeContext({ stageTamagotchi: true, activeAtmosphereId: 'snow', chatboxActiveAtmosphereId: 'rain' }),
      'x',
    )).toBe('Theme & Atmosphere (Stage: snow, Chat: rain)')

    expect(resolveControlStripTitle(
      'stage-atmosphere',
      makeContext({ activeAtmosphereId: 'snow', activeBackgroundId: 'bg-1' }),
      'x',
    )).toBe('Stage Theme & Atmosphere (snow, Wallpaper)')

    expect(resolveControlStripTitle('stage-atmosphere', makeContext(), 'x'))
      .toBe('Stage Theme & Atmosphere (none, No Wallpaper)')
  })

  it('falls back to the stored label for pass-through buttons', () => {
    expect(resolveControlStripTitle('settings', makeContext(), 'Settings')).toBe('Settings')
  })
})

describe('control strip labels: short labels', () => {
  it('uses the static map', () => {
    expect(resolveControlStripShortLabel('chat', makeContext())).toBe('Chat')
    expect(resolveControlStripShortLabel('actor-all-emotions', makeContext())).toBe('Mood')
    expect(resolveControlStripShortLabel('actor-motion-playground', makeContext())).toBe('Move')
  })

  it('abbreviates the interaction mode', () => {
    for (const [interactionMode, expected] of [
      ['tactile', 'Tact'],
      ['drag', 'Drag'],
      ['positioning', 'Pos'],
      ['orbit', 'Orbt'],
    ] as const) {
      expect(resolveControlStripShortLabel('viewport-cycle-modes', makeContext({ interactionMode }))).toBe(expected)
    }
    expect(resolveControlStripShortLabel('viewport-cycle-modes', makeContext({ interactionMode: 'weird' }))).toBe('Modes')
  })

  it('abbreviates caption docking', () => {
    for (const [captionDocking, expected] of Object.entries(CAPTION_DOCKING_SHORT_LABELS))
      expect(resolveControlStripShortLabel('caption-docking', makeContext({ captionDocking }))).toBe(expected)
    expect(resolveControlStripShortLabel('caption-docking', makeContext({ captionDocking: 'weird' }))).toBe('Dock')
  })

  it('truncates unknown ids to four characters', () => {
    expect(resolveControlStripShortLabel('hyper-custom', makeContext())).toBe('hype')
  })
})

describe('control strip labels: status dots', () => {
  it('gives every dot id a class list and every other id none', () => {
    const ctx = makeContext()
    for (const id of CONTROL_STRIP_DOT_IDS) {
      const dot = resolveControlStripDot(id, ctx)
      expect(dot, `${id} should render a dot`).toBeTruthy()
      expect(dot).toContain('absolute right-1 top-1 h-1.5 w-1.5 rounded-full')
    }
    expect(resolveControlStripDot('settings', ctx)).toBeNull()
    expect(resolveControlStripDot('actor-characters', ctx)).toBeNull()
  })

  it('only renders dots for controls the Customizer knows about', () => {
    const orphans = [...CONTROL_STRIP_DOT_IDS].filter(id => !CATALOG_IDS.has(id))
    expect(orphans, `dot ids missing from the catalog: ${orphans.join(', ')}`).toEqual([])
  })

  it('reflects the actor stage trio of states', () => {
    expect(resolveControlStripDot('stage', makeContext({ stageDisabled: true }))).toContain('bg-neutral-400 dark:bg-neutral-600')
    expect(resolveControlStripDot('stage', makeContext({ stageEnabled: true }))).toContain('bg-green-500')
    expect(resolveControlStripDot('stage', makeContext({ stageEnabled: false }))).toContain('bg-red-500')
  })

  it('maps the speech session dot states', () => {
    expect(resolveControlStripDot('gemini-session', makeContext({ powerState: 'busy' }))).toContain('bg-purple-500')
    expect(resolveControlStripDot('gemini-session', makeContext({ powerState: 'connecting' }))).toContain('bg-sky-400 animate-pulse')
    expect(resolveControlStripDot('gemini-session', makeContext({ powerState: 'ambient' }))).toContain('bg-amber-500 animate-pulse')
    expect(resolveControlStripDot('gemini-session', makeContext({ powerState: 'off' }))).toContain('bg-neutral-400/50')
  })

  it('uses a per-mode colour for cycling and docking', () => {
    expect(resolveControlStripDot('viewport-cycle-modes', makeContext({ interactionMode: 'tactile' }))).toContain('bg-rose-500')
    expect(resolveControlStripDot('viewport-cycle-modes', makeContext({ interactionMode: 'orbit' }))).toContain('bg-indigo-500')
    expect(resolveControlStripDot('caption-docking', makeContext({ captionDocking: 'top' }))).toContain('bg-sky-400')
    expect(resolveControlStripDot('caption-docking', makeContext({ captionDocking: 'head' }))).toContain('bg-fuchsia-400')
  })

  it('uses a per-stance colour for gunslinger', () => {
    expect(resolveControlStripDot('actor-gunslinger', makeContext({ gunslingerStance: 'off' }))).toContain('bg-neutral-500/40')
    expect(resolveControlStripDot('actor-gunslinger', makeContext({ gunslingerStance: 'cat' }))).toContain('bg-pink-400')
    expect(resolveControlStripDot('actor-gunslinger', makeContext({ gunslingerStance: 'blk' }))).toContain('bg-emerald-400')
    expect(resolveControlStripDot('actor-gunslinger', makeContext({ gunslingerStance: 'gray' }))).toContain('bg-cyan-400')
  })

  it('keeps the three-way theme dot', () => {
    expect(resolveControlStripDot('theme-mode', makeContext({ themeMode: 'auto' }))).toContain('bg-cyan-500')
    expect(resolveControlStripDot('theme-mode', makeContext({ themeMode: 'dark', isDark: true }))).toContain('bg-green-500')
    expect(resolveControlStripDot('theme-mode', makeContext({ themeMode: 'light', isDark: false }))).toContain('bg-amber-500')
  })
})

describe('control strip labels: option tables', () => {
  it('keeps the stock MMD list unique and non-empty', () => {
    expect(STOCK_MMD_MOTIONS).toHaveLength(14)
    expect(new Set(STOCK_MMD_MOTIONS).size).toBe(STOCK_MMD_MOTIONS.length)
  })

  it('only references real macaron parts from the featured presets', () => {
    const shells = new Set(MACARON_SHELL_OPTIONS.map(option => option.value))
    const whips = new Set(MACARON_WHIP_OPTIONS.map(option => option.value))
    const hearts = new Set(MACARON_HEART_OPTIONS.map(option => option.value))

    for (const preset of FEATURED_MACARONS) {
      expect(shells, `${preset.id} shell`).toContain(preset.shell)
      expect(whips, `${preset.id} whip`).toContain(preset.whip)
      expect(hearts, `${preset.id} heart`).toContain(preset.heart)
    }
  })

  it('exposes the four window presets in order', () => {
    expect(WINDOW_SIZE_PRESETS.map(preset => preset.name)).toEqual(['mini', 'medium', 'large', 'full'])
  })

  it('keeps every short-label key a catalog control', () => {
    const keys = [
      ...Object.keys(CONTROL_STRIP_SHORT_LABELS),
      ...Object.keys(INTERACTION_MODE_SHORT_LABELS).map(() => 'viewport-cycle-modes'),
      ...Object.keys(CAPTION_DOCKING_SHORT_LABELS).map(() => 'caption-docking'),
    ]
    const orphans = keys.filter(id => !CATALOG_IDS.has(id))
    expect(orphans, `short labels for unknown ids: ${unique(orphans).join(', ')}`).toEqual([])
  })
})

function unique(values: string[]): string[] {
  return [...new Set(values)]
}

describe('useControlStripButtonPresentation', () => {
  const buttons = [
    { id: 'chat', label: 'Chat Toggle', icon: 'i-solar:chat-line-linear' },
    { id: 'stage', label: 'Actor Stage', icon: 'i-solar:clapperboard-play-bold-duotone' },
    { id: 'settings', label: 'Settings', icon: 'i-solar:settings-linear' },
  ]

  it('describes each button in order, falling back to stored presentation', () => {
    const { presentation } = useControlStripButtonPresentation({
      buttons,
      context: () => makeContext(),
    })

    expect(presentation.value.map(entry => entry.id)).toEqual(['chat', 'stage', 'settings'])
    expect(presentation.value[0]).toMatchObject({
      icon: 'i-solar:chat-line-linear',
      iconColor: '',
      title: 'Chat Toggle: Open (Green)',
      shortLabel: 'Chat',
      dot: expect.stringContaining('bg-green-500'),
    })
    // `settings` has no dot and passes the stored label through as its tooltip.
    expect(presentation.value[2]).toMatchObject({ title: 'Settings', dot: null })
  })

  it('recomputes when the context changes', () => {
    const context = ref(makeContext({ chatOpen: true }))
    const { presentation } = useControlStripButtonPresentation({
      buttons,
      context: () => context.value,
    })

    expect(presentation.value[0].title).toBe('Chat Toggle: Open (Green)')
    expect(presentation.value[0].dot).toContain('bg-green-500')

    context.value = makeContext({ chatOpen: false })
    expect(presentation.value[0].title).toBe('Chat Toggle: Closed (Red)')
    expect(presentation.value[0].dot).toContain('bg-red-500')
  })

  it('accepts a reactive button list', () => {
    const list = ref(buttons)
    const { presentation } = useControlStripButtonPresentation({
      buttons: list,
      context: () => makeContext(),
    })

    expect(presentation.value).toHaveLength(3)
    list.value = buttons.slice(0, 1)
    expect(presentation.value).toHaveLength(1)
  })
})
