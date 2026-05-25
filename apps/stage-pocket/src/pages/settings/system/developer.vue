<script setup lang="ts">
import { CheckBar, IconItem } from '@proj-airi/stage-ui/components'
import { useSettings } from '@proj-airi/stage-ui/stores/settings'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const settings = useSettings()

const menu = computed(() => [
  {
    description: 'Test Audio related composables',
    icon: 'i-solar:sledgehammer-bold-duotone',
    title: 'Audio Record',
    to: '/devtools/audio-record',
  },
  {
    description: 'Test blending & theme',
    icon: 'i-solar:sledgehammer-bold-duotone',
    title: 'Background Theme color blending',
    to: '/devtools/background-gradient-blending',
  },
  {
    description: 'Utility for background removal',
    icon: 'i-solar:sledgehammer-bold-duotone',
    title: 'Background removal (WebGPU required)',
    to: '/devtools/background-removal',
  },
  {
    description: 'Chat',
    icon: 'i-solar:sledgehammer-bold-duotone',
    title: 'Chat',
    to: '/devtools/chat',
  },
  {
    description: 'Test gesture recognition',
    icon: 'i-solar:sledgehammer-bold-duotone',
    title: 'Gesture Circle (Desktop only)',
    to: '/devtools/gesture-circle',
  },
  {
    description: 'Image',
    icon: 'i-solar:sledgehammer-bold-duotone',
    title: 'Image',
    to: '/devtools/image',
  },
  {
    description: 'Utility for taking shots of models',
    icon: 'i-solar:sledgehammer-bold-duotone',
    title: 'Polaroid',
    to: '/devtools/polaroid',
  },
  {
    description: t('settings.pages.system.sections.section.developer.sections.section.use-magic-keys.description'),
    icon: 'i-solar:sledgehammer-bold-duotone',
    title: t('settings.pages.system.sections.section.developer.sections.section.use-magic-keys.title'),
    to: '/devtools/use-magic-keys',
  },
  {
    description: 'Test color extraction',
    icon: 'i-solar:sledgehammer-bold-duotone',
    title: 'Color extract',
    to: '/devtools/vibrant',
  },
  {
    description: 'Stream microphone audio to Aliyun NLS and inspect live transcripts',
    icon: 'i-solar:sledgehammer-bold-duotone',
    title: 'Aliyun Real-time Transcriber',
    to: '/devtools/providers-transcription-realtime-aliyun-nls',
  },
  {
    description: 'VRM expressions + TTS lip sync playground',
    icon: 'i-solar:sledgehammer-bold-duotone',
    title: 'Performance Playground',
    to: '/devtools/performance-playground',
  },
  {
    description: 'Test notification',
    icon: 'i-solar:sledgehammer-bold-duotone',
    title: 'Notification',
    to: '/devtools/notifications',
  },
  {
    description: 'Inspect raw WebSocket traffic',
    icon: 'i-solar:transfer-horizontal-bold-duotone',
    title: 'WebSocket Inspector',
    to: '/devtools/websocket-inspector',
  },
])
</script>

<template>
  <CheckBar
    v-model="settings.disableTransitions"
    v-motion
    mb-2
    icon-on="i-solar:people-nearby-bold-duotone"
    icon-off="i-solar:running-2-line-duotone"
    text="settings.animations.stage-transitions.title"
    :initial="{ opacity: 0, y: 10 }"
    :enter="{ opacity: 1, y: 0 }"
    :duration="250 + (19 * 10)"
    :delay="1 * 50"
    transition="all ease-in-out duration-250"
  />
  <CheckBar
    v-model="settings.usePageSpecificTransitions"
    v-motion
    :disabled="settings.disableTransitions"
    icon-on="i-solar:running-2-line-duotone"
    icon-off="i-solar:people-nearby-bold-duotone"
    text="settings.animations.use-page-specific-transitions.title"
    description="settings.animations.use-page-specific-transitions.description"
    :initial="{ opacity: 0, y: 10 }"
    :enter="{ opacity: 1, y: 0 }"
    :duration="250 + (20 * 10)"
    :delay="2 * 50"
    transition="all ease-in-out duration-250"
  />

  <div flex="~ col gap-4" pb-12>
    <IconItem
      v-for="(item, index) in menu"
      :key="item.to"
      v-motion
      :initial="{ opacity: 0, y: 10 }"
      :enter="{ opacity: 1, y: 0 }"
      :duration="250"
      :style="{
        transitionDelay: `${index * 50}ms`, // delay between each item, unocss doesn't support dynamic generation of classes now
      }"
      :title="item.title"
      :description="item.description"
      :icon="item.icon"
      :to="item.to"
    />
  </div>

  <div
    v-motion
    text="neutral-200/50 dark:neutral-600/20" pointer-events-none
    fixed top="[65dvh]" right--15 z--1
    :initial="{ scale: 0.9, opacity: 0, rotate: 30 }"
    :enter="{ scale: 1, opacity: 1, rotate: 0 }"
    :duration="250"
    flex items-center justify-center
  >
    <div text="60" i-solar:code-bold-duotone />
  </div>
</template>

<route lang="yaml">
meta:
  layout: settings
  stageTransition:
    name: slide
</route>
