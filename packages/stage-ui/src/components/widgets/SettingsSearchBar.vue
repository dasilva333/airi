<script setup lang="ts">
import type { SearchItem } from '@proj-airi/stage-ui/constants'

import { convertCatalogItemToSearchItem, convertProviderMetadataToSearchItem, getAllCatalogItems } from '@proj-airi/stage-ui/constants'
import { useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { onClickOutside, useMediaQuery } from '@vueuse/core'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const cardStore = useAiriCardStore()
const providersStore = useProvidersStore()

const mobileSearchOpen = defineModel<boolean>('mobileSearchOpen', { default: false })
const isDesktop = useMediaQuery('(min-width: 640px)')

const searchQuery = ref('')
const isOpen = ref(false)
const isExpandedSubPage = ref(false)
const highlightedIndex = ref(0)
const inputRef = ref<HTMLInputElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)
const dropdownRef = ref<HTMLDivElement | null>(null)

const isRoot = computed(() => {
  return route.path === '/settings' || route.path === '/settings/' || Boolean(route.meta?.rootOfSettings)
})

const showInput = computed(() => {
  if (isDesktop.value) {
    return isRoot.value || isExpandedSubPage.value
  }
  return mobileSearchOpen.value
})

onClickOutside(containerRef, (event) => {
  if (dropdownRef.value && dropdownRef.value.contains(event.target as Node)) {
    return
  }
  handleClose()
})

watch(() => route.path, () => {
  if (!isRoot.value) {
    isExpandedSubPage.value = false
  }
  isOpen.value = false
  mobileSearchOpen.value = false
  searchQuery.value = ''
})

// ── Dynamic Character Card Index ──
const dynamicCharacterIndex = computed<SearchItem[]>(() => {
  try {
    const cardEntries = Array.from(cardStore.cards?.entries?.() || [])
    return cardEntries.map(([id, card]) => {
      const cardName = card.name || 'Unnamed Character'
      return {
        id: `card-${id}`,
        title: cardName,
        category: 'Character Card',
        description: `Open ${cardName}'s card editor`,
        to: `/settings/airi-card?cardId=${id}`,
        icon: 'i-solar:user-bold-duotone',
        keywords: ['character', 'card', cardName.toLowerCase()],
      }
    })
  }
  catch {
    return []
  }
})

// ── Dynamic Live Provider Registry Index ──
const dynamicProviderIndex = computed<SearchItem[]>(() => {
  try {
    const metadata = providersStore.allProvidersMetadata
    if (!metadata)
      return []
    return Object.values(metadata).map(convertProviderMetadataToSearchItem)
  }
  catch {
    return []
  }
})

// ── Dynamic Settings Catalog Index (Curated + Provider Fallbacks) ──
const dynamicCatalogIndex = computed<SearchItem[]>(() => {
  return getAllCatalogItems(providersStore.allProvidersMetadata)
    .map(convertCatalogItemToSearchItem)
    .filter((item): item is SearchItem => item !== null)
})

const fullSearchIndex = computed<SearchItem[]>(() => {
  const seenRoutes = new Set<string>()
  const result: SearchItem[] = []

  // 1. Character Cards
  for (const item of dynamicCharacterIndex.value) {
    if (!seenRoutes.has(item.to)) {
      seenRoutes.add(item.to)
      result.push(item)
    }
  }

  // 2. Live Providers (takes priority for provider routes)
  for (const item of dynamicProviderIndex.value) {
    if (!seenRoutes.has(item.to)) {
      seenRoutes.add(item.to)
      result.push(item)
    }
  }

  // 3. Settings Catalog Pages & DevTools
  for (const item of dynamicCatalogIndex.value) {
    if (!seenRoutes.has(item.to)) {
      seenRoutes.add(item.to)
      result.push(item)
    }
  }

  return result
})

const searchResults = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query)
    return fullSearchIndex.value.slice(0, 8)

  return fullSearchIndex.value.filter((item) => {
    const kwMatch = item.keywords?.some(k => k.toLowerCase().includes(query))
    return (
      item.title.toLowerCase().includes(query)
      || item.category.toLowerCase().includes(query)
      || (item.description && item.description.toLowerCase().includes(query))
      || kwMatch
    )
  }).slice(0, 12)
})

function handleExpand() {
  if (!isDesktop.value) {
    mobileSearchOpen.value = true
  }
  else {
    isExpandedSubPage.value = true
  }
  isOpen.value = true
  nextTick(() => {
    inputRef.value?.focus()
  })
}

function handleClose() {
  isOpen.value = false
  mobileSearchOpen.value = false
  searchQuery.value = ''
  if (!isRoot.value) {
    isExpandedSubPage.value = false
  }
}

function handleSelect(item: SearchItem) {
  isOpen.value = false
  mobileSearchOpen.value = false
  if (!isRoot.value) {
    isExpandedSubPage.value = false
  }
  searchQuery.value = ''
  router.push(item.to)
}

function handleKeyDown(e: KeyboardEvent) {
  if (!isOpen.value && !showInput.value)
    return

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (searchResults.value.length > 0) {
      highlightedIndex.value = (highlightedIndex.value + 1) % searchResults.value.length
    }
  }
  else if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (searchResults.value.length > 0) {
      highlightedIndex.value = (highlightedIndex.value - 1 + searchResults.value.length) % searchResults.value.length
    }
  }
  else if (e.key === 'Enter') {
    e.preventDefault()
    const selected = searchResults.value[highlightedIndex.value]
    if (selected) {
      handleSelect(selected)
    }
  }
  else if (e.key === 'Escape') {
    handleClose()
  }
}

function handleGlobalShortcut(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    handleExpand()
  }
}

function handleInput() {
  highlightedIndex.value = 0
}

onMounted(() => {
  window.addEventListener('keydown', handleGlobalShortcut)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalShortcut)
})
</script>

<template>
  <div
    ref="containerRef"
    :class="[
      showInput
        ? 'relative w-full min-w-0 sm:min-w-[240px] max-w-none sm:max-w-md lg:max-w-lg flex items-center'
        : 'shrink-0',
    ]"
  >
    <!-- Compact Icon Button (Sub-pages default state, or mobile idle state) -->
    <button
      v-if="!showInput"
      type="button"
      class="shadow-2xs h-9 w-9 flex items-center justify-center border border-neutral-200/80 rounded-xl bg-white/70 text-neutral-600 backdrop-blur-md transition-all active:scale-95 dark:border-neutral-800/80 hover:border-primary-500/50 dark:bg-neutral-900/70 dark:text-neutral-300 hover:text-primary-500 dark:hover:text-primary-400"
      title="Search settings (⌘K)"
      @click="handleExpand"
    >
      <div class="i-solar:magnifer-bold-duotone text-base" />
    </button>

    <!-- Expanded Search Input Bar -->
    <div
      v-else
      :class="[
        'group relative flex flex-1 items-center rounded-xl px-3 py-1.5 transition-all duration-200',
        'border border-neutral-200/80 bg-white/70 shadow-2xs backdrop-blur-md',
        'dark:border-neutral-800/80 dark:bg-neutral-900/70',
        'hover:border-primary-500/50',
        'focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500/20',
      ]"
      @click="isOpen = true; inputRef?.focus()"
    >
      <div class="i-solar:magnifer-bold-duotone mr-2 shrink-0 text-base text-neutral-400 dark:text-neutral-500 group-focus-within:text-primary-500" />
      <input
        ref="inputRef"
        v-model="searchQuery"
        type="text"
        placeholder="Search settings, characters, providers..."
        :class="[
          'w-full bg-transparent text-xs outline-none',
          'text-neutral-800 placeholder-neutral-400',
          'dark:text-neutral-100 dark:placeholder-neutral-500',
        ]"
        @focus="isOpen = true"
        @keydown="handleKeyDown"
        @input="handleInput"
      >
      <!-- Clear button when text is entered -->
      <button
        v-if="searchQuery"
        type="button"
        class="ml-1 size-5 flex shrink-0 items-center justify-center rounded-full text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
        title="Clear search"
        @click.stop="searchQuery = ''; inputRef?.focus()"
      >
        <div class="i-solar:close-circle-bold size-3.5" />
      </button>
      <div class="ml-2 shrink-0 items-center gap-1 hidden sm:flex">
        <span
          :class="[
            'rounded-md border px-1.5 py-0.5 text-[10px] font-semibold',
            'border-neutral-200/80 bg-neutral-100/80 text-neutral-400',
            'dark:border-neutral-800 dark:bg-neutral-800/80 dark:text-neutral-500',
          ]"
        >
          ⌘K
        </span>
      </div>
    </div>

    <!-- Mobile Cancel Button -->
    <button
      v-if="showInput && !isDesktop"
      type="button"
      class="ml-2 h-9 flex shrink-0 cursor-pointer items-center px-1 text-xs text-primary-500 font-semibold transition active:opacity-70 sm:hidden"
      @click="handleClose"
    >
      Cancel
    </button>

    <!-- Mobile Dimmed Backdrop Scrim & Mobile Viewport Dropdown -->
    <Teleport to="body">
      <div
        v-if="showInput && !isDesktop && isOpen"
        class="backdrop-blur-xs animate-in fade-in fixed inset-0 top-14 z-[99990] bg-black/30 duration-150"
        @click="handleClose"
      />

      <div
        v-if="showInput && !isDesktop && isOpen && searchResults.length > 0"
        ref="dropdownRef"
        class="animate-in fade-in zoom-in-95 fixed inset-x-3 top-16 z-[100000] max-h-[60dvh] overflow-y-auto border border-neutral-200/90 rounded-2xl bg-white/95 p-1.5 shadow-2xl backdrop-blur-2xl duration-150 dark:border-neutral-800/90 dark:bg-neutral-900/95"
      >
        <div class="px-2.5 py-1 text-[10px] text-neutral-400 font-bold tracking-wider uppercase dark:text-neutral-500">
          {{ searchQuery.trim() ? 'Search Results' : 'Suggested Shortcuts' }}
        </div>
        <div class="flex flex-col gap-0.5">
          <button
            v-for="(item, idx) in searchResults"
            :key="item.id"
            type="button"
            :class="[
              'flex items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition-colors',
              highlightedIndex === idx
                ? 'bg-primary-500/10 font-semibold text-primary-600 dark:bg-primary-500/20 dark:text-primary-300'
                : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800/60',
            ]"
            @mouseenter="highlightedIndex = idx"
            @click.stop="handleSelect(item)"
          >
            <div class="min-w-0 flex flex-1 items-center gap-2.5">
              <div :class="item.icon || 'i-solar:alt-arrow-right-bold-duotone'" class="shrink-0 text-base text-primary-500" />
              <div class="min-w-0 flex flex-1 flex-col">
                <span class="truncate">{{ item.title }}</span>
                <span v-if="item.description" class="truncate text-[10px] text-neutral-400 font-normal dark:text-neutral-500">
                  {{ item.description }}
                </span>
              </div>
            </div>
            <span
              class="ml-2 shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-[9px] text-neutral-400 font-medium dark:bg-neutral-800 dark:text-neutral-500"
            >
              {{ item.category }}
            </span>
          </button>
        </div>
      </div>
    </Teleport>

    <!-- Desktop Autocomplete Dropdown Overlay -->
    <div
      v-if="showInput && isDesktop && isOpen && searchResults.length > 0"
      class="animate-in fade-in zoom-in-95 absolute left-1/2 top-full z-[99999] mt-2 max-h-96 w-[480px] overflow-y-auto border border-neutral-200/90 rounded-2xl bg-white/95 p-1.5 shadow-2xl backdrop-blur-2xl duration-150 -translate-x-1/2 dark:border-neutral-800/90 dark:bg-neutral-900/95"
    >
      <div class="px-2.5 py-1 text-[10px] text-neutral-400 font-bold tracking-wider uppercase dark:text-neutral-500">
        {{ searchQuery.trim() ? 'Search Results' : 'Suggested Shortcuts' }}
      </div>
      <div class="flex flex-col gap-0.5">
        <button
          v-for="(item, idx) in searchResults"
          :key="item.id"
          type="button"
          :class="[
            'flex items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition-colors',
            highlightedIndex === idx
              ? 'bg-primary-500/10 font-semibold text-primary-600 dark:bg-primary-500/20 dark:text-primary-300'
              : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800/60',
          ]"
          @mouseenter="highlightedIndex = idx"
          @click.stop="handleSelect(item)"
        >
          <div class="min-w-0 flex flex-1 items-center gap-2.5">
            <div :class="item.icon || 'i-solar:alt-arrow-right-bold-duotone'" class="shrink-0 text-base text-primary-500" />
            <div class="min-w-0 flex flex-1 flex-col">
              <span class="truncate">{{ item.title }}</span>
              <span v-if="item.description" class="truncate text-[10px] text-neutral-400 font-normal dark:text-neutral-500">
                {{ item.description }}
              </span>
            </div>
          </div>
          <span
            class="ml-2 shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-[9px] text-neutral-400 font-medium dark:bg-neutral-800 dark:text-neutral-500"
          >
            {{ item.category }}
          </span>
        </button>
      </div>
    </div>
  </div>
</template>
