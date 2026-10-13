# 🚀 AIRI v0.9.38-stable.20261012 — Release Notes

This release marks a massive leap forward in companion capabilities and visual polish: introducing **In-Memory Virtual Terminals & Generative UI Micro-Apps**—giving companions an air-gapped workstation to run tools, execute terminal commands, and generate live interactive mini-apps directly in chat and on the desktop—alongside the **TypeSafe Jev System-1 Decision Engine**, an exhaustive **Step-by-Step Redesign of Onboarding V3**, **OpenRouter Audio Transcription**, **Reviewable Voice Dictation**, **System Theme Auto-Syncing**, **Live2D VRAM Memory Leak Elimination**, and **Thai (ไทย) Language Support**.

Companions can now autonomously write and render interactive visual widgets with two-way state reactivity, dictate speech straight to your chat composer for review before sending, make ultra-fast subconscious decisions via the Jev System-1 coprocessor, and guide you through an expressive, mascot-sticker-accented first-run setup.

---

## ✨ Key Highlights

### 🖥️ Virtual Terminal & Generative UI Micro-Apps
* **Autonomous In-Memory Virtual Terminal**: Companions now have access to a secure, in-memory virtual workstation capable of executing terminal commands, managing virtual filesystems, and chaining tools locally without requiring Docker or heavy VM infrastructure.
* **Dynamic Generative UI Micro-Apps**: Companions can now write, compile (via in-browser Sucrase), and render interactive Vue and HTML/JS mini-applications directly inside chat message bubbles or as floating desktop sidecar overlays.
* **2-Way Reactive Widget State**: Generative widgets maintain bi-directional state synchronization with your companion's memory and chat session, enabling interactive calculators, real-time monitors, data visualizations, and gameboards.
* **Persistent Breakout Overlays**: Generative UI widgets can be detached into standalone desktop breakout windows with saved window coordinates and automatic rehydration across app restarts.
* **Micro-App Library & Manifest Import**: Browse bundled generative micro-apps, export widget packages, and import third-party manifests with built-in CloudSync multi-device merge safety.
* **Native MCP CLI Toolchain**: Users and companions can discover, inspect, and execute Model Context Protocol (MCP) tools directly within the Virtual Terminal.
* **Cross-Surface Terminal Access**: Monitor companion commands and outputs in real time via a restyled terminal drawer on Desktop and Web, and a dedicated Workspace overlay sheet on mobile (Pocket).

### ⚡ TypeSafe Jev System-1 Decision Engine
* **Subconscious Decision Coprocessor**: Integrated TypeSafe Jev System-1 for non-autoregressive, ultra-fast discrete decision routing (~100–150ms), allowing companions to evaluate choices, scores, and categorical classifications in the background without burning primary LLM generation cycles.
* **OpenCode-Go Coprocessor Provider**: Native support for the OpenCode-Go coprocessor backend (`jev-1.13` and `jev-1.13-free`) with live telemetry tracking decision counts, latency, and token efficiency.
* **Semantic Shell & Decision Bridge**: The Virtual Terminal now consults Jev System-1 before executing commands, evaluating intent and classifying safety constraints.
* **Multi-Provider System-1 Parity**: Full support across four distinct backends: OpenRouter Decisions (`/api/alpha/decisions`), OpenCode-Go, Direct TypeSafe AI, and local on-device Laya (WebGPU/WASM ModernBERT).
* **System-1 Telemetry Dashboard**: The System-1 settings card now features live round-trip latency metrics and interactive decision playgrounds.

### 🧙 Onboarding V3: Step-by-Step Experience Polish & Hardware Intelligence
* **Welcome Step**: Refreshed welcome screen with modern typography, subtle canvas background styling, and a seamless toggle between express Quick Start (60s) and Guided Setup.
* **Triage Step**: Overhauled account architecture selection featuring direct-action cards for Local Air-Gapped vs. Cloud Sync modes, alongside a dedicated non-blocking Cloud Restore screen.
* **Appearance Step**: Complete appearance redesign featuring an 8-locale selector (including new Thai support), dynamic System / Dark / Light theme options, and an interactive 24-color chromatic accent palette.
* **Experience Step**: Balanced the 6 companion archetype presets (*Casual Companion*, *Creative Muse*, *Quiet Observer*, *Executive Copilot*, *Ambient Roommate*, *Swiss Army*) and organized the module grid into a clean 5×2 layout with live hardware compatibility telemetry.
* **User Profile Step**: Streamlined two-column profile layout featuring companion callsign inputs, user persona preferences, and animated chibi AIRI mascot guidance bubbles.
* **Physical Vessel Step**: Upgraded the unified 3D vessel coverflow carousel with responsive aspect-ratio framing, interactive settle callbacks, and model format badges (VRM, Live2D, MMD, Spine).
* **Consciousness Step**: Overhauled LLM consciousness step featuring local WebLLM WebGPU model cards, 77+ cloud provider discovery, custom Base URL entry for generic OpenAI endpoints, and a restored native provider picker grid.
* **Persona Step**: Redesigned character card selection with rich starter character cards, story variation selectors with quick copy glyphs, and seamless import for CCv2/CCv3 and SillyTavern character cards.
* **Hearing Step**: Polished speech-to-text configuration with live microphone input metering, interactive VAD sensitivity slider, local Whisper model selection, and OpenRouter cloud transcription support.
* **Speech Step**: Completely revamped neural speech interface with a clean 50/50 split layout between voice model selection (Kokoro, Pocket-TTS, ElevenLabs) and real-time pitch, rate, and speech preview controls.
* **Thinking Step**: Revamped conversational pacing hub featuring Snappy, Balanced, and Deep CoT thinking presets with pre-cached filler audio previews and subconscious aside toggles.
* **Emotions Step**: Enhanced 2-pass ACT Expression Bridge step mapping facial expressions and blendshapes to `<|ACT:*|>` tokens with real-time morph test preview.
* **Vision Step**: Upgraded chat VLM and photo perception step with two-hop camera testing and visual recognition sample cards.
* **Proactivity Step**: Overhauled ambient proactive behavior hub with schedule cards, quiet hours configuration, ambient heartbeat sliders, and desktop perception toggles.
* **Artistry Step**: Refined autonomous image generation and director step with ComfyUI workflow template selection and exposed field mappings.
* **Memory Step**: Overhauled memory hierarchy hub configuring Short-Term Memory (STMM), append-only Sacred Journal (LTMM), and lifetime artifact provisioning.
* **Tools & Automation Step**: Updated tool hub configuring MCP integration, built-in system tools, and Virtual Terminal execution permissions.
* **Stage Finale Step**: Upgraded final calibration review featuring the readiness honesty matrix, atomic companion card synthesis, and stage launch transition.
* **Sensory & Screen Steps**: Polished desktop screen perception, active-window history tracking, and environmental sensor telemetry.

### 🎙️ Audio Pipeline & Speech Polish
* **OpenRouter Audio Transcription**: Added native support for OpenRouter speech-to-text (STT), giving users access to top-tier cloud audio transcription models alongside local Whisper.
* **Reviewable Speech Dictation**: When "Auto-send" is disabled, transcribed voice input is placed directly into the chat composer, allowing you to review and edit recognized text before sending.
* **Exhaustive Local Whisper Catalog**: The Hearing settings faculty picker now lists all supported local Whisper model variants (tiny, base, small, and medium).
* **Cross-Platform Speech Interruption**: Hitting the stop button on Web and Mobile now instantly interrupts ongoing TTS playback and flushes pending speech queues, matching desktop behavior.
* **Whitespace Literal Preservation**: Prevented speech streaming audio processors from stripping necessary whitespace literals across stream chunk boundaries.
* **Reasoning Speech Suppression**: Ensured deep internal reasoning and thinking traces are never accidentally vocalized by the TTS speech engine.

### 💃 3D Avatar Rendering & Memory Reliability
* **Live2D VRAM & Listener Leak Plugged**: Switching or unmounting Live2D models now completely unloads textures from WebGL memory and cleans up stage listeners, eliminating gradual memory bloat during extended sessions.
* **Remote HTTP Avatar Catalog**: Import and download avatars from remote HTTP URLs with built-in proxy-safe persistence and automatic caching.
* **Decoupled Starter Companions**: Decoupled starter companion activation from hardcoded legacy IDs, preventing companion profile overwrites and state collisions.
* **Orbit Gesture Stability**: Camera orbit controls now maintain smooth 3D rotation gestures across native text selection drags.

### 🌗 System Theme & Internationalization
* **System Theme Auto-Syncing**: AIRI now includes a true "System" theme option across General Settings and the floating Control Strip, automatically matching your operating system's light or dark mode.
* **Thai (ไทย) Language Support**: Added comprehensive Thai localization across the application and Onboarding appearance selection.
* **Full Simplified Chinese Companion Setup**: Onboarding V3 is now 100% translated into Simplified Chinese.
* **Anthropic Title Formatting**: Fixed delimiter parsing to cleanly display pipe separators in Anthropic provider titles across all languages.
* **Blazing Fast Web Stage Startup**: Web Stage now caches WebAssembly binaries on first use instead of pre-caching everything on initial page load, dramatically speeding up initial load times.

---

## 🌐 Community & Upstream Radar

### 🤝 Community Collaborators & Fork Pull Requests
* **Nan0 Architecture Collaboration**: Heartfelt shoutout to **@Kayoken54** for continuous architectural design discussions, feedback, and testing support guiding the evolution of the Nan0 cognition engine on Discord.
* **PR [#20](https://github.com/dasilva333/airi/pull/20): feat(i18n): localize Companion Setup into Simplified Chinese** — Huge thanks to **@ki1lthewor1d** for fully translating the Onboarding V3 companion wizard into Simplified Chinese.
* **PR [#23](https://github.com/dasilva333/airi/pull/23): feat(stage-tamagotchi,stage-ui): put transcribed text into chat input when auto-send is off** — Special thanks to **@meckbaig** for enhancing voice accessibility by piping voice transcription directly into the message composer for review.
* **PR [#25](https://github.com/dasilva333/airi/pull/25): fix(stage-pages,stage-ui): list every local Whisper model in the hearing faculty picker** — Special thanks to **@meckbaig** for expanding the Hearing settings picker to expose all available local Whisper models.

### 🌊 Upstream Pull Requests (Forward-Ported from moeru-ai/airi)
* **PR [#2920](https://github.com/moeru-ai/airi/pull/2920): feat(provider-inference): add OpenRouter transcription provider** — Sourced and adapted from upstream by **@Weathercold**.
* **PR [#2929](https://github.com/moeru-ai/airi/pull/2929): feat(i18n): add Thai** — Sourced and adapted from upstream by **@蓝莓🫐**.
* **PR [#2930](https://github.com/moeru-ai/airi/pull/2930): chore(i18n): warn only when English lacks a message** — Sourced from upstream by **@蓝莓🫐**.
* **PR [#2843](https://github.com/moeru-ai/airi/pull/2843): feat(stage-pages,stage-ui,i18n): support system theme option in general settings and control strip** — Sourced from upstream by **@Penluna**.
* **PR [#2894](https://github.com/moeru-ai/airi/pull/2894) & [#2891](https://github.com/moeru-ai/airi/pull/2891): fix(stage-ui-live2d,stage-ui): release unmounted Live2D models, textures, and stage listeners** — Sourced from upstream by **@starvingarc**.
* **PR [#2896](https://github.com/moeru-ai/airi/pull/2896): fix(stage-web): cache WebAssembly files on first use instead of precaching them** — Sourced from upstream by **@starvingarc**.
* **PR [#2821](https://github.com/moeru-ai/airi/pull/2821): feat(stage-web,stage-pages): add remote MCP support and connection test bench** — Sourced from upstream by **@clansty**.
* **PR [#2916](https://github.com/moeru-ai/airi/pull/2916): fix: exclude nested reasoning from streamed speech in response-categoriser** — Sourced from upstream by **@starvingarc** & **@nekomeowww**.
* **PR [#2911](https://github.com/moeru-ai/airi/pull/2911): fix(core-agent): preserve whitespace literals in streamed speech** — Sourced from upstream by **@starvingarc**.
* **PR [#2905](https://github.com/moeru-ai/airi/pull/2905): fix: preserve 3D orbit gestures across native text drags in OrbitControls** — Sourced from upstream by **@Penluna**.
* **PR [#2904](https://github.com/moeru-ai/airi/pull/2904): fix(i18n): show the pipe in the Anthropic provider title** — Sourced from upstream by **@凌莞~(=^▽^=)**.
