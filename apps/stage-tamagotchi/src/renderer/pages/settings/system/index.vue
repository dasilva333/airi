<script setup lang="ts">
import { IconItem } from '@proj-airi/stage-ui/components'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const settings = computed(() => [
  {
    description: t('settings.pages.system.general.description'),
    icon: 'i-solar:emoji-funny-square-bold-duotone',
    title: t('settings.pages.system.general.title'),
    to: '/settings/system/general',
  },
  {
    description: t('settings.pages.system.color-scheme.description'),
    icon: 'i-solar:pallete-2-bold-duotone',
    title: t('settings.pages.system.color-scheme.title'),
    to: '/settings/system/color-scheme',
  },
  {
    description: t('tamagotchi.settings.pages.system.window-shortcuts.description'),
    icon: 'i-solar:keyboard-bold-duotone',
    title: t('tamagotchi.settings.pages.system.window-shortcuts.title'),
    to: '/settings/system/window-shortcuts',
  },
  {
    description: t('tamagotchi.settings.pages.system.dock-mode.description'),
    icon: 'i-solar:magnet-bold-duotone',
    title: t('tamagotchi.settings.pages.system.dock-mode.title'),
    to: '/settings/system/dock-mode',
  },
  {
    description: t('settings.pages.system.developer.description'),
    icon: 'i-solar:code-bold-duotone',
    title: t('settings.pages.system.developer.title'),
    to: '/settings/system/developer',
  },
  {
    description: t('settings.pages.chat.description'),
    icon: 'i-solar:chat-round-dots-bold-duotone',
    title: t('settings.pages.chat.title'),
    to: '/settings/system/chat',
  },
  {
    description: t('settings.pages.connection.description'),
    icon: 'i-solar:wi-fi-router-bold-duotone',
    title: t('settings.pages.connection.title'),
    to: '/settings/system/connection',
  },
])
</script>

<template>
  <div flex="~ col gap-4" font-normal>
    <div />
    <div flex="~ col gap-4">
      <IconItem
        v-for="(setting, index) in settings"
        :key="setting.to"
        v-motion
        :initial="{ opacity: 0, y: 10 }"
        :enter="{ opacity: 1, y: 0 }"
        :duration="250"
        :style="{
          transitionDelay: `${index * 50}ms`, // delay between each item, unocss doesn't support dynamic generation of classes now
        }"
        :title="setting.title"
        :description="setting.description"
        :icon="setting.icon"
        :to="setting.to"
      />
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
  titleKey: settings.pages.system.title
  subtitleKey: settings.title
  descriptionKey: settings.pages.system.description
  icon: i-solar:filters-bold-duotone
  settingsEntry: true
  order: 9
  stageTransition:
    name: slide
    pageSpecificAvailable: true
</route>
