<script setup lang="ts">
import { isStageCapacitor, isStageTamagotchi } from '@proj-airi/stage-shared'
import { AboutContent, AboutDialog, IconItem, RippleGrid } from '@proj-airi/stage-ui/components'
import { useBuildInfo } from '@proj-airi/stage-ui/composables'
import { useRippleGridState } from '@proj-airi/stage-ui/composables/use-ripple-grid-state'
import { useOnboardingStore } from '@proj-airi/stage-ui/stores/onboarding'
import { useSettings } from '@proj-airi/stage-ui/stores/settings'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import SettingsQuickAccess from './components/SettingsQuickAccess.vue'
import SettingsSearchBar from './components/SettingsSearchBar.vue'

const router = useRouter()
const route = useRoute()
const resolveAnimation = ref<() => void>()
const { t } = useI18n()
const { lastClickedIndex, setLastClickedIndex } = useRippleGridState()

const settingsStore = useSettings()
const onboardingStore = useOnboardingStore()

const showAbout = ref(false)
const buildInfo = useBuildInfo()
const aboutLinks = [
  { label: 'Home', href: 'https://airi.moeru.ai/docs/', icon: 'i-solar:home-smile-outline' },
  { label: 'Documentations', href: 'https://airi.moeru.ai/docs/en/docs/overview/', icon: 'i-solar:document-add-outline' },
  { label: 'GitHub', href: 'https://github.com/moeru-ai/airi', icon: 'i-simple-icons:github' },
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

const removeBeforeEach = router.beforeEach(async (_, __, next) => {
  if (!settingsStore.usePageSpecificTransitions || settingsStore.disableTransitions) {
    next()
    return
  }

  await new Promise<void>((resolve) => {
    resolveAnimation.value = resolve
  })
  removeBeforeEach()
  next()
})

const settingsGroups = computed(() => [
  {
    id: 'character',
    title: 'CHARACTER & SCENE',
    items: [
      {
        title: t('settings.pages.card.title'),
        description: t('settings.pages.card.description'),
        icon: 'i-solar:emoji-funny-square-bold-duotone',
        to: '/settings/airi-card',
      },
      {
        title: t('settings.pages.scene.title'),
        description: t('settings.pages.scene.description'),
        icon: 'i-solar:armchair-2-bold-duotone',
        to: '/settings/scene',
      },
      {
        title: t('settings.pages.models.title'),
        description: t('settings.pages.models.description'),
        icon: 'i-solar:people-nearby-bold-duotone',
        to: '/settings/models',
      },
      {
        title: t('settings.pages.memory.title'),
        description: t('settings.pages.memory.description'),
        icon: 'i-solar:leaf-bold-duotone',
        to: '/settings/memory',
      },
      {
        title: 'Dating Sim',
        description: 'Adjust interactive game modes, intimacy gating thresholds, and visual behavior rules',
        icon: 'i-solar:heart-bold-duotone',
        to: '/settings/dating-sim',
      },
    ],
  },
  {
    id: 'intelligence',
    title: 'INTELLIGENCE',
    items: [
      {
        title: t('settings.pages.modules.title'),
        description: t('settings.pages.modules.description'),
        icon: 'i-solar:layers-bold-duotone',
        to: '/settings/modules',
      },
      {
        title: t('settings.pages.providers.title'),
        description: t('settings.pages.providers.description'),
        icon: 'i-solar:box-minimalistic-bold-duotone',
        to: '/settings/providers',
      },
    ],
  },
  {
    id: 'system',
    title: 'SYSTEM',
    items: [
      {
        title: t('settings.pages.system.title'),
        description: t('settings.pages.system.description'),
        icon: 'i-solar:filters-bold-duotone',
        to: '/settings/system',
      },
      {
        title: t('settings.pages.docs.title'),
        description: t('settings.pages.docs.description'),
        icon: 'i-solar:book-open-bold-duotone',
        to: '/settings/docs',
      },
      {
        title: t('settings.pages.data.title'),
        description: t('settings.pages.data.description'),
        icon: 'i-solar:database-bold-duotone',
        to: '/settings/data',
      },
    ],
  },
])

function isActive(to: string) {
  const currentPath = route.path.replace(/\/$/, '')
  const targetPath = to.replace(/\/$/, '')
  return currentPath === targetPath || currentPath.startsWith(`${targetPath}/`)
}
</script>

<template>
  <div flex="~ col gap-8" pb-12 font-normal>
    <!-- Search Bar & Quick Access -->
    <div flex="~ col gap-5">
      <SettingsSearchBar />
      <SettingsQuickAccess />
    </div>

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
