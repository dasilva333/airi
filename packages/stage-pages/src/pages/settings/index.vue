<script setup lang="ts">
import { IconItem, RippleGrid } from '@proj-airi/stage-ui/components'
import { useRippleGridState } from '@proj-airi/stage-ui/composables/use-ripple-grid-state'
import { useSettings } from '@proj-airi/stage-ui/stores/settings'
import { computed, ref } from 'vue'
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
  </div>
</template>

<route lang="yaml">
meta:
  layout: settings
  stageTransition:
    name: slide
</route>
