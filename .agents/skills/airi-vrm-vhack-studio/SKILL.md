---
name: airi-vrm-vhack-studio
description: >-
  Use when working with V-HACK DevTools — the hidden God MODE VRM binary modding panel inside Model Settings: HackerPanel.vue stage-map tree inspector + MToon material lab + Texture Forge + AI-Studio texture generation + surgical GLB export, vhack.ts state store, in-memory hotspot swap, or Unity-style mesh surgery UX. Also relevant to Live2D sibling (live2d-lhack/LHackerPanel.vue) and GLB binary manipulation pitfalls.
---

# AIRI V-HACK Studio — Native VRM Binary Modding Panel

V-HACK is the "hidden devtools" pivot: rather than a standalone app, it is a HACKER MODE panel embedded in AIRI's Model Settings that binary-modifies the loaded VRM **in-memory** — live MToon shader sliders, texture deck, AI texture generation, and a surgical GLB repatcher that compiles changes back to `.vrm`. `docs/vhack-design-doc.md` is the founding spec; this skill maps the implementation.

## 1. Key Code Paths

| Surface | Path |
| :--- | :--- |
| Main panel (1476 lines) | `packages/stage-ui/src/components/scenarios/settings/model-settings/vrm-vhack/HackerPanel.vue` |
| Live2D sibling panel | `./live2d-lhack/LHackerPanel.vue` (same directory parent; parallel lizard-mode UI) |
| Panel mount point | `packages/stage-ui/src/components/scenarios/settings/model-settings/index.vue` — imports both panels (:13, :17) and the store (:24) |
| Tab store | `packages/stage-ui/src/stores/vhack.ts` — `useVHackStore` (132 lines) |
| Desktop settings route | `packages/stage-pages/src/pages/settings/models/index.vue` |
| Design doc | `docs/vhack-design-doc.md` |

**How to reach it**: Settings → Models → V-HACK toggle button launches `toggleHackerMode()` and the panel slides in on the right of the Model Settings viewport.

## 2. Panel Modules (HackerPanel.vue)

1. **StageMap Tree (inspector)** — parses `json.nodes`/`json.meshes` from the source VRM buffer; click a mesh to select + show/hide (`toggleNodeVisibility`, `focusNode` isolation). Hiding a node is tracked as a `VHACK_HIDDEN` entry; at export the spleener transforms/ghosts that primitive so it never reappears (see §3).
2. **Material Lab** — live sliders binding directly to Three.js MToon uniforms (`_RimWidth`, `_ShadeShift`, `_SphereAdd` matcap index, alpha-mode toggle) — zero-latency because edits hit in-memory material objects, not file IO.
3. **Texture Deck + Forge** — grid of all `json.images`; extract PNG / hot-swap upload; `registerMutation(index, data, mimeType)` tracks every touched texture image index in `vhack.ts`. Includes AI eraser (color-picker key-out of black pixels; see `Alpha Patch` :584), color-picker, and "NUCLEAR" mesh texture injection (:553) that matches scene node → mesh → texture slot through UV containment.
4. **AI Studio** — generates replacement textures through the active Artistry provider (Gemini API key/model/resolution persist in `localStorage` keys `vhack_gemini_api_key|model|res`, NOT the providers store); result slots into the Texture Deck and immediately applies to the mapped texture.

## 3. The Surgical Export / Repacker

`exportVrm()` (:727) is the commit-to-binary pass:
1. Applies `hiddenNodeUuids` as spleener transforms (mesh primitive unlink / ghost-scale; logs `[VHACK] Surgery Complete`) (:766-817).
2. Rebuilds the glTF JSON + binary chunk: re-pointing `json.images` to mutated texture indices and rewriting buffer views (`outView.setUint32(16, 0x4E4F534A, true)` = "JSON" chunk magic; `0x004E4942` = "BIN" chunk magic near :940).
3. Streams a download of `V-HACK_{modelName}.vrm`.
GLB chunk-header math (offset = `20 + jsonBytes.length`, then 8-byte header + data) is the most brittle part of this system — a mismatch of even one byte corrupts the whole container.

## 4. State Store (`vhack.ts`)

- `isHackerModeActive` + `toggleHackerMode()/closeHackerMode()` drive the panel's presence.
- `selectedNodeName` / `selectedMaterialName` / `hiddenNodeUuids` — inspector selection & visibility set (Store's Set is rebuilt after mutations so Vue reactivity reflects).
- `geminiApiKey` / `geminiModel` / `geminiResolution` — AI persist keys into `localStorage` (watch-based write-back at :31-33).
- `sourceArrayBuffer` — the untouched imported GLB (`setSourceArrayBuffer`, cleared via :90-93 when model reloaded); `mutatedTextures` (Map<index, {data, mimeType}>) tracks every texture swap.
- `registerMutation()`, `resetState()` — registration/reset hooks used by Texture Forge / deck sections.

## 5. Pitfalls & Failure Modes

- **VRAM leaks on hot-swap**: old Three.js textures/materials must be `.dispose()`d (or leaked GPU memory accumulates) — a known problem class.
- **GLB binary corruption**: chunk offset rewrites are unforgiving (see §3); test the export against @gltf-transform or a VRM validator before shipping changes.
- **UI stalls**: serializing large binaries on the main thread freezes the viewport — offload to a Web Worker when repacking large models (this was a flagged bloat concern in the doc).
- **AI settings persistence**: vhack's Gemini keys live in `localStorage`, not the provider store; don't move them into the BYOS-synced state without a migration plan.

## 6. Verification

- `pnpm -F @proj-airi/stage-ui typecheck`.
- Runtime smoke: Settings → Models → V-HACK → toggle node visibility, then export and reload the `.vrm` to confirm the surgery round-trips.

### Authoritative Docs & Cross-Citations

- [docs/vhack-design-doc.md](docs/vhack-design-doc.md) — V-HACK founding spec (panel layout, module breakdown, MVP priorities).
- `airi-character-rendering` — model/schema layer this panel modifies.
- `airi-card-schema` — if exploring "write mutated VRM back onto the outfit card" flows.

## Related Skills & References

- **Peer Skills**: [[airi-card-schema]], [[airi-character-rendering]]
- **Key Documents**: [[vhack-design-doc]]
