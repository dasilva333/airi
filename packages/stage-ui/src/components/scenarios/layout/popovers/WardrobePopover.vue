<script setup lang="ts">
/**
 * Wardrobe popover — outfit slots for the card's active display model.
 *
 * Self-serving: resolves the display model itself instead of receiving it from
 * the shell, so the shell no longer needs to know which popovers care about it.
 */
import { storeToRefs } from 'pinia'
import { computed } from 'vue'

import OutfitSlotList from '../OutfitSlotList.vue'
import StripPopover from '../StripPopover.vue'

import { useAiriCardStore } from '../../../../stores/modules/airi-card'

const emit = defineEmits<{ close: [] }>()

const cardStore = useAiriCardStore()
const { activeCardId } = storeToRefs(cardStore)

const displayModelId = computed(() => cardStore.getCardDisplayModelId(activeCardId.value) || '')
</script>

<template>
  <StripPopover title="Wardrobe" @close="emit('close')">
    <OutfitSlotList :model-id="displayModelId" />
  </StripPopover>
</template>
