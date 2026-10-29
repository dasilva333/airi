<script setup lang="ts">
import { isStageCapacitor, isStageTamagotchi } from '@proj-airi/stage-shared'
import { AboutContent, AboutDialog, IconItem, RippleGrid } from '@proj-airi/stage-ui/components'
import { useBuildInfo } from '@proj-airi/stage-ui/composables'
import { useRippleGridState } from '@proj-airi/stage-ui/composables/use-ripple-grid-state'
import { useOnboardingStore } from '@proj-airi/stage-ui/stores/onboarding'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import SettingsQuickAccess from './components/SettingsQuickAccess.vue'
import SettingsUpdateBanner from './components/SettingsUpdateBanner.vue'

import { SETTINGS_CATALOG_ITEMS } from '../../composables/settings-topology/settings-catalog'

const router = useRouter()
const route = useRoute()
const { t } = useI18n()
const { lastClickedIndex, setLastClickedIndex } = useRippleGridState()

const onboardingStore = useOnboardingStore()

const showAbout = ref(false)
const buildInfo = useBuildInfo()
const aboutLinks = [
  { label: 'Documentation', href: 'https://dasilva333.github.io/airi/en/docs/overview/', icon: 'i-solar:document-add-outline' },
  { label: 'Web Stage', href: 'https://dasilva333.github.io/airi/web-stage/', icon: 'i-solar:global-outline' },
  { label: 'GitHub', href: 'https://github.com/dasilva333/airi', icon: 'i-simple-icons:github' },
]

const edition = computed(() => {
  return isStageTamagotchi()
    ? t('base.edition.desktop')
    : isStageCapacitor()
      ? t('base.edition.mobile')
      : t('base.edition.web')
})

watch(
  () => route.query.action,
  (action) => {
    if (action === 'onboarding' || action === 'onboarding-v2') {
      onboardingStore.resetSetupState()
      onboardingStore.forceShowSetup()
      router.replace({ query: {} })
    }
  },
  { immediate: true },
)

/**
 * Data-driven Settings Groups derived from the canonical settings-catalog topology.
 * Grouped dynamically by clusterGroup into CHARACTER & SCENE, INTELLIGENCE, and SYSTEM.
 */
const settingsGroups = computed(() => {
  const hubItems = SETTINGS_CATALOG_ITEMS.filter(item => item.parentId === 'hub')
  const groupsMap = new Map<string, { id: string, title: string, items: Array<{ title: string, description: string, icon: string, to: string }> }>()

  for (const item of hubItems) {
    const rawCluster = item.clusterGroup || 'SYSTEM'
    const cleanTitle = rawCluster.replace(/[\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF]/g, '').trim() || 'SYSTEM'
    const groupId = cleanTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')

    if (!groupsMap.has(groupId)) {
      groupsMap.set(groupId, {
        id: groupId,
        title: cleanTitle,
        items: [],
      })
    }

    groupsMap.get(groupId)!.items.push({
      title: item.titleKey ? t(item.titleKey, item.label) : item.label,
      description: item.descriptionKey ? t(item.descriptionKey, item.description || '') : (item.description || ''),
      icon: item.icon || 'i-solar:settings-bold-duotone',
      to: item.route || '/settings',
    })
  }

  return Array.from(groupsMap.values())
})

function isActive(to: string) {
  const currentPath = route.path.replace(/\/$/, '')
  const targetPath = to.replace(/\/$/, '')
  return currentPath === targetPath || currentPath.startsWith(`${targetPath}/`)
}
</script>

<template>
  <div flex="~ col gap-6" pb-12 font-normal>
    <!-- Desktop Update Banner (isStageTamagotchi only) -->
    <SettingsUpdateBanner />

    <!-- Quick Access Shortcuts -->
    <SettingsQuickAccess />

    <div v-for="group in settingsGroups" :key="group.id" flex="~ col gap-4">
      <div px-4 text="xs neutral-400 dark:neutral-500" font-bold tracking-wider uppercase>
        {{ group.title }}
      </div>
      <RippleGrid
        :items="group.items"
        :get-key="item => item.to"
        :columns="1"
        :origin-index="lastClickedIndex"
        @item-click="({ globalIndex }) => setLastClickedIndex(globalIndex)"
      >
        <template #item="{ item }">
          <IconItem
            :title="item.title"
            :description="item.description"
            :icon="item.icon"
            :to="item.to"
            :active="isActive(item.to)"
          />
        </template>
      </RippleGrid>
    </div>

    <!-- About & Build Metadata Footer -->
    <div class="mt-2 flex flex-col items-center justify-center gap-1.5 pt-4 text-center text-xs text-neutral-400 dark:text-neutral-500">
      <button
        class="flex items-center gap-1.5 border border-neutral-200/60 rounded-xl bg-white/70 px-3.5 py-2 text-neutral-700 font-semibold shadow-sm backdrop-blur-md transition-all active:scale-95 dark:border-neutral-800/80 dark:bg-neutral-900/70 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-800"
        @click="showAbout = true"
      >
        <div class="i-solar:info-circle-bold-duotone size-4 text-primary-500" />
        <span>About AIRI</span>
      </button>
      <div class="text-[11px] text-neutral-400/80 font-mono">
        v{{ buildInfo.version }} · {{ edition }}
      </div>
    </div>

    <AboutDialog v-model="showAbout">
      <AboutContent :subtitle="edition" :build-info="buildInfo" :links="aboutLinks" />
    </AboutDialog>

    <div
      v-motion
      text="neutral-200/50 dark:neutral-600/20" pointer-events-none
      fixed top="[calc(100dvh-12rem)]" bottom-0 right--10 z--1
      :initial="{ scale: 0.9, opacity: 0, rotate: 180 }"
      :enter="{ scale: 1, opacity: 1, rotate: 0 }"
      :duration="500"
      size-60
      flex items-center justify-center
    >
      <div v-motion text="60" i-solar:settings-bold-duotone />
    </div>
  </div>
</template>

<route lang="yaml">
meta:
  layout: settings
  stageTransition:
    name: slide
</route>
