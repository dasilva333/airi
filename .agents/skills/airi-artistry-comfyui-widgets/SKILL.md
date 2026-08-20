---
name: airi-artistry-comfyui-widgets
description: >-
  Use when working with AIRI image-generation widgets, the ComfyUI bridge, the image_journal built-in tool, widget spawn modes (spawn/update/remove/clear/open and bg/inline/bg_widget routing), multi-backend art providers (comfyui/replicate/nanobanana), and the autonomous artistry director-note grading loop. Covers apps/stage-tamagotchi/src/renderer/stores/tools/builtin/widgets.ts and image-journal.ts, apps/stage-tamagotchi/src/main/services/airi/widgets/ (artistry-bridge.ts, index.ts, providers/), and packages/stage-ui/src/stores/modules/artistry.ts plus artistry-autonomous.ts. Triggers on adding a widget, wiring a new art backend, debugging headless generation, or touching director-note broadcast sync.
---

# AirI Artistry / ComfyUI Widgets

## Surface Map

- **Renderer built-in tools (LLM-callable):**
  - `apps/stage-tamagotchi/src/renderer/stores/tools/builtin/widgets.ts` (215 lines) — defines the `stage_widgets` tool (`zod` schema at lines 81-88) with actions `spawn | update | remove | clear | open`. `executeWidgetAction(...)` at line 138 is the action switch; `spawn` defaults `comfy`/`artistry` components to `status: 'generating'` (line 148-150) and injects `_artistryConfig` from the store (line 152).
  - `apps/stage-tamagotchi/src/renderer/stores/tools/builtin/image-journal.ts` (225 lines) — defines the `image_journal` tool (`zod` schema at lines 32-38) with actions `create` and `apply` (also accepts legacy `set_as_background` at line 211). `executeCreateImageJournalEntry(...)` at line 40; display-mode routing `inline | widget | bg | bg_widget` at lines 61-128; `apply` path at lines 157-198.
- **Main-process widget services (Electron main):**
  - `apps/stage-tamagotchi/src/main/services/airi/widgets/index.ts` (115 lines) — `createWidgetsService(...)` registers `widgetsAdd/Update/Remove/Clear/OpenWindow/PrepareWindow/Fetch/HideWindow` plus `artistryGenerateHeadless` and `artistryComfyHealthCheck` handlers (lines 28-114).
  - `apps/stage-tamagotchi/src/main/services/airi/widgets/artistry-bridge.ts` (381 lines) — `generateHeadless(...)` at line 64; provider registry (`comfyui`, `replicate`, `nanobanana`) at lines 52-55; headless dedup + concurrency cap (one job at a time, `MAX_CONCURRENT_HEADLESS = 1`, lines 60-62); widget spawn/update interceptor that auto-runs generation when a `comfy`/`artistry` widget lands (`setupArtistryBridge`, lines 348-380); `handleArtistryTrigger` at line 211.
- **Art providers directory:** `apps/stage-tamagotchi/src/main/services/airi/widgets/providers/`
  - `base.ts` — `ArtistryProvider` / `ArtistryRequest` types (imported at `artistry-bridge.ts:2`).
  - `comfyui.ts`, `nanobanana.ts`, `replicate.ts` — provider implementations registered in `artistry-bridge.ts:9-11,52-55`. **Deep ComfyUI protocol details (workflow upload/annotation rules, `{{PROMPT}}`/`{{IMAGE}}` placeholder contract, endpoint surface, exposed-fields security boundary) live in peer skill `airi-comfyui-provider-bridge`.**
  - `workflows/` — workflow JSON (currently `txt2img-default.json`).

## Store Map (Pinia)

- `useArtistryStore` (`packages/stage-ui/src/stores/modules/artistry.ts:12`, ~163 lines) — every field is a `useLocalStorageManualReset` ref. Owns `activeProvider` (default `'comfyui'`), `activeModel`, `defaultPromptPrefix`, `providerOptions`, plus provider-specific blocks: ComfyUI (`comfyuiServerUrl`, `comfyuiSavedWorkflows`, `comfyuiActiveWorkflow`), Replicate (`replicateApiKey`, `replicateDefaultModel`, `replicateAspectRatio`, `replicateInferenceSteps`), and NanoBanana (`nanobananaApiKey`, `nanobananaModel`, `nanobananaResolution`). Also exports `ComfyUIWorkflowTemplate` (line 5), `ArtistryStoreSnapshot` (139), `ResolvedArtistryConfig` (141), and `resolveArtistryConfigFromStore(...)` (153). The `configured` computed (78-95) only requires each provider's own credentials.
- `useAutonomousArtistryStore` (`packages/stage-ui/src/stores/modules/artistry-autonomous.ts:26`, 1160 lines) — the "autonomous artistry" loop. Owns `isProcessing`, `directorNotes`, `runArtistTask(...)` (line 436), `activateConcept(...)` (line 1007), `applyCurrentStackManifestations(...)`, `resolveSpeechConfigForActor(...)`, `resolveConceptStack`/`foldConceptStack`, and the two cross-window `BroadcastChannel` hooks (see Pitfalls). Persisted director notes go through `directorNotesRepo` (line 13).

## Key Code Paths

- **Tool → renderer executor:** `stage_widgets` → `executeWidgetAction()` in `builtin/widgets.ts:138`; `image_journal` → `executeImageJournalAction()` in `builtin/image-journal.ts:200`.
- **Renderer → main IPC (eventa):** `defineInvoke`/`defineInvokeEventa` calls use contracts from `apps/stage-tamagotchi/src/shared/eventa.ts` (imported as `widgetsAdd`, `widgetsClear`, `widgetsOpenWindow`, `widgetsPrepareWindow`, `widgetsRemove`, `widgetsUpdate` in `builtin/widgets.ts:9`; `artistryGenerateHeadless`, `widgetsAdd` in `builtin/image-journal.ts:16`). Main handlers are in `apps/stage-tamagotchi/src/main/services/airi/widgets/index.ts`.
- **Headless generation dispatcher:** `apps/stage-tamagotchi/src/main/services/airi/widgets/artistry-bridge.ts:64` (`generateHeadless`) — request fingerprint dedup (lines 71-88), provider init (lines 103-107), poll-vs-callback (`setJobCallback`) branching (lines 131-190).
- **Autonomous loop entry:** `packages/stage-ui/src/stores/modules/artistry-autonomous.ts:436` (`runArtistTask`) — composes the Director system prompt, parses JSON + fencing, resolves concept stack (`resolveConceptStack` line 152, `foldConceptStack` line 192), then routes by `spawnMode` (lines 840-945) into `bg | inline | widget | bg_widget` — **Dating Sim override applies first**: if `datingSimStore.enabled && settings.sceneryRoute !== 'inherit'`, the resolved scenery route wins over the card's `artistry.spawnMode` (lines 835-838); default `'bg_widget'`.
- **ComfyUI web fallback (no Electron):** `generateComfyUIWeb(...)` at `artistry-autonomous.ts:294` — talks straight to `${comfyuiServerUrl}/prompt`, injects the `prompt` into the first exposed text field (lines 317-323), randomizes seed (line 337-339), polls `/history/<id>` and fetches the image (lines 354-381).
- **Cross-window broadcast constants:** canonical registry in `docs/rosetta-stone.md` §13. Relevant channels: `airi:director-notes-sync` (publisher in `artistry-autonomous.ts:58`) and `airi:artistry-processing-state` (`artistry-autonomous.ts:40`).

## Core SOPs

### 1) Add a new art provider (e.g. FooAI)
1. Create `apps/stage-tamagotchi/src/main/services/airi/widgets/providers/fooai.ts` implementing `ArtistryProvider` from `providers/base.ts` (look at `comfyui.ts` / `replicate.ts` first — callback-based providers implement `setJobCallback(runId, cb)`; the rest poll `getStatus(jobId)`).
2. Register it in `artistry-bridge.ts` next to `artistryProviders.set('comfyui'|...)`: `artistryProviders.set('fooai', new FooAIProvider())` (lines 52-55).
3. Add provider settings to `useArtistryStore` (`packages/stage-ui/src/stores/modules/artistry.ts`) as new `useLocalStorageManualReset` refs, include them in `resetState` (lines 61-76) and in `artistryGlobals` (97-108), and extend `configured` (78-95).
4. No renderer tool change is needed unless you want it routable via `stage_widgets` — `_artistryConfig` is already injected from the store (`builtin/widgets.ts:113-136`).

### 2) Add a widget spawn / update via the `stage_widgets` tool
- Call `executeWidgetAction` (or let the LLM call the `stage_widgets` tool) with `action: 'spawn' | 'update' | 'remove' | 'clear' | 'open'`, `id`, `componentName`, `componentProps` (JSON string), `size` (`'s'|'m'|'l'`), and `ttlSeconds` (`spawn` only — `0` = immortal). Full switch lives at `builtin/widgets.ts:142-203`.
- For `comfy`/`artistry` components, omitting `status` auto-sets `status: 'generating'` (line 148-150) and the main-process interceptor (`artistry-bridge.ts:244-345`) will trigger a generation run. Pass `status: 'done'` plus an `imageUrl` if you only want to render an existing image.

### 3) Persist / apply a generated image (`image_journal` tool)
- `image_journal` with `action: 'create'` requires `prompt` (throws if blank at `builtin/image-journal.ts:41-42`). `title` is optional. `mode` defaults to the active card's `extensions.airi.artistry.spawnMode`, finally `inline` (line 61-62).
- `mode='bg'` or `'bg_widget'` writes `extensions.airi.modules.activeBackgroundId = entryId` on the card (lines 92-107). `mode='widget'` or `'bg_widget'` calls `widgetsAdd` with `componentName: 'artistry'` and `_skipIngestion: true` (lines 109-128).
- Every successful `create` stages an "artistry intrusion" via `stageArtistryIntrusion({ prompt, timestamp })` (lines 130-139) so later chat turns can reference it.
- `action: 'apply'` searches current-card journal entries by id or title (`builtin/image-journal.ts:157-198`) — it only writes `activeBackgroundId`, it does not spawn a widget.

### 4) Update the ComfyUI workflow list / server URL
- `useArtistryStore` owns `comfyuiServerUrl`, `comfyuiSavedWorkflows` (`ComfyUIWorkflowTemplate[]`), and `comfyuiActiveWorkflow` (`packages/stage-ui/src/stores/modules/artistry.ts:22-33`). Mutate those refs or call `resetState()` (line 61).

## Known Pitfalls

- **ALL widget↔renderer events cross process/window boundaries.** Widgets spawn in a separate Electron window; renderer tools (`builtin/widgets.ts`, `builtin/image-journal.ts`) call eventa invokers over `getIpcRenderer()`. Main-process handlers then mutate `WidgetsWindowManager`. Match the **exact** `airi:*` `BroadcastChannel` or eventa contract name — see `docs/rosetta-stone.md` §1 (eventa/IPC wiring) and §13 (BroadcastChannel registry). Don't re-list every channel here and don't invent new contract names.
- **The autonomous artistry loop broadcasts `airi:director-notes-sync` after writing a DirectorNote, so other windows update.** `recordDirectorDecision()` in `artistry-autonomous.ts:96-104` first writes through `directorNotesRepo` and then `broadcastDirectorEvent({ type: 'director-note-added', ... })`. If you add a new director-note mutation (archive, update, refresh), follow the same repo-write-then-broadcast pattern (see `updateDirectorDecision` at line 106 and `archiveSessionNotes` at line 123); otherwise other windows will hold stale notes.
- **`airi:artistry-processing-state` is a separate `BroadcastChannel`** (`artistry-autonomous.ts:40`) used only to mirror `isProcessing` across windows. Don't mix its payload with director-note events.
- **Headless generation is serialized in main.** `MAX_CONCURRENT_HEADLESS = 1` (`artistry-bridge.ts:60-62`); simultaneous triggers return `{ error: 'Concurrency cap reached...' }` (line 90-93). Callers should surface that error, not treat it as a crash.
- **`generateHeadless` dedupes by JSON fingerprint** of `{ prompt, model, provider, options, globals }` (`artistry-bridge.ts:71-88`), hashing only the **first 1024 chars** of `globals.image` (sha256, line 79-81) to avoid megabyte keys. Two identical in-flight calls share one promise — but the dedup map is cleared in `finally` (line 205), so dedup only applies while the job is running.
- **Widget auto-generate triggers on `status: 'generating'`** (`artistry-bridge.ts:244`). If you only want to render an already-generated image, pass `status: 'done'` plus `imageUrl`; do not omit `status` from a `comfy`/`artistry` `update`, or `executeWidgetAction` will auto-set `status: 'generating'` (`builtin/widgets.ts:169-176`) and kick off a new run. Note the update path also fires on the `looksLikeArtistryGeneration` heuristic (props carry `prompt` / `remixId` / `payload.prompt` / `payload.remixId`), not just component name.
- **Artistry widget spawns are "Living Wall": `setupArtistryBridge`'s `pushWidget` wrapper forces `ttlMs = 0`** for `comfy`/`artistry` components (`artistry-bridge.ts:364-368`). Any `ttlSeconds` passed via `stage_widgets` `spawn` for these components is silently overridden — they never auto-close.
- **Trigger dedup + fallbacks in `handleArtistryTrigger`** (`artistry-bridge.ts:211-346`): re-trigger guard = per-widget `lastTriggerMap` keyed `${mode}:${remixId}:${prompt}` (:242-248); `providerId === 'none'` skips generation entirely (:234); a magic fallback `remixId: '48250602'` kicks in when `status: 'generating'` arrives with no prompt (:239); and when `_artistryConfig` is missing from props the bridge falls back to a main-process-side `cachedArtistryConfig` from the last widget update that carried one (:209, :226-230).
- **Default provider mismatch**: `generateHeadless` falls back to `'replicate'` when `provider` is absent (`artistry-bridge.ts:96`), even though `useArtistryStore.activeProvider` defaults to `'comfyui'`. Callers omitting `provider` get Replicate, not the store default.
- **`stage_widgets` Globals are incomplete**: `getArtistryConfig()` in `builtin/widgets.ts:121-129` builds `Globals` with ComfyUI + Replicate keys only — **NanoBanana credentials are omitted**, so nanobanana generations spawned via the widget tool path fail auth. The `image_journal` (`resolveArtistryConfigFromStore`) and autonomous paths include all three providers' keys.
- **The same widget can be re-triggered before the previous run settles.** `handleArtistryTrigger` guards with `activeRunMap` (`artistry-bridge.ts:29-34,280-290`) so only the newest run updates the widget. Long-running callbacks must check `activeRunMap.get(id) === runId` before writing state.
- **Artistry config resolution order differs per entry point:** `image_journal` prefers card-over-store (`builtin/image-journal.ts:49-56`), `stage_widgets` reads the store global (`builtin/widgets.ts:113-136`), and the autonomous loop folds card/module overrides via `foldConceptStack` (`artistry-autonomous.ts:192-289`). If you change a default, check all three paths.


### Authoritative Design & Architecture Documents

- [docs/content/en/docs/advanced/architecture/design-comfyui-image-generation-widget.md](docs/content/en/docs/advanced/architecture/design-comfyui-image-generation-widget.md) — ComfyUI image generation widget design.
- [docs/content/en/docs/advanced/architecture/arch-comfyui-native-api-engine.md](docs/content/en/docs/advanced/architecture/arch-comfyui-native-api-engine.md) — ComfyUI native API engine architecture.
- [docs/content/en/docs/advanced/architecture/design-flux-grid-slice-image-generation.md](docs/content/en/docs/advanced/architecture/design-flux-grid-slice-image-generation.md) — Flux grid slice image generation design.
- [docs/artistry-porting-report.md](docs/artistry-porting-report.md) — Artistry porting report.
- [docs/ideogram-4-schema.md](docs/ideogram-4-schema.md) — Ideogram 4 schema.
- [docs/project-widget-system-status-report.md](docs/project-widget-system-status-report.md) — Widget system status report.
- [docs/content/en/docs/showcase/09-artistry.md](docs/content/en/docs/showcase/09-artistry.md) — Artistry showcase.
- [docs/rosetta-stone.md](docs/rosetta-stone.md) — Canonical concept-to-path index; §1 eventa/IPC wiring, §13 BroadcastChannel registry.

## Verification

- Renderer tool / built-in store changes (`builtin/widgets.ts`, `builtin/image-journal.ts`, renderer composables): `pnpm -F @proj-airi/stage-tamagotchi typecheck` (runs `tsc --noEmit -p tsconfig.node.json` then `vue-tsc --noEmit -p tsconfig.web.json`).
- Main-process widget-services changes (`main/services/airi/widgets/**`): same `pnpm -F @proj-airi/stage-tamagotchi typecheck`. A full desktop build (`pnpm -F @proj-airi/stage-tamagotchi build`) typechecks and rebuilds the Electron bundle when the change touches main-process service wiring.
- Stage-UI store changes (`packages/stage-ui/src/stores/modules/artistry.ts`, `artistry-autonomous.ts`): `pnpm -F @proj-airi/stage-ui typecheck`.
- UI-only class/copy tweaks normally need no script; run the above whenever you changed TS logic, a store, an import, an eventa contract, or a `zod` tool schema.
