# Project Specialized Skills Master Plan & Skill Catalog

This document outlines the strategic blueprint, architecture, and comprehensive sitemap catalog for building purpose-built AIRI Agent Skills under `.agents/skills/<skill_name>/SKILL.md`.

The goal is to equip AI agents and pair-programming assistants with modular, domain-specific Standard Operating Procedures (SOPs), code locations, and technical guidelines covering **every architectural domain** in AIRI as cataloged by [`docs/rosetta-stone.md`](./rosetta-stone.md).

---

## 1. Skill Architecture & Matching Mechanism

### What is an AIRI Skill?
An **AIRI Skill** is a purpose-built directory under `.agents/skills/<skill_name>/` containing a required `SKILL.md` entry point. It provides concise, high-density instructions, key code paths, pitfalls, and verification steps for a specific domain.

```text
.agents/skills/<skill-name>/
├── SKILL.md                 # Required: Entry point with YAML frontmatter
├── scripts/                 # Optional: Helper scripts & CLI tools
├── examples/                # Optional: Reference code & implementation patterns
└── references/              # Optional: Domain documentation & specs
```

### The Matching Mechanism (`description` trigger)
Skill selection relies on semantic triggering via the YAML frontmatter `description`:
```yaml
---
name: airi-ipc-eventa
description: >-
  Use when defining, wiring, or debugging Electron typed IPC/RPC between main
  and renderer: `@moeru/eventa` contracts in `shared/eventa.ts`, `defineInvokeEventa`
  / `defineEventa`, renderer invocations, main-process handlers, and cross-window
  `BroadcastChannel` relays (e.g. `airi:cards-sync`, `airi:director-notes-sync`).
  Trigger for work on Electron IPC, eventa context serialization, or multi-window
  event/state synchronization.
---
```
At session startup, the agent sitemap indexes these `description` triggers. When a task matches a skill's description, the agent automatically reads that skill's `SKILL.md` via `view_file` to follow its instructions.

---

## 2. 5-Phase Rollout & Batch Execution Strategy

To build this comprehensive library without context fragmentation, skills will be authored in **5 phased execution batches**:

```mermaid
flowchart TD
    P1["Phase 1: Core Plumbing & Infrastructure"] --> P2["Phase 2: Character, Stage, Motion & Sensing"]
    P2 --> P3["Phase 3: Module Systems, Cognition & Memory"]
    P3 --> P4["Phase 4: Operational SOPs & Upstream Research"]
    P1 & P2 & P3 --> P5["Phase 5: Feature-Dense UI Surfaces"]
```

---

## 3. Comprehensive Domain Skill Sitemap Catalog

Below is the complete, categorized sitemap of all 58 specialized skills mapped against AIRI's architectural domains in [`docs/rosetta-stone.md`](./rosetta-stone.md).

> **Authoring requirement for worker agents.** Every authored `SKILL.md` **must** include a keyword-rich `description:` frontmatter trigger of the form `Use when working with …`, explicitly naming the domain, the key technologies (e.g. `eventa`, `unstorage`, `localforage`, `defineProvider`, `BroadcastChannel`), and the kinds of tasks it applies to. Model it on the example in §1.

---

### 🟢 Phase 1: Core Plumbing & Infrastructure

#### 1.1 `airi-app-entry-wiring`
- **Target Domain**: Application Bootstrap, Window Management, DI Composition Root (`injeca`).
- **Key Paths**: `apps/stage-tamagotchi/src/main/index.ts`, `apps/stage-tamagotchi/src/main/windows/`, `apps/stage-web/src/App.vue`.
- **Content**: Service injection via `injeca`, main process window manager lifecycles (Control Strip, Stage, Chat, Caption, Widgets, Settings), renderer routing via Vite, and web app entry.

#### 1.2 `airi-ipc-eventa`
- **Target Domain**: Typed Electron IPC/RPC Contracts & Cross-Window Messaging.
- **Key Paths**: `apps/stage-tamagotchi/src/shared/eventa.ts`, `packages/electron-eventa/`.
- **Content**: Defining typed `eventa` IPC calls, main-to-renderer event emissions, avoiding the Eventa context serializer pitfall, and handling `BroadcastChannel` cross-window event relays.

#### 1.3 `airi-data-persistence`
- **Target Domain**: Database Repos, Dual IndexedDB Layer (`unstorage` + `localforage`), Sync Engine.
- **Key Paths**: `packages/stage-ui/src/database/storage.ts`, `packages/stage-ui/src/database/repos/`, `packages/stage-ui/src/stores/sync-engine.ts`, `docs/data-catalog.md`.
- **Content**: Writing repo actions for `local:` namespaces, avoiding Vue 3 binary proxy destruction in `localforage`, handling S3/ElectronFS sync engine reconciliations, and outbox queue management.

#### 1.4 `airi-provider-core-registry`
- **Target Domain**: Provider Architecture, `defineProvider()` Schemas & API Capability Contracts.
- **Key Paths**: `packages/stage-ui/src/libs/providers/providers/registry.ts`, `packages/stage-ui/src/libs/providers/types.ts`, `docs/provider-catalog.md`, `docs/project-provider-metadata-catalog.md`.
- **Content**: Defining new provider backends via `defineProvider()`, implementing `ProviderMetadata` and `SpeechCapabilitiesInfo` contracts, `capabilities` (`listModels`, `listVoices`, `loadModel`), and Zod validation schemas.

#### 1.5 `airi-provider-store-instances`
- **Target Domain**: Multi-Instance Provider Store, Account Catalog & Persistence.
- **Key Paths**: `packages/stage-ui/src/stores/provider-catalog.ts` (`providersStore`), `packages/stage-ui/src/database/repos/providers.repo.ts` (`local:providers`), `docs/design-multi-instance-provider-studio.md`, `docs/arch-provider-store-current-structure.md`, `docs/project-provider-store-restructuring-plan.md`.
- **Content**: `providersStore` Pinia state, `providersRepo` IndexedDB persistence, multi-instance provider configuration (allowing multiple API keys / endpoints per provider), data boundaries, and account validation state (`useProviderValidation`).

#### 1.6 `airi-card-schema`
- **Target Domain**: Character Card Specifications (CCv2/CCv3) & AIRI Extension Schema.
- **Key Paths**: `packages/stage-ui/src/types/card.schema.ts`, `packages/stage-ui/src/stores/modules/airi-card.ts`, `packages/ccc/src/define/card.ts` (base `Card` shape), `docs/airi-card-design.md`.
- **Content**: `AiriCard` and `AiriExtension` structure, Valibot schema validation, PNG `tEXt` chunk writing (`chara` keyword → base64 UTF-8 JSON → zlib CRC-32 per PNG tEXt chunk rules), and Electron webview `will-download` interception for `.png` card imports.

#### 1.7 `airi-cloud-relay-infrastructure`
- **Target Domain**: Serverless Edge Workers, BYOS Cloud Sync & Remote Proxy Infrastructure.
- **Key Paths**: `apps/stage-edge/`, `docs/cloud-relay-design.md`, `docs/project-byos-cloud-sync.md`, `docs/project-audit-cloudsync.md`, `docs/superpowers/specs/2026-07-04-commercial-backend-phase-1-provider-data-boundary-design.md`.
- **Content**: Deploying and maintaining Cloudflare Workers, Edge KV memory models, BYOS cloud sync outbox queues, commercial API server proxy boundaries, and `PERSONAL_DATA_CLOUD_SYNC_ENABLED` storage guards.

#### 1.8 `airi-byos-cloud-sync`
- **Target Domain**: Bring Your Own Storage (BYOS) active-state cloud backup, S3/R2/Google Drive adapters, unstorage outbox queues, IndexedDB sync reconciliations, multi-device state sync.
- **Key Paths**: `packages/stage-ui/src/database/storage.ts`, `packages/stage-ui/src/stores/sync-engine.ts`, `packages/stage-ui/src/components/scenarios/providers/selective-sync-panel.vue`, `packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/steps/step-cloud-infrastructure.vue` / `step-cloud-restore.vue`, `packages/stage-ui/src/stores/modules/cloudflare.ts`, `docs/project-byos-cloud-sync.md`, `docs/project-audit-cloudsync.md`.
- **Content**: The unstorage interceptor + outbox queue architecture, LWW vs mergeable-key vs manifest reconciliation rules, voice-profile reconciliation with quota gates, Google Drive AppData bootstrap + Edge Vault credential recovery, loop prevention (`isImportingRemoteData`), anti-contraction safeguard, and selective restore (metadata required, heavy blobs opt-in). Peer skill: `airi-cloud-relay-infrastructure` (edge relay side).

---

### 🔵 Phase 2: Character, Stage, Motion & Sensing

#### 2.1 `airi-character-rendering`
- **Target Domain**: 3D & 2D Avatar Display Models (VRM, Live2D, Spine, MMD).
- **Key Paths**: `packages/stage-ui-three/`, `packages/stage-ui-live2d/`, `packages/stage-ui-spine/`, `packages/stage-ui-mmd/`.
- **Content**: Rendering pipelines for VRM (Three.js), Live2D (Canvas & DSL VM adapter), Spine, and MMD. Expression mappings, parameter controls, motion triggers, and `displayModelsStore` binary fetching.

#### 2.2 `airi-audio-pipeline`
- **Target Domain**: TTS Speech Output, STT Hearing Input, Audio Studio & UST.
- **Key Paths**: `packages/stage-ui/src/stores/modules/speech.ts`, `hearing.ts`, `stores/audio.ts`, `packages/audio-pipelines-transcribe/`.
- **Content**: TTS output flow (VoiceProfile, UST speech transformers, PCM/WAV playback), STT input flow (microphone device switching, VAD detection, streaming transcription). Note: "Audio Studio" refers to the voice-profile / UST feature spec (`docs/feat-audio-studio.md`).

#### 2.3 `airi-local-inference-engines`
- **Target Domain**: Local WebGPU & WASM Inference (Kokoro TTS, Whisper STT, WebLLM, Web-RWKV).
- **Key Paths**: `packages/stage-ui/src/libs/inference/` (protocol/coordinator/`gpu-resource-coordinator`, `adapters/`), `packages/stage-ui/src/workers/kokoro/`, `packages/stage-ui/src/libs/workers/whisper/`. Note: WebLLM/Web-RWKV run as workers under `packages/stage-ui/src/workers/`.
- **Content**: Message protocol (`load-model`, `run-inference`, `progress`), serialized load queues, `GpuResourceCoordinator` VRAM pressure telemetry, and WebGPU detection.

#### 2.4 `airi-stage-ui-surfaces`
- **Target Domain**: Cross-app Control Strip (desktop Electron pill + `mode="mobile"` integration in stage-web/stage-pocket), floating Electron window overlays, `ControlStripHost.vue`/`WidgetStage`, `RendererStage.vue`, control islands, and the action-dispatch / button-catalog layer.
- **Key Paths**: `packages/stage-ui/src/components/scenarios/layout/ControlStrip.vue`, `packages/stage-ui/src/composables/use-control-strip-action.ts`, `packages/stage-ui/src/stores/settings/control-strip.ts` + `controls-island.ts`, `packages/stage-ui/src/constants/control-customizer.ts`, `packages/stage-ui/src/components/scenes/ControlStripHost.vue` (exported as `WidgetStage`), `RendererStage.vue`, `apps/stage-tamagotchi/src/renderer/pages/index.vue`, `apps/stage-web/src/pages/index.vue`, `apps/stage-pocket/src/pages/index.vue`, `packages/stage-pages/src/pages/settings/stage/index.vue`.
- **Content**: One shared `ControlStrip.vue` rendered in three app shells via a `mode` prop; `DEFAULT_BUTTONS` vs `DEFAULT_MOBILE_BUTTONS` selected on `isStageTamagotchi()`; `BUTTONS_CATALOG_VERSION` gating + keyed merge (do NOT bump to add buttons); `useControlStripAction` dispatcher + `control-strip:*` CustomEvent bus + `airi-control-strip-actions` BroadcastChannel; desktop-only event listeners (open-customizer/open-settings) that web/pocket do NOT implement; opposite-edge chatbox rule for `dockedEdge`; notch-mode geometric hit-testing and click-through; portrait vs landscape integration planes. Pitfalls: version bump wipes user layouts, `useLocalStorage` vs ManualReset for `buttons`, shared localStorage key for fadeOnHoverEnabled, `stageViewControlsEnabled` transparency trap, stale mobile-revamp doc naming unbuilt files.

#### 2.5 `airi-live2d-dsl-interpreter`
- **Target Domain**: Live2D Scripting DSL Virtual Machine & Kinetic Staging Engine.
- **Key Paths**: `docs/live2d-dsl-interpreter-spec.md`, `docs/handoff-live2d-dsl-phase2.md`, `packages/stage-ui-live2d/src/components/scenes/live2d/Model.vue`.
- **Content**: `pixi-live2d-display` instruction parser, `VarFloats` reactive heap (conditional guards & state modifiers), Sequencer pipeline (`start_mtn`, `clear_exp`), `change_cos` zero-latency WebGL costume hot-swapping, and `Live2DStageManager` delta ticking loop.

#### 2.6 `airi-generative-motion-vrma`
- **Target Domain**: Text-to-VRMA Generative Motion & Skeletal Retargeting Engine.
- **Key Paths**: `docs/proposal-text-to-vrma-system.md`, `docs/design-text-to-motion.md`, `@pixiv/three-vrm-animation`, `generate_motion` tool call, IndexedDB motion cache (`"jumping_jacks"`), Rehearsal Room motion sandbox.
- **Content**: Compiling LLM JSON keyframes into `.vrma` binary buffers in the browser, Mixamo-to-VRM bone retargeting maps, Euler-to-quaternion GLB builders, bone rotation safety clamping, and synchronized motion playback via `<|ACT:motion="..."|>`.

#### 2.7 `airi-attention-ecology-vision`
- **Target Domain**: Continuous Vision Perception & Attention Ecology Gate.
- **Key Paths**: `docs/proposal-attention-ecology-local-webgpu-guard.md`, `docs/implementation-plan-vision-witness.md`, `packages/stage-ui/src/stores/modules/vision/orchestrator.ts`.
- **Content**: Cascaded Salience Gate (pHash → CLIP vision embedding & novelty scoring → WASM OCR / RWKV-7 gate → VLM forwarder), privacy app exclusion filters, push/pull cognitive mechanics, and Vibe Island integration.

#### 2.8 `airi-model-customizer`
- **Target Domain**: The inline **ModelCustomizer** widget (`ModelCustomizer.vue`) — the embedded per-model capability editor used by all four model-type settings panels (VRM/Live2D/Spine/MMD) and the Rehearsal Room acting sandbox.
- **Key Paths**: `packages/stage-ui/src/components/scenarios/settings/model-settings/ModelCustomizer.vue`, `vrm-expressions.vue`, `live2d.vue`, `mmd.vue`, `spine.vue`, `apps/stage-tamagotchi/src/renderer/components/chat/chat_rehearsal.vue`, `packages/stage-ui/src/stores/display-models.ts` (`getOrLoadModelCapabilities`), `packages/stage-ui-three/src/stores/model-store.ts` (`discoveredMeshes`, `setMeshVisibility`), `docs/modelcustomizer-design.md`.
- **Content**: Universal 4-format expression/motion explorer driven by indexed model capabilities (works with model off-stage); per-type preview dispatch (`triggerExpressionEffect`/`triggerMotionEffect`); ACT emotion and motion mapping + `<|ACT:...|>` insert-token contract; rename/visibility/favorite/idle-cycle toggles; and the mesh-part wardrobe builder (outfits + mesh names) expanding into a third domain. **Disambiguation**: this is the *inline widget*; the floating window is `airi-controlstrip-customizer`.

#### 2.9 `airi-controlstrip-customizer`
- **Target Domain**: The floating **Control Strip Customizer** window — user-facing "Customizer" (NOT the inline ModelCustomizer widget).
- **Key Paths**: `apps/stage-tamagotchi/src/main/windows/customizer/index.ts`, `apps/stage-tamagotchi/src/renderer/pages/customizer.vue`, `packages/stage-ui/src/constants/control-customizer.ts` (`CUSTOMIZER_CATALOG`), eventa IPC (`electronCustomizerToggleVisibility`, `electronGetCustomizerWindowState`), `apps/stage-tamagotchi/src/renderer/pages/index.vue`.
- **Content**: Floating glassmorphic configuration panel (opened from Control Strip / tray / hotkey) tweaking stage, captions, actor/wardrobe, Gemini, and system-window state in real time via direct Pinia store binding. `desktopOnly` items gate the desktop multi-window managers. **Disambiguation**: this is the *floating window*; the embedded settings widget is `airi-model-customizer`.

#### 2.10 `airi-caption-subsystem`
- **Target Domain**: Captions/subtitles across all render surfaces — standalone Electron caption window, DatingSim inline panel, head-tethered comic-bubble plank, and the shared `'airi-caption-overlay'` BroadcastChannel streaming protocol.
- **Key Paths**: `apps/stage-tamagotchi/src/main/windows/caption/`, `apps/stage-tamagotchi/src/renderer/pages/caption.vue`, `packages/stage-ui/src/components/scenes/CaptionPanel.vue`, `packages/stage-ui/src/components/scenes/HeadTetheredCaption.vue`, `packages/stage-ui/src/composables/use-speech-caption-player.ts`, `packages/stage-ui/src/stores/settings/captions.ts`.
- **Content**: The segment/isActive streaming protocol, CaptionPanel segment highlighting, Live2D baked-in motion Text captions, Sentence-Sync TTS player, caption settings (docking, follow-stage, head-tether, opacity, layout mode), and the desktop-only-with-shared-in-scene-behavior distinction. Peer skills: `airi-broadcast-channels`, `airi-audio-pipeline`.

#### 2.11 `airi-stage-mate-unity`
- **Target Domain**: Stage-Mate — the Unity/VRM native sidecar (`apps/stage-mate`): workspace purity rules, harness WebSocket protocol, C# sidecar runtime, upstream patches, batch builds.
- **Key Paths**: `apps/stage-mate/unity-src/Assets/StageMate/`, `apps/stage-mate/unity-src/Patches/`, `apps/stage-mate/scripts/setup.ts` / `build.ts`, `apps/stage-mate/CANONICAL_MATE_ENGINE_COMMIT`.
- **Content**: The never-edit-`mate-engine/` rule and overlay sync, `ws://localhost:6171` mock harness + `stage:vrm` wire protocol, StageMateSocket/Bridge/StateSync C# runtime, VRM model drivers, camera/viewport/shadow rigs, runtime log split (stagemate-runtime.log vs Player.log), and platform-specific UniWindowController transparency. Peer skill: `airi-character-rendering`.

---

### 🟣 Phase 3: Module Systems, Cognition & Memory

#### 3.1 `airi-onboarding-v2`
- **Target Domain**: Onboarding V2 7-Step Sequence & Draft Assembly Architecture.
- **Key Paths**: `packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/`, `docs/project-onboarding-modernize.md`.
- **Content**: Implementing V2 onboarding steps, `onboardingV2Gate` contracts, transient `onboardingV2Draft` composition state (Principle 6), in-context model shard downloads, and Step 7 atomic card synthesis.

#### 3.2 `airi-mcp-integration`
- **Target Domain**: Model Context Protocol (MCP) Server Integration.
- **Key Paths**: `apps/stage-tamagotchi/src/main/services/airi/mcp-servers/`, `packages/stage-ui/src/stores/mcp-tool-bridge.ts`, `mcp.json`.
- **Content**: Electron stdio MCP service manager, tool listing and invocation IPC bridge (`window.__AIRI_MCP_BRIDGE__`), builtin meta-tools (`mcp_list_tools`, `mcp_call_tool`), and configuration schemas.

#### 3.3 `airi-discord-integration`
- **Target Domain**: Discord Bot Integration & Multi-Modal Routing.
- **Key Paths**: `apps/stage-tamagotchi/src/main/services/airi/discord/`, `packages/stage-ui/src/stores/modules/discord.ts`.
- **Content**: Main process Discord gateway service, slash command registration (`COMMANDS_VERSION`), image attachment vision routing, and tool availability fallthrough.

#### 3.4 `airi-memory-systems`
- **Target Domain**: The Eight Pillars of Memory — hub / map-of-maps skill.
- **Key Paths**: `packages/stage-ui/src/stores/` (memory-* stores, event-log, background), `packages/stage-ui/src/database/repos/`, `docs/data-catalog.md`, `docs/timeline-flat-design.md`.
- **Content**: Deliberately thin map-of-maps: locates each of the eight pillars (chat sessions, text journal, short-term, echo chips, lifetime, image journal, event log, provisioning) with store → repo → namespace key → universe tagging → prompt-injection point, then defers depth to the eight dedicated pillar skills (3.13–3.20) plus retrieval (3.8), consolidation (3.9), and Memory UI (5.10). Owns the `local:*` vs `localforage` storage boundary, the session-store injection spine, and the flat-`universeId` isolation rules.

#### 3.5 `airi-prompt-builder-engine`
- **Target Domain**: System Prompt Builder, ACT Pipeline & Dating Sim Engine.
- **Key Paths**: `packages/stage-ui/src/stores/modules/airi-card.ts` (`buildSystemPrompt`), `packages/stage-ui/src/stores/chat/session-store.ts` (`refreshActiveSystemMessage`, `buildShortTermMemoryContext`), `packages/stage-ui/src/composables/llm-marker-parser.ts`, `packages/stage-ui/src/stores/dating-sim.ts`.
- **Content**: Composing character card fields, acting prompts, artistry instructions, and runtime overlays (dating sim storylines). ACT token parsing (`<|ACT:...|>`), kinetic manifestation triggers, and response formatting.

#### 3.6 `airi-gemini-live-api`
- **Target Domain**: Real-Time Bidirectional Multimodal WebSocket Streaming (`google-genai`).
- **Key Paths**: `docs/design-gemini-live-api-integration.md`, `packages/stage-ui/src/stores/modules/live-session.ts`.
- **Content**: Sub-second latency WebSocket Bidi streaming (`LiveSessionStore`), mandatory `['AUDIO']` modality rule (prevents Error 1007/1011), zero-length TTS suppress hack, live marker parsing, and native tool calling.

#### 3.7 `airi-proactivity-sensory-telemetry`
- **Target Domain**: OS Sensor Polling, Environmental Telemetry & Attention Ecology Gate.
- **Key Paths**: `docs/design-proactivity-heartbeats-engine.md`, `packages/stage-ui/src/stores/proactivity.ts`.
- **Content**: OS sensor polling (Active Window Title, Program Name, AFK status, Volume, Time), 5-event rolling clipboard buffer, invisible emotion meters (Trust, Patience, Playfulness), heuristic gating, and `NO_REPLY` decision logic.

#### 3.8 `airi-memory-retrieval-engine`
- **Target Domain**: Ultimate Hybrid Memory Retrieval Engine & Ranking Architecture.
- **Key Paths**: `docs/memory_lab/retrieval-and-ranking-spec.md`, `docs/memory_lab/search-probe-harness-plan.md`, `packages/stage-ui/src/libs/search/layered-memory.ts`.
- **Content**: Tiered Router (Literal Mode for single-hop exact recall, Bridge Mode for C1 multi-hop fact linking, Detective Mode for C3 open-domain reasoning), 5W extraction schema (`who/what/where/when/why`), concept normalization, candidate search across 10+ metadata fields, and fused signal reranking.

#### 3.9 `airi-memory-consolidation-dreaming`
- **Target Domain**: Triple-Store Memory Model, Sacred Journal Rule & Dreaming Worker.
- **Key Paths**: `docs/memory_lab/design-prospective-rich-journal.md`, `docs/memory_lab/memory-schema-and-lifecycle-spec.md`, `docs/memory_lab/memory-lifecycle-and-features.md`.
- **Content**: Triple-Store Model (Ephemeral STMM, Immutable Sacred LTMM, Dynamic DRMM), Sacred Irreplaceable Journal Rule (workers derive insights but never rewrite manual entries), PCL contradiction handling with invalidation gates, Dreaming Worker, and Emotional Exhaust deltas updating global `MoodState`.

#### 3.10 `airi-interaction-pipelines`
- **Target Domain**: End-to-end Interaction & Voice Pipelines (Cross-Cutting Map-of-Maps).
- **Key Paths**: `docs/arch-chat-stt-proactivity-pipelines.md`, `packages/stage-ui/src/stores/chat.ts`, `packages/stage-ui/src/stores/modules/live-session.ts`, `packages/stage-ui/src/services/speech/`, `apps/stage-tamagotchi/src/main/services/airi/discord/index.ts`.
- **Content**: The seven input→hub→output routes (typed text × 4 surfaces, app mic STT, Discord classic voice → STT, proactivity heartbeats, Discord gemini voice, in-app Gemini Live mic, typed-text-mid-call short-circuit), the module-level hooks bus (HMR lesson, `chat.ts:96`), the six-layer TTS chain (`emitTokenLiteralHooks` → host intent → speech runtime → UST pipeline → playback), `performSend` generation-gated checkpoints (`bumpSessionGeneration` as the canonical mid-flight lever, Discord steer mode as the working precedent), the stop/cancel-in-flight audit (decorative stop button at `WhisperComposerBar.vue:233`, propose-first stop recipe), and a current-status reconciliation of the arch-doc Failure Log. Peer skills: `airi-audio-pipeline`, `airi-gemini-live-api`, `airi-proactivity-sensory-telemetry`, `airi-discord-integration`. Phase 3 foundation referenced by Phase 5 `airi-desktop-chatbox`.

#### 3.11 `airi-llm-dispatch-gateway`
- **Target Domain**: LLM Request Dispatch Gateway (`useLLM` store).
- **Key Paths**: `packages/stage-ui/src/stores/llm.ts`, `packages/stage-ui/src/stores/chat.ts`, `docs/arch-chat-stt-proactivity-pipelines.md`.
- **Content**: The single renderer-side LLM funnel (`stream`/`generate`/`generateObject`/`discoverToolsCompatibility`), the `StreamOptions` contract (abortSignal, waitForTools, supportsTools, lazy tools resolver, requestOverrides sanitization), the `StreamEvent` protocol, the dual-settlement stream promise, message/system-message sanitization, and the one-way per-model tools-compatibility cache. Peer skills: `airi-provider-core-registry`, `airi-tool-registry-builtin-tools`, `airi-interaction-pipelines`.

#### 3.12 `airi-tool-registry-builtin-tools`
- **Target Domain**: Tool Registry, Builtin Tool Authoring & Per-Surface Availability.
- **Key Paths**: `apps/stage-tamagotchi/src/renderer/stores/tools/builtin/index.ts`, `packages/stage-ui/src/stores/proactivity.ts`, `packages/stage-ui/src/stores/chat.ts`, `packages/stage-ui/src/stores/llm.ts`.
- **Content**: The two registries (chat `toolsResolver` + ProactivityStore `registerTools`/`resolveRegisteredTools`), the `builtinTools` factory composition and gateables, ACT-marker tool bridging, card-level `allowedTools` gating, the per-surface availability matrix (desktop/secondary-windows/proactivity/Discord text+voice+steer/Gemini Live native/web-stage/pocket/VLM), tool-call rendering in chat slices and Discord outbound formatting, and builtin tool authoring. Peer skills: `airi-mcp-integration`, `airi-interaction-pipelines`, `airi-llm-dispatch-gateway`.

#### 3.13 `airi-memory-chat-sessions`
- **Target Domain**: Memory Pillar 1 — Chat Sessions & the prompt-injection spine.
- **Key Paths**: `packages/stage-ui/src/stores/chat/session-store.ts`, `packages/stage-ui/src/database/repos/chat-sessions.repo.ts`, `docs/data-catalog.md` §1.4/§1.5.
- **Content**: Session lifecycle (index, metas, generation checkpoints), universe metadata, fork/switch flows, and `buildShortTermMemoryContext`/`buildLifetimeMemoryContext` injection point.

#### 3.14 `airi-memory-text-journal`
- **Target Domain**: Memory Pillar 2 — Long-Term Text Journal (LTMM).
- **Key Paths**: `packages/stage-ui/src/stores/memory-text-journal.ts`, `packages/stage-ui/src/database/repos/text-journal.repo.ts`, `apps/stage-tamagotchi/src/renderer/stores/tools/builtin/text-journal.ts`.
- **Content**: Append-only Sacred Journal rule, `text_journal` tool write path, universe-scoped filtering, journal→search indexing.

#### 3.15 `airi-memory-short-term`
- **Target Domain**: Memory Pillar 3 — Short-Term Memory daily blocks (STMM).
- **Key Paths**: `packages/stage-ui/src/stores/memory-short-term.ts`, `packages/stage-ui/src/database/repos/short-term-memory.repo.ts`.
- **Content**: One block per character per day, `tokenBudgetPerDay`/`windowSize` card config, rebuild flows, universe-scoped day buckets.

#### 3.16 `airi-memory-echo-chips`
- **Target Domain**: Memory Pillar 4 — Echo Chips.
- **Key Paths**: `packages/stage-ui/src/stores/echo-chips.ts`, `packages/stage-ui/src/database/repos/echo-chips.repo.ts`, `docs/proposal-echo-chips-rwkv-synthesis.md`.
- **Content**: 3–5 typed chips per character, two-stage RWKV-7 salience gate + LLM tag synthesis, evidence windows.

#### 3.17 `airi-memory-lifetime`
- **Target Domain**: Memory Pillar 5 — Lifetime Artifacts / Eternal Thread.
- **Key Paths**: `packages/stage-ui/src/stores/memory-lifetime.ts`, `packages/stage-ui/src/database/repos/lifetime-memory.repo.ts`, `docs/memory_lab/lifetime-artifact-generation-plan.md`.
- **Content**: The 5-stage resumable provisioning synthesis (`collect → chunk → base → distill_pass_1 → distill_pass_2 → success`), universe-keyed storage, `[Lifetime Artifact]` injection.

#### 3.18 `airi-memory-image-journal`
- **Target Domain**: Memory Pillar 6 — Image Journal & Autonomous Artistry.
- **Key Paths**: `packages/stage-ui/src/stores/background.ts`, `packages/stage-ui/src/stores/modules/artistry-autonomous.ts`, `apps/stage-tamagotchi/src/renderer/stores/tools/builtin/image-journal.ts`, `docs/design-image-journal-storage.md`.
- **Content**: `BackgroundEntry` (`journal`/`selfie` types) in localforage; distinguishes the assistant-driven `image_journal` tool call from the deterministic Autonomous Artistry side-pipeline (Director 2nd-LLM → threshold gate → headless generation → journal save, invisible to the talking assistant).

#### 3.19 `airi-memory-event-log`
- **Target Domain**: Memory Pillar 7 — Event Log ledger.
- **Key Paths**: `packages/stage-ui/src/stores/event-log.ts`, `apps/stage-tamagotchi/src/renderer/components/chat/chat_event_log.vue`.
- **Content**: 500-cap bounded ledger, seven event categories, `getRecentEventsText` heartbeat injection, UI pane.

#### 3.20 `airi-memory-provisioning`
- **Target Domain**: Memory Pillar 8 — Provisioning Sessions (resumable build state).
- **Key Paths**: `packages/stage-ui/src/database/repos/provisioning-session.repo.ts`, `docs/data-catalog.md` §1.9.
- **Content**: Phase state machine, chunk-summary checkpoint persistence, resume/reprovision/restart semantics paired with pillar 5.

#### 3.21 `airi-acting-cue-act-tokens`
- **Target Domain**: The ACT token system — acting-cue orchestration protocol (emotion/motion/delay/actor tokens), cross-cutting Phase 2 rendering and Phase 3 prompt assembly.
- **Key Paths**: `packages/stage-ui/src/composables/llm-marker-parser.ts`, `packages/stage-ui/src/composables/response-categoriser.ts`, `packages/stage-ui/src/constants/prompts/character-defaults.ts`, `packages/stage-ui/src/types/chat.ts` (`rawContent`/`content`), `packages/stage-pages/src/pages/settings/airi-card/components/tabs/CardCreationTabActing.vue`, `FieldAiGeneratorModal.vue`, `apps/stage-tamagotchi/src/renderer/components/chat/chat_rehearsal.vue`, `packages/stage-ui/src/components/scenes/ControlStripHost.vue`.
- **Content**: The two official ACT formats (Short Format, JSON Chaining Format), hidden/tolerated forms (legacy bare-`>` close whitelisted for ACT/DELAY/LLM_, `|}` normalization, escapes), DELAY and ACTOR tokens, rawContent-vs-content dual-key drift contract, teaching layer (DEFAULT_ACTING_* prompts, `AiriExtension.acting`, Acting tab, Field AI Generator templates), cue-execution chain (parser → categoriser → hooks → special-token queue → VRM/Live2D), Rehearsal Room playground, Model Customizer mapping nexus, Discord outbound stripping, and the planned Onboarding-V2 Advanced-Lab acting step. Peer skills: `airi-prompt-builder-engine`, `airi-model-customizer`, `airi-character-rendering`, `airi-interaction-pipelines`, `airi-onboarding-v2`.

---

### 🟡 Phase 4: Operational SOPs & Upstream Research

#### 4.1 `airi-i18n-localization`
- **Target Domain**: Monorepo i18n Translations & YAML Management.
- **Key Paths**: `packages/i18n/`, `scripts/yaml-manager.js`, `docs/settings-yaml.md`.
- **Content**: Using `scripts/yaml-manager.js` to locate, validate, and manage locale YAML files without brute-forcing translation keys.

#### 4.2 `airi-binary-safety`
- **Target Domain**: Binary Asset Serialization & Vue 3 Proxy Handling.
- **Key Paths**: `packages/stage-ui/src/database/storage.ts`, `stores/display-models.ts`.
- **Content**: Preventing Vue 3 proxy destruction of `File`/`Blob` objects during `JSON.stringify()`. Using `toRaw()` and lightweight metadata catalogs with on-demand binary loading.

#### 4.3 `airi-codebase-verification`
- **Target Domain**: Validation Commands & Verification Workflows.
- **Key Paths**: `AGENTS.md`, workspace `package.json` scripts.
- **Content**: Selecting minimal verification targets (`pnpm -F <workspace> typecheck`, workspace builds), handling Electron vs web typechecks, git status reporting rules, and fork release safety constraints.

#### 4.4 `airi-prefix-cache-alignment`
- **Target Domain**: LLM Prefix Cache Alignment & Prompt Compilation Optimization.
- **Key Paths**: `docs/proposal-prefix-cache-alignment.md`, `docs/proposal-director-cache-alignment-analysis.md`, `packages/stage-ui/src/stores/chat/session-store.ts`.
- **Content**: Multi-phase prompt compilation layout geometry for DeepSeek, OpenRouter & Gemini to prevent KV prefix cache invalidation across automated sub-loops, drastically reducing LLM latency and token costs.

#### 4.5 `airi-roadmap-upstream-research`
- **Target Domain**: Project Roadmap Navigation, Proposal RFC Analysis, Fork Research & Upstream Syncing.
- **Key Paths**: `docs/content/en/docs/chronicles/roadmap.md`, `docs/memory_lab/`, `docs/` proposal RFCs, fork diff tools (`git remote`).
- **Content**: Evaluating unbuilt features, reading architectural proposals, inspecting upstream repository changes, comparing divergent fork paths, and planning feature implementations safely without scope creep.

#### 4.6 `airi-release-packaging-deploy`
- **Target Domain**: Shipping AIRI artifacts and deploying services — stable releases, electron-builder packaging, CI matrix, mobile packaging, Docker/docs deploys, edge-worker deploys.
- **Key Paths**: `release-tamagotchi.yml`, `apps/stage-tamagotchi/` (electron-builder config, `release:win`/`release:mac`), `apps/stage-pocket/` (Capacitor), `apps/stage-web/` (Docker/Pages), `apps/stage-edge/` (Cloudflare).
- **Content**: Version stamping/git-tag/notes workflow, SignPath code signing + Apple notarization (CSC_CONTENT/APPLE_ID), `latest*.yml` auto-update feeds, Android APK + iOS IPA via Capacitor, ghcr.io Docker images, GitHub Pages docs deployment, Cloudflare worker deploys, and gh CLI release-upload auth quirks.

---

### 🟠 Phase 5: Feature-Dense UI Surfaces

#### 5.1 `airi-desktop-chatbox`
- **Target Domain**: The desktop (stage-tamagotchi Electron) chat window as a whole: the `pages/chat.vue` hub, its hamburger Workspace Routes and the 9 sub-views (Chat View, Director's Monitor, World Bible, Studio, Media Library, Eternal Thread, Event Ledger, Notes, Rehearsal), the desktop composer host, chat message bubbles, toolbar strips, context menus, journal chips, grounding panel, ACT/Director-note bubbles — plus a concise map of the three (+1) distinct chatboxes (desktop, web/pocket portrait `MobileWhisperSheet`, web/pocket landscape `Layouts/InteractiveArea`, and WhisperDock as input-dock-only).
- **Key Paths**: `apps/stage-tamagotchi/src/renderer/pages/chat.vue`, `apps/stage-tamagotchi/src/renderer/components/chat/` (`chat_messages.vue`, `chat_director.vue`, `chat_world.vue`, `chat_studio.vue`, `chat_media.vue`, `chat_lifetime.vue`, `chat_event_log.vue`, `chat_notes.vue`, `chat_rehearsal.vue`), `apps/stage-tamagotchi/src/renderer/components/InteractiveArea.vue`, `packages/stage-ui/src/components/scenarios/chat/` (`history.vue`, `assistant-item.vue`, `user-item.vue`, `response-part.vue`, `tool-call-block.vue`, `DirectorNoteBubble.vue`, `WhisperDock.vue`, `WhisperComposerBar.vue`, `components/action-menu/index.vue`), `packages/stage-layouts/src/components/Widgets/ChatArea.vue`.
- **Content**: Desktop chatbox maintenance — Workspace Route/sub-view wiring (both duplicated inline arrays in `chat.vue`), text-vs-edit bubble rendering, Reka action-menu (copy/delete/edit/retry/fork/journal moment), image drag-and-drop, journal preview vs. moment modal, mood strip, Act token rendering, and which ingestion path each of the four surfaces uses. Pitfalls: per-window broadcast sync, `healMozibake` Unicode repair, eager `{ deep: true }` watchers on store data (Rosetta §16), `index: 0` tool-call field for bridged gateways, the `INVOKE_CHARACTER_FIRST` sentinel path.

#### 5.2 `airi-card-editor-wizard`
- **Target Domain**: AIRI Card Editor, Character Creation Wizard (9-tab guided flow suite: Identity, Cognition, Generation, Acting, Artistry, Modules, Proactivity, Tools, ProductionStudio), Card Import modal.
- **Key Paths**: `packages/stage-pages/src/pages/settings/airi-card/index.vue`, `guided.vue`, `tabs/`, `components/CardImportWizard.vue`; card data layer: `packages/stage-ui/src/stores/modules/airi-card.ts`.
- **Content**: Schema-driven tab navigation, Identity/Cognition/Generation/Acting/Artistry/Modules/Proactivity/Tools/ProductionStudio tab responsibilities, SillyTavern metadata mapping in the import wizard, and edit-vs-preview flows. Avoids re-saving the whole card during wizard edits (write only mutated `extensions.airi` slice).

#### 5.3 `airi-scenes-backgrounds`
- **Target Domain**: Stage background layers, scene style galleries, background picker dialogs, background store.
- **Key Paths**: `packages/stage-ui/src/components/scenes/RendererStage.vue`, `packages/stage-ui/src/components/scenarios/dialogs/stage-background-picker/StageBackgroundPicker.vue`, `packages/stage-pages/src/pages/settings/scene/index.vue`, `packages/stage-ui/src/stores/background.ts` (localforage `bg-{nanoid}` + `airi:background-sync`).
- **Content**: Layer ordering vs. stage model (`Z` offsets), picker dialog flows, per-card `activeBackgroundId`, background-store storage/sync contract. Pitfall: background blobs are **not** in the `storage` outbox — reconciliation is handled by `reconcileBackgrounds()` in the sync engine.

#### 5.4 `airi-dating-sim-engine`
- **Target Domain**: Dating Sim game layer, storyline presets, overlay UI, mood/intimacy state machine.
- **Key Paths**: `packages/stage-ui/src/stores/dating-sim.ts`, `packages/stage-ui/src/components/scenes/DatingSimOverlay.vue`, `StorySelectorModal.vue`, `constants/dating-sim/storylines.ts`.
- **Content**: Amagami-inspired mechanics — intimacy/tension/action points, mood state computation (`low/normal/high/max`), branching choices, storyline presets, motion/expression triggers. Pitfall: dating-sim state is **ephemeral localStorage** (not synced), and its system-prompt injections override `card.scenario` when active.

#### 5.5 `airi-artistry-comfyui-widgets`
- **Target Domain**: Image-generation widgets, ComfyUI bridge, `image_journal` tool, autonomous artistry.
- **Key Paths**: `apps/stage-tamagotchi/src/renderer/stores/tools/builtin/widgets.ts`, `image-journal.ts`; `apps/stage-tamagotchi/src/main/services/airi/widgets/` (`artistry-bridge.ts`, `providers/comfyui.ts`); `packages/stage-ui/src/stores/modules/artistry.ts`, `artistry-autonomous.ts`.
- **Content**: Widget window lifecycle (spawn/bg/inline), ComfyUI workflow selection, `image_journal` tool contracts, director-note grading loop. Pitfall: all widget→renderer events cross processes — match `airi:*` BroadcastChannel or Eventa contract exactly. Deep ComfyUI protocol (upload rules, placeholder contract, endpoint surface, exposed-fields security boundary) is covered by peer skill `airi-comfyui-provider-bridge`.

#### 5.6 `airi-broadcast-channels`
- **Target Domain**: Cross-window `BroadcastChannel` relay registry (25+ channels) and multi-window state synchronization.
- **Key Paths**: `grep -r "useBroadcastChannel" packages/ apps/` (channel names source of truth), plus Rosetta §13.
- **Content**: Complete channel registry with publisher/subscriber roles, message payloads, and lifecycle. Pitfall: two API styles coexist — `useBroadcastChannel` (VueUse) and raw `new BroadcastChannel`; naming is inconsistent (`airi-kebab` / `airi:snake` / odd `airi::beat-sync` double-colon); adding a channel requires registering payload types in every consuming window. **Canonical registry lives in `docs/rosetta-stone.md` §13** (now verified against 28 channels in source) — this skill references and explains those channels rather than re-listing them, and must keep Rosetta §13 updated when a channel is added or removed.

#### 5.7 `airi-modular-outfits-system`
- **Target Domain**: Character `outfits` in the `AiriExtension` schema, Live2D/VRM costume variants, and visual-asset manifestations.
- **Key Paths**: `packages/stage-ui/src/types/card.schema.ts` (`outfits` field), `packages/stage-ui/src/stores/modules/airi-card.ts`, `docs/design-modular-outfits-system.md`, `docs/project-live2d-multimoc-changecos-design.md`.
- **Content**: `AiriOutfit` structure, outfit→display-model and outfit→visual_asset manifestation mapping, and how outfit switching propagates through the card and renderer. Pitfalls: not a standalone store — it rides on the card schema (Phase 1.5) and Live2D/VRM rendering (Phase 2.1). Cross-link to both.

#### 5.8 `airi-provider-ui-pages`
- **Target Domain**: Provider Settings UI Pages, Category Cards, Inline Configuration Panels & Validation Composables.
- **Key Paths**: `packages/stage-pages/src/pages/settings/providers/` (`chat/`, `speech/`, `transcription/`, `vision/`, `embed/`), `packages/stage-ui/src/components/scenarios/providers/provider-settings-layout.vue`, `packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/step-provider-configuration.vue`, `packages/stage-ui/src/composables/use-provider-validation.ts`.
- **Content**: Provider settings UI panels, category filtering (chat, speech, transcription, vision, embed), inline credential forms in onboarding vs full settings pages, and live connection testing with `useProviderValidation`.

#### 5.9 `airi-vrm-vhack-studio`
- **Target Domain**: V-HACK DevTools & Live VRM Binary Modding Studio.
- **Key Paths**: `docs/vhack-design-doc.md`, `packages/stage-ui/src/components/scenarios/settings/model-settings/vrm-vhack/` (`HackerPanel.vue`), `packages/stage-ui/src/stores/vhack.ts`.
- **Content**: In-memory Three.js VRM material inspector (`_RimWidth`, `_ShadeShift`), Texture Deck hot-swapper, glTF JSON / GLB byte-level repacker, and AI UV map generation via Artistry.

#### 5.10 `airi-memory-ui-pages`
- **Target Domain**: Memory Settings Control Hub UI Surface.
- **Key Paths**: `docs/memory_lab/memory-settings-home-page-plan.md`, `packages/stage-pages/src/pages/settings/modules/memory-short-term.vue`.
- **Content**: Maintaining `Settings > Memory` 4-lane control hub (Short-Term Memory, Long-Term Memory, Lifetime Archive, Chips/LTMM Artifacts), top contract status strips, lane budget controls, manual session rebuild triggers, and memory artifact preview cards.

#### 5.11 `airi-animadex-wizard`
- **Target Domain**: The AnimaDex Wizard — 4-step cast-to-card guided synthesis (bundled 36k-character tuple catalog, sticky character-bindings localStorage map, model auto-linking, LLM voice/story/synthesis pipelines, multi-actor card assembly).
- **Key Paths**: `packages/stage-pages/src/pages/settings/airi-card/guided.vue` (1929-line monolith, mapped with line anchors), `packages/stage-ui/src/stores/animadex-wizard.ts`, `packages/stage-ui/src/stores/custom-characters.ts`, `packages/stage-ui/src/components/scenarios/dialogs/model-selector/model-selector.vue` (`runAutoLinkCatalog`), `packages/stage-pages/src/pages/settings/airi-card/components/AutoVoiceConfigModal.vue` / `CustomCharacterModal.vue` / `VoiceCreatorModal.vue`, `packages/stage-ui/src/assets/animadex-catalog.json`.
- **Content**: Catalog tuple contract (`[id, copyrightIdx, name, trigger, tags, traits]`) and its consumers (load, autocomplete, Jaccard auto-link @ ≥0.3, blacklist), the `settings/airi-card/character-bindings*` sticky maps, Step-1 surface anatomy (search, chip filters, Has-Model toggle, custom characters with BLIP auto-tagging, World Dock hotbar), Step-2 roster binding (prefill from bindings map, model/voice pickers, AutoVoiceConfigModal LLM voice + idle-animation assignment), Step-3 story suggester (trope templates, `{Name}` placeholder substitution from user-profile settings, BrainModelPicker sourcing), Step-4 synthesis (deterministic 4-copy actor-slug keys, keyed-ACT-tag rules, mock-fallback dashboard, `doCreateCard` order-of-operations and CC-v3 card shape), and cross-cutting pitfalls (bindings map is localStorage-only, not BYOS-synced; tuple indices are load-bearing). Peer skills: `airi-card-editor-wizard`, `airi-card-schema`, `airi-acting-cue-act-tokens`.

#### 5.12 `airi-comfyui-provider-bridge`
- **Target Domain**: ComfyUI local image-generation backend — provider execution protocol, workflow upload/annotation UX, placeholder contract, endpoint surface, and its position as a generic `ArtistryProvider` peer to remote backends.
- **Key Paths**: `apps/stage-tamagotchi/src/main/services/airi/widgets/providers/comfyui.ts` (391-line provider), `providers/base.ts`; `packages/stage-pages/src/pages/settings/providers/artistry/comfyui.vue` (734-line settings UI); `packages/stage-ui/src/stores/modules/artistry.ts` (`ComfyUIWorkflowTemplate`, `artistry-comfyui-*` keys); `packages/stage-shared/src/artistry.ts` (`artistryComfyHealthCheck`); `generateComfyUIWeb` in `packages/stage-ui/src/stores/modules/artistry-autonomous.ts:294`.
- **Content**: API-format-only upload rule (`File > Export (API)`), prompt/image target annotation (link-array exclusion, smart auto-select, `{{IMAGE}}` burned into saved JSON at save time), template resolution order (`extra.template` > `model` > `activeWorkflowId`), `{{PROMPT}}` opt-out of auto-injection, endpoint surface (`POST /prompt` 30s, `GET /history` 5s poll/10min timeout + 1s empty-outputs race retry, `GET /view`, `POST /upload/image` `vhack_{ts}.png`, `GET /system_stats`), and the exposed-fields-only security boundary (`comfyui.ts:314-315`). Pitfalls: unexposed overrides silently dropped by design; web fallback diverges (3s/5min, `text`-only injection, no `{{IMAGE}}`). Peer skills: `airi-artistry-comfyui-widgets`, `airi-card-schema`.

#### 5.13 `airi-gateway-websocket-protocol`
- **Target Domain**: Local WebSocket Gateway & Channel Server Protocol.
- **Key Paths**: `apps/stage-tamagotchi/src/main/services/airi/channel-server/index.ts`, `apps/stage-tamagotchi/src/shared/eventa.ts`, `packages/server-runtime/src/server/index.ts`, `docs/arch-gateway-security-hardening.md`.
- **Content**: Electron main-process channel server on port `6121` (`SERVER_CHANNEL_PORT`), mandatory cryptographic `authToken` handshake, auto-healing `server-channel/config.json`, loopback (`127.0.0.1`) vs LAN (`0.0.0.0`) binding, mkcert TLS certificate management, and pairing with mobile (`stage-pocket`) / extension clients.

#### 5.14 `airi-docs-site-maintenance`
- **Target Domain**: Documentation Website Pipeline & Single-Source-of-Truth Sync.
- **Key Paths**: `docs/shared-sidebar.ts`, `docs/.vitepress/config.ts`, `docs/content/en/`, `docs/content/ja/`, `docs/content/zh-Hans/`.
- **Content**: VitePress documentation setup, `shared-sidebar.ts` single-source-of-truth syncing across web and in-app viewers, multi-locale synchronization, Markdown frontmatter standards, asset resolution rules, and strict separation between technical root docs (`docs/*.md`) and public user-facing guides (`docs/content/`).

---

## 4. Execution Roadmap Summary

| Phase | Target Scope | Output Skills | Count |
|---|---|---|---|
| **Phase 1** | Core Plumbing, IPC, Data Persistence, Providers, Cards, Cloud Relay, BYOS Sync, Gateway | `airi-app-entry-wiring`, `airi-ipc-eventa`, `airi-data-persistence`, `airi-provider-core-registry`, `airi-provider-store-instances`, `airi-card-schema`, `airi-cloud-relay-infrastructure`, `airi-byos-cloud-sync`, `airi-gateway-websocket-protocol` | 9 |
| **Phase 2** | Character Rendering (VRM/Live2D/Spine/MMD), Audio, Local Inference, Motion, Sensing, Model/Control-Strip Customizers, Captions, Stage-Mate | `airi-character-rendering`, `airi-audio-pipeline`, `airi-local-inference-engines`, `airi-stage-ui-surfaces`, `airi-live2d-dsl-interpreter`, `airi-generative-motion-vrma`, `airi-attention-ecology-vision`, `airi-model-customizer`, `airi-controlstrip-customizer`, `airi-caption-subsystem`, `airi-stage-mate-unity` | 11 |
| **Phase 3** | Onboarding V2, MCP, Discord, Memory Engine, Gemini Live, Proactivity, Interaction Pipelines, Memory Pillars, ACT Tokens | `airi-onboarding-v2`, `airi-mcp-integration`, `airi-discord-integration`, `airi-memory-systems`, `airi-prompt-builder-engine`, `airi-gemini-live-api`, `airi-proactivity-sensory-telemetry`, `airi-memory-retrieval-engine`, `airi-memory-consolidation-dreaming`, `airi-interaction-pipelines`, `airi-llm-dispatch-gateway`, `airi-tool-registry-builtin-tools`, `airi-memory-chat-sessions`, `airi-memory-text-journal`, `airi-memory-short-term`, `airi-memory-echo-chips`, `airi-memory-lifetime`, `airi-memory-image-journal`, `airi-memory-event-log`, `airi-memory-provisioning`, `airi-acting-cue-act-tokens` | 21 |
| **Phase 4** | i18n Localization, Binary Safety, Verification SOPs, Prefix Cache, Upstream Research, Release & Deploy, Docs Site | `airi-i18n-localization`, `airi-binary-safety`, `airi-codebase-verification`, `airi-prefix-cache-alignment`, `airi-roadmap-upstream-research`, `airi-release-packaging-deploy`, `airi-docs-site-maintenance` | 7 |
| **Phase 5** | Feature-Dense UI Surfaces (Chatbox, Wizard, Scenes, Dating Sim, Memory UI, V-HACK, AnimaDex) | `airi-desktop-chatbox`, `airi-card-editor-wizard`, `airi-scenes-backgrounds`, `airi-dating-sim-engine`, `airi-artistry-comfyui-widgets`, `airi-comfyui-provider-bridge`, `airi-broadcast-channels`, `airi-modular-outfits-system`, `airi-provider-ui-pages`, `airi-vrm-vhack-studio`, `airi-memory-ui-pages`, `airi-animadex-wizard` | 12 |
| | **TOTAL** | | **60** |

> **Phasing note.** Phases 1–4 remain the dependency-ordered build sequence (plumbing → rendering → modules → SOPs). **Phase 5 skills depend on Phases 1–3** (they reference the card schema, rendering engines, and provider/memory stores) and should be authored **after** the foundations they link to are stable, so their "Surface Map / State & Store Map" sections can accurately deep-link the underlying skills. Interleave them: author Phase 5 entries in parallel with, or immediately after, their Phase 1–3 dependencies rather than as a strictly serial fifth batch.

## Relevant Skills

- [[airi-codebase-verification]]
- [[airi-roadmap-upstream-research]]
