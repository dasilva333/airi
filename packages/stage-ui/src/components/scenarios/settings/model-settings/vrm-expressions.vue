<script setup lang="ts">
import type { AiriOutfit } from '../../../../stores/modules/airi-card'

import { useModelStore } from '@proj-airi/stage-ui-three'
import { Input } from '@proj-airi/ui'
import { nanoid } from 'nanoid'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'

import ModelCustomizer from './ModelCustomizer.vue'

import { useAiriCardStore } from '../../../../stores/modules/airi-card'
import { Container } from '../../../data-pane'

const props = defineProps<{
  modelId?: string
}>()

const airiCardStore = useAiriCardStore()
const { activeCard, activeCardId } = storeToRefs(airiCardStore)
const modelStore = useModelStore()
const { availableExpressions, activeExpressions, discoveredMeshes } = storeToRefs(modelStore)
const displayModelId = computed(() => {
  return props.modelId || (activeCardId.value ? airiCardStore.getCardDisplayModelId(activeCardId.value) || undefined : undefined)
})

const uniqueExpressions = computed(() => [...new Set(availableExpressions.value)])
const hasExpressions = computed(() => uniqueExpressions.value.length > 0)
const outfits = computed<AiriOutfit[]>(() => activeCard.value?.extensions?.airi?.outfits || [])

// === Inline Wardrobe Builder State ===
const isBuildingOutfit = ref(false)
const selectedMeshes = ref(new Set<string>())
const slotName = ref('')
const slotTag = ref('')
const slotIcon = ref('i-solar:t-shirt-bold-duotone')
const searchMeshQuery = ref('')

const availableIcons = [
  'i-solar:t-shirt-bold-duotone',
  'i-solar:hanger-bold-duotone',
  'i-solar:magic-stick-3-bold-duotone',
  'i-solar:glasses-bold-duotone',
  'i-solar:crown-bold-duotone',
  'i-solar:cat-bold-duotone',
  'i-solar:heart-bold-duotone',
  'i-solar:star-bold-duotone',
  'i-solar:tag-bold-duotone',
  'i-solar:palette-bold-duotone',
  'i-solar:medal-ribbons-star-bold-duotone',
  'i-solar:mask-happly-bold-duotone',
]

const suggestedTags = [
  { label: 'Independent', value: '' },
  { label: 'Outfit / Dress', value: 'outfit' },
  { label: 'Hairstyle', value: 'hair' },
  { label: 'Headwear', value: 'headwear' },
  { label: 'Shoes / Footwear', value: 'shoes' },
  { label: 'Accessories', value: 'accessories' },
]

const filteredDiscoveredMeshes = computed(() => {
  const query = searchMeshQuery.value.trim().toLowerCase()
  if (!query)
    return discoveredMeshes.value
  return discoveredMeshes.value.filter(m => m.name.toLowerCase().includes(query))
})

function resetAll() {
  const reset: Record<string, number> = {}
  for (const name of availableExpressions.value) {
    reset[name] = 0
  }
  activeExpressions.value = reset
}

function startBuildingOutfit() {
  isBuildingOutfit.value = true
  selectedMeshes.value.clear()
  slotName.value = ''
  slotTag.value = ''
  slotIcon.value = 'i-solar:t-shirt-bold-duotone'
  searchMeshQuery.value = ''
}

function cancelBuildingOutfit() {
  isBuildingOutfit.value = false
  selectedMeshes.value.clear()
}

function toggleMesh(meshName: string) {
  if (selectedMeshes.value.has(meshName)) {
    selectedMeshes.value.delete(meshName)
  }
  else {
    selectedMeshes.value.add(meshName)
  }
}

function selectAllMeshes() {
  for (const m of filteredDiscoveredMeshes.value) {
    selectedMeshes.value.add(m.name)
  }
}

function clearAllMeshes() {
  for (const m of filteredDiscoveredMeshes.value) {
    selectedMeshes.value.delete(m.name)
  }
}

function saveOutfitSlot() {
  if (!activeCardId.value || !slotName.value.trim() || selectedMeshes.value.size === 0)
    return

  const currentOutfits = [...outfits.value]
  if (currentOutfits.length >= 8)
    return

  currentOutfits.push({
    id: nanoid(),
    name: slotName.value.trim(),
    tag: slotTag.value.trim(),
    icon: slotIcon.value,
    meshes: Array.from(selectedMeshes.value),
    defaultEnabled: true,
  })

  airiCardStore.updateCardOutfits(activeCardId.value, currentOutfits)
  isBuildingOutfit.value = false
  selectedMeshes.value.clear()
}

function deleteSlot(id: string) {
  if (!activeCardId.value)
    return
  const updated = outfits.value.filter(o => o.id !== id)
  airiCardStore.updateCardOutfits(activeCardId.value, updated)
}
</script>

<template>
  <div class="min-w-0 w-full flex flex-col gap-2 overflow-hidden">
    <div v-if="!hasExpressions && discoveredMeshes.length === 0" class="p-2 text-xs text-neutral-400">
      No expressions or meshes available. Load a VRM model first.
    </div>

    <template v-else>
      <!-- Sub-Header Controls -->
      <div class="flex items-center justify-between px-2 pt-1">
        <span class="text-xs text-neutral-500 dark:text-neutral-400">
          {{ isBuildingOutfit ? `${discoveredMeshes.length} meshes · select parts` : `${uniqueExpressions.length} expressions · hold to map` }}
        </span>
        <div class="flex gap-2">
          <button
            v-if="!isBuildingOutfit"
            class="rounded-md bg-primary-500/10 px-2 py-0.5 text-xs text-primary-600 font-medium transition-colors hover:bg-primary-500/20 dark:text-primary-400"
            @click="startBuildingOutfit"
          >
            Build Outfit
          </button>
          <div v-else class="flex gap-1">
            <button
              class="rounded-md bg-green-500/10 px-2 py-0.5 text-xs text-green-600 font-medium transition-colors hover:bg-green-500/20 dark:text-green-400"
              :disabled="selectedMeshes.size === 0 || !slotName.trim()"
              @click="saveOutfitSlot"
            >
              Done ({{ selectedMeshes.size }})
            </button>
            <button
              class="rounded-md bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 transition-colors dark:bg-neutral-800 hover:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-700"
              @click="cancelBuildingOutfit"
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

      <!-- === Inline Wardrobe Builder View === -->
      <div v-if="isBuildingOutfit" class="mt-2 flex flex-col gap-4">
        <!-- Slot Configuration Form -->
        <Container title="New Wardrobe Slot" :expand="true" inner-class="flex flex-col gap-3 p-3">
          <!-- Slot Name -->
          <div class="flex flex-col gap-1">
            <label class="text-[10px] text-neutral-400 font-bold tracking-wider uppercase">
              Slot Name *
            </label>
            <Input
              v-model="slotName"
              placeholder="e.g. FLOATIE, BUNNY EARS, HEADWEAR, SUMMER DRESS"
            />
          </div>

          <!-- Group Tag (Exclusivity Group) -->
          <div class="flex flex-col gap-1">
            <label class="text-[10px] text-neutral-400 font-bold tracking-wider uppercase">
              Exclusivity Group Tag (Optional)
            </label>
            <Input
              v-model="slotTag"
              placeholder="e.g. outfit, hair, headwear (or leave blank for independent)"
            />
            <!-- Quick Suggestion Chips -->
            <div class="flex flex-wrap gap-1 pt-1">
              <button
                v-for="sug in suggestedTags"
                :key="sug.value"
                type="button"
                class="rounded px-2 py-0.5 text-[10px] transition-colors"
                :class="[
                  slotTag === sug.value
                    ? 'bg-primary-500 text-white font-medium'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700',
                ]"
                @click="slotTag = sug.value"
              >
                {{ sug.label }}
              </button>
            </div>
            <span class="text-[10px] text-neutral-400">
              Slots with the same tag string deactivate each other when activated. Blank tag is independent.
            </span>
          </div>

          <!-- Icon Selector -->
          <div class="flex flex-col gap-1">
            <label class="text-[10px] text-neutral-400 font-bold tracking-wider uppercase">
              Icon
            </label>
            <div class="grid grid-cols-6 gap-1.5 rounded-xl bg-neutral-50 p-2 dark:bg-neutral-800/60">
              <button
                v-for="icon in availableIcons"
                :key="icon"
                type="button"
                class="size-8 flex items-center justify-center rounded-lg transition-colors"
                :class="[
                  slotIcon === icon
                    ? 'bg-primary-500 text-white shadow-sm'
                    : 'text-neutral-500 hover:bg-neutral-200 dark:text-neutral-400 dark:hover:bg-neutral-700',
                ]"
                @click="slotIcon = icon"
              >
                <div :class="icon" class="size-5" />
              </button>
            </div>
          </div>
        </Container>

        <!-- Discovered 3D Meshes Selection Grid -->
        <Container
          :title="`Discovered 3D Meshes (${discoveredMeshes.length})`"
          :expand="true"
          inner-class="flex flex-col gap-2 p-3"
        >
          <div class="flex items-center justify-between gap-2">
            <Input
              v-model="searchMeshQuery"
              placeholder="Search meshes..."
              size="sm"
              class="flex-1"
            />
            <div class="flex gap-2">
              <button
                type="button"
                class="text-[10px] text-primary-500 hover:underline"
                @click="selectAllMeshes"
              >
                Select All
              </button>
              <button
                type="button"
                class="text-[10px] text-neutral-400 hover:underline"
                @click="clearAllMeshes"
              >
                Clear
              </button>
            </div>
          </div>

          <div
            v-if="filteredDiscoveredMeshes.length === 0"
            class="p-4 text-center text-xs text-neutral-400"
          >
            {{ discoveredMeshes.length === 0 ? 'No 3D meshes detected on loaded model.' : 'No meshes match filter.' }}
          </div>

          <div v-else class="flex flex-wrap gap-1.5 pt-1">
            <button
              v-for="mesh in filteredDiscoveredMeshes"
              :key="mesh.name"
              type="button"
              class="group relative flex items-center gap-1.5 border border-neutral-200 rounded-lg border-solid px-2.5 py-1 text-xs transition-all duration-150 dark:border-neutral-700"
              :class="[
                selectedMeshes.has(mesh.name)
                  ? 'bg-primary-500/20 border-primary-500 text-primary-600 dark:text-primary-400 font-medium ring-1 ring-primary-500'
                  : 'bg-neutral-50 text-neutral-600 hover:bg-neutral-100 dark:bg-neutral-800/60 dark:text-neutral-300 dark:hover:bg-neutral-700',
              ]"
              @click="toggleMesh(mesh.name)"
            >
              <div
                class="size-3 flex items-center justify-center border rounded-sm"
                :class="selectedMeshes.has(mesh.name) ? 'bg-primary-500 border-primary-500 text-white' : 'border-neutral-400'"
              >
                <div v-if="selectedMeshes.has(mesh.name)" class="i-solar:check-read-bold text-[9px]" />
              </div>
              <span class="font-mono">{{ mesh.name }}</span>
              <span class="text-[9px] text-neutral-400">({{ mesh.vertexCount }}v)</span>
            </button>
          </div>
        </Container>

        <!-- Configured Wardrobe Slots -->
        <Container
          v-if="outfits.length > 0"
          :title="`Configured Wardrobe Slots (${outfits.length} / 8)`"
          :expand="true"
          inner-class="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2"
        >
          <div
            v-for="slot in outfits"
            :key="slot.id"
            class="group relative flex flex-col justify-between border border-neutral-200 rounded-xl bg-neutral-50/50 p-2.5 dark:border-neutral-800 dark:bg-neutral-900/50"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="flex items-center gap-2">
                <div class="size-7 flex items-center justify-center rounded-lg bg-primary-500/10 text-primary-500">
                  <div :class="slot.icon || 'i-solar:t-shirt-bold-duotone'" class="text-base" />
                </div>
                <div class="min-w-0 flex flex-col">
                  <span class="truncate text-xs text-neutral-800 font-bold dark:text-neutral-100">
                    {{ slot.name }}
                  </span>
                  <span
                    v-if="slot.tag"
                    class="w-fit rounded bg-amber-500/10 px-1.5 py-0.2 text-[9px] text-amber-600 font-medium tracking-tight uppercase dark:text-amber-400"
                  >
                    Group: {{ slot.tag }}
                  </span>
                  <span
                    v-else
                    class="w-fit rounded bg-neutral-200/60 px-1.5 py-0.2 text-[9px] text-neutral-500 font-medium tracking-tight uppercase dark:bg-neutral-800 dark:text-neutral-400"
                  >
                    Independent
                  </span>
                </div>
              </div>

              <button
                class="p-1 text-neutral-400 transition-colors hover:text-red-500"
                title="Delete Slot"
                @click="deleteSlot(slot.id)"
              >
                <div class="i-solar:trash-bin-trash-bold-duotone size-4" />
              </button>
            </div>

            <div class="mt-2 flex flex-wrap gap-1">
              <span
                v-for="mesh in (slot.meshes || []).slice(0, 3)"
                :key="mesh"
                class="max-w-[120px] truncate rounded bg-neutral-100 px-1.5 py-0.2 text-[9px] text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
              >
                {{ mesh }}
              </span>
              <span
                v-if="(slot.meshes || []).length > 3"
                class="rounded bg-neutral-100 px-1.5 py-0.2 text-[9px] text-neutral-400 dark:bg-neutral-800"
              >
                +{{ (slot.meshes || []).length - 3 }} more
              </span>
            </div>
          </div>
        </Container>
      </div>

      <!-- === Standard Customize View (ModelCustomizer) === -->
      <ModelCustomizer
        v-else
        :model-id="displayModelId || ''"
        class="mt-2"
        :local-stage="true"
      />
    </template>
  </div>
</template>
