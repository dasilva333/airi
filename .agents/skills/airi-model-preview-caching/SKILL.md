---
name: airi-model-preview-caching
description: >-
  Use when generating, caching, framing, or refreshing 2D and 3D avatar display model preview thumbnails (VRM, Live2D, Spine, MMD), implementing offscreen renderer pipelines, applying framing/camera strategies per format, trimming transparent margins, settling animations, persisting compressed WebP previews to IndexedDB (localforage), batch reprocessing thumbnails, or synchronizing catalog metadata across windows.
---

# AIRI Model Preview Caching & Keyframing Engine

This skill provides comprehensive guidelines, architectural mental models, per-format framing theories, offscreen rendering pipelines, batch reprocessing queue architectures, and persistence contracts for generating and maintaining cached model preview thumbnails across all avatar formats supported by AIRI.

---

## 1. Architectural Overview & The Two-Tier Storage Hierarchy

Model preview thumbnails (`previewImage`) are critical for UI rendering performance across the Companion Avatars Carousel (`ModelSelectorCarousel.vue`), compact grid views (`model-selector.vue`), Animadex cards, and dialogue rehearsal. Rendering live 2D/3D models in catalog pickers causes severe WebGL context exhaustion and GPU thrashing; thus, every model relies on a cached, transparent, pre-framed snapshot.

AIRI enforces a strict **Two-Tier Storage Hierarchy** to balance fast reactivity against memory safety:

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Tier 1: Core Binary Persistence Layer (IndexedDB via localforage)       │
│ - Key: `display-model-<nanoid>`                                         │
│ - Payload: DisplayModelFile { file: File/Blob, previewImage: DataURL }  │
│ - Textures Key (MMD): `${id}-textures` (MmdTextureFile[])               │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ On-Demand Loading
                                     ▼ (`getDisplayModel(id)`)
┌─────────────────────────────────────────────────────────────────────────┐
│ Tier 2: Lightweight In-Memory Catalog (Pinia displayModels.value)      │
│ - Reactive array for UI rendering & search                              │
│ - Payload: DisplayModelFile { file: undefined, previewImage: DataURL }  │
│ - Rule: MUST NEVER hold raw File/Blob references in catalog items       │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ Cross-Window Sync
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Auxiliary Sync & Metadata Cache                                         │
│ - `local:display-models:metadata-cache` in storage.ts                   │
│ - `broadcastModelsSync(Date.now())` via BroadcastChannel                │
│ - In-Memory LRU-3 Cache (`displayModelCache`) for active stage models  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Per-Format Keyframing Theories & Offscreen Rendering

Each avatar format has distinct coordinate systems, bone/parameter conventions, and camera optics. AIRI provides specialized offscreen preview generators for each format.

### A. 3D VRM (`@pixiv/three-vrm`)
- **Generator**: `packages/stage-ui-three/src/utils/vrm-preview.ts` (`loadVrmModelPreview`)
- **Offscreen Canvas**: 512×768 with WebGLRenderer (`alpha: true`, `preserveDrawingBuffer: true`, `antialias: true`).
- **Camera & Framing Strategy**:
  - Uses `vrmData.modelCenter` and `vrmData.initialCameraOffset` (computed from bounding box and humanoid height).
  - Perspective camera with FOV 40 positioned at `modelCenter + initialCameraOffset`, looking directly at `modelCenter`.
  - Balanced 3-point lighting: AmbientLight (0.8) + DirectionalLight (0.8 at `(1, 1, 1)`).
- **Settling & Keyframing**:
  - Applies active expressions via `vrmInstance.expressionManager.setValue()`.
  - Calls `expressionManager.update()`.
  - **SpringBone Stabilization**: Calls `vrmInstance.update(0.1)` followed by `vrmInstance.update(0)` and a 200ms delay to let spring bones, cloth physics, and eye gaze settle before capturing.
- **Output**: WebP (`image/webp`, quality 0.85).

### B. 2D Live2D Cubism (`pixi-live2d-display/cubism4`)
- **Generator**: `packages/stage-ui-live2d/src/utils/live2d-preview.ts` (`loadLive2DModelPreview`)
- **Offscreen Canvas**: 512×768 offscreen DOM canvas attached with `opacity: 0` to preserve WebGL context.
- **Framing & Silhouette Cropping**:
  - Model centered at `(275, 450)` with initial scale `(0.1, 0.1)`.
  - Parameters applied to `internalModel.coreModel.setParameterValueById`.
  - After rendering, passes offscreen canvas through `@lemonneko/crop-empty-pixels` to remove all blank margin pixels around the character's exact silhouette.
  - **Aspect Ratio Padding**: The cropped canvas is repadded to a standard **12:16 vertical character portrait aspect ratio** on an auxiliary 2D canvas, ensuring uniform alignment across model pickers without warping.
- **Output**: WebP (`image/webp`, quality 0.85).

### C. 2D Spine Skeletal Animation (`@esotericsoftware/spine-webgl`)
- **Generator**: `packages/stage-ui-spine/src/utils/spine-preview.ts` (`loadSpineModelPreview`)
- **Multi-Version Dynamic Loader**: Detects version from binary or JSON header (`detectSpineVersionFromBinary` / `detectSpineVersionFromJson`) and loads matched runtime (Spine 3.8 / 4.0 / 4.1 / 4.2).
- **In-Memory Downloader Patch**: Patches `AssetManagerBase.downloader` (`patchAssetManagerForZipAssets`) to intercept texture/atlas requests and serve in-memory Blob URLs, bypassing Electron file URL bugs.
- **Whole-Character Union Bounding**:
  - Do NOT rely on head/chin bone joints alone (the skull, ears, hats, and tall hair extend hundreds of pixels higher; weapon props/accessories extend horizontally).
  - Synthesize a unified model bounding box from:
    1. Attachment bounds via `skeleton.getBounds(offset, size, [])` with proper `new spine.Vector2()` instances. If `getBounds` returns degenerate (<= 0) dimensions, dynamically project slot mesh/region attachment vertices into world coordinates.
    2. Design canvas bounds via `skeletonData` (`x`, `y`, `width`, `height`).
    3. Bone world bounds across all non-root bones (`minX`, `maxX`, `minY`, `maxY`).
  - Sets skin to `"Normal"` or first non-default skin and calls `setSlotsToSetupPose()`.
  - Disables physics (`Physics.none`) to prevent spring distortion on initial frame.
- **Animation Settling Loop (`AnimationState`)**:
  - Models with complex IK constraints, cloth meshes, or leg assemblies (e.g. Evangelion Rei) often have unpositioned setup bones at pose frame 0.
  - Instantiate `AnimationState(new AnimationStateData(skeleton.data))` and apply the default idle/stand animation (`state.setAnimation(0, idleAnim.name, true)`).
  - Run an artificial 15-frame tick loop (`state.update(delta)`, `state.apply(skeleton)`, `skeleton.updateWorldTransform()`) before snapshotting to let the character naturally settle into resting pose.
- **Silhouette Trimming & Portrait Repaging**:
  - Some Spine authoring setups export huge 4000×4000 canvas dimensions for a small character (e.g. White Suit Asuka), making the character appear tiny and distant.
  - To solve this universally, capture the canvas into an offscreen buffer, crop away empty transparent pixels via `cropEmptyPixels(tempCanvas, { minAlpha: 0.02 })`, and repage the trimmed character onto a 12:16 vertical portrait (`repageToPortrait(croppedCanvas, 12, 16, 0.88)`).
  - This fills 88% of the portrait canvas while preserving exact aspect ratio and transparency.
- **Output**: WebP (`image/webp`, quality 0.85).

### D. 3D MMD (`three/addons/loaders/MMDLoader`)
- **Generator**: `packages/stage-ui-mmd/src/utils/mmd-preview.ts` (`loadMMDModelPreview`)
- **Physics-Free Snapshot**: Deliberately omits Ammo.js WASM physics simulation to keep preview generation lightweight, capturing the model in clean rest pose.
- **Texture Remapping**: Maps extracted ZIP textures via `textureUrlMap` to handle relative Windows backslash path variations.
- **Bounding Box Distance Math**:
  - Computes `Box3` dimensions `(size.x, size.y)`.
  - Calculates distance: `1.15 * Math.max((size.y / 2) / tan(fov / 2), (size.x / 2) / (tan(fov / 2) * aspect))`.
  - Centers camera at target with 15% margin to ensure head ornaments and weapons fit cleanly within frame.
- **Output**: WebP (`image/webp`, quality 0.85).

---

## 3. macOS AppleDouble & Quarantine Junk Filtering

When users import model zip files created or unpacked on macOS, the archive often contains AppleDouble resource fork files (`__MACOSX/`, `._*`, `.DS_Store`). If parsed as model assets:
- `._model3.json` or `._character.cdi3.json` files contain binary quarantine metadata (e.g. `Mac OS X ... ATTR ... com.apple.quarantine`), causing `JSON.parse` syntax crashes.
- Hidden AppleDouble atlas textures cause Spine/Live2D asset loaders to fail.

### Defense Rules:
1. **Zip Ingestion Filtering**: Always strip entries matching `__MACOSX/`, `**/._*`, or `.DS_Store` before indexing model files:
   ```ts
   function isJunkMacFile(name: string) {
     return name.includes('__MACOSX') || name.split('/').some(p => p.startsWith('._') || p === '.DS_Store')
   }
   ```
2. **Safe JSON Parsing**: Always wrap JSON parsing of model descriptors (CDI3, model3.json, Spine json) in try/catches and filter out filenames starting with `._`.

---

## 4. UI Representation & Format Badges

Model selector cards in both compact grid (`model-selector.vue`) and carousel lineup (`ModelSelectorCarousel.vue`) follow a unified badge hierarchy:

1. **Badge Order**:
   `[LOCAL] / [CLOUD]` ➔ `[FORMAT]` ➔ `[NSFW]` (if applicable) ➔ Groups ➔ Tags count.
2. **Color Mapping**:
   - **Live2D**: Teal (`bg-teal-500/10 text-teal-600 dark:text-teal-400`) — distinct from `LOCAL` green.
   - **VRM**: Blue (`bg-blue-500/10 text-blue-600 dark:text-blue-400`).
   - **Spine**: Purple (`bg-purple-500/10 text-purple-600 dark:text-purple-400`).
   - **MMD**: Pink (`bg-pink-500/10 text-pink-600 dark:text-pink-400`).
3. **Card Cleanliness**: Avoid redundant rows below the model title or inconsistent icons; use the top badge row to maintain tight vertical spacing.

---

## 5. Preview Refresh & Batch Reprocessing Queue

AIRI provides both single-model preview regeneration and gallery-wide batch reprocessing.

### A. Single Preview Refresh (Context Menu)
- Located in card `•••` dropdown menu (`Refresh Thumbnail`).
- Calls `displayModelStore.regenerateDisplayModelPreview(model.id)`.
- Updates the model card's `loadingPreviews[model.id]` state and displays a `toast.promise`.

### B. Batch Reprocessing Queue ("Thumbs" Button)
- Located in the model selector toolbar directly to the right of **Tags**.
- Displays `i-solar:gallery-bold-duotone` and switches to a spinning `i-solar:refresh-bold animate-spin` indicator during processing.
- **Confirmation Dialog**:
  > "Are you sure you want to reprocess the thumbnails in the viewable gallery? Doing so might take a few seconds to a few minutes depending on your collection. Apply if they previously got clipped or generated with a background color."
- **Sequential Queue Execution**:
  - **CRITICAL**: Do NOT execute preview generation concurrently in parallel! Creating 10+ offscreen WebGL canvases simultaneously exceeds the browser's hardware WebGL context limit (`CONTEXT_LOST_WEBGL`) and causes browser GPU crashes.
  - Process models **sequentially one by one** with a 60ms breather between items:
    ```ts
    for (let i = 0; i < targets.length; i++) {
      const target = targets[i]
      loadingPreviews.value[target.id] = true
      try {
        toast(`Reprocessing thumbnail ${i + 1}/${targets.length}: ${target.name}`, { id: toastId })
        await displayModelStore.regenerateDisplayModelPreview(target.id)
        successCount++
      }
      catch (err) {
        console.error(`Failed thumbnail for ${target.name}:`, err)
        failedCount++
      }
      finally {
        loadingPreviews.value[target.id] = false
      }
      await new Promise(resolve => setTimeout(resolve, 60))
    }
    ```
  - Card previews update reactively in real time as each model completes.
  - IndexedDB storage, metadata caches, and cross-window broadcast sync remain consistent.

---

## 6. Compression & Image Lifecycle Contracts

1. **Resolution & Size Targets**:
   - Canonical preview size is max 512×768 (or 768px long-edge).
   - Compression helper: `compressPreviewDataUrl(dataUrl, 768, 0.85)` in `packages/stage-ui/src/stores/display-models.ts`.
   - Resulting compressed WebP strings are typically 30KB–80KB (down from 1MB–3MB uncompressed PNGs).
2. **Binary Safety (`toRaw`)**:
   - IndexedDB cannot serialize Vue 3 reactive proxies containing `File`/`Blob` objects.
   - Always call `toRaw(model)` and `toRaw(model.file)` before calling `localforage.setItem(id, cleanModel)`.
3. **Catalog Purity**:
   - `displayModels.value` items MUST have `file: undefined`.
   - Never store raw binary Buffers or Blobs inside `displayModels.value`.

---

## 7. Verification Checklist

- [ ] Generator dispatches to the correct pipeline based on `displayModel.format`.
- [ ] Offscreen canvas and WebGL renderer/context are properly disposed after snapshot capture.
- [ ] No `File` or `Blob` reference leaks into reactive `displayModels.value`.
- [ ] AppleDouble files (`__MACOSX`, `._*`) are filtered out during model scanning and parsing.
- [ ] `toRaw` is used before writing back to IndexedDB (`localforage`).
- [ ] The updated thumbnail immediately reflects in the UI and persists across page reloads.
- [ ] Batch processing runs sequentially without triggering `CONTEXT_LOST_WEBGL`.
- [ ] Run `pnpm --filter @proj-airi/stage-ui typecheck` and verify no type errors.
