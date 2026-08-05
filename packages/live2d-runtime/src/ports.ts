/**
 * Output ports: the only way the headless runtime talks to the outside world.
 *
 * The runtime never imports PIXI/Vue/DOM. A host (e.g. `packages/stage-ui-live2d`'s
 * `Live2DRuntimeAdapter`, or a Vitest fake) implements these interfaces. Each method
 * returns `void`; long-running effects expose completion through their own domain
 * events (e.g. the music/audio side emits a finish signal), not through promises.
 */

import type { DslEntry, MotionRef, ResolvedChoice } from './dsl/types'

/** Plays body motions / animation groups on the stage viewport. */
export interface IMotionSink {
  /** Play a motion lane. Parallel `start_mtn` calls map to distinct lanes (Body, Face#2, ...). */
  startMotion: (ref: MotionRef) => void
  /** Stop/clear currently running motions (maps to stopAllMotions). */
  stopAllMotions: () => void
  /** Gate a motion pool on/off (`motions enable/disable <group>`). */
  setMotionGroupEnabled: (ref: MotionRef, enabled: boolean) => void
}

/** Routes model-bound audio (voice / BGM / environmental) onto sound channels. */
export interface ISoundSink {
  /** Play a model-packaged sound file on a channel. 0=voice, 1=BGM, 2=ENV. */
  playSound: (file: string, options: { channel: number, loop?: boolean, volume?: number }) => void
  /** Stop a channel (`stop_sound <channel>`). */
  stopSound: (channel: number) => void
}

/** Applies/resets facial expressions (blendshape overrides). */
export interface IExpressionSink {
  /** Apply an expression file (e.g. `exp01.exp3`). */
  applyExpression: (file: string) => void
  /** Clear persistent expressions back to the base face (`clear_exp`). */
  clearExpressions: () => void
}

/** Swaps the active costume/model while keeping runtime state intact (`change_cos`). */
export interface ICostumeSwapper {
  /**
   * Swap to another model manifest. The VarFloats heap and intimacy are preserved
   * by the runtime; the host only swaps the renderable.
   */
  changeCostume: (modelFile: string) => void
}

/** Persistent affinity store (e.g. backed by the dating-sim variables). */
export interface IIntimacyStore {
  /** Current persistent intimacy score. */
  getIntimacy: () => number
  /** Apply a bonus/penalty delta. */
  addIntimacy: (delta: number) => void
}

/** Feature toggles for gaze/blink subsystems. */
export interface ITrackingSink {
  setMouseTracking: (enabled: boolean) => void
  setEyeBlink: (enabled: boolean) => void
}

/** Replace a model texture at runtime (`replace_tex <index> <file>`). */
export interface ITextureSink {
  replaceTexture: (textureIndex: number, file: string) => void
}

/** Event bus toward the UI bridge (choice overlay, subtitles, lifecycle). */
export interface IEventEmitter {
  /** Present a glassmorphic choice menu composed over the stage. */
  showChoices: (payload: { text?: string, textDuration?: number, choices: ResolvedChoice[], rawEntry: DslEntry }) => void
  /** Show / relay a text line (subtitle / toast / caption). */
  showText: (payload: { text: string, duration?: number, rawEntry: DslEntry }) => void
  /** The active costume is about to change; render a crossfade if desired. */
  onCostumeWillSwap: (modelFile: string) => void
  /** Intimacy changed via a DSL `Bonus`. */
  onIntimacyChanged: (next: number, delta: number) => void
}

/** Abstracts time so the engine is deterministic under test. */
export interface IClock {
  /** Current epoch ms (for `{$timenow}` and TimeLimit month/day checks). */
  now: () => number
}

/** System wall clock. */
export const systemClock: IClock = { now: () => Date.now() }

/** Aggregate bag of every port a host can supply; all optional so hosts implement progressively. */
export interface Live2DRuntimePorts {
  motion?: IMotionSink
  sound?: ISoundSink
  expression?: IExpressionSink
  costume?: ICostumeSwapper
  intimacy?: IIntimacyStore
  tracking?: ITrackingSink
  texture?: ITextureSink
  events?: IEventEmitter
  clock?: IClock
}
