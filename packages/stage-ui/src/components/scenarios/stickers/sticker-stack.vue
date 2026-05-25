<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useStickersStore } from '../../../stores/stickers'
import StickerWidget from './sticker-widget.vue'

const stickersStore = useStickersStore()
const { activePlacements } = storeToRefs(stickersStore)
</script>

<template>
  <div class="pointer-events-none fixed inset-0 z-50 overflow-hidden">
    <StickerWidget
      v-for="placement in activePlacements"
      :key="placement.instanceId"
      :instance-id="placement.instanceId"
      :sticker-id="placement.stickerId"
      :initial-x="placement.x"
      :initial-y="placement.y"
      :rotation="placement.rotation"
      :expires-at="placement.expiresAt"
    />
  </div>
</template>
