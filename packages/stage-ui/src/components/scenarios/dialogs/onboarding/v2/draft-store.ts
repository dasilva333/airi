import type { Card, ccv3 } from '@proj-airi/ccc'

import { useLocalStorageManualReset } from '@proj-airi/stage-shared/composables'
import { defineStore } from 'pinia'
import { computed } from 'vue'

/**
 * Transient onboarding draft state (Core Principle 6).
 *
 * NOTICE: This store is the single scratchpad for V2 onboarding. Steps record
 * choices here as plain data; NOTHING is committed to the production stores
 * (`airi-card`, `consciousness`, `hearing`, `speech`) until Step 7 performs an
 * atomic synthesis. Navigating back or cancelling onboarding mutates no
 * IndexedDB character cards.
 *
 * Persisted under `onboarding/v2-draft` so a mid-flow refresh resumes cleanly.
 */

export type OnboardingPersonaSource = 'preset' | 'import'

export interface OnboardingV2DraftState {
  consciousness: { provider?: string, model?: string, engine?: 'web-llm' | 'cloud' }
  hearing: { provider?: string, model?: string }
  speech: { provider?: string, model?: string, voiceId?: string }
  persona: { cardId?: string, source?: OnboardingPersonaSource, importedCardDraft?: Card | ccv3.CharacterCardV3 }
  vessel: { displayModelId?: string }
  userProfile: { name?: string, description?: string, prompt?: string }
}

export const useOnboardingV2Draft = defineStore('onboarding-v2-draft', () => {
  const state = useLocalStorageManualReset<OnboardingV2DraftState>('onboarding/v2-draft', {
    consciousness: {},
    hearing: {},
    speech: {},
    persona: {},
    vessel: {},
    userProfile: {},
  })

  // Convenience writers (whole-fragment replace keeps serialization trivial)
  function setConsciousness(patch: NonNullable<OnboardingV2DraftState['consciousness']>) {
    state.value.consciousness = { ...patch }
  }

  function setHearing(patch: NonNullable<OnboardingV2DraftState['hearing']>) {
    state.value.hearing = { ...patch }
  }

  function setSpeech(patch: NonNullable<OnboardingV2DraftState['speech']>) {
    state.value.speech = { ...patch }
  }

  function setPersona(patch: NonNullable<OnboardingV2DraftState['persona']>) {
    state.value.persona = { ...patch }
  }

  function setVessel(patch: NonNullable<OnboardingV2DraftState['vessel']>) {
    state.value.vessel = { ...patch }
  }

  function setUserProfile(patch: NonNullable<OnboardingV2DraftState['userProfile']>) {
    state.value.userProfile = { ...patch }
  }

  const hasPersona = computed(() => !!state.value.persona.cardId || !!state.value.persona.importedCardDraft)
  const hasBrain = computed(() => !!state.value.consciousness.provider && !!state.value.consciousness.model)
  const hasVessel = computed(() => !!state.value.vessel.displayModelId)
  const hasHearing = computed(() => !!state.value.hearing.provider)
  const hasSpeech = computed(() => !!state.value.speech.provider)

  function reset() {
    state.reset()
  }

  return {
    state,
    setConsciousness,
    setHearing,
    setSpeech,
    setPersona,
    setVessel,
    setUserProfile,
    hasPersona,
    hasBrain,
    hasVessel,
    hasHearing,
    hasSpeech,
    reset,
  }
})
