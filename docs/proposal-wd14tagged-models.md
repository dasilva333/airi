# Proposal: Auto-Tagging Local Models via WD14 Image Tagger

This proposal details the integration of the **SmilingWolf WD14 Danbooru Tagger** (specified in `design-vision-system-support.md`) to automatically extract, store, and query visual tags for all models (VRM, Live2D, Spine, MMD) in the user's local collection. This turns the Model Selector into a semantically searchable library (e.g., searching "blonde", "swimsuit", "glasses" to find a matching model for a synthesized companion).

---

## 1. The Core Concept

By utilizing the vision system's image tagger on each model's preview/thumbnail image, we can automatically index their visual attributes without requiring manual tag entry from the user.

```
[Model Preview Image] ──> [WD14 Tagger (Local WebGPU)] ──> [Extract Danbooru Tags] ──> [Save to Model Metadata] ──> [Semantic Library Search]
```

---

## 2. Storage & Cloud Sync Integration

To track these tags, we will extend the model metadata schema:

### A. Schema Extension
Inside the `display-models` store (defined in `packages/stage-ui/src/stores/display-models.ts`), we will add a new field:
```typescript
interface DisplayModelMetadata {
  id: string
  name: string
  format: DisplayModelFormat
  // ... existing fields
  tags?: string[] // Auto-generated visual tags (e.g., ['blonde hair', 'glasses', 'blue eyes'])
}
```

### B. Cloud Sync Coordination
Since model metadata is tracked and synchronized (referenced in `docs/project-byos-cloud-sync.md`), this `tags` property will be serialized within the model's metadata block and synced to the user's BYOS (Bring Your Own Storage) drive, ensuring that tags are computed once and available across all the user's devices.

---

## 3. UI/UX Changes in the Model Selector

We have implemented the following features:

### A. The [Tag] Toolbar Button & Popover
*   **Icon & Label**: Placed in the top toolbar of the Model Selector as `<div class="i-solar:tag-bold-duotone text-xs" /> Tag`.
*   **Contextual Trigger**:
    *   If **uninitialized** (no tags exist in the DB), clicking the button triggers the batch indexer (`testTagModel('reindex')`).
    *   If **initialized**, clicking it opens the `PopoverRoot` containing the **Top 20 filter tags** (pills showing tag counts).
*   **Reindex & Fill In Options**: Located at the bottom of the popover content block:
    *   `Fill In`: Runs the tagger only on new models without existing tags (highly efficient).
    *   `Reindex`: Runs a full force-overwrite tagging job on all models.
    *   `Reset`: Clears the selected tags filter.

### B. Lightweight Tag Count Badge (Option B)
*   To avoid Reka/Radix UI rendering overhead for hundreds of cards, each model card displays a simple, non-interactive badge (e.g., `[🏷️ 34]`) indicating the tag count.
*   Hovering over this badge displays the full list of tags as a native browser tooltip (`title` attribute) with **zero performance penalty**.

### C. Search Field Extension
*   The text search box in the Model Selector matches the user's input against **both** the model name and the tags array partially (e.g., searching "blond" will match models tagged "blonde hair").

---

## 4. Consumer File References

The tags field is consumed or will be integrated in the following files:

### 1. Main Model Selector Dialog
*   **Path**: [model-selector.vue](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/components/scenarios/dialogs/model-selector/model-selector.vue)
    *   *Search filter logic*: lines 101-113
    *   *Tags filter Popover & toolbar*: lines 1008-1090
    *   *Tag count badge*: lines 1227-1236

### 2. Control Strip "Avatars" Panel
*   **Path**: [ControlStrip.vue](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/components/scenarios/layout/ControlStrip.vue)
    *   *Search/filtering logic*: lines 36-65
    *   *Search input binding*: lines 2300-2308

### 3. Concept Builder Modal (Manifestation Tab)
*   **Path**: [ConceptBuilderModal.vue](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-pages/src/pages/settings/airi-card/components/ConceptBuilderModal.vue)
    *   *Search/filtering logic*: lines 196-215
    *   *Search input binding*: lines 502-506

### 4. Card Import Wizard (Visual Avatar step)
*   **Path**: [CardImportWizard.vue](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-pages/src/pages/settings/airi-card/components/CardImportWizard.vue)
    *   *Model mapping & computed state*: lines 85-104
    *   *Model grid display*: lines 555-586

---

## Open Questions & System Decisions

### 1. Tag Pruning & Noise Filtering
*   **Decision**: We curated the blocklist based on the complete ingestion run of 363 models.
*   **Final Blocklist**: `1girl`, `1boy`, `solo`, `looking at viewer`, `simple background`, `white background`, `black background`, `grey background`, `transparent background`, `outstretched arms`, `straight-on`, `spread arms`, `cowboy shot`, `standing`, `t-pose`, `full body`, `upper body`, `close-up`, `tachi-e`, `closed mouth`, `blush`, `blush stickers`, `smile`, `parted lips`, `open mouth`, `expressionless`, `male focus`, `holding`, `hand on own hip`.

### 2. Auto-Run on Import vs. User Consent
*   **Decision**: Auto-tagging will **not** run automatically upon model import. Since loading and running the WD14 ONNX/WebGPU tagger model introduces non-trivial resource overhead and asset downloading, it requires explicit user consent.
*   **Flow**: Tagging remains a manual, user-triggered action via the **[Tag]** popover buttons.

### 3. Database Write Performance Optimization
*   **Problem**: Sequentially awaiting database writes and firing reactive cross-window broadcasts for each model (363 re-saves) caused a massive I/O bottleneck.
*   **Proposed Optimization**: In the next iteration, we will use a **Chunked Batch Queue** (e.g., size of 10) that writes updates in parallel via `Promise.all` and fires the cross-window sync broadcast only once per batch.

## Relevant Skills

- [[airi-attention-ecology-vision]]
