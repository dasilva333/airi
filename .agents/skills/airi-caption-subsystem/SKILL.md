---
name: airi-caption-subsystem
description: >-
  Use when working with AIRI captions/subtitles across all render surfaces: the standalone Electron caption window (main/windows/caption + renderer/pages/caption.vue), the DatingSim inline caption panel, the head-tethered comic-bubble plank (Live2D-only so far), the dormant Stage-Mate bubble bridge, and the shared BroadcastChannel ('airi-caption-overlay') segment/isActive streaming protocol. Also covers CaptionPanel segment highlighting, Live2D baked-in motion Text captions (hit zones → motion captions), the useSpeechCaptionPlayer Sentence-Sync TTS player, caption settings (stores/settings/captions.ts), and the control-strip/customizer captions-layout group (docking, follow-stage position/visibility, theme, opacity, layout mode, head-tether toggle). Consistently distinguishes desktop-only windowed features from shared in-scene behavior.
---

# AIRI Caption & Subtitle Subsystem

Captions are a single **publisher/ subscriber BroadcastChannel protocol** (`airi-caption-overlay`) feeding up to four conceptually distinct render surfaces. Know which surface you're touching before editing — windowed features only exist on desktop Electron; the in-scene plank and dating-sim panel are renderer-agnostic.

```
                    Speech STT / LLM / TTS / motion Text
                                 │
                                 ▼
              [ BroadcastChannel: 'airi-caption-overlay' ]
               caption-speaker { text }          → actor-side bubble label ("User")
               caption-assistant { segments[] }  → segments w/ isActive flag
                                 │
     ┌───────────────┬───────────┴──────────┬───────────────────┐
     ▼               ▼                      ▼                   ▼
 1. Standalone     2. Dating-Sim        3. Head-Tethered     4. Stage-Mate
    Caption Window    Inline Caption       Plank (in-scene)      Bubble (future,
    (Electron-only)   (DatingSimOverlay)   (Live2D-only MVP)     dormant)
```

---

## 1. The Four Render Surfaces

### 1.1 Standalone caption window (desktop Electron only)
- **Main**: `apps/stage-tamagotchi/src/main/windows/caption/index.ts` (~785 lines) — frameless transparent BrowserWindow; owns **follow-stage position/visibility** (the main process is the single owner), display-matrix hashing, bounds clamping, initial-bounds resolution-breakpoint sizing. Emits `caption-window-state` (`isOpen: boolean`) to the main window's webContents on show/hide (:590, :599, :632).
- **Page**: `apps/stage-tamagotchi/src/renderer/pages/caption.vue` (~226 lines) — renders `CaptionPanel`; wires caption-window drag handle + hide button (`toggleVisibility` via `electronCaptionToggleVisibility`), mirrors follow-stage toggles back into `settingsStore` via the `captionFollowStagePositionChanged` / `captionFollowStageVisibilityChanged` listens, and watches `settingsStore.captionLayoutMode` for single/multi reflow.
- **Toggle ownership** — renderer `apps/stage-tamagotchi/src/renderer/pages/index.vue`:
  - `watch(captionOpen, ...)` (~:155) drives `toggleCaptionVisibility(val)` **only** in independent mode; with `captionFollowStageVisibility` on it's a no-op because main already mirrors stage visibility.
  - `watch(stageEnabled, ...)` (~:134) mirrors strip toggle state without firing a separate IPC toggle when follow is on.
  - IPC echo listener `caption-window-state` (~:843) updates `controlStripStore.captionOpen` so strip UI never desyncs.
  - The `stageEnabled` watcher also handles the "caption is more than a stage toggle" desync retraction (~:170-176).
- **eventa contracts** (`apps/stage-tamagotchi/src/shared/eventa.ts`): `electronCaptionToggleVisibility` (:42), `electronCaptionSyncDocking` (:43, `'top'|'bottom'|undefined`), `electronCaptionSetFollowStagePosition` (:44), `electronCaptionSetFollowStageVisibility` (:45), `electronGetCaptionWindowState` (:288), plus the `captionFollowStagePositionChanged` / `captionFollowStageVisibilityChanged` reverse channels.

### 1.2 Dating-Sim inline caption panel
- `packages/stage-ui/src/components/scenes/DatingSimOverlay.vue` (~:430-460) — its own `CaptionPanel` instance gated on **both** the dating-sim story subtitle (`datingSimStore.currentSubtitle`) and live `airi-caption-overlay` streaming (checks `event.segments.some(s => s.isActive)` at ~:38) under `datingSimStore.settings.inlineCaption` (default `true`, dating-sim.ts:56).
- Watchers at DatingSimOverlay.vue:18-38 auto-hide the panel when streaming quiets (`hasActiveCaption` flips false on a segmentless or all-inactive payload).
- **Subtitles in dating-sim are LLM-generated** (turn prompts inject "subtitle" text, `packages/stage-ui/src/stores/dating-sim.ts:376`+) — distinct from the streaming-segment pipeline but both funnel into the same `CaptionPanel` look.

### 1.3 Head-tethered caption plank (in-scene; Live2D-only MVP)
- **Vue wrapper**: `packages/stage-ui/src/components/scenes/HeadTetheredCaption.vue` (~256 lines) — an invisible host whose lifetime drives the adapter; polls `live2dSceneRef.live2dApp()` every 250ms until the PIXI canvas is up, detaches/re-attaches on model/toggle changes, and **sub-chunks** long active segments (≤80 chars at clause boundaries) into a reading-pace ticker.
- **Live2D adapter**: `packages/stage-ui-live2d/src/composables/live2d/head-tethered-caption.ts` — builds the comic-bubble PIXI Graphics/Text, injects `BatchRenderer` into the live renderer when missing, reads Cubism pose params via `coreModel.getParameterValueById` (alias table for `ParamAngleX` / `PARAM_ANGLE_X` variants), and applies the fake-perspective transform.
- **Math**: `packages/stage-shared/src/utils/caption-perspective.ts` — `poseToCaptionTransform(...)` is the shared single-source for future Spine/VRM/MMD adapters. Current exports are consumed only by Live2D.
- **Mount**: `RendererStage.vue:504` — `<HeadTetheredCaption v-if="stageModelRenderer === 'live2d'" :live2d-scene-ref="live2dSceneRef" />`. The wrapper gets the *component instance*, not the resolved PIXI app; the adapter polls internally.
- **Status**: Live2D only. Spine/VRM/MMD have **no** tethered adapter yet; the design doc (`docs/head-tethered-captions-design.md` §3.1) pre-specifies Spine (PIXI child, bone-driven worldTransform), VRM, and MMD (three.js CSS3DSprite / canvas-sprite, head-bone quaternion). Nothing ports yet — leave `caption-perspective.ts` renderer-agnostic if you add an adapter, and read this doc before starting.

### 1.4 Stage-Mate bubble bridge (dormant)
- The Unity engine already has a markdown-rendered chat bubble: `apps/stage-mate/mate-engine/Assets/MATE ENGINE - Scripts/AvatarHandlers/AvatarBubbleHandler.cs` + `ThemeManager/AiBubble.mat` (dormant today; candidate for bridging head-tethered/data captions into the desktop div).
- **NEVER** edit `mate-engine/` directly (upstream-pinned clone); overlays go in `apps/stage-mate/unity-src/` and are synced via `engine:setup`.
- Bridging decision (port into three.js vs Unity bubble vs both) is still open — if asked to implement, propose first; the in-scene-side wrappers for VRM/MMD don't exist yet either.

---

## 2. BroadcastChannel Protocol (`airi-caption-overlay`)

Decoupled from chat state by design — any window/worker with speech tokens posts here; every surface subscribes dumbly (no chat-history queries).

```ts
// CaptionPanel.vue:26-30 (canonical segment shape)
interface CaptionSegment { text: string, color: string, actorId: string, isActive?: boolean }

type CaptionChannelEvent
  = | { type: 'caption-speaker', text: string } // actor-side bubble label, e.g. "User"
    | { type: 'caption-assistant', segments: CaptionSegment[] } // rolling dialog; exactly one isActive while TTS speaks
```

- **`isActive` = "currently spoken sentence"**. `CaptionPanel` filters `segments.filter(s => s.isActive)` for the highlight/larger type treatment (:92, :148-159); dating-sim displays if *any* segment is active; head-tether sub-chunks whichever segment is active.
- **Publishers** (what feeds the protocol):
  - `packages/stage-ui/src/composables/use-speech-caption-player.ts` (160 lines) — Sentence-Sync TTS player: splits text at `[.!?]`+space, posts one caption per sentence in lockstep with per-sentence audio playback; `showCaption` appends/activates the segment, `clearCaption` empties everything. Consumers: `ProducerChoiceBubble.vue:2` and `actor.vue:7,346`.
  - STT speaking pipeline: `apps/stage-tamagotchi/src/renderer/pages/index.vue:458-589` posts `caption-speaker` deltas plus caption events during live hearing/speech sessions.
  - Live2D baked-in motion captions: `packages/stage-ui-live2d/src/components/scenes/live2d/Model.vue:171` posts `caption-assistant` with the resolved motion `Text` (see §3.2).
  - LLM/TTS streaming highlight in chat: `packages/stage-ui/src/stores/chat.ts:187-193` listens for `caption-assistant` and mirrors `activeSpokenText`/`color` into the chat surface (reverse of a true publisher).
- **Subscribers**: `CaptionPanel.vue` (standalone window + dating-sim panel), `HeadTetheredCaption.vue` (:131), `DatingSimOverlay.vue` (:19), `ControlStripHost.vue` (:97, active-spoken highlight).

### 2.1 CaptionPanel (`packages/stage-ui/src/components/scenes/CaptionPanel.vue`, ~180 lines)
Shared presentation for windowed + dating-sim. Props: `showActiveSentenceOnly`, `fadeOnCursor`, `transparentBg`, `fallbackText`, `textSize`. Theme/opacity/layout come from `settingsStore` (see §4). Turn-reset listener clears both speaker + assistant segments on `airi-chat-stream` `session-updated` with `role: 'user'`.

---

## 3. Source-of-truth for Caption Text

### 3.1 TTS pipeline → Sentence Sync
The primary path: streaming-tts token deltas are chunked per sentence and pushed with `isActive` by whichever session owns the audio (see `useSpeechCaptionPlayer` for the reference implementation).

### 3.2 Live2D baked-in motion captions (`docs/live2d-caption-design.md`)
Captions come from **inline `Text` + `Language` fields on `model3.json` `FileReferences.Motions` entries** — NOT from `motion3.json` UserData or sidecar JSON. Pipeline in `packages/stage-ui-live2d/src/components/scenes/live2d/Model.vue`:
1. `:756-766` — after load, builds `availableMotions` straight from `motionManager.definitions` (the parsed `Motions` block), capturing `text`/`language`.
2. `:907-963` (approx.) — on motion fire, looks up `activeMotionDef`, **resolves English localization** (sibling entries sharing `File`+`Sound` with `Language: "en"` win), then posts `caption-assistant`; if settings disable captions this falls back to an OS/notification toast.
3. `captionOpen`/`captionEnabled` gating happens at the subscriber, not here — the channel always carries the event.
- **Hit zones**: model `hitAreas` (`internalModel.settings.hitAreas` at :739-740) + `model.on('hit', ...)` (:742-744) drive tap → motion (e.g. `'body'` → `motion('tap_body')`) which then routes through step 2. Hover hit-testing is separate (:1757-1763) and feeds the `hitAreaHover` emit, not captions.

---

## 4. Settings Store & Binding

`packages/stage-ui/src/stores/settings/captions.ts` — `useSettingsCaptions` (Pinia, localStorage-backed):
- Windowed: `showCaptions`, `fontSize` (100 = 100%), `opacity` (0-100 tier), `docking` (`'top' | 'bottom' | 'head' | 'none'`), `followStageVisibility`, `followStagePosition`, `layoutMode` (`'single' | 'multi'`), `resetTrigger`/`triggerReset()`.
- Head-tethered (in-scene, independent and may co-run with windowed): `headTetheredCaptionEnabled` (default false, Live2D-only MVP), `headTetheredCaptionOffset {x,y}` (default `{0,-15}`), `headTetheredCaptionFollowStrength` (default 100).
- Barrel: `packages/stage-ui/src/stores/settings/index.ts:116-129` exposes all of the above as flat refs (`showCaptions`, `captionDocking`, `captionLayoutMode`, `headTetheredCaptionEnabled` …) — `useSettings` consumers read them flat, never via a nested `captions` object.

> Note: docking has four states including `'head'`; the **window** cannot render tether math (Electron windows can't skew). The `'head'` docking mode + head-tethered plank are separate toggles: docking `'head'` moves the *rectangle* near the head; `headTetheredCaptionEnabled` renders the *in-scene* transformable plank. They can both be on.

---

## 5. Control Strip / Customizer Caption Controls

`packages/stage-ui/src/constants/control-customizer.ts` — group `captions-layout` (:182) holds every caption strip button. Associations per button:

| Button id | What it controls | Type | Default | Desktop-only |
| --- | --- | --- | --- | --- |
| `caption` | `controlStripStore.captionOpen` → `electronCaptionToggleVisibility` (standalone window) | toggle | on strip | YES |
| `head-tethered-caption` | `settingsStore.headTetheredCaptionEnabled` | toggle | off | NO (in-scene; appears in DEFAULT_MOBILE_BUTTONS) |
| `caption-docking` | cycles `captionDocking`: none → bottom → top → **head** | cycler | off | YES |
| `caption-sync-position` | `captionFollowStagePosition` | toggle | off | YES |
| `caption-sync-visibility` | `captionFollowStageVisibility` | toggle | off | YES |
| `caption-theme-mode` | dark → light → system (see §6 for current handler state) | cycler | off | NO (in-scene applicable) |
| `caption-opacity` | 0/20/50/80 opacity tier | cycler | off | YES |
| `caption-layout-mode` | `single` (active sentence) ↔ `multi` (dialog block) | cycler | off | YES |

Wiring: `use-control-strip-action.ts` handles `head-tethered-caption`, `caption-docking` (DOCK_CYCLE `['none','bottom','top','head']`, :105-111), `caption-sync-position`, `caption-sync-visibility`, `caption-layout-mode`, and `caption` (binds to `controlStripStore.captionOpen` via binding `captionOpen`); `ControlStrip.vue` maps icon/active-label/short-label states in `getButtonIcon` / `getActiveCaptionButtonIcon` / `getShortLabel` (:~1230-1360) and adds status-dot branches at :1519/1609.

---

## 6. Known Drift / Documentation Warnings

- `docs/captions-widget-system.md` spec mentions **`captionThemeMode`** (`light|dark|system`) with a caption-background-theme cycler — no corresponding field exists in `stores/settings/captions.ts` and no `caption-theme-mode` case in either `use-control-strip-action.ts` or `ControlStrip.vue` handlers (only icon/label branches, :1233/:1359). If you're asked to implement this, it's a real gap, not a rename.
- `docs/head-tethered-captions-design.md` pre-specifies Spine/VRM/MMD tethered adapters that **do not exist yet**; treat its platform table as plan-of-record, not inventory.
- Some older skills/docs still name the caption settings `settingsStore.captionFollowStage…` nested fields; flattened barrel refs in `settings/index.ts` are current.

---

## 7. Development & Verification Rules

1. **Never double-toggle the caption window from the renderer.** With `captionFollowStageVisibility` on, main owns the lockstep show/hide (see §1.1 toggle-ownership). Renderer mirrors strip state only.
2. **Follow-stage position is main-owned too.** Any reposition logic belongs in `main/windows/caption/index.ts`, not in renderer drag handlers.
3. **Add a new caption surface** by subscribing dumbly to `airi-caption-overlay`; never reach into chat/session stores. Filter on `isActive` for the spoken line, persist speaker/labels from `caption-speaker`.
4. **In-scene (tether) captions must stay renderer-package-local** — the adapter lives in the model runtime's package (`stage-ui-live2d`), not in `stage-ui`, so Spine/VRM/MMD each own their adapter when built; shared math goes in `@proj-airi/stage-shared/utils/caption-perspective`.
5. **WebPreferences**: the caption window is frameless + transparent (`backgroundColor: '#00000000'`); keep contrast with backdrop-blur + theme-aware capsule styling in `CaptionPanel`.
6. Typecheck: `pnpm -F @proj-airi/stage-ui typecheck` for panel/plank/settings; `pnpm -F @proj-airi/stage-tamagotchi typecheck` for window manager/eventa/page changes; `pnpm -F @proj-airi/stage-ui-live2d typecheck` for the adapter.

---

## 8. File Index

### Component layer
- `packages/stage-ui/src/components/scenes/CaptionPanel.vue` — shared segment typography + isActive highlight.
- `packages/stage-ui/src/components/scenes/HeadTetheredCaption.vue` — in-scene plank Vue host (sub-chunk ticker + attach polling).
- `packages/stage-ui/src/components/scenes/RendererStage.vue:504` — tether mount.
- `packages/stage-ui/src/components/scenes/DatingSimOverlay.vue:~430` — dating-sim caption panel.
- `apps/stage-tamagotchi/src/renderer/pages/caption.vue` — standalone window page.
- `packages/stage-ui-live2d/src/composables/live2d/head-tethered-caption.ts` — Live2D adapter (PIXI mount, BatchRenderer injection, pose→transform).
- `packages/stage-shared/src/utils/caption-perspective.ts` — renderer-agnostic pose→2D-transform math.

### Stores / data
- `packages/stage-ui/src/stores/settings/captions.ts` — caption settings store.
- `packages/stage-ui/src/stores/settings/index.ts:116-129` — flattened barrel refs.
- `packages/stage-ui/src/stores/chat.ts:187-193` — reverse sync of spoken-highlight into chat.
- `packages/stage-ui/src/stores/dating-sim.ts` (`currentSubtitle` :66, `settings.inlineCaption` :56).

### Desktop window plumbing
- `apps/stage-tamagotchi/src/main/windows/caption/index.ts` — window lifecycle, follow-stage owner, `caption-window-state` emitter.
- `apps/stage-tamagotchi/src/main/windows/main/rpc/index.electron.ts` — caption toggle applies.
- `apps/stage-tamagotchi/src/renderer/pages/index.vue` (~:110-180, :458-589, :843) — strip toggle mirroring, STT caption publishing, IPC echo.
- `apps/stage-tamagotchi/src/shared/eventa.ts` (:42-45, :288) — caption eventa contracts.
- `packages/stage-ui/src/composables/use-speech-caption-player.ts` — Sentence-Sync TTS caption poster.

### Stage-Mate dormant surface
- `apps/stage-mate/mate-engine/Assets/MATE ENGINE - Scripts/AvatarHandlers/AvatarBubbleHandler.cs` — existing Unity bubble, dormant bridge.

---

## 9. Authoritative Design & Architecture Documents

- [docs/captions-widget-system.md](docs/captions-widget-system.md) — Canonical widget/window + Sentence-Sync system spec (may predate current store names; see §6).
- [docs/head-tethered-captions-design.md](docs/head-tethered-captions-design.md) — Head-tethered plank design and cross-model roadmap.
- [docs/live2d-caption-design.md](docs/live2d-caption-design.md) — Baked-in motion Text/Language pipeline (canonical).
- [docs/catalog-control-strip.md](docs/catalog-control-strip.md) — Catalog of caption strip buttons.
- [docs/rosetta-stone.md](docs/rosetta-stone.md) — §13 BroadcastChannel registry.
