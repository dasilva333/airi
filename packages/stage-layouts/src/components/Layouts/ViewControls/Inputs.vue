<script setup lang="ts">
import { useSettings } from '@proj-airi/stage-ui/stores/settings'
import { usePositioningStore } from '@proj-airi/stage-ui/stores/settings/positioning'
import { useModelStore } from '@proj-airi/stage-ui-three'
import { RoundRange } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'

const props = defineProps<{
  mode?: 'x' | 'y' | 'z' | 'scale'
}>()

const {
  stageModelRenderer,
  stageViewControlsEnabled,
  stageViewControlsMode: mode,
  stageModelSelected,
} = storeToRefs(useSettings())
const { modelOffset: vrmPosition, modelSize: vrmModelSize } = storeToRefs(useModelStore())

const positioningStore = usePositioningStore()

const vrmControlsDisabled = computed(() => {
  return stageModelRenderer.value === 'vrm' && false // vrmSceneMutationLocked was removed upstream
})

const activeMode = computed(() => props.mode ?? mode.value)

const viewControlsValueX = computed({
  get: () => {
    switch (stageModelRenderer.value) {
      case 'live2d':
      case 'vrm':
      case 'spine':
        return positioningStore.getPosition(stageModelSelected.value).x
      default:
        return 0
    }
  },
  set: (value) => {
    switch (stageModelRenderer.value) {
      case 'vrm':
      case 'live2d':
      case 'spine': {
        if (stageModelRenderer.value === 'vrm' && vrmControlsDisabled.value) break

        const current = positioningStore.getPosition(stageModelSelected.value)
        positioningStore.setPosition(stageModelSelected.value, { ...current, x: value })
        break
      }
      default:
        break
    }
  },
})

const viewControlsValueXMin = computed(() => {
  if (stageModelRenderer.value === 'live2d') return -1000
  if (stageModelRenderer.value === 'spine') return -2000
  return (-vrmModelSize.value.x - 10) * 10
})

const viewControlsValueXMax = computed(() => {
  if (stageModelRenderer.value === 'live2d') return 1000
  if (stageModelRenderer.value === 'spine') return 2000
  return (vrmModelSize.value.x + 10) * 10
})

const viewControlsValueY = computed({
  get: () => {
    switch (stageModelRenderer.value) {
      case 'live2d':
        // For Live2D, the store stores the raw slider value.
        // We invert it when passing to the component, but here we show the raw value!
        // Wait, if we want the slider to reflect the stored value, we just return it!
        return positioningStore.getPosition(stageModelSelected.value).y
      case 'vrm':
      case 'spine':
        return positioningStore.getPosition(stageModelSelected.value).y
      default:
        return 0
    }
  },
  set: (value) => {
    switch (stageModelRenderer.value) {
      case 'vrm':
      case 'live2d':
      case 'spine': {
        if (stageModelRenderer.value === 'vrm' && vrmControlsDisabled.value) break

        const current = positioningStore.getPosition(stageModelSelected.value)
        positioningStore.setPosition(stageModelSelected.value, { ...current, y: value })
        break
      }
      default:
        break
    }
  },
})

const viewControlsValueYMin = computed(() => {
  if (stageModelRenderer.value === 'live2d') return -1000
  if (stageModelRenderer.value === 'spine') return -2000
  return (-vrmModelSize.value.y - 10) * 10
})

const viewControlsValueYMax = computed(() => {
  if (stageModelRenderer.value === 'live2d') return 1000
  if (stageModelRenderer.value === 'spine') return 2000
  return (vrmModelSize.value.y + 10) * 10
})

const viewControlsValueZ = computed({
  get: () => {
    switch (stageModelRenderer.value) {
      case 'live2d':
        return 0
      case 'vrm':
        return vrmPosition.value.z
      default:
        return 0
    }
  },
  set: (value) => {
    switch (stageModelRenderer.value) {
      case 'live2d':
        break
      case 'vrm':
        if (vrmControlsDisabled.value) break
        vrmPosition.value.z = value
        break
      default:
        break
    }
  },
})

const viewControlsValueZMin = computed(() => {
  return stageModelRenderer.value === 'live2d' ? -500 : -vrmModelSize.value.z - 10
})

const viewControlsValueZMax = computed(() => {
  return stageModelRenderer.value === 'live2d' ? 500 : vrmModelSize.value.z + 10
})

const viewControlsValueScale = computed({
  get: () => {
    switch (stageModelRenderer.value) {
      case 'live2d':
      case 'vrm':
      case 'spine':
        return positioningStore.getPosition(stageModelSelected.value).scale
      default:
        return 1
    }
  },
  set: (value) => {
    switch (stageModelRenderer.value) {
      case 'vrm':
      case 'live2d':
      case 'spine': {
        if (stageModelRenderer.value === 'vrm' && vrmControlsDisabled.value) break

        const current = positioningStore.getPosition(stageModelSelected.value)
        positioningStore.setPosition(stageModelSelected.value, { ...current, scale: value })
        break
      }
      default:
        break
    }
  },
})

function resetOnMode() {
  switch (activeMode.value) {
    case 'x':
      viewControlsValueX.value = 0
      break
    case 'y':
      viewControlsValueY.value = 0
      break
    case 'z':
      viewControlsValueZ.value = 0
      break
    case 'scale':
      viewControlsValueScale.value = 1
      break
  }
}

defineExpose({
  resetOnMode,
})
</script>

<template>
  <Transition name="fade-side-pops-in">
    <div v-if="stageViewControlsEnabled" :class="vrmControlsDisabled ? ['opacity-60', 'pointer-events-none'] : []">
      <Transition name="fade-side-pops-in" mode="out-in">
        <div v-if="activeMode === 'x'" relative class="[&_.round-range-tooltip]:hover:opacity-100">
          <RoundRange v-model="viewControlsValueX" :min="viewControlsValueXMin" :max="viewControlsValueXMax" :step="0.01" :disabled="vrmControlsDisabled" data-direction="vertical" h="50%" write-vertical-left />
          <div class="round-range-tooltip" top="50%" translate-y="[-50%]" absolute left-10 font-mono op-0 transition="all duration-200 ease-in-out">
            {{ viewControlsValueX.toFixed(2) }}
          </div>
        </div>
        <div v-else-if="activeMode === 'y'" relative class="[&_.round-range-tooltip]:hover:opacity-100">
          <RoundRange v-model="viewControlsValueY" :min="viewControlsValueYMin" :max="viewControlsValueYMax" :step="0.01" :disabled="vrmControlsDisabled" write-vertical-left h="50%" data-direction="vertical" />
          <div class="round-range-tooltip" top="50%" translate-y="[-50%]" absolute left-10 font-mono op-0 transition="all duration-200 ease-in-out">
            {{ viewControlsValueY.toFixed(2) }}
          </div>
        </div>
        <div v-else-if="stageModelRenderer === 'vrm' && activeMode === 'z'" relative class="[&_.round-range-tooltip]:hover:opacity-100">
          <RoundRange v-model="viewControlsValueZ" :min="viewControlsValueZMin" :max="viewControlsValueZMax" :step="0.01" :disabled="vrmControlsDisabled" write-vertical-left h="50%" data-direction="vertical" />
          <div class="round-range-tooltip" top="50%" translate-y="[-50%]" absolute left-10 font-mono op-0 transition="all duration-200 ease-in-out">
            {{ viewControlsValueZ.toFixed(2) }}
          </div>
        </div>
        <div v-else-if="activeMode === 'scale'" relative class="[&_.round-range-tooltip]:hover:opacity-100">
          <RoundRange v-model="viewControlsValueScale" :min="0" :max="3" :step="0.0001" :disabled="vrmControlsDisabled" write-vertical-left h="50%" data-direction="vertical" />
          <div class="round-range-tooltip" top="50%" translate-y="[-50%]" absolute left-10 font-mono op-0 transition="all duration-200 ease-in-out">
            {{ viewControlsValueScale.toFixed(2) }}
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
</template>

<style scoped>
.fade-side-pops-in-enter-active,
.fade-side-pops-in-leave-active {
  transition: all 0.2s ease-in-out;
}

.fade-side-pops-in-enter-from,
.fade-side-pops-in-leave-to {
  opacity: 0;
  transform: translateX(-100%) scale(0.8);
}

.fade-side-pops-in-enter-to,
.fade-side-pops-in-leave-from {
  opacity: 1;
  transform: translateX(0) scale(1);
}
</style>
