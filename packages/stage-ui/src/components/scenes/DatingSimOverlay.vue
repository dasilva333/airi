<script setup lang="ts">
import { useBroadcastChannel } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import CaptionPanel from './CaptionPanel.vue'
import ModeSelectorModal from './ModeSelectorModal.vue'
import StorySelectorModal from './StorySelectorModal.vue'

import { useChatSessionStore } from '../../stores/chat/session-store'
import { useDatingSimStore } from '../../stores/dating-sim'
import { useAiriCardStore } from '../../stores/modules/airi-card'

const datingSimStore = useDatingSimStore()
const cardStore = useAiriCardStore()
const chatSessionStore = useChatSessionStore()
const { post: postChatInput } = useBroadcastChannel({ name: 'airi-chat-input-bridge' })

// Broadcast channels to track active caption streaming
const { data: captionData } = useBroadcastChannel<any, any>({ name: 'airi-caption-overlay' })
const { data: sessionUpdate } = useBroadcastChannel<any, any>({ name: 'airi-chat-stream' })
const hasActiveCaption = ref(false)

watch(sessionUpdate, (event) => {
  if (event?.type === 'session-updated' && event.message?.role === 'user') {
    hasActiveCaption.value = false
  }
})

watch(captionData, (event) => {
  if (!event)
    return
  if (event.type === 'caption-assistant') {
    if (!event.segments || event.segments.length === 0) {
      hasActiveCaption.value = false
    }
    else {
      // Since CaptionPanel filters to active segments only, check if there is any active segment
      hasActiveCaption.value = event.segments.some((s: any) => s.isActive)
    }
  }
}, { immediate: true })

const visibleChoices = computed(() => {
  return datingSimStore.choices.filter((c: any) => datingSimStore.evaluateCondition(c.condition))
})

const autonomousEnabled = computed(() => {
  return cardStore.activeCard?.extensions?.airi?.artistry?.autonomousEnabled ?? false
})

const timerPercentage = computed(() => {
  return Math.min(100, Math.max(0, (datingSimStore.getVariable('Timer') / 10) * 100))
})

const turnsElapsed = computed(() => {
  const msgs = chatSessionStore.messages || []
  return msgs.filter((m: any) => m.role === 'assistant').length
})

const lastAssistantMessage = computed(() => {
  const msgs = chatSessionStore.messages || []
  const assistantMsgs = msgs.filter((m: any) => m.role === 'assistant')
  const content = assistantMsgs[assistantMsgs.length - 1]?.content
  if (!content)
    return ''
  let rawText = ''
  if (typeof content === 'string') {
    rawText = content
  }
  else if (Array.isArray(content)) {
    rawText = content
      .map((part: any) => (typeof part === 'string' ? part : (part.text || '')))
      .join('')
  }
  return rawText.replace(/<\|.*?\|>/g, '').trim()
})

const isInitialTurn = computed(() => {
  return turnsElapsed.value === 0
})

const isGameOver = computed(() => {
  if (datingSimStore.settings.gameMode !== 'goal_driven')
    return false
  const pos = datingSimStore.getVariable('positiveScore')
  const neg = datingSimStore.getVariable('negativeScore')
  const turns = turnsElapsed.value
  const maxScore = datingSimStore.settings.maxScore
  const maxTurns = datingSimStore.settings.maxTurns
  return pos >= maxScore || neg >= maxScore || turns >= maxTurns
})

const subtitleText = computed(() => {
  if (isGameOver.value && datingSimStore.activeStoryline) {
    if (lastAssistantMessage.value) {
      return lastAssistantMessage.value
    }
    const pos = datingSimStore.getVariable('positiveScore')
    const neg = datingSimStore.getVariable('negativeScore')
    if (pos > neg) {
      return datingSimStore.activeStoryline.positiveOutcome || 'Victory!'
    }
    else {
      return datingSimStore.activeStoryline.negativeOutcome || 'Defeat!'
    }
  }
  return datingSimStore.currentSubtitle
})

const containerBottomClass = computed(() => {
  return (datingSimStore.settings.inlineCaption && (datingSimStore.currentSubtitle || isGameOver.value || hasActiveCaption.value))
    ? 'bottom-[280px]'
    : 'bottom-[40px]'
})

const isExpanded = ref(false)
watch(() => subtitleText.value, () => {
  isExpanded.value = false
})

function handleChoiceClick(choice: any) {
  // Live2D DSL menus are rendered here but resolved by the VM. Route the click back via
  // the store bridge and skip all dating-sim scoring/LLM side-effects for these choices.
  if (typeof choice.id === 'string' && choice.id.startsWith('dsl:')) {
    const choiceIndex = Number(choice.id.split(':').pop())
    datingSimStore.postDslChoiceSelected(choiceIndex)
    datingSimStore.choices = []
    datingSimStore.currentSubtitle = ''
    return
  }

  if (typeof choice.positiveScoreChange === 'number') {
    datingSimStore.setVariable('positiveScore', datingSimStore.getVariable('positiveScore') + choice.positiveScoreChange)
  }
  if (typeof choice.negativeScoreChange === 'number') {
    datingSimStore.setVariable('negativeScore', datingSimStore.getVariable('negativeScore') + choice.negativeScoreChange)
  }

  let intimacyDelta = 1
  if (choice.action === 'llm_topic') {
    intimacyDelta = 2
  }
  else if (choice.action === 'llm_item') {
    intimacyDelta = 5
  }
  datingSimStore.setVariable('Intimacy', Math.min(100, datingSimStore.getVariable('Intimacy') + intimacyDelta))

  postChatInput({ sendingMessage: choice.text, options: { skipAssistant: false, metadata: { source: 'dating-sim' } } })

  if (!autonomousEnabled.value) {
    datingSimStore.evaluateParameters(choice.text)
  }

  datingSimStore.setVariable('Timer', 0)
  datingSimStore.choices = []
  datingSimStore.currentSubtitle = ''
}

async function handleRestart() {
  datingSimStore.activeStoryline = null
  datingSimStore.setVariable('positiveScore', 0)
  datingSimStore.setVariable('negativeScore', 0)
  datingSimStore.setVariable('turnsElapsed', 0)
  datingSimStore.choices = []
  datingSimStore.currentSubtitle = ''

  if (cardStore.activeCardId) {
    await chatSessionStore.createSession(cardStore.activeCardId, { title: 'Dating Sim' })
  }

  showSelector.value = true
}

const customPrompt = ref('')
function submitCustomPrompt() {
  if (!customPrompt.value.trim() || isGameOver.value)
    return

  // Synthesize a zero-weight llm_topic choice and route it through handleChoiceClick.
  // This guarantees the exact same code path as clicking a real choice: same state
  // clearing, same Director pipeline trigger, same timing — no race conditions.
  const text = customPrompt.value
  customPrompt.value = ''
  handleChoiceClick({
    id: 'custom',
    text,
    action: 'llm_topic',
    positiveScoreChange: 0,
    negativeScoreChange: 0,
  })
}

const showSelector = ref(false)
const showModeSelector = ref(false)

watch(() => datingSimStore.enabled, (enabled) => {
  if (enabled) {
    showModeSelector.value = true
  }
  else {
    showModeSelector.value = false
  }
})

function handleModeSelect(mode: 'open_ended' | 'goal_driven') {
  showModeSelector.value = false
  datingSimStore.settings.gameMode = mode
  if (mode === 'open_ended') {
    datingSimStore.generateLiveChoices()
  }
}

function handleModeClose() {
  showModeSelector.value = false
  datingSimStore.disable()
}

watch(() => [datingSimStore.enabled, datingSimStore.settings.gameMode, datingSimStore.activeStoryline, showModeSelector.value], ([enabled, mode, storyline, modeSelectorOpen]) => {
  if (enabled && mode === 'goal_driven' && !storyline && !modeSelectorOpen) {
    showSelector.value = true
  }
  else {
    showSelector.value = false
  }
}, { immediate: true })

function handleStorySelect(story: any, customPromptVal: string) {
  showSelector.value = false
  datingSimStore.activeStoryline = story
  datingSimStore.generateInitialGoalDrivenChoices(customPromptVal)
}
</script>

<template>
  <div v-if="datingSimStore.enabled" class="pointer-events-none absolute inset-0 z-50 flex flex-col justify-end overflow-hidden pb-8">
    <!-- Background cover image (Goal-Driven initial phase) -->
    <div
      v-if="datingSimStore.settings.gameMode === 'goal_driven' && datingSimStore.activeStoryline && isInitialTurn && (datingSimStore.resolvedSceneryRoute === 'background' || datingSimStore.resolvedSceneryRoute === 'bg_widget')"
      class="absolute inset-0 h-full w-full transition-opacity duration-1000 -z-10"
    >
      <img
        :src="datingSimStore.activeStoryline.coverImage"
        class="h-full w-full object-cover opacity-100"
        alt="Storyline Background"
      >
    </div>

    <!-- Top-Right Floating Stats -->
    <div class="pointer-events-auto absolute right-8 top-6 flex flex-col gap-4">
      <!-- GOAL DRIVEN HUD -->
      <template v-if="datingSimStore.settings.gameMode === 'goal_driven'">
        <!-- Positive (Intimacy) Badge -->
        <div class="min-w-[220px] flex flex-col gap-3 border border-white/20 rounded-2xl bg-white/10 p-4 shadow-[0_8px_32px_rgba(0,0,0,0.15)] backdrop-blur-[12px] backdrop-saturate-[180%] transition-all dark:bg-black/30 hover:bg-white/20">
          <div class="flex items-center justify-between text-sm text-white font-semibold tracking-wide">
            <span>Intimacy</span>
            <div class="i-solar:heart-bold text-xl text-rose-400 drop-shadow-[0_0_8px_rgba(251,113,133,0.8)]" />
          </div>
          <div class="h-2 w-full overflow-hidden rounded-full bg-black/40 shadow-inner">
            <div class="h-full rounded-full from-rose-400 to-pink-500 bg-gradient-to-r shadow-[0_0_10px_rgba(244,63,94,0.6)] transition-all duration-300 ease-out" :style="{ width: `${Math.min(100, (datingSimStore.getVariable('positiveScore') / datingSimStore.settings.maxScore) * 100)}%` }" />
          </div>
          <div class="text-right text-xs text-white/80 font-mono">
            {{ datingSimStore.getVariable('positiveScore') }} / {{ datingSimStore.settings.maxScore }}
          </div>
        </div>

        <!-- Negative (Tension) Badge -->
        <div class="min-w-[220px] flex flex-col gap-3 border border-white/20 rounded-2xl bg-white/10 p-4 shadow-[0_8px_32px_rgba(0,0,0,0.15)] backdrop-blur-[12px] backdrop-saturate-[180%] transition-all dark:bg-black/30 hover:bg-white/20">
          <div class="flex items-center justify-between text-sm text-white font-semibold tracking-wide">
            <span>Tension</span>
            <div class="i-solar:fire-bold text-xl text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
          </div>
          <div class="h-2 w-full overflow-hidden rounded-full bg-black/40 shadow-inner">
            <div class="h-full rounded-full from-amber-400 to-orange-500 bg-gradient-to-r shadow-[0_0_10px_rgba(245,158,11,0.6)] transition-all duration-300 ease-out" :style="{ width: `${Math.min(100, (datingSimStore.getVariable('negativeScore') / datingSimStore.settings.maxScore) * 100)}%` }" />
          </div>
          <div class="text-right text-xs text-white/80 font-mono">
            {{ datingSimStore.getVariable('negativeScore') }} / {{ datingSimStore.settings.maxScore }}
          </div>
        </div>

        <!-- Mood & Turns Badge -->
        <div class="min-w-[220px] flex flex-col gap-3 border border-white/20 rounded-2xl bg-white/10 p-4 shadow-[0_8px_32px_rgba(0,0,0,0.15)] backdrop-blur-[12px] backdrop-saturate-[180%] transition-all dark:bg-black/30 hover:bg-white/20">
          <div class="flex items-center justify-between text-sm text-white font-semibold tracking-wide">
            <span>Mood</span>
            <span class="border border-blue-400/50 rounded-full bg-blue-500/30 px-2.5 py-0.5 text-white font-medium shadow-[0_0_10px_rgba(59,130,246,0.3)] backdrop-blur-md">{{ datingSimStore.mood }}</span>
          </div>
          <div class="mt-2 flex items-center justify-between text-sm text-white font-semibold tracking-wide">
            <span>Turns</span>
            <span :class="[isGameOver ? 'text-rose-400 animate-pulse font-black' : 'text-white/90 font-bold', 'font-mono']">{{ turnsElapsed }} / {{ datingSimStore.settings.maxTurns }}</span>
          </div>
        </div>
      </template>

      <!-- OPEN ENDED HUD -->
      <template v-else>
        <!-- Intimacy Badge -->
        <div class="min-w-[220px] flex flex-col gap-3 border border-white/20 rounded-2xl bg-white/10 p-4 shadow-[0_8px_32px_rgba(0,0,0,0.15)] backdrop-blur-[12px] backdrop-saturate-[180%] transition-all dark:bg-black/30 hover:bg-white/20">
          <div class="flex items-center justify-between text-sm text-white font-semibold tracking-wide">
            <span>Intimacy</span>
            <div class="i-solar:heart-bold text-xl text-rose-400 drop-shadow-[0_0_8px_rgba(251,113,133,0.8)]" />
          </div>
          <div class="h-2 w-full overflow-hidden rounded-full bg-black/40 shadow-inner">
            <div class="h-full rounded-full from-rose-400 to-pink-500 bg-gradient-to-r shadow-[0_0_10px_rgba(244,63,94,0.6)] transition-all duration-300 ease-out" :style="{ width: `${Math.min(100, datingSimStore.getVariable('Intimacy'))}%` }" />
          </div>
          <div class="text-right text-xs text-white/80 font-mono">
            {{ datingSimStore.getVariable('Intimacy') }} / 100
          </div>
        </div>

        <!-- Mood & AP Badge -->
        <div class="min-w-[220px] flex flex-col gap-3 border border-white/20 rounded-2xl bg-white/10 p-4 shadow-[0_8px_32px_rgba(0,0,0,0.15)] backdrop-blur-[12px] backdrop-saturate-[180%] transition-all dark:bg-black/30 hover:bg-white/20">
          <div class="flex items-center justify-between text-sm text-white font-semibold tracking-wide">
            <span>Mood</span>
            <span class="border border-blue-400/50 rounded-full bg-blue-500/30 px-2.5 py-0.5 text-white font-medium shadow-[0_0_10px_rgba(59,130,246,0.3)] backdrop-blur-md">{{ datingSimStore.mood }}</span>
          </div>
          <div v-if="datingSimStore.currentPhase === 'conversation'" class="mt-2 flex items-center justify-between text-sm text-white font-semibold tracking-wide">
            <span>AP</span>
            <div class="flex gap-1.5">
              <div v-for="i in 5" :key="i" class="h-3 w-3 rounded-full transition-all duration-300" :class="i <= datingSimStore.getVariable('ActionPoints') ? 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]' : 'bg-black/40'" />
            </div>
          </div>
        </div>
      </template>

      <!-- Timer Badge (Lightning Round Mode) -->
      <div v-if="datingSimStore.settings.lightningRounds && datingSimStore.getVariable('Timer') > 0 && !isGameOver" class="min-w-[220px] flex flex-col gap-3 border border-white/20 rounded-2xl bg-white/10 p-4 shadow-[0_8px_32px_rgba(0,0,0,0.15)] backdrop-blur-[12px] backdrop-saturate-[180%] transition-all dark:bg-black/30 hover:bg-white/20">
        <div class="flex items-center justify-between text-sm text-white font-semibold tracking-wide">
          <span>Time Remaining</span>
          <div class="i-solar:clock-circle-bold-duotone text-xl text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
        </div>
        <div class="h-2 w-full overflow-hidden rounded-full bg-black/40 shadow-inner">
          <div class="h-full animate-pulse rounded-full transition-all duration-100 ease-linear" :class="timerPercentage < 30 ? 'bg-gradient-to-r from-red-500 to-rose-600 shadow-[0_0_10px_rgba(225,29,72,0.8)]' : 'bg-gradient-to-r from-cyan-400 to-blue-500 shadow-[0_0_10px_rgba(56,189,248,0.8)]'" :style="{ width: `${timerPercentage}%` }" />
        </div>
      </div>
    </div>

    <!-- Center Floating Branching Choices & Input -->
    <div :class="['pointer-events-none absolute inset-x-0 top-[20px] flex flex-col items-center justify-center', containerBottomClass]">
      <!-- Choices/Input Stack -->
      <div class="custom-scrollbar pointer-events-auto max-h-full max-w-[90vw] w-[650px] flex flex-col gap-4 overflow-y-auto pr-4">
        <!-- AA Upsell Tip -->
        <div v-if="visibleChoices.length === 0 && !autonomousEnabled && !isGameOver" class="pointer-events-auto border border-yellow-400/20 rounded-2xl bg-yellow-500/10 p-4 text-center shadow-[0_8px_32px_rgba(0,0,0,0.15)] backdrop-blur-[12px] transition-all hover:bg-yellow-500/15">
          <p class="text-sm text-yellow-100/90 font-semibold tracking-wide drop-shadow-md">
            Want options automatically generated? Enable <span class="text-yellow-300 font-bold underline">Autonomous Artistry</span> in your companion settings, or click the <span class="text-purple-300 font-bold">Sparkle ✨</span> button below to generate choices manually.
          </p>
        </div>

        <!-- Choices Stack -->
        <template v-if="visibleChoices.length > 0 && !isGameOver">
          <button
            v-for="choice in visibleChoices"
            :key="choice.id"
            class="group relative flex flex-shrink-0 items-center gap-5 overflow-hidden border border-white/20 rounded-2xl bg-white/10 px-6 py-4 text-left shadow-[0_8px_32px_rgba(0,0,0,0.15)] backdrop-blur-[12px] backdrop-saturate-[180%] transition-all duration-300 active:scale-[0.98] hover:scale-[1.02] hover:border-white/40 dark:bg-black/30 hover:bg-white/20"
            @click="handleChoiceClick(choice)"
          >
            <!-- Hover light reflection effect -->
            <div class="absolute inset-0 from-transparent via-white/10 to-transparent bg-gradient-to-r transition-transform duration-700 ease-in-out -translate-x-[150%] group-hover:translate-x-[150%]" />

            <div v-if="choice.icon" :class="[choice.icon, 'text-3xl text-blue-300 drop-shadow-[0_0_8px_rgba(147,197,253,0.5)] transition-transform group-hover:scale-110']" />
            <div v-else class="i-solar:chat-round-dots-bold-duotone text-3xl text-blue-300 drop-shadow-[0_0_8px_rgba(147,197,253,0.5)] transition-transform group-hover:scale-110" />

            <span class="flex-1 text-xl text-white font-medium tracking-wide drop-shadow-md">
              <span v-if="datingSimStore.settings.showChoiceWeights && (choice.positiveScoreChange || choice.negativeScoreChange)" class="mr-3 inline-flex items-center gap-1.5 border border-white/10 rounded-lg bg-black/40 px-2 py-0.5 text-sm text-white/90 font-bold font-mono">
                <span class="text-rose-400">💖</span> {{ choice.positiveScoreChange ?? 0 }}
                <span class="ml-1 text-amber-500">🔥</span> {{ choice.negativeScoreChange ?? 0 }}
              </span>
              {{ choice.text }}
            </span>

            <div v-if="choice.cost && datingSimStore.settings.gameMode === 'open_ended'" class="flex items-center gap-1.5 border border-white/10 rounded-full bg-black/40 px-3 py-1.5">
              <div class="i-solar:lightning-bold text-base text-yellow-400 drop-shadow-[0_0_6px_rgba(250,204,21,0.8)]" />
              <span class="text-sm text-white/90 font-bold">{{ choice.cost }} AP</span>
            </div>
          </button>
        </template>

        <!-- Game Over / Conclusion Card -->
        <template v-if="isGameOver">
          <div class="pointer-events-auto flex flex-col items-center gap-3 border border-rose-500/30 rounded-2xl bg-rose-950/20 p-5 text-center shadow-[0_8px_32px_rgba(0,0,0,0.3)] backdrop-blur-[12px]">
            <div class="flex items-center gap-2 text-lg text-rose-400 font-bold tracking-wider uppercase">
              <span class="i-solar:shield-check-bold animate-pulse text-2xl" />
              Storyline Concluded
            </div>
            <p class="text-sm text-white/80 leading-relaxed">
              You've reached the climax of this encounter. The final narrative resolution has been played back.
            </p>
            <button
              class="mt-1 border border-rose-400/50 rounded-xl bg-rose-500/30 px-5 py-2 text-sm text-white font-semibold transition-all active:scale-95 hover:scale-105 hover:bg-rose-500/50"
              @click="handleRestart"
            >
              Start New Story
            </button>
          </div>
        </template>

        <!-- Custom Prompt Input -->
        <div v-if="!isGameOver" class="group relative flex flex-shrink-0 items-center gap-4 border border-white/20 rounded-2xl bg-white/10 px-6 py-4 shadow-[0_8px_32px_rgba(0,0,0,0.15)] backdrop-blur-[12px] backdrop-saturate-[180%] transition-all duration-300 focus-within:border-white/40 dark:bg-black/30 focus-within:bg-white/20">
          <div class="i-solar:keyboard-bold-duotone text-3xl text-purple-300 drop-shadow-[0_0_8px_rgba(216,180,254,0.5)] transition-transform group-focus-within:scale-110" />
          <input
            v-model="customPrompt"
            type="text"
            placeholder="Or say something else..."
            class="w-full flex-1 bg-transparent text-xl text-white font-medium tracking-wide outline-none drop-shadow-md placeholder:text-white/40"
            :disabled="isGameOver || datingSimStore.isGenerating"
            @keydown.enter="submitCustomPrompt"
          >
          <div class="flex gap-2">
            <!-- Sparkle Button (Generate Choices manually / Retry) -->
            <button
              class="border border-purple-400/50 rounded-xl bg-purple-500/30 p-2 transition-all active:scale-95 hover:scale-105 hover:bg-purple-500/50"
              title="Generate suggestions/Retry choices"
              :disabled="datingSimStore.isGenerating || isGameOver"
              @click="datingSimStore.generateLiveChoices(true)"
            >
              <div v-if="datingSimStore.isGenerating" class="i-solar:restart-square-bold animate-spin text-xl text-white" />
              <div v-else class="i-solar:magic-stick-3-bold-duotone text-xl text-white" />
            </button>
            <button
              class="border border-purple-400/50 rounded-xl bg-purple-500/30 p-2 transition-colors hover:bg-purple-500/50"
              :disabled="isGameOver"
              @click="submitCustomPrompt"
            >
              <div class="i-solar:plain-2-bold text-xl text-white" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom Dialogue -->
    <div v-show="datingSimStore.settings.inlineCaption && (datingSimStore.currentSubtitle || isGameOver || hasActiveCaption)" class="pointer-events-none mb-4 w-full flex justify-center px-12">
      <div class="pointer-events-auto relative max-w-4xl w-full">
        <!-- Main Dialogue Box (Shorted to 130px, smaller padding and spacing) -->
        <div
          class="group relative min-h-[130px] flex flex-col cursor-pointer justify-center border border-white/20 rounded-3xl bg-white/10 px-8 py-6 shadow-[0_16px_40px_rgba(0,0,0,0.3)] backdrop-blur-[16px] backdrop-saturate-[200%] transition-all duration-300 dark:bg-black/40 hover:bg-white/15"
          :class="isExpanded ? 'max-h-[70vh] overflow-y-auto' : 'max-h-[220px] overflow-hidden'"
          @click="isExpanded = !isExpanded"
        >
          <!-- Subtle top gradient border effect -->
          <div class="absolute left-0 right-0 top-0 h-[1px] from-transparent via-white/40 to-transparent bg-gradient-to-r" />

          <!-- Nameplate integrated smoothly -->
          <div class="absolute left-8 top-4 flex items-center gap-2 opacity-80">
            <div class="i-solar:user-bold text-lg text-blue-400" />
            <span class="text-sm text-blue-200 font-bold tracking-widest uppercase drop-shadow-md">Character</span>
          </div>

          <!-- Modular Real-Time Caption Panel inside original frame -->
          <div class="mt-6 w-full flex justify-center overflow-hidden" :class="isExpanded ? 'max-h-[60vh]' : 'max-h-[140px]'">
            <CaptionPanel
              :show-active-sentence-only="true"
              :transparent-bg="true"
              text-size="text-2xl"
              :fallback-text="subtitleText"
            />
          </div>

          <!-- Auto-advance / Expand indicator -->
          <div
            :class="[
              isExpanded ? 'i-solar:alt-arrow-up-bold' : 'i-solar:alt-arrow-down-bold animate-bounce',
              'absolute bottom-4 right-8 text-3xl text-white/50 transition-all duration-300 hover:text-white',
            ]"
            @click.stop="isExpanded = !isExpanded"
          />
        </div>
      </div>
    </div>

    <!-- Story Select Modal -->
    <StorySelectorModal
      :show="showSelector"
      @close="showSelector = false"
      @select="handleStorySelect"
    />

    <!-- Mode Select Modal -->
    <ModeSelectorModal
      :show="showModeSelector"
      @close="handleModeClose"
      @select="handleModeSelect"
    />
  </div>
</template>
