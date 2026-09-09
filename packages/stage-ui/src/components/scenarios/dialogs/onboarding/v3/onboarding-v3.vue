<script setup lang="ts">
import type { OnboardingV3Step, OnboardingV3StepDef } from './types'

import { computed, ref, watch } from 'vue'

import SlidingStepper from './components/sliding-stepper.vue'
import StepAppearance from './steps/step-appearance.vue'
import StepArtistry from './steps/step-artistry.vue'
import StepConsciousness from './steps/step-consciousness.vue'
import StepExperience from './steps/step-experience.vue'
import StepHearing from './steps/step-hearing.vue'
import StepMemory from './steps/step-memory.vue'
import StepPersona from './steps/step-persona.vue'
import StepProfile from './steps/step-profile.vue'
import StepSensory from './steps/step-sensory.vue'
import StepSpeech from './steps/step-speech.vue'
import StepThinking from './steps/step-thinking.vue'
import StepTools from './steps/step-tools.vue'
import StepTriage from './steps/step-triage.vue'
import StepVessel from './steps/step-vessel.vue'
import StepWelcome from './steps/step-welcome.vue'

import { useOnboardingV3Draft } from './stores/useOnboardingV3Draft'
import { ONBOARDING_V3_STEPS } from './types'

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'finish'): void
}>()

const draftStore = useOnboardingV3Draft()
const currentStepId = ref<OnboardingV3Step>('welcome')

const activeSteps = computed<OnboardingV3StepDef[]>(() => {
  const modules = draftStore.state.modules
  return ONBOARDING_V3_STEPS
    .filter((step) => {
      if (!step.moduleKey)
        return true
      return Boolean(modules[step.moduleKey])
    })
    .map((step, idx) => ({
      ...step,
      index: idx,
    }))
})

const activeIndex = computed(() => {
  const idx = activeSteps.value.findIndex(s => s.id === currentStepId.value)
  return idx >= 0 ? idx : 0
})

watch(activeSteps, (newSteps) => {
  const exists = newSteps.some(s => s.id === currentStepId.value)
  if (!exists && newSteps.length > 0) {
    currentStepId.value = newSteps[Math.min(activeIndex.value, newSteps.length - 1)].id
  }
})

function handleNext() {
  if (activeIndex.value < activeSteps.value.length - 1) {
    currentStepId.value = activeSteps.value[activeIndex.value + 1].id
  }
}

function handlePrevious() {
  if (activeIndex.value > 0) {
    currentStepId.value = activeSteps.value[activeIndex.value - 1].id
  }
}

function handleSelectStep(index: number) {
  if (index >= 0 && index < activeSteps.value.length) {
    currentStepId.value = activeSteps.value[index].id
  }
}

function handleSkip() {
  emit('close')
}
</script>

<template>
  <div :class="['h-full w-full flex flex-col justify-between select-none relative text-neutral-900 dark:text-white overflow-hidden']">
    <!-- Edgeless Header Bar (With Drag Region & Traffic Light Clearance) -->
    <header
      data-tauri-drag-region
      :class="['h-14 pl-22 pr-6 pt-2 pb-1 flex items-center justify-between select-none flex-shrink-0 border-b border-neutral-200/80 dark:border-white/5']"
    >
      <!-- Left: Brand Title -->
      <div :class="['flex items-center space-x-2 text-xs font-semibold tracking-wider text-primary-500 select-none pointer-events-none']">
        <div :class="['i-solar:shield-star-bold-duotone w-4 h-4']" />
        <span>AIRI ONBOARDING V3</span>
      </div>

      <!-- Center: 5-Item Dynamic Sliding Window Stepper -->
      <div :class="['flex-shrink-0']" style="-webkit-app-region: no-drag;">
        <SlidingStepper
          :steps="activeSteps"
          :current-index="activeIndex"
          @select="handleSelectStep"
        />
      </div>

      <!-- Right: Status / Close Button -->
      <div :class="['flex items-center gap-3 text-xs text-neutral-400']" style="-webkit-app-region: no-drag;">
        <span :class="['hidden sm:flex items-center gap-1.5 text-[11px] text-emerald-500 dark:text-emerald-400 font-mono']">
          <span :class="['w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse']" />
          <span>Stage Ready</span>
        </span>
        <button
          type="button"
          :class="['p-1 rounded-lg text-neutral-400 hover:text-neutral-800 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer']"
          title="Close Setup"
          @click="emit('close')"
        >
          <div :class="['i-solar:close-circle-bold w-5 h-5']" />
        </button>
      </div>
    </header>

    <!-- Main Edgeless Workspace (Centered & Clean) -->
    <main :class="['flex-1 min-h-0 overflow-y-auto px-6 py-4 flex flex-col items-center justify-start']">
      <!-- Step 0: Welcome -->
      <StepWelcome
        v-if="currentStepId === 'welcome'"
        :on-next="handleNext"
        :on-skip="handleSkip"
      />

      <!-- Step 1: Appearance (Language, Theme Mode & Accent Color) -->
      <StepAppearance
        v-else-if="currentStepId === 'appearance'"
        :on-next="handleNext"
        :on-previous="handlePrevious"
      />

      <!-- Step 2: Triage (Architecture Choice: Local-First vs Cloudflare Relay) -->
      <StepTriage
        v-else-if="currentStepId === 'triage'"
        :on-next="handleNext"
        :on-previous="handlePrevious"
      />

      <!-- Step 3: Experience (Interaction Archetype Choice & Module Customization) -->
      <StepExperience
        v-else-if="currentStepId === 'experience'"
        :on-next="handleNext"
        :on-previous="handlePrevious"
      />

      <!-- Step 4: User Profile (Who Are You?) -->
      <StepProfile
        v-else-if="currentStepId === 'profile'"
        :on-next="handleNext"
        :on-previous="handlePrevious"
      />

      <!-- Step 5: Physical Vessel (Live2D / VRM Avatar Body) -->
      <StepVessel
        v-else-if="currentStepId === 'vessel'"
        :on-next="handleNext"
        :on-previous="handlePrevious"
      />

      <!-- Step 6: Soul & Persona (Personality Core) -->
      <StepPersona
        v-else-if="currentStepId === 'persona'"
        :on-next="handleNext"
        :on-previous="handlePrevious"
      />

      <!-- Step 7: Hearing & Mic Playground (Voice Transcription STT) -->
      <StepHearing
        v-else-if="currentStepId === 'hearing'"
        :on-next="handleNext"
        :on-previous="handlePrevious"
      />

      <!-- Step 8: Consciousness (Reasoning Engine LLM) -->
      <StepConsciousness
        v-else-if="currentStepId === 'consciousness'"
        :on-next="handleNext"
        :on-previous="handlePrevious"
      />

      <!-- Step 9: Speech (Neural Voice Studio TTS) -->
      <StepSpeech
        v-else-if="currentStepId === 'speech'"
        :on-next="handleNext"
        :on-previous="handlePrevious"
      />

      <!-- Step 10: Thinking (Conversational Pacing & Subconscious Asides) -->
      <StepThinking
        v-else-if="currentStepId === 'thinking'"
        :on-next="handleNext"
        :on-previous="handlePrevious"
      />

      <!-- Step 12: Artistry (Visual Creative Studio & Autonomous Director) -->
      <StepArtistry
        v-else-if="currentStepId === 'artistry'"
        :on-next="handleNext"
        :on-previous="handlePrevious"
      />

      <!-- Step 13: Sensory (Screen Watching & Heartbeats) -->
      <StepSensory
        v-else-if="currentStepId === 'sensory'"
        :on-next="handleNext"
        :on-previous="handlePrevious"
      />

      <!-- Step 14: Memory (4 Temporal Quadrants) -->
      <StepMemory
        v-else-if="currentStepId === 'memory'"
        :on-next="handleNext"
        :on-previous="handlePrevious"
      />

      <!-- Step 15: Tools (Automation & MCP Tools) -->
      <StepTools
        v-else-if="currentStepId === 'tools'"
        :on-next="handleNext"
        :on-previous="handlePrevious"
      />

      <!-- Placeholder View for Subsequent Steps during Incremental Assembly -->
      <div
        v-else
        :class="['flex flex-col items-center justify-center flex-1 max-w-xl mx-auto text-center space-y-4 py-8 animate-fadeIn']"
      >
        <div :class="['text-3xl']">
          🚧
        </div>
        <div>
          <h2 :class="['text-xl font-bold text-neutral-900 dark:text-white']">
            {{ activeSteps[activeIndex]?.label }} (Step {{ activeIndex + 1 }}/{{ activeSteps.length }})
          </h2>
          <p :class="['text-xs text-neutral-500 dark:text-neutral-400 mt-1']">
            {{ activeSteps[activeIndex]?.subtitle }}
          </p>
        </div>
        <p :class="['text-xs text-neutral-600 dark:text-neutral-400 bg-neutral-100 dark:bg-white/5 p-3 rounded-xl border border-neutral-200 dark:border-white/10 max-w-md']">
          This step is being wired into the modular V3 pipeline. You can use the breadcrumbs above to jump between steps or return to Welcome.
        </p>
        <div :class="['flex items-center gap-3 pt-2']">
          <button
            type="button"
            :class="['px-4 py-2 rounded-xl bg-neutral-100 dark:bg-white/5 hover:bg-neutral-200 dark:hover:bg-white/10 text-neutral-700 dark:text-neutral-300 text-xs font-medium border border-neutral-200 dark:border-white/10 transition-colors cursor-pointer']"
            @click="handlePrevious"
          >
            ← Previous
          </button>
          <button
            type="button"
            :class="['px-5 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs font-semibold shadow-md shadow-primary-600/30 transition-colors cursor-pointer']"
            @click="handleNext"
          >
            Next Step →
          </button>
        </div>
      </div>
    </main>
  </div>
</template>
