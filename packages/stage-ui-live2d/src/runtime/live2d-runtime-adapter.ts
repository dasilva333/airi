/**
 * Live2DRuntimeAdapter — bridges the headless `@proj-airi/live2d-runtime` DSL VM onto
 * the live `pixi-live2d-display` model that `Model.vue` already owns.
 *
 * This adapter is deliberately additive: it does not replace the existing motion
 * playback / beat-sync / ArtMesh pipeline. It only implements the DSL output ports by
 * delegating to facilities the host already has (motionManager, expressionManager,
 * SoundManager, focusController) and defers view-level effects (choice overlay, speech
 * text, costume hot-swap) to a small `RenderHostActions` surface the component supplies.
 */

import type {
  DslEntry,
  IEventEmitter,
  IMotionSink,
  ISoundSink,
  ITrackingSink,
  MotionRef,
  ResolvedChoice,
} from '@proj-airi/live2d-runtime'
import type { Live2DModel } from 'pixi-live2d-display/cubism4'

import { MotionPriority } from 'pixi-live2d-display/cubism4'

/**
 * Rendering-host effects that depend on the Vue shell, not on the PIXI model. The VM never
 * touches these directly; it emits events and Model.vue reacts.
 */
export interface RenderHostActions {
  /**
   * Hot-swap the rendered costume/model while keeping DSL heap + intimacy intact.
   * The runtime owns state; the host swaps the renderable (see plan §3.2 change_cos).
   */
  changeCostume: (modelFile: string) => void | Promise<void>
  /** Present a speech line (toast on non-stage routes, caption channel on stage). */
  showSpeechText: (text: string, options: { duration?: number, language?: string }) => void
  /** Render the interactive choice overlay. Selection resolves via VM.selectChoice. */
  showChoices: (payload: {
    text?: string
    textDuration?: number
    choices: ResolvedChoice[]
    rawEntry: DslEntry
  }) => void
}

export interface Live2DRuntimeAdapterConfig {
  /** The loaded model (works for both cubism4 and cubism2 internal models). */
  model: Live2DModel<any>
  /** Persistence-intimacy read from the host's store. */
  getIntimacy: () => number
  /** Persistence-intimacy write-back (will be wired to the dating-sim store). */
  addIntimacy: (delta: number) => void
  /** View-level effects implemented by Model.vue. */
  host: RenderHostActions
  /**
   * Resolve the URL for a model-relative file like a sound clip (`Motions_Sound#1_0_Sound_0.wav`)
   * or a replacement texture. Required for sound + texture playback.
   */
  resolveAssetUrl?: (file: string) => string
  /** Optional intimacy hard ceiling clamp (defaults to none). */
  clampIntimacy?: (v: number) => number
}

/**
 * The bundle of runtime output ports this adapter produces. Each field matches a
 * `Live2DRuntimePorts` member from `@proj-airi/live2d-runtime` and can be spread into
 * the VM host: `new DSLVirtualMachine({ host: adapter.ports })`.
 */
export class Live2DRuntimeAdapter {
  private readonly model: Live2DModel<any>
  private readonly cfg: Live2DRuntimeAdapterConfig

  constructor(config: Live2DRuntimeAdapterConfig) {
    this.cfg = config
    this.model = config.model
  }

  private get internalModel() {
    return this.model?.internalModel as any
  }

  // -- Motion (IMotionSink) ------------------------------------------------

  readonly motion: IMotionSink = {
    startMotion: (ref: MotionRef) => this.startMotion(ref),
    stopAllMotions: () => this.stopAllMotions(),
    setMotionGroupEnabled: (ref: MotionRef, enabled: boolean) => {
      void ref
      void enabled
      // Motion-pool gating is applied by the VM; the render host's `live2dIdleAnimationEnabled`
      // prop already gates idle playback. No IT motion-manager switch exists to toggle here.
    },
  }

  private startMotion(ref: MotionRef): void {
    const motionManager = this.internalModel?.motionManager
    if (!motionManager)
      return

    // The DSL's parallel lanes (Body, Sound#1 voice, Face#2 face) each carry a motion or
    // audio item. The motion manager keys those groups by their base name (`motionName`),
    // and the item selects the index inside it (0 by default).
    const index = ref.item != null && /^\d+$/.test(ref.item) ? Number(ref.item) : 0
    void motionManager.startMotion(ref.group, index, MotionPriority.FORCE).catch(() => {
      // Unknown DSL group on the physical model: harmless — DSL motion groups are a superset.
    })
  }

  private stopAllMotions(): void {
    this.internalModel?.motionManager?.stopAllMotions()
  }

  // -- Sound (ISoundSink) --------------------------------------------------

  readonly sound: ISoundSink = {
    playSound: (file, options) => this.playSound(file, options.channel, options.loop, options.volume),
    stopSound: channel => this.stopSound(channel),
  }

  private readonly channelAudios = new Map<number, HTMLAudioElement>()

  private playSound(file: string, channel: number, loop?: boolean, volume?: number): void {
    const url = this.cfg.resolveAssetUrl?.(file)
    if (!url) {
      // Without a resolver we cannot fetch opaque zip/OPFS assets; skip sound but keep motion.
      return
    }

    this.stopSound(channel)

    const audio = new Audio(url)
    audio.loop = loop ?? false
    audio.volume = volume ?? 1
    this.channelAudios.set(channel, audio)

    void audio.play().catch((e) => {
      console.warn(`[Live2D DSL] Failed to play sound "${file}" on channel ${channel}:`, e)
      this.channelAudios.delete(channel)
    })

    audio.addEventListener('ended', () => {
      if (this.channelAudios.get(channel) === audio)
        this.channelAudios.delete(channel)
    })
  }

  private stopSound(channel: number): void {
    const audio = this.channelAudios.get(channel)
    if (!audio)
      return
    try {
      audio.pause()
      audio.currentTime = 0
    }
    catch {
      /* ignore */
    }
    this.channelAudios.delete(channel)
  }

  // -- Tracking (ITrackingSink) -------------------------------------------

  // The host's own auto-blink plugin (`useMotionUpdatePluginAutoEyeBlink`) owns eye state;
  // DSL toggles are forwarded as property hints. Keeping these as state so a future
  // hard-wiring can read them without an API change.
  readonly tracking: ITrackingSink = {
    setMouseTracking: (enabled: boolean) => {
      this.mouseTrackingEnabled = enabled
    },
    setEyeBlink: (enabled: boolean) => {
      this.eyeBlinkEnabled = enabled
    },
  }

  mouseTrackingEnabled = true
  eyeBlinkEnabled = true

  // -- Events (IEventEmitter) — view-level effects deferred to the host ----

  readonly events: IEventEmitter = {
    showChoices: (payload: { text?: string, textDuration?: number, choices: ResolvedChoice[], rawEntry: DslEntry }) => {
      this.cfg.host.showChoices(payload)
    },
    showText: (payload: { text: string, duration?: number, rawEntry: DslEntry }) => {
      this.cfg.host.showSpeechText(payload.text, { duration: payload.duration, language: (payload.rawEntry as DslEntry).Language })
    },
    onCostumeWillSwap: (modelFile: string) => {
      // The swap itself is triggered by the costume port; this event is a render-side hint
      // (used for crossfade prep). Model.vue performs the actual motionManager swap when it
      // receives the matching changeCostume action, so nothing extra happens here yet.
      void modelFile
    },
    onIntimacyChanged: () => {
      // Intimacy is persisted via addIntimacy below; overlay styling can subscribe later.
    },
  }

  // -- Intimacy + costume: exposed as plain members (wired into VMOptions separately) ---

  getIntimacy(): number {
    return this.cfg.getIntimacy()
  }

  addIntimacy(delta: number): void {
    const clamp = this.cfg.clampIntimacy
    if (clamp) {
      clamp(this.cfg.getIntimacy() + delta) // normalize; the host clamps on write
    }
    this.cfg.addIntimacy(delta)
  }

  changeCostume(modelFile: string): void {
    void this.cfg.host.changeCostume(modelFile)
  }

  /** Stop every live sound channel; call on unmount / model unload. */
  dispose(): void {
    for (const channel of [...this.channelAudios.keys()])
      this.stopSound(channel)
  }
}

/**
 * Assemble the `Live2DRuntimePorts` bag for the VM from an adapter. costume/intimacy/clock
 * are wired by the caller (they aren't part of the adapter's render-only surface).
 */
export function buildAdapterPorts(adapter: Live2DRuntimeAdapter) {
  return {
    motion: adapter.motion,
    sound: adapter.sound,
    tracking: adapter.tracking,
    events: adapter.events,
  }
}
