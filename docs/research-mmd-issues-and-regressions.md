# MMD Regressions, Issues, and Upstream Tracking

This document tracks known issues, regressions, and upstream PR references related to MikuMikuDance (MMD) model support in `stage-ui-mmd` and `stage-ui`.

---

## Active Issues & Regressions

### 1. Display Preview Cache Generating Empty Image [RESOLVED]
* **Symptom**: Generated display preview cache images for MMD models result in empty / 0-byte or transparent image files.
* **Impact**: Model selector cards and catalog previews show blank images for MMD models.
* **Component**: `@proj-airi/stage-ui-mmd/utils/mmd-preview.ts` / `generateMmdPreview`.
* **Resolution**: Updated `loadMMDModelPreview` to map sidecar texture files into Blob URLs and install `urlModifier` on `loadMMDModelFromSource`, properly rendering MMD textures into offscreen preview canvases. (Committed in `c94bdf0c6`)

### 2. Built-in VMD Motions Missing in ModelCustomizer [RESOLVED]
* **Symptom**: The "Motions" tab in `ModelCustomizer.vue` fails to list or populate built-in `.vmd` motion files for MMD models.
* **Impact**: Users cannot preview or select built-in VMD animations for MMD models from the customizer panel.
* **Component**: `packages/stage-ui/src/components/scenarios/settings/model-settings/ModelCustomizer.vue` / `@proj-airi/stage-ui-mmd`.
* **Resolution**: Coalesced both `mmdStore.availableMotions` (built-in VMD files) and `mmdStore.customMotions` (user uploaded VMD files) into `rawMotions` in `ModelCustomizer.vue`, exposing all motions under "Built-in Animations" and "Custom Animations" groups.

### 3. Bundled Model Backup Architecture Clobbered (Flat Filesystem Degradation) [OPEN]
* **Symptom**: The original model backup implementation bundled the `.pmx` model and its sidecar textures into a single archive format (`.pmz` / zipped bundle) for clean backup and transport. The current logic extracts and litters the filesystem with flat unorganized files.
* **Impact**: System storage cleanliness degraded; backup/restore cannot cleanly transport self-contained MMD model bundles.
* **Component**: `@proj-airi/stage-ui-mmd/utils/mmd-zip-extractor` & `display-models.ts` backup exporter.

---

## Upstream Tracking & PR References

### Upstream PR #2171 (`moeru-ai/airi#2171`)
* **Description**: Contains an improved, more performant MMD rendering & model ingestion implementation from upstream.
* **Tracking Goal**: Review and cherry-pick / adapt performance enhancements from upstream `#2171` to optimize MMD model rendering, texture handling, and memory footprint.
