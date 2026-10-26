<script setup lang="ts">
import type { VoiceEditorPayload } from '@proj-airi/stage-ui/types/voice-editor'

import { CharacterAvatar } from '@proj-airi/stage-ui/components'
import { useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { useSpeechStore } from '@proj-airi/stage-ui/stores/modules/speech'
import { storeToRefs } from 'pinia'
import { computed, onUnmounted, ref } from 'vue'

const emit = defineEmits<{
  (e: 'openVoiceSettings'): void
  (e: 'openVoiceEditor', payload: VoiceEditorPayload): void
}>()

const airiCardStore = useAiriCardStore()
const { activeCard, activeCardId } = storeToRefs(airiCardStore)

const speechStore = useSpeechStore()
const {
  savedVoiceProfiles,
  activeSpeechProvider,
  activeSpeechVoiceId,
  activeSpeechVoice,
  availableVoices,
  outputVolume,
  speechEnabled: isSpeechEnabled,
} = storeToRefs(speechStore)

// --- AUDIO PREVIEW STATE ---
const currentlyPlayingId = ref<string | null>(null)
let currentAudio: HTMLAudioElement | null = null

function stopCurrentAudio() {
  if (currentAudio) {
    currentAudio.pause()
    currentAudio = null
  }
  currentlyPlayingId.value = null
}

onUnmounted(() => {
  stopCurrentAudio()
})

function playChimePreview() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(523.25, ctx.currentTime) // C5
    osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.12) // E5
    gain.gain.setValueAtTime(0.12 * outputVolume.value, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.3)
  }
  catch {
    // Autoplay policy or uninitialized audio context
  }
}

function handleTogglePreview(targetId: string, previewUrl?: string) {
  if (currentlyPlayingId.value === targetId) {
    stopCurrentAudio()
    return
  }

  stopCurrentAudio()

  if (previewUrl) {
    currentAudio = new Audio(previewUrl)
    currentAudio.volume = Math.max(0, Math.min(1, outputVolume.value))
    currentlyPlayingId.value = targetId
    currentAudio.onended = () => {
      currentlyPlayingId.value = null
      currentAudio = null
    }
    currentAudio.onerror = () => {
      currentlyPlayingId.value = null
      currentAudio = null
    }
    currentAudio.play().catch(() => {
      currentlyPlayingId.value = null
      currentAudio = null
      playChimePreview()
    })
  }
  else {
    currentlyPlayingId.value = targetId
    playChimePreview()
    setTimeout(() => {
      if (currentlyPlayingId.value === targetId) {
        currentlyPlayingId.value = null
      }
    }, 350)
  }
}

// --- VOICE OPTIONS (PROFILES & VOICES) ---
const voiceOptions = computed(() => {
  const options: Array<{ id: string, name: string, previewUrl?: string }> = []

  // 1. Virtual Voice Profiles
  for (const profile of savedVoiceProfiles.value || []) {
    options.push({
      id: profile.id,
      name: profile.name,
    })
  }

  // 2. Provider Voices
  const providerVoices = availableVoices.value[activeSpeechProvider.value] || []
  for (const voice of providerVoices) {
    if (!options.some(o => o.id === voice.id)) {
      options.push({
        id: voice.id,
        name: voice.name,
        previewUrl: voice.previewURL,
      })
    }
  }

  // 3. Fallback active voice if not listed
  if (activeSpeechVoiceId.value && !options.some(o => o.id === activeSpeechVoiceId.value)) {
    options.push({
      id: activeSpeechVoiceId.value,
      name: activeSpeechVoice.value?.name || activeSpeechVoiceId.value,
      previewUrl: activeSpeechVoice.value?.previewURL,
    })
  }

  return options
})

// --- CHARACTER & ACTOR RESOLUTION ---
const activeCharacterName = computed(() => {
  return activeCard.value?.name || 'Character'
})

const activeDisplayModelId = computed(() => {
  if (!activeCardId.value)
    return undefined
  return airiCardStore.getCardDisplayModelId(activeCardId.value)
})

const cardDefaultVoiceId = computed(() => {
  return activeCard.value?.extensions?.airi?.modules?.speech?.voice_id || activeSpeechVoiceId.value || ''
})

const cardSpeechConfig = computed(() => {
  const speech = activeCard.value?.extensions?.airi?.modules?.speech as { provider?: string, model?: string, voice_id?: string } | undefined
  return {
    provider: speech?.provider || '',
    model: speech?.model || '',
    voice: cardDefaultVoiceId.value,
  }
})

const cardDefaultVoiceName = computed(() => {
  if (!cardDefaultVoiceId.value)
    return 'Default voice'
  const match = voiceOptions.value.find(v => v.id === cardDefaultVoiceId.value)
  return match?.name || cardDefaultVoiceId.value
})

const cardDefaultPreviewUrl = computed(() => {
  const match = voiceOptions.value.find(v => v.id === cardDefaultVoiceId.value)
  return match?.previewUrl
})

const stagingVisualAssets = computed(() => {
  return activeCard.value?.extensions?.airi?.visual_assets || {}
})

const actorConcepts = computed(() => {
  const assets = stagingVisualAssets.value
  return Object.entries(assets)
    .filter(([id, asset]: [string, any]) => {
      if (id.startsWith('actor_') || id.startsWith('actress_'))
        return true
      if (asset?.manifestation?.modelId)
        return true
      return false
    })
    .map(([id, asset]: [string, any]) => {
      const cleanName = id.replace(/^(actor_|actress_)/i, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      return {
        id,
        name: asset?.name || cleanName,
        displayModelId: asset?.manifestation?.modelId as string | undefined,
        speech: asset?.speech as { provider?: string, model?: string, voice_id?: string, profileId?: string } | undefined,
        asset,
      }
    })
})

const isMultiActorCard = computed(() => {
  if (actorConcepts.value.length > 1)
    return true
  if (actorConcepts.value.length === 1) {
    const conceptName = actorConcepts.value[0].name.toLowerCase().trim()
    const cardName = activeCharacterName.value.toLowerCase().trim()
    return conceptName !== cardName
  }
  return false
})

function getActorVoiceName(actor: { id: string, speech?: { voice_id?: string } }): string {
  const voiceId = actor.speech?.voice_id
  if (!voiceId) {
    return 'Uses card default'
  }
  const match = voiceOptions.value.find(v => v.id === voiceId)
  return match?.name || voiceId
}

function getActorPreviewUrl(actor: { id: string, speech?: { voice_id?: string } }): string | undefined {
  const voiceId = actor.speech?.voice_id || cardDefaultVoiceId.value
  const match = voiceOptions.value.find(v => v.id === voiceId)
  return match?.previewUrl
}

// --- CARD EXTENSION UPDATES ---
function writeCardSpeech(voice: { baseProvider: string, baseModel: string, baseVoice: string }) {
  if (!activeCardId.value || !activeCard.value)
    return
  const extensions = JSON.parse(JSON.stringify(activeCard.value.extensions || {}))
  if (!extensions.airi)
    extensions.airi = {}
  if (!extensions.airi.modules)
    extensions.airi.modules = {}
  if (!extensions.airi.modules.speech) {
    extensions.airi.modules.speech = {
      provider: '',
      model: '',
      voice_id: '',
      speed: 1,
      pitch: 0,
      volume: 1,
    }
  }
  extensions.airi.modules.speech.provider = voice.baseProvider
  extensions.airi.modules.speech.model = voice.baseModel
  extensions.airi.modules.speech.voice_id = voice.baseVoice

  airiCardStore.updateCard(activeCardId.value, {
    ...activeCard.value,
    extensions,
  } as any)
}

function openCardVoiceEditor() {
  emit('openVoiceEditor', {
    scope: 'card-default',
    initial: { ...cardSpeechConfig.value },
    characterName: activeCharacterName.value,
    onSave: voice => writeCardSpeech(voice),
  })
}

function writeActorSpeech(actorId: string, voice: { baseProvider: string, baseModel: string, baseVoice: string } | null) {
  if (!activeCardId.value || !activeCard.value)
    return
  const extensions = JSON.parse(JSON.stringify(activeCard.value.extensions || {}))
  if (!extensions.airi)
    extensions.airi = {}
  if (!extensions.airi.visual_assets)
    extensions.airi.visual_assets = {}
  if (!extensions.airi.visual_assets[actorId]) {
    extensions.airi.visual_assets[actorId] = { description: '' }
  }
  if (!extensions.airi.visual_assets[actorId].speech) {
    extensions.airi.visual_assets[actorId].speech = {}
  }

  if (voice) {
    extensions.airi.visual_assets[actorId].speech.provider = voice.baseProvider
    extensions.airi.visual_assets[actorId].speech.model = voice.baseModel
    extensions.airi.visual_assets[actorId].speech.voice_id = voice.baseVoice
  }
  else {
    delete extensions.airi.visual_assets[actorId].speech.voice_id
    if (Object.keys(extensions.airi.visual_assets[actorId].speech).length === 0) {
      delete extensions.airi.visual_assets[actorId].speech
    }
  }

  airiCardStore.updateCard(activeCardId.value, {
    ...activeCard.value,
    extensions,
  } as any)
}

function handleSelectActorVoice(actorId: string, voiceId: string) {
  if (voiceId) {
    const actor = actorConcepts.value.find(a => a.id === actorId)
    writeActorSpeech(actorId, {
      baseProvider: actor?.speech?.provider || cardSpeechConfig.value.provider,
      baseModel: actor?.speech?.model || cardSpeechConfig.value.model,
      baseVoice: voiceId,
    })
    return
  }
  writeActorSpeech(actorId, null)
}

function openActorVoiceEditor(actorId: string) {
  const actor = actorConcepts.value.find(a => a.id === actorId)
  emit('openVoiceEditor', {
    scope: 'actor',
    actorId,
    initial: {
      provider: actor?.speech?.provider || cardSpeechConfig.value.provider,
      model: actor?.speech?.model || cardSpeechConfig.value.model,
      voice: actor?.speech?.voice_id || '',
    },
    characterName: actor?.name || activeCharacterName.value,
    onSave: voice => writeActorSpeech(actorId, voice),
  })
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <!-- Header Banner -->
    <div class="flex items-center gap-3 px-1 py-1">
      <div class="size-10 flex shrink-0 items-center justify-center border border-emerald-500/20 rounded-xl bg-emerald-500/15 text-emerald-500 dark:bg-emerald-500/20">
        <div class="i-solar:volume-loud-bold-duotone size-6" />
      </div>
      <div class="flex flex-col">
        <span class="text-xs text-neutral-800 font-bold dark:text-neutral-100">Voice & Audio</span>
        <span class="text-[10px] text-neutral-400 dark:text-neutral-500">Playback and speech generation</span>
      </div>
    </div>

    <!-- PLAYBACK SECTION -->
    <div class="flex flex-col gap-1.5 pt-1">
      <div class="select-none px-1 text-[10px] text-neutral-400 font-bold tracking-wider uppercase">
        Playback Controls
      </div>

      <!-- Volume Slider Card -->
      <div class="flex flex-col gap-1.5 border border-neutral-200/50 rounded-xl bg-neutral-50/70 p-2.5 dark:border-neutral-800/60 dark:bg-neutral-900/40">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div
              class="size-4.5"
              :class="outputVolume === 0
                ? 'i-solar:volume-cross-bold-duotone text-neutral-400'
                : 'i-solar:volume-loud-bold-duotone text-emerald-500'"
            />
            <span class="text-xs text-neutral-700 font-semibold dark:text-neutral-200">Speaker volume</span>
          </div>
          <span class="text-xs text-neutral-600 font-bold font-mono dark:text-neutral-300">
            {{ Math.round(outputVolume * 100) }}%
          </span>
        </div>
        <input
          v-model.number="outputVolume"
          type="range"
          min="0"
          max="1"
          step="0.01"
          class="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-neutral-200 accent-primary-500 dark:bg-neutral-700"
        >
        <span class="text-[9px] text-neutral-400 leading-tight dark:text-neutral-500">
          At 0%, speech still generates; lip-sync and captions continue.
        </span>
      </div>

      <!-- Generate Speech (TTS) Toggle Row -->
      <div
        class="w-full flex cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 transition hover:bg-neutral-100 dark:hover:bg-neutral-800/60"
        @click="isSpeechEnabled = !isSpeechEnabled"
      >
        <div class="flex items-center gap-2.5">
          <div
            class="size-4.5"
            :class="isSpeechEnabled
              ? 'text-emerald-500 i-solar:microphone-3-bold-duotone'
              : 'text-neutral-400 dark:text-neutral-500 i-solar:microphone-3-linear'"
          />
          <div class="flex flex-col">
            <span class="text-xs text-neutral-700 font-semibold dark:text-neutral-200">Generate speech (TTS)</span>
            <span class="text-[9px] text-neutral-400">Turn off to stop TTS requests. Text chat continues.</span>
          </div>
        </div>
        <div
          :class="isSpeechEnabled ? 'bg-primary-500' : 'bg-neutral-200 dark:bg-neutral-700'"
          class="relative h-4 w-7 inline-flex shrink-0 cursor-pointer items-center border border-transparent rounded-full transition-colors duration-200 ease-in-out"
        >
          <span
            :class="isSpeechEnabled ? 'translate-x-3.5' : 'translate-x-0.5'"
            class="pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
          />
        </div>
      </div>
    </div>

    <!-- ADAPTIVE CHARACTER VOICES SECTION -->
    <!-- SECTION A: SINGLE CHARACTER MODE (Mockup 1) -->
    <div v-if="!isMultiActorCard" class="flex flex-col gap-2 pt-1">
      <!-- Info Callout -->
      <div class="flex items-start gap-2.5 border border-amber-500/20 rounded-xl bg-amber-500/10 p-2.5 dark:border-amber-400/20 dark:bg-amber-400/10">
        <div class="i-solar:info-circle-bold-duotone mt-0.5 size-4 shrink-0 text-amber-500 dark:text-amber-400" />
        <div class="flex flex-col text-[10px] text-amber-800 leading-snug dark:text-amber-200">
          <span class="font-bold">Silent speakers ≠ disabled speech</span>
          <span class="text-amber-700/80 dark:text-amber-300/80">Use volume for silence. Switch TTS off to stop synthesis requests entirely.</span>
        </div>
      </div>

      <div class="select-none px-1 text-[10px] text-neutral-400 font-bold tracking-wider uppercase">
        Card Voice
      </div>

      <!-- Single Character Row -->
      <div class="flex items-center justify-between border border-neutral-200/50 rounded-xl bg-neutral-50/70 p-2 dark:border-neutral-800/60 dark:bg-neutral-900/40">
        <div class="min-w-0 flex items-center gap-2.5">
          <CharacterAvatar
            :card-id="activeCardId || ''"
            :name="activeCharacterName"
            :display-model-id="activeDisplayModelId"
            size-class="size-8"
            shape="circle"
          />
          <div class="min-w-0 flex flex-col">
            <span class="truncate text-xs text-neutral-800 font-bold dark:text-neutral-100">
              {{ activeCharacterName }}
            </span>
            <span class="truncate text-[10px] text-neutral-400 dark:text-neutral-500">
              {{ cardDefaultVoiceName }}
            </span>
          </div>
        </div>

        <div class="flex shrink-0 items-center gap-1.5">
          <!-- Preview button -->
          <button
            type="button"
            title="Preview voice"
            class="cursor-pointer rounded-lg p-1.5 text-neutral-500 transition hover:bg-neutral-200/60 dark:text-neutral-400 hover:text-neutral-800 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
            @click="handleTogglePreview('default', cardDefaultPreviewUrl)"
          >
            <div
              :class="currentlyPlayingId === 'default'
                ? 'i-solar:stop-circle-bold text-emerald-500'
                : 'i-solar:play-circle-bold-duotone'"
              class="size-5"
            />
          </button>

          <!-- Voice Editor Button -->
          <button
            type="button"
            title="Edit voice"
            class="cursor-pointer rounded-lg p-1.5 text-neutral-500 transition hover:bg-neutral-200/60 dark:text-neutral-400 hover:text-neutral-800 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
            @click="openCardVoiceEditor"
          >
            <div class="i-solar:pen-bold-duotone size-5" />
          </button>
        </div>
      </div>
    </div>

    <!-- SECTION B: MULTI-ACTOR MODE (Mockup 2) -->
    <div v-else class="flex flex-col gap-2 pt-1">
      <div class="flex items-center justify-between px-1">
        <span class="select-none text-[10px] text-neutral-400 font-bold tracking-wider uppercase">
          Character Voices
        </span>
        <span class="text-[9px] text-neutral-400">Default with actor overrides</span>
      </div>

      <!-- Card Default Row -->
      <div class="flex items-center justify-between border border-neutral-200/50 rounded-xl bg-neutral-50/70 p-2 dark:border-neutral-800/60 dark:bg-neutral-900/40">
        <div class="min-w-0 flex items-center gap-2.5">
          <div class="size-8 flex shrink-0 items-center justify-center rounded-lg bg-neutral-200/60 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
            <div class="i-solar:document-text-linear size-4.5" />
          </div>
          <div class="min-w-0 flex flex-col">
            <span class="truncate text-xs text-neutral-800 font-bold dark:text-neutral-100">
              Default voice
            </span>
            <span class="truncate text-[10px] text-neutral-400 dark:text-neutral-500">
              {{ cardDefaultVoiceName }}
            </span>
          </div>
        </div>

        <div class="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            title="Preview voice"
            class="cursor-pointer rounded-lg p-1.5 text-neutral-500 transition hover:bg-neutral-200/60 dark:text-neutral-400 hover:text-neutral-800 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
            @click="handleTogglePreview('default', cardDefaultPreviewUrl)"
          >
            <div
              :class="currentlyPlayingId === 'default'
                ? 'i-solar:stop-circle-bold text-emerald-500'
                : 'i-solar:play-circle-bold-duotone'"
              class="size-5"
            />
          </button>

          <button
            type="button"
            title="Edit voice"
            class="cursor-pointer rounded-lg p-1.5 text-neutral-500 transition hover:bg-neutral-200/60 dark:text-neutral-400 hover:text-neutral-800 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
            @click="openCardVoiceEditor"
          >
            <div class="i-solar:pen-bold-duotone size-5" />
          </button>
        </div>
      </div>

      <!-- Actor Overrides -->
      <div class="select-none px-1 pt-1 text-[10px] text-neutral-400 font-bold tracking-wider uppercase">
        Actor Overrides
      </div>

      <div class="flex flex-col gap-1.5">
        <div
          v-for="actor in actorConcepts"
          :key="actor.id"
          class="flex items-center justify-between border border-neutral-200/50 rounded-xl bg-neutral-50/70 p-2 dark:border-neutral-800/60 dark:bg-neutral-900/40"
        >
          <div class="min-w-0 flex items-center gap-2.5">
            <CharacterAvatar
              :card-id="activeCardId || ''"
              :name="actor.name"
              :display-model-id="actor.displayModelId"
              size-class="size-8"
              shape="circle"
            />
            <div class="min-w-0 flex flex-col">
              <span class="truncate text-xs text-neutral-800 font-bold dark:text-neutral-100">
                {{ actor.name }}
              </span>
              <span class="truncate text-[10px] text-neutral-400 dark:text-neutral-500">
                {{ getActorVoiceName(actor) }}
              </span>
            </div>
          </div>

          <div class="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              title="Preview voice"
              class="cursor-pointer rounded-lg p-1.5 text-neutral-500 transition hover:bg-neutral-200/60 dark:text-neutral-400 hover:text-neutral-800 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
              @click="handleTogglePreview(actor.id, getActorPreviewUrl(actor))"
            >
              <div
                :class="currentlyPlayingId === actor.id
                  ? 'i-solar:stop-circle-bold text-emerald-500'
                  : 'i-solar:play-circle-bold-duotone'"
                class="size-5"
              />
            </button>

            <button
              type="button"
              title="Edit voice"
              class="cursor-pointer rounded-lg p-1.5 text-neutral-500 transition hover:bg-neutral-200/60 dark:text-neutral-400 hover:text-neutral-800 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
              @click="openActorVoiceEditor(actor.id)"
            >
              <div class="i-solar:pen-bold-duotone size-5" />
            </button>

            <!-- Reset to default button or link icon -->
            <button
              v-if="actor.speech?.voice_id"
              type="button"
              title="Reset to card default"
              class="cursor-pointer rounded-lg p-1 text-neutral-400 transition hover:bg-neutral-200/60 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
              @click="handleSelectActorVoice(actor.id, '')"
            >
              <div class="i-solar:restart-linear size-4" />
            </button>
            <div
              v-else
              title="Uses card default"
              class="p-1 text-neutral-400/60"
            >
              <div class="i-solar:link-linear size-4" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Divider & Manage Voice Profiles Link -->
    <div class="my-1 border-t border-neutral-200/40 dark:border-neutral-800/40" />

    <button
      type="button"
      class="w-full flex cursor-pointer items-center justify-between rounded-xl px-2 py-1.5 text-xs text-primary-500 font-semibold transition hover:bg-primary-500/10 dark:text-primary-400"
      @click="emit('openVoiceSettings')"
    >
      <span>Manage voice profiles</span>
      <div class="i-solar:arrow-right-up-linear size-4" />
    </button>
  </div>
</template>
