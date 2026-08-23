import type { Cubism4InternalModel, InternalModel } from 'pixi-live2d-display/cubism4'
import type { Ref } from 'vue'

import type { BeatSyncController } from './beat-sync'

import { useLive2DIdleEyeFocus } from './animation'

type CubismModel = Cubism4InternalModel['coreModel']
type CubismEyeBlink = Cubism4InternalModel['eyeBlink']

export type PixiLive2DInternalModel = InternalModel & {
  eyeBlink?: CubismEyeBlink
  coreModel: CubismModel
}

export interface MotionManagerUpdateContext {
  model: CubismModel
  now: number
  timeDelta: number
  hookedUpdate?: (model: CubismModel, now: number) => boolean
}

export type MotionManagerPluginContext = MotionManagerUpdateContext & {
  internalModel: PixiLive2DInternalModel
  motionManager: PixiLive2DInternalModel['motionManager']
  modelParameters: Ref<any>
  live2dIdleAnimationEnabled: Ref<boolean>
  live2dAutoBlinkEnabled: Ref<boolean>
  live2dForceAutoBlinkEnabled: Ref<boolean>
  isIdleMotion: boolean
  handled: boolean
  markHandled: () => void
}

export type MotionManagerPlugin = (ctx: MotionManagerPluginContext) => void

export interface UseLive2DMotionManagerUpdateOptions {
  internalModel: PixiLive2DInternalModel
  motionManager: PixiLive2DInternalModel['motionManager']
  modelParameters: Ref<any>
  live2dIdleAnimationEnabled: Ref<boolean>
  live2dAutoBlinkEnabled: Ref<boolean>
  live2dForceAutoBlinkEnabled: Ref<boolean>
  lastUpdateTime: Ref<number>
}

export function useLive2DMotionManagerUpdate(options: UseLive2DMotionManagerUpdateOptions) {
  const {
    internalModel,
    motionManager,
    modelParameters,
    live2dIdleAnimationEnabled,
    live2dAutoBlinkEnabled,
    live2dForceAutoBlinkEnabled,
    lastUpdateTime,
  } = options

  const prePlugins: MotionManagerPlugin[] = []
  const postPlugins: MotionManagerPlugin[] = []

  function register(plugin: MotionManagerPlugin, stage: 'pre' | 'post' = 'pre') {
    if (stage === 'pre')
      prePlugins.push(plugin)
    else
      postPlugins.push(plugin)
  }

  function runPlugins(plugins: MotionManagerPlugin[], ctx: MotionManagerPluginContext, breakOnHandled = true) {
    for (const plugin of plugins) {
      if (breakOnHandled && ctx.handled)
        break
      plugin(ctx)
    }
  }

  function hookUpdate(model: CubismModel, now: number, hookedUpdate?: (model: CubismModel, now: number) => boolean) {
    const timeDelta = lastUpdateTime.value ? now - lastUpdateTime.value : 0
    const selectedMotionGroup = localStorage.getItem('selected-runtime-motion-group')
    const isIdleMotion = !motionManager.state.currentGroup
      || motionManager.state.currentGroup === motionManager.groups.idle
      || (!!selectedMotionGroup && motionManager.state.currentGroup === selectedMotionGroup)

    const ctx: MotionManagerPluginContext = {
      model,
      now,
      timeDelta,
      hookedUpdate,
      internalModel,
      motionManager,
      modelParameters,
      live2dIdleAnimationEnabled,
      live2dAutoBlinkEnabled,
      live2dForceAutoBlinkEnabled,
      isIdleMotion,
      handled: false,
      markHandled: () => {
        ctx.handled = true
      },
    }

    runPlugins(prePlugins, ctx)

    if (!ctx.handled && ctx.hookedUpdate) {
      const result = ctx.hookedUpdate.call(motionManager, model, now)
      if (result)
        ctx.handled = true
    }

    runPlugins(postPlugins, ctx, false)

    lastUpdateTime.value = now
    return ctx.handled
  }

  return {
    register,
    hookUpdate,
  }
}

// -- Plugins ---------------------------------------------------------------

export function useMotionUpdatePluginBeatSync(beatSync: BeatSyncController): MotionManagerPlugin {
  let curAngleX = 0
  let curAngleY = 0
  let curAngleZ = 0
  let initialized = false
  let lastLogTime = 0

  return (ctx) => {
    beatSync.updateTargets(ctx.now)

    // Normalize timeDelta to seconds (safe clamp between 0.001s and 0.1s)
    const rawDelta = Math.max(ctx.timeDelta ?? 0, 0)
    const dt = Math.min(0.1, (rawDelta > 5 ? rawDelta / 1000 : rawDelta) || 0.016)

    // Semi-implicit Euler approach
    const stiffness = 120 // Higher -> Snappier
    const damping = 16 // Higher -> Less bounce
    const mass = 1

    if (!initialized) {
      curAngleX = beatSync.targetX.value || 0
      curAngleY = beatSync.targetY.value || 0
      curAngleZ = beatSync.targetZ.value || 0
      initialized = true
    }

    // X
    {
      const target = beatSync.targetX.value
      const pos = curAngleX
      const vel = beatSync.velocityX.value
      const accel = (stiffness * (target - pos) - damping * vel) / mass
      beatSync.velocityX.value = vel + accel * dt
      curAngleX = pos + beatSync.velocityX.value * dt

      if (Math.abs(target - curAngleX) < 0.01 && Math.abs(beatSync.velocityX.value) < 0.01) {
        curAngleX = target
        beatSync.velocityX.value = 0
      }
    }

    // Y
    {
      const target = beatSync.targetY.value
      const pos = curAngleY
      const vel = beatSync.velocityY.value
      const accel = (stiffness * (target - pos) - damping * vel) / mass
      beatSync.velocityY.value = vel + accel * dt
      curAngleY = pos + beatSync.velocityY.value * dt

      // Snap
      if (Math.abs(target - curAngleY) < 0.01 && Math.abs(beatSync.velocityY.value) < 0.01) {
        curAngleY = target
        beatSync.velocityY.value = 0
      }
    }

    // Z
    {
      const target = beatSync.targetZ.value
      const pos = curAngleZ
      const vel = beatSync.velocityZ.value
      const accel = (stiffness * (target - pos) - damping * vel) / mass
      beatSync.velocityZ.value = vel + accel * dt
      curAngleZ = pos + beatSync.velocityZ.value * dt

      // Snap
      if (Math.abs(target - curAngleZ) < 0.01 && Math.abs(beatSync.velocityZ.value) < 0.01) {
        curAngleZ = target
        beatSync.velocityZ.value = 0
      }
    }

    // Diagnostic logging when beat sync is active (throttled to once per second)
    const debug = beatSync.debugState()
    if (debug.primed && ctx.now - lastLogTime > 1000) {
      lastLogTime = ctx.now
      console.debug('[Live2D BeatSync]', {
        bpm: debug.bpm ? Math.round(debug.bpm) : null,
        style: debug.style,
        segments: debug.segments.length,
        targets: { x: Number(beatSync.targetX.value.toFixed(2)), y: Number(beatSync.targetY.value.toFixed(2)), z: Number(beatSync.targetZ.value.toFixed(2)) },
        applied: { x: Number(curAngleX.toFixed(2)), y: Number(curAngleY.toFixed(2)), z: Number(curAngleZ.toFixed(2)) },
      })
    }

    ctx.model.setParameterValueById('ParamAngleX', curAngleX)
    ctx.model.setParameterValueById('ParamAngleY', curAngleY)
    ctx.model.setParameterValueById('ParamAngleZ', curAngleZ)
  }
}

export function useMotionUpdatePluginIdleDisable(idleEyeFocus = useLive2DIdleEyeFocus()): MotionManagerPlugin {
  return (ctx) => {
    if (ctx.handled)
      return

    // Stop idle motions if they're disabled
    if (!ctx.live2dIdleAnimationEnabled.value && ctx.isIdleMotion) {
      ctx.motionManager.stopAllMotions()

      // Still update eye focus and blink even if idle motion is stopped
      idleEyeFocus.update(ctx.internalModel, ctx.now)
      if (ctx.internalModel.eyeBlink != null) {
        ctx.internalModel.eyeBlink.updateParameters(ctx.model, ctx.timeDelta / 1000)
      }

      // Apply manual eye parameters after auto eye blink
      ctx.model.setParameterValueById('ParamEyeLOpen', ctx.modelParameters.value.leftEyeOpen)
      ctx.model.setParameterValueById('ParamEyeROpen', ctx.modelParameters.value.rightEyeOpen)

      ctx.markHandled()
    }
  }
}

export function useMotionUpdatePluginIdleFocus(
  disableFocusAt?: Ref<boolean>,
  idleEyeFocus = useLive2DIdleEyeFocus(),
): MotionManagerPlugin {
  return (ctx) => {
    if (!ctx.isIdleMotion || ctx.handled)
      return

    // If mouse tracking is enabled (disableFocusAt is false/undefined), skip random idle saccades
    if (disableFocusAt && !disableFocusAt.value)
      return

    idleEyeFocus.update(ctx.internalModel, ctx.now)
  }
}

export function useMotionUpdatePluginMouseFocus(
  focusAt: Ref<{ x: number, y: number }>,
  disableFocusAt: Ref<boolean>,
  followSpeed: Ref<number>,
  model: Ref<any>,
  width: Ref<number>,
  height: Ref<number>,
): MotionManagerPlugin {
  let currentX = 0
  let currentY = 0
  let initialized = false
  return (_ctx) => {
    if (disableFocusAt.value || !model.value)
      return

    const targetX = focusAt.value?.x ?? 0
    const targetY = focusAt.value?.y ?? 0

    // Normalize coordinates to [-1, 1] relative to the model's current position
    const charX = model.value.x ?? (width.value / 2)
    const charY = model.value.y ?? (height.value / 2)

    // Normalize relative to half width/height (distance from model center to bounds)
    const halfW = width.value / 2 || 1
    const halfH = height.value / 2 || 1

    const targetNormX = Math.max(-1, Math.min(1, (targetX - charX) / halfW))
    const targetNormY = Math.max(-1, Math.min(1, -(targetY - charY) / halfH))

    if (!initialized) {
      currentX = targetNormX
      currentY = targetNormY
      initialized = true
    }

    // Smoothly interpolate towards target
    const speed = followSpeed.value
    currentX = currentX + (targetNormX - currentX) * speed
    currentY = currentY + (targetNormY - currentY) * speed

    // Capture base parameter values set by active motion prior to focus update
    const baseAngleX = _ctx.model.getParameterValueById('ParamAngleX') || 0
    const baseAngleY = _ctx.model.getParameterValueById('ParamAngleY') || 0
    const baseAngleZ = _ctx.model.getParameterValueById('ParamAngleZ') || 0
    const baseEyeBallX = _ctx.model.getParameterValueById('ParamEyeBallX') || 0
    const baseEyeBallY = _ctx.model.getParameterValueById('ParamEyeBallY') || 0

    // Call focus on the internal focus controller directly with normalized coordinates [-1, 1]
    _ctx.internalModel.focusController.focus(currentX, currentY, true)

    // Additively layer the motion's base offsets back on top of focus targets
    if (baseAngleX !== 0) {
      const cur = _ctx.model.getParameterValueById('ParamAngleX')
      _ctx.model.setParameterValueById('ParamAngleX', Math.max(-30, Math.min(30, cur + baseAngleX)))
    }
    if (baseAngleY !== 0) {
      const cur = _ctx.model.getParameterValueById('ParamAngleY')
      _ctx.model.setParameterValueById('ParamAngleY', Math.max(-30, Math.min(30, cur + baseAngleY)))
    }
    if (baseAngleZ !== 0) {
      const cur = _ctx.model.getParameterValueById('ParamAngleZ')
      _ctx.model.setParameterValueById('ParamAngleZ', Math.max(-30, Math.min(30, cur + baseAngleZ)))
    }
    if (baseEyeBallX !== 0) {
      const cur = _ctx.model.getParameterValueById('ParamEyeBallX')
      _ctx.model.setParameterValueById('ParamEyeBallX', Math.max(-1, Math.min(1, cur + baseEyeBallX)))
    }
    if (baseEyeBallY !== 0) {
      const cur = _ctx.model.getParameterValueById('ParamEyeBallY')
      _ctx.model.setParameterValueById('ParamEyeBallY', Math.max(-1, Math.min(1, cur + baseEyeBallY)))
    }
  }
}

export function useMotionUpdatePluginAutoEyeBlink(): MotionManagerPlugin {
  const blinkState = {
    phase: 'idle' as 'idle' | 'closing' | 'opening',
    progress: 0,
    startLeft: 1,
    startRight: 1,
    delayMs: 0,
  }
  const blinkCloseDuration = 200 // ms
  const blinkOpenDuration = 200 // ms
  const minDelay = 3000
  const maxDelay = 8000

  const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

  function resetBlinkState() {
    blinkState.phase = 'idle'
    blinkState.progress = 0
    blinkState.delayMs = minDelay + Math.random() * (maxDelay - minDelay)
  }
  resetBlinkState()

  function easeOutQuad(t: number) {
    return 1 - (1 - t) * (1 - t)
  }
  function easeInQuad(t: number) {
    return t * t
  }

  function updateForcedBlink(dt: number, baseLeft: number, baseRight: number) {
    // Idle: count down delay to next blink.
    if (blinkState.phase === 'idle') {
      blinkState.delayMs = Math.max(0, blinkState.delayMs - dt)
      if (blinkState.delayMs === 0) {
        blinkState.phase = 'closing'
        blinkState.progress = 0
        blinkState.startLeft = baseLeft
        blinkState.startRight = baseRight
      }

      return { eyeLOpen: baseLeft, eyeROpen: baseRight }
    }

    // Closing: move toward zero with ease-out.
    if (blinkState.phase === 'closing') {
      blinkState.progress = Math.min(1, blinkState.progress + dt / blinkCloseDuration)
      const eased = easeOutQuad(blinkState.progress)
      const eyeLOpen = clamp01(blinkState.startLeft * (1 - eased))
      const eyeROpen = clamp01(blinkState.startRight * (1 - eased))

      if (blinkState.progress >= 1) {
        blinkState.phase = 'opening'
        blinkState.progress = 0
      }

      return { eyeLOpen, eyeROpen }
    }

    // Opening: move back to the base with ease-in.
    blinkState.progress = Math.min(1, blinkState.progress + dt / blinkOpenDuration)
    const eased = easeInQuad(blinkState.progress)
    const eyeLOpen = clamp01(blinkState.startLeft * eased)
    const eyeROpen = clamp01(blinkState.startRight * eased)

    if (blinkState.progress >= 1) {
      resetBlinkState()
    }

    return { eyeLOpen, eyeROpen }
  }

  return (ctx) => {
    // Possibility 1: Only update eye focus when the model is idle
    // Possibility 2: For models having no motion groups, currentGroup will be undefined while groups can be { idle: ... }
    if (!ctx.isIdleMotion || ctx.handled)
      return

    const baseLeft = clamp01(ctx.modelParameters.value.leftEyeOpen)
    const baseRight = clamp01(ctx.modelParameters.value.rightEyeOpen)

    // If the user disabled auto blink entirely, keep manual values and bail. Reset state so re-enabling starts fresh.
    if (!ctx.live2dAutoBlinkEnabled.value) {
      resetBlinkState()
      ctx.model.setParameterValueById('ParamEyeLOpen', baseLeft)
      ctx.model.setParameterValueById('ParamEyeROpen', baseRight)
      ctx.markHandled()
      return
    }

    // Option 1: Force auto blink via our own timer (for models without eyeBlink or when forced in settings).
    if (ctx.live2dForceAutoBlinkEnabled.value || !ctx.internalModel.eyeBlink) {
      // timeDelta can be seconds or milliseconds depending on source; normalize to ms.
      const rawDelta = Math.max(ctx.timeDelta ?? 0, 0)
      const dt = rawDelta < 5 ? rawDelta * 1000 : rawDelta // If less than 5, treat as seconds (e.g., 0.016s -> 16ms).
      const safeDt = dt || 16 // Fallback to ~1 frame to avoid getting stuck when timeDelta is 0 on first tick.

      const { eyeLOpen, eyeROpen } = updateForcedBlink(safeDt, baseLeft, baseRight)

      ctx.model.setParameterValueById('ParamEyeLOpen', eyeLOpen)
      ctx.model.setParameterValueById('ParamEyeROpen', eyeROpen)
      ctx.markHandled()
      return
    }

    // Option 2: Let Cubism drive the blink, but scale it with the user-provided base.
    // If the model has eye blink parameters
    if (ctx.internalModel.eyeBlink != null) {
      // For the part of the auto eye blink implementation in pixi-live2d-display
      //
      // this.emit("beforeMotionUpdate");
      // const motionUpdated = this.motionManager.update(this.coreModel, now);
      // this.emit("afterMotionUpdate");
      // model.saveParameters();
      // this.motionManager.expressionManager?.update(model, now);
      // if (!motionUpdated) {
      //   this.eyeBlink?.updateParameters(model, dt);
      // }
      //
      // https://github.com/guansss/pixi-live2d-display/blob/31317b37d5e22955a44d5b11f37f421e94a11269/src/cubism4/Cubism4InternalModel.ts#L202-L214
      //
      // If the this.motionManager.update returns true, as motion updated flag on,
      // the eye blink parameters will not be updated, in another hand, the auto eye blink is disabled
      //
      // Since we are hooking the motionManager.update method currently,
      // and previously a always `true` was returned, eye blink parameters were never updated.
      //
      // Thous we are here to manually update the eye blink parameters within this hooked method
      ctx.internalModel.eyeBlink.updateParameters(ctx.model, ctx.timeDelta / 1000)
    }

    // Apply manual eye parameters after auto eye blink
    const blinkLeft = ctx.model.getParameterValueById('ParamEyeLOpen') as number
    const blinkRight = ctx.model.getParameterValueById('ParamEyeROpen') as number

    ctx.model.setParameterValueById('ParamEyeLOpen', clamp01(blinkLeft * baseLeft))
    ctx.model.setParameterValueById('ParamEyeROpen', clamp01(blinkRight * baseRight))

    ctx.markHandled()
  }
}

export interface ArtMeshColorApplyStats {
  applied: number
  missed: number
  missedIds: string[]
}

function hexToRGBA(hex: string): [number, number, number, number] {
  const r = Number.parseInt(hex.substring(0, 2), 16) / 255
  const g = Number.parseInt(hex.substring(2, 4), 16) / 255
  const b = Number.parseInt(hex.substring(4, 6), 16) / 255
  const a = Number.parseInt(hex.substring(6, 8), 16) / 255
  return [r, g, b, a]
}

/**
 * Writes VTube multiply/screen colors onto Cubism drawable buffers.
 * Must run after coreModel.update() ÔÇö that step recalculates drawables and clears earlier writes.
 */
export function applyArtMeshColorsToDrawables(
  internalModel: PixiLive2DInternalModel,
  artMeshColors: Record<string, string>,
): ArtMeshColorApplyStats {
  const stats: ArtMeshColorApplyStats = { applied: 0, missed: 0, missedIds: [] }

  if (!artMeshColors || Object.keys(artMeshColors).length === 0)
    return stats

  if (!internalModel?.coreModel)
    return stats

  const coreModel = internalModel.coreModel
  const drawables = (coreModel as any).getModel?.()?.drawables
  if (!drawables?.multiplyColors || !drawables?.screenColors)
    return stats

  for (const [artMeshId, colorValue] of Object.entries(artMeshColors)) {
    try {
      const [multiplyHex, screenHex] = colorValue.split('|')
      const drawableIndex = typeof internalModel.getDrawableIndex === 'function'
        ? internalModel.getDrawableIndex(artMeshId)
        : (coreModel as any).getDrawableIndex?.(artMeshId) ?? -1

      if (drawableIndex < 0) {
        stats.missed++
        if (stats.missedIds.length < 5)
          stats.missedIds.push(artMeshId)
        continue
      }

      if (multiplyHex) {
        const [r, g, b, a] = hexToRGBA(multiplyHex)
        const offset = drawableIndex * 4
        drawables.multiplyColors[offset] = r
        drawables.multiplyColors[offset + 1] = g
        drawables.multiplyColors[offset + 2] = b
        drawables.multiplyColors[offset + 3] = a
        // NOTICE: VTube uses multiply alpha (RRGGBBAA last byte) for mesh visibility.
        // pixi-live2d-display shaders tint RGB only; map sub-1 multiply alpha to drawable opacity.
        if (drawables.opacities && a < 1)
          drawables.opacities[drawableIndex] = a
      }

      if (screenHex) {
        const [r, g, b, a] = hexToRGBA(screenHex)
        const offset = drawableIndex * 4
        drawables.screenColors[offset] = r
        drawables.screenColors[offset + 1] = g
        drawables.screenColors[offset + 2] = b
        drawables.screenColors[offset + 3] = a
      }

      stats.applied++
    }
    catch {
      stats.missed++
    }
  }

  return stats
}

export function hookArtMeshColorsAfterModelUpdate(
  internalModel: PixiLive2DInternalModel,
  artMeshColors: Ref<Record<string, string>>,
) {
  const originalUpdate = internalModel.update.bind(internalModel)
  let diagLogged = false

  internalModel.update = function (dt: number, now: number) {
    originalUpdate(dt, now)
    const stats = applyArtMeshColorsToDrawables(internalModel, artMeshColors.value)
    if (!diagLogged && Object.keys(artMeshColors.value).length > 0) {
      diagLogged = true
      console.info(
        `[Live2D] ArtMesh colors applied after model.update: ${stats.applied} ok, ${stats.missed} drawable not found`,
        stats.missedIds.length > 0 ? `(examples: ${stats.missedIds.join(', ')})` : '',
      )
    }
  }
}

/** @deprecated Use hookArtMeshColorsAfterModelUpdate ÔÇö motion tick runs before coreModel.update() */
export function useMotionUpdatePluginArtMeshColors(artMeshColors: Ref<Record<string, string>>): MotionManagerPlugin {
  return (ctx) => {
    applyArtMeshColorsToDrawables(ctx.internalModel, artMeshColors.value)
  }
}
