---
name: airi-vrm-vhack-studio
description: >-
  Modify/debug avatar assets with Hacker Studio: VRM adapter/shell, MToon materials, texture atlases, AI textures, mesh surgery, GLB export. Includes the remaining Live2D L-HACK panel and the model-agnostic adapter contract; expression/motion mapping uses airi-model-customizer.
---

# AIRI Hacker Studio — VRM Adapter & Model-Agnostic Shell

Hacker Studio is the successor to V-HACK: a docked **Avatar Appearance** section that modifies the loaded model in memory, with a model-agnostic shell and format adapters. VRM is the first completed adapter. The unified design is [`docs/design-hacker-studio.md`](docs/design-hacker-studio.md); the original V-HACK doc is historical.

## 1. Key Code Paths

| Surface | Path |
| :--- | :--- |
| VRM adapter | `packages/stage-ui/src/components/scenarios/settings/model-settings/hacker-studio/adapters/vrm/use-vrm-hacker-adapter.ts` |
| GLB exporter | `.../hacker-studio/adapters/vrm/glb-exporter.ts` |
| Shell | `.../hacker-studio/HackerStudioShell.vue` |
| Controller | `.../hacker-studio/composables/use-hacker-studio.ts` |
| Adapter contract | `.../hacker-studio/adapters/types.ts` |
| Domain policies | `.../hacker-studio/domain/` |
| VRM mount | `packages/stage-ui/src/components/scenarios/settings/model-settings/vrm.vue` — creates the VRM adapter/controller and mounts the shell inside `Avatar Appearance`. |
| Live2D sibling | `packages/stage-ui/src/components/scenarios/settings/model-settings/live2d-lhack/LHackerPanel.vue` — legacy drawer, pending migration to the shared shell. |
| Test suites | `.../hacker-studio/**/*.test.ts` — 10 suites / 60 tests. |
| Design docs | `docs/design-hacker-studio.md` (current), `docs/design-vhack-studio.md` (historical). |

**How to reach it**: Settings → Models (VRM selected) → `Avatar Appearance`. The VRM section is docked; adapter and controller are owned by `vrm.vue`, so collapsing the section does not lose replacement state.

## 2. Architecture

```text
vrm.vue
  ├─ useVrmHackerAdapter() ── implements HackerAdapter over Three/GLB
  └─ useHackerStudio(adapter) ── serializable controller state
       └─ HackerStudioShell.vue (props: adapter + studio)
```

- **Shell** owns UI-only state: tabs, filters, AI provider form, eraser overlay.
- **Controller** owns selection, mode/prompt, per-texture replacement origin/history, preview flags, revisions, upload feedback, and generation status. It never stores Three/Pixi objects.
- **Adapter** owns live textures, parts, material controls, originals, mutation registry, source buffer, and export.
- `use-hacker-studio-host.ts` owns the adapter/controller in a detached session scope, so Section collapse and settings remounts preserve them. The host is intentionally a singleton rather than a Pinia store until the format registry lands.

### Adapter contract

`HackerAdapter` exposes:

- descriptors: `textures`, `parts`, optional `materialControls`
- `selectTexture(id)` for adapter-side material selection
- `getGenerationBase(id)` returning the **raw applied** image
- `applyTexture(id, dataUrl, meta)` / `restoreTexture(id)` / `setMaterialControl` / `setPartVisibility`
- `exportAsset()` returning `{ blob, filename }`
- `reset()` / `dispose()`
- capabilities including export availability, parts/materials, and preview gamma

## 3. VRM Adapter Behavior

1. **Textures** — one glTF image per descriptor, with material owners, dimensions, shared flag, preview URL, and alpha detection. IDs are adapter-local.
2. **Apply** — `TextureLoader` loads the replacement; the legacy alpha patch and preview-only sRGB-EOTF linearization run for display. Export bytes use the raw/alpha-patched image, never the gamma canvas. The legacy `currentSlotTex.colorSpace = tex.colorSpace` path is intentionally preserved.
3. **Restore** — original images are captured by texture UUID before the first swap and restored in place; the image-index mutation is deleted.
4. **Material controls** — Rim Width, Shade Shift, Additive Blending, with a material snapshot for reset.
5. **Parts** — mesh descriptors; visibility is applied directly and through `modelStore.setMeshVisibility`; Ctrl+click in Parts isolates one part.
6. **Generation** — the controller captures the originating texture and a revision. The shell gets the raw base from the adapter, calls Artistry, and applies through `applyGenerationResult`; uploads/eraser/revert bump the revision, so late results are discarded. UV/seams/transparency guidance is appended to the request only.
7. **Export** — the adapter gathers hidden primitives/nodes and the mutation registry, calls `exportVrmBinary`, and returns a blob. Filename policy lives in `domain/export-filename.ts`.

## 4. State and Persistence

- There is **no `vhack.ts` store** anymore. The legacy store and `vrm-vhack/HackerPanel.vue` were removed.
- Controller state is in `vrm.vue` for the lifetime of the settings panel and survives Section collapse/remount.
- Mode is session-persisted under `hacker-studio-mode`; prompt is controller state and is never rewritten by generation guidance.
- No migration or fallback reads from the old `vhack_*` keys; AI provider configuration comes from `useArtistryStore`.
- Raw binaries/Three objects stay out of reactive state. The mutation registry and original images are plain Maps in the adapter.

## 5. Surgical Export / Repacker

`glb-exporter.ts` is a pure function over `{ source, mutations, hiddenPrimitives, hiddenNodeIndices }`:

1. Parses GLB JSON/BIN chunks.
2. Injects the `VHACK_HIDDEN` material and applies primitive/node surgery.
3. Replaces image bufferViews, updates mimeType and byteLength.
4. Rebuilds BIN offsets/alignment and serializes a valid GLB with the declared buffer byteLength matching the BIN chunk.

The synthetic GLB suite covers offsets, alignment, multiple mutations, hidden surgery, and invalid magic. Test any changes with:
`pnpm exec vitest run packages/stage-ui/src/components/scenarios/settings/model-settings/hacker-studio/adapters/vrm/glb-exporter.test.ts`.

## 6. Pitfalls

- **Image ≠ part**: merged/baked VRMs reuse one image across Body/Bottoms/Hair/outline materials. Surface material owners; never infer a part from a thumbnail.
- **Color-space hack**: the preview intentionally keeps the legacy NoColorSpace swap and compensates with a preview-only LUT. Do not write the compensated canvas into export mutations.
- **Generation ownership**: use the controller's revision guard; do not apply a provider result directly to `selectedTexture` after an await.
- **Shared atlases**: replacing one image affects every material owner; the warning must remain.
- **No per-slot export duplication** for a shared image yet; per-material replacement is a known limitation.
- **VRAM**: dispose/replace textures carefully; original image maps are retained for restore.
- **MMD is excluded** from the unified design; do not add MMD adapters/UI.

## 7. Verification

- `pnpm -F @proj-airi/stage-ui typecheck`
- `pnpm exec vitest run packages/stage-ui/src/components/scenarios/settings/model-settings/hacker-studio`
- `pnpm exec vitest run packages/stage-ui/src/components/scenarios/settings/model-settings/vrm-fps.browser.test.ts`
- `node scripts/audit-test-catalog.mjs` (new suites are cataloged; pre-existing uncatalogued suites remain a known warning)
- Runtime: Settings → Models → Avatar Appearance → upload/generate, Preview/Revert, Parts hide/show, export, re-import.

### Authoritative Docs

- [docs/design-hacker-studio.md](docs/design-hacker-studio.md) — current unified design.
- [docs/design-vhack-studio.md](docs/design-vhack-studio.md) — historical V-HACK spec.
- `airi-character-rendering` — rendering/model layer.
- `airi-model-customizer` — expression/motion mapping.
- `docs/research-vrm-cloth-interaction.md` — tactile VRM interactions.
- `docs/rosetta-stone.md` — canonical path index.
