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

1. **In-Context Component Preparation**: No late 99% download screens. Selecting a local engine initializes its WebWorker, WASM, or WebGPU weights immediately on that step with a live progress bar and test playground.
2. **Decoupled Soul & Form**: Personality/Lore (Step 4) and Physical Avatar Body (Step 5) are completely decoupled, granting total mix-and-match freedom.
3. **Hardware Capability Transparency**: Every local model card clearly displays VRAM requirements, model size, and supported languages so users make informed choices based on their hardware.
4. **Early Hardware & WebGPU Detection**: Detects `isWebGPUSupported()` globally on startup to guide the user toward WebGPU vs. WASM/Browser-native options.
5. **Zero-Custody Cloud Relay**: Cloud accounts authenticate via Cloudflare OAuth 2.0 PKCE. All storage (R2/S3) and compute (Workers/KV) run inside the user's personal Cloudflare account. AIRI never holds custody of user API keys or master credentials.
6. **Transient Composition State & Deferred Card Assembly**: Onboarding V2 collects choices (STT, LLM, User Profile, Persona, Vessel, TTS) in a clean, transient onboarding composition draft store (`useOnboardingV2Draft`). It does **NOT** dirty-mutate existing IndexedDB character cards as a step-by-step scratchpad. On Step 7 (Calibration / Finale), the assembled choices are cleanly compiled into the target `AiriCard` and `AiriExtension` payload.

---

## 3. The Modernized Sequence & Dual-Track Flow

```text
                     ┌──────────────────────────────────────────────┐
                     │           Step 0: Welcome Landing            │
                     │   "Welcome to AIRI · Zero-Custody Stage"     │
                     └──────────────────────┬───────────────────────┘
                                            │
                                            ▼
                     ┌──────────────────────────────────────────────┐
                     │          Step 0.5: Path Triage               │
                     │  "Choose How You Want to Experience AIRI"   │
                     └──────────────┬───────────────────────────────┘
                                    │
               ┌────────────────────┴────────────────────┐
               ▼                                         ▼
   [ Sign In with Cloudflare ]                  [ Continue Offline / Later ]
   (Cloud-Connected & Multi-Device Sync)        (New Users & 100% Local-First)
               │                                         │
               ▼                                         ▼
   ┌───────────────────────┐                 ┌───────────────────────┐
   │ Cloudflare OAuth PKCE │                 │ 7-Step Guided Wizard  │
   │  - Auth with CF       │                 │  1. Hearing (Whisper) │
   │  - Provision Worker   │                 │  2. Consciousness     │
   │  - Connect S3/R2      │                 │  3. User Profile      │
   │  - Sync/Restore State │                 │  4. Persona           │
   └───────────┬───────────┘                 │  5. Vessel (Avatar)   │
               │                             │  6. Voice (TTS)       │
               ▼                             │  7. Calibration       │
   ┌───────────────────────┐                 └───────────┬───────────┘
   │  "Everything Synced!" │                             │
   │  [ Enter Stage ]  OR  │                             │
   │  [ + New Companion ]  │ ────────────────────────────┘
   └───────────┬───────────┘
               │
               ▼
   ┌───────────────────────┐
   │    Live AIRI Stage    │
   └───────────────────────┘
```

---

## 4. Detailed Step Breakdown

### Step 0: Welcome Landing & Path Triage
- **Hardware Check**: Runs `isWebGPUSupported()` early and stores the capability flag in memory.
- **Companion Bubble**: *"Don't worry, it's easier than it looks! We've pre-configured everything to run locally on your machine, or you can sign in with Cloudflare for zero-trust cloud backup."*
- **Triage Action (`step-start-choice.vue`)**:
  - **Track A: "Sign In with Cloudflare" (`[ZERO-TRUST]`) (Cloud-Connected / Multi-Device Sync)**:
    - Initiates OAuth 2.0 PKCE directly with Cloudflare.
    - Automates personal Worker deployment (Edge CORS proxy + 24/7 Discord bot host) and R2 bucket connectivity for private zero-trust backups.
    - **Existing Data Found**: Hydrates character cards, 3D VRM/2D Live2D models, and memory archives from S3/R2 into local IndexedDB $\rightarrow$ Drops to Victory Stage with active companion ready, or opens Wizard to add another companion.
    - **New Cloudflare Account / Empty Sync**: Provisions the user's empty cloud bucket/worker upfront, then proceeds into the 7-step wizard so new companions are immediately cloud-backed and portable.
  - **Track B: "Local Companion (Offline)" (`[LOCAL-FIRST]`) (Local-First Wizard)**:
    - Advances to Step 1 for 100% offline, private local companion creation without an account.


### Step 1: Hearing & Mic Playground (STT / Ear Setup)
- **Why Right After Welcome?**: Speech recognition has zero dependencies on character language or persona! Combining the microphone hardware test with the STT provider picker creates an immediate, interactive playground right after the welcome page.
- **Architectural Principle**: **Reuse & Extract, Don't Reinvent**. Lifts existing verified STT machinery directly from `packages/stage-pages/src/pages/settings/modules/hearing.vue`:
  - `useSettingsAudioDevice` (mic enumeration & device switching)
  - `useAudioAnalyzer` → `LevelMeter` component (live volume level wave animation)
  - `transcribeForMediaStream` & `transcribeForRecording` (`stores/modules/hearing.ts`)
  - `electronGet/SetMicToggleHotkey` (hardware lock key shortcuts for CapsLock, NumLock, ScrollLock)
- **Provider Selection Matrix (Reused Step 2 Grid Primitive)**:
  - Reuses the exact category-agnostic provider grid & filter template from Step 2 (Consciousness), pointed at all audio transcription providers (`allAudioTranscriptionProvidersMetadata`):
    - Filter controls for **DEPLOYMENT** (`All`, `Cloud`, `Local`) and **PRICING** (`All`, `Free`, `Paid`).
    - Full grid of transcription provider cards: **Whisper WebGPU** (`whisper-local`), **Browser Web Speech API**, **Groq Whisper**, **OpenAI Whisper**, **Deepgram**, **ElevenLabs**, etc.
  - **Provider Seam Truth**: Registers `whisper-local` in the provider registry with `listModels` returning `WHISPER_MODELS` (`whisper-large-v3-turbo` ~800MB and `whisper-small` ~480MB), replacing the no-op placeholder.
  - **No Deep Links / Escapes**: Selecting cloud cards expands `step-provider-configuration` inline — users enter API keys directly within the step without navigating to `/settings/providers`.
- **In-Context Model Weight Download**:
  - Selecting **Whisper WebGPU** immediately calls `ensureWhisperLoaded(modelId)` to trigger real-time weight shard downloading & WASM compilation via `onProgress(ProgressPayload)` right inside Step 1 before moving forward (enforces Core Principle 1: In-Context Component Preparation).
- **Lock-Key Hardware Shortcut Widget (`MicToggleHotkey`)**:
  - Electron-only hotkey selector allowing users to set **Caps Lock**, **Num Lock**, or **Scroll Lock** as their PTT / mic toggle key (hidden on Web).
  - Listens for `toggle-mic-from-shortcut` IPC to flash a live "Key detected ✓" indicator when pressed.
- **Empirical Live Verification & Gated Navigation**:
  - **Verification Rule**: Selecting a provider does **NOT** mark it as verified. Verification occurs **ONLY** when the live transcript display label receives actual output text from the active provider (`transcribedText !== ""`).
  - Orchestrator Gate (`provide`/`inject` `onboardingV2Gate` contract):
    - `[ Skip Step ]`: Always enabled. Allows users without a mic or interest in voice STT to bypass setup.
    - `[ Next > ]`: **Disabled by default**. Automatically lights up & unlocks ONLY after live spoken text is successfully transcribed and displayed in the transcript label.
- **Cleanup**: Stopping monitoring, VAD, and streaming sessions on step unmount to avoid mic stream leaks into Step 2.

---

### Step 2: Consciousness (Mind / LLM Setup)
- **Unified Composition**: Top section displays WebLLM hero cards; bottom section reuses the category-agnostic Provider Grid primitive for cloud & local providers.
- **Top Section - WebLLM Hero Cards (with VRAM Transparency)**:
  - Sourced directly from `WEB_LLM_MODELS` in [`libs/inference/constants.ts`](packages/stage-ui/src/libs/inference/constants.ts):
    - `Qwen 3.5 4B` — `[⭐ RECOMMENDED]` — VRAM: ~3.9 GB (3868 MB) — Outstanding chat, instruction, & roleplay.
    - `Qwen 3.5 0.8B` — VRAM: ~1.6 GB (1629 MB) — Fast distill for lightweight systems.
    - `Gemma 3 1B` — VRAM: ~0.7 GB (711 MB) — Lowest VRAM; integrated GPUs & mobile.
    - `Ministral 3B` — VRAM: ~2.9 GB (2864 MB) — High reasoning capability.
    - `Phi-4 Mini` — VRAM: ~3.4 GB (3438 MB) — Compact Microsoft 3.8B model.
- **In-Context WebLLM Weight Download**:
  - Selecting a WebLLM hero card dynamically imports `getWebLlmAdapter()` (`libs/inference/adapters/web-llm.ts`) and calls `adapter.loadModel(target, { onProgress })` inline, streaming real `ProgressPayload` percent/bytes to drive the progress bar on Step 2.
- **Hardware & WebGPU Gating**:
  - If `isWebGPUSupported()` is `false`, displays an amber callout ("Local AI brain needs WebGPU") and steers users to the cloud provider grid.
- **Bottom Section - Reused Provider Grid Primitive**:
  - Reuses the shared provider grid primitive (`ProviderPickerGrid`) pointed at `allChatProvidersMetadata`.
  - Selecting cloud cards (OpenAI, Anthropic, Gemini, Groq, NVIDIA NIM, OpenRouter, Ollama, LM Studio) expands `step-provider-configuration` inline for API key entry.
- **Transient Draft Composition (Core Principle 6)**:
  - Provider/model selection writes ONLY into `useOnboardingV2Draft` (`recordDraft()` → `setConsciousness({ provider, model, engine: 'web-llm' | 'cloud' })`). `consciousnessStore.activeProvider` / `activeModel` and `activeCard.extensions.airi.modules.consciousness` are NOT touched until Step 7 performs the atomic synthesis.
  - The only in-step production write is the entered API key itself (account credentials committed to `providersStore` via `markProviderAdded` when the user connects a provider) — credentials are account config, not card state, and survive Step 7 synthesis intentionally.
- **Live Inference Probe & Verification Gate**:
  - An ad-hoc inference validation widget is implemented (formerly a future-polish note): connecting a provider allows a live `generateText` probe (`probeState`: `connecting` → `inferencing` → `verified`).
  - WebLLM: Verified when `loadModel()` resolves and adapter state flips to `ready`.
  - Cloud LLMs: Verified on probe success, or as a fallback when a provider is configured and a model is selected.
  - Orchestrator Gate (`provide`/`inject` `onboardingV2Gate` contract):
    - `[ Skip Step ]`: Always enabled.
    - `[ Next > ]`: **Disabled by default** until the selected LLM engine is verified ready (probe verified, or provider+model chosen).

---

### Step 3: User Profile & Identity Setup
- **Source Ref**: [`packages/stage-pages/src/pages/settings/system/user-profile.vue`](packages/stage-pages/src/pages/settings/system/user-profile.vue)
- **Store**: `useSettingsUserProfile` (`name`, `description`, `prompt`, `voiceProfileId`).
- **Purpose**: Captures User Display Name, Narrative Description, and Visual Prompt Tags **before** Persona Selection so Tier 3 AI Card Creators and SillyTavern template engines know who the user is.

---

### Step 4: Soul & Persona Selection (Pure Personality)
- **Total Decoupling**: Purely handles personality cards and system prompts. Visual avatar bodies are chosen on Step 5.
- **3-Tier Structure**:
  - **Tier 1 (1-Click Starter Cards & Archetypes)**:
    - ReLU (Companion), Dr. Aria (Scientist), Lupin (Guardian) — the three existing seeded defaults (`airi-card.ts`).
    - Anime archetype cards (Tsundere, Kuudere, Yandere, etc.) sourced from `assets/animadex-catalog.json`.
  - **Tier 2 (Community Card Interceptor Hub & SillyTavern Interceptor Wizard)**:
    - Opens a webview side-sheet for community providers (JannyAI, Chub AI, JanitorAI, Risu Realm, DataCat).
    - Intercepts Chromium `onDidDownload` image download events when users click to download a SillyTavern PNG/JSON card.
    - Reads PNG tEXt / JSON metadata, extracts character fields, and runs a templating wizard replacing `{{user}}` placeholders with Step 3's User Profile!
  - **Tier 3 (AI Guided Creator Wizard)**:
    - Displayed as a **Feature Preview / "Coming Soon" placeholder card** for now so it remains visible without getting bogged down in its complex 4-step synthesis gauntlet (`guided.vue`).

---

### Step 5: Physical Vessel (Pure 3D/2D Avatar Selection)
- **Built-in Portals**: Hiyori (2D Live2D — seeded as Free **and** Pro preset variants), AvatarSample_A (3D VRM), AvatarSample_B (3D VRM) — 4 preset entries total in `display-models.ts`.
- **Ever-Present Dropzone**: Custom model uploader (`.vrm`, `.model3.json`, `.zip`) remains fixed.
- **Explore Link Wall Swap**: Tapping `[ 🌐 Find Free Bodies ]` swaps starter cards for the full AIRI Explore Link Wall (Steam Workshop, Booth, VRoid Hub, Eikanya Archive, SillyTavern Live2D Portal, itch.io, Sketchfab, etc.).

---

### Step 6: Contextual Speech (Her Voice Studio Setup)
- **Section A — Visual Provider Hierarchy (Local Hero Cards vs Remote Cloud Grid)**:
  - **3x Prominent Local Hero Cards (Top Row)**:
    - **Kokoro Local WebGPU**: Badges `[🇺🇸 EN]` `[🇯🇵 JP]` `[🇨🇳 ZH]` `[🇪🇸 ES]` `[🇫🇷 FR]` — High-performance local neural TTS.
    - **Pocket-TTS Local**: Badges `[🇺🇸 EN]` `[🇫🇷 FR]` `[🇪🇸 ES]` `[🇩🇪 DE]` `[🇵🇹 PT]` `[🇮🇹 IT]` — Low-latency 0.1B CPU engine with voice cloning.
    - **Moss-Nano Local**: Badges `[🇺🇸 EN]` `[🇨🇳 ZH]` — Fast low-resource local voice.
  - **Remote Cloud Provider Mini-Card Grid (Second Row)**:
    - Compact mini cards for ElevenLabs, OpenAI Audio, Deepgram Aura, Azure Speech, Fish Speech.
- **Section B — Model Selection & Provisioning Panel**:
  - **Model Dropdown**: Dynamically populated based on active provider (e.g. Kokoro `v0.19`/`v1.0`; ElevenLabs `eleven_multilingual_v2`; OpenAI `tts-1`).
  - **Local Provisioning Branch**: Displays **`[ Activate & Download Weights ]`** action button with a real-time weight loading progress bar.
  - **Remote Provisioning Branch**: Displays **API Key password input** with inline 👁️ eye icon show/hide toggle + ↗ quick console button leveraging `consoleUrl` (opens key settings page directly in a new browser window).
- **Section C — Unified Voice Selector & Audio Tuning Controls**:
  - **Voice Selector Dropdown + `[ 🔄 Load Voices ]`**: Calls `getVoices()` for the active provider to fetch or refresh live voice presets.
  - **Speed & Pitch Sliders**: Constrained to a tight, high-quality tuning range of **`0.75x` to `1.5x`** (step `0.05`, default `1.0x`) to prevent severe audio distortion.
- **Section D — Live Audio Preview Playground**:
  - **Dynamic Sample Text Input**: Pre-filled with Step 3 User Name and Step 4 Persona Name: *"Hello {userName}! I'm {personaName}. Everything is ready — how do I sound?"*
  - **`[ ▶ Play Preview ]` Button**: Synthesizes speech live using the active engine, model, voice, pitch, and speed, playing the audio back live.
- **Internal Architecture & Audio Studio Proxy Mapping**:
  - Leverages AIRI's internal Audio Studio proxy framework (`AutoVoiceConfigModal.vue` / `speechStore`).
  - `draftStore.state.speech` stores a **3-part tuple**: `providerId: 'virtual-audio-studio'`, `modelId: 'virtual'`, `voiceId: voice_profile_{personaName}_onboarding`.
  - Under the hood, this compiles into a temporary/final `VoiceProfile` containing the real `baseProvider`, `baseModel`, `baseVoice`, and `effects: { pitch, rate, volume }`.

### Step 7: Stage Calibration & Victory Launch
- **Zero Download Waiting**: Every local engine was already cached and verified on steps 1, 2, 5, and 6.
- **Summary Badges**: Green status indicators for Consciousness, Hearing, Speech, Avatar, and Soul.
- **Live Greeting Trial**: [Character Name] speaks an instant live greeting using the configured model and voice!
- **Instant Entry**: Tapping `[ 🚀 Enter AIRI Stage ]` opens AIRI immediately.

---

## 5. Implementation Status & Active Architecture

- **Canonical Implementation**: V2 onboarding is the single active onboarding implementation across all platforms. Legacy V1 files have been completely removed.
- **Modal Mounting**: `OnboardingDialog` (`packages/stage-ui/src/components/scenarios/dialogs/onboarding/onboarding-dialog.vue`) directly mounts `OnboardingV2` within desktop `DialogRoot` and mobile `DrawerRoot`.
- **State Isolation**: Transient state is isolated in `useOnboardingV2Draft` (`onboarding/v2-draft`), guaranteeing that cancelling or navigating back never leaves orphaned or corrupted cards in IndexedDB.

---

## 6. Codebase Reference Table

| Step | Vue Component Path | Pinia Store Ref | Key Constants / Services |
|---|---|---|---|
| **0** | [`v2/steps/step-0-welcome.vue`](packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/steps/step-0-welcome.vue) | `useOnboardingStore` | `isWebGPUSupported()` |
| **0.5**| [`step-start-choice.vue`](packages/stage-ui/src/components/scenarios/dialogs/onboarding/step-start-choice.vue) | `useOnboardingStore` | `onSelectPath('new' \| 'returning')`, Cloudflare OAuth PKCE |
| **1** | [`v2/steps/step-1-hearing.vue`](packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/steps/step-1-hearing.vue) | `useHearingStore` | `WHISPER_MODELS`, `useAudioContext` |
| **2** | [`v2/steps/step-2-consciousness.vue`](packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/steps/step-2-consciousness.vue) | `useConsciousnessStore` / `useProvidersStore` | `WEB_LLM_MODELS`, `getWebLlmAdapter()` |
| **3** | [`v2/steps/step-3-user-profile.vue`](packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/steps/step-3-user-profile.vue) | `useSettingsUserProfile` | `name`, `description`, `prompt` |
| **4** | [`v2/steps/step-4-persona.vue`](packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/steps/step-4-persona.vue) | `useAiriCardStore` | `STARTER_CHARACTERS`, `getStarterCharacter()` |
| **5** | [`v2/steps/step-5-vessel.vue`](packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/steps/step-5-vessel.vue) | `useDisplayModelsStore` | `displayModelsStore.displayModels` |
| **6** | [`v2/steps/step-6-speech.vue`](packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/steps/step-6-speech.vue) | `useSpeechStore` | `kokoro-local`, `pocket-tts-local`, `moss-nano-local` |
| **7** | [`v2/steps/step-7-calibration.vue`](packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/steps/step-7-calibration.vue) | `useOnboardingStore` / `useAiriCardStore` | Atomic card synthesis & launch |

## Relevant Skills

- [[airi-onboarding-v2]]
