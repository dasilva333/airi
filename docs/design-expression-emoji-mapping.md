# Design: Expression Emoji Mapping & Quick-Trigger System

**Status**: Deprecated / Shelved for Redesign
**Date**: August 2026
**Catalog Identifier**: `actor-expressions` ("Expressions (Facial)")
**Original Icon**: `i-solar:mask-happly-outline`

---

## 1. Context & History

Prior to the creation of the universal [`ModelCustomizer.vue`](../packages/stage-ui/src/components/scenarios/settings/model-settings/ModelCustomizer.vue) component, Project AIRI featured an early prototype quick-trigger emotional expression popover on the Control Strip (`actor-expressions`).

The feature concept was:
1. Provide 7 core emotional anchor emoji shortcuts (`😀` happy, `😢` sad, `😠` angry, `😳` surprised, `😃` joyful, `🤔` thinking, `😎` cool, plus a `🔀` shuffle trigger).
2. Automatically heuristic-match each emoji to raw model expressions/blendshapes.
3. Allow users to manually trigger or customize these facial expressions on demand.

### Why It Was Shelved
- **Decoupled from Modern Runtime**: The original implementation relied on a global dev-harness hook `(window as any).testEmotion(emotionKey)` that injected bare `<|ACT:{"emotion":"..."}|>` tokens into the input stream.
- **Model Import Failure**: If a model (especially Live2D, Spine, or custom VRM) did not have pre-baked ACT emotion mappings configured in the database, pressing the emoji buttons did nothing, causing TestFlight tester confusion (*"Expressions failed to import"*).
- **Control Strip Crowding**: On mobile portrait screens (`stage-pocket`), the Control Strip was congested with 8+ vertical icons.
- **Architectural Duplication**: `ModelCustomizer.vue` was subsequently built as the canonical, robust 4-runtime engine (handling VRM blendshapes, Live2D Cubism parameters, Spine animations, and MMD morphs). Leaving the legacy popover active created a broken parallel path.

---

## 2. Legacy Code References (Citations for Revival)

When ready to resurrect or reimplement this feature, the following locations provide the historical code:

1. **Control Strip Popover Markup**:
   - `packages/stage-ui/src/components/scenarios/layout/ControlStrip.vue`
   - Popover container: `v-if="activePopover === 'actor-expressions'"` (Lines ~2578–2607)
   - Emoji grid: Iterates over `ACT_EMOTIONS` (`packages/stage-ui/src/constants/emotions.ts`)
2. **Legacy Trigger Function**:
   - `packages/stage-ui/src/components/scenarios/layout/ControlStrip.vue`
   - `triggerEmotion(emotion: string)` (Lines ~1066–1070) calling `window.testEmotion(emotion)`
3. **Stage Host Handler**:
   - `packages/stage-ui/src/components/scenes/ControlStripHost.vue`
   - `(window as any).testEmotion` (Lines ~477–480) calling `processMarkers('<|ACT:{"emotion":"${emotion}"}|>')`
4. **Catalog Definition**:
   - `packages/stage-ui/src/constants/control-customizer.ts` (`id: 'actor-expressions'`)
   - `packages/stage-ui/src/stores/settings/control-strip.ts` (`DEFAULT_MOBILE_BUTTONS`)

---

## 3. Future Architecture: Revival Roadmap

When reviving this feature, it should be built directly on top of the modern capability layers rather than re-creating ad-hoc hooks.

### Architecture Plan: Inline Interactive Emoji Mapping

Instead of a static grid of emojis sending blind ACT tokens, the revived popover will be an interactive, self-configuring quick panel:

```
┌────────────────────────────────────────────────────────┐
│ EXPRESSIONS                                        [X] │
├────────────────────────────────────────────────────────┤
│  [ 😀 ]  [ 😢 ]  [ 😠 ]  [ 😳 ]                        │
│   Joy     Sad     Anger  Blush                         │
│                                                        │
│  [ 😃 ]  [ 🤔 ]  [ 😎 ]  [ 🔀 ]                        │
│  Cheer   Think    Cool   Shuffle                       │
├────────────────────────────────────────────────────────┤
│ Active: [ 😀 Joy ] -> "F00_000_00_Face.M_F00_000_00_Joy"│
│ [ Change Mapping ]                [ Open Customizer ↗ ] │
└────────────────────────────────────────────────────────┘
```

#### Key Architectural Requirements for Revival:
1. **Universal 4-Runtime Capability Resolution**:
   - Use `useDisplayModelsStore().getOrLoadModelCapabilities(currentModelId)` to fetch resolved expressions.
   - Works seamlessly across all four supported model runtimes:
     - **VRM**: Blendshapes / Expression Morph targets
     - **Live2D**: Expression `.exp3.json` files and Motion groups
     - **Spine 2D**: Skeleton animation tracks and skins
     - **MMD / PMX**: Morph targets and VMD expression keys
2. **Direct Mapping Storage**:
   - Persist custom user emoji-to-expression associations in `displayModel.emotionMappings[emotionKey] = rawExpressionName` via `displayModelsStore.updateDisplayModelMappings(modelId, ...)`.
3. **Interactive In-Popover Mapping (Inline Binding)**:
   - Clicking an unmapped emoji displays a badge (e.g. `+` or amber dot).
   - Long-pressing or tapping "Change Mapping" spawns an inline search sheet of the model's available raw expressions.
   - Selecting an expression immediately previews it on the active stage and binds it to that emoji.
4. **Direct Engine Dispatch (Zero Synthetic Tokens)**:
   - When tapped, bypass the LLM chat pipeline entirely.
   - Dispatch directly to the active renderer:
     - VRM: `vrmStore.activeExpressions[name] = 1`
     - Live2D: `live2dStore.triggerEmotion(name)`
     - Spine: `spineStore.currentAnimation = ...`
     - MMD: `mmdStore.previewExpression = name`
   - Include auto-reset timers (e.g. 3–5 seconds) so manual emotional expressions return to neutral gracefully.
