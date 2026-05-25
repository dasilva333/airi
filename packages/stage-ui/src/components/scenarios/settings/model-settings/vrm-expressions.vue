<script setup lang="ts">
import { useModelStore } from '@proj-airi/stage-ui-three'
import { Button, Input, Select } from '@proj-airi/ui'
import { nanoid } from 'nanoid'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'

import { useAiriCardStore } from '../../../../stores/modules/airi-card'
import { Container } from '../../../data-pane'

const airiCardStore = useAiriCardStore()
const { activeCard, activeCardId } = storeToRefs(airiCardStore)
const modelStore = useModelStore()
const { availableExpressions, activeExpressions, emotionMappings, favoriteExpression } = storeToRefs(modelStore)

const uniqueExpressions = computed(() => [...new Set(availableExpressions.value)])

// Categorize: Presets have mixed case (e.g., "happy", "MouthLeft"), Custom are all lowercase
const presets = computed(() => uniqueExpressions.value.filter((e) => e !== e.toLowerCase()))
const custom = computed(() => uniqueExpressions.value.filter((e) => e === e.toLowerCase()))

const hasExpressions = computed(() => uniqueExpressions.value.length > 0)

// === Layer 1: Toggle ===
function toggleExpression(name: string) {
  const current = activeExpressions.value[name] || 0
  const next = current > 0 ? 0 : 1
  activeExpressions.value = { ...activeExpressions.value, [name]: next }
}

function resetAll() {
  const reset: Record<string, number> = {}
  for (const name of availableExpressions.value) {
    reset[name] = 0
  }
  activeExpressions.value = reset
}

function isActive(name: string): boolean {
  return (activeExpressions.value[name] || 0) > 0
}

// === Layer 3: ACT Mapping ===
const ACT_EMOTIONS = ['happy', 'sad', 'angry', 'surprised', 'neutral', 'think', 'cool'] as const

const mappingTarget = ref<string | null>(null) // Which VRM expression we're mapping
let longPressTimer: ReturnType<typeof setTimeout> | null = null

function getMappedEmotion(name: string): string | undefined {
  return emotionMappings.value[name]
}

function onPointerDown(name: string) {
  longPressTimer = setTimeout(() => {
    mappingTarget.value = name
    longPressTimer = null
  }, 500)
}

function onPointerUp(name: string) {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
    // Short press — toggle
    toggleExpression(name)
  }
  // If longPressTimer is already null, the long press fired (modal opened)
}

function onPointerLeave() {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
}

function assignMapping(actEmotion: string) {
  if (!mappingTarget.value) return
  emotionMappings.value = { ...emotionMappings.value, [mappingTarget.value]: actEmotion }
  mappingTarget.value = null
}

function clearMapping() {
  if (!mappingTarget.value) return
  const updated = { ...emotionMappings.value }
  delete updated[mappingTarget.value]
  emotionMappings.value = updated
  mappingTarget.value = null
}

function toggleFavorite() {
  if (!mappingTarget.value) return
  if (favoriteExpression.value === mappingTarget.value) {
    favoriteExpression.value = ''
  } else {
    favoriteExpression.value = mappingTarget.value
  }
  mappingTarget.value = null
}

function isSlotOccupied(emotion: string): boolean {
  return occupiedActiveEmotions.value.has(emotion)
}

const occupiedActiveEmotions = computed(() => {
  const available = new Set(availableExpressions.value)
  const occupied = new Set<string>()
  for (const [vrmName, actSlot] of Object.entries(emotionMappings.value)) {
    if (available.has(vrmName)) occupied.add(actSlot)
  }
  return occupied
})

function closeModal() {
  mappingTarget.value = null
}

const ACT_EMOJI: Record<string, string> = {
  angry: '😠',
  cool: '😎',
  happy: '😊',
  neutral: '😐',
  sad: '😢',
  surprised: '😲',
  think: '🤔',
}

// === Layer 4: Wardrobe Management ===
const isBuildingOutfit = ref(false)
const selectedExpressions = ref(new Set<string>())
const showCreationDialog = ref(false)

const draftOutfit = ref({
  icon: 'i-solar:t-shirt-bold-duotone',
  name: '',
  type: 'base' as 'base' | 'overlay',
})

const snapshotState = ref<Record<string, number> | null>(null)
const outfits = computed(() => activeCard.value?.extensions?.airi?.outfits || [])

function toggleSelection(name: string) {
  if (selectedExpressions.value.has(name)) {
    selectedExpressions.value.delete(name)
    // Real-time preview: Turn off when unselected
    activeExpressions.value = { ...activeExpressions.value, [name]: 0 }
  } else {
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
  if (selectedExpressions.value.size === 0) return
  draftOutfit.value.name = ''
  showCreationDialog.value = true
}

function saveOutfit() {
  if (!activeCardId.value || !draftOutfit.value.name) return

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
  if (!activeCardId.value) return
  const updatedOutfits = outfits.value.filter((o) => o.id !== id)
  airiCardStore.updateCardOutfits(activeCardId.value, updatedOutfits)
}
</script>

<template>
  <div class="flex flex-col gap-2">
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

      <!-- Custom Extensions -->
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
          :class="[
            'relative rounded-md px-2 py-1 text-xs transition-all duration-150',
            'border border-solid select-none',
            isActive(name) || selectedExpressions.has(name)
              ? 'bg-lime-500/20 border-lime-400 text-lime-600 dark:text-lime-300 font-medium'
              : 'bg-neutral-50 dark:bg-neutral-800/60 border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700',
            isBuildingOutfit && selectedExpressions.has(name) ? 'ring-2 ring-primary-500 ring-offset-2 dark:ring-offset-neutral-900' : '',
          ]"
          @pointerdown.prevent="!isBuildingOutfit ? onPointerDown(name) : undefined"
          @pointerup="!isBuildingOutfit ? onPointerUp(name) : toggleSelection(name)"
          @pointerleave="!isBuildingOutfit ? onPointerLeave() : undefined"
        >
          <span v-if="favoriteExpression === name" class="mr-0.5 text-[10px]">⭐</span>
          {{ name }}
          <span
            v-if="getMappedEmotion(name)"
            class="ml-0.5 text-[10px] opacity-70"
          >{{ ACT_EMOJI[getMappedEmotion(name)!] || '🔗' }}</span>
        </button>
      </Container>

      <!-- Presets -->
      <Container
        v-if="presets.length > 0"
        :title="`Presets (${presets.length})`"
        :expand="false"
        inner-class="flex flex-wrap gap-1 p-2"
        class="mt-2"
      >
        <button
          v-for="name in presets"
          :key="name"
          :class="[
            'relative rounded-md px-2 py-1 text-xs transition-all duration-150',
            'border border-solid select-none',
            isActive(name) || selectedExpressions.has(name)
              ? 'bg-primary-500/20 border-primary-400 text-primary-600 dark:text-primary-300 font-medium'
              : 'bg-neutral-50 dark:bg-neutral-800/60 border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700',
            isBuildingOutfit && selectedExpressions.has(name) ? 'ring-2 ring-primary-500 ring-offset-2 dark:ring-offset-neutral-900' : '',
          ]"
          @pointerdown.prevent="!isBuildingOutfit ? onPointerDown(name) : undefined"
          @pointerup="!isBuildingOutfit ? onPointerUp(name) : toggleSelection(name)"
          @pointerleave="!isBuildingOutfit ? onPointerLeave() : undefined"
        >
          <span v-if="favoriteExpression === name" class="mr-0.5 text-[10px]">⭐</span>
          {{ name }}
          <span
            v-if="getMappedEmotion(name)"
            class="ml-0.5 text-[10px] opacity-70"
          >{{ ACT_EMOJI[getMappedEmotion(name)!] || '🔗' }}</span>
        </button>
      </Container>
    </template>
  </div>

  <!-- ACT Mapping Modal -->
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-150"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-150"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="mappingTarget"
        class="fixed inset-0 z-9999 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        @click.self="closeModal"
      >
        <div
          class="w-72 border border-neutral-200 rounded-xl border-solid bg-white p-4 shadow-2xl dark:border-neutral-700 dark:bg-neutral-900"
        >
          <div class="mb-3 text-center">
            <div class="text-sm text-neutral-700 font-medium dark:text-neutral-200">
              Map Expression
            </div>
            <div class="mt-1 rounded-md bg-neutral-100 px-3 py-1 text-xs text-primary-500 font-mono dark:bg-neutral-800">
              {{ mappingTarget }}
            </div>
            <div class="mt-1 text-[11px] text-neutral-400">
              to an ACT emotion slot
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <button
              v-for="emotion in ACT_EMOTIONS"
              :key="emotion"
              :class="[
                'rounded-lg px-3 py-2 text-sm transition-all duration-150',
                'border border-solid',
                getMappedEmotion(mappingTarget!) === emotion
                  ? 'bg-primary-500/20 border-primary-400 text-primary-600 dark:text-primary-300 font-medium'
                  : isSlotOccupied(emotion)
                    ? 'bg-emerald-500/5 border-emerald-500/40 text-neutral-600 dark:text-neutral-300'
                    : 'bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-400 dark:text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-700',
              ]"
              @click="assignMapping(emotion)"
            >
              {{ ACT_EMOJI[emotion] }} {{ emotion }}
            </button>
          </div>

          <!-- Favorite Toggle -->
          <button
            :class="[
              'mt-3 w-full rounded-lg px-3 py-2 text-sm transition-all duration-150',
              'border border-solid',
              favoriteExpression === mappingTarget
                ? 'bg-amber-500/20 border-amber-400 text-amber-600 dark:text-amber-300 font-medium'
                : 'bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700',
            ]"
            @click="toggleFavorite"
          >
            ⭐ {{ favoriteExpression === mappingTarget ? 'Remove Favorite' : 'Set as Favorite' }}
          </button>

          <div class="mt-3 flex gap-2">
            <button
              class="flex-1 border border-red-300 rounded-lg border-solid bg-red-50 px-3 py-1.5 text-xs text-red-600 transition-colors dark:border-red-800 dark:bg-red-900/30 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900/50"
              @click="clearMapping"
            >
              Clear Mapping
            </button>
            <button
              class="flex-1 border border-neutral-200 rounded-lg border-solid bg-neutral-50 px-3 py-1.5 text-xs text-neutral-600 transition-colors dark:border-neutral-700 dark:bg-neutral-800 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-700"
              @click="closeModal"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

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
