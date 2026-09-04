<script setup lang="ts">
import { isStageWeb } from '@proj-airi/stage-shared'
import { CloudflareAccountHeaderWidget, SettingsSearchBar, SettingsThemeHeaderWidget } from '@proj-airi/stage-ui/components'
import { useGetNativeAppModal } from '@proj-airi/stage-ui/composables'
import { buildSettingsCatalogTopology, resolvePathFromRoute } from '@proj-airi/stage-ui/constants'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

defineProps<{
  showSidebar?: boolean
}>()

const emit = defineEmits<{
  (e: 'back'): void
}>()

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const providersStore = useProvidersStore()
const isMobileSearchOpen = ref(false)
const { open: openGetAppDialog } = useGetNativeAppModal()

interface BreadcrumbItem {
  id: string
  label: string
  shortLabel?: string
  glyph?: string
  route: string
  isLast: boolean
}

const topology = computed(() => {
  return buildSettingsCatalogTopology(providersStore.allProvidersMetadata)
})

const pathResolution = computed(() => {
  return resolvePathFromRoute(topology.value, route.path, route.hash)
})

const breadcrumbs = computed<BreadcrumbItem[]>(() => {
  const { path } = pathResolution.value
  const top = topology.value

  return path.map((id, index) => {
    const node = top.nodesById[id]
    const isLast = index === path.length - 1
    const rawLabel = node?.titleKey ? t(node.titleKey, node.label) : (node?.label || id)
    const shortLabel = node?.shortLabel || rawLabel.slice(0, 10)

    return {
      id,
      label: rawLabel,
      shortLabel: shortLabel.toUpperCase(),
      glyph: node?.glyph,
      route: node?.route || '/settings',
      isLast,
    }
  })
})

const depthLevel = computed(() => {
  return pathResolution.value.path.length
})

function handleSegmentClick(crumb: BreadcrumbItem) {
  if (!crumb.isLast) {
    router.push(crumb.route)
  }
}

function handleBackClick() {
  emit('back')
}
</script>

<template>
  <header
    class="shadow-2xs relative z-50 h-14 w-full flex items-center justify-between gap-2 border-b border-neutral-200/70 bg-white/70 px-3 backdrop-blur-md sm:gap-3 dark:border-neutral-800/70 dark:bg-neutral-900/70 sm:px-4"
  >
    <!-- Left: Back Button & Clickable Breadcrumbs (Hidden on mobile when spotlight search is active) -->
    <div
      :class="[
        'items-center gap-2 sm:gap-3 shrink-0',
        isMobileSearchOpen ? 'hidden sm:flex' : 'flex',
      ]"
    >
      <!-- Back Button -->
      <button
        type="button"
        class="shadow-2xs size-8 flex shrink-0 items-center justify-center border border-neutral-200/80 rounded-lg bg-white/80 text-neutral-600 transition-all active:scale-90 dark:border-neutral-800/80 hover:border-neutral-300 dark:bg-neutral-800/80 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:border-neutral-700 dark:hover:bg-neutral-800"
        title="Go back"
        @click="handleBackClick"
      >
        <div class="i-solar:alt-arrow-left-line-duotone size-4" />
      </button>

      <!-- Breadcrumbs Trail -->
      <nav class="flex items-center gap-1.5 overflow-x-auto text-xs scrollbar-none sm:gap-2">
        <template v-for="(crumb, index) in breadcrumbs" :key="crumb.id">
          <!-- Separator Diamond -->
          <span v-if="index > 0" class="select-none text-[10px] text-neutral-300 dark:text-neutral-600">
            ◇
          </span>

          <!-- Breadcrumb Item -->
          <button
            type="button"
            :disabled="crumb.isLast"
            :class="[
              'flex items-center gap-1.5 rounded-lg px-2 py-1 font-mono transition-all',
              crumb.isLast
                ? 'font-bold text-primary-600 dark:text-primary-400 cursor-default bg-primary-500/10 dark:bg-primary-500/20'
                : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 hover:bg-neutral-100/40 dark:hover:bg-neutral-800/40 cursor-pointer',
            ]"
            @click="handleSegmentClick(crumb)"
          >
            <span
              v-if="crumb.glyph"
              :class="[
                'text-[11px] font-bold',
                crumb.isLast ? 'text-primary-500' : 'text-neutral-400 dark:text-neutral-500',
              ]"
            >
              {{ crumb.glyph }}
            </span>
            <span class="truncate text-[11px] tracking-wider uppercase sm:text-xs">
              {{ crumb.shortLabel || crumb.label }}
            </span>
          </button>
        </template>
      </nav>
    </div>

    <!-- Center: Horizontally Centered Autocomplete Search Bar (Expands on mobile) -->
    <div
      :class="[
        'flex flex-1 items-center justify-center transition-all duration-200',
        isMobileSearchOpen ? 'mx-0 w-full max-w-none' : 'mx-2 max-w-xl',
      ]"
    >
      <SettingsSearchBar
        v-model:mobile-search-open="isMobileSearchOpen"
        class="w-full"
      />
    </div>

    <!-- Right: Depth Indicator & Theme / Color Picking Controls (Hidden on mobile when spotlight search is active) -->
    <div
      :class="[
        'items-center gap-2 sm:gap-2.5 shrink-0',
        isMobileSearchOpen ? 'hidden sm:flex' : 'flex',
      ]"
    >
      <!-- Depth Level Indicator (深 N) -->
      <div
        class="select-none items-center gap-1 border border-neutral-200/50 rounded-xl bg-neutral-100/50 px-2.5 py-1.5 text-[10px] text-neutral-400 tracking-wider font-mono hidden md:flex dark:border-neutral-800/50 dark:bg-neutral-800/50 dark:text-neutral-500"
        title="Topology hierarchy depth"
      >
        <span class="text-primary-500 font-bold">深</span>
        <span>{{ depthLevel }}</span>
      </div>

      <!-- Get Native App Button (Web Stage Only) -->
      <button
        v-if="isStageWeb()"
        type="button"
        class="shadow-2xs h-8 flex shrink-0 items-center gap-1.5 border border-primary-500/30 rounded-lg bg-primary-500/10 px-2.5 text-xs text-primary-700 font-semibold transition-all active:scale-95 hover:bg-primary-500/20 dark:text-primary-300"
        title="Get AIRI for Desktop (Win/Mac) & Mobile (iOS/Android)"
        @click="openGetAppDialog"
      >
        <div class="i-solar:devices-bold-duotone text-sm text-primary-500" />
        <span class="text-[11px] hidden md:inline">Get App</span>
      </button>

      <!-- Cloudflare & Edge Account Indicator Widget -->
      <CloudflareAccountHeaderWidget shrink-0 />

      <!-- Color Palette & Theme Mode Header Widget -->
      <SettingsThemeHeaderWidget shrink-0 />
    </div>
  </header>
</template>
