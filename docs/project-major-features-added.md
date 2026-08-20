# AIRI Fork: Major Features Added

This document catalogs the high-level feature systems added to this fork, sourced from feature reports, release notes (34 stable releases, March–July 2026), the roadmap, and the README. Each entry is a distinct, user-facing capability that does not exist in upstream `moeru-ai/airi`.

Detailed sub-features and technical specifics live in [`docs/chronicles/feature-report.md`](./chronicles/feature-report.md). Pending/planned work lives in [`docs/chronicles/roadmap.md`](./chronicles/roadmap.md).

> **Status legend:** ✅ shipped & stable · 🚧 in progress / partially shipped

---

## 1. AIRI Card Character System

A full-fidelity character management system. Cards are importable, editable, and exportable with all fork-specific extensions preserved. Supports native JSON (`airi-card` v1) and SillyTavern `chara_card_v2` PNG formats. Backgrounds, outfits, and acting metadata are bundled on export. Duplicate imports auto-rename. A dragover backdrop lets you drop `.json` or `.png` cards anywhere on the window to import instantly. (✅)

### Card Editor — Multi-Tab Configuration Surface

The card editor is a multi-tab surface, not a thin metadata form:

- **Acting Tab**: Three prompt layers (model expressions/ACT tokens, speech-expression tags, speech mannerisms). Aligns the model's face, TTS delivery, and character writing style.
- **Modules Tab**: A card carries its own chat model, speech provider/voice, VRM/Live2D avatar, and preferred background. Switching characters switches the entire presentation.
- **Artistry Tab**: Per-card image provider, model override, default prompt prefix, and provider-specific JSON options.
- **Generation Tab**: Per-character LLM provider, model, temperature, top-p, max tokens. Designed for SillyTavern preset import compatibility.
- **Proactivity Tab**: Defines when and how a character speaks on their own. Injects window history, system load, volume state, and usage metrics into heartbeat evaluations.
- **Per-Character Tool Gating**: Disable tool calls per character to reduce context size and prevent errors on models that don't support tool usage (e.g. RWKV).
- **Blank Field Preservation**: System prompt fields that are set to blank stay blank — no rogue default values injected.

(✅)

---

## 2. Multi-Character & Actor Token System

Upstream main only supports 1:1 character-cards — one character per card, with no concept of multiple actors or dynamic model switching. This fork introduces a full multi-character architecture:

- **`<|ACTOR|>` Tokens**: Dynamically switch between 3D models during the speaking phase. The LLM can designate which character is speaking mid-conversation, and the stage renders the correct model in real time.
- **Display Model LRU Cache**: An in-memory Least Recently Used cache for 3D models that prevents latency and visual flicker when dynamically switching between characters on stage. Models are pre-loaded and retained, so rapid actor swaps during dialogue are seamless.
- **Multi-Character Card Support**: Cards can define multiple actors, each with their own model, voice, expressions, and idle animations. The stage handles concurrent models and smooth transitions between them.

(✅)

---

## 3. AnimaDex Guided Card Creator

A standalone multi-step wizard for creating new AIRI character cards from scratch. Integrates dataset-driven character metadata (series, archetypes), WD14 auto-tagging for visual indexing, and AI story idea suggestions. Steps include visual roster/model binding, voice auto-assignment via an extensible provider registry, per-character idle animation selection, and speech/UST pipeline integration. Batch auto-assign utilities in the Studio panel let you manage voices and motions for existing cards. Action-split confirmation with backup-on-apply. (✅)

---

## 4. Sparkle AI Field Generator

AI-assisted content generation buttons rolled out across all AIRI Card tabs — Visual DNA, Stealth Heartbeat, Identity, Behavior, Artistry, and more. Long-form fields converted from inputs to resizable textareas. Sparkle AI context injection preserves core system prompt elements when merging Multi-Role prompts or customizing premises. Includes Multi-Role system prompt templates and Studio concept context injection. Visual Description step (Step 5) in CardImportWizard for generating visual descriptions and artistry prefix definitions. (✅)

---

## 5. Production Studio & Concept Stacking

A system for architecting complex character behaviors and visuals through layered "Concepts." A Concept Registry lets you register and stack Concepts as Base (mutually exclusive) or Additive (layered) onto characters. Layer multiple prompts, artistry rules, and behaviors to create highly nuanced character manifestations. Tabbed Builder Modal for creating and managing your concept library. Manifestation Bridge synchronizes concepts with the live stage. Model Override Grid shows reactive active concept status badges. (✅)

---

## 6. ACT Token & Expression Pipeline — Expanded Format & Model Support

Upstream main invented the ACT token pipeline. This fork broadens it significantly:

- **Expanded Syntax Format Support**: Broader parsing of different ACT token syntax formats beyond the upstream baseline, ensuring compatibility with more LLM output styles and community card formats.
- **MMD & Spine Expression Integration**: Extended the ACT pipeline to drive MMD morph targets and Spine animation slots, not just VRM blendshapes. All four model types (VRM, Live2D, MMD, Spine) now share the same expression pipeline.
- **Live2D Emotion Parity**: Stable Baseline Manager prevents Live2D models from getting stuck in emotional states during rapid interaction.
- **LLM Emotion Keyword Clustering**: Maps LLM-requested emotions to broader synonym and bilingual Japanese/English keyword clusters.
- **ACT/Bracket-Driven Bubble Styling**: Reactive chat bubble styling with mood-colored borders driven by ACT tokens and bracket syntax (e.g. `[happy]`, `[sad]`).

(✅)

---

## 7. VRM Animation Ecosystem

A fully customizable idle and performance animation system.

- 24 type-safe, standardized VRMA animation presets with cross-fade transitions
- Per-character animation palettes (subset selection of presets)
- ACT-triggered animations with automatic cross-fade back to idle
- "Idle Hairball" random cycle toggle for continuous alive-at-rest behavior
- Performance priority system — idle cycle pauses/yields during ACT performances
- User VRMA uploads from marketplaces like Booth.pm
- Batch VRM importer — select and import multiple VRM models at once
- Revamped VRM Settings panel with cleaner editing surface
- Tactile tug-and-pull physics for interactive model manipulation at high refresh rates

(✅)

---

## 8. Modular Wardrobe System

A persistent, multi-layered clothing and expression management system stored within the AIRI card schema. Supports Base outfits (mutually exclusive) and Overlay layers (stackable — glasses, hats, ribbons). Interactive "Build Outfit" mode with snapshot, real-time preview, and restoration. Integrated into the Desktop Control Strip with visual highlighting (Amber/Sky-Blue). Fully portable via card exports. (✅)

---

## 9. Live2D System (Customization, Tactile Interaction & Hacker Tools)

Standardizes the Live2D experience to match the premium VRM feature set.

- **Customization & Parity**: Reorganized into Character Customizations, Scene, and Advanced panels. Hold-to-Map interaction for binding expressions to ACT emotion tokens. Compact UI mode. All customization persisted and exported within AiriCard.
- **Multi-Moc3 Zip Import & Normalization**: Import a single zip file containing multiple `.moc3` files, and the importer automatically splits and normalizes them into separate, individually selectable models. Auto-discovery heals expression files, manifest naming, and motions dictionaries on the fly.
- **Tactile Interaction**: Interactive hit-zone clicking on Live2D models triggers both audio playback and on-screen captions for the associated sound file. Dynamic Tactile Expression Pooling — clicking specific body zones triggers contextually appropriate expression files from available pools. Global tactile interaction decoupled from VRM orbit camera restrictions.
- **Live2D Hacker (lhack)**: A specialized panel for real-time model modification. Texture Deck for surgical upload/download of model textures. Surgical Eraser to remove or hide specific model components. Export stability ensures custom tweaks persist across sessions.
- **Self-Healing Imports**: Automatically heals expression files nested inside subdirectories when importing new cards.
- **Motion Audio Playback**: Motion-associated audio playback for Live2D characters. (✅)

---

## 10. MMD / PMX Model Support

Full MMD model integration alongside VRM, Live2D, and Spine. Real-time physics simulation, interactive mouse tracking (companions look at and follow cursor), and automatic blinking built into the lip-sync system. Custom `.vmd` motion file support. Idle animation cycling with precise camera positioning. MMD morphs and motions fully integrated into the Acting tab of the Card Editor. Unified positioning, lighting controls, and Y-axis inversion handling during canvas dragging. (✅)

---

## 11. Spine 2D Model Support

Native integration for Spine 2D models. Model settings, preview support, animation handling, idle animation cycling, and runtime validation. Binary format support for Spine 4.0+ with robust version parser fallbacks. Auto-detection of premultiplied alpha from atlas headers. Bone-based tactile interaction with refined hitbox math. Drag-to-pan and wheel-to-scale. Motion audio playback. (✅)

---

## 12. Scene & Background Manager

Character-scoped background management that upstream didn't have. Upload scene backgrounds, manage them in a gallery, choose global defaults, and override per-character via AIRI cards. Transparency-aware rendering for both Live2D (PixiJS `backgroundAlpha: 0`) and VRM (Three.js `clearAlpha: 0`). AI-Driven Background Creation — the character can generate a new image and set it as the background in one action. Backgrounds exported with cards. Photo Mode (Stage Capture) with 3-2-1 countdown and flash transition. Fullscreen lightbox picker for the stage background gallery. Responsive Media Library transforms the background picker into a full-page experience. Card previews auto-use the latest selfie as the portrait. (✅)

---

## 13. Two-Layer Memory System

A character-centric memory system replacing upstream's placeholder.

- **Short-Term Memory**: Rebuilds daily continuity blocks from chat history. Blocks stored durably and injected into new/reset sessions. One summary block per day. Language-aware summarization for better conversational context.
- **Long-Term Memory**: Append-only journal archive in IndexedDB. Characters can create and keyword-search journal entries via the `text_journal` tool. Real archive view UI.
- **Unified Retrieval**: Checks long-term journal first, falls back to short-term blocks. Feels like one memory system.
- **Character-Centric Boundary**: Strict isolation per character profile. No identity bleed across souls.
- **Echo Chips**: Lightweight memory fragments surfaced in the chat context panel. Quick at-a-glance recall of recent topics and character-relevant snippets.
- **Dream State**: Characters can enter a dream state where the LLM synthesizes subconscious reflections from accumulated memories and recent experiences. Dream content is injected back into the character's awareness.
- **Trigger-Based Memory Compaction**: Background archival compaction with forking to protect context size from bloating while preserving long-term memory.
- **Semantic Search**: Reciprocal Rank Fusion (RRF) and Maximal Marginal Relevance (MMR) for relevance/diversity balance. Native CJK tokenization for multilingual memory retrieval. Semantic lookup dialog directly inside the chatbox memory popover.
- **Introspective Memory Feedback Loops**: Characters reflect on their own recent actions (journaling, dreaming, creating art) in their immediate context. Dream & Artistry reflective prompts let the character reference what they just dreamed or painted.
- **Custom Journal Prompts**: Customizable system prompt template for Journal Moments.
- **Eternal Thread**: Long-term memory archive view with token budget controls. (✅)

---

## 14. Universe-Based Story Memory Isolation

Upstream main doesn't let you switch sessions at all while using the same underlying models — the chatbox has no concept of session management. This fork introduces a complete session and universe architecture:

- **Quick Session Switching**: A session selector directly in the chatbox lets you jump between different conversations with the same character without any setup.
- **Universe System**: Sessions and timelines are grouped into isolated "Universes." Each universe is a self-contained silo — memories, timelines, and chat histories from one universe never bleed into another.
- **Clean Session Creation**: Create a brand new session under a character that is completely free of memories and artifacts from previous sessions — start fresh without losing the old ones.
- Multiple sessions can coexist under the same character and universe, or span across different universes for entirely separate storylines.

(✅)

---

## 15. Artistry & Creative Generation

A complete redesign of the image generation pipeline.

- **Native ComfyUI API**: Direct HTTP integration with any ComfyUI instance. No middleware or WSL requirements.
- **Replicate Cloud**: First-class remote provider with pricing transparency in the UI.
- **NanoBanana Provider**: Additional first-class artistry backend.
- **"Bring Your Own Workflow" (BYOW)**: Upload `workflow_api.json` and visually map nodes to be AI-controllable.
- **Global & Per-Character Control**: "None" provider state; dynamic prompt stripping when disabled.
- **Workflow Templates & Presets**: Save/reuse named node graphs; different characters get unique generation personalities.
- **Bidirectional `{{PROMPT}}` / `{{IMAGE}}` Placeholders**: Reuse prompt text and source images across provider backends.
- **Automated Image Handoff**: Generated art instantly archived into character-scoped Image Journal.
- **Background-Journal Bridge**: One-click to set generated art as the character's background.
- **"Imagine" Mode**: A button in the chatbox opens an inline prompt modal — the user types a prompt and generates an image on demand, without needing to go through the AI or settings. Direct user-to-artistry pipeline.
- **ComfyUI Web Surface Support**: Full ComfyUI support in the browser/web view. (✅)

---

## 16. Vision Support (Decoupled VLM Pipeline)

A dedicated Vision-Language Model system independent from the primary Chat LLM ("Mind" vs. "Senses"). When images are attached, the turn routes entirely to the VLM for cost optimization. Drag-and-drop and clipboard paste with preview strip above chat input. Image-aware chat history via `image_url` content parts. Local inference via Ollama and LM Studio; cloud via OpenAI, OpenRouter, and Native Gemini SDK. Global shortcut for vision captures while the app window is active. (✅)

### Two VLM Strategies

- **Direct Response (Impersonator)**: The VLM responds directly in the character's voice — the character "sees" the image and replies as if looking at it themselves. This is the simpler path where the vision model and chat model are one and the same turn.
- **"Forward to LLM"**: The VLM generates neutral descriptions/tags (e.g. WD14 tagger, Kimi 2.5 captioning) which are injected into the text stream. The primary chat LLM then responds in its authentic character voice, informed by the VLM's description rather than impersonating the VLM. This decouples sight from voice. (🚧 — mostly implemented, needs timing tuning)

### WD14 Local Image Tag Extractor & Model Collection Scouting

A standalone local image tag extractor modal powered by WebGPU WD v3 tagger. Beyond generating prompts, it scouts through your entire model collection and decorates every model with associated tags (e.g. "blonde hair", "school uniform", "cat ears"). These tags power search, filtering, and organization across the model selector, CardImportWizard, Concept Builder, and Control Strip avatar popover. (✅)

---

## 17. AI Producer Subsystem

A dual-track AI suggestions engine decoupled into two operational modes:

- **Producer Lite (Stateless)**: Operates entirely within the chatbox context using only the local conversation thread. Generates context-aware, user-mimicking interactive suggestions on the fly. Requires zero configuration, database records, or storyline setups — works instantly on any character session. Recently integrated into the Actor Stage so suggestions appear alongside the character. Quick-Suggest magic wand triggers suggestions from current composer input text. Play-All button for sequential TTS playback of all alternative paths. Decoupled preview textareas for editing suggestions. The WhisperDock inside the actor stage provides floating voice control for hands-free suggestion interaction.
- **Producer+ (Campaign & Story Orchestration)**: Full-featured Producer OE (Open-Ended), GD-IT (Gameshow Host / Initial Turn), and GD-NT (Next Turn) engines. Ties suggestion choices to the Intimacy Engine's variables (`intimacyChange`, `tensionChange`, `mood`), storyline guidelines, local scene settings, and custom encounter rules. Cache-aligned full-context suggestions with editable prompt templates.

(✅)

---

## 18. Situational Awareness & Proactivity

Characters perceive and react to the user's real-world desktop environment. Real-time OS sensor injection: active window title, program name, user idle (AFK) status. Activity history tracks which applications the user uses and for how long. Environment telemetry: CPU/GPU load, system volume, local time. AppleScript fallback for active window tracking on macOS. Tool-aware proactivity fetches contextually relevant tools during proactive evaluation. Metric-driven milestones trigger special conversational moments. Deep Context Awareness — the character knows when it's blushing, wearing accessories, or what's on screen. Mid-card-switch proactivity guards and session ownership validation. (✅)

---

## 19. Dating Sim System

A dedicated dating simulation mode with dynamic encounter selection (Sandbox Mode vs. Goal-Driven Date Session). Intimacy Engine tracks variables like `intimacyChange`, `tensionChange`, and `mood`. Custom encounter rules and storyline guidelines. Dating Sim Overlay with real-time caption synchronization. Dating Sim Preferences integrated under Memory settings. (✅)

---

## 20. Desktop Control Strip & Actor Stage

A comprehensive desktop interaction system. The original "Control Island" (a hub inside the actor stage window) has been completely deprecated and replaced by the **Control Strip**.

- **Control Strip**: A floating, draggable glassmorphic interaction bar using `backdrop-blur-xl` and semi-transparent backgrounds. Mutual exclusion between Main and Gemini/Module strips keeps the desktop clean. Houses all quick-access controls that were previously split across the old island: profile switcher popover, character popover, 8-emotion picker sub-menu, animation cycle button, ScrollLock mic toggle, manual pure-mic mode, local TTS voice switch popover, and transcription feedback toasts.
- **Control Strip Customizer**: Window manager with bottom-placement popover, master button catalog, and left-sidebar layout configurations. Interactive status dot indicators (red/green mic, 5-way speech session indicator). Inverted interaction — single-click collapse/expand, double-click toggle layout.
- **Snap-to-Edge & Auto-Hide**: Automatic edge-snapping auto-hide with macOS work area/screen boundary awareness. Popover-aware retention holds the strip expanded when menus are open.
- **Decoupled Actor Stage**: Standalone character renderer window with premium rounded-xl borders, bottom-right drag handle, and optimal aspect ratio rendering. Works independently from the main chat/controls window. Electronic touch-gesture dragging support. Fade-on-hover "Eye" mode keeps the UI nearly invisible when hovering over the model.
- **Smart Window Snapping & Position Persistence**: Windows snap to edges and remember their last position across restarts. Cross-window synchronization for caption visibility, session deletions, and chat message broadcasts. (✅)

---

## 21. Chatbox Redesign

A comprehensive re-architecture of the main conversation workspace into a multi-surface layout, plus broad chat UX enrichments.

### Workspace Layout
- **Three-Column Layout**: Navigation, conversation, and context sidebars are separated into dedicated surfaces that never compete for screen space.
- **Left Navigation Sidebar**: Primary hub switching between Chat Messages, Studio Monitor, World Bible, Media Library, and Settings. On mobile, operates as a responsive overlay drawer.
- **Right Context Panel**: Desktop viewport panel displaying Memory Cards (Echo chips, daily summaries, journal entries) and a lazy-loading Media Gallery. Unified collapsible header bar that stacks vertically on mobile.
- **Consolidated Toolbar**: Memory and proactivity controls in the top header; grounding options in a clean ellipsis dropdown menu. Centered session switcher and quick LLM selector ("Brain Popover") in the titlebar. Naked-on-idle premium button styling.
- **Quick-Suggest Magic Wand**: Trigger response suggestions instantly from current composer input text. Inline "Add Media" popover replacing Imagine Mode.

### Chat UX Enrichments
- **Real-time Spoken Highlights**: The exact sentence being uttered is highlighted inline using the CSS Custom Highlight API, completely eliminating DOM layout thrashing and OOM crashes on long chat logs.
- **Mood Tags & Colored Chat Bubbles**: Configure your character to use mood tags like `[happy]` or `[sad]`, and the chat bubble for that message gets color-coded appropriately — mood-colored borders and background tints give each message distinct personality at a glance.
- **Screenplay Actor Formatting**: Chat bubbles support screenplay formatting with high-contrast dynamic chips and actor-aware colored text segments.
- **Inline Message Editing**: Both user and assistant messages can be edited inline directly in the chat bubble.
- **Draft Autosaving**: Trailing throttle localStorage autosave for chatbox drafts, preserving typed text across restarts.
- **Configurable Send Key**: User-selectable chat submission hotkey (Enter vs. Ctrl+Enter).
- **Context Meter**: Visual progress bar and token counter transitioning Green → Yellow → Red as the character's memory limit is approached.
- **Context-Width Inheritance**: Automatic global default mapping linking provider/model to user-defined context width.
- **Clear Chat Archival**: Director notes are archived instead of simply cleared.
- **Timeline Management**: Fork & Switch, Trim Timeline, and Delete Following controls from the message action menu.
- **Journal Moments**: Real-time previews and seamless LLM integration for creating journal entries during chat.
- **Caption System**: Colored, segmented captions with actor-aware tracking, real-time active segment highlighting, and smart click-through for desktop usability. (✅)

---

## 22. Studio Monitor Panel

A creative diagnostics console that gives creators an "at-a-glance" dashboard to audit active concept stacks, wardrobes, and place configurations. Actor & Place Prose Parser dynamically extracts character descriptions and setting lore from cards to visualize character perspectives during chat. "Configure" shortcut button instantly opens the card's Studio settings tab. Visual roster cards with model preview avatars. (✅)

---

## 23. Model Selector — Redesigned

The Settings → Models → Select Model dialog is night-and-day different from upstream:

- **Search**: Full-text search across model titles, filenames, tags, and groups. Upstream had no search at all.
- **Filters**: Filter by model type (VRM, Live2D, MMD, Spine) and by tag groups.
- **WD14 Tagging Integration**: Tag models directly from the selector using the local WD14 tagger — scout your collection and decorate every model with searchable metadata.
- **Dual Layout Modes**: The upstream classic 2-column layout plus a dense 4-column layout for browsing large collections efficiently.
- **Batch VRM Import**: Select and import multiple VRM models at once directly from the selector dialog. (✅)

---

## 24. Discord Integration Revamp

A ground-up Discord bot integration that upstream does not have in functional form.

- **Classic TTS Voice Pipeline**: Discord Audio → STT → Custom LLM → Custom TTS → Discord Audio. Browser-side 24kHz PCM resampling with raw PCM streaming into the active connection's voice player. WAV merging for complete voice notes. Self-speaker muting to prevent echo-back. STT ingestion auto-injects voice channel transcripts into chat sessions.
- **Bidirectional Gemini Live Audio Bridge**: Pure JS audio bridge connecting Discord voice channels directly to Gemini Live sessions. Audio-to-audio — zero text involved. Auto-session lifecycle with auto-start/stop triggered by channel activity. `/summon` and `/leave` voice commands.
- **`/voicemode`**: Supports `puppet` (local speaker playback), `voicenote` (combined TTS chunks as voice notes), and `none` modes.
- **Slash Commands**: `/status`, `/imagine`, `/character`, `/new`, `/history`, `/director`, `/vision`, `/selfie`, `/timelines`, `/journalmoment`. Rich status dashboard with timeline, universe, chat mode, and VLM configuration details.
- **Image Pipeline**: Companions "see" images attached to Discord messages (via VLM routing) and send visual manifestations back.
- **Per-Channel Isolation**: `channelId → activeCharacterId → activeSessionId` mapping. Each channel gets its own character and session.
- **DM Access Control**: Master toggle to restrict/enable DM command ingestion. Sync isolation excludes the flag from cloud sync.
- **Interaction Modes**: Queue (ordered processing) vs. Steer (proactive/reactive). NO_REPLY hook lets the AI intelligently decide to stay silent.
- **Interactive Dashboard Widgets**: Discord widgets with pagination for active status dashboard, timeline histories, and character selector grids. (✅)

---

## 25. Audio Studio — Virtual TTS Provider

A virtual proxy TTS provider concept that upstream does not have. Bundles base speech engines (Kokoro, Azure, OpenAI) with custom audio effects and UST settings into named, globally-referenceable voice profiles. Dynamic Web Audio DSP with live voice processing effects (EQ, reverb, dynamics). Voice library playground with real-time preview controls. Supports modular post-processing transformations: Pitch Shifting, Rate/Speed adjustments, and Voice Equalizers. Advanced UST rules with bracket action mapper and custom character substitutions. Quick Audio Studio Creator modal directly inside the guided card creator. (✅)

---

## 26. Speech & Provider Integrations

Provider integrations beyond the upstream baseline:

- **Chatterbox TTS**: Preset & profile CRUD with dedicated Management Studio. Dynamic preset resolution. Capability-driven helpers for context-aware UI. Semantic speech pipeline from ACT token to TTS synthesis.
- **App (Local) Speech & Transcription**: Privacy-first Whisper (transcription) and Kokoro (speech synthesis) via `xsai-transformers`. Runs fully locally in Electron main process with WebGPU acceleration. Zero external dependencies. Consolidated under a unified App (Local) provider with interactive activation toggle. Eventa-compatible Whisper worker with English-only optimized models.
- **MOSS-TTS-Nano Local Voice Provider**: Browser-local voice provider with voice cloning playground and OPFS model caching. WASM core execution to prevent storage buffer limit errors.
- **WebGPU Inference Engine**: On-device model execution with hardware acceleration. VAD Web Worker and Semantic Search Scheduler as dedicated background workers. ModelCacheManager UI for browsing, downloading, and managing local inference models. RWKV-7 and Whisper local inference with Hugging Face downloader integration.
- **Deepgram STT (Nova-2/Nova-3)**: Native integration with main-process JWT-based CORS bypass.
- **AWS Polly**: Native neural speech synthesis with `aws4fetch` V4 signing. Neural and Standard engines with dynamic voice discovery across all AWS regions. Generative and long-form voice models.
- **Gemini Live**: Native audio playback queue for gapless streaming. Custom AI voices (Algenir, Fenrir). Marker parser layer strips ACT/DELAY/reasoning tokens. Grounding UI with 3x3 control grid.
- **Gemini TTS**: Native Google Gemini text-to-speech provider.
- **DeepSeek / GLM-4 Streaming**: `reasoning-delta` event handling and typo-tolerant ACT tag categorizer.
- **Qwen Portal**: Dedicated OAuth-plumbed integration.
- **OpenRouter Easy Mode**: Primary backend for the Sense Portal onboarding flow. (✅)

---

## 27. MCP Management Hub

A premium, Antigravity-inspired interface for orchestrating the Model Context Protocol ecosystem. Curated server discovery across filesystem, GitHub, and pre-defined sources. Per-tool toggles for granular capability control. Real-time status monitoring with tool counts and re-poll capability. Standardized configuration templates. Canonical path resolution. Rebuilt settings with direct JSON editing, connection testing, server enable/disable controls, and restart feedback. One-Click Install flow for MCP plugins. (✅)

---

## 28. Cloud Sync Engine (BYOS — Bring Your Own Storage)

A full cloud backup, restore, and sync system with multiple storage provider support:

- **S3 / Cloudflare R2 Sync**: Backup, restore, and sync character assets and models. Intuitive settings UI for credentials and provider swapping. Bootstrap safety to prevent accidental local deletion on first sync.
- **Google AppData Integration**: Cloud backups with automated restore prompts and progress indicators during onboarding.
- **Selective Sync Filtering**: Group assets by character ID bundle and choose exactly which directories and character files are backed up. Restore-only settings for scoped custom settings recovery.
- **Conflict Triage UI**: Standardized triage indicators allowing users to choose Keep Local, Keep Remote, or chronologically Merge Message History for blocked contractions.
- **Contraction Safety Heuristics**: Intercepts and blocks silent data contractions (e.g. a newer but empty database silently overwriting rich local history).
- **Heavy-Asset Sync**: VMD and VRMA motion libraries sync with robust tombstone tracking for deletions. Index merge logic and critical-index safety guards prevent fresh clients from overwriting remote backups.
- **Cross-Window Reactive Sync**: Changes in one Electron window immediately propagate across all active frames.
- **Automated 24-Hour Backups**: Background service automatically backs up local data every 24 hours.
- **STMM, LTMM & Display Model Stores**: Critical data stores fully synchronized that were previously excluded from cloud backups. (✅)

---

## 29. Onboarding Overhaul

A redesigned first-run experience that reduces setup friction. The very first question is "Are you an existing user or a new user?" — existing users are guided through a BYOS restore flow.

- **Google Sign-In for BYOS Restore**: Existing users can sign in to Google to retrieve their AppData, which contains saved S3 credentials or filesystem paths. This enables a one-click restore of all their characters, settings, and assets from cloud storage during onboarding.
- **Sense Portal (Easy Mode)**: Zero-config setup using OpenRouter for LLM and Deepgram for voice. Completing the flow auto-configures all internal stores with optimal defaults.
- **The Sense Pivot**: Terminology shift from technical acronyms (LLM, TTS, STT) to human-centered terms (Consciousness, Speech, Hearing).
- **Advanced Mode**: Retains granular control for power users with custom providers.
- **Onboarding Orchestrator**: Modular, multi-step dialog with branching setup paths and character initialization.
- **Polymorphic UI Primitives**: Upgraded core components for seamless integration of external setup links. (✅)

---

## 30. Global User Profiles

A dedicated user-profile settings page with integrated voice profile store. Self-Concept Wizard option registers a user self-concept template (compiled under a generic `concept_user` key) for multi-actor layouts. Profile field autocomplete and shortcut handling. Narrator voice fallback to user's customized profile voice for narrative cards. (✅)

---

## 31. V-Hack & L-Hack (Unified Texture Editor)

In-app visual experimentation surfaces for AI-assisted texture and mutation workflows. Extends AIRI from pure card configuration into model reskinning.

- **V-Hack (VRM Texture Editor)**: Dynamic reskinning for VRM (3D) models. Upload, edit, and save-back textures directly.
- **L-Hack (Live2D Texture Editor)**: Surgical upload/download of Live2D model textures for precise, live editing. Surgical Eraser to remove or hide specific model components. Export stability ensures custom tweaks persist across sessions.
- Supports MMD/PMX and Spine runtimes as well. (✅)

---

## 32. Platform & Operations Hardening

Internal hardening for a stable daily-driver build.

- Interaction throttling (200ms rate limit on window move/resize to prevent IPC flooding)
- Secure CORS bypass via main-process header interceptor; user-managed dynamic CORS bypass settings for any provider that enforces CORS — routed through Electron to bypass restrictions
- Single instance lock prevents duplicate parallel running instances
- Environment guardrails (Node.js >= 20.14.0, pnpm >= 10.0.0)
- macOS Apple Silicon compatibility
- Production Electron sandbox (full Chromium sandbox enabled)
- Tray position auto-restore from saved snapshots
- Cross-window IndexedDB sync resolving "Lost Update" race conditions
- Index auto-recovery bridge that reconstructs missing index records from raw local session files on startup (✅)

---

## 33. Architecture & Pipeline Unification

All interaction pipelines (typed chat, STT-triggered chat, proactivity heartbeats) consume the same shared `builtinTools` surface. New builtin tools like `text_journal` and `stage_widgets` are automatically available across every pipeline without per-surface wiring. All chat updates broadcast before database persistence to prevent UI locks. (✅)

---

## 34. Zero-Trust Privacy Architecture

A foundational principle of this fork: the developer has zero access to any user data. No analytics, no telemetry, no usage tracking of any kind. All data (characters, memories, conversations, settings, assets) lives exclusively on the user's machine or their own chosen cloud storage (S3/R2/Google AppData). The application functions as a fully local-first, privacy-respecting companion. Legacy PostHog tracking and analytics scripts inherited from upstream have been fully removed. Cloud sync is opt-in and disabled by default. (✅)
