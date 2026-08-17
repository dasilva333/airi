---
name: airi-onboarding-v2
description: >-
  Use when working with the AIRI Onboarding wizard, full 9-step sequence (Welcome, Triage, Cloud Sync/Restore, Hearing, Consciousness, User Profile, Persona, Vessel, Speech, Calibration), gate.ts onboardingV2Gate contracts, draft-store.ts onboardingV2Draft transient composition (Principle 6), onboarding-v2.vue orchestrator, onboarding-dialog.vue modal wrapper, steps/ directory Vue components, in-context model-shard downloads, whisper-loader.ts, Step 7 atomic card synthesis into airi-card/consciousness/hearing/speech stores, docs/project-onboarding-modernize.md, provider selection, character card assembly, first-run setup flow.
---

# AIRI Onboarding (V2 Architecture)

The V2 onboarding flow is the single canonical, fully shipped first-run wizard across AIRI (Web, Desktop, and Pocket). Legacy V1 onboarding files have been retired.

## Key Files/Locations

- `packages/stage-ui/src/components/scenarios/dialogs/onboarding/onboarding-dialog.vue` — canonical dialog/drawer wrapper used in `apps/stage-pocket/src/App.vue` and `apps/stage-web/src/App.vue`; mounts `OnboardingV2` in desktop `DialogRoot` or mobile `DrawerRoot`.
- `packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/onboarding-v2.vue` — top-level orchestrator; manages step progression, footer (`[ Next > ]` / `[ Skip Step ]`), and provides the gate API via `onboardingV2GateKey`.
- `packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/gate.ts` — defines `OnboardingV2GateState` (`canProceed`, `skipLabel`, `hint`, `onSkip`), `OnboardingV2GateApi` (`setGate(id, gate)`, `clearGate(id)`), and the `onboardingV2GateKey` `InjectionKey`.
- `packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/draft-store.ts` — `useOnboardingV2Draft` Pinia store; transient scratchpad persisted under `onboarding/v2-draft`. Fragments: `consciousness`, `hearing`, `speech`, `persona`, `vessel`, `userProfile`; computed `hasPersona`/`hasBrain`/`hasVessel`/`hasHearing`/`hasSpeech`; `reset()`.
- `packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/index.ts` — barrel: `export { default as OnboardingV2 } from './onboarding-v2.vue'`.
- `packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/steps/` — the complete step suite:
  - `step-0-welcome.vue` — Welcome landing and hardware/WebGPU detection.
  - `../step-start-choice.vue` — Path triage: Zero-Trust Cloudflare OAuth vs 100% Offline Local-First.
  - `step-cloud-infrastructure.vue` — (Returning track) Edge CORS proxy & S3/R2 provisioning.
  - `step-cloud-restore.vue` — (Returning track) Cloud snapshot hydration.
  - `step-1-hearing.vue` — STT provider matrix & live mic playground (Whisper WebGPU / Browser / Cloud).
  - `step-2-consciousness.vue` — LLM brain selection (WebLLM WebGPU hero cards / Cloud provider grid).
  - `step-3-user-profile.vue` — User display name, bio, narrative tags for prompt templating.
  - `step-4-persona.vue` — Soul selection (Seeded starters ReLU/Aria/Lupin, Anime archetypes, Community Hub imports).
  - `step-5-vessel.vue` — Physical body selection (3D VRM Avatars & 2D Live2D presets + custom dropzone).
  - `step-6-speech.vue` — Voice studio (Kokoro WebGPU, Pocket-TTS, Moss-Nano, Cloud TTS + live preview playground).
  - `step-7-calibration.vue` — Stage calibration, live spoken greeting, atomic AiriCard synthesis, and instant Stage launch.
- `packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/whisper-loader.ts` — Whisper WebGPU weight-shard loader.
- `packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/components/` — shared step UI subcomponents (`companion-bubble.vue`, `lock-key-picker.vue`, `provider-picker-grid.vue`, `stt-test-box.vue`).
- `packages/stage-ui/src/components/scenarios/dialogs/onboarding/step-provider-configuration.vue` — shared inline credential / endpoint input pane used by Step 1 & Step 2.
- `docs/project-onboarding-modernize.md` — canonical design spec (Core Principles, per-step behavior, Step 7 atomic assembly).

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

- [docs/project-onboarding-modernize.md](docs/project-onboarding-modernize.md) — Shipped Onboarding Modernization spec (Core Principles, per-step behavior, Step 7 atomic assembly).
- [docs/onboarding-overhaul-plan.md](docs/onboarding-overhaul-plan.md) — Advanced Setup Lab & Post-V2 Subsystem roadmap (ACT token calibration, ComfyUI, VRMA motion, Proactivity).
- [docs/content/en/docs/advanced/architecture/design-onboarding-character-selection.md](docs/content/en/docs/advanced/architecture/design-onboarding-character-selection.md) — Character selection and starter souls reference.
- [docs/proposal-global-user-profile.md](docs/proposal-global-user-profile.md) — Global user profile specification.

## Verification

- Typecheck: `pnpm -F @proj-airi/stage-ui typecheck` (covers `gate.ts`, `draft-store.ts`, step components).
- Manual: launch onboarding, confirm Next is disabled until each step's `canProceed` is true, skip buttons appear only where `skipLabel` set, refresh mid-flow resumes draft, and only at Step 7 does the production card/stores update atomically (verify no partial IndexedDB writes when cancelling).


