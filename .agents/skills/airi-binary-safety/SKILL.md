---
name: airi-binary-safety
description: >-
  Prevent/debug File/Blob/ArrayBuffer corruption during Vue reactive-proxy serialization and IndexedDB/localforage writes. Covers toRaw, empty persisted models, lightweight asset catalogs, eager deep watchers. General repository design uses airi-data-persistence.
---

Binary payloads die silently. Vue 3 reactive proxies plus `JSON.stringify()` will strip `File`/`Blob`/`ArrayBuffer` contents and persist an empty `{}`. Never cite `crates/` (legacy Tauri; current desktop is Electron `apps/stage-tamagotchi/`). Authoritative lessons live in Rosetta Stone §16.

## Key Files/Locations

- `packages/stage-ui/src/database/storage.ts` — the localforage-backed persistence surface.
- `packages/stage-ui/src/stores/display-models.ts` — the display-model store (`displayModels` catalog, `getDisplayModel(id)`, mapping updates).
- `docs/rosetta-stone.md` §16 (Lessons Learned → Model Persistence & IndexedDB Serialization) — the canonical failure-mode reference.

## When to Use

- Persisting a model or any object that carries a `File`, `Blob`, or `ArrayBuffer`.
- Writing to localforage/IndexedDB via `storage.ts`.
- Editing the display-models catalog or model mapping persistence.
- Adding watchers on store data inside UI wrapper components (e.g. `mmd.vue`, `live2d.vue`, `vrm-expressions.vue`).

## Common Pitfalls

- **`JSON.stringify()` strips prototype getters.** On native Web binary objects (`File`, `Blob`, `ArrayBuffer`) it returns `{}` and destroys the payload on disk. The fix: un-proxy before persisting — `toRaw(model)` and `toRaw(model.file)` — then `localforage.setItem(id, cleanModel)`.
- **Eager `{ deep: true }` watchers on store data.** Attaching deep watchers to store data inside UI wrappers fires immediately on mount (model selection / navigation). Delegate storage to explicit store methods triggered by user events or debounced handlers instead.
- **Heavy catalogs hold live binaries.** Catalog items in `displayModels.value` must carry lightweight metadata only (name, format, tags, groups, previewImage) with `file: undefined` to avoid multi-megabyte memory bloat. Load full binary payloads on demand via `displayModelsStore.getDisplayModel(id)`.
- **Scattered mapping write paths.** Persist model mappings (`emotionMappings`, `motionMappings`, `hiddenExpressions`, `hiddenMotions`, `favoriteExpressions`) directly on `DisplayModelFile` (1:1 with the model object) through a single store action (`displayModelsStore.updateDisplayModelMappings()`), not duplicate write paths.


### Authoritative Design & Architecture Documents

- [docs/rosetta-stone.md](docs/rosetta-stone.md) — Canonical failure-mode index; §16 Model Persistence & IndexedDB Serialization (binary-proxy lesson).
- [docs/arch-indexeddb-storage.md](docs/arch-indexeddb-storage.md) — IndexedDB storage architecture.

## Verification

- Confirm no `JSON.stringify()` runs on objects containing binary references before persistence.
- Confirm `toRaw` is applied to both the model and `model.file` ahead of `localforage.setItem`.
- Confirm catalog entries use `file: undefined` and full binaries come only from `getDisplayModel(id)`.
- Confirm no new eager deep watcher was added in a UI wrapper — persistence flows through explicit store methods.
- Logic changes to `.ts`/Pinia stores: run `pnpm -F <workspace> typecheck` for the affected workspace (per `AGENTS.md`), then run `git status` and report open/unstaged files.

## Related Skills & References

- **Key Documents**: [[rosetta-stone]], [[arch-indexeddb-storage]], [[AGENTS]]
