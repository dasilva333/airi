<script setup lang="ts">
import { SETTINGS_CATALOG_ITEMS } from '@proj-airi/stage-pages/composables/settings-topology'
import { isStageTamagotchi } from '@proj-airi/stage-shared'
import { CheckBar, IconItem, RippleGrid } from '@proj-airi/stage-ui/components'
import { useRippleGridState } from '@proj-airi/stage-ui/composables/use-ripple-grid-state'
import { useOnboardingStore } from '@proj-airi/stage-ui/stores/onboarding'
import { useSettings } from '@proj-airi/stage-ui/stores/settings'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const settings = useSettings()
const onboardingStore = useOnboardingStore()
const { lastClickedIndex, setLastClickedIndex } = useRippleGridState()

function launchOnboardingV3() {
  onboardingStore.resetSetupState()
  onboardingStore.forceShowSetup()
}

interface ToolItem {
  id: string
  title: string
  description: string
  icon: string
  to: string
}

interface ToolGroup {
  id: string
  title: string
  items: ToolItem[]
}

const toolGroups = computed<ToolGroup[]>(() => {
  const items = SETTINGS_CATALOG_ITEMS
    .filter(item => item.parentId === 'sys-developer')
    .filter(item => isStageTamagotchi() || !item.desktopOnly)
    .sort((a, b) => a.order - b.order)

  const groupsMap = new Map<string, ToolGroup>()

  for (const item of items) {
    const rawCluster = item.clusterGroup || 'RUNTIME & NEURAL LABS'
    const cleanTitle = rawCluster.replace(/[\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF]/g, '').trim() || 'DIAGNOSTICS'
    const groupId = cleanTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')

    if (!groupsMap.has(groupId)) {
      groupsMap.set(groupId, {
        id: groupId,
        title: cleanTitle,
        items: [],
      })
    }

    groupsMap.get(groupId)!.items.push({
      id: item.id,
      title: item.titleKey ? t(item.titleKey, item.label) : item.label,
      description: item.descriptionKey ? t(item.descriptionKey, item.description || '') : (item.description || ''),
      icon: item.icon || 'i-solar:code-bold-duotone',
      to: item.route || '/settings/system/developer',
    })
  }

  return Array.from(groupsMap.values())
})
</script>

<template>
  <div flex="~ col gap-8" pb-12 font-normal>
    <!-- Clustered Developer Instruments -->
    <div v-for="group in toolGroups" :key="group.id" flex="~ col gap-4">
      <div px-4 text="xs neutral-400 dark:neutral-500" font-bold tracking-wider uppercase>
        {{ group.title }}
      </div>
      <RippleGrid
        :items="group.items"
        :get-key="item => item.to"
        :columns="{ default: 1, sm: 2 }"
        :origin-index="lastClickedIndex"
        @item-click="({ globalIndex }) => setLastClickedIndex(globalIndex)"
      >
        <template #item="{ item }">
          <IconItem
            :title="item.title"
            :description="item.description"
            :icon="item.icon"
            :to="item.to"
          />
        </template>
      </RippleGrid>
    </div>

    <!-- Developer Flags (Bottom Section) -->
    <div flex="~ col gap-3">
      <div px-4 text="xs neutral-400 dark:neutral-500" font-bold tracking-wider uppercase>
        Runtime Animation Flags
      </div>
      <div class="flex flex-col gap-2">
        <CheckBar
          v-model="settings.disableTransitions"
          icon-on="i-solar:people-nearby-bold-duotone"
          icon-off="i-solar:running-2-line-duotone"
          text="settings.animations.stage-transitions.title"
        />
        <CheckBar
          v-model="settings.usePageSpecificTransitions"
          :disabled="settings.disableTransitions"
          icon-on="i-solar:running-2-line-duotone"
          icon-off="i-solar:people-nearby-bold-duotone"
          text="settings.animations.use-page-specific-transitions.title"
          description="settings.animations.use-page-specific-transitions.description"
        />
      </div>
    </div>

    <!-- Onboarding Wizard Trigger -->
    <div flex="~ col gap-3">
      <div px-4 text="xs neutral-400 dark:neutral-500" font-bold tracking-wider uppercase>
        Onboarding Wizard
      </div>
      <div class="px-4">
        <button
          type="button"
          class="w-full flex items-center justify-between border border-neutral-200/80 rounded-xl bg-neutral-100/50 p-4 text-left transition-all active:scale-[0.99] dark:border-neutral-800/80 active:bg-neutral-200/60 dark:bg-neutral-900/50 dark:active:bg-neutral-800/60"
          @click="launchOnboardingV3"
        >
          <div class="flex items-center gap-3">
            <div class="i-solar:stars-minimalistic-bold-duotone size-6 text-primary-500" />
            <div>
              <div class="text-sm text-neutral-800 font-medium dark:text-neutral-200">
                Launch Onboarding V3
              </div>
              <div class="text-xs text-neutral-500 dark:text-neutral-400">
                Re-test the modular 7-stage initialization and persona wizard
              </div>
            </div>
          </div>
          <div class="i-solar:alt-arrow-right-linear size-4 text-neutral-400" />
        </button>
      </div>
    </div>

    <div
      v-motion
      text="neutral-200/50 dark:neutral-600/20" pointer-events-none
      fixed top="[calc(100dvh-15rem)]" bottom-0 right--5 z--1
      :initial="{ scale: 0.9, opacity: 0, y: 20 }"
      :enter="{ scale: 1, opacity: 1, y: 0 }"
      :duration="500"
      size-60
      flex items-center justify-center
    >
      <div text="60" i-solar:code-bold-duotone />
    </div>
  </div>
</template>

<route lang="yaml">
meta:
  layout: settings
  stageTransition:
    name: slide
</route>
