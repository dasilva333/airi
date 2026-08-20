---
name: airi-broadcast-channels
description: >-
  Use when adding, consuming, or debugging cross-window BroadcastChannel relays: the live channel registry, control-strip dispatch ('airi-control-strip-actions'), caption overlay streaming ('airi-caption-overlay'), store-sync signals ('airi:*-sync'), the chat bus ('airi-chat-input-bridge', 'airi-chat-present', 'airi-speaking-state'), VueUse useBroadcastChannel lifecycle, or @moeru/eventa broadcast contexts. Trigger on cross-window state sync, window-to-window messaging, or channel payload typing.
---

# AIRI Broadcast Channels

Multi-window AIRI (Electron chat + stage + caption + widgets, or web split panes) uses browser `BroadcastChannel`s as its primitive for window-to-window state sync and commands. This skill maps the verified registry, the established lifecycle rules, and the failure modes to design around.

## 1. Live Channel Registry (verified)

| Channel | Publisher | Subscriber(s) | Payload |
| :--- | :--- | :--- | :--- |
| `airi-control-strip-actions` | `use-control-strip-action.ts` :17 (Control Strip buttons dispatch) | `ControlStripHost.vue`, `customizer.vue`, `apps/stage-tamagotchi/.../pages/index.vue` | string action id |
| `airi-caption-overlay` | `use-speech-caption-player.ts` :20, `ControlStripHost.vue` :100, `HeadTetheredCaption.vue`, `CaptionPanel.vue`, `DatingSimOverlay.vue` | Caption window (`pages/notice/caption.vue`), all caption flags | `CaptionChannelEvent` {segment, isActive} |
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

## 2. Rules & SOPs

1. **Prefer `useBroadcastChannel` from `@vueuse/core`** over raw `new BroadcastChannel()` — it gives typed `{ data, post }` getters and cables itself to component unmount. Raw instances must be guarded (`typeof BroadcastChannel !== 'undefined'`) for SSR-safety and closed manually.
2. **Register every new channel**: add it to `docs/rosetta-stone.md` (the §13 canonical registry) with publisher, subscribers, and payload shape. This skill + the Rosetta Stone table is the contract; presenting an undocumented channel is a discoverability failure mode.
3. **Strongly type payloads with generics** (`useBroadcastChannel<CaptionChannelEvent, CaptionChannelEvent>`) and differentiate publisher vs subscriber roles — many channels are bidirectional (control strip both dispatches and consumes).
4. **Loop prevention is mandatory**: never republish a broadcast message in response to a broadcast message without an explicit circuit breaker or generator flag.

## 3. Known Pitfalls & Failure Modes

- **Memory leaks**: forgetting to close/dispose a raw channel on unmount → listener sprawl across window lifecycles.
- **Message loops**: A→B→A bounce amplification (see loop prevention above).
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
