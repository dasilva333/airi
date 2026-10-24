<script setup lang="ts">
import type { AiriOutfit } from '../../../stores/modules/airi-card'

import { useModelStore } from '@proj-airi/stage-ui-three'
import { computed, ref, watch } from 'vue'

import { useDisplayModelsStore } from '../../../stores/display-models'
import { useAiriCardStore } from '../../../stores/modules/airi-card'

const props = withDefaults(defineProps<{
  /** Display model id whose mesh outfit slots to list. */
  modelId?: string
}>(), {
  modelId: '',
})

const displayModelsStore = useDisplayModelsStore()
const cardStore = useAiriCardStore()
const modelStore = useModelStore() // VRM

// Outfit slots resolve from two homes (same shape, `meshes` wins):
// 1. the display-model record (shared across cards using the model),
// 2. the active card's `extensions.airi.outfits` (per-character bundle —
//    the only durable home for preset/URL models, which persist memory-only).
// Card entries win on id conflict.
const modelOutfits = ref<AiriOutfit[]>([])

watch(() => props.modelId, async (newId) => {
  if (!newId) {
    modelOutfits.value = []
    return
  }
  if (displayModelsStore.displayModels.length === 0) {
    await displayModelsStore.loadDisplayModelsFromIndexedDB()
  }
  let model = displayModelsStore.displayModels.find(m => m.id === newId)
  if (!model) {
    const rawModel = await displayModelsStore.getDisplayModel(newId)
    if (rawModel)
      model = rawModel as any
  }
  modelOutfits.value = [...((model as any)?.outfits || [])]
}, { immediate: true })

const outfitSlots = computed(() => {
  const merged = new Map<string, AiriOutfit>()
  for (const s of modelOutfits.value) {
    if ((s.meshes || []).length > 0)
      merged.set(s.id, s)
  }
  // Card-bundled outfits (preset models only persist here)
  const card = cardStore.activeCardId ? cardStore.cards.get(cardStore.activeCardId) : undefined
  const cardOutfits = (card as any)?.extensions?.airi?.outfits || (card as any)?.data?.extensions?.airi?.outfits || []
  for (const s of cardOutfits) {
    if ((s.meshes || []).length > 0)
      merged.set(s.id, s)
  }
  return [...merged.values()]
})

// NOTICE: mirrors ModelCustomizer isSlotVisible/toggleSlotVisibility — a slot
// is visible only when ALL of its meshes are currently shown.
function isSlotVisible(slot: AiriOutfit) {
  const meshes = slot.meshes || []
  if (meshes.length === 0)
    return true
  return meshes.every(name => !modelStore.hiddenMeshes.includes(name))
}

function toggleSlotVisibility(slot: AiriOutfit) {
  const currentlyVisible = isSlotVisible(slot)
  const meshes = slot.meshes || []
  modelStore.setMeshesVisibility(meshes, !currentlyVisible)
}

function resetToDefault() {
  modelStore.resetMeshVisibility()
}
</script>

<template>
  <div :class="['flex flex-col gap-2']">
    <div :class="['flex items-center justify-between']">
      <span :class="['text-[10px] text-neutral-400 font-bold tracking-wider uppercase']">
        Outfit Slots ({{ outfitSlots.length }})
      </span>
      <button
        type="button"
        :class="['cursor-pointer rounded-lg px-2 py-1 text-[11px] text-neutral-500 font-medium transition hover:bg-neutral-200 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200']"
        title="Show all meshes (default look)"
        @click="resetToDefault"
      >
        Reset
      </button>
    </div>

    <div v-if="outfitSlots.length === 0" :class="['py-6 text-center text-xs text-neutral-400']">
      No outfits yet — build one in model settings.
    </div>

    <div v-else :class="['max-h-56 min-h-0 flex flex-col gap-1.5 overflow-y-auto pb-1 scrollbar-thin']">
      <button
        v-for="slot in outfitSlots"
        :key="slot.id"
        type="button"
        :class="['flex cursor-pointer items-center justify-between border rounded-xl px-3 py-2 text-left transition-all active:scale-[0.99]', 'bg-white dark:bg-neutral-900', isSlotVisible(slot) ? 'border-primary-500/30' : 'border-neutral-200/70 dark:border-neutral-800']"
        :title="isSlotVisible(slot) ? 'Hide this outfit' : 'Wear this outfit'"
        @click="toggleSlotVisibility(slot)"
      >
        <div :class="['min-w-0 flex items-center gap-2.5']">
          <div :class="['size-8 flex shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400']">
            <div :class="[slot.icon || 'i-solar:t-shirt-outline', 'size-4']" />
          </div>
          <div :class="['min-w-0 flex flex-col']">
            <span :class="['truncate text-xs text-neutral-900 font-bold dark:text-neutral-100']">
              {{ slot.name }}
            </span>
            <span v-if="slot.tag" :class="['text-[10px] text-neutral-400 uppercase tracking-wide']">
              {{ slot.tag }}
            </span>
          </div>
        </div>
        <div :class="[isSlotVisible(slot) ? 'text-primary-500' : 'text-neutral-400', 'shrink-0']">
          <div :class="[isSlotVisible(slot) ? 'i-solar:eye-bold' : 'i-solar:eye-closed-linear', 'size-4.5']" />
        </div>
      </button>
    </div>
  </div>
</template>
