<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import CompanionBubble from '../components/companion-bubble.vue'

import { DEFAULT_POST_HISTORY_INSTRUCTIONS, getStarterCharacter, STARTER_CHARACTERS } from '../../../../../../constants/prompts/character-defaults'
import { useDisplayModelsStore } from '../../../../../../stores/display-models'
import { useAiriCardStore } from '../../../../../../stores/modules/airi-card'
import { useSpeechStore } from '../../../../../../stores/modules/speech'
import { useOnboardingStore } from '../../../../../../stores/onboarding'
import { useSettingsUserProfile } from '../../../../../../stores/settings/user-profile'
import { useOnboardingV2Draft } from '../draft-store'

// V2 onboarding — Step 7: Stage Calibration & Victory Launch.
// Performs atomic synthesis of transient draft choices into production stores.

const props = defineProps<{
  onFinish?: () => void
}>()

const emit = defineEmits<{
  (e: 'finish'): void
}>()

const userProfileStore = useSettingsUserProfile()
const cardStore = useAiriCardStore()
const speechStore = useSpeechStore()
const onboardingStore = useOnboardingStore()
const draftStore = useOnboardingV2Draft()
const displayModelsStore = useDisplayModelsStore()

const badges = [
  { label: 'Consciousness', icon: 'i-solar:cpu-bolt-bold-duotone' },
  { label: 'Hearing', icon: 'i-solar:microphone-3-bold-duotone' },
  { label: 'Speech', icon: 'i-solar:soundwave-bold-duotone' },
  { label: 'Avatar Model', icon: 'i-solar:people-nearby-bold-duotone' },
  { label: 'Personality Soul', icon: 'i-solar:heart-bold-duotone' },
]

const userName = computed(() => userProfileStore.name || 'Manager')

const USER_TOKEN_REGEX = /(?<!\{)\{user\}(?!\})/g

const resolvedPersona = computed(() => {
  const persona = draftStore.state.persona

  if (persona.importedCardDraft) {
    const rawData = persona.importedCardDraft as any
    const data = rawData.data || rawData
    return {
      name: data.nickname || data.name || 'AI Companion',
      description: data.description || 'Your default AI companion on stage.',
      personality: data.personality || 'Friendly, caring, and bright assistant.',
      scenario: data.scenario || '',
      systemPrompt: data.system_prompt || data.systemPrompt || '',
      postHistoryInstructions: data.post_history_instructions || data.postHistoryInstructions || DEFAULT_POST_HISTORY_INSTRUCTIONS,
      greetings: (data.greetings || (data.first_mes ? [data.first_mes, ...(data.alternate_greetings || [])] : [])) as string[],
      messageExample: (data.message_example || data.messageExample || []) as [string, string][],
    }
  }

  const cardId = persona.cardId || 'default'
  if (STARTER_CHARACTERS[cardId]) {
    const p = getStarterCharacter(cardId)
    return {
      name: p.name,
      description: p.description,
      personality: p.personality,
      scenario: p.scenario.replace(USER_TOKEN_REGEX, userName.value),
      systemPrompt: p.systemPrompt.replace(USER_TOKEN_REGEX, userName.value),
      postHistoryInstructions: DEFAULT_POST_HISTORY_INSTRUCTIONS,
      greetings: p.greetings.map(g => g.replace(USER_TOKEN_REGEX, userName.value)),
      messageExample: (p.messageExample || []).map(([uMsg, cMsg]) => [
        uMsg.replace(USER_TOKEN_REGEX, userName.value),
        cMsg.replace(USER_TOKEN_REGEX, userName.value),
      ]) as [string, string][],
    }
  }

  const installedCard = cardStore.getCard(cardId) as any
  if (installedCard) {
    const data = installedCard.data || installedCard
    return {
      name: data.nickname || data.name || 'AI Companion',
      description: data.description || 'Your default AI companion on stage.',
      personality: data.personality || 'Friendly, caring, and bright assistant.',
      scenario: data.scenario || '',
      systemPrompt: data.system_prompt || data.systemPrompt || '',
      postHistoryInstructions: data.post_history_instructions || data.postHistoryInstructions || DEFAULT_POST_HISTORY_INSTRUCTIONS,
      greetings: (data.greetings || (data.first_mes ? [data.first_mes, ...(data.alternate_greetings || [])] : [])) as string[],
      messageExample: (data.message_example || data.messageExample || []) as [string, string][],
    }
  }

  const d = STARTER_CHARACTERS.default
  return {
    name: d.name,
    description: d.description,
    personality: d.personality,
    scenario: d.scenario.replace(USER_TOKEN_REGEX, userName.value),
    systemPrompt: d.systemPrompt.replace(USER_TOKEN_REGEX, userName.value),
    postHistoryInstructions: DEFAULT_POST_HISTORY_INSTRUCTIONS,
    greetings: d.greetings.map(g => g.replace(USER_TOKEN_REGEX, userName.value)),
    messageExample: (d.messageExample || []).map(([uMsg, cMsg]) => [
      uMsg.replace(USER_TOKEN_REGEX, userName.value),
      cMsg.replace(USER_TOKEN_REGEX, userName.value),
    ]) as [string, string][],
  }
})

const fullGreeting = computed(() => {
  const g = resolvedPersona.value.greetings?.[0]
  if (g) {
    return g.replace(USER_TOKEN_REGEX, userName.value).replace(/\{\{user\}\}/gi, userName.value)
  }
  return `Hello ${userName.value}! Everything is ready — let's step onto the stage.`
})

const resolvedVesselName = computed(() => {
  const modelId = draftStore.state.vessel.displayModelId
  if (!modelId)
    return 'Hiyori (Free)'
  const starter = [
    { id: 'preset-live2d-2', name: 'Hiyori (Free)' },
    { id: 'preset-live2d-1', name: 'Hiyori (Pro)' },
    { id: 'preset-vrm-1', name: 'AvatarSample_A' },
    { id: 'preset-vrm-2', name: 'AvatarSample_B' },
  ].find(b => b.id === modelId)
  if (starter)
    return starter.name
  const found = displayModelsStore.displayModels.find(m => m.id === modelId)
  return found?.name || modelId
})

const typedGreeting = ref('')
let typeTimer: ReturnType<typeof setInterval> | undefined

function startTypewriter(text: string) {
  if (typeTimer) {
    clearInterval(typeTimer)
    typeTimer = undefined
  }
  if (!text) {
    typedGreeting.value = ''
    return
  }
  let i = 0
  typedGreeting.value = ''
  typeTimer = setInterval(() => {
    i++
    typedGreeting.value = text.slice(0, i)
    if (i >= text.length) {
      clearInterval(typeTimer)
      typeTimer = undefined
    }
  }, 24)
}

watch(fullGreeting, (newGreeting) => {
  if (newGreeting) {
    startTypewriter(newGreeting)
  }
}, { immediate: true })

onBeforeUnmount(() => {
  if (typeTimer) {
    clearInterval(typeTimer)
    typeTimer = undefined
  }
})

const showPayload = ref(false)

const compiledCardPayload = computed(() => {
  const draft = draftStore.state
  const inheritedArtistry = cardStore.activeCard?.extensions?.airi?.artistry
    ? JSON.parse(JSON.stringify(cardStore.activeCard.extensions.airi.artistry))
    : {}

  if (draft.persona.importedCardDraft) {
    const card = JSON.parse(JSON.stringify(draft.persona.importedCardDraft))
    const isV3 = 'data' in card
    const extTarget = isV3 ? (card.data.extensions = card.data.extensions || {}) : (card.extensions = card.extensions || {})
    extTarget.airi = extTarget.airi || {}
    extTarget.airi.modules = extTarget.airi.modules || {}
    if (draft.vessel.displayModelId) {
      extTarget.airi.modules.displayModelId = draft.vessel.displayModelId
    }
    if (draft.consciousness.provider) {
      extTarget.airi.modules.consciousness = {
        provider: draft.consciousness.provider,
        model: draft.consciousness.model || '',
      }
    }
    if (draft.speech.provider) {
      extTarget.airi.modules.speech = {
        provider: draft.speech.provider,
        model: draft.speech.model || '',
        voice_id: draft.speech.voiceId || '',
      }
    }
    return card
  }

  const greetings = resolvedPersona.value.greetings || []
  const firstGreeting = greetings[0] || ''
  const alternateGreetings = greetings.slice(1)

  return {
    spec: 'chara_card_v3' as const,
    spec_version: '3.0' as const,
    data: {
      name: resolvedPersona.value.name,
      nickname: resolvedPersona.value.name,
      creator: 'AIRI',
      creator_notes: 'Created via Onboarding V2',
      character_version: '1.0.0',
      description: resolvedPersona.value.description,
      personality: resolvedPersona.value.personality,
      scenario: resolvedPersona.value.scenario,
      system_prompt: resolvedPersona.value.systemPrompt,
      post_history_instructions: resolvedPersona.value.postHistoryInstructions,
      first_mes: firstGreeting,
      alternate_greetings: alternateGreetings,
      group_only_greetings: [],
      mes_example: (resolvedPersona.value.messageExample || [])
        .map(pair => pair.join('\n'))
        .join('\n<START>\n'),
      tags: ['onboarding-v2'],
      extensions: {
        airi: {
          agents: {},
          artistry: {
            ...inheritedArtistry,
          },
          modules: {
            displayModelId: draft.vessel.displayModelId || 'preset-live2d-2',
            consciousness: {
              provider: draft.consciousness.provider || 'openai',
              model: draft.consciousness.model || 'gpt-4o',
            },
            speech: {
              provider: draft.speech.provider || 'kokoro',
              model: draft.speech.model || 'kokoro-v1',
              voice_id: draft.speech.voiceId || 'af_heart',
            },
          },
        },
      },
    },
  }
})

async function handleFinish() {
  const draft = draftStore.state

  if (draft.userProfile.name) {
    userProfileStore.name = draft.userProfile.name
  }
  if (draft.userProfile.description) {
    userProfileStore.description = draft.userProfile.description
  }
  if (draft.userProfile.prompt) {
    userProfileStore.prompt = draft.userProfile.prompt
  }
  if (draft.userProfile.voiceProfileId) {
    const rawVoice = draft.userProfile.voiceProfileId
    const baseProvider = draft.speech.provider || 'pocket-tts-local'
    const baseModel = draft.speech.model || 'english_2026-04'
    const userVoiceRate = draft.userProfile.rate ?? 1.0
    const userVoicePitch = draft.userProfile.pitch ?? 1.0
    const userNameStr = draft.userProfile.name || 'User'
    const profileId = `voice_profile_user_${userNameStr.toLowerCase().replace(/\s+/g, '_')}`

    const newProfile = {
      id: profileId,
      name: `${userNameStr}'s Voice`,
      baseProvider,
      baseModel,
      baseVoice: rawVoice,
      effects: {
        pitch: userVoicePitch,
        rate: userVoiceRate,
        volume: 1.0,
        asmr: 0,
        radio: 0,
        robot: 0,
        reverb: 0,
        spatial: 0,
      },
      ust: {
        enabled: true,
        mode: 'mute' as any,
        customStripChars: '*_[]()<>"\'',
        stripEmojis: true,
        tildeReplacement: '',
        autoLowercaseCapsThreshold: 2,
        autoLowercaseCapsExclude: [],
        convertBracketsToTokenFormat: true,
        customReplacements: [],
      },
    }

    speechStore.saveVoiceProfile(newProfile as any)
    userProfileStore.voiceProfileId = profileId
  }

  // Synthesize and persist the brand new card payload
  const payload = compiledCardPayload.value
  const newCardId = await cardStore.addCard(payload)
  await cardStore.activateCard(newCardId, true)

  onboardingStore.markSetupCompleted()
  draftStore.reset()

  emit('finish')
  props.onFinish?.()
}
</script>

<template>
  <div class="h-full flex flex-col gap-5 overflow-y-auto px-1 pb-2">
    <div class="text-center">
      <h2 class="text-xl text-neutral-800 font-semibold md:text-2xl dark:text-neutral-100">
        Stage Calibration
      </h2>
      <p class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
        Every component was prepared in-context — zero waiting here.
      </p>
    </div>

    <CompanionBubble
      message="Everything is 100% prepared and ready to go! Look at you, setup champion. Let me give you a quick greeting before we step onto the stage!"
    />

    <!-- Victory status badges -->
    <div class="grid grid-cols-2 gap-2 sm:grid-cols-5">
      <div
        v-for="(badge, i) in badges"
        :key="badge.label"
        v-motion
        :initial="{ opacity: 0, y: 8 }"
        :enter="{ opacity: 1, y: 0 }"
        :duration="300"
        :delay="i * 90"
        :class="['flex flex-col items-center gap-1.5', 'border border-emerald-500/25 rounded-xl px-2 py-3', 'bg-emerald-500/5 dark:bg-emerald-400/5']"
      >
        <div class="relative">
          <div :class="badge.icon" class="h-6 w-6 text-emerald-500" />
          <div class="i-solar:check-circle-bold absolute h-3.5 w-3.5 text-emerald-500 -bottom-1 -right-1" />
        </div>
        <span class="text-[10px] text-emerald-700 font-bold dark:text-emerald-400">{{ badge.label }}</span>
        <span class="text-[9px] text-emerald-600/70 dark:text-emerald-500/70">Ready</span>
      </div>
    </div>

    <!-- Live greeting trial -->
    <div :class="['p-4 rounded-xl', 'bg-white/40 dark:bg-neutral-900/40', 'border border-neutral-200/60 dark:border-neutral-800/80', 'backdrop-blur-md', 'flex flex-col gap-3']">
      <div class="flex items-center gap-2 text-xs text-neutral-400 font-bold tracking-wider uppercase">
        <div class="i-solar:chat-round-dots-bold-duotone h-4 w-4 text-primary-500" />
        Live Greeting Preview
      </div>
      <div class="flex items-start gap-2.5">
        <div class="h-8 w-8 flex flex-shrink-0 items-center justify-center rounded-full bg-pink-500/15">
          <div class="i-solar:user-heart-rounded-bold-duotone h-5 w-5 text-pink-500" />
        </div>
        <div class="flex-1 border border-pink-500/15 rounded-2xl rounded-tl-sm bg-pink-500/5 px-3.5 py-2.5 text-sm text-neutral-700 leading-relaxed dark:bg-pink-400/5 dark:text-neutral-300">
          {{ typedGreeting }}<span class="animate-pulse">▍</span>
        </div>
      </div>
    </div>

    <button
      v-motion
      :initial="{ opacity: 0, y: 8 }"
      :enter="{ opacity: 1, y: 0 }"
      :duration="400"
      :delay="400"
      class="w-full flex items-center justify-center gap-2 rounded-xl from-primary-500 to-indigo-500 bg-gradient-to-r px-6 py-3.5 text-base text-white font-bold shadow-lg shadow-primary-500/30 transition-all active:scale-[0.98] hover:shadow-primary-500/50"
      @click="handleFinish"
    >
      <div class="i-solar:rocket-2-bold-duotone h-5 w-5" />
      Enter AIRI Stage
    </button>

    <!-- Dev / Inspection Payload Viewer Button -->
    <div class="flex flex-col items-center gap-2">
      <button
        type="button"
        class="flex items-center gap-1.5 border border-neutral-200/80 rounded-lg bg-neutral-100/60 px-3 py-1.5 text-xs text-neutral-600 font-semibold transition-colors dark:border-neutral-800 dark:bg-neutral-900/60 hover:bg-neutral-200/60 dark:text-neutral-300 dark:hover:bg-neutral-800"
        @click="showPayload = !showPayload"
      >
        <div class="i-solar:code-square-bold-duotone h-4 w-4 text-primary-500" />
        {{ showPayload ? 'Hide Card Payload JSON' : '🔍 View Compiled Card Payload' }}
      </button>

      <!-- Raw JSON Code Inspector -->
      <div
        v-if="showPayload"
        class="w-full flex flex-col gap-1 border border-neutral-200/80 rounded-xl bg-neutral-950 p-3 text-left shadow-inner dark:border-neutral-800"
      >
        <div class="flex items-center justify-between border-b border-neutral-800 pb-1.5">
          <span class="text-[10px] text-neutral-400 font-bold tracking-wider font-mono uppercase">
            Raw Compiled Card &amp; AiriExtension Payload
          </span>
          <span class="text-[10px] text-primary-400 font-bold font-mono">
            Vessel: {{ resolvedVesselName }} | Persona: {{ resolvedPersona.name }}
          </span>
        </div>
        <textarea
          readonly
          :value="JSON.stringify(compiledCardPayload, null, 2)"
          class="h-64 w-full resize-none border-none bg-transparent pt-1.5 text-[11px] text-emerald-400 font-mono outline-none"
        />
      </div>
    </div>

    <p class="pb-1 text-center text-[10px] text-neutral-400 italic">
      Launches AIRI Stage and commits your custom setup.
    </p>
  </div>
</template>
