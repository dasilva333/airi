<script setup lang="ts">
import { CharacterAvatar } from '@proj-airi/stage-ui/components'
import { useAiriCardStore, useBackgroundStore } from '@proj-airi/stage-ui/stores'
import { Button, Callout } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

type FilterTab = 'all' | 'scenes' | 'builtin' | 'journal'

const { t } = useI18n()
const router = useRouter()
const backgroundStore = useBackgroundStore()
const cardStore = useAiriCardStore()
const { activeBackgroundId, activeBackgroundUrl } = storeToRefs(backgroundStore)

const fileInputRef = ref<HTMLInputElement>()
const activeTab = ref<FilterTab>('all')
const searchQuery = ref('')

const allBackgrounds = computed(() => backgroundStore.availableBackgrounds)

const activeCardId = computed(() => cardStore.activeCardId)
const activeCharacterName = computed(() => cardStore.activeCard?.name || 'Active Character')
const activeBgEntry = computed(() => allBackgrounds.value.find(e => e.id === activeBackgroundId.value))

const sceneCount = computed(() => allBackgrounds.value.filter(e => e.type === 'scene').length)
const builtinCount = computed(() => allBackgrounds.value.filter(e => e.type === 'builtin').length)
const journalCount = computed(() => allBackgrounds.value.filter(e => e.type === 'journal' || e.type === 'selfie').length)

const filterTabs = computed(() => [
  { id: 'all' as const, label: 'All', icon: 'i-solar:gallery-bold-duotone', count: allBackgrounds.value.length },
  { id: 'scenes' as const, label: 'Custom Scenes', icon: 'i-solar:camera-bold-duotone', count: sceneCount.value },
  { id: 'builtin' as const, label: 'Built-in', icon: 'i-solar:stars-bold-duotone', count: builtinCount.value },
  ...(journalCount.value > 0
    ? [{ id: 'journal' as const, label: 'Journal & Selfies', icon: 'i-solar:palette-bold-duotone', count: journalCount.value }]
    : []),
])

const filteredEntries = computed(() => {
  let list = allBackgrounds.value

  if (activeTab.value === 'scenes') {
    list = list.filter(e => e.type === 'scene')
  }
  else if (activeTab.value === 'builtin') {
    list = list.filter(e => e.type === 'builtin')
  }
  else if (activeTab.value === 'journal') {
    list = list.filter(e => e.type === 'journal' || e.type === 'selfie')
  }

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase()
    list = list.filter(e => (e.title || '').toLowerCase().includes(q))
  }

  return list
})

function triggerUpload() {
  fileInputRef.value?.click()
}

async function handleFileChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file)
    return

  await backgroundStore.addBackground('scene', file, file.name)
  if (fileInputRef.value)
    fileInputRef.value.value = ''
}

function setAsBackground(id: string) {
  backgroundStore.setActiveBackground(id)
}

function removeBackground(id: string) {
  if (confirm(t('settings.pages.scene.gallery.delete_confirm', 'Are you sure you want to delete this background?'))) {
    if (activeBackgroundId.value === id) {
      backgroundStore.setActiveBackground('none')
    }
    backgroundStore.removeBackground(id)
  }
}

function clearDefault() {
  backgroundStore.setActiveBackground('none')
}
</script>

<template>
  <div class="relative min-h-full w-full overflow-hidden">
    <!-- Dynamic Scene Background Preview Layer -->
    <div
      v-if="activeBackgroundUrl"
      class="pointer-events-none fixed inset-0 z-0 transition-opacity duration-700"
      :style="{
        backgroundImage: `url(${activeBackgroundUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }"
    >
      <!-- Subtle frosted glass overlay for readability -->
      <div class="absolute inset-0 bg-white/75 backdrop-blur-md transition-colors duration-500 dark:bg-[#0a0d14]/80" />
    </div>

    <div :class="['relative z-1 w-full max-w-7xl mx-auto flex flex-col gap-6 p-4 sm:p-6 lg:p-8 pb-28']">
      <!-- Active Stage Background Spotlight / Hero Card -->
      <div
        :class="[
          'relative overflow-hidden rounded-3xl border border-neutral-200/80 dark:border-neutral-800',
          'bg-white/70 dark:bg-neutral-900/60 p-5 sm:p-6 backdrop-blur-xl shadow-sm',
          'flex flex-col md:flex-row items-start md:items-center justify-between gap-6',
        ]"
      >
        <!-- Left: Character & Active Stage Background details -->
        <div :class="['flex items-start sm:items-center gap-4 min-w-0 flex-1']">
          <CharacterAvatar
            v-if="activeCardId"
            :card-id="activeCardId"
            :name="activeCharacterName"
            size-class="size-14 sm:size-16 shrink-0"
            shape="rounded"
            :is-active="true"
          />
          <div v-else :class="['size-14 sm:size-16 rounded-2xl bg-neutral-200 dark:bg-neutral-800 shrink-0 flex items-center justify-center text-2xl text-neutral-400']">
            <div :class="['i-solar:user-bold-duotone']" />
          </div>

          <!-- Active Scene Preview Thumbnail -->
          <div
            v-if="activeBgEntry"
            :class="[
              'size-14 sm:size-16 rounded-2xl overflow-hidden shrink-0 border-2 border-primary-500/60 shadow-sm relative bg-neutral-100 dark:bg-neutral-800',
            ]"
          >
            <img
              :src="backgroundStore.getBackgroundUrl(activeBgEntry.id) || undefined"
              class="h-full w-full object-cover"
              alt="Active Scene"
            >
          </div>

          <div :class="['flex flex-col gap-1 min-w-0 flex-1']">
            <div :class="['flex items-center gap-2 flex-wrap']">
              <span :class="['text-xs font-semibold px-2 py-0.5 rounded-full bg-primary-100 text-primary-700 dark:bg-primary-950/60 dark:text-primary-300 border border-primary-200 dark:border-primary-800/50']">
                {{ activeCharacterName }}
              </span>
              <span v-if="activeBgEntry" :class="['text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50 flex items-center gap-1.5']">
                <span :class="['size-1.5 rounded-full bg-emerald-500 animate-pulse']" />
                {{ t('settings.pages.scene.gallery.active_badge', 'Current Scene') }}
              </span>
            </div>

            <h2 :class="['text-lg sm:text-xl font-bold text-neutral-900 dark:text-neutral-100 truncate']">
              {{ activeBgEntry ? activeBgEntry.title : t('settings.pages.scene.background_image.no_background', 'Default Canvas (No Stage Background)') }}
            </h2>

            <p :class="['text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 line-clamp-1']">
              {{ activeBgEntry ? t('settings.pages.scene.beta_description') : t('settings.pages.scene.description') }}
            </p>
          </div>
        </div>

        <!-- Right: Quick Actions -->
        <div :class="['flex items-center gap-3 w-full md:w-auto shrink-0']">
          <input
            ref="fileInputRef"
            type="file"
            accept="image/*"
            hidden
            @change="handleFileChange"
          >
          <Button
            variant="secondary"
            :class="['h-10 px-3.5 rounded-xl font-medium border-purple-200 dark:border-purple-800/60 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/30 flex items-center justify-center gap-2 transition-all']"
            title="Generate custom AI backgrounds with Pollinations in the Artistry Playground"
            @click="router.push('/settings/modules/artistry')"
          >
            <div :class="['i-solar:magic-stick-3-bold-duotone text-lg text-purple-500']" />
            <span class="hidden sm:inline">AI Generator</span>
          </Button>

          <Button
            variant="primary"
            :class="['flex-1 md:flex-initial h-10 px-4 rounded-xl shadow-sm font-medium flex items-center justify-center gap-2']"
            @click="triggerUpload"
          >
            <div :class="['i-solar:upload-bold-duotone text-lg']" />
            <span>{{ t('settings.pages.scene.background_image.upload') }}</span>
          </Button>

          <Button
            v-if="activeBackgroundId !== 'none'"
            variant="secondary"
            :class="['h-10 px-4 rounded-xl font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 border-red-200 dark:border-red-900/50 flex items-center justify-center gap-2']"
            @click="clearDefault"
          >
            <div :class="['i-solar:trash-bin-trash-bold-duotone text-lg']" />
            <span>{{ t('settings.pages.scene.background_image.clear') }}</span>
          </Button>
        </div>
      </div>

      <!-- Callout note -->
      <Callout
        :label="t('settings.pages.scene.beta_label')"
        theme="orange"
        icon="i-solar:star-fall-bold-duotone"
      >
        <div>
          {{ t('settings.pages.scene.beta_description') }}
        </div>
      </Callout>

      <!-- Toolbar: Filter Pills and Search Bar -->
      <div :class="['flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2']">
        <!-- Filter Tabs -->
        <div :class="['flex items-center gap-1.5 p-1 rounded-xl bg-neutral-100 dark:bg-neutral-900/80 border border-neutral-200/80 dark:border-neutral-800/80 text-xs font-medium overflow-x-auto max-w-full']">
          <button
            v-for="tab in filterTabs"
            :key="tab.id"
            type="button"
            :class="[
              'px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap',
              activeTab === tab.id
                ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-xs font-semibold'
                : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200',
            ]"
            @click="activeTab = tab.id"
          >
            <div :class="[tab.icon, 'text-sm']" />
            <span>{{ tab.label }}</span>
            <span :class="['text-[10px] px-1.5 py-0.2 rounded-full', activeTab === tab.id ? 'bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300' : 'bg-neutral-200/60 dark:bg-neutral-800 text-neutral-400']">
              {{ tab.count }}
            </span>
          </button>
        </div>

        <!-- Search Input -->
        <div :class="['relative w-full sm:w-64 md:w-72']">
          <div :class="['pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-400 text-sm']">
            <div :class="['i-solar:magnifer-line-duotone']" />
          </div>
          <input
            v-model="searchQuery"
            type="search"
            placeholder="Search backgrounds..."
            :class="[
              'w-full h-9 pl-9 pr-8 text-xs rounded-xl bg-white dark:bg-neutral-900',
              'border border-neutral-200 dark:border-neutral-800 focus:border-primary-500 dark:focus:border-primary-500',
              'outline-none transition-all placeholder:text-neutral-400',
            ]"
          >
          <button
            v-if="searchQuery"
            type="button"
            :class="['absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer']"
            @click="searchQuery = ''"
          >
            <div :class="['i-solar:close-circle-bold text-sm']" />
          </button>
        </div>
      </div>

      <!-- Gallery Grid (Responsive widescreen) -->
      <div
        v-if="filteredEntries.length > 0 || !searchQuery"
        :class="['grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-5 sm:gap-6']"
      >
        <!-- Default Stage (None) Option Card -->
        <div
          v-if="!searchQuery && (activeTab === 'all' || activeTab === 'builtin')"
          :class="[
            'relative aspect-[16/9] overflow-hidden rounded-2xl border-2 group transition-all duration-200 cursor-pointer shadow-sm',
            activeBackgroundId === 'none'
              ? 'border-primary-500 ring-4 ring-primary-500/30 shadow-xl shadow-primary-500/10 scale-[1.01]'
              : 'border-neutral-200/80 dark:border-neutral-800/80 bg-neutral-100/80 dark:bg-neutral-900/60 hover:border-primary-400/80 hover:shadow-lg',
          ]"
          @click="setAsBackground('none')"
        >
          <!-- Checkerboard / Solid canvas representation -->
          <div class="absolute inset-0 z-0 flex flex-col items-center justify-center from-neutral-100 to-neutral-200/60 bg-gradient-to-br p-4 text-center dark:from-neutral-900 dark:to-neutral-800/60">
            <div class="shadow-xs size-12 flex items-center justify-center rounded-2xl bg-white/80 text-2xl text-neutral-400 transition-transform group-hover:scale-110 dark:bg-neutral-800/80">
              <div class="i-solar:gallery-remove-bold-duotone" />
            </div>
            <span class="mt-2 text-xs text-neutral-600 font-semibold dark:text-neutral-400">Default Stage</span>
          </div>

          <!-- Top Badges -->
          <div class="pointer-events-none absolute inset-x-3 top-3 z-1 flex items-center justify-between gap-2">
            <div
              v-if="activeBackgroundId === 'none'"
              class="flex items-center gap-1.5 border border-white/20 rounded-lg bg-primary-600 px-2.5 py-1 text-xs text-white font-bold shadow-md"
            >
              <div class="i-solar:check-circle-bold text-sm" />
              <span>Active Scene</span>
            </div>
            <div v-else />

            <div class="shadow-xs border border-neutral-700/50 rounded-lg bg-neutral-900/75 px-2.5 py-1 text-xs text-neutral-100 font-semibold backdrop-blur-md">
              System
            </div>
          </div>

          <!-- Bottom Title Bar -->
          <div class="absolute inset-x-0 bottom-0 z-1 flex items-center justify-between from-black/90 via-black/60 to-transparent bg-gradient-to-t px-3.5 pb-3 pt-8 text-sm text-white font-semibold">
            <span class="truncate tracking-wide drop-shadow-sm">None (Default Canvas)</span>
          </div>

          <!-- Hover Overlay -->
          <div class="absolute inset-0 z-2 flex items-center justify-center gap-2.5 bg-black/40 p-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <button
              v-if="activeBackgroundId !== 'none'"
              type="button"
              class="h-9 flex cursor-pointer items-center gap-1.5 border border-white/25 rounded-xl bg-primary-600 px-4 text-xs text-white font-bold shadow-lg transition-all active:scale-95 hover:bg-primary-500"
              @click.stop="setAsBackground('none')"
            >
              <div class="i-solar:check-read-bold-duotone text-base" />
              <span>Reset to None</span>
            </button>
            <div
              v-else
              class="flex items-center gap-1.5 border border-white/25 rounded-xl bg-emerald-600/95 px-4 py-2 text-xs text-white font-bold shadow-lg"
            >
              <div class="i-solar:check-circle-bold text-base text-emerald-200" />
              <span>Currently Active</span>
            </div>
          </div>
        </div>

        <div
          v-for="bg in filteredEntries"
          :key="bg.id"
          :class="[
            'relative aspect-[16/9] overflow-hidden rounded-2xl border-2 group transition-all duration-200 cursor-pointer shadow-sm',
            bg.id === activeBackgroundId
              ? 'border-primary-500 ring-4 ring-primary-500/30 shadow-xl shadow-primary-500/10 scale-[1.01]'
              : 'border-neutral-200/80 dark:border-neutral-800/80 bg-neutral-100 dark:bg-neutral-900/60 hover:border-primary-400/80 hover:shadow-lg',
          ]"
          @click="setAsBackground(bg.id)"
        >
          <!-- Background Preview Image -->
          <div
            :class="['absolute inset-0 z-0 transition-transform duration-300 group-hover:scale-105']"
            :style="{
              backgroundImage: `url(${backgroundStore.getBackgroundUrl(bg.id)})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }"
          />

          <!-- Top Badges -->
          <div :class="['absolute top-3 inset-x-3 flex items-center justify-between z-1 pointer-events-none gap-2']">
            <div
              v-if="bg.id === activeBackgroundId"
              :class="[
                'bg-primary-600 text-white text-xs font-bold px-2.5 py-1 rounded-lg shadow-md',
                'flex items-center gap-1.5 border border-white/20',
              ]"
            >
              <div :class="['i-solar:check-circle-bold text-sm']" />
              <span>{{ t('settings.pages.scene.gallery.active_badge', 'Active Scene') }}</span>
            </div>
            <div v-else />

            <div
              :class="[
                'text-xs font-semibold px-2.5 py-1 rounded-lg shadow-xs backdrop-blur-md',
                bg.type === 'builtin'
                  ? 'bg-neutral-900/75 text-neutral-100 border border-neutral-700/50'
                  : 'bg-primary-950/75 text-primary-200 border border-primary-700/50',
              ]"
            >
              {{ bg.type === 'builtin' ? 'Built-in' : (bg.type === 'journal' ? 'Journal' : 'Custom') }}
            </div>
          </div>

          <!-- Bottom Title Bar (Glassmorphic) -->
          <div
            :class="[
              'absolute bottom-0 inset-x-0 z-1',
              'bg-gradient-to-t from-black/90 via-black/60 to-transparent pt-8 pb-3 px-3.5',
              'flex items-center justify-between text-white text-sm font-semibold',
            ]"
          >
            <span :class="['truncate tracking-wide drop-shadow-sm']" :title="bg.title">
              {{ bg.title }}
            </span>
          </div>

          <!-- Hover Overlay with Action Buttons -->
          <div
            :class="[
              'absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200',
              'flex items-center justify-center gap-2.5 z-2 p-3',
            ]"
          >
            <button
              v-if="bg.id !== activeBackgroundId"
              type="button"
              :class="[
                'cursor-pointer h-9 px-4 rounded-xl font-bold text-xs text-white',
                'bg-primary-600 hover:bg-primary-500 active:scale-95 transition-all shadow-lg',
                'flex items-center gap-1.5 border border-white/25',
              ]"
              @click.stop="setAsBackground(bg.id)"
            >
              <div :class="['i-solar:check-read-bold-duotone text-base']" />
              <span>Apply Scene</span>
            </button>
            <div
              v-else
              :class="[
                'bg-emerald-600/95 text-white text-xs font-bold px-4 py-2 rounded-xl',
                'flex items-center gap-1.5 shadow-lg border border-white/25',
              ]"
            >
              <div :class="['i-solar:check-circle-bold text-base text-emerald-200']" />
              <span>Currently Active</span>
            </div>

            <button
              v-if="bg.type !== 'builtin'"
              type="button"
              :class="[
                'cursor-pointer h-9 px-3 rounded-xl text-xs text-white font-semibold',
                'bg-red-600 hover:bg-red-500 active:scale-95 transition-all shadow-lg',
                'flex items-center justify-center border border-white/25',
              ]"
              :title="t('settings.pages.scene.gallery.delete', 'Delete from Gallery')"
              @click.stop="removeBackground(bg.id)"
            >
              <div :class="['i-solar:trash-bin-trash-bold-duotone text-base']" />
            </button>
          </div>
        </div>

        <!-- Artistry Creative Generator Discovery Card -->
        <div
          v-if="!searchQuery"
          :class="[
            'relative aspect-[16/9] overflow-hidden rounded-2xl border-2 border-dashed group transition-all duration-200 cursor-pointer shadow-sm',
            'border-purple-300/80 dark:border-purple-800/80 bg-gradient-to-br from-purple-50/70 via-pink-50/40 to-amber-50/60 dark:from-purple-950/30 dark:via-pink-950/20 dark:to-amber-950/20 hover:border-purple-500 hover:shadow-lg hover:scale-[1.01]',
          ]"
          @click="router.push('/settings/modules/artistry')"
        >
          <div class="absolute inset-0 z-0 flex flex-col items-center justify-center p-4 text-center">
            <div class="shadow-xs size-12 flex items-center justify-center rounded-2xl bg-purple-500/15 text-2xl text-purple-600 transition-transform group-hover:scale-110 dark:bg-purple-500/25 dark:text-purple-400">
              <div class="i-solar:magic-stick-3-bold-duotone" />
            </div>
            <span class="mt-2 text-xs text-neutral-800 font-bold dark:text-neutral-200">
              Generate AI Scenes
            </span>
            <span class="mt-0.5 max-w-44 text-[10px] text-neutral-500 dark:text-neutral-400">
              Free instant generation with Pollinations & ComfyUI
            </span>
          </div>

          <!-- Top Badge -->
          <div class="pointer-events-none absolute inset-x-3 top-3 z-1 flex items-center justify-end">
            <div class="border border-purple-500/20 rounded-lg bg-purple-500/15 px-2 py-0.5 text-[10px] text-purple-700 font-bold dark:text-purple-300">
              FREE AI
            </div>
          </div>

          <!-- Bottom Bar -->
          <div class="absolute inset-x-0 bottom-0 z-1 flex items-center justify-between from-black/80 via-black/50 to-transparent bg-gradient-to-t px-3.5 pb-2.5 pt-6 text-xs text-white font-medium">
            <span>Open Artistry Studio</span>
            <div class="i-solar:arrow-right-line-duotone text-sm transition-transform group-hover:translate-x-1" />
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div
        v-else
        :class="[
          'border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-3xl',
          'p-12 sm:p-16 text-center text-neutral-400 bg-neutral-50/50 dark:bg-neutral-900/30',
          'flex flex-col items-center justify-center gap-3',
        ]"
      >
        <div :class="['size-16 rounded-2xl bg-neutral-100 dark:bg-neutral-800/60 flex items-center justify-center text-3xl text-neutral-400 dark:text-neutral-500']">
          <div :class="['i-solar:gallery-wide-bold-duotone']" />
        </div>
        <div :class="['flex flex-col gap-1']">
          <p :class="['text-sm font-semibold text-neutral-700 dark:text-neutral-300']">
            {{ searchQuery ? 'No matching backgrounds found' : t('settings.pages.scene.gallery.empty') }}
          </p>
          <p :class="['text-xs text-neutral-500']">
            {{ searchQuery ? 'Try adjusting your search or category filter' : 'Upload an image to personalize your stage environment' }}
          </p>
        </div>
        <Button
          v-if="!searchQuery"
          variant="primary"
          size="sm"
          :class="['mt-2 rounded-xl px-4']"
          @click="triggerUpload"
        >
          <div :class="['i-solar:upload-bold-duotone mr-1.5']" />
          {{ t('settings.pages.scene.background_image.upload') }}
        </Button>
        <Button
          v-else
          variant="secondary"
          size="sm"
          :class="['mt-2 rounded-xl px-4']"
          @click="searchQuery = ''; activeTab = 'all'"
        >
          Reset Filters
        </Button>
      </div>

      <!-- Artistry Creative Studio Teaser Banner -->
      <div
        :class="[
          'relative overflow-hidden rounded-3xl border border-purple-200/80 dark:border-purple-900/60',
          'bg-gradient-to-br from-purple-50/90 via-pink-50/40 to-amber-50/70 dark:from-purple-950/40 dark:via-pink-950/20 dark:to-neutral-900/60',
          'p-5 sm:p-6 backdrop-blur-xl shadow-xs',
          'flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5',
        ]"
      >
        <div class="min-w-0 flex flex-1 items-start gap-4 sm:items-center">
          <div class="shadow-xs size-12 flex shrink-0 items-center justify-center rounded-2xl bg-purple-500/15 text-2xl text-purple-600 sm:size-14 dark:bg-purple-500/25 sm:text-3xl dark:text-purple-400">
            <div class="i-solar:palette-round-bold-duotone" />
          </div>

          <div class="min-w-0 flex flex-1 flex-col gap-1">
            <div class="flex flex-wrap items-center gap-2">
              <h3 class="text-sm text-neutral-900 font-bold sm:text-base dark:text-neutral-100">
                Want custom scenes for your companion?
              </h3>
              <span class="border border-emerald-500/20 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-600 font-bold dark:text-emerald-400">
                100% FREE AI
              </span>
            </div>
            <p class="max-w-2xl text-xs text-neutral-600 leading-relaxed dark:text-neutral-300">
              Dream up infinite rooms, anime landscapes, and scenery in seconds using zero-config generative AI providers like <strong>Pollinations AI</strong> (no API keys or accounts required), or link your local <strong>ComfyUI</strong> workflows in the <strong>Artistry Studio</strong>.
            </p>
          </div>
        </div>

        <Button
          variant="primary"
          size="sm"
          :class="[
            'shrink-0 font-bold flex items-center gap-2 py-2.5 px-4 shadow-sm rounded-xl',
            'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 border-none text-white transition-all',
          ]"
          @click="router.push('/settings/modules/artistry')"
        >
          <div class="i-solar:magic-stick-3-bold-duotone text-base" />
          <span>Open Artistry Studio</span>
          <div class="i-solar:arrow-right-line-duotone text-sm" />
        </Button>
      </div>

      <!-- Tips callout -->
      <Callout theme="lime" :label="t('settings.pages.scene.tip.label')">
        <div v-html="t('settings.pages.scene.tip.description')" />
      </Callout>
    </div>

    <!-- Background Icon Decoration -->
    <div
      v-motion
      :class="[
        'text-neutral-200/50 dark:text-neutral-600/20',
        'pointer-events-none fixed bottom-0 right--5 z--1',
        'size-60 flex items-center justify-center',
      ]"
      :style="{ top: 'calc(100dvh - 15rem)' }"
      :initial="{ scale: 0.9, opacity: 0, y: 20 }"
      :enter="{ scale: 1, opacity: 1, y: 0 }"
      :duration="500"
    >
      <div :class="['text-6xl', 'i-solar:armchair-2-bold-duotone']" />
    </div>
  </div>
</template>

<route lang="yaml">
meta:
  layout: settings
  titleKey: settings.pages.scene.title
  subtitleKey: settings.title
  descriptionKey: settings.pages.scene.description
  icon: i-solar:armchair-2-bold-duotone
  settingsEntry: true
  order: 3
  stageTransition:
    name: slide
    pageSpecificAvailable: true
</route>
