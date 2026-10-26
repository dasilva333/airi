<script setup lang="ts">
/**
 * Characters popover — card library with search, favourites, view mode and the
 * selective-sync filter.
 *
 * Self-serving: owns the airi-card and sync-engine reads plus the profile
 * navigation it triggers. It dispatches the same `control-strip:open-settings`
 * window event the shell used to, so the desktop host contract is unchanged.
 */
import { normalizeSearchText } from '@proj-airi/stage-shared'
import { useLocalStorage } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'

import CharacterAvatar from '../../../misc/CharacterAvatar.vue'
import StripPopover from '../StripPopover.vue'

import { useControlStripSettingsRoute } from '../../../../composables/use-control-strip-settings-route'
import { useAiriCardStore } from '../../../../stores/modules/airi-card'
import { useSyncEngineStore } from '../../../../stores/sync-engine'

const emit = defineEmits<{ close: [] }>()

const cardStore = useAiriCardStore()
const { cards, activeCardId } = storeToRefs(cardStore)

const syncEngineStore = useSyncEngineStore()
const { selectiveSyncEnabled } = storeToRefs(syncEngineStore)
const cardSyncFilter = ref<'all' | 'synced'>(selectiveSyncEnabled.value ? 'synced' : 'all')

const { openSettingsRoute } = useControlStripSettingsRoute()
watch(selectiveSyncEnabled, (enabled) => {
  cardSyncFilter.value = enabled ? 'synced' : 'all'
})

function getCardSyncStatus(cardId: string): 'synced' | 'cloud-only' | 'partial' {
  const displayModelId = cardStore.getCardDisplayModelId(cardId)
  return syncEngineStore.getCardSyncStatus(cardId, displayModelId)
}

const characterSearch = ref('')
const characterViewMode = useLocalStorage<'list' | 'grid'>(
  'settings/control-strip/character-view-mode',
  'list',
)
// Global character favorites: max 3 IDs, FIFO pop on overflow
const charFavIds = useLocalStorage<string[]>(
  'settings/control-strip/character-favorites-global',
  [],
)

const charFavEntries = computed(() =>
  charFavIds.value
    .map(id => [id, cards.value.get(id)] as [string, typeof cards.value extends Map<string, infer V> ? V : never])
    .filter(([id, card]) => {
      if (!card)
        return false
      if (selectiveSyncEnabled.value && cardSyncFilter.value === 'synced')
        return getCardSyncStatus(id) === 'synced'
      return true
    }),
)

const sortedCharacters = computed(() => {
  const query = normalizeSearchText(characterSearch.value)
  let entries = [...cards.value.entries()].map(([id, card], idx) => ({ id, card, idx }))

  if (selectiveSyncEnabled.value && cardSyncFilter.value === 'synced') {
    entries = entries.filter(({ id }) => getCardSyncStatus(id) === 'synced')
  }

  const filtered = entries.filter(({ id, card }) => {
    if (!query)
      return true
    const name = normalizeSearchText(card.name || (card as any).data?.name)
    const nickname = normalizeSearchText(card.nickname || (card as any).data?.nickname)
    const idNorm = normalizeSearchText(id)
    const desc = normalizeSearchText(card.description || (card as any).data?.description)
    return name.includes(query)
      || nickname.includes(query)
      || idNorm.includes(query)
      || desc.includes(query)
  })
  filtered.sort((a, b) => {
    if (a.card.createdAt !== undefined && b.card.createdAt !== undefined)
      return b.card.createdAt - a.card.createdAt
    return b.idx - a.idx
  })
  return filtered.map(({ id, card }) => [id, card] as [string, typeof card])
})

function isCharFav(id: string) {
  return charFavIds.value.includes(id)
}

function toggleCharFav(id: string) {
  const favs = [...charFavIds.value]
  const idx = favs.indexOf(id)
  if (idx !== -1) {
    favs.splice(idx, 1)
  }
  else {
    if (favs.length >= 3)
      favs.shift() // FIFO: drop oldest
    favs.push(id)
  }
  charFavIds.value = favs
}

function handleEditActiveCard() {
  if (!activeCardId.value)
    return
  openSettingsRoute(`/settings/airi-card/edit?id=${activeCardId.value}`)
  emit('close')
}

function handleViewGallery() {
  if (activeCardId.value) {
    openSettingsRoute(`/settings/airi-card?cardId=${activeCardId.value}&tab=gallery`)
    emit('close')
  }
}

function handleManageProfiles() {
  openSettingsRoute('/settings/airi-card')
  emit('close')
}
</script>

<template>
  <StripPopover title="Characters" @close="emit('close')">
    <template #header>
      <div class="flex items-center justify-between border-b border-neutral-200/80 pb-2 dark:border-neutral-800">
        <div class="min-w-0 flex items-center gap-1.5">
          <span class="shrink-0 text-xs text-neutral-800 font-bold tracking-wider uppercase dark:text-neutral-200">Characters</span>
          <span class="shrink-0 rounded-full bg-neutral-200/60 px-1.5 py-0.2 text-[10px] text-neutral-600 font-semibold dark:bg-neutral-800 dark:text-neutral-400">{{ sortedCharacters.length !== cards.size ? `${sortedCharacters.length}/${cards.size}` : cards.size }}</span>
          <!-- Selective Sync Filter Toggle (Only visible when selective sync is enabled) -->
          <button
            v-if="selectiveSyncEnabled"
            type="button"
            :class="[
              'flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[10px] font-semibold transition-all cursor-pointer shrink-0',
              cardSyncFilter === 'synced'
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25 ring-1 ring-emerald-500/30 font-bold'
                : 'bg-neutral-200/60 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700',
            ]"
            :title="cardSyncFilter === 'synced' ? 'Showing synced characters only. Tap to show all' : 'Showing all characters. Tap to show synced only'"
            @click="cardSyncFilter = cardSyncFilter === 'synced' ? 'all' : 'synced'"
          >
            <div v-if="cardSyncFilter === 'synced'" class="i-solar:bolt-bold text-[10px] text-emerald-500" />
            <span>{{ cardSyncFilter === 'synced' ? 'Synced' : 'All' }}</span>
          </button>
        </div>
        <div class="flex items-center gap-1">
          <button
            class="size-6 flex cursor-pointer items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-100 dark:text-neutral-400 hover:text-neutral-800 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
            title="Toggle view mode"
            @click="characterViewMode = characterViewMode === 'list' ? 'grid' : 'list'"
          >
            <span :class="characterViewMode === 'list' ? 'i-solar:grid-bold text-xs' : 'i-solar:list-bold text-xs'" />
          </button>
          <button
            class="size-6 flex cursor-pointer items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
            @click="emit('close')"
          >
            <span class="i-solar:close-circle-outline text-base" />
          </button>
        </div>
      </div>
    </template>

    <!-- SEARCH INPUT -->
    <div class="relative">
      <span class="i-solar:magnifer-linear absolute left-2.5 top-1/2 text-xs text-neutral-500 -translate-y-1/2 dark:text-neutral-400" />
      <input
        v-model="characterSearch"
        type="text"
        placeholder="Search characters..."
        class="shadow-xs w-full border border-neutral-300 rounded-xl bg-neutral-100/70 py-1.5 pl-7.5 pr-7 text-[11px] text-neutral-800 transition-colors dark:border-neutral-700 focus:border-amber-500 dark:bg-neutral-800/90 focus:bg-white dark:text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:focus:bg-neutral-800 dark:placeholder:text-neutral-400"
      >
      <button
        v-if="characterSearch"
        type="button"
        class="absolute right-2 top-1/2 text-neutral-400 -translate-y-1/2 hover:text-neutral-600 dark:hover:text-neutral-200"
        @click="characterSearch = ''"
      >
        <span class="i-solar:close-circle-bold text-xs" />
      </button>
    </div>

    <!-- FAVORITES SECTION (GRID - THUMBNAILS ONLY) -->
    <div v-if="charFavEntries.length > 0" class="grid grid-cols-3 gap-1">
      <div
        v-for="[id, card] in charFavEntries"
        :key="id"
        :title="card.nickname ? `${card.nickname} (${card.name})` : card.name"
        :class="[
          'group relative aspect-square cursor-pointer overflow-hidden border rounded-xl bg-neutral-100 dark:bg-neutral-800/40 hover:ring-2 hover:ring-amber-500/50 transition-all duration-200 shadow-xs',
          id === activeCardId ? 'border-amber-400 ring-2 ring-amber-400/50' : 'border-neutral-200 dark:border-neutral-700/60',
        ]"
        @click="cardStore.activateCard(id); emit('close')"
      >
        <CharacterAvatar
          :card-id="id"
          :name="card.name"
          :display-model-id="cardStore.getCardDisplayModelId(id)"
          shape="rounded"
          size-class="h-full w-full"
        />
        <div class="absolute bottom-0 left-0 right-0 truncate bg-black/60 px-1 py-0.5 text-center text-[8px] text-white opacity-0 transition-opacity group-hover:opacity-100">
          {{ card.nickname || card.name }}
        </div>
        <!-- Star Corner Favorite Button -->
        <button
          type="button"
          class="absolute right-0.5 top-0.5 size-4 flex cursor-pointer items-center justify-center rounded-full bg-black/40 text-amber-400 hover:bg-black/60"
          @click.stop="toggleCharFav(id)"
        >
          <span class="i-solar:star-bold text-[10px]" />
        </button>
      </div>
    </div>

    <!-- LIST VIEW -->
    <div v-if="characterViewMode === 'list'" class="max-h-48 flex flex-col gap-1 overflow-y-auto py-1 scrollbar-thin">
      <div
        v-for="[id, card] in sortedCharacters"
        :key="id"
        :class="[
          'group w-full flex items-center justify-between cursor-pointer border rounded-xl px-2.5 py-1.5 text-left text-xs transition-all duration-200',
          id === activeCardId
            ? 'bg-amber-500/15 border-amber-400/60 text-amber-800 dark:text-amber-200 font-semibold shadow-xs ring-1 ring-amber-400/30'
            : 'bg-white dark:bg-neutral-800/60 border-neutral-200/80 dark:border-neutral-700/60 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 shadow-xs hover:border-neutral-300 dark:hover:border-neutral-600',
        ]"
        @click="cardStore.activateCard(id); emit('close')"
      >
        <div class="min-w-0 flex flex-1 items-center gap-2.5">
          <CharacterAvatar
            :card-id="id"
            :name="card.name"
            :display-model-id="cardStore.getCardDisplayModelId(id)"
            shape="rounded"
            size-class="size-8 shrink-0"
          />
          <div class="min-w-0 flex flex-1 flex-col">
            <div class="flex items-center gap-1.5 truncate">
              <span class="truncate font-semibold">{{ card.nickname || card.name }}</span>
              <span v-if="id === activeCardId" class="shrink-0 scale-90 border border-amber-500/30 rounded bg-amber-500/20 px-1 py-0.2 text-[8px] text-amber-700 font-bold uppercase dark:text-amber-300">Active</span>
            </div>
            <span v-if="card.nickname && card.name && card.nickname.trim() !== card.name.trim()" class="truncate text-[10px] text-neutral-400 dark:text-neutral-500">
              {{ card.name }}
            </span>
          </div>
        </div>
        <!-- Right Star Toggle -->
        <button
          type="button"
          class="size-6 flex shrink-0 cursor-pointer items-center justify-center rounded-lg transition-all"
          :class="[
            isCharFav(id)
              ? 'text-amber-400 hover:bg-amber-400/10'
              : 'text-neutral-400 opacity-0 group-hover:opacity-100 hover:bg-neutral-100 dark:hover:bg-neutral-700 hover:text-neutral-600 dark:hover:text-neutral-200',
          ]"
          :title="isCharFav(id) ? 'Remove favorite' : 'Add favorite'"
          @click.stop="toggleCharFav(id)"
        >
          <span :class="isCharFav(id) ? 'i-solar:star-bold text-sm' : 'i-solar:star-linear text-sm'" />
        </button>
      </div>
      <div v-if="sortedCharacters.length === 0" class="flex flex-col items-center justify-center py-6 text-center text-neutral-400 dark:text-neutral-500">
        <span class="i-solar:user-bold-duotone text-2xl" />
        <span class="mt-1 text-[10px]">{{ selectiveSyncEnabled && cardSyncFilter === 'synced' ? 'No synced characters found' : 'No characters found' }}</span>
      </div>
    </div>

    <!-- GRID VIEW (3 col) -->
    <div v-else class="max-h-48 overflow-y-auto py-1 scrollbar-thin">
      <div class="grid grid-cols-3 gap-1.5">
        <div
          v-for="[id, card] in sortedCharacters"
          :key="id"
          :title="card.nickname ? `${card.nickname} (${card.name})` : card.name"
          :class="[
            'group relative aspect-square border rounded-xl overflow-hidden cursor-pointer bg-neutral-100 dark:bg-neutral-800 transition-all duration-200 shadow-xs',
            id === activeCardId
              ? 'border-amber-400 ring-2 ring-amber-400/50'
              : 'border-neutral-200 dark:border-neutral-700 hover:border-amber-400/60 hover:ring-2 hover:ring-amber-500/30',
          ]"
          @click="cardStore.activateCard(id); emit('close')"
        >
          <CharacterAvatar
            :card-id="id"
            :name="card.name"
            :display-model-id="cardStore.getCardDisplayModelId(id)"
            shape="rounded"
            size-class="size-full"
          />
          <div class="absolute bottom-0 left-0 right-0 truncate bg-black/60 px-1 py-0.5 text-center text-[8px] text-white opacity-0 transition-opacity group-hover:opacity-100">
            {{ card.nickname || card.name }}
          </div>
          <!-- Hover Favorite Star -->
          <button
            type="button"
            :class="[
              'absolute top-1 right-1 size-5 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/60 transition-opacity cursor-pointer',
              isCharFav(id) ? 'text-amber-400 opacity-100' : 'text-white opacity-0 group-hover:opacity-100',
            ]"
            @click.stop="toggleCharFav(id)"
          >
            <span :class="isCharFav(id) ? 'i-solar:star-bold text-xs' : 'i-solar:star-linear text-xs'" />
          </button>
        </div>
      </div>
      <div v-if="sortedCharacters.length === 0" class="flex flex-col items-center justify-center py-6 text-center text-neutral-400 dark:text-neutral-500">
        <span class="i-solar:user-bold-duotone text-2xl" />
        <span class="mt-1 text-[10px]">{{ selectiveSyncEnabled && cardSyncFilter === 'synced' ? 'No synced characters found' : 'No characters found' }}</span>
      </div>
    </div>

    <!-- FOOTER -->
    <div class="grid grid-cols-3 gap-1.5 border-t border-neutral-200/80 pt-2 dark:border-neutral-800">
      <button
        class="flex cursor-pointer items-center justify-center gap-1 border border-sky-500/20 rounded-xl bg-sky-500/10 py-1.5 text-[10px] text-sky-700 font-semibold transition-colors hover:bg-sky-500/20 dark:text-sky-300"
        @click="handleViewGallery"
      >
        <span class="i-solar:gallery-linear text-xs" />
        Gallery
      </button>
      <button
        class="flex cursor-pointer items-center justify-center gap-1 border border-amber-500/20 rounded-xl bg-amber-500/10 py-1.5 text-[10px] text-amber-700 font-semibold transition-colors hover:bg-amber-500/20 dark:text-amber-300"
        @click="handleEditActiveCard"
      >
        <span class="i-solar:pen-linear text-xs" />
        Edit
      </button>
      <button
        class="flex cursor-pointer items-center justify-center gap-1 border border-purple-500/20 rounded-xl bg-purple-500/10 py-1.5 text-[10px] text-purple-700 font-semibold transition-colors hover:bg-purple-500/20 dark:text-purple-300"
        @click="handleManageProfiles"
      >
        <span class="i-solar:settings-outline text-xs" />
        Cards
      </button>
    </div>
  </StripPopover>
</template>
