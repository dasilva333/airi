<script setup lang="ts">
/**
 * Avatars popover — display-model catalogue with search, format filter,
 * per-character favourites and pagination.
 *
 * Self-serving: it owns the catalogue store and the Preview/Apply mode. Opening
 * the popover refreshes the display-model catalogue (previously a watcher on
 * `activePopover` in the shell).
 */
import { useLocalStorageManualReset } from '@proj-airi/stage-shared/composables'
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref, watch } from 'vue'

import StripPopover from '../StripPopover.vue'

import { useDisplayModelsStore } from '../../../../stores/display-models'
import { useAiriCardStore } from '../../../../stores/modules/airi-card'
import { useSettings } from '../../../../stores/settings'

const emit = defineEmits<{ close: [] }>()

const settingsStore = useSettings()
const displayModelsStore = useDisplayModelsStore()
const cardStore = useAiriCardStore()
const { activeCard, activeCardId } = storeToRefs(cardStore)

const avatarSearch = ref('')
const avatarTypeFilter = ref('all')
const currentAvatarPage = ref(1)

watch([avatarSearch, avatarTypeFilter], () => {
  currentAvatarPage.value = 1
})

const favoritesByCharacter = useLocalStorageManualReset<Record<string, string[]>>('settings/control-strip/avatar-favorites-by-char', {})

const characterFavorites = computed(() => {
  const charId = activeCardId.value || 'global'
  const ids = favoritesByCharacter.value[charId] || []
  return displayModelsStore.displayModels.filter(m => ids.includes(m.id))
})

const filteredAvatars = computed(() => {
  let list = displayModelsStore.displayModels

  // Search filter (matches name or tags partially)
  if (avatarSearch.value.trim()) {
    const query = avatarSearch.value.trim().toLowerCase()
    list = list.filter((m) => {
      const nameMatches = m.name.toLowerCase().includes(query)
      const tagMatches = m.tags && Array.isArray(m.tags) && m.tags.some(t => t.toLowerCase().includes(query))
      return nameMatches || tagMatches
    })
  }

  // Format filter
  if (avatarTypeFilter.value !== 'all') {
    const type = avatarTypeFilter.value
    list = list.filter((m) => {
      if (type === 'live2d')
        return m.format.startsWith('live2d')
      if (type === 'vrm')
        return m.format === 'vrm'
      if (type === 'spine')
        return m.format.startsWith('spine')
      if (type === 'mmd')
        return m.format === 'pmx-zip' || m.format === 'pmd' || m.format === 'pmx-directory'
      return true
    })
  }

  return list
})

const totalAvatarPages = computed(() => {
  return Math.ceil(filteredAvatars.value.length / 12) || 1
})

const paginatedAvatars = computed(() => {
  const start = (currentAvatarPage.value - 1) * 12
  return filteredAvatars.value.slice(start, start + 12)
})

function isAvatarFavorite(modelId: string) {
  const charId = activeCardId.value || 'global'
  const current = favoritesByCharacter.value[charId] || []
  return current.includes(modelId)
}

function toggleAvatarFavorite(modelId: string) {
  const charId = activeCardId.value || 'global'
  const current = favoritesByCharacter.value[charId] || []
  if (current.includes(modelId)) {
    favoritesByCharacter.value[charId] = current.filter(id => id !== modelId)
  }
  else {
    favoritesByCharacter.value[charId] = [...current, modelId]
  }
}

// NOTICE: persisted (not a plain ref) so the Preview/Apply choice survives
// popover close — the shell previously held it for the whole session.
const avatarApplyMode = useLocalStorageManualReset<'preview' | 'apply'>('settings/control-strip/avatar-apply-mode', 'preview')

function selectAvatar(modelId: string) {
  settingsStore.stageModelSelected = modelId

  if (avatarApplyMode.value === 'apply' && activeCard.value && activeCardId.value) {
    const card = activeCard.value
    void cardStore.updateCard(activeCardId.value, {
      extensions: {
        ...card.extensions,
        airi: {
          ...card.extensions?.airi,
          modules: {
            ...card.extensions?.airi?.modules,
            displayModelId: modelId,
          },
          active_state: {
            ...card.extensions?.airi?.active_state,
            displayModelId: modelId,
          },
        },
      },
    })
  }

  emit('close')
}

// Opening the popover refreshes the catalogue (was a shell watcher on activePopover).
onMounted(() => {
  void displayModelsStore.loadDisplayModelsFromIndexedDB(true)
})
</script>

<template>
  <StripPopover title="Avatars" header-padding="1.5" @close="emit('close')">
    <!-- Segmented Toggle: Preview vs Apply -->
    <div class="flex rounded-xl bg-neutral-200/40 p-0.5 dark:bg-neutral-950/40">
      <button
        :class="[
          'flex-1 text-[10px] font-bold py-1 rounded-lg transition-all cursor-pointer text-center',
          avatarApplyMode === 'preview'
            ? 'bg-white text-neutral-800 shadow-sm dark:bg-neutral-800 dark:text-neutral-100'
            : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300',
        ]"
        @click="avatarApplyMode = 'preview'"
      >
        Preview
      </button>
      <button
        :class="[
          'flex-1 text-[10px] font-bold py-1 rounded-lg transition-all cursor-pointer text-center',
          avatarApplyMode === 'apply'
            ? 'bg-white text-neutral-800 shadow-sm dark:bg-neutral-800 dark:text-neutral-100'
            : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300',
        ]"
        @click="avatarApplyMode = 'apply'"
      >
        Apply to Char
      </button>
    </div>

    <!-- FAVORITES SECTION (GRID) -->
    <div v-if="characterFavorites.length > 0" class="flex flex-col gap-1">
      <span class="text-[10px] text-neutral-400 font-bold tracking-wider uppercase">Favorites</span>
      <div class="grid grid-cols-3 gap-1">
        <div
          v-for="model in characterFavorites"
          :key="model.id"
          class="group relative aspect-square cursor-pointer overflow-hidden border border-neutral-200/40 rounded-xl bg-neutral-200/10 dark:border-neutral-800/40 dark:bg-neutral-800/10 hover:ring-2 hover:ring-sky-500/50"
          @click="selectAvatar(model.id)"
        >
          <img
            v-if="model.previewImage"
            :src="model.previewImage"
            class="h-full w-full object-cover"
          >
          <div v-else class="h-full w-full flex items-center justify-center bg-neutral-500/10 text-neutral-400">
            <span class="i-solar:user-bold-duotone text-lg" />
          </div>
          <div class="absolute bottom-0 left-0 right-0 truncate bg-black/60 px-1 py-0.5 text-center text-[8px] text-white opacity-0 transition-opacity group-hover:opacity-100">
            {{ model.name }}
          </div>
          <!-- Star Corner Favorite Button -->
          <button
            class="absolute right-0.5 top-0.5 h-4 w-4 flex items-center justify-center rounded-full bg-black/40 text-amber-400 hover:bg-black/60"
            @click.stop="toggleAvatarFavorite(model.id)"
          >
            <span class="i-solar:star-bold text-[10px]" />
          </button>
        </div>
      </div>
      <div class="my-1.5 border-b border-neutral-200/50 dark:border-neutral-800/50" />
    </div>

    <!-- SEARCH INPUT -->
    <div class="relative">
      <span class="i-solar:magnifer-linear absolute left-2.5 top-2 text-xs text-neutral-400" />
      <input
        v-model="avatarSearch"
        type="text"
        placeholder="Search avatars..."
        class="w-full border border-neutral-200/10 rounded-xl bg-neutral-200/40 py-1 pl-7 pr-2.5 text-[11px] text-neutral-700 dark:border-neutral-800/10 dark:bg-neutral-800/40 dark:text-neutral-300 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
      >
    </div>

    <!-- TYPE SELECT DROPDOWN -->
    <div class="flex items-center gap-1.5">
      <span class="truncate text-[10px] text-neutral-400 font-semibold">Format:</span>
      <select
        v-model="avatarTypeFilter"
        class="flex-1 cursor-pointer border border-neutral-200/10 rounded-xl bg-neutral-200/40 px-2 py-0.5 text-[10px] text-neutral-700 dark:border-neutral-800/10 dark:bg-neutral-800/40 dark:text-neutral-300 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
      >
        <option value="all">
          All
        </option>
        <option value="live2d">
          Live2D
        </option>
        <option value="vrm">
          VRM
        </option>
        <option value="spine">
          Spine
        </option>
        <option value="mmd">
          MMD
        </option>
      </select>
    </div>

    <!-- COLLECTION GRID -->
    <div class="grid grid-cols-3 gap-1">
      <div
        v-for="model in paginatedAvatars"
        :key="model.id"
        :class="[
          'group relative aspect-square border rounded-xl overflow-hidden cursor-pointer bg-neutral-200/10 dark:bg-neutral-800/10',
          settingsStore.stageModelSelected === model.id
            ? 'border-sky-500 ring-2 ring-sky-500/40'
            : 'border-neutral-200/40 dark:border-neutral-800/40 hover:ring-2 hover:ring-sky-500/50',
        ]"
        @click="selectAvatar(model.id)"
      >
        <img
          v-if="model.previewImage"
          :src="model.previewImage"
          class="h-full w-full object-cover"
        >
        <div v-else class="h-full w-full flex items-center justify-center bg-neutral-500/10 text-neutral-400">
          <span class="i-solar:user-bold-duotone text-lg" />
        </div>
        <div class="absolute bottom-0 left-0 right-0 truncate bg-black/60 px-1 py-0.5 text-center text-[8px] text-white opacity-0 transition-opacity group-hover:opacity-100">
          {{ model.name }}
        </div>
        <!-- Hover Favorite Star -->
        <button
          :class="[
            'absolute top-0.5 right-0.5 h-4 w-4 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/60 transition-opacity',
            isAvatarFavorite(model.id) ? 'text-amber-400 opacity-100' : 'text-white opacity-0 group-hover:opacity-100',
          ]"
          @click.stop="toggleAvatarFavorite(model.id)"
        >
          <span :class="isAvatarFavorite(model.id) ? 'i-solar:star-bold text-[10px]' : 'i-solar:star-linear text-[10px]'" />
        </button>
      </div>

      <!-- Empty state for search -->
      <div
        v-if="filteredAvatars.length === 0"
        class="col-span-3 flex flex-col items-center justify-center py-6 text-center opacity-40"
      >
        <span class="i-solar:user-bold-duotone text-xl" />
        <span class="mt-1 text-[9px]">No models found</span>
      </div>
    </div>

    <!-- PAGINATION CONTROLS -->
    <div v-if="totalAvatarPages > 1" class="mt-1 flex items-center justify-between gap-2 border-t border-neutral-200/50 pt-1.5 dark:border-neutral-800/50">
      <button
        :disabled="currentAvatarPage <= 1"
        class="h-5 w-5 flex cursor-pointer items-center justify-center rounded-lg bg-neutral-200/40 text-neutral-600 disabled:cursor-not-allowed dark:bg-neutral-800/40 hover:bg-neutral-200 dark:text-neutral-400 disabled:opacity-30 dark:hover:bg-neutral-700"
        @click="currentAvatarPage--"
      >
        <span class="i-solar:arrow-left-linear text-xs" />
      </button>
      <span class="text-[9px] text-neutral-400 font-semibold">Page {{ currentAvatarPage }} of {{ totalAvatarPages }}</span>
      <button
        :disabled="currentAvatarPage >= totalAvatarPages"
        class="h-5 w-5 flex cursor-pointer items-center justify-center rounded-lg bg-neutral-200/40 text-neutral-600 disabled:cursor-not-allowed dark:bg-neutral-800/40 hover:bg-neutral-200 dark:text-neutral-400 disabled:opacity-30 dark:hover:bg-neutral-700"
        @click="currentAvatarPage++"
      >
        <span class="i-solar:arrow-right-linear text-xs" />
      </button>
    </div>
  </StripPopover>
</template>
