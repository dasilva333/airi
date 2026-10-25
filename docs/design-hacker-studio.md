# Hacker Studio: Model-Agnostic Avatar Asset Modding

**Status:** Implemented (VRM, Live2D, Spine), October 2026
**Supersedes:** the V-HACK-only UX and architecture in [design-vhack-studio.md](design-vhack-studio.md) (kept as historical context)

**Phase 1 (VRM) status (2026-10-25):** implemented end to end.
- Shell: `hacker-studio/HackerStudioShell.vue`, driven by `HackerAdapter` + `useHackerStudio`.
- VRM adapter: `hacker-studio/adapters/vrm/use-vrm-hacker-adapter.ts`; GLB surgery: `glb-exporter.ts`.
- Session host: `hacker-studio/use-hacker-studio-host.ts` keeps the adapter/controller alive across Section collapse and settings remounts.
- Retired: `vrm-vhack/HackerPanel.vue` and `stores/vhack.ts`.

**Phase 2 (Live2D) status (2026-10-25):** implemented end to end for atlas replacement and ZIP export.
- Live2D adapter: `hacker-studio/adapters/live2d/use-live2d-hacker-adapter.ts`; ZIP rewrite: `live2d-exporter.ts`; baseTexture swap/restore: `live2d-texture.ts`.
- Mounted through `hacker-studio/use-live2d-hacker-studio-host.ts` in `live2d.vue` after Character Customizations.
- The legacy `LHackerPanel.vue`, global drawer mount, L-HACK toggle, `lhack.ts`, and dead `__LHACK_LAST_ZIP_BUFFER__` capture are removed.
- Export requires a source ZIP; bare model URLs show a disabled reason. Uploads are PNG-only for Live2D in this pass.

**Phase 3 (Spine) status (2026-10-25):** implemented end to end for atlas-page replacement and ZIP export.
- Spine adapter: `hacker-studio/adapters/spine/use-spine-hacker-adapter.ts`; ZIP rewrite: `spine-exporter.ts`; page swap/restore: `spine-texture.ts`.
- Runtime bridge: `packages/stage-ui-spine/src/utils/spine-hacker-runtime.ts` exposes the live atlas/context, source ZIP, and a `createTexture` callback from `Model.vue`. The callback uses the dynamically loaded Spine runtime's own `GLTexture`, avoiding cross-version context mismatches; raw objects stay outside Pinia.
- Mounted through `hacker-studio/use-spine-hacker-studio-host.ts` in `spine.vue` after Character Customizations.
- Atlas metadata is preserved on replacement: Spine derives UVs from the page `size:` header, so patching only that header would corrupt sampling. The replacement image is sampled by the existing normalized UVs; dimension changes are surfaced as a warning in the Lab.
- Export requires a source ZIP; bare sibling-URL models show a disabled reason. Uploads are PNG-only in this pass.
- Revert swaps the original `GLTexture` back in place; it never calls `shouldUpdateView()` (which would reload the model).

**Deferred across formats:** Live2D Parts/drawables, Spine Parts/slots/skins, and a Pinia session store. Controller state is serializable; live Three/Pixi/Spine handles use session host singletons.

**Roadmap entry:** [Unified Texture Editor (V-HACK / L-HACK & ModelCustomizer)](content/en/docs/chronicles/roadmap.md)
**Related:** [design-model-customizer.md](design-model-customizer.md), [AIRI Character Rendering skill](../.agents/skills/airi-character-rendering/SKILL.md)

---

## 1. Summary

Hacker Studio is one docked **Avatar Appearance** section shared by the supported display-model formats. It brings the V-HACK / L-HACK texture workflow to **VRM, Live2D, and Spine** through a common shell and format adapters:

- Same tabs, Local editing / Promptcraft modes, upload/drop flow, replacement history, preview, validation, generation progress, and footer for all formats.
- **Atlas/texture replacement is the first milestone.** Parts/visibility is VRM-only for now; Live2D drawables and Spine slots are deferred.
- **New UI only.** The old V-HACK Lab and the L-HACK purple drawer are retired; format-specific internals move behind adapters.
- **Thin shell, thick adapters.** GLB surgery, Pixi baseTexture swaps, and Spine atlas/ZIP handling stay inside their format adapters.
- **One shared session runtime.** Controller state is serializable and lives in `useHackerStudio`; a session host keeps the live adapter alive. No migration from `vhack.ts` / `lhack.ts`; old AI keys and session state are intentionally dropped.
- **MMD is excluded.** Its current wiring has no writable export bundle; a preview-only MMD surface is not worth building.
- **Three adapters completed** — VRM, Live2D, and Spine share the contract and shell.

---

## 2. Context

The original V-HACK design was deliberately VRM-only: a Three.js/GLB inspector with MToon parameters, texture decks, AI texture generation, and a surgical GLB repacker. L-HACK grew as a parallel Live2D panel with its own purple drawer, Pixi atlas swapping, ZIP export, and a second store.

The roadmap already names the intended convergence:

> **Unified Texture Editor (V-HACK / L-HACK & ModelCustomizer)** — Dynamic reskinning editor building on ModelCustomizer unified model handling across VRM (3D), Live2D (2D), MMD/PMX, and Spine.

MMD was part of the original roadmap target, but is now explicitly deferred: the current MMD loader has no writable export bundle (see §3.1). This initiative covers VRM, Live2D, and Spine.

The concepts already exist in every format:

| Concept | VRM | Live2D | Spine |
| :--- | :--- | :--- | :--- |
| Texture unit | glTF image | atlas page | atlas page |
| Owner | material / outline | drawable / part | slot / attachment |
| Preview apply | in-memory `Texture.image` | `baseTexture` swap | atlas page swap |
| Export | surgical GLB | ZIP rewrite | ZIP rewrite |
| Parts | nodes | drawables | slots / attachments |

The UI, state, and export plumbing are what diverged. Hacker Studio converges those, not the format internals.

### Current split (for context)

- `vrm.vue` creates the VRM adapter/controller through `use-hacker-studio-host.ts` and embeds `hacker-studio/HackerStudioShell.vue` docked in Avatar Appearance.
- `live2d.vue` creates the Live2D adapter/controller through a session host and docks the shared shell after Character Customizations.
- Both `vhack.ts` and `lhack.ts` have been retired; AI provider configuration comes from `useArtistryStore`.
- Live2D Parts/drawables remain deferred; its new adapter restores baseTextures in place instead of reloading the page.

This document specifies the replacement.

---

## 3. Goals and non-goals

### Goals

1. One **Avatar Appearance** experience for VRM, Live2D, and Spine.
2. First-class **atlas/texture replacement** for all three, including download, local upload/drop, AI generation, preview, revert, and export where a source bundle exists.
3. Preserve the new UI contract: Local editing / Promptcraft, shared chrome outside forms, decode-before-apply uploads, replacement origin/history, generation revisions, and accessible owner information.
4. Thin shared shell; format adapters own rendering, texture application, parts, and export.
5. One new serializable store for cross-format session state; **no migration** and no legacy dual-write.
6. Retire the old V-HACK Lab and L-HACK drawer rather than running two UIs.

### Non-goals (first milestone)

- Full Parts parity for Live2D/Spine before texture replacement works. VRM Parts remains; other Parts are capability-gated until phase 5.
- A universal material editor. Only adapters that can expose material controls do so.
- UV-aware painting or per-material image duplication for shared atlases (a known VRM limitation; see §13).
- Exporting a complete bundle when the source is a bare model URL with no original archive.
- Migrating old `vhack_*` / `lhack_*` settings, AI keys, or session data.
- MMD support of any kind (see §3.1).
- Spine skin authoring beyond the existing settings panels.

### 3.1 MMD is intentionally out of scope

The current MMD pipeline consumes a PMX/PMD and either a ZIP bundle or a bare model URL. It exposes the loaded Three.js mesh but does not retain a writable PMX/source bundle, and there is no viable export path in the present architecture. Shipping a texture-preview-only MMD adapter would contradict Hacker Studio's export contract and create a second-class surface.

MMD is therefore not an adapter in this initiative. Revisit only if the MMD loader is redesigned to retain a writable bundle (PMX + external texture paths) and an exporter is specified separately. No MMD UI, store state, or deferred tab should be added now.

---

## 4. Product and UX

### 4.1 Mount

Each format settings panel owns an `Avatar Appearance` section that hosts the shared shell:

- `vrm.vue`
- `live2d.vue`
- `spine.vue`

The Live2D L-HACK drawer, its toggle, the global `LHackerPanel` mount, the old VRM `HackerPanel`, and their stores are removed. Each format mounts `HackerStudioShell` through its own host.

The shell is the same 440px controls-rail content used by the current Lab. No format-specific heading is duplicated; the outer Section title/subtitle remain.

### 4.2 Shared chrome

Outside the Local/Promptcraft forms:

- Selected texture header: name, format/type, dimensions, owner count, expandable owner list (touch-friendly `<details>`).
- Current / Replacement thumbnails.
- Preview eye with “on avatar” hint.
- Download replacement, surgical eraser, Revert texture, Change texture.
- Replacement origin status: uploaded filename or “Generated replacement”; “Loaded in preview” / “Saved · preview off”.
- Upload warnings (dimensions, transparency loss, non-PNG format, adapter-specific metadata).
- Material adjustments (only if `capabilities.materials`).
- Shared-texture warning using adapter vocabulary.
- Generation progress/error status visible in both modes.
- Footer: Reset changes + adapter export action. Export is the persistent primary action.

### 4.3 Local editing / Promptcraft

- One segmented mode switch immediately above the active form.
- Default **Local editing**; mode is session-persisted globally across formats/textures.
- Prompt is preserved when switching modes; texture selection does not reset the mode.
- **Local editing**: download, drop zone, upload; decode/validate before applying; warnings; immediate preview; Revert available.
- **Promptcraft**: style presets, prompt, provider settings, Generate. The UV-layout/seams/transparency guidance is appended to the request only, never written back to `aiPrompt` or appended repeatedly.
- Generation is allowed to continue while switching modes. A compact shared status remains visible in Local editing; Promptcraft shows the action label and percentage alongside the Generate button.
- A late generation result is discarded if a newer upload, eraser bake, revert, reset, or model change landed on the originating texture.

### 4.4 Tabs

- **Textures** — atlas/texture browser. The shell label is “Textures”; adapters may use “Atlas” in descriptions and summaries.
- **Lab** — per-texture replacement.
- **Parts** — format parts/drawables. Priority 2. Hidden until an adapter declares `capabilities.parts`, except VRM which already has it.

### 4.5 Upload contract

- PNG recommended; JPEG and WebP accepted when the adapter/runtime can load them.
- Decode and validate before mutating anything.
- Non-blocking warnings:
  - dimensions differ from the original;
  - upload loses transparency the original uses;
  - non-PNG format;
  - adapter-specific warnings (for example, Spine atlas-page dimension metadata).
- Valid uploads apply immediately to the preview; no second confirmation.
- Replacing an existing replacement is allowed; Revert and per-texture history remain the safety net.
- Show filename for uploads and “Generated replacement” for AI results, derived from the selected texture’s stored replacement metadata. Switching textures must not erase that origin.

### 4.6 Styling

- Use the current docked, theme-aware surface and typography.
- Accent using existing `primary` chroma tokens; no hardcoded cyan/purple and no global `Button` variant changes.
- Upload/Generate use the accent within their forms; Export is the persistent primary in the footer.
- The old L-HACK purple/dark drawer is retired. A small format badge is sufficient identity; layout and accent remain unified.

---

## 5. Architecture

### 5.1 Shape

```text
packages/stage-ui/src/components/scenarios/settings/model-settings/hacker-studio/
  HackerStudioShell.vue            # tabs, mode switch, shared chrome, footer
  use-hacker-studio-host.ts        # VRM session host
  use-live2d-hacker-studio-host.ts # Live2D session host
  use-spine-hacker-studio-host.ts  # Spine session host
  composables/
    use-hacker-studio.ts           # selection, mode, history, revision, generation, validation
  domain/                          # pure filename/upload/guidance/identity/gamma policies
  adapters/
    types.ts
    vrm/
      use-vrm-hacker-adapter.ts
      glb-exporter.ts
    live2d/
      use-live2d-hacker-adapter.ts
      live2d-exporter.ts
      live2d-texture.ts
    spine/
      use-spine-hacker-adapter.ts
      spine-exporter.ts
      spine-texture.ts
```

The bridge for live Spine objects lives in `packages/stage-ui-spine/src/utils/spine-hacker-runtime.ts`. The shell imports only `HackerAdapter`/controller types and never a renderer package.


The shell never imports Three.js, PixiJS, or Spine runtime types. Adapters never render shared chrome.

### 5.2 Data flow

```text
adapter (active format)
  ├─ textures / parts descriptors (serializable)
  ├─ applyTexture(id, dataUrl, meta, decodedImage?) ──► live model
  ├─ getGenerationBase(id) ──► raw image
  ├─ exportUnavailableReason ──► visible disabled reason
  └─ exportAsset() ──► { blob, filename }

useHackerStudio(adapter)
  ├─ selected texture/part
  ├─ mode + prompt
  ├─ replacement metadata + previewing
  ├─ per-texture revision guard
  ├─ upload validation
  └─ generation lifecycle

HackerStudioShell
  ├─ Textures tab
  ├─ Lab (Local / Promptcraft)
  ├─ Parts tab (capability-gated)
  └─ footer (Reset / adapter export)
```

### 5.3 Adapter contract

```ts
export type HackerModelKind = 'vrm' | 'live2d' | 'spine'

export interface HackerCapabilities {
  textures: boolean
  preview: boolean
  revert: boolean
  parts: boolean
  materials: boolean
  /**
   * VRM only: pre-linearize the preview image to compensate the legacy
   *  NoColorSpace swap. Must never affect export bytes.
   */
  previewGamma: boolean
  export: 'full-bundle' | 'disabled'
}

export interface HackerTexture {
  id: string | number
  name: string
  kind: string // Main | Shade | Atlas | ...
  previewUrl: string | null
  width: number | null
  height: number | null
  owners: string[] // material/drawable/slot labels
  hasAlpha: boolean | null
  shared: boolean
}

export interface HackerPart {
  id: string
  name: string
  kind: string
  visible: boolean
  canFocus: boolean
}

export interface HackerMaterialControls {
  // Adapter-defined, serializable descriptors; values are read/written through
  // adapter methods, not by the shell directly.
}

export interface HackerExportResult {
  blob: Blob
  filename: string
}

export interface HackerAdapter {
  readonly kind: HackerModelKind
  readonly identity: string // model id/url/hash; stable for session keying
  readonly label: string // VRM / Live2D / Spine
  readonly capabilities: HackerCapabilities

  readonly ready: Ref<boolean>
  readonly textures: Ref<HackerTexture[]>
  readonly parts: Ref<HackerPart[]>
  readonly materialControls: Ref<HackerMaterialControls[]>

  /**
   * Raw, unmodified current texture for AI generation. Must not return the
   *  gamma-compensated preview image.
   */
  getGenerationBase: (id: HackerTexture['id']) => Promise<string>

  applyTexture: (id: HackerTexture['id'], dataUrl: string, meta: {
    source: 'upload' | 'generated'
    fileName?: string
  }) => Promise<void>

  /** Restore the live model to the original image for this texture. */
  restoreTexture: (id: HackerTexture['id']) => void

  setPartVisibility: (id: string, visible: boolean) => void

  /** Optional adapter-specific image preparation (VRM gamma compensation). */
  preparePreviewImage?: (dataUrl: string, id: HackerTexture['id']) => Promise<string>

  exportAsset: () => Promise<HackerExportResult>

  reset: () => void
  dispose: () => void
}
```

Rules:

- The shell only sees serializable descriptors and calls adapter methods.
- The adapter owns the original texture map, mutation registry, source archive, and format-specific cleanup.
- `getGenerationBase` returns the raw applied image, not the normalized preview.
- `applyTexture` is atomic from the shell’s perspective: adapter errors surface as typed failures and do not silently overwrite.
- `identity` is used to namespace replacement history and revisions. It must combine format and previewed model identity.
- Adapters must not put raw Three/Pixi/Spine objects into Pinia.

### 5.4 Shared state

There is no Pinia `hacker-studio` store. The serializable controller state lives in `useHackerStudio(adapter)` and is owned by a per-format session host:

- `use-hacker-studio-host.ts` — VRM
- `use-live2d-hacker-studio-host.ts` — Live2D
- `use-spine-hacker-studio-host.ts` — Spine

Each host creates the adapter/controller inside a detached effect scope so Section collapse and settings remounts preserve replacements and mutation registries for the session. Watch sources reset the controller on model/variant changes. The hosts are deliberately singletons rather than Pinia stores because live Three/Pixi/Spine handles cannot be serialized; a future format registry can replace the factory.

Controller state is serializable and includes:

```ts
interface HackerSessionState {
  mode: 'local' | 'prompt'
  prompt: string
  selectedTextureId: string | number | null
  replacements: Map<string, {
    url: string
    source: 'upload' | 'generated'
    fileName?: string
  }>
  previewing: Set<string>
  revisions: Map<string, number>
  uploadNotice: UploadNotice | null
  uploadError: string | null
  generation: {
    isGenerating: boolean
    progress: number
    actionLabel: string | null
    error: string | null
    targetName: string | null
  }
}
```

Replacement keys combine adapter identity and texture id.

### 5.5 Exporters

The footer calls `adapter.exportAsset()`; the shell only renders the label and handles the download.

| Adapter | Export contract |
| :--- | :--- |
| VRM | Surgical GLB rebuild → `.vrm` |
| Live2D | Implemented: JSZip rewrite of `model3.json` texture entries → `.zip`; requires a source ZIP |
| Spine | JSZip rewrite of atlas-page images → `.zip`; atlas UV/PMA metadata preserved; requires a source ZIP |

The Live2D exporter now lives in `adapters/live2d/live2d-exporter.ts`. It reads `model3.json.FileReferences.Textures`, maps runtime indices across filtered blank slots, overwrites the matching ZIP entries from the mutation registry, and returns a ZIP. It requires the source ZIP buffer; models loaded from a bare model URL may not have one.
The Spine exporter lives in `adapters/spine/spine-exporter.ts`: capture the original ZIP, resolve the selected atlas/page paths, overwrite the page entries, and return a ZIP. Atlas text is intentionally preserved, including `size:` and `pma:` lines. Spine derives region UVs from the page size; patching only that header would distort sampling. Only a sibling-URL source without an archive has no bundle to rewrite.

Filename patterns: VRM uses `<base>_VHACK_<YYYYMMDD-HHmm>.vrm`; Live2D/Spine use `<base>_HACK_<YYYYMMDD-HHmm>.zip`, derived from model metadata/display names or the source basename.

`export: 'disabled'` is a visible capability, not a silent no-op. The shell shows the adapter’s reason (for example, “Load a ZIP bundle to export a complete model”).

---

## 6. Capability matrix

| Capability | VRM | Live2D | Spine |
| :--- | :--- | :--- | :--- |
| Atlas/texture replacement | ✅ embedded images | ✅ atlas pages | ✅ atlas pages |
| Local upload / drop | ✅ | ✅ | ✅ |
| AI generation | ✅ | ✅ | ✅ |
| Preview / restore / revert | ✅ | ✅ | ✅ |
| Full bundle export | ✅ `.vrm` | ✅ `.zip` (requires source ZIP) | ✅ `.zip` (requires source ZIP) |
| Parts tab | ✅ existing nodes | ⏳ drawables (deferred) | ⏳ slots/attachments (deferred) |
| Material adjustments | ✅ MToon | ❌ | ❌ |
| Gamma preview compensation | ✅ | ❌ | ❌ |
| Owner vocabulary | material | atlas page | atlas page (slots deferred) |

### Capability policy

- Parts tabs are **hidden** until the adapter declares `parts` true. Do not show an empty Parts tab.
- Material adjustments are hidden when `materials` is false.
- Export is disabled with an explicit reason when the source archive is unavailable.
- Gamma compensation is adapter-local; the shell never re-encodes texture bytes.
- For shared textures, the warning uses `owners.length` and adapter-provided noun; there is no generic “materials” assumption.

---

## 7. Format adapter notes

### 7.1 VRM

- Port the current `HackerPanel` internals into `adapters/vrm`.
- Textures = glTF images; owners = materials, including outlines.
- Apply = in-memory texture image swap; preserve the legacy NoColorSpace behavior and use the **preview-only sRGB linearization LUT** (`previewGamma`), keeping export bytes raw/alpha-patched.
- Parts = current node visibility tree.
- Materials = current MToon adjustments.
- Export = existing surgical GLB repacker, hidden-node surgery, mutation registry, and filename resolver.
- Known limitation: one glTF image shared by several material slots cannot have per-slot replacement on export; the shared-image warning remains.
- This adapter is the parity baseline: its extracted shell must behave exactly as the current committed UI before Live2D work starts.

### 7.2 Live2D

- Textures = Pixi atlas pages; owners = drawables/parts that reference them.
- Apply = replace `baseTexture` and synchronize affected drawables; preserve original texture handles for revert.
- **Drawable/parts support is currently disabled** (`drawables` returns `[]` under a `SCALED BACK` comment). Implement discovery and opacity/visibility in phase 5; until then, Parts is hidden.
- Export = `live2d-exporter.ts`: source ZIP → `model3.json.FileReferences.Textures` → overwrite ZIP entries from the mutation registry → `JSZip.generateAsync`. ZIP-sourced models export; bare model URLs surface a clear disabled reason.
- Replace the current full-page reload on revert with in-place restoration.
- The fixed drawer, purple styling, and `lhackStore.isHackerModeActive` toggle are removed. The shared section is docked in `live2d.vue`.
- Atlas page replacement does not carry material semantics; no Material adjustments.

### 7.3 Spine

- Textures = atlas-page images referenced by the `.atlas` file; first-pass owners are the page itself (`atlas page`). Slot/attachment ownership is deferred with Parts.
- Runtime bridge = `spine-hacker-runtime.ts` publishes the selected `TextureAtlas`, `ManagedWebGLRenderingContext`, layout, variant, source ZIP, PMA, and a `createTexture` callback from `Model.vue`. The callback uses the **dynamically loaded Spine runtime's own `GLTexture`**, avoiding cross-version `instanceof` mismatches; raw objects stay outside Pinia.
- Apply = load the decoded PNG, create the replacement through the bridge callback, call `TextureAtlasPage.setTexture()`, and preserve the original texture for in-place restore. Never call `shouldUpdateView()` (it requests a full model reload).
- Source/export: capture the original ZIP buffer and atlas-page paths. Rewrite the page images in the ZIP. This is a ZIP-rewrite problem similar to Live2D; no Spine exporter existed before Phase 3. If the model came from a sibling `.skel`/`.json` URL with no archive, full-bundle export is disabled with a reason.
- Atlas metadata stays authoritative. Spine derives region UVs from the page `size:` header; changing only that header while leaving region coordinates unmodified corrupts sampling. Preserve the atlas text and PMA, sample the replacement by the existing UVs, and expose a dimension warning plus a PMA hint in the Lab.
- Parts (slots/attachments/skins) are phase 5.
- No Material adjustments.

---

## 8. Shared behavior details

### 8.1 Upload validation

1. Accept `image/png`, `image/jpeg`, `image/webp`; infer MIME from extension when the browser omits it.
2. Read/decode the image before mutating the model.
3. Compare with the adapter texture descriptor:
   - dimensions mismatch → warning;
   - original had alpha and upload has none → transparency-loss warning;
   - non-PNG → format recommendation;
   - adapter-specific metadata warning (Spine atlas dimensions, etc.).
4. Bump the texture revision, apply the preview, and store replacement metadata.
5. On decode failure, leave the live model untouched and show the error.

Warnings do not block. Applying is immediate after successful decode.

### 8.2 Generation ownership

- Capture at start: originating texture id/key, adapter identity, raw generation base, starting revision, and model instance.
- Upload/eraser/revert/reset/model changes bump or clear the revision.
- On result: if the revision or model changed, discard the result and surface a visible “result discarded” status. Never overwrite a newer edit.
- The result applies to the originating texture even if the user has selected another texture/format; history and preview state update for that texture.
- Progress is shared in the shell so it stays visible in Local editing; Promptcraft additionally shows the action label and percentage.
- Presets fill the prompt by design; generation guidance is request-only and is not persisted into `aiPrompt`.

### 8.3 Preview and revert

- Preview is per-texture, not global.
- Restore must not reload the page or model.
- Reset clears replacement history, preview flags, mutations, warnings, and generation errors for the active model.
- Adapters dispose temporary canvases/textures and revoke blob URLs they own.

### 8.4 Export

- Export is the persistent primary action, independent of the Lab mode.
- `exportAsset` runs adapter-specific repacking and returns a filename; the shell downloads the blob and reports failures.
- Export must use raw/alpha-patched image bytes, never the gamma-normalized preview.
- Full-bundle export is only advertised when the source archive is captured.

---

## 9. Store and settings

- New namespace: `hacker-studio` store and session state.
- New AI/provider preference surface: consume `useArtistryStore`; remove duplicated Gemini key fields from the old stores.
- **No migration.** Old `vhack_*` and `lhack_*` keys are not read, not dual-written; the old stores and panels are removed. Users start with fresh Hacker Studio settings.
- Raw model objects stay outside the store; only texture descriptors, replacement URLs, metadata, revisions, and generation status are stored.
- Session key includes adapter kind + previewed model identity; switching format must not cross-contaminate replacement history.
- Mode is global session state; prompt is shell state and preserved across mode switches.

---

## 10. Lifecycle and mount

1. The host section creates the adapter for the active renderer and previewed model.
2. The adapter attaches to the live model and publishes serializable texture/part descriptors.
3. `useHackerStudio` restores any existing session state for `adapter.identity`.
4. On model change/format switch, adapters dispose listeners and temporary textures; sessions are keyed and retained only for the current app session.
5. On unmount, adapter `dispose()` runs; no global overlay remains.

Mount points:

- `vrm.vue`: existing Avatar Appearance section → `<HackerStudioShell :adapter="hackerAdapter" :studio="hackerStudio" />` via `use-hacker-studio-host.ts`.
- `live2d.vue`: new Avatar Appearance section after Character Customizations → same shell via `use-live2d-hacker-studio-host.ts`; drawer/toggle removed.
- `spine.vue`: new Avatar Appearance section after Character Customizations → same shell via `use-spine-hacker-studio-host.ts`.
- `model-settings/index.vue`: the global `LHackerPanel` mount is removed.

---

## 11. Rollout

VRM, Live2D, and Spine are in scope for this initiative, sequenced so the contract is stable before the harder format plumbing:

1. **Documentation and contract** — this document; update the old V-HACK spec and roadmap links.
2. **Shell extraction + VRM adapter** — move the current Lab into shared components/composable; `HackerPanel.vue` becomes a thin adapter wrapper; behavior parity and repacker tests.
3. **Live2D adapter** — atlases, Pixi swap/sync, **port the existing ZIP exporter**, in-place revert; dock in `live2d.vue`; remove the drawer/toggle and old purple UI.
4. **Spine adapter** — atlas-page replacement and a **new ZIP exporter** modeled on the Live2D exporter, preserving atlas UV metadata/PMA. (Done.)
5. **Parts parity** — VRM (already), Live2D drawables, Spine slots/attachments; enable tabs only when ready.
6. **Cleanup** — delete `vhack.ts`, `lhack.ts`, old panels, old AI keys, and dead code; update manual/showcase docs. (Done for VRM/Live2D/Spine.)

Parts is explicitly phase 5; texture/atlas replacement must be complete for all adapters before it starts.

---

## 12. Risks and decisions

| Risk / decision | Position |
| :--- | :--- |
| **Three formats at once** | Phased adapters, one contract; do not build three independent UIs. |
| **MMD export is not viable** | MMD is deliberately excluded; do not add MMD UI, store state, or a preview-only adapter. |
| **Export without a source archive** | Disable full-bundle export with a visible reason. Do not fabricate a partial model. |
| **Spine atlas dimensions** | Preserve the `.atlas` size/UV metadata; resizing only the header would corrupt region UVs. Warn on dimension mismatch and preserve PMA. |
| **Live2D drawables disabled** | Parts is deferred; atlas replacement lands first. Do not show an empty Parts tab. |
| **Shared atlases / per-material** | Keep shared-owner warning; per-slot export duplication is out of scope for this initiative. |
| **Old UI removal** | No dual UI, no purple drawer, no old Lab. One shell. |
| **No settings migration** | Accepted: new store/keys; old data is abandoned and old stores removed. |
| **Large textures / memory** | Offload ZIP/GLB assembly to a worker if main-thread stalls appear; adapters own cleanup. |
| **Format identity** | Small format badge; unified theme-aware accent, no per-format purple. |
| **Testing surface** | Adapter contract tests plus one fixture per supported format; VRM repacker regression remains mandatory. |

### Open questions

1. For Spine bare-URL models without an archive: is a “texture pack + instructions” export worth offering, or should export remain disabled? Recommendation: disabled until a full bundle is possible.
2. ~~Spine replacement dimensions~~ — resolved: preserve atlas UV/PMA metadata and warn on dimension mismatch; do not patch only `size:`.
3. Parts tab visibility before phase 5: hidden (recommended) or visible with a “coming soon” state?

---

## 13. Testing and verification

- **Contract tests**: a stub adapter exercises selection, mode switching, upload warning construction, replacement history, revision rejection, and export labels in the shell without a renderer.
- **VRM**: existing repacker regression plus a reload/export round-trip; gamma preview must not leak into mutation bytes.
- **Live2D**: ZIP fixture with `model3.json` + atlas pages; verify replacement, restore, and exported ZIP entries from the ported exporter.
- **Spine**: `.atlas` + page + skeleton ZIP fixture; verify page replacement, atlas metadata handling, and export.
- **Uploads**: decode success/failure, PNG/JPEG/WebP, transparency-loss warning, dimension warning, immediate apply.
- **Generation races**: late result after upload/eraser/revert/reset/model switch is discarded; result attached to origin when selection changes.
- **Typechecks**: `pnpm -F @proj-airi/stage-ui typecheck`, plus `stage-ui-three`, `stage-ui-live2d`, and `stage-ui-spine` where the adapters live.

---

## 14. File map

```text
packages/stage-ui/src/components/scenarios/settings/model-settings/
  vrm.vue                      → Avatar Appearance hosts HackerStudioShell + VRM host
  live2d.vue                   → Avatar Appearance hosts HackerStudioShell + Live2D host
  spine.vue                    → Avatar Appearance hosts HackerStudioShell + Spine host
  index.vue                    → no global Hacker panel mount
  hacker-studio/
    HackerStudioShell.vue
    use-hacker-studio-host.ts
    use-live2d-hacker-studio-host.ts
    use-spine-hacker-studio-host.ts
    composables/use-hacker-studio.ts
    domain/…
    adapters/types.ts
    adapters/vrm/…
    adapters/live2d/…
    adapters/spine/…

packages/stage-ui-spine/src/utils/
  spine-hacker-runtime.ts      # live atlas/context/source/createTexture bridge
  spine-zip-loader.ts          # retained source ZIP + layout/PMA detection
```

Retired:

- `vrm-vhack/HackerPanel.vue`
- `live2d-lhack/LHackerPanel.vue`
- `stores/vhack.ts`
- `stores/lhack.ts`
- L-HACK toggle/global drawer mount and dead ZIP global
