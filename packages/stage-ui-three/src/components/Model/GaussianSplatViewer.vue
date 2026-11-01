<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

import * as GaussianSplats3D from '@mkkellogg/gaussian-splats-3d'

const props = withDefaults(defineProps<{
  src?: string | Blob
  format?: number
  splatAlphaRemovalThreshold?: number
  cameraPosition?: [number, number, number]
  cameraLookAt?: [number, number, number]
  autoStart?: boolean
}>(), {
  splatAlphaRemovalThreshold: 5,
  cameraPosition: () => [0, 0, 2.6],
  cameraLookAt: () => [0, 0, 0],
  autoStart: true,
})

const emit = defineEmits<{
  (e: 'loaded', splatCount: number): void
  (e: 'error', error: unknown): void
  (e: 'progress', percent: number, percentText: string): void
}>()

const containerRef = ref<HTMLDivElement | null>(null)
let viewer: any = null
let currentBlobUrl: string | null = null
let isLoading = false

function determineFormat(url: string, explicitFormat?: number): number {
  if (explicitFormat !== undefined)
    return explicitFormat
  if (url.endsWith('.splat'))
    return GaussianSplats3D.SceneFormat.Splat
  if (url.endsWith('.ksplat'))
    return GaussianSplats3D.SceneFormat.KSplat
  if (url.endsWith('.spz'))
    return GaussianSplats3D.SceneFormat.Spz
  return GaussianSplats3D.SceneFormat.Ply
}

async function loadSplatSource(source?: string | Blob) {
  if (!viewer || !source || isLoading)
    return

  isLoading = true

  // Clean up any previously created blob URL
  if (currentBlobUrl) {
    URL.revokeObjectURL(currentBlobUrl)
    currentBlobUrl = null
  }

  let loadUrl: string
  if (source instanceof Blob) {
    currentBlobUrl = URL.createObjectURL(source)
    loadUrl = currentBlobUrl
  }
  else {
    loadUrl = source
  }

  try {
    // If a scene is already loaded, dispose or replace
    if (viewer.splatMesh && viewer.splatMesh.scenes && viewer.splatMesh.scenes.length > 0) {
      try {
        viewer.dispose()
      }
      catch (e) {
        console.warn('[GaussianSplatViewer] Scene dispose error:', e)
      }
      initViewer()
    }

    await viewer.addSplatScene(loadUrl, {
      format: determineFormat(loadUrl, props.format),
      splatAlphaRemovalThreshold: props.splatAlphaRemovalThreshold,
      showLoadingUI: false,
      position: [0, 0, 0],
      rotation: [0, 0, 0, 1],
      scale: [1, 1, 1],
      onProgress: (percent: number, percentText: string) => {
        emit('progress', percent, percentText)
      },
    })

    if (props.autoStart)
      viewer.start()

    const count = viewer.splatMesh?.getSplatCount() || 0
    emit('loaded', count)
  }
  catch (err) {
    console.error('[GaussianSplatViewer] Failed to load splat:', err)
    emit('error', err)
  }
  finally {
    isLoading = false
  }
}

function initViewer() {
  if (!containerRef.value)
    return

  // Ensure any orphaned canvas elements are detached cleanly
  containerRef.value.innerHTML = ''

  viewer = new GaussianSplats3D.Viewer({
    rootElement: containerRef.value,
    cameraUp: [0, -1, 0],
    initialCameraPosition: props.cameraPosition,
    initialCameraLookAt: props.cameraLookAt,
    sharedMemoryForWorkers: false,
    gpuAcceleratedSort: false,
    integerBasedSort: false,
    logLevel: GaussianSplats3D.LogLevel.None,
  })
}

watch(() => props.src, (newSrc) => {
  if (newSrc)
    loadSplatSource(newSrc)
})

onMounted(() => {
  initViewer()
  if (props.src)
    loadSplatSource(props.src)
})

onBeforeUnmount(() => {
  if (currentBlobUrl) {
    URL.revokeObjectURL(currentBlobUrl)
    currentBlobUrl = null
  }
  if (viewer) {
    try {
      viewer.dispose()
    }
    catch (e) {
      console.warn('[GaussianSplatViewer] Error during dispose:', e)
    }
    viewer = null
  }
})

defineExpose({
  getViewer: () => viewer,
})
</script>

<template>
  <div ref="containerRef" class="relative h-full w-full overflow-hidden" />
</template>
