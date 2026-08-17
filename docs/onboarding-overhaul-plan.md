# AIRI Onboarding Evolution: From V2 Baseline to Advanced Subsystems

---

## 1. Executive Summary & Shipped Baseline

The **V2 Onboarding Flow** is fully implemented and active as the single canonical first-run wizard across AIRI (Desktop, Web, and Pocket). It provides an end-to-end, zero-friction path that configures all necessary baseline subsystems in a 9-step sequence, atomically synthesizes the initial `AiriCard`, and immediately launches the live Stage, Chatbox, and Companion.

### Shipped V2 Step Sequence

```text
Step 0: Welcome Landing (Hardware/WebGPU Check)
   │
   ▼
Step 0.5: Path Triage (Cloudflare PKCE Zero-Trust Sync vs. 100% Offline Local-First)
   │
   ├─► [Cloudflare Sync Track] ──► Edge Services & Cloud Restore ──┐
   │                                                               │
   ▼                                                               │
Step 1: Hearing & Mic Playground (Whisper WebGPU / Browser STT / Cloud)
   │
   ▼
Step 2: Consciousness (WebLLM WebGPU Hero Cards / Cloud Grid)
   │
   ▼
Step 3: User Profile & Identity (Name, Bio, Narrative Prompt Tags)
   │
   ▼
Step 4: Soul & Persona (Seeded Starters, Anime Archetypes, Community Card Hub)
   │
   ▼
Step 5: Physical Vessel (3D VRM Avatars & 2D Live2D Bodies)
   │
   ▼
Step 6: Contextual Speech & Voice Studio (Kokoro WebGPU, Pocket-TTS, Moss-Nano, Cloud)
   │
   ▼
Step 7: Stage Calibration & Victory Launch (Live Audio Greeting & Instant Stage Spawn)
```

---

## 2. The Future Vision: The "I Just Wanna Play" Dilemma

While the 9-step V2 wizard successfully solves initial companion creation, AIRI features several deep, high-power subsystems that are currently left to manual settings discovery or technical documentation:

1. **Generative Motion & VRMA Text-to-Motion**: Real-time keyframe animation compilation, FlowMDM diffusion synthesis, and kinetic dance cues.
2. **Autonomous Artistry & ComfyUI Bridge**: Configuring local ComfyUI endpoints, Replicate/Nanobanana backends, node workflows, and desktop widget frames.
3. **Sensory Proactivity & Environmental Telemetry**: Calibrating OS sensory polling (active window monitoring, AFK idle thresholds, system load) and attention-ecology gating.
4. **`<|ACT:...|>` Token Calibration (Rehearsal Room)**: Fine-tuning streaming kinetic and emotional action markers to match the chosen model's prompt format and tokenizer.
5. **Memory Synthesis & Consciousness Matrix**: Configuring local vector indexing, Sacred Journal (LTMM), Lifetime consolidation (DRMM), Dreaming Worker, and Echo-Chips.

### The Problem: Onboarding Fatigue vs. Capability Discovery

Forcing new users through an endless, 15+ step setup gauntlet causes severe onboarding fatigue ("I just wanna play!"). Conversely, completely hiding these capabilities means users miss AIRI's most distinctive autonomous features.

---

## 3. The Future Architecture: The Advanced Setup Lab

To bridge this gap, the next evolution of AIRI onboarding introduces an **optional, non-blocking post-launch continuation**:

```text
┌─────────────────────────────────────────────────────────────┐
│                   Step 7: Calibration Finale                │
│       "Your companion is ready! Ready to enter Stage?"       │
└──────────────────────────────┬──────────────────────────────┘
                               │
               ┌───────────────┴───────────────┐
               ▼                               ▼
    [ 🚀 Enter AIRI Stage ]        [ 🛠️ Advanced Setup Lab ]
    "I just wanna play!"           "Let's tune everything!"
               │                               │
               ▼                               ▼
    ┌────────────────────┐          ┌─────────────────────────┐
    │  Active Companion  │ ◄─────── │ Floating Setup Sidecar  │
    │  Stage + Chatbox   │ (Live    │ - VRMA Kinetic Dance    │
    │  Open & Running    │  Echo)   │ - ComfyUI Artistry      │
    └────────────────────┘          │ - Sensory Proactivity   │
                                    │ - ACT Marker Rehearsal  │
                                    │ - Memory & Consciousness│
                                    └─────────────────────────┘
```

### Key Modalities for Advanced Setup

1. **Option A: Non-Blocking Floating Sidecar (Recommended)**:
   - Clicking `[ 🛠️ Advanced Setup Lab ]` launches the Stage and Chatbox immediately so the companion is already alive and visible on the desktop.
   - An auxiliary setup window remains open beside the stage, letting the user test motions, image generation, proactivity check-ins, and memory search **live** with their companion reacting in real time.
2. **Option B: Step Extension (Sequential)**:
   - For users who prefer a linear flow, defers the final launch and advances directly through the advanced modules before entering the stage.
3. **Re-openable at Any Time**:
   - Users who click `[ 🚀 Enter AIRI Stage ]` can launch the Advanced Setup Lab at any time from the Control Strip or Settings drawer without re-running first-run onboarding.

---

## 4. Advanced Setup Lab Subsystem Modules

```text
┌────────────────────────────────────────────────────────────────────────────┐
│                       🛠️ AIRI Advanced Setup Lab                           │
├────────────────────────────────────────────────────────────────────────────┤
│  [ 💃 Kinetic Motion ] [ 🎨 Artistry ] [ 👁️ Proactivity ] [ 🎭 Rehearsal ]  │
│  [ 🧠 Memory & Consciousness Matrix ]                                      │
└────────────────────────────────────────────────────────────────────────────┘
```

---

### Module 1: VRMA Kinetic Dance & Generative Motion Studio
*Connecting to:* [`docs/proposal-text-to-vrma-system.md`](docs/proposal-text-to-vrma-system.md) & [`@pixiv/three-vrm-animation`](.agents/skills/airi-generative-motion-vrma/SKILL.md)

* **Purpose**: Verifies that 3D avatar rigging, Mixamo bone retargeting, and browser-side `@pixiv/three-vrm-animation` GLB keyframe compilation work smoothly.
* **The Interactive UX Flow**:
  1. **Preset Motion Chips**: 1-click test chips (*"Victory Dance"*, *"Dramatic Bow"*, *"Fortnite Emote"*, *"Playful Twirl"*) or custom prompt text box.
  2. **Direct Motion Dispatch**: Clicking **`[ 🎬 Synthesize Motion ]`** skips conversational LLM latency and sends the request directly to the generative motion worker / FlowMDM bridge.
  3. **Live Real-Time Execution**: The compiled GLB animation streams directly to the active 3D VRM vessel on Stage.
  4. **The Showtime Fanfare**: The companion performs the dance on the desktop stage in real time, accompanied by a confetti burst and a *"Kinetic Motion Verified! 🎉"* achievement banner in the lab.

---

### Module 2: ComfyUI & Artistry Studio Wizard (Ending the 3-Page Friction)
*Connecting to:* [`packages/stage-ui/src/stores/modules/artistry.ts`](packages/stage-ui/src/stores/modules/artistry.ts) & [`apps/stage-tamagotchi/src/main/services/airi/widgets/artistry-bridge.ts`](apps/stage-tamagotchi/src/main/services/airi/widgets/artistry-bridge.ts)

* **Purpose**: Condenses the scattered configuration (provider credentials, node workflow JSONs, widget display modes) into a compact 3-click wizard.
* **The Interactive UX Flow**:
  1. **Provider Selector**: Radio toggle: **ComfyUI Local** (with automated `http://127.0.0.1:8188` connection ping) vs. **Replicate Cloud** vs. **Nanobanana**.
  2. **Workflow Templates**: Dropdown of verified pre-bundled workflows (*SDXL Anime Character*, *Flux Schnell Fast*, *SD1.5 Portrait*), plus an optional custom workflow JSON dropzone.
  3. **The First Snapshot**: Pre-filled test prompt (*"Polaroid selfie with Manager backstage"*) with a **`[ 📸 Snap Test Photo ]`** button.
  4. **Instant Verification**: The generated image renders in the lab preview AND immediately pops open the desktop floating widget on the Stage!

---

### Module 3: Sensory Proactivity Playground (Live Telemetry & Isolated Simulation)
*Connecting to:* [`packages/stage-ui/src/stores/proactivity.ts`](packages/stage-ui/src/stores/proactivity.ts) & [`docs/content/en/docs/advanced/architecture/design-proactivity-heartbeats-engine.md`](docs/content/en/docs/advanced/architecture/design-proactivity-heartbeats-engine.md)

* **Purpose**: Demonstrates OS environmental telemetry, idle AFK detection, and NO_REPLY decision gating without waiting hours for a natural heartbeat.
* **The Interactive UX Flow**:
  1. **Live Sensor HUD**: Displays real-time Electron OS telemetry:
     - `Active Window`: `Visual Studio Code — airi-rebase-scratch`
     - `User State`: `Idle for 14 minutes (AFK)`
     - `System Load`: `RAM 38% · CPU 12%`
     - `Time of Day`: `2:30 AM (Late Night Session)`
  2. **Scenario Simulator**: Allows toggling between **Live OS State** and **Simulated Presets** (*"Deep Coding Grind"*, *"Gaming Session: Elden Ring"*, *"AFK for 45 mins"*).
  3. **Isolated Simulation Turn**: Clicking **`[ 🧠 Simulate Proactive Check-in ]`** fires an isolated turn with the companion's system prompt + telemetry payload.
  4. **Live Response Output**: The user sees the companion's internal thought process and proactive spoken check-in:
     > *"You've been staring at that shader for 45 minutes, Manager. Don't forget to blink and drink some water!"*
  5. **Quick-Tuning Sliders**: User adjusts the **Idle Interval** (5m, 15m, 30m) and **NO_REPLY Sensitivity** with immediate visual feedback.

---

### Module 4: ACT Marker Calibration (The "Rehearsal Room" Pattern)
*Connecting to:* [`apps/stage-tamagotchi/src/renderer/components/chat/chat_rehearsal.vue`](apps/stage-tamagotchi/src/renderer/components/chat/chat_rehearsal.vue) & [`docs/proposal-acting-sidebar.md`](docs/proposal-acting-sidebar.md)

* **Purpose**: Validates that the chosen LLM and avatar rig properly handle streaming action tokens without leaking raw syntax into speech.
* **The Interactive UX Flow**:
  1. **Rehearsal Script Box**: Interactive token-tagger UX adapted from `chat_rehearsal.vue`.
  2. **Click-to-Insert Action Tokens**: Quick-insert chips for `<|ACT:motion="wave" expression="joy"|>`, `<|ACT:expression="blush" gesture="shy"|>`, `<|ACT:motion="nod"|>`.
  3. **`[ 🎭 Rehearse Action ]` Playback**: Streams the tagged script through the LLM marker categorizer and speech runtime pipeline.
  4. **Live Avatar Blendshapes**: 3D VRM blendshapes or Live2D parameter morphs trigger in real time on stage, validating that the chosen model and avatar rig interpret kinetic markers seamlessly.

---

### Module 5: Memory & Consciousness Matrix (Solving the Zero-History Cold Start)
*Connecting to:* [`packages/stage-ui/src/stores/echo-chips.ts`](packages/stage-ui/src/stores/echo-chips.ts), [`packages/stage-ui/src/stores/memory-text-journal.ts`](packages/stage-ui/src/stores/memory-text-journal.ts), [`packages/stage-ui/src/stores/memory-lifetime.ts`](packages/stage-ui/src/stores/memory-lifetime.ts), [`packages/stage-ui/src/libs/search/layered-memory.ts`](packages/stage-ui/src/libs/search/layered-memory.ts)

* **The Problem**: Memory systems (Short-Term, Sacred Journal LTMM, Lifetime Synthesis, Dreaming DRMM) feel abstract or "dead" on a brand-new companion with 0 conversation history.
* **The Solution — The "Prologue Seed"**: Uses the chosen character's backstory and first meeting with the user to generate a synthetic **Prologue Memory Chronicle**, providing immediate real data to index, search, and dream about.

```text
┌────────────────────────────────────────────────────────────────────────────┐
│                    🧠 Memory & Consciousness Deck                          │
│   "Configure how your companion remembers, reflects, and dreams."          │
└────────────────────────────────────────────────────────────────────────────┘
                                      │
       ┌──────────────────────────────┼──────────────────────────────┐
       ▼                              ▼                              ▼
 🏷️ Echo-Chips Hub             📖 Sacred Journal (LTMM)      🌙 Dreaming & Lifetime
 - Live Floating Chips         - 5W Fact Extraction          - Idle Sleep Worker
 - Vibe/Contextual Tags        - Orama Local Vector Search   - Lifetime Synthesis
 - [ ✨ Spawn Test Chip ]      - [ 🔍 Live Search Probe ]     - [ 🌙 Simulate 1 Dream ]
```

#### A. 🏷️ Echo-Chips Studio (Sensory Working Memory)
- **Configuration**: Master toggle (Show/Hide HUD), Floating Position (Above WhisperDock vs. Floating on Desktop Stage), Max Active Chips count (3, 5, 8).
- **Interactive Demo**: Spawns 2 live interactive chips from the prologue:
  - `🏷️ [Origin: Met Manager in Neo-Tokyo]`
  - `💡 [Preference: Prefers green tea]`
- Clicking a chip shows the prompt injection preview and pulses the desktop Stage window.

#### B. 📖 Sacred Journal & Long-Term Memory (LTMM)
- **Configuration**: Auto-journal trigger (Automatic vs Manual/Director only), Vector Embedding Provider (Local WASM Embeddings vs Remote Cloud), Journal Detail Level (Concise bullets vs Narrative prose).
- **Interactive Demo (Search Probe)**: Displays the prologue journal entry with 5W extraction (`Who`, `What`, `When`, `Where`, `Why`) and an Emotional Delta (`Trust: +15%`, `Curiosity: High`). Includes a **Live Search Probe Box**: typing *"tea"* or *"meeting"* runs local Orama hybrid vector search live and highlights the match with its similarity score (`0.94 Match`).

#### C. 🌙 The Dreaming Lab & Lifetime Memory (DRMM Consolidation)
- **Configuration**: Background dreaming schedule (Idle sleep trigger after 30 mins AFK), PCL contradiction resolution mode (automatically invalidate outdated facts when contradicted), Lifetime archiving threshold.
- **Interactive Demo (1-Night Dream Simulation)**: Clicking **`[ 🌙 Simulate 1 Night of Dreaming ]`** runs the consolidation worker on the prologue journal $\rightarrow$ synthesizes a permanent **Lifetime Insight**:
  > *"Core Insight: Manager is supportive; I feel safe expressing my true thoughts around them."*
  $\rightarrow$ shifts the companion's baseline mood dial from `Neutral` to `Warm & Connected`.

#### D. ⚙️ The "Dry Dump" Quick-Accordion (For Power Users)
- Collapsible tray providing instant access to all low-level store parameters in one clean grid:
  - Short-term rolling token window size.
  - Top-K vector candidate retrieval depth.
  - Memory decay half-life curves.
  - Raw JSON export / import for memory databases.

---

## 5. Technical Integration Seams

- **Orchestrator**: [`packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/onboarding-v2.vue`](packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/onboarding-v2.vue)
- **Calibration Step (Launch Fork)**: [`packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/steps/step-7-calibration.vue`](packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/steps/step-7-calibration.vue)
- **Draft Store**: [`packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/draft-store.ts`](packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/draft-store.ts)
- **Auxiliary Window / Sidecar Host**: `apps/stage-tamagotchi/src/main/windows/` (`customizer/`, `notice/`, `dashboard/`)
- **BroadcastChannel State Relays**: `airi:stage:motion-event`, `airi:widgets:command`, `airi:proactivity:telemetry`, `airi:memory:sync`


