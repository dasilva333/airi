<script setup lang="ts">
import type { FavoriteModel } from './BrainModelFavoriteModal.vue'

import { useLocalStorage } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import BrainModelFavoriteModal from './BrainModelFavoriteModal.vue'

import { NativeAI } from '../../../libs/native-ai'
import { useAiriCardStore } from '../../../stores/modules/airi-card'
import { useConsciousnessStore } from '../../../stores/modules/consciousness'

const props = withDefaults(defineProps<Props>(), {
  title: 'Model & Provider',
  variant: 'default',
  side: 'top',
  align: 'end',
})
const emit = defineEmits<{
  (e: 'update:provider', value: string): void
  (e: 'update:model', value: string): void
  (e: 'change', value: { provider: string, model: string }): void
}>()
const isOpen = ref(false)

interface Props {
  /** Tooltip or title for the popover header */
  title?: string
  /** Trigger button visual variant */
  variant?: 'default' | 'mobile' | 'circle' | 'button' | 'custom'
  /** Trigger button custom label when variant === 'button' */
  buttonLabel?: string
  /** Side where the popover renders */
  side?: 'top' | 'right' | 'bottom' | 'left'
  /** Alignment of the popover relative to the trigger */
  align?: 'start' | 'center' | 'end'
  /** Optional custom bound provider. If not provided, falls back to consciousnessStore.activeProvider */
  provider?: string
  /** Optional custom bound model. If not provided, falls back to consciousnessStore.activeModel */
  model?: string
}

// Store bindings
const consciousnessStore = useConsciousnessStore()
const airiCardStore = useAiriCardStore()

const { activeProvider, activeModel } = storeToRefs(consciousnessStore)
const { activeCard, activeCardId, cards } = storeToRefs(airiCardStore)

// Resolve effective selected provider and model
const currentProvider = computed({
  get: () => props.provider !== undefined ? props.provider : activeProvider.value,
  set: (val: string) => {
    if (props.provider !== undefined) {
      emit('update:provider', val)
    }
    else {
      activeProvider.value = val
    }
  },
})

const currentModel = computed({
  get: () => props.model !== undefined ? props.model : activeModel.value,
  set: (val: string) => {
    if (props.model !== undefined) {
      emit('update:model', val)
    }
    else {
      activeModel.value = val
    }
  },
})

const searchQuery = ref('')
const isEditMode = ref(false)

const showModal = ref(false)
const selectedFavoriteForEdit = ref<FavoriteModel | null>(null)

export type { FavoriteModel }

// Persistent Storage for Favorites
const favorites = useLocalStorage<FavoriteModel[]>('airi:chat-model-favorites', [])
const deletedKeys = useLocalStorage<string[]>('airi:chat-model-deleted-keys', [])

// Seeding default favorites reactively to perfectly handle asynchronous card store hydration
watch(cards, (newCards) => {
  const discovered = new Set<string>()

  // 1. Coalesce the current active model from store first
  if (activeProvider.value && activeModel.value) {
    discovered.add(`${activeProvider.value}:${activeModel.value}`)
  }

  // 2. Coalesce all distinct model configurations from all imported character cards (both consciousness and generation modules)
  for (const card of newCards.values()) {
    const provider = card.extensions?.airi?.modules?.consciousness?.provider || card.extensions?.airi?.generation?.provider
    const model = card.extensions?.airi?.modules?.consciousness?.model || card.extensions?.airi?.generation?.model
    if (provider && model) {
      discovered.add(`${provider}:${model}`)
    }
  }

  // 3. Dynamically sync discovered models into the favorites list
  for (const key of discovered) {
    const [provider, model] = key.split(':')

    // If the user has explicitly deleted this favorite, respect their choice and do not auto-seed it again
    if (deletedKeys.value.includes(key))
      continue

    const alreadyInFavorites = favorites.value.some(fav => fav.provider === provider && fav.model === model)
    if (!alreadyInFavorites) {
      // Find a friendly display name based on character card name
      let displayName = `Current (${model.split('/').pop() || model})`
      for (const card of newCards.values()) {
        const cardProv = card.extensions?.airi?.modules?.consciousness?.provider || card.extensions?.airi?.generation?.provider
        const cardModel = card.extensions?.airi?.modules?.consciousness?.model || card.extensions?.airi?.generation?.model
        if (cardProv === provider && cardModel === model) {
          displayName = `${card.name} (${model.split('/').pop() || model})`
          break
        }
      }

      favorites.value.push({
        id: `seed-${provider}-${model}`,
        name: displayName,
        provider,
        model,
      })
    }
  }
}, { immediate: true, deep: true })

function handleDeleteFavorite(fav: FavoriteModel) {
  favorites.value = favorites.value.filter(f => f.id !== fav.id)

  // Track as deleted so it is never auto-seeded on card additions
  const key = `${fav.provider}:${fav.model}`
  if (!deletedKeys.value.includes(key)) {
    deletedKeys.value.push(key)
  }
}

function handleSelectFavorite(fav: FavoriteModel) {
  if (props.provider !== undefined || props.model !== undefined) {
    emit('update:provider', fav.provider)
    emit('update:model', fav.model)
    emit('change', { provider: fav.provider, model: fav.model })
  }
  else {
    activeProvider.value = fav.provider
    activeModel.value = fav.model

    // Update active card extensions to keep character state synced
    if (activeCard.value) {
      airiCardStore.updateCard(activeCardId.value, {
        extensions: {
          ...activeCard.value.extensions,
          airi: {
            ...activeCard.value.extensions?.airi,
            modules: {
              ...activeCard.value.extensions?.airi?.modules,
              consciousness: {
                provider: fav.provider,
                model: fav.model,
              },
            },
          },
        },
      } as any)
    }
  }

  // If selecting on-device Apple Core AI, proactively ensure background download starts
  if (fav.provider === 'apple-core-ai' && fav.model && NativeAI.isNative()) {
    NativeAI.isModelCached(fav.model).then((cached) => {
      if (!cached) {
        toast.info(`Preparing on-device ${fav.model.split('/').pop() || 'Core AI'} in background...`, {
          duration: 5000,
        })
        NativeAI.downloadModel({ modelId: fav.model, repo: fav.model }).then(() => {
          toast.success(`${fav.model.split('/').pop() || 'Core AI'} model ready!`)
        }).catch((err) => {
          console.warn('[BrainModelPicker] Background download error:', err)
        })
      }
    })
  }
}

// Proactively check current selection
watch([currentProvider, currentModel], async ([provider, model]) => {
  if (provider === 'apple-core-ai' && model && NativeAI.isNative()) {
    const cached = await NativeAI.isModelCached(model)
    if (!cached) {
      NativeAI.downloadModel({ modelId: model, repo: model }).catch((err) => {
        console.warn('[BrainModelPicker] Background download error:', err)
      })
    }
  }
}, { immediate: true })

const activeModelDisplay = computed(() => {
  const matched = favorites.value.find(
    fav => fav.provider === currentProvider.value && fav.model === currentModel.value,
  )
  if (matched) {
    return matched.name
  }
  const modelShort = currentModel.value?.split('/').pop() || currentModel.value || 'None'
  return `${currentProvider.value || 'None'} / ${modelShort}`
})

// Filtered favorites list based on search query
const filteredFavorites = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  let list = favorites.value

  if (q) {
    list = list.filter(fav =>
      fav.name.toLowerCase().includes(q)
      || fav.provider.toLowerCase().includes(q)
      || fav.model.toLowerCase().includes(q),
    )
  }

  // Sort: current active model first, then alphabetically
  return [...list].sort((a, b) => {
    const isACurrent = a.provider === currentProvider.value && a.model === currentModel.value
    const isBCurrent = b.provider === currentProvider.value && b.model === currentModel.value
    if (isACurrent && !isBCurrent)
      return -1
    if (!isACurrent && isBCurrent)
      return 1
    return a.name.localeCompare(b.name)
  })
})

function openAddModal() {
  selectedFavoriteForEdit.value = null
  showModal.value = true
}

function openEditModal(fav: FavoriteModel) {
  selectedFavoriteForEdit.value = fav
  showModal.value = true
}

function handleSaveFavoriteFromModal(payload: { id?: string, name: string, provider: string, model: string, options?: Record<string, unknown> }) {
  if (payload.id) {
    // Update existing favorite
    const idx = favorites.value.findIndex(f => f.id === payload.id)
    if (idx !== -1) {
      favorites.value[idx] = {
        ...favorites.value[idx],
        name: payload.name,
        provider: payload.provider,
        model: payload.model,
        options: payload.options,
      }
    }
  }
  else {
    // Add new favorite
    favorites.value.push({
      id: String(Date.now()),
      name: payload.name,
      provider: payload.provider,
      model: payload.model,
      options: payload.options,
    })
  }
}

function handleEntryClick(fav: FavoriteModel) {
  if (isEditMode.value) {
    openEditModal(fav)
    return
  }
  handleSelectFavorite(fav)
}
</script>

<template>
  <PopoverRoot v-model:open="isOpen">
    <PopoverTrigger as-child>
      <slot name="trigger" :open="isOpen" :toggle="() => isOpen = !isOpen">
        <button
          v-if="variant === 'circle'"
          type="button"
          class="size-8.5 flex cursor-pointer items-center justify-center border border-neutral-200/30 rounded-full bg-white/10 text-neutral-700 shadow-sm backdrop-blur-md transition-all active:scale-95 dark:border-neutral-700/40 dark:bg-neutral-800/60 dark:text-neutral-200"
          :class="isOpen ? 'ring-2 ring-primary-500/30' : ''"
          :title="title"
        >
          <div class="i-ph:brain-duotone size-4.5 text-teal-500 dark:text-teal-400" />
        </button>
        <button
          v-else-if="variant === 'mobile'"
          type="button"
          class="w-fit flex cursor-pointer items-center justify-center border-2 border-neutral-100/60 rounded-xl border-solid bg-neutral-50/70 p-2 backdrop-blur-md transition-all active:scale-95 dark:border-neutral-800/30 dark:bg-neutral-800/70"
          :class="isOpen ? 'ring-2 ring-primary-500/30' : ''"
          :title="title"
        >
          <div class="i-ph:brain-duotone size-5 text-neutral-500 dark:text-neutral-400" />
        </button>
        <button
          v-else-if="variant === 'button'"
          type="button"
          class="h-9 inline-flex cursor-pointer items-center gap-2 border border-neutral-200 rounded-xl bg-white px-3 text-xs text-neutral-700 font-medium shadow-sm transition-all dark:border-neutral-800 hover:border-primary-300 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:border-primary-800"
          :class="isOpen ? 'ring-2 ring-primary-500/30' : ''"
          :title="title"
        >
          <div class="i-ph:brain-duotone text-sm text-primary-500" />
          <span class="max-w-xs truncate text-[11px] font-mono sm:max-w-sm">
            {{ buttonLabel || activeModelDisplay }}
          </span>
          <div class="i-solar:alt-arrow-down-bold text-[10px] text-neutral-400" />
        </button>
        <button
          v-else
          type="button"
          class="flex cursor-pointer items-center justify-center rounded-xl p-1.5 text-neutral-500 transition-colors duration-200 ease-in-out hover:bg-neutral-200 dark:text-neutral-400 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
          :class="isOpen ? 'ring-2 ring-primary-500/30' : ''"
          :title="title"
        >
          <div class="i-ph:brain-duotone text-base" />
        </button>
      </slot>
    </PopoverTrigger>

    <PopoverPortal>
      <PopoverContent
        :side="side"
        :side-offset="8"
        :align="align"
        :collision-padding="12"
        class="data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 z-[10010] max-h-[min(540px,85vh)] max-w-[calc(100vw-24px)] w-88 flex flex-col border border-neutral-200/50 rounded-2xl bg-white/95 p-3.5 shadow-2xl backdrop-blur-2xl duration-200 dark:border-neutral-800/80 dark:bg-neutral-900/95"
      >
        <!-- Top Search Bar & Edit Button Row -->
        <div class="mb-2.5 flex items-center gap-2">
          <!-- Search Input -->
          <div class="relative flex-1">
            <div class="i-solar:magnifer-linear pointer-events-none absolute left-2.5 top-1/2 size-3.5 text-neutral-400 -translate-y-1/2" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search favorites..."
              class="w-full border border-neutral-200/70 rounded-xl bg-neutral-100/70 py-1.5 pl-8 pr-3 text-xs text-neutral-800 outline-none transition-all dark:border-neutral-800 focus:border-primary-500/60 dark:bg-neutral-800/50 dark:text-neutral-200 focus:ring-1 focus:ring-primary-500/20 placeholder-neutral-400"
            >
            <button
              v-if="searchQuery"
              type="button"
              class="absolute right-2 top-1/2 size-4 flex cursor-pointer items-center justify-center rounded-full text-neutral-400 -translate-y-1/2 hover:text-neutral-600 dark:hover:text-neutral-200"
              @click="searchQuery = ''"
            >
              <div class="i-solar:close-circle-bold size-3.5" />
            </button>
          </div>

          <!-- Edit Mode Toggle Button (Pencil) -->
          <button
            type="button"
            :class="[
              'size-8 flex shrink-0 cursor-pointer items-center justify-center rounded-xl border transition-all',
              isEditMode
                ? 'border-primary-500/50 bg-primary-50 text-primary-600 dark:bg-primary-950/40 dark:text-primary-400'
                : 'border-neutral-200/70 bg-neutral-100/70 text-neutral-500 hover:text-neutral-800 dark:border-neutral-800 dark:bg-neutral-800/50 dark:text-neutral-400 dark:hover:text-neutral-200',
            ]"
            title="Edit favorites"
            @click="isEditMode = !isEditMode"
          >
            <div class="i-solar:pen-linear size-4" />
          </button>
        </div>

        <!-- Favorites Scrollable List -->
        <div class="min-h-30 flex-1 overflow-y-auto pr-0.5 scrollbar-thin space-y-1">
          <div v-if="filteredFavorites.length === 0" class="border border-neutral-200/60 rounded-xl border-dashed py-8 text-center text-xs text-neutral-400 dark:border-neutral-800">
            {{ searchQuery ? 'No matching models found' : 'No favorites saved yet' }}
          </div>

          <div
            v-for="fav in filteredFavorites"
            :key="fav.id"
            :class="[
              'group relative flex items-center justify-between rounded-xl px-2.5 py-2 transition-all cursor-pointer text-left',
              fav.provider === currentProvider && fav.model === currentModel
                ? 'bg-neutral-100/90 dark:bg-neutral-800/80 shadow-xs'
                : 'hover:bg-neutral-100/60 dark:hover:bg-neutral-800/40',
            ]"
            @click="handleEntryClick(fav)"
          >
            <!-- Left Icon / Indicator -->
            <div class="flex flex-1 items-center gap-2.5 overflow-hidden">
              <!-- If active: Emerald Status Dot, Otherwise Star Icon -->
              <div v-if="fav.provider === currentProvider && fav.model === currentModel" class="size-4.5 flex shrink-0 items-center justify-center">
                <span class="size-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              </div>
              <div
                v-else
                class="size-4.5 flex shrink-0 items-center justify-center text-neutral-400 transition-colors group-hover:text-primary-400"
              >
                <div class="i-solar:star-linear size-4" />
              </div>

              <!-- Title, Current Badge, Subtitle -->
              <div class="flex flex-1 flex-col overflow-hidden">
                <div class="flex items-center gap-1.5">
                  <span
                    :class="[
                      'truncate text-xs font-semibold',
                      fav.provider === currentProvider && fav.model === currentModel
                        ? 'text-neutral-900 dark:text-white'
                        : 'text-neutral-800 dark:text-neutral-200',
                    ]"
                  >
                    {{ fav.name }}
                  </span>

                  <!-- Current Pill (Option B style) -->
                  <span
                    v-if="fav.provider === currentProvider && fav.model === currentModel"
                    class="rounded bg-sky-500/15 px-1.5 py-0.2 text-[9px] text-sky-600 font-bold font-mono uppercase dark:bg-sky-400/20 dark:text-sky-300"
                  >
                    Current
                  </span>
                </div>

                <span class="truncate text-[10px] text-neutral-400 font-mono">
                  {{ fav.model }} &bull; {{ fav.provider }}
                </span>
              </div>
            </div>

            <!-- Right Selection Checkmark or Delete Button in Edit Mode -->
            <div class="flex shrink-0 items-center gap-1 pl-2">
              <template v-if="isEditMode">
                <button
                  type="button"
                  class="cursor-pointer rounded-lg p-1 text-neutral-400 transition-colors hover:bg-red-500/10 hover:text-red-500"
                  title="Remove favorite"
                  @click.stop="handleDeleteFavorite(fav)"
                >
                  <div class="i-solar:trash-bin-trash-bold-duotone size-3.5" />
                </button>
              </template>
              <template v-else-if="fav.provider === currentProvider && fav.model === currentModel">
                <div class="shadow-xs size-4.5 flex items-center justify-center rounded-full bg-sky-500 text-white">
                  <div class="i-solar:check-read-linear size-3 font-bold" />
                </div>
              </template>
            </div>
          </div>
        </div>

        <!-- Footer Bar: Favorites count on left & "+ Add favorite" on right (Option B style) -->
        <div class="mt-2.5 flex items-center justify-between border-t border-neutral-100 pt-2.5 dark:border-neutral-800/80">
          <span class="text-[10px] text-neutral-400 font-medium">
            {{ favorites.length }} favorites
          </span>

          <button
            type="button"
            class="flex cursor-pointer items-center gap-1 text-xs text-sky-500 font-semibold transition-colors dark:text-sky-400 hover:text-sky-600 dark:hover:text-sky-300"
            @click="openAddModal"
          >
            <div class="i-solar:add-linear size-3.5" />
            <span>Add favorite</span>
          </button>
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>

  <!-- Edit / Add Favorite Modal -->
  <BrainModelFavoriteModal
    :open="showModal"
    :favorite="selectedFavoriteForEdit"
    @close="showModal = false"
    @save="handleSaveFavoriteFromModal"
  />
</template>

<style scoped>
.scrollbar-thin {
  scrollbar-width: thin;
}
.scrollbar-thin::-webkit-scrollbar {
  width: 5px;
}
.scrollbar-thin::-webkit-scrollbar-track {
  background: transparent;
}
.scrollbar-thin::-webkit-scrollbar-thumb {
  background: rgba(156, 163, 175, 0.25);
  border-radius: 9999px;
}
.scrollbar-thin::-webkit-scrollbar-thumb:hover {
  background: rgba(156, 163, 175, 0.45);
}
</style>
