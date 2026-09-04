<script setup lang="ts">
import { isStageWeb } from '@proj-airi/stage-shared'
import { GetNativeAppDialog } from '@proj-airi/stage-ui/components'
import { buildSettingsCatalogTopology, resolveSettingsBackRoute } from '@proj-airi/stage-ui/constants'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { useTheme } from '@proj-airi/ui'
import { useMediaQuery } from '@vueuse/core'
import { computed, onMounted, ref, watch } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'

import SettingsBreadcrumbHeader from '../components/Layouts/SettingsMasterDetail/SettingsBreadcrumbHeader.vue'
import SettingsSidebarNav from '../components/Layouts/SettingsMasterDetail/SettingsSidebarNav.vue'

import { themeColorFromValue, useThemeColor } from '../composables/theme-color'

const route = useRoute()
const router = useRouter()
const { isDark: dark } = useTheme()
const providersStore = useProvidersStore()

// Widescreen breakpoint for Master-Detail dual-pane mode (1024px+)
const isWidescreen = useMediaQuery('(min-width: 1024px)')

const topology = computed(() => {
  return buildSettingsCatalogTopology(providersStore.allProvidersMetadata)
})

const { updateThemeColor } = useThemeColor(themeColorFromValue({ light: 'rgb(255 255 255)', dark: 'rgb(18 18 18)' }))
watch(dark, () => updateThemeColor(), { immediate: true })
watch(route, () => updateThemeColor(), { immediate: true })
onMounted(() => updateThemeColor())

// The window doesn't scroll here; this layout-owned container does, so the
// router has no chance to reset it.
const scrollContainerRef = ref<HTMLElement>()
watch(() => route.path, () => {
  if (scrollContainerRef.value)
    scrollContainerRef.value.scrollTop = 0
})

function handleBack() {
  const target = resolveSettingsBackRoute(route.path, {
    isDesktop: isWidescreen.value,
    topology: topology.value,
  })

  if (target) {
    router.push(target)
  }
  else {
    router.push('/')
  }
}
</script>

<template>
  <div
    :style="{
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      paddingTop: 'env(safe-area-inset-top, 0px)',
      paddingRight: 'env(safe-area-inset-right, 0px)',
      paddingLeft: 'env(safe-area-inset-left, 0px)',
    }"
    class="h-full w-full overflow-hidden bg-white text-neutral-900 transition-colors dark:bg-neutral-950 dark:text-neutral-100"
  >
    <!-- Master-Detail Dual-Pane Mode (Desktop / Widescreen >= 1024px) -->
    <div v-if="isWidescreen" class="h-full w-full flex overflow-hidden">
      <!-- Left: Navigation Sidebar -->
      <aside class="h-full w-64 shrink-0 xl:w-72">
        <SettingsSidebarNav />
      </aside>

      <!-- Right: Main Content Area with Header -->
      <main class="h-full min-w-0 flex flex-1 flex-col overflow-hidden bg-white/60 dark:bg-neutral-950/60">
        <SettingsBreadcrumbHeader :show-sidebar="true" @back="handleBack" />

        <div
          id="settings-scroll-container"
          ref="scrollContainerRef"
          class="relative min-h-0 flex-1 overflow-y-auto p-4 scrollbar-none lg:p-8 sm:p-6"
        >
          <div class="mx-auto max-w-5xl">
            <RouterView />
          </div>
        </div>
      </main>
    </div>

    <!-- Single Column Mode (Mobile / Narrow < 1024px) -->
    <div v-else class="h-full w-full flex flex-col overflow-hidden">
      <SettingsBreadcrumbHeader :show-sidebar="false" @back="handleBack" />

      <div
        id="settings-scroll-container"
        ref="scrollContainerRef"
        class="relative min-h-0 flex-1 overflow-y-auto px-3 py-3 scrollbar-none sm:px-4 sm:py-4"
      >
        <div class="mx-auto max-w-2xl">
          <RouterView />
        </div>
      </div>
    </div>

    <!-- Get Native Apps Dialog (Web Stage) -->
    <GetNativeAppDialog v-if="isStageWeb()" />
  </div>
</template>
