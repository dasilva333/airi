<script setup lang="ts">
import { useLocalStorage } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { computed, onMounted, ref, watch } from 'vue'

import { useAiriCardStore } from '../../../stores/modules/airi-card'
import { useConsciousnessStore } from '../../../stores/modules/consciousness'
import { useProvidersStore } from '../../../stores/providers'

const props = withDefaults(defineProps<{
  /** Tooltip or title for the popover header */
  title?: string
  /** Trigger button visual variant */
  variant?: 'default' | 'mobile' | 'button' | 'custom'
  /** Trigger button custom label when variant === 'button' */
  buttonLabel?: string
  /** Side where the popover renders */
  side?: 'top' | 'right' | 'bottom' | 'left'
  /** Optional custom bound provider. If not provided, falls back to consciousnessStore.activeProvider */
  provider?: string
  /** Optional custom bound model. If not provided, falls back to consciousnessStore.activeModel */
  model?: string
}>(), {
  title: 'Model & Provider',
  variant: 'default',
  side: 'top',
})

const emit = defineEmits<{
  (e: 'update:provider', value: string): void
  (e: 'update:model', value: string): void
  (e: 'change', value: { provider: string, model: string }): void
}>()

// Store bindings
const consciousnessStore = useConsciousnessStore()
const providersStore = useProvidersStore()
const airiCardStore = useAiriCardStore()

const { activeProvider, activeModel } = storeToRefs(consciousnessStore)
const { activeCard, activeCardId, cards } = storeToRefs(airiCardStore)
const { configuredChatProviderOptions } = storeToRefs(providersStore)

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

const showAddForm = ref(false)

export interface FavoriteModel {
  id: string
  name: string
  provider: string
  model: string
}

// Persistent Storage for Favorites
const favorites = useLocalStorage<FavoriteModel[]>('airi:chat-model-favorites', [])
const deletedKeys = useLocalStorage<string[]>('airi:chat-model-deleted-keys', [])

// Form state for adding new favorite
const newName = ref('')
const newProvider = ref('')
const newModel = ref('')
const availableModels = ref<any[]>([])
const isLoadingModels = ref(false)

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

onMounted(() => {
  // Pre-fill the form default provider with first configured provider
  if (configuredChatProviderOptions.value.length > 0) {
    newProvider.value = configuredChatProviderOptions.value[0].value
  }
})

// Dynamically fetch and load models when provider changes in form
watch(newProvider, async (provider) => {
  if (!provider) {
    availableModels.value = []
    return
  }

  isLoadingModels.value = true
  try {
    await consciousnessStore.loadModelsForProvider(provider)
    const rawModels = providersStore.getModelsForProvider(provider)
    availableModels.value = [...rawModels].sort((a, b) => {
      const nameA = (a.name || a.id.split('/').pop() || a.id).toLowerCase()
      const nameB = (b.name || b.id.split('/').pop() || b.id).toLowerCase()
      return nameA.localeCompare(nameB)
    })
  }
  catch (err) {
    console.error('[BrainModelPicker] Failed to load models for provider:', provider, err)
    availableModels.value = []
  }
  finally {
    isLoadingModels.value = false
  }
}, { immediate: true })

function handleAddFavorite() {
  if (!newName.value.trim() || !newModel.value)
    return

  favorites.value.push({
    id: String(Date.now()),
    name: newName.value.trim(),
    provider: newProvider.value,
    model: newModel.value,
  })

  // Reset inputs & hide form
  newName.value = ''
  newModel.value = ''
  showAddForm.value = false
}

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
}

const activeModelDisplay = computed(() => {
  const matched = favorites.value.find(
    fav => fav.provider === currentProvider.value && fav.model === currentModel.value,
  )
  if (matched) {
    return matched.name
  }
  const modelShort = currentModel.value?.split('/').pop() || currentModel.value || 'None'
  return `${modelShort} / ${currentProvider.value || 'None'}`
})
</script>

<template>
  <PopoverRoot>
    <PopoverTrigger as-child>
      <slot name="trigger">
        <button
          v-if="variant === 'mobile'"
          class="w-fit flex items-center justify-center border-2 border-neutral-100/60 rounded-xl border-solid bg-neutral-50/70 p-2 backdrop-blur-md transition-all active:scale-95 dark:border-neutral-800/30 dark:bg-neutral-800/70"
          :title="title"
        >
          <div class="i-ph:brain-duotone size-5 text-neutral-500 dark:text-neutral-400" />
        </button>
        <button
          v-else-if="variant === 'button'"
          type="button"
          class="h-9 inline-flex items-center gap-2 border border-neutral-200 rounded-xl bg-white px-3 text-xs text-neutral-700 font-medium shadow-sm transition-all dark:border-neutral-800 hover:border-primary-300 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:border-primary-800"
          :title="title"
        >
          <div class="i-ph:brain-duotone text-sm text-primary-500" />
          <span class="max-w-40 truncate text-[11px] font-mono">
            {{ buttonLabel || activeModelDisplay }}
          </span>
          <div class="i-solar:alt-arrow-down-bold text-[10px] text-neutral-400" />
        </button>
        <button
          v-else
          class="flex cursor-pointer items-center justify-center rounded-xl p-1.5 text-neutral-500 transition-colors duration-200 ease-in-out hover:bg-neutral-200 dark:text-neutral-400 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
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
        align="end"
        class="animate-in fade-in zoom-in z-[9999] w-80 border border-neutral-200/50 rounded-2xl bg-white/90 p-4 shadow-2xl backdrop-blur-xl duration-200 dark:border-neutral-700/50 dark:bg-neutral-900/90"
      >
        <!-- Header -->
        <div class="mb-3 flex items-center justify-between border-b border-neutral-100 pb-2 dark:border-neutral-800">
          <div class="flex items-center gap-1.5">
            <div class="i-ph:brain-duotone text-base text-primary-500" />
            <span class="text-xs text-neutral-400 font-bold tracking-wider uppercase">{{ title }}</span>
          </div>
          <span class="rounded bg-primary-500/10 px-1.5 py-0.5 text-[9px] text-primary-500 font-bold font-mono uppercase dark:bg-primary-500/20">Model Picker</span>
        </div>

        <!-- Sleek, Compact Active Status Badge -->
        <div class="mb-3.5 flex items-center justify-between gap-2 border border-neutral-200/30 rounded-xl bg-neutral-50/50 px-2.5 py-1.5 text-[10px] dark:border-neutral-800/60 dark:bg-neutral-800/20">
          <div class="flex items-center gap-1.5">
            <span class="size-1.5 animate-pulse rounded-full bg-emerald-500" />
            <span class="text-neutral-400 font-bold tracking-tight uppercase">Selected</span>
          </div>
          <span class="max-w-48 truncate text-neutral-700 font-semibold font-mono dark:text-neutral-300" :title="activeModelDisplay">
            {{ activeModelDisplay }}
          </span>
        </div>

        <!-- Favorites List -->
        <div class="mb-4">
          <div class="mb-2 flex items-center justify-between text-[10px] text-neutral-400 font-bold tracking-wider uppercase">
            <span>Favorites</span>
            <span class="text-[9px] text-neutral-400/60 font-mono">{{ favorites.length }} saved</span>
          </div>

          <div v-if="favorites.length === 0" class="border border-neutral-200 rounded-xl border-dashed py-4 text-center text-xs text-neutral-400 dark:border-neutral-800">
            No favorites saved. Add one below!
          </div>

          <div v-else class="max-h-40 overflow-y-auto scrollbar-thin space-y-1.5">
            <div
              v-for="fav in favorites"
              :key="fav.id"
              :class="[
                'group flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer text-left',
                fav.provider === currentProvider && fav.model === currentModel
                  ? 'bg-primary-50/50 border-primary-200/50 dark:bg-primary-950/20 dark:border-primary-800/50'
                  : 'bg-white/40 border-neutral-100 hover:bg-neutral-50 dark:bg-neutral-900/40 dark:border-neutral-800 dark:hover:bg-neutral-800/40',
              ]"
              @click="handleSelectFavorite(fav)"
            >
              <div class="flex flex-1 items-center gap-2 overflow-hidden">
                <div
                  :class="[
                    'text-sm shrink-0',
                    fav.provider === currentProvider && fav.model === currentModel
                      ? 'text-primary-500 i-solar:star-bold'
                      : 'text-neutral-300 group-hover:text-primary-400 i-solar:star-linear',
                  ]"
                />
                <div class="flex flex-col overflow-hidden">
                  <span class="truncate text-xs text-neutral-800 font-semibold dark:text-neutral-200">
                    {{ fav.name }}
                  </span>
                  <span class="truncate text-[9px] text-neutral-400 font-mono">
                    {{ fav.provider }} / {{ fav.model }}
                  </span>
                </div>
              </div>

              <div class="flex shrink-0 items-center gap-1 pl-2">
                <!-- Checkmark when active -->
                <div
                  v-if="fav.provider === currentProvider && fav.model === currentModel"
                  class="i-solar:check-circle-bold text-sm text-primary-500"
                />
                <!-- Delete Button -->
                <button
                  type="button"
                  class="rounded p-1 text-neutral-400 opacity-0 transition-all hover:text-red-500 group-hover:opacity-100"
                  title="Remove Favorite"
                  @click.stop="handleDeleteFavorite(fav)"
                >
                  <div class="i-solar:trash-bin-trash-bold-duotone text-xs" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Add Favorite Form Trigger / Inline Collapse -->
        <div class="border-t border-neutral-100 pt-3.5 dark:border-neutral-800">
          <Transition
            enter-active-class="transition-all duration-200 ease-out"
            enter-from-class="opacity-0 -translate-y-1 scale-95"
            enter-to-class="opacity-100 translate-y-0 scale-100"
            leave-active-class="transition-all duration-150 ease-in"
            leave-from-class="opacity-100 translate-y-0 scale-100"
            leave-to-class="opacity-0 -translate-y-1 scale-95"
            mode="out-in"
          >
            <!-- Toggle Button -->
            <button
              v-if="!showAddForm"
              type="button"
              class="w-full flex items-center justify-center gap-1.5 border border-neutral-200 rounded-xl border-dashed py-2 text-xs text-neutral-500 font-semibold transition-all active:scale-98 dark:border-neutral-800 hover:border-primary-300 hover:text-primary-500 dark:hover:border-primary-800"
              @click="showAddForm = true"
            >
              <div class="i-solar:add-circle-linear text-sm" />
              <span>Add New Favorite</span>
            </button>

            <!-- Form -->
            <div v-else class="space-y-2.5">
              <div class="flex items-center justify-between">
                <span class="text-[10px] text-neutral-400 font-bold tracking-wider uppercase">Add Favorite</span>
                <button
                  type="button"
                  class="text-[10px] text-neutral-400 font-semibold hover:text-neutral-600 dark:hover:text-neutral-200"
                  @click="showAddForm = false"
                >
                  Cancel
                </button>
              </div>

              <!-- Custom Label Name -->
              <input
                v-model="newName"
                type="text"
                placeholder="Name (e.g. Fast Model)"
                class="w-full border border-neutral-200/60 rounded-lg bg-transparent px-2.5 py-1.5 text-xs text-neutral-800 outline-none transition-all dark:border-neutral-800 focus:border-primary-500 dark:text-neutral-200 placeholder:text-neutral-400/60 focus:ring-1 focus:ring-primary-500/20"
              >

              <!-- Provider & Model Selectors -->
              <div class="flex gap-2">
                <div class="flex-1">
                  <select
                    v-model="newProvider"
                    class="w-full border border-neutral-200/60 rounded-lg bg-white px-2 py-1.5 text-xs text-neutral-800 outline-none transition-all dark:border-neutral-800 focus:border-primary-500 dark:bg-neutral-900 dark:text-neutral-200 focus:ring-1 focus:ring-primary-500/20"
                  >
                    <option v-for="prov in configuredChatProviderOptions" :key="prov.value" :value="prov.value">
                      {{ prov.label }}
                    </option>
                  </select>
                </div>

                <div class="flex-1">
                  <select
                    v-model="newModel"
                    class="w-full border border-neutral-200/60 rounded-lg bg-white px-2 py-1.5 text-xs text-neutral-800 outline-none transition-all dark:border-neutral-800 focus:border-primary-500 dark:bg-neutral-900 dark:text-neutral-200 focus:ring-1 focus:ring-primary-500/20"
                    :disabled="isLoadingModels || availableModels.length === 0"
                  >
                    <option value="" disabled selected>
                      {{ isLoadingModels ? 'Loading...' : availableModels.length === 0 ? 'No Models' : 'Select Model' }}
                    </option>
                    <option v-for="model in availableModels" :key="model.id" :value="model.id">
                      {{ model.name || model.id.split('/').pop() || model.id }}
                    </option>
                  </select>
                </div>
              </div>

              <!-- Add Button -->
              <button
                type="button"
                class="w-full flex items-center justify-center gap-1.5 rounded-xl bg-primary-500 px-3 py-2 text-xs text-white font-bold tracking-wider uppercase shadow-md shadow-primary-500/10 transition-all disabled:pointer-events-none active:scale-[0.98] disabled:scale-100 hover:scale-[1.02] hover:bg-primary-600 disabled:opacity-40"
                :disabled="!newName.trim() || !newModel"
                @click="handleAddFavorite"
              >
                <div class="i-solar:add-circle-bold-duotone text-sm" />
                <span>Save Favorite</span>
              </button>
            </div>
          </Transition>
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
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
