<script setup lang="ts">
/*
 * Core component for loading and displaying MMD (PMX/PMD) models.
 * Parallel to VRMModel.vue but uses @moeru/three-mmd for loading and rendering.
 * Handles model loading, animation playback, morph-based expressions, and lip sync.
 */

import type { MMD } from '@moeru/three-mmd'
import { useLoop, useTresContext } from '@tresjs/core'
import type { Group, PerspectiveCamera } from 'three'
import { AnimationMixer } from 'three'
import { onMounted, onUnmounted, ref, shallowRef, toRefs, watch } from 'vue'

import { loadVMDAnimation } from '../../../composables/mmd/animation'
import { loadMmd } from '../../../composables/mmd/core'
import { useMMDEmote } from '../../../composables/mmd/expression'
import { useMMDLipSync } from '../../../composables/mmd/lip-sync'
import { useMmd } from '../../../stores/mmd'

export interface Vec3 {
  x: number
  y: number
  z: number
}
export interface SceneBootstrap {
  cacheHit: boolean
  cameraDistance: number
  cameraPosition: Vec3
  eyeHeight: number
  lookAtTarget: Vec3
  modelOffset: Vec3
  modelOrigin: Vec3
  modelSize: Vec3
}

const props = withDefaults(
  defineProps<{
    audioContext?: AudioContext
    currentAudioSource?: AudioBufferSourceNode
    lastCommittedModelSrc?: string
    modelSrc?: string
    textureMap?: Map<string, string>
    idleAnimation?: string
    paused?: boolean
    modelOffset: Vec3
    modelRotationY: number
    lookAtTarget: Vec3
    trackingMode: string
    eyeHeight: number
    cameraPosition: Vec3
    camera: PerspectiveCamera
    scale?: number
    previewExpression?: string
  }>(),
  {
    paused: false,
    scale: 1,
  },
)

const emit = defineEmits<{
  (e: 'loadingProgress', value: number): void
  (e: 'loadStart', value: 'initial-load' | 'model-reload' | 'model-switch'): void
  (e: 'sceneBootstrap', value: SceneBootstrap): void
  (e: 'lookAtTarget', value: Vec3): void
  (e: 'error', value: unknown): void
  (e: 'loaded', value: string): void
}>()

const { currentAudioSource, lastCommittedModelSrc, modelSrc, idleAnimation, paused, modelOffset, modelRotationY } =
  toRefs(props)

const { scene } = useTresContext()
const mmdInstance = shallowRef<MMD>()
const mmdGroup = shallowRef<Group>()
const modelLoaded = ref(false)
let loadSequence = 0

const mmdAnimationMixer = shallowRef<AnimationMixer>()
const mmdEmote = shallowRef<ReturnType<typeof useMMDEmote>>()
// audioContext is passed as a prop so this composable stays within the stage-ui-three
// package boundary and does not need to import from stage-ui.
const mmdLipSync = props.audioContext ? useMMDLipSync(props.audioContext, currentAudioSource) : null

const mmdStore = useMmd()
const { onBeforeRender } = useLoop()

// Render loop
let disposeRenderLoop: (() => void) | undefined

function bindRenderLoop() {
  disposeRenderLoop?.()

  const { off } = onBeforeRender(({ delta }) => {
    if (paused.value) return

    const activeMmd = mmdInstance.value
    if (!activeMmd) return

    // Update animation mixer
    mmdAnimationMixer.value?.update(delta)

    // Update physics (IK, grants, spring bones)
    activeMmd.update(delta)

    // Update expressions
    mmdEmote.value?.update(delta)

    // Update lip sync
    mmdLipSync?.update(activeMmd, delta)
  })

  disposeRenderLoop = off
}

function detachMmdGroup(group: Group) {
  scene.value?.remove(group as any)
}

function cleanup() {
  disposeRenderLoop?.()
  disposeRenderLoop = undefined

  if (mmdGroup.value) {
    detachMmdGroup(mmdGroup.value)
  }

  if (mmdInstance.value) {
    // Dispose geometry and materials
    const mesh = mmdInstance.value.mesh
    mesh.geometry?.dispose()
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((m: { dispose: () => void }) => m.dispose())
    } else if (mesh.material && 'dispose' in mesh.material) {
      ;(mesh.material as { dispose: () => void }).dispose()
    }
  }

  mmdInstance.value = undefined
  mmdGroup.value = undefined
  mmdAnimationMixer.value = undefined
  mmdEmote.value = undefined
  modelLoaded.value = false
}

function resolveLoadReason(): 'initial-load' | 'model-reload' | 'model-switch' {
  if (!lastCommittedModelSrc.value) return 'initial-load'
  if (lastCommittedModelSrc.value === modelSrc.value) return 'model-reload'
  return 'model-switch'
}

async function loadModel(url: string) {
  const currentSequence = ++loadSequence
  const reason = resolveLoadReason()

  emit('loadStart', reason)
  console.log('[MMDModel] loadModel started!', { reason, sequence: currentSequence, url })

  try {
    const result = await loadMmd(url, {
      onProgress: (progress) => {
        if (currentSequence !== loadSequence) return
        if (progress.total > 0) {
          emit('loadingProgress', progress.loaded / progress.total)
        }
      },
      // NOTICE:
      // Do NOT pass scene here. loadMmd would add the new group to the scene immediately
      // upon completion, before cleanup() removes the old model — causing both models to
      // coexist in the scene and visually "fuse" together. Instead, we add the group to
      // the scene manually after cleanup() so the transition is atomic from the scene's
      // perspective. Remove this comment if loadMmd's scene-insertion behavior changes.
      textureMap: props.textureMap,
    })

    if (!isComponentMounted.value || currentSequence !== loadSequence) return

    if (!result) {
      console.warn('[MMDModel] loadMmd returned undefined!')
      emit('error', new Error('Failed to load MMD model'))
      return
    }
    console.log('[MMDModel] loadMmd succeeded!', { mesh: result.mmd.mesh.name })
    console.log('[MMDModel] Available Morph Targets:', Object.keys(result.mmd.mesh.morphTargetDictionary || {}))
    console.log('[MMDModel] Available Bones:', result.mmd.mesh.skeleton?.bones.map((b: any) => b.name) || [])

    // Update store with available morphs
    mmdStore.availableMorphs = Object.keys(result.mmd.mesh.morphTargetDictionary || {})

    // Clean up previous model before adding the new one to the scene,
    // so the old and new models never coexist in the scene simultaneously.
    cleanup()

    if (scene.value) {
      scene.value.add(result.mmdGroup as any)
    }

    mmdInstance.value = result.mmd
    mmdGroup.value = result.mmdGroup

    // Apply model offset and rotation
    result.mmdGroup.position.set(modelOffset.value.x, modelOffset.value.y, modelOffset.value.z)
    result.mmdGroup.rotation.y = modelRotationY.value

    // Set up animation mixer
    const mixer = new AnimationMixer(result.mmd.mesh)
    mmdAnimationMixer.value = mixer

    // Set up expression controller
    mmdEmote.value = useMMDEmote(result.mmd)

    // Load idle animation if provided (only VMD files are supported for MMD models)
    if (idleAnimation.value && idleAnimation.value.endsWith('.vmd')) {
      try {
        const clip = await loadVMDAnimation(idleAnimation.value, result.mmd)
        // Re-check sequence after the async VMD load — a new load may have started
        if (clip && currentSequence === loadSequence) {
          const action = mixer.clipAction(clip)
          action.play()
        }
      } catch (error) {
        console.warn('[MMDModel] Failed to load idle animation:', error)
      }
    }

    // Re-check sequence after all async work before committing to the scene
    if (currentSequence !== loadSequence) return

    // Emit scene bootstrap data
    const eyeHeight = result.modelCenter.y
    const cameraDistance = result.initialCameraOffset.z

    emit('sceneBootstrap', {
      cacheHit: false,
      cameraDistance,
      cameraPosition: {
        x: result.initialCameraOffset.x,
        y: result.initialCameraOffset.y,
        z: result.initialCameraOffset.z,
      },
      eyeHeight,
      lookAtTarget: { x: 0, y: eyeHeight, z: -100 },
      modelOffset: { x: 0, y: 0, z: 0 },
      modelOrigin: {
        x: result.modelCenter.x,
        y: result.modelCenter.y,
        z: result.modelCenter.z,
      },
      modelSize: {
        x: result.modelSize.x,
        y: result.modelSize.y,
        z: result.modelSize.z,
      },
    })

    emit('lookAtTarget', { x: 0, y: eyeHeight, z: -100 })

    // Bind render loop and mark as loaded
    bindRenderLoop()
    modelLoaded.value = true
    emit('loaded', url)
  } catch (error) {
    if (currentSequence !== loadSequence) {
      console.log('[MMDModel] loadModel failed but sequence changed. Ignoring error.')
      return
    }
    console.error('[MMDModel] loadModel FAILED:', error)
    emit('error', error)
  }
}

// Watch idle animation changes
watch(
  () => props.idleAnimation,
  async (newAnim) => {
    console.log('[MMDModel] idleAnimation changed:', newAnim)
    if (newAnim && newAnim.endsWith('.vmd') && mmdInstance.value && mmdAnimationMixer.value) {
      try {
        const clip = await loadVMDAnimation(newAnim, mmdInstance.value)
        if (clip) {
          console.log('[MMDModel] Playing new animation:', newAnim)
          mmdAnimationMixer.value.stopAllAction()
          const action = mmdAnimationMixer.value.clipAction(clip)
          action.play()
        }
      } catch (error) {
        console.warn('[MMDModel] Failed to load new idle animation:', error)
      }
    } else if (mmdAnimationMixer.value) {
      console.log('[MMDModel] Stopping all actions (None or invalid animation)')
      mmdAnimationMixer.value.stopAllAction()
    }
  },
)

// Watch model source changes
watch(
  modelSrc,
  (newSrc, oldSrc) => {
    if (!newSrc) {
      cleanup()
      return
    }
    if (newSrc !== oldSrc) {
      void loadModel(newSrc)
    }
  },
  { immediate: true },
)

// Watch offset/rotation changes
watch([modelOffset, modelRotationY], ([offset, rotY]) => {
  if (!mmdGroup.value) return
  mmdGroup.value.position.set(offset.x, offset.y, offset.z)
  mmdGroup.value.rotation.y = rotY
})

// Watch scale changes
watch(
  () => props.scale,
  (newScale) => {
    if (!mmdGroup.value || newScale === undefined) return
    mmdGroup.value.scale.set(newScale, newScale, newScale)
  },
)

// Watch preview expression changes
watch(
  () => props.previewExpression,
  (newExpr) => {
    console.log('[MMDModel] previewExpression changed:', newExpr)
    if (newExpr && mmdEmote.value) {
      console.log('[MMDModel] Setting expression:', newExpr)
      mmdEmote.value.setExpression(newExpr, 1.0)
    } else if (mmdEmote.value) {
      console.log('[MMDModel] Resetting expression')
      mmdEmote.value.resetExpression()
    }
  },
)

const isComponentMounted = ref(false)

onMounted(() => {
  isComponentMounted.value = true
  if (modelSrc.value && !modelLoaded.value) {
    void loadModel(modelSrc.value)
  }
})

onUnmounted(() => {
  isComponentMounted.value = false
  cleanup()
})

defineExpose({
  resetExpression: () => {
    mmdEmote.value?.resetExpression()
  },
  setExpression: (name: string, intensity?: number) => {
    mmdEmote.value?.setExpression(name, intensity)
  },
})
</script>

<template>
  <!-- MMD model is added to the scene programmatically via Three.js API -->
  <slot />
</template>
