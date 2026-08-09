/**
 * Live2D DSL type system.
 *
 * These types mirror the *manifest wire format* exactly as observed in
 * `docs/live2d-special-sauce-insights.md` — PascalCase keys, `#`/`:` lane and
 * priority hints embedded in names — because they are parsed straight from
 * pruned `.model.json` / `.model3.json` custom motion-group entries.
 */

/** Type 1 VarFloat: a guard clause. If any guard in the entry fails, the entry is discarded. */
export interface VarFloatCondition {
  Name: string
  Type: 1
  Code: string // "equal 1" | "not_equal 0" | "greater 5" | "greater_equal 4" | "less 10" | "lower 255" | "lower_equal 0"
}

/** Type 2 VarFloat: a state mutation. Executed only after every Type 1 guard in the entry passes. */
export interface VarFloatMutation {
  Name: string
  Type: 2
  Code: string // "assign 1" | "assign rand(20,25)" | "add 15" | "subtract 0.5" | "init 1"
}

export type VarFloat = VarFloatCondition | VarFloatMutation

/** Affinity / intimacy gate + reward. `Min`/`Max` gate eligibility; `Bonus` is written back on success. */
export interface IntimacyBounds {
  Min?: number
  Max?: number
  Bonus?: number
}

/** Seasonal / time-of-day gate. Evaluated against the runtime clock. */
export interface TimeLimitBounds {
  Month?: number
  Sustain?: number
}

/** A single selectable choice inside a Choices menu. */
export interface DslChoice {
  Text: string
  NextMtn?: string
  [extra: string]: unknown
}

/**
 * A candidate interaction entry inside a motion group (the "special sauce"
 * object that was pruned from manifests to avoid WebGL crashes).
 */
export interface DslEntry {
  Command?: string
  PostCommand?: string
  VarFloats?: VarFloat[]
  Intimacy?: IntimacyBounds
  TimeLimit?: TimeLimitBounds
  Choices?: DslChoice[]
  Text?: string
  TextDuration?: number
  Weight?: number
  NextMtn?: string
  MotionDuration?: number
  Language?: string
  Sound?: string
  SoundLoop?: boolean
  SoundChannel?: number
  SoundVolume?: number
  Ignorable?: boolean
  Interruptable?: boolean
  Expression?: string
  FadeIn?: number
  FadeOut?: number
  [extra: string]: unknown
}

/**

 * A named motion group: an ordered list of candidate entries. Selection among
 * them is guard-filtered, intimacy/time-gated, then weight-random.
 */
export interface DslMotionGroup {
  name: string
  entries: DslEntry[]
}

/** A normalized, language-matched choice ready for the UI bridge. */
export interface ResolvedChoice {
  text: string
  nextMtn?: string
  raw: DslChoice
}

/** The kinds of executable instructions produced by the command parser. */
export type DslCommandKind
  = | 'start_mtn'
    | 'clear_exp'
    | 'change_cos'
    | 'motions'
    | 'mouse_tracking'
    | 'eye_blink'
    | 'stop_sound'
    | 'replace_tex'
    | 'noop'

/** A target reference like `Sound#1:011501_051_01_01` or `Leave60_70_80`. */
export interface MotionRef {
  /** Group/track name with the `#priority` lane hint stripped (e.g. `Sound`). */
  group: string
  /** Optional numeric priority/lane marker parsed from `#N`. */
  lane?: number
  /** Optional item/sub-selection after the `:` separator. */
  item?: string
  /** Original unparsed target string. */
  raw: string
}

/** A single parsed instruction from a `;`-delimited command chain. */
export type DslCommand
  = | { kind: 'start_mtn', target: MotionRef, raw: string }
    | { kind: 'clear_exp', raw: string }
    | { kind: 'change_cos', modelFile: string, index?: number, raw: string }
    | { kind: 'motions', enabled: boolean, target: MotionRef, raw: string }
    | { kind: 'mouse_tracking', enabled: boolean, raw: string }
    | { kind: 'eye_blink', enabled: boolean, raw: string }
    | { kind: 'stop_sound', channel: number, raw: string }
    | { kind: 'replace_tex', textureIndex: number, file: string, raw: string }
    | { kind: 'noop', raw: string }
