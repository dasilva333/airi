<script setup lang="ts">
/**
 * Voice Switch popover — Gemini Live voice names, or the three-layer native TTS
 * registry (global favourites → character-scoped cast → provider/model/voice).
 *
 * Self-serving: owns the speech/providers/live-session stores and the favourite
 * bookkeeping it reads. Favourites are capped at 3 with FIFO eviction and stored
 * under the same key as before.
 */
import { useLocalStorage } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'

import StripPopover from '../StripPopover.vue'

import { cardInitialColor, GEMINI_LIVE_VOICES } from '../../../../constants/control-strip-labels'
import { useAiriCardStore } from '../../../../stores/modules/airi-card'
import { useLiveSessionStore } from '../../../../stores/modules/live-session'
import { useSpeechStore } from '../../../../stores/modules/speech'
import { useProvidersStore } from '../../../../stores/providers'

const emit = defineEmits<{ close: [] }>()

const speechStore = useSpeechStore()
const providersStore = useProvidersStore()
const liveSessionStore = useLiveSessionStore()
const cardStore = useAiriCardStore()

const { activeCard, activeCardId, cards } = storeToRefs(cardStore)
const { activeSpeechProvider, activeSpeechModel, activeSpeechVoiceId } = storeToRefs(speechStore)
const {
  outputMode: ttsOutputMode,
  powerState,
  voiceName: geminiLiveVoiceName,
} = storeToRefs(liveSessionStore)

// Voice Favorites stored as `provider:voiceId`
const voiceFavIds = useLocalStorage<string[]>('settings/control-strip/voice-favorites', [])

// Local refs for dropdowns
const selectedManualProvider = ref('')
const selectedManualModel = ref('')
const selectedManualVoiceId = ref('')

// Initialize manual selections when stores change
watch([activeSpeechProvider, activeSpeechModel, activeSpeechVoiceId], () => {
  selectedManualProvider.value = activeSpeechProvider.value || ''
  selectedManualModel.value = activeSpeechModel.value || ''
  selectedManualVoiceId.value = activeSpeechVoiceId.value || ''
}, { immediate: true })

// If provider changes, fetch models & voices
watch(selectedManualProvider, (newProv) => {
  if (newProv && newProv !== activeSpeechProvider.value) {
    void speechStore.loadVoicesForProvider(newProv)
    void providersStore.fetchModelsForProvider(newProv)
  }
})

// Star / Unstar helper for voice favorites
function toggleVoiceFavorite(provider: string, voiceId: string) {
  const key = `${provider}:${voiceId}`
  const favs = [...voiceFavIds.value]
  const idx = favs.indexOf(key)
  if (idx !== -1) {
    favs.splice(idx, 1)
  }
  else {
    if (favs.length >= 3) {
      favs.shift() // FIFO drop
    }
    favs.push(key)
  }
  voiceFavIds.value = favs
}

// Check if a voice is favorited
function isVoiceFavorite(provider: string, voiceId: string): boolean {
  return voiceFavIds.value.includes(`${provider}:${voiceId}`)
}

// Select a voice and update stores/card
function selectVoice(provider: string, model: string, voiceId: string) {
  activeSpeechProvider.value = provider
  activeSpeechModel.value = model
  activeSpeechVoiceId.value = voiceId

  // Persist to active character card
  if (activeCard.value && activeCardId.value) {
    cardStore.updateCard(activeCardId.value, {
      extensions: {
        ...activeCard.value.extensions,
        airi: {
          ...activeCard.value.extensions.airi,
          modules: {
            ...activeCard.value.extensions.airi.modules,
            speech: {
              ...activeCard.value.extensions.airi.modules.speech,
              provider,
              model,
              voice_id: voiceId,
            },
          },
        },
      },
    } as any)
  }
}

// Layer 1: Computed global favorite voices list
const favoriteVoices = computed(() => {
  const list: Array<{ provider: string, model: string, voiceId: string, name: string }> = []
  for (const key of voiceFavIds.value) {
    const [provider, voiceId] = key.split(':')
    if (!provider || !voiceId)
      continue
    const voices = speechStore.getVoicesForProvider(provider)
    const voiceObj = voices.find(v => v.id === voiceId)
    // Find matching model ID
    const models = providersStore.getModelsForProvider(provider)
    const model = models[0]?.id || ''
    list.push({
      provider,
      model,
      voiceId,
      name: voiceObj?.name || voiceId,
    })
  }
  return list
})

// Layer 2: Scoped Concept Voices (primary) or Global Cast Fallback
const scopedCastVoices = computed(() => {
  const result: Array<{ provider: string, model: string, voiceId: string, name: string, description?: string }> = []

  // 1. Scoped card concepts
  const activeChar = activeCard.value
  if (activeChar && activeChar.extensions?.airi?.visual_assets) {
    const assets = activeChar.extensions.airi.visual_assets
    for (const [key, asset] of Object.entries(assets)) {
      const speechConfig = (asset as any).manifestation?.speech || (asset as any).speech
      if (speechConfig && speechConfig.provider && speechConfig.voice_id) {
        result.push({
          provider: speechConfig.provider,
          model: speechConfig.model || '',
          voiceId: speechConfig.voice_id,
          name: key, // Use asset key/name as initial representation
          description: asset.description || '',
        })
      }
    }
  }

  // 2. Fallback to global cast voices if no studio configurations are found in visual_assets
  if (result.length === 0) {
    const seen = new Set<string>()
    for (const [, card] of cards.value.entries()) {
      const sp = card.extensions?.airi?.modules?.speech
      if (sp && sp.provider && sp.voice_id) {
        const key = `${sp.provider}:${sp.voice_id}`
        if (!seen.has(key)) {
          seen.add(key)
          result.push({
            provider: sp.provider,
            model: sp.model || '',
            voiceId: sp.voice_id,
            name: card.name,
          })
        }
      }
    }
  }

  return result.slice(0, 6) // limit to 6 items
})
</script>

<template>
  <StripPopover title="Voice Switch" gap="2.5" @close="emit('close')">
    <!-- CONDITION A: Gemini Live Session Voice List -->
    <div v-if="ttsOutputMode === 'gemini' && powerState !== 'off'" class="flex flex-col gap-1.5">
      <span class="text-[10px] text-neutral-400 font-bold tracking-wider uppercase">Gemini Live Voices</span>
      <div class="max-h-56 flex flex-col gap-1 overflow-y-auto py-1 scrollbar-thin">
        <button
          v-for="voice in GEMINI_LIVE_VOICES"
          :key="voice"
          :class="[
            'w-full cursor-pointer border rounded-xl px-2.5 py-1.5 text-left text-xs transition-all duration-200',
            geminiLiveVoiceName === voice
              ? 'bg-primary-500/20 border-primary-400/50 text-primary-600 dark:text-primary-300 font-semibold'
              : 'bg-neutral-50/50 dark:bg-neutral-800/40 border-neutral-200/50 dark:border-neutral-800/20 hover:bg-neutral-200/50 dark:hover:bg-neutral-700/50',
          ]"
          @click="geminiLiveVoiceName = voice as any; emit('close')"
        >
          <div class="flex items-center justify-between">
            <span>{{ voice }}</span>
            <span v-if="geminiLiveVoiceName === voice" class="i-solar:check-circle-bold text-sm text-primary-500" />
          </div>
        </button>
      </div>
    </div>

    <!-- CONDITION B: 3-Layer LLM / Native TTS View -->
    <div v-else class="flex flex-col gap-2.5">
      <!-- LAYER 1: Global Favorites -->
      <div v-if="favoriteVoices.length > 0" class="flex flex-col gap-1">
        <span class="text-[10px] text-neutral-400 font-bold tracking-wider uppercase">Favorites</span>
        <div class="grid grid-cols-3 gap-1.5">
          <button
            v-for="fav in favoriteVoices"
            :key="`${fav.provider}:${fav.voiceId}`"
            :class="[
              'relative h-12 flex flex-col items-center justify-center border rounded-xl text-[10px] transition-all overflow-hidden cursor-pointer select-none',
              (activeSpeechProvider === fav.provider && activeSpeechVoiceId === fav.voiceId)
                ? 'border-amber-400 ring-2 ring-amber-400/50 font-bold bg-amber-500/10'
                : 'border-neutral-200/40 dark:border-neutral-800/40 hover:ring-2 hover:ring-amber-500/50 bg-neutral-200/10 dark:bg-neutral-800/10',
            ]"
            @click="selectVoice(fav.provider, fav.model, fav.voiceId); emit('close')"
          >
            <div :class="['w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold uppercase mb-0.5', cardInitialColor(fav.name)]">
              {{ fav.name[0] }}
            </div>
            <span class="w-full truncate px-1 text-center text-[8px] text-neutral-600 dark:text-neutral-400">{{ fav.name }}</span>
          </button>
        </div>
        <div class="my-1 border-b border-neutral-200/50 dark:border-neutral-800/50" />
      </div>

      <!-- LAYER 2: Character Scoped / Global Fallback -->
      <div v-if="scopedCastVoices.length > 0" class="flex flex-col gap-1">
        <span class="text-[10px] text-neutral-400 font-bold tracking-wider uppercase">
          {{ activeCard?.extensions?.airi?.visual_assets && Object.keys(activeCard.extensions.airi.visual_assets).length > 0 ? 'Concept Voices' : 'Cast Voices' }}
        </span>
        <div class="grid grid-cols-3 gap-1.5">
          <button
            v-for="v in scopedCastVoices"
            :key="`${v.provider}:${v.voiceId}`"
            :class="[
              'relative h-12 flex flex-col items-center justify-center border rounded-xl text-[10px] transition-all overflow-hidden cursor-pointer select-none',
              (activeSpeechProvider === v.provider && activeSpeechVoiceId === v.voiceId)
                ? 'border-primary-400 ring-2 ring-primary-400/50 font-bold bg-primary-500/10'
                : 'border-neutral-200/40 dark:border-neutral-800/40 hover:ring-2 hover:ring-primary-500/50 bg-neutral-200/10 dark:bg-neutral-800/10',
            ]"
            :title="v.description || v.name"
            @click="selectVoice(v.provider, v.model, v.voiceId); emit('close')"
          >
            <div :class="['w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold uppercase mb-0.5', cardInitialColor(v.name)]">
              {{ v.name[0] }}
            </div>
            <span class="w-full truncate px-1 text-center text-[8px] text-neutral-600 dark:text-neutral-400">{{ v.name }}</span>
          </button>
        </div>
        <div class="my-1 border-b border-neutral-200/50 dark:border-neutral-800/50" />
      </div>

      <!-- LAYER 3: Dropdown Selectors -->
      <div class="flex flex-col gap-2">
        <span class="text-[10px] text-neutral-400 font-bold tracking-wider uppercase">Search Registry</span>

        <!-- Provider Selector -->
        <div class="flex flex-col gap-0.5">
          <span class="text-[8px] text-neutral-400 font-semibold uppercase">Provider</span>
          <select
            v-model="selectedManualProvider"
            class="w-full border border-neutral-200/30 rounded-xl bg-neutral-200/40 px-2.5 py-1 text-[10px] text-neutral-700 dark:border-neutral-800/30 dark:bg-neutral-800/40 dark:text-neutral-300 focus:outline-none"
          >
            <option
              v-for="p in providersStore.allAudioSpeechProvidersMetadata"
              :key="p.id"
              :value="p.id"
            >
              {{ p.name }}
            </option>
          </select>
        </div>

        <!-- Model Selector -->
        <div v-if="providersStore.getModelsForProvider(selectedManualProvider).length > 0" class="flex flex-col gap-0.5">
          <span class="text-[8px] text-neutral-400 font-semibold uppercase">Engine / Model</span>
          <select
            v-model="selectedManualModel"
            class="w-full border border-neutral-200/30 rounded-xl bg-neutral-200/40 px-2.5 py-1 text-[10px] text-neutral-700 dark:border-neutral-800/30 dark:bg-neutral-800/40 dark:text-neutral-300 focus:outline-none"
          >
            <option
              v-for="m in providersStore.getModelsForProvider(selectedManualProvider)"
              :key="m.id"
              :value="m.id"
            >
              {{ m.name }}
            </option>
          </select>
        </div>

        <!-- Voice Selector -->
        <div v-if="speechStore.getVoicesForProvider(selectedManualProvider).length > 0" class="flex flex-col gap-1">
          <div class="flex flex-col gap-0.5">
            <span class="text-[8px] text-neutral-400 font-semibold uppercase">Voice ID</span>
            <select
              v-model="selectedManualVoiceId"
              class="w-full border border-neutral-200/30 rounded-xl bg-neutral-200/40 px-2.5 py-1 text-[10px] text-neutral-700 dark:border-neutral-800/30 dark:bg-neutral-800/40 dark:text-neutral-300 focus:outline-none"
            >
              <option
                v-for="v in speechStore.getVoicesForProvider(selectedManualProvider)"
                :key="v.id"
                :value="v.id"
              >
                {{ v.name }}
              </option>
            </select>
          </div>

          <!-- Action row to toggle favorite / apply -->
          <div class="mt-1 flex items-center gap-1.5">
            <button
              class="flex-1 cursor-pointer border border-primary-500/25 rounded-xl bg-primary-500/20 py-1 text-center text-[10px] text-primary-600 font-semibold transition-all hover:bg-primary-500/30 dark:text-primary-300"
              @click="selectVoice(selectedManualProvider, selectedManualModel, selectedManualVoiceId); emit('close')"
            >
              Apply Voice
            </button>
            <button
              class="h-8 w-8 flex cursor-pointer items-center justify-center border border-neutral-200/30 rounded-xl bg-neutral-200/40 text-amber-500 transition-all dark:border-neutral-800/30 dark:bg-neutral-800/40 hover:bg-neutral-200/60 dark:hover:bg-neutral-700/60"
              title="Toggle Favorite"
              @click="toggleVoiceFavorite(selectedManualProvider, selectedManualVoiceId)"
            >
              <span :class="isVoiceFavorite(selectedManualProvider, selectedManualVoiceId) ? 'i-solar:star-bold' : 'i-solar:star-linear'" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </StripPopover>
</template>
