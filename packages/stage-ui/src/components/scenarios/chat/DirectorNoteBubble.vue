<script setup lang="ts">
import { ref } from 'vue'
import type { DirectorNote } from '../../../types/director'

const props = defineProps<{
  note: DirectorNote
}>()

const isExpanded = ref(false)
</script>

<template>
  <div
    class="director-note-bubble relative my-1 flex flex-col cursor-pointer overflow-hidden border border-purple-500/30 rounded-lg bg-black/40 p-2 text-sm text-purple-200 font-mono shadow-[0_0_15px_rgba(168,85,247,0.15)] backdrop-blur-md transition-colors hover:bg-black/60"
    @click="isExpanded = !isExpanded"
  >
    <!-- Subtle scanline effect overlay -->
    <div class="pointer-events-none absolute inset-0 bg-[length:100%_4px] bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.1)_50%)] opacity-20" />

    <div class="z-10 flex select-none items-center justify-between">
      <div class="flex items-center gap-2">
        <span class="i-carbon-video text-purple-400" />
        <span class="text-xs text-purple-300 font-bold tracking-widest">DIRECTOR'S MONITOR</span>
      </div>
      <div class="flex items-center gap-2 border border-purple-500/20 rounded bg-black/50 px-2 py-0.5">
        <span class="text-xs text-purple-400/70">GRADE</span>
        <span class="text-purple-200 font-bold">{{ note.intensity }}/100</span>
        <span class="ml-1 text-purple-400/50 transition-transform" :class="isExpanded ? 'i-carbon-chevron-up' : 'i-carbon-chevron-down'" />
      </div>
    </div>

    <!-- Expanded Content -->
    <div v-show="isExpanded" class="z-10 mt-2 flex flex-col animate-fade-in animate-duration-200 cursor-text select-auto gap-2 border-t border-purple-500/20 pt-2" @click.stop>
      <div class="border-l-2 border-purple-500/40 pl-2 opacity-90">
        <p class="whitespace-pre-wrap text-xs leading-relaxed">
          {{ note.content }}
        </p>
      </div>

      <div v-if="note.state === 'pending' || note.selected_concepts?.length || (note.intensity >= 70 && note.state === 'done')" class="mt-1 flex items-center justify-between border-t border-purple-500/20 pt-2">
        <div class="flex items-center gap-2">
          <template v-if="note.state === 'pending'">
            <span class="i-svg-spinners-pulse-multiple text-purple-400" />
            <span class="animate-pulse text-xs text-purple-300">Manifesting Scene...</span>
          </template>
          <template v-else-if="note.intensity >= 70">
            <span class="i-carbon-checkmark-outline text-green-400" />
            <span class="text-xs text-green-300">Scene Manifested</span>
          </template>
          <template v-else>
            <span class="i-carbon-information text-purple-400/50" />
            <span class="text-xs text-purple-300/50">Analysis Complete</span>
          </template>
        </div>

        <!-- Concepts Chips -->
        <div v-if="note.selected_concepts?.length" class="flex flex-wrap justify-end gap-1">
          <span
            v-for="concept in note.selected_concepts"
            :key="concept"
            class="border border-purple-500/30 rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] text-purple-300 tracking-tighter uppercase shadow-[0_0_5px_rgba(168,85,247,0.1)]"
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
