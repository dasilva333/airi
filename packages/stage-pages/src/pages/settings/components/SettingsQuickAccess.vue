<script setup lang="ts">
import { isStageTamagotchi } from '@proj-airi/stage-shared'
import { useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { useSpeechStore } from '@proj-airi/stage-ui/stores/modules/speech'
import { useOnboardingStore } from '@proj-airi/stage-ui/stores/onboarding'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

interface QuickAccessItem {
  id: string
  title: string
  icon: string
  to: string
  hasModal?: boolean
}

const router = useRouter()
const route = useRoute()
const cardStore = useAiriCardStore()
const onboardingStore = useOnboardingStore()
const { activeCardId } = storeToRefs(cardStore)

const isVoiceModalOpen = ref(false)
const isFreeAiModalOpen = ref(false)
const isCharacterWizardModalOpen = ref(false)

// Deep-link: `/settings?freeAi=open` (or `?action=free-ai`) auto-opens the Free AI picker.
// The portrait provider nudge routes here so new users land on zero-cost options.
watch(
  () => route.query.freeAi,
  (freeAi) => {
    if (freeAi === 'open' || freeAi === '1' || freeAi === '') {
      isFreeAiModalOpen.value = true
      const { freeAi: _omit, ...rest } = route.query
      router.replace({ query: rest })
    }
  },
  { immediate: true },
)

watch(
  () => route.query.action,
  (action) => {
    if (action === 'free-ai') {
      isFreeAiModalOpen.value = true
      const { action: _omitAction, ...rest } = route.query
      router.replace({ query: rest })
    }
  },
  { immediate: true },
)

const characterWizards = [
  {
    id: 'companion-wizard',
    name: 'Companion Wizard',
    icon: 'i-solar:stars-line-bold-duotone',
    accent: 'text-purple-500 dark:text-purple-400',
    tag: 'RECOMMENDED · 19 STEPS',
    tagBg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    desc: 'Full-spectrum guided setup sequence for mind, voice, 3D avatar, and persona.',
    badges: ['🌟 Full Experience', '🎭 Persona & Mind', '🚀 Dedicated Window'],
    action: 'companion',
  },
  {
    id: 'animadex-wizard',
    name: 'AnimaDex Wizard',
    icon: 'i-solar:planet-3-bold-duotone',
    accent: 'text-cyan-500 dark:text-cyan-400',
    tag: 'AI SYNTHESIZER · 36K',
    tagBg: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
    desc: 'Synthesize a roleplay card from the 36k anime character catalog with story tropes.',
    badges: ['✨ 36k Anime Cast', '🤖 Story Prompts', '📖 Trope Suggestions'],
    to: '/settings/airi-card/guided',
  },
  {
    id: 'card-hub-importer',
    name: 'Card Hub Importer',
    icon: 'i-solar:folder-with-files-bold-duotone',
    accent: 'text-amber-500 dark:text-amber-400',
    tag: 'COMMUNITY · CCv2 / CCv3',
    tagBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    desc: 'Browse Chub.ai / CharacterHub and import SillyTavern CCv2/CCv3 PNG or JSON cards.',
    badges: ['🎴 SillyTavern V2', '🌐 Chub / Hub Browser', '📦 Drag & Drop'],
    to: '/settings/airi-card/import-hub',
  },
]

function selectCharacterWizard(wizard: (typeof characterWizards)[number]) {
  isCharacterWizardModalOpen.value = false
  if (wizard.action === 'companion') {
    onboardingStore.resetSetupState()
    onboardingStore.forceShowSetup()
    if (typeof window !== 'undefined' && (window as any).electron?.ipcRenderer) {
      void (window as any).electron.ipcRenderer.invoke('eventa:invoke:electron:windows:onboarding:open').catch(() => {})
    }
    return
  }
  if (wizard.to) {
    router.push(wizard.to)
  }
}

const localVoiceEngines = [
  {
    id: 'pocket',
    providerId: 'pocket-tts-local',
    name: 'Pocket-TTS Local',
    icon: 'i-solar:microphone-3-bold-duotone',
    accent: 'text-emerald-500 dark:text-emerald-400',
    tag: 'VOICE CLONE',
    tagBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    desc: 'Local speech with support for voice samples.',
    badges: ['🇺🇸 EN', '🇫🇷 FR', '🇪🇸 ES', '🇩🇪 DE', '🇮🇹 IT', '🇯🇵 JA · Sakura'],
    to: '/settings/providers/speech/pocket-tts-local',
  },
  {
    id: 'kokoro',
    providerId: 'kokoro-local',
    name: 'Kokoro Local TTS',
    icon: 'i-solar:heart-bold-duotone',
    accent: 'text-pink-500 dark:text-pink-400',
    tag: 'PRESET VOICES',
    tagBg: 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20',
    desc: 'Expressive English voices.',
    badges: ['🇺🇸 EN (US)', '🇬🇧 EN (UK)'],
    to: '/settings/providers/speech/kokoro-local',
  },
  {
    id: 'moss',
    providerId: 'moss-nano-local',
    name: 'MOSS-Nano Local',
    icon: 'i-solar:bolt-bold-duotone',
    accent: 'text-amber-500 dark:text-amber-400',
    tag: 'VOICE CLONE',
    tagBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    desc: 'Local speech with reference-audio voices.',
    badges: ['🇺🇸 EN', '🇨🇳 ZH'],
    to: '/settings/providers/speech/moss-nano-local',
  },
  {
    id: 'ming',
    providerId: 'ming3-local',
    name: 'Ming 3.0',
    icon: 'i-solar:stars-bold-duotone',
    accent: 'text-violet-500 dark:text-violet-400',
    tag: 'VOICE DESIGN',
    tagBg: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
    desc: 'Design a voice in words, or choose a built-in speaker.',
    badges: ['🇨🇳 ZH', '🇺🇸 EN', '🇯🇵 JA', '🇰🇷 KO', '🇩🇪 DE', '🇫🇷 FR', '🇪🇸 ES'],
    to: '/settings/providers/speech/ming3-local',
  },
]

function selectEngine(to: string) {
  isVoiceModalOpen.value = false
  router.push(to)
}

// Highlights the card/row matching the currently active speech provider.
const speechStore = useSpeechStore()
function isActiveEngine(engine: (typeof localVoiceEngines)[number]) {
  try {
    const active = speechStore.activeSpeechProvider as unknown as string | undefined
    if (!active)
      return false
    const baseId = active.includes(':') ? active.split(':')[0] : active
    return baseId === engine.providerId
  }
  catch {
    return false
  }
}

// Row 1: Core Character & Services
const row1Items = computed<QuickAccessItem[]>(() => [
  {
    id: 'user-profile',
    title: 'User Profile',
    icon: 'i-solar:user-bold-duotone',
    to: '/settings/system/user-profile',
  },
  {
    id: 'character-config',
    title: 'Character Config',
    icon: 'i-solar:pen-bold-duotone',
    to: '/settings/airi-card/edit',
  },
  {
    id: 'character-wizard',
    title: 'Guided Tours',
    icon: 'i-solar:magic-stick-3-bold-duotone',
    to: '/settings/airi-card/guided',
    hasModal: true,
  },
  {
    // NOTICE: Discord Bot retired from quick access while Friends is in
    // active development; the route still exists at
    // /settings/modules/messaging-discord for existing users.
    id: 'friends-companions',
    title: 'Friends',
    icon: 'i-solar:users-group-rounded-bold-duotone',
    to: '/settings/modules/messaging-friends',
  },
  {
    id: 'cloud-sync',
    title: 'Cloud Sync',
    icon: 'i-solar:cloud-bold-duotone',
    to: '/settings/modules/cloud-sync',
  },
])

// Detection for iOS (iPad/iPhone/iPod)
const isIOS = typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

const freeAiEngines = computed(() => [
  {
    id: 'free-hub',
    name: 'Free AI Hub',
    icon: 'i-solar:planet-3-bold-duotone',
    accent: 'text-cyan-500 dark:text-cyan-400',
    tag: 'CLOUD · 50+ MODELS',
    tagBg: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
    desc: 'Curated zero-cost cloud LLMs with no setup or local hardware required.',
    badges: ['⚡ High RPM', '☁️ Zero VRAM', '🆓 Free Forever'],
    to: '/settings/providers/free-hub',
  },
  {
    id: 'web-llm',
    name: isIOS ? 'Apple Core AI' : 'WebLLM Local',
    icon: isIOS ? 'i-solar:apple-bold' : 'i-solar:cpu-bolt-bold-duotone',
    accent: 'text-emerald-500 dark:text-emerald-400',
    tag: isIOS ? 'APPLE SILICON' : 'WEBGPU · OFFLINE',
    tagBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    desc: isIOS
      ? 'On-device Apple Foundation Models running privately on Apple Silicon.'
      : 'Run open-weight models (Llama, Qwen, Gemma) in-browser with zero install.',
    badges: ['🔒 100% Private', '💻 Local VRAM', '🔌 Air-Gapped'],
    to: isIOS ? '/settings/providers/chat/apple-core-ai' : '/settings/providers/chat/web-llm',
  },
  {
    id: 'web-rwkv',
    name: 'Web-RWKV Local',
    icon: 'i-solar:atom-bold-duotone',
    accent: 'text-purple-500 dark:text-purple-400',
    tag: 'RNN · LINEAR',
    tagBg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    desc: 'Ultra-low VRAM linear attention RNN engine running locally on WebGPU.',
    badges: ['🧠 Constant VRAM', '🚀 Fast Token Gen', '⚡ WebGPU'],
    to: '/settings/providers/chat/web-rwkv',
  },
])

function selectFreeAiEngine(to: string) {
  isFreeAiModalOpen.value = false
  router.push(to)
}

// Row 2: Audio & Discovery
const row2Items = computed<QuickAccessItem[]>(() => [
  {
    id: 'audio-studio',
    title: 'Voice Profiles',
    icon: 'i-solar:soundwave-bold-duotone',
    to: '/settings/providers/speech/virtual-audio-studio',
  },
  {
    id: 'local-voice',
    title: 'Local Voice',
    icon: 'i-solar:volume-loud-bold-duotone',
    to: isStageTamagotchi()
      ? '/settings/providers/speech/kokoro-local'
      : '/settings/providers/speech/pocket-tts-local',
    hasModal: true,
  },
  {
    id: 'local-hearing',
    title: 'Local Hearing',
    icon: 'i-solar:microphone-3-bold-duotone',
    to: '/settings/providers/transcription/whisper-local',
  },
  {
    id: 'free-ai',
    title: 'Free AI',
    icon: 'i-solar:cpu-bolt-bold-duotone',
    to: '/settings/providers/free-hub',
    hasModal: true,
  },
  {
    id: 'discover-models',
    title: 'Get Free Avatars',
    icon: 'i-solar:planet-3-bold-duotone',
    to: '/settings/models/explore',
  },
])

function navigate(target: string | QuickAccessItem) {
  if (typeof target === 'object') {
    if (target.id === 'character-config') {
      const targetId = activeCardId.value || cardStore.resolveCardId()
      router.push({ path: '/settings/airi-card/edit', query: { id: targetId } })
      return
    }
    if (target.id === 'character-wizard') {
      isCharacterWizardModalOpen.value = true
      return
    }
    if (target.id === 'local-voice') {
      isVoiceModalOpen.value = true
      return
    }
    if (target.id === 'free-ai') {
      isFreeAiModalOpen.value = true
      return
    }
    router.push(target.to)
    return
  }
  router.push(target)
}
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <!-- Row 1: Core & Services -->
    <div class="grid grid-cols-5 gap-1.5">
      <button
        v-for="item in row1Items"
        :key="item.id"
        :class="[
          'group relative flex flex-col items-center justify-center overflow-hidden rounded-xl px-1 py-2 min-h-19 text-center transition-all duration-300',
          'border border-neutral-200/80 bg-white/70 shadow-2xs',
          'dark:border-neutral-800/80 dark:bg-neutral-900/60',
          'hover:border-primary-500/40 dark:hover:border-primary-400/40',
          'hover:bg-primary-500/8 dark:hover:bg-primary-500/15',
          'hover:-translate-y-0.5 hover:shadow-sm',
        ]"
        @click="navigate(item)"
      >
        <!-- Multi-layer indicator overlay in top-right corner -->
        <div
          v-if="item.hasModal"
          :class="[
            'pointer-events-none absolute right-1.5 top-1.5 transition-all duration-200',
            'text-neutral-400/70 dark:text-neutral-500/80',
            'group-hover:text-primary-500 dark:group-hover:text-primary-400 group-hover:scale-110',
          ]"
        >
          <div class="i-solar:layers-minimalistic-bold-duotone size-3" />
        </div>

        <div
          :class="[
            'h-7 w-7 flex shrink-0 items-center justify-center rounded-lg transition-all duration-300',
            'bg-primary-500/10 text-primary-500',
            'dark:bg-primary-500/15 dark:text-primary-400',
            'group-hover:bg-primary-500/20 dark:group-hover:bg-primary-500/30 group-hover:scale-110',
          ]"
        >
          <div :class="item.icon" class="text-base" />
        </div>
        <span class="line-clamp-2 mt-1 w-full text-[10px] text-neutral-800 font-medium leading-3 transition-colors duration-300 dark:text-neutral-100 group-hover:text-primary-600 dark:group-hover:text-primary-300">
          {{ item.title }}
        </span>
      </button>
    </div>

    <!-- Row 2: Audio & Discovery -->
    <div class="grid grid-cols-5 gap-1.5">
      <button
        v-for="item in row2Items"
        :key="item.id"
        :class="[
          'group relative flex flex-col items-center justify-center overflow-hidden rounded-xl px-1 py-2 min-h-19 text-center transition-all duration-300',
          'border border-neutral-200/80 bg-white/70 shadow-2xs',
          'dark:border-neutral-800/80 dark:bg-neutral-900/60',
          'hover:border-primary-500/40 dark:hover:border-primary-400/40',
          'hover:bg-primary-500/8 dark:hover:bg-primary-500/15',
          'hover:-translate-y-0.5 hover:shadow-sm',
        ]"
        @click="navigate(item)"
      >
        <!-- Multi-layer indicator overlay in top-right corner -->
        <div
          v-if="item.hasModal"
          :class="[
            'pointer-events-none absolute right-1.5 top-1.5 transition-all duration-200',
            'text-neutral-400/70 dark:text-neutral-500/80',
            'group-hover:text-primary-500 dark:group-hover:text-primary-400 group-hover:scale-110',
          ]"
        >
          <div class="i-solar:layers-minimalistic-bold-duotone size-3" />
        </div>

        <div
          :class="[
            'h-7 w-7 flex shrink-0 items-center justify-center rounded-lg transition-all duration-300',
            'bg-primary-500/10 text-primary-500',
            'dark:bg-primary-500/15 dark:text-primary-400',
            'group-hover:bg-primary-500/20 dark:group-hover:bg-primary-500/30 group-hover:scale-110',
          ]"
        >
          <div :class="item.icon" class="text-base" />
        </div>
        <span class="line-clamp-2 mt-1 w-full text-[10px] text-neutral-800 font-medium leading-3 transition-colors duration-300 dark:text-neutral-100 group-hover:text-primary-600 dark:group-hover:text-primary-300">
          {{ item.title }}
        </span>
      </button>
    </div>

    <!-- Local Voice Selection Modal -->
    <Teleport to="body">
      <div
        v-if="isVoiceModalOpen"
        class="pointer-events-auto fixed inset-0 z-[999999] flex animate-fadeIn items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        @pointerdown.stop
        @mousedown.stop
        @touchstart.stop
        @click.stop.self="isVoiceModalOpen = false"
      >
        <div
          class="max-h-[85dvh] max-w-3xl w-full flex flex-col gap-5 overflow-y-auto border border-neutral-200/80 rounded-3xl bg-white p-6 shadow-2xl dark:border-neutral-800/80 dark:bg-neutral-900"
          @pointerdown.stop
          @mousedown.stop
          @touchstart.stop
          @click.stop
        >
          <!-- Header -->
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="size-11 flex shrink-0 items-center justify-center rounded-2xl bg-primary-500/10 text-primary-500 dark:bg-primary-500/20">
                <div class="i-solar:volume-loud-bold-duotone size-6" />
              </div>
              <div>
                <h3 class="text-base text-neutral-900 font-bold dark:text-white">
                  Local Voice Engines
                </h3>
                <p class="text-xs text-neutral-500 dark:text-neutral-400">
                  Choose an engine to configure its models and voices.
                </p>
              </div>
            </div>
            <button
              type="button"
              class="cursor-pointer rounded-xl p-2 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
              @click="isVoiceModalOpen = false"
            >
              <div class="i-solar:close-circle-linear size-5" />
            </button>
          </div>

          <!-- 4 Engine Hero Cards: 2×2 on desktop, compact list on mobile -->
          <div class="grid-cols-2 gap-3.5 hidden sm:grid">
            <button
              v-for="engine in localVoiceEngines"
              :key="engine.id"
              type="button"
              :class="[
                'group relative flex flex-col justify-between text-left rounded-2xl p-4.5 transition-all duration-200 cursor-pointer',
                isActiveEngine(engine)
                  ? 'border-2 border-primary-500/70 bg-white dark:border-primary-400/70 dark:bg-neutral-800'
                  : 'border border-neutral-200/80 bg-neutral-50/70 dark:border-neutral-800 dark:bg-neutral-800/40',
                'hover:border-primary-500/60 dark:hover:border-primary-400/60 hover:bg-white dark:hover:bg-neutral-800',
                'hover:-translate-y-1 hover:shadow-lg',
              ]"
              @click="selectEngine(engine.to)"
            >
              <!-- Card Top: Icon, Tag & Chevron -->
              <div class="flex items-start gap-2">
                <div :class="['size-10 flex shrink-0 items-center justify-center rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-700/60 shadow-xs transition-transform group-hover:scale-105', engine.accent]">
                  <div :class="[engine.icon, 'size-5']" />
                </div>
                <span v-if="engine.tag" :class="['ml-auto text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-md border uppercase', engine.tagBg]">
                  {{ engine.tag }}
                </span>
                <div class="i-solar:arrow-right-line-duotone shrink-0 text-lg text-neutral-400 transition-transform group-hover:translate-x-0.5 dark:text-neutral-500" :class="engine.tag ? '' : 'ml-auto'" />
              </div>

              <!-- Card Content: Name & Description -->
              <div class="mb-3 mt-3.5 flex flex-col gap-1">
                <span class="text-[15px] text-neutral-900 font-bold transition-colors dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400">
                  {{ engine.name }}
                </span>
                <p class="text-xs text-neutral-500 leading-relaxed dark:text-neutral-400">
                  {{ engine.desc }}
                </p>
              </div>

              <!-- Card Bottom: Language Badges -->
              <div class="flex flex-wrap gap-1.5">
                <span
                  v-for="badge in engine.badges"
                  :key="badge"
                  class="rounded-md bg-neutral-200/60 px-2 py-1 text-[10px] text-neutral-600 font-mono dark:bg-white/5 dark:text-neutral-400"
                >
                  {{ badge }}
                </span>
              </div>
            </button>
          </div>

          <!-- Mobile: compact engine list -->
          <div class="flex flex-col gap-2.5 sm:hidden">
            <button
              v-for="engine in localVoiceEngines"
              :key="engine.id"
              type="button"
              :class="[
                'group relative flex items-start gap-3 rounded-2xl p-3.5 text-left transition-all duration-200 cursor-pointer',
                isActiveEngine(engine)
                  ? 'border-2 border-primary-500/70 bg-white dark:border-primary-400/70 dark:bg-neutral-800'
                  : 'border border-neutral-200/80 bg-neutral-50/70 dark:border-neutral-800 dark:bg-neutral-800/40',
                'active:bg-white dark:active:bg-neutral-800',
              ]"
              @click="selectEngine(engine.to)"
            >
              <div :class="['size-10 flex shrink-0 items-center justify-center rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-700/60 shadow-xs', engine.accent]">
                <div :class="[engine.icon, 'size-5']" />
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <span class="truncate text-sm text-neutral-900 font-bold dark:text-white">
                    {{ engine.name }}
                  </span>
                  <span v-if="engine.tag" :class="['ml-auto shrink-0 text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-md border uppercase', engine.tagBg]">
                    {{ engine.tag }}
                  </span>
                </div>
                <p class="mt-1 text-xs text-neutral-500 leading-relaxed dark:text-neutral-400">
                  {{ engine.desc }}
                </p>
                <div class="mt-2 flex flex-wrap gap-1.5">
                  <span
                    v-for="badge in engine.badges"
                    :key="badge"
                    class="rounded-md bg-neutral-200/60 px-2 py-1 text-[10px] text-neutral-600 font-mono dark:bg-white/5 dark:text-neutral-400"
                  >
                    {{ badge }}
                  </span>
                </div>
              </div>
            </button>
          </div>

          <!-- Footer note -->
          <div class="mt-1 flex items-center gap-2 border-t border-neutral-200/60 pt-4 text-xs text-neutral-500 dark:border-neutral-700/40 dark:text-neutral-400">
            <div class="i-solar:download-minimalistic-bold-duotone shrink-0 text-base" />
            <span>Models download during setup.</span>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Free AI Selection Modal -->
    <Teleport to="body">
      <div
        v-if="isFreeAiModalOpen"
        class="pointer-events-auto fixed inset-0 z-[999999] flex animate-fadeIn items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        @pointerdown.stop
        @mousedown.stop
        @touchstart.stop
        @click.stop.self="isFreeAiModalOpen = false"
      >
        <div
          class="max-w-3xl w-full flex flex-col gap-5 border border-neutral-200/80 rounded-3xl bg-white p-6 shadow-2xl dark:border-neutral-800/80 dark:bg-neutral-900"
          @pointerdown.stop
          @mousedown.stop
          @touchstart.stop
          @click.stop
        >
          <!-- Header -->
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="size-11 flex shrink-0 items-center justify-center rounded-2xl bg-primary-500/10 text-primary-500 dark:bg-primary-500/20">
                <div class="i-solar:cpu-bolt-bold-duotone size-6" />
              </div>
              <div>
                <h3 class="text-base text-neutral-900 font-bold dark:text-white">
                  Free AI Options
                </h3>
                <p class="text-xs text-neutral-500 dark:text-neutral-400">
                  Select a zero-cost cloud hub or private local in-browser model engine
                </p>
              </div>
            </div>
            <button
              type="button"
              class="cursor-pointer rounded-xl p-2 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
              @click="isFreeAiModalOpen = false"
            >
              <div class="i-solar:close-circle-linear size-5" />
            </button>
          </div>

          <!-- 3 Engine Hero Cards -->
          <div class="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            <button
              v-for="engine in freeAiEngines"
              :key="engine.id"
              type="button"
              :class="[
                'group relative flex flex-col justify-between text-left rounded-2xl p-4.5 transition-all duration-200 cursor-pointer',
                'border border-neutral-200/80 bg-neutral-50/70 dark:border-neutral-800 dark:bg-neutral-800/40',
                'hover:border-primary-500/60 dark:hover:border-primary-400/60 hover:bg-white dark:hover:bg-neutral-800',
                'hover:-translate-y-1 hover:shadow-lg',
              ]"
              @click="selectFreeAiEngine(engine.to)"
            >
              <!-- Card Top: Icon & Tag -->
              <div class="flex items-start justify-between gap-2">
                <div :class="['size-10 flex shrink-0 items-center justify-center rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-700/60 shadow-xs transition-transform group-hover:scale-105', engine.accent]">
                  <div :class="[engine.icon, 'size-5']" />
                </div>
                <span :class="['text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-md border uppercase', engine.tagBg]">
                  {{ engine.tag }}
                </span>
              </div>

              <!-- Card Content: Name & Description -->
              <div class="mb-3 mt-3.5 flex flex-col gap-1">
                <span class="text-sm text-neutral-900 font-bold transition-colors dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400">
                  {{ engine.name }}
                </span>
                <p class="text-xs text-neutral-500 leading-relaxed dark:text-neutral-400">
                  {{ engine.desc }}
                </p>
              </div>

              <!-- Card Bottom: Feature Badges -->
              <div class="mt-auto flex flex-wrap gap-1 border-t border-neutral-200/60 pt-3 dark:border-neutral-700/40">
                <span
                  v-for="badge in engine.badges"
                  :key="badge"
                  class="rounded bg-neutral-200/60 px-1.5 py-0.5 text-[10px] text-neutral-600 font-mono dark:bg-white/5 dark:text-neutral-400"
                >
                  {{ badge }}
                </span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Guided Tours Selection Modal -->
    <Teleport to="body">
      <div
        v-if="isCharacterWizardModalOpen"
        class="pointer-events-auto fixed inset-0 z-[999999] flex animate-fadeIn items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        @pointerdown.stop
        @mousedown.stop
        @touchstart.stop
        @click.stop.self="isCharacterWizardModalOpen = false"
      >
        <div
          class="max-w-3xl w-full flex flex-col gap-5 border border-neutral-200/80 rounded-3xl bg-white p-6 shadow-2xl dark:border-neutral-800/80 dark:bg-neutral-900"
          @pointerdown.stop
          @mousedown.stop
          @touchstart.stop
          @click.stop
        >
          <!-- Header -->
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="size-11 flex shrink-0 items-center justify-center rounded-2xl bg-primary-500/10 text-primary-500 dark:bg-primary-500/20">
                <div class="i-solar:magic-stick-3-bold-duotone size-6" />
              </div>
              <div>
                <h3 class="text-base text-neutral-900 font-bold dark:text-white">
                  Guided Tours
                </h3>
                <p class="text-xs text-neutral-500 dark:text-neutral-400">
                  Select a workflow to create or import your companion character
                </p>
              </div>
            </div>
            <button
              type="button"
              class="cursor-pointer rounded-xl p-2 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
              @click="isCharacterWizardModalOpen = false"
            >
              <div class="i-solar:close-circle-linear size-5" />
            </button>
          </div>

          <!-- 3 Wizard Hero Cards -->
          <div class="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            <button
              v-for="wizard in characterWizards"
              :key="wizard.id"
              type="button"
              :class="[
                'group relative flex flex-col justify-between text-left rounded-2xl p-4.5 transition-all duration-200 cursor-pointer',
                'border border-neutral-200/80 bg-neutral-50/70 dark:border-neutral-800 dark:bg-neutral-800/40',
                'hover:border-primary-500/60 dark:hover:border-primary-400/60 hover:bg-white dark:hover:bg-neutral-800',
                'hover:-translate-y-1 hover:shadow-lg',
              ]"
              @click="selectCharacterWizard(wizard)"
            >
              <!-- Card Top: Icon & Tag -->
              <div class="flex items-start justify-between gap-2">
                <div :class="['size-10 flex shrink-0 items-center justify-center rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-700/60 shadow-xs transition-transform group-hover:scale-105', wizard.accent]">
                  <div :class="[wizard.icon, 'size-5']" />
                </div>
                <span :class="['text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-md border uppercase', wizard.tagBg]">
                  {{ wizard.tag }}
                </span>
              </div>

              <!-- Card Content: Name & Description -->
              <div class="mb-3 mt-3.5 flex flex-col gap-1">
                <span class="text-sm text-neutral-900 font-bold transition-colors dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400">
                  {{ wizard.name }}
                </span>
                <p class="text-xs text-neutral-500 leading-relaxed dark:text-neutral-400">
                  {{ wizard.desc }}
                </p>
              </div>

              <!-- Card Bottom: Feature Badges -->
              <div class="mt-auto flex flex-wrap gap-1 border-t border-neutral-200/60 pt-3 dark:border-neutral-700/40">
                <span
                  v-for="badge in wizard.badges"
                  :key="badge"
                  class="rounded bg-neutral-200/60 px-1.5 py-0.5 text-[10px] text-neutral-600 font-mono dark:bg-white/5 dark:text-neutral-400"
                >
                  {{ badge }}
                </span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
