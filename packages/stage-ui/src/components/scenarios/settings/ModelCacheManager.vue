<script setup lang="ts">
import { Button } from '@proj-airi/ui'
import { onMounted, ref } from 'vue'

import { clearModelCache, DEFAULT_WEB_RWKV_MODEL, formatBytes, getModelCacheSize, isModelCached } from '../../../libs/inference'

const cacheSize = ref(0)
const loading = ref(true)
const clearing = ref(false)

// Known model IDs to check cache status
const knownModels = [
  { id: DEFAULT_WEB_RWKV_MODEL, name: 'RWKV LLM' },
  { id: 'web-llm', name: 'WebLLM (Ministral 3 / Qwen 3.5 / Llama 3.2)' },
  { id: 'onnx-community/Kokoro-82M-v1.0-ONNX', name: 'Kokoro TTS' },
  { id: 'onnx-community/whisper-large-v3-turbo', name: 'Whisper ASR' },
  { id: 'Xenova/modnet', name: 'Background Removal' },
  { id: 'onnx-community/blip-image-captioning-base', name: 'BLIP Vision' },
  { id: 'SmilingWolf/wd-v1-4-swinv2-tagger-v2', name: 'WD14 SwinV2 Tagger' },
  { id: 'SmilingWolf/wd-v1-4-vit-tagger-v2', name: 'WD14 ViT Tagger' },
  { id: 'onnx-community/blip2-opt-2.7b', name: 'BLIP-2 Vision' },
  { id: 'moss-tts-nano', name: 'MOSS TTS (Nano)' },
  { id: 'Xenova/clip-vit-base-patch32', name: 'CLIP Text Encoder (Motion)' },
  { id: 'dasilva333/flowmdm-onnx', name: 'FlowMDM Denoiser (WebGPU)' },
]

const cachedModels = ref<{ id: string, name: string, cached: boolean }[]>([])

async function refresh() {
  loading.value = true
  try {
    cacheSize.value = await getModelCacheSize()
    cachedModels.value = await Promise.all(
      knownModels.map(async m => ({
        ...m,
        cached: await isModelCached(m.id),
      })),
    )
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

onMounted(refresh)
</script>

<template>
  <div
    :class="[
      'flex flex-col gap-3',
      'rounded-lg p-4',
      'border border-solid border-neutral-200 dark:border-neutral-700',
    ]"
  >
    <div flex items-center justify-between>
      <div>
        <h3 m-0 text-sm font-medium>
          Model Cache
        </h3>
        <p m-0 text-xs text-neutral-500>
          Downloaded inference models stored in browser cache
        </p>
      </div>
      <div
        v-if="!loading"
        :class="[
          'rounded-full px-2 py-1',
          'text-xs font-medium',
          'bg-neutral-100 text-neutral-600',
          'dark:bg-neutral-800 dark:text-neutral-400',
        ]"
      >
        {{ formatBytes(cacheSize) }}
      </div>
    </div>

    <!-- Cached models list -->
    <div v-if="!loading" flex flex-col gap-1>
      <div
        v-for="model in cachedModels"
        :key="model.id"
        :class="[
          'flex items-center justify-between',
          'rounded px-3 py-2 text-sm',
          'bg-neutral-50 dark:bg-neutral-800/50',
        ]"
      >
        <span>{{ model.name }}</span>
        <span
          :class="[
            'rounded-full px-2 py-0.5 text-xs',
            model.cached
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400'
              : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-700 dark:text-neutral-400',
          ]"
        >
          {{ model.cached ? 'Cached' : 'Not cached' }}
        </span>
      </div>
    </div>

    <!-- Loading state -->
    <div v-else flex items-center gap-2 py-2 text-sm text-neutral-500>
      <div i-svg-spinners:ring-resize />
      <span>Checking cache...</span>
    </div>

    <!-- Actions -->
    <div flex items-center justify-between>
      <Button
        variant="secondary-muted"
        size="sm"
        label="Refresh"
        icon="i-solar:refresh-linear"
        :disabled="loading"
        @click="refresh"
      />
      <Button
        v-if="cacheSize > 0"
        variant="danger"
        size="sm"
        :label="clearing ? 'Clearing...' : 'Clear All Cache'"
        icon="i-solar:trash-bin-trash-bold"
        :disabled="clearing || loading"
        :loading="clearing"
        @click="handleClearCache"
      />
    </div>
  </div>
</template>
