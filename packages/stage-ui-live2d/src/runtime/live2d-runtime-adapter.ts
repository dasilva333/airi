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

import { useBroadcastChannel } from '@vueuse/core'
import { MotionPriority } from 'pixi-live2d-display/cubism4'
import { watch } from 'vue'

import { DSL_INTIMACY_MAX } from '../stores/dsl-intimacy'

/** Cross-window bridge channel to the app-shell dating-sim store (no cross-package import). */
const DSL_BRIDGE_CHANNEL = 'live2d-dsl-bridge'

type DslBridgeEvent
  = | {
    type: 'dsl-choices'
    requestId: string
    sourceModelId?: string
    text?: string
    textDuration?: number
    choices: { index: number, text: string }[]
    language?: string
  }
  | {
    type: 'dsl-choice-selected'
    requestId: string
    choiceIndex: number
  }
  | {
    type: 'dsl-intimacy-changed'
    modelId?: string
    /** Raw native score (0..DSL_INTIMACY_MAX). */
    next: number
    delta: number
    /** Normalized 0–100 projection for HUD display. */
    display: number
  }

/**
 * Rendering-host effects that depend on the Vue shell, not on the PIXI model. The VM never
 * touches these directly; it emits events and Model.vue reacts.
 */
export interface RenderHostActions {
  /**
   * Hot-swap the rendered costume/model while keeping DSL heap + intimacy intact.
   * The runtime owns state; the host swaps the renderable (see plan §3.2 change_cos).
   */
  changeCostume: (modelFile: string, index?: number) => void | Promise<void>
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
  /**
   * The persistence key for this costume/model. Raw DSL intimacy is stored under this id
   * by the dedicated stage-ui-live2d dsl-intimacy store (Phase 3 Option 1).
   */
  modelId?: string
  /** Raw native DSL intimacy read (0..DSL_INTIMACY_MAX). */
  getIntimacy: () => number
  /** Raw native DSL intimacy write-back. */
  addIntimacy: (delta: number) => void
  /** View-level effects implemented by Model.vue. */
  host: RenderHostActions
  /**
   * Resolve the URL for a model-relative file like a sound clip (`Motions_Sound#1_0_Sound_0.wav`)
   * or a replacement texture. Required for sound + texture playback.
   */
  resolveAssetUrl?: (file: string) => string
}

/**
 * The bundle of runtime output ports this adapter produces. Each field matches a
 * `Live2DRuntimePorts` member from `@proj-airi/live2d-runtime` and can be spread into
 * the VM host: `new DSLVirtualMachine({ host: adapter.ports })`.
 */
export class Live2DRuntimeAdapter {
  private readonly model: Live2DModel<any>
  private readonly cfg: Live2DRuntimeAdapterConfig

  /** Set after VM construction so a bridged choice selection can resume the VM. */
  private selectChoiceHandler: ((choiceIndex: number) => void) | null = null
  private currentChoiceRequestId: string | null = null

  private readonly bridge = useBroadcastChannel<DslBridgeEvent, DslBridgeEvent>({ name: DSL_BRIDGE_CHANNEL })
  private readonly stopBridgeWatch: () => void

  /**
   * DSL `motions enable/disable <group>` gate. Pools are enabled unless explicitly disabled;
   * the canvas consults this before auto-(re)starting an idle motion in that group. The VM
   * mirrors this state too (it never blocks start itself); this map is the render-side truth.
   */
  private readonly motionGroupEnabled = new Map<string, boolean>()
  private onMotionGroupEnabledChange: ((ref: MotionRef, enabled: boolean) => void) | null = null

  constructor(config: Live2DRuntimeAdapterConfig) {
    this.cfg = config
    this.model = config.model
    // Listen for the app-shell dating-sim store answering a choice menu. Incoming
    // BroadcastChannel events arrive via the reactive `data` ref (useBroadcastChannel has
    // no onMessage); watch it and ignore stale/non-matching request ids.
    this.stopBridgeWatch = watch(this.bridge.data, (event) => {
      if (event?.type === 'dsl-choice-selected' && event.requestId === this.currentChoiceRequestId) {
        this.currentChoiceRequestId = null
        this.selectChoiceHandler?.(event.choiceIndex)
      }
    })
  }

  /** Called by Model.vue after constructing the VM so a bridged selection resumes it. */
  setSelectChoiceHandler(handler: (choiceIndex: number) => void): void {
    this.selectChoiceHandler = handler
  }

  private get internalModel() {
    return this.model?.internalModel as any
  }

  // -- Motion (IMotionSink) ------------------------------------------------

  readonly motion: IMotionSink = {
    startMotion: (ref: MotionRef) => this.startMotion(ref),
    stopAllMotions: () => this.stopAllMotions(),
    setMotionGroupEnabled: (ref: MotionRef, enabled: boolean) => {
      this.setMotionGroupEnabled(ref, enabled)
    },
  }

  /**
   * Apply a DSL `motions enable/disable <group>` signal. Marks the pool gate and, when
   * disabling, immediately stops that group's currently-playing motion so the canvas
   * reflects the toggle (a disabled idle pool must not keep animating).
   */
  private setMotionGroupEnabled(ref: MotionRef, enabled: boolean): void {
    this.motionGroupEnabled.set(ref.group, enabled)

    if (!enabled) {
      const motionManager = this.internalModel?.motionManager
      const currentGroup = (motionManager as any)?.state?.currentGroup as string | undefined
      // Stop only when the *active* motion belongs to the group being disabled — we must not
      // clobber an in-flight reaction just because an idle pool next to it was turned off.
      if (motionManager && currentGroup === ref.group) {
        try {
          motionManager.stopAllMotions()
        }
        catch { /* renderer not ready yet — gate flag is still recorded */ }
      }
    }

    this.onMotionGroupEnabledChange?.(ref, enabled)
  }

  /** Whether the named motion pool is enabled (default true until a DSL disable). */
  isMotionGroupEnabled(group: string): boolean {
    return this.motionGroupEnabled.get(group) ?? true
  }

  /** Model.vue registers to react to pool toggles (e.g. to skip a disabled idle on restart). */
  setOnMotionGroupEnabledChange(handler: ((ref: MotionRef, enabled: boolean) => void) | null): void {
    this.onMotionGroupEnabledChange = handler
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
      // Broadcast the menu to the dating-sim overlay store; Model.vue responds with
      // `dsl-choice-selected`. The host callback is kept as a fallback for non-window hosts.
      const requestId = `dsl-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
      this.currentChoiceRequestId = requestId
      this.bridge.post({
        type: 'dsl-choices',
        requestId,
        text: payload.text,
        textDuration: payload.textDuration,
        choices: payload.choices.map((c, index) => ({ index, text: c.text })),
        language: (payload.rawEntry as DslEntry).Language,
      })
      this.cfg.host.showChoices(payload)
    },
    showText: (payload: { text: string, duration?: number, rawEntry: DslEntry }) => {
      this.cfg.host.showSpeechText(payload.text, { duration: payload.duration, language: (payload.rawEntry as DslEntry).Language })
    },
    onCostumeWillSwap: (modelFile: string, index?: number) => {
      void index
      // change_cos is DEFERRED (see docs/design-live2d-change-cos-challenge.md). Keeping this
      // as a render-side hint no-op preserves surface compatibility until the ingestion fix lands.
      void modelFile
    },
    onIntimacyChanged: (next: number, delta: number) => {
      this.bridge.post({
        type: 'dsl-intimacy-changed',
        modelId: this.cfg.modelId,
        next,
        delta,
        display: Math.round((next / DSL_INTIMACY_MAX) * 100),
      })
    },
  }

  // -- Intimacy + costume: exposed as plain members (wired into VMOptions separately) ---

  getIntimacy(): number {
    return this.cfg.getIntimacy()
  }

  addIntimacy(delta: number): void {
    // Persistence + clamping are owned by the dedicated dsl-intimacy store via cfg.addIntimacy.
    this.cfg.addIntimacy(delta)
    // Reflect to the HUD bridge: raw (for persistence/gates) + normalized display (0-100).
    const next = this.getIntimacy()
    this.bridge.post({
      type: 'dsl-intimacy-changed',
      modelId: this.cfg.modelId,
      next,
      delta,
      display: Math.round((next / DSL_INTIMACY_MAX) * 100),
    })
  }

  changeCostume(modelFile: string, index?: number): void {
    void this.cfg.host.changeCostume(modelFile, index)
  }

  /** Stop every live sound channel and close the bridge; call on unmount / model unload. */
  dispose(): void {
    for (const channel of [...this.channelAudios.keys()])
      this.stopSound(channel)
    this.stopBridgeWatch()
    this.bridge.close()
    this.selectChoiceHandler = null
    this.currentChoiceRequestId = null
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
