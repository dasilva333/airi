# AIRI Pending Items Catalog

This document tracks all active pending items, architectural roadmaps, and feature branches for the AIRI project, grouped by system layers. Completed items are removed to keep this document strictly focused on actionable and pending work.

---

## Core Infrastructure & Network Services

### Cloud & Sync Systems
*Reference: [project-byos-cloud-sync.md](../../../../../project-byos-cloud-sync.md)*
*   **Dropbox & Google Drive Storage Engines**: Extend database/asset storage options to natively support Dropbox and Google Drive as storage providers (in addition to existing S3/R2 and Local FS).
*   **Modular Token Lifecycle Management**: Implement automatic refresh handshakes for Dropbox/Google Drive OAuth integrations.

### Core-Agent Revamp (Apeira Runtime Integration)
*Reference: [proposal-core-agent-revamp.md](../../../../../proposal-core-agent-revamp.md)*
*   **Apeira Evaluation (Deferred / On Hold)**: Monitor and evaluate Apeira (v0.0.5+) as a potential lightweight replacement for `@proj-airi/core-agent` once codebase and persistence interfaces stabilize.
*   **Plugin Hooks Mapping**: Map fork-specific orchestration behaviors (e.g. autonomous artistry triggers, live session bidirectional audio) to Apeira's Plugin API.

### AnimaDex Character Creator Wizard
*References: [proposal-animadex-wizard.md](../../../../proposal-animadex-wizard.md) | [proposal-animadex-new-characters.md](../../../../proposal-animadex-new-characters.md)*
*   **AnimaDex Ad-hoc Cast Expansion (Dynamic Character Injection)**:
    *   Implement "Add Character" gallery selection and voice/model binding modal context.
    *   Build injection engine parsing and generation rules for Mode A (markers), Mode B (multi-actor tags), and Mode C (single-to-multi conversion).
    *   Support Step 4 review interface with choices for "Apply to Current Card (with Backup)" and "Create as New Card".

---

## Local Runtimes & Desktop Automation

### Local WebGPU RWKV Enhancements & State Cartridges
*References: [proposal-built-in-llm-webgpu.md](../../../../../proposal-built-in-llm-webgpu.md) | [project-rwkv-cleanroom-harness-plan.md](../../../../../project-rwkv-cleanroom-harness-plan.md) | [proposal-generative-code-painting-rwkv-webllm.md](../../../../../proposal-generative-code-painting-rwkv-webllm.md)*
*   **State Cartridge Loading & Ingestion**: Integrate verified cleanroom state loading (`scripts/tests/rwkv-harness/`) into the active WebGPU Web Worker (`packages/stage-ui/src/workers/web-rwkv/`). Enables loading modular `.state` files (e.g. bilingual roleplay, character personality cartridges, `p5-watercolor-1.5b.state`).
*   **Prompt Template & Model Selector**: Add a prompt template configuration selector and custom model URL input to allow power users to load arbitrary Hugging Face safetensors.

### Next-Gen Local Inference: Edge0 Dynamic MoE Streaming & MiniCPM-5 Starter Runtime
*Reference: [proposal-local-inference-edge0-minicpm.md](../../../../../proposal-local-inference-edge0-minicpm.md)*
*   **Tier 1: MiniCPM-5 2B (In-Browser Web Worker / WebLLM & ONNX Web)**: 100% in-browser WebGPU worker runtime (~1.2–1.5 GB VRAM in 4-bit, zero sidecar, zero native build requirements) serving as an instant offline starter brain with state-of-the-art reasoning and strict JSON tool compliance across web and desktop.
*   **Tier 2: Edge0 Dynamic MoE Expert Streaming (Electron Native Runtime — Zero Python Sidecar)**: Enables running 35B MoE models (e.g. Qwen 2.5 32B MoE) in sub-3 GB RAM by streaming only active expert tensors dynamically via kernel `mmap` with INT4 quantization and Recover-LoRA. Implemented strictly as an Electron-only native C++/Node N-API addon, explicitly rejecting any Python sidecar processes.

### Generative Code-Painting Dual-Engine (`p5.brush` & RWKV-7)
*References: [proposal-generative-code-painting-rwkv-webllm.md](../../../../../proposal-generative-code-painting-rwkv-webllm.md) | [project-rwkv-cleanroom-harness-plan.md](../../../../../project-rwkv-cleanroom-harness-plan.md)*
*   **Dual-Engine Artistry Architecture**: Integrate cleanroom-verified generative code-painting:
    *   **Engine A (Procedural LLM)**: General consciousness LLM generating `p5.brush` watercolor scripts via `<BrainModelPicker />`.
    *   **Engine B (RWKV-7 WebGPU + S0 State Cartridge)**: Dedicated offline on-device neural model running with pre-conditioned `p5-watercolor-1.5b.state` (12.19 MB).
*   **UI & Pipeline Integration**: Connect settings panel (`packages/stage-pages/src/pages/settings/providers/artistry/code-painter.vue`), switchboard (`artistry.vue`), and execution runtime in `artistry.ts` / `artistry-autonomous.ts`.

### Desktop Computer-Use MCP Architecture & Ambient Group Bot Dynamics
*References: [project-selective-upstream-sync-shortlist.md](../../../../../project-selective-upstream-sync-shortlist.md) | [design-conversational-group-bot.md](../../../../../design-conversational-group-bot.md)*
*   **Desktop Computer-Use MCP Integration (`@proj-airi/computer-use-mcp`) [Deferred]**:
    *   Technical evaluation completed for upstream's macOS orchestration service `services/computer-use-mcp` as an architectural addition.
    *   **Scope & Deferred Rationale**: Provides native desktop actions (Quartz clicking/typing/hotkeys), browser DOM bridge (`ws://127.0.0.1:8765`), and terminal runner. Deferred due to non-trivial configuration footprint: requires macOS Accessibility/Screen Recording permissions, interactive action-approval dialogs, application whitelisting, and Chrome extension pairing.
*   **Character Card Density & Compliance Model (`CardCreationTabGeneration.vue`)**:
    *   Introduce paired physical execution bounds (`maxTokens`, `maxBubblesPerTurn`, `maxLinesPerTarget`) coupled with dynamic system prompt compliance prose teaching models how to naturally chunk dialogue without performative cadence.
*   **Discord Group Dynamics & Ambient Tuning (`MessagingDiscord.vue` `'group'` Tab)**:
    *   **Batch Ingestion Throttling**: Reactive `collectDebounceMs` (2,500ms) and `maxBatchWaitMs` (6,000ms) under `/chatmode collect` to digest high-velocity multi-user bursts into unified turns.
    *   **Dual Outbound Delivery Paradigms**:
        *   *Multi-Bubble Stagger (Sarah Style)*: Multi-target `<reply to="...">` / `<ambient>` block parsing with natural typing delays (40ms/char) and `<react to="..." emoji="..."/>` Discord emoji reactions.
        *   *Real-Time SSE Streaming (Nanori Style)*: Live token streaming via Discord `message.edit()` with a mandatory 2,500ms rate-limit safety floor to prevent HTTP 429 locks.
    *   **Conversational Appetite Slider**: Configurable modes (Reserved / Natural Conversationalist / Hyper-Enthusiastic) with `NO_REPLY` silence sentinel drop routing.

## Consciousness & Cognitive Pipeline

### TypeSafe Jev System-1 Cognitive Engine & Multi-Subsystem Wiring
*Reference: [proposal-jev-integration.md](../../../../../proposal-jev-integration.md)*
*   **Streaming Speech-to-Motion & Expression Classifier**:
    *   Evaluate streaming sentence strides in real time (~110–140ms) via Jev `choice` and `score` primitives during TTS pre-synthesis.
    *   Dynamically dispatch Live2D/VRM/Stage-Mate facial expressions (`smug`, `flustered`, `tender`) and ACT motion triggers (`nod`, `lean_forward`, `tilt`) with zero inline XML token generation overhead in the primary LLM.
*   **Memory Token Compaction & Pre-Summary Salience Curation**:
    *   Pre-filter raw multi-turn conversation logs before invoking heavy System-2 daily/lifetime summarizers.
    *   Strip routine banter and transient small-talk, compacting transcript token volume by ~70% and isolating high-salience biographical anchors and emotional milestones.
*   **Arcade Room Retro Games & Interactive Backseat Gaming (`chat_arcade.vue`)**:
    *   Run 10 Hz carry-hold game actuation loops (JS-DOS retro titles / ViZDoom) while the companion streams gameplay in the Arcade Room.
    *   Inject live user chat/voice suggestions into dynamic `standingOrders` situation reports at the next 100ms cycle, enabling interactive backseat gaming and contextual audio-ducked banter.

### Prefix Cache Alignment & Prompt Compilation Controls
*Reference: [proposal-prefix-cache-alignment.md](../../../../../proposal-prefix-cache-alignment.md)*
*   **Unified Context Builder & Settings Store**: Implement `useContextBuilder` to dry up prompt construction across Proactivity/Destiny 2/Producer and create `useSettingsLlmPerformance`. Prefix alignment logic verified with `scripts/validate-prefix-cache.js`.

### Proactivity System Enrichments
*Reference: [project-proactivity-enrichment-roadmap.md](../../../../../project-proactivity-enrichment-roadmap.md)*
*   **Cognition Tab Synergy & Behavioral Enrichments**:
    *   Clipboard Metadata Buffer (rolling buffer of last 5 clipboard events).
    *   Invisible Emotion Meters (cumulative sentiment meters: Trust, Patience, Playfulness).
    *   Physical Model Tracking (click/mouse coordinates mapped to VRM bones / Live2D hit areas).
    *   Media Now Playing comments & Temporal/Day Tropes.

### Chatbox Conversational Anchoring & Contextual Bubble Reply
*Reference: [proposal-chatbox-revamp.md](../../../../proposal-chatbox-revamp.md)*
*   **Message-Level Provenance & Attention Anchoring**: Enable users to circle back to older conversation turns without semantic confusion. Contextually replying to an earlier bubble prefixes a model-only attention anchor (`[Replying to: <text>]`) to the outgoing prompt turn, overcoming recency bias and binding the LLM's response directly to the cited topic across conversational drift.
*   **Bubble Context Menu Integration (No Swipe)**: Provide a clean desktop-first entry point via the bubble contextual menu positioned near the top next to "Retry". Explicitly bypasses mobile gesture/swipe capture bloat while offering instant access to reply targeting.
*   **Composer Quote Drawer & Inline Bubble Attribution**: Display an expandable, dismissible reply preview banner above the composer input (`Replying to <Speaker>: "<text>" [✕]`) and render an inline quote header inside the sent bubble to preserve visual provenance in the session timeline with click-to-ancestor jumping.

---

## Memory & Grounding RAG

### Memory & Grounding RAG
*References: [proposal-dynamic-memory-rag-injection.md](../../../../../proposal-dynamic-memory-rag-injection.md) | [proposal-introspective-context-injection.md](../../../../../proposal-introspective-context-injection.md) | [proposal-tools-tab.md](../../../../../proposal-tools-tab.md)*
*   **Actor & Relationship Schema Integration**: Enhance `layered-memory.ts` and memory repositories with native TypeScript actor properties (`actorId`, `targetActorId`, and `relationship`) for episodic vector indexing.

### Live2D DSL Manifest Scripting Interpreter
*Reference: [design-live2d-dsl-interpreter-spec.md](../../../../../design-live2d-dsl-interpreter-spec.md)*
*   **DSL Virtual Machine Runtime Integration**: Connect the 24KB verified interpreter harness (`scripts/tests/live2d-dsl-harness/test-dsl-interpreter.ts`) to `packages/stage-ui/src/stores/dating-sim.ts` and Live2D stage manager.

---

## Speech & Audio Systems

### Future Modalities (Audio & Video)
*Reference: [project-future-modalities-support.md](../../../../../project-future-modalities-support.md)*
*   **Raw Audio Input**: Support native audio ingestion for LLMs supporting raw audio modality (e.g. OpenRouter, Gemini).
*   **STT Pre-Transcription Chooser**: Choice dialog upon attaching audio to run local Whisper pre-transcription before sending.
*   **Smart Video Frame Sampling & Tiled Contact Sheets**: Frontend Canvas/WebCodecs frame extraction and contact sheet tile generation.

### Generative DJ & Music Engine: Character Proactive Tools & Banter
*Reference: [proposal-comfyui-generative-music-dj-engine.md](../../../../../proposal-comfyui-generative-music-dj-engine.md)*
*   *(Note: Core Sound Studio frontend & local backend shipped in `chat_music.vue` via YuE-2 & MiniMax Music 3.0)*
*   **Character Proactive Music Tools**: Equip the companion with first-class LLM tools (`compose_track`, `queue_music`, `suggest_playlist`) allowing characters to autonomously initiate, generate, and collaborate on music tracks during conversation.
*   **Dynamic Voice Ducking & DJ Banter**: Automated volume attenuation during character TTS speech with automatic recovery, supporting radio-style spoken intros/outros and status-anchored proactivity.

---

## Visual Manifestation & Stage Presentation

### Dynamic Desktop Ambient Lighting (Screen Bounce) for 3D (VRM & MMD) and 2D (Live2D)
*Reference: [design-desktop-ambient-lighting.md](../../../../../design-desktop-ambient-lighting.md)*
*   **Perimeter Band Sampling**: Low-resolution (160x90) 10 Hz desktop screen capture with mascot window bounding-box exclusion to eliminate self-sampling feedback loops.
*   **Color Science & Temporal Smoothing**: RGB-to-HSV conversion, saturation gamma boosting ($I = \text{lerp}(I_{\min}, I_{\max}, S^{\gamma})$), and delta-time exponential smoothing with angular shortest-path hue wrapping.
*   **Three.js Dynamic Directional Rig (VRM & MMD Parity)**: Drive 4-point unshadowed directional lights (`topLight`, `bottomLight`, `leftLight`, `rightLight`) in `ThreeScene.vue` and `MMD.vue` for realistic monitor bounce on VRM MToon and MMD PMX shaders.
*   **2D Live2D WebGL Shader Filter (Upstream PR #2391 Extension)**: Adapt screen ambient environment parameters into a PixiJS `ScreenAmbientLightFilter` on `Live2DModel` for 2D ambient tinting and screen-edge bounce.

### Autoregressive Live2D Ambient Motion & Micro-Movement Synthesis
*Reference: [design-live2d-autoregressive-motion.md](../../../../../design-live2d-autoregressive-motion.md)*
*   **Parametric Autoregressive HMM & Lissajous Phase Engine**: Continuous, non-repeating resting sway and breath dynamics applied directly to Cubism parameter buffers (`ParamAngleX/Y/Z`, `ParamBodyAngleX`, `ParamBreath`) without 3D skeletal distortion or looping animation clips.
*   **4-Layer Motion Override Hierarchy**: Seamless blending between Layer 0 (Autoregressive Resting Foundation), Layer 1 (Gaze & Saccades), Layer 2 (BeatSync tempo override), and Layer 3 (Discrete `<|ACT:motion="..."|>` action clips).
*   **Automated `.motion3.json` Feature Extraction**: Synthesize stochastic transition state-spaces directly from bundled Live2D animation files.

### Expression Emoji Quick-Trigger Mapping (Live2D & Spine Support)
*Reference: [design-expression-emoji-mapping.md](../../../../../design-expression-emoji-mapping.md)*
*   **Live2D & Spine Capability Parity**: Following completion of the VRM expression emoji quick-trigger system, extend universal expression-to-emoji mapping across 2D runtimes:
    *   **Live2D**: Map core emoji anchors (`😀`, `😢`, `😠`, `😳`, `😃`, `🤔`, `😎`, `🔀`) to `.exp3.json` expressions and motion groups via `live2dStore.triggerEmotion(name)`.
    *   **Spine 2D**: Map emoji anchors to skeletal animation tracks and skin states via `spineStore`.
*   **Inline Popover Binding & Direct Dispatch**: Interactive in-popover search and reassignment sheet saving directly into `displayModel.emotionMappings[emotionKey]` with auto-reset decay timers back to neutral.

### Dynamic Item & Scene Manifestation (TRELLIS & Fire3D)
*Reference: [proposal-trellis-dynamic-item-manifestation.md](../../../../../proposal-trellis-dynamic-item-manifestation.md)*
*   **Tier 1: Actor Item Manifestation (TRELLIS)**: Implement LLM tool calls (`create_stage_item`, `list_stage_items`, `equip_stage_item`), ComfyUI TRELLIS 3D websocket pipeline (.glb mesh output), and skeletal bone socket mounting for personal accessories.
*   **Tier 2: Environment Scene Decomposition (Fire3D)**: Implement `decompose_stage_scene` tool, converting photos, video clips, or background art into simulation-ready 3D scenes with up to 16 separate, editable mesh objects with physics colliders in under 1 minute on a single GPU.
*   **Prompt-to-Character Expansion**: Use TRELLIS/3D pipeline as the foundational base for generating fully rigged, auto-injected 3D characters directly from natural language prompts.

### Universal Multi-Skeleton Animation & Text-to-Motion (Unimate & FlowMDM)
*Reference: [design-text-to-motion.md](../../../../../design-text-to-motion.md)*
*   **Unimate Multi-Skeleton Upgrade**: Evolve beyond FlowMDM's bipedal humanoid constraint (HumanML3D 21 joints) to a unified foundational model capable of animating arbitrary 3D rigged skeletons (quadrupeds, non-human pets, dragons, satellites, mechanical props) from natural language prompts without per-skeleton retraining.
*   **Stage-Mate & Three.js Integration**: Drive kinematically valid joint rotations for companion sidecars and dynamic animated stage props.

### Director-Led Regional Orchestration (Spatial Vision)
*Reference: [proposal-director-led-regional-orchestration.md](../../../../../proposal-director-led-regional-orchestration.md)*
*   **Director Spatial Upgrade**: Evolve Director LLM into Spatial Scene Architect, AIRIRegionalResolver custom ComfyUI node, Ideogram 4 spatial integration (0-1000 grid).

### Unified Texture Editor (V-HACK / L-HACK & ModelCustomizer)
*References: [design-hacker-studio.md](../../../../design-hacker-studio.md) | [design-vhack-studio.md](../../../../design-vhack-studio.md) (historical) | [design-model-customizer.md](../../../../design-model-customizer.md)*
*   **Multi-Model Reskin & ModelCustomizer Extension**: Dynamic reskinning editor building on ModelCustomizer unified model handling across VRM (3D), Live2D (2D), and Spine. MMD/PMX is deferred: the current loader has no writable export bundle, so it is excluded from the Hacker Studio adapter scope.

### Unified Sticker System: In-Chat Slices & Desktop Screen Spawning (Dormant)
*Reference: [project-stickers-system-spec.md](../../../../../project-stickers-system-spec.md)*
*   *Status: Dormant / Revised Specification (Oct 2026)*
*   **Dual-Modal Manifestation & Acting Tab Integration**:
    *   **In-Chat Emotion Slices**: Inline chibi stickers nested within assistant messages via `<|STICKER <id>|>`, stripped before TTS audio synthesis.
    *   **Desktop Stage / Screen Slapping**: Ephemeral stickers spawned directly onto the screen or stage viewport (`sticker-stack.vue` / `sticker-widget.vue`) with rotation jitter, spring spawn dynamics, holographic sheen tilt, and automatic decay.
    *   **Acting Tab Authoring**: Anchored within the character card Acting Tab rather than legacy modules.

### Pluggable Integration Architecture
*References: [proposal-twitch-plugin.md](../../../../../proposal-twitch-plugin.md) | [proposal-destiny2-plugin.md](../../../../../proposal-destiny2-plugin.md) | [proposal-gaming-show-harness-copilot.md](../../../../../proposal-gaming-show-harness-copilot.md) | [feat-discord-revamp.md](../../../../../feat-discord-revamp.md)*
*   **Show Harness Vision-to-Action Gaming Co-Pilot & Autonomous Companion**: Moves beyond passive REST API polling and OCR by using Vision-Language Models to watch the live game stream, evaluate HUD/game state, and execute discrete semantic action primitives via a bounded Action Interpreter with up to 100% execution accuracy (real-time game callouts, automated farming/minigames, visual novel decision-making, and secondary constrained desktop UI navigation).
*   **Twitch Chat Plugin (`airi-plugin-twitch-chat`)**: Inbound live stream chat context ingest reacting to chats, subs, raids, and channel points.
*   **WIP Plugin Stubs**: Complete stubs for Bilibili Live Stream Ingest (`airi-plugin-bilibili-laplace`) and Home Assistant Event Ingest (`airi-plugin-homeassistant`).
*   **Destiny 2 Proactive Speech Plugin**: Real-time Bungie API game event polling and a local ONNX/WebGPU screen-capture OCR pipeline (`PP-OCRv6_tiny_rec_onnx`) for live PVP/PVE HUD analysis (cleanroom OCR verified).
