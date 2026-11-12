<script setup lang="ts">
import { useElectronEventaInvoke } from '@proj-airi/electron-vueuse'
import { estimateTokens } from '@proj-airi/stage-shared'
import { useSpeakingStore } from '@proj-airi/stage-ui/stores/audio'
import { useChatOrchestratorStore } from '@proj-airi/stage-ui/stores/chat'
import { useChatSessionStore } from '@proj-airi/stage-ui/stores/chat/session-store'
import { useConsciousnessStore } from '@proj-airi/stage-ui/stores/modules/consciousness'
import { useLiveSessionStore } from '@proj-airi/stage-ui/stores/modules/live-session'
import { useSpeechStore } from '@proj-airi/stage-ui/stores/modules/speech'
import { useSystemOneStore } from '@proj-airi/stage-ui/stores/modules/system-one'
import { useVisionStore } from '@proj-airi/stage-ui/stores/modules/vision'
import { useSettingsControlStrip } from '@proj-airi/stage-ui/stores/settings'
import { onClickOutside, useBroadcastChannel, useIntervalFn, useLocalStorage } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, ref, useTemplateRef, watch } from 'vue'

import { chatSessionsRepo } from '../../../../../../packages/stage-ui/src/database/repos/chat-sessions.repo'
import { electronCustomizerToggleVisibility } from '../../../shared/eventa'

const toggleCustomizerRpc = useElectronEventaInvoke(electronCustomizerToggleVisibility)

const consciousnessStore = useConsciousnessStore()
const chatSessionStore = useChatSessionStore()
const chatOrchestrator = useChatOrchestratorStore()
const liveSessionStore = useLiveSessionStore()
const systemOneStore = useSystemOneStore()
const controlStripStore = useSettingsControlStrip()
const speechStore = useSpeechStore()
const speakingStore = useSpeakingStore()
const visionStore = useVisionStore()

const isVoiceMuted = useLocalStorage('airi:audio:voice-muted', false)

interface SpeakingStateSignal {
  nowSpeaking?: boolean
  mouthOpenSize?: number
  intentActive?: boolean
}
const { data: speakingData } = useBroadcastChannel<SpeakingStateSignal, SpeakingStateSignal>({
  name: 'airi:speaking-state',
})
const isSpeaking = computed(() => Boolean(speakingStore.nowSpeaking || speakingData.value?.nowSpeaking))

// RAM & GPU Metrics
const appRamMb = ref(0)
function updateRam() {
  if (typeof window !== 'undefined' && (window.performance as any)?.memory?.usedJSHeapSize) {
    appRamMb.value = Math.round((window.performance as any).memory.usedJSHeapSize / (1024 * 1024))
  }
  else {
    appRamMb.value = 148
  }
}
updateRam()
useIntervalFn(updateRam, 5000)

const gpuEngineLabel = computed(() => {
  if (typeof navigator !== 'undefined' && 'gpu' in navigator && Boolean(navigator.gpu))
    return 'WebGPU'
  return 'WebGL'
})

// Stage Renderer status
const stageRendererStatus = computed(() => {
  if (controlStripStore.stageMateEnabled) {
    return {
      label: 'Stage Mate',
      colorClass: 'bg-cyan-500',
      textClass: 'text-cyan-600 dark:text-cyan-400',
      pulse: false,
    }
  }
  if (!controlStripStore.stageEnabled) {
    return {
      label: 'Off',
      colorClass: 'bg-neutral-400 dark:bg-neutral-600',
      textClass: 'text-neutral-500 dark:text-neutral-400',
      pulse: false,
    }
  }
  if (isSpeaking.value || chatOrchestrator.sending) {
    return {
      label: 'Active',
      colorClass: 'bg-emerald-500',
      textClass: 'text-emerald-600 dark:text-emerald-400',
      pulse: true,
    }
  }
  return {
    label: 'Idle',
    colorClass: 'bg-emerald-500',
    textClass: 'text-emerald-600 dark:text-emerald-400',
    pulse: false,
  }
})

// Voice / TTS status
const voiceTtsStatus = computed(() => {
  if (!speechStore.configured) {
    return {
      label: 'Not Configured',
      colorClass: 'bg-neutral-400 dark:bg-neutral-600',
      textClass: 'text-neutral-500 dark:text-neutral-400',
      pulse: false,
    }
  }
  if (isVoiceMuted.value) {
    return {
      label: 'Muted',
      colorClass: 'bg-amber-400',
      textClass: 'text-amber-600 dark:text-amber-400',
      pulse: false,
    }
  }
  if (isSpeaking.value) {
    return {
      label: 'Speaking',
      colorClass: 'bg-emerald-400',
      textClass: 'text-emerald-600 dark:text-emerald-400',
      pulse: true,
    }
  }
  return {
    label: 'Ready',
    colorClass: 'bg-emerald-500',
    textClass: 'text-emerald-600 dark:text-emerald-400',
    pulse: false,
  }
})

// Vision (Capture) status
const visionStatus = computed(() => {
  if (!visionStore.isWitnessEnabled) {
    return {
      label: 'Off',
      colorClass: 'bg-neutral-400 dark:bg-neutral-600',
      textClass: 'text-neutral-500 dark:text-neutral-400',
      pulse: false,
    }
  }
  if (visionStore.status === 'capturing') {
    return {
      label: 'Capturing',
      colorClass: 'bg-cyan-500',
      textClass: 'text-cyan-600 dark:text-cyan-400',
      pulse: true,
    }
  }
  return {
    label: 'On',
    colorClass: 'bg-emerald-500',
    textClass: 'text-emerald-600 dark:text-emerald-400',
    pulse: false,
  }
})

const { messages } = storeToRefs(chatSessionStore)
const { activeModel, providerModels } = storeToRefs(consciousnessStore)

// Model Dropdown
const isModelDropdownOpen = ref(false)
const modelDropdownRef = useTemplateRef<HTMLElement>('modelDropdownRef')
onClickOutside(modelDropdownRef, () => {
  isModelDropdownOpen.value = false
})

const activeModelLabel = computed(() => {
  return activeModel.value || 'Gemini 2.5 Pro'
})

const availableModels = computed(() => {
  if (providerModels.value && providerModels.value.length > 0)
    return providerModels.value
  return [
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
    { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet' },
    { id: 'deepseek-chat', name: 'DeepSeek Chat' },
  ]
})

function selectModel(modelId: string) {
  consciousnessStore.activeModel = modelId
  isModelDropdownOpen.value = false
}

// Context Usage calculation
const sessionTokens = computed(() => {
  return (messages.value || []).reduce((sum, msg: any) => {
    if (typeof msg.content === 'string')
      return sum + estimateTokens(msg.content)
    if (Array.isArray(msg.content)) {
      const textOnly = msg.content
        .map((part: any) => (typeof part === 'string' ? part : part?.text || ''))
        .join('')
      return sum + estimateTokens(textOnly)
    }
    return sum
  }, 0)
})

const maxContextTokens = computed(() => {
  const model = (activeModel.value || '').toLowerCase()
  if (model.includes('gemini-1.5') || model.includes('gemini-2'))
    return 1000000
  if (model.includes('claude'))
    return 200000
  if (model.includes('gpt-4'))
    return 128000
  if (model.includes('deepseek'))
    return 64000
  return 1000000
})

const contextPercent = computed(() => {
  if (!maxContextTokens.value)
    return 0
  const pct = (sessionTokens.value / maxContextTokens.value) * 100
  return Math.min(100, Math.max(0.1, Math.round(pct * 10) / 10))
})

// Historical Tokens Range Selector
const selectedRange = ref<'today' | 'yesterday' | 'last_week' | 'last_month'>('last_week')
const rangeLabels: Record<string, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  last_week: 'Last Week',
  last_month: 'Last Month',
}

const rangeTokens = ref<number | null>(null)
const isRangeLoading = ref(false)
const isRangeDropdownOpen = ref(false)
const rangeDropdownRef = useTemplateRef<HTMLElement>('rangeDropdownRef')
onClickOutside(rangeDropdownRef, () => {
  isRangeDropdownOpen.value = false
})

async function calculateRangeTokens() {
  if (isRangeLoading.value)
    return
  isRangeLoading.value = true
  try {
    const index = await chatSessionsRepo.getIndex('local')
    const sessionIds: string[] = []
    if (index && index.characters) {
      for (const charId of Object.keys(index.characters)) {
        const charSessions = index.characters[charId]
        if (charSessions?.sessions) {
          for (const sid of Object.keys(charSessions.sessions)) {
            sessionIds.push(sid)
          }
        }
      }
    }

    const now = new Date()
    let startLimit = 0
    let endLimit = now.getTime()
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)

    if (selectedRange.value === 'today') {
      startLimit = todayMidnight.getTime()
    }
    else if (selectedRange.value === 'yesterday') {
      const yesterdayMidnight = new Date(todayMidnight.getTime() - 24 * 3600 * 1000)
      startLimit = yesterdayMidnight.getTime()
      endLimit = todayMidnight.getTime() - 1
    }
    else if (selectedRange.value === 'last_week') {
      startLimit = todayMidnight.getTime() - 7 * 24 * 3600 * 1000
    }
    else if (selectedRange.value === 'last_month') {
      startLimit = todayMidnight.getTime() - 30 * 24 * 3600 * 1000
    }

    let total = 0
    const BATCH_SIZE = 10
    for (let i = 0; i < sessionIds.length; i += BATCH_SIZE) {
      const batch = sessionIds.slice(i, i + BATCH_SIZE)
      const records = await Promise.all(batch.map(sid => chatSessionsRepo.getSession(sid)))
      for (const session of records) {
        if (!session?.messages || !Array.isArray(session.messages))
          continue
        for (const msg of session.messages) {
          const msgTime = msg.createdAt || session.meta?.createdAt
          if (!msgTime || msgTime < startLimit || msgTime > endLimit)
            continue
          if (typeof msg.content === 'string') {
            total += estimateTokens(msg.content)
          }
          else if (Array.isArray(msg.content)) {
            const textOnly = msg.content
              .map((part: any) => (typeof part === 'string' ? part : part?.text || ''))
              .join('')
            total += estimateTokens(textOnly)
          }
        }
      }
    }
    rangeTokens.value = total
  }
  catch {
    // Graceful fallback
  }
  finally {
    isRangeLoading.value = false
  }
}

watch(selectedRange, () => {
  void calculateRangeTokens()
}, { immediate: true })

function selectRange(range: 'today' | 'yesterday' | 'last_week' | 'last_month') {
  selectedRange.value = range
  isRangeDropdownOpen.value = false
}

function openCustomizerStats() {
  void toggleCustomizerRpc({ enabled: true, group: 'stats' })
}
</script>

<template>
  <div class="h-full flex flex-col space-y-3">
    <!-- Two Column Dashboard Grid -->
    <div class="grid grid-cols-2 gap-2.5">
      <!-- Left Column: Model & Tokens -->
      <div
        :class="[
          'p-3 rounded-2xl border',
          'bg-neutral-50/80 dark:bg-neutral-900/60',
          'border-neutral-200/80 dark:border-neutral-800/80',
          'flex flex-col space-y-2.5',
        ]"
      >
        <div class="flex items-center gap-1 text-[11px] text-neutral-800 font-bold dark:text-neutral-100">
          <div class="i-solar:layers-minimalistic-bold text-primary-500" />
          Model & Tokens
        </div>

        <!-- Model dropdown button -->
        <div ref="modelDropdownRef" class="relative">
          <button
            type="button"
            :class="[
              'w-full px-2 py-1.5 rounded-xl border text-left',
              'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700',
              'text-[11px] font-semibold text-neutral-800 dark:text-neutral-100',
              'flex items-center justify-between shadow-sm cursor-pointer',
            ]"
            @click="isModelDropdownOpen = !isModelDropdownOpen"
          >
            <span class="flex items-center gap-1.5 truncate">
              <div class="i-solar:stars-bold flex-shrink-0 text-xs text-cyan-500" />
              <span class="truncate">{{ activeModelLabel }}</span>
            </span>
            <div class="i-solar:alt-arrow-down-linear text-xs text-neutral-400" />
          </button>

          <!-- Model options dropdown menu -->
          <div
            v-if="isModelDropdownOpen"
            class="absolute left-0 top-full z-50 mt-1 max-h-48 w-full flex flex-col overflow-y-auto border border-neutral-200 rounded-xl bg-white py-1 shadow-xl dark:border-neutral-700 dark:bg-neutral-800"
          >
            <button
              v-for="model in availableModels"
              :key="model.id"
              type="button"
              :class="[
                'px-2.5 py-1.5 text-[11px] text-left cursor-pointer transition flex items-center justify-between truncate',
                consciousnessStore.activeModel === model.id
                  ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950/40 font-bold'
                  : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700/60',
              ]"
              @click="selectModel(model.id)"
            >
              <span class="truncate">{{ model.name || model.id }}</span>
              <div v-if="consciousnessStore.activeModel === model.id" class="i-solar:check-read-linear ml-1 shrink-0 text-xs text-primary-500" />
            </button>
          </div>
        </div>

        <!-- Context Usage Bar -->
        <div class="space-y-1">
          <div class="flex items-center justify-between text-[10px]">
            <span class="text-neutral-500 dark:text-neutral-400">Context Usage</span>
            <span class="text-primary-600 font-bold font-mono dark:text-primary-400">{{ contextPercent }}%</span>
          </div>
          <div class="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200/80 dark:bg-neutral-800">
            <div
              class="h-full rounded-full bg-primary-500 transition-all duration-300"
              :style="{ width: `${contextPercent}%` }"
            />
          </div>
          <div class="text-right text-[9px] text-neutral-400 font-mono">
            {{ sessionTokens.toLocaleString() }} / {{ maxContextTokens.toLocaleString() }}
          </div>
        </div>

        <!-- Voice & System-1 Metrics -->
        <div class="border-t border-neutral-200/60 pt-1 text-[10px] space-y-1.5 dark:border-neutral-800/60">
          <div class="flex items-center justify-between">
            <span class="flex items-center gap-1 text-neutral-500 dark:text-neutral-400">
              <span class="h-1.5 w-1.5 rounded-full bg-cyan-400" />
              Voice Tokens
            </span>
            <span class="text-neutral-700 font-semibold font-mono dark:text-neutral-300">
              {{ Number(liveSessionStore.voiceTokens || 0).toLocaleString() }}
            </span>
          </div>
          <div class="flex items-center justify-between">
            <span class="flex items-center gap-1 text-neutral-500 dark:text-neutral-400">
              <span class="h-1.5 w-1.5 rounded-full bg-purple-400" />
              System-1 Tokens
            </span>
            <span class="text-neutral-700 font-semibold font-mono dark:text-neutral-300">
              {{ Number(systemOneStore.systemOneCloudTokens || 0).toLocaleString() }}
            </span>
          </div>
        </div>

        <!-- Time Range Selector & Historical Tokens -->
        <div ref="rangeDropdownRef" class="relative mt-auto pt-1">
          <button
            type="button"
            :class="[
              'w-full px-2 py-1 rounded-lg border text-left',
              'bg-neutral-100/70 dark:bg-neutral-800/70 border-neutral-200/80 dark:border-neutral-700/80',
              'text-[10px] text-neutral-600 dark:text-neutral-300',
              'flex items-center justify-between cursor-pointer',
            ]"
            @click="isRangeDropdownOpen = !isRangeDropdownOpen"
          >
            <span>Range: <strong class="text-neutral-900 dark:text-neutral-100">{{ rangeLabels[selectedRange] }}</strong></span>
            <div class="i-solar:alt-arrow-down-linear text-[10px] text-neutral-400" />
          </button>

          <!-- Range Dropdown -->
          <div
            v-if="isRangeDropdownOpen"
            class="absolute bottom-full left-0 z-50 mb-1 w-full flex flex-col border border-neutral-200 rounded-xl bg-white py-1 shadow-xl dark:border-neutral-700 dark:bg-neutral-800"
          >
            <button
              v-for="r in (['today', 'yesterday', 'last_week', 'last_month'] as const)"
              :key="r"
              type="button"
              :class="[
                'px-2.5 py-1 text-[10px] text-left cursor-pointer transition flex items-center justify-between',
                selectedRange === r
                  ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950/40 font-bold'
                  : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700/60',
              ]"
              @click="selectRange(r)"
            >
              <span>{{ rangeLabels[r] }}</span>
              <div v-if="selectedRange === r" class="i-solar:check-read-linear text-[10px] text-primary-500" />
            </button>
          </div>

          <div class="mt-1 text-center text-[9px] text-neutral-400 font-mono">
            <span v-if="isRangeLoading" class="i-svg-spinners:ring-resize mr-1 inline-block text-[8px]" />
            <span>{{ rangeTokens !== null ? `${rangeTokens.toLocaleString()} tokens` : 'Loading...' }}</span>
          </div>
        </div>
      </div>

      <!-- Right Column: Runtime & Health -->
      <div
        :class="[
          'p-3 rounded-2xl border',
          'bg-neutral-50/80 dark:bg-neutral-900/60',
          'border-neutral-200/80 dark:border-neutral-800/80',
          'flex flex-col space-y-2.5',
        ]"
      >
        <div class="flex items-center gap-1 text-[11px] text-neutral-800 font-bold dark:text-neutral-100">
          <div class="i-solar:heart-pulse-bold text-primary-500" />
          Runtime & Health
        </div>

        <!-- Hardware & Resource Specs -->
        <div class="text-[10px] space-y-2">
          <div class="flex items-center justify-between">
            <span class="flex items-center gap-1 text-neutral-500 dark:text-neutral-400">
              <div class="i-solar:cpu-bolt-bold text-xs text-neutral-400" />
              GPU Engine
            </span>
            <span class="text-neutral-700 font-semibold font-mono dark:text-neutral-200">
              {{ gpuEngineLabel }}
            </span>
          </div>

          <div class="flex items-center justify-between">
            <span class="flex items-center gap-1 text-neutral-500 dark:text-neutral-400">
              <div class="i-solar:server-square-bold text-xs text-neutral-400" />
              RAM (App)
            </span>
            <span class="text-neutral-700 font-semibold font-mono dark:text-neutral-200">
              {{ appRamMb }} MB
            </span>
          </div>
        </div>

        <!-- Service Indicators -->
        <div class="border-t border-neutral-200/60 pt-2 text-[10px] space-y-1.5 dark:border-neutral-800/60">
          <div class="flex items-center justify-between">
            <span class="text-neutral-500 dark:text-neutral-400">Stage Renderer</span>
            <span :class="['flex items-center gap-1 text-[9px] font-medium font-mono', stageRendererStatus.textClass]">
              <span
                :class="[
                  'h-1.5 w-1.5 rounded-full',
                  stageRendererStatus.colorClass,
                  stageRendererStatus.pulse ? 'animate-pulse' : '',
                ]"
              />
              {{ stageRendererStatus.label }}
            </span>
          </div>

          <div class="flex items-center justify-between">
            <span class="text-neutral-500 dark:text-neutral-400">Voice / TTS</span>
            <span :class="['flex items-center gap-1 text-[9px] font-medium font-mono', voiceTtsStatus.textClass]">
              <span
                :class="[
                  'h-1.5 w-1.5 rounded-full',
                  voiceTtsStatus.colorClass,
                  voiceTtsStatus.pulse ? 'animate-pulse' : '',
                ]"
              />
              {{ voiceTtsStatus.label }}
            </span>
          </div>

          <div class="flex items-center justify-between">
            <span class="text-neutral-500 dark:text-neutral-400">Vision (Capture)</span>
            <span :class="['flex items-center gap-1 text-[9px] font-medium font-mono', visionStatus.textClass]">
              <span
                :class="[
                  'h-1.5 w-1.5 rounded-full',
                  visionStatus.colorClass,
                  visionStatus.pulse ? 'animate-pulse' : '',
                ]"
              />
              {{ visionStatus.label }}
            </span>
          </div>
        </div>

        <!-- Bottom Action: Generate Report -->
        <div class="mt-auto pt-1">
          <button
            type="button"
            :class="[
              'w-full py-1.5 rounded-xl text-[10px] font-bold text-center',
              'bg-primary-500/10 hover:bg-primary-500/20 text-primary-600 dark:text-primary-400',
              'border border-primary-500/20 transition cursor-pointer',
              'flex items-center justify-center gap-1',
            ]"
            @click="openCustomizerStats"
          >
            <div class="i-solar:document-text-bold text-xs" />
            Generate Report
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
