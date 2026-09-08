# AIRI Onboarding V3 Proposal: Intent-Driven Hero Bundles, Persona-First Flow & Unified Subsystems

> [!NOTE]
> **ARCHIVED & SUPERSEDED**: This proposal has been consolidated and unified into the canonical master specification at [`docs/project-onboarding-modernize.md`](../project-onboarding-modernize.md). It is preserved here for historical lineage and architectural reference.

---

## 1. Executive Summary & The Architectural Paradigm Shift

Previous onboarding designs faced a sharp tension:
1. **The Fixed 9–11 Step Gauntlet**: Forcing every new user through microphone testing, LLM provider selection, profile input, character selection, avatar selection, and TTS voice sliders before they ever reach the desktop stage caused cognitive fatigue (*"I just wanna play!"*).
2. **The "Advanced Setup Lab" Dilemma**: Deferring advanced features (Sensory Proactivity, Autonomous Artistry, Generative Motion, Memory Matrix) into a post-launch "second onboarding lab" created a disjointed secondary wizard that felt bolted onto the app.

**Onboarding V3 replaces both with a Unified Intent-Driven Flow**:
Users choose what they want their companion to do upfront via **4 Hero Archetype Cards**. That selection dynamically generates their tailored onboarding path. Advanced capabilities are no longer segregated into a secondary lab—they are seamlessly woven into the primary onboarding journey for users who want them, while users who just want simple text chat encounter a lightning-fast 3-screen setup.

```text
┌────────────────────────────────────────────────────────────────────────────┐
│                    Onboarding V3 Journey Topology                          │
├────────────────────────────────────────────────────────────────────────────┤
│  Step 0: Zen Welcome Landing + Language Selector                           │
│     │   - Mascot greeting, capability pills                                │
│     │   - Dual CTAs: [ Let's Get Started → ] vs [ ⚡ Quick Start (Stage) ]  │
│     ▼                                                                      │
│  Step 0.5: Intelligent Path Triage (Option B Architecture)                 │
│     ├──────────────────────────────────────┬───────────────────────────────┤
│     ▼                                      ▼                               │
│  [ 🏠 100% Offline Local ]            [ ☁️ Cloudflare Connected ]           │
│     │                                      │                               │
│     │                                      ▼                               │
│     │                                 Auth & Check Remote R2 Vault         │
│     │                                 ├────────────────────────────┐       │
│     │                                 ▼                            ▼       │
│     │                      [ Remote Cards Found ]        [ Empty Account ] │
│     │                                 │                            │       │
│     │                                 ▼                            │       │
│     │                       Selective Sync Panel                   │       │
│     │                                 ├──────────────────┐         │       │
│     │                                 ▼                  ▼         │       │
│     │                        [ 🚀 Launch Stage ]   [ + Add Comp. ] │       │
│     │                        (Use Case 4: DONE!)         │         │       │
│     │                                                    │         │       │
│     └────────────────────────────────────────────────────┴─────────┘       │
│                                       │                                    │
│                                       ▼                                    │
│  Step 1: Choose Your Experience (4 Hero Bundles + Customizer Deck)         │
│     │                                                                      │
│     ├───────────────────┬───────────────────┬───────────────────┐          │
│     ▼                   ▼                   ▼                   ▼          │
│  [Chat Only]      [Talk & Listen]     [Sentinel]           [Artistic]      │
│  (3 screens)      (5 screens)         (7 screens)          (6 screens)     │
│     │                   │                   │                   │          │
│     └───────────────────┴─────────┬─────────┴───────────────────┘          │
│                                   ▼                                        │
│             Step 2: Soul & Persona (Emotional Payoff First!)               │
│                                   │                                        │
│                                   ▼                                        │
│             Step 3: Physical Vessel (DiscoverCarousel Starters)            │
│                                   │                                        │
│                                   ▼                                        │
│             Step 4: User Profile & Identity                                │
│                                   │                                        │
│                                   ▼                                        │
│             [Dynamic Shared Modules: Brain, Voice, Sensory, Art]           │
│             (Directly powered by /settings/modules/* faculties)            │
│                                   │                                        │
│                                   ▼                                        │
│             Step Finale: Stage Calibration (Readiness Honesty)             │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. The 5 Entry Use Cases & Dual-Step Zen Triage (Option B Architecture)

### 2.1 The Architectural Root Problem in V2 Entry
In current V2 onboarding, the transition from Step 1 (`step-0-welcome.vue`) to Step 2 (`step-start-choice.vue`) suffered from two critical flaws:
1. **The "Returning User Hostage Loop"**: In [`onboarding-v2.vue`](packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/onboarding-v2.vue), selecting the "returning" Cloudflare path routed through `cloud-restore` (Selective Sync), but **then unconditionally forced the user through Hearing, Consciousness, Profile, Persona, Vessel, and Speech anyway**. Existing users who just restored their complete companion were forced to build an unwanted new starter card from scratch!
2. **Ambiguous Intent**: The initial screens failed to distinguish between a new user who wants cloud backup vs. an existing user who just wants their restored companion immediately.

### 2.2 The 5 Distilled Entry Use Cases
Onboarding V3 cleanly isolates and handles all five real-world user intents:

| # | User Intent | Primary Motivation | Onboarding Journey & Resolution |
| :--- | :--- | :--- | :--- |
| **1** | **The Explorer / Guest** | *"I don't care about anything, let me just try the app!"* | **Step 0 `[ ⚡ Quick Start ]`**: Bypasses the entire wizard. Loads the seeded `ReLU` companion with local WebGPU inference directly onto the stage. |
| **2** | **The Local-First Creator** | Wants full companion customization with 100% privacy and zero accounts. | **Step 0.5 `[ 🏠 Local Companion ]`**: Proceeds to Step 1 (Experience Picker) to build their companion entirely on-device. |
| **3** | **The Cloud-Backed Creator** | Wants to build a new companion that is automatically backed up to Cloudflare R2 from day 1. | **Step 0.5 `[ ☁️ Cloudflare ]`** $\rightarrow$ Authenticate $\rightarrow$ Remote storage is empty $\rightarrow$ Automatically advances to Step 1 (Experience Picker) to craft their cloud-backed companion. |
| **4** | **The Returning Restorer** | Already has cards/models backed up on another machine and wants to pick up where they left off. | **Step 0.5 `[ ☁️ Cloudflare ]`** $\rightarrow$ Authenticate $\rightarrow$ Remote cards detected $\rightarrow$ `SelectiveSyncPanel` $\rightarrow$ **`[ 🚀 Launch Stage with Restored Cards ]`**. Setup complete in 30 seconds! |
| **5** | **The Multi-Companion Power User** | Restores their existing cloud companions, but *also* wants to craft an additional companion today. | **Step 0.5 `[ ☁️ Cloudflare ]`** $\rightarrow$ Authenticate $\rightarrow$ `SelectiveSyncPanel` $\rightarrow$ User selects **`[ + Build Another Companion ]`** $\rightarrow$ Proceeds into Step 1 with cloud sync active. |

---

### 2.3 Option B Layout Specifications

#### Step 0: Zen Welcome Landing (Mascot First Impression)
Preserves the clean, spacious, uncluttered first impression without overwhelming new visitors with authentication inputs:

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

#### Step 0.5: Choose Your Path (State-Aware Intelligent Triage)
Replaces the broken binary cards with honest, state-aware path cards:

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

## 3. Two-Phase Internationalization Strategy

Upstream's biggest usability strength is early language selection. Users should never have to navigate an entire English setup wizard just to find language preferences later.

### Phase 1: Zero-Friction Welcome Language Selector (Immediate)
- Mount a language selector dropdown directly in the top-right header of **Step 0 (Welcome Landing)**.
- Binds to `useI18n().locale.value` and synchronizes with `settings/general.yaml` (`language` key).
- Instantly switches the UI locale in-memory for all already-translated strings across `@proj-airi/i18n`.

### Phase 2: Systematic Onboarding String Audit (Deep Localization)
- Audit all steps under `packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/steps/`.
- Extract hardcoded English strings into `packages/i18n/locales/en/settings.yaml` under `settings.pages.onboarding.*` using `node scripts/yaml-manager.js sync`.
- Populate localized counterparts (`zh-CN`, `ja-JP`, `es-ES`, etc.) to guarantee 100% render completeness.

---

## 4. Consolidation & Shared Faculty Surface Architecture (Settings Modules Reuse)

### 4.1 The Single-Source Configuration Surface Principle
A critical architectural lesson in AIRI is avoiding duplicate, divergent configuration engines. Onboarding should not construct complex, bespoke sub-applications for every subsystem. Instead, **Onboarding steps and Settings Module pages share the exact same underlying faculty components**:

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
│ 🎨 Autonomous Artistry   │ /settings/modules/      │ Dynamic Artistry Step │
│                          │ artistry.vue            │ (Reuses Provider/Node)│
│ 💃 Physical Vessel       │ /settings/models/       │ Step 3: Vessel        │
│                          │ explore.vue             │ (Reuses Discover-     │
│                          │                         │  Carousel.vue)        │
│ ☁️ Cloudflare & Sync     │ /settings/modules/      │ Step 0.5: Triage      │
│                          │ cloudflare.vue / sync   │ (Reuses SelectiveSync)│
└────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 The `modules/artistry.vue` Precedent
The newly refactored [`packages/stage-pages/src/pages/settings/modules/artistry.vue`](packages/stage-pages/src/pages/settings/modules/artistry.vue) serves as the gold standard for this pattern:
- It functions simultaneously as a **global configuration layer** (Pollinations, ComfyUI, Replicate, Nano Banana) and an **interactive generation playground** (testing preset prompts, image dimensions, and headless eventa triggers).
- The Onboarding Artistry step does not reinvent these selectors; it embeds the lightweight provider card list from `artistry.vue`, binding directly to `useArtistryStore`.
- **Permanent Access for Skipped Capabilities**: If a user selects `Chat Only` or skips Artistry during onboarding, the capability is never lost. The user can navigate to `/settings/modules/artistry` at any time to enable and test it with zero friction.

---

## 5. Reordered Topology: Emotional Payoff First

### The Problem With Current V2 Ordering
Current V2 calibrates hardware before identity:
`Welcome → Triage → Hearing (STT) → Consciousness (LLM) → User Profile → Persona → Vessel → Speech → Finale`
Users are asked to test a microphone and configure AI providers for an abstract entity they haven't met yet.

### The New Emotional Sequence
**Persona (Soul) and Vessel (Body) are moved to the front of the journey:**
1. **Meet Your Companion (Persona)**: Choose who she is (ReLU, Dr. Aria, Lupin, Anime Archetype, or Custom Card Import).
2. **Choose Her Appearance (Vessel)**: Select her body (3D VRM or 2D Live2D via the new Coverflow Carousel).
3. **Your Identity (User Profile)**: Establish your name and how she should address you.
4. **Awaken Her Senses (Hardware & Models)**: Only *after* the companion has a soul and body does the user configure how she thinks (LLM), hears (STT), speaks (TTS), or sees (Vision/Sensory).

### Dependency Integrity
- **Persona & Vessel** depend only on bundled static presets (`STARTER_CHARACTERS`, `animadex-catalog.json`, `display-models.ts`) and have **zero** hardware or network dependencies.
- **Speech (TTS)** naturally benefits from knowing the character's persona and gender first, making voice selection intuitive.
- **Consciousness (LLM)** prompt compilation requires the character card and user profile to be assembled first.

---

## 6. Step 1: Choose Your Experience (The 4 Hero Bundles + Customizer)

### 4.1 The 4 Hero Archetype Cards
Users select one primary card that matches their immediate intent:

| Hero Card | Archetype | Included Capabilities | Target User / Flow |
| :--- | :--- | :--- | :--- |
| **💬 Chat Only** | Text Companion | Soul + Vessel + Profile + LLM Consciousness | Zero audio friction. Fastest route to chatting (3 steps). |
| **🎙️ Talk & Listen** | Voice Companion | Chat + Hearing (STT) + Speech (TTS) | Natural conversational voice partner with microphone input and audio playback. |
| **👁️ Sentinel Companion** | Proactive Companion | Talk & Listen + Sensory Telemetry + Proactive Check-ins | Observes active window/desktop context and proactively initiates conversations. |
| **🎨 Artistic Companion** | Creative Collaborator | Talk & Listen + ComfyUI / Pollinations Artistry | Collaborates on artwork, snaps desktop selfies, and visualizes journal scenes. |

---

### 4.2 Complete Layout Specification & Customizer Deck

Below the Hero Cards sits the **"Customize Your Journey"** deck. Selecting a Hero Card automatically pre-checks its baseline modules. Users can toggle individual capabilities on or off, or click `[ Select All ]` for the complete power-user suite.

To provide a complete vision of AIRI's modular architecture, **all planned capabilities are spec'd in the layout**. Future expansion modules are rendered as styled, unclickable/disabled "Coming Soon" badges with clear tooltip explanations, allowing users to see the full evolutionary roadmap of their companion without breaking the wizard flow.

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

#### 4.3 Detailed Capability Matrix & State Behavior

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

## 7. Physical Vessel (Step 3): DiscoverCarousel Overhaul

### 5.1 The Friction in Current Vessel Selection
In current V2 ([`step-5-vessel.vue`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/steps/step-5-vessel.vue)), clicking "Explore" opens an external links grid to third-party marketplaces (Hololive MMD, NicoNico, Reverse: 1999, etc.). Users are kicked out of the flow to download files manually.

### 5.2 The Solution: Spotlight Coverflow Carousel
Integrate the 3D coverflow carousel from [`packages/stage-pages/src/pages/settings/models/components/DiscoverCarousel.vue`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-pages/src/pages/settings/models/components/DiscoverCarousel.vue) as the **primary default view**:

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

- **Interactive Drag & Snap**: Smooth 3D momentum carousel showing spotlight VRM and Live2D avatars.
- **Format Filter Chips**: Instant switching between `All`, `VRM (3D)`, `Live2D (2D)`, `Spine`, and `MMD`.
- **Secondary View**: `[ Choose from Installed Library ]` toggles the full grid for users with existing avatar collections.
- **Dropzone Kept Intact**: Direct drag-and-drop of `.vrm` or `.zip` archives works instantly.

---

## 8. Calibration Finale: Readiness Honesty & Live First Exchange

### 6.1 Truthful Subsystem Status Matrix
Replace the artificial "Everything is 100% prepared" claim with honest, multi-state status cards:

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

### 6.2 The Real First Exchange
- The finale initiates a **real first model completion**:
  1. Sends a hidden generation request using the companion's compiled system prompt and starter greeting.
  2. If Speech is enabled, streams the response through the chosen TTS voice.
  3. The companion speaks her actual live first words on the calibration screen.
  4. If the model fails or has no internet, falls back gracefully to a designated offline greeting with a clear notice: *"Unable to reach cloud brain; offline starter loaded."*

---

## 9. Technical Implementation Map

| Layer / Component | File Location | Responsibility |
| :--- | :--- | :--- |
| **Wizard Orchestrator** | [`packages/stage-ui/.../onboarding/v2/onboarding-v2.vue`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/onboarding-v2.vue) | Dynamic step rail computation based on active draft archetype/capabilities |
| **Draft Store** | [`packages/stage-ui/.../onboarding/v2/draft-store.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/draft-store.ts) | State management for `selectedHeroBundle`, `enabledCapabilities`, and step data |
| **Step 0 Welcome** | [`.../onboarding/v2/steps/step-0-welcome.vue`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/steps/step-0-welcome.vue) | Hardware check + Phase 1 Language Selector mounting |
| **Step 1 Experience Picker** | `.../onboarding/v2/steps/step-1-experience.vue` (New) | 4 Hero Cards + Customizer toggles (active & coming-soon specs) |
| **Step 2 Persona** | [`.../onboarding/v2/steps/step-4-persona.vue`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/steps/step-4-persona.vue) | Promoted to Step 2: Starter characters, anime catalog, card imports |
| **Step 3 Vessel** | [`.../onboarding/v2/steps/step-5-vessel.vue`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/steps/step-5-vessel.vue) | Promoted to Step 3: DiscoverCarousel 3D coverflow starters + dropzone |
| **Discover Carousel** | [`packages/stage-pages/.../models/components/DiscoverCarousel.vue`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-pages/src/pages/settings/models/components/DiscoverCarousel.vue) | Reusable coverflow component powering Step 3 avatar selection |
| **Step Finale** | [`.../onboarding/v2/steps/step-7-calibration.vue`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/steps/step-7-calibration.vue) | Readiness honesty badges + real first live greeting call |

---

## 10. Relevant Skills

- [[airi-onboarding-v2]] — First-run onboarding wizard architecture and draft contracts
- [[airi-card-schema]] — AiriCard and CCv3 card assembly
- [[airi-character-rendering]] — 3D VRM and 2D Live2D display model loading
- [[airi-i18n-localization]] — Language selection and settings YAML translation
