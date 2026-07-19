# AIRI Rosetta Stone

Concept-to-file-path index for rapid context retrieval. Use this to find where anything lives — UI, data, providers, modules, audio, memory, or the integration plumbing between them.

---

## 1. Application Entry & Wiring

| Concept | Path | Notes |
| :--- | :--- | :--- |
| **DI composition root** | `apps/stage-tamagotchi/src/main/index.ts` | Where services are injected via `injeca`. Start here to trace how a service gets wired. |
| **Eventa IPC contract** | `apps/stage-tamagotchi/src/shared/eventa.ts` | All typed IPC/RPC event definitions between main and renderer. |
| **Window managers** | `apps/stage-tamagotchi/src/main/windows/` | One dir per window: `main/`, `stage/`, `chat/`, `caption/`, `widgets/`, `settings/` |
| **Renderer bootstrap** | `apps/stage-tamagotchi/src/renderer/` | `App.vue`, `router.ts`, layouts at `layouts/settings.vue` |
| **Renderer build config** | `apps/stage-tamagotchi/electron.vite.config.ts` | Vite config + route definitions for the Electron renderer |
| **Web app entry** | `apps/stage-web/src/App.vue` | `pages/`, `layouts/`; router config via `vite.config.ts` |
| **Main process services** | `apps/stage-tamagotchi/src/main/services/airi/` | discord, widgets (comfyui, artistry-bridge), mcp-servers |

---

## 2. Core UI & Surfaces

| Concept | Path |
| :--- | :--- |
| **Control Strip (Main Window)** | `apps/stage-tamagotchi/src/main/windows/main/index.ts` (Electron) | `packages/stage-ui/src/components/scenarios/layout/ControlStrip.vue` (UI) |
| **Actor Stage (Floating Island)** | `apps/stage-tamagotchi/src/main/windows/stage/index.ts` (Electron) | `packages/stage-ui/src/components/scenes/Stage.vue` (UI) |
| **Chatbox Window** | `apps/stage-tamagotchi/src/main/windows/chat/index.ts` (Electron) | `apps/stage-tamagotchi/src/renderer/pages/chat.vue` (UI) | `apps/stage-tamagotchi/src/renderer/components/InteractiveArea.vue` (Host) |
| **Control Island (Original)** | `apps/stage-tamagotchi/src/renderer/components/stage-islands/controls-island/index.vue` |
| **Gemini Control Island** | `apps/stage-tamagotchi/src/renderer/components/stage-islands/controls-island/gemini-controls.vue` |
| **Whisperbox (Input)** | `packages/stage-ui/src/components/scenarios/chat/WhisperDock.vue` |
| **Resource Island** | `apps/stage-tamagotchi/src/renderer/components/stage-islands/resource-status-island/index.vue` |
| **VRM Character** | `packages/stage-ui-three/src/components/Model/VRMModel.vue` |
| **Live2D Character** | `packages/stage-ui-live2d/src/components/scenes/live2d/Canvas.vue` |
| **Spine Character** | `packages/stage-ui-spine/src/components/scenes/Spine.vue` | `packages/stage-ui-spine/src/components/scenes/spine/Model.vue` |
| **MMD Character** | `packages/stage-ui-mmd/src/components/scenes/MMD.vue` | `packages/stage-ui-mmd/src/components/scenes/mmd/Model.vue` |
| **Gemini Panel** | `apps/stage-tamagotchi/src/renderer/pages/notice/gemini.vue` (UI) | `packages/stage-ui/src/stores/modules/live-session.ts` (Bidi WebSocket) |
| **System Tray** | `apps/stage-tamagotchi/src/main/tray/index.ts` |
| **Caption Overlay** | `apps/stage-tamagotchi/src/renderer/pages/caption.vue` (UI) | `apps/stage-tamagotchi/src/main/windows/caption/` (Manager) |
| **Widgets Host** | `apps/stage-tamagotchi/src/renderer/pages/widgets.vue` | `apps/stage-tamagotchi/src/main/windows/widgets/index.ts` (Manager) |

---

## 3. Settings & Editing

| Concept | Path |
| :--- | :--- |
| **AIRI Card Editor** | `packages/stage-pages/src/pages/settings/airi-card/index.vue` |
| — Identity Tab | `.../tabs/CardCreationTabIdentity.vue` |
| — Behavior Tab | `.../tabs/CardCreationTabBehavior.vue` |
| — Generation Tab | `.../tabs/CardCreationTabGeneration.vue` |
| — Acting Tab | `.../tabs/CardCreationTabActing.vue` |
| — Artistry Tab | `.../tabs/CardCreationTabArtistry.vue` |
| — Modules Tab | `.../tabs/CardCreationTabModules.vue` |
| — Proactivity Tab | `.../tabs/CardCreationTabProactivity.vue` |
| **Vision Settings** | `packages/stage-pages/src/pages/settings/modules/vision.vue` | `visionStore` |
| **Module Settings Pages** | `packages/stage-pages/src/pages/settings/modules/` |
| **Provider Config Pages** | `packages/stage-pages/src/pages/settings/providers/` |
| **Docs Viewer Sidebar** | `apps/stage-tamagotchi/src/renderer/constants/docs-sidebar.ts` |
| **Docs Viewer Router** | `apps/stage-tamagotchi/src/renderer/pages/settings/docs/[...path].vue` |

---

## 4. Chatbox Elements

| Concept | Path |
| :--- | :--- |
| **Chat History (Host)** | `packages/stage-ui/src/components/scenarios/chat/history.vue` |
| **Assistant Bubble** | `packages/stage-ui/src/components/scenarios/chat/assistant-item.vue` |
| **User Bubble** | `packages/stage-ui/src/components/scenarios/chat/user-item.vue` |
| **Bubble Actions Menu** | `packages/stage-ui/src/components/scenarios/chat/components/action-menu/index.vue` — Reka-based right-click/long-press menu offering copy, delete, edit, retry, fork, and journal moment options |
| **Bubble Render Parts** | `packages/stage-ui/src/components/scenarios/chat/response-part.vue` (Text) | `packages/stage-ui/src/components/scenarios/chat/tool-call-block.vue` (Tools) |
| **Director Note Bubble** | `packages/stage-ui/src/components/scenarios/chat/DirectorNoteBubble.vue` |
| **Chat Layout (Widget)** | `packages/stage-layouts/src/components/Widgets/ChatArea.vue` — main chat container, ACT bubble styling, image attachment state |
| **Journal Strip (Chips)** | `apps/stage-tamagotchi/src/renderer/components/InteractiveArea.vue` — scrollable image/text/episode previews |
| **Mood / Vibe Indicator** | `apps/stage-tamagotchi/src/renderer/components/InteractiveArea.vue` — emotional baseline display |
| **Toolbar Strip** | `apps/stage-tamagotchi/src/renderer/components/InteractiveArea.vue` — buttons: Grounding, Memory, Trash, Send |
| **Image Attachments (Drop Zone)** | `packages/ui/src/components/form/textarea/basic-text-area.vue` — file drop handling |

---

## 5. Data Layer & Persistence

The canonical reference for every storage key, type, and sync behavior is **[`docs/data-catalog.md`](./data-catalog.md)**. Below are the key entry points.

### Architecture
- **Unified storage layer**: `packages/stage-ui/src/database/storage.ts` — `unstorage` with two IndexedDB mounts (`local:` for data, `outbox:` for sync queue). All writes automatically enqueue sync operations.
- **Database repos**: `packages/stage-ui/src/database/repos/` — one file per domain (characters, chat sessions, text journal, short-term memory, lifetime memory, provisioning sessions, echo chips, director notes, providers).

### Key Namespaces (quick reference)
| Namespace | Stores | Sync Behavior |
| :--- | :--- | :--- |
| `local:airi-cards` | All character cards | Merged per-card by timestamp |
| `local:chat/sessions/{id}` | Full chat records | Merged messages + conflict detection |
| `local:chat/index/{userId}` | Session index (organized by character) | Merged per-session |
| `local:memory/text-journal/{userId}` | Long-term memory entries | Merged by ID |
| `local:memory/short-term/{userId}` | Daily summary blocks | Merged by ID |
| `local:memory/lifetime/{characterId}` | Eternal thread artifacts | Full LWW |
| `local:memory/echo-chips/{userId}` | Semantic bursts | Merged by ID |
| `local:director/sessions/{id}` | Director notes | Full LWW, conflict-protected |
| `local:characters` | Community character catalog | Full LWW |
| `local:providers` | Provider configurations | Full LWW |
| `local:sync-metadata/*` | Internal sync tracking | Skipped by sync |

### Binary Assets (localforage — separate IndexedDB)
| Asset | Key Pattern | Store File |
| :--- | :--- | :--- |
| Background images | `bg-{nanoid}` | `packages/stage-ui/src/stores/background.ts` |
| Display models (VRM/Live2D/Spine/MMD) | `display-model-{nanoid}` | `packages/stage-ui/src/stores/display-models.ts` |
| Stickers | `sticker-data-{id}` | `packages/stage-ui/src/stores/stickers.ts` |
| Custom VRM animations | `custom-vrma-animation-{id}` | `packages/stage-ui-three/src/stores/custom-vrm-animations.ts` |

### Sync Engine
- **Orchestrator**: `packages/stage-ui/src/stores/sync-engine.ts` — `StorageClient` interface, merge logic, reconciliation for backgrounds and models.
- **Storage backends**: `ElectronFSClient` (local filesystem) and `S3StorageClient` (S3-compatible, including R2).

---

## 6. Provider System

The provider architecture lets TTS, LLM, STT, vision, and image generation backends be registered as interchangeable "providers."

For a complete, categorized index of every registered provider, see **[`docs/provider-catalog.md`](./provider-catalog.md)**.

> **Restructuring status:** Provider metadata is still mostly inline in `providers.ts`. Phase 1 extraction is documented in [`docs/project-provider-store-restructuring-plan.md`](./project-provider-store-restructuring-plan.md) — the plan for splitting metadata into dedicated files by provider family. See also [`docs/content/en/docs/advanced/architecture/arch-provider-store-current-structure.md`](./content/en/docs/advanced/architecture/arch-provider-store-current-structure.md) for the current architecture.

### Core Files
| Concept | Path |
| :--- | :--- |
| **Provider registry** | `packages/stage-ui/src/stores/providers.ts` — central catalog where every provider is registered via `defineProvider()`. |
| **Provider type definitions** | `packages/stage-ui/src/stores/providers/types.ts` — `ProviderMetadata`, `ModelInfo`, `VoiceInfo`, `VoiceProfile`, `SpeechCapabilitiesInfo`, `ProviderRuntimeState`. |
| **Provider store** | `packages/stage-ui/src/database/repos/providers.repo.ts` — persists provider configs as `local:providers`. |

### Provider Contract
Every provider implements this shape (defined in `providers.ts`):
```typescript
interface ProviderMetadata {
  id: string
  category: 'chat' | 'embed' | 'speech' | 'transcription' | 'vision'
  tasks: string[]
  deployment: 'local' | 'cloud'
  defaultOptions: () => Record<string, unknown>
  createProvider: (config) => Provider | Promise<Provider>
  capabilities: {
    listModels?: (config) => Promise<ModelInfo[]>
    listVoices?: (config) => Promise<VoiceInfo[]>
    loadModel?: (config, hooks?) => Promise<void>
    getSpeechCapabilities?: (config) => Promise<SpeechCapabilitiesInfo | null>
    supportsSSML?: boolean
    supportsPitch?: boolean
  }
  validators: {
    validateProviderConfig: (config) => Promise<ProviderValidationResult>
  }
}
```

### Inference Protocol (Local Models)
- **Protocol contract**: `packages/stage-ui/src/libs/inference/protocol.ts` — message types (`load-model`, `run-inference`, `cancel`, `unload-model`) and responses (`progress`, `model-ready`, `inference-result`, `error`).
- **Coordinator**: `packages/stage-ui/src/libs/inference/coordinator.ts` — serialized model loads via `getLoadQueue()`.
- **GPU Resource Coordinator**: `packages/stage-ui/src/libs/inference/gpu-resource-coordinator.ts` — VRAM bookkeeping, pressure telemetry, device-loss fallback.
- **WebGPU detection**: `packages/stage-shared/src/webgpu/detect.ts`.

### Local TTS Reference (Kokoro)
- **Worker**: `packages/stage-ui/src/workers/kokoro/worker.ts`
- **Adapter**: `packages/stage-ui/src/libs/inference/adapters/kokoro.ts` — uses load queue, GPU coordinator, device-loss promotion.
- **Provider page**: `packages/stage-pages/src/pages/settings/providers/speech/kokoro-local.vue`

---

## 7. Module System

AIRI's "modules" are feature domains stored in `packages/stage-ui/src/stores/modules/`. They come in two flavors:

### Card-Embedded Modules
These are serialized inside the AIRI card (`extensions.airi`) and travel with the character profile.

| Module | Store File | Config Location |
| :--- | :--- | :--- |
| **Consciousness (LLM)** | `packages/stage-ui/src/stores/modules/consciousness.ts` | `extensions.airi.modules.consciousness` (provider, model) |
| **Speech (TTS)** | `packages/stage-ui/src/stores/modules/speech.ts` | `extensions.airi.modules.speech` (provider, model, voice_id, pitch, rate, ssml, language) |
| **VRM** | (card editor only) | `extensions.airi.modules.vrm` (source: file/url) |
| **Live2D** | (card editor only) | `extensions.airi.modules.live2d` (source, expressions, model params, motion mappings) |
| **Artistry (Image Gen)** | `packages/stage-ui/src/stores/modules/artistry.ts` | `extensions.airi.artistry` (provider, model, prompt, spawnMode, autonomous) |
| **Generation** | (card editor only) | `extensions.airi.generation` (maxTokens, temperature, topP, contextWidth, compaction) |
| **Acting** | (card editor only) | `extensions.airi.acting` (modelExpressionPrompt, speechExpressionPrompt, idleAnimations) |
| **Heartbeats / Proactivity** | `packages/stage-ui/src/stores/proactivity.ts` (runtime) | `extensions.airi.heartbeats` (interval, prompt, schedule) |
| **Short-Term Memory** | `packages/stage-ui/src/stores/memory-short-term.ts` (runtime) | `extensions.airi.shortTermMemory` (windowSize, tokenBudgetPerDay) |

### Standalone Modules
These use `localStorage` for settings and are **not** serialized inside the AIRI card.

| Module | Store File | Settings Page | Settings Key |
| :--- | :--- | :--- | :--- |
| **Hearing (STT)** | `packages/stage-ui/src/stores/modules/hearing.ts` | `modules/hearing.vue` | `settings/hearing/*` |
| **Vision (VLM)** | `packages/stage-ui/src/stores/modules/vision.ts` | `modules/vision.vue` | `settings/vision/*` |
| **Discord** | `packages/stage-ui/src/stores/modules/discord.ts` | `modules/messaging-discord.vue` | `settings/discord/*` |
| **Twitter** | `packages/stage-ui/src/stores/modules/twitter.ts` | — | `settings/twitter/*` |
| **Live Session (Gemini)** | `packages/stage-ui/src/stores/modules/live-session.ts` | `notice/gemini.vue` | `settings/gemini/*` |
| **Artistry Autonomous** | `packages/stage-ui/src/stores/modules/artistry-autonomous.ts` | — | in-memory (director notes in IndexedDB) |
| **Gaming: Minecraft** | `packages/stage-ui/src/stores/modules/gaming-minecraft.ts` | — | `settings/minecraft/*` |
| **Gaming: Factorio** | `packages/stage-ui/src/stores/modules/gaming-factorio.ts` | — | `settings/factorio/*` |

### Module Wiring Pattern
Each module typically follows:
1. A **Pinia store** in `stores/modules/` with `useLocalStorage`-backed settings (or IndexedDB via `storage`)
2. A **provider adapter** in the provider system (for LLM/TTS/STT/Vision modules)
3. A **settings page** in `packages/stage-pages/src/pages/settings/modules/`
4. For card-embedded modules: a slot in `extensions.airi.*` inside `AiriExtension`

---

## 8. Audio Pipeline

### TTS Flow (Output)
```
LLM output text → VoiceProfile (effects + UST transforms) → SpeechProvider.speech().fetch() → Worker inference → PCM → WAV → Playback
```

### STT Flow (Input)
```
Microphone → VadDetector → AudioBuffer → STTProvider inference → text → chatOrchestrator.ingest
```

### Key Files
| Concept | Path |
| :--- | :--- |
| **Speech provider selection** | `packages/stage-ui/src/stores/modules/speech.ts` — active provider, model, voice, pitch, rate, SSML, language |
| **Hearing provider selection** | `packages/stage-ui/src/stores/modules/hearing.ts` — active provider, model, auto-send, detection mode (VAD/manual), device settings |
| **Speech runtime** | `packages/stage-ui/src/stores/speech-runtime.ts` — wraps `createSpeechPipelineRuntime()` |
| **Audio context / character speaking** | `packages/stage-ui/src/stores/audio.ts` — `audio-context` and `character-speaking` stores |
| **Audio input devices** | `packages/stage-ui/src/stores/settings/audio-device.ts` |
| **Voice profiles** | `settings/speech/voice-profiles` (localStorage) — `VoiceProfile[]` with effects (pitch, rate, volume, equalizer, ASMR, radio, robot, reverb, spatial) and UST (universal speech transformer) config |
| **UST processing** | Packaged within the provider fetch flow — strips asterisks, mutes narrative brackets, replaces tildes, strips emojis before text reaches TTS |
| **Audio Studio** | [`feat-audio-studio.md`](./feat-audio-studio.md) — full spec for the voice profile management UI |
| **Kokoro worker** | `packages/stage-ui/src/workers/kokoro/worker.ts` — reference local TTS implementation |
| **Kokoro adapter** | `packages/stage-ui/src/libs/inference/adapters/kokoro.ts` — load queue, GPU coordinator, device-loss promotion, WAV encoding |
| **Whisper worker** | `packages/stage-ui/src/workers/whisper/` — reference local STT implementation |
| **Whisper adapter** | `packages/stage-ui/src/libs/inference/adapters/whisper.ts` |
| **Audio Studio UST proposal** | [`proposal-higgs-audio-v3-tts-integration.md`](./proposal-higgs-audio-v3-tts-integration.md) |
| **MOSS-TTS-Nano proposal** | [`proposal-moss-tts-nano-provider-unified-webgpu.md`](./proposal-moss-tts-nano-provider-unified-webgpu.md) |
| **Audio pipelines (transcribe)** | `packages/audio-pipelines-transcribe/` — audio transcription pipeline implementations |
| **Audio pipelines (general)** | `packages/pipelines-audio/` — general audio pipeline utilities |
| **Model drivers** | `packages/model-driver-lipsync/` (lipsync) | `packages/model-driver-mediapipe/` (face/body tracking) |

---

## 9. Memory Systems

### Long-Term Memory (Text Journal)
- **Store**: `packages/stage-ui/src/stores/memory-text-journal.ts`
- **Repo**: `packages/stage-ui/src/database/repos/text-journal.repo.ts` — `local:memory/text-journal/{userId}`
- **Tool integration**: `apps/stage-tamagotchi/src/renderer/stores/tools/builtin/text-journal.ts` — exposes `create` and `search` actions to the LLM
- **Search index**: `packages/stage-ui/src/libs/search/layered-memory.ts` — `Transformers.js` / Orama / Voy, stored in separate `airi-search-index` IndexedDB

### Short-Term Memory (Daily Summaries)
- **Store**: `packages/stage-ui/src/stores/memory-short-term.ts`
- **Repo**: `packages/stage-ui/src/database/repos/short-term-memory.repo.ts` — `local:memory/short-term/{userId}`
- **Settings**: `packages/stage-pages/src/pages/settings/modules/memory-short-term.vue`
- **Config**: `extensions.airi.shortTermMemory` — `windowSize` (default 3) and `tokenBudgetPerDay` (default 1000)
- **Rebuilding**: `rebuildFromHistory()` and `rebuildToday()` process daily buckets scoped to the character's `tokenBudgetPerDay`

### Lifetime Memory (Eternal Thread)
- **Store**: `packages/stage-ui/src/stores/memory-lifetime.ts`
- **Repo**: `packages/stage-ui/src/database/repos/lifetime-memory.repo.ts`
- **Provisioning session repo**: `packages/stage-ui/src/database/repos/provisioning-session.repo.ts`
- **Pipeline**:
  1. `collectSourceDocs()` aggregates data across three tiers: raw turn history (`chatSessionsRepo`), short-term memory blocks (`shortTermMemoryRepo`), long-term journal entries (`textJournalRepo`)
  2. Chunking processes documents in chunks defined by `contextLimitTokens` (~64K tokens default), extracting key facts using `ChunkArchiveJsonSchema`
  3. Base synthesis flattens facts and writes the first canonical profile via `buildBaseArchivePrompt` with `LifetimeArchiveJsonSchema`
  4. **Pass 1 (Dedupe & Core Framing)**: Compresses base content into bullet lists using `DistillPass1Schema`; desired bullet counts scaled dynamically by `ratio = targetTokens / 1000`
  5. **Pass 2 (Caveman Refinement)**: Final compaction to `targetTokens`, removing articles/pleasantries, pruning duplicates
- **Modals**: `packages/stage-pages/src/pages/settings/modules/components/LifetimeProvisioningModal.vue` | `LifetimeHistoryModal.vue`

### Echo Chips
- **Store**: `packages/stage-ui/src/stores/echo-chips.ts`
- **Repo**: `packages/stage-ui/src/database/repos/echo-chips.repo.ts` — `local:memory/echo-chips/{userId}`

### Director Notes
- **Repo**: `packages/stage-ui/src/database/repos/director-notes.repo.ts` — `local:director/sessions/{sessionId}`
- **Autonomous execution**: `packages/stage-ui/src/stores/modules/artistry-autonomous.ts`

### Proactivity / Heartbeats
- **Store**: `packages/stage-ui/src/stores/proactivity.ts` — idle heartbeat loop, sensor compilation, registered tool resolution

---

## 10. Engine & Subsystems

| Concept | Path |
| :--- | :--- |
| **ACT Pipeline (Parser)** | `packages/stage-ui/src/composables/use-llm-marker-parser.ts` |
| **ACT Pipeline (Execution)** | `packages/stage-ui-three/src/services/expression.ts` |
| **Artistry / ComfyUI** | `apps/stage-tamagotchi/src/main/services/airi/widgets/providers/comfyui.ts` |
| **Artistry Bridge** | `apps/stage-tamagotchi/src/main/services/airi/widgets/artistry-bridge.ts` |
| **Scene / Background Layer** | `packages/stage-ui/src/components/scenes/Stage.vue` (Layer) | `packages/stage-pages/src/pages/settings/scene/index.vue` (UI) |
| **Background Picker Dialog** | `packages/stage-ui/src/components/scenarios/dialogs/stage-background-picker/StageBackgroundPicker.vue` |
| **Image Journal Store** | `packages/stage-ui/src/stores/background.ts` |
| **Stage Style / Gallery** | `packages/stage-pages/src/pages/settings/scene/index.vue` |
| **Model Position / Lights** | `packages/stage-ui/src/components/scenarios/settings/model-settings/vrm.vue` |
| **Control Island State** | `packages/stage-ui/src/stores/settings/controls-island.ts` (Shared) | `apps/stage-tamagotchi/src/renderer/stores/controls-island.ts` (Renderer) |
| **VRM Animations** | `packages/stage-ui-three/src/assets/vrm/animations/index.ts` (Assets) | `packages/stage-ui-three/src/stores/model-store.ts` (State) |
| **Custom VRM Animations** | `packages/stage-ui-three/src/stores/custom-vrm-animations.ts` |
| **Spine Store** | `packages/stage-ui-spine/src/stores/spine.ts` — model loading, animation state |
| **MMD Store** | `packages/stage-ui-mmd/src/stores/mmd.ts` — model loading, animation state |
| **Character Artistry DNA** | `packages/stage-ui/src/constants/prompts/character-defaults.ts` |
| **STT / Microphone** | `apps/stage-tamagotchi/src/renderer/pages/index.vue` (Tamagotchi) | `apps/stage-web/src/pages/index.vue` (Web) |
| **Gemini Live (Bidi WebSocket)** | `packages/stage-ui/src/stores/modules/live-session.ts` |
| **LLM Meta-Tools** | `apps/stage-tamagotchi/src/renderer/stores/tools/builtin/` |
| **Multi-Step Tool Gating** | `packages/stage-ui/src/stores/llm.ts` — `maxSteps: 10` |

### System Prompt Builder

The "system prompt builder" is the composition layer that templates all the moving parts — character card fields, acting prompts, artistry instructions, memory context, and runtime overlays (like dating sim storyline guidance) — into a single system prompt at runtime.

| Concept | Path |
| :--- | :--- |
| **Core builder** | `packages/stage-ui/src/stores/modules/airi-card.ts` — `buildSystemPrompt()` (line 1170). Composes: `card.systemPrompt` + nickname + description + personality + scenario + greetings + acting prompts + artistry widget instruction + dating sim storyline (if active). Exported as computed `systemPrompt` on the store. |
| **Session enrichment** | `packages/stage-ui/src/stores/chat/session-store.ts` — `refreshActiveSystemMessage()` (line 745). Takes the base system prompt and further injects memory context (short-term summaries, lifetime memory), environmental awareness, and context awareness. Manages persona blocks (head + tail) to prevent prompt pollution across sessions. |
| **Short-term memory injection** | `packages/stage-ui/src/stores/chat/session-store.ts` — `buildShortTermMemoryContext()` (line 199). Slices daily summaries by `windowSize` and appends as hidden context. |
| **Dating sim hooks** | `packages/stage-ui/src/stores/modules/airi-card.ts` — `buildSystemPrompt()` checks `datingSimStore.enabled` and `activeStoryline`, then injects: storyline premise, character appearances for the story, scene/setting. Disables the default `card.scenario` when dating sim is active. |
| **Producer composables** | `packages/stage-ui/src/composables/use-producer.ts` — composes system prompts for interactive roleplay scenarios. |
| **Artistry autonomous** | `packages/stage-ui/src/stores/modules/artistry-autonomous.ts` — composes system prompts for visual interest grading. |
| **Memory lifetime** | `packages/stage-ui/src/stores/memory-lifetime.ts` — composes system prompts for the lifetime memory synthesis pipeline. |
| **Live session** | `packages/stage-ui/src/stores/modules/live-session.ts` — injects `systemPrompt` into Gemini Live WebSocket context. |

### Dating Sim Engine

A game layer on top of the Actor Stage with deep Live2D integration. Implements Amagami-inspired mechanics (intimacy, tension, action points, time-of-day) with branching choices, storyline presets, and mood-driven character reactions.

| Concept | Path |
| :--- | :--- |
| **Store** | `packages/stage-ui/src/stores/dating-sim.ts` — game state, variables, choices, settings, mood computation |
| **Overlay UI** | `packages/stage-ui/src/components/scenes/DatingSimOverlay.vue` — renders choices, subtitles, game HUD on stage |
| **Story Selector** | `packages/stage-ui/src/components/scenes/StorySelectorModal.vue` — curated storyline presets picker |
| **Storyline presets** | `packages/stage-ui/src/constants/dating-sim/storylines.ts` — preset definitions |
| **Settings page** | `packages/stage-pages/src/pages/settings/dating-sim.vue` |
| **Renderer Stage integration** | `packages/stage-ui/src/components/scenes/RendererStage.vue` — listens for dating-sim events (motion triggers, expression changes, costume swaps) |
| **Control Strip integration** | `packages/stage-ui/src/components/scenarios/layout/ControlStrip.vue` — adjusts stage size when dating sim is on/off |

**Key types:** `GamePhase` (`'idle' | 'conversation' | 'map' | 'action'`), `MoodState` (`'low' | 'normal' | 'high' | 'max'`), `Choice`

**Settings (localStorage):** `airi:dating-sim:game-mode` (`open_ended`/`goal_driven`), `airi:dating-sim:max-score`, `airi:dating-sim:max-turns-temp`, `airi:dating-sim:scenery-route`, `airi:dating-sim:show-choice-weights`, `airi:producer:context-depth`

---

## 11. Discord Integration

| Concept | Path |
| :--- | :--- |
| **Service (main process)** | `apps/stage-tamagotchi/src/main/services/airi/discord/index.ts` |
| **Slash command definitions** | `packages/stage-ui/src/stores/modules/discord.ts` (`COMMANDS_VERSION: 4`) |
| **Settings store** | `packages/stage-ui/src/stores/modules/discord.ts` |
| **Settings page** | `packages/stage-pages/src/pages/settings/modules/messaging-discord.vue` |
| **Vision plumbing** | Intercepts Discord attachments → `chatOrchestrator.ingest` as base64 |
| **Tool call availability** | Discord messages flow through the same `performSend` pipeline as desktop inputs. Tools are NOT passed explicitly by the Discord store, but `chat.ts:297` falls through to `toolsResolver.value` (set to `builtinTools` at `index.vue:728`). All built-in tools (text journal, widgets, stickers, MCP, dating sim) are available from Discord. The only exception is VLM turns (image attachments) — tools are stripped for all sources, not just Discord. |
| **Full spec** | [`feat-discord-revamp.md`](./feat-discord-revamp.md) |
| **Architecture doc** | `docs/content/en/docs/advanced/architecture/design-discord-bot-integration.md` |

---

## 12. MCP Architecture

| Concept | Path |
| :--- | :--- |
| **Config file** | `%AppData%/airi/mcp.json` (Electron `userData`) |
| **Electron service manager** | `apps/stage-tamagotchi/src/main/services/airi/mcp-servers/index.ts` — stdio connection, lifecycle, tool listing/delegation |
| **IPC Eventa contracts** | `electronMcpListTools`, `electronMcpCallTool` in `apps/stage-tamagotchi/src/shared/eventa.ts` |
| **Renderer bridge** | `packages/stage-ui/src/stores/mcp-tool-bridge.ts` — exposes `listTools()`, `callTool()`, `getRuntimeStatus()` cross-window via `window.__AIRI_MCP_BRIDGE__` |
| **Builtin meta-tools** | `apps/stage-tamagotchi/src/renderer/stores/tools/builtin/mcp.ts` — `mcp_list_tools`, `mcp_call_tool` |
| **Settings** | `packages/stage-ui/src/stores/mcp.ts` — server command, args, connected state |
| **Google Search Grounding (Gemini)** | `packages/stage-ui/src/stores/modules/live-session.ts` — conditioned on `isGroundingEnabled` |

---

## 13. BroadcastChannels

Cross-window communication relies on named `BroadcastChannel` instances. These are the channel names used across the app:

| Channel Name | Purpose |
| :--- | :--- |
| `airi-chat-input-bridge` | Ingestion pipeline — secondary windows post input to main window |
| `airi-chat-stream` | Streaming LLM text deltas across windows |
| `airi-caption-overlay` | Caption text relay to the overlay window |
| `airi:cards-sync` | AIRI card modifications across windows |
| `airi:background-sync` | Background image changes |
| `airi:display-models-sync` | Display model import/deletion |
| `airi:director-notes-sync` | Director note creation/archival (see §16) |
| `airi:short-term-memory-sync` | Short-term memory block updates |
| `airi:lifetime-memory-sync` | Lifetime memory artifact changes |
| `airi-stores-live2d` | VRM/Three.js store synchronization — broadcasts view updates, emotion triggers, and transient motion triggers across windows |
| `CHAT_STREAM_CHANNEL_NAME` | Chat stream + journal refresh events (exported constant from session-store) |

---

## 14. Key Directories

| Directory | Role |
| :--- | :--- |
| `packages/stage-ui` | Core business logic, components, Pinia stores, database layer, inference |
| `packages/stage-ui/src/stores/modules/` | All feature modules (consciousness, speech, hearing, vision, discord, artistry, etc.) |
| `packages/stage-ui/src/stores/chat/` | Chat-specific stores — session, stream, context, orchestrator |
| `packages/stage-ui/src/stores/providers/` | Provider adapter helpers and converters |
| `packages/stage-ui/src/database/` | `storage.ts` + `repos/` (persistence layer) |
| `packages/stage-ui/src/libs/inference/` | Protocol, coordinator, GPU resource tracking, per-model adapters |
| `packages/stage-ui/src/libs/search/` | Semantic search index (`layered-memory.ts`) |
| `packages/stage-ui/src/workers/` | Web Worker implementations (kokoro, whisper, moss-nano) |
| `packages/stage-ui/src/composables/` | Business-oriented Vue composables |
| `packages/stage-ui/src/components/scenarios/` | Scenario-specific UI components |
| `packages/stage-ui-three` | Three.js 3D rendering, VRM |
| `packages/stage-ui-live2d` | Live2D rendering |
| `packages/stage-ui-spine` | Spine rendering |
| `packages/stage-ui-mmd` | MMD/PMX rendering (MikuMikuDance) |
| `packages/stage-ui-three-performance-runtime` | Performance runtime for three.js |
| `packages/stage-pages` | Shared settings pages, card editor, module pages |
| `packages/stage-shared` | Constants (`emotions.ts`, `events.ts`), utilities (`text.ts` — `healMozibake`) |
| `packages/stage-layouts` | Layout components shared across apps |
| `packages/ui` | Primitive components built on reka-ui |
| `packages/i18n` | Central translations (YAML managed via `scripts/yaml-manager.js`) |
| `packages/audio-pipelines-transcribe/` | Audio transcription pipelines |
| `packages/model-driver-lipsync/` | Lipsync driver for model expressions |
| `packages/model-driver-mediapipe/` | MediaPipe driver for face/body tracking |
| `packages/plugin-protocol/` | Plugin protocol definitions |
| `packages/plugin-sdk/` | Plugin SDK for extensions |
| `packages/server-runtime/` | Server runtime (powers services/ and plugins/) |
| `packages/server-sdk/` | Server SDK |
| `packages/server-shared/` | Shared server types |
| `packages/stream-kit/` | Streaming utilities |
| `packages/electron-eventa/` | Electron Eventa bindings |
| `packages/font-*` | Font packages (allseto, departure-mono, xiaolai) |
| `apps/stage-tamagotchi` | Electron app (main + renderer) |
| `apps/stage-web` | Web app |
| `apps/stage-tamagotchi/src/renderer/stores/tools/builtin/` | LLM tool definitions exposed to the model |
| `apps/stage-tamagotchi/src/main/services/airi/` | Main process services (discord, widgets, MCP) |
| `scripts/` | Utility scripts (`yaml-manager.js`, `pr_summary.sh`) |
| `crates/` | Legacy Tauri desktop app (current desktop is Electron — ignore) |
| `docs/` | Proposal docs, reference sheets, how-to guides |
| `docs/content/en/docs/` | In-app manual content (vitepress) |
| `docs/design-prospective-rich-journal.md` | Specification for the Cognitive Memory / Dreaming UI ("the rich journal") |

---

## 15. Nicknames Index

| Nickname | Resolves To |
| :--- | :--- |
| **"chatbox"** | `ChatArea.vue` / `InteractiveArea.vue` / `renderer/pages/chat.vue` |
| **"control strip" / "the strip"** | `ControlStrip.vue` / `ControlStripHost.vue` (always-on-top status bar / mini-control tray) |
| **"the island" / "original island" / "og island"** | `controls-island/index.vue` |
| **"the floating widget" / "the standalone window" / "the tamagotchi"** | `Stage.vue` (Actor Stage Window) |
| **"the rich journal"** | `design-prospective-rich-journal.md` |
| **"dreaming"** | Memory consolidation via proactive idle tasks |
| **"vibe indicator"** | Emotional dashboard in the chatbox |
| **"pencil artistry"** | `CardCreationTabArtistry.vue` |
| **"the staging_widgets thing"** | `apps/stage-tamagotchi/src/renderer/stores/tools/builtin/widgets.ts` |
| **"the backends"** | `packages/stage-ui/src/stores/providers.ts` |
| **"the brain"** | `packages/stage-ui/src/stores/modules/` |
| **"chat bubble context menu"** | `action-menu/index.vue` |
| **"bubble layer" / "user bubble layer"** | `user-item.vue` |
| **"edit mode"** | Inline editing inside `user-item.vue` |
| **"system prompt builder"** | `buildSystemPrompt()` in `airi-card.ts` (core) + `refreshActiveSystemMessage()` in `session-store.ts` (enrichment). The composition layer that templates character card, acting, artistry, memory, and runtime overlays into the final system prompt. |

---

## 16. Lessons Learned

### Ingestion & Input Pipeline

- **Main vs. Secondary Windows**: The Main Window is the Control Strip (serving `/` or `#` route, where `isMainWindow` is `true`). Secondary windows (Chatbox `#/chat`, Actor Stage `#/actor`) are not the main window.
- **Fire-and-Forget Pitfall**: Input textareas in secondary windows call `chatStore.ingest`, which historically posted to the main window over `BroadcastChannel('airi-chat-input-bridge')`. If the main window was deadlocked or HMR-reloaded, the message was swallowed.
- **Verification Loop**: Each `ingest` generates a `clientMessageId`, returns a promise with a 5-second timeout watching for `session-updated` broadcasts. On timeout, the UI restores draft text and shows a toast.
- **Unicode Healing**: `healMozibake` in `packages/stage-shared/src/text.ts` repairs mis-decoded UTF-8 byte streams. Iterate by code point (`for (const char of text)`) not by index — supplementary plane characters (emojis, ZWJs) split into invalid surrogates under indexed access.
- **Shared Chat Composer logic**: The input ingestion pipelines for desktop layouts (`ChatArea.vue`) and mobile portrait views (`MobileInteractiveArea.vue`) are unified using the `useChatComposer` composable, ensuring synchronized attachments capabilities and safe chat error handling (preventing incorrect `.pop()` bugs when message ingestion rejections occur).

### Toast Notifications & Event Bridging

1. Renderer invokes `electronShowToast` (`defineInvokeEventa` in `shared/eventa.ts`).
2. Main process (`apps/stage-tamagotchi/src/main/index.ts`) handles it, targets the visible Chatbox (fallback: Actor Stage → Control Strip), and emits `electronShowToastEvent`.
3. Target window's `App.vue` listens and calls `toast()` from `vue-sonner`.
4. **Eventa Context Pitfall**: `targetWin.webContents.send('eventa:event:electron:show-toast', payload)` bypasses Eventa's serializer. Correct dispatch:
   ```typescript
   const { context, dispose } = createContext(ipcMain, targetWin)
   context.emit(electronShowToastEvent, payload)
   dispose()
   ```

### Autonomous Artistry & Director Notes Sync

- **Flow**: LLM turn triggers `runArtistTask` → Director LLM grades visual interest (1-100) → saves `DirectorNote` via `recordDirectorDecision()` → `history.vue` reactively merges notes with chat messages, sorted by `createdAt`, rendered by `DirectorNoteBubble.vue`.
- **Cross-Window Sync**: Pinia stores are per-window. Writing to IndexedDB from one window doesn't update in-memory state in others. Fix: broadcast modifications over `BroadcastChannel('airi:director-notes-sync')` — each store instance listens, filters by active `sessionId`, and updates locally.
