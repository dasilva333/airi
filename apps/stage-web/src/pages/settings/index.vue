<script setup lang="ts">
// Web Settings root — re-uses the shared settings shell from the Electron
// app via route metadata. The layout (`settings`) is provided by the shared
// `packages/stage-layouts` dir; the guard-enforced ground rule that users cannot
// navigate back from `/settings` to `/` is expressed via `rootOfSettings`.
</script>

<template>
  <div />
</template>

<route lang="yaml">
meta:
  layout: settings
  titleKey: settings.title
  rootOfSettings: true
</route>
