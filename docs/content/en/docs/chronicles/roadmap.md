# AIRI Pending Items Catalog

This document tracks all active pending items, architectural roadmaps, and feature branches for the AIRI project, grouped by system layers.

---

## Core Infrastructure & Network Services

### Cloud & Sync Systems
*Reference: [project-byos-cloud-sync.md](../../../../../project-byos-cloud-sync.md)*
*   **Dropbox & Google Drive Storage Engines**: Extend database/asset storage options to natively support Dropbox and Google Drive as storage providers (in addition to existing S3/R2 and Local FS).
*   **Modular Token Lifecycle Management**: Implement automatic refresh handshakes for Dropbox/Google Drive integrations.

### Web CORS Proxy Bypass & Cloudflare Workers Bundle
*References: [proposal-web-cors-proxy-bypass.md](../../../../../proposal-web-cors-proxy-bypass.md) | [cloud-relay-design.md](../../../../../cloud-relay-design.md)*
*   **Cloudflare Workers Deployer & Ecosystem Cross-Reference**: Bundle the "Deploy to Cloudflare Workers" private CORS reverse-proxy worker template together with the Cloud Relay user deployment flow.
*   **System Connection Settings**: Introduce Worker URL inputs and Web CORS bypass toggles in Settings > System > Connection.
*   **Dynamic XHR/Fetch Routing**: Redirect requests to CORS-restricted endpoints (Deepgram, Pioneer, Opencode) through the user's private worker when matching the bypass list.

### Provider Store Restructuring (`providers.ts`)
*Reference: [project-provider-store-restructuring-plan.md](../../../../../project-provider-store-restructuring-plan.md)*
*   **Monolithic Store Phase 1 Decomposition (Review & Handoff Candidate)**: Extract shared types, helper functions, and legacy metadata declarations out of monolithic `packages/stage-ui/src/stores/providers.ts` (~3k lines) into dedicated registry-family files (`types.ts`, `helpers.ts`, `registry/*`). Maintain public API interface compatibility while creating an agent handoff spec.

### Core-Agent Revamp (Apeira Runtime Integration)
*Reference: [proposal-core-agent-revamp.md](../../../../../proposal-core-agent-revamp.md)*
*   **Apeira Evaluation (Deferred / Not Doing Yet)**: Monitor and evaluate Apeira (v0.0.5+) as a potential lightweight replacement for `@proj-airi/core-agent` once codebase and persistence interfaces stabilize.
*   **Plugin Hooks Mapping**: Map fork-specific orchestration behaviors (e.g. autonomous artistry triggers, live session bidirectional audio) to Apeira's Plugin API.

### AnimaDex Character Creator Wizard
*References: [proposal-animadex-wizard.md](../../../../proposal-animadex-wizard.md) | [proposal-animadex-new-characters.md](../../../../proposal-animadex-new-characters.md)*
*   **AnimaDex Ad-hoc Cast Expansion (Dynamic Character Injection)**:
    *   Implement "Add Character" gallery selection and voice/model binding modal context.
    *   Build injection engine parsing and generation rules for Mode A (markers), Mode B (multi-actor tags), and Mode C (single-to-multi conversion).
    *   Support Step 4 review interface with choices for "Apply to Current Card (with Backup)" and "Create as New Card".

---

## Local Runtimes & Desktop Automation

### Local WebGPU RWKV Enhancements (State File Merge)
*Reference: [proposal-built-in-llm-webgpu.md](../../../../../proposal-built-in-llm-webgpu.md)*
*   **State File Merge Support**: Implement merging a base model `.safetensors` URL with a separate `.state` file URL inside the Web Worker before model session creation (enabling bilingual roleplay states).
*   **Prompt Template & Model Selector**: Add a prompt template configuration selector and custom model URL input to allow power users to load arbitrary Hugging Face safetensors.

### Engine Sidecar (Godot vs. Mate-Engine)
*Reference: [engine-sidecar-journal.md](../../../../../engine-sidecar-journal.md)*
*   **Render Offloading Spike (Design Revamped)**: Architecture heavily revamped recently; core design updated, implementation open. Evaluate offloading VRM rendering into native sidecar window (Godot 4 vs Mate-Engine Unity runtime).

### Computer Use & Desktop Agent Subsystem
*Reference: [project-selective-upstream-sync-shortlist.md](../../../../../project-selective-upstream-sync-shortlist.md)*
*   **Desktop Observation & Upstream Cherry-Pick Candidate**: Upstream Moeru implementation is maturing; marked for potential cherry-pick review (Aug 3).
*   **Browser-Native DOM Action Routing & Ghost Pointer**: Enable native communication protocols between Tamagotchi stage and `computer-use-mcp` service + ghost pointer UX overlays.

---

## Consciousness & Cognitive Pipeline

### Attention Ecology & Cognitive Gates
*Reference: [proposal-attention-ecology-local-webgpu-guard.md](../../../../../proposal-attention-ecology-local-webgpu-guard.md)*
*   **Local WebGPU Gated Inference**: Continuously poll screen captures every 2 seconds, generate vision embeddings, and filter events locally with a lightweight RWKV model before deciding to promote them to the main Cloud LLM.
*   **Vector-Sampled Attention Pool**: Query vector store of captured frames for the top $N$ most relevant visual landmarks instead of passing a chronological FIFO feed.

### Prefix Cache Alignment & Prompt Compilation Controls
*Reference: [proposal-prefix-cache-alignment.md](../../../../../proposal-prefix-cache-alignment.md)*
*   **Prefix Alignment Logic**: Re-order prompt assembly arrays (System Prompt -> Chat History -> Suffix Telemetry/Deltas) to optimize caching mechanics and maximize prefix hit rates for DeepSeek, Gemini, and OpenRouter.
*   **Unified Context Builder & Settings Store**: Implement `useContextBuilder` to dry up prompt construction across Proactivity/Destiny 2/Producer and create `useSettingsLlmPerformance`.

### "Forward to LLM" VLM Captioning & Tagging Pipeline [Candidate for Quick Task]
*Reference: [proposal-vlm-forward-to-llm.md](../../../../../proposal-vlm-forward-to-llm.md)*
*   **Decoupled Sight Pipeline (Low-Hanging Fruit / Research Agent Target)**: VLM image analysis / WD14 tagger injected into text stream for primary LLM response. Mostly implemented; candidate to delegate to research subagent to debug timing issues.

### Proactivity System Enrichments
*Reference: [project-proactivity-enrichment-roadmap.md](../../../../../project-proactivity-enrichment-roadmap.md)*
*   **Cognition Tab Synergy & Behavioral Enrichments**: Cross-reference with the new Cognition Tab system.
    *   Clipboard Metadata Buffer (rolling buffer of last 5 clipboard events).
    *   Invisible Emotion Meters (Trust, Patience, Playfulness).
    *   Physical Model Tracking (click/mouse coordinates to VRM bones / Live2D hit areas).
    *   Media Now Playing comments & Temporal/Day Tropes.

---

## Memory & Grounding RAG

### Memory & Grounding RAG
*References: [proposal-dynamic-memory-rag-injection.md](../../../../../proposal-dynamic-memory-rag-injection.md) | [nan0-integration-feedback.md](../../../../../nan0-integration-feedback.md) | [proposal-introspective-context-injection.md](../../../../../proposal-introspective-context-injection.md) | [proposal-tools-tab.md](../../../../../proposal-tools-tab.md)*
*   **Toggle 2 — Session-Scoped Timeline Memory (RAG)**: Enforce semantic search limited strictly to the current active session ID (cross-session / cross-universe searching removed by design).
*   **Toggle 4 — Recent Topics Revisit (Researcher Agent Candidate)**: Review/re-architect decaying topic frequency map (Turn-Based/Segment-Based/Wall-Clock decay strategies). Failed/suboptimal implementation flagged for researcher agent rework.
*   **Actor & Relationship Schema Integration**: Enhance `layered-memory.ts` and memory repositories with native TypeScript actor properties (`actorId`, `targetActorId`, and `relationship`) for episodic vector indexing.


### Live2D DSL Manifest Scripting Interpreter [HIGH PRIORITY / High Reasoning Target]
*Reference: [live2d-dsl-interpreter-spec.md](../../../../../live2d-dsl-interpreter-spec.md)*
*   **DSL Virtual Machine**: Event-driven VM parsing custom metadata manifests (logic parameters, assignment codes, intimacy multipliers) for advanced third-party Live2D models. Marked as **HIGH PRIORITY** for high-reasoning agent implementation.
*   **Active Staging & Dating Sim Development Branches**:
    *   `feature/dating-sim-demo`
    *   `feature/dating-sim-gen3`
    *   `remotes/origin/kazzy-feature-dating-sim-demo`
    *   `remotes/aki/feature/dating-sim-demo`

---

## Speech & Audio Systems

### Audio Studio & Virtual Voice Bundling
*Reference: [feat-audio-studio.md](../../../../../feat-audio-studio.md)*
*   **Virtual Provider Abstraction**: Establish `virtual-audio-studio` to bundle base speech engines (Kokoro, Azure, OpenAI) with custom audio effects and UST settings into named, globally-referenceable voice profiles.
*   **Xvan's Audio Effects**: Build modular high-fidelity post-processing transformations (Pitch Shifting, Rate/Speed adjustments, and Voice Equalizers) directly into the voice bundle engine (working).
*   **[x] Advanced UST Rules Expansion**: Expand per-profile UST settings to support advanced non-regex rules and custom character substitutions. (Completed)
*   **Immersive User Profile Playback Routing**: Support setting 3D/2D display model representation in Global User Profile and route user speech previews through `speechRuntimeStore.openIntent`.

### Higgs Audio v3 TTS Integration [COMPLETED]
*Reference: [proposal-higgs-audio-v3-tts-integration.md](../../../../../proposal-higgs-audio-v3-tts-integration.md)*
*   **[x] UST Bracket-to-Token Converter**: Convert square bracket directions into Higgs XML/token format. (Completed)
*   **[x] Expression Tag Buttons**: Populate emotions, styles, and sound effects as clickable speech tags in Character Card Edit Modal. (Completed)

### Future Modalities (Audio & Video)
*Reference: [project-future-modalities-support.md](../../../../../project-future-modalities-support.md)*
*   **Raw Audio Input**: Support native audio ingestion for LLMs supporting raw audio modality (e.g. OpenRouter, Gemini).
*   **STT Pre-Transcription Chooser**: Choice dialog upon attaching audio to run local Whisper pre-transcription before sending.
*   **Smart Video Frame Sampling & Tiled Contact Sheets**: Frontend Canvas/WebCodecs frame extraction and contact sheet tile generation.

---

## Visual Manifestation & Stage Presentation

### Director-Led Modular Visual Assets ("Production Studio") [COMPLETED]
*Reference: [proposal-visual-state-outfit-hook.md](../../../../../proposal-visual-state-outfit-hook.md)*
*   **[x] Complete Production Studio Pipeline**: Manifestation expression triggers, ACTOR token model spawning, preset expression mapping, "Bases for Places" concept packs, "Add Character as Concept" creator, and Director 6-core emotion output pipeline. (Completed)

### Dynamic Item Manifestation & Prompt-to-Character (TRELLIS)
*Reference: [proposal-trellis-dynamic-item-manifestation.md](../../../../../proposal-trellis-dynamic-item-manifestation.md)*
*   **Actor Item Tool Calling & Prompt-to-Character Pipeline**: Implement LLM tool calls (`create_stage_item`, `list_stage_items`, `equip_stage_item`), ComfyUI TRELLIS 3D websocket pipeline (.glb mesh output), and skeletal bone socket mounting.
*   **Prompt-to-Character Expansion Note**: Use TRELLIS/3D pipeline as the foundational base for generating fully rigged, auto-injected 3D characters directly from natural language prompts.

### Director-Led Regional Orchestration (Spatial Vision)
*Reference: [proposal-director-led-regional-orchestration.md](../../../../../proposal-director-led-regional-orchestration.md)*
*   **Director Spatial Upgrade**: Evolve Director LLM into Spatial Scene Architect, AIRIRegionalResolver custom ComfyUI node, Ideogram 4 spatial integration (0-1000 grid).

### Unified Texture Editor (V-HACK / L-HACK & ModelCustomizer)
*References: [vhack-design-doc.md](../../../../../vhack-design-doc.md) | [modelcustomizer-design.md](../../../../../modelcustomizer-design.md)*
*   **Multi-Model Reskin & ModelCustomizer Extension**: ModelCustomizer unified model handling across VRM (3D), Live2D (2D), MMD/PMX, and Spine. The dynamic reskinning editor is the direct feature extension building on this unified model foundation.

### Sticker System Specification (Anchored Pseudo-Stickers)
*Reference: [project-stickers-system-spec.md](../../../../../project-stickers-system-spec.md)*
*   **Stickers Refurbish**: Transition from unstable standalone OS-level sticker windows to **anchored pseudo-stickers** rendered as absolute-positioned DOM elements within existing app containers:
    *   **ActorStage Window**: Reacts dynamically to expressions/poses.
    *   **ControlStrip / Island**: Sliding out from behind or sticking to the frame.
    *   **Chat Interface**: Placed along chat bubbles or the input field.
*   **Tactile Physics & Micro-Animations**: Implement rotation jitter (3°-8° random skew), initial spring scale (0 to 1.1 scale on spawn), and a gentle floating translate loop.
*   **Holographic Hover Effects**: Add 3D card tilt based on cursor position accompanied by a holographic sheen reflection overlay.

### Pluggable Integration Architecture
*References: [proposal-twitch-plugin.md](../../../../../proposal-twitch-plugin.md) | [proposal-destiny2-plugin.md](../../../../../proposal-destiny2-plugin.md) | [feat-discord-revamp.md](../../../../../feat-discord-revamp.md)*
*   **Twitch Chat Plugin (`airi-plugin-twitch-chat`)**: Inbound live stream chat context ingest reacting to chats, subs, raids, and channel points.
*   **WIP Plugin Stubs**: Complete stubs for Bilibili Live Stream Ingest (`airi-plugin-bilibili-laplace`) and Home Assistant Event Ingest (`airi-plugin-homeassistant`).
*   **Destiny 2 Proactive Speech Plugin**: Real-time Bungie API game event polling and a local ONNX/WebGPU screen-capture OCR pipeline (`PP-OCRv6_tiny_rec_onnx`) for live PVP/PVE HUD analysis.
*   **[x] Discord Revamp - Voice Delivery, Isolation & Sync**:
    *   Implement `/voicemode` command to support `puppet` (local speaker playback), `voicenote` (combining TTS audio chunks to upload as voice notes), and `none` modes. (Completed)
    *   Implement `/voicecall` command classic `tts` pipeline (Discord Audio -> Deepgram STT -> Custom LLM -> Custom TTS -> Discord Audio) — (Completed: Classic TTS playback is fully functional, using browser-side 24kHz PCM resampling and streaming directly into the active connection's voice player, combined with WAV merging for complete voice notes. Turn interruption and full transcription sync are pending).
    *   **Gemini Voice Call Sync Parity**: Capture and ingest both user and assistant transcription events from the Gemini Live WebSocket stream back into the active message history logs so that conversation logs stay in sync with the spoken voice session.
    *   Implement `/vision` command toggle state guard (supported natively). (Completed)
    *   Wire up `/selfie` command trigger (stage capture is fully plumbed). (Completed)
    *   Implement `/timelines` command (Completed).
    *   Implement `/journalmoment` command (Completed).
    *   Enforce per-channel session/character isolation mapping ($\text{channelId} \longrightarrow \text{activeCharacterId} \longrightarrow \text{activeSessionId}$) (Completed by Kyo).
