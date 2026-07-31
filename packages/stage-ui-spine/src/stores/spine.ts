import { useLocalStorageManualReset } from '@proj-airi/stage-shared/composables'
import { useBroadcastChannel } from '@vueuse/core'
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

import { supportedControl, useSpineViewControl } from './view-control'

type BroadcastChannelEvents
  = | BroadcastChannelEventShouldUpdateView
    | BroadcastChannelEventPlayOneShot

interface BroadcastChannelEventShouldUpdateView {
  type: 'spine-should-update-view'
}

interface BroadcastChannelEventPlayOneShot {
  type: 'spine-play-one-shot'
  name: string
  loop: boolean
}

export interface SpineAnimationDescriptor {
  name: string
  duration: number
}

export interface SpineSkinDescriptor {
  name: string
}

export interface SpineVariantDescriptor {
  name: string
}

/** Persisted runtime state for the active Spine model. */
export interface SpineCurrentAnimation {
  /** Animation name resolved against the loaded skeleton. */
  name: string
  /** Whether the animation should loop on track 0. */
  loop: boolean
  /** Optional one-shot trigger; bumped to force re-application. */
  nonce?: number
}

/** Transient request to play a one-shot animation on the emotion track. */
export interface SpineOneShotAnimation {
  /** Animation name; resolved against the loaded skeleton by the scene. */
  name: string
  /** Whether the one-shot should loop instead of reverting to idle. */
  loop: boolean
  /** Bumped on every request so repeat calls with the same name re-trigger. */
  nonce: number
}

export const defaultSpineAnimation: SpineCurrentAnimation = {
  name: 'idle',
  loop: true,
}

export const useSpine = defineStore('spine', () => {
  const { post, data } = useBroadcastChannel<BroadcastChannelEvents, BroadcastChannelEvents>({
    name: 'airi-stores-stage-ui-spine',
  })
  const shouldUpdateViewHooks = ref(new Set<() => void>())

  const onShouldUpdateView = (hook: () => void) => {
    shouldUpdateViewHooks.value.add(hook)
    return () => {
      shouldUpdateViewHooks.value.delete(hook)
    }
  }

  function shouldUpdateView() {
    post({ type: 'spine-should-update-view' })
    shouldUpdateViewHooks.value.forEach(hook => hook())
  }

  watch(data, (event) => {
    if (event?.type === 'spine-should-update-view') {
      shouldUpdateViewHooks.value.forEach(hook => hook())
    }
    else if (event?.type === 'spine-play-one-shot') {
      oneShotAnimation.value = { name: event.name, loop: event.loop, nonce: (oneShotAnimation.value?.nonce ?? 0) + 1 }
    }
  })

  /** Currently active idle animation (track 0). */
  const currentAnimation = useLocalStorageManualReset<SpineCurrentAnimation>(
    'settings/spine/current-animation',
    () => ({ ...defaultSpineAnimation }),
  )

  /** Active independent animations keyed by model ID. */
  const activeAnimations = useLocalStorageManualReset<Record<string, Record<string, boolean>>>(
    'settings/spine/active-animations',
    () => ({}),
  )

  /** All animations discovered on the loaded skeleton. */
  const availableAnimations = useLocalStorageManualReset<SpineAnimationDescriptor[]>(
    'settings/spine/available-animations',
    () => [],
  )

  /** All skins discovered on the loaded skeleton. */
  const availableSkins = useLocalStorageManualReset<SpineSkinDescriptor[]>(
    'settings/spine/available-skins',
    () => [],
  )

  /** Active skin name. Empty string means use the model's default skin. */
  const currentSkin = useLocalStorageManualReset<string>('settings/spine/current-skin', '')

  /** All skeleton variants discovered in the ZIP. */
  const availableVariants = useLocalStorageManualReset<SpineVariantDescriptor[]>(
    'settings/spine/available-variants',
    () => [],
  )

  /** Active variant name. Empty string means use the default (first) variant. */
  const currentVariant = useLocalStorageManualReset<string>('settings/spine/current-variant', '')

  /** Animation playback speed multiplier (1.0 = normal). */
  const animationSpeed = useLocalStorageManualReset<number>('settings/spine/animation-speed', 1)

  /**
   * Premultiplied alpha — auto-detected from the loaded ZIP atlas.
   * Internal runtime state only, no longer user-configurable.
   */
  const premultipliedAlpha = ref(true)

  /** Whether a Spine skeleton is currently loaded in the active scene. */
  const isModelLoaded = ref(false)

  /** Transient request to play a one-shot animation. */
  const oneShotAnimation = ref<SpineOneShotAnimation>()

  /** Triggers a one-shot animation on the emotion track and broadcasts to other windows. */
  function playOneShotAnimation(name: string, loop = false) {
    oneShotAnimation.value = { name, loop, nonce: (oneShotAnimation.value?.nonce ?? 0) + 1 }
    post({ type: 'spine-play-one-shot', name, loop })
  }

  /** Hit detection mode for tactile interactions ('bounds' for mesh/bbox, 'radial' for origin circle). */
  const hitDetectionMode = useLocalStorageManualReset<'bounds' | 'radial'>(
    'settings/spine/hit-detection-mode',
    'bounds',
  )

  /** Radius threshold in pixels when using radial hit detection. */
  const radialHitRadius = useLocalStorageManualReset<number>(
    'settings/spine/radial-hit-radius',
    35,
  )

  const { position, scale, reset: resetViewControl } = useSpineViewControl()

  function resetState() {
    supportedControl.forEach(c => resetViewControl(c))
    currentAnimation.reset()
    activeAnimations.reset()
    availableAnimations.reset()
    availableSkins.reset()
    currentSkin.reset()
    availableVariants.reset()
    currentVariant.reset()
    animationSpeed.reset()
    hitDetectionMode.reset()
    radialHitRadius.reset()
    premultipliedAlpha.value = true
    shouldUpdateView()
  }

  function selectVariantAndSkin(variantName: string, skinName: string) {
    if (currentVariant.value !== variantName) {
      currentVariant.value = variantName
    }
    if (currentSkin.value !== skinName) {
      currentSkin.value = skinName
    }
    shouldUpdateView()
  }

  return {
    position,
    scale,
    currentAnimation,
    activeAnimations,
    availableAnimations,
    availableSkins,
    currentSkin,
    availableVariants,
    currentVariant,
    animationSpeed,
    hitDetectionMode,
    radialHitRadius,
    premultipliedAlpha,
    isModelLoaded,
    oneShotAnimation,

    playOneShotAnimation,
    selectVariantAndSkin,
    onShouldUpdateView,
    shouldUpdateView,
    resetState,
  }
})

export { useSpineViewControl }
