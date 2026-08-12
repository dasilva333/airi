---
name: airi-dating-sim-engine
description: >-
  Use when working with the Dating Sim game engine, storyline presets, overlay UI (choices/subtitles/HUD), mood/intimacy state machine, Amagami-inspired mechanics, Amagami-style turn loops, per-card scenery routing, or the ephemeral dating-sim Pinia store. Key technologies: Vue 3, Pinia, localForage-backed persistence, BroadcastChannel ('dating-sim-sync'). File paths: packages/stage-ui/src/stores/dating-sim.ts, packages/stage-ui/src/components/scenes/DatingSimOverlay.vue, packages/stage-ui/src/components/scenes/StorySelectorModal.vue, packages/stage-ui/src/constants/dating-sim/storylines.ts.
---

# Dating Sim Engine

Amagami-inspired game layer on top of the Actor Stage. Intimacy/tension/action points, branching `Choice`s, preset storylines, and mood-driven character reactions. Activated / deactivated per session via `toggleDatingSim()`.

## Surface Map

- **Overlay UI (choices / subtitles / HUD)**: `packages/stage-ui/src/components/scenes/DatingSimOverlay.vue`
- **Preset picker (storyline selection)**: `packages/stage-ui/src/components/scenes/StorySelectorModal.vue`
- **Stage integration (motion / expression triggers)**: `packages/stage-ui/src/components/scenes/RendererStage.vue`
- **Settings page**: `packages/stage-pages/src/pages/settings/dating-sim.vue`

## Store Map

- **`useDatingSimStore`** — `packages/stage-ui/src/stores/dating-sim.ts:L23` (`'dating-sim'`, ~851 lines)

### Core state atoms

```ts
const currentPhase = ref<'idle' | 'conversation' | 'map' | 'action'>('idle')
const variables = ref({
  Intimacy: 0,
  Tension: 50,
  ActionPoints: 5,
  TimeOfDay: 12,
  Timer: 0,
  positiveScore: 0,
  negativeScore: 0,
  turnsElapsed: 0,
})
```

- `GamePhase = 'idle' | 'conversation' | 'map' | 'action'`
- `MoodState = 'low' | 'normal' | 'high' | 'max'` (computed from `Intimacy` & `Tension` at `L39-48`)
- `Choice` interface at `L12`

### Settings (localStorage via `useLocalStorage`)

| Key | Default | Notes |
| :--- | :--- | :--- |
| `airi:producer:context-depth` | `6` | Producer / scenario context depth |
| `airi:dating-sim:game-mode` | `'goal_driven'` | `'open_ended'` \| `'goal_driven'` |
| `airi:dating-sim:show-choice-weights` | `false` | Show score impacts in UI |
| `airi:dating-sim:max-score` | `15` | Goal-driven win threshold |
| `airi:dating-sim:max-turns-temp` | `18` | Max turns per session (temp pending real save-system) |
| `airi:dating-sim:scenery-route` | `'inherit'` | `'background'` \| `'widget'` \| `'bg_widget'` \| `'inherit'` — routes overlay rendering |

### Cross-window sync

Raw `new BroadcastChannel('dating-sim-sync')` at `L627`. Registry canonical in Glossary §13 of the Rosetta Stone — do not introduce a new channel or normalize naming.

## Key Code Paths

| Path | Notes |
| :--- | :--- |
| `packages/stage-ui/src/stores/dating-sim.ts:L9` | `GamePhase` export |
| `packages/stage-ui/src/stores/dating-sim.ts:L12` | `Choice` interface export |
| `packages/stage-ui/src/stores/dating-sim.ts:L25` | `currentPhase` ref |
| `packages/stage-ui/src/stores/dating-sim.ts:L28-37` | Amagami variables (`Intimacy`, `Tension`, `ActionPoints`, `TimeOfDay`, `Timer`, `positiveScore`, `negativeScore`, `turnsElapsed`) |
| `packages/stage-ui/src/stores/dating-sim.ts:L39-48` | `mood` MoodState computed (clamped tension/intimacy) |
| `packages/stage-ui/src/stores/dating-sim.ts:L571` | Dispatch `window.dispatchEvent(new CustomEvent('dating-sim:trigger-motion', { detail: target }))` |
| `packages/stage-ui/src/stores/dating-sim.ts:L711` | `toggleDatingSim()` — entry/exit |
| `packages/stage-ui/src/stores/dating-sim.ts:L627` | `const bc = new BroadcastChannel('dating-sim-sync')` |
| `packages/stage-ui/src/stores/modules/airi-card.ts:L1417-1431` | System-prompt override — `isDatingSimActive ? '' : card.scenario` |
| `packages/stage-ui/src/components/scenes/RendererStage.vue:L319` | `handleTriggerMotion` — receives motion triggers and routes them to the active model |
| `packages/stage-ui/src/components/scenes/RendererStage.vue:L337` | `window.addEventListener('dating-sim:trigger-motion', ...)` |

## Core SOPs

### 1. Triggering a motion / expression change

Send a custom `window` event (same-process) — the store wraps this in dedicated helpers (`emote()`, `triggerMotion()`):

```ts
window.dispatchEvent(new CustomEvent('dating-sim:trigger-motion', { detail: target }))
```

`RendererStage.vue` listens at `L337` and routes the target to the Live2D / VRM model. Never call the model store directly; use the custom event bridge for decoupling.

### 2. Adding a branching choice

Populate the `choices` ref in the store. The overlay reads from it reactively. Each choice may have:

```ts
{
  text: 'Choice label',
  cost?: number,    // ActionPoint cost
  mood?: string,    // Sets mood after selection
  intimacyChange?: number,
  tensionChange?: number,
  positiveScore?: number,
  negativeScore?: number
}
```

The LLM dialog controller (`L240`, `L293`, `L374`) also generates choices dynamically; if editing narrative logic, target the prompt sections near those lines.

### 3. System-prompt override (`card.scenario`)

When dating-sim is active, `airi-card.ts:L1427` omits `card.scenario` from the system prompt and lets `dating-sim.ts` inject its own directive. If the dating sim is active but the character seems to ignore card scenario, this is expected behavior — verify `useDatingSimStore().enabled`.

## Known Pitfalls

### Ephemeral localStorage state — NOT synced by BYOS

Dating-sim state lives in `localStorage` (`useLocalStorage`). The BYOS "Background/Yield Outbox Storage" sync does **not** propagate these values. Cross-window sync relies on the `BroadcastChannel('dating-sim-sync')` raw constructor at `L627` and is limited to in-memory mirror — a reload clears everything except `localStorage` settings.

### Action Points misnomer

`ActionPoints` is really "Conversation Topic budget." Do not treat it as a general resource pool.

### Raw vs VueUse BroadcastChannel

Two styles coexist in AIRI. Dating-sim uses the raw `new BroadcastChannel('dating-sim-sync')`. Do not "upgrade" it to VueUse `useBroadcastChannel` to match other stores — name normalization breaks cross-window contract.


### Authoritative Design & Architecture Documents

- [docs/dating-sim-gamestate-mechanics.md](docs/dating-sim-gamestate-mechanics.md) — Dating sim gamestate mechanics.
- [docs/dating-sim-intimacy-spec.md](docs/dating-sim-intimacy-spec.md) — Dating sim intimacy spec.
- [docs/director-producer-roles.md](docs/director-producer-roles.md) — Director/producer roles document.
- [docs/content/en/docs/showcase/07-producer-subsystem.md](docs/content/en/docs/showcase/07-producer-subsystem.md) — Producer subsystem showcase.
- [docs/rosetta-stone.md](docs/rosetta-stone.md) — Canonical concept-to-path index; §13 BroadcastChannel registry.

## Verification

```bash
pnpm -F @proj-airi/stage-ui typecheck
```
