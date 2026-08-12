# AIRI Modernized Onboarding Specification (Zero-Friction & Local-First)

---

## 1. Overview & Rationale

The original AIRI setup experience relied on a choice between an "Easy Mode" (which required registering on external cloud platforms and pasting API keys) and an "Advanced Mode" provider picker.

Since that initial design was drafted, **AIRI's local ecosystem has matured dramatically**:
- **Built-in Local Consciousness (LLMs)**: High-performance in-browser WebGPU inference via **WebLLM** (Qwen 3.5 0.8B/4B, Gemma 3 1B, Ministral 3B, Phi-4-mini) and **Web-RWKV**.
- **Built-in Local Speech (TTS)**: Out-of-the-box local synthesis engines (**Kokoro-WebGPU**, **Pocket-TTS**, and **Moss-Nano**), delivering instant neural voice output without external credentials or API keys.
- **Built-in Local Hearing (STT)**: In-browser speech recognition via **Whisper-WebGPU** (featuring `whisper-large-v3-turbo` and `whisper-small`) enabling fully offline, zero-telemetry listening, alongside the zero-download browser-native **Web Speech API** as a fallback (recognition backend and privacy characteristics vary by browser/OS).

This modernized onboarding architecture shifts AIRI to a **Zero-Friction, Local-First Experience**. Users can launch their AI companion within seconds without leaving the browser or typing a single API key, while still preserving full access to advanced cloud providers through a unified, elegant visual hierarchy.

---

## 2. Core Design Principles

1. **In-Context Component Preparation**: No late 99% download screens (avoiding NekoGPT's batch failure flaw). Selecting a local engine initializes its WebWorker, WASM, or WebGPU weights immediately on that step with a live progress bar and test playground.
2. **Decoupled Soul & Form**: Personality/Lore (Step 4) and Physical Avatar Body (Step 5) are completely decoupled, granting total mix-and-match freedom.
3. **Hardware Capability Transparency**: Every local model card clearly displays VRAM requirements, model size, and supported languages so users make informed choices based on their hardware.
4. **Early Hardware & WebGPU Detection**: Detects `isWebGPUSupported()` globally on startup to guide the user toward WebGPU vs. WASM/Browser-native options.
5. **No Forced Fallbacks**: If a local model fails or isn't supported, users can easily pick another provider or skip — no silent redirects.
6. **Transient Composition State & Deferred Card Assembly**: Onboarding V2 collects choices (STT, LLM, User Profile, Persona, Vessel, TTS) in a clean, transient onboarding composition draft store. It does **NOT** dirty-mutate existing IndexedDB character cards as a step-by-step scratchpad. On Step 7 (Calibration / Finale), the assembled choices are cleanly compiled into the target `AiriCard` and `AiriExtension` payload.

---

## 3. The Modernized 7-Step Sequence

```text
Step 0: Welcome Landing (Warm Companion Introduction)
  ├── Ref: `step-welcome-triage.vue` & `useOnboardingStore`
  └── Primary: "Let's Get Started" → Opens Step 0.5 Path Triage
        │
Step 0.5: Path Triage (Preserved Choice Screen)
  ├── Ref: `packages/stage-ui/src/components/scenarios/dialogs/onboarding/step-start-choice.vue`
  ├── Option A: "Set Up as New User" → Begins Step 1 (New User Setup)
  └── Option B: "Returning User" → Unchanged Existing Restore Flow (Google Cloud OAuth / S3 Sync)
        │
Step 1: Hearing & Mic Playground (STT / Ear Setup)
  ├── Ref: `v2/step-hearing.vue` & `useHearingStore`
  ├── Hardware: Microphone Selector + Live Audio Volume Meter
  ├── Local Hero Cards:
  │    ├── 🎙️ Whisper WebGPU (Large-v3-turbo ~800MB | Small ~480MB — fully offline)
  │    └── 🌐 Browser Web Speech API (Zero Download — browser-native, no model weights; backend varies by browser)
  └── Integrated Playground: Live download progress bar + instant real-time speech transcription test
        │
Step 2: Consciousness (Mind / LLM Setup)
  ├── Ref: `v2/step-consciousness.vue`, `useConsciousnessStore` & `constants.ts`
  ├── 💡 Setup LLM FIRST so AI Character Creators & Synthesizers have an active brain!
  ├── Local WebLLM Hero Cards (VRAM from `vramMB` in `libs/inference/constants.ts`):
  │    ├── ⭐ Qwen 3.5 4B (Recommended - ~3.9 GB VRAM - Most capable for RP/Chat)
  │    ├── ⚡ Qwen 3.5 0.8B (Fast Distill - ~1.6 GB VRAM)
  │    ├── 🌐 Gemma 3 1B (Lowest VRAM - ~0.7 GB - mobile/integrated GPUs)
  │    ├── 🔬 Ministral 3B (High Reasoning - ~2.9 GB VRAM)
  │    └── 🧠 Phi-4 Mini (Microsoft 3.8B - ~3.4 GB VRAM)
  └── Preserved Provider Grid: `step-provider-selection.vue` (OpenAI, Anthropic, Gemini, Groq, Ollama, LM Studio)
        │
Step 3: User Profile & Identity Setup
  ├── Ref: `v2/step-user-profile.vue`, `user-profile.vue` & `useSettingsUserProfile`
  ├── 💡 Dedicated step BEFORE Persona so AI Card Synthesizers know who the user is!
  ├── Speech Bubble ("Tell her who you are! What should she call you? She's not a mind reader, right?")
  └── Fields: User Display Name (`name`), Narrative Description (`description`), Visual Prompt Tags (`prompt`)
        │
Step 4: Soul & Persona (Personality Selection & Card Builder)
  ├── Ref: `v2/step-persona.vue` & `useAiriCardStore`
  ├── 💬 Speech Bubble: "Choose your companion's personality! This layer isn't permanent."
  ├── 3-Tier Persona Selection:
  │    ├── Tier 1: 1-Click Starter Cards (ReLU, Dr. Aria, Lupin, Anime Archetypes)
  │    ├── Tier 2: Community Card Hub & Interceptor (JannyAI, Chub AI, JanitorAI, Risu Realm, DataCat)
  │    └── Tier 3: AI Guided Creator Wizard (`guided.vue` AnimaDex builder using Step 2 LLM + Step 3 Profile!)
        │
Step 5: Physical Vessel (3D VRM & 2D Live2D Avatar Selection)
  ├── Ref: `v2/step-physical-vessel.vue`, `models/index.vue` & `useDisplayModelsStore`
  ├── Built-in Avatar Portals: Hiyori (2D Live2D), AvatarSample_A (3D VRM), AvatarSample_B (3D VRM)
  ├── Custom Model Dropzone: Drag-and-drop `.vrm`, `.model3.json`, or `.zip` assets
  └── Viewport Swap: Tapping `[ 🌐 Find Free Bodies ]` swaps starter cards for external Explore Link Wall
        │
Step 6: Contextual Speech (Her Voice Studio Setup)
  ├── Ref: `v2/step-speech.vue`, `useSpeechStore` & `AutoVoiceConfigModal.vue`
  ├── Section A (Provider Hierarchy):
  │    ├── 3x Prominent Local Hero Cards: Kokoro WebGPU, Pocket-TTS (CPU voice cloning), Moss-Nano (Ultra-Fast EN/ZH)
  │    └── Remote Cloud Mini-Card Grid: ElevenLabs, OpenAI Audio, Deepgram Aura, Azure Speech, Fish Speech
  ├── Section B (Model Selection & Provisioning):
  │    ├── Model Dropdown (populated per active provider)
  │    ├── Local: [ Activate & Download ] button + real-time WASM/worker progress bar
  │    └── Remote: API Key password input + inline 👁️ eye icon show/hide toggle + ↗ quick console URL link
  ├── Section C (Voice Studio & Tone Tuning Controls):
  │    ├── Voice Selector Dropdown + [ 🔄 Load Voices ] button (invokes provider.getVoices())
  │    └── Speed & Pitch Sliders: Constrained range 0.75x to 1.5x (step 0.05) to prevent distortion
  ├── Section D (Live Audio Preview Playground):
  │    ├── Dynamic sample text prompt: "Hello {userName}! I'm {personaName}. Everything is ready — how do I sound?"
  │    └── [ ▶ Play Preview ] button: Synthesizes live audio via Audio Studio proxy & plays in browser
  └── Internal Tuple & Audio Studio Proxy: `draft.speech` represented as 3-part tuple (`providerId`, `modelId`, `voiceId`) mapping to `virtual-audio-studio` proxy provider & generated `VoiceProfile`
        │
Step 7: Stage Calibration & Victory Launch
  ├── Ref: `v2/step-calibration.vue` & `useOnboardingStore`
  └── Victory Badges Card + Live interactive chat preview with [Character Name] → Instant AIRI Stage Launch!
```

---

## 4. Detailed Step Breakdown

### Step 0: Welcome Landing & Triage
- **Hardware Check**: Runs `isWebGPUSupported()` early and stores flag in onboarding state.
- **Companion Bubble**: *"Don't worry, it's easier than it looks! We've pre-configured everything to run locally on your machine."*
- **Triage (`step-start-choice.vue`)**:
  - `Set Up as New User` → Begins Step 1.
  - `Returning User` → Routes into existing Google Cloud OAuth / S3 sync restore pipeline.

---

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
  - Sourced directly from `WEB_LLM_MODELS` in [`libs/inference/constants.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/libs/inference/constants.ts):
    - `Qwen 3.5 4B` — `[⭐ RECOMMENDED]` — VRAM: ~3.9 GB (3868 MB) — Outstanding chat, instruction, & roleplay.
    - `Qwen 3.5 0.8B` — VRAM: ~1.6 GB (1629 MB) — Fast distill for lightweight systems.
    - `Gemma 3 1B` — VRAM: ~0.7 GB (711 MB) — Lowest VRAM; integrated GPUs & mobile.
    - `Ministral 3B` — VRAM: ~2.9 GB (2864 MB) — High reasoning capability.
    - `Phi-4 Mini` — VRAM: ~3.4 GB (3438 MB) — Compact Microsoft 3.8B model.
- **In-Context WebLLM Weight Download**:
  - Bridge helper `ensureWebLlmLoaded(modelId, onProgress, signal)` in `v2/webllm-loader.ts` delegates to `getWebLlmAdapter().loadModel()`, streaming real `ProgressPayload` percent/bytes to drive the progress bar on Step 2.
- **Hardware & WebGPU Gating**:
  - If `isWebGPUSupported()` is `false`, displays an amber callout ("Local AI brain needs WebGPU") and steers users to the cloud provider grid.
- **Bottom Section - Reused Provider Grid Primitive**:
  - Reuses the shared provider grid primitive (`stt-provider-picker.vue` / `ProviderPickerGrid`) pointed at `allChatProvidersMetadata`.
  - Selecting cloud cards (OpenAI, Anthropic, Gemini, Groq, NVIDIA NIM, OpenRouter, Ollama, LM Studio) expands `step-provider-configuration` inline for API key entry.
- **Bidirectional Store & Character-Card Sync**:
  - Selecting a provider/model updates `consciousnessStore.activeProvider` & `consciousnessStore.activeModel` **AND** patches `activeCard.extensions.airi.modules.consciousness = { provider, model }`. This ensures Step 4 Persona & Tier 3 AnimaDex Wizard borrow the configured brain.
- **Verification Gate & Navigation**:
  - WebLLM: Verified when `loadModel()` resolves and inference status flips to `ready`.
  - Cloud LLMs: Verified when provider is configured and a model is selected.
  - Orchestrator Gate (`provide`/`inject` `onboardingV2Gate` contract):
    - `[ Skip Step ]`: Always enabled.
    - `[ Next > ]`: **Disabled by default** until the selected LLM engine is verified ready.
- **Future Polish Pass Note**: We will revisit Step 2 in a dedicated follow-up pass to build a lightweight ad-hoc inference validation widget so users can test live LLM output for remote cloud providers before moving on.

---

### Step 3: User Profile & Identity Setup
- **Source Ref**: [`packages/stage-pages/src/pages/settings/system/user-profile.vue`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-pages/src/pages/settings/system/user-profile.vue)
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

---

### Step 7: Stage Calibration & Victory Launch
- **Zero Download Waiting**: Every local engine was already cached and verified on steps 1, 2, 5, and 6.
- **Summary Badges**: Green status indicators for Consciousness, Hearing, Speech, Avatar, and Soul.
- **Live Greeting Trial**: [Character Name] speaks an instant live greeting using the configured model and voice!
- **Instant Entry**: Tapping `[ 🚀 Enter AIRI Stage ]` opens AIRI immediately.

---

## 5. Implementation & Migration Strategy (Side-by-Side Evolution)

1. **Isolated Directory**: All V2 step components live in `packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/`.
2. **Safe Preview Route**:
   - System Tray item **"Show Setup Wizard"** currently opens `/settings?action=onboarding` (V1, wired in `apps/stage-tamagotchi/src/main/tray/index.ts`). Implementation must add a sibling tray item and a new `action=onboarding-v2` handler in `packages/stage-pages/src/pages/settings/index.vue` for the V2 preview.
   - The existing `action=onboarding` handler calls `resetSetupState()`, which **clears the persisted `onboarding/completed` flag** — a V2 preview must not reuse it verbatim. V2 uses a separate `onboarding/v2-state` key in `localStorage` (and never calls `resetSetupState()` for preview), so testing V2 does **NOT** mutate live `onboarding/completed` flags or collide with V1's index-based `airi-onboarding-state` progress restore.
3. **The "Flip & Sweep" Launch**:
   - `needsOnboarding` in `useOnboardingStore` is a **computed boolean gate** (`!hasSkippedSetup && !hasCompletedSetup`) — it cannot select V1 vs V2 and flipping it does nothing to route versions. The actual flip is a version flag: read an `onboarding/version` localStorage flag (`'v1' | 'v2'`) at the two wizard mount points — `onboarding-dialog.vue` (stage-web `App.vue`) and the Tamagotchi dedicated onboarding window (`apps/stage-tamagotchi/src/renderer/pages/onboarding.vue`) — and render the V2 step sequence when set to `'v2'`.
   - Once all 7 V2 steps pass testing, change the flag default to `'v2'`, then delete legacy V1 step files in a clean final commit.

---

## 6. Codebase Reference Table

| Step | Vue Component Path | Pinia Store Ref | Key Constants / Services |
|---|---|---|---|
| **0** | `v2/step-welcome-triage.vue` | `useOnboardingStore` | `isWebGPUSupported()` |
| **0.5**| [`step-start-choice.vue`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/components/scenarios/dialogs/onboarding/step-start-choice.vue) | `useOnboardingStore` | `onSelectPath('new' \| 'returning')` |
| **1** | `v2/step-hearing.vue` | `useHearingStore` | `providers/whisper-local` (`whisper-large-v3-turbo`) |
| **2** | `v2/step-consciousness.vue` | `useConsciousnessStore` / `useProvidersStore` | [`constants.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/libs/inference/constants.ts) `WEB_LLM_MODELS` (`Qwen3.5-4B-q4f16_1-MLC`, `Qwen3.5-0.8B-q4f16_1-MLC`, `gemma3-1b-it-q4f16_1-MLC`, `Ministral-3-3B-Reasoning-2512-q4f16_1-MLC`, `Phi-4-mini-instruct-q4f16_1-MLC` — VRAM from `vramMB`) |
| **3** | `v2/step-user-profile.vue` | [`useSettingsUserProfile`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/settings/user-profile.ts) | [`user-profile.vue`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-pages/src/pages/settings/system/user-profile.vue) (`name`, `description`, `prompt`) |
| **4** | `v2/step-persona.vue` | `useAiriCardStore` | [`airi-card/index.vue`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-pages/src/pages/settings/airi-card/index.vue), [`guided.vue`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-pages/src/pages/settings/airi-card/guided.vue) |
| **5** | `v2/step-physical-vessel.vue` | `useDisplayModelsStore` | [`models/index.vue`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-pages/src/pages/settings/models/index.vue) (`openModelSelector('explore')`) |
| **6** | `v2/step-speech.vue` | `useSpeechStore` | `kokoro-local`, `pocket-tts-local`, `moss-nano-local` |
| **7** | `v2/step-calibration.vue` | `useOnboardingStore` | Victory summary & live chat preview |
