<script setup lang="ts">
import { StageControlEditor } from '@proj-airi/stage-ui/components'
</script>

<template>
  <StageControlEditor />
</template>

<route lang="yaml">
meta:
  layout: settings
  titleKey: settings.pages.stage.title
  subtitleKey: settings.title
  descriptionKey: settings.pages.stage.description
  icon: i-solar:widget-2-bold-duotone
  settingsEntry: true
  order: 8
  stageTransition:
    name: slide
    pageSpecificAvailable: true
</route>
