---
name: airi-vrm-vhack-studio
description: >-
  Modify/debug avatar assets with V-HACK/God MODE: VRM tree inspection, MToon materials, Texture Forge, AI textures, mesh surgery, GLB export. Includes Live2D L-HACK; expression/motion mapping uses airi-model-customizer.
---

# AIRI V-HACK Studio — Native VRM Binary Modding Panel

V-HACK is the "hidden devtools" pivot: rather than a standalone app, it is a HACKER MODE panel embedded in AIRI's Model Settings that binary-modifies the loaded VRM **in-memory** — live MToon shader sliders, texture deck, AI texture generation, and a surgical GLB repatcher that compiles changes back to `.vrm`. `docs/design-vhack-studio.md` is the founding spec; this skill maps the implementation.

## 1. Key Code Paths

| Surface | Path |
| :--- | :--- |
| Main panel | `packages/stage-ui/src/components/scenarios/settings/model-settings/vrm-vhack/HackerPanel.vue` |
| Live2D sibling panel | `./live2d-lhack/LHackerPanel.vue` (same directory parent; parallel lizard-mode UI) |
| Panel mount point | `packages/stage-ui/src/components/scenarios/settings/model-settings/vrm.vue` — the `Avatar Appearance` section embeds `HackerPanel` directly. The old `model-settings/index.vue` overlay mount was removed. |
| Tab store | `packages/stage-ui/src/stores/vhack.ts` — `useVHackStore` (132 lines) |
| Desktop settings route | `packages/stage-pages/src/pages/settings/models/index.vue` |
| Design doc | `docs/design-vhack-studio.md` |

**How to reach it**: Settings → Models (VRM selected) → `Avatar Appearance` accordion. The VRM inspector is **docked inline** in the controls rail — no toggle, no fixed overlay, so it can never occlude the preview. The Live2D `LHACK` panel still uses the `lhack` store's toggle + fixed slide-in.

**Presentation note**: the frame, `Nodes` tab, and footer are styled for the light settings surface; the `Lab` and `Deck` tab bodies are still the original dark internals inside a dark inset (pending a follow-up revamp). Keep that split if you restyle further.

## 2. Panel Modules (HackerPanel.vue)

Tabs are `Textures | Lab | Parts` (default `Textures`), all rendered inside one shared 440px rail frame with theme-aware surfaces.

1. **Textures** — 2-column atlas grid of every glTF image (`textureList` from `extractTextures`), with `Find a texture...` search, `All / Main / Shade` filters, size/format metadata, and a selected-texture summary. Selecting a card resolves the first material that actually uses that image and opens it in **Lab**.
2. **Lab** — per-texture replacement workspace. `Current` vs `Replacement` comparison, `Upload PNG`, `OR GENERATE` (presets + prompt + Generate replacement), and a collapsed **Material adjustments** block (Rim Width, Shade Shift, Additive Blending) so the old MToon sliders survive. `Preview` toggles the replacement on/off on the avatar without discarding it; `Revert texture` restores the original image and drops its mutation. Replacements are tracked per glTF image index in the store (`replacementByIndex`, `previewingKeys`, with `originalTextureImages` captured before in-place swaps) so switching textures and collapsing/remounting the section preserve each one.
3. **Parts** — mesh/part inspector; search + show/hide, per-part visibility, Ctrl+click focus. Hiding a node is tracked as `VHACK_HIDDEN`; at export the spleener transforms/ghosts that primitive so it never reappears (see §3).
4. **Texture Forge/AI Studio** (inside Lab) — upload, AI eraser (color-picker key-out; see `Alpha Patch`), and Artistry-provider generation (Gemini key/model/resolution persist in `localStorage` keys `vhack_gemini_api_key|model|res`, NOT the providers store). Generation applies immediately and registers a texture mutation.

## 3. The Surgical Export / Repacker

`exportVrm()` (:727) is the commit-to-binary pass:
1. Applies `hiddenNodeUuids` as spleener transforms (mesh primitive unlink / ghost-scale; logs `[VHACK] Surgery Complete`) (:766-817).
2. Rebuilds the glTF JSON + binary chunk: re-pointing `json.images` to mutated texture indices and rewriting buffer views (`outView.setUint32(16, 0x4E4F534A, true)` = "JSON" chunk magic; `0x004E4942` = "BIN" chunk magic near :940).
3. Streams a download of `V-HACK_{modelName}.vrm`.
GLB chunk-header math (offset = `20 + jsonBytes.length`, then 8-byte header + data) is the most brittle part of this system — a mismatch of even one byte corrupts the whole container.

## 4. State Store (`vhack.ts`)

- The VRM panel is always mounted (no presence flag); `isHackerModeActive` / `toggleHackerMode()` / `closeHackerMode()` now only serve the Live2D `LHACK` sibling. `isHackerModeActive` is dead state for VRM and can be retired.
- `selectedNodeName` / `selectedMaterialName` / `hiddenNodeUuids` — inspector selection & visibility set (Store's Set is rebuilt after mutations so Vue reactivity reflects).
- `geminiApiKey` / `geminiModel` / `geminiResolution` — AI persist keys into `localStorage` (watch-based write-back at :31-33).
- `sourceArrayBuffer` — the untouched imported GLB (`setSourceArrayBuffer`, cleared via :90-93 when model reloaded); `mutatedTextures` (Map<index, {data, mimeType}>) tracks the applied/exportable texture swaps. Preview-off and per-texture revert delete the index entry; global `revert()` clears the map after restoring snapshots.
- **In-place image mutation**: `swapTextureByRef` changes `THREE.Texture.image` rather than replacing the texture object, so the panel captures the pre-swap image via `setOriginalTextureImage` (keyed by texture uuid) to support preview-off/revert. `replacementByIndex` / `previewingKeys` / the original-image map live in this store so the docked panel can unmount without losing replacement state; `setSourceArrayBuffer` and global `revert()` clear them.
- `registerMutation()`, `resetState()` — registration/reset hooks used by the texture workflow.

## 5. Pitfalls & Failure Modes

- **VRAM leaks on hot-swap**: old Three.js textures/materials must be `.dispose()`d (or leaked GPU memory accumulates) — a known problem class.
- **GLB binary corruption**: chunk offset rewrites are unforgiving (see §3); test the export against @gltf-transform or a VRM validator before shipping changes.
- **UI stalls**: serializing large binaries on the main thread freezes the viewport — offload to a Web Worker when repacking large models (this was a flagged bloat concern in the doc).
- **AI settings persistence**: vhack's Gemini keys live in `localStorage`, not the provider store; don't move them into the BYOS-synced state without a migration plan.

## 6. Verification

- `pnpm -F @proj-airi/stage-ui typecheck`.
- Runtime smoke: Settings → Models → Avatar Appearance → toggle node visibility, then export and reload the `.vrm` to confirm the surgery round-trips.

### Authoritative Docs & Cross-Citations

- [docs/design-vhack-studio.md](docs/design-vhack-studio.md) — V-HACK founding spec (panel layout, module breakdown, MVP priorities).
- `airi-character-rendering` — model/schema layer this panel modifies.
- `airi-card-schema` — if exploring "write mutated VRM back onto the outfit card" flows.

## Related Skills & References

- **Peer Skills**: [[airi-card-schema]], [[airi-character-rendering]]
- **Key Documents**: [[design-vhack-studio]]

### Authoritative Design & Architecture Documents

- [docs/design-vhack-studio.md](docs/design-vhack-studio.md) — V-HACK DevTools design document.
- [docs/research-vrm-cloth-interaction.md](docs/research-vrm-cloth-interaction.md) — VRM cloth interaction deep dive.
- [docs/rosetta-stone.md](docs/rosetta-stone.md) — Canonical concept-to-path index; §16 binary-proxy lesson.
