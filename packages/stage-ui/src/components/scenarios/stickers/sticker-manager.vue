<script setup lang="ts">
import { Button } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { onMounted, ref } from 'vue'

import { useStickersStore } from '../../../stores/stickers'

const emit = defineEmits<(e: 'spawn-standalone', id: string) => void>()
const stickersStore = useStickersStore()
const { currentLibrary, standaloneMode } = storeToRefs(stickersStore)
const fileInput = ref<HTMLInputElement>()

// Map to store temporary preview URLs for the library grid
const previews = ref<Record<string, string>>({})

async function loadPreviews() {
  for (const meta of currentLibrary.value) {
    if (!previews.value[meta.id]) {
      const url = await stickersStore.getStickerUrl(meta.id)
      if (url) {
        previews.value[meta.id] = url
      }
    }
  }
}

onMounted(() => {
  loadPreviews()
})

async function handleFileUpload(e: Event) {
  const files = (e.target as HTMLInputElement).files
  if (!files) return

  for (const file of Array.from(files)) {
    try {
      const id = await stickersStore.addSticker(file)
      const url = await stickersStore.getStickerUrl(id)
      if (url) {
        previews.value[id] = url
      }
    } catch (err) {
      console.error('Failed to upload sticker:', err)
    }
  }

  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

function spawn(id: string) {
  if (standaloneMode.value) {
    emit('spawn-standalone', id)
  } else {
    stickersStore.spawnSticker(id, { duration: 60 })
  }
}

async function remove(id: string) {
  await stickersStore.deleteSticker(id)
  delete previews.value[id]
}
</script>

<template>
  <div class="max-h-96 min-h-60 flex flex-col gap-4 overflow-y-auto p-4">
    <div class="flex items-center justify-between gap-4">
      <div class="flex items-center gap-2">
        <h3 class="text-sm text-neutral-500 font-bold tracking-widest uppercase">
          Sticker Library
        </h3>

        <!-- Standalone Toggle -->
        <button
          :class="[
            'flex items-center gap-1 px-2 py-0.5 rounded-full border transition-all duration-200 text-[10px] font-bold uppercase tracking-tight',
            standaloneMode
              ? 'bg-primary-500/10 border-primary-500/30 text-primary-600 dark:text-primary-400 shadow-[0_0_10px_rgba(139,92,246,0.1)]'
              : 'bg-neutral-100 border-neutral-200 text-neutral-400 dark:bg-neutral-800 dark:border-neutral-700',
          ]"
          title="Toggle Standalone Window Mode"
          @click="standaloneMode = !standaloneMode"
        >
          <div :class="[standaloneMode ? 'i-ph:app-window-fill' : 'i-ph:app-window-light', 'size-3']" />
          Standalone
        </button>
      </div>

      <div class="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          class="flex items-center gap-2"
          @click="stickersStore.clearLibrary()"
        >
          <div class="i-ph:trash-bold size-3" />
          Clear Library
        </Button>
        <Button
          variant="primary"
          size="sm"
          class="flex items-center gap-2"
          @click="fileInput?.click()"
        >
          <div class="i-ph:plus-bold size-3" />
          Upload
        </Button>
      </div>
      <input
        ref="fileInput"
        type="file"
        multiple
        accept="image/*"
        class="hidden"
        @change="handleFileUpload"
      >
    </div>

    <!-- Grid -->
    <div
      v-if="currentLibrary.length > 0"
      class="grid grid-cols-3 gap-3"
    >
      <div
        v-for="meta in currentLibrary"
        :key="meta.id"
        class="group relative aspect-square flex cursor-pointer items-center justify-center rounded-xl bg-neutral-100 p-2 transition-all dark:bg-neutral-800 hover:ring-2 hover:ring-primary-400"
        @click="spawn(meta.id)"
      >
        <img
          v-if="previews[meta.id]"
          :src="previews[meta.id]"
          class="max-h-full max-w-full object-contain"
          :alt="meta.label"
        >

        <!-- Label Overlay -->
        <div class="absolute inset-0 flex items-end justify-center rounded-xl bg-black/40 p-1 opacity-0 transition-opacity group-hover:opacity-100">
          <span class="w-full truncate text-center text-[10px] text-white font-medium">
            {{ meta.label }}
          </span>
        </div>

        <!-- Delete Metadata -->
        <button
          class="absolute size-4 flex items-center justify-center rounded-full bg-red-400 text-white opacity-0 shadow-sm transition-opacity -right-1 -top-1 hover:bg-red-500 group-hover:opacity-100"
          @click.stop="remove(meta.id)"
        >
          <div class="i-ph:x-bold size-2" />
        </button>
      </div>
    </div>

    <!-- Empty State -->
    <div
      v-else
      class="flex flex-1 flex-col items-center justify-center gap-2 border-2 border-neutral-200 rounded-2xl border-dashed py-8 text-neutral-400 dark:border-neutral-800"
    >
      <div class="i-ph:stamp-light size-12 opacity-50" />
      <span class="text-xs">No stickers yet</span>
    </div>
  </div>
</template>
