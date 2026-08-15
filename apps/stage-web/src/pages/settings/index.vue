<script setup lang="ts">
import SettingsIndexPage from '../../../../../packages/stage-pages/src/pages/settings/index.vue'
</script>

<template>
  <SettingsIndexPage />
</template>

<route lang="yaml">
meta:
  layout: settings
  titleKey: settings.title
  stageTransition:
    name: slide
</route>
