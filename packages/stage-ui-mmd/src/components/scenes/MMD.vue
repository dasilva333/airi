<script setup lang="ts">
import { useMmd } from '@proj-airi/stage-ui-mmd/stores/mmd'
import { Screen } from '@proj-airi/ui'
import { TresCanvas } from '@tresjs/core'
import { storeToRefs } from 'pinia'
import { ACESFilmicToneMapping, PerspectiveCamera } from 'three'
import { shallowRef } from 'vue'

import MMDModel from './mmd/Model.vue'

const props = withDefaults(
  defineProps<{
    modelSrc?: string
    paused?: boolean
    currentAudioSource?: AudioBufferSourceNode
    textureMap?: Map<string, string>
    scale?: number
    positionX?: number
    positionY?: number
    previewExpression?: string
  }>(),
  {
    paused: false,
    positionX: 0,
    positionY: 0,
    scale: 1,
  },
)

const emit = defineEmits<{
  (e: 'error', value: unknown): void
  (e: 'scaleChange', value: number): void
}>()

const componentState = defineModel<'pending' | 'loading' | 'mounted'>('state', { default: 'pending' })

const camera = shallowRef(new PerspectiveCamera())
const mmdStore = useMmd()
const { currentMotion } = storeToRefs(mmdStore)

function onTresReady() {
  componentState.value = 'mounted'
}

function onSceneBootstrap(data: any) {
  if (camera.value) {
    camera.value.position.set(data.cameraPosition.x, data.cameraPosition.y, data.cameraPosition.z)
    camera.value.lookAt(data.lookAtTarget.x, data.lookAtTarget.y, data.lookAtTarget.z)
  }
}

function handleWheel(event: WheelEvent) {
  const delta = event.deltaY * -0.0005
  const newScale = Math.min(Math.max((props.scale || 1) + delta, 0.1), 3)
  emit('scaleChange', newScale)
}
</script>

<template>
  <Screen v-slot="{ width, height }" relative>
    <div class="h-full w-full" @wheel="handleWheel">
      <TresCanvas
        :camera="(camera as any)"
        :alpha="true"
        :antialias="true"
        :width="width"
        :height="height"
        :tone-mapping="ACESFilmicToneMapping"
        :tone-mapping-exposure="1"
        :clear-alpha="0"
        power-preference="high-performance"
        @ready="onTresReady"
      >
        <TresAmbientLight :intensity="1.0" />
        <TresDirectionalLight :position="[0, 10, 10]" :intensity="1.5" />

        <MMDModel
          :model-src="modelSrc"
          :paused="paused"
          :current-audio-source="currentAudioSource"
          :texture-map="textureMap"
          :model-offset="{ x: props.positionX, y: props.positionY, z: 0 }"
          :model-rotation-y="0"
          :look-at-target="{ x: 0, y: 0, z: -100 }"
          tracking-mode="orbit"
          :eye-height="1.5"
          :camera-position="{ x: 0, y: 1.5, z: 5 }"
          :camera="camera"
          :scale="props.scale"
          :preview-expression="props.previewExpression"
          :idle-animation="`/assets/mmd/animations/${currentMotion}`"
          @scene-bootstrap="onSceneBootstrap"
          @error="(err) => emit('error', err)"
        />
      </TresCanvas>
    </div>
  </Screen>
</template>
