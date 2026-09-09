# AIRI Onboarding V3: Architecture Specification & Progress Journal

---

## 1. Document Mission & Scope

This document serves as the **canonical technical architecture specification**, **design decision record**, and **live implementation progress journal** for the clean-slate **Onboarding V3** wizard.

### 1.1 Relationship to Prior Documentation
- **`docs/project-onboarding-modernize.md`**: Preserved as the reference specification for the legacy V2 overhaul concept and Cloudflare PKCE / WebGPU background analysis.
- **`docs/design-onboarding-v3.md` (This Document)**: The authoritative, living implementation ledger that tracks every architectural distinction, file boundary, component responsibility, and field breakdown of the canonical V3 implementation.

---

## 2. Core Architectural Distinctions (V2 Overhaul vs. Canonical V3)

| Architectural Pillar | Legacy V2 Overhaul Plan (`project-onboarding-modernize.md`) | Canonical V3 Architecture (This Specification) |
| :--- | :--- | :--- |
| **File & Step Naming** | Monolithic numbered steps (`0:welcome.vue`, `1:experience.vue`, `3:voice.vue`). Step numbers became meaningless and brittle when steps were reordered or conditionally omitted. | **Domain-driven semantic names** (`welcome.vue`, `experience.vue`, `thinking.vue`, `emotions.vue`, `artistry.vue`, `sensory.vue`, `memory.vue`, `tools.vue`). No leading numbers. |
| **Breadcrumb Stepper** | Monolithic list of 15 buttons stretching across the window header, causing horizontal overflow, truncated labels, and cognitive clutter. | **5-Item Sliding-Window Stepper**: Dynamic centered window showing `[current - 2]` to `[current + 2]` with subtle `···` overflow anchors. Constant width, zero layout shift. |
| **Step Navigation** | Rigid hardcoded numeric index (0..15). Disabling a module left awkward empty placeholders or required manual index skipping. | **Dynamic Step Pruning & Semantic IDs**: Steps are identified by semantic IDs (`currentStepId: OnboardingV3Step`). `activeSteps` is computed reactively from `draftStore.state.modules`. Inactive steps are completely excised from the stepper and navigation path. |
| **Physical Avatar Selection** | Segregated into installed models vs. a secondary modal dialog triggered by a "Find Free Bodies" top-right button. | **Unified Vessel Coverflow**: Local avatars (`✓ Installed`) and downloadable models (`🌐 Free Download`) presented side-by-side in a single 3D coverflow carousel with source and format filters. |
| **Cognition & Acting Division** | Combined "Acting & Calibration" into a single overloaded tab conflating conversational fillers, Live2D/VRM morph mapping, and motion delays. | **Cleanly Unbundled into Thinking vs. Emotions**: <br>• **Thinking**: Cognitive latency, 3 conversational pacing presets (*Snappy*, *Balanced*, *Deep CoT*), and 3-tier subconscious aside extraction (Needle 2 WASM).<br>• **Emotions**: The ACT Bridge. 2-pass AI Expression Curation (Pass 1: raw morph normalization to `<|ACT:*|>` tokens; Pass 2: prompt directives teaching character how to express them). |
| **Artistry & Visual Synthesis** | Buried deep within advanced card editor with complex routing mode dropdowns, JSON parameter blocks, and 12+ Director evaluation sliders. | **Streamlined Provider & Character Setup**: <br>• **Top Engines**: Pollinations AI (100% Free / Zero-Config with Quick Pick models) vs. ComfyUI (Local Node:8188) vs. None.<br>• **Visual Style Prompt Box**: Auto-injected with selected vessel's physical traits, preset style chips (+ Ghibli, + Cyberpunk, + Shinkai, + Cozy Cafe), and a bottom-right `[🎨 Preview]` button opening a fast, non-disruptive preview modal.<br>• **Autonomous Director**: Single clean toggle switch, hiding low-level evaluation knobs. |
| **Sensory & Proactivity** | Spread across disconnected tabs (Proactivity, Attention Ecology, Sleep Gate). | **Unified Sensory Step**: Screen Watching with 4 delivery modes (`Voice & Bubble`, `Bubble Only`, `Voice Only`, `Muted`), Zero-Cost Salience Gating (Lightweight OCR vs Moondream2 VLM), Ambient Heartbeats with `NO_REPLY` smart silence directive, Bedtime / Quiet Hours schedule, and full raw telemetry dump. |
| **Memory & Tool Placement** | Memory and external tools crammed into one massive vertical page or split across disconnected settings. | **Clean Separation into Dedicated Chapters**: <br>• **Step 14: Memory Hierarchy**: Focused purely on the 4 temporal quadrants (STMM, Sacred Journal LTMM, Lifetime Relational Thread, Dream State Echo Chips) with interactive tiers.<br>• **Step 15: Automation & Tools**: Focused purely on external tools (0-Key Web Search, Desktop Filesystem MCP, 3D Motion Generator). |
| **Stage Handoff** | Generic completion dialog with artificial 100% checkmarks. | **Stage Finale & Pre-Flight Honesty Matrix**: Real verification across 4 pillars (Audio Input, Reasoning Core, Voice Synthesis, Avatar Stage) + seamless Turn 0 greeting continuity into Stage. |

---

## 3. Master 17-Step Journey Topology

```
[ 0. Welcome ] ──▶ [ 1. Appearance ] ──▶ [ 2. Triage ] ──▶ [ 3. Experience Archetypes ]
                                                                        │
   ┌────────────────────────────────────────────────────────────────────┘
   ▼
[ 4. User Profile ] ──▶ [ 5. Physical Vessel ] ──▶ [ 6. Soul & Persona ]
                                                               │
   ┌──────────────────────────────────────────────────────────┘
   ▼
[ 7. Hearing (STT)* ] ──▶ [ 8. Consciousness (LLM) ] ──▶ [ 9. Speech (TTS)* ]
                                                                   │
   ┌───────────────────────────────────────────────────────────────┘
   ▼
[ 10. Thinking (Pacing)* ] ──▶ [ 11. Emotions (ACT Bridge)* ] ──▶ [ 12. Artistry (Visuals)* ]
                                                                             │
   ┌─────────────────────────────────────────────────────────────────────────┘
   ▼
[ 13. Sensory & Vision* ] ──▶ [ 14. Memory Hierarchy* ] ──▶ [ 15. Automation & Tools* ]
                                                                         │
   ┌─────────────────────────────────────────────────────────────────────┘
   ▼
[ 16. Stage Finale & Launch ]
```
*\* Denotes optional modular steps dynamically governed by the Experience Coordinator.*

---

## 4. Dynamic Step Pruning by Archetype

The wizard does not force users through irrelevant steps. Selecting an Archetype preset in Step 3 (or toggling individual switches in the "Advanced: Customize Modules" drawer) reactively computes `activeSteps`. The breadcrumb stepper and navigation dynamically shrink or expand in real time:

| Archetype Preset | Active Modules | Steps Traversed | User Journey Experience |
| :--- | :--- | :---: | :--- |
| **The Quiet Observer**<br>*(Text & Ambient Presence)* | `emotions`, `thinking`, `memory` | **12 Steps**<br>*(Skips STT, TTS, Artistry, Sensory, Tools)* | Fast, lightweight text companion. Avatar emotes on screen, has inner thoughts and deep memory, with zero audio, vision, or filesystem overhead. |
| **The Casual Companion**<br>*(Voice Dialogue & Soul)* | `hearing`, `speech`, `thinking`, `emotions`, `memory` | **14 Steps**<br>*(Skips Artistry, Sensory, Tools)* | The quintessential voice friend. Natural speech transcription (STT), emotional voice (TTS), natural pacing, and long-term memory. |
| **The Executive Copilot**<br>*(Voice + System Automation)* | `hearing`, `speech`, `thinking`, `sensory`, `memory`, `tools` | **15 Steps**<br>*(Skips Artistry)* | Focused productivity. Voice conversation, screen awareness, active window history, desktop filesystem MCP tools, and web search. |
| **The Dynamic Performer**<br>*(Full Autonomous Multimodal)* | **All 8 Modules Active** | **17 Steps**<br>*(Complete master journey)* | Full multimodal studio: autonomous visuals, ComfyUI/Pollinations, 3D motion generation, vision, and MCP tools. |

---

## 5. Detailed Per-Page Breakdown (All 17 Steps)

Below is the comprehensive field-by-field and control breakdown for every page in Onboarding V3.

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│                           ONBOARDING V3 STEP DIRECTORY                            │
├────┬────────────────────┬─────────────────────────┬───────────────────────────────┤
│ #  │ Step ID            │ Component Name          │ Primary Focus                 │
├────┼────────────────────┼─────────────────────────┼───────────────────────────────┤
│ 0  │ welcome            │ step-welcome.vue        │ Studio Introduction & Bubble  │
│ 1  │ appearance         │ step-appearance.vue     │ Language, Theme & 24 Colors   │
│ 2  │ triage             │ step-triage.vue         │ Local-First vs Cloudflare     │
│ 3  │ experience         │ step-experience.vue     │ Archetype & Step Pruning      │
│ 4  │ profile            │ step-profile.vue        │ User Persona & Callout Name   │
│ 5  │ vessel             │ step-vessel.vue         │ 3D Vessel Coverflow (Avatar)  │
│ 6  │ persona            │ step-persona.vue        │ Character Card & Soul         │
│ 7  │ hearing            │ step-hearing.vue        │ Mic, VAD & STT Engine         │
│ 8  │ consciousness      │ step-consciousness.vue  │ LLM Reasoning Brain           │
│ 9  │ speech             │ step-speech.vue         │ Neural TTS & Voice Timbre     │
│ 10 │ thinking           │ step-thinking.vue       │ Pacing & Subconscious Asides  │
│ 11 │ emotions           │ step-emotions.vue       │ 2-Pass ACT Expression Bridge  │
│ 12 │ artistry           │ step-artistry.vue       │ Pollinations/ComfyUI Visuals  │
│ 13 │ sensory            │ step-sensory.vue        │ Screen Watching & Telemetry   │
│ 14 │ memory             │ step-memory.vue         │ 4 Temporal Memory Quadrants   │
│ 15 │ tools              │ step-tools.vue          │ Web Search & Desktop MCP      │
│ 16 │ finale             │ step-finale.vue         │ Honesty Matrix & Stage Launch │
└────┴────────────────────┴─────────────────────────┴───────────────────────────────┘
```

---

### Step 0: Welcome (`step-welcome.vue`)
- **Radiant Orb Icon**: Floating gradient brand visual with subtle ambient pulse.
- **Companion Speech Bubble**: Warm welcome quote introducing AIRI as a private companion studio.
- **Three Pillar Highlights**:
  - `Private by Design`: Local storage, zero corporate data harvesting.
  - `Multimodal Presence`: Live2D/VRM avatars, neural voice, vision, and memory.
  - `Extensible Core`: MCP server support, custom character cards, and open engines.
- **Navigation Controls**: Primary `Start Setup →` button and secondary `Set Up Later (Skip)` dialog.

---

### Step 1: Appearance (`step-appearance.vue`)
- **Interface Language Selector**: Dropdown supporting 8 localized languages (English, Japanese, Simplified Chinese, Traditional Chinese, Spanish, French, German, Korean) via `packages/i18n`.
- **Theme Mode Selector**: 3-option card group (`Dark`, `Light`, `System Synchronized`).
- **24-Color Accent Palette**: Full spectral swatch grid providing exact parity with the desktop Settings header bar accent picker. Dynamically updates the active primary color variable in real time.

---

### Step 2: Triage (`step-triage.vue`)
- **Architecture Choice Cards**:
  - **Local-First Private Studio**: 100% offline-ready, all data stored in local IndexedDB (`local:*`), direct WebGPU or local server connectivity.
  - **Cloudflare Edge Relay**: End-to-end synchronized companion via Cloudflare Workers Edge KV.
- **Cloudflare Auth Seams**:
  - 1-Click OAuth PKCE sign-in flow.
  - Manual Cloudflare API Token & Account ID input seam.
  - Edge Vault character & settings restoration on sign-in.

---

### Step 3: Experience Archetypes (`step-experience.vue`)
- **4 Curated Archetype Cards**:
  - `The Quiet Observer` (3 modules active: thinking, emotions, memory -> 12 steps).
  - `The Casual Companion` (5 modules active: hearing, speech, thinking, emotions, memory -> 14 steps).
  - `The Executive Copilot` (6 modules active: hearing, speech, thinking, sensory, memory, tools -> 15 steps).
  - `The Dynamic Performer` (8 modules active: all modules active -> 17 steps).
- **Dynamic Capability Count Pill**: Live calculation of active capabilities per preset.
- **Collapsible "Advanced: Customize Modules" Drawer**:
  - 8 standalone toggle cards (`Transcription`, `Neural Voice`, `Thinking & Pacing`, `Emotional Expressions`, `Autonomous Artistry`, `Screen Perception`, `Memory Hierarchy`, `Automation & MCP Tools`).
  - Flipping any toggle immediately updates the draft store and dynamically adds/removes steps from the active journey.
- **Reset to Preset Button**: Re-aligns all 8 toggles with the selected archetype defaults.

---

### Step 4: User Profile (`step-profile.vue`)
- **User Display Name**: The name the companion uses to address the user.
- **User Callout / Honorific**: Dropdown or custom input (e.g. Master, Sensei, Friend, Producer, or none).
- **4 User Narrative Archetypes**: Quick-fill backstories (Richie, Dave, Maya, Elena).
- **Narrative Backstory Textarea**: Contextual biography injected into prompt context so the companion understands who you are.
- **Visual Prompt Tags**: Physical descriptors used when generating images featuring the user.

---

### Step 5: Physical Vessel (`step-vessel.vue`)
- **3D Vessel Coverflow (`vessel-coverflow.vue`)**:
  - 3D perspective carousel rendering avatar bodies.
  - Unified catalog merging local avatars (`✓ Installed`) and downloadable community avatars (`🌐 Free Download`).
  - Format filters: `All`, `VRM (3D)`, `Live2D (2D)`, `Spine`, `MMD`.
  - Source filters: `All`, `Installed`, `Free Download`.
- **Custom Model Import Seam**: Drag-and-drop file upload accepting `.vrm`, `.model3.json`, or model archives.
- **Visual Trait Auto-Injection**: Selected vessel's physical traits automatically pre-fill the Artistry visual style prompt box in Step 12.

---

### Step 6: Soul & Persona (`step-persona.vue`)
- **Persona Selection Grid (`persona-card-grid.vue`)**:
  - 2-column card grid showing pre-installed and community starter cards.
  - Official default Airi persona.
  - Starter archetypes (Tsundere, Kuudere, Dandere, Genki, Executive Assistant).
- **Card Metadata Preview**: Displays avatar icon, character name, nickname, creator, and first greeting speech bubble.
- **Custom Card Import Seam**: 1-click import of Tavern PNG cards (tEXt chunk), CCv2/CCv3 JSON, or AiriCard archives.

---

### Step 7: Hearing & Microphone (`step-hearing.vue` - Optional)
- **Input Microphone Selector**: Device dropdown enumeration via Web Audio API.
- **Live VAD Audio Meter**: Real-time canvas volume visualizer testing mic sensitivity and background noise floor.
- **STT Engine Selection**:
  - `Browser Web Speech API`: Zero download, instant activation, native OS speech engine.
  - `Whisper WebGPU`: Local neural transcription (`onnx-community/whisper-tiny` or `whisper-base`) running in WebAssembly/WebGPU.
  - `External Cloud STT`: Groq Whisper or OpenAI Whisper API integration.
- **Activation Mode**: Push-to-Talk (with hotkey assignment: `Caps`, `Space`, `Fn`) vs Voice Activity Detection (VAD) threshold slider.

---

### Step 8: Consciousness Core (`step-consciousness.vue` - Core)
- **Consciousness Engine Architecture**:
  - **Local WebGPU / Neural Engine**:
    - WebLLM (Llama 3.2 1B / 3B, Qwen 2.5 1.5B / 7B, SmolLM2).
    - Apple CoreML / Metal acceleration for macOS Apple Silicon.
    - One-click model bundle downloader with download progress and compiling status.
  - **Cloud LLM Providers**:
    - OpenAI, Anthropic Claude, Google Gemini (with Live API audio support), DeepSeek, Groq, OpenRouter, and Ollama local server.
- **API Key & Endpoint Inputs**: Secure password fields and custom base URL inputs.
- **Model Selector & Ping Connection Test**: Live test query verifying latency and token throughput.

---

### Step 9: Neural Speech (`step-speech.vue` - Optional)
- **TTS Engine Architecture**:
  - `Kokoro WebGPU`: 82M parameter lightweight neural TTS running 100% locally with zero latency.
  - `Edge TTS`: Microsoft natural cloud speech voices (zero cost, zero setup).
  - `Pocket-TTS / Piper`: Fast offline local speech.
  - `ElevenLabs / OpenAI Voice`: High-fidelity cloud voice generation.
- **Voice Timbre Selector**: Grid of male/female character voice profiles with nationality and tone tags.
- **Audition Speech Playback**: Interactive `[🔊 Test Voice]` button rendering sample greeting speech.

---

### Step 10: Thinking & Pacing (`step-thinking.vue` - Optional)
- **3 Conversational Pacing Presets**:
  - `Snappy (Zero Delay)`: Immediate speech response for rapid back-and-forth banter.
  - `Balanced (Human Natural)`: Realistic cognitive latency (~1.5s) with subtle thinking fillers ("Hmm...", "Let's see...").
  - `Deep CoT (Reasoning Monologue)`: Extended chain-of-thought exploration with subconscious asides.
- **Subconscious Thinking Asides (Needle 2 WASM)**:
  - Toggle switch enabling extraction of `<think>` tags into spoken fillers before final speech synthesis.
  - Eliminates dead air while complex reasoning models execute multi-hop logic.

---

### Step 11: Emotional Expressions (`step-emotions.vue` - Optional)
- **The 2-Pass ACT Expression Curation Bridge**:
  - **Pass 1 (Morph Normalization)**: Translates raw model blendshapes into canonical `<|ACT:*|>` emotion tokens (`[ACT:smile]`, `[ACT:blush]`, `[ACT:pout]`, `[ACT:shocked]`, `[ACT:wink]`).
  - **Pass 2 (Prompt Directives)**: Teaches the LLM character when to weave emotion tokens into narrative prose.
- **Interactive Expression Audition Pad**: Clickable emotion pills triggering live blendshape morphs on the 3D/2D avatar vessel.

---

### Step 12: Visual Artistry (`step-artistry.vue` - Optional)
- **Image Generation Backend**:
  - `Pollinations AI`: 100% free, zero configuration, zero API key requirement. Models: Flux, Turbo, Anime.
  - `ComfyUI`: Local image generation node at `http://127.0.0.1:8188` using custom workflow JSON.
  - `None`: Disables visual synthesis.
- **Visual Style Prompt Box**:
  - Auto-injected with physical descriptors from the selected vessel (hair color, eye shape, outfit).
  - Preset style chips: `+ Ghibli`, `+ Cyberpunk`, `+ Makoto Shinkai`, `+ Cozy Cafe`, `+ Retro 90s Anime`.
  - Non-disruptive modal preview button (`[🎨 Preview]`) rendering rapid offline SVG or API mockups.
- **Autonomous Director**:
  - Single master toggle enabling autonomous 2nd-LLM background painting and selfie synthesis during narrative climaxes.

---

### Step 13: Sensory Perception & Proactivity (`step-sensory.vue` - Optional)
- **Visual Push (Screen Watching)**:
  - Master toggle with live `ACTIVE` / `DORMANT` status badge.
  - 4 Reaction Delivery Modes: `Voice & Bubble`, `Bubble Only`, `Voice Only`, `Muted`.
  - Vision Engine Workload: Lightweight OCR & pHash diff (0 MB VRAM) vs Moondream2 WebGPU VLM (~700 MB).
  - Capture Interval slider (500ms to 10s).
- **Ambient Pull (Proactive Heartbeats)**:
  - Master toggle with cadence presets (`2 min`, `5 min (Recommended)`, `10 min`, `20 min`).
  - **Operating & Sleep Schedule (Quiet Hours)**: Wake-up clock (`09:00 AM`) and Bedtime clock (`10:00 PM`).
  - **Dual Sleep Guarantee**: Frame capture is frozen for 100% display privacy, and heartbeat timers are halted.
  - **User Presence Gating**: Automatic pause after 5 minutes of keyboard/mouse inactivity.
  - **Context-Aware Smart Silence Directive (`NO YAP GUARANTEE`)**: Hardened `NO_REPLY` anti-yapping instruction baked into prompts.
- **Situational Grounding & Full Telemetry Dump**:
  - Manual Chatbox Grounding toggle.
  - Active OS Sensor Probes: `Window History`, `CPU & System Load`, `Usage Metrics`.
  - Unified Event Ledger Stream: configurable sample depth (default 6) and domain chips (`[VISION]`, `[TOOLS]`, `[CHAT]`, `[MEMORY]`, `[DISCORD]`).
  - **Live Raw Telemetry Dump (`<pre class="text-green-400 font-mono">`)**: Full monospace display of live active application, window title, idle seconds, CPU/GPU load, and volume level.

---

### Step 14: Memory Hierarchy (`step-memory.vue` - Optional)
- **The Four Temporal Memory Quadrants**:
  1. **Short-Term Memory (STMM) — *The Active Pulse***:
     - Master toggle: 24h nightly summarization into daily chunks injected into prompt context.
     - 3 Preset Tiers:
       - `Compact`: 1-Day Window · 500 tok/day (minimal prompt footprint).
       - `Balanced`: 3-Day Window · 1,000 tok/day (Default; golden ratio of speed & continuity).
       - `Deep History`: 7-Day Window · 2,000 tok/day (full week of deep episodic awareness).
  2. **Sacred Long-Term Text Journal (LTMM) — *Episodic Records***:
     - Master toggle: grants `text_journal` tool call.
     - The Sacred Record Rule: append-only, immortal autobiographical event preservation.
  3. **The Eternal Thread — *Lifetime Relational Essence***:
     - Master toggle: distills relationship milestones and day-to-day bond evolution across resets.
     - 3 Distillation Tiers:
       - `Lightweight Essence`: ~500 tokens (core milestones only).
       - `Relational Thread`: ~1,000 tokens (Default; balanced relational evolution).
       - `Deep Foundation`: ~2,500 tokens (rich narrative foundation).
  4. **Day Dreaming & Echo Chips — *The Echoes***:
     - Master toggle: idle-gated background consolidation into keyword-based Echo Chips and mood highlights.
- **Active Cognitive Memory Footprint**: Monospace badges summarizing allocated token budgets and active quadrants.

---

### Step 15: Automation & Tools (`step-tools.vue` - Optional)
- **External Action Capability Packs**:
  1. **Web & Research Pack**:
     - Master toggle: `0-Key Real-Time Web Search` via `open-websearch`.
     - Badges: `web_search`, `fetch_content (Markdown)`, `Zero Setup Needed` (DuckDuckGo, Bing, Brave, Baidu).
  2. **Local Workspace & Filesystem Pack**:
     - Master toggle: `Desktop Filesystem MCP` via `@modelcontextprotocol/server-filesystem`.
     - Badges: `read_file`, `list_directory`, `directory_tree`, `search_files`.
     - Scoped to safe user directory boundaries (e.g. `~/Projects`).
  3. **3D Kinetic Motion Generator Pack**:
     - Master toggle: `3D Kinetic Motion Generator` (`generate_motion`).
     - Badges: `FlowMDM WebGPU`, `Procedural VRMA`.
     - Autonomously authors and compiles custom 3D animations in real time for VRM models.
  4. **Visual Artistry Status Card**:
     - Reflects status of `image_journal` tool linked to Step 12 Artistry.
- **Active Desktop Toolbelt Summary**: Real-time badge overview of granted tool permissions.

---

### Step 16: Stage Finale & Launch (`step-finale.vue` - Core)
- **Pre-Flight Readiness Honesty Matrix (4 Pillars)**:
  - `🎙️ Audio Input`: Microphone detection and Web Audio VAD status.
  - `🧠 Reasoning Core`: LLM connectivity and WebGPU / API handshake verification.
  - `🔊 Voice Synthesis`: TTS model compilation and audio pipeline readiness.
  - `🎭 Avatar Stage`: 3D/2D vessel model loading and animation driver binding.
- **Turn 0 Greeting Continuity**:
  - Live character speech bubble displaying the companion's first greeting.
- **Launch to Stage CTA**:
  - Compiles transient draft store into target `AiriCard` and `AiriExtension`.
  - Atomically saves to IndexedDB (`local:*`).
  - Closes setup and smoothly transitions live companion runtime into Stage.

---

## 6. File & Component Responsibility Topology

```
packages/stage-ui/src/components/scenarios/dialogs/onboarding/v3/
├── onboarding-v3.vue                  # Host dialog, window chrome, dynamic sliding stepper router
├── components/
│   ├── sliding-stepper.vue            # 5-item sliding-window breadcrumb stepper with overflow anchors
│   ├── vessel-coverflow.vue           # 3D Coverflow carousel for avatar bodies
│   ├── persona-card-grid.vue          # 2-column character card selector
│   └── art-preview-modal.vue          # Non-disruptive visual style preview modal
├── steps/
│   ├── step-welcome.vue               # Step 0: Welcome, companion bubble, setup later modal
│   ├── step-appearance.vue            # Step 1: Language (8 locales), theme mode, 24-color accent
│   ├── step-triage.vue                # Step 2: Local-first vs Cloudflare sync
│   ├── step-experience.vue            # Step 3: 4 Archetypes & dynamic module pruning coordinator
│   ├── step-profile.vue               # Step 4: User name, honorific, narrative backstory
│   ├── step-vessel.vue                # Step 5: Physical Vessel selection & 3D coverflow
│   ├── step-persona.vue               # Step 6: Character card & soul selection
│   ├── step-hearing.vue               # Step 7: Mic selection, VAD, and STT engine
│   ├── step-consciousness.vue         # Step 8: WebGPU / Cloud LLM reasoning core
│   ├── step-speech.vue                # Step 9: Neural TTS provider & voice timbre
│   ├── step-thinking.vue              # Step 10: Pacing presets & subconscious thinking asides
│   ├── step-emotions.vue              # Step 11: 2-Pass ACT expression curation bridge
│   ├── step-artistry.vue              # Step 12: Pollinations/ComfyUI, visual prompt & director
│   ├── step-sensory.vue               # Step 13: Screen watching, quiet hours & full telemetry dump
│   ├── step-memory.vue                # Step 14: 4 Temporal Memory Quadrants (STMM, LTMM, Lifetime, Dreams)
│   ├── step-tools.vue                 # Step 15: Web search, Desktop MCP filesystem & 3D motions
│   └── step-finale.vue                # Step 16: 4-pillar readiness honesty matrix & stage launch
├── stores/
│   └── useOnboardingV3Draft.ts        # Transient Pinia draft store (zero dirty writes to DB)
└── types.ts                           # Canonical 17-step TypeScript definitions & module mappings
```

---

## 7. Implementation Progress Journal

### Phase 1: UX Alignment & Interactive Prototype
- [x] Align on clean-slate V3 architecture (semantic filenames, 5-item sliding stepper).
- [x] Design Unified Vessel Coverflow merging installed and community models with status badges.
- [x] Unbundle Thinking (pacing presets, subconscious asides) vs Emotions (2-pass ACT bridge).
- [x] Streamline Artistry: Pollinations vs ComfyUI vs None, visual style prompt, non-disruptive preview modal.
- [x] Consolidate Sensory: Screen watching delivery modes, salience gating, ambient heartbeats, bedtime quiet hours, and full raw telemetry dump.
- [x] Split Memory & Tools: Dedicated Memory Hierarchy step (STMM, LTMM, Lifetime, Dreams) alongside dedicated Automation & Tools step (Web search, Filesystem MCP, Motions).
- [x] Implement Dynamic Step Pruning: Experience coordinator pruned paths (12 to 17 steps).

### Phase 2: Core Contracts, Types & Stepper Host Shell
- [x] Implement `types.ts` with 17-step master topology and `moduleKey` bindings.
- [x] Implement `useOnboardingV3Draft.ts` (transient Pinia draft store with memory tiers and tool fields).
- [x] Implement `sliding-stepper.vue` (5-item dynamic sliding window with `···` anchors, light/dark theme adaptive, dynamic primary color).
- [x] Implement `onboarding-v3.vue` (dynamic `activeSteps` pruning, semantic step ID navigation, traffic light clearance `pl-22`).
- [x] Wire electron system tray entry (`Companion Setup & Sign-In (V3)`) and renderer route `/onboarding-v3`.

### Phase 3: Setup & Identity Steps
- [x] Implement `step-welcome.vue` (radiant icon orb, companion speech bubble, feature pills, setup later modal).
- [x] Implement `step-appearance.vue` (interface language selector with 8 locales, dark/light theme toggle, 24-color spectrum accent palette).
- [x] Implement `step-triage.vue` (Local-first vs Cloudflare sync, 1-click OAuth PKCE, API token auth, and Edge Vault restoration).
- [x] Implement `step-experience.vue` (4 Hero Archetype cards, custom module drawer with 8 switches, dynamic capability counts).
- [x] Implement `step-profile.vue` (User Display Name, Honorific, Narrative Description, Visual Prompt Tags).
- [x] Implement `step-vessel.vue` & `vessel-coverflow.vue` (3D Coverflow carousel, mixed installed & free downloadable community models, visual style auto-injection).
- [ ] Implement `step-persona.vue` & `persona-card-grid.vue`.

### Phase 4: Voice & Cognitive Steps
- [ ] Implement `step-hearing.vue` (Mic test, Whisper WebGPU / Web Speech).
- [ ] Implement `step-consciousness.vue` (WebLLM / OpenAI-compatible / Cloud).
- [ ] Implement `step-thinking.vue` (Pacing presets, Needle 2 subconscious asides).
- [ ] Implement `step-speech.vue` (Kokoro WebGPU / Edge TTS / Pocket-TTS).
- [ ] Implement `step-emotions.vue` (2-pass ACT expression curation bridge).

### Phase 5: Autonomous World & Memory Steps
- [x] Implement `step-artistry.vue` & `ArtPreviewModal.vue` (Visual style prompt, preview modal, Director toggle).
- [x] Implement `step-sensory.vue` (Screen watching, reaction delivery mode, salience gating, quiet hours, full telemetry dump).
- [x] Implement `step-memory.vue` (4 Temporal Memory Quadrants: STMM tiers, Sacred Journal LTMM, Lifetime tiers, Dreams).
- [x] Implement `step-tools.vue` (Web search 0-key, Desktop Filesystem MCP, 3D motion generator).

### Phase 6: Stage Finale & Atomic Synthesis
- [ ] Implement `step-finale.vue` (4-pillar honesty readiness verification matrix).
- [ ] Implement atomic card synthesis (compile draft store into target `AiriCard` and `AiriExtension`).
- [ ] Implement Turn 0 continuity transition into live stage runtime.
