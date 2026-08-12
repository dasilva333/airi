<script setup lang="ts">
import { ref, watch } from 'vue'

import CompanionBubble from '../components/companion-bubble.vue'

import { useOnboardingV2Draft } from '../draft-store'

// V2 onboarding — Step 6: Contextual Speech (TTS).

const draftStore = useOnboardingV2Draft()
type EngineId = 'kokoro' | 'pocket' | 'moss'

const selectedEngine = ref<EngineId>((draftStore.state.speech.provider as EngineId) || 'kokoro')
const expandedCloud = ref('')

if (!draftStore.state.speech.provider) {
  draftStore.setSpeech({ provider: selectedEngine.value })
}

watch(selectedEngine, (val) => {
  draftStore.setSpeech({ provider: val })
})

const engines = [
  {
    id: 'kokoro' as const,
    name: 'Kokoro Local WebGPU',
    icon: 'i-solar:speaker-loud-bold-duotone',
    accent: 'text-primary-500',
    tag: 'RECOMMENDED',
    desc: 'High-performance local neural TTS with multilingual voices.',
    badges: ['🇺🇸 EN', '🇯🇵 JP', '🇨🇳 ZH', '🇪🇸 ES', '🇫🇷 FR'],
  },
  {
    id: 'pocket' as const,
    name: 'Pocket-TTS Local',
    icon: 'i-solar:server-minimalistic-bold-duotone',
    accent: 'text-emerald-500',
    tag: 'CPU · VOICE CLONING',
    desc: 'Low-latency 0.1B multilingual CPU engine — the local pick when WebGPU is unavailable.',
    badges: ['🇺🇸 EN', '🇫🇷 FR', '🇪🇸 ES', '🇩🇪 DE', '🇵🇹 PT', '🇮🇹 IT'],
  },
  {
    id: 'moss' as const,
    name: 'Moss-Nano Local',
    icon: 'i-solar:bolt-bold-duotone',
    accent: 'text-amber-500',
    tag: 'ULTRA-FAST',
    desc: 'Tiny low-resource voice for instant feedback on modest hardware.',
    badges: ['⚡ FAST LOCAL'],
  },
]

const cloudProviders = ['ElevenLabs', 'OpenAI Audio', 'Deepgram Aura', 'Azure Speech', 'Fish Speech']
</script>

<template>
  <div class="h-full flex flex-col gap-4 overflow-hidden">
    <div class="flex-shrink-0">
      <h2 class="text-xl text-neutral-800 font-semibold md:text-2xl dark:text-neutral-100">
        Her Voice
      </h2>
      <p class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
        Match the voice to the body & soul — not the other way around.
      </p>
    </div>

    <CompanionBubble
      class="flex-shrink-0"
      message="Choose how your companion will sound! Built-in local voices start instantly — you can connect 10+ cloud voice providers in settings later. Pinky promise!"
    />

    <div class="min-h-0 flex flex-1 flex-col gap-3 overflow-y-auto pr-1">
      <!-- Local TTS hero cards -->
      <div class="grid grid-cols-1 gap-3">
        <button
          v-for="engine in engines"
          :key="engine.id"
          :class="[
            'flex items-center gap-3 border-2 rounded-xl p-4 text-left transition-all duration-300',
            selectedEngine === engine.id
              ? 'border-primary-500 bg-primary-500/5 shadow-lg shadow-primary-500/10 dark:border-primary-400'
              : 'border-neutral-200/60 bg-white/40 dark:border-neutral-800/80 dark:bg-neutral-900/40 hover:border-primary-500/50',
          ]"
          @click="selectedEngine = engine.id"
        >
          <div
            class="h-11 w-11 flex flex-shrink-0 items-center justify-center rounded-xl"
            :class="[selectedEngine === engine.id ? 'bg-primary-500/15' : 'bg-neutral-100 dark:bg-neutral-800']"
          >
            <div class="h-6 w-6" :class="[engine.icon, engine.accent]" />
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-sm text-neutral-800 font-bold dark:text-neutral-100">{{ engine.name }}</span>
              <span class="rounded-full bg-neutral-100 px-2 py-0.5 text-[9px] text-neutral-500 font-bold dark:bg-neutral-800 dark:text-neutral-400">{{ engine.tag }}</span>
            </div>
            <p class="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
              {{ engine.desc }}
            </p>
            <div class="mt-1.5 flex flex-wrap gap-1">
              <span
                v-for="badge in engine.badges"
                :key="badge"
                class="rounded-md bg-neutral-100 px-1.5 py-0.5 text-[9px] text-neutral-600 font-semibold dark:bg-neutral-800 dark:text-neutral-300"
              >
                {{ badge }}
              </span>
            </div>
          </div>
          <div
            class="h-5 w-5 flex flex-shrink-0 items-center justify-center border-2 rounded-full"
            :class="selectedEngine === engine.id ? 'border-primary-500 dark:border-primary-400' : 'border-neutral-300 dark:border-neutral-600'"
          >
            <div v-if="selectedEngine === engine.id" class="h-2.5 w-2.5 rounded-full bg-primary-500 dark:bg-primary-400" />
          </div>
        </button>
      </div>

      <!-- Inline cloud directory -->
      <div class="border-t border-neutral-200/60 pt-3 dark:border-neutral-800/80">
        <span class="mb-2 block px-1 text-xs text-neutral-400 font-bold tracking-wider uppercase dark:text-neutral-500">
          Cloud Voice Directory
        </span>
        <div class="flex flex-col gap-1.5 pb-2">
          <div v-for="provider in cloudProviders" :key="provider" class="flex flex-col">
            <button
              :class="[
                'flex items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
                expandedCloud === provider
                  ? 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-100'
                  : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800/60',
              ]"
              @click="expandedCloud = expandedCloud === provider ? '' : provider"
            >
              <div class="i-solar:cloud-bold-duotone h-4 w-4 text-sky-500" />
              <span class="flex-1 font-medium">{{ provider }}</span>
              <div
                class="i-solar:alt-arrow-down-linear h-4 w-4 transition-transform"
                :class="{ 'rotate-180': expandedCloud === provider }"
              />
            </button>
            <div v-if="expandedCloud === provider" class="flex gap-2 px-3 pb-2 pt-1">
              <input
                type="password"
                placeholder="API Key (mock)"
                class="flex-1 border border-neutral-200 rounded-lg bg-white px-3 py-1.5 text-xs outline-none dark:border-neutral-700 focus:border-primary-500 dark:bg-neutral-900 dark:text-neutral-200"
              >
              <input
                type="text"
                placeholder="Voice ID (mock)"
                class="flex-1 border border-neutral-200 rounded-lg bg-white px-3 py-1.5 text-xs outline-none dark:border-neutral-700 focus:border-primary-500 dark:bg-neutral-900 dark:text-neutral-200"
              >
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
