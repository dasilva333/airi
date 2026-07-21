# Proposal: Rehearsal Room (Stage Rehearsal Sidebar)

A dedicated sidebar panel in the Chatbox for rapid, iterative prompt-crafting and instant playback testing of the `modelExpressionPrompt` — the bridge between the LLM and the 3D model's emotion/motion system. Think of it as a backstage dress rehearsal where you tweak the acting script and watch the character perform it immediately on the Stage.

---

## Name

**Rehearsal Room** (primary) / **Stage Rehearsal** (alternate).

Theatrical, warm, implies practice and refinement before the real performance. Beats "Acting Lab" in character.

---

## Scope & Target Field

This view is laser-focused on one field from the `ActingConfig` interface ([data-catalog.md:121](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/docs/data-catalog.md#L121)):

```typescript
interface ActingConfig {
  modelExpressionPrompt: string // ← THIS ONE
  speechExpressionPrompt: string
  speechMannerismPrompt: string
  idleAnimations?: string[]
}
```

The Rehearsal Room exists to configure `modelExpressionPrompt` for the active character. Everything in the sidebar serves that goal — preview available tokens, generate sample text, test orchestration, iterate.

---

## The Downstream AI Mapping Philosophy (The Naming Bridge)

One of the most critical aspects of the Rehearsal Room is establishing the bridge between technical assets and semantic understanding.

```
[Raw Asset Keys]              [Renamed Mapped Labels]         [AI & Suggestion Engines]
expression_1_2.json   ───>   "happy"                ───>     LLM understands "happy",
ParamEyeLX            ───>   "wink"                 ───>     writes <|ACT:emotion="happy"|>
```

### Why Renaming Matters
When a 3D model (Live2D, VRM, MMD, or Spine) is loaded, its native keys are often system filenames (`expression_01.exp3.json`), bone IDs (`ParamEyeLX`), or localized strings. The LLM and the suggestion engines have no context for what these mean:
- **No Semantic Context:** An LLM cannot logically deduce that `expression_1_2.json` represents embarrassment, so it will never generate it.
- **Orchestration Failure:** If the LLM generates a tag like `<|ACT:emotion="happy"|>`, it fails to trigger anything because there is no `happy` key native to the model.

### The Downstream Flow
By renaming these keys in the Rehearsal Room:
1. **Downstream Propagation:** The new human-readable label (e.g. `happy`, `sad`, `smug`) is persisted directly to the active character card extensions.
2. **Instruction Injection:** The suggestion engine reads the card's mapped labels and injects them into the `modelExpressionPrompt` instructions so the LLM learns the valid vocabulary.
3. **Dialogue Generation:** The LLM and the Suggestion generator can write natural sentences embedded with clear, human-readable `<|ACT:emotion="happy"|>` tags.
4. **Visual Execution:** When the tag is received by the Stage, it maps back to the corresponding raw asset file and executes the visual reaction.

---

## Sandbox Orchestration & Pipeline Integration (DRY Principle)

To prevent duplication of audio/visual parsing and timing code, the Rehearsal Room's play button hooks directly into the **shared Speech Runtime Pipeline** instead of creating a custom speech playback lane.

```
Rehearsal Room (Chatbox Process)                Stage Window Host (Renderer Process)
───────────────────────────────                ────────────────────────────────────
1. Parse playground text
2. openIntent({ ownerId }) ──(BroadcastBus)──>  Host receives intent stream
3. Loop parts:                                  Host invokes pipeline:
     - writeSpecial(tag)                          - TTS Generation
     - writeLiteral(text)                         - Slice alignment
4. writeFlush() / end()                           - Captions & synchronized animation
```

### How the Integration Works:
1. **Host Discovery:** The Stage window host (`ControlStripHost.vue`) registers itself as the audio/speech execution host via the `speechRuntimeStore`.
2. **Remote Intent Streaming:** When the play button is clicked in the Rehearsal Room:
   - It opens a runtime intent via `speechRuntimeStore.openIntent({ ownerId: activeCardId.value })`.
   - Under the hood, this uses the VueUse-backed cross-window event bus to forward tokens to the registered Host.
3. **Token Slicing:** The sandbox text is parsed using the same regex pattern utilized by the main chat orchestrator:
   ```typescript
   const parts = content.split(/(<\|(?:ACT|DELAY|ACTOR)[^\r\n]*?(?:\|>|>))/gi)
   ```
4. **Ingestion Execution:** The loop streams parts to the intent:
   - Tags (starting with `<|`) are sent to `intent.writeSpecial(part)`.
   - Plain text is sent to `intent.writeLiteral(part)`.
   - After processing, the player dispatches `intent.writeFlush()` and `intent.end()`.
5. **Downstream Benefits:** This ensures any fixes applied to the main chat audio slicing, tag synchronization, or caption overlay are instantly shared by the sandbox playground.

### Special Token Execution & Model Dispatch Branching

Once special tokens arrive at the Stage Host (`ControlStripHost.vue`), the pipeline parses the token contents (`<|ACT:emotion="..."|>` or `<|ACT:motion="..."|>`) and dispatches the visual command to the active renderer.

```
                          <|ACT:emotion="Name"|>
                                    │
                     [ControlStripHost.vue:320-370]
                                    │
       ┌────────────────────────────┼────────────────────────────┐
       ▼                            ▼                            ▼
    Live2D                         VRM                      Spine / MMD
live2dStore.triggerEmotion   modelStore.triggerEmotion    Composite Key & Motion Match:
                                                          - Variant [Skin] or Variant
                                                            ➜ selectVariantAndSkin()
                                                          - Animation key
                                                            ➜ playOneShotAnimation()
```

#### Entry Points & Core Files Index:

| Step | Location / File | Purpose |
|------|-----------------|---------|
| **1. UI Trigger** | [`chat_rehearsal.vue:296`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/apps/stage-tamagotchi/src/renderer/components/chat/chat_rehearsal.vue#L296) | Sandbox text parser; emits tokens via `orchestrator.emitTokenSpecialHooks()`. |
| **2. Stream Bus** | [`pipeline-runtime.ts:184`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/services/speech/pipeline-runtime.ts#L184) | Slices stream into `speechIntentSpecialEvent` tokens over cross-window Eventa bus. |
| **3. Stage Host** | [`ControlStripHost.vue:326`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/components/scenes/ControlStripHost.vue#L326) | Receives `<|ACT...|>` token and branches execution to the active model renderer store. |
| **4. Spine Dispatch** | [`ControlStripHost.vue:331`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/components/scenes/ControlStripHost.vue#L331) | Parses `Variant [Skin]` keys $\rightarrow$ calls `spineStore.selectVariantAndSkin()`; motion keys $\rightarrow$ calls `spineStore.playOneShotAnimation()`. |
| **5. Spine Store** | [`spine.ts:174`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui-spine/src/stores/spine.ts#L174) | Manages atomic `currentVariant` & `currentSkin` refs; triggers WebGL skeleton switch on stage. |

### Voice Resolution Hierarchy & Sandbox Context Decoration

To ensure TTS speech audio uses the correct voice during rehearsal playback, speech synthesis resolves voice configuration using a strict **3-Tier Fallback Hierarchy**:

```
                       TTS Voice Resolution
                                │
          ┌─────────────────────┴─────────────────────┐
          ▼                                           ▼
[Tier 1: Actress Voice]                      [Tier 2: Character Card Voice]
visual_assets[actorId].speech                card.extensions.airi.modules.speech
          │                                           │
          └─────────────────────┬─────────────────────┘
                                ▼
                     [Tier 3: Global User Voice]
                     speechStore.activeSpeechVoiceId
```

#### Why Rehearsal Room Must Decorate Context:
During normal chat streaming, the orchestrator attaches `characterId` and `actorId` to message context and emits `<|ACTOR:conceptId|>` tags when switching actresses on multi-character cards.

In `chat_rehearsal.vue` (the sandbox playground):
1. **Context Decoration**: [`chat_rehearsal.vue:309`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/apps/stage-tamagotchi/src/renderer/components/chat/chat_rehearsal.vue#L309) decorates `dummyContext` with `characterId: activeCardId.value` and `actorId: selectedModel.value?.key`.
2. **Actor Tag Prepending**: If a specific actress concept is selected in the carousel (e.g. `actress_yomi`), `playRehearsal()` prepends an `<|ACTOR:actress_yomi|>` token to the stream.
3. **Execution Result**: When `<|ACTOR:actress_yomi|>` arrives at `ControlStripHost.vue`, `specialTokenQueue` catches it, activates `actress_yomi` in `artistryAutonomousStore`, and sets `playbackActorId = 'actress_yomi'`.
4. **Resolution Result**: `resolveSpeechConfigForActor('actress_yomi')` successfully resolves **Tier 1 (Actress Voice)** or **Tier 2 (Character Voice)** instead of falling through to Tier 3 (Global User / Narrator Voice).

---

## Layout & Elements

The Rehearsal Room sidebar is split into three main zones:

### 1. Top Zone — Prompt & Instruction Builder

A textarea for `modelExpressionPrompt` designed for prompt-crafting.
* **Save button** — persists changes to the active card via `cardStore.updateCard()`.
* **Sparkle ✨ Generate Instructions** — opens the suggestion helper palette. It reads the current model's mapped, human-readable labels and drafts a complete instruction block teaching the AI how to use those labels in context.

### 2. Middle Zone — Rehearsal Playground Sandbox

Instead of static, semantic mock presets (like "Basic Joy"), the playground uses a **structural syntax template engine** that dynamically injects active keys.

#### Dynamic Presets / Templates:
These buttons are rendered dynamically based on whether `expressions.length > 0` and `motions.length > 0`:
* **Template 1: Single Leading Tag**
  - Generates: `<|ACT:emotion="[exp1]"|> Hello world!`
* **Template 2: Leading & Trailing Tags**
  - Generates: `<|ACT:emotion="[exp1]"|> This is a sandbox test. <|ACT:emotion="[exp2]"|>`
* **Template 3: Combined Emotion + Motion Tag**
  - Generates: `<|ACT:emotion="[exp1]",motion="[mot1]"|> Moving and speaking.`
* **Template 4: Dual Combos**
  - Generates: `<|ACT:emotion="[exp1]",motion="[mot1]"|> Starting off... <|ACT:emotion="[exp2]",motion="[mot2]"|> and transitioning.`

#### AI Custom Templates (`{sparkle} Create More`):
* A button that prompts the active character's LLM to generate 3 additional structural templates utilizing random combinations of mapped expressions and motions, rendering them as clickable temporary preset pills.

#### Playground Actions:
* **Play Endcap (Clapperboard button)** — Streams tokens to the `speechRuntimeStore` intent, triggering Stage playback.

---

### 3. Bottom Zone — Emotions & Motions Explorer

A view listing available parameters, loaded dynamically from the active model.

> [!IMPORTANT]
> The first tab is labeled **Emotions** (not "Expressions") to reflect that this is the semantic, AI-facing vocabulary layer — not the raw technical asset list.

#### Advanced Filtering & "Treasure Hunting" Toggles:
To help users navigate through raw model files, the explorer includes specific filters:
* **Show Hidden** — Toggles the visibility of items marked hidden.
* **Hide Numeric** (or "Show Numeric" toggle)
  - *Context*: Unnamed or internal parameters are often exported with purely numeric names (`blendshape_01`, `123`). These are usually garbage, but occasionally hide working custom animations.
  - *Tip (Shown when toggled on)*:
    > [!TIP]
    > You are seeing all the internal keys for this model. Some of them might have working expressions. Click through them to see if any produce meaningful faces; if so, rename the key.
* **Hide Capitalized** / **Hide Functional** (under VRM/MMD)
  - *Context*: Capitalized keys (`MouthSmileLeft`, `BrowDownRight`) usually serve a mechanical/functional purpose rather than a semantic expression.
  - *Tip (Shown when toggled on)*:
    > [!TIP]
    > You are observing functional keys that serve a mechanical purpose (e.g. `MouthRight`) rather than semantic expressions. There is often a hidden gem in here; click through them to test.

---

## Character Selector (Model-on-Set Picker)

The Rehearsal Room is **not** a character narrative browser — it is a 3D model configurator. The selector reflects which physical model files are bound and available for configuration, not which story characters exist in the card.

### Fundamental Departure from Studio

The Studio's character selector represents every cast member regardless of their physical presence — a character with just an actor token, no TTS, no 3D model is still shown. The Rehearsal Room has zero interest in narrative-only characters. Its only question is: **"What 3D model files are physically on set?"**

### The Derivation Rule

```
const boundModels = Object.entries(visual_assets)
  .filter(([key, asset]) => {
    const mod = modules[key] || {}
    // modules value is the authoritative runtime director state
    return mod.manifestation?.modelId || asset.manifestation?.modelId
  })

if (boundModels.length > 0:
  → Show each as a clickable 5-col grid card
  → Clicking sets activeModelId → passed to ModelCustomizer
  → modules[key].manifestation.modelId is the runtime director value
    (director may have swapped the model for a given actor on a per-turn basis)

else:  // no per-actor bindings = Gen1 / simple single-model card
  → Show modules.displayModelId as a non-interactive thumbnail
  → Auto-pass it to ModelCustomizer
  → No click behavior — nothing to switch between
```

### What Gets Shown vs. Excluded

| Case | Shown? | Reason |
|------|--------|--------|
| Actor with `manifestation.modelId` | ✅ Clickable card | Has a 3D model bound |
| Actor with no model binding | ❌ Not shown | Not on set |
| Place / narrative concept | ❌ Not shown | Not a model |
| Gen1 card (no actor tokens, no bindings) | ✅ Single thumbnail (non-interactive) | Shown via `modules.displayModelId` fallback |

### Runtime Director Value

In multi-character cards, the director system can dynamically change which model is displayed for a given actor slot on a per-turn basis. The binding resolution order is:

```
modules[key].manifestation.modelId    ← runtime director override (authoritative)
  ↓ (fallback if not set)
visual_assets[key].manifestation.modelId   ← static author-time binding
```

This means the selector reflects actual current runtime state, not just static card configuration.

---

## Capability Resolution: How Expression/Motion Lists Are Sourced

This is the most important architectural distinction between the Rehearsal Room and the old per-model settings panels.

### The Old (Wrong) Approach

The old model settings panels read expression/motion lists directly from live renderer stores:
```typescript
// ❌ Only works when that specific model is actively loaded by the renderer
live2dStore.availableExpressions // populated by running renderer
mmdStore.availableMorphs // populated by running renderer
spineStore.availableAnimations // populated by running renderer
```

This means if you select a character whose model is not currently on stage, you get an empty list.

### The Correct Approach: `getOrLoadModelCapabilities`

The Rehearsal Room (via `ModelCustomizer`) routes all list resolution through `displayModelsStore.getOrLoadModelCapabilities(modelId)`:

```
getOrLoadModelCapabilities(modelId)
  │
  ├── model.expressions && model.motions exist in memory?
  │     → Return immediately (cache hit)
  │
  ├── Not cached → crack open the raw file:
  │     Live2D zip  → parse .model3.json → FileReferences.Expressions + Motions
  │     VRM binary  → parse glTF JSON chunk → VRM.blendShapeMaster.blendShapeGroups
  │     Spine zip   → parse .json → animations keys
  │     PMX binary  → scan binary for morph target names (utf-16le)
  │     → Write results to model.expressions / model.motions
  │     → Persist to IndexedDB via localforage
  │
  └── Return { expressions: string[], motions: string[] }
```

**The key insight:** a model's expression/motion list is fixed at the time the model file is authored. It does not grow or change at runtime. Therefore, once parsed and cached, the cached list is always correct — regardless of whether the model is currently loaded by the renderer or not.

The live renderer stores (`live2dStore` etc.) are still used for:
- **`isActive` state** — which expression is currently playing on stage
- **Triggering effects** — `triggerEmotion()`, `triggerMotion()` etc. when the user clicks an item

But the **list of available keys** comes exclusively from `getOrLoadModelCapabilities`.

### Persistence Layer (What Gets Cached Where)

All metadata converges on the **DisplayModel entry** in `localforage` (and reconciled via S3 remote `manifest.json`):

| Data | Field on `DisplayModelFile` / `DisplayModelURL` |
|------|--------------------------------------------------|
| Raw expression key list | `model.expressions: string[]` |
| Raw motion key list | `model.motions: string[]` |
| Human-readable emotion labels | `model.emotionMappings: Record<string, string>` |
| Human-readable motion labels | `model.motionMappings: Record<string, string>` |
| Hidden expression keys | `model.hiddenExpressions: string[]` |
| Hidden motion keys | `model.hiddenMotions: string[]` |
| Starred/favorite expressions | `model.favoriteExpressions: string[]` |

These are **model-scoped**, not card-scoped. The same model used across multiple characters or cards shares the same label vocabulary and visibility settings.

---

## Model Settings Component Catalog

Each model type's "Character Customizations" section has a different shape, feature set, and persistence strategy. This catalog inventories all five source files so the Rehearsal Room MVP can normalize them into a unified interface.

### Source files

| Model | Component | Sub-component (expressions) |
|-------|-----------|------------------------------|
| Live2D | `packages/stage-ui/src/components/scenarios/settings/model-settings/live2d.vue` | `live2d-customization.vue` |
| VRM | `packages/stage-ui/src/components/scenarios/settings/model-settings/vrm-expressions.vue` | *(inline)* |
| MMD | `packages/stage-ui/src/components/scenarios/settings/model-settings/mmd.vue` | *(inline)* |
| Spine | `packages/stage-ui/src/components/scenarios/settings/model-settings/spine.vue` | *(inline)* |

> [!NOTE]
> All of the above have been consolidated into the unified `ModelCustomizer.vue` component
> (`packages/stage-ui/src/components/scenarios/settings/model-settings/ModelCustomizer.vue`).
> The originals are preserved as reference but `ModelCustomizer` is the single implementation
> going forward.

---

### A. Expressions / Emotions

All four model types expose a **read-only** list of named expression presets discovered from the model file. New expressions cannot be created at runtime — they are baked into the model formats (Live2D `.exp3.json`, VRM BlendShapeClips, MMD morph targets, Spine animation tracks). This makes a safe normalization baseline: every backend provides a discoverable, immutable list of named presets.

Raw parameter manipulation (individual sliders, bone values) is deferred — focus is on unifying the preset layer.

| Feature | Live2D | VRM | MMD | Spine |
|---------|--------|-----|-----|-------|
| **Store** | `live2dStore` | `modelStore` | `mmdStore` | `spineStore` |
| **Key list source** | `getOrLoadModelCapabilities` → `model.expressions` | same | same | same |
| **Expression nature** | Named parameter-override presets (`.exp3.json`) | BlendShapeClips (glTF VRM extension) | Morph targets (PMX vertex groups) | Animation tracks (layered on idle) |
| **Activate/click** | `triggerEmotion(name)` | `triggerEmotion(name)` | `previewExpression = name` | `playOneShotAnimation(name)` |
| **Active state** | `activeExpressions: Record<string, number>` | `activeExpressions: Record<string, number>` | `previewExpression: Ref<string \| null>` | `activeAnimations: Record<string, Record<string, boolean>>` |
| **Editable labels** | ✅ `emotionMappings` on DisplayModel | ✅ same | ✅ same | ✅ same |
| **Label save target** | `localforage` via `DisplayModelFile.emotionMappings` | same | same | same |
| **Visibility control** | ✅ `hiddenExpressions` on DisplayModel | ✅ same | ✅ same | ✅ same |
| **ACT emotion mapping** | ✅ 7 slots: `happy, sad, angry, surprised, neutral, think, cool` | ✅ Same 7 slots | ✅ same | ✅ same |
| **Favorite/star** | ✅ `favoriteExpressions` on DisplayModel | ✅ same | ✅ same | ✅ same |

---

### B. Motions / Animations

| Feature | Live2D | MMD | Spine |
|---------|--------|-----|-------|
| **Key list source** | `getOrLoadModelCapabilities` → `model.motions` | same | same |
| **Editable labels** | ✅ `motionMappings` on DisplayModel | ✅ same | ✅ same |
| **Label save target** | `localforage` via `DisplayModelFile.motionMappings` | same | same |
| **Visibility control** | ✅ `hiddenMotions` on DisplayModel | ✅ same | ✅ same |
| **Idle cycle toggle** | ✅ `toggleMotionInCycle()` | ✅ same | ✅ same |
| **Cycle save target** | Card: `extensions.airi.acting.idleAnimations[]` | same | same |
| **Click to preview** | `triggerMotion(group)` | `playOneShotAction(name)` | `playOneShotAnimation(name)` |

---

### C. Unified Interface Target

Normalize all four backends into a single list component for the Rehearsal Room. Every entry row:

```
┌──────────────────────────────────────────────────────────────────┐
│ ● [group badge]  Display Name                          [∞] [✎] [👁] │
│   originalKey                                        (1.2s)  (♪)  │
└──────────────────────────────────────────────────────────────────┘
```

---

### E. Persistence Target

To ensure that expression/motion mappings and visibility settings are shared across all characters using the same model, and to allow automatic cross-device backups via Cloud Sync, all metadata converges directly on the **Display Model metadata entry** (stored in `localforage` and reconciled in the S3 remote `manifest.json`):

| Data | Target Path (in DisplayModel entry) |
|------|-------------------------------------|
| Expression labels / ACT maps | `model.emotionMappings: Record<string, string>` |
| Expression visibility | `model.hiddenExpressions: string[]` |
| Motion labels | `model.motionMappings: Record<string, string>` |
| Motion visibility | `model.hiddenMotions: string[]` |
| Favorite expressions | `model.favoriteExpressions: string[]` |
| Raw expression key cache | `model.expressions: string[]` |
| Raw motion key cache | `model.motions: string[]` |

When old character cards are loaded, a one-time migration runs to sweep any legacy mappings stored in `card.extensions.airi.modules.{type}` into the display model's entry, cleaning the card namespace.

---

## Model Test-Case Homework (Model Finder Checklist)

Use the following catalog to hunt for and register specific models in the local environment that match each test-case requirement. Fill in the filename or ID for each slot.

### A. VRM Models
- [ ] **Numeric Keys:** A model containing purely numeric or generic system-generated keys (e.g., `1`, `002`, `blendshape_10`).
  - *Model Filename/ID:* _____________________
- [ ] **Capitalized/Functional Keys:** A model that has camelCase or capitalized functional keys (e.g. `MouthSmileLeft`, `BrowDownRight`).
  - *Model Filename/ID:* _____________________
- [ ] **Multi-Emotion Blend:** A model that has high-quality blendshapes that can be mixed simultaneously without mesh tearing or model collapse.
  - *Model Filename/ID:* _____________________

### B. Live2D Models
- [x] **Ready-to-Go Expressions:** A model with clean, pre-built named expression files (e.g., `happy.exp3.json`, `sad.exp3.json`).
  - *Model Filename/ID:* Anya - kitten vtuber.zip (`display-model-ROiozwAemT_lmJoYBWuRK`)
- [ ] **Raw Filename Keys:** A model with raw technical filenames (e.g., `exp_09_12.exp3.json`) to trigger the rename banner.
  - *Model Filename/ID:* _____________________
- [x] **No Expressions:** A model that has zero expression files in its asset folder.
  - *Model Filename/ID:* model6.zip (`display-model-9j4Mk60ReAxCj_9JfYX_N`)
- [x] **With Motions:** A model containing motion clips.
  - *Model Filename/ID:* v2a6_306204_meilanni_Live2D.zip (`display-model-dDe8yJ_R_SSSKr-ddS-tx`)
- [ ] **Motions with Sound:** A model containing `.motion3.json` files that reference audio files.
  - *Model Filename/ID:* _____________________
- [ ] **Motions with Sound & Caption:** A model where motions trigger both audio and built-in text captions.
  - *Model Filename/ID:* _____________________
- [ ] **No Motions:** A model that has zero motion files.
  - *Model Filename/ID:* _____________________
- [x] **Empty Asset Set:** A model that has neither motions nor expressions (completely blank).
  - *Model Filename/ID:* 302301_shisihangshi_Live2D.zip (`display-model-g16ESa6Q5E_EvoPTYIfBD`)

### C. MMD Models
- [x] **Unicode/Shift-JIS Keys:** A model with morph targets named in Japanese Shift-JIS (e.g., `まばたき`, `にっこり`).
  - *Model Filename/ID:* inav2.0.pmx (`display-model--D2OMxL5fGuQmGApH3eAB`)
- [ ] **ASCII/English Keys:** A model with morph targets named in standard ASCII/English.
  - *Model Filename/ID:* _____________________
- [ ] **No Morph Targets:** A static MMD PMX model (e.g., a background prop or accessory) with no morph targets.
  - *Model Filename/ID:* _____________________
- [ ] **With Built-in Animations:** A model that has default PMX VMD animations bundled.
  - *Model Filename/ID:* _____________________

### D. Spine Models
- [ ] **Varying Track Durations:** A model with multiple animation tracks having different explicit durations.
  - *Model Filename/ID:* _____________________
- [ ] **No Animations:** A model with no animation tracks (only the default setup pose).
  - *Model Filename/ID:* _____________________
- [ ] **Multiple Skins:** A model that has multiple skins configured in the skeleton.
  - *Model Filename/ID:* _____________________
- [ ] **Multiple Skeletons:** A ZIP containing multiple skeleton variants/files.
  - *Model Filename/ID:* _____________________

---

## Answered Open Questions

| Question | Answer |
| :--- | :--- |
| Play on Stage or embedded mini-viewer? | Play on the main Stage. Disable orchestration + effectuation if Stage is not open — show a warning in the sidebar. |
| AI generate uses which model? | The user's active chat LLM for the current character. |
| Save snapshot for regression testing? | Not in v1. The prompt itself is persisted to the card — that's the source of truth. |
| Raw TTS toggle (disable acting layer)? | Yes — include as a utility toggle for A/B comparison. |
| Should the selector show all story characters? | No. The Rehearsal Room selector shows only 3D models that are physically bound via `manifestation.modelId`. Narrative-only characters (no model binding) are excluded entirely. |
| What happens for simple/Gen1 single-model cards? | Fall back to `modules.displayModelId`. Show a single non-interactive thumbnail. ModelCustomizer auto-receives that modelId with nothing to select. |
| Does expressions list require the model to be on stage? | No. `getOrLoadModelCapabilities(modelId)` resolves from cache → raw file parse → IndexedDB. A model's expression list is fixed at authoring time and never changes at runtime, so the cached list is always complete and correct regardless of stage state. |
| Are expression/motion lists card-scoped or model-scoped? | **Model-scoped.** Stored on the `DisplayModelFile` entry. The same model used across multiple cards or characters shares one label vocabulary. |
| What does `modules[key].manifestation.modelId` represent? | The authoritative runtime director value for which 3D model is currently bound to a given actor slot. Takes precedence over the static `visual_assets[key].manifestation.modelId`. The director can swap it per-turn. |
