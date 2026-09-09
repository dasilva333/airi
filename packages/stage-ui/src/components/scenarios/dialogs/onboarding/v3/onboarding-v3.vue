<script setup lang="ts">
import { ref } from 'vue'

import SlidingStepper from './components/sliding-stepper.vue'
import StepAppearance from './steps/step-appearance.vue'
import StepExperience from './steps/step-experience.vue'
import StepHearing from './steps/step-hearing.vue'
import StepPersona from './steps/step-persona.vue'
import StepProfile from './steps/step-profile.vue'
import StepTriage from './steps/step-triage.vue'
import StepVessel from './steps/step-vessel.vue'
import StepWelcome from './steps/step-welcome.vue'

import { ONBOARDING_V3_STEPS } from './types'

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'finish'): void
}>()

const currentIndex = ref(0)

function handleNext() {
  if (currentIndex.value < ONBOARDING_V3_STEPS.length - 1) {
    currentIndex.value++
  }
}

function handlePrevious() {
  if (currentIndex.value > 0) {
    currentIndex.value--
  }
}

function handleSelectStep(index: number) {
  currentIndex.value = index
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
          :steps="ONBOARDING_V3_STEPS"
          :current-index="currentIndex"
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
    <main :class="['flex-1 min-h-0 overflow-y-auto px-6 py-4 flex flex-col items-center justify-center']">
      <!-- Step 0: Welcome -->
      <StepWelcome
        v-if="currentIndex === 0"
        :on-next="handleNext"
        :on-skip="handleSkip"
      />

      <!-- Step 1: Appearance (Language, Theme Mode & Accent Color) -->
      <StepAppearance
        v-else-if="currentIndex === 1"
        :on-next="handleNext"
        :on-previous="handlePrevious"
      />

      <!-- Step 2: Triage (Architecture Choice: Local-First vs Cloudflare Relay) -->
      <StepTriage
        v-else-if="currentIndex === 2"
        :on-next="handleNext"
        :on-previous="handlePrevious"
      />

      <!-- Step 3: Experience (Interaction Archetype Choice & Module Customization) -->
      <StepExperience
        v-else-if="currentIndex === 3"
        :on-next="handleNext"
        :on-previous="handlePrevious"
      />

      <!-- Step 4: User Profile (Who Are You?) -->
      <StepProfile
        v-else-if="currentIndex === 4"
        :on-next="handleNext"
        :on-previous="handlePrevious"
      />

      <!-- Step 5: Physical Vessel (Live2D / VRM Avatar Body) -->
      <StepVessel
        v-else-if="currentIndex === 5"
        :on-next="handleNext"
        :on-previous="handlePrevious"
      />

      <!-- Step 6: Soul & Persona (Personality Core) -->
      <StepPersona
        v-else-if="currentIndex === 6"
        :on-next="handleNext"
        :on-previous="handlePrevious"
      />

      <!-- Step 7: Hearing & Mic Playground (Voice Transcription STT) -->
      <StepHearing
        v-else-if="currentIndex === 7"
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
            {{ ONBOARDING_V3_STEPS[currentIndex]?.label }} (Step {{ currentIndex + 1 }}/{{ ONBOARDING_V3_STEPS.length }})
          </h2>
          <p :class="['text-xs text-neutral-500 dark:text-neutral-400 mt-1']">
            {{ ONBOARDING_V3_STEPS[currentIndex]?.subtitle }}
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
