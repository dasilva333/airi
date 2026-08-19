---
name: airi-onboarding-v2
description: Use when working with the AIRI Onboarding wizard (V2 architecture), the full step sequence (Welcome, Triage, Cloud Sync/Restore returning-track, Hearing, Consciousness, User Profile, Persona, Vessel, Speech, Calibration), gate.ts onboardingV2Gate contracts, draft-store.ts onboardingV2Draft transient composition (Principle 6), onboarding-v2.vue orchestrator, onboarding-dialog.vue modal wrapper, useOnboardingStore first-run flags (onboarding/completed, needsOnboarding, markSetupCompleted/Skipped), steps/ directory Vue components, in-context model-shard downloads (whisper-loader.ts, WebLLM/Kokoro adapters), Step 7 atomic card synthesis into airi-card/consciousness/hearing/speech stores, docs/project-onboarding-modernize.md, provider selection, character card assembly, or first-run setup flow lineage.
---

# AIRI Onboarding (V2 Architecture)

The V2 onboarding flow is the single canonical, fully shipped first-run wizard. Legacy V1 files have been retired; every new step is written under `v2/steps/`.

## 0. Lineage — Why the Code Calls It "v2" When It Is the 4th Generation

The codebase id `v2` refers to an architecture version, not a generation counter. Do not "upgrade to v3" because v3 already happened in the fork's product history:

| Generation | Codename | Scope | Status |
|---|---|---|---|
| (upstream) | Easy Mode / Advanced Mode | Pick an LLM provider (+ sign in to AIRI cloud account) → done | Retired |
| (fork) v1 | — | Only pick LLM | Retired |
| (fork) v2 | — | LLM + pick character | Retired |
| (fork) v3 | Sense Portal (easy mode) | Easy-mode TTS + LLM setup, then character | Retired |
| **(fork) v4 — `v2` in code** | **Onboarding V2** | **Full multi-domain wizard: STT, LLM, user profile, persona, vessel, TTS, cloud sync/restore** | **Active, canonical** |

Commit-history markers if you're digging through git: "implement functional Sense Portal (easy mode) onboarding flow" (v3) → "scaffold onboarding v2" (v4 begins) → "V2 Step 1 STT Playground…" etc. Future post-V2 roadmap (Advanced Setup Lab, ACT/VRMA/ComfyUI/proactivity steps) lives in `docs/onboarding-overhaul-plan.md` and is NOT part of this skill's shipped surface.

## Key Files/Locations

### Mounting (per platform)

**Desktop (Electron)** — dedicated onboarding window (`main/windows/onboarding/`), page `apps/stage-tamagotchi/src/renderer/pages/onboarding.vue` mounting `OnboardingV2` directly. Three launch surfaces, all funneling into the same window via `electronOpenOnboarding` (handled by `main/services/airi/onboarding/index.ts`):

1. **First run**: main-window `App.vue` watches `onboardingStore.needsOnboarding` and opens the wizard automatically on fresh installs.
2. **System tray**: "Start Companion Wizard" menu item → `onboardingWindow.openWindow('/onboarding')` (`main/tray/index.ts:80`).
3. **Settings → AIRI Cards → Create button**: `CreateModeSelectorDialog.vue` offers 3 modes; **Companion Wizard** is the "Recommended" first option and emits `wizard` → `airi-card/index.vue:handleWizardMode()` → `onboardingStore.resetSetupState()` + `forceShowSetup()`, which re-trips the same first-run watcher (the other two modes are *Guided AI Creator* → AnimaDex `guided.vue` route, and *Advanced Manual* → card editor tabs — do not conflate those with this wizard).

**Web & Pocket** — `onboarding-dialog.vue` (desktop `DialogRoot` / mobile `DrawerRoot`) mounts `OnboardingV2`; used in `apps/stage-web/src/App.vue` and `apps/stage-pocket/src/App.vue`.

### Orchestrator & Contract
- `packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/onboarding-v2.vue` — orchestrator: step rail, Back/Next/Skip footer, direction transitions, `ownNav` steps (welcome, calibration render their own navigation).
- `packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/gate.ts` — gate contract (below).
- `packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/draft-store.ts` — transient draft (below).
- `packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/index.ts` — barrel export `OnboardingV2`.
- `packages/stage-ui/src/components/scenarios/dialogs/onboarding/types.ts` — shared step handler types (`OnboardingStepNextHandler`, `OnboardingStepPrevHandler`).
- `packages/stage-ui/src/stores/onboarding.ts` — `useOnboardingStore`: first-run visibility flags (`onboarding/completed`, `onboarding/skipped`), `needsOnboarding`, `markSetupCompleted()`, `markSetupSkipped()`, `forceShowSetup()`, `resetSetupState()`; also computes essential-provider fallback detection.

### Step Suite (`v2/steps/`)
| Step | File | Domain | Notes |
|---|---|---|---|
| 0 Welcome | `step-0-welcome.vue` | Welcome/hardware | `isWebGPUSupported()` detection; `ownNav` (has `[ Skip everything ]`) |
| 0.5 Triage | `../step-start-choice.vue` (parent dir) | Path split | `onSelectPath('new' \| 'returning')`; Zero-Trust Cloudflare vs Local-First |
| — Cloud Infra | `step-cloud-infrastructure.vue` | returning only | Edge CORS proxy + R2 provisioning |
| — Cloud Restore | `step-cloud-restore.vue` | returning only | Snapshot hydration |
| 1 Hearing | `step-1-hearing.vue` | STT | Provider grid + live mic playground; gate unlocks ONLY on real transcript text |
| 2 Consciousness | `step-2-consciousness.vue` | LLM | WebLLM hero cards (`WEB_LLM_MODELS`) + cloud grid; loads via `getWebLlmAdapter().loadModel()` (progress-driven) |
| 3 User Profile | `step-3-user-profile.vue` | Identity | `useSettingsUserProfile` (name, description, prompt, voiceProfileId) |
| 4 Persona | `step-4-persona.vue` | Soul | Seed starters from `STARTER_CHARACTERS` (`constants/prompts/character-defaults.ts`); Anime archetype tier uses `assets/animadex-catalog.json`; community card webview interception; draft holds `cardId` or `importedCardDraft` |
| 5 Vessel | `step-5-vessel.vue` | Body | Preset VRM/Live2D entries (default `preset-live2d-2`) + custom dropzone (`display-models.ts`) |
| 6 Speech | `step-6-speech.vue` | TTS | Local heroes (Kokoro WebGPU, Pocket-TTS, Moss-Nano) + cloud grid; live preview playground; pitch/rate sliders constrained 0.75x–1.5x; speech engineered as Audio-Studio-style `VoiceProfile` tuple |
| 7 Calibration | `step-7-calibration.vue` | Finale | `ownNav`; summary badges, live spoken greeting, **atomic AiriCard synthesis + production-store commit**, instant Stage launch |

Shared step UI: `v2/components/` (`companion-bubble.vue`, `lock-key-picker.vue`, `provider-picker-grid.vue`, `stt-test-box.vue`); `onboarding/step-provider-configuration.vue` (shared inline credential pane for Steps 1 & 2 — no deep links into `/settings/providers`); `v2/whisper-loader.ts` (`ensureWhisperLoaded(modelId, onProgress)` shard/WASM loader gating Step 1 Next per Core Principle 1).

### Track Topology

```
new / local-first:  welcome → triage → hearing → consciousness → profile → persona → vessel → speech → calibration      (9 stops)
returning:          welcome → triage → cloud-infrastructure → cloud-restore → hearing → consciousness → profile → persona → vessel → speech → calibration      (11 stops)
```

(`STEPS` computed in `onboarding-v2.vue`; progress rail is clickable for free navigation by index.)

## Gate Contract (footer control)

`provide(onboardingV2GateKey, { setGate, clearGate, requestNext })` from the orchestrator; steps `inject` it and call `setGate(stepId, state)`:

```typescript
interface OnboardingV2GateState {
  canProceed: ComputedRef<boolean> | boolean | (() => boolean) // Next disabled until true
  skipLabel?: string // renders ALWAYS-enabled Skip button with this label
  hint?: string // italic hint shown in footer while !canProceed
  onSkip?: () => boolean | void | Promise<boolean | void> // may intercept/veto (return false) the skip action
}
```

- **Absent gate = free-flowing footer** (Next always enabled, no skip button).
- `skipLabel` button is never disabled by `canProceed` — way out even when a gate is red.
- Orchestrator also exposes optional `requestNext` on the gate API for steps that drive advancement programmatically.
- Whole-wizard bail: Step 0's `handleSkip` → `onboardingStore.markSetupSkipped()` + reset; Step 7 finish → `markSetupCompleted()`.

## Draft Composition (Core Principle 6 — non-negotiable)

`useOnboardingV2Draft` persisted under `onboarding/v2-draft` (`useLocalStorageManualReset`) is the ONLY mutation surface for steps 1–6:

```typescript
interface OnboardingV2DraftState {
  consciousness: { provider?: string, model?: string, engine?: 'web-llm' | 'cloud' }
  hearing: { provider?: string, model?: string }
  speech: { provider?: string, model?: string, voiceId?: string }
  persona: { cardId?: string, source?: 'preset' | 'import', importedCardDraft?: Card | ccv3.CharacterCardV3 }
  vessel: { displayModelId?: string }
  userProfile: { name?: string, description?: string, prompt?: string, voiceProfileId?: string, pitch?: number, rate?: number }
}
```

- Whole-fragment replacements via `set*()` writers; derived booleans `hasPersona`/`hasBrain`/`hasVessel`/`hasHearing`/`hasSpeech`.
- Production stores (`airi-card`, `consciousness`, `hearing`, `speech`) are only written in Step 7's atomic synthesis (`step-7-calibration.vue`), where draft fields are translated to real store shapes (`consciousness.engine: 'web-llm' | 'cloud'` is a draft-only field that must be mapped).
- Step 1 may *read* from `useHearingStore` machinery (`transcribeForMediaStream` etc.) for the live playground, and Step 6 *reads* `useSpeechStore`/provider config; neither would write to production.
- `reset()` is called on completion/abandonment; mid-flow refresh must resume from the draft.

## Orchestrator Persistence Keys (isolated from production)

| Key | Purpose |
|---|---|
| `onboarding/v2-state` | `{ stepId, path: 'new' \| 'returning' }` — resume position |
| `onboarding/v2-skipped` / `onboarding/v2-completed` | Orchestrator mirror flags |
| `onboarding/v2-draft` | Transient composition (above) |
| `onboarding/completed` / `onboarding/skipped` | PRODUCTION first-run flags (`useOnboardingStore`) — only written via `markSetupCompleted`/`markSetupSkipped` at finish/global-skip |

The orchestrator's NOTICE comment is load-bearing: V2 previewing must never mutate live `onboarding/completed`/`onboarding/skipped` outside its own finish/skip handlers.

## When to Use

- Adding, removing, reordering, or editing any onboarding step or the footer/rail navigation.
- Debugging disabled `[ Next > ]` (gate predicate) or missing/appearing `[ Skip Step ]`.
- Working on draft persistence, mid-flow resume, or the atomic Step 7 commit.
- Wiring provider/model selection (LLM, STT, TTS) or display-model selection into the draft.
- Implementing in-context downloads (Whisper shards, WebLLM weights) gating a step.
- Touching `useOnboardingStore` first-run visibility logic or re-showing setup.

## Common Pitfalls

- **Never commit from a step.** Steps write ONLY into `useOnboardingV2Draft`. Cancelling or navigating back must leave IndexedDB cards unmodified (Principle 6). Production writes happen once, in Step 7.
- **Design-doc drift — Step 2 "bidirectional store sync."** `docs/project-onboarding-modernize.md` §Step 2 describes live patching of `consciousnessStore`/`activeCard.extensions.airi.modules.consciousness` from within the step. The shipped implementation is draft-only; **the code wins**. Do not implement that sync to "match the doc" without explicitly re-approving Principle 6.
- **Gate misuse.** Absent gate ≠ disabled Next; it means no gating at all. `skipLabel` must remain always-enabled. Use `onSkip` to veto (return `false`), not to run required work.
- **Loaders are implementations, not abstractions.** `ensureWhisperLoaded` lives in `v2/whisper-loader.ts`; WebLLM progress comes straight from `getWebLlmAdapter().loadModel(model, { onProgress })` in the step component; Kokoro preview uses `getKokoroAdapter()`. No `ensureWebLlmLoaded` helper exists — do not import one.
- **Step 2 WebGPU gate.** If `isWebGPUSupported()` is false, show the amber local-brain callout and steer to cloud cards; don't offer WebLLM hero cards as selectable.
- **Two `index.ts` barrels.** `onboarding/index.ts` (barrel for `OnboardingDialog`) vs `onboarding/v2/index.ts` (barrel for `OnboardingV2`). Import from the right scope.
- **Registering a new step.** New step files belong in `v2/steps/` and must be added to both the `STEPS` array AND the `v-if/v-else-if` chain in `onboarding-v2.vue` — forgetting the template branch renders a blank step.
- **Clean up resources on unmount.** Step 1 stops mic monitoring/VAD/streaming sessions on unmount to avoid leaks into Step 2; keep any new resource-owning step to the same discipline.
- **Don't pollute `onboarding/v2-state`.** It is the resume coordinate only — keep unrelated state out of it.

### Authoritative Design & Architecture Documents

- [docs/project-onboarding-modernize.md](docs/project-onboarding-modernize.md) — Shipped V2 spec (Core Principles 1–6, per-step behavior, dual-track flow, codebase reference table). Note its `file:///` links are historical artifacts; resolve paths repo-relative.
- [docs/onboarding-overhaul-plan.md](docs/onboarding-overhaul-plan.md) — Post-V2 roadmap (Advanced Setup Lab, ACT token calibration, ComfyUI, VRMA, Proactivity) — future work, not this skill's surface.
- [docs/content/en/docs/advanced/architecture/design-onboarding-character-selection.md](docs/content/en/docs/advanced/architecture/design-onboarding-character-selection.md) — Character selection & starter souls.
- [docs/proposal-global-user-profile.md](docs/proposal-global-user-profile.md) — Global user profile spec (Step 3).

## Verification

- Typecheck: `pnpm -F @proj-airi/stage-ui typecheck` (covers orchestrator, gate, draft-store, steps).
- Manual: launch onboarding on each platform mount (Electron window vs Dialog/Drawer); confirm Next disabled until `canProceed` true, skip appears only where `skipLabel` is set, refresh resumes from `onboarding/v2-state`+draft, `onboarding/completed`/`onboarding/skipped` are untouched until Step 7 finish or global skip, and no IndexedDB character-card writes happen on cancel.
