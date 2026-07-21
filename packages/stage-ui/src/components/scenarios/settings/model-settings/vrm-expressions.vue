<script setup lang="ts">
import { useModelStore } from '@proj-airi/stage-ui-three'
import { Button, Input, Select } from '@proj-airi/ui'
import { nanoid } from 'nanoid'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'

import ModelCustomizer from './ModelCustomizer.vue'

import { useDisplayModelsStore } from '../../../../stores/display-models'
import { useAiriCardStore } from '../../../../stores/modules/airi-card'
import { Container } from '../../../data-pane'

const airiCardStore = useAiriCardStore()
const { activeCard, activeCardId } = storeToRefs(airiCardStore)
const modelStore = useModelStore()
const { availableExpressions, activeExpressions, emotionMappings, favoriteExpression } = storeToRefs(modelStore)
const displayModelsStore = useDisplayModelsStore()
const displayModelId = computed(() => {
  return activeCardId.value ? airiCardStore.getCardDisplayModelId(activeCardId.value) || undefined : undefined
})

watch([emotionMappings, favoriteExpression], async () => {
  if (!activeCardId.value)
    return
  const displayModelId = airiCardStore.getCardDisplayModelId(activeCardId.value)
  if (!displayModelId)
    return

  const model = displayModelsStore.displayModels.find(m => m.id === displayModelId)
  if (model) {
    model.emotionMappings = { ...emotionMappings.value }
    model.favoriteExpressions = favoriteExpression.value ? [favoriteExpression.value] : []
    const localforageModule = await import('localforage').then(m => m.default || m)
    await localforageModule.setItem(displayModelId, JSON.parse(JSON.stringify(model)))
    displayModelsStore.broadcastModelsSync(Date.now())
    await displayModelsStore.loadDisplayModelsFromIndexedDB(true)
  }
}, { deep: true })

const uniqueExpressions = computed(() => [...new Set(availableExpressions.value)])

// Categorize: Presets have mixed case (e.g., "happy", "MouthLeft"), Custom are all lowercase
const presets = computed(() =>
  uniqueExpressions.value.filter(e => e !== e.toLowerCase()),
)
const custom = computed(() =>
  uniqueExpressions.value.filter(e => e === e.toLowerCase()),
)

const hasExpressions = computed(() => uniqueExpressions.value.length > 0)

function resetAll() {
  const reset: Record<string, number> = {}
  for (const name of availableExpressions.value) {
    reset[name] = 0
  }
  activeExpressions.value = reset
}

// === Layer 4: Wardrobe Management ===
const isBuildingOutfit = ref(false)
const selectedExpressions = ref(new Set<string>())
const showCreationDialog = ref(false)

const draftOutfit = ref({
  name: '',
  icon: 'i-solar:t-shirt-bold-duotone',
  type: 'base' as 'base' | 'overlay',
})

const snapshotState = ref<Record<string, number> | null>(null)
const outfits = computed(() => activeCard.value?.extensions?.airi?.outfits || [])

function toggleSelection(name: string) {
  if (selectedExpressions.value.has(name)) {
    selectedExpressions.value.delete(name)
    // Real-time preview: Turn off when unselected
    activeExpressions.value = { ...activeExpressions.value, [name]: 0 }
  }
  else {
    selectedExpressions.value.add(name)
    // Real-time preview: Turn on (full weight) when selected
    activeExpressions.value = { ...activeExpressions.value, [name]: 1 }
  }
}

function startBuilding() {
  // Snapshot current character look
  snapshotState.value = { ...activeExpressions.value }
  // Reset model to "naked" for clean preview
  resetAll()

  isBuildingOutfit.value = true
  selectedExpressions.value.clear()
}

function cancelBuilding() {
  // Restore original character look
  if (snapshotState.value) {
    activeExpressions.value = snapshotState.value
    snapshotState.value = null
  }

  isBuildingOutfit.value = false
  selectedExpressions.value.clear()
}

function openCreationDialog() {
  if (selectedExpressions.value.size === 0)
    return
  draftOutfit.value.name = ''
  showCreationDialog.value = true
}

function saveOutfit() {
  if (!activeCardId.value || !draftOutfit.value.name)
    return

  const expressions: Record<string, number> = {}
  selectedExpressions.value.forEach((name) => {
    // Current weights are used for the bundle
    expressions[name] = activeExpressions.value[name] || 1
  })

  const newOutfit = {
    id: nanoid(),
    ...draftOutfit.value,
    expressions,
  }

  const updatedOutfits = [...outfits.value, newOutfit]
  airiCardStore.updateCardOutfits(activeCardId.value, updatedOutfits)

  // Restore original state
  if (snapshotState.value) {
    activeExpressions.value = snapshotState.value
    snapshotState.value = null
  }

  showCreationDialog.value = false
  isBuildingOutfit.value = false
  selectedExpressions.value.clear()
}

function deleteOutfit(id: string) {
  if (!activeCardId.value)
    return
  const updatedOutfits = outfits.value.filter(o => o.id !== id)
  airiCardStore.updateCardOutfits(activeCardId.value, updatedOutfits)
}
</script>

<template>
  <div class="min-w-0 w-full flex flex-col gap-2 overflow-hidden">
    <div v-if="!hasExpressions" class="p-2 text-xs text-neutral-400">
      No expressions available. Load a VRM model first.
    </div>
    <template v-else>
      <div class="flex items-center justify-between px-2 pt-1">
        <span class="text-xs text-neutral-500 dark:text-neutral-400">
          {{ uniqueExpressions.length }} expressions · {{ isBuildingOutfit ? 'select multiple' : 'hold to map' }}
        </span>
        <div class="flex gap-2">
          <button
            v-if="!isBuildingOutfit"
            class="rounded-md bg-primary-500/10 px-2 py-0.5 text-xs text-primary-600 transition-colors hover:bg-primary-500/20"
            @click="startBuilding"
          >
            Build Outfit
          </button>
          <div v-else class="flex gap-1">
            <button
              class="rounded-md bg-green-500/10 px-2 py-0.5 text-xs text-green-600 transition-colors hover:bg-green-500/20"
              :disabled="selectedExpressions.size === 0"
              @click="openCreationDialog"
            >
              Done ({{ selectedExpressions.size }})
            </button>
            <button
              class="rounded-md bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 transition-colors dark:bg-neutral-800 hover:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-700"
              @click="cancelBuilding"
            >
              Cancel
            </button>
          </div>
          <button
            v-if="!isBuildingOutfit"
            class="rounded-md bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 transition-colors dark:bg-neutral-800 hover:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-700"
            @click="resetAll"
          >
            Reset All
          </button>
        </div>
      </div>

      <!-- Wardrobe Section -->
      <Container
        v-if="outfits.length > 0 && !isBuildingOutfit"
        title="Wardrobe"
        :expand="true"
        inner-class="grid grid-cols-2 gap-2 p-2"
        class="mt-2"
      >
        <div
          v-for="outfit in outfits"
          :key="outfit.id"
          class="group relative flex items-center gap-2 border border-neutral-200 rounded-lg border-solid bg-neutral-50/50 p-2 dark:border-neutral-800 dark:bg-neutral-900/50"
        >
          <div :class="[outfit.icon, 'text-lg shrink-0', outfit.type === 'base' ? 'text-amber-500' : 'text-sky-400']" />
          <div class="min-w-0 flex flex-col">
            <span class="truncate text-[11px] text-neutral-700 font-medium dark:text-neutral-200">{{ outfit.name }}</span>
            <span class="text-[9px] text-neutral-400 tracking-tight uppercase">{{ outfit.type }}</span>
          </div>
          <button
            class="absolute right-1 top-1 p-0.5 text-red-400 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
            @click="deleteOutfit(outfit.id)"
          >
            <div i-solar:trash-bin-trash-bold-duotone class="size-3" />
          </button>
        </div>
      </Container>

      <!-- Outfit Building Grid -->
      <template v-if="isBuildingOutfit">
        <Container
          v-if="custom.length > 0"
          :title="`Custom Extensions (${custom.length})`"
          :expand="true"
          inner-class="flex flex-wrap gap-1 p-2"
          class="mt-2"
        >
          <button
            v-for="name in custom"
            :key="name"
            class="relative select-none border border-neutral-200 rounded-md border-solid bg-neutral-50 px-2 py-1 text-xs text-neutral-600 transition-all duration-150 dark:border-neutral-700 dark:bg-neutral-800/60 dark:text-neutral-400"
            :class="selectedExpressions.has(name) ? 'ring-2 ring-primary-500 ring-offset-2 dark:ring-offset-neutral-900 bg-primary-500/20 border-primary-400 text-primary-600 font-medium' : ''"
            @click="toggleSelection(name)"
          >
            {{ name }}
          </button>
        </Container>

        <Container
          v-if="presets.length > 0"
          :title="`Presets (${presets.length})`"
          :expand="true"
          inner-class="flex flex-wrap gap-1 p-2"
          class="mt-2"
        >
          <button
            v-for="name in presets"
            :key="name"
            class="relative select-none border border-neutral-200 rounded-md border-solid bg-neutral-50 px-2 py-1 text-xs text-neutral-600 transition-all duration-150 dark:border-neutral-700 dark:bg-neutral-800/60 dark:text-neutral-400"
            :class="selectedExpressions.has(name) ? 'ring-2 ring-primary-500 ring-offset-2 dark:ring-offset-neutral-900 bg-primary-500/20 border-primary-400 text-primary-600 font-medium' : ''"
            @click="toggleSelection(name)"
          >
            {{ name }}
          </button>
        </Container>
      </template>

      <!-- Standard Customize View (ModelCustomizer) -->
      <template v-else>
        <ModelCustomizer :model-id="displayModelId || ''" class="mt-2" :local-stage="true" />
      </template>
    </template>
  </div>

  <!-- Outfit Creation Modal -->
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="showCreationDialog"
        class="fixed inset-0 z-9999 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        @click.self="showCreationDialog = false"
      >
        <div class="w-80 flex flex-col gap-4 border border-neutral-200 rounded-2xl border-solid bg-white p-6 shadow-2xl dark:border-neutral-700 dark:bg-neutral-900">
          <div class="text-center">
            <h3 class="text-lg font-bold">
              Bundle Outfit
            </h3>
            <p class="text-xs text-neutral-400">
              Grouping {{ selectedExpressions.size }} expressions
            </p>
          </div>

          <div class="flex flex-col gap-3">
            <div class="flex flex-col gap-1">
              <label class="text-[10px] text-neutral-400 font-bold uppercase">Name</label>
              <Input v-model="draftOutfit.name" placeholder="e.g. Summer Dress" />
            </div>

            <div class="flex flex-col gap-1">
              <label class="text-[10px] text-neutral-400 font-bold uppercase">Type</label>
              <Select
                v-model="draftOutfit.type"
                :options="[
                  { label: 'Base (Exclusive Swap)', value: 'base' },
                  { label: 'Overlay (Additive)', value: 'overlay' },
                ]"
              />
            </div>

            <div class="flex flex-col gap-1">
              <label class="text-[10px] text-neutral-400 font-bold uppercase">Icon</label>
              <div class="grid grid-cols-3 gap-2 rounded-lg bg-neutral-50 p-2 dark:bg-neutral-800">
                <button
                  v-for="icon in [
                    'i-solar:t-shirt-bold-duotone',
                    'i-solar:magic-stick-3-bold-duotone',
                    'i-solar:glasses-bold-duotone',
                    'i-solar:pallete-bold-duotone',
                    'i-solar:cat-bold-duotone',
                    'i-solar:heart-bold-duotone',
                  ]"
                  :key="icon"
                  :class="[
                    'p-2 rounded-md transition-colors flex items-center justify-center',
                    draftOutfit.icon === icon ? 'bg-primary-500 text-white' : 'hover:bg-neutral-200 dark:hover:bg-neutral-700',
                  ]"
                  @click="draftOutfit.icon = icon"
                >
                  <div :class="icon" class="size-6" />
                </button>
              </div>
            </div>
          </div>

          <div class="flex gap-2 pt-2">
            <Button variant="secondary" class="flex-1" @click="showCreationDialog = false">
              Cancel
            </Button>
            <Button class="flex-1" :disabled="!draftOutfit.name" @click="saveOutfit">
              Save Bundle
            </Button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
