<script setup lang="ts">
import { CodeAssistant } from '@proj-airi/stage-ui/components'
</script>

<template>
  <CodeAssistant />
</template>

<route lang="yaml">
meta:
  layout: settings
  titleKey: settings.pages.modules.code-assistant.title
  subtitleKey: settings.title
  stageTransition:
    name: slide
    pageSpecificAvailable: true
</route>
