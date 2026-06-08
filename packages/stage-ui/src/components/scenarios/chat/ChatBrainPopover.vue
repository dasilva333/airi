<script setup lang="ts">
import { defineInvoke, defineInvokeEventa } from '@moeru/eventa'
import { getElectronEventaContext } from '@proj-airi/electron-vueuse'
import { isStageTamagotchi } from '@proj-airi/stage-shared'
import { useLocalStorage } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

import { useAiriCardStore } from '../../../stores/modules/airi-card'
import { useConsciousnessStore } from '../../../stores/modules/consciousness'
import { useProvidersStore } from '../../../stores/providers'

withDefaults(defineProps<{
  /** Tooltip for the main button */
  title?: string
  variant?: 'default' | 'mobile'
}>(), {
  title: 'Model & Provider',
  variant: 'default',
})

// Store bindings
const consciousnessStore = useConsciousnessStore()
const providersStore = useProvidersStore()
const airiCardStore = useAiriCardStore()

const { activeProvider, activeModel } = storeToRefs(consciousnessStore)
const { activeCard, activeCardId, cards } = storeToRefs(airiCardStore)
const { configuredChatProvidersMetadata } = storeToRefs(providersStore)

const showAddForm = ref(false)

interface FavoriteModel {
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

  // Seeding Debug Logs deleted
}, { immediate: true, deep: true })

const electronLocalLlmGetStatus = defineInvokeEventa<any>('eventa:invoke:electron:local-llm:get-status')
const electronLocalLlmStartServer = defineInvokeEventa<void, { modelId: string }>('eventa:invoke:electron:local-llm:start-server')
const electronLocalLlmStopServer = defineInvokeEventa<void>('eventa:invoke:electron:local-llm:stop-server')

const localLlmStatus = ref<any>(null)
const isStartingServer = ref(false)
let localLlmPollInterval: any = null

const isLlmActive = computed(() => {
  if (activeProvider.value === 'local-llm') {
    return localLlmStatus.value?.state === 'running'
  }
  return !!activeProvider.value && !!activeModel.value
})

async function updateLocalLlmStatus() {
  if (!isStageTamagotchi())
    return
  if (typeof window === 'undefined')
    return
  const context = getElectronEventaContext()
  if (!context)
    return
  try {
    const getStatus = defineInvoke(context, electronLocalLlmGetStatus)
    localLlmStatus.value = await getStatus()
  }
  catch (err) {
    console.error('[ChatBrainPopover] Failed to get local LLM status:', err)
  }
}

async function handleStartServer() {
  if (typeof window === 'undefined' || isStartingServer.value || !activeModel.value)
    return
  const context = getElectronEventaContext()
  if (!context)
    return
  try {
    isStartingServer.value = true
    if (localLlmStatus.value) {
      localLlmStatus.value.state = 'starting'
    }
    const startServer = defineInvoke(context, electronLocalLlmStartServer)
    await startServer({ modelId: activeModel.value })
    providersStore.forceProviderConfigured('local-llm')
    await updateLocalLlmStatus()
    await providersStore.fetchModelsForProvider('local-llm')
    await providersStore.validateProvider('local-llm', { force: true })
  }
  catch (err) {
    console.error('[ChatBrainPopover] Failed to start local LLM server:', err)
  }
  finally {
    isStartingServer.value = false
  }
}

async function handleStopServer() {
  if (typeof window === 'undefined')
    return
  const context = getElectronEventaContext()
  if (!context)
    return
  try {
    const stopServer = defineInvoke(context, electronLocalLlmStopServer)
    const runtimeState = providersStore.providerRuntimeState['local-llm']
    if (runtimeState) {
      runtimeState.models = []
      runtimeState.isConfigured = false
    }
    if (localLlmStatus.value) {
      localLlmStatus.value.state = 'stopped'
    }
    await stopServer()
    await updateLocalLlmStatus()
    await providersStore.fetchModelsForProvider('local-llm')
    await providersStore.validateProvider('local-llm', { force: true })
  }
  catch (err) {
    console.error('[ChatBrainPopover] Failed to stop local LLM server:', err)
  }
}

watch(activeProvider, (provider) => {
  if (provider === 'local-llm') {
    updateLocalLlmStatus()
    if (!localLlmPollInterval) {
      localLlmPollInterval = setInterval(updateLocalLlmStatus, 3000)
    }
  }
  else {
    if (localLlmPollInterval) {
      clearInterval(localLlmPollInterval)
      localLlmPollInterval = null
    }
  }
}, { immediate: true })

onUnmounted(() => {
  if (localLlmPollInterval) {
    clearInterval(localLlmPollInterval)
  }
})

onMounted(() => {
  // Pre-fill the form default provider with first configured provider
  if (configuredChatProvidersMetadata.value.length > 0) {
    newProvider.value = configuredChatProvidersMetadata.value[0].id
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
    availableModels.value = providersStore.getModelsForProvider(provider)
  }
  catch (err) {
    console.error('[ChatBrainPopover] Failed to load models for provider:', provider, err)
    availableModels.value = []
  }
  finally {
    isLoadingModels.value = false
  }
}, { immediate: true })

function handleAddFavorite() {
  if (!newModel.value)
    return

  const fallbackName = newModel.value.split('/').pop() || newModel.value
  const displayName = newName.value.trim() || fallbackName

  favorites.value.push({
    id: String(Date.now()),
    name: displayName,
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

const electronOpenSettings = defineInvokeEventa<void, { route?: string }>('eventa:invoke:electron:windows:settings:open')

function handleGoToSettings() {
  const context = getElectronEventaContext()
  if (context) {
    try {
      const openSettings = defineInvoke(context, electronOpenSettings)
      void openSettings({ route: '/settings/modules/consciousness' })
    }
    catch (err) {
      console.error('[ChatBrainPopover] Failed to open settings window:', err)
    }
  }
}
</script>

<template>
  <PopoverRoot>
    <PopoverTrigger as-child>
      <button
        v-if="variant === 'mobile'"
        class="w-fit flex items-center justify-center border-2 border-neutral-100/60 rounded-xl border-solid bg-neutral-50/70 p-2 backdrop-blur-md transition-all active:scale-95 dark:border-neutral-800/30 dark:bg-neutral-800/70"
        :title="title"
      >
        <div class="i-ph:brain-duotone size-5 text-neutral-500 dark:text-neutral-400" />
      </button>
      <button
        v-else
        class="max-h-[10lh] min-h-[1lh] flex items-center justify-center rounded-md p-2 outline-none transition-colors transition-transform active:scale-95"
        bg="neutral-100 dark:neutral-800"
        text="lg neutral-500 dark:neutral-400"
        hover:text="primary-500 dark:primary-400"
        :title="title"
      >
        <div class="i-ph:brain-duotone" />
      </button>
    </PopoverTrigger>

    <PopoverPortal>
      <PopoverContent
        side="top"
        :side-offset="8"
        align="end"
        class="animate-in fade-in zoom-in z-100 w-80 border border-neutral-200/50 rounded-2xl bg-white/90 p-4 shadow-2xl backdrop-blur-xl duration-200 dark:border-neutral-700/50 dark:bg-neutral-900/90"
      >
        <!-- Header -->
        <div class="mb-3 flex items-center justify-between border-b border-neutral-100 pb-2 dark:border-neutral-800">
          <div class="flex items-center gap-1.5">
            <div class="i-ph:brain-duotone text-base text-primary-500" />
            <span class="text-xs text-neutral-400 font-bold tracking-wider uppercase">Model & Provider</span>
          </div>
          <div class="flex items-center gap-1.5">
            <button
              class="flex items-center justify-center rounded p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
              title="Open Consciousness Settings"
              @click="handleGoToSettings"
            >
              <div class="i-solar:settings-bold-duotone text-sm" />
            </button>
            <span class="rounded bg-primary-500/10 px-1.5 py-0.5 text-[9px] text-primary-500 font-bold font-mono uppercase dark:bg-primary-500/20">Real-Time</span>
          </div>
        </div>

        <!-- Sleek, Compact Active Status Badge -->
        <div class="mb-3.5 flex items-center justify-between gap-2 border border-neutral-200/30 rounded-xl bg-neutral-50/50 px-2.5 py-1.5 text-[10px] dark:border-neutral-800/60 dark:bg-neutral-800/20">
          <div class="flex items-center gap-1.5">
            <span
              :class="[
                'size-1.5 rounded-full',
                isLlmActive ? 'bg-emerald-500 animate-pulse' : 'bg-red-500',
              ]"
            />
            <span class="text-neutral-400 font-bold tracking-tight uppercase">
              {{ isLlmActive ? 'Active' : 'Inactive' }}
            </span>
          </div>
          <span class="max-w-48 truncate text-neutral-700 font-semibold font-mono dark:text-neutral-300">
            {{ activeProvider }} / {{ activeModel?.split('/').pop() || activeModel || 'None' }}
          </span>
        </div>

        <!-- Local LLM Server Controls -->
        <div
          v-if="activeProvider === 'local-llm' && localLlmStatus"
          class="mb-3.5 flex items-center justify-between gap-2 border border-neutral-200/30 rounded-xl bg-neutral-50/50 px-2.5 py-1.5 text-[10px] dark:border-neutral-800/60 dark:bg-neutral-800/20"
        >
          <div class="flex items-center gap-1.5">
            <span
              :class="[
                'size-1.5 rounded-full',
                localLlmStatus.state === 'running'
                  ? 'bg-emerald-500 animate-pulse'
                  : localLlmStatus.state === 'starting'
                    ? 'bg-amber-500 animate-pulse'
                    : 'bg-red-500',
              ]"
            />
            <span class="text-neutral-400 font-bold uppercase">Local Server</span>
          </div>

          <div class="flex items-center gap-1.5">
            <span
              v-if="localLlmStatus.state === 'starting'"
              class="animate-pulse text-amber-500 font-semibold"
            >
              Starting...
            </span>
            <button
              v-else-if="localLlmStatus.state === 'running'"
              class="rounded bg-red-500/15 px-2 py-0.5 text-[9px] text-red-500 font-bold transition-all hover:bg-red-500/25"
              @click="handleStopServer"
            >
              Stop Server
            </button>
            <button
              v-else
              class="rounded bg-emerald-500/15 px-2 py-0.5 text-[9px] text-emerald-500 font-bold transition-all hover:bg-emerald-500/25"
              :disabled="isStartingServer"
              @click="handleStartServer"
            >
              Start Server
            </button>
          </div>
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
                fav.provider === activeProvider && fav.model === activeModel
                  ? 'bg-primary-50/50 border-primary-200/50 dark:bg-primary-950/20 dark:border-primary-800/50'
                  : 'bg-white/40 border-neutral-100 hover:bg-neutral-50 dark:bg-neutral-900/40 dark:border-neutral-800 dark:hover:bg-neutral-800/40',
              ]"
              @click="handleSelectFavorite(fav)"
            >
              <div class="flex flex-1 items-center gap-2 overflow-hidden">
                <div
                  :class="[
                    'text-sm shrink-0',
                    fav.provider === activeProvider && fav.model === activeModel
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
                  v-if="fav.provider === activeProvider && fav.model === activeModel"
                  class="i-solar:check-circle-bold text-sm text-primary-500"
                />
                <!-- Delete Button -->
                <button
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
                    <option v-for="prov in configuredChatProvidersMetadata" :key="prov.id" :value="prov.id">
                      {{ prov.name || prov.localizedName || prov.id }}
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
                class="w-full flex items-center justify-center gap-1.5 rounded-xl bg-primary-500 px-3 py-2 text-xs text-white font-bold tracking-wider uppercase shadow-md shadow-primary-500/10 transition-all disabled:pointer-events-none active:scale-[0.98] disabled:scale-100 hover:scale-[1.02] hover:bg-primary-600 disabled:opacity-40"
                :disabled="!newModel"
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
