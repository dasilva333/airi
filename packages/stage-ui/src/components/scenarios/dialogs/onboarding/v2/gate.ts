import type { ComputedRef, InjectionKey } from 'vue'

/**
 * Step-supplied gate contract for the V2 onboarding footer.
 *
 * A step can register a `gate` so the orchestrator controls whether the
 * `[ Next > ]` button is enabled. When absent the footer is free-flowing.
 * `skipLabel` renders an always-enabled `[ Skip Step ]` button next to Next.
 */
export interface OnboardingV2GateState {
  /** Reactive predicate — Next is enabled only when this is true. */
  canProceed: ComputedRef<boolean> | boolean | (() => boolean)
  /** When present, renders an always-enabled Skip button with this label. */
  skipLabel?: string
}

export interface OnboardingV2GateApi {
  setGate: (id: string, gate: OnboardingV2GateState) => void
  clearGate: (id: string) => void
}

export const onboardingV2GateKey: InjectionKey<OnboardingV2GateApi> = Symbol('onboarding-v2-gate')
