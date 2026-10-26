/**
 * Characterization ("golden master") contract tests for the Control Strip.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * `ControlStrip.vue` is ~3,300 lines and is scheduled to be decomposed into
 * popover components + shell composables. The regression risk in that work is
 * not arithmetic — it is *silent omission*: a popover id dropped from the click
 * router, a status badge orphaned when a lookup table moves, a BroadcastChannel
 * closed in two places, or an extra store dragged into the shell's setup.
 *
 * These tests pin those contracts as data, so the decomposition can be done in
 * mechanical steps with a green light after each one.
 *
 * WHY NOT A MOUNTED COMPONENT TEST
 * --------------------------------
 * A real `createApp(ControlStrip)` mount was attempted first (jsdom +
 * `createTestingPinia`, and it is the right long-term target) but does not
 * currently get off the ground: setup eagerly instantiates 20 store/composable
 * graphs whose constructors reach for IndexedDB (display-models), bundled asset
 * URLs (background), `import.meta.hot.data` (chat context via live-session),
 * response streams (`wlipsync` via stage-ui-three), WebGPU and Electron. Four
 * separate environment shims were required and each one exposed another. That
 * is precisely the coupling phases P2/P3 of the decomposition exist to remove.
 * Treat "mounts under jsdom with zero environment hacks" as an acceptance
 * criterion for that work, and this file as the interim safety net.
 *
 * SCOPE OF PARSING
 * ----------------
 * Sources are collected recursively from this directory (not from one file), so
 * these assertions keep holding as popovers move into `./popovers/*.vue`. If the
 * implementation ever switches from `v-if="activePopover === 'x'"` branches to a
 * dynamic component registry, update the extraction helper rather than deleting
 * the assertion.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { CUSTOMIZER_CATALOG } from '../../../constants/control-customizer'
import { CONTROL_STRIP_DOT_IDS } from '../../../constants/control-strip-labels'
import { DEFAULT_BUTTONS, DEFAULT_MOBILE_BUTTONS } from '../../../stores/settings/control-strip'

const LAYOUT_DIR = fileURLToPath(new URL('.', import.meta.url))
const SHELL = join(LAYOUT_DIR, 'ControlStrip.vue')
const ACTION_SOURCE = join(LAYOUT_DIR, '..', '..', '..', 'composables', 'use-control-strip-action.ts')

// ── Helpers ────────────────────────────────────────────────────────────────

function collectVueSources(dir: string): Array<{ file: string, source: string }> {
  const out: Array<{ file: string, source: string }> = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      out.push(...collectVueSources(full))
      continue
    }
    if (!entry.endsWith('.vue'))
      continue
    out.push({ file: full, source: readFileSync(full, 'utf8') })
  }
  return out
}

function templateOf(source: string): string {
  const start = source.indexOf('<template>')
  const end = source.lastIndexOf('</template>')
  return start === -1 || end === -1 ? '' : source.slice(start, end)
}

/** Everything before `</script>` — includes the import block and setup body. */
function scriptOf(source: string): string {
  const end = source.indexOf('</script>')
  return end === -1 ? source : source.slice(0, end)
}

function unique(matches: Iterable<string>): string[] {
  return [...new Set(matches)].sort()
}

function matchAll(text: string, pattern: RegExp): string[] {
  return [...text.matchAll(pattern)].map(match => match[1])
}

function sliceBetween(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker)
  if (start === -1)
    return ''
  const end = source.indexOf(endMarker, start)
  return end === -1 ? source.slice(start) : source.slice(start, end)
}

const sources = collectVueSources(LAYOUT_DIR)
const shellSource = readFileSync(SHELL, 'utf8')
const shellScript = scriptOf(shellSource)
const shellTemplate = templateOf(shellSource)
const actionSource = readFileSync(ACTION_SOURCE, 'utf8')

const COMPOSABLES_DIR = join(LAYOUT_DIR, '..', '..', '..', 'composables')

/**
 * The strip's extraction targets (`use-control-strip-*.ts`). They participate
 * in the same cross-window contract as the shell, so contract assertions are
 * made over the *ownership surface* rather than over one directory — moving a
 * channel or an event into a composable must not change the expected set.
 */
const STRIP_COMPOSABLE_SOURCES = readdirSync(COMPOSABLES_DIR)
  .filter(entry => /^use-control-strip-[a-z-]+\.ts$/.test(entry) && !entry.endsWith('.test.ts'))
  .map(entry => ({
    file: join(COMPOSABLES_DIR, entry),
    source: readFileSync(join(COMPOSABLES_DIR, entry), 'utf8'),
  }))

const OWNERSHIP_SOURCES = [...sources, ...STRIP_COMPOSABLE_SOURCES]

/**
 * Button ids that currently render a status dot in the template. Retires itself
 * once P5 collapses the 21 badge branches into one descriptor-driven span.
 */
const TEMPLATE_DOT_IDS = unique(
  matchAll(
    sliceBetween(shellTemplate, '<!-- Status dot badge', '<!-- POPOVERS -->'),
    /btn\.id === '([^']+)'/g,
  ),
)

/**
 * Control Strip popovers exist in two forms while the cutover is in flight:
 * extracted components listed in `popovers/registry.ts`, and inline `v-if`
 * branches still living in the shell. Both count as "rendered" here.
 */
const REGISTRY_SOURCE = readFileSync(join(LAYOUT_DIR, 'popovers', 'registry.ts'), 'utf8')
const REGISTRY_POPOVER_KEYS = matchAll(REGISTRY_SOURCE, /'([a-z0-9-]+)':/g)
const REGISTRY_POPOVERS = unique(REGISTRY_POPOVER_KEYS)

/** Popovers still rendered by an inline `v-if` branch. */
const TEMPLATE_POPOVERS = unique(
  sources.flatMap(entry => matchAll(templateOf(entry.source), /v-if="activePopover === '([^']+)'"/g)),
)

/** Popovers the strip can render, by either mechanism. */
const RENDERED_POPOVERS = unique([...TEMPLATE_POPOVERS, ...REGISTRY_POPOVERS])

/** Popovers the shell declares in its `menuButtons` array. */
const MENU_POPOVERS = unique(
  matchAll(shellScript.match(/const menuButtons = \[([^\]]+)\]/)?.[1] ?? '', /'([^']+)'/g),
)

/** Popovers the shell opens implicitly (right-click on stage/chat buttons). */
const PRESET_POPOVERS = unique(
  matchAll(shellScript, /activePopover\.value = '([^']+)'/g),
)

const ROUTABLE_POPOVERS = unique([...MENU_POPOVERS, ...PRESET_POPOVERS])

const CATALOG_IDS = new Set(CUSTOMIZER_CATALOG.flatMap(group => group.items.map(item => item.id)))

/** Catalog items the strip hides when mounted as `mode="mobile"`. */
const DESKTOP_ONLY_IDS = new Set(
  CUSTOMIZER_CATALOG.flatMap(group => group.items.filter(item => item.desktopOnly).map(item => item.id)),
)

const CONTROL_STRIP_STORE_SOURCE = readFileSync(
  join(LAYOUT_DIR, '..', '..', '..', 'stores', 'settings', 'control-strip.ts'),
  'utf8',
)

/**
 * Popovers that are not Customizer catalog controls: they are window-geometry
 * choosers reached by right-clicking the stage/chat buttons.
 */
const NON_CATALOG_POPOVERS = new Set(['stage-preset', 'chat-preset'])

// ── 1. Popover registry integrity ──────────────────────────────────────────
// The single most likely silent regression: a popover that renders but can
// never be opened, or an id the router opens that no longer renders.

describe('control strip: popover registry', () => {
  it('can open every popover it renders', () => {
    const unreachable = RENDERED_POPOVERS.filter(id => !ROUTABLE_POPOVERS.includes(id))
    expect(unreachable, `popovers rendered but never opened: ${unreachable.join(', ')}`).toEqual([])
  })

  it('renders every popover it routes to', () => {
    const missing = ROUTABLE_POPOVERS.filter(id => !RENDERED_POPOVERS.includes(id))
    expect(missing, `popovers routed but never rendered: ${missing.join(', ')}`).toEqual([])
  })

  it('renders each popover exactly once, by either mechanism', () => {
    const templateDuplicates = TEMPLATE_POPOVERS.filter((id) => {
      const pattern = new RegExp(`v-if="activePopover === '${id}'"`, 'g')
      return (shellTemplate.match(pattern) ?? []).length > 1
    })
    const registryDuplicates = REGISTRY_POPOVER_KEYS.filter(
      (id, index) => REGISTRY_POPOVER_KEYS.indexOf(id) !== index,
    )
    expect(templateDuplicates, `duplicate template branches: ${templateDuplicates.join(', ')}`).toEqual([])
    expect(unique(registryDuplicates), `duplicate registry entries: ${unique(registryDuplicates).join(', ')}`).toEqual([])
  })

  it('never renders the same popover from both the registry and an inline branch', () => {
    // Both forms coexisting for one id would mount two components for one click.
    const both = REGISTRY_POPOVERS.filter(id => TEMPLATE_POPOVERS.includes(id))
    expect(both, `popovers rendered twice (registry + template): ${both.join(', ')}`).toEqual([])
  })

  it('classifies every popover as a catalog control or a known window chooser', () => {
    const unknown = RENDERED_POPOVERS.filter(
      id => !CATALOG_IDS.has(id) && !NON_CATALOG_POPOVERS.has(id),
    )
    expect(unknown, `popovers with no catalog entry: ${unknown.join(', ')}`).toEqual([])
  })
})

// ── 2. Button affordances stay wired to the catalog ────────────────────────
// Guides the P1 extraction of the icon / title / short-label `if`-chains into
// lookup tables. Every id these chains mention must be a real catalog control.

describe('control strip: button affordances', () => {
  it('only references catalog ids in badge, icon, title and label branches', () => {
    const referenced = unique([
      ...matchAll(shellTemplate, /btn\.id === '([^']+)'/g),
      ...matchAll(shellScript, /if \(btnId === '([^']+)'\)/g),
      ...matchAll(shellScript.slice(shellScript.indexOf('function getShortLabel')), /'([a-z0-9-]+)':/g),
    ])
    const orphans = referenced.filter(id => !CATALOG_IDS.has(id))
    expect(orphans, `button affordances referencing unknown ids: ${orphans.join(', ')}`).toEqual([])
  })

  it('only ships default buttons that the Customizer can control', () => {
    const orphans = [...DEFAULT_BUTTONS, ...DEFAULT_MOBILE_BUTTONS]
      .map(button => button.id)
      .filter(id => !CATALOG_IDS.has(id))
    expect(unique(orphans), `default buttons missing from the catalog: ${unique(orphans).join(', ')}`).toEqual([])
  })

  it('delegates every default-enabled button to the router or the action dispatcher', () => {
    const dispatchCases = new Set(matchAll(actionSource, /case '([^']+)'/g))
    // 'settings' is intentionally not handled by the dispatcher: the strip
    // emits `control-strip:action` and the host window opens the settings
    // window. See apps/stage-tamagotchi/src/renderer/pages/index.vue.
    const hostHandled = new Set(['settings'])

    const dead = unique(
      [...DEFAULT_BUTTONS, ...DEFAULT_MOBILE_BUTTONS]
        .filter(button => button.enabled)
        .map(button => button.id)
        .filter(id => !ROUTABLE_POPOVERS.includes(id) && !dispatchCases.has(id) && !hostHandled.has(id)),
    )
    expect(dead, `default-enabled buttons with no handler: ${dead.join(', ')}`).toEqual([])
  })

  it.skipIf(TEMPLATE_DOT_IDS.length === 0)('renders a status dot for exactly the ids the presentation layer describes', () => {
    // Pairs the template's inline badge branches with `CONTROL_STRIP_DOT_IDS`,
    // so dropping a badge (or adding one without a resolver) fails here. Skips
    // itself once P5 replaces the branches with a single descriptor-driven span.
    expect(TEMPLATE_DOT_IDS).toEqual([...CONTROL_STRIP_DOT_IDS].sort())
  })
})

// ── 3. Button storage invariants ───────────────────────────────────────────

describe('control strip: stored button invariants', () => {
  it('does not default a desktop-only control onto the mobile strip', () => {
    // `activeButtons` silently filters `desktopOnly` items in mobile mode, so a
    // mobile default in that set renders nothing on web/pocket.
    const hidden = DEFAULT_MOBILE_BUTTONS.filter(button => DESKTOP_ONLY_IDS.has(button.id)).map(button => button.id)
    expect(hidden, `mobile defaults that mobile mode filters out: ${hidden.join(', ')}`).toEqual([])
  })

  it('does not declare the same button twice per platform', () => {
    for (const [platform, buttons] of [
      ['desktop', DEFAULT_BUTTONS],
      ['mobile', DEFAULT_MOBILE_BUTTONS],
    ] as const) {
      const ids = buttons.map(button => button.id)
      const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index)
      expect(duplicates, `duplicate ${platform} defaults: ${unique(duplicates).join(', ')}`).toEqual([])
    }
  })

  it('keeps the persisted button catalog version frozen', () => {
    // CRITICAL: bumping this wipes every user's custom strip arrangement. If a
    // bump is genuinely required, update this expectation in the same commit so
    // the user-visible reset is a reviewed decision, never a drive-by edit.
    const version = CONTROL_STRIP_STORE_SOURCE.match(/const BUTTONS_CATALOG_VERSION = '([^']+)'/)?.[1]
    expect(version).toBe('v5')
  })
})

// ── 4. Cross-window contract ───────────────────────────────────────────────
// The strip is the only writer of these channels. Losing or duplicating one is
// invisible in review but breaks the stage window (selfie viewfinder, caption
// relay, window geometry) at runtime.

describe('control strip: cross-window contract', () => {
  it('dispatches exactly the documented window events', () => {
    const events = unique(
      OWNERSHIP_SOURCES.flatMap(entry => matchAll(entry.source, /new CustomEvent\('([^']+)'/g)),
    )
    expect(events).toEqual([
      'control-strip:action',
      'control-strip:apply-size-preset',
      'control-strip:drag-start',
      'control-strip:open-customizer',
      'control-strip:open-settings',
      'control-strip:popover-changed',
    ])
  })

  it('opens exactly the documented broadcast channels', () => {
    const channels = unique(
      OWNERSHIP_SOURCES.flatMap(entry => matchAll(entry.source, /useBroadcastChannel[^(]*\(\s*\{\s*name:\s*'([^']+)'/g)),
    )
    expect(channels).toEqual([
      'airi-caption-overlay',
      'airi-control-strip-actions',
      'airi:stage-capture',
      'airi:stage-selfie-viewfinder',
    ])
  })

  it('never lets a popover own a broadcast channel', () => {
    // Channels are owned by the shell or by a dedicated `use-control-strip-*`
    // composable. A popover that opens its own channel duplicates the listener
    // in every window that renders it (double selfie capture, double captions).
    const violating = sources
      .filter(entry => entry.file !== SHELL && entry.source.includes('useBroadcastChannel'))
      .map(entry => entry.file)
    expect(violating, `popover components opening broadcast channels: ${violating.join(', ')}`).toEqual([])
  })

  it('keeps the caption relay single-owner while it moves out of the shell', () => {
    // Two live listeners on `airi-caption-overlay` would double-send captions to
    // Stage-Mate. The shell must either own the relay itself or delegate to
    // `useControlStripCaptionRelay` — never both, and never a second copy.
    const shellOwnsRelay = shellSource.includes('name: \'airi-caption-overlay\'')
    const shellDelegatesRelay = shellSource.includes('useControlStripCaptionRelay')

    expect(
      shellOwnsRelay && shellDelegatesRelay,
      'ControlStrip.vue both opens airi-caption-overlay and delegates to useControlStripCaptionRelay',
    ).toBe(false)

    if (shellOwnsRelay) {
      const owners = sources.filter(entry => entry.source.includes('name: \'airi-caption-overlay\''))
      expect(owners.map(owner => owner.file)).toHaveLength(1)
    }
  })
})

// ── 5. Eager bootstrap ratchet ─────────────────────────────────────────────
// The shell's setup currently instantiates the entire state layer whether or
// not a popover is ever opened. This ratchet makes the P2/P3 progress
// measurable and blocks *new* eager work from slipping in.

describe('control strip: eager bootstrap ratchet', () => {
  // Frozen at the state observed before decomposition. Removing entries is the
  // goal; adding one must be a deliberate, reviewed decision.
  const FROZEN_STATE_BOOTSTRAPS = [
    'useAiriCardStore',
    'useBackgroundStore',
    'useCustomVrmAnimationsStore',
    'useDatingSimStore',
    'useDisplayModelsStore',
    'useElectronEventaInvoke',
    'useLive2d',
    'useLiveSessionStore',
    'useMmd',
    'useModelStore',
    'useProvidersStore',
    'useSettings',
    'useSettingsAudioDevice',
    'useSettingsControlStrip',
    'useSettingsControlsIsland',
    'useSettingsStageModel',
    'useSpeechStore',
    'useSpine',
    'useSyncEngineStore',
    'useTextToMotionStore',
  ]

  /**
   * Extracted `use-control-strip-*` helpers are the *target* of the refactor,
   * not eager state. They are allowed to appear in the shell even when they
   * internally reach for a store — the popover-scoped ones are what must not.
   */
  const isStateBootstrap = (name: string) =>
    name.endsWith('Store') || ['useLive2d', 'useMmd', 'useSpine', 'useTheme'].includes(name)

  it('does not add new eager state bootstraps to the shell', () => {
    const current = unique(matchAll(shellScript, /^\s*const \w+ = (use[A-Z]\w*)\(/gm))
    const added = current.filter(name => isStateBootstrap(name) && !FROZEN_STATE_BOOTSTRAPS.includes(name))
    expect(added, `new eager state work in ControlStrip.vue: ${added.join(', ')}`).toEqual([])
  })

  it('keeps at most one mount-time side-effect block', () => {
    const mountHooks = shellSource.match(/onMounted\(/g) ?? []
    expect(mountHooks.length).toBeLessThanOrEqual(1)
  })
})
