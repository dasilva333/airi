<script setup lang="ts">
/**
 * VFX & Auras popover — stateless wrapper around the bespoke preview grid.
 */
import StripPopover from '../StripPopover.vue'
import VfxPreviewGrid from '../VfxPreviewGrid.vue'

const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <StripPopover title="VFX & Auras" @close="emit('close')">
    <VfxPreviewGrid />
  </StripPopover>
</template>
