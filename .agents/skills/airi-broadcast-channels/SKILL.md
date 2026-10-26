---
name: airi-broadcast-channels
description: >-
  Wire/debug window-to-window BroadcastChannel messaging: state sync, chat relay, caption streaming, channel registry, payload types, VueUse lifecycle, eventa broadcast contexts. Electron main/renderer IPC uses airi-ipc-eventa.
---

# AIRI Broadcast Channels

Multi-window AIRI (Electron chat + stage + caption + widgets, or web split panes) uses browser `BroadcastChannel`s as its primitive for window-to-window state sync and commands. This skill maps the verified registry, the established lifecycle rules, and the failure modes to design around.

## 1. Live Channel Registry (verified)

| Channel | Publisher | Subscriber(s) | Payload |
| :--- | :--- | :--- | :--- |
| `airi-control-strip-actions` | `use-control-strip-action.ts` :17 (Control Strip buttons dispatch) | `ControlStripHost.vue`, `customizer.vue`, `apps/stage-tamagotchi/.../pages/index.vue` | string action id |
| `airi-caption-overlay` | `use-speech-caption-player.ts` :20, `ControlStripHost.vue` :100, `HeadTetheredCaption.vue`, `CaptionPanel.vue`, `DatingSimOverlay.vue` | Caption window (`pages/notice/caption.vue`); strip-side **single owner** is `use-control-strip-caption-relay.ts` (never a popover — the contract suite fails if a `.vue` popover opens a channel) | `CaptionChannelEvent` {segment, isActive} |
| `airi-chat-input-bridge` | `DatingSimOverlay.vue` :16 | Chat composer (subscribed in chat store) | input text string |
| `airi-chat-stream` | Chat store session | `ControlStripHost.vue` :104 | raw session updates |
| `airi-chat-present` | `ControlStripHost.vue` :149 | Desktop chat window | `PresentEvent` |
| `airi-speaking-state` | Control Strip / TTS runtime | Store / Model spoke state flags | `SpeakingState` |
| `airi-stage-model-ready` | `VRMModel.vue` after load | `ControlStripHost.vue` :191 | model url string |
| `dating-sim-sync` | `dating-sim.ts` :627 | All DatingSim UI surfaces | serialized DatingSim state |
| `airi:background-sync` | `background.ts` :198, `sync-engine.ts` :659 | `background.ts` (reload on signal) | sync signal |
| `airi:cards-sync` | `airi-card.ts` :325 | Card consumers | card id |
| `airi:display-models-sync` | `display-models.ts` :201 | Model settings / card pages | sync signal |
| `airi:short-term-memory-sync` | `memory-short-term.ts` :209 | Memory UI lanes | sync signal |
| `airi:custom-vrma-sync` | `custom-vrm-animations.ts` :40 | Motion playbook surfaces | sync signal |
| `airi:store-reload` | `sync-engine.ts` :660 (after BYOS remote import) | none found in code — outbound notification only | reload signal |
| `proj-airi:pipelines:outputs:speech` | `services/speech/bus.ts` :48 + `pipeline-runtime.ts` (same service publishes/consumes cross-window) | same speech service in other windows; UI-side surfaces consume the derived `airi-caption-overlay` segment events instead | `SpeechIntentStartPayload` / token payloads |
| `live2d-dsl-bridge` | `dating-sim.ts` (Live2D scene bridge) | `packages/stage-ui-live2d` | motion command JSON |
| `airi::beat-sync` | `packages/stage-shared/src/beat-sync/eventa.ts` :23 (Eventa broadcast context) | All windows' beat-sync listeners | AnalyserBeatEvent / MusicSignal |
| `airi::stage-three-runtime-trace` | `stage-three-runtime-trace.ts` :48 (renderer bridge) | `stage-three-runtime-diagnostics.ts` | runtime trace diagnostics |
| `airi_cf_oauth_channel` | `modules/cloudflare.ts` :255 (onboarding CORS proxy) | OAuth popup relay window | credential exchange |
| `airi:inference:web-llm` | `web-llm-channel.ts` (Leader / Client single-owner coordinator) | All windows (Chat, Onboarding, Actor, DatingSim, Memory) | `WebLlmChannelMessage` (ping, pong, load, generate, cancel, state-change) |
| `airi:nan0:state-sync` | `stores/modules/nan0.ts` :170 (Main Stage Window leader) | Secondary windows (Chatbox `ChatNan0CognitionPanel.vue`) | `Nan0StateSyncMessage` (emotions, lastReflex, decision, monologue) |

## 2. Rules & SOPs

1. **Prefer `useBroadcastChannel` from `@vueuse/core`** over raw `new BroadcastChannel()` — it gives typed `{ data, post }` getters and cables itself to component unmount. Raw instances must be guarded (`typeof BroadcastChannel !== 'undefined'`) for SSR-safety and closed manually.
2. **Register every new channel**: add it to `docs/rosetta-stone.md` (the §13 canonical registry) with publisher, subscribers, and payload shape. This skill + the Rosetta Stone table is the contract; presenting an undocumented channel is a discoverability failure mode.
3. **Strongly type payloads with generics** (`useBroadcastChannel<CaptionChannelEvent, CaptionChannelEvent>`) and differentiate publisher vs subscriber roles — many channels are bidirectional (control strip both dispatches and consumes).
4. **Loop prevention is mandatory**: never republish a broadcast message in response to a broadcast message without an explicit circuit breaker or generator flag.
5. **Single persistence owner per namespace**: one window (the leader, `isMainWindow() === true`) owns IndexedDB writes for a namespace; secondaries hydrate via `hydrateFromStorage()` and receive live deltas over the channel. Never add `storage`-event listeners as a second sync path. Fork precedents: `stores/modules/nan0.ts` (`ensureKernel` refuses in secondaries, `hydrateFromStorage` on mount/card change, live `airi:nan0:state-sync`), `libs/inference/adapters/web-llm-channel.ts` (single-owner leader election prevents multi-window VRAM duplication), `stores/sync-engine.ts` (`airi:store-reload` after BYOS import).
6. **Follower-only secondary windows**: chat/caption/customizer windows render and forward intent to the leader; they never propose canonical state. Guard orchestration entry points with `if (!isMainWindow()) throw/warn` and route mutations through the leader-owned store action.
7. **Watchers must not write to the channel**: a channel `watch`/`subscribe` callback must never call `post()` unconditionally — use a generator flag or idempotency key. A watcher may `await` an idempotent leader action (convergent on retry); it must not emit a new proposal. Receiving a remote snapshot must update local state silently and never re-emit.

## 3. Known Pitfalls & Failure Modes

- **Memory leaks**: forgetting to close/dispose a raw channel on unmount → listener sprawl across window lifecycles.
- **Message loops**: A→B→A bounce amplification (see loop prevention above). Regression probe: post one snapshot from the leader, assert the follower applies it with zero outbound posts; repeat the same snapshot and assert convergence (no second write, no proposal echo).
- **Dual writers**: two windows persisting the same namespace causes last-write-wins churn. Fix with rule 5 (single owner + `hydrateFromStorage` + reload signal), not with extra debounce.
- **Non-serializable payloads**: channels use structured clone — DOM nodes, class instances with methods, and Blobs will either throw or arrive rehydrated. Blob-like transfers (e.g. backgrounds) serialize via ArrayBuffer where needed.
- **Data races**: delivery is async and not ordered against your local state changes — never assume a message arrived before your local code ran.

## 4. Verification

- `pnpm -F <affected-workspace> typecheck` on channel additions.
- For a new channel: grep `rg "name: 'your-channel'"` across `packages/ apps/` to confirm every subscriber handles unknown-message-version gracefully.

### Cross-Citations

- [docs/rosetta-stone.md](docs/rosetta-stone.md) — §13 canonical registry.
- Skills that consume specific channels: `airi-caption-subsystem`, `airi-dating-sim-engine`, `airi-scenes-backgrounds`, `airi-stage-ui-surfaces`, `airi-byos-cloud-sync`, `airi-cloud-relay-infrastructure`.

## Related Skills & References

- **Peer Skills**: [[airi-byos-cloud-sync]], [[airi-caption-subsystem]], [[airi-cloud-relay-infrastructure]], [[airi-dating-sim-engine]], [[airi-scenes-backgrounds]], [[airi-stage-ui-surfaces]]
- **Key Documents**: [[rosetta-stone]]

### Authoritative Design & Architecture Documents

- [docs/rosetta-stone.md](docs/rosetta-stone.md) — Canonical BroadcastChannel registry (§13).
