<script setup lang="ts">
import { computed, onMounted } from 'vue'

import FloatingWidgetCard from './FloatingWidgetCard.vue'

import { useSandbox } from '../../../composables/use-sandbox'

const { mountedWidgets, init } = useSandbox()

// NOTICE: explicitly (re)init on mount so the layer never stays on an empty
// snapshot if it mounted before the panel's breakout notification fired.
onMounted(() => {
  void init()
})

const floatingWidgets = computed(() => {
  return mountedWidgets.value.filter(w => w.surface === 'widget')
})
</script>

<template>
  <div
    v-if="floatingWidgets.length > 0"
    class="pointer-events-none fixed inset-0 z-35 overflow-hidden"
  >
    <FloatingWidgetCard
      v-for="(widget, idx) in floatingWidgets"
      :key="widget.id"
      :widget="widget"
      :index="idx"
    />
  </div>
</template>
