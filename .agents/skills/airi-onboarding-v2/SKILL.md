---
name: airi-onboarding-v2
description: >-
  Build/debug first-run Onboarding V2: setup steps, returning-user restore, gate/draft contracts, completion flags, model downloads, provider selection, atomic starter-card assembly. Existing-card editing uses airi-card-editor-wizard.
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

Commit-history markers if you're digging through git: "implement functional Sense Portal (easy mode) onboarding flow" (v3) → "scaffold onboarding v2" (v4 begins) → "V2 Step 1 STT Playground…" etc. Future post-V2 roadmap (Advanced Setup Lab, ACT/VRMA/ComfyUI/proactivity steps) has been unified into canonical `docs/project-onboarding-modernize.md` (historical proposal archived at `docs/archive/proposal-onboarding-overhaul.md`) and is NOT part of this skill's shipped surface.

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
| 0 Welcome | `step-0-welcome.vue` | Welcome/hardware | `isWebGPUSupported()` early detection; Cold-Device Quick Start vs. Skip Permanently; `ownNav` |
| 0.5 Triage | `../step-start-choice.vue` | 5 Use Cases | Local-First vs. Cloudflare Zero-Trust; handles auth cancel, empty vs. unreadable vaults |
| — Cloud Restore | `step-cloud-restore.vue` | returning only | `RestoreResult` inbound hydration; direct **`[ 🚀 Launch Stage with Restored Companions ]`** (no gauntlet hostage loop) OR **`[ + Create an Additional Companion ]`** |
| 1 Experience | `step-1-experience.vue` | Intent Bundles | 4 Standardized Hero Archetype Cards (*The Casual Companion*, *The Quiet Observer*, *The Executive Copilot*, *The Dynamic Performer*) + Customizer Deck |
| 2 Soul & Persona | `step-4-persona.vue` | Soul (Emotional First) | Seed starters (`STARTER_CHARACTERS`), Animadex archetypes, SillyTavern community interceptor |
| 3 Physical Vessel | `step-5-vessel.vue` | Body | `DiscoverCarousel.vue` 3D coverflow, starter presets (Hiyori Live2D, AvatarSample_A/B), custom dropzone |
| 4 User Profile | `step-3-user-profile.vue` | Identity | `useSettingsUserProfile` (name, description, prompt, voiceProfileId) |
| 5 Hearing | `step-1-hearing.vue` | STT (Conditional) | Whisper WebGPU / Web Speech; LevelMeter; unmount stops mic stream and VAD |
| 6 Consciousness | `step-2-consciousness.vue` | LLM (Mind) | WebLLM hero cards (`WEB_LLM_MODELS`) + cloud grid; VRAM transparency; live inference ping |
| 7 Voice Studio | `step-6-speech.vue` | TTS (Conditional) | Kokoro WebGPU / Pocket-TTS / Cloud; pitch/rate sliders 0.75x–1.5x; audio preview playground |
| Extended Artistry | `step-artistry.vue` | Art / Vision | ComfyUI API endpoint + Pollinations fallback |
| Finale Calibration | `step-7-calibration.vue` | Finale & Commit | Truthful Readiness Matrix, live first greeting with persistent Turn 0 in `useChatSessionStore`, strict atomic card commit |

Shared step UI: `v2/components/` (`companion-bubble.vue`, `lock-key-picker.vue`, `provider-picker-grid.vue`, `stt-test-box.vue`); shared presentation decks in `packages/stage-ui/src/components/modules/` (`HearingDeck`, `ConsciousnessDeck`, `VoiceStudioDeck`, `ArtistryDeck`); `v2/whisper-loader.ts`.

### Track Topology

```
new / local-first:  welcome → triage → experience → persona → vessel → profile → [hearing] → consciousness → [speech] → [extended] → calibration
returning:          welcome → triage → cloud-infrastructure → cloud-restore ──► [ 🚀 Launch Stage (Direct) ]
                                                                             └──► [ + Build Another ] ──► experience → persona → ...
```

(`STEPS` computed reactively in `onboarding-v2.vue` based on enabled capabilities; dynamic step rail displays `Step X of N`.)

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

- **Never commit from a step.** Steps write ONLY into `useOnboardingV2Draft`. Cancelling or navigating back must leave IndexedDB cards unmodified (Principle 6). Production writes happen once, in Step Finale.
- **Shared controls extraction boundary.** Settings and Onboarding both consume shared presentation controls (`HearingDeck`, `ConsciousnessDeck`, `VoiceStudioDeck`, `ArtistryDeck`). Never bind onboarding steps directly to production stores or attempt live store mutations with unmount-revert snapshots (as legacy Step 1 did). Onboarding adapters bind exclusively to `useOnboardingV2Draft`.
- **Strict atomic commit in Finale.** In `step-7-calibration.vue`, never commit speech or provider settings before card creation. Follow the 8-step atomic sequence: schema validation → card write to `cardsRepo` → provider bindings → Chat Turn 0 commit → active card designation → mark completed. Retries must reuse `card.id` to prevent duplicate cards.
- **Gate misuse.** Absent gate ≠ disabled Next; it means no gating at all. `skipLabel` must remain always-enabled. Use `onSkip` to veto (return `false`), not to run required work.
- **Loaders are implementations, not abstractions.** `ensureWhisperLoaded` lives in `v2/whisper-loader.ts`; WebLLM progress comes straight from `getWebLlmAdapter().loadModel(model, { onProgress })` in the step component; Kokoro preview uses `getKokoroAdapter()`. No `ensureWebLlmLoaded` helper exists — do not import one.
- **Step 6 WebGPU gate.** If `isWebGPUSupported()` is false, show the amber local-brain callout and steer to cloud cards; don't offer WebLLM hero cards as selectable.
- **Two `index.ts` barrels.** `onboarding/index.ts` (barrel for `OnboardingDialog`) vs `onboarding/v2/index.ts` (barrel for `OnboardingV2`). Import from the right scope.
- **Registering a new step.** New step files belong in `v2/steps/` and must be added to both the `STEPS` array AND the `v-if/v-else-if` chain in `onboarding-v2.vue` — forgetting the template branch renders a blank step.
- **Clean up resources on unmount.** Resource-owning steps (Hearing mic capture, Voice audio preview, Artistry test generation) must stop active MediaStream tracks, close AudioContext source nodes, and signal abort on in-flight promises upon unmount to prevent background audio or memory leaks.
- **Don't pollute `onboarding/v2-state`.** It is the resume coordinate only — keep unrelated state out of it.

### Authoritative Design & Architecture Documents

- [docs/project-onboarding-modernize.md](docs/project-onboarding-modernize.md) — Canonical Onboarding V2/V3 spec (Core Principles 1–6, 5 Entry Use Cases, per-step behavior, dual-track flow, codebase reference table).
- [docs/archive/proposal-onboarding-overhaul.md](docs/archive/proposal-onboarding-overhaul.md) — (Archived) Post-V2 roadmap superseded and consolidated into [docs/project-onboarding-modernize.md](docs/project-onboarding-modernize.md).
- [docs/design-onboarding-character-selection.md](docs/design-onboarding-character-selection.md) — Character selection & starter souls.
- [docs/proposal-global-user-profile.md](docs/proposal-global-user-profile.md) — Global user profile spec (Step 3).

## Verification

- Typecheck: `pnpm -F @proj-airi/stage-ui typecheck` (covers orchestrator, gate, draft-store, steps).
- Manual: launch onboarding on each platform mount (Electron window vs Dialog/Drawer); confirm Next disabled until `canProceed` true, skip appears only where `skipLabel` is set, refresh resumes from `onboarding/v2-state`+draft, `onboarding/completed`/`onboarding/skipped` are untouched until Step 7 finish or global skip, and no IndexedDB character-card writes happen on cancel.

## Related Skills & References

- **Key Documents**: [[project-onboarding-modernize]], [[design-onboarding-character-selection]], [[proposal-global-user-profile]], [[proposal-onboarding-overhaul]]
