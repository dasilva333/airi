<script setup lang="ts">
/**
 * All Emotions popover — trigger-mode expression explorer for the card's
 * active display model.
 *
 * Self-serving (see WardrobePopover): the display model is resolved here rather
 * than passed down, so the shell does not own popover-scoped state.
 */
import { storeToRefs } from 'pinia'
import { computed } from 'vue'

import ExpressionExplorer from '../../settings/model-settings/ExpressionExplorer.vue'
import StripPopover from '../StripPopover.vue'

import { useAiriCardStore } from '../../../../stores/modules/airi-card'

const emit = defineEmits<{ close: [] }>()

const cardStore = useAiriCardStore()
const { activeCardId } = storeToRefs(cardStore)

const displayModelId = computed(() => cardStore.getCardDisplayModelId(activeCardId.value) || '')
</script>

<template>
  <StripPopover title="All Emotions" @close="emit('close')">
    <div class="max-h-64 min-h-0 flex flex-col overflow-hidden">
      <ExpressionExplorer
        :model-id="displayModelId"
        mode="trigger"
      />
    </div>
  </StripPopover>
</template>
