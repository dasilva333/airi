<script setup lang="ts">
import type { OnboardingStepNextHandler, OnboardingStepPrevHandler } from '../types'
import type { OnboardingV2GateState } from './gate'

import { useLocalStorage } from '@vueuse/core'
import { computed, provide, reactive, ref, unref, watch } from 'vue'

import StepStartChoice from '../step-start-choice.vue'
import Step0Welcome from './steps/step-0-welcome.vue'
import Step1Hearing from './steps/step-1-hearing.vue'
import Step2Consciousness from './steps/step-2-consciousness.vue'
import Step3UserProfile from './steps/step-3-user-profile.vue'
import Step4Persona from './steps/step-4-persona.vue'
import Step5Vessel from './steps/step-5-vessel.vue'
import Step6Speech from './steps/step-6-speech.vue'
import Step7Calibration from './steps/step-7-calibration.vue'

import { useOnboardingStore } from '../../../../../stores/onboarding'
import { useOnboardingV2Draft } from './draft-store'
import { onboardingV2GateKey } from './gate'

/**
 * V2 onboarding orchestrator — UI mockup scaffold.
 *
 * NOTICE: persisted under `onboarding/v2-state`, fully isolated from V1's
 * `airi-onboarding-state` (index-based restore) and the live
 * `onboarding/completed` / `onboarding/skipped` flags. Previewing V2 must
 * never mutate production setup state.
 */
interface V2StepDef {
  id: string
  label: string
  // Steps that render their own Back/Next navigation (preserved steps with a
  // baked-in footer, zero-indexed landing/finale CTAs).
  ownNav?: boolean
}

const emit = defineEmits<{
  (e: 'close'): void
}>()

const STEPS: V2StepDef[] = [
  { id: 'welcome', label: 'Welcome', ownNav: true },
  { id: 'triage', label: 'Your Path' },
  { id: 'hearing', label: 'Hearing' },
  { id: 'consciousness', label: 'Consciousness' },
  { id: 'profile', label: 'You' },
  { id: 'persona', label: 'Persona' },
  { id: 'vessel', label: 'Vessel' },
  { id: 'speech', label: 'Voice' },
  { id: 'calibration', label: 'Launch', ownNav: true },
]

const onboardingStore = useOnboardingStore()

// Mock step/path state, persisted separately from the live V1 flags.
const v2State = useLocalStorage<{ stepId: string, path: 'new' | 'returning' }>(
  'onboarding/v2-state',
  { stepId: 'welcome', path: 'new' },
)
const v2Skipped = useLocalStorage('onboarding/v2-skipped', false)
const v2Completed = useLocalStorage('onboarding/v2-completed', false)

const direction = ref<'next' | 'previous'>('next')

const stepIndex = computed(() => {
  const idx = STEPS.findIndex(s => s.id === v2State.value.stepId)
  return idx === -1 ? 0 : idx
})

const currentStep = computed(() => STEPS[stepIndex.value])
const currentId = computed(() => currentStep.value.id)
const isLastStep = computed(() => stepIndex.value === STEPS.length - 1)

watch(stepIndex, () => {
  v2State.value.stepId = currentId.value
})

function goTo(id: string) {
  const target = STEPS.findIndex(s => s.id === id)
  if (target === -1 || target === stepIndex.value)
    return
  direction.value = target > stepIndex.value ? 'next' : 'previous'
  v2State.value.stepId = id
}

const requestNextStep: OnboardingStepNextHandler = () => {
  if (isLastStep.value)
    return
  direction.value = 'next'
  const next = STEPS[stepIndex.value + 1]
  if (next)
    v2State.value.stepId = next.id
}

const requestPreviousStep: OnboardingStepPrevHandler = () => {
  if (stepIndex.value <= 0)
    return
  direction.value = 'previous'
  const prev = STEPS[stepIndex.value - 1]
  if (prev)
    v2State.value.stepId = prev.id
}

function handleSelectPath(path: 'new' | 'returning') {
  v2State.value.path = path
}

// --- Per-step verification gate contract (provided to v2 steps) ---
const gates = reactive<Record<string, OnboardingV2GateState>>({})

function setGate(id: string, gate: OnboardingV2GateState) {
  gates[id] = gate
}

function clearGate(id: string) {
  delete gates[id]
}

provide(onboardingV2GateKey, { setGate, clearGate })

const activeGate = computed(() => gates[currentId.value])
const canProceed = computed(() => {
  if (!activeGate.value)
    return true
  const val = activeGate.value.canProceed
  if (typeof val === 'function')
    return (val as () => boolean)()
  return Boolean(unref(val))
})

const draftStore = useOnboardingV2Draft()

function resetOnboardingState() {
  v2State.value = { stepId: 'welcome', path: 'new' }
  draftStore.reset()
}

function handleStepSkip() {
  requestNextStep()
}

function handleSkip() {
  v2Skipped.value = true
  onboardingStore.markSetupSkipped()
  resetOnboardingState()
  emit('close')
}

function handleFinish() {
  v2Completed.value = true
  resetOnboardingState()
  emit('close')
}
</script>

<template>
  <div class="h-full flex flex-col gap-4">
    <!-- Progress rail -->
    <div class="flex items-center gap-1.5 px-1 pt-1">
      <button
        v-for="(s, i) in STEPS"
        :key="s.id"
        :title="s.label"
        class="h-1.5 flex-1 rounded-full transition-all duration-300"
        :class="[
          i < stepIndex ? 'bg-primary-500' : '',
          i === stepIndex ? 'bg-primary-500' : '',
          i > stepIndex ? 'bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600' : '',
        ]"
        @click="goTo(s.id)"
      />
    </div>
    <div class="flex items-center justify-between px-1 text-xs text-neutral-400 dark:text-neutral-500">
      <span>{{ currentStep.label }}</span>
      <span>Step {{ stepIndex + 1 }} of {{ STEPS.length }} · {{ currentStep.label }}</span>
    </div>

    <!-- Step content -->
    <div class="min-h-0 flex-1 overflow-x-hidden">
      <Transition :name="direction === 'next' ? 'v2-slide-next' : 'v2-slide-prev'" mode="out-in">
        <StepStartChoice
          v-if="currentId === 'triage'"
          key="triage"
          :on-next="requestNextStep"
          :on-previous="requestPreviousStep"
          :on-select-path="handleSelectPath"
        />
        <!-- Returning-user path stays on V1's restore pipeline -->
        <div
          v-else-if="currentId === 'hearing' && v2State.path === 'returning'"
          key="returning-notice"
          class="h-full flex flex-col items-center justify-center gap-4 px-6 text-center"
        >
          <div class="i-solar:cloud-storage-bold-duotone h-14 w-14 text-purple-500" />
          <h3 class="text-lg text-neutral-800 font-bold dark:text-neutral-100">
            Returning User Restore (Preserved V1 Flow)
          </h3>
          <p class="max-w-md text-sm text-neutral-500 leading-relaxed dark:text-neutral-400">
            Google Cloud OAuth / S3 sync restore is intentionally preserved from V1 and is not part of this UI mockup.
          </p>
          <button
            class="text-sm text-primary-500 font-medium hover:underline"
            @click="() => { handleSelectPath('new'); direction = 'previous'; v2State.stepId = 'triage' }"
          >
            ← Back to Path Triage
          </button>
        </div>
        <Step0Welcome v-else-if="currentId === 'welcome'" key="welcome" :on-next="requestNextStep" :on-skip="handleSkip" />
        <Step1Hearing v-else-if="currentId === 'hearing'" key="hearing" />
        <Step2Consciousness v-else-if="currentId === 'consciousness'" key="consciousness" />
        <Step3UserProfile v-else-if="currentId === 'profile'" key="profile" />
        <Step4Persona v-else-if="currentId === 'persona'" key="persona" />
        <Step5Vessel v-else-if="currentId === 'vessel'" key="vessel" />
        <Step6Speech v-else-if="currentId === 'speech'" key="speech" />
        <Step7Calibration v-else-if="currentId === 'calibration'" key="calibration" :on-finish="handleFinish" />
      </Transition>
    </div>

    <!-- Global nav footer (hidden for steps with their own navigation) -->
    <div v-if="!currentStep.ownNav" class="flex flex-shrink-0 items-center justify-between gap-3 pt-1">
      <button
        class="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-neutral-500 font-medium outline-none transition-colors disabled:cursor-default hover:bg-neutral-100 dark:text-neutral-400 hover:text-neutral-800 disabled:opacity-40 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
        :disabled="stepIndex <= 0"
        @click="requestPreviousStep"
      >
        <div class="i-solar:alt-arrow-left-line-duotone h-4 w-4" />
        Back
      </button>
      <div class="min-w-0 flex flex-1 items-center justify-end gap-3">
        <span
          v-if="activeGate && !canProceed"
          class="truncate text-xs text-neutral-400 italic dark:text-neutral-500"
        >
          Speak into your microphone — Next unlocks once we hear you.
        </span>
        <button
          v-if="activeGate?.skipLabel"
          class="rounded-lg px-3 py-2 text-sm text-neutral-500 font-medium outline-none transition-colors hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
          @click="handleStepSkip"
        >
          {{ activeGate.skipLabel }}
        </button>
        <button
          class="flex items-center gap-1.5 rounded-lg bg-primary-500 px-5 py-2 text-sm text-white font-semibold shadow-lg shadow-primary-500/25 outline-none transition-all active:scale-95 disabled:cursor-not-allowed hover:bg-primary-600 disabled:opacity-50"
          :disabled="!canProceed"
          @click="requestNextStep"
        >
          Next
          <div class="i-solar:alt-arrow-right-line-duotone h-4 w-4" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.v2-slide-next-enter-active,
.v2-slide-next-leave-active,
.v2-slide-prev-enter-active,
.v2-slide-prev-leave-active {
  will-change: transform, opacity;
}

.v2-slide-next-enter-active {
  animation: v2-slide-next-in 0.2s ease-in-out both;
}

.v2-slide-next-leave-active {
  animation: v2-slide-next-out 0.2s ease-in-out both;
}

.v2-slide-prev-enter-active {
  animation: v2-slide-prev-in 0.2s ease-in-out both;
}

.v2-slide-prev-leave-active {
  animation: v2-slide-prev-out 0.2s ease-in-out both;
}

@keyframes v2-slide-next-in {
  from {
    transform: translateX(2rem);
    opacity: 0;
  }

  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes v2-slide-next-out {
  from {
    transform: translateX(0);
    opacity: 1;
  }

  to {
    transform: translateX(-2rem);
    opacity: 0;
  }
}

@keyframes v2-slide-prev-in {
  from {
    transform: translateX(-2rem);
    opacity: 0;
  }

  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes v2-slide-prev-out {
  from {
    transform: translateX(0);
    opacity: 1;
  }

  to {
    transform: translateX(2rem);
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .v2-slide-next-enter-active,
  .v2-slide-next-leave-active,
  .v2-slide-prev-enter-active,
  .v2-slide-prev-leave-active {
    animation-duration: 1ms;
  }
}
</style>
