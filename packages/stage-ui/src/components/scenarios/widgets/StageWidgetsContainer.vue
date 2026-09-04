<script setup lang="ts">
import { storeToRefs } from 'pinia'

import StageWidgetOverlay from './StageWidgetOverlay.vue'

import { useStageWidgetsStore } from '../../../stores/stage-widgets'

const stageWidgetsStore = useStageWidgetsStore()
const { activeWidgets } = storeToRefs(stageWidgetsStore)
</script>

<template>
  <div class="pointer-events-none fixed inset-0 z-50 overflow-hidden">
    <StageWidgetOverlay
      v-for="widget in activeWidgets"
      :key="widget.id"
      :widget="widget"
    />
  </div>
</template>
