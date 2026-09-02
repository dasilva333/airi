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

### Character Card Universal Import/Export & Package Compatibility Bridge
*References: [design-character-card-import-export.md](../../../../design-character-card-import-export.md) | [design-airi-card.md](../../../../design-airi-card.md)*
*   **Durable Full-Fidelity AIRI JSON Format**:
    *   Preserve complete base card metadata, greetings, system prompts, post-history instructions, and all `extensions.airi` data slices (`modules`, `artistry`, `acting`, `heartbeats`, `generation`) without data loss.
    *   Support auto-versioned JSON wrapper (`{ "format": "airi-card", "version": 1, "card": { ... } }`) with deterministic duplicate renaming (`Lain (2)`, `Lain (3)`).
*   **Ecosystem CCv2 / SillyTavern PNG Metadata Interoperability**:
    *   Embed `chara_card_v2` base64 UTF-8 JSON inside PNG `tEXt` chunks under the `chara` keyword for cross-ecosystem card sharing.
    *   Dual export visual modes: Raw Preview PNG vs Styled Framed Composition (`card-export-frame.png` 925x1436 canvas, portrait inner box `[65, 79, 831, 1295]`).
    *   Refined export render pipeline reflecting customized outfit variants, active expressions, and character-specific portrait framing.
*   **ZIP Package Spec v2 Manifest & Multi-Model Layout**: Implement clean asset package structure (`cover.png`, `background.png`, `models/`, `voices/`) replacing inline base64 bloat while supporting multi-model arrays (base 3D VRM + secondary Live2D outfits + manifestations).
*   **Card Package Export & Import Modal UX (`CardDetailDialog.vue` & `CardCreationDialog.vue`)**:
    *   Provide full format controls: AIRI Extended ZIP v2, Upstream Main Compatible ZIP v1, SillyTavern CCv2 PNG, Standalone AIRI JSON.
    *   Asset inclusion checkboxes and auto-generated `README.md` with model redistribution licensing notices.
    *   Unified global import tile with clear format guidance and auto-defaulting for missing AIRI-specific extension fields.
*   **Bidirectional Import Pipeline**: Seamlessly import upstream `moeru-ai/airi` Version 1 single-model packages, fork Version 2 multi-model archives, SillyTavern PNG `tEXt` chunks, and CCv2/CCv3 JSON files.

---

## Local Runtimes & Desktop Automation

### Local WebGPU RWKV Enhancements & State Cartridges
*References: [proposal-built-in-llm-webgpu.md](../../../../../proposal-built-in-llm-webgpu.md) | [project-rwkv-cleanroom-harness-plan.md](../../../../../project-rwkv-cleanroom-harness-plan.md) | [proposal-generative-code-painting-rwkv-webllm.md](../../../../../proposal-generative-code-painting-rwkv-webllm.md)*
*   **State Cartridge Loading & Ingestion**: Integrate verified cleanroom state loading (`scripts/tests/rwkv-harness/`) into the active WebGPU Web Worker (`packages/stage-ui/src/workers/web-rwkv/`). Enables loading modular `.state` files (e.g. bilingual roleplay, character personality cartridges, `p5-watercolor-1.5b.state`).
*   **Prompt Template & Model Selector**: Add a prompt template configuration selector and custom model URL input to allow power users to load arbitrary Hugging Face safetensors.

### iOS Native Multimodal Neural Inference Suite (Apple Core AI & Capacitor)
*Reference: [design-ios-core-ai-native-inference.md](../../../../../design-ios-core-ai-native-inference.md)*
*   **Gemma 4 Baseline & Multimodal Expansion**: Building on the working Gemma 4 on-device LLM implementation, expand native Apple Neural Engine (ANE) and Metal GPU acceleration via `@proj-airi/cap-native-ai` for other modalities:
    *   **Consciousness**: Qwen 2.5 (0.5B/1.5B), Llama 3.2 (1B/3B), Ministral 3B, RWKV-7.
    *   **Vision & Perception**: WD14 WaifuDiffusion Tagger, CLIP (ViT-B/32), BLIP scene captioning, MODNet.
    *   **Generative Motion**: On-device FlowMDM diffusion denoiser UNet (<350ms on ANE).
    *   **Audio & Hearing**: Local Whisper STT & Kokoro TTS.
*   **Out-of-Process Sandbox Streaming**: Stream `.aimodel` bundles directly to `Documents/CoreAI/models/` via native Swift `URLSessionDownloadDelegate` with one-time `.aimodelc` hardware specialization, completely bypassing WebKit memory limits.

### Generative Code-Painting Dual-Engine (`p5.brush` & RWKV-7)
*References: [proposal-generative-code-painting-rwkv-webllm.md](../../../../../proposal-generative-code-painting-rwkv-webllm.md) | [project-rwkv-cleanroom-harness-plan.md](../../../../../project-rwkv-cleanroom-harness-plan.md)*
*   **Dual-Engine Artistry Architecture**: Integrate cleanroom-verified generative code-painting:
    *   **Engine A (Procedural LLM)**: General consciousness LLM generating `p5.brush` watercolor scripts via `<BrainModelPicker />`.
    *   **Engine B (RWKV-7 WebGPU + S0 State Cartridge)**: Dedicated offline on-device neural model running with pre-conditioned `p5-watercolor-1.5b.state` (12.19 MB).
*   **UI & Pipeline Integration**: Connect settings panel (`packages/stage-pages/src/pages/settings/providers/artistry/code-painter.vue`), switchboard (`artistry.vue`), and execution runtime in `artistry.ts` / `artistry-autonomous.ts`.

### Computer Use, Capability Packs & Ambient Group Bot Dynamics
*References: [project-selective-upstream-sync-shortlist.md](../../../../../project-selective-upstream-sync-shortlist.md) | [design-conversational-group-bot.md](../../../../../design-conversational-group-bot.md)*
*   **Desktop Observation & Upstream Cherry-Pick Candidate**: Upstream Moeru implementation is maturing; marked for potential cherry-pick review for `computer-use-mcp` service + ghost pointer UX overlays.
*   **AiriCard Capability Packs Architecture (`CardCreationTabTools.vue`)**:
    *   Replace flat tool toggles with progressive disclosure **Capability Packs**:
        *   🌐 **Web & Research Pack**: `fetch_url` (instant Markdown RAG) + `web_search`.
        *   📁 **Local Workspace Pack (Desktop Electron Only)**: Turnkey `@modelcontextprotocol/server-filesystem` MCP with 1-click native folder picker.
        *   🎨 **Visual Artistry Pack**: `image_journal` + `generate_motion`.
        *   🧠 **Sacred Memory Pack**: `text_journal` LTMM entries.
        *   ⚙️ **Custom Developer MCP**: Raw `mcp.json` stdio server manager.
    *   Enforce tri-platform tool capability gating (Desktop Electron vs. Web Browser vs. Mobile Companion).
*   **Character Card Density & Compliance Model (`CardCreationTabGeneration.vue`)**:
    *   Introduce paired physical execution bounds (`maxTokens`, `maxBubblesPerTurn`, `maxLinesPerTarget`) coupled with dynamic system prompt compliance prose teaching models how to naturally chunk dialogue without performative cadence.
*   **Discord Group Dynamics & Ambient Tuning (`MessagingDiscord.vue` `'group'` Tab)**:
    *   **Batch Ingestion Throttling**: Reactive `collectDebounceMs` (2,500ms) and `maxBatchWaitMs` (6,000ms) under `/chatmode collect` to digest high-velocity multi-user bursts into unified turns.
    *   **Dual Outbound Delivery Paradigms**:
        *   *Multi-Bubble Stagger (Sarah Style)*: Multi-target `<reply to="...">` / `<ambient>` block parsing with natural typing delays (40ms/char) and `<react to="..." emoji="..."/>` Discord emoji reactions.
        *   *Real-Time SSE Streaming (Nanori Style)*: Live token streaming via Discord `message.edit()` with a mandatory 2,500ms rate-limit safety floor to prevent HTTP 429 locks.
    *   **Conversational Appetite Slider**: Configurable modes (Reserved / Natural Conversationalist / Hyper-Enthusiastic) with `NO_REPLY` silence sentinel drop routing.

---

## Consciousness & Cognitive Pipeline

### Conversational Pacing, Dynamic Thinking Fillers & Post-CoT Text Velocity
*Reference: [proposal-conversational-pacing-thinking-fillers.md](../../../../../proposal-conversational-pacing-thinking-fillers.md)*
*   **Pillar A — Dynamic Thinking Fillers & CoT Audio Cue Interception**:
    *   Zero-bloat IndexedDB audio cache (`local:audio:thinking-cache/{voiceId}`) synthesized dynamically via active TTS with 0ms replay overhead.
    *   Personality Thinking Bundles (Tsundere, Kuudere, Yandere, Genki, Custom) configured in Character Card Acting Tab.
    *   Cascaded timing state machine masking high Time-to-First-Token (TTFT) and reasoning pauses during DeepSeek R1 / OpenAI o1/o3 thinking turns.
*   **Pillar B — Post-CoT Expressive Text Pacing & Hesitation**:
    *   Chatbox text velocity modulation, simulated human retyping/backspacing, emotional pauses, and non-verbal avatar reaction hooks.

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

---

## Visual Manifestation & Stage Presentation

### Dynamic Desktop Ambient Lighting (Screen Bounce) for Three.js / VRM
*Reference: [design-desktop-ambient-lighting.md](../../../../../design-desktop-ambient-lighting.md)*
*   **Perimeter Band Sampling**: Low-resolution (160x90) 10 Hz desktop screen capture with mascot window bounding-box exclusion to eliminate self-sampling feedback loops.
*   **Color Science & Temporal Smoothing**: RGB-to-HSV conversion, saturation gamma boosting ($I = \text{lerp}(I_{\min}, I_{\max}, S^{\gamma})$), and delta-time exponential smoothing with angular shortest-path hue wrapping.
*   **Three.js Dynamic Directional Rig**: Drive 4-point unshadowed directional lights (`topLight`, `bottomLight`, `leftLight`, `rightLight`) in `ThreeScene.vue` for realistic monitor bounce on VRM / MToon shaders.

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

### Model Expression Noise Gate & Sparkle AI Curation (Live2D & Spine Expansion)
*Reference: [design-expression-noise-gate-and-llm-curation.md](../../../../../design-expression-noise-gate-and-llm-curation.md)*
*   **Live2D & Spine Noise Gate Adaptation**: Following the completed VRM Tier 1 deterministic classifier (~99.5% accuracy across 907 models), adapt the noise gate to 2D runtimes:
    *   **Live2D**: Filter tracking physics channels (`ParamAngleX/Y/Z`, `ParamEyeBallX/Y`, `ParamMouthOpenY` visemes, breath loops) while isolating `.exp3.json` expressive targets and motion group triggers.
    *   **Spine 2D**: Filter mechanical bone IK tracks and base skins while surfacing expressive facial attachments and pose states.
*   **Sparkle AI 3-Step Curation Wizard for 2D Models**: Enable the `"✨ Auto-Curate (AI)"` wizard in `ModelCustomizer.vue` for Live2D and Spine models, translating foreign parameter names (Japanese/Chinese/cryptic DCC tags) into clean `<|ACT:emotion="..."|>` tokens and compiling acting system prompt directives into `displayModel.emotionMappings` and `AiriExtension.acting.modelExpressionPrompt`.

### Dynamic Item Manifestation & Prompt-to-Character (TRELLIS)
*Reference: [proposal-trellis-dynamic-item-manifestation.md](../../../../../proposal-trellis-dynamic-item-manifestation.md)*
*   **Actor Item Tool Calling & Prompt-to-Character Pipeline**: Implement LLM tool calls (`create_stage_item`, `list_stage_items`, `equip_stage_item`), ComfyUI TRELLIS 3D websocket pipeline (.glb mesh output), and skeletal bone socket mounting.
*   **Prompt-to-Character Expansion**: Use TRELLIS/3D pipeline as the foundational base for generating fully rigged, auto-injected 3D characters directly from natural language prompts.

### Director-Led Regional Orchestration (Spatial Vision)
*Reference: [proposal-director-led-regional-orchestration.md](../../../../../proposal-director-led-regional-orchestration.md)*
*   **Director Spatial Upgrade**: Evolve Director LLM into Spatial Scene Architect, AIRIRegionalResolver custom ComfyUI node, Ideogram 4 spatial integration (0-1000 grid).

### Unified Texture Editor (V-HACK / L-HACK & ModelCustomizer)
*References: [design-vhack-studio.md](../../../../../design-vhack-studio.md) | [design-model-customizer.md](../../../../../design-model-customizer.md)*
*   **Multi-Model Reskin & ModelCustomizer Extension**: Dynamic reskinning editor building on ModelCustomizer unified model handling across VRM (3D), Live2D (2D), MMD/PMX, and Spine.

### Sticker System Specification (Anchored Pseudo-Stickers)
*Reference: [project-stickers-system-spec.md](../../../../../project-stickers-system-spec.md)*
*   **Anchored Pseudo-Stickers**: Render pseudo-stickers as absolute-positioned DOM elements within existing app containers (ActorStage Window, ControlStrip/Island, Chat bubbles) with rotation jitter, spring scale, and holographic sheen.

### Pluggable Integration Architecture
*References: [proposal-twitch-plugin.md](../../../../../proposal-twitch-plugin.md) | [proposal-destiny2-plugin.md](../../../../../proposal-destiny2-plugin.md) | [feat-discord-revamp.md](../../../../../feat-discord-revamp.md)*
*   **Twitch Chat Plugin (`airi-plugin-twitch-chat`)**: Inbound live stream chat context ingest reacting to chats, subs, raids, and channel points.
*   **WIP Plugin Stubs**: Complete stubs for Bilibili Live Stream Ingest (`airi-plugin-bilibili-laplace`) and Home Assistant Event Ingest (`airi-plugin-homeassistant`).
*   **Destiny 2 Proactive Speech Plugin**: Real-time Bungie API game event polling and a local ONNX/WebGPU screen-capture OCR pipeline (`PP-OCRv6_tiny_rec_onnx`) for live PVP/PVE HUD analysis (cleanroom OCR verified).
*   **Discord & Gemini Live Voice Transcription Sync**: Capture and ingest both user and assistant transcription events from the Gemini Live WebSocket stream back into active message history logs to ensure full parity with spoken voice sessions.
