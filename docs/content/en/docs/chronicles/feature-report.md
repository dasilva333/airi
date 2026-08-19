# AIRI Fork: Core Feature Report

> **Provenance**: Revised against commits through `fb1a8a4ab` (2026-08-19, post `v0.9.25-stable.20260818`). Previous revisions: `ca618d5b3` (2026-08-18), `6d5cf8467` (2026-07-18, 34-feature catalog) and `b6917fe4c` (2026-07-10). Sections marked **(NEW)** were added in this revision; bullets marked *new* extend a pre-existing section.

This document tracks the high-level, user-facing features and architectural shifts that define this fork. It serves as a living reference for the project's evolution beyond the baseline implementation.

---

## Table of Contents

| # | Section | # | Section |
|:---|:---|:---|:---|
| 1 | Chat & Desktop Experience | 12 | Dating Sim & Companion Gaming (NEW) |
| 2 | Character Card System | 13 | Captions & Subtitle FX (NEW) |
| 3 | ACT Token & Expression Pipeline | 14 | MCP Management Hub |
| 4 | VRM Animation Ecosystem | 15 | Modular Wardrobe System |
| 5 | Scenes & Background Manager | 16 | Live2D, Spine & MMD Parity |
| 6 | Memory & Continuity | 17 | Onboarding V2 (Companion Wizard) |
| 7 | Artistry & Creative Generation | 18 | Platform Parity: Web, Mobile & Native (NEW) |
| 8 | Vision & Attention Ecology | 19 | Cloud Relay & Zero-Custody Sync (NEW) |
| 9 | Provider Integrations | 20 | Stage-Mate: Native Unity Sidecar (NEW) |
| 10 | Situational Awareness & Proactivity | 21 | Platform & Operations |
| 11 | Discord & Messaging (NEW) | 22 | Integrated Upstream PRs |

---

## 1. Chat & Desktop Experience
Focuses on immersion, transparency, and reducing the "black box" nature of AI interactions.

- **ACT-Driven Bubble Styling**: Chat bubbles automatically apply **background tints**, **border glows**, and **transitions** based on character performance tokens (e.g., `[happy]`, `[angry]`, `(surprised)`). Mood-colored borders give each message a distinct personality.
- **Unified Journaling Feed**: A horizontal Interaction Area above the chat input that displays a **real-time carousel** of the latest 2 text journals and 3 image journals — visible at a glance without opening extra panels.
- **Persona-Driven Auto-Titles**: Automated short-term memory blocks are assigned **character-consistent titles** (e.g., *"My thoughts after 108 messages together~"*) instead of static IDs.
- **Context Limit Transparency**: A visual **Context Meter** (progress bar) and **Token Counter** (e.g., `46.7K`) that transition from Green → Yellow → Red as the character's memory limit is approached.
- **Context-Width Inheritance**: Automatic global default mapping (via `localStorage`) that links `providerId` and `modelName` to a user-defined `contextWidth`, ensuring characters inherit stable token limits even if not explicitly configured.
- **Atomic Session Rebuilds**: A context-aware "Rebuild" logic that semantically **compacts long-running conversations** into a clean state while preserving the last 3 days of continuity.
- **Configurable Send Key**: User-selectable chat submission hotkey (e.g., Enter vs. Ctrl+Enter) via General Settings.
- **Generation Stats Popover** *(new)*: Per-turn generation statistics (tokens, timing, output-limit controls) surfaced inline on messages, so cost/length behavior is inspectable without devtools.
- **Pre-Flight Grounding Panel** *(new)*: The four context blocks injected on every send — `[ENVIRONMENTAL AWARENESS]`, `[GROUNDED LONG-TERM MEMORIES]`, `[RECENT TOPICS]`, `[VISUAL STATE BOARD]` — are composed and previewable *before* the prompt leaves the machine, making "what does she actually see?" a first-class UI question.
- **Unified Event Ledger** *(new)*: A workspace-wide audit stream (`stores/event-log.ts`, spec `docs/project-unified-eventlog.md`) that records live user ingestion, assistant responses, voice STT, tool results, and text/image-journal writes — a replayable paper trail decoupled from the chat transcript.

### Desktop Stage (Control Island & UI)
The floating interaction hub for the desktop experience.

- **Glassmorphic Control Island**: A floating, draggable UI component using `backdrop-blur-xl` and semi-transparent backgrounds, following an iOS-style **"island" pattern**.
- **Control Island Mutual Exclusion**: Main and Gemini/Module islands now auto-collapse each other, ensuring the desktop always remains clean and only one interaction hub is active at a time.
- **Gemini Control Island UX Refinements**: New button interaction patterns (Toggle/Action buttons auto-hide the island; Cycle buttons remain persistent) to match the premium "Main" island experience.
- **Emotion Picker Sub-Menu**: Direct access to **8 emotion triggers** (Happy, Sad, Angry, Surprised, Neutral, Think, Cool, Random) from the Control Island drawer.
- **Fade-on-Hover Intelligence**: A specialized **"Eye" mode** that makes the UI nearly invisible when the mouse hovers over the model area, ensuring the character's performance is never obscured.
- **Integrated Profile Switcher**: A dedicated sub-menu within the Control Island that replaces the main view, featuring a scrollable list of character profiles with deep-links to Gallery and Management settings. Ensures the UI remains usable at any window size.
- **Animation Cycle Button**: One-click cycling through available VRM idle animations directly from the island.
- **ScrollLock Mic Toggle**: A physical hardware key binding for **push-to-talk / toggle microphone** without touching the UI.
- **Manual (Pure Mic) Mode**: Bypasses VAD entirely for **clean push-to-talk** microphone triggering.
- **Resource Status Island**: A separate floating indicator that shows real-time **module loading progress** and a "Ready!" status with expandable details.
- **Transcription Feedback Toasts**: Real-time `🎤 You said: {text}` confirmation during voice interactions.
- **Gallery "Download" Support**: Added a direct Download button to the Image Journal gallery in settings, allowing users to save their captured selfies to their local machine.
- **UI Icon Hygiene**: Standardized the icons for Profile Switcher (`solar:users-group-rounded-outline`) and Emotions (`solar:mask-happly-outline`) to improve visual distinctness.
- **Chat Hover Timestamps**: Contextual time display (e.g., "14:32") appears smoothly on message hover, providing immediate continuity feedback without cluttering the chat history.
- **WhisperDock Flush Alignment**: Recalibrated the floating voice control hub's position to align perfectly with the side controls at all window scaling levels.
- **Unified Gemini "Emerald" Brand**: System-wide update to use **Emerald/Emerald-Dark** accents for all Gemini-powered features, increasing visual consistency across the "Consciousness" modules.

---

## 2. Character Card System
A full-featured card creation, configuration, and portability layer.

- **Per-Character LLM Generation Settings**: Each AIRI card can override the global LLM provider, model, temperature, top-p, and max tokens via a dedicated **Generation** tab. Designed with future SillyTavern preset import compatibility in mind.
- **V-Hack / Mutation Studio**: A native in-app "V-Hack" style surface for live VRM binary capture, texture decks, and AI-assisted mutation workflows — extending character cards from configuration into runtime visual experimentation.
- **AIRI JSON Export**: A full-fidelity native JSON format (`airi-card` v1) that preserves all extensions (modules, artistry, acting, heartbeats). **Does not include personal chat history or private data** — only the configured character settings, ensuring cards are safe to share.
- **Background Bundling on Export**: The character's currently active background/scene is exported **with the card**, so anyone who imports it gets the background automatically applied.
- **SillyTavern PNG Import/Export**: Full `chara_card_v2` compatibility, allowing users to **import existing community cards** and export AIRI cards as shareable PNGs with embedded metadata and a framed portrait preview.
- **Dynamic Card Export Snapshots**: Session-aware snapshot system that captures **active outfits and expressions** in real-time for export previews.
- **Duplicate Handling**: Automatic rename-on-import (`Lain`, `Lain (2)`, `Lain (3)`) prevents accidental overwrites.
- **Model Assignment & Self-Healing** *(new)*: `ModelAssignmentModal` lets users bind display models to cards explicitly, with display-model self-healing for corrupted/orphaned metadata and lazy catalog loading so multi-megabyte binaries load on demand.
- **Visual Memory Review** *(new)*: generated-content review modals for approving what the character remembers from visual captures before it lands in memory.

---

## 3. ACT Token & Expression Pipeline
A structured pipeline that maps AI dialogue tokens into real-time VRM/Live2D expression and animation changes.

- **Full ACT Token Pipeline**: AI output is parsed for `<|ACT:...|>` tokens, which flow through `processMarkers()` → `parseActEmotion()` → `emotionsQueue` → VRM `expressionManager`. Drives **morph targets and material color binds** directly.
- **Heuristic Mood Mapping**: A 7-archetype system (`happy`, `sad`, `angry`, `surprised`, `thinking`, `flustered`, `relaxed`) that maps dozens of keywords to core visual states for bubble styling and UI feedback, independent of the VRM pipeline.
- **Custom Expression Key Mapping**: Users can define **custom keys** that map directly to their VRM model's expression names, enabling any model's unique expressions to be driven by ACT tokens.
- **Dynamic Name Resolution**: Expression names not in the hardcoded map are resolved via **case-insensitive search** of the VRM's `expressionMap`, allowing any model's custom expressions to work without code changes.
- **VRMA-Aware ACT Tokens**: ACT tokens can trigger full-body **VRMA animations** (e.g., `<|ACT:{"animation":"crab_dance"}|>`), not just facial expressions. A priority system ensures VRMA takes precedence over blendshape matches.
- **Smooth Transitions**: All emotion changes use a lerp-based blending system — when one emotion activates, all others fade to zero simultaneously over a configurable `blendDuration`.
- **Live2D Emotion Parity**: Extended the ACT pipeline to Live2D models, including a **"Stable Baseline Manager"** that flushes pending resets on new triggers, ensuring the model never gets stuck in an emotional state during rapid interaction.
- **Additive Live2D Motion Blending** *(new)*: live motions layer additively over the idle instead of hard-cutting it, and motion groups dispatch into the DSL VM during `setMotion` playback.

---

## 4. VRM Animation Ecosystem
A fully customizable idle and performance animation system for VRM models.

- **Revamped VRM Settings Panel**: The VRM model settings surface has been reorganized into a cleaner, more structured editing experience for animations, expressions, and model controls.
- **24 Built-In VRMA Presets**: An expanded library of **24 type-safe, standardized English-named** animation presets selectable via a dropdown in Model Settings, with cross-fade transitions.
- **Per-Character Animation Palettes**: Each character card can be configured with a **subset of the 24 presets** that the idle sampler will cycle through, rather than using the full library. This allows personality-specific animation curation (e.g., calm poses for one character, energetic dances for another).
- **ACT-Triggered Animations**: AI characters can trigger specific animations on-demand via ACT tokens, with automatic cross-fade back to the user's chosen idle on completion.
- **"Idle Hairball" Random Cycle**: A global toggle that continuously **samples random animations** from the character's configured palette, cross-fading between them to keep the character feeling "alive" at rest.
- **Performance Priority System**: When an ACT performance token fires, the idle cycle **pauses and yields**, then resumes a new random idle once the performance completes.
- **User VRMA Uploads**: Users can upload their own `.vrma` files (from marketplaces like Booth.pm) and add them to the animation library.
- **Text-to-Motion (Experimental)** *(new)*: a Text-to-VRMA module page with a real-time, in-browser **FlowMDM ONNX WebGPU diffusion pipeline** that animates the character from text prompts, with a procedural-acting fallback toggle when diffusion is unavailable.

---

## 5. Scenes & Background Manager
Character-scoped backgrounds and the foundation for AI-driven environment control.

- **2 Bundled Scenic Backgrounds**: Ships with **2 built-in scene backgrounds** out of the box for a richer first-run experience.
- **Character-Scoped Backgrounds**: Each AIRI card can specify a **preferred background** that persists across sessions and can be set directly from the Artistry gallery widget.
- **Transparency-Aware Rendering**: Both Live2D (PixiJS `backgroundAlpha: 0`) and VRM (Three.js `clearAlpha: 0`) renderers use **fully transparent canvases**, allowing layered composition with DOM backgrounds.
- **Background-Journal Integration**: The Image Journal and Background systems are **bridged** — generated artistry images can be set as the character's background in a single click.
- **AI-Driven Background Creation**: The AI can not only set an existing image from the journal as a background, but also **generate a new image and set it as the background** in one action — letting the character "redecorate" on the fly.
- **Background Portability**: Active backgrounds are exported **with the AIRI card**, so anyone who imports a character gets their scene automatically applied.
- **Photo Mode (Stage Capture)**: A dedicated 3-2-1 countdown capture system that snapshots the character and their active background into a single composite image. Features a full-screen flash transition for immediate visual feedback. *(The old "Control Island" housing was retired; capture now lives on the Control Strip / customizer.)*
- **Selfie-Enhanced Previews**: Character card previews in the settings menu automatically use the latest "selfie" from the image journal as the portrait, providing a dynamic and personalized view of each character. Includes smart anchoring (object-top) for perfect framing.
- **AVIF Background Reconciliation** *(new)*: cloud sync converts and reconciles background images to AVIF, shrinking multi-device sync payloads.

---

## 6. Memory & Continuity
A sophisticated multi-layered storage system designed for multi-day, consistent roleplay.

- **Two-Layer Memory Model**:
    - **Short-Term (Context Summaries)**: Daily derived "blocks" of conversation history automatically injected into the LLM context.
    - **Long-Term (Durable Journal)**: A persistent, append-only archive stored in **IndexedDB**, allowing for years of recall without context bloat.
- **Unified Retrieval System**: Smart memory lookup that searches **Long-Term first**, then falls back to **Short-Term blocks**, ensuring character recall is seamless across storage layers.
- **Character-Centric Boundary**: Strict isolation of memory per character profile, preventing identity bleed or cross-contamination between different "Souls."
- **Immutable Daily Summaries**: Once a day ends, a final immutable summary is generated, locking in the "soul" of that day's interactions for future recall.
- **Echo Chips & RWKV Salience Gate** *(new)*: High-intensity conversation moments are surfaced as reusable semantic "Echo Chips," gated by a local **0.1B RWKV-7 WebGPU salience sensor** whose boundary votes are benchmarked (F1 0.86 / Precision 0.90 provenance). The tagger runs fully on-device; Chat UI exposes the grounding panel integration.

---

## 7. Artistry & Creative Generation
A complete redesign of the image generation pipeline, focusing on performance and user creative control.

- **Native ComfyUI API Support**: Direct, high-speed HTTP integration with any local or network **ComfyUI instance**. No middleware, CLI bridges, or WSL requirements.
- **Replicate Cloud Support**: First-class integration with **Replicate's API** as a remote generation provider. Pricing transparency is built into the UI — models are sorted with cost-per-generation visible, and starting at **$5 for ~1,600 images** on their cheapest models, it's a great option for users who can't render locally.
- **Interactive Gallery Widget**: A premium "Flip Card" display with **front-face** image preview, **back-face** generation metadata (Prompt, Remix ID, Render Time), and one-click **"Set as Background"**.
- **NanoBanana Provider Support**: Added **NanoBanana** as another first-class artistry backend alongside Replicate and ComfyUI, widening the generation and mutation toolset available to AIRI.
- **"Bring Your Own Workflow" (BYOW)**: Users can upload any `workflow_api.json` from ComfyUI and visually map specific nodes (prompts, seeds, LoRA weights) to be **controllable by the AI**.
- **Global & Per-Character Artistry Control**: Added a "None" provider state to the global settings and per-character switches. This allows users to fully disable image generation module-wide or for specific individuals.
- **Dynamic Prompt Stripping**: Automatically removes image-generation instructions and tool definitions from the system prompt builder whenever Artistry is disabled, preventing AI roleplay confusion.
- **Workflow Templates & Presets**: Save and name complex node graphs as reusable templates. Different AI characters can be assigned **unique generation "personalities"** and prompt prefixes.
- **Bidirectional `{{PROMPT}}` / `{{IMAGE}}` Placeholders**: Artistry workflows can now reuse prompt text and source images through explicit placeholders, enabling cleaner remix and image-conditioned generation flows across provider backends.
- **Automated Image Handoff**: Generated art is instantly archived into the character-scoped **Image Journal**, ensuring no creation is lost across sessions.

---

## 8. Vision & Attention Ecology
Decoupled Vision-Language Model (VLM) support — not present in the upstream project — plus the continuous-vision evolution.

- **Dedicated Vision Store**: A separate `vision` store for VLM provider and model selection, keeping it independent from the primary Chat LLM ("Mind" vs. "Senses").
- **Direct Handover Strategy**: When images are attached, the request is routed **entirely to the VLM** for that turn, allowing cost optimization (e.g., cheap LLM for chat, Gemini Pro Vision for images).
- **Drag-and-Drop / Paste Attachments**: Image attachment support via **drag-and-drop** and **clipboard paste** in both the Desktop and Web chat areas, with a preview strip above the input.
- **Image-Aware Chat History**: Attached images are tracked in the chat history as `image_url` content parts, allowing the AI to reference previously shared images in context.
- **Local & Remote VLM Inference**: Supports **Ollama** and **LM Studio** for fully local VLM inference, plus **OpenAI**, **OpenRouter**, and **Native Gemini SDK** for cloud-based vision.
- **24/7 Attention Ecology** *(new)*: continuous background vision built as a **cascaded salience gate** — pHash dedupe → CLIP vision embedding → WASM OCR / RWKV-7 gate → VLM forwarder — so only genuinely novel screen content pays for a VLM call. Includes privacy app-exclusion filters, live desktop + ASCII terminal dashboards, a devtools inspector, and an "0-cost WebGPU guard" tier.

---

## 9. Provider Integrations
Custom provider integrations not present in the upstream project.

- **Chatterbox TTS**: A first-class speech provider with deep integration:
    - **Preset & Profile CRUD**: A dedicated Chatterbox Management Studio (`Settings → Providers → Speech → Chatterbox`) for creating and managing speech presets and text transformation profiles.
    - **Dynamic Preset Resolution**: Presets combine base voice, model mode, exaggeration, and mannerism profiles into reusable speech configurations.
    - **Capability-Driven Helpers**: Provider capabilities (`supportsSpeechTags`, `availableMannerisms`) are queried at runtime to power context-aware helper UI in the Acting tab.
    - **Semantic Speech Pipeline**: End-to-end flow from ACT token parsing → provider-side text preprocessing → mannerism transformation → TTS synthesis.
- **App (Local) Speech & Transcription**: Direct in-app, privacy-first implementation of **Whisper** (transcription) and **Kokoro** (speech synthesis) via `xsai-transformers`. Runs fully locally in the Electron main process with WebGPU acceleration support, requiring zero external dependencies or API keys.
- **Qwen Portal Provider**: Added a first-class **Qwen Portal** integration with dedicated OAuth plumbing through the unified provider registry.
- **OpenRouter (Easy Mode)**: Integrated **OpenRouter** as the primary backend for the "Sense Portal" Easy Mode, providing a streamlined, high-performance LLM experience with minimal configuration.
- **Deepgram STT (Nova-2/Nova-3)**: Native integration for high-speed transcription with a secure **main-process JWT-based CORS bypass** for the Electron environment.
- **Amazon AWS Polly**: Native high-quality neural speech synthesis integration using `aws4fetch` for secure V4 signing. Supports both **Neural** and **Standard** engines with dynamic voice discovery across all AWS regions.
- **DeepSeek / GLM-4 Streaming**: Added streaming support for `reasoning-delta` events and hardened the categorizer against **malformed tag typos** to prevent prompt stalls.
- **Gemini Live Streaming Pipeline**: Optimized the native Google Gemini Live API for production-grade performance:
    - **Native Audio Playback Queue**: Pre-buffers audio chunks in the main process for gapless, zero-latency streaming.
    - **Custom AI Voices**: Standardized support for Gemini-native voices like **Algenib** and **Fenrir**.
    - **Marker Parser Layer**: Integrated a streaming categorizer that strips ACT, DELAY, and reasoning tokens before the audio stream reaches the user's ears.
    - **Grounding UI**: Real-time awareness of specific external data sources, presented through a clean 3x3 control grid.
- **Local WebGPU LLM & TTS suite** *(new)*:
    - **WebLLM (WebGPU)**: Built-in provider with VRAM-transparent hero cards, a curated 5-model tier (Qwen 3.5 4B/0.8B, Gemma 3 1B, Ministral 3B, Phi-4 Mini), in-context weight downloading, and a "Local Free AI" shortcut.
    - **Kyutai Pocket-TTS**: Local CPU neural TTS with a neural flow sampling engine, 26 cataloged voices, language-filtered dropdowns, voice cloning, and predefined voice presets.
    - **MOSS-TTS-Nano**: Local low-resource TTS with an optimized voice-cloning pipeline and `prompt_audio_codes` caching.
    - **Whisper WebGPU STT** (`whisper-local`): VRAM specs, single-tenant cache enforcement, and VRAM reclaim on model switch.
- **Multi-Instance Provider Studio** *(new)*: the provider registry is decomposed into modular registry/store/lifecycle families supporting **multiple configured instances per provider**, with instance-aware credential gating, 1-click active-model activation for the current character, and a Provider Studio UI overhaul + model browser (paginated, cached, searchable cloud catalogs).

---

## 10. Situational Awareness & Proactivity
Enables the character to perceive and react to the user's real-world desktop environment.

- **OS Sensor Integration**: Proactive injection of real-time telemetry into the LLM context, including **Active Window Title**, **Program Name**, and **User Idle (AFK) status**.
- **Activity History Tracking**: AIRI can track and reference **which applications you've been using** and for how long, allowing for more grounded and reactive roleplay.
- **Environment Telemetry**: Real-time awareness of **CPU/GPU load**, **System Volume** (PowerShell-backed sensor), and **Local Time**, allowing characters to coordinate their energy levels or suggestions with your PC's state.
- **Tool-Aware Proactivity**: Dynamic tool registration for the Heartbeats pipeline — the AI can fetch and use **contextually relevant tools** (Volume, Time, etc.) during proactive evaluation.
- **Metric-Driven Milestones**: Tracking of session-level metadata (total turns, journal entry counts) to trigger **special conversational milestones** or "save-point" reminders.
- **Busy-Pipe Mutex & Prefix-Cache Tail Framing** *(new)*: heartbeat/proactivity sub-loops hold a serialized "busy pipe" and frame traffic at the tail of the prompt so the static system-prompt prefix stays KV-cache-stable — idle turns stay cheap instead of re-hydrating the whole context each beat.
- **Screen Watching Tab** *(new)*: developer-facing screen-watching surface with a visual source picker for probing what the vision pipeline sees.

---

## 11. Discord & Messaging (NEW)
Upstream shipped Discord as a detached sidecar process with limited, text-only features. The fork rebuilt it in three generations, documented fully in [`docs/feat-discord-revamp.md`](docs/feat-discord-revamp.md):

- **Generation 1 — Native Electron Integration**: the bot logic moved from a second process + WebSocket bridge into a first-class service inside the app (`main/services/airi/discord/`), injected via injeca and wired with `@moeru/eventa`. Discord interactions now flow through the **same Episode/Memory pipeline** as desktop chat — no isolated session IDs.
- **Generation 2 — Voice & Native Commands**:
    - **Voice Call Engines** (`/voicecall`): **Gemini** (raw Discord VC audio piped directly to a Gemini Live WebSocket for full-duplex, no-text-first voice, with session-ownership routing of transcriptions to the active Discord text channel) and **Classic TTS** (STT → LLM → TTS with 24kHz mono PCM resampling and custom WAV chunk-merging for chat voice notes).
    - **Voice Modes** (`/voicemode`): `puppet` (desktop speakers), `voicenote` (Discord audio attachments), or `none` (muted) — remote-controlling where her speech comes out.
    - **Native Slash Command Registry**: `/status`, `/imagine`, `/director`, `/character`, `/new`, `/history`, `/chatmode`, `/timelines`, `/summon`, `/leave`, `/journalmoment`, `/voicecall` — REST-registered with native autocomplete; long ops show "AIRI is thinking…" via interaction deferral.
    - **Interactive Message Widgets**: button-driven `/timelines` (select/fork/paginate), `/characters` (switch/details), and `/manage` (voice mode / voice-call engine / chat mode / module toggles) dashboards.
    - **Full Tool Calls**: LLM-driven tools (journal create/search, artistry) execute natively and render as premium results in Discord responses instead of raw JSON dumps; inline artistry images return as native attachments.
- **Generation 3 — Cloud Relay ("Vercel for Characters")**: when you close the desktop app entirely, the character keeps talking on Discord. A stateless **Cloudflare Worker** hosted on **your own Cloudflare account** answers interaction webhooks, reads the live character prompt + rolling conversation from **Cloudflare KV**, calls your LLM, and replies — 24/7, zero-custody, no AIRI backend. The desktop client acts as the control plane and even *deploys* this Worker for you via Cloudflare OAuth, then can switch execution between the local gateway and the edge. Full architecture, deployment flow, and the BYOS/Edge-Vault sync story live in **§19 Cloud Relay & Zero-Custody Sync**.
- **Cloud Relay Execution Handover** *(discord-side detail)*: deploying a relay switches `executionMode` to `remote` and pauses the local Discord gateway (so a single bot token isn't contends for by two listeners). The right-panel memory-review modal lets you inspect the Worker's KV conversation log and hand execution back to local, with relay instances tracked per-character.
- **Mission Control Settings** (`Settings → Modules → Discord`): live gateway status + ping, guild/VC presence table, scrollable event stream, force identity-sync + test/restart buttons, granular toggles, and **DMs disabled by default** for security.

---

## 12. Dating Sim & Companion Gaming (NEW)
A game layer on top of the Actor Stage (Amagami-inspired), plus experimental game-presence modules.

- **Deep Live2D Integration**: The dating sim engine bridges Live2D's DSL VM — in-model choice menus are projected into the overlay as `Choice[]` (with `dsl:`-prefixed ids to keep LLM-generated vs VM-generated options distinguishable), and **DSL Bonus rewards feed persistent intimacy**.
- **Game State Machine**: `GamePhase` (`idle` / `conversation` / `map` / `action`) and `MoodState` (`low`/`normal`/`high`/`max`) drive mood-aware character reactions and choice regeneration.
- **Choice System with Time Pressure**: A delta-ticking engine processes countdown timers on choices with fallback logic if the user doesn't answer in time; scored choices, journey metrics, and Amagami-inspired intimacy/tension/action-points-style stats display on the overlay HUD.
- **Storyline Presets**: Curated story catalogs with branching branch choices, per-card scenery routing, open-ended vs goal-driven modes, max-score/temp-turn settings, and choice-weight displays for debugging.
- **Instruction Sequencer**: A command pipeline that translates game events into stage instructions (motion triggers, expression changes, costume swaps, background swaps).
- **Cross-Window Sync**: Coordinators + secondary-window broadcast pattern keeps the game state consistent between the Chatbox and Actor Stage windows (raw `BroadcastChannel` `dating-sim-sync` — intentionally outside the `airi-*` naming convention).
- **Game Presence Modules** *(new)*: `gaming-module-factory` spawns game-companion modules (Minecraft default port 25565, Factorio) so the character can join/monitor actual game sessions.

---

## 13. Captions & Subtitle FX (NEW)
A full caption subsystem: what the character says/hears, rendered in real time.

- **Floating Caption Window**: A dedicated Electron overlay window over the stage relay — the STT transcript flow and TTS/LLM response flow are overlaid via a `BroadcastChannel('airi-caption-overlay')` streaming protocol. Includes follow-stage visibility/position sync (docking top/bottom or free-floating) and configurable settings.
- **Head-Tethered Caption Plank**: An in-scene caption bubble anchored to the character's head (PIXI container child in Live2D, 3D overlay in VRM/MMD), with **viewport edge clamping**, a seamless single-path vector bubble with tail, and rich telemetry on head anchors.
- **4-Channel FX Engine**: A parametric vector-bubble path builder + 4-channel FX (star blooms, vector hearts, teardrop rain, scanlines, rim stars) driven by a sentence-trigger parser — i.e. caption decoration reacts to content.
- **Sentence Sync Protocol**: Captions track LLM sentence boundaries with actor outline color accents and state persistence, keeping text, audio, and visuals in lockstep.
- **Bite-Sized Micro-Pacer**: Head-tethered Live2D captions dispense streaming text in micro-paces to avoid unreadable text walls on small planks.

---

## 14. MCP Management Hub
A premium, Antigravity-inspired interface for orchestrating the Model Context Protocol ecosystem.

- **Curated Server Discovery**: Integrated discovery for MCP servers across the filesystem, GitHub, and pre-defined curated sources.
- **Antigravity-Inspired UI**: A high-fidelity, settings-integrated dashboard (`Settings → Modules`) designed for maximum clarity and technical control.
- **Tool Titration (Per-Tool Toggles)**: Granular control over the AI's capabilities. Users can toggle individual tools within an MCP server to precisely define the character's "skillset."
- **Real-Time Status Monitoring**: Displays precise tool counts (e.g., `91/91 tools ready`) and provides an instant "Re-poll" capability to refresh toolsets without restarting the Electron host.
- **Standardized Configuration Templates**: Integrated setup guidance and reusable templates at the top of the management view to lower the barrier for manual server additions.
- **Canonical Path Resolution**: Hardened path handling for MCP configurations, ensuring consistency between Windows and Unix-like environments; config lives at `%AppData%/airi/mcp.json`.
- **Non-Blocking Startup** *(new)*: MCP server startup no longer blocks app boot — servers initialize asynchronously post-launch.

---

## 15. Modular Wardrobe System
A persistent, multi-layered clothing and expression management system.

- **Schema-Driven Outfits**: Outfits are stored as part of the AIRI character card, specifying `name`, `icon`, `base/overlay` type, and a set of `expressions`.
- **Base vs. Overlay Logic**:
    - **Base Outfits**: Mutually exclusive. Applying a new Base outfit will "zero out" any other active Base expressions (e.g., swapping a full dress for a swimsuit).
    - **Overlays**: Stackable layers (e.g., glasses, ribbons, hats) that can be toggled on/off independently without disturbing the Base outfit.
- **Interactive "Build Outfit" Mode**: A dedicated staging mode in the character settings that:
    - **Snapshots** the character's current state before starting.
    - Allows **real-time previewing** of expressions as the user selects them.
    - Supports **restoration** to the original state if the build is canceled.
- **Desktop Integration**: Quick-access Wardrobe hub in the desktop control surfaces. Active outfits are visually highlighted (Amber for Base, Sky-Blue for Overlay) with interactive toggle support.
- **Persistence & Portability**: Wardrobe definitions are fully integrated into AIRI Card exports, ensuring character outfits are shared along with their personality and visuals.

---

## 16. Live2D, Spine & MMD Parity
Standardizing the 2D/3D model experiences to match the premium VRM feature set.

### Live2D
- **Standardized 3-Panel Architecture**: The Live2D settings surface is organized into the core **Character Customizations**, **Scene**, and **Advanced** panels, providing a unified UX across all model types.
- **Live2D Expression Mapping**: A **"Hold-to-Map"** interaction — long-press any expression in the grid to bind it to a standard ACT emotion token (Happy, Sad, Angry, etc.).
- **Compact UI Optimization**: A specialized **compact mode** for tabbed navigation with shortened terminology (e.g., "Head & Face" → "Face") for 100% visibility in narrow side-panels.
- **AiriCard Integration**: All Live2D customization data — expressions, motions, and emotion mappings — persists inside the character's `AiriCard`, ensuring total portability.
- **Live2D Scripting DSL VM** *(new)*: a custom scripting virtual machine (`packages/live2d-runtime`) driving models' native script layer — `start_mtn`, `clear_exp` commands, a VarFloats heap with automatic declaration tracking, motion group dispatch, costume hot-swaps (`change_cos`) with state preservation, and intimacy store harnesses; covered by a headless DSL test harness (42+/52+/67+ passing scenario suites) and a `/playground/live2d` web playground.
- **Multi-File Import Queue** *(new)*: bulk Live2D imports run as a queue with progress toasts and macOS ZIP-artifact cleanup.

### Spine
- **Spine 3.x→4.1 Upgrader** *(new)*: An in-memory WebAssembly upgrader converts legacy Spine 3.x skeletons to 4.1 at import time.
- **Variants-to-Expressions Normalization** *(new)*: The ModelCustomizer normalizes Spine variants and skins into a static Emotion list, so Spine participates in the same ACT/outfit pipelines (variant and skin parameters sync from the concept registry's active expressions).
- **Dual Hit-Detection Architecture** *(new)*: precise body-area interactions with a settings UI.
- **Motion Hardening** *(new)*: track-collision prevention, removal of destructive `setToSetupPose` calls during motion updates, one-shot motion audio playback, and full-body thumbnail captures.

### MMD
- **Idle Cycle Support** *(new)*: MMD models get the same idle animation cycling, with preview-expression cross-window sync and scale-limit raises.
- **Orbit Mode & Drag** *(new)*: orbit-mode camera control for MMD scenes with drag/offset events wired into ModelSettings.

---

## 17. Onboarding V2 (Companion Wizard)
Previous section "Onboarding Overhaul (Phase 1)" described the retired Sense Portal flow. The current first-run experience is the V2 wizard — a full rewrite covering nearly every subsystem (see `docs/project-onboarding-modernize.md`).

- **The Sense Pivot** (kept): terminology shifted from acronyms (LLM/TTS/STT) to human-centered terms — **Consciousness, Speech, Hearing**.
- **9-Step Local-First Flow / 11-Step Cloud Returning-User Flow**: Welcome → Path Triage → (Cloud Infra + Cloud Restore for returning users) → Hearing → Consciousness → User Profile → Persona → Vessel → Voice → Calibration.
- **Zero-Custody Cloud Track**: Sign in with **Cloudflare OAuth 2.0 PKCE** to provision the user's own edge CORS proxy / Discord worker / R2 backup bucket and restore existing state — or continue 100% offline with no account at all.
- **In-Context Model Preparation**: every local engine downloads live on its own step (Whisper WebGPU shards, WebLLM weights, Kokoro/Pocket-TTS/Moss-Nano) with real progress bars and test playgrounds — no end-of-setup 99% download screens.
- **Verification Gates**: steps only light up "Next" after real evidence (e.g., Whisper unlocks only when actual transcript text appears). Skip is always allowed.
- **Decoupled Soul & Form**: Persona (Step 4, starters + anime archetypes + community card-import interception) is fully separated from Vessel (Step 5, 3D VRM + 2D Live2D presets + custom dropzone).
- **Atomic Card Synthesis**: steps 1–6 write only to a temporary draft store; Step 7 composes everything into the production `AiriCard` + module stores in one shot — canceling never leaves a half-baked card behind.
- **Customizer Exits**: The wizard is reachable from the first run, the **"Start Companion Wizard"** tray item, and from **Settings → AIRI Cards → Create → Companion Wizard (Recommended)**, where it re-gates the setup state.

### Retired Phase-1 Onboarding (historical lineage)
The previous "Onboarding Overhaul (Phase 1)" flow that shipped before the V2 wizard. Superseded but retained as catalog history.

- **Sense Portal (Easy Mode)**: A zero-config setup path that used **OpenRouter** for instant LLM access and **Deepgram** for high-speed voice services.
- **Automated Provider Configuration**: Successfully completing the Easy Mode flow automatically configured all internal stores (Consciousness, Speech, Hearing) with optimal default models (e.g., `aura-2`, `nova-3`).
- **Advanced Mode**: Retained granular control for power users who preferred custom OpenAI, Anthropic, or local (Ollama/LM Studio) configurations.
- **Onboarding Orchestrator**: A modular, multi-step dialog system that handled branching setup paths and character initialization in a single unified flow.
- **Polymorphic UI Primitives**: Upgraded core UI components (e.g., `Button`) to support polymorphic rendering, enabling seamless integration of external setup links into the premium onboarding interface.

---

## 18. Platform Parity: Web, Mobile & Native (NEW)
Running AIRI is no longer desktop-only. The core experience (`packages/stage-ui` + `stage-pages`) is deliberately platform-agnostic, so the same brain, memory, voice, and rendering drive three distinct hosts that converge on one interaction model.

- **Three Hosts, One Core**:
    - **`stage-tamagotchi`** — the flagship Electron desktop app: multi-window overlays (Stage, Chat, Caption, Customizer, Widgets…), tray integration, Control Strip, tool bridges, and screen-capture hooks.
    - **`stage-web`** — a browser-native web surface backed by the same `stage-ui`: unified header across all breakpoints, viewport cycling with opposite-edge docking and a cursor icon, plus the streamlining of the chat action bar for the web layout.
    - **`stage-pocket`** — the Capacitor hybrid app for **iOS + Android** (with a `dev:web` Vite target), carrying the same composer/chat core as the desktop with mobile-first gesture chrome.
- **Mobile Sheet Architecture**: `WhisperDock` was decomposed into a shared `WhisperComposerBar` + `MobileWhisperSheet`, introducing **4 distinct sheet postures** (with mouse-drag and quick-action collapse/expand controls), producer guidance + choice bubbles wired into the composer (`ProducerGuidanceModal` / `ProducerChoiceBubble`), and an unconfigured-safety modal when the persona isn't set up.
- **Mobile Native Stage**: an overhauled mobile stage with a **story timeline switcher** in the header, pure-Vue popovers, an ambient floating-hearts layer, and a theme-aware frosted Control Strip. A full-screen **Control Strip customizer** supports edge-notch docking and drag positioning, unconstrained on mobile.
- **Mobile Landscape**: dedicated layout support so the experience holds up when the device rotates (with an updated mobile revamp architecture spec).
- **Native Unity Companion**: `apps/stage-mate` — a standalone Unity/VRM desktop-pet window that renders the character outside the Electron surface (see §20).
- **Cross-Platform Fixes**: iOS Web Speech API streaming fixes, web-settings back navigation and STT error alerts, and a catalogue of documented mobile lessons (Vue `<Transition>` scoped-CSS opacity lockups, KeepAlive name matching) hardened the shared codebase without leaking regressions between platforms.

---

## 19. Cloud Relay & Zero-Custody Sync (NEW)
The overarching philosophy is **Local-First, Zero-Custody, and Edge-Native**: there is no proprietary AIRI backend anywhere. The character lives on your own machines, and the cloud is an opt-in extension hosted entirely on the user's own accounts.

### A. The Platform: `@proj-airi/stage-edge` ("Vercel for Characters")
A first-class workspace package (`apps/stage-edge`) compiles a Cloudflare Worker, and ships a Node.js SDK/CLI that deploys it programmatically. The AIRI desktop acts as the control plane / authoring client; the serverless Worker handles the 24/7 presence.

- **Worker Runtime (`src/index.ts`)**: a single stateless HTTP handler. Wakes on POST (Discord interaction webhook or relay), serves `/health`, proxies `/cors-proxy` and `/proxy`, answers Discord **Ed25519**-verified interaction webhooks, and 404s everything else.
    - **Signature Verification**: every incoming webhook is signature-verified against the Discord application public key (`verifyDiscordSignature`, `src/crypto/ed25519.ts`), including Type-1 PING.
    - **Interaction Replies**: slash command interactions defer with `type:5`, run inference inside `waitUntil`, and reply by PATCHing the interaction webhook's `messages/@original`, trimmed to Discord's 2000-character limit.
    - **Generic Web CORS Reverse-Proxy** (`/cors-proxy?url=...`): hides CORS restrictions so outbound calls from browser/web targets (LLM APIs, Cloudflare APIs, token endpoints) work from the client-rendered app, with `x-target-authorization` header remapping.
- **Provider-Agnostic Inference** (`src/inference/llm.ts`): an OpenAI-compatible LLM wrapper driven by a three-tuple of Worker secrets (`LLM_BASE_URL` / `LLM_MODEL` / `LLM_API_KEY`) — nothing Gemini-specific is baked in. `SYSTEM_PROMPT` / `CHARACTER_NAME` are Worker bindings.
- **Edge KV Memory** (`src/memory/kv.ts`): a transactional `KvMemoryStore` with configurable rolling memory windows — `'fixed'` (e.g. 10–50 turns) for concise assistant turns, or `'unlimited'` (0 = fetch full conversation) for deep character coherence. Turns are stored per-user (`history_{userId}_turn_{timestamp}_{turnId}`); the rolling conversation lives at `context/rolling`, and the full system prompt lives at `system/prompt` in KV (bypassing Cloudflare's 5.1KB text-binding cap).
- **Access Control** (`src/discord/acl.ts`): a three-role permission matrix — `OWNER` / `DESIGNATED` / `VISITOR` — that gates which users' interactions the Worker actually answers.

### B. Deployment: The Deployer + Desktop Control Plane
Cloud Relay isn't a manual DevOps exercise — **AIRI deploys it for you**.

- **OAuth 2.0 PKCE login**: "Sign in with Cloudflare" runs a PKCE code challenge, claims or discovers the account's `workers.dev` subdomain, auto-resolves the account ID from the token, and stores `OAuthTokens` + `apiToken` + `accountId`.
- **`CloudflareStageDeployer`** (`src/deployer/`): a Node SDK (`cloudflare` v4) that creates/resolves the KV namespace (`ensureKvNamespace`), seeds the system prompt + rolling memory, binds the LLM tuple and Discord keys, bundles the Worker via in-memory **esbuild** (with a zero-fail pre-compiled `BUNDLED_WORKER_SCRIPT` fallback), and uploads the script + webhooks. `packager.ts` guards that single-step bundling.
- **Client-driven store** (`useCloudflareStore` / `discordStore.deployCloudRelay`): the renderer orchestrates the whole to-the-app flow via IPC — subdomain probe/claim/registration, 2-step deployment review, and a **deployment-review modal** before overwriting an existing Worker. On success it registers the instance into **`cloudRelayInstances`** (per-character): `scriptName`, `workerUrl`, `namespaceId`, `memoryMode`, `deployedAt`, `cardId`, `sessionId`.
- **Execution-Mode Handover**: deploying a relay flips `executionMode` to `remote` and **pauses the local Discord gateway** so a single bot token isn't source-contended by two listeners. The memory-review panel can fetch `context/rolling` back from KV and hand execution back to `local`. Relay instances are tracked per character.

### C. Zero-Custody Sync (BYOS) & Edge Vault
Relay isn't just a chat bot — it's also the spine of state persistence between devices.

- **Edge Vault Credential Sync** (`airi-edge-vault`): provider secrets and runtime tokens are written to a `vault/credentials` KV key (`saveToEdgeVault` / `fetchFromEdgeVault` — direct REST first, CORS-proxy fallback), and are **auto-restored on login**, so a fresh device sign-in can recover your configuration without ever touching an AIRI server.
- **Sync Engine (BYOS adapters)**: a reconciliation engine replicates active state (settings, character artifacts, per-device binaries) to user-owned object storage. The S3 client streams binary blobs directly to the bucket and guarantees initial remote manifest creation, with voice-profile + data-catalog reconciliation and selective model-download guards. The Web bridge uses the CORS-proxy edge worker.
- **Onboarding cloud track**: Onboarding V2 adds **Cloud Infrastructure** and **Selective Restore** steps — Cloudflare sign-in provisions your own edge CORS proxy / Discord worker / R2 backup bucket, then offers a per-artifact selective restore of prior state (see §17).
- **Platform Parity via Relay**: by routing DB and vault reads through the Cloudflare Web CORS reverse-proxy, the same cloud surface serves the web (`stage-web`) and mobile (`stage-pocket`) targets — a single zero-custody spine across desktop, web, and mobile.

> **Design lineage**: the master blueprint is `docs/cloud-relay-design.md`; the generic framework plan is `docs/project-generic-cloudflare-framework-plan.md`. Sibling Discord design specs: `docs/design-discord-context-routing.md` + `docs/design-discord-control-plane.md`.

---

## 20. Stage-Mate: Native Unity Sidecar (NEW)
A native desktop "pet" engine — **Unity 6000.2.6f2** (`apps/stage-mate`) — that renders the AIRI character as a transparent always-on-top companion window. It is built on the upstream `shinyflvre/Mate-Engine` project, layered with AIRI-specific code through a source overlay; pinned to upstream commit `2c5ea6b8` ("Prepare 3.4 Features") so the engine stays upgradeable while all AIRI customizations live in tracked trees.

- **Workspace Overlay Architecture**: `unity-src/` (version-controlled custom code) is deterministically overlaid onto the upstream `mate-engine/` clone via `scripts/setup.ts` only. `mate-engine/` is a gitignored upstream clone that must stay clean; `Patches/` mirrors `MATE ENGINE - Scripts/` to override upstream scripts, `ProjectSettings/` pins the standalone build target. `pnpm -F ... run engine:setup` / `engine:clean` manage the overlay and reset. This keeps the upstream engine upgradeable while all AIRI-side hand-off is reviewable.
- **A Subtractive `StageMateBridge` Runtime**: a C# sidecar (`Core/StageMateBridge.cs`, `StageMateSocket.cs`, `StageMateStateSync.cs`) connects AIRI and the engine over a **`ws://localhost:6171`** WebSocket, driving UniWindowController + VRMLoader + telemetry. It sets platform window config (macOS hit-test disabled, Windows opacity threshold), unlocks the tutorial gate, and suppresses standalone menus in sidecar mode.
- **Dynamic VRM Loading & Model Cache**: the Electron-side service (`main/services/airi/stage-mate/`) dispatches `stage:vrm:load` / receives `stage:vrm:ready` over the `ws://localhost:6171` socket, with a dynamic model-cache gate (cache HIT / on-disk size check / cache-and-dispatch) so repeated swaps don't re-transfer. Sway physics drive the model, and AIRI can fire expressions, tactile events, and prop changes (e.g. the macaron snack) over the socket. A mock WebSocket **harness** (`harness/`, port 6171) lets the engine develop/test without the full Electron app.
- **Interactive Companion Surface**: a standalone **radial pie-menu** (with dynamic root UI activation on open), **companion floaties and snack props** surfaced in the AIRI Control Strip as a popover with featured presets and a custom recipe builder, an interactive TUI harness for expression triggers, two-tier positioning persistence, and customizer viewport modes managed in tandem with the desktop Control Strip.
- **Post-handshake state sync & MEClothes**: after connect, AIRI and the sidecar reconcile state (post-handshake sync), and **MEClothes dynamic sidecar injection on VRM load** keeps wardrobe parity. The `WindowAPI`/`MenuActions` scene-hierarchy is patched active by the overlay.
- **Cross-platform builds**: batch builds via `MateSidecarBuild` + `scripts/build.ts` emit Windows (`StageMate.exe`), Linux (`.x86_64`), and macOS (`StageMate.app`) artifacts; Windows StageMate packaging is added to the Electron release. Windows-only NAudio / Win32 P/Invokes are guarded for clean macOS execution.

---

## 21. Platform & Operations
Internal hardening so the app remains a stable, performant "daily driver" across targets.

- **Windows ZIP + NSIS distribution**: the Electron release builds both an NSIS installer and a ZIP distribution target, with `node_modules` size pruning in the file filter — plus a renderer build shim and Capacitor Android sync, so users get a reasonably clean out-of-the-box runtime.
- **Windows StageMate packaging**: the Electron-builder config now ships the Stage-Mate sidecar artifacts alongside the desktop package (see §20).
- **WebLLM static-worker bundling**: web-llm is statically bundled into the web worker to resolve runtime module-specifier errors, keeping the WebGPU provider working in packaged builds.
- **Dev-loop Hygiene**: `ELECTRON_RUN_AS_NODE` is explicitly cleared in dev scripts, `start_airi.sh` resolves turbo/electron-vite + checks dependencies automatically.
- **Production Electron Sandbox**: full Chromium sandbox is enabled for the Electron environment, a meaningful security improvement for web-forwarded provider integrations.
- **Release Provenance**: published releases follow a `v0.9.x-stable.YYYYMMDD` tag (e.g., `v0.9.25-stable.20260818`, `v0.9.24-stable.20260813`, `v0.9.23-stable.20260808`), giving community users a stable pull point.
- **Operations Skills Catalog**: 44 specialized AIRI skill files + a Rosetta-Stone governing index (`ae3025738`, `35c7fd580`) document subsystem contracts and failure modes, keeping contributors and agents in sync with shipping reality.

### Retained Legacy Hardening
Carried forward from the previous revision's Platform & Operations section; still in force.

- **Interaction Throttling**: window move/resize events are rate-limited on the main process (e.g. `throttle(handleNewBounds, 200)` in the chat window, per-frame throttling for caption follow) to prevent IPC flooding and UI stutter during desktop manipulation.
- **Secure CORS Bypass**: an `onHeadersReceived` / `onBeforeSendHeaders` interceptor on `defaultSession` strips `Origin`/`Referer` and injects permissive CORS headers for trusted provider origins — main-process-controlled, so the renderer's network stack stays safe.
- **Environment Guardrails**: the root `package.json` enforces `node >=20.14.0 <28.0.0` and `pnpm@10.32.1` (`packageManager`), guarding against the `tsdown` build crashes found in newer toolchains.
- **Identity-Guarded Character Switching**: redundant model reloads and duplicate toasts are suppressed when card metadata updates without an actual model switch.
- **Tray Position Restore**: window bounds/state are persisted to a config snapshot and restored on startup.
- **Improved Animation Cycles**: hardened VRM idle-cycle logic in `airi-card.ts` for reliable cross-fading and state transitions during AI-acting and manual overrides.
- **Provider Onboarding & Metadata UX**: the provider settings surface ships beginner-friendly onboarding cues and richer provider metadata presentation.
- **macOS Compatibility**: Node.js constraint relaxed (`<28.0.0`) and TextJournalEntry type mismatches resolved so the app builds cleanly on modern Apple Silicon.
- **MCP Config Stabilization**: canonical path resolution in the MCP module places custom tool config under `@appData/airi` for cross-platform reliability (see §14).

---

## 22. Integrated Upstream PRs
Features from upstream PRs that were integrated, squatted, and maintained in this fork. Status ✅ means integrated; ❌ is reserved upstream (evaluated, not adopted).

| PR # | Function | Author | Status |
|:---|:---|:---|:---|
| #1256 | **Amazon Bedrock Provider** — AWS Bedrock as a first-class LLM provider | @chaosreload | ✅ |
| #1302 | **OpenRouter TTS** — OpenRouter as a TTS provider | @monolithic827 | ✅ |
| #851 | **Configurable Chat Send Key** — user-selectable send key option | @cheesemori | ✅ |
| #1026 | **xAI Grok Voice Provider** — Grok TTS/STT as speech providers | @olsenbudanur | ✅ |
| #1336 | **Chat Connection Guard** — explicit button/wait before chat completion triggers on unverified connections | — | ✅ |
| #1153 | **Window Dock Mode** — Tamagotchi dock mode for Electron | @NJX-njx | ✅ |
| #1065 | **Manual Model Entry** — manual model string when auto-detect is empty | @liuxiaopai-ai | ✅ |
| #1107 | **Native ElevenLabs API on Desktop** — avoids unspeech-proxy 401s | @Hanfeng-Lin | ✅ |
| #1324 | **Server-runtime route fix** — preserves an explicit empty route target | @Gujiassh | ✅ |
| #1190 | **Local Provider Config routes** — resolves missing local provider config routes | @Sakuranda | ✅ |

The integration of [#1324/#1190](https://github.com/moeru-ai/airi/commit/97e5f8b66) (`97e5f8b66`) also restored the missing **local provider settings routes** (`app-local-audio-speech`, `browser-local-audio-speech`, `app-local-audio-transcription`, `browser-local-audio-transcription`) in addition to amazon-bedrock, carried the upstream fix for explicit empty route destinations in `server-runtime`, and included type-fix and encoding-correction passes. A historical full catalog (including ❌ evaluated-but-not-adopted PRs) lived at `docs/FULL_UPSTREAM_PR_CATALOG.md` before the docs reorganization (see commit `97e5f8b66`).
