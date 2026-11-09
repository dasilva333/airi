# Proposal: Dual-Duty Ninja-Swap Interceptor (Speech Tags + ACT Cues)

> **Status**: Tier 1 and Character Card Schema SHIPPED (Oct 2026) — `EmotionCalibrationStudio.vue` + `settings/models/emotions` route + guided Meet/Name/Verify dots shipped; canonical `expressionCapabilities` / `motionCapabilities` on `DisplayModelFile` shipped; `CharacterCueAllowlistSchema` (`cueAllowlist` with version 1, emotions & motions) shipped on `card.extensions.airi.acting`. Acting tab streamlined to 4 side-by-side hubs (`Cues`, `Voice`, `Thinking`, `Lab`) with the Autonomous Cues (System-1 Interceptor) UI live.
> **Current Focus**: Tier 2 live chat integration — shared module extraction from Rehearsal Room into chat pipeline, enforcing the Evaporation Doctrine (zero history pollution), landing the pipe with emotions first before widening to motions.
> **Promoted from**: [`docs/proposal-jev-integration.md`](./proposal-jev-integration.md) Domain F (Phase 6 — NEXT UP) and [`docs/design-jev-integrations.md`](./design-jev-integrations.md) §4 Domain F.
> **Related domain skill**: [`.agents/skills/airi-jev-decision-engine/SKILL.md`](../.agents/skills/airi-jev-decision-engine/SKILL.md)
> **Adjacent docs (do not duplicate, integrate with)**:
> - [`design-act-token-expression-system.md`](./design-act-token-expression-system.md) — ACT token formats + parser pipeline (actuation side).
> - [`design-acting-tab-and-chatterbox.md`](./design-acting-tab-and-chatterbox.md) — Acting tab authoring surface + Chatterbox capabilities (Tier 1 upstream).
> - [`proposal-conversational-pacing-thinking-fillers.md`](./proposal-conversational-pacing-thinking-fillers.md) — owns the speech lane; single-owner rule applies (see §5).
> - [`airi-acting-cue-act-tokens/SKILL.md`](../.agents/skills/airi-acting-cue-act-tokens/SKILL.md), [`airi-speech-pipeline/SKILL.md`](../.agents/skills/airi-speech-pipeline/SKILL.md), [`airi-speech-runtime/SKILL.md`](../.agents/skills/airi-speech-runtime/SKILL.md)

---

## 1. Problem: the voice-face emotional disconnect

Avatar interaction relies on two annotation systems that historically clash:

1. **Physical blendshapes & gestures**: inline `<|ACT:emotion="smug",motion="lean_forward"|>` cues driving Live2D, VRM, and Stage-Mate rigs.
2. **Audio speech tags**: prepended expressive tags (`[whisper]`, `[giggle]`, `*sigh*`) driving inflection-aware TTS backends (`airi-audio-server` / Chatterbox, Fish Audio, IndexTTS-2.0, Higgs, OmniVoice).

Forcing the primary conversational LLM (System 2) to generate both inline creates severe failure modes:

1. **Token cost, latency & cache invalidation**: 20–40 extra markup tokens per turn, degraded Time-to-First-Token (TTFT), broken KV-cache prefix stability.
2. **Model non-compliance**: smaller/local models (7B/8B) hallucinate invalid tag names or drop markers altogether.
3. **Concurrent-execution desync**: if TTS synthesis dispatches immediately while avatar cues resolve in parallel, TTS receives flat unannotated text — the 3D model smiles while the voice stays monotone.
4. **Hardware junk drawer & persona integrity**: VRM/Live2D rigs expose 40–100 raw blendshapes. Dumping the full catalog into a runtime classifier dilutes probabilities and breaks persona (a stoic character smiling at a joke because `happy` was in the candidate pool).
5. **Regex infeasibility**: card authors write natural-language acting guidelines, not per-token markup — naive regex matches zero tokens.

---

## 2. Architecture: two-tier persona compiler + stride interceptor

```text
┌────────────────────────────────────────────────────────────────────────┐
│  Tier 1: Authoring-Time Reverse Extractor ("The Persona Compiler")     │
│  Trigger: author edits Acting Tab prompts or imports/switches a card   │
│  Engine:  local Needle 2 (WASM), local tiny LLM, or Jev schema query   │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
                                     ▼
                Compiled Character Whitelist Cache
                ┌────────────────────────────────────────────────────────┐
                │ whitelisted_emotions: ["deadpan", "glare", "smirk"]   │
                │ whitelisted_motions:  ["arms_crossed", "head_turn"]   │
                │ whitelisted_speech:   ["whisper", "sigh", "neutral"]   │
                └────────────────────┬───────────────────────────────────┘
                                     │
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│  Tier 2: Real-Time Sentence Stride Interceptor (~110ms Ninja-Swap)     │
│  Trigger: live sentence stride emitted by primary chat LLM             │
│  Engine:  TypeSafe Jev / Laya Local (single merged request)            │
│                                                                        │
│  Jev options fed STRICTLY from compiled whitelist:                     │
│    - act_emotion: ["none", "deadpan", "glare", "smirk"]                │
│    - act_motion:  ["none", "idle", "arms_crossed", "head_turn"]        │
│    - speech_tag:  ["none", "whisper", "sigh"]                          │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
           ┌─────────────────────────┴─────────────────────────┐
           ▼                                                   ▼
┌──────────────────────────────────────┐   ┌──────────────────────────────────────┐
│  Avatar Rig (Live2D / VRM / Mate)    │   │  Audio Engine (Chatterbox / Index)   │
│  Inject: <|ACT:emotion="smug"...|>   │   │  Inject: "[sigh] You actually..."    │
└──────────────────────────────────────┘   └──────────────────────────────────────┘
```

### 2.1 Tier 1: authoring-time persona compiler (reverse extractor)

#### Tier 1 surfaces inventory (5 entry points, one compiler)

Button-level reference — where each entry lives today:

| # | Surface | Entry point (file:line) | Code anchor | State today |
|---|---|---|---|---|
| 1 | Manual entry (character config) | Acting tab text fields + sparkle glyphs — `packages/stage-pages/src/pages/settings/airi-card/components/tabs/CardCreationTabActing.vue` (`actingModelExpression` sparkle ~L618, `actingSpeechExpression` sparkle ~L740) | `CardCreationTabActing.vue` (`actingModelExpression` / `actingSpeechExpression`) | Free-text textarea stays as the permanent manual escape hatch (reverse-parse into whitelist pending) |
| 2 | Sparkle per-field generator (first-gen) | Confirm dialog — `packages/stage-pages/src/pages/settings/airi-card/components/CardEditorForm.vue` (`openSparkleGenerator` ~L1692, confirm overlay below) | `FieldAiGeneratorModal.vue` via `CardEditorForm.openSparkleGenerator` | RETIRED for `actingModelExpression` (Oct 2026): sparkle click shows a confirm + routes to `settings/models/emotions` with `?model=` when known (other fields keep the modal) |
| 3 | AI curated wizard | Auto-Curate banner button — `packages/stage-ui/src/components/scenarios/settings/model-settings/ModelCustomizer.vue` (`AI Expression Curation` banner ~L1237, confirm overlay) | Formerly embedded `ExpressionCurationModal.vue` (removed) | RETIRED (Oct 2026): button confirms, then in-window `router.push` to `settings/models/emotions?model=` — modal, import, and apply handler deleted |
| 4 | Onboarding emotions phase | Onboarding wizard Emotions step — `packages/stage-ui/src/components/scenarios/dialogs/onboarding/v3/steps/step-emotions.vue` (thin draft-bound wrapper) | `EmotionCalibrationStudio.vue` (shared component — fixes land once, benefit both) | LIVE: same studio, embedded context |
| 5 | Rehearsal Room | Generate Acting Instructions button — `apps/stage-tamagotchi/src/renderer/components/chat/chat_rehearsal.vue` (button ~L694, confirm overlay at file end) | `electronOpenSettings` eventa → `settings/models/emotions?model=` in the Settings window | RETIRED (Oct 2026): `ModelPromptGeneratorModal` + its card-writing save path removed from rehearsal. Long-term footnote (not now): rehearsal failed as a teaching tool but works as a debug tool — relocate under `settings/modules` as a demo playground with the emotion studio mounted in its place. |
| ★ | Unified studio (all roads lead here) | Hidden route — `packages/stage-pages/src/pages/settings/models/emotions.vue` (`settingsEntry: false`) | `packages/stage-ui/src/components/scenarios/acting/EmotionCalibrationStudio.vue` | LIVE: guided Meet → Name → Verify → Remaps + full cockpit; onboarding embeds the component |

`use-expression-curation.ts` (`curateExpressions` / `generateActingPrompt` / `previewOnStage` / `applyCuration`) is the shared logic behind the studio's Name curation, Enhance pass, previews, and legacy apply paths.

#### 2.1.1 Grand unification plan (agreed direction): decompose, don't port

The 4–5 Tier 1 surfaces are distinctively different processes — porting the 3-step curator wizard into a full page (or nesting it inside the onboarding wizard) preserves the wrong shape. Instead, the **single-pass `step-emotions.vue` cockpit is the baseline**: model left, canonical premaps right, lightweight calibrate + nuanced LLM pass + tactile soundboard, all in one pass. The work is decomposition:

**Extract** `step-emotions.vue` (1022 lines) into a reusable studio component (proposed: `components/scenarios/acting/EmotionCalibrationStudio.vue`, new folder — none exists today):

| Block | Moves into studio (parameterized) | Stays with caller |
|---|---|---|
| §§1–3 model/vessel resolution, stage mount, capability scan (`rawExpressions` / `candidateExpressions` via noise-gate) | Yes — model-Id source + preview assets as props | Onboarding wrapper passes draft vessel; route wrapper passes route param + card store |
| §4 canonical 6-slot mappings + soundboard + `triggerPreview` | Yes — pure, moves verbatim | — |
| §5 auto-calibration (presets → regex → fallback) + default directives | Yes — pure logic | Mount-time auto-calibrate *policy* stays with caller (onboarding auto-runs; route runs on demand) |
| §6 directives hub + Enhance with AI (`generateActingPrompt`) | Yes — prompt context (name/personality/description) as props | — |
| Cockpit template (avatar viewport + mapping card + directives hub) | Yes — navigation chrome via slots | Onboarding header/i18n + Back/Continue; route settings chrome |
| §8 draft sync (`useOnboardingV3Draft`) | No | Onboarding wrapper only; route wrapper binds `displayModels` + card store instead |

**Retire the modal, keep its power feature.** `ExpressionCurationModal.vue`'s 3-step flow goes away as a wizard, but it does one thing the studio doesn't: full-catalog curation (scope select over 335 morphs, per-morph rename/skip). That survives as an **Advanced drawer/section on the studio page** (the current "Details >" affordance), not a separate flow. Entry buttons (ModelCustomizer "Curate AI", acting-tab sparkle, Rehearsal Room button) navigate to the route; onboarding embeds the component.

**Whitelist wiring in the unified shape**: `compiledWhitelist.emotions` (token → `{rawKey, label}`) derives deterministically from Verify keepers + mapped remap slots; motions append with their phase; speech-tag allowlist via the step-3 LLM sidecar (§2.1.3).

#### 2.1.4 6-slot successor: semantic pipeline + guided curation (design in progress)

The 6 static slots don't die — they become the *optional preset layer*. The successor pipeline:

```text
raw morph keys → noise gate → [pass] → semantic classification → semantic keys (the whitelist)
                                                              ↘ (optional) preset-emotion mapping (6 fast-path cues for Tier 2)
                              → [fail] → hidden / skipped
```

- **Stage 1 (deterministic, shipped)**: `filterCandidateExpressions` noise gate — already in `use-expression-curation` path via `loadModelCapabilities`.
- **Motions (shipped inventory, curation pending)**: Live2D/Spine motions queried from the model file (`caps.motions`); MMD/VRM always ship built-in (+ custom) sets (`mmdStore.availableMotions`, `customVrmAnimationsStore.animationOptions`) — no remap needed, but the user activates which ones the character may use (Verify-step concern). Name-step tiles: Total Facial Expressions | Available Facial Expressions | Body Motions.
- **Speech tags (deferred)**: availableTags × authored speech-prompt cross-section is real scope, but it spans a second domain (TTS provider capabilities). Land emotion + motion first, fold speech in after.
- **Stage 2 (new)**: classify passed keys into **semantic keys** (user-vetted: click each candidate, observe the avatar, keep/discard, name it). This ordered, vetted list IS the whitelist.
- **Stage 3 (optional)**: bind semantic keys onto the 6 preset emotion slots (smile/blush/pout/surprise/wink/shy) as Tier-2 fast-path cues. Models with rich rigs skip this; sparse rigs lean on it.

**Guided curation UX (dots breadcrumb, right column; avatar column untouched)**: the page's cognitive load is the real blocker — a new user sees mappings, tokens, directives with no idea what to click first. A lightweight dot-guided pass over the right column:

1. **Meet** — greeting + concept in plain language (what an expression is, why models differ, what the end goal is: a clean list your character learns from). Demo-anchored: sets a known-working model (verified: AvatarSample_B / `preset-vrm-2`, only `Surprised` fires) and offers one deterministic button ("press Surprise, watch it work") with auto-advance + light fanfare on success. Skip exits to the full cockpit. No Continue pressure.
2. **Name** — merged old-modal step 1 stats + step 2 review inline (no modal): candidate counts, then the per-key list with play + hide controls. Guidance-first: an explicit **button** (not auto-launch — the call costs provider budget/latency and the user must understand what just happened) labeled with what it does: takes all remaining keys, keeps the likely-working usable ones, gives them neat names. Next unlocks only after curation completes (zero-expression rigs get an apology + disabled Next). No per-step AI picker v1: the director chip is read-only (global consciousness LLM) — switching providers mid-flow, especially inside onboarding, is deferred.
3. **Verify** — after the AI pass: explicit instruction to click play on each item and hide (eye icon) anything that doesn't visibly fire. Nothing advances until the user has vetted; the vetted list IS the whitelist.
4. **Remaps (optional)** — the current 6-preset view as the final optional step: bind semantic keys onto preset slots, auto-templated prompt baked into state from the in-memory whitelist, with Enhance with AI as pure polish (persona-aligned usage guidance, e.g. grunge character told to use `happy` sparsely).

The dots component lives in the studio so it renders identically embedded in onboarding (as the step body) and standalone (same component, settings chrome). Skip exits to the full un-guided cockpit.

**Reliability caveat**: the Meet beat is only deterministic if the anchor key fires on demand. `Surprised` on AvatarSample_B has been observed not activating intermittently — health-check the anchor (test-fire silently, or confirm stage mounted) before presenting the "press to see it work" button, with a graceful fallback line if it fails rather than a dead demo.

**Demo mode (proposed)**: hardcode the Meet/Try dots to a known-good model (VERIFIED by user: AvatarSample_B / `preset-vrm-2` — only `Surprised` fires; `BUILTIN_MODEL_PRESETS` claims of 6/6 working are aspirational for this rig) and script the narrative around one verified-working key ("click Surprise — see? now try the others — notice they don't all work: no two models ship the same expressions. Your job: find the ones that work and name them.").

#### 2.1.2 Known UX defects in the current modal (`ExpressionCurationModal.vue`)

1. **Footer ignores dark theme** (`ExpressionCurationModal.vue:524`): pairs `bg-neutral-50/80` with `dark:bg-neutral-850`. `neutral-850` is a non-standard shade (used 71× repo-wide, so presumably a custom Uno token in some app configs) — if the rendering surface's Uno build lacks the token, the dark class never generates and the light background wins. Fix: `dark:bg-neutral-900`, or prove `850` resolves in every consuming app's Uno config.
2. **Step 2 cannot vet options**: 6-column table crammed into `max-w-2xl`, raw keys truncated to 120px, and the eye-icon preview fires on the stage *behind* the modal overlay (`bg-black/60` + blur) — the user literally cannot see what they are validating. Resolved by the full-page master-detail layout (§2.1.1).
3. **Whitelist not compiled at synthesis**: step 3 already holds `activeItems` (label / actToken / category / shouldSkip) when `generateActingPrompt` runs — the whitelist is one derivation away and currently discarded. See §2.1.3.

#### 2.1.3 Compiling `compiledWhitelists` at the step-3 synthesis pass

- **Emotions/motions: deterministic, no LLM needed.** `activeItems` already carries `actToken` + `category` + `shouldSkip` — the whitelist emotion/motion sets are a pure function of the non-skipped items. Zero extra cost, zero variance. The rendered template lists the union of keeper actTokens and mapped preset slot tokens (both are live cues once bound — e.g. `blush → Surprised` means `blush` is taught alongside `stunned_start`).
- **Speech tags: LLM-assisted.** Curation output contains no speech tags; the allowlist needs persona judgment (stoic → no `giggle`) intersected with provider capabilities (`expressionTags` plumbing already exists — see §4). Options: extend the step-3 prompt to return directives + a JSON sidecar, or a second small structured call reusing the same context.
- **Scope note**: this solves the wizard path (surfaces 3–4) only. Manual acting-tab input (surface 1) still needs the debounced background "fancy parse" compile on edit — that is the Q3 shootout item.

- **When it runs**: asynchronously (debounced ~500ms) when the user edits `acting.modelExpressionPrompt` or `acting.speechExpressionPrompt` in `CardCreationTabActing.vue`, or upon card import/switch.
- **Inputs intersected**:
  1. **Avatar hardware catalog**: expressions/motions actually wired in the Model Customizer (`character.expressions`, `character.motions`).
  2. **Speech engine capabilities**: programmatic `expressionTags` — already plumbed today via `useActingCapabilities.ts` → `speechCapabilities.expressionTags`, provider registry `supportsExpressionTags`/`expressionTags` (`packages/stage-ui/src/stores/providers/registry/speech.ts`), and the `airi-audio-server.vue` capabilities page.
  3. **Author's natural-language prompts**: freeform expressive demeanor + constraints.
- **Extraction task**: *"Given this character's acting guidelines, the model's mapped capabilities, and available TTS speech tags, extract the exact subset of emotion keys, motion keys, and speech tags this character is authorized to use."*
- **Output (SHIPPED Oct 2026 — shape supersedes the array sketch below)**: the union from both guided legs, persisted at `extensions.airi.acting.compiledWhitelist` (card-level; the `acting` schema is `looseObject`, so no migration):
  ```json
  {
    "version": 1,
    "emotions": {
      "stunned_start": { "rawKey": "Surprised", "label": "Stunned Start" },
      "blush": { "rawKey": "Surprised", "label": "Blush" }
    }
  }
  ```
  Verify keepers contribute their actTokens first; mapped preset slots add any token not already present. Template and classifier both read these keys — neither leg alone is ever the vocabulary. (The earlier `whitelistedEmotions[]` arrays sketch is superseded by this token→morph map; motions/speech arrays return with their phases.)
- **Cost**: runs offline once at authoring/import time (~300–800ms), zero real-time streaming impact.

#### 2.1.5 Tier 1 execution: goals, data model, and build log

**Goal.** Tier 1 exists to clean the data so Tier 2 never has to guess. Every avatar ships a private morph namespace (raw keys); every character needs a public cue vocabulary (ACT tokens). Tier 1's entire job is building a verified bridge between the two and caching it — first at the shared model level, then projected per character. Direction of travel: raw morphs → noise filter → semantic naming (Verify) → preset remaps → compiled whitelist → (Tier 2 consumes). Speech tags ride the same pipeline only after emotion + motion land.

**Three alias layers (do not conflate).**
1. **Display label** (`rawKey → human label`, e.g. `shocked → "Very Surprised"`): one label per raw key, display only. Stored on the display-model record (`emotionMappings[rawKey] = label`, cf. `applyCuration`).
2. **ACT slot binding** (`rawKey → actSlot`, e.g. `shocked → surprised`): one slot per raw key, but unlimited raw keys per slot — the VRM runtime (`VRMModel.vue:1087`) inverts the map on load and fires every bound morph per slot. Many-to-one is native; no "second alias entry" is needed or possible at this layer.
3. **ACT token vocabulary** (what the LLM may emit, e.g. `very_surprised`): the only layer where multiple names for one morph is meaningful — and today it exists only as prose inside the generated directives prompt, not as data. `compiledWhitelists` is that vocabulary made machine-readable (`actToken → rawKey`), and it is what Tier 2 will query.

**Model-level vs character-level (locked).** Rig truth lives on the **display-model record** (emotion mappings, labels) so every card sharing an avatar reuses months of curation work. Taste lives on the **card** (`extensions.airi.acting`: directives prompt + `compiledWhitelists`), so a grunge card and a bubbly card on the same avatar whitelist different subsets. This split already exists in the codebase (model record vs card extension); the whitelist completes it — no migration.

**The terminal field: `modelExpressionPrompt`.** Everything in Tier 1 serves exactly one runtime field:

```ts
interface ActingConfig {
  modelExpressionPrompt: string // ← the whole game
  speechExpressionPrompt: string
  speechMannerismPrompt: string
  idleAnimations?: string[]
}
```

Today all 5 Tier 1 surfaces write `modelExpressionPrompt` in free prose — which is precisely why the whitelist has to exist: prose can't be queried, a structured list can. So the full pipeline ends here:

```text
customExpressions (model-level rig truth)
  → curated (AI-named keepers)
    → compiledWhitelist (per-character structured allowlist)
      → templated (synthetic generic prompt derived from the whitelist)
        → modelExpressionPrompt (overwritten — the runtime reads only this)
```

When the guided flow finishes, it overwrites the user's `modelExpressionPrompt` with the templated synthesis. No merge, no append — overwrite, because the whitelist is now the source of truth and the prompt is its rendering.

**Endgame: one UI, one escape hatch.** Once this flow lands, every surface that writes `modelExpressionPrompt` gets pointed at it — the curated wizard, the Sparkle per-field generator (for acting fields), the onboarding emotions step (already the same component), the Rehearsal Room entry. Four of the five converge. The fifth — the raw textarea in the Acting tab — stays forever, because the user must retain full manual control. It just reverses direction: instead of writing the field directly, free text gets parsed *back* into `compiledWhitelists` (the Tier 1 "fancy parse" background compile), which then re-renders the prompt. Manual control is preserved; structured truth is preserved; they stay in sync through the whitelist, never around it.

**Direction normalization (tracked follow-up, NOT in Remaps).** The commit path writes mappings as `slot → rawKey` while both runtimes read `rawKey → actSlot`, and curated display labels collide with slot bindings in the same record field. Flipping writers without migrating readers (ModelCustomizer display, commit, sync-engine) breaks faces — so Remaps ships persistence-identical, and the canonical-shape migration (separate label field + inverted writers + updated readers) gets its own pass with its own verification.

**Build log (shipped).** Studio extraction + thin onboarding wrapper (no behavior change) → hidden `settings/models/emotions` route → guided dots scaffold (Meet → Name → Verify → Remaps, dots clickable backward, Skip/Finish to full cockpit) → Meet demo anchor (AvatarSample_B `Surprised`, health-checked) → Name stats/AI-gate/curation trigger with step-scoped `BrainModelPicker` override (`curateExpressions` accepts `providerId`/`model`) → motions inventory per format (Live2D/Spine from file, MMD/VRM built-in) → Verify keeper table with re-fire-safe previews + ✓/✕ Keep toggles → AVIF art (~96% smaller) → LIVE/STATIC badge + trigger diagnostics + neutral-bounce re-fire.

**Next (in order).** Remaps per the agreed plan (keeper-constrained dropdowns, one-shot empty-slot auto-apply, no Recalibrate/Details in the guided leg, direction normalization) → `compiledWhitelist` bake + auto-templated `modelExpressionPrompt` overwrite → entry-point rewiring (ModelCustomizer, acting-tab sparkle, Rehearsal Room → route; modal retirement) → acting-tab textarea reverse-parse (free text → whitelist) → Tier 2 stride interceptor (§2.2).

#### 2.1.6 Field cleanup: model vs character, raw → allowable (Canonical Spec: `docs/design-avatar-capabilities-architecture.md`)

**Adopted Direction (Oct 2026).** The fragmented field zoo (`expressions`, `motions`, `emotionMappings`, `motionMappings`, `favoriteExpressions`, `hiddenExpressions`, `hiddenMotions`) is completely retired and replaced by two self-contained capability catalogs directly on `DisplayModelFile`:
* `expressionCapabilities: ModelCapabilityItem[]` — `{ rawKey, label, usable }`
* `motionCapabilities: ModelCapabilityItem[]` — `{ rawKey, label, usable }`

See **[`docs/design-avatar-capabilities-architecture.md`](./design-avatar-capabilities-architecture.md)** for the complete canonical data contracts, 4-stage lifecycle, noise-gate ingestion rules, and monorepo touchlist.

On the character card level:
* `card.extensions.airi.acting.cueAllowlist`: `{ version: 1, emotions: Record<token, { rawKey, label }>, motions: Record<token, { rawKey, label }> }`
* `card.extensions.airi.acting.modelExpressionPrompt`: The prompt derived from the allowlist.

### 2.2 Tier 2: real-time sentence-stride interceptor (~110ms ninja-swap)

- **When it runs**: during live chat generation (integration point TBD — see §5 Q1).
- **Stride buffer**: slices text into **sentence** strides on `[.?!]` + newlines. Comma-splitting is explicitly out (fragments lose the affect carried by neighboring clauses, doubling cost while halving accuracy).
- **Single request per turn**: all sentence strides ride ONE `execute(state, questions)` call with per-sentence question groups (`s1_speech_tag`, `s2_speech_tag`, …) over the shared turn state — one forward pass, one round trip, full-turn coherence. Cap ~8 sentences per request; spillover opens a second call. (DevTools verification: one SystemOne request per Act press, not one per sentence.)
- **Per-stride timeout from speech rate, not a fixed clock**: budget per stride = `(words / 150) * 60_000 * 0.9` — drop the stride's result past ~90% of its theoretical spoken duration. The TTS synthesis window is the budget; a 100–400ms classifier effectively always fits.
- **Mid-utterance-only actuation**: ACT tokens are visual-only — never captioned, never in TTS audio, and never written into chat logs or the token stream (the LLM would see our injections and double up). Results apply to the avatar rig at stride-audio onset at the earliest (hold early arrivals for natural reaction timing) and are dropped past the 90% threshold.
- **Skip pre-prefixed strides**: sentences already carrying an author- or LLM-placed ACT token are never reclassified.
- **Mandatory `none` out**: every `choice` group includes an explicit `none` attractor. Without it, a two-cue character reacts Angry-or-Surprised to every sentence; with it, neutrality is a calibrated decision.

> **Footnote — mirror the TTS chunker, don't freelance.** The "chunk" is not always one sentence: `packages/pipelines-audio/src/processors/lead-coordinator.ts` (Option C Lead Coordinator) adaptively batches sentences for SSE-driven TTS — flushing on low buffer lead (< 1.5s), batch caps (3 sentences / 45 words), or stream completion — and `ControlStripHost.vue:931-940` re-derives sentence boundaries post-hoc (`alignSpokenSentences`) inside multi-sentence batches. The Tier 2 rule is therefore: **Jev request boundaries = TTS chunk boundaries.** A progressive single-sentence chunk gets a solo `execute()`; a flushed multi-sentence remainder gets ONE batched `execute()` with per-sentence question groups (single forward pass). Jev never invents its own segmentation — it shadows the chunker, so DevTools should show System1 calls mirroring TTS dispatch shape. (The literal "first 4 words" fast-path was not verified in this pass — candidate location is the orchestrator/hooks layer; confirm before citing it.)
> **Footnote — mid-chunk cue timing without lazy math.** A multi-sentence remainder chunk has no per-sentence TTS requests, but it is not timing-blind: `ControlStripHost.vue:767-816` already walks `item.boundaries` (per-sentence `startSec`/`endSec` from `alignSpokenSentences`) on a `requestAnimationFrame` AudioContext-clock loop for Sentence-Sync highlighting. The cue scheduler subscribes to that same boundary-crossing signal — first cue at chunk start, the rest on crossings — instead of estimating with speech-rate math. WPM-based timing (`(words/150)×60s×0.9` drop threshold) survives only as the fallback when boundaries are absent. Do not drop SSE-TTS support and do not prefix-only the remainder: the clock already exists, reuse it.
- **Single-pass merged request**: one dispatch to Jev/Laya evaluating all questions over a single shared forward pass (~110ms, $42/Btok or free local Laya) instead of split requests (220ms+ and voice-face desync risk):
  ```json
  {
    "state": {
      "sentence": "Wait, did you really think I wouldn't notice you sneaking in here?",
      "character_persona": "Tsundere persona: defensive when caught off-guard, crosses arms, hides relief behind mild indignation."
    },
    "questions": {
      "speech_tag": {
        "type": "choice",
        "instructions": "Select the voice speech tag from the character's allowed tags that best matches this line.",
        "options": ["none", "whisper", "sigh", "curious"]
      },
      "act_emotion": {
        "type": "choice",
        "instructions": "What facial expression from the character's allowed emotions should the avatar adopt?",
        "options": ["none", "deadpan", "glare", "smirk", "neutral"]
      },
      "act_motion": {
        "type": "choice",
        "instructions": "What physical gesture from the character's allowed motions should accompany this spoken line?",
        "options": ["none", "idle_subtle", "arms_crossed", "head_turn_away"]
      },
      "intensity": {
        "type": "score",
        "instructions": "Score the emotional intensity of this line.",
        "criteria": [
          "Flat, neutral delivery with no emotional charge.",
          "Mild feeling — a hint of warmth, tension, or playfulness.",
          "Strong feeling — clearly audible emotion driving the line.",
          "Exaggerated, theatrical peak — maximum emotional charge."
        ]
      }
    }
  }
  ```
- **Why one merged request guarantees coherence**: voice inflection and facial blendshape derive from the same unified latent appraisal — no "laughing voice with angry face" dissonance.
- **Ninja-swap execution** (example return: `speech_tag: "sigh"`, `act_emotion: "smirk"`, `act_motion: "arms_crossed"`, `intensity: 0.8`):
  1. Inject `<|ACT:{"emotion":{"name":"smug","intensity":0.8},"motion":"arms_crossed"}|>` into the special-token queue (rig + subtitle indicators).
  2. Prepend `[sigh] ` to the sentence chunk before TTS synthesis.
  3. Audio + blendshapes fire in emotional harmony; the 110ms buffer absorbs into natural turn-pacing silence. Zero prompt pollution on the primary LLM; full prefix-cache alignment.

---

## 3. Contracts to preserve

1. **Whitelist-strict options**: Tier 2 `choice` option lists MUST be built exclusively from the Tier 1 compiled whitelist (+ `none`). Never the raw hardware catalog.
2. **Universal consumer gate**: check `systemOneStore.configured` before every stride evaluation; when unconfigured/offline, pass sentences through unannotated (no throw, no stall).
3. **Distractor attractor baselines**: include explicit `none` in every option list to absorb neutral lines and suppress false-positive spillover.
4. **Decoupled actuation**: Jev decides; existing queues execute. The interceptor never synthesizes audio or drives rigs directly.
5. **Single merged request per stride**: batch `speech_tag` + `act_emotion` + `act_motion` (+ `intensity`) into one `execute()` call.
6. **Mirror, don't freelance**: Jev request boundaries = TTS chunk boundaries (see §2.2 footnotes). Solo chunks get solo calls; flushed multi-sentence remainders get one batched call with per-sentence groups.
7. **Evaporation doctrine**: Jev-injected cues evaporate by design — never written to `rawContent`, never replayed, never re-read. There is no persistence to filter after the fact; the LLM must never follow our lead when it reads history on the next turn (doubling hazard). Tag injection provenance at the `onTokenSpecial`/queue layer so any future persistence path can distinguish origin.
8. **Enter once**: injected tokens go through the special-token queue exactly once; never re-broadcast as fresh messages (cf. the existing double-execution trap).

## 3.5 Tier 2 game plan (phased — Rehearsal Room as proving ground)

- **Phase A — Inline viewport (DONE Oct 2026).** Local `RendererStage` embedded in `chat_rehearsal.vue` (same collapsible pattern as the chat window right panel); stage-offline banner deleted. Expression previews actuate the embedded canvas with Stage closed. Full Act audio still routes to the stage host (gate kept) — local speech hosting lands in Phase C.
- **Phase B — Experimental System1 toggle (DONE Oct 2026).** Persisted checkbox in the rehearsal sandbox (`rehearsal/system-one-enabled`), disabled with guidance when `systemOneStore.configured` is false; live provider badge (emerald `Laya local` / sky `Jev · <model>` / amber `Unconfigured`); `systemOneArmed` computed (opt-in AND configured) ready as Phase C's gate. The toggle never configures providers itself.
- **Phase C — Stride simulator in Rehearsal Room (DONE Oct 2026).** Proved the `decide → hold → release` mechanics. Act fires `runSystemOneSimulation` fire-and-forget alongside untouched playback: sentence-split → single batched `execute()` with per-sentence `s{i}_emotion` choice groups (model vocab + `none`) → collapsible readout (sentence, decision, confidence, latency/budget, status). Proved: `none` out, pre-prefixed skip, 90%-WPM drop, provenance tagging, morph resolver (`card whitelist → token/rig match → model mappings`).
- **Phase D — Schema, Capability Model & Authoring UI (DONE Oct 2026).**
  - **Capability model unified**: `DisplayModelFile` capability models replaced with clean `expressionCapabilities: ModelCapabilityItem[]` and `motionCapabilities: ModelCapabilityItem[]` (`{ rawKey, label, usable }`), eliminating legacy fragmented mapping arrays.
  - **Character card schema**: `CharacterCueAllowlistSchema` (`{ version: 1, emotions, motions }`) and extension keys (`cueAllowlist`, `autoCuesEnabled`, `autoCueExpressions`, `autoCueMotions`) added to `card.schema.ts` and `airi-card.ts`.
  - **Acting sub-tab streamlining**: Four side-by-side tabs (`Cues`, `Voice`, `Thinking`, `Lab`) fitting horizontally without wrapping.
  - **Autonomous Cues (System-1 Interceptor) UI**: Embedded directly inside the `Cues` sub-tab with plain-language copy, `Character Details Considered` input badges, modality checkboxes, allowlist counters, and Emotion Studio link.
- **Phase E — Shared Module Extraction & Evaporation Pipeline (ACTIVE - NEXT UP).**
  - Decompose the stride buffer, hold-release map, and morph resolver from `chat_rehearsal.vue` into a reusable module (`useAutonomousCues.ts` in `packages/stage-ui/src/composables/` or `pipelines-audio`).
  - Wire into live chat streaming (`ControlStripHost.vue` / chat orchestrator).
  - Enforce the **Evaporation Doctrine**: injected cues flow strictly in-memory into the animation queue and evaporate; they must NEVER be saved to `rawContent` or conversation history database records.
- **Phase F — Motion Widening & Sentence-Sync Boundary Clock.**
  - Once live emotion injection is running stably in chat, widen the candidate pool to include motions from `cueAllowlist.motions`.
  - Jev `score` returns map directly to motion intensity and gesture velocity.
  - Multi-sentence remainder cues subscribe to the sentence-sync crossing signal (`ControlStripHost.vue:767-816`) instead of firing at chunk start; WPM timing stays fallback-only.

### 3.6 Behavior configuration & UX design (locked direction)

Provider setup is solved (global System1 config); what remains is per-character behavior, living in the Acting tab:

- **Location**: Autonomous Cues segment housed directly inside the `Cues` sub-tab of `CardCreationTabActing.vue`, alongside ACT directives and allowlist controls.
- **Plain Language Copy**: Speaks directly to character expressiveness rather than technical execution:
  > *"Automatically makes your character more expressive by evaluating dialogue sentiment in real time, using their personality and acting directives to choose matching cues."*
- **State fields ("Character Details Considered")**: Hardcoded 3-way input bundle (`Personality`, `Description`, `Acting Directives`) displayed as clean visible badges. No user sliders or token weights: exposing them invites users to degrade classifier accuracy. The badges make the classifier's inputs transparent without adding cognitive clutter or sliding-window jargon.
- **Expressions vs motions**: Two per-character checkboxes in the same segment:
  - `Auto-cue Expressions` (active)
  - `Auto-cue Motions (Coming Soon)` (reserves its seat now; activates when Phase F lands)
- **Timing knob policy**: **Strictly no user knob in v1.** Natural event-driven onset at sentence audio boundary is physically correct timing. Introducing an offset slider is just a desync dial. Documented here as an intentional product principle: revisit only if empirical telemetry or user feedback requests "more deliberate" vs "snappier" pacing.
- **Master switch & conversion bridge**: Per-character master toggle (`autoCuesEnabled`, default OFF until curated). The **Finish celebration modal** at the end of Emotion Studio / Guided Flow is the primary conversion moment: on Finish, offer 1-click enable ("Enable Autonomous Cues now?") with a clear guidance callout showing where to toggle it in the Cues tab.

### 3.7 Integration order: land the pipe, widen it after

**Strategy: Integration first, motions second.**

* **Why integration first:** The live chat execution pipeline (stride buffering → System-1 evaluation → evaporation → animation queue dispatch) is identical whether the payload contains 1 modality or 2. Landing motions first would require building curation UI, score plumbing, and trigger semantics for a payload that has nowhere to flow.
* **Execution steps:**
  1. **Land the pipe (Emotions only — SHIPPED Oct 2026):** Extracted `useAutonomousCues` into shared composable, wired into live chat stream (`ControlStripHost.vue`), enforced cue evaporation, solved sentence-synchronized hold & release at audio playback onset, guarded VRM motion fallbacks, and verified facial blendshapes firing in live chat turns.
  2. **Dynamic Intensity (SHIPPED / IN PROGRESS):** Widen System-1 request schema to include `intensity` score head (0.3 to 1.0) so expressions blend at natural proportional nuances instead of flat 1.0 intensity.
  3. **Directives Reverse-Extractor (SHIPPED / IN PROGRESS):** Lightweight, deterministic allowlist compiler looping over the active model's usable `expressionCapabilities` and checking word containment in `modelExpressionPrompt` — populates `cueAllowlist.emotions` without requiring the full calibration wizard.
  4. **Widen the pipe (Motions):** Widen the System-1 request schema to include `act_motion` choices and `intensity` score. The `score` return slots naturally into motion velocity/intensity, and `cueAllowlist.motions` feeds the candidate pool. Flip `Auto-cue Motions (Coming Soon)` to active.
     - **Architectural Decision Point (Option A vs Option B):**
       - **Option A (Unified Acting Studio):** Broaden `EmotionCalibrationStudio.vue` into a unified Acting Studio with an integrated Motions step alongside Expressions (`Meet` → `Expressions` → `Motions` → `Verify` → `Remaps` → `Finish`), keeping both modalities under one roof.
       - **Option B (Dedicated Motion Studio):** Keep `EmotionCalibrationStudio.vue` focused on facial morphs, and build a dedicated Motion Calibration Studio specifically designed for skeletal animations, tactile triggers, and deep FlowMDM / VRMA library integration.
  5. **Speech tags (Deferred):** Provider-side audio tags (`[whisper]`, `*sigh*`) ride after visual cues are fully validated.

---

## 4. Integration anchors (verify signatures before implementing)

| Concern | Anchor | Notes |
|---|---|---|
| Authoring UI | `packages/stage-pages/src/pages/settings/airi-card/components/tabs/CardCreationTabActing.vue` | Tier 1 trigger; prompt fields live here |
| Capability discovery | `packages/stage-pages/src/pages/settings/airi-card/composables/useActingCapabilities.ts`, `packages/stage-ui/src/stores/providers/registry/speech.ts`, `packages/stage-pages/src/pages/settings/providers/speech/airi-audio-server.vue` | `expressionTags` plumbing already exists — reuse, don't rebuild |
| Decision engine | `packages/stage-ui/src/stores/modules/system-one.ts` (`execute()`) | Tier 2 merged request entrypoint |
| Runtime interception | `ControlStripHost.vue` / `speech.ts` vs `packages/pipelines-audio/src/speech-pipeline.ts` | Placement TBD — see §5 Q1 |
| Marker actuation | ACT parser (`queues.ts` / `processMarkers()` per `design-act-token-expression-system.md`) | Injection target for `<\|ACT…\|>` output |
| Whitelist storage | `extensions.airi.acting.compiledWhitelist` (SHIPPED Oct 2026) | `{version, emotions: Record<token, {rawKey, label}>}` on the card; no schema migration (`looseObject`) |

---

## 5. Refinement checklist (open questions before implementation)

- [ ] **Q1 — Stride-buffer placement**: `ControlStripHost.vue` vs `speech-pipeline.ts`? Constraint from the pacing doc: one queue/owner, no second audio driver in `speech.ts` (which remains the selected-provider/settings authority). Where does the stride buffer tap the token stream without violating the single-owner rule?
- [ ] **Q2 — Whitelist schema & ownership**: confirm `extensions.airi.acting.compiledWhitelists` shape, defaults for cards without a compiled whitelist (passthrough unannotated vs Tier-1-on-first-use?), and migration for existing cards. Register the key in `docs/data-catalog.md`.
- [ ] **Q3 — Tier 1 engine choice**: Needle 2 WASM vs local tiny LLM vs Jev schema query? Needs a shootout like the Nan0 43-case cleanroom (accuracy on natural-language acting guidelines → exact key subsets, with persona-violation counterexamples).
- [ ] **Q4 — Latency budget**: is 110ms/stride absorbable in all surfaces (chat, DatingSim, Stage-Mate bridge)? Define per-surface degradation (skip annotation vs block) on Jev timeout.
- [ ] **Q5 — Tag validity per provider**: which TTS providers honor `[tag]` prefixes vs strip/butcher them? `moss-audio-utils` sanitizes `[whisper]` → `whisper` (no brackets) — per-provider prefix/strip matrix needed so the interceptor prepends only what the active provider supports.
- [ ] **Q6 — Intensity mapping**: how does the `intensity` score map onto ACT `intensity`/`duration` fields and provider-specific expressiveness knobs?
- [ ] **Q7 — Test harness**: stride fixtures (sentence + persona + whitelist → expected tag+ACT pairs), persona-violation counterexamples (stoic character must never receive `happy`), voice-face coherence assertions. Mirror `system-one.test.ts` mock-Decisions-API pattern.
- [ ] **Q8 — Observability**: per-stride latency logging, tag/EMOTION distribution counters, debug surface (Controls / Rehearsal Room?) for whitelist inspection and stride replay.
- [ ] **Q9 — Tier 1 unification build**: extract route-capable curation component (§2.1.1); fix footer `dark:bg-neutral-850` (§2.1.2 defect 1); master-detail vetting layout with visible avatar preview (§2.1.2 defect 2); deterministic whitelist compile + speech-tag sidecar at step 3 (§2.1.3); wire all 5 entry points; confirm route path against settings topology.

---

## 6. Verification (when implementation lands)

```bash
# Store-level (existing suite must stay green)
pnpm -F @proj-airi/stage-ui test packages/stage-ui/src/stores/modules/system-one.test.ts
# Typecheck affected surfaces
pnpm -F @proj-airi/stage-ui typecheck
pnpm -F @proj-airi/stage-pages typecheck
```

Text-only doc change: no validation run required for this scaffold.

---

## 7. Cross-reference index

| Subsystem | Code anchors | Authoritative docs |
|---|---|---|
| System-1 engine | `stage-ui/stores/modules/system-one.ts` | [`proposal-jev-integration.md`](./proposal-jev-integration.md) |
| ACT tokens | marker parser / `processMarkers()` | [`design-act-token-expression-system.md`](./design-act-token-expression-system.md) |
| Acting authoring | `CardCreationTabActing.vue`, `useActingCapabilities.ts` | [`design-acting-tab-and-chatterbox.md`](./design-acting-tab-and-chatterbox.md) |
| Speech lane | `speech-pipeline.ts`, `ControlStripHost.vue`, `speech.ts` | [`proposal-conversational-pacing-thinking-fillers.md`](./proposal-conversational-pacing-thinking-fillers.md) |
| Capability registry | `stores/providers/registry/speech.ts` | provider settings pages |
