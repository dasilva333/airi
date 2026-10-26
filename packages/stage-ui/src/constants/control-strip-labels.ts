/**
 * Presentation tables for the Control Strip button row.
 *
 * Extracted verbatim from `ControlStrip.vue`'s setup — `getButtonIcon`,
 * `getButtonIconColor`, `getButtonTitle`, `getShortLabel`, `geminiDotClasses`
 * and the 21 status-dot template branches — plus the strip's small option
 * tables (window presets, macaron flavours, the stock MMD motion list).
 *
 * Two reasons this exists:
 *  1. This logic currently lives inside `<script setup>` and is therefore
 *     unreachable from tests. As pure functions it gets real unit coverage.
 *  2. The decomposition can adopt it without also restructuring the template,
 *     so a label regression and a structural regression are never in the same
 *     change.
 *
 * NOTHING IS WIRED INTO THE COMPONENT YET. Adoption happens at the popover
 * cutover: `ControlStrip.vue` imports these resolvers, and the 21 inline
 * `<span v-if="btn.id === ...">` dot branches collapse to one span fed by
 * `resolveControlStripDot`.
 *
 * Every resolver is total: an unknown id yields the caller's default, and an
 * unknown id for a dot yields `null` (no badge), matching the previous
 * `if`-chain fall-through behaviour exactly.
 */

// ── Context ────────────────────────────────────────────────────────────────

/**
 * Everything the button row can read. The caller (initially the component,
 * later `useControlStripButtonPresentation`) supplies a plain snapshot, which
 * keeps these resolvers free of reactivity and trivially testable.
 */
export interface ControlStripPresentationContext {
  // theme (via @proj-airi/ui useTheme)
  themeMode: string
  isDark: boolean
  // platform
  stageTamagotchi: boolean
  // control strip store
  workspaceOpen: boolean
  stageDisabled: boolean
  stageEnabled: boolean
  stageMateEnabled: boolean
  chatOpen: boolean
  captionOpen: boolean
  interactionMode: string
  stageMode: string
  // settings store
  captionDocking: string
  captionLayoutMode: string
  captionFollowStagePosition: boolean
  captionFollowStageVisibility: boolean
  headTetheredCaptionEnabled: boolean
  // audio device store
  micEnabled: boolean
  // live session store
  powerState: string
  // controls island store
  fadeOnHoverEnabled: boolean
  alwaysOnTop: boolean
  // stage model settings
  gunslingerStance: string
  // background store
  activeAtmosphereId: string
  activeBackgroundId: string
  chatboxActiveAtmosphereId: string
  chatboxActiveBackgroundId: string
}

// ── Label tables ───────────────────────────────────────────────────────────

export const GUNSLINGER_STANCE_LABELS: Record<string, string> = {
  off: 'Disabled (Safe)',
  cat: 'Cat Gun (Rapid Spray)',
  blk: 'M1911 Black (.45 ACP)',
  gray: 'M1911 Silver (Steel Custom)',
}

export const INTERACTION_MODE_LABELS: Record<string, string> = {
  tactile: 'Tactile (Rose)',
  drag: 'Drag (Orange)',
  positioning: 'Positioning (Emerald)',
  orbit: 'Orbit (Indigo)',
}

export const SESSION_STATE_LABELS: Record<string, string> = {
  off: 'Disconnected (Gray)',
  connecting: 'Connecting (Sky Blue)',
  active: 'Listening / Idle (Red)',
  busy: 'Transmitting / Speaking (Purple)',
  ambient: 'Witness Mode Active (Amber)',
}

export const CAPTION_DOCKING_TITLES: Record<string, string> = {
  none: 'Caption Docking: NONE',
  bottom: 'Caption Docking: BOTTOM',
  top: 'Caption Docking: TOP',
  head: 'Caption Docking: HEAD',
}

export const INTERACTION_MODE_SHORT_LABELS: Record<string, string> = {
  tactile: 'Tact',
  drag: 'Drag',
  positioning: 'Pos',
  orbit: 'Orbt',
}

export const CAPTION_DOCKING_SHORT_LABELS: Record<string, string> = {
  none: 'None',
  bottom: 'Bot',
  top: 'Top',
  head: 'Head',
}

/**
 * Static short labels, rendered instead of the icon while a button is hovered.
 * The two state-dependent ids (`viewport-cycle-modes`, `caption-docking`) are
 * resolved separately by `resolveControlStripShortLabel`.
 */
export const CONTROL_STRIP_SHORT_LABELS: Record<string, string> = {
  'stage-atmosphere': 'Theme',
  'chat': 'Chat',
  'mic': 'Mic',
  'stage': 'Stage',
  'stage-mate': 'Mate',
  'caption': 'CC',
  'gemini-session': 'Live',
  'settings': 'Set',
  'layout': 'Edit',
  'viewport-auto-hide': 'Hide',
  'always-on-top': 'Pin',
  'viewport-tactile': 'Touch',
  'viewport-drag': 'Drag',
  'viewport-positioning': 'Pos',
  'viewport-orbit': 'Orbit',
  'viewport-reset-coordinates': 'Reset',
  'actor-characters': 'Char',
  'actor-avatars': 'Avtr',
  'actor-wardrobe': 'Wear',
  'actor-motions': 'Move',
  'actor-motion-playground': 'Move',
  'actor-all-emotions': 'Mood',
  'actor-vfx': 'VFX',
  'actor-selfies': 'Self',
  'actor-macaron': 'Snack',
  'workspace': 'Work',
  'theme-mode': 'Color',
  'caption-layout-mode': 'Rows',
  'caption-sync-position': 'Pos↔',
  'caption-sync-visibility': 'Vis↔',
  'head-tethered-caption': 'HeadCC',
  'caption-theme-mode': 'Theme',
  'caption-opacity': 'Opac',
  'exit-app': 'Quit',
}

// ── Option tables ──────────────────────────────────────────────────────────

export const WINDOW_SIZE_PRESETS = [
  { name: 'mini', icon: 'i-solar:minimize-square-3-linear', label: 'Mini' },
  { name: 'medium', icon: 'i-solar:maximize-square-2-linear', label: 'Medium' },
  { name: 'large', icon: 'i-solar:maximize-square-3-linear', label: 'Large' },
  { name: 'full', icon: 'i-solar:screencast-linear', label: 'Full' },
] as const

export const GEMINI_LIVE_VOICES = ['Leda', 'Zephyr', 'Achernar', 'Algenib', 'Fenrir']

/**
 * Motions that ship with the MMD renderer. The store lists them alongside
 * generated motions; anything absent from this set came from the user or the
 * motion generator, which is what the "Gen" filter tab keys off.
 *
 * Previously duplicated verbatim in both `genMotionsCount` and `filteredMotions`.
 */
export const STOCK_MMD_MOTIONS = [
  'brushoff_nice_and_tidy.vmd',
  'circulation.vmd',
  'crossed_arms_look_around_confident.vmd',
  'fixing_hair_or_wig.vmd',
  'getting_item_out_of_bra.vmd',
  'hat_flip.vmd',
  'impatient_foot_tapping.vmd',
  'shy.vmd',
  'skittish_mermay.vmd',
  'smelling_something_in_the_air.vmd',
  'something_in_the_sky.vmd',
  'stretching.vmd',
  'swaying_arms_and_hips.vmd',
  'tracker.vmd',
] as const

export const FEATURED_MACARONS = [
  { id: 'strawberry_cream', name: 'Strawberry Cream', emoji: '🍓', shell: 'pink', whip: 'berry', heart: 'pink' },
  { id: 'matcha_classic', name: 'Matcha Classic', emoji: '🍵', shell: 'green', whip: 'matcha', heart: 'green' },
  { id: 'blueberry_whip', name: 'Blueberry Whip', emoji: '🫐', shell: 'blue', whip: 'berry', heart: 'purple' },
  { id: 'mint_choco', name: 'Mint Choco', emoji: '🍫', shell: 'blue', whip: 'chocolate', heart: 'brawn' },
  { id: 'lemon_custard', name: 'Lemon Custard', emoji: '🍋', shell: 'yellow', whip: 'milk', heart: 'yellow' },
  { id: 'lavender_berry', name: 'Lavender Berry', emoji: '💜', shell: 'purple', whip: 'berry', heart: 'purple' },
  { id: 'mocha_caramel', name: 'Mocha Caramel', emoji: '☕', shell: 'brawn', whip: 'chocolate', heart: 'brawn' },
  { id: 'vanilla_strawberry', name: 'Vanilla Strawberry', emoji: '🍦', shell: 'pink', whip: 'milk', heart: 'blue' },
  { id: 'chocolate_berry', name: 'Chocolate Berry', emoji: '🍩', shell: 'pink', whip: 'chocolate', heart: 'brawn' },
] as const

export const MACARON_SHELL_OPTIONS = [
  { value: 'pink', label: 'Pastel Pink' },
  { value: 'green', label: 'Green Tea' },
  { value: 'blue', label: 'Ice Blue' },
  { value: 'yellow', label: 'Lemon Yellow' },
  { value: 'purple', label: 'Soft Purple' },
  { value: 'brawn', label: 'Roast Brown' },
  { value: 'orange', label: 'Peach Orange' },
]

export const MACARON_WHIP_OPTIONS = [
  { value: 'berry', label: 'Berry Cream' },
  { value: 'matcha', label: 'Matcha Cream' },
  { value: 'milk', label: 'Fresh Milk' },
  { value: 'chocolate', label: 'Rich Cocoa' },
  { value: 'strawberry', label: 'Strawberry Puree' },
]

export const MACARON_HEART_OPTIONS = [
  { value: 'pink', label: 'Pink Heart' },
  { value: 'green', label: 'Green Heart' },
  { value: 'blue', label: 'Blue Heart' },
  { value: 'yellow', label: 'Yellow Heart' },
  { value: 'purple', label: 'Purple Heart' },
  { value: 'brawn', label: 'Chocolate Heart' },
  { value: 'orange', label: 'Caramel Heart' },
]

// ── Avatars ────────────────────────────────────────────────────────────────

export const CARD_INITIAL_PALETTE = [
  'bg-sky-500/25 text-sky-300',
  'bg-purple-500/25 text-purple-300',
  'bg-amber-500/25 text-amber-300',
  'bg-emerald-500/25 text-emerald-300',
  'bg-rose-500/25 text-rose-300',
  'bg-indigo-500/25 text-indigo-300',
  'bg-teal-500/25 text-teal-300',
  'bg-fuchsia-500/25 text-fuchsia-300',
]

/** Stable hashed colour class for a character's initials badge. */
export function cardInitialColor(name: string): string {
  let hash = 0
  for (let index = 0; index < name.length; index++)
    hash = name.charCodeAt(index) + ((hash << 5) - hash)
  return CARD_INITIAL_PALETTE[Math.abs(hash) % CARD_INITIAL_PALETTE.length]
}

// ── Icon resolution ────────────────────────────────────────────────────────

export function resolveControlStripIcon(
  btnId: string,
  ctx: Pick<ControlStripPresentationContext, 'themeMode' | 'isDark' | 'captionDocking' | 'captionLayoutMode'>,
  defaultIcon: string,
): string {
  if (btnId === 'actor-gunslinger')
    return 'i-ph:crosshair-bold'
  if (btnId === 'viewport-cycle-modes')
    return 'i-solar:cursor-bold-duotone'
  if (btnId === 'theme-mode') {
    if (ctx.themeMode === 'auto')
      return 'i-solar:laptop-minimalistic-linear'
    return ctx.isDark ? 'i-solar:moon-linear' : 'i-solar:sun-linear'
  }
  if (btnId === 'caption-docking')
    return ctx.captionDocking === 'top' ? 'i-solar:align-top-line-duotone' : 'i-solar:align-bottom-line-duotone'
  if (btnId === 'caption-layout-mode')
    return ctx.captionLayoutMode === 'multi' ? 'i-solar:layers-linear' : 'i-solar:window-frame-linear'
  if (btnId === 'stage-atmosphere')
    return 'i-solar:magic-stick-3-bold-duotone'
  return defaultIcon
}

export function resolveControlStripIconColor(
  btnId: string,
  ctx: Pick<
    ControlStripPresentationContext,
    | 'gunslingerStance'
    | 'interactionMode'
    | 'stageTamagotchi'
    | 'workspaceOpen'
    | 'activeAtmosphereId'
    | 'activeBackgroundId'
    | 'chatboxActiveAtmosphereId'
    | 'chatboxActiveBackgroundId'
  >,
): string {
  if (btnId === 'actor-gunslinger') {
    if (ctx.gunslingerStance === 'cat')
      return 'text-pink-400 dark:text-pink-300'
    if (ctx.gunslingerStance === 'blk')
      return 'text-emerald-400 dark:text-emerald-300'
    if (ctx.gunslingerStance === 'gray')
      return 'text-cyan-400 dark:text-cyan-300'
    return 'text-neutral-500 opacity-50'
  }
  if (btnId === 'viewport-cycle-modes') {
    if (ctx.interactionMode === 'tactile')
      return 'text-rose-500 dark:text-rose-400'
    if (ctx.interactionMode === 'drag')
      return 'text-orange-500 dark:text-orange-400'
    if (ctx.interactionMode === 'positioning')
      return 'text-emerald-500 dark:text-emerald-400'
    if (ctx.interactionMode === 'orbit')
      return 'text-indigo-500 dark:text-indigo-400'
    // Unknown mode falls through to the id checks below, as before.
  }
  if (btnId === 'stage-atmosphere') {
    const hasStageActive = ctx.activeAtmosphereId !== 'none' || ctx.activeBackgroundId !== 'none'
    const hasChatboxActive = ctx.stageTamagotchi
      && (ctx.chatboxActiveAtmosphereId !== 'none' || ctx.chatboxActiveBackgroundId !== 'none')
    if (hasStageActive || hasChatboxActive)
      return 'text-amber-500 dark:text-amber-400'
    return 'text-neutral-500 opacity-50'
  }
  if (btnId === 'workspace')
    return ctx.workspaceOpen ? 'text-primary-500 dark:text-primary-400' : 'text-neutral-500 opacity-70'
  return ''
}

// ── Tooltip resolution ─────────────────────────────────────────────────────

export function resolveControlStripTitle(
  btnId: string,
  ctx: Pick<
    ControlStripPresentationContext,
    | 'gunslingerStance'
    | 'interactionMode'
    | 'chatOpen'
    | 'stageDisabled'
    | 'stageEnabled'
    | 'stageMateEnabled'
    | 'micEnabled'
    | 'captionOpen'
    | 'powerState'
    | 'captionDocking'
    | 'captionLayoutMode'
    | 'captionFollowStagePosition'
    | 'captionFollowStageVisibility'
    | 'headTetheredCaptionEnabled'
    | 'stageTamagotchi'
    | 'activeAtmosphereId'
    | 'activeBackgroundId'
    | 'chatboxActiveAtmosphereId'
  >,
  defaultLabel: string,
): string {
  if (btnId === 'actor-gunslinger')
    return `Gunslinger Stance: ${GUNSLINGER_STANCE_LABELS[ctx.gunslingerStance] || 'Disabled'}`
  if (btnId === 'viewport-cycle-modes')
    return `Cycle Viewport Modes: ${INTERACTION_MODE_LABELS[ctx.interactionMode] || 'Tactile'}`
  if (btnId === 'chat')
    return `Chat Toggle: ${ctx.chatOpen ? 'Open (Green)' : 'Closed (Red)'}`
  if (btnId === 'stage') {
    if (ctx.stageDisabled)
      return 'Actor Stage: Disabled (--disable-webgl-stage)'
    return `Actor Stage: ${ctx.stageEnabled ? 'Visible (Green)' : 'Hidden (Red)'}`
  }
  if (btnId === 'stage-mate')
    return `Stage Mate: ${ctx.stageMateEnabled ? 'Active (Green)' : 'Disabled (Red)'}`
  if (btnId === 'mic')
    return `Microphone: ${ctx.micEnabled ? 'Active (Green)' : 'Muted (Red)'}`
  if (btnId === 'caption')
    return `Captions: ${ctx.captionOpen ? 'Active (Green)' : 'Disabled (Red)'}`
  if (btnId === 'gemini-session')
    return `Speech Session: ${SESSION_STATE_LABELS[ctx.powerState] || 'Disconnected (Gray)'}`
  if (btnId === 'caption-docking')
    return CAPTION_DOCKING_TITLES[ctx.captionDocking ?? 'none'] ?? 'Caption Docking: NONE'
  if (btnId === 'caption-layout-mode')
    return `Caption Layout: ${ctx.captionLayoutMode === 'multi' ? 'Multi-line History (Indigo)' : 'Standard Bubble (Teal)'}`
  if (btnId === 'caption-sync-position')
    return `Caption Sync Position: ${ctx.captionFollowStagePosition ? 'ON (Green)' : 'OFF (Red)'}`
  if (btnId === 'caption-sync-visibility')
    return `Caption Sync Visibility: ${ctx.captionFollowStageVisibility ? 'ON (Green)' : 'OFF (Red)'}`
  if (btnId === 'head-tethered-caption')
    return `Head-Tethered Caption: ${ctx.headTetheredCaptionEnabled ? 'ON (Green)' : 'OFF (Red)'}`
  if (btnId === 'stage-atmosphere') {
    if (ctx.stageTamagotchi)
      return `Theme & Atmosphere (Stage: ${ctx.activeAtmosphereId}, Chat: ${ctx.chatboxActiveAtmosphereId})`
    return `Stage Theme & Atmosphere (${ctx.activeAtmosphereId}, ${ctx.activeBackgroundId !== 'none' ? 'Wallpaper' : 'No Wallpaper'})`
  }
  return defaultLabel
}

// ── Short label resolution ─────────────────────────────────────────────────

export function resolveControlStripShortLabel(
  btnId: string,
  ctx: Pick<ControlStripPresentationContext, 'interactionMode' | 'captionDocking'>,
): string {
  if (btnId === 'viewport-cycle-modes')
    return INTERACTION_MODE_SHORT_LABELS[ctx.interactionMode] ?? 'Modes'
  if (btnId === 'caption-docking')
    return CAPTION_DOCKING_SHORT_LABELS[ctx.captionDocking] ?? 'Dock'
  return CONTROL_STRIP_SHORT_LABELS[btnId] || btnId.substring(0, 4)
}

// ── Status dot resolution ──────────────────────────────────────────────────

const DOT_BASE = 'absolute right-1 top-1 h-1.5 w-1.5 rounded-full'
const DOT_TRANSITION_COLORS = 'transition-colors duration-200'
const DOT_TRANSITION_ALL = 'transition-all duration-200'
const DOT_TRANSITION_ALL_SLOW = 'transition-all duration-300'

const CAPTION_DOCKING_DOTS: Record<string, string> = {
  none: 'bg-neutral-400 shadow-[0_0_6px_rgba(163,163,163,0.5)]',
  bottom: 'bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.5)]',
  top: 'bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.5)]',
  head: 'bg-fuchsia-400 shadow-[0_0_6px_rgba(232,121,249,0.5)]',
}

const INTERACTION_MODE_DOTS: Record<string, string> = {
  tactile: 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.5)]',
  drag: 'bg-orange-500 shadow-[0_0_6px_rgba(249,115,22,0.5)]',
  positioning: 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]',
  orbit: 'bg-indigo-500 shadow-[0_0_6px_rgba(99,102,241,0.5)]',
}

const GUNSLINGER_DOTS: Record<string, string> = {
  off: 'bg-neutral-500/40',
  cat: 'bg-pink-400 shadow-[0_0_6px_rgba(244,114,182,0.6)]',
  blk: 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]',
  gray: 'bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.6)]',
}

const GEMINI_SESSION_DOTS: Record<string, string> = {
  busy: 'bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.8)] animate-pulse',
  active: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.7)]',
  connecting: 'bg-sky-400 animate-pulse',
  ambient: 'bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.6)]',
}

function dot(transition: string, state: string): string {
  return [DOT_BASE, transition, state].filter(Boolean).join(' ')
}

/**
 * Buttons that render a status dot. Mirrors the 21 `<span v-if="btn.id === …">`
 * badge branches that used to live in the template; kept as data so the set can
 * be asserted against the Customizer catalog.
 */
export const CONTROL_STRIP_DOT_IDS: ReadonlySet<string> = new Set([
  'stage',
  'stage-mate',
  'chat',
  'mic',
  'caption',
  'stage-atmosphere',
  'gemini-session',
  'viewport-auto-hide',
  'always-on-top',
  'viewport-tactile',
  'viewport-drag',
  'viewport-positioning',
  'viewport-orbit',
  'caption-sync-position',
  'caption-sync-visibility',
  'head-tethered-caption',
  'theme-mode',
  'caption-docking',
  'viewport-cycle-modes',
  'actor-gunslinger',
  'caption-layout-mode',
])

/**
 * Full class list for a button's status dot, or `null` when the button has no
 * dot. Returning the complete list lets the template collapse the 21 inline
 * badge branches into a single `<span v-if="button.dot" :class="button.dot" />`.
 */
export function resolveControlStripDot(
  btnId: string,
  ctx: Pick<
    ControlStripPresentationContext,
    | 'stageDisabled'
    | 'stageEnabled'
    | 'stageMateEnabled'
    | 'chatOpen'
    | 'micEnabled'
    | 'captionOpen'
    | 'stageTamagotchi'
    | 'activeAtmosphereId'
    | 'activeBackgroundId'
    | 'chatboxActiveAtmosphereId'
    | 'chatboxActiveBackgroundId'
    | 'powerState'
    | 'fadeOnHoverEnabled'
    | 'alwaysOnTop'
    | 'stageMode'
    | 'captionFollowStagePosition'
    | 'captionFollowStageVisibility'
    | 'headTetheredCaptionEnabled'
    | 'themeMode'
    | 'isDark'
    | 'captionDocking'
    | 'interactionMode'
    | 'gunslingerStance'
    | 'captionLayoutMode'
  >,
): string | null {
  switch (btnId) {
    case 'stage':
      return dot(
        DOT_TRANSITION_COLORS,
        ctx.stageDisabled ? 'bg-neutral-400 dark:bg-neutral-600' : ctx.stageEnabled ? 'bg-green-500' : 'bg-red-500',
      )
    case 'stage-mate':
      return dot(DOT_TRANSITION_COLORS, ctx.stageMateEnabled ? 'bg-green-500' : 'bg-red-500')
    case 'chat':
      return dot(DOT_TRANSITION_COLORS, ctx.chatOpen ? 'bg-green-500' : 'bg-red-500')
    case 'mic':
      return dot(DOT_TRANSITION_COLORS, ctx.micEnabled ? 'bg-green-500' : 'bg-red-500')
    case 'caption':
      return dot(DOT_TRANSITION_COLORS, ctx.captionOpen ? 'bg-green-500' : 'bg-red-500')
    case 'stage-atmosphere': {
      const active = ctx.activeAtmosphereId !== 'none'
        || ctx.activeBackgroundId !== 'none'
        || (ctx.stageTamagotchi
          && (ctx.chatboxActiveAtmosphereId !== 'none' || ctx.chatboxActiveBackgroundId !== 'none'))
      return dot(DOT_TRANSITION_COLORS, active ? 'bg-amber-400 dark:bg-amber-300' : 'bg-neutral-400 opacity-50')
    }
    case 'gemini-session':
      return dot(DOT_TRANSITION_ALL_SLOW, GEMINI_SESSION_DOTS[ctx.powerState] ?? 'bg-neutral-400/50')
    case 'viewport-auto-hide':
      return dot(DOT_TRANSITION_COLORS, ctx.fadeOnHoverEnabled ? 'bg-green-500' : 'bg-red-500')
    case 'always-on-top':
      return dot(DOT_TRANSITION_COLORS, ctx.alwaysOnTop ? 'bg-green-500' : 'bg-red-500')
    case 'viewport-tactile':
      return dot(DOT_TRANSITION_COLORS, ctx.stageMode === 'tactileMode' ? 'bg-green-500' : 'bg-red-500')
    case 'viewport-drag':
      return dot(DOT_TRANSITION_COLORS, ctx.stageMode === 'dragMode' ? 'bg-green-500' : 'bg-red-500')
    case 'viewport-positioning':
      return dot(DOT_TRANSITION_COLORS, ctx.stageMode === 'positionMode' ? 'bg-green-500' : 'bg-red-500')
    case 'viewport-orbit':
      return dot(DOT_TRANSITION_COLORS, ctx.stageMode === 'orbitMode' ? 'bg-green-500' : 'bg-red-500')
    case 'caption-sync-position':
      return dot(DOT_TRANSITION_COLORS, ctx.captionFollowStagePosition ? 'bg-green-500' : 'bg-red-500')
    case 'caption-sync-visibility':
      return dot(DOT_TRANSITION_COLORS, ctx.captionFollowStageVisibility ? 'bg-green-500' : 'bg-red-500')
    case 'head-tethered-caption':
      return dot(DOT_TRANSITION_COLORS, ctx.headTetheredCaptionEnabled ? 'bg-green-500' : 'bg-red-500')
    case 'theme-mode':
      return dot(
        DOT_TRANSITION_COLORS,
        ctx.themeMode === 'auto' ? 'bg-cyan-500' : ctx.isDark ? 'bg-green-500' : 'bg-amber-500',
      )
    case 'caption-docking':
      return dot(DOT_TRANSITION_ALL, CAPTION_DOCKING_DOTS[ctx.captionDocking] ?? '')
    case 'viewport-cycle-modes':
      return dot(DOT_TRANSITION_ALL, INTERACTION_MODE_DOTS[ctx.interactionMode] ?? '')
    case 'actor-gunslinger':
      return dot(DOT_TRANSITION_ALL, GUNSLINGER_DOTS[ctx.gunslingerStance] ?? '')
    case 'caption-layout-mode':
      return dot(
        DOT_TRANSITION_COLORS,
        ctx.captionLayoutMode === 'multi'
          ? 'bg-indigo-400 shadow-[0_0_6px_rgba(129,140,248,0.5)]'
          : 'bg-teal-400 shadow-[0_0_6px_rgba(45,212,191,0.5)]',
      )
    default:
      return null
  }
}
