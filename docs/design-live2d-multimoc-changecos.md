# Architectural Design: Multi-MOC Packages, `ChangeCos` Hot-Swapping & Ingestion Normalization

**Status:** Technical Architecture & UX Specification
**Target Package:** `packages/stage-ui-live2d` & `packages/live2d-runtime`
**Key Files:** [`packages/stage-ui-live2d/src/utils/live2d-zip-loader.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui-live2d/src/utils/live2d-zip-loader.ts) & [`packages/live2d-runtime/src/dsl/interpreter.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/live2d-runtime/src/dsl/interpreter.ts)

---

## 1. Problem Statement & Motivation

Stateful Live2D character models (especially complex VTuber packages like Gura, Saba, and Japanese stateful models) rely on **`ChangeCos`** commands in their motion groups to dynamically swap outfits, accessories, or body models (e.g. `Next:Leaveon`, `Next:cos_casual`, `change_cos:1`).

Currently, when the stateful Live2D DSL VM encounters a `ChangeCos` command, the execution pipeline stalls or silently falls back because:
1. **Single-MOC Ingestion Bias**: The current zip importer ([`live2d-zip-loader.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui-live2d/src/utils/live2d-zip-loader.ts)) and storage stores assume a 1-to-1 mapping between a character card and a single `.moc3` binary.
2. **Missing MOC Registry in WebGL Runtime**: The active `pixi-live2d-display` WebGL container only has one `.moc3` model loaded in VRAM. When `ChangeCos` fires, there is no in-memory registry or buffer bridge to swap the model geometry.

---

## 2. History of Code Evolution & Upstream Comparison

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Upstream vs. AIRI Fork Comparison                     │
├──────────────────────────────────────────┬──────────────────────────────────┤
│ 🟥 Upstream Main (`moeru-ai/airi`)       │ 🟩 AIRI Fork Architecture        │
├──────────────────────────────────────────┼──────────────────────────────────┤
│ • Naively hardcodes `model0` in multi-MOC│ • Extracts & captures raw manifest│
│   zips and ignores all subsequent .moc3  │   DSL groups in `zip-loader.ts`.  │
│   files.                                 │ • Normalizes assets into OPFS /  │
│ • Zero support for `ChangeCos`, stateful │   IndexedDB model stores.        │
│   DSLs, intimacy, or multi-costumes.     │ • Preserves state across turns.  │
└──────────────────────────────────────────┴──────────────────────────────────┘
```

### Upstream's Naive Hardcoding:
In upstream `moeru-ai/airi`, multi-MOC zips are handled by picking `model0` (the first `.moc3` found) and ignoring all other `.moc3` files. Upstream has no stateful DSL interpreter VM, no intimacy system, and no concept of interactive costume switching.

### AIRI's Ingestion Evolution:
In our fork, [`live2d-zip-loader.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui-live2d/src/utils/live2d-zip-loader.ts) extracts raw manifest JSON blocks before `ZipLoader.unzip` sanitizes away entries, capturing custom motion groups, `VarFloats`, `Choices`, `Intimacy`, and `ChangeCos` directives. However, we stopped short of building a multi-MOC VRAM hot-swap registry.

---

## 3. The Keystone Premise: In-Memory Hot-Swapping vs. Full Re-Ingestion

> [!CRITICAL]
> **Why Full Disk Re-Ingestion is a Hard Anti-Pattern**
>
> Wiring `change_cos` from the DSL VM all the way back up to disk/OPFS file re-fetching or full model re-ingestion would be **slow, laggy, and introduce severe breaking changes**:
> - Re-fetching from disk causes a visible frame stutter (100ms–500ms drop).
> - Re-instantiating the entire model store resets the active **DSL VM Heap** (`VarFloats`, intimacy level, active expression flags), destroying character memory!

### The Solution: MOC3 VRAM Buffer Hot-Swapping
The DSL VM state MUST remain untouched during costume changes:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      In-Memory MOC3 Hot-Swap Pipeline                       │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. DSL VM triggers `ChangeCos("gura_casual")`                               │
│    └─► Heap state (Intimacy, VarFloats, Active Expressions) PRESERVED.      │
│                                                                             │
│ 2. `Live2dCostumeRegistry` Lookup                                           │
│    └─► Fetches pre-parsed `.moc3` ArrayBuffer & Texture Atlas from RAM/OPFS.│
│                                                                             │
│ 3. WebGL Buffer Hot-Swap (<16ms, Single Frame Boundary)                     │
│    ├── Pause render ticker for 1 frame.                                    │
│    ├── Unbind previous MOC3 WebGL vertex/index buffers & textures.          │
│    ├── Bind target MOC3 geometry & texture atlas.                           │
│    └── Re-attach shared physics controller & resume render ticker.          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Ingestion Normalization & User Experience Tradeoffs

When a user drops a `.zip` file containing **multiple `.moc3` binaries** into AIRI:

### The Multi-Costume Import Modal
The importer inspects the archive. If `.moc3` count > 1, it presents the user with two clear choices:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Multi-Costume Package Detected                           │
├─────────────────────────────────────────────────────────────────────────────┤
│ Found 3 costume models: [gura_default, gura_casual, gura_swimsuit]          │
│                                                                             │
│  ◯ Option 1: Unified Character Card with Outfits (Recommended)             │
│    Bundles all outfits under 1 gallery card. Enables dynamic in-chat        │
│    costume switches (ChangeCos) while maintaining single intimacy state.    │
│                                                                             │
│  ◯ Option 2: Split into 3 Standalone Character Cards                        │
│    Normalizes the zip into 3 independent cards in your gallery.             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Gallery UI Representation:
For Option 1 (Unified Multi-Costume Card):
- **Model Count Badge**: Displays a clean pill badge on the gallery card (e.g. `3 Outfits` or `🎭 3 Costumes`).
- **Thumbnail Cycling**: Hovering or clicking the costume indicator cycles through the outfit preview thumbnails directly within the single gallery card, letting users set their default starting outfit!

---

## 5. Implementation Roadmap & Guardrails

1. **Phase 2 (Current Focus)**: Finish Host Intimacy (`Bonus`), Motion Enable/Disable (`MotionEnable`/`MotionDisable`), and DSL VM reactivity for single-MOC models without touching the production zip uploader.
2. **Phase 3 (Multi-MOC Architecture)**:
   - Implement `MultiMocRegistry` in `packages/stage-ui-live2d/src/utils/live2d-zip-loader.ts`.
   - Add MOC3 ArrayBuffer pre-loading & WebGL hot-swap bridge in `@proj-airi/stage-ui-live2d`.
   - Add Multi-Costume Import Modal to `ModelImporter.vue`.

## Relevant Skills

- [[airi-live2d-dsl-interpreter]]
- [[airi-modular-outfits-system]]
