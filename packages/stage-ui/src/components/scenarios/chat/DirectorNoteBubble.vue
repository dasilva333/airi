<script setup lang="ts">
import type { DirectorNote } from '../../../types/director'

import { ref } from 'vue'

const props = defineProps<{
  note: DirectorNote
}>()

const isExpanded = ref(false)
</script>

<template>
  <div
    class="director-note-bubble relative my-1 flex flex-col cursor-pointer overflow-hidden border border-purple-300 rounded-lg bg-purple-50/70 p-2 text-sm text-purple-800 font-mono shadow-[0_0_15px_rgba(168,85,247,0.15)] backdrop-blur-md transition-colors dark:border-purple-500/30 dark:bg-black/40 hover:bg-purple-100/80 dark:text-purple-200 dark:hover:bg-black/60"
    @click="isExpanded = !isExpanded"
  >
    <!-- Subtle scanline effect overlay -->
    <div class="pointer-events-none absolute inset-0 bg-[length:100%_4px] bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.1)_50%)] opacity-20" />

    <div class="z-10 flex select-none items-center justify-between">
      <div class="flex items-center gap-2">
        <span class="i-carbon-video text-purple-400" />
        <span class="text-xs text-purple-700 font-bold tracking-widest dark:text-purple-300">DIRECTOR'S MONITOR</span>
      </div>
      <div class="flex items-center gap-2 border border-purple-300 rounded bg-purple-100/50 px-2 py-0.5 dark:border-purple-500/20 dark:bg-black/50">
        <span class="text-xs text-purple-600 dark:text-purple-400/70">GRADE</span>
        <span class="text-purple-900 font-bold dark:text-purple-200">{{ note.intensity }}/100</span>
        <span class="ml-1 text-purple-600/55 transition-transform dark:text-purple-400/50" :class="isExpanded ? 'i-carbon-chevron-up' : 'i-carbon-chevron-down'" />
      </div>
    </div>

    <!-- Expanded Content -->
    <div v-show="isExpanded" class="z-10 mt-2 flex flex-col animate-fade-in animate-duration-200 cursor-text select-auto gap-2 border-t border-purple-200 pt-2 dark:border-purple-500/20" @click.stop>
      <div class="border-l-2 border-purple-300 pl-2 opacity-90 dark:border-purple-500/40">
        <p class="whitespace-pre-wrap text-xs leading-relaxed">
          {{ note.content }}
        </p>
      </div>

      <!-- Scratchpad State Section -->
      <div v-if="note.scratchpad" class="mt-1 flex flex-col gap-1 border-t border-purple-200 pt-2 dark:border-purple-500/10">
        <span class="text-[10px] text-purple-600 font-bold tracking-wider uppercase dark:text-purple-400">Visual State Board</span>
        <pre class="whitespace-pre-wrap border border-purple-200 rounded bg-purple-100/30 p-1.5 text-[11px] text-purple-900 leading-relaxed font-mono dark:border-purple-500/10 dark:bg-purple-950/20 dark:text-purple-300">{{ note.scratchpad }}</pre>
      </div>

      <div v-if="note.state === 'pending' || note.selected_concepts?.length || (note.intensity >= 70 && note.state === 'done')" class="mt-1 flex items-center justify-between border-t border-purple-200 pt-2 dark:border-purple-500/20">
        <div class="flex items-center gap-2">
          <template v-if="note.state === 'pending'">
            <span class="i-svg-spinners-pulse-multiple text-purple-600 dark:text-purple-400" />
            <span class="animate-pulse text-xs text-purple-700 dark:text-purple-300">Manifesting Scene...</span>
          </template>
          <template v-else-if="note.intensity >= 70">
            <span class="i-carbon-checkmark-outline text-green-600 dark:text-green-400" />
            <span class="text-xs text-green-700 dark:text-green-300">Scene Manifested</span>
          </template>
          <template v-else>
            <span class="i-carbon-information text-purple-500/50 dark:text-purple-400/50" />
            <span class="text-xs text-purple-600/50 dark:text-purple-300/50">Analysis Complete</span>
          </template>
        </div>

        <!-- Concepts Chips -->
        <div v-if="note.selected_concepts?.length" class="flex flex-wrap justify-end gap-1">
          <span
            v-for="concept in note.selected_concepts"
            :key="concept"
            class="border border-purple-300 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] text-purple-800 tracking-tighter uppercase shadow-[0_0_5px_rgba(168,85,247,0.1)] dark:border-purple-500/30 dark:bg-purple-500/10 dark:text-purple-300"
          >
            {{ concept }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.director-note-bubble {
  transition: all 0.3s ease;
}
</style>
