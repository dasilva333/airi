# AIRI Modernized Onboarding Specification (Zero-Friction & Local-First + Cloudflare Edge Relay)

---

## 1. Overview & Rationale

The original AIRI setup experience relied on a choice between an "Easy Mode" (which required registering on external cloud platforms and pasting API keys) and an "Advanced Mode" provider picker, alongside a deprecated Google Drive AppData sync for returning users.

Since that initial design was drafted, **AIRI's local and edge ecosystems have matured dramatically**:
- **Built-in Local Consciousness (LLMs)**: High-performance in-browser WebGPU inference via **WebLLM** (Qwen 3.5 0.8B/4B, Gemma 3 1B, Ministral 3B, Phi-4-mini) and **Web-RWKV**.
- **Built-in Local Speech (TTS)**: Out-of-the-box local synthesis engines (**Kokoro-WebGPU**, **Pocket-TTS**, and **Moss-Nano**), delivering instant neural voice output without external credentials or API keys.
- **Built-in Local Hearing (STT)**: In-browser speech recognition via **Whisper-WebGPU** (featuring `whisper-large-v3-turbo` and `whisper-small`) enabling fully offline, zero-telemetry listening, alongside the zero-download browser-native **Web Speech API** as a fallback.
- **Zero-Custody Cloud Relay & Cloud Sync (Cloudflare OAuth PKCE + R2/KV)**: Replaces legacy Google AppData sync with user-owned Cloudflare infrastructure ("Vercel for Characters"). Users authenticate directly with Cloudflare to automatically provision their personal edge CORS proxy, 24/7 Discord interaction worker, and S3-compatible R2 storage bucket for private zero-trust backups without any proprietary AIRI backend servers.
- **Mobile Native CORS Bypass (`@capacitor/http`)**: On Pocket Stage (iOS/Android), network requests leverage native `URLSession` / Java HTTP to bypass browser WebKit CORS restrictions out-of-the-box for local network models (e.g. LAN Ollama) and unproxied cloud APIs.

This modernized onboarding architecture unifies AIRI into a **Zero-Friction, Local-First, Zero-Custody Experience**. Users can either connect their Cloudflare account to sync existing assets and provision edge relays, or launch an entirely local AI companion within seconds without leaving the browser, creating an account, or typing an API key.

---

## 2. Core Design Principles

1. **Emotional Payoff First**: Companion identity and form (Soul & Persona on Step 2, Physical Vessel on Step 3) are introduced *before* technical hardware calibration (Hearing and Consciousness). Users fall in love with their companion first instead of testing a microphone for an abstract empty shell.
2. **Intent-Driven Dynamic Journey**: Users select from **4 Hero Archetype Cards** (`Chat Only`, `Talk & Listen`, `Sentinel Companion`, `Artistic Companion`) or configure the **Customizer Deck** upfront. The wizard dynamically renders only the steps required for their chosen experience (e.g. 3 screens for pure text chat vs. 7 screens for full multimodal).
3. **Decoupled Soul & Form**: Personality/Lore (Step 2) and Physical Avatar Body (Step 3) are completely decoupled, granting total mix-and-match freedom.
4. **Hardware Capability Transparency**: Every local model card clearly displays VRAM requirements, model size, and supported languages so users make informed choices based on their hardware.
5. **Early Hardware & WebGPU Detection**: Detects `isWebGPUSupported()` globally on startup to guide the user toward WebGPU vs. WASM/Browser-native options.
6. **Two-Phase Internationalization**: Phase 1 mounts an immediate language selector on the Step 0 Welcome screen; Phase 2 provides full deep localization across all step components via `@proj-airi/i18n` YAML strings.
7. **Zero-Custody Cloud Relay**: Cloud accounts authenticate via Cloudflare OAuth 2.0 PKCE. All storage (R2/S3) and compute (Workers/KV) run inside the user's personal Cloudflare account. AIRI never holds custody of user API keys or master credentials.
8. **Transient Composition State & Deferred Card Assembly**: Choices are collected in a clean, transient draft store (`useOnboardingV2Draft`). IndexedDB character cards are never dirty-mutated during the wizard. On the Calibration Finale, the assembled choices are atomically compiled into the target `AiriCard` and `AiriExtension` payload.
9. **Readiness Honesty**: Replaces artificial 100% checkmarks with truthful status states (`Verified Active`, `Configured (Untested)`, `Muted / Skipped`, `Silent Mode`) and tests a real first spoken completion before launch.

---

## 3. The Modernized Sequence & Dual-Track Flow

```text
                     ┌──────────────────────────────────────────────┐
                     │           Step 0: Welcome Landing            │
                     │    + Phase 1 Language Selector Dropdown      │
                     └──────────────────────┬───────────────────────┘
                                            │
                                            ▼
                     ┌──────────────────────────────────────────────┐
                     │          Step 0.5: Path Triage               │
                     │  "Choose How You Want to Experience AIRI"    │
                     └──────────────┬───────────────────────────────┘
                                    │
               ┌────────────────────┴────────────────────┐
               ▼                                         ▼
   [ Sign In with Cloudflare ]                  [ Continue Offline / Later ]
   (Cloud-Connected & Multi-Device Sync)        (New Users & 100% Local-First)
               │                                         │
               ▼                                         ▼
   ┌───────────────────────┐                 ┌────────────────────────────────┐
   │ Cloudflare OAuth PKCE │                 │ Step 1: Choose Your Experience │
   │  - Auth with CF       │                 │ (4 Hero Cards + Customizer)    │
   │  - Provision Worker   │                 └──────────────┬─────────────────┘
   │  - Connect S3/R2      │                                │
   │  - Sync/Restore State │                                ▼
   └───────────┬───────────┘                 ┌────────────────────────────────┐
               │                             │ Step 2: Soul & Persona (Soul)  │
               ▼                             │ (Starter Cards / Tropes / Img) │
   ┌───────────────────────┐                 └──────────────┬─────────────────┘
   │  "Everything Synced!" │                                │
   │  [ Enter Stage ]  OR  │                                ▼
   │  [ + New Companion ]  │ ────────┐       ┌────────────────────────────────┐
   └───────────┬───────────┘         │       │ Step 3: Physical Vessel (Body) │
               │                     │       │ (DiscoverCarousel 3D Coverflow)│
               │                     │       └──────────────┬─────────────────┘
               │                     │                      │
               │                     │                      ▼
               │                     │       ┌────────────────────────────────┐
               │                     │       │ Step 4: User Profile & Identity│
               │                     │       └──────────────┬─────────────────┘
               │                     │                      │
               │                     │                      ▼
               │                     │       ┌────────────────────────────────┐
               │                     │       │ Step 5: Hearing & Mic (STT)*   │
               │                     │       │ (*Conditional if Voice Enabled)│
               │                     │       └──────────────┬─────────────────┘
               │                     │                      │
               │                     │                      ▼
               │                     │       ┌────────────────────────────────┐
               │                     │       │ Step 6: Consciousness (LLM)    │
               │                     │       └──────────────┬─────────────────┘
               │                     │                      │
               │                     │                      ▼
               │                     │       ┌────────────────────────────────┐
               │                     │       │ Step 7: Voice Studio (TTS)*    │
               │                     │       │ (*Conditional if Voice Enabled)│
               │                     │       └──────────────┬─────────────────┘
               │                     │                      │
               │                     │                      ▼
               │                     │       ┌────────────────────────────────┐
               │                     │       │ Extended: Artistry / Sensory*  │
               │                     │       │ (*Conditional on Archetype)    │
               │                     │       └──────────────┬─────────────────┘
               │                     │                      │
               │                     │                      ▼
               │                     │       ┌────────────────────────────────┐
               │                     │       │ Step Finale: Stage Calibration │
               │                     │       │ (Readiness Honesty & Greeting) │
               │                     │       └──────────────┬─────────────────┘
               │                     │                      │
               ▼                     ▼                      ▼
   ┌──────────────────────────────────────────────────────────┐
   │                     Live AIRI Stage                      │
   └──────────────────────────────────────────────────────────┘
```

---

## 4. Detailed Step Breakdown

### Step 0: Zen Welcome Landing & Language Selector
- **Zen Welcome Philosophy**: Keeps the first screen uncluttered, spacious, and inviting without authentication forms.
- **Phase 1 Language Selector**: Dropdown in top header allows immediate switching of application locale (`en`, `zh-CN`, `ja-JP`, `es-ES`, `de-DE`, `fr-FR`), synchronizing with `useI18n().locale.value` and `settings/general.yaml`.
- **Hardware Check**: Runs `isWebGPUSupported()` early and stores the capability flag in memory.
- **Companion Greeting**: *"Don't worry, it's easier than it looks! We've pre-configured everything to run locally on your machine. No sign-ups, no API keys — just pick, download, and play."*
- **Three Capability Pills**: `Local WebGPU Models`, `No API Keys Needed`, `Mix & Match Souls + Bodies`.
- **Dual Launch CTAs**:
  - `[ Let's Get Started → ]`: Advances to Step 0.5 (Path Triage).
  - `[ ⚡ Quick Start: Jump Straight to Stage ]` (Use Case 1): Bypasses all setup; boots default `ReLU` companion on stage immediately.
  - `[ Skip Permanently ]`: Skips onboarding flags for users who want to jump in and explore settings manually.

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ [🌐 English ▼]                                                    [AIRI ✦] │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│                                    ✦                                       │
│                             Welcome to AIRI                                │
│        Your companion's stage — set up in minutes, 100% on your machine.   │
│                                                                            │
│       ┌─────────────────────────────────────────────────────────────┐      │
│       │ 💬 "Don't worry, it's easier than it looks! We've           │      │
│       │    pre-configured everything to run locally on your machine.│      │
│       │    No sign-ups, no API keys — just pick, download, and play"│      │
│       └─────────────────────────────────────────────────────────────┘      │
│                                                                            │
│     [ ⚙ Local WebGPU Models ]  [ 🔒 No API Keys Needed ]  [ 💃 Mix & Match ] │
│                                                                            │
│                    [ Let's Get Started → ]                                 │
│                                                                            │
│            [ ⚡ Quick Start: Jump Straight to Stage (ReLU) ]               │
│                                                                            │
│  [ Skip Permanently ]                                                      │
└────────────────────────────────────────────────────────────────────────────┘
```

---

### Step 0.5: Path Triage — The 5 Use Cases (Option B Architecture)

Onboarding V3 cleanly isolates and handles all five real-world user intents:

| # | User Intent | Primary Motivation | Onboarding Journey & Resolution |
| :--- | :--- | :--- | :--- |
| **1** | **The Explorer / Guest** | *"I don't care about anything, let me just try the app!"* | **Step 0 `[ ⚡ Quick Start ]`**: Bypasses the entire wizard. Loads the seeded `ReLU` companion with local WebGPU inference directly onto the stage. |
| **2** | **The Local-First Creator** | Wants full companion customization with 100% privacy and zero accounts. | **Step 0.5 `[ 🏠 Local Companion ]`**: Proceeds to Step 1 (Experience Picker) to build their companion entirely on-device. |
| **3** | **The Cloud-Backed Creator** | Wants to build a new companion that is automatically backed up to Cloudflare R2 from day 1. | **Step 0.5 `[ ☁️ Cloudflare ]`** $\rightarrow$ Authenticate $\rightarrow$ Remote storage is empty $\rightarrow$ Automatically advances to Step 1 (Experience Picker) to craft their cloud-backed companion. |
| **4** | **The Returning Restorer** | Already has cards/models backed up on another machine and wants to pick up where they left off. | **Step 0.5 `[ ☁️ Cloudflare ]`** $\rightarrow$ Authenticate $\rightarrow$ Remote cards detected $\rightarrow$ `SelectiveSyncPanel` $\rightarrow$ **`[ 🚀 Launch Stage with Restored Cards ]`**. Setup complete in 30 seconds! |
| **5** | **The Multi-Companion Power User** | Restores their existing cloud companions, but *also* wants to craft an additional companion today. | **Step 0.5 `[ ☁️ Cloudflare ]`** $\rightarrow$ Authenticate $\rightarrow$ `SelectiveSyncPanel` $\rightarrow$ User selects **`[ + Build Another Companion ]`** $\rightarrow$ Proceeds into Step 1 with cloud sync active. |

```text
┌────────────────────────────────────────────────────────────────────────────┐
│                            Choose Your Path                                │
│                 How would you like to set up your stage?                   │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ 🏠 Local Companion (100% Offline)                       [LOCAL-FIRST]│  │
│  │ Setup your companion directly on this device with WebGPU.            │  │
│  │ Complete privacy — no accounts, no cloud dependencies.               │  │
│  │ [ Select Local Setup ]                                               │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ ☁️ Cloud-Connected (Cloudflare Zero-Trust)               [ZERO-TRUST]│  │
│  │ Sync existing companions or connect for automated private backup.    │  │
│  │                                                                      │  │
│  │ [ Auto Sign-in (PKCE) ]   [ API Token (Direct) ]   [ Browser OAuth ] │  │
│  │                                                                      │  │
│  │ ── When Authenticated with Existing Backups: ──────────────────────  │  │
│  │  ✓ Connected to Cloudflare Account (ID: 3a9f...c81)                  │  │
│  │  Found 2 companions and 4 avatar assets in R2 Cloud Storage.         │  │
│  │  [ Selective Sync Panel Embed ]                                      │  │
│  │                                                                      │  │
│  │  [ 🚀 Launch Stage with Restored Companions ]  (Use Case 4)         │  │
│  │  [ + Create an Additional Companion ]         (Use Case 5)         │  │
│  │                                                                      │  │
│  │ ── When Authenticated with Fresh/Empty Account: ───────────────────  │  │
│  │  ✓ Connected! Edge vault and R2 bucket initialized.                  │  │
│  │  [ Continue Setup (Cloud-Backed) > ]          (Use Case 3)         │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  < Back to Welcome                     [ Skip Permanently ]                │
└────────────────────────────────────────────────────────────────────────────┘
```

---

### Step 1: Choose Your Experience (4 Hero Bundles + Customizer Deck)
- **4 Hero Archetype Cards**:
  1. **💬 Chat Only** (3 steps): Soul + Vessel + Profile + LLM Consciousness. Zero audio friction; lightning fast.
  2. **🎙️ Talk & Listen** (5 steps): Adds Hearing (Whisper WebGPU / Web Speech) and Voice Studio (Kokoro / Pocket-TTS / Cloud).
  3. **👁️ Sentinel Companion** (7 steps): Adds OS sensory telemetry, active-window context, and idle AFK check-ins.
  4. **🎨 Artistic Companion** (6 steps): Adds Autonomous Artistry (ComfyUI / Pollinations) for generative art and selfies.

```text
┌────────────────────────────────────────────────────────────────────────────┐
│                    Choose Your Companion Experience                        │
│   "Select an archetype to get started. You can tune any module below."     │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────┐  │
│  │   💬 Chat Only       │  │  🎙️ Talk & Listen     │  │  👁️ Sentinel     │  │
│  │  Pure text dialogue  │  │  Voice conversation  │  │  Proactive desk  │  │
│  │  Zero audio friction │  │  Hear & speak freely │  │  companion       │  │
│  │  [  Select Chat  ]   │  │  [ Selected ✓ ]      │  │  [ Select Sent. ]│  │
│  └──────────────────────┘  └──────────────────────┘  └──────────────────┘  │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │   🎨 Artistic Companion                                              │  │
│  │  Creative collaborator for generative art, selfies, and visual lore │  │
│  │  [ Select Artistic ]                                                 │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  ─────────────────── ⚙️ Customize Your Journey ──────────────────────────  │
│                                                                            │
│  Core Capabilities (Configured in Guided Flow):                            │
│  [✓] 🧠 Consciousness (LLM)      — Required. Language model for dialogue.  │
│  [✓] 🎭 Soul & Persona           — Required. Companion identity and lore.  │
│  [✓] 💃 Physical Vessel          — Required. 3D VRM or 2D Live2D avatar.   │
│  [✓] 👤 User Profile             — Required. Your name, callsign & lore.   │
│  [✓] 🎙️ Hearing & Mic (STT)      — In-browser Whisper WebGPU / Web Speech. │
│  [✓] 🔊 Voice Studio (TTS)       — Kokoro WebGPU / Pocket-TTS / Cloud.     │
│                                                                            │
│  Extended Capabilities (Active in V3 Engine):                              │
│  [ ] 🎨 Autonomous Artistry      — ComfyUI node runner / Pollinations AI.  │
│  [ ] 👁️ Sensory Proactivity      — OS window telemetry, AFK heartbeats.    │
│                                                                            │
│  Future Capabilities (Spec'd Layout — Unclickable / Coming Soon):         │
│  [ ] 🎬 Generative Motion & VRMA — [Coming Soon] Real-time 3D dance cues.  │
│  [ ] 📖 Lifetime Memory Matrix   — [Coming Soon] LTMM Orama & DRMM dreams. │
│  [ ] 🎭 Marker Rehearsal Room    — [Coming Soon] <|ACT:...|> token tuner.  │
│  [ ] 🎮 Dating Sim Mode & HUD    — [Coming Soon] Intimacy & branching lore.│
│  [ ] 🪟 Multi-Window Stage Island — [Coming Soon] Transparent overlay bubble.│
│  [ ] ☁️ 24/7 Cloud Relay & Bot   — [Coming Soon] Cloudflare Discord daemon.│
│                                                                            │
│  Estimated Journey: 5 Steps · ~2 Minutes Setup                             │
│  [ Skip All (Direct to Stage) ]                      [ Continue Setup > ]  │
└────────────────────────────────────────────────────────────────────────────┘
```

#### Detailed Capability Matrix & State Behavior

| Capability Identifier | Category | UI State | Default in Hero Bundles | Step Screen / Behavior |
| :--- | :--- | :--- | :--- | :--- |
| `consciousness` | Core | Enabled (Locked) | All Bundles | Step 6: Consciousness (WebLLM / Cloud) |
| `persona` | Core | Enabled (Locked) | All Bundles | Step 2: Soul & Persona (Trope / Card Import) |
| `vessel` | Core | Enabled (Locked) | All Bundles | Step 3: Physical Vessel (DiscoverCarousel) |
| `user_profile` | Core | Enabled (Locked) | All Bundles | Step 4: User Profile & Identity |
| `hearing` | Core | Toggleable | Talk & Listen, Sentinel, Artistic | Step 5: Hearing & Mic (Whisper WebGPU / Web Speech) |
| `speech` | Core | Toggleable | Talk & Listen, Sentinel, Artistic | Step 7: Voice Studio (Kokoro / Pocket-TTS / Cloud) |
| `artistry` | Extended | Toggleable | Artistic Companion | Configures ComfyUI API / Pollinations provider |
| `sensory` | Extended | Toggleable | Sentinel Companion | Prompts OS permission & enables AFK telemetry loops |
| `generative_motion` | Future Expansion | Disabled (`cursor-not-allowed`) | None | Badge: `[Coming Soon]`. Tooltip: "FlowMDM WebGPU procedural text-to-motion". |
| `memory_matrix` | Future Expansion | Disabled (`cursor-not-allowed`) | None | Badge: `[Coming Soon]`. Tooltip: "Lifetime Sacred Journal & DRMM dreaming consolidation". |
| `rehearsal_room` | Future Expansion | Disabled (`cursor-not-allowed`) | None | Badge: `[Coming Soon]`. Tooltip: "<|ACT:...|> live emotion and motion cue testing sandbox". |
| `dating_sim` | Future Expansion | Disabled (`cursor-not-allowed`) | None | Badge: `[Coming Soon]`. Tooltip: "Branching visual novel HUD, intimacy tracking, and scene sets". |
| `multi_window` | Future Expansion | Disabled (`cursor-not-allowed`) | None | Badge: `[Coming Soon]`. Tooltip: "Detached desktop chat bubble and transparent stage overlay". |
| `cloud_relay_bot` | Future Expansion | Disabled (`cursor-not-allowed`) | None | Badge: `[Coming Soon]`. Tooltip: "Cloudflare Edge Worker for 24/7 Discord bot and multi-device sync". |

---

### Step 2: Soul & Persona (Emotional Payoff First!)
- **Total Decoupling**: Purely handles personality cards and system prompts. Visual avatar bodies are chosen on Step 3.
- **3-Tier Structure**:
  - **Tier 1 (1-Click Starter Cards & Archetypes)**:
    - ReLU (Companion), Dr. Aria (Scientist), Lupin (Guardian) — the three seeded defaults (`airi-card.ts`).
    - Anime archetype cards (Tsundere, Kuudere, Yandere, etc.) sourced from `assets/animadex-catalog.json`.
  - **Tier 2 (Community Card Interceptor Hub & SillyTavern Interceptor Wizard)**:
    - Opens a webview side-sheet for community providers (JannyAI, Chub AI, JanitorAI, Risu Realm, DataCat).
    - Intercepts Chromium `onDidDownload` image download events when users click to download a SillyTavern PNG/JSON card.
    - Reads PNG tEXt / JSON metadata, extracts character fields, and replaces `{{user}}` placeholders.
  - **Tier 3 (AI Guided Creator Wizard)**:
    - Displayed as a feature preview / coming soon card so it remains visible without bogging down the initial flow.

---

### Step 3: Physical Vessel (DiscoverCarousel 3D Coverflow)
- **Primary View: 3D Coverflow Carousel**:
  - Direct integration of `DiscoverCarousel.vue` (from `settings/models/explore.vue`).
  - Interactive drag-and-snap carousel showcasing spotlight avatars (Hiyori Live2D, AvatarSample_A 3D VRM, AvatarSample_B 3D VRM).
  - Format filter chips: `All Formats`, `VRM (3D)`, `Live2D (2D)`, `Spine`, `MMD`.
- **Secondary View Toggle**: `[ 📂 Choose from Installed Library ]` toggles the full installed model grid for existing users.
- **Ever-Present Dropzone**: Drag-and-drop support for custom `.vrm`, `.model3.json`, or `.zip` archives works instantly.

```text
┌────────────────────────────────────────────────────────────────────────────┐
│                             Physical Vessel                                │
│        "Choose a starter body for your companion, or drop your own."       │
│                                                                            │
│   [ All Formats ]  [ VRM (3D) ]  [ Live2D (2D) ]  [ Spine ]  [ MMD ]       │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│            ┌───────────┐      ┌─────────────┐      ┌───────────┐           │
│            │           │      │  ★ ACTIVE   │      │           │           │
│            │  Avatar_A │ ◄─── │   Hiyori    │ ───► │  Avatar_B │           │
│            │  3D VRM   │      │   Live2D    │      │  3D VRM   │           │
│            └───────────┘      └─────────────┘      └───────────┘           │
│                                      ▲                                     │
│                         Drag / Swipe Carousel Deck                         │
│                                                                            │
│   Selected Body: Hiyori (Live2D Cubism) · Free Starter Avatar              │
│                                                                            │
│   ┌────────────────────────────────────────────────────────────────────┐   │
│   │ 📁 Drop or browse custom model (.vrm, .zip, .pmx, .skel)           │   │
│   └────────────────────────────────────────────────────────────────────┘   │
│                                                                            │
│   [ 📂 Choose from Installed Library (100+) ]   (Secondary View Toggle)    │
│                                                                            │
│   [ < Back to Persona ]                                   [ Next: Voice > ]│
└────────────────────────────────────────────────────────────────────────────┘
```

---

### Step 4: User Profile & Identity Setup
- **Source Ref**: [`packages/stage-pages/src/pages/settings/system/user-profile.vue`](packages/stage-pages/src/pages/settings/system/user-profile.vue)
- **Store**: `useSettingsUserProfile` (`name`, `description`, `prompt`, `voiceProfileId`).
- **Purpose**: Captures User Display Name, Narrative Description, and Visual Prompt Tags so the companion's prompts know who the user is.

---

### Step 5: Hearing & Mic Playground (STT / Ear Setup)
> *Conditional Step: Rendered when `Talk & Listen`, `Sentinel`, `Artistic`, or custom `hearing` capability is enabled.*
- **Lifts Existing STT Machinery**: Direct reuse of verified hearing engine components from `packages/stage-pages/src/pages/settings/modules/hearing.vue`:
  - `useSettingsAudioDevice` (device switching)
  - `useAudioAnalyzer` → `LevelMeter` (real-time audio waveform meter)
  - `transcribeForMediaStream` & `transcribeForRecording` (`stores/modules/hearing.ts`)
  - `electronGet/SetMicToggleHotkey` (hardware lock key shortcuts for CapsLock, NumLock, ScrollLock on desktop)
- **Transcription Providers**:
  - Filter controls for **DEPLOYMENT** (`All`, `Cloud`, `Local`) and **PRICING** (`All`, `Free`, `Paid`).
  - Provider options: **Whisper WebGPU** (`whisper-local` via `whisper-large-v3-turbo` / `whisper-small`), **Browser Web Speech API** (zero-download fallback), **Groq Whisper**, **OpenAI Whisper**, **Deepgram**, etc.
- **In-Context Model Preparation**: Selecting Whisper WebGPU initiates on-step weight downloads with streaming progress percentages.
- **Live Verification**: `[ Next > ]` unlocks automatically once live speech is detected and transcribed into the preview label.

---

### Step 6: Consciousness (Mind / LLM Setup)
> *Core Required Step: Configures the companion's reasoning and dialogue engine.*
- **Top Section - WebLLM Hero Cards (Local WebGPU with VRAM Transparency)**:
  - `Qwen 3.5 4B` — `[⭐ RECOMMENDED]` — VRAM: ~3.9 GB — Outstanding roleplay and instruction following.
  - `Qwen 3.5 0.8B` — VRAM: ~1.6 GB — Ultra-fast distilled model for lightweight laptops.
  - `Gemma 3 1B` — VRAM: ~0.7 GB — Lowest VRAM footprint; ideal for integrated graphics and mobile.
  - `Ministral 3B` — VRAM: ~2.9 GB — High reasoning density.
  - `Phi-4 Mini` — VRAM: ~3.4 GB — Microsoft 3.8B compact reasoning model.
- **Hardware & WebGPU Detection**: If `isWebGPUSupported()` is false, displays a friendly callout steering users to cloud providers.
- **Bottom Section - Cloud & Self-Hosted Provider Grid**:
  - Categorized grid: OpenAI, Anthropic, Google Gemini, Groq, OpenRouter, Ollama, LM Studio, etc.
  - Selecting a cloud provider expands inline credential inputs without kicking the user to settings.
- **Live Inference Probe**: Performs an active completion ping to verify connection before unlocking progression.

---

### Step 7: Contextual Speech (Her Voice Studio Setup)
> *Conditional Step: Rendered when voice speech is enabled.*
- **Section A — Visual Provider Hierarchy**:
  - **Local Neural Hero Cards**:
    - **Kokoro Local WebGPU**: Multilingual neural synthesis (`[EN]`, `[JA]`, `[ZH]`, `[ES]`, `[FR]`).
    - **Pocket-TTS Local**: Ultra-fast CPU engine with instant voice cloning.
    - **Moss-Nano Local**: Lightweight local synthesis.
  - **Cloud Providers**: ElevenLabs, OpenAI Audio, Deepgram Aura, Azure Speech, Fish Audio.
- **Section B — Unified Voice Tuning Controls**:
  - Voice Selector dropdown + `[ 🔄 Load Voices ]`.
  - Tight tuning range for Speed & Pitch (`0.75x` – `1.5x`) to preserve natural vocal timber.
- **Section C — Live Audio Preview Playground**:
  - Pre-filled sample text: *"Hello {userName}! I'm {personaName}. Everything is ready — how do I sound?"*
  - `[ ▶ Play Preview ]` synthesizes and plays audio live through the selected engine.

---

### Extended Modules: Autonomous Artistry & Sensory Proactivity
> *Conditional Steps: Rendered when Sentinel Companion, Artistic Companion, or corresponding customizer checkboxes are active.*
- **🎨 Autonomous Artistry**:
  - Configures local ComfyUI API endpoint (`http://127.0.0.1:8188`) or Pollinations AI cloud fallback.
  - Tests workflow connectivity for autonomous selfies, visual storytelling, and stage widget manifestation.
- **👁️ Sensory Proactivity**:
  - Guides OS permission setup for active window title tracking and desktop AFK detection.
  - Calibrates attention thresholds and non-intrusive heartbeat interval triggers.

---

### Step Finale: Stage Calibration & Truthful Readiness Launch
### Step Finale: Stage Calibration & Truthful Readiness Launch
- **Readiness Honesty Matrix**:
  - Replaces artificial "100% prepared" claims with granular, truthful status cards:

| Subsystem | State | Visual Indicator | Status Label | Meaning |
| :--- | :--- | :--- | :--- | :--- |
| **Consciousness** | Probe Passed | 🟢 Green Check | `Verified Active` | Real LLM generation ping succeeded. |
| **Consciousness** | Untested Cloud | 🟡 Yellow Dot | `Configured (Untested)` | API key present, probe skipped. |
| **Hearing** | Mic Passed | 🟢 Green Check | `Calibrated` | Live audio transcription captured. |
| **Hearing** | Deselected/Skipped| ⚪ Grey Dash | `Muted / Skipped` | Mic input disabled for this companion. |
| **Speech** | Audio Previewed| 🟢 Green Check | `Voice Active` | Real audio synthesis played. |
| **Speech** | Deselected/Skipped| ⚪ Grey Dash | `Silent Mode` | Text-only companion. |
| **Artistry** | Connected | 🟢 Green Check | `Art Engine Ready` | ComfyUI or Pollinations verified. |
| **Sensory** | Granted | 🟢 Green Check | `Sensory Active` | OS telemetry permissions granted. |

- **Live First Spoken Greeting**:
  - Triggers an actual LLM completion with the companion's compiled persona, user profile, and starter prompt.
  - If speech is enabled, streams the response through the chosen TTS voice so she speaks her real first words on the calibration screen.
  - Graceful fallback to offline starter text if network is unavailable.
- **Instant Launch**: Tapping `[ 🚀 Enter AIRI Stage ]` transitions smoothly into the desktop stage with the new companion active.

---

## 5. Implementation Status & Active Architecture

- **Canonical Implementation**: Onboarding V3 evolves V2's robust component modularity by adding dynamic bundle routing, coverflow vessel selection, and persona-first ordering.
- **Modal Mounting**: `OnboardingDialog` (`packages/stage-ui/src/components/scenarios/dialogs/onboarding/onboarding-dialog.vue`) hosts the onboarding flow across desktop `DialogRoot` and mobile `DrawerRoot`.
- **State Isolation**: Transient choices reside in `useOnboardingV2Draft` (`onboarding/v2-draft`), guaranteeing that navigating or cancelling never leaves orphaned or corrupted records in IndexedDB.
- **Single-Source Shared Faculty Architecture**:
  - Rather than maintaining duplicate, diverging configuration engines, Onboarding steps embed and adapt the verified presentation components from `packages/stage-pages/src/pages/settings/modules/*`.

```text
┌────────────────────────────────────────────────────────────────────────────┐
│                    Shared Faculty Architecture Map                         │
├────────────────────────────────────────────────────────────────────────────┤
│   Faculty / Subsystem    │ Settings Module Surface │ Onboarding Step Seam  │
├──────────────────────────┼─────────────────────────┼───────────────────────┤
│ 🎙️ Hearing (STT)         │ /settings/modules/      │ Step 5: Hearing       │
│                          │ hearing.vue             │ (Reuses LevelMeter &  │
│                          │                         │  device switching)    │
│ 🧠 Consciousness (LLM)   │ /settings/modules/      │ Step 6: Consciousness │
│                          │ consciousness.vue       │ (Reuses ProviderGrid) │
│ 🔊 Speech Studio (TTS)   │ /settings/modules/      │ Step 7: Voice Studio  │
│                          │ speech.vue              │ (Reuses Audio Preview)│
│ 🎨 Autonomous Artistry   │ /settings/modules/      │ Extended: Artistry    │
│                          │ artistry.vue            │ (Reuses Provider/Node)│
│ 💃 Physical Vessel       │ /settings/models/       │ Step 3: Vessel        │
│                          │ explore.vue             │ (Reuses Discover-     │
│                          │                         │  Carousel.vue)        │
│ ☁️ Cloudflare & Sync     │ /settings/modules/      │ Step 0.5: Triage      │
│                          │ cloudflare.vue / sync   │ (Reuses SelectiveSync)│
└────────────────────────────────────────────────────────────────────────────┘
```

  - The newly refactored [`modules/artistry.vue`](packages/stage-pages/src/pages/settings/modules/artistry.vue) demonstrates this principle: it serves as both a global configuration surface / prompt playground and directly powers the Onboarding Artistry module.
  - Any capability skipped or minimally configured during onboarding is permanently accessible and tuneable in `/settings/modules/*`.

---

## 6. Codebase Reference Table

| Step | Component / Location | Pinia Store / Composable Ref | Key Constants / Services |
|---|---|---|---|
| **0: Welcome** | [`v2/steps/step-0-welcome.vue`](packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/steps/step-0-welcome.vue) | `useOnboardingStore`, `useI18n` | `isWebGPUSupported()`, Phase 1 Language Selector |
| **0.5: Triage** | [`step-start-choice.vue`](packages/stage-ui/src/components/scenarios/dialogs/onboarding/step-start-choice.vue) | `useOnboardingStore` | `onSelectPath('new' \| 'returning')`, Cloudflare OAuth PKCE |
| **1: Experience** | `v2/steps/step-1-experience.vue` (New) | `useOnboardingV2Draft` | 4 Hero Archetype Cards + Customizer Deck |
| **2: Soul & Persona** | [`v2/steps/step-4-persona.vue`](packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/steps/step-4-persona.vue) | `useAiriCardStore` | `STARTER_CHARACTERS`, `animadex-catalog.json`, Card Imports |
| **3: Vessel** | [`v2/steps/step-5-vessel.vue`](packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/steps/step-5-vessel.vue) | `useDisplayModelsStore` | `DiscoverCarousel.vue`, VRM/Live2D starter presets, uploader |
| **4: User Profile** | [`v2/steps/step-3-user-profile.vue`](packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/steps/step-3-user-profile.vue) | `useSettingsUserProfile` | `name`, `description`, `prompt` |
| **5: Hearing (STT)** | [`v2/steps/step-1-hearing.vue`](packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/steps/step-1-hearing.vue) | `useHearingStore` | `WHISPER_MODELS`, `useAudioContext`, `MicToggleHotkey` |
| **6: Consciousness** | [`v2/steps/step-2-consciousness.vue`](packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/steps/step-2-consciousness.vue) | `useConsciousnessStore` / `useProvidersStore` | `WEB_LLM_MODELS`, `getWebLlmAdapter()`, Live LLM probe |
| **7: Speech (TTS)** | [`v2/steps/step-6-speech.vue`](packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/steps/step-6-speech.vue) | `useSpeechStore` | `kokoro-local`, `pocket-tts-local`, `moss-nano-local`, Audio Preview |
| **Finale: Calibration** | [`v2/steps/step-7-calibration.vue`](packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/steps/step-7-calibration.vue) | `useOnboardingStore` / `useAiriCardStore` | Readiness Honesty Matrix, Live First Spoken Greeting |

## Relevant Skills

- [[airi-onboarding-v2]]
- [[airi-card-schema]]
- [[airi-character-rendering]]
- [[airi-i18n-localization]]

