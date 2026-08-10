<script setup lang="ts">
import { IconItem, OnboardingV2, RippleGrid } from '@proj-airi/stage-ui/components'
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
const showOnboardingV2 = ref(false)

watch(
  () => route.query.action,
  (action) => {
    if (action === 'onboarding') {
      onboardingStore.resetSetupState()
      onboardingStore.forceShowSetup()
      router.replace({ query: {} })
    }
    // V2 preview: isolated overlay, must NOT call resetSetupState() — that
    // would clear the live `onboarding/completed` flag.
    else if (action === 'onboarding-v2') {
      showOnboardingV2.value = true
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

    <!-- V2 onboarding preview overlay (UI mockup scaffold) -->
    <Teleport to="body">
      <div
        v-if="showOnboardingV2"
        class="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm"
        @click.self="showOnboardingV2 = false"
      >
        <div class="absolute left-1/2 top-1/2 max-h-[92dvh] max-w-3xl w-[94dvw] flex flex-col -translate-x-1/2 -translate-y-1/2">
          <div :class="['h-full max-h-[92dvh]', 'flex flex-col', 'rounded-2xl border border-neutral-200/60', 'bg-white/95 dark:bg-neutral-900/95', 'shadow-2xl backdrop-blur-xl', 'overflow-hidden']">
            <div class="flex flex-shrink-0 items-center justify-between border-b border-neutral-200/60 px-5 py-3 dark:border-neutral-800/80">
              <span class="text-xs text-neutral-400 font-bold tracking-wider uppercase dark:text-neutral-500">AIRI Setup · V2 Preview</span>
              <button
                class="h-7 w-7 flex items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                @click="showOnboardingV2 = false"
              >
                <div class="i-solar:close-circle-bold-duotone h-5 w-5" />
              </button>
            </div>
            <div class="min-h-0 flex-1 overflow-y-auto p-5">
              <OnboardingV2 @close="showOnboardingV2 = false" />
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<route lang="yaml">
meta:
  layout: settings
  stageTransition:
    name: slide
</route>
