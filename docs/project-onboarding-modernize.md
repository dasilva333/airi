# Proposal & Implementation Blueprint: AIRI Onboarding Modernization

## 1. Overview & Rationale

The original AIRI setup experience relied on a choice between an "Easy Mode" (which still required registering on external cloud platforms, fetching API keys for Deepgram + Qwen, and pasting them into the app) and a technical "Advanced Mode" provider picker.

Since that initial design was drafted, **AIRI's local ecosystem has matured dramatically**:
- **Built-in Local Consciousness (LLMs)**: High-performance in-browser WebGPU inference via **WebLLM** (Qwen 3.5 0.8B/4B, Gemma 3 1B/4B, Llama 3.2 1B/3B, Ministral) and **Web-RWKV**.
- **Built-in Local Speech (TTS)**: Multiple out-of-the-box local synthesis engines (**Kokoro-WebGPU** supporting English, Japanese, Mandarin, Spanish, French, Italian, Hindi, and **Sherpa-ONNX**), delivering instant voice output without external credentials.
- **Built-in Local Hearing (STT)**: In-browser speech recognition (**Whisper-WebGPU** / **Sherpa-ONNX**) enabling fully offline, zero-telemetry listening capabilities.

This modernized onboarding architecture shifts AIRI to a **Zero-Friction, Local-First Experience**. Users can launch their AI companion within seconds without leaving the browser or typing a single API key, while still preserving full access to advanced cloud providers through a unified, elegant visual hierarchy.

---

## 2. Core Design Principles

1. **Local-First Defaults with Instant Gratification**: Every "Sense" page defaults to 1-click zero-config local models powered by WebGPU/ONNX. Users are functional out-of-the-box.
2. **Unified "Hero Choice + Custom Accordion" Layout**: Each step displays prominent, wide "Recommended Local / Free" hero cards at the top. Below the hero cards sits a clean, collapsible or structured provider directory for power users who want custom API keys or cloud models.
3. **Decoupled Visual Form vs. Personality Mounting**: Physical avatar selection (3D VRM or 2D Live2D models) is separated from personality assignment (system prompts, greetings, voice parameters, character cards). This allows users to mix and match any visual form with any soul or create custom companions seamlessly.
4. **Universal Landing with Instant Restore Shortcut**: Everyone lands on a warm, unifying Welcome page featuring an encouraging companion speech bubble to eliminate setup anxiety, with a clear secondary button for returning users to restore from backup or account sync without wading through steps.

---

### 3. The Modernized "Logical & Guided" Step Sequence

```text
Step 0: Welcome Landing (Warm Companion Introduction)
  ├── Ref: `step-welcome-triage.vue`
  └── Primary: "Let's Get Started" → Begins Step 0.5 Triage
        │
Step 0.5: Path Triage
  ├── Ref: `packages/stage-ui/src/components/scenarios/dialogs/onboarding/step-start-choice.vue`
  ├── Option A: "Set Up as New User" → Begins Modernized New User Flow (Step 1)
  └── Option B: "Returning User" → Unchanged Restore Flow (Google Cloud OAuth / S3 Sync)
        │
Step 1: Hearing & Mic Playground (STT / Ear)
  ├── Ref: `step-hearing.vue` & `stores/modules/hearing.ts`
  ├── Hardware Controls: Microphone Selector & Live Audio Volume Wave Meter
  ├── Hero Provider Cards: [🎙️ Built-in Whisper WebGPU (Local)] | [⚡ Sherpa-ONNX Local]
  └── Integrated Playground: Live model download progress bar + instant STT transcription test
        │
Step 2: Consciousness (Mind / LLM Setup)
  ├── Ref: `step-consciousness.vue` & `stores/modules/consciousness.ts`
  ├── 💡 Setup LLM FIRST so AI Character Creators & Synthesizers have an active brain!
  ├── Speech Bubble ("Give AIRI a brain! WebLLM is pre-configured to run 100% locally.")
  ├── Hero Cards: [⚡ Built-in WebLLM (Qwen / Gemma / Llama)] | [🌐 OpenRouter Free Tier]
  └── Preserved Grid: `step-provider-selection.vue` (OpenAI, Anthropic, Gemini, Groq, Ollama, LM Studio)
        │
Step 3: User Profile & Identity (User Persona Setup)
  ├── Ref: `packages/stage-pages/src/pages/settings/system/user-profile.vue` & `stores/settings/user-profile.ts`
  ├── 💡 Dedicated step BEFORE Persona so AI Card Synthesizers know who the user is!
  ├── Speech Bubble ("Tell her who you are! What should she call you? She's not a mind reader, right?")
  └── Fields: User Display Name (`name`), Narrative Description (`description`), Visual Prompt Tags (`prompt`)
        │
Step 4: Soul & Persona (Personality Selection & AI Card Synthesizer)
  ├── Ref: `step-persona.vue` & `stores/modules/airi-card.ts`
  ├── 💬 Speech Bubble: "Choose your companion's personality! This layer isn't permanent."
  ├── 3-Tier Persona Selection:
  │    ├── Tier 1: 1-Click Starter Cards (ReLU, Dr. Aria, Lupin, Anime Archetypes)
  │    ├── Tier 2: Community Card Hub & Interceptor (JannyAI, Chub AI, JanitorAI, Risu Realm, DataCat)
  │    └── Tier 3: AI Guided Creator Wizard (`guided.vue` AnimaDex builder using Step 2 LLM + Step 3 Profile!)
        │
Step 5: Physical Vessel (3D VRM & 2D Live2D Avatar Selection)
  ├── Ref: `step-physical-vessel.vue`, `stores/display-models.ts` & `settings/models/index.vue`
  ├── 3D/2D Avatar Selection: Hiyori (2D Live2D), AvatarSample_A/B (3D VRM)
  ├── Custom Dropzone: Drag-and-drop `.vrm`, `.model3.json`, or `.zip` assets
  └── Viewport Swap: Tapping `[ 🌐 Find Free Bodies ]` swaps cards for external Explore Link Wall
        │
Step 6: Speech (Contextual Voice / TTS Setup)
  ├── Ref: `step-speech.vue` & `stores/modules/speech.ts`
  ├── 🎯 Smart Contextual Matching: Auto-highlights voices matching Character Language & Archetype

## 4. Detailed Step Breakdown

### Step 0: Welcome Landing (Warm Companion Introduction)

- **Universal Entry**: Everyone lands on Step 0. Branded welcome with the reassuring companion speech bubble (*"Don't worry, it's easier than it looks! We've pre-configured everything to run 100% locally..."*).
- **Action**: Clicking `[ Let's Get Started → ]` opens Step 0.5 Path Triage.

---

### Step 0.5: Path Triage (Preserved Ref: `step-start-choice.vue`)

- **Preserved Existing Screen**: Keeps AIRI's existing [`step-start-choice.vue`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/components/scenarios/dialogs/onboarding/step-start-choice.vue) choice card interface.
- **Option A: "Set Up as New User"**:
  - Enters our modernized 6-step New User setup (Step 1 Hearing Playground → Step 2 Mind → Step 3 Persona & Profile → Step 4 Avatar → Step 5 Voice → Step 6 Calibration).
- **Option B: "Returning User"**:
  - **Zero Changes**: Unchanged existing restore pipeline. Takes the user directly to Google Account OAuth restore or S3 storage database recovery.

---

### Step 1: Hearing & Mic Playground (Ear / STT Setup)

- **Why Right After Welcome?**: Speech recognition has zero dependencies on character language or persona! Combining the microphone hardware test with the STT provider picker creates an immediate, interactive playground right after the welcome page.
- **Companion Speech Bubble**:
  > *"Test your microphone here! Scream a little to watch the wave react. If it doesn't work, make sure your browser permissions are enabled!"*
- **All-in-One Playground UI**:
  1. **Hardware Controls**: Microphone device selector dropdown & live audio volume wave meter.
  2. **Provider Selector**: Wide Hero Cards for **Built-in Whisper WebGPU** (Local) and **Sherpa-ONNX** (Local) + Cloud list (Groq Whisper, OpenAI Whisper, Deepgram).
  3. **Live Download Progress & Test Playground**:
     - Selecting a local engine (e.g. Whisper-WebGPU) initiates a sleek in-card download progress bar showing WASM & weight progress in real time.
     - A live test box displays real-time speech-to-text transcriptions as the user speaks into their mic (*"I hear you! You said: Testing 1 2 3"*).

### Step 2: Consciousness (Mind / LLM Setup)

- **Retirement of Legacy "Easy vs. Advanced Setup" Fork**:
  - The old artificial fork screen (*"How would you like to start? Easy Setup vs Advanced Setup"*) is **retired**. Users no longer face a confusing technical barrier before seeing options.
- **Top Section: Recommended Local Engine & Live Download Playground**:
  - **WebLLM** *(Primary Recommended Local Engine)*:
    - Features a clean model tier dropdown (Qwen 3.5 0.8B / 4B, Gemma 3 1B, Llama 3.2 1B).
    - **Interactive Download Verification**: Selecting a model triggers model initialization **right on the page**. A sleek progress bar displays WebWorker RPC shard downloading and WebGPU compilation in real time (*"Downloading weight shards: 45% (1.2 GB / 2.7 GB)"*).
    - *Goal*: Ensures the model is fully cached and verified before moving forward so the user is never "thrown to the wolves" later during live conversation.
  - **Web-RWKV**: Alternative local RNN engine.
- **Bottom Section: Preserved AIRI Provider Selection Grid** (Ref: `step-provider-selection.vue`):
  - Directly embeds AIRI's existing `step-provider-selection.vue` provider grid below the WebLLM hero section:
    - **Deployment Filters**: `All` | `Cloud` | `Local`
    - **Pricing Filters**: `All` | `Free` | `Paid`
    - **Provider Cards**: OpenAI, Anthropic Claude, Google Gemini, Groq, NVIDIA NIM, OpenRouter, Ollama, LM Studio, Custom OpenAI-Compatible.

### Step 3: Soul & Persona (Pure Personality & User Profile Setup)

- **Decoupled Architecture (Total Mix & Match Freedom)**:
  - Step 3 is **purely for the Persona / Soul (System Prompt & Character Lore)**. Visual 3D/2D body selection is completely decoupled and handled separately on Step 4. Users can freely pair any personality card with any visual body!
- **Sequential 2-Part Speech Bubbles**:
  - **Bubble Part 1 (Companion Personality)**:
    > *"Well, this is where you choose your companion's personality! This layer isn't permanent — it just changes how she expresses herself and shows emotions."*
  - **Bubble Part 2 (User Identity - Auto-transitions on focus/scroll)**:
    > *"And of course, tell her who you are! What should she call you? After all, she's not a mind reader, right?"*
- **3 Tiers of Personality Selection (Pure Persona / System Prompt)**:
  - **Tier 1: 1-Click Starter Personas & Anime Presets** (Ref: `step-character-selection.vue`):
    - Built-in personas: **ReLU** (Empathetic Companion), **Dr. Aria** (Analytical Scientist), **Lupin** (Fierce Guardian).
    - Archetype presets: Tsundere, Kuudere, Yandere, Dandere, Deredere cards.
  - **Tier 2: Community Card Hub & Interceptor** (Ref: `airi-card/index.vue` `cardSourceLinks` + `CardImportWizard.vue`):
    - Integrated Card Browser & automatic download interceptor for JannyAI, Chub AI, JanitorAI, Risu Realm, DataCat.
  - **Tier 3: AI-Guided Character Creator Wizard** (Ref: `airi-card/guided.vue` & `proposal-animadex-wizard.md`):
    - AnimaDex Multi-Character World Synthesizer (uses Step 2 active LLM to generate custom lore and prompts).
- **3C. User Profile Inputs**:
  - Your Name / Nickname, Gender, Age, Hobbies/Interests, How the companion should address you.

### Step 4: Physical Vessel (Pure 3D VRM & 2D Live2D Model Selection)

- **Decoupled Architecture (Pure Physical Body Selection)**:
  - Step 4 is **purely for the Physical Avatar Body**. Users pick or upload their companion's visual form to mount the Step 3 persona onto.
- **Ever-Present Element: Custom Model Drag & Drop Zone**:
  - The custom model uploader (`.vrm`, `.model3.json`, `.zip`) is an **ever-present anchor element** on Step 4. Whether viewing the 3 built-in bodies or exploring external repositories, the upload box remains fixed so users can drop a model file at any moment.
- **Two Toggleable Sub-Views**:
  - **View A: Built-in Starter Bodies (Default Hero View)**:
    - Displays visual cards for the 3 pre-installed avatar bodies:
      1. **Hiyori** (Live2D Anime 2D Model)
      2. **AvatarSample_A** (3D VRM Model)
      3. **AvatarSample_B** (3D VRM Model)
    - Includes a prominent action button: `[ 🌐 Find Free Bodies / Explore Repositories ]`.
  - **View B: Inline External Link Wall (Explore Mode)**:
    - Clicking `[ 🌐 Find Free Bodies ]` swaps out the 3 starter body cards in favor of the **Full AIRI Model Explore Link Wall** (ref: `/settings/models?action=explore`):
      - 🎮 **Steam Workshop** (Live2D / Spine)
      - 🎨 **Booth & Booth VRMA** (VRM / Live2D / MMD)
      - 🌐 **VRoid Hub** (VRM)
      - 📦 **Eikanya Live2D Archive** (4,900+ Live2D models)
      - 📜 **SillyTavern Live2D Portal** (270+ Live2D models)
      - 🕹️ **itch.io, Sketchfab, VGen, Gumroad, Ko-fi, VChaVCha, NicoNico 3D, bear0830**
    - Includes a back toggle button: `[ ← Back to Starter Bodies ]`.
- **Live Viewport Preview Canvas**:
  - Displays a real-time 3D VRM or 2D Live2D preview of the currently selected or uploaded model with basic idle animation.

---

### Step 5: Speech (Contextual Voice / TTS Setup)

- **Why After Model & Persona?**: "Match the voice to the body & soul instead of matching the body to the voice!" Seeing the 3D/2D visual avatar on Step 4 combined with the personality chosen on Step 3 gives total clarity on what voice frequency, pitch, and language preset fits best.
- **Companion Speech Bubble**:
  > *"Choose how your companion will sound! Pick one of our built-in local voices to get started instantly — you can tune pitch, speed, and connect 10+ cloud voice providers inside settings later. Pinky promise!"*
- **UI Layout: 3 Featured Hero Cards + Inline Cloud Provider List**:
  - **Top Section (3 Featured Local Hero Cards)**:
    1. **Kokoro WebGPU** *(Recommended)*: High-performance local neural TTS. Features language badge auto-matched to character (🇺🇸 / 🇪🇸 / 🇯🇵 / 🇨🇳 / 🇫🇷 / 🇮🇹 / 🇮🇳) + quick voice archetype selector (e.g., *sassy*, *calm*, *energetic*).
    2. **Sherpa-ONNX Local Voice**: Ultra-lightweight local ONNX voice synthesis.
    3. **Virtual Audio Studio**: Pre-bundled local voice profiles.
  - **Bottom Section (Custom Cloud Provider Directory)**:
    - Clean list of cloud providers: ElevenLabs, OpenAI Audio, Deepgram Aura, Azure Speech, Fish Speech.
    - **Inline Configuration Expansion**: Selecting any cloud provider from the list opens its API Key and Voice ID configuration fields **inline right on the page** without taking the user away.

---

### Step 6: Stage Calibration & Victory Launch

- **AIRI vs. NekoGPT Architectural Comparison**:
  - **NekoGPT's Flaw**: NekoGPT defers all component downloads (Python, Whisper, Live2D models) to a massive batch download screen at the very end (*"NekoGPT will prepare local components now"*). If a download fails or errors at 99%, the user is stranded after filling out the entire wizard.
  - **AIRI's Superior In-Context Preparation**: In AIRI, every local component is prepared, cached, and verified **in-context on its respective step**:
    - **Step 1 (Ear)**: Whisper WebGPU model shards are downloaded and tested live on Step 1.
    - **Step 2 (Mind)**: WebLLM weight shards are fetched and compiled on WebGPU on Step 2.
    - **Step 4 (Form)**: 3D VRM / 2D Live2D assets are loaded and rendered in the viewport on Step 4.
- **The Step 6 Victory Review Experience**:
  - Because all components were already prepared and cached step-by-step, **Step 6 requires ZERO download waiting time**!
  - **Summary Badges Card**: Displays crisp green status badges for **Consciousness**, **Hearing**, **Speech**, **Avatar Model**, and **Personality Soul**.
  - **Companion Reassurance Bubble**:
    > *"Everything is 100% prepared and ready to go! Look at you, setup champion. Let me give you a quick greeting before we step onto the stage!"*
  - **Live Interactive Trial Chat Box**: [Character Name] speaks an instant live greeting using your configured voice, model, and personality right on the calibration card (*"Hello! I'm [Character Name]. I'm ready whenever you are!"*).
  - **Instant Launch Action**: `[ 🚀 Enter AIRI Stage ]` — opens the main application instantly with zero additional load bars!

---

## 7. Implementation & Migration Strategy: Side-by-Side Evolution (V2 Isolation)

To ensure zero disruption to community users pulling `main` during this multi-day refactor, the modernization will be implemented using a **Side-by-Side Evolutionary Strategy**:

### 1. Isolated V2 Directory Structure
All new modernized step components will be created under a clean, isolated directory:
`packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/`

### 2. Experimental Access via System Tray
- The Electron System Tray item **"Show Setup Wizard"** and query string `/settings?action=onboarding-v2` will trigger the V2 wizard directly.
- Developers and pair-programming agents can instantly launch, test, and iterate on V2 steps in live runtime without modifying the default startup behavior.

### 3. Step-by-Step Incremental Build & Commit Plan
- **Step 1 (Ear Playground)**: Build & verify mic wave meter + Whisper WebGPU download progress bar.
- **Step 2 (Mind LLM)**: Build & verify WebLLM local hero cards + model shard download progress + embedded `step-provider-selection.vue` grid.
- **Step 3 (User Profile)**: Build & verify dedicated user profile inputs (`name`, `description`, `prompt`).
- **Step 4 (Soul & Persona)**: Build & verify 3-tier persona picker + sequential speech bubbles + Tier 3 AnimaDex creator integration.
- **Step 5 (Physical Vessel)**: Build & verify 3D/2D avatar picker + ever-present dropzone + inline Find Free Bodies Explore Link Wall toggle.
- **Step 6 (Speech TTS)**: Build & verify 3 local TTS hero cards + contextual language matching + inline cloud provider list.
- **Step 7 (Calibration)**: Build & verify victory status badges + live chat greeting trial + instant stage launch.

### 4. The 1-Line "Flip & Sweep" Launch
Once all 7 steps are fully built, polished, and verified clean:
1. **The Flip**: Switch `needsOnboarding` in `onboardingStore` to launch V2 by default.
2. **The Sweep**: Safely remove legacy V1 step files in a single cleanup commit.

---

## 6. Next Steps & Iterative Refinement

- **Pass 1 (Current)**: Conceptual architecture, zero-friction local-first layout, and decoupled avatar/soul model.
- **Pass 2**: Technical state mapping (Pinia store integrations for `useOnboardingStore`, `useProvidersStore`, `useDisplayModelsStore`, and `useAiriCardStore`).
- **Pass 3**: UI mockups & UnoCSS visual tokens for hero cards, glassmorphism containers, and responsive mobile layouts.
