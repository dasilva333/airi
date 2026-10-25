<script setup lang="ts">
import type { ModelCacheStatusMap } from '../../../libs/inference'

import { Button } from '@proj-airi/ui'
import { computed, onMounted, ref } from 'vue'

import {
  clearModelCache,
  clearSingleModelCache,
  formatBytes,
  getDetailedModelCacheMap,
  getModelCacheSize,
} from '../../../libs/inference'

export type ModelCategory = 'all' | 'installed' | 'llm' | 'audio' | 'vision' | 'misc'

interface KnownModelItem {
  id: string
  name: string
  category: Exclude<ModelCategory, 'all' | 'installed'>
  runtime: string
  icon: string
  description?: string
}

const emit = defineEmits<{
  (e: 'change', size: number): void
}>()
const cacheSize = ref(0)
const loading = ref(true)
const clearing = ref(false)
const clearingModelId = ref<string | null>(null)
const selectedCategory = ref<ModelCategory>('all')

// Known model catalog organized by modality
const knownModels: KnownModelItem[] = [
  // 1. LLMs
  {
    id: 'okayuji/Gemma-4-E2B-it-coreml-speculative',
    name: 'Gemma 4 E2B IT (Speculative CoreML)',
    category: 'llm',
    runtime: 'CoreML / ANE',
    icon: 'i-solar:cpu-bolt-bold-duotone',
    description: 'Ultra-fast on-device dialogue with speculative draft verification on Apple Neural Engine',
  },
  // Single-slot RWKV entry: the OPFS cache holds whichever checkpoint was
  // loaded last (new loads evict the previous file on finalize), so the
  // widget tracks slot occupancy — not any one model URL.
  {
    id: 'web-rwkv',
    name: 'RWKV (Web-RWKV)',
    category: 'llm',
    runtime: 'Browser OPFS',
    icon: 'i-solar:chat-round-line-bold-duotone',
    description: 'Single-slot cache · holds the last-loaded checkpoint',
  },
  {
    id: 'web-llm',
    name: 'WebLLM (Ministral 3 / Qwen 2.5 / Llama 3.2)',
    category: 'llm',
    runtime: 'WebGPU (Cache API)',
    icon: 'i-solar:chat-round-dots-bold-duotone',
    description: 'In-browser WebGPU transformer execution engine',
  },
  {
    id: 'needle-2',
    name: 'Needle 2 (Cactus SAN 45M)',
    category: 'llm',
    runtime: 'WASM / CPU',
    icon: 'i-solar:magic-stick-3-bold-duotone',
    description: '14 MB on-device semantic extractor for real-time aside generation & conversational pacing',
  },

  // 2. Audio & Speech
  {
    id: 'onnx-community/Kokoro-82M-v1.0-ONNX',
    name: 'Kokoro 82M TTS (ONNX Web)',
    category: 'audio',
    runtime: 'Transformers.js',
    icon: 'i-solar:volume-loud-bold-duotone',
    description: 'High-speed conversational English & Japanese voice synthesis',
  },
  {
    id: 'whisper',
    name: 'Whisper ASR (Hearing & Transcription)',
    category: 'audio',
    runtime: 'Transformers.js',
    icon: 'i-solar:microphone-bold-duotone',
    description: 'Multilingual automatic speech recognition',
  },
  {
    id: 'moss-tts-nano',
    name: 'MOSS TTS (Nano)',
    category: 'audio',
    runtime: 'Browser OPFS',
    icon: 'i-solar:music-note-bold-duotone',
    description: 'Lightweight on-device speech model',
  },
  {
    id: 'pocket-tts-local',
    name: 'Pocket TTS (Kyutai 0.1B)',
    category: 'audio',
    runtime: 'Browser OPFS',
    icon: 'i-solar:speaker-minimalistic-bold-duotone',
    description: 'Single active language · switching languages evicts the previous bundle',
  },
  {
    id: 'ming3-local',
    name: 'Ming 3.0 TTS (0.5B)',
    category: 'audio',
    runtime: 'WASM / OPFS',
    icon: 'i-solar:soundwave-bold-duotone',
    description: 'Multilingual neural TTS with voice design · ~850 MB bundle',
  },

  // 3. Vision & Artistry
  {
    id: 'wd-tagger',
    name: 'WD Anime Tagger (SwinV2 / ViT / ConvNeXt)',
    category: 'vision',
    runtime: 'Transformers.js',
    icon: 'i-solar:gallery-bold-duotone',
    description: 'Single-slot anime character & visual trait recognition tagger',
  },
  {
    id: 'Xenova/moondream2',
    name: 'Moondream2 Scene VLM',
    category: 'vision',
    runtime: 'Transformers.js',
    icon: 'i-solar:stars-bold-duotone',
    description: 'Compact 1.6B visual language model',
  },
  {
    id: 'jellybox/isnet-anime',
    name: 'Background Removal (IS-Net Anime)',
    category: 'vision',
    runtime: 'ONNX Web',
    icon: 'i-solar:magic-stick-bold-duotone',
    description: 'Anime-native foreground segmentation for stickers and artwork',
  },

  // 4. Miscellaneous & System 1 (Motion, Decisions, Embeddings)
  {
    id: 'tozp/laya-onnx',
    name: 'Laya 80M / ModernBERT (System 1 Decisions)',
    category: 'misc',
    runtime: 'ONNX Web / WASM',
    icon: 'i-solar:cpu-bolt-bold-duotone',
    description: 'Ultra-fast on-device System-1 decision & question triage model',
  },
  {
    id: 'dasilva333/flowmdm-onnx',
    name: 'FlowMDM Motion Denoiser',
    category: 'misc',
    runtime: 'WebGPU',
    icon: 'i-solar:running-bold-duotone',
    description: '100-step generative diffusion Text-to-VRMA gesture synthesizer',
  },
  {
    id: 'Xenova/clip-vit-base-patch32',
    name: 'CLIP Motion & Text Encoder',
    category: 'misc',
    runtime: 'Transformers.js',
    icon: 'i-solar:compass-bold-duotone',
    description: 'Semantic motion matching and attention ecology text embedder',
  },
]

const categories: { id: ModelCategory, label: string, icon: string }[] = [
  { id: 'all', label: 'All', icon: 'i-solar:widget-bold-duotone' },
  { id: 'installed', label: 'Installed', icon: 'i-solar:check-circle-bold-duotone' },
  { id: 'llm', label: 'LLMs', icon: 'i-solar:chat-round-line-bold-duotone' },
  { id: 'audio', label: 'Audio & Voice', icon: 'i-solar:volume-loud-bold-duotone' },
  { id: 'vision', label: 'Vision & Art', icon: 'i-solar:gallery-bold-duotone' },
  { id: 'misc', label: 'Misc', icon: 'i-solar:box-minimalistic-bold-duotone' },
]

const cachedModelMap = ref<ModelCacheStatusMap>({})

const categoryCounts = computed(() => {
  const counts: Record<ModelCategory, { total: number, cached: number }> = {
    all: { total: knownModels.length, cached: 0 },
    installed: { total: 0, cached: 0 },
    llm: { total: 0, cached: 0 },
    audio: { total: 0, cached: 0 },
    vision: { total: 0, cached: 0 },
    misc: { total: 0, cached: 0 },
  }

  for (const model of knownModels) {
    counts[model.category].total++
    if (cachedModelMap.value[model.id]?.cached) {
      counts[model.category].cached++
      counts.all.cached++
      counts.installed.cached++
      counts.installed.total++
    }
  }

  return counts
})

const filteredModels = computed(() => {
  if (selectedCategory.value === 'all')
    return knownModels
  if (selectedCategory.value === 'installed')
    return knownModels.filter(m => cachedModelMap.value[m.id]?.cached)
  return knownModels.filter(m => m.category === selectedCategory.value)
})

async function refresh() {
  loading.value = true
  try {
    const [size, map] = await Promise.all([
      getModelCacheSize(),
      getDetailedModelCacheMap(),
    ])
    cacheSize.value = size
    emit('change', cacheSize.value)
    cachedModelMap.value = map
  }
  finally {
    loading.value = false
  }
}

async function handleClearCache() {
  clearing.value = true
  try {
    await clearModelCache()
    await refresh()
  }
  finally {
    clearing.value = false
  }
}

async function handleClearSingleCache(modelId: string) {
  clearingModelId.value = modelId
  try {
    await clearSingleModelCache(modelId)
    await refresh()
  }
  finally {
    clearingModelId.value = null
  }
}

onMounted(refresh)
</script>

<template>
  <div
    :class="[
      'flex flex-col gap-3.5',
      'rounded-xl p-4',
      'border border-solid border-neutral-200 dark:border-neutral-800',
      'bg-white dark:bg-neutral-900 shadow-sm',
    ]"
  >
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2.5">
        <div class="h-8 w-8 flex items-center justify-center rounded-lg bg-sky-500/10 text-sky-500 dark:bg-sky-500/20">
          <div class="i-solar:server-square-bold-duotone text-lg" />
        </div>
        <div>
          <h3 class="m-0 text-sm text-gray-900 font-bold tracking-tight dark:text-gray-100">
            Model Cache Oversight
          </h3>
          <p class="m-0 text-xs text-neutral-500 dark:text-neutral-400">
            On-device neural weights stored across CoreML, OPFS, and CacheStorage
          </p>
        </div>
      </div>
      <div
        v-if="!loading"
        :class="[
          'rounded-full px-2.5 py-1',
          'text-xs font-semibold',
          cacheSize > 0
            ? 'bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400'
            : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400',
        ]"
      >
        {{ formatBytes(cacheSize) }} Total
      </div>
    </div>

    <!-- Segmented Category Filter Tabs -->
    <div class="flex flex-wrap items-center gap-1.5 border-y border-neutral-100 py-2 dark:border-neutral-800/80">
      <button
        v-for="cat in categories"
        :key="cat.id"
        class="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition active:scale-98"
        :class="[
          selectedCategory === cat.id
            ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs'
            : 'bg-neutral-100/80 text-neutral-600 hover:bg-neutral-200/60 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700',
        ]"
        @click="selectedCategory = cat.id"
      >
        <div :class="[cat.icon, 'text-xs']" />
        <span>{{ cat.label }}</span>
        <span
          class="ml-0.5 rounded-full px-1.5 py-0.2 text-[10px] font-bold"
          :class="[
            selectedCategory === cat.id
              ? 'bg-white/20 text-white dark:bg-neutral-900/20 dark:text-neutral-900'
              : (cat.id === 'installed' ? categoryCounts.installed.cached : categoryCounts[cat.id]?.cached) > 0
                ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                : 'bg-neutral-200 text-neutral-500 dark:bg-neutral-700 dark:text-neutral-400',
          ]"
        >
          {{ cat.id === 'installed' ? categoryCounts.installed.cached : (categoryCounts[cat.id]?.cached > 0 ? `${categoryCounts[cat.id]?.cached} / ${categoryCounts[cat.id]?.total}` : categoryCounts[cat.id]?.total) }}
        </span>
      </button>
    </div>

    <!-- Segmented Models List -->
    <div v-if="!loading" class="flex flex-col gap-1.5">
      <div
        v-for="model in filteredModels"
        :key="model.id"
        :class="[
          'flex items-center justify-between',
          'rounded-xl p-3 text-xs transition',
          'border border-neutral-100 dark:border-neutral-800/60',
          'bg-neutral-50/60 dark:bg-neutral-800/40 hover:bg-neutral-100/60 dark:hover:bg-neutral-800/70',
        ]"
      >
        <div class="flex items-center gap-2.5 truncate pr-2">
          <div
            class="h-7 w-7 flex shrink-0 items-center justify-center rounded-lg text-sm"
            :class="[
              cachedModelMap[model.id]?.cached
                ? 'bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/20'
                : 'bg-neutral-200/50 text-neutral-400 dark:bg-neutral-700/50',
            ]"
          >
            <div :class="model.icon" />
          </div>
          <div class="flex flex-col truncate">
            <div class="flex items-center gap-1.5 truncate">
              <span class="truncate text-gray-800 font-bold dark:text-neutral-200">
                {{ model.name }}
              </span>
              <span class="shrink-0 rounded-sm bg-neutral-200/60 px-1 py-0.2 text-[9px] text-neutral-600 font-semibold dark:bg-neutral-700 dark:text-neutral-300">
                {{ model.runtime }}
              </span>
            </div>
            <span v-if="model.description" class="truncate text-[10px] text-neutral-400 dark:text-neutral-500">
              {{ model.description }}
            </span>
          </div>
        </div>

        <div class="flex shrink-0 items-center gap-2">
          <span
            :class="[
              'rounded-full px-2 py-0.5 text-[10px] font-bold flex items-center gap-1',
              cachedModelMap[model.id]?.cached
                ? 'bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400'
                : 'bg-neutral-100 text-neutral-400 dark:bg-neutral-700/60 dark:text-neutral-400',
            ]"
          >
            <span v-if="cachedModelMap[model.id]?.cached && (cachedModelMap[model.id]?.sizeBytes ?? 0) > 0" class="text-[9px] font-mono opacity-80">
              {{ formatBytes(cachedModelMap[model.id]?.sizeBytes ?? 0) }} ·
            </span>
            <span>{{ cachedModelMap[model.id]?.cached ? 'Cached' : 'Not Cached' }}</span>
          </span>
          <Button
            v-if="cachedModelMap[model.id]?.cached"
            variant="danger"
            size="sm"
            icon="i-solar:trash-bin-trash-linear"
            :disabled="clearingModelId === model.id || clearing"
            :loading="clearingModelId === model.id"
            title="Delete this model from cache"
            @click="handleClearSingleCache(model.id)"
          />
        </div>
      </div>

      <div
        v-if="filteredModels.length === 0"
        class="flex flex-col items-center justify-center py-8 text-center text-neutral-400 dark:text-neutral-500"
      >
        <div class="i-solar:box-minimalistic-linear mb-1 text-xl opacity-60" />
        <span class="text-xs">No models found in this category</span>
      </div>
    </div>

    <!-- Loading state -->
    <div v-else class="flex items-center gap-2 py-4 text-xs text-neutral-500">
      <div class="i-svg-spinners:ring-resize text-sm" />
      <span>Checking on-device model caches...</span>
    </div>

    <!-- Bottom Actions -->
    <div class="mt-1 flex items-center justify-between pt-1">
      <Button
        variant="secondary-muted"
        size="sm"
        label="Refresh Cache"
        icon="i-solar:restart-bold"
        :disabled="loading"
        @click="refresh"
      />
      <Button
        v-if="cacheSize > 0"
        variant="danger"
        size="sm"
        :label="clearing ? 'Clearing...' : 'Clear All Models'"
        icon="i-solar:trash-bin-trash-bold"
        :disabled="clearing || loading || clearingModelId !== null"
        :loading="clearing"
        @click="handleClearCache"
      />
    </div>
  </div>
</template>
