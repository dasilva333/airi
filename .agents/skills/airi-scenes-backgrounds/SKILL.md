---
name: airi-scenes-backgrounds
description: >-
  Use when working with Stage background layers, scene style galleries, background picker dialogs, or the background Pinia store (localforage, BroadcastChannel sync, per-card activeBackgroundId, or Vue 3 toRaw serialization of binary blobs). Key technologies: Vue 3, Pinia, localforage, canvas compositing, stage UI. File paths: packages/stage-ui/src/stores/background.ts, packages/stage-ui/src/components/scenes/RendererStage.vue, packages/stage-ui/src/components/scenarios/dialogs/stage-background-picker/, packages/stage-ui/src/components/scenarios/dialogs/background-picker/, packages/stage-pages/src/pages/settings/scene/index.vue.
---

# AIRI Scenes & Backgrounds

Stage background layer, scene style galleries (settings), background pickers, and the `useBackgroundStore` Pinia store.

## Surface Map

- **Stage background layer / compositor**: `packages/stage-ui/src/components/scenes/RendererStage.vue`
- **Background picker** (stage-level): `packages/stage-ui/src/components/scenarios/dialogs/stage-background-picker/StageBackgroundPicker.vue`
- **Background picker dialog wrapper**: `packages/stage-ui/src/components/scenarios/dialogs/stage-background-picker/StageBackgroundDialogPicker.vue`
- **Legacy / alternate background picker** (older, lower-level): `packages/stage-ui/src/components/scenarios/dialogs/background-picker/background-picker.vue` and `background-picker-dialog.vue`
  - NOTE the dual directory structure. Cite `stage-background-picker/` when working on stage-image configuration; the sibling `background-picker/` is for scene-entry-level choice.
- **Scene / style gallery settings**: `packages/stage-pages/src/pages/settings/scene/index.vue`
- **Per-card background linkage**: `packages/stage-ui/src/stores/modules/airi-card.ts:L159`, `L254`, `L783` (`activeBackgroundId: 'none'` default)

## Store Map

- **`useBackgroundStore`** — `packages/stage-ui/src/stores/background.ts:L43` (`'background'`)
  - `STORAGE_PREFIX = 'bg-'` (`L44`)
  - Persistence via `localforage.setItem(entry.id, entry)` (`L368`)
  - Cross-window sync via `useBroadcastChannel({ name: 'airi:background-sync' })` (`L197`)
  - Sync to other windows is NOT via unstorage outbox — see `reconcileBackgrounds()` below

## Key Code Paths

| Path | Notes |
| :--- | :--- |
| `packages/stage-ui/src/stores/background.ts:L95-143` | Legacy prefix migration (`startsWith('builtin:')`) — reads `localforage.keys()` and migrates in place |
| `packages/stage-ui/src/stores/background.ts:L218-227` | Reads `extensions?.airi?.modules?.activeBackgroundId` from the active card and substitutes `'image-journal-'` IDs with the `bg-` prefix |
| `packages/stage-ui/src/stores/background.ts:L330` | `id = \`${STORAGE_PREFIX}${nanoid()}\`` — all new backgrounds are prefixed |
| `packages/stage-ui/src/stores/background.ts:L368` | `localforage.setItem(id, entry)` — the WRITE path; ensure `entry` is plain (use `toRaw`) |
| `packages/stage-ui/src/stores/sync-engine.ts:L625` | `reconcileBackgrounds()` — dedicated background sync engine |
| `packages/stage-ui/src/components/scenes/RendererStage.vue:L189-206` | Background canvas draw with center-cover offset (`offsetX = (canvas.width - drawWidth) / 2`) |
| `packages/stage-ui/src/components/scenes/RendererStage.vue:L284-288` | Fallback compositing when IPC is unavailable (`compositeBg`) |
| `packages/stage-pages/src/pages/settings/scene/index.vue:L14-16` | Gallery filter `e.type === 'scene' \|\| e.type === 'builtin'` |
| `packages/stage-pages/src/pages/settings/scene/index.vue:L19-28` | Getter/setter for `activeBackgroundId` in `scene/index.vue` — mutates `extensions.airi.modules.activeBackgroundId` |

## Core SOPs

### 1. Adding a new background (picker or upload)

1. Import `useBackgroundStore`.
2. Enforce `backgroundStore.addBackground(type, file, file.name, ...)`.
3. The store handles `id` prefixing, persistence, and broadcast (`airi:background-sync`).
4. To **set** the active background, update the card: `cardStore.activeCard.extensions.airi.modules.activeBackgroundId = <newId>` — do not manipulate the background store entry directly for this mapping.

### 2. Layer ordering vs stage model — Z offsets

- Background is drawn on a raw `<canvas>` **behind** the Live2D / VRM model canvas.
- The model canvas has its own stacking context; do not set `z-index` manually in CSS — `RendererStage.vue` controls the composition.
- If a model appears behind the background, check `backgroundStore.activeBackgroundUrl`; if empty, the compositing falls back to the solid `activeBackgroundColor`.

### 3. Per-card `activeBackgroundId`

- Stored under `extensions.airi.modules.activeBackgroundId` (NOT `extensions.airi.modules.backgroundId`).
- Default is `'none'`.
- `'none'` disables compositing; the UI clears it via a `clearBackground()` helper in `scene/index.vue`.

## Known Pitfalls

### Storage sync via `reconcileBackgrounds()`, not unstorage outbox

Binary blobs stored in `localforage` under `bg-*` keys are **excluded** from the normal unstorage sync outbox. Cross-window / cross-device sync is explicitly handled by `reconcileBackgrounds()` in `packages/stage-ui/src/stores/sync-engine.ts`. Never rely on unstorage persistence to propagate a new background blob.

### Vue 3 `toRaw` before storing binary

Do not pass a reactive object containing `Blob` or `File` directly into `localforage.setItem`. Always un-proxy first:

```ts
import { toRaw } from 'vue'

const cleanModel = toRaw(model)
const cleanFile = toRaw(model.file)
await localforage.setItem(id, cleanModel)
```

Without `toRaw`, `JSON.stringify` strips non-enumerable prototype getters on `Blob`/`File`/`ArrayBuffer` and writes an empty `{}` to IndexedDB. (Rosetta §16)

### Picker directory duality

- `stage-background-picker/` — stage-level configuration dialog
- `background-picker/` — scene-entry-level dialog (older)

Both exist. Choose the correct import path for the surface you are editing; do not assume one is a rename of the other.


### Authoritative Design & Architecture Documents

- [docs/design-scenes-and-backgrounds-system.md](docs/design-scenes-and-backgrounds-system.md) — Scenes and backgrounds system design.
- [docs/design-image-journal-storage.md](docs/design-image-journal-storage.md) — Image journal storage design.
- [docs/project-artistry-porting-report.md](docs/project-artistry-porting-report.md) — Artistry porting report.
- [docs/rosetta-stone.md](docs/rosetta-stone.md) — Canonical concept-to-path index; §16 toRaw/binary lesson.

## Verification

```bash
pnpm -F @proj-airi/stage-ui typecheck
pnpm -F @proj-airi/stage-pages typecheck
```

## Related Skills & References

- **Key Documents**: [[design-scenes-and-backgrounds-system]], [[design-image-journal-storage]], [[project-artistry-porting-report]], [[rosetta-stone]]
