---
name: airi-onboarding-v2
description: >-
  Use when working with AIRI Onboarding V2 wizard, 7-step sequence, gate.ts onboardingV2Gate contracts, draft-store.ts onboardingV2Draft transient composition (Principle 6), onboarding-v2.vue orchestrator, steps/ directory Vue components (step-0-welcome through step-7-calibration), packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/, in-context model-shard downloads, whisper-loader.ts, Step 7 atomic card synthesis into airi-card/consciousness/hearing/speech stores, docs/project-onboarding-modernize.md, provider selection, character card assembly, first-run setup flow.
---

# AIRI Onboarding V2

## Key Files/Locations

- `packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/onboarding-v2.vue` — top-level orchestrator; renders the active step, footer (`[ Next > ]` / `[ Skip Step ]`), and provides the gate API via `onboardingV2GateKey`.
- `packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/gate.ts` — defines `OnboardingV2GateState` (`canProceed`, `skipLabel`), `OnboardingV2GateApi` (`setGate(id, gate)`, `clearGate(id)`), and the `onboardingV2GateKey` `InjectionKey`.
- `packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/draft-store.ts` — `useOnboardingV2Draft` Pinia store; transient scratchpad persisted under `onboarding/v2-draft`. Fragments: `consciousness`, `hearing`, `speech`, `persona`, `vessel`, `userProfile`; computed `hasPersona`/`hasBrain`/`hasVessel`/`hasHearing`/`hasSpeech`; `reset()`.
- `packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/index.ts` — barrel: `export { default as OnboardingV2 } from './onboarding-v2.vue'`.
- `packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/steps/` — one Vue file per step: `step-0-welcome.vue`, `step-1-hearing.vue` (STT), `step-2-consciousness.vue` (LLM), `step-3-user-profile.vue`, `step-4-persona.vue`, `step-5-vessel.vue` (display model), `step-6-speech.vue` (TTS), `step-7-calibration.vue` (finale).
- `packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/whisper-loader.ts` — Whisper WebGPU weight-shard loader.
- `packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/components/` — shared step UI subcomponents.
- `docs/project-onboarding-modernize.md` — design doc (Core Principles incl. Principle 6, per-step behavior, Step 7 assembly spec).

## When to Use

- Adding, removing, reordering, or editing any onboarding step UI or its footer gating.
- Debugging why `[ Next > ]` is disabled (gate predicate) or why a `[ Skip Step ]` button appears/missing.
- Working on draft persistence, mid-flow refresh resume, or the atomic Step 7 commit.
- Wiring provider/model selection (LLM, STT, TTS) or display-model (vessel) selection into the draft.
- Implementing in-context downloads (e.g. Whisper WebGPU shards blocking Step 1 progression per Core Principle 1).

## Common Pitfalls

- **Never commit from a step.** Steps write ONLY into `useOnboardingV2Draft` via the `set*` writers (whole-fragment replace). Production stores (`airi-card`, `consciousness`, `hearing`, `speech`) must stay untouched until Step 7 performs the atomic synthesis — navigating back or cancelling must leave IndexedDB character cards unmodified (Core Principle 6).
- **Gate contract misuse.** A step opts into gating by calling `setGate(stepId, { canProceed, skipLabel? })` with the injected `onboardingV2GateKey` API; `canProceed` accepts `ComputedRef<boolean> | boolean | (() => boolean)`. Absent gate = free-flowing footer. `skipLabel` renders an ALWAYS-enabled skip button — do not gate it.
- **Draft vs production shape mismatch.** `persona` holds either `cardId` (preset) or `importedCardDraft` (`Card | ccv3.CharacterCardV3`), never a live card reference. `consciousness.engine` is `'web-llm' | 'cloud'` — Step 7 must translate draft fields into the real store shapes.
- **In-context downloads (Core Principle 1).** Selecting Whisper WebGPU in Step 1 calls `ensureWhisperLoaded(modelId)` which streams shard-download/WASM-compile progress via `onProgress(ProgressPayload)` and gates Next until ready. Do not let the user advance with a half-loaded model.
- **Refresh resume.** The draft is localStorage-persisted under `onboarding/v2-draft`; a mid-flow refresh should resume cleanly. Don't add unrelated state into this key, and use `reset()` on completion/abandon.


### Authoritative Design & Architecture Documents

- [docs/project-onboarding-modernize.md](docs/project-onboarding-modernize.md) — Onboarding modernization design doc (Core Principles, per-step behavior, Step 7 assembly).
- [docs/onboarding-overhaul-plan.md](docs/onboarding-overhaul-plan.md) — Onboarding overhaul plan.
- [docs/content/en/docs/advanced/architecture/design-onboarding-character-selection.md](docs/content/en/docs/advanced/architecture/design-onboarding-character-selection.md) — Onboarding character selection design.
- [docs/proposal-global-user-profile.md](docs/proposal-global-user-profile.md) — Global user profile proposal.

## Verification

- Typecheck: `pnpm -F @proj-airi/stage-ui typecheck` (covers `gate.ts`, `draft-store.ts`, step components).
- Manual: launch onboarding, confirm Next is disabled until each step's `canProceed` is true, skip buttons appear only where `skipLabel` set, refresh mid-flow resumes draft, and only at Step 7 does the production card/stores update atomically (verify no partial IndexedDB writes when cancelling).
