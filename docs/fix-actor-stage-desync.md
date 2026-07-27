# Fix: Actor Stage Desync During Autonomous Artistry (Director) Background Updates

> **Status:** IMPLEMENTED (v3 recommendation applied). Changes:
> - **Rail 2 fix:** `packages/stage-ui/src/stores/modules/airi-card.ts` — `resolveAiriExtension`'s `active_state.displayModelId` is now a passthrough of `modules.displayModelId`; the `manifestation.modelId` concept fold was removed (background fold and additive expression merge retained).
> - **Rail 1 gate:** `packages/stage-ui/src/stores/modules/artistry-autonomous.ts` — `foldConceptStack` now tracks and returns `modelIdFromBase` (whether the winning `modelId` came from an `isBase` concept); `runArtistTask` writes `modules.displayModelId` only when Base-sourced. `activateConcept` (ACTOR pipeline) and `applyCurrentStackManifestations` (manual sync) intentionally remain ungated.
> - **Validation:** `pnpm -F @proj-airi/stage-ui typecheck` — clean.
>
> **One-paragraph summary:** The stage model was being re-derived from the Director's *scene* concept stack, whose ordering is arbitrary with respect to who is currently speaking. Concepts legitimately bundle three pillars (prompt, artistry, `manifestation.modelId`), and the Director must keep managing the stack for scene/prompt continuity — but the `manifestation.modelId` pillar reached the physical stage from the Director's stack ordering via two rails (§4), over the top of the actor pipeline that actually knows who is speaking. The fix is **not** "stop the Director from managing concepts" and **not** "remove the Director's model write entirely" (that would kill Director-driven outfit swaps — Setup B, §1.1). The fix: make `modules.displayModelId` the single source of truth (Rail 2 passthrough) and **gate** the Director's model write to Base-sourced modelIds only (Rail 1 gate), preserving both supported setups.

---

## 1. The Concept Bundle: Three Pillars, Two Owners

From `docs/proposal-visual-state-outfit-hook.md`, every concept in `visual_assets` bundles:

| Pillar | Field | Purpose | Rightful runtime owner |
| :--- | :--- | :--- | :--- |
| **Identity (Prompt)** | `prompt` | Tags concatenated into the image-generation prompt | **Director** (scene continuity, turn-by-turn) |
| **Artistry (Pipeline)** | `artistry.provider/model/options` | Workflow/provider overrides for generation | **Director** (image generation) |
| **Manifestation (Physical)** | `manifestation.modelId`, `manifestation.backgroundId`, `manifestation.active_expressions` | Live stage model swap, mood lock | **Actor pipeline** (`<|ACTOR:x|>` tokens) / explicit user action |

The bug is a **pillar-ownership violation**: when the Director applies its resolved scene stack, the Manifestation pillar rides along and clobbers the stage model that the actor pipeline set for the currently-speaking character.

The user's invariant, restated precisely: **the Director deciding "living room + first girl + grumpy girl" for the image prompt must never re-decide which girl is physically on stage.** The Director knows the *scene*; only the speech/playback pipeline knows the *speaker*.

### 1.1 The Two Supported Setups

**Setup A — ACTOR-driven multi-character (modern, primary).** Two or more models; handoffs are driven exclusively by `<|ACTOR:x|>` tokens. Actor concepts (`first_girl`, `grumpy_girl`) coexist in the Director's scene stack because their **prompt tags** feed image generation ("living room + first girl + grumpy girl"). The Director must never move the physical model in this setup. This is the most common scenario and the one this fix prioritizes.

**Setup B — Director-driven outfit/state changes (legacy, worth preserving).** One character, multiple outfit concepts (`actor_pajamas` for morning, `actor_dress` for daytime). No ACTOR tokens; the user does not expect mid-dialog swaps — only that the right model appears as the Director drives the scene. Here the Director driving `modules.displayModelId` from `runArtistTask` *is the feature*. Closing Rail 1 entirely would remove this capability.

---

## 2. System Architecture & Relevant Files

| Role | Path |
|------|------|
| Actor stage page (stage window) | `apps/stage-tamagotchi/src/renderer/pages/actor.vue` |
| Stage renderer (model switcher UI) | `packages/stage-ui/src/components/scenes/RendererStage.vue` |
| Stage model store (`stageModelSelected`, `updateStageModel`) | `packages/stage-ui/src/stores/settings/stage-model.ts` |
| Control strip host (ACTOR token handling, speech orchestration) | `packages/stage-ui/src/components/scenes/ControlStripHost.vue` |
| AIRI card store (`updateCard`, `syncCardState`, both watchers, `resolveAiriExtension`/`active_state` fold) | `packages/stage-ui/src/stores/modules/airi-card.ts` |
| Autonomous artistry store (`runArtistTask`, `resolveConceptStack`, `foldConceptStack`, `activateConcept`) | `packages/stage-ui/src/stores/modules/artistry-autonomous.ts` |
| ACTOR marker parser (stream splitter) | `packages/stage-ui/src/composables/llm-marker-parser.ts` |
| `parseActor()` regex | `packages/stage-ui/src/composables/queues.ts:142-147` |
| Speech pipeline (special-token → sequenced playback) | `packages/pipelines-audio/src/speech-pipeline.ts` |
| Chat hooks (`onTokenSpecial`) | `packages/stage-ui/src/stores/chat/hooks.ts` |
| Background store (`addBackground`, `activeBackgroundUrl`, `airi:background-sync`) | `packages/stage-ui/src/stores/background.ts` |
| Display models store (IndexedDB model assets) | `packages/stage-ui/src/stores/display-models.ts` |
| Cross-window localStorage wrapper | `packages/stage-shared/src/composables/use-local-storage-manual-reset.ts` |

---

## 3. The Full Flow (Multi-Character Turn)

```
User: "Hey girls how are you both?"
│
├─► LLM streams: "<|ACTOR:first_girl|> I'm great! <|ACTOR:grumpy_girl|> bah humbug!"
│   │
│   ├─► llm-marker-parser splits stream → literal / special chunks
│   │   └─► onTokenSpecial hooks (chat/hooks.ts) fire per token
│   │
│   ├─► PARSER-LEVEL actor handler (ControlStripHost.vue:392-396)
│   │   └─► activateConcept(actorId) IMMEDIATELY during streaming
│   │       (fires for BOTH tokens within seconds — stack churns pre-speech)
│   │
│   └─► Speech pipeline (speech-pipeline.ts)
│       ├─► TTS per text segment (voice swap per actor)
│       └─► PLAYBACK-LEVEL actor handler (ControlStripHost.vue:577-628)
│           └─► activateConcept(actorId) SEQUENCED with audio
│               ├─► waits for 'airi-stage-model-ready' (5s timeout)
│               └─► applies per-actor speech config
│
├─► activateConcept(conceptId)  [artistry-autonomous.ts:988-1068]
│   ├─► resolveConceptStack(currentStack, [conceptId], visualAssets)
│   │   → appends actor concept ON TOP of stack (actor's modelId lands LAST)
│   ├─► foldConceptStack(stack) → "last modelId wins" → correct model ✓
│   └─► updateCard({ active_concepts, modules.displayModelId })
│       └─► watchers → syncCardState → stageModelSelected = actor's model ✓
│
└─► Response ends → runArtistTask (Director) fires ASYNC  [artistry-autonomous.ts]
    │
    ├─► Director LLM grades scene, returns selected_concepts
    │   (e.g. ["place_livingroom", "actor_first_girl", "actor_grumpy_girl"]
    │    — order is whatever the LLM felt like)
    │
    ├─► resolveConceptStack(currentStack, selected_concepts)  [:152-184]
    │   → may DROP actor concepts (see §5)
    │
    ├─► foldConceptStack(nextStack)  [:192-282]
    │   → "last modelId-bearing concept wins" → ARBITRARY actor's modelId
    │
    ├─► ⚠ DECISION-TIME updateCard  [:729-746]
    │   { active_concepts: nextStack,
    │     modules: { displayModelId: folded.modelId,   ← RAIL 1
    │                active_expressions } }
    │   → watchers → syncCardState → MODEL SWAP ARMED HERE
    │
    ├─► Image generation (seconds–tens of seconds)
    ├─► backgroundStore.addBackground(...) → airi:background-sync
    │
    └─► IMAGE-ARRIVAL updateCard ('bg' branch, :822-841)
        { modules: { ...modules, activeBackgroundId: entryId } }  ← surgical, CLEAN
        → background image appears on stage ✓
        → (does NOT touch active_concepts or displayModelId)
```

---

## 4. The Four Rails That Can Move the Stage Model

The stage model is `stageModelStore.stageModelSelected` (localStorage key `settings/stage/model`, shared across windows via `useLocalStorage` storage events). These are the rails that write it, in order of guilt:

### RAIL 1 — Director's decision-time explicit write (primary)
`artistry-autonomous.ts:734-736`:
```typescript
if (folded.modelId) {
  immediateModuleUpdates.displayModelId = folded.modelId
}
```
`folded.modelId` = last `manifestation.modelId` in the **Director's** stack ordering. When the Director lists both girls (common for a two-girl scene), whichever girl the LLM happened to list last wins. **This is the "sometimes first girl, sometimes grumpy girl" non-determinism.** The write lands seconds before the same run's image arrives — decision → generate → save → apply — so the swap and the background change appear simultaneous.

### RAIL 2 — The `active_state` passive fold (the subtle, load-bearing one)
`airi-card.ts`, inside `resolveAiriExtension`, the `active_state` block re-folds `active_concepts` on **every card read**:
```typescript
let foldedModelId = resolvedDisplayModelId // starts from modules.displayModelId
for (const conceptId of activeConcepts) {
  if (concept.manifestation?.modelId && concept.manifestation.modelId !== 'inherit')
    foldedModelId = concept.manifestation.modelId // last-in-stack wins
}
```
`syncCardState` then prefers this derived value (`airi-card.ts:731`):
```typescript
const newModelId = extension.active_state?.displayModelId ?? extension.modules?.displayModelId
```
**Even with Rail 1 removed, Rail 2 re-derives the model from the Director's stack ordering on every card update.** Any `updateCard` that changes `active_concepts` lets the fold re-resolve an arbitrary actor's model behind the actor pipeline's back. This is why simply "not writing displayModelId in the Director" (crude Option A) is insufficient on its own.

### RAIL 3 — The two watcher amplifiers
- `airi-card.ts:462-469` — `watch(active_concepts, …)` with `deep: true` → `syncCardState(card, force=true)`. `force=true` bypasses the `modelChanged` check and re-applies unconditionally.
- `airi-card.ts:1344-1347` — `watch(activeCard, …)` → `syncCardState(card)` (no force). `updateCard` always replaces the card object (`nextCards.set(id, compactCard(updatedCard))`), so **this fires on every updateCard**, including the image-arrival background update. It only swaps when the resolved model differs — but with Rail 2 active, "differs" is exactly what happens after the Director reorders the stack.

### RAIL 4 — Cross-window & sync propagation (amplifiers, not root causes)
- `stageModelSelected` is localStorage-backed and shared across Electron windows; the main window's `syncCardState` can push a value the stage window's own store then picks up via storage events, where `watch(stageModelSelectedState)` fires `updateStageModel('manual selection')` (`stage-model.ts:248-250`).
- `persistCards` broadcasts `airi:cards-sync`; every other window runs `loadCards(true)` → fresh card objects → both Rail-3 watchers re-evaluate in that window.
- `local:airi-cards` is merged per-card by timestamp by the sync engine. A sync cycle can resurrect a **stale** `active_concepts`/`displayModelId` pair (e.g., from the parser-level activation of the *second* actor, or a previous Director run) and re-broadcast it. Worth checking `remoteSyncEnabled` as a secondary amplifier.

---

## 5. Why `resolveConceptStack` Drops/Reorders Actors

`artistry-autonomous.ts:152-184`, the "Keep Base, Refresh Modifiers" rule:

```typescript
const nonVisualLayers = currentStack.filter(id => !isVisual(visualAssets[id]))
// …
if (newBases.length > 0)
  return [primaryBase, ...nonVisualLayers, ...newLayers]   // visual actors DROPPED
const currentBase = currentStack.find(id => visualAssets[id]?.isBase)
return [currentBase?, ...nonVisualLayers, ...newLayers]    // non-base visual actors DROPPED
```

- Actor concepts are "visual" (they have prompts) → they never survive as `nonVisualLayers`.
- Unless an actor concept is `isBase` *and* re-selected by the Director, it falls out of the stack.
- Two consequences, both observed in the wild:
  1. **Clean-looking decision (the case the owner described):** Director picks only a place base (`place_beach`) → girls drop out → fold finds no `modelId` → Rail 1 writes nothing → `modules.displayModelId` flows through the Rail-2 fold untouched → *no swap at decision time*. This is why the decision-time application *appears* guarded.
  2. **The bug case:** Director includes actor concepts in `selected_concepts` (natural for "my girls at the beach" — the girls ARE the scene) → they land in the stack in LLM-output order → fold resolves the **last-listed** girl's model → swap. Which girl is "last" varies run to run → non-deterministic victim.

A second, related ordering fact: `activateConcept` is safe precisely because `resolveConceptStack(current, [actorId])` places the actor concept **on top** of the stack, so its `modelId` always lands last in the fold. The fold's "last wins" rule is correct **only** when the speaker is guaranteed to be last — a guarantee only the actor pipeline can make.

---

## 6. Timing Analysis: Why It *Looks* Like the Image Does It

The image-arrival update is verified clean (`artistry-autonomous.ts:822-841` — surgical, background-only, concepts preserved). Yet the swap coincides with the image because:

1. **Same-run proximity.** The decision-time `updateCard` (Rail 1/2) and the image arrival are separated only by image-generation latency (seconds). The background change is the visually salient event; the model swap 2–10s earlier gets mentally merged into it.
2. **Director LLM latency variance.** `runArtistTask` for `target: 'assistant'` fires at response end with no artificial delay, but the Director LLM call itself is non-streaming and can take 10–60s. Its decision can therefore land at any point during a long speech segment — during first_girl's audio *or* grumpy_girl's. This explains "it also breaks grumpy girl when she's speaking": a slow Director run from the same (or previous) turn lands during her audio.
3. **Stale-stack clobbering across turns.** The Director reads `active_concepts` *before* its LLM call and writes its resolved stack *after*. If ACTOR tokens from the next turn changed the stack in between, the Director's late write restores a stale ordering — with Rail 2, that stale ordering re-derives the model too.
4. **Rail 3's `activeCard` watcher** ensures that the moment *any* of these writes land, the stage re-syncs within milliseconds.

There is also pre-speech **model flapping** worth noting (not the reported bug, but related noise): the parser-level `activateConcept` (ControlStripHost.vue:392) fires for *both* ACTOR tokens during streaming, so the stack/model can briefly settle on the *second* girl before her audio starts; the playback-level call (line 577) re-corrects at each girl's audio start. This means the stack content the Director reads at response end is itself racy.

---

## 7. Recommendation — Fix Rail 2 (passthrough) + Gate Rail 1 (Base-sourced only)

**Do not** stop the Director from managing `active_concepts` — the scene stack is load-bearing for prompt injection and scratchpad continuity ("living room + both girls" must keep flowing into image prompts turn by turn). **Do not** remove the Director's `displayModelId` write entirely either — that closes Setup B (§1.1). The proposal's own Base/Layer semantics provide the exact distinction needed to keep both setups alive.

### 7.1 Why "Rail 2 only" is not sufficient (Setup A trace)

With Rail 2 fixed as a passthrough, `syncCardState` reads `modules.displayModelId` verbatim — so **whoever writes that field owns the stage.** In Setup A:

1. first_girl speaks → `modules.displayModelId = first_girl_model` (actor pipeline, correct)
2. Director decides `selected_concepts = ['living_room', 'first_girl', 'grumpy_girl']` — it must include the girls; their prompt tags feed the image
3. `foldConceptStack` → "last modelId-bearing concept wins" → `grumpy_girl_model`
4. **Rail 1 fires:** `modules.displayModelId = grumpy_girl_model` ← the poison write
5. Fixed Rail 2 faithfully passes that value through → swap to grumpy_girl. **Bug persists.**

Rail 2's fix is necessary but not sufficient. Conversely, removing Rail 1 entirely fixes Setup A but kills Setup B. Hence: gate, not removal.

### 7.2 The Base-vs-Layer gate (the proposal's own semantics)

`proposal-visual-state-outfit-hook.md` already defines the distinction:

- **Base (exclusionary):** "a total state change (e.g., a New Outfit, a Cameo Character)". Activating a Base *should* move the physical model. Setup B's outfits (`actor_pajamas`, `actor_dress`) are Bases.
- **Layer (additive):** scene members and modifiers stacked on a Base. Per the proposal's "Bases for Places" principle, **the girls in a multi-actor scene are Layers** on a place Base.

`foldConceptStack` already knows which concept supplied the winning `modelId` — have it also return that concept's identity / `isBase` flag, then gate Rail 1 in `runArtistTask`:

```typescript
if (folded.modelId && folded.modelIdFromBase) {
  immediateModuleUpdates.displayModelId = folded.modelId
}
```

| Scenario | Winning modelId source | Gate result | Behavior |
| :--- | :--- | :--- | :--- |
| Setup A: Director lists girls as scene Layers | Layer | **suppressed** | `modules.displayModelId` stays where ACTOR tokens put it ✓ |
| Setup B: Director picks a new outfit Base | Base | **passes** | Director drives the model, as designed ✓ |
| ACTOR token handoff (either setup) | — | untouched | `activateConcept` always writes explicitly ✓ |

### 7.3 The two changes, concretely

1. **Rail 2 (required):** in `resolveAiriExtension`'s `active_state`, remove `manifestation.modelId` from the concept fold; make `active_state.displayModelId` a passthrough of `modules.displayModelId`. Every legitimate model-change path already writes `modules.displayModelId` explicitly (verified: `activateConcept`, `applyCurrentStackManifestations`, card activation/editor), so the fold is redundant where it's correct and harmful where it isn't. Keep the additive `active_expressions` merge — it is an `Object.assign` merge, not order-sensitive exclusion, and is not implicated in this bug.
2. **Rail 1 gate (required, not removal):** `foldConceptStack` reports whether the winning `modelId` came from a Base concept; `runArtistTask` writes `displayModelId` only when Base-sourced.

### 7.4 The one constraint to document (not enforce)

In ACTOR-driven cards (Setup A), actor concepts MUST be **Layers** (scene members); the Base slot belongs to the place/state ("Bases for Places"). If a card models two *speaking* characters as mutually exclusive Bases, the Director picking both will still resolve a Base-sourced modelId and move the stage — but that card shape is conceptually Setup B and conflicts with ACTOR tokens by definition. Document it; no code guard.

### 7.5 Alternatives considered and rejected

- **Remove Rail 1 entirely (v1 Option A):** fixes Setup A but closes Setup B (Director-driven outfit swaps). Superseded by the gate.
- **Rail 2 fix alone:** insufficient — Rail 1 remains a wrong-writer whenever the Director includes actor concepts for prompt tags (§7.1 trace).
- **Speech-active guard (owner's Option B):** the invariant "never touch the model while anyone is speaking" is correct, but as a mechanism it is unsafe: legitimate actor handoffs (first_girl → grumpy_girl) intentionally swap the model *between audio segments during the same playback*. A naive `isSpeaking` gate either blocks those handoffs or is timing-fragile. Done safely it requires source-tagging every model write (allow actor-pipeline, defer others until playback drains) — real complexity that 7.3 already makes unnecessary. Optional defense-in-depth only.
- **Weaker variants (drop `force=true`, tighten `hasChanges`):** insufficient — the rails' *values* are wrong, not the watcher mechanics.

### 7.6 Settling the observed timing empirically (optional diagnostic)

The owner's observation is that the Director's *decision* applies cleanly and the *image arrival* is what jams the stage. Mechanically, if Rail 1 writes a different modelId at decision time, the swap should be visible then. Two explanations, both consistent with the observation:

1. **Compressed timing** — the Director LLM call is non-streaming and slow (10–60s) while image generation is fast, so the decision-time write and the image land within a couple of seconds and merge perceptually (most likely).
2. **Latent poison** — Rail 1's write lands at decision time, but the stage's visible application waits for the next card-update trigger — which the image-arrival `updateCard` supplies via the `activeCard` watcher (Rail 3b, `airi-card.ts:1344`, fires on *every* `updateCard`).

Diagnostic (one run settles it): compare the Director note's `createdAt` (decision time), the background entry's `createdAt` (image time), and a timestamped log line at the point `stageModelSelected` is reassigned in `syncCardState`. The fix is identical under either explanation — this is for confidence, not for choosing the fix.

---

## 8. Verification Checklist (post-fix)

**Setup A (ACTOR-driven multi-character) — the bug fix:**
1. Multi-actor card (actor concepts as **Layers**), autonomous artistry ON, `spawnMode: 'bg'`. Send a message producing a two-girl script. During first_girl's audio, wait for the Director image: background changes, **model does not move**.
2. Same, but with the image landing during grumpy_girl's audio (long second segment): same invariant.
3. Director `selected_concepts` containing both actor concepts (check the Director note in chat history): stage model still tracks the ACTOR-token speaker, not the last-listed concept.
4. ACTOR handoff still works: grumpy_girl's model appears exactly when her audio segment starts.
5. `active_concepts` continues to evolve turn-by-turn (verify the generated image prompt still contains place + both girls' tags — scene continuity intact).

**Setup B (Director-driven outfits) — the regression guard:**
6. Single-character card with outfit concepts as **Bases** (`actor_pajamas`, `actor_dress`), no ACTOR tokens. Narrate an outfit change; the Director's decision swaps the model exactly once, at decision time.

**Cross-cutting:**
7. Card shape audit: in Setup A cards, confirm actor concepts are Layers, not Bases (§7.4).
8. Check `remoteSyncEnabled`: if on, confirm no stale `displayModelId` resurrection after a sync cycle (Rail 4 amplifier).
9. Optional: run the §7.6 timestamp diagnostic once to confirm decision-vs-arrival timing in your environment.

---

## Appendix: Key Code References

| What | Where |
|------|-------|
| Rail 1: Director writes displayModelId | `artistry-autonomous.ts:729-746` |
| Rail 2: `active_state` modelId fold | `airi-card.ts` (`resolveAiriExtension` → `active_state` block) |
| Rail 3a: concept watcher (force=true) | `airi-card.ts:462-469` |
| Rail 3b: activeCard watcher (every update) | `airi-card.ts:1344-1347` |
| Model application | `airi-card.ts:709-740` (`syncCardState`) → `stage-model.ts:67-237` (`updateStageModel`) |
| Actor pipeline (correct ordering) | `artistry-autonomous.ts:988-1068` (`activateConcept`) |
| Parser-level actor event | `ControlStripHost.vue:392-396` |
| Playback-level actor event | `ControlStripHost.vue:577-628` |
| Stack resolution (drop rules) | `artistry-autonomous.ts:152-184` |
| Stack fold (last-wins) | `artistry-autonomous.ts:192-282` |
| Clean image-arrival update | `artistry-autonomous.ts:822-841` (`'bg'` branch) |
| localStorage cross-window wrapper | `stage-shared/src/composables/use-local-storage-manual-reset.ts` |
