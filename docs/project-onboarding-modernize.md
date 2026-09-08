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

### Step 0: Welcome Landing & Language Selector
- **Phase 1 Language Selector**: Dropdown in top header allows immediate switching of application locale (`en`, `zh-CN`, `ja-JP`, `es-ES`, `de-DE`, `fr-FR`), synchronizing with `useI18n().locale.value` and `settings/general.yaml`.
- **Hardware Check**: Runs `isWebGPUSupported()` early and stores the capability flag in memory.
- **Companion Greeting**: *"Welcome to AIRI. Choose your language, configure your companion, or connect your personal zero-trust cloud relay."*

### Step 0.5: Path Triage (`step-start-choice.vue`)
- **Track A: "Sign In with Cloudflare" (`[ZERO-TRUST]`) (Cloud-Connected / Multi-Device Sync)**:
  - Initiates OAuth 2.0 PKCE directly with Cloudflare.
  - Automates personal Worker deployment (Edge CORS proxy + 24/7 Discord bot host) and R2 bucket connectivity for private zero-trust backups.
  - **Existing Data Found**: Hydrates character cards, 3D VRM/2D Live2D models, and memory archives from S3/R2 into local IndexedDB $\rightarrow$ Drops to Victory Stage with active companion ready, or opens Wizard to add another companion.
  - **New Cloudflare Account / Empty Sync**: Provisions the user's empty cloud bucket/worker upfront, then proceeds into the guided wizard so new companions are immediately cloud-backed and portable.
- **Track B: "Local Companion (Offline)" (`[LOCAL-FIRST]`) (Local-First Wizard)**:
  - Advances to Step 1 for 100% offline, private local companion creation without an account.

### Step 1: Choose Your Experience (4 Hero Bundles + Customizer Deck)
- **4 Hero Archetype Cards**:
  1. **💬 Chat Only** (3 steps): Soul + Vessel + Profile + LLM Consciousness. Zero audio friction; lightning fast.
  2. **🎙️ Talk & Listen** (5 steps): Adds Hearing (Whisper WebGPU / Web Speech) and Voice Studio (Kokoro / Pocket-TTS / Cloud).
  3. **👁️ Sentinel Companion** (7 steps): Adds OS sensory telemetry, active-window context, and idle AFK check-ins.
  4. **🎨 Artistic Companion** (6 steps): Adds Autonomous Artistry (ComfyUI / Pollinations) for generative art and selfies.
- **Customize Your Journey Deck**:
  - Live checkboxes allow tuning individual modules or selecting all.
  - Spec'd future expansion capabilities are displayed with styled disabled/unclickable `[Coming Soon]` badges to showcase the full vision without breaking flow:
    - `🎬 Generative Motion & VRMA`: FlowMDM WebGPU procedural text-to-motion dance cues.
    - `📖 Lifetime Memory Matrix`: Sacred Journal & DRMM dreaming consolidation.
    - `🎭 Marker Rehearsal Room`: `<|ACT:...|>` live token expression sandbox.
    - `🎮 Dating Sim Mode & HUD`: Interactive storyline presets & intimacy meters.
    - `🪟 Multi-Window Stage Island`: Detached overlay chat bubble.
    - `☁️ 24/7 Cloud Relay & Bot`: Cloudflare edge daemon for Discord presence.

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

### Step 3: Physical Vessel (DiscoverCarousel 3D Coverflow)
- **Primary View: 3D Coverflow Carousel**:
  - Direct integration of `DiscoverCarousel.vue` (from `settings/models/explore.vue`).
  - Interactive drag-and-snap carousel showcasing spotlight avatars (Hiyori Live2D, AvatarSample_A 3D VRM, AvatarSample_B 3D VRM).
  - Format filter chips: `All Formats`, `VRM (3D)`, `Live2D (2D)`, `Spine`, `MMD`.
- **Secondary View Toggle**: `[ 📂 Choose from Installed Library ]` toggles the full installed model grid for existing users.
- **Ever-Present Dropzone**: Drag-and-drop support for custom `.vrm`, `.model3.json`, or `.zip` archives works instantly.

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
- **Readiness Honesty Matrix**:
  - Replaces false "100% prepared" claims with granular, truthful status cards:
    - `Verified Active` (🟢): Subsystem verified via live probe or local weights loaded.
    - `Configured (Untested)` (🟡): API key entered, probe skipped.
    - `Muted / Skipped` (⚪): Microphone input disabled or skipped.
    - `Silent Mode` (⚪): Speech disabled (Chat Only mode).
- **Live First Spoken Greeting**:
  - Triggers an actual LLM completion with the companion's compiled persona, user profile, and starter prompt.
  - If speech is enabled, streams the response through the chosen TTS voice so she speaks her real first words.
  - Graceful fallback to offline starter text if network is unavailable.
- **Instant Launch**: Tapping `[ 🚀 Enter AIRI Stage ]` transitions smoothly into the desktop stage with the new companion active.

---

## 5. Implementation Status & Active Architecture

- **Canonical Implementation**: Onboarding V3 evolves V2's robust component modularity by adding dynamic bundle routing, coverflow vessel selection, and persona-first ordering.
- **Modal Mounting**: `OnboardingDialog` (`packages/stage-ui/src/components/scenarios/dialogs/onboarding/onboarding-dialog.vue`) hosts the onboarding flow across desktop `DialogRoot` and mobile `DrawerRoot`.
- **State Isolation**: Transient choices reside in `useOnboardingV2Draft` (`onboarding/v2-draft`), guaranteeing that navigating or cancelling never leaves orphaned or corrupted records in IndexedDB.

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

