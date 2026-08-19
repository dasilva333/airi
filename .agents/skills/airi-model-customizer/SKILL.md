---
name: airi-model-customizer
description: >-
  Use when working with the inline ModelCustomizer widget (ModelCustomizer.vue) — the embedded per-model capability editor for all four model formats (VRM/Live2D/Spine/MMD) in the model-settings panels and Rehearsal Room. Covers expression/motion exploration via getOrLoadModelCapabilities, ACT emotion & motion mapping, <|ACT:...|> insert-token contract, rename/visibility/favorite/idle-cycle toggles, and the mesh-part wardrobe builder (outfits + mesh names). NOT the floating Control Strip Customizer window — see airi-controlstrip-customizer.
---

# AIRI ModelCustomizer Widget

`ModelCustomizer.vue` is an **inline, embedded widget** — it has no window of its own. It is the universal per-model capability editor: given a `modelId`, it lists the model file's raw expressions (blendshapes/parameter IDs) and motions/animations, lets the user rename them to human words, map them to ACT emotion slots, mark favorites, hide dead keys, add motions to the idle cycle, and (in acting contexts) insert `<|ACT:...|>` tokens into a prompt/textarea.

> **Disambiguation**: the floating glassmorphic **Control Strip Customizer** window (`apps/stage-tamagotchi/src/main/windows/customizer/index.ts`, `CUSTOMIZER_CATALOG`) is a different feature — see the `airi-controlstrip-customizer` skill. Both go by "customizer" in the UI; this skill is strictly the inline widget.

---

## 1. Canonical Design Document

Read **`docs/modelcustomizer-design.md`** first. It defines the separation-of-concerns boundary:

- **`ModelCustomizer.vue`** = zero-side-effects capabilities explorer: transient click-to-preview, rename / visibility / favorite / idle-cycle toggles, ACT mapping. It must NOT own LLM generation, sandbox dialogues, or prompt injection — that belongs to parent containers.
- **Parent containers**: settings panels (`vrm-expressions.vue`, `live2d.vue`, `mmd.vue`, `spine.vue`) and the Rehearsal Room (`apps/stage-tamagotchi/src/renderer/components/chat/chat_rehearsal.vue`, which passes `showInsertActions` for token insertion and owns LLM generation + backup download).

---

## 2. File Map

### Component & Hosts
- `packages/stage-ui/src/components/scenarios/settings/model-settings/ModelCustomizer.vue` — the widget itself (~960 lines).
- `packages/stage-ui/src/components/scenarios/settings/model-settings/vrm-expressions.vue` — VRM settings panel; embeds `ModelCustomizer` (`local-stage=true`) AND owns the inline **mesh-part wardrobe builder** (the third domain).
- `packages/stage-ui/src/components/scenarios/settings/model-settings/live2d.vue` — Live2D panel; `<ModelCustomizer :model-id="props.modelId || settings.stageModelSelected" :local-stage="true" />`.
- `packages/stage-ui/src/components/scenarios/settings/model-settings/mmd.vue` — MMD panel; same embedding pattern.
- `packages/stage-ui/src/components/scenarios/settings/model-settings/spine.vue` — Spine panel; same embedding pattern.
- `apps/stage-tamagotchi/src/renderer/components/chat/chat_rehearsal.vue` — Rehearsal Room; embeds with `showInsertActions` + `@insert-token` handling, powered by the active model.

### Data & State
- `packages/stage-ui/src/stores/display-models.ts` — binary model catalog + IndexedDB persistence. `getOrLoadModelCapabilities(id)` (≈L1424) resolves expression/motion lists: cache hit immediately, otherwise parses the raw file (ZIP walk for Live2D/Spine/MMD) and writes capability lists back to IndexedDB. Works even when the model is **off-stage**.
- `packages/stage-ui/src/stores/display-models.ts` — `updateDisplayModelMappings(id, {...})` persists `emotionMappings`, `favoriteExpressions`, `hiddenExpressions`, `motionMappings`, `hiddenMotions` per model.
- `packages/stage-ui-three/src/stores/model-store.ts` (VRM) — `discoveredMeshes` (`DiscoveredMeshNode[]`, ≈L214), `hiddenMeshes`, `setMeshVisibility`/`setMeshesVisibility`/`resetMeshVisibility` (≈L154–173). Third-domain mesh plumbing.
- `packages/stage-ui/src/stores/modules/airi-card.ts` — `useAiriCardStore`; reads `card.extensions.airi.acting.idleAnimations` for idle-cycle state; `updateCardOutfits` for wardrobe slots.

---

## 3. Component Contract

```vue
<ModelCustomizer
  :model-id="displayModelId || ''"
  :show-insert-actions="false"
  :palette="[]"
  :local-stage="false"
  @insert-token="(t) => appendToPrompt(t)"
  @update:visible-capabilities="({ emotions, motions }) => store.emotions = emotions"
/>
```

### Props
- `modelId: string` — **required**. The previewed model ID (see the previewed-vs-active rule below).
- `showInsertActions?: boolean` — enables the token-insert and ACT-map action buttons + the Rehearsal Controls Legend. Used only by Rehearsal Room today.
- `palette?: string[]` — accent palette (unused in most hosts; provided for styling).
- `localStage?: boolean` — when the widget is embedded in a settings page that already renders its own stage preview, clicks effectuate that stage directly without requiring the actor window. Set `true` in all four settings panels.

### Emits
- **`insert-token`** — `(token: string)` with `<|ACT:emotion="Happy"|>` (expressions) or `<|ACT:motion="...|>` (motions). Rehearsal Room appends it to the sandbox template.
- **`update:visible-capabilities`** — `({ emotions: string[], motions: string[] })` surfaced after filtering for visibility/renamed-only. Lets parents reflect "what the AI can actually use" without re-deriving.

> [!IMPORTANT]
> **Previewed Model vs Active Character Card Model**: When a user browses models in Settings, `stageModelSelected` holds the *previewed* ID. Hosts MUST pass `props.modelId || stageModelSelected` so lists reflect the model on screen, NOT the unapplied `activeCard.displayModelId`. See `docs/modelcustomizer-design.md`.

---

## 4. Four-Format Type Resolution & Preview Dispatch

`modelType` is derived from `currentModel.format` (`DisplayModelFormat`):

| Format value(s) | Resolved type |
|---|---|
| `Live2dZip`, `Live2dDirectory` | `live2d` |
| `VRM` | `vrm` |
| `PMXZip`, `PMXDirectory`, `PMD` | `mmd` |
| `SpineZip` | `spine` |
| anything else / missing model | `unknown` (renders the "No Creative Controls Available" empty state) |

### Expression preview (`triggerExpressionEffect`)
- **live2d**: `live2dStore.triggerEmotion(key, 1.0)`
- **vrm**: `modelStore.triggerEmotion(key, 1.0)`
- **mmd**: sets `mmdStore.previewExpression = key`, auto-clears after 2s
- **spine**: `spineStore.selectVariantAndSkin(...)` — parses `Variant [Skin]` keys (see §5)

### Motion preview (`triggerMotionEffect`)
- **live2d**: `live2dStore.triggerMotion(key)`
- **vrm**: `modelStore.triggerMotion(key)`
- **mmd**: `mmdStore.playOneShotAction(key)`
- **spine**: `spineStore.playOneShotAnimation(key)`

Gate: when `!localStage && !stageEnabled`, previews are blocked with a toast ("Stage window must be open to preview expressions/motions").

---

## 5. Per-Format Capability Semantics

All lists are driven by `getOrLoadModelCapabilities` output (model-file level), not the live renderer. `isActive` still reads renderer state for on-stage feedback.

- **VRM**: `cachedExpressions` are raw blendshape keys. Display names fall back to `normalizeVrmKey` (strips `Face.M_F00_000_00_Fcl_`, `Fcl_`, `vrc.v_`, `ARKit_BS.` prefixes, splits camelCase, title-cases). Motions come from `customVrmAnimationsStore.animationOptions` and keep a "None (Stop Base Idle)" row. Category derived as `preset` (all-caps key) vs `custom`.
- **Live2D**: keys are Cubism parameter/motion group IDs. Active state reads `live2dStore.activeExpressions[key]` and `live2dStore.currentMotion?.group`.
- **MMD**: motions come from `mmdStore.availableMotions` (Built-in, `.vmd` displayNames cleaned) plus `mmdStore.customMotions` (Custom Animations). Active matches `mmdStore.currentMotion`.
- **Spine**: expression keys are `Variant [Skin]` composite names (`/^(.+?)\s*\[(.+?)\]$/`). Active = `spineStore.currentVariant` + `currentSkin` both match. Motions = `spineStore` animations. Requires the spine variants→expressions normalization from the concept registry.

---

## 6. ACT Mapping & Token Insertion

- **ACT mapping dialog** (`openActMapping(key)` → `assignActMapping(emotion)`): maps a model expression key to one of the 7 ACT emotion slots — `happy, sad, angry, surprised, neutral, think, cool`. Persisted into the model's `emotionMappings` via `updateDisplayModelMappings`. Shown with `showInsertActions`.
- **Insert token (expressions)**: emits `` `<|ACT:emotion="${exp.displayName}"|>` `` — uses the *display name*, so `M_F00_000_00_Fcl_ALL_HOJO` renamed to `Happy` inserts `<|ACT:emotion="Happy"|>`.
- **Insert token (motions)**: emits `` `<|ACT:motion="${mot.displayName}"|>` ``.
- **Idle-cycle toggle**: `toggleMotionCycle` writes prefix-keyed entries into `card.extensions.airi.acting.idleAnimations`. Key format: VRM models use the raw key; Live2D/MMD/Spine use `${modelType}:${key}`. `isMotionInCycle` checks with the same prefix rule.
- Live2D stage-window cross-process sync: `saveMetadata()` also copies `motionMappings`/`emotionMappings` into `live2dStore` so the actor window triggers correctly.

---

## 7. The Third Domain: Mesh-Part Wardrobe Builder

`vrm-expressions.vue` adds an inline **"Build Outfit"** flow that pairs with `ModelCustomizer` (mutually exclusive views — the `isBuildingOutfit` flag swaps between them).

- **Mesh discovery**: `modelStore.discoveredMeshes` (VRM, from `model-store.ts`) holds discovered mesh names + vertex counts. Listed in a searchable grid (search filters `mesh.name`).
- **Selecting a slot**: build a wardrobe slot with a **name**, an **exclusivity group tag** (blank = independent; same tag string = mutually exclusive with siblings), and up to **8 outfits per card**. Toggling a mesh hides it via `modelStore.setMeshVisibility(name, false)`.
- **Persistence**: `saveOutfitSlot` writes `{ id: nanoid(), name, tag, icon, meshes: string[], defaultEnabled: true }` into `card.extensions.airi.outfits` via `airiCardStore.updateCardOutfits`. 8-slot hard limit.
- **Visibility semantics**: `isSlotVisible` returns true only when ALL the slot's meshes are currently visible (not in `hiddenMeshes`); `toggleSlotVisibility` calls `setMeshesVisibility(meshes, !currentlyVisible)`.
- Reset restores all mesh visibility (`resetAll` → `modelStore.resetMeshVisibility()`).

> When extending this domain, keep the boundary from §1: mesh discovery/wardrobe CRUD live in the host (`vrm-expressions.vue`) + `model-store.ts`; `ModelCustomizer.vue` stays the expression/motion editor. The `airi-modular-outfits-system` skill covers card-schema outfit propagation (`displayModelId`/`change_cos` costume variants) — mesh-part slots are the new mesh-name-based layer.

---

## 8. Known Pitfalls & Failure Modes

- **`modelId` empty string**: components pass `props.modelId || ''` — always guard for empty before `getOrLoadModelCapabilities` in the watcher.
- **Metafile capability miss**: `getOrLoadModelCapabilities` returns empty on parse failure; the widget shows "No Creative Controls Available" even for a valid model. Check `console.log('[ModelCustomizer] capabilities resolved...')` and IndexedDB rows.
- **Technical keys**: keys containing `.json|.vmd|expression_|morph_|\d` that are unrenamed trigger a warning banner telling users to rename them so the AI understands.
- **Vue binary-proxy destruction**: never wrap `ArrayBuffer`/`Blob`/VRM instances in `ref()`/`reactive()` in this area — see `airi-binary-safety`; capability lists are plain strings, safe, but the raw binary path is not.
- **Cross-window preview requires actor window**: real stage windows must be open (or `localStage=true`) or preview toasts error out.
- **Spine needs the `[Skin]` composite**: hypothesis-testing a Spine row without the `Variant [Skin]` format silently falls back to variant-only matching.

---

## 9. Verification

- `pnpm -F @proj-airi/stage-ui typecheck` — the widget lives in `stage-ui`.
- Manual (desktop): open Settings → a model panel for each format; rename a technical key; map one to an ACT emotion; toggle idle cycle; confirm previews effectuate the actor window; in Rehearsal Room confirm insert-token appends to the sandbox. For VRM: build an outfit slot with mesh parts and confirm hide/show per slot.
- Not a label/comment-only change: this is component + store behavior; run the typecheck target above.
