---
name: airi-beat-sync-choreography
description: >-
  Implement/debug audio-reactive Beat Sync and AI Choreography: audio capture,
  BeatSyncVibeTracker, BeatSyncTempoEstimator, Live2D energy-modulated dancing,
  VRM energy-tier clip playback, FlowMDM AI choreography orchestration,
  per-character AiriExtension.beatSync persistence, and Control Strip / Chat
  Quick Settings UI. FlowMDM diffusion and VRMA compilation internals use
  airi-generative-motion-vrma; Control Strip layout uses airi-stage-ui-surfaces.
---

# Beat Sync & AI Choreography

Unified architecture for real-time audio-reactive dancing across Live2D and VRM avatars, combining lightweight DSP tempo/energy tracking with both curated `.vrma` dance clips and FlowMDM generative choreography.

## 1. Ownership & Boundaries

- **Owns**:
  - Audio beat/tempo/energy sensing (`@proj-airi/stage-shared/beat-sync`): Tempora `beat` ticks, `BeatSyncVibeTracker` (30s rolling p10/p90 dBFS normalization), `BeatSyncTempoEstimator` (6s onset autocorrelation + 120 BPM log-normal prior + octave folding), and eventa IPC (`listenBeatSyncVibeSignal`, `updateBeatSyncVibeParameters`).
  - Live2D beat-sync playback (`@proj-airi/stage-ui-live2d`): `punchy-v` (Bounce), `swing-lr` (Swing), `sway-sine` (Sway), user `strength`, and live `energy` modulation.
  - VRM dance orchestration: lightweight `Dance clips` (energy-tier `.vrma` selection + `bpm / 120` speed scaling) and `AI choreography` (FlowMDM phrase scheduling, persona selection/cycling, live BPM bar cadence).
  - Per-character Beat Sync configuration under `AiriExtension.beatSync` + global audio source in `useSettingsBeatSync`.
  - Beat Sync performance surfaces: Control Strip `actor-beat-sync` / `BeatSyncPopover.vue` and Chat Quick Settings capability toggle.
- **Does NOT own**:
  - FlowMDM diffusion weights, HumanML3D bone calibration, or `.vrma` binary compilation — see `airi-generative-motion-vrma`.
  - Control Strip shell positioning, notch hit-testing, or button catalog layout rules — see `airi-stage-ui-surfaces`.

---

## 2. Authoritative Source Map

### Phase 1 (Implemented)
- **Shared Sensor & DSP (`packages/stage-shared/src/beat-sync/`)**:
  - `settings.ts`: Shared constants (`BEAT_SYNC_TEMPO_BASE_BPM = 120`, `BEAT_SYNC_VRM_DANCE_SPEED_MIN = 0.5`, `BEAT_SYNC_VRM_DANCE_SPEED_MAX = 2.0`, energy gain & silence floor `-55 dBFS`).
  - `vibe.ts`: `BeatSyncVibeTracker`, `BeatSyncTempoEstimator`, `beatSyncEnergyTierFromNormalized`, `computeBeatSyncVrmDanceSpeed`.
  - `vibe.test.ts`: Unit tests for rolling normalization, silence floor, and 120 BPM autocorrelation tracking.
  - `detector.ts`: Runs Tempora `beat` detector alongside 30 Hz `vibeInterval` emitting `vibe` (`BeatSyncVibe`).
  - `eventa.ts`, `types.ts`, `index.ts`: Typed eventa contracts (`beatSyncVibeSignalEventa`, `beatSyncUpdateVibeParametersInvokeEventa`) and `BeatSyncVibe` / `BeatSyncEnergyTier` types.
- **Desktop Audio Host (`apps/stage-tamagotchi/src/renderer/beat-sync.main.ts`)**:
  - Captures system/tab audio, forwards `detector.on('beat', ...)` and `detector.on('vibe', ...)` via `context`, and handles `beatSyncUpdateVibeParametersInvokeEventa`.
- **Live2D Energy-Modulated Dancing (`packages/stage-ui-live2d/`)**:
  - `src/composables/live2d/beat-sync.ts`: `createBeatSyncController` with `setStrength(0..1)`, `getStrength()`, and `setEnergy(0..1)`. Scale factor = `(0.25 + strength * 1.15) * (0.55 + energy * 0.75)`.
  - `src/components/scenes/live2d/Model.vue`: Subscribes to `listenBeatSyncVibeSignal` on mount and calls `beatSync.setEnergy(vibe.energy)`.

### Motion Choreography Engine (`packages/motion-choreography/src/`)
- `synthesizer.ts`: Real-time FlowMDM choreography synthesis & persona presets (`Pure Beat`, `Idol`, `Gothic Maid`, `Cool Android`).
- `conductor/phrase-scheduler.ts`: Musical phrase bar scheduling (`barsPerPhrase`, auto vs fixed bar cadence) and lookahead buffer preparation.
- `dsp/`: Beat/bar phase alignment helpers.

### Phase 2 & 3 (Implemented)
- **Per-Character Schema & VRM/Live2D Bridges**:
  - `packages/stage-ui/src/types/card.schema.ts` & `packages/stage-ui/src/stores/modules/airi-card.ts`: `AiriBeatSyncSchema` / `AiriExtension.beatSync`.
  - `packages/stage-shared/src/beat-sync/vrm-clips.ts`: `beatSyncEnergyTierFromNormalized`, `computeBeatSyncVrmDanceSpeed`, `selectBeatSyncVrmClipForEnergy`.
  - `packages/stage-ui-three/src/stores/model-store.ts`, `VRMModel.vue`, `ThreeScene.vue`: `TriggerMotionOptions.timeScale` and `setMotionTimeScale` / `onMotionTimeScale`.
  - `packages/stage-ui-live2d/src/stores/live2d.ts` & `Model.vue`: `setBeatSyncConfig` / `onBeatSyncConfig` (`style`, `strength`).
  - `packages/stage-ui/src/stores/modules/beat-sync-choreography.ts`: `useBeatSyncChoreographyStore` unified coordinator.
- **Control Strip & Chat Quick Settings UI**:
  - `packages/stage-ui/src/components/scenarios/layout/popovers/BeatSyncPopover.vue`: Dedicated 3-state Control Strip popover (`Live2D` / `VRM · Dance clips` / `VRM · AI choreography` / `Unsupported`).
  - `packages/stage-ui/src/components/scenarios/layout/popovers/registry.ts`, `ControlStrip.vue`, `control-customizer.ts`, `control-strip-labels.ts`, `stores/settings/control-strip.ts`: `actor-beat-sync` registration.
  - `packages/stage-layouts/src/components/Layouts/ChatOptions/ChatOptionsCapabilitiesView.vue`: Quick Settings Beat Sync toggle + live BPM pill.

---

## 3. Load-Bearing Invariants & Pitfalls

1. **Preserve Tempora alongside Vibe/Tempo**: Never remove Tempora's `beat` tick emission or `getInputByteFrequencyData()` from `detector.ts`; `beat-sync.vue` settings visualizer and Live2D `beatSync.beat(...)` depend on them.
2. **Tempo vs. Energy Separation**: Tempo (`bpm`) drives playback speed (`clamp(bpm / 120, 0.5, 2.0)`), while rolling normalized `energy` (`0..1`, `calm` / `medium` / `intense`) drives motion amplitude (Live2D) or tier selection (VRM clips). Fast quiet songs and slow loud songs must not conflate these signals.
3. **No raw `BroadcastChannel` in Control Strip popovers**: `ControlStrip.contract.test.ts` forbids opening `new BroadcastChannel(...)` directly inside Control Strip `.vue` popover files. Route cross-window state through Pinia stores/composables or the stage shell.
4. **Do NOT bump `BUTTONS_CATALOG_VERSION`**: When registering `actor-beat-sync` in `packages/stage-ui/src/stores/settings/control-strip.ts`, rely on keyed merge — bumping `BUTTONS_CATALOG_VERSION` wipes users' customized Control Strip layouts.
5. **Per-character persistence under `AiriExtension`**: Machine-level `audioSourceId` belongs in `useSettingsBeatSync`, whereas `live2d` (`style`, `strength`) and `vrm` (`mode`, `persona`, `cyclePersonas`, `barsPerPhrase`) belong in `extensions.airi.beatSync` so VRM and Live2D cards keep independent dance strategies.

---

## 4. Verification

- Sensor unit tests:
  ```bash
  pnpm exec vitest run packages/stage-shared/src/beat-sync/vibe.test.ts
  ```
- Affected workspace typechecks:
  ```bash
  pnpm -F @proj-airi/stage-shared typecheck
  pnpm -F @proj-airi/stage-ui-live2d typecheck
  pnpm -F @proj-airi/stage-ui typecheck
  pnpm -F @proj-airi/stage-tamagotchi typecheck
  ```
