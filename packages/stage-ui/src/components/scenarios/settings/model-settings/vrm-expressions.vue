<script setup lang="ts">
import { useModelStore } from '@proj-airi/stage-ui-three'
import { storeToRefs } from 'pinia'
import { computed, defineAsyncComponent } from 'vue'

import ModelCustomizerSkeleton from './components/ModelCustomizerSkeleton.vue'

import { useAiriCardStore } from '../../../../stores/modules/airi-card'
import { useSettings } from '../../../../stores/settings'

const props = defineProps<{
  modelId?: string
}>()

const ModelCustomizer = defineAsyncComponent({
  loader: () => import('./ModelCustomizer.vue'),
  loadingComponent: ModelCustomizerSkeleton,
  delay: 0,
})

const settingsStore = useSettings()
const airiCardStore = useAiriCardStore()
const { activeCardId } = storeToRefs(airiCardStore)
const modelStore = useModelStore()
const { availableExpressions, activeExpressions } = storeToRefs(modelStore)
const displayModelId = computed(() => {
  return props.modelId || (activeCardId.value ? airiCardStore.getCardDisplayModelId(activeCardId.value) || undefined : undefined)
})

const uniqueExpressions = computed(() => [...new Set(availableExpressions.value)])
const hasExpressions = computed(() => uniqueExpressions.value.length > 0)

function resetAll() {
  const reset: Record<string, number> = {}
  for (const name of availableExpressions.value) {
    reset[name] = 0
  }
  activeExpressions.value = reset
  modelStore.resetMeshVisibility()
}
</script>

<template>
  <div class="min-w-0 w-full flex flex-col gap-2 overflow-hidden">
    <div v-if="!hasExpressions && !settingsStore.stageModelSelectedUrl" class="p-2 text-xs text-neutral-400">
      No expressions available. Load a VRM model first.
    </div>
    <ModelCustomizerSkeleton v-else-if="!hasExpressions" />

    <div v-else class="flex flex-col gap-2">
      <!-- Sub-Header Controls -->
      <div class="flex items-center justify-between px-2 pt-1">
        <span class="text-xs text-neutral-500 dark:text-neutral-400">
          {{ uniqueExpressions.length }} expressions · hold to map
        </span>
        <button
          class="rounded-md bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 transition-colors dark:bg-neutral-800 hover:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-700"
          @click="resetAll"
        >
          Reset All
        </button>
      </div>

      <!-- Standard Customize View (ModelCustomizer) -->
      <ModelCustomizer
        :model-id="displayModelId || ''"
        class="mt-2"
        :local-stage="true"
      />
    </div>
  </div>
</template>
