<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import CompanionBubble from '../components/companion-bubble.vue'

import { useAiriCardStore } from '../../../../../../stores/modules/airi-card'
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
const onboardingStore = useOnboardingStore()
const draftStore = useOnboardingV2Draft()

const badges = [
  { label: 'Consciousness', icon: 'i-solar:cpu-bolt-bold-duotone' },
  { label: 'Hearing', icon: 'i-solar:microphone-3-bold-duotone' },
  { label: 'Speech', icon: 'i-solar:soundwave-bold-duotone' },
  { label: 'Avatar Model', icon: 'i-solar:people-nearby-bold-duotone' },
  { label: 'Personality Soul', icon: 'i-solar:heart-bold-duotone' },
]

const companionName = 'ReLU'
const userName = computed(() => userProfileStore.name || 'Manager')

// Simulated typewriter greeting
const fullGreeting = computed(() => `Hello ${userName.value}! I'm ${companionName}. Everything is warmed up and ready — I'm ready whenever you are!`)
const typedGreeting = ref('')
let typeTimer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  let i = 0
  typeTimer = setInterval(() => {
    i++
    typedGreeting.value = fullGreeting.value.slice(0, i)
    if (i >= fullGreeting.value.length)
      clearInterval(typeTimer)
  }, 28)
})

onBeforeUnmount(() => clearInterval(typeTimer))

async function handleFinish() {
  const draft = draftStore.state

  if (draft.userProfile.name) {
    userProfileStore.name = draft.userProfile.name
  }

  if (draft.persona.importedCardDraft) {
    const cardId = await cardStore.addCard(draft.persona.importedCardDraft)
    cardStore.activeCardId = cardId
  }
  else if (draft.persona.cardId) {
    cardStore.activeCardId = draft.persona.cardId
  }
  else {
    const cardId = await cardStore.addCard({
      name: companionName,
      description: 'Your default AI companion on stage.',
      personality: 'Friendly, caring, and bright assistant.',
      greetings: [fullGreeting.value],
      version: '1.0.0',
      extensions: {
        airi: {
          agents: {},
          modules: {
            displayModelId: draft.vessel.displayModelId || 'hiyori-free',
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
    })
    cardStore.activeCardId = cardId
  }

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
    <p class="pb-1 text-center text-[10px] text-neutral-400 italic">
      Launches AIRI Stage and commits your custom setup.
    </p>
  </div>
</template>
