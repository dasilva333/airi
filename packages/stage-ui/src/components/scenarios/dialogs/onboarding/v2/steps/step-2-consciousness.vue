<script setup lang="ts">
import type { ProviderMetadata } from '../../../../../../stores/providers'

import { computed, onBeforeUnmount, ref } from 'vue'

import StepProviderSelection from '../../step-provider-selection.vue'
import CompanionBubble from '../components/companion-bubble.vue'

import { WEB_LLM_MODELS } from '../../../../../../libs/inference/constants'
import { useProvidersStore } from '../../../../../../stores/providers'

// V2 onboarding scaffold — Step 2: Consciousness (Mind / LLM).
// Model cards are rendered from the real WEB_LLM_MODELS catalog (VRAM from
// `vramMB`); the download/compile progress is SIMULATED — no WebWorker RPCs.

defineProps<{
  onNext?: () => void
  onPrevious?: () => void
}>()

const RECOMMENDED_MODEL_ID = 'Qwen3.5-4B-q4f16_1-MLC'

const MODEL_ACCENTS: Record<string, { icon: string, text: string, badge: string }> = {
  'Qwen3.5-4B-q4f16_1-MLC': { icon: 'i-solar:star-bold-duotone', text: 'text-amber-500', badge: '⭐ RECOMMENDED' },
  'Qwen3.5-0.8B-q4f16_1-MLC': { icon: 'i-solar:bolt-bold-duotone', text: 'text-sky-500', badge: '⚡ FAST DISTILL' },
  'gemma3-1b-it-q4f16_1-MLC': { icon: 'i-solar:planet-bold-duotone', text: 'text-emerald-500', badge: '🌐 LOWEST VRAM' },
  'Ministral-3-3B-Reasoning-2512-q4f16_1-MLC': { icon: 'i-solar:lightbulb-bolt-bold-duotone', text: 'text-purple-500', badge: '🔬 REASONING' },
  'Phi-4-mini-instruct-q4f16_1-MLC': { icon: 'i-solar:brain-bold-duotone', text: 'text-rose-500', badge: '🧠 GENERALIST' },
}

function formatVram(vramMB: number) {
  return `~${(vramMB / 1024).toFixed(1)} GB VRAM`
}

// --- Simulated download/compile ---
const selectedModelId = ref('')
const downloadState = ref<'idle' | 'downloading' | 'ready'>('idle')
const downloadProgress = ref(0)
let downloadTimer: ReturnType<typeof setInterval> | undefined

function selectModel(id: string) {
  selectedModelId.value = id
  downloadState.value = 'downloading'
  downloadProgress.value = 0
  clearInterval(downloadTimer)
  downloadTimer = setInterval(() => {
    downloadProgress.value = Math.min(100, downloadProgress.value + Math.random() * 6)
    if (downloadProgress.value >= 100) {
      clearInterval(downloadTimer)
      downloadState.value = 'ready'
    }
  }, 160)
}

onBeforeUnmount(() => clearInterval(downloadTimer))

// --- Preserved V1 provider grid (read-only metadata for mockup) ---
const providersStore = useProvidersStore()
const availableProviders = computed<ProviderMetadata[]>(() => providersStore.allChatProvidersMetadata)
const selectedProviderId = ref('')

function selectProvider(provider: ProviderMetadata) {
  selectedProviderId.value = provider.id
}
</script>

<template>
  <div class="h-full flex flex-col gap-4 overflow-hidden">
    <div class="flex-shrink-0">
      <h2 class="text-xl text-neutral-800 font-semibold md:text-2xl dark:text-neutral-100">
        Consciousness
      </h2>
      <p class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
        Give AIRI a brain first — the AI character creators on later steps borrow it.
      </p>
    </div>

    <CompanionBubble
      class="flex-shrink-0"
      message="WebLLM is pre-configured to run 100% locally on WebGPU. Pick a model size your GPU can handle — it'll download and compile right here before we move on!"
    />

    <div class="min-h-0 flex flex-1 flex-col gap-4 overflow-y-auto pr-1">
      <!-- WebLLM local hero cards -->
      <div class="flex flex-col gap-2">
        <button
          v-for="model in WEB_LLM_MODELS"
          :key="model.id"
          :class="[
            'relative flex items-center gap-3 border-2 rounded-xl p-3.5 text-left transition-all duration-300',
            selectedModelId === model.id
              ? 'border-primary-500 bg-primary-500/5 shadow-lg shadow-primary-500/10 dark:border-primary-400'
              : 'border-neutral-200/60 bg-white/40 dark:border-neutral-800/80 dark:bg-neutral-900/40 hover:border-primary-500/50',
          ]"
          @click="selectModel(model.id)"
        >
          <div
            class="h-10 w-10 flex flex-shrink-0 items-center justify-center rounded-xl"
            :class="[selectedModelId === model.id ? 'bg-primary-500/15' : 'bg-neutral-100 dark:bg-neutral-800']"
          >
            <div
              class="h-6 w-6"
              :class="[MODEL_ACCENTS[model.id]?.icon || 'i-solar:cpu-bolt-bold-duotone', MODEL_ACCENTS[model.id]?.text || 'text-neutral-500']"
            />
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-sm text-neutral-800 font-bold dark:text-neutral-100">{{ model.name }}</span>
              <span
                v-if="model.id === RECOMMENDED_MODEL_ID"
                class="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-600 font-bold dark:text-amber-400"
              >
                {{ MODEL_ACCENTS[model.id].badge }}
              </span>
            </div>
            <p class="mt-0.5 truncate text-xs text-neutral-500 dark:text-neutral-400">
              {{ model.description }}
            </p>
          </div>
          <span class="flex-shrink-0 rounded-md bg-neutral-100 px-2 py-1 text-[10px] text-neutral-600 font-bold font-mono dark:bg-neutral-800 dark:text-neutral-300">
            {{ formatVram(model.vramMB) }}
          </span>
        </button>
      </div>

      <!-- Simulated WebGPU download/compile verification -->
      <div
        v-if="downloadState !== 'idle'"
        :class="['p-4 rounded-xl', 'bg-white/40 dark:bg-neutral-900/40', 'border border-neutral-200/60 dark:border-neutral-800/80', 'backdrop-blur-md', 'flex flex-col gap-2']"
      >
        <div class="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
          <span>{{ downloadState === 'ready' ? 'WebGPU shards cached & compiled' : 'Downloading weight shards & compiling…' }}</span>
          <span>{{ Math.floor(downloadProgress) }}%</span>
        </div>
        <div class="h-2.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
          <div
            class="h-full rounded-full from-primary-500 to-indigo-500 bg-gradient-to-r transition-all duration-150"
            :style="{ width: `${downloadProgress}%` }"
          />
        </div>
        <div v-if="downloadState === 'ready'" class="flex items-center gap-1.5 text-xs text-emerald-600 font-bold dark:text-emerald-400">
          <div class="i-solar:check-circle-bold-duotone h-4 w-4" />
          Brain verified — ready to think!
        </div>
      </div>

      <!-- Preserved V1 cloud/local provider directory -->
      <div class="min-h-[26rem] flex flex-1 flex-col border-t border-neutral-200/60 pt-3 dark:border-neutral-800/80">
        <span class="mb-2 px-1 text-xs text-neutral-400 font-bold tracking-wider uppercase dark:text-neutral-500">
          Or pick a cloud / custom provider
        </span>
        <StepProviderSelection
          class="min-h-0 flex-1"
          :available-providers="availableProviders"
          :selected-provider-id="selectedProviderId"
          :on-select-provider="selectProvider"
          :on-next="() => onNext?.()"
          :on-previous="() => onPrevious?.()"
        />
      </div>
    </div>
  </div>
</template>
