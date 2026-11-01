<script setup lang="ts">
import { DropInViewer } from '@mkkellogg/gaussian-splats-3d'
import { useTresContext } from '@tresjs/core'
import { onMounted, onUnmounted, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  src?: string
  splatAlphaRemovalThreshold?: number
  position?: [number, number, number]
  rotation?: [number, number, number]
  scale?: [number, number, number] | number
}>(), {
  splatAlphaRemovalThreshold: 5,
  position: () => [0, 0, 0],
  rotation: () => [0, 0, 0],
  scale: 1,
})

const emit = defineEmits<{
  (e: 'loaded', count: number): void
  (e: 'error', error: unknown): void
}>()

const { scene } = useTresContext()
const splatViewer = ref<any>(null)
let currentSceneIndex: number | null = null

async function loadSplat(url: string) {
  if (!splatViewer.value)
    return

  try {
    if (currentSceneIndex !== null) {
      splatViewer.value.removeSplatScene(currentSceneIndex)
      currentSceneIndex = null
    }

    const scaleArr = typeof props.scale === 'number'
      ? [props.scale, props.scale, props.scale]
      : props.scale

    await splatViewer.value.addSplatScene(url, {
      splatAlphaRemovalThreshold: props.splatAlphaRemovalThreshold,
      position: props.position,
      rotation: props.rotation,
      scale: scaleArr,
    })

    currentSceneIndex = 0
    emit('loaded', splatViewer.value.getSceneCount())
  }
  catch (err) {
    console.error('[GaussianSplatModel] Failed to load splat:', err)
    emit('error', err)
  }
}

onMounted(() => {
  if (!scene.value)
    return

  const viewer = new DropInViewer({
    sharedMemoryForWorkers: false,
    gpuAcceleratedSort: true,
  })

  splatViewer.value = viewer
  scene.value.add(viewer)

  if (props.src) {
    loadSplat(props.src)
  }
})

watch(() => props.src, (newSrc) => {
  if (newSrc) {
    loadSplat(newSrc)
  }
})

onUnmounted(() => {
  if (splatViewer.value && scene.value) {
    scene.value.remove(splatViewer.value)
    splatViewer.value.dispose()
    splatViewer.value = null
  }
})
</script>

<template>
  <!-- DropInViewer attaches directly to Three.js scene graph -->
</template>
