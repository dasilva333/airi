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
2. **Intent-Driven Dynamic Journey**: Users select from **4 Hero Archetype Cards** (*The Casual Companion*, *The Quiet Observer*, *The Executive Copilot*, *The Dynamic Performer*) or configure the **Customizer Deck** upfront. The wizard dynamically renders only the steps required for their chosen experience (e.g. 4 screens for text-only observer vs. 8 screens for full multimodal performer).
3. **Decoupled Soul & Form**: Personality/Lore (Step 2) and Physical Avatar Body (Step 3) are completely decoupled, granting total mix-and-match freedom.
4. **Hardware Capability Transparency**: Every local model card clearly displays VRAM requirements, model size, and supported languages so users make informed choices based on their hardware.
5. **Early Hardware & WebGPU Detection**: Detects `isWebGPUSupported()` globally on startup to guide the user toward WebGPU vs. WASM/Browser-native options.
6. **Two-Phase Internationalization**: Phase 1 mounts an immediate language selector on the Step 0 Welcome screen; Phase 2 provides full deep localization across all step components via `@proj-airi/i18n` YAML strings.
7. **Zero-Custody Cloud Relay**: Cloud accounts authenticate via Cloudflare OAuth 2.0 PKCE. All storage (R2/S3) and compute (Workers/KV) run inside the user's personal Cloudflare account. AIRI never holds custody of user API keys or master credentials.
8. **Transient Composition State & Deferred Card Assembly**: Choices are collected in a clean, transient draft store (`useOnboardingV2Draft`). IndexedDB character cards are never dirty-mutated during the wizard. On the Calibration Finale, the assembled choices are atomically compiled into the target `AiriCard` and `AiriExtension` payload.
9. **Readiness Honesty**: Replaces artificial 100% checkmarks with truthful status states (`Verified Active`, `Configured (Untested)`, `Muted / Skipped`, `Silent Mode`) and tests a real first spoken completion before launch.

---

## 3. The Modernized Sequence & Authoritative Routing Contract

### 3.1 Journey Topology Diagram

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
               ▼                                         │
   ┌───────────────────────┐                             │
   │ Cloudflare OAuth PKCE │                             │
   │  - Auth with CF       │                             │
   │  - Check R2 Vault     │                             │
   └───────────┬───────────┘                             │
               │                                         │
       ┌───────┴────────────────────────┐                │
       ▼                                ▼                │
[ Remote Cards Found ]         [ Empty Cloud Vault ]     │
       │                                │                │
       ▼                                │                │
┌─────────────────────────┐             │                │
│  Selective Sync Panel   │             │                │
│  - Select card(s)       │             │                │
│  - Pull R2 assets       │             │                │
└───────────┬─────────────┘             │                │
            │                           │                │
     ┌──────┴──────────────┐            │                │
     │                     │            │                │
     ▼                     ▼            ▼                ▼
[ 🚀 Launch Stage ]   [ + Build Another ] ──► ┌────────────────────────────────┐
(Restored Companion)                          │ Step 1: Choose Your Experience │
     │                                        │ (4 Hero Cards + Customizer)    │
     │                                        └──────────────┬─────────────────┘
     │                                                       │
     │                                                       ▼
     │                                        ┌────────────────────────────────┐
     │                                        │ Step 2: Soul & Persona (Soul)  │
     │                                        │ (Starter Cards / Tropes / Img) │
     │                                        └──────────────┬─────────────────┘
     │                                                       │
     │                                                       ▼
     │                                        ┌────────────────────────────────┐
     │                                        │ Step 3: Physical Vessel (Body) │
     │                                        │ (DiscoverCarousel 3D Coverflow)│
     │                                        └──────────────┬─────────────────┘
     │                                                       │
     │                                                       ▼
     │                                        ┌────────────────────────────────┐
     │                                        │ Step 4: User Profile & Identity│
     │                                        └──────────────┬─────────────────┘
     │                                                       │
     │                                                       ▼
     │                                        ┌────────────────────────────────┐
     │                                        │ Step 5: Hearing & Mic (STT)*   │
     │                                        │ (*Conditional if Voice Enabled)│
     │                                        └──────────────┬─────────────────┘
     │                                                       │
     │                                                       ▼
     │                                        ┌────────────────────────────────┐
     │                                        │ Step 6: Consciousness (LLM)    │
     │                                        └──────────────┬─────────────────┘
     │                                                       │
     │                                                       ▼
     │                                        ┌────────────────────────────────┐
     │                                        │ Step 7: Voice Studio (TTS)*    │
     │                                        │ (*Conditional if Voice Enabled)│
     │                                        └──────────────┬─────────────────┘
     │                                                       │
     │                                                       ▼
     │                                        ┌────────────────────────────────┐
     │                                        │ Extended: Artistry / Sensory*  │
     │                                        │ (*Conditional on Archetype)    │
     │                                        └──────────────┬─────────────────┘
     │                                                       │
     │                                                       ▼
     │                                        ┌────────────────────────────────┐
     │                                        │ Step Finale: Stage Calibration │
     │                                        │ (Readiness Honesty & Greeting) │
     │                                        └──────────────┬─────────────────┘
     │                                                       │
     ▼                                                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                               Live AIRI Stage                                │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Routing Failure Modes & State Resolution Rules

To prevent diverging implementations across Desktop (Electron), Web (`DialogRoot`), and Pocket Stage (`DrawerRoot`), the following strict transition rules govern authentication, vault errors, and cancellation:

1. **Authentication Cancelled or Failed**:
   - **Condition**: User aborts the Cloudflare OAuth popup, PKCE challenge times out, or bad credentials returned.
   - **Behavior**: Remains on Step 0.5 (Path Triage). Displays an inline dismissible warning banner: *"Cloudflare sign-in was cancelled or failed ({errorCode}). You can try again, or continue with 100% offline local setup."*
   - **Persistence Effect**: `cloudflareStore` credentials remain uncommitted. Any existing transient draft (`onboarding/v2-draft`) is preserved. The user is never blocked from proceeding locally.

2. **Remote Storage Empty vs. Inaccessible / Unreadable**:
   - **Rule**: An inaccessible vault **MUST NEVER** be classified as empty!
   - **Empty Vault (`200 OK`, card count = 0)**: Vault bucket was successfully inspected and is genuinely empty. Displays checkmark: *"Connected to Cloudflare! Your vault is ready to receive backups."* Automatically advances to Step 1 (Experience Picker) with cloud sync flag enabled in draft (`draft.cloudSyncEnabled = true`).
   - **Inaccessible / Unreadable Vault (`401`, `403`, `5xx`, or network timeout)**: Displays an amber error state: *"Connected to Cloudflare, but the R2 storage bucket could not be read ({statusCode}). Check your API token permissions or network connection."*
   - **Resolution Action**: Provides two explicit buttons: `[ 🔄 Retry Bucket Access ]` and `[ Continue in Local Mode (Sync Deferred) ]`. Proceeding in local mode defers cloud synchronization without failing onboarding.

3. **Restore Selection: Partial Hydration & Zero-Card Selection**:
   - **Zero Selection**: If the user unchecks all remote cards in `SelectiveSyncPanel`, the button `[ 🚀 Launch Stage with Restored Companions ]` is **disabled**. A helper tip reads: *"Select at least one companion to restore, or click '+ Create an Additional Companion'."*
   - **Partial Restoration**: If 2 out of 3 cards hydrate successfully but 1 card fails due to network interruption, the successful cards are committed to IndexedDB. The failed card displays a `[ ⚠️ Failed — Retry ]` button. The user may click `[ 🚀 Launch Stage with Restored Companions ]` to proceed with the subset that succeeded; failed cards remain available for subsequent sync in Settings.

4. **Existing Local Companions Alongside Remote Backups**:
   - **Name / UUID Collision Resolution**: Remote cards use immutable UUIDs. If a remote card's ID matches an existing local card, the UI presents an inline prompt: `[ Keep Local ]` vs `[ Overwrite with Remote ]`.
   - **Active Companion Determination**: The user selects which companion will be active via a radio button beside each restored card before clicking launch. If unselected, defaults to the most recently modified card.

5. **Adding a Companion While Already Authenticated**:
   - When entering onboarding from **Settings → AIRI Cards → Companion Wizard** while already logged into Cloudflare, Step 0.5 detects `cloudflareStore.isAuthenticated`.
   - Instead of displaying sign-in forms, it shows: *"Connected as {accountEmail} (Cloudflare R2 active)"*. The primary action becomes `[ + Create New Companion ]`, jumping directly to Step 1 with cloud sync pre-wired.

6. **Cancelling Companion Creation After a Successful Restore**:
   - If a returning user restores cards in Step 0.5, selects `[ + Create an Additional Companion ]`, proceeds into Step 1/2/3, and then clicks `[ Cancel ]` or `[ ✕ Close ]`:
   - **Contract**: Discards *only* the transient creation draft (`onboarding/v2-draft`). The already hydrated companions in IndexedDB are **preserved**. The first restored companion is activated, `onboarding/completed` is set to `true`, and the onboarding window/dialog safely closes into Stage. The user is never left in an un-onboarded limbo.

### 3.3 Authoritative Platform Transition Table

| Entry Mode | Trigger / Event | Condition / Pre-State | Target Destination | Persistence & Storage Effects |
| :--- | :--- | :--- | :--- | :--- |
| **Fresh Install** | App launch | `!onboarding/completed && !onboarding/skipped` | **Step 0: Welcome** | Initializes `onboarding/v2-state = { stepId: 'welcome' }`. Reads device GPU via `isWebGPUSupported()`. |
| **Fresh Install** | User clicks `[ Let's Get Started → ]` | On Step 0 | **Step 0.5: Triage** | Updates `onboarding/v2-state.stepId = 'triage'`. |
| **Fresh Install** | User clicks `[ ⚡ Quick Start ]` | On Step 0 | **Live Stage** | Executes Cold-Device Contract (§4.1). Writes `relu-starter` card to IndexedDB. Sets `onboarding/completed = true`. |
| **Fresh Install** | User clicks `[ Skip Permanently ]` | On Step 0 or Step 0.5 | **Live Stage** | Sets `onboarding/skipped = true`. No background model downloads. Minimal placeholder or unconfigured stage. |
| **Step 0.5** | User clicks `[ 🏠 Local Companion ]` | On Step 0.5 | **Step 1: Experience** | Sets `draft.path = 'new'`. Updates `onboarding/v2-state.stepId = 'experience'`. |
| **Step 0.5** | User initiates Cloudflare OAuth | On Step 0.5 | **OAuth Webview / Popup** | Opens PKCE auth window. Local state preserved. |
| **Step 0.5** | Cloudflare OAuth returns error / cancel | In OAuth flow | **Step 0.5: Triage** | Shows dismissible error banner. `cloudflareStore` credentials uncommitted. |
| **Step 0.5** | Cloudflare Auth Success; R2 empty | Bucket cards count == 0 | **Step 1: Experience** | Stores CF credentials in `cloudflareStore`. Sets `draft.cloudSyncEnabled = true`. Advances to Step 1. |
| **Step 0.5** | Cloudflare Auth Success; R2 unreadable | Status 401/403/500/timeout | **Step 0.5: Triage (Error)** | Displays persistent alert banner with status code + Retry button + Continue Local button. |
| **Step 0.5** | Cloudflare Auth Success; cards found | Bucket cards count > 0 | **Step 0.5: Selective Sync** | Embeds `SelectiveSyncPanel`. Lists remote companions with radio selector for active card. |
| **Step 0.5** | User clicks `[ 🚀 Launch Stage ]` | ≥1 card hydrated in IndexedDB | **Live Stage** | Sets `airiCardStore.activeCardId = selectedCardId`. Sets `onboarding/completed = true`. Closes wizard. |
| **Step 0.5** | User clicks `[ + Build Another ]` | ≥1 card hydrated in IndexedDB | **Step 1: Experience** | Preserves restored cards. Sets `draft.cloudSyncEnabled = true`. Advances to Step 1. |
| **Step 1–7** | User clicks `[ Back ]` | On Step N | **Step N-1 (Previous active step)** | Traverses backward along dynamic active step list. All draft inputs preserved. |
| **Step 1–7** | User cancels wizard after restore | Restored cards in IndexedDB | **Live Stage** | Clears transient draft. Keeps restored cards. Sets active card. Marks `onboarding/completed = true`. |
| **Step 1–7** | User cancels wizard without restore | Local new path, no prior cards | **Step 0: Welcome** | Prompts: *"Discard draft and exit?"* If confirmed, resets `onboarding/v2-draft` and returns to Step 0. |
| **Step Finale** | User clicks `[ 🚀 Enter AIRI Stage ]` | Readiness check completed | **Live Stage** | Executes Atomic Assembly Contract (§4.8). Commits card, sessions, settings. Marks `completed = true`. |
| **Settings Entry** | Triggered via `CreateModeSelector` | User authenticated with CF | **Step 1: Experience** | Skips Welcome & Triage. Draft initialized with `cloudSyncEnabled = true`. |

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
  - `[ ⚡ Quick Start: Jump Straight to Stage ]` (Use Case 1): Bypasses all setup; boots default `ReLU` companion on stage immediately per the cold-device contract below.
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

#### Cold-Device Execution Contract for Quick Start

Quick Start guarantees that the user reaches the desktop Stage immediately, but local inference availability depends strictly on hardware readiness and cached weights:

| Device State | Required System Behavior & Visual Contract |
| :--- | :--- |
| **Compatible Engine + Cached Model Weights** | Stage opens immediately (<500ms). Stage HUD displays a brief loading badge (`Initializing neural brain...`, <2s). Once WebLLM / Kokoro instances warm up, companion triggers her live spoken greeting and accepts user text/voice. |
| **Compatible Engine + Missing Model Weights** | Stage opens immediately with the ReLU companion loaded. The Stage HUD renders an explicit model preparation progress bar: `Preparing ReLU's Brain (Qwen 3.5 0.8B): 34% (120MB / 450MB)`. The user can freely reposition or minimize the window. If cloud or mock fallback is available, text chat functions immediately; local neural voice begins once weights finish downloading. |
| **Unsupported Hardware / Load Failure** | Stage opens safely in **Fallback Mode**. An unobtrusive HUD banner states: *"Local WebGPU acceleration is unavailable on this device."* The companion appears on stage with text dialogue active (Web Speech API / offline starter responses). The banner offers an action: `[ Connect Cloud Provider (Free Groq / Gemini) ]` or `[ Continue in Text-Only Mode ]`. Never crashes or loops. |
| **Existing Configured Installation** | Preserves all existing configured providers, credentials, and custom character cards. Activates `relu-starter` alongside existing companions without overwriting prior user data. |

#### Quick Start vs. Skip Permanently Comparison Matrix

| Property | `[ ⚡ Quick Start ]` | `[ Skip Permanently ]` |
| :--- | :--- | :--- |
| **User Intent** | *"I want to immediately play with the default companion right now."* | *"Leave me alone; I will configure providers and cards myself in settings."* |
| **Persistence Flag** | Sets `onboarding/completed = true`. | Sets `onboarding/skipped = true`. |
| **Card Assembly** | Compiles and persists default seeded `relu-starter` card to IndexedDB. | No card created, or loads a bare minimalist placeholder shell. |
| **Background Downloads** | Initiates background weight downloads for default local models (`Qwen 3.5 0.8B`, `Kokoro`). | **Zero network requests / Zero downloads**. Respects low-bandwidth environments. |
| **Subsequent Reminders** | No intrusive banners. Subtle badge in Settings: *"Setup full companion voice & memory"*. | Preserves persistent `Start Companion Wizard` item in system tray and settings. |
| **Target Destination** | Desktop Stage with ReLU active. | Desktop Stage in unconfigured state, or Settings if launched from preference modal. |

---

### Step 0.5: Path Triage — The 5 Use Cases (Option B Architecture)

Onboarding V3 cleanly isolates and handles all five real-world user intents:

| # | User Intent | Primary Motivation | Onboarding Journey & Resolution |
| :--- | :--- | :--- | :--- |
| **1** | **The Explorer / Guest** | *"I don't care about anything, let me just try the app!"* | **Step 0 `[ ⚡ Quick Start ]`**: Bypasses the entire wizard. Loads the seeded `ReLU` companion per the Cold-Device Contract directly onto the stage. |
| **2** | **The Local-First Creator** | Wants full companion customization with 100% privacy and zero accounts. | **Step 0.5 `[ 🏠 Local Companion ]`**: Proceeds to Step 1 (Experience Picker) to build their companion entirely on-device. |
| **3** | **The Cloud-Backed Creator** | Wants to build a new companion that is automatically backed up to Cloudflare R2 from day 1. | **Step 0.5 `[ ☁️ Cloudflare ]`** $\rightarrow$ Authenticate $\rightarrow$ Remote storage is verified empty $\rightarrow$ Automatically advances to Step 1 (Experience Picker) with cloud backup active. |
| **4** | **The Returning Restorer** | Already has cards/models backed up on another machine and wants to pick up where they left off. | **Step 0.5 `[ ☁️ Cloudflare ]`** $\rightarrow$ Authenticate $\rightarrow$ Remote cards detected $\rightarrow$ `SelectiveSyncPanel` $\rightarrow$ **`[ 🚀 Launch Stage with Restored Companions ]`**. Setup complete in 30 seconds! |
| **5** | **The Multi-Companion Power User** | Restores their existing cloud companions, but *also* wants to craft an additional companion today. | **Step 0.5 `[ ☁️ Cloudflare ]`** $\rightarrow$ Authenticate $\rightarrow$ `SelectiveSyncPanel` $\rightarrow$ User selects **`[ + Create an Additional Companion ]`** $\rightarrow$ Proceeds into Step 1 with cloud sync active. |

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

#### Restore Completion Contract (Beyond "Sync Finished")

The existing V2 restore wrapper invoked `triggerSync()` and advanced blindly upon promise resolution. Onboarding V3 enforces a structured, typed `RestoreResult` contract:

```typescript
interface RestoreResult {
  status: 'success' | 'partial' | 'failed' | 'empty'
  requestedCardIds: string[]
  restoredCardIds: string[]
  failedCardIds: string[]
  assetPresence: Record<string, {
    avatarPresent: boolean
    fallbackAvatarUsed: boolean
    voiceModelPresent: boolean
  }>
  suggestedActiveCardId?: string
  errorDetails?: string
}
```

- **Inbound Hydration Semantics**: The restore operation during onboarding is **strictly an inbound hydration pull** from the user's Cloudflare R2 bucket into local IndexedDB. It does not perform two-way conflict merges, upload local artifacts, or purge local assets.
- **Active Companion Requirement**: The button `[ 🚀 Launch Stage with Restored Companions ]` requires:
  1. `restoredCardIds.length > 0` (at least one character card successfully written to `cardsRepo`).
  2. A designated `activeCardId` (either chosen by the user in `SelectiveSyncPanel` or defaulting to the most recently edited restored card).
- **Missing Optional Assets Policy**: If a restored card references an avatar mesh (`.vrm`, `.model3.json`) or voice profile not found in R2 or local storage:
  - The card is hydrated with its persona and lore intact.
  - The missing vessel is swapped to the default starter vessel (`Hiyori Live2D` or `AvatarSample_A`).
  - `assetPresence[cardId].fallbackAvatarUsed = true`.
  - Stage displays an informational toast on startup: *"Restored companion '{name}' loaded with default avatar (cloud visual asset unavailable)."* Launch is never blocked by a missing avatar or voice model.

---

### Step 1: Choose Your Experience (4 Hero Bundles + Customizer Deck)

The Experience Picker allows users to choose their companion's operational role upfront or customize individual faculties through an expandable deck.

- **4 Standardized Hero Archetype Bundles**:
  1. **💬 The Quiet Observer**: Visual/presence companion with low system footprint. Pure text dialogue; zero audio friction. (Steps: Persona, Vessel, Profile, Consciousness).
  2. **🎙️ The Casual Companion**: Everyday conversational partner with text chat and neural voice playback. (Steps: Persona, Vessel, Profile, Hearing, Consciousness, Speech).
  3. **💼 The Executive Copilot**: Productivity-focused desktop companion with voice, hearing, and structured tool/MCP integration. (Steps: Persona, Vessel, Profile, Hearing, Consciousness, Speech).
  4. **✨ The Dynamic Performer**: Multimodal companion with Autonomous Artistry (ComfyUI/Pollinations) and OS sensory proactivity. (Steps: Persona, Vessel, Profile, Hearing, Consciousness, Speech, Artistry, Sensory).

```text
┌────────────────────────────────────────────────────────────────────────────┐
│                    Choose Your Companion Experience                        │
│   "Select an archetype to get started. You can tune any module below."     │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────┐  │
│  │ 💬 The Quiet         │  │ 🎙️ The Casual        │  │ 💼 The Executive │  │
│  │    Observer          │  │    Companion         │  │    Copilot       │  │
│  │  Presence & chat     │  │  Voice dialogue      │  │  Voice + Tools   │  │
│  │  Zero audio overhead │  │  Hear & speak freely │  │  Productivity    │  │
│  │  [ Select Observer ] │  │  [ Selected ✓ ]      │  │  [ Select Exec ] │  │
│  └──────────────────────┘  └──────────────────────┘  └──────────────────┘  │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ ✨ The Dynamic Performer                                             │  │
│  │   Autonomous artistry, selfies, sensory telemetry & stage presence   │  │
│  │   [ Select Performer ]                                               │  │
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
│  [ ] 🎬 Generative Motion & VRMA — [Feature In Development] 3D dance cues. │
│  [ ] 📖 Lifetime Memory Matrix   — [Guided Setup Coming Soon] DRMM dreams. │
│  [ ] 🎭 Marker Rehearsal Room    — [Guided Setup Coming Soon] <|ACT:...|>. │
│  [ ] 🎮 Dating Sim Mode & HUD    — [Guided Setup Coming Soon] Intimacy HUD.│
│  [ ] 🪟 Multi-Window Stage Island — [Feature In Development] Overlay bubble.│
│  [ ] 🤖 24/7 Cloud Relay Bot     — [Feature In Development] Discord worker.│
│                                                                            │
│  [ Select All Available ]                              [ Clear Optional ]  │
│  Dynamic Path: Step 1 of 6                                                 │
│  [ Skip All (Direct to Stage) ]                      [ Continue Setup > ]  │
└────────────────────────────────────────────────────────────────────────────┘
```

#### Bundle Editing, Dynamic Rail, and Draft Migration Rules

1. **Hero Switching & Custom Draft Retention**:
   - Selecting a Hero Card toggles the enabled state of the customizer checkboxes to match that archetype's preset defaults.
   - **Retention Contract**: Switching hero archetypes **never discards entered draft data**. If a user enters a custom persona name, provides an OpenAI API key, or tunes voice sliders, and then switches between *The Quiet Observer* and *The Casual Companion*, all previously entered strings, keys, and values remain safely stored in `useOnboardingV2Draft`. Toggling a capability only controls whether that step appears in the active sequence.

2. **Deselection & Dynamic Rail Recalculation**:
   - The active journey sequence `activeSteps` is computed reactively: `['persona', 'vessel', 'user_profile', ...(hearing ? ['hearing'] : []), 'consciousness', ...(speech ? ['speech'] : []), ...(artistry ? ['artistry'] : []), ...(sensory ? ['sensory'] : []), 'calibration']`.
   - If the user is on a step that gets deselected (for example, navigating to the customizer deck and unchecking `hearing`), the wizard immediately computes the new route and advances smoothly to the next available step.
   - **Dynamic Step Counting**: Step indicators are computed dynamically as `Step ${currentIndex + 1} of ${activeSteps.length}`. Static hardcoded counts (e.g. "3 steps") and fixed time estimates (e.g. "~2 minutes") are prohibited because download durations and step counts vary by device and selection.

3. **Hearing & Speech Decoupled Independence**:
   - Hearing (STT microphone input) and Speech (TTS audio synthesis) are **completely independent toggles**.
   - `hearing: true, speech: false`: Subtitle / Silent Companion mode. Companion listens to user speech and responds with on-screen dialogue bubbles.
   - `hearing: false, speech: true`: Voice-only output mode. User types via desktop composer; companion responds verbally.

4. **Separation of "Included in Journey" vs. "Verification Probe Gates"**:
   - Required identity steps (Soul & Persona, Physical Vessel, User Profile) are always included in the journey, but are seeded with instant 1-click defaults (`ReLU`, `Hiyori Live2D`, `Default User`). Users are never forced to perform manual authoring or drop files to proceed.
   - Technical verification probes (mic speech detection, LLM generation pings, TTS audio previews) always include an always-enabled `[ Skip Step ]` or `[ Test Later in Settings ]` button. A red probe gate disables `[ Next > ]` until verified, but never blocks `[ Skip Step ]`.

5. **"Select All" Button Semantics**:
   - Clicking `[ Select All Available ]` toggles all Core and Extended capabilities (`hearing`, `speech`, `artistry`, `sensory`) to enabled.
   - It **strictly ignores** disabled `Future Expansion` items.

6. **Draft Migration Contract (`migrateV2DraftToV3`)**:
   - When the wizard mounts and detects an existing draft in `onboarding/v2-draft` (from a previous session or V2 release):
   ```typescript
   export function migrateV2DraftToV3(raw: any): OnboardingV3DraftState {
     return {
       archetype: raw?.archetype || 'casual-companion',
       enabledCapabilities: Array.isArray(raw?.enabledCapabilities)
         ? raw.enabledCapabilities
         : ['consciousness', 'persona', 'vessel', 'user_profile', 'hearing', 'speech'],
       consciousness: {
         provider: raw?.consciousness?.provider || 'web-llm',
         model: raw?.consciousness?.model || 'Qwen/Qwen2.5-0.5B-Instruct-q4f16_1-MLC',
         engine: raw?.consciousness?.engine || 'web-llm',
       },
       hearing: {
         provider: raw?.hearing?.provider || 'whisper-local',
         model: raw?.hearing?.model || 'whisper-small',
       },
       speech: {
         provider: raw?.speech?.provider || 'kokoro-local',
         model: raw?.speech?.model || 'kokoro-v1.0',
         voiceId: raw?.speech?.voiceId || 'af_bella',
         pitch: raw?.speech?.pitch ?? 1.0,
         rate: raw?.speech?.rate ?? 1.0,
       },
       persona: raw?.persona || { cardId: 'relu-starter', source: 'preset' },
       vessel: raw?.vessel || { displayModelId: 'preset-live2d-2' },
       userProfile: raw?.userProfile || { name: 'Producer' },
       artistry: raw?.artistry || { provider: 'pollinations' },
       sensory: raw?.sensory || { osTelemetryEnabled: false },
       cloudSyncEnabled: Boolean(raw?.cloudSyncEnabled),
       probeVerification: raw?.probeVerification || {},
     }
   }
   ```

#### Detailed Capability Matrix & State Behavior

| Capability Identifier | Category | UI State | Default in Hero Bundles | Step Screen / Behavior |
| :--- | :--- | :--- | :--- | :--- |
| `consciousness` | Core | Enabled (Locked) | All Bundles | Step 6: Consciousness (WebLLM / Cloud) |
| `persona` | Core | Enabled (Locked) | All Bundles | Step 2: Soul & Persona (Trope / Card Import) |
| `vessel` | Core | Enabled (Locked) | All Bundles | Step 3: Physical Vessel (DiscoverCarousel) |
| `user_profile` | Core | Enabled (Locked) | All Bundles | Step 4: User Profile & Identity |
| `hearing` | Core | Toggleable | Casual Companion, Executive Copilot, Dynamic Performer | Step 5: Hearing & Mic (Whisper WebGPU / Web Speech) |
| `speech` | Core | Toggleable | Casual Companion, Executive Copilot, Dynamic Performer | Step 7: Voice Studio (Kokoro / Pocket-TTS / Cloud) |
| `artistry` | Extended | Toggleable | Dynamic Performer | Configures ComfyUI API / Pollinations provider |
| `sensory` | Extended | Toggleable | Dynamic Performer | Prompts OS permission & enables AFK telemetry loops |
| `generative_motion` | Future Expansion | Disabled (`cursor-not-allowed`) | None | Badge: `[Feature In Development]`. Tooltip: "FlowMDM WebGPU procedural text-to-motion". |
| `memory_matrix` | Future Expansion | Disabled (`cursor-not-allowed`) | None | Badge: `[Guided Setup Coming Soon]`. Tooltip: "Lifetime Sacred Journal & DRMM dreaming consolidation (available in Settings)". |
| `rehearsal_room` | Future Expansion | Disabled (`cursor-not-allowed`) | None | Badge: `[Guided Setup Coming Soon]`. Tooltip: "<|ACT:...|> live emotion and motion cue testing sandbox (available in Model Customizer)". |
| `dating_sim` | Future Expansion | Disabled (`cursor-not-allowed`) | None | Badge: `[Guided Setup Coming Soon]`. Tooltip: "Branching visual novel HUD, intimacy tracking, and scene sets (available in Settings)". |
| `multi_window` | Future Expansion | Disabled (`cursor-not-allowed`) | None | Badge: `[Feature In Development]`. Tooltip: "Detached desktop chat bubble and transparent stage overlay". |
| `cloud_relay_bot` | Future Expansion | Disabled (`cursor-not-allowed`) | None | Badge: `[Feature In Development]`. Tooltip: "Cloudflare Edge Worker for 24/7 Discord interaction bot". |

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
│   [ < Back to Persona ]                             [ Next: User Profile > ]│
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

The Calibration Finale serves as the truth-telling checkpoint where assembled draft capabilities are verified before committing production records.

#### Readiness Honesty Matrix

Replaces artificial "100% prepared" claims with granular, truthful status cards:

| Subsystem | State | Visual Indicator | Status Label | Meaning |
| :--- | :--- | :--- | :--- | :--- |
| **Consciousness** | Probe Passed | 🟢 Green Check | `Verified Active` | Real LLM generation ping succeeded with currently selected model. |
| **Consciousness** | Untested Cloud | 🟡 Yellow Dot | `Configured (Untested)` | API key present, live ping skipped or not yet attempted. |
| **Consciousness** | Offline Fallback | ⚪ Grey Dot | `Offline Starter` | LLM unconfigured; companion will use card's seeded starter greeting text. |
| **Hearing** | Mic Passed | 🟢 Green Check | `Calibrated` | Live audio transcription captured and verified in current session. |
| **Hearing** | Deselected/Skipped| ⚪ Grey Dash | `Muted / Skipped` | Mic input disabled for this companion. |
| **Speech** | Audio Previewed| 🟢 Green Check | `Voice Active` | Real audio synthesis generated and heard. |
| **Speech** | Deselected/Skipped| ⚪ Grey Dash | `Silent Mode` | Text-only companion. Zero audio output. |
| **Artistry** | Connected | 🟢 Green Check | `Art Engine Ready` | ComfyUI API endpoint or Pollinations verified reachable. |
| **Sensory** | Granted | 🟢 Green Check | `Sensory Active` | OS telemetry permissions granted. |

#### Verification Freshness & Evidence Invalidation Contract

- **Tuple Hashing**: Every verification badge is strictly bound to its configuration tuple: `hash(providerId, modelId, endpointUrl, credentialsHash, voiceId)`.
- **Immediate Invalidation**: Changing any parameter (e.g. switching model from `Qwen 0.8B` to `Qwen 4B`, altering a custom system prompt, switching voice from `af_bella` to `af_sarah`, or changing audio input device) **immediately clears** the verification evidence and resets the status badge back to `Configured (Untested)` or `Uncalibrated`.
- **Cached Weights ≠ Initialized Engine**: The presence of downloaded model shards in browser cache does NOT prove the engine can successfully initialize on the current WebGPU adapter. A green badge requires an active in-session initialization and completion test.

#### First Spoken Greeting Lifecycle & Persistence

1. **Generation & Playback**:
   - The Calibration screen automatically requests a short live greeting from the compiled persona and user profile.
   - If Speech is enabled (`speech: true`), the response streams through the chosen TTS voice so the user hears her companion speak live on the finale screen.
2. **User Aborts via `[ < Back ]` or Closes Window**:
   - If the user clicks `[ < Back ]` during generation or audio playback, the wizard immediately dispatches `abort()` on the underlying `AbortController`, suspends/closes the Web AudioContext source, and silences all speaker output.
3. **Persona or Voice Changes While Request In-Flight**:
   - Any modification cancels the pending request and resets the probe state.
4. **LLM Succeeds but TTS Fails**:
   - The greeting text appears inside a styled companion chat bubble on the screen.
   - A non-blocking warning banner appears below: *"⚠️ Voice synthesis failed ({errorDetails}). [ 🔄 Retry Voice ] | [ Continue in Silent Mode ]"*.
   - The wizard **does not crash or abort** card creation. The user can proceed to Stage with text subtitles active.
5. **Speech Deliberately Deselected (Silent Mode)**:
   - If the user selected *The Quiet Observer* or unchecked Speech, **NEVER** play audible sound or fall back to system audio. The greeting is presented strictly as a visual dialogue bubble.
6. **Fallback Starter Text vs. Live Inference**:
   - If LLM inference was skipped or failed, the card's seeded `first_mes` / `greeting` text is displayed and labeled with an amber badge: `Offline Starter Greeting (LLM Untested)`. It is never represented as a successful live inference ping.
7. **Persistent Conversation Turn 0**:
   - Upon launching Stage, the greeting generated on the Calibration screen is committed as **Turn 0 (the initial assistant message)** in the newly created chat session (`useChatSessionStore.createSession(cardId, [greetingMessage])`). This guarantees seamless emotional continuity: the companion does not repeat herself or forget what she just said when Stage opens.

#### Atomic Assembly & Commit Contract (Anti-Duplicate & Recovery)

The existing V2 calibration step committed speech settings to production stores *before* character card creation, creating dirty partial state if card creation failed. Onboarding V3 enforces strict atomic sequencing:

```text
Draft In Memory ──► [Valibot Validation] ──► [Write Card to IndexedDB] ──► [Write Provider Bindings]
                                                                                   │
Stage Focused ◄── [Mark Completed] ◄── [Set Active Card] ◄── [Commit Chat Turn 0] ◄┘
```

1. **Step 1: Schema Validation**: Validates transient draft state against `AiriCard` and `AiriExtension` Valibot schemas.
2. **Step 2: Card Commit**: Writes the compiled card to `cardsRepo` in IndexedDB. Generates a deterministic or stable UUID (`card.id`). If this write fails, the operation halts; no production provider settings are altered.
3. **Step 3: Provider Instance Bindings**: Binds model, voice, and API keys to the newly created card ID in `providersStore` and `consciousnessStore`.
4. **Step 4: Chat Session Commit**: Commits Turn 0 into `chatSessionStore` keyed by `card.id`.
5. **Step 5: Active Card Designation**: Sets `airiCardStore.activeCardId = card.id`.
6. **Step 6: Completion Flags**: Calls `onboardingStore.markSetupCompleted()`.
7. **Step 7: Draft Purge**: Calls `useOnboardingV2Draft().reset()` to purge `onboarding/v2-draft`.
8. **Step 8: Stage Transition**: Closes onboarding dialog/window and focuses Stage.
- **Idempotent Retry on Failure**: If an error occurs during Step 4, 5, or 6, clicking `[ 🚀 Enter AIRI Stage ]` again **reuses the existing `card.id`**. It updates the existing card rather than generating duplicate duplicate cards in IndexedDB.

---

## 5. Implementation Status, Shared Faculty Architecture & Draft Boundary

### 5.1 Required Component Extraction Work (The Refactoring Seam)

The previous architecture had a leaky boundary:
- [`packages/stage-pages/src/pages/settings/modules/artistry.vue`](packages/stage-pages/src/pages/settings/modules/artistry.vue) bound directly to production stores (`useArtistryStore`), used router navigation, and directly invoked Electron IPC.
- [`packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/steps/step-1-hearing.vue`](packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/steps/step-1-hearing.vue) temporarily mutated live production `hearingStore` state and attempted to restore snapshots on unmount.

**Onboarding V3 establishes a strict dependency direction via shared presentation controls**:

```text
                        ┌─────────────────────────────────────────┐
                        │        Shared Presentation Deck         │
                        │    (packages/stage-ui/src/components/   │
                        │               modules/*)                │
                        │   - Props: modelValue, capabilities     │
                        │   - Emits: update:modelValue, testProbe │
                        └────────────────────┬────────────────────┘
                                             │
                     ┌───────────────────────┴───────────────────────┐
                     ▼                                               ▼
      ┌─────────────────────────────┐                 ┌─────────────────────────────┐
      │   Settings Module Adapter   │                 │   Onboarding Step Adapter   │
      │   (/settings/modules/*.vue) │                 │   (v2/steps/*.vue)          │
      ├─────────────────────────────┤                 ├─────────────────────────────┤
      │ • Binds to Production Store │                 │ • Binds to Transient Draft  │
      │ • Writes to IndexedDB       │                 │ • Writes to v2-draft only   │
      │ • Immediate persistence     │                 │ • Deferred atomic commit    │
      └─────────────────────────────┘                 └─────────────────────────────┘
```

#### Shared Faculty Extraction Plan

| Subsystem Deck | Shared Component Path | Extracted Presentation Responsibility | Settings Adapter (Production) | Onboarding Adapter (Draft) |
| :--- | :--- | :--- | :--- | :--- |
| **STT Hearing** | `stage-ui/components/modules/HearingDeck.vue` | Mic selector dropdown, audio level meter (`LevelMeter.vue`), Whisper model selector, live transcript box. | `packages/stage-pages/.../hearing.vue` (mutates `useHearingStore`). | `v2/steps/step-1-hearing.vue` (reads draft, updates `draft.hearing`). |
| **LLM Mind** | `stage-ui/components/modules/ConsciousnessDeck.vue` | WebLLM hero cards, VRAM badges, cloud provider grid, inline API key inputs, test completion probe. | `packages/stage-pages/.../consciousness.vue` (mutates `useProvidersStore`). | `v2/steps/step-2-consciousness.vue` (reads draft, updates `draft.consciousness`). |
| **TTS Voice** | `stage-ui/components/modules/VoiceStudioDeck.vue` | Local neural engine cards (Kokoro/Pocket), voice dropdown, pitch/rate sliders (0.75x–1.5x), audio player preview. | `packages/stage-pages/.../speech.vue` (mutates `useSpeechStore`). | `v2/steps/step-6-speech.vue` (reads draft, updates `draft.speech`). |
| **Artistry** | `stage-ui/components/modules/ArtistryDeck.vue` | ComfyUI API endpoint input, Pollinations provider toggle, test prompt button, preview image thumbnail. | `packages/stage-pages/.../artistry.vue` (mutates `useArtistryStore`). | `v2/steps/step-artistry.vue` (reads draft, updates `draft.artistry`). |

#### Step Unmount & Resource Cleanup Discipline

When an onboarding step unmounts or the user navigates Back/Next:
- **Audio Capture**: All active `MediaStream` tracks and VAD audio nodes must be explicitly stopped (`stream.getTracks().forEach(t => t.stop())`).
- **Audio Playback**: Any active preview synthesis AudioContext must be suspended/closed and in-flight audio buffers freed.
- **Inference Signals**: Any running WebLLM or Kokoro test ping must be signalled via its `AbortController.abort()`.
- **Zero Production Pollution**: No step may leave temporary overrides in live stores.

---

## 6. Codebase Reference Table

| Step | Component / Location | Pinia Store / Composable Ref | Key Constants / Services |
|---|---|---|---|
| **0: Welcome** | [`v2/steps/step-0-welcome.vue`](packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/steps/step-0-welcome.vue) | `useOnboardingStore`, `useI18n` | `isWebGPUSupported()`, Phase 1 Language Selector, Cold-Device Contract |
| **0.5: Triage** | [`step-start-choice.vue`](packages/stage-ui/src/components/scenarios/dialogs/onboarding/step-start-choice.vue) | `useOnboardingStore`, `useCloudflareStore` | `RestoreResult`, Inbound Hydration Pull, `SelectiveSyncPanel` |
| **1: Experience** | `v2/steps/step-1-experience.vue` (New) | `useOnboardingV2Draft` | 4 Hero Archetype Cards + Customizer Deck, `migrateV2DraftToV3` |
| **2: Soul & Persona** | [`v2/steps/step-4-persona.vue`](packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/steps/step-4-persona.vue) | `useAiriCardStore` | `STARTER_CHARACTERS`, `animadex-catalog.json`, Card Imports |
| **3: Vessel** | [`v2/steps/step-5-vessel.vue`](packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/steps/step-5-vessel.vue) | `useDisplayModelsStore` | `DiscoverCarousel.vue`, VRM/Live2D starter presets, uploader |
| **4: User Profile** | [`v2/steps/step-3-user-profile.vue`](packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/steps/step-3-user-profile.vue) | `useSettingsUserProfile` | `name`, `description`, `prompt` |
| **5: Hearing (STT)** | [`v2/steps/step-1-hearing.vue`](packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/steps/step-1-hearing.vue) | `useHearingStore` | `WHISPER_MODELS`, `useAudioContext`, `MicToggleHotkey`, `HearingDeck` |
| **6: Consciousness** | [`v2/steps/step-2-consciousness.vue`](packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/steps/step-2-consciousness.vue) | `useConsciousnessStore` / `useProvidersStore` | `WEB_LLM_MODELS`, `getWebLlmAdapter()`, `ConsciousnessDeck` |
| **7: Speech (TTS)** | [`v2/steps/step-6-speech.vue`](packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/steps/step-6-speech.vue) | `useSpeechStore` | `kokoro-local`, `pocket-tts-local`, `moss-nano-local`, `VoiceStudioDeck` |
| **Extended: Artistry**| `v2/steps/step-artistry.vue` (New) | `useArtistryStore` | `ArtistryDeck.vue`, ComfyUI endpoint probe, Pollinations fallback |
| **Finale: Calibration**| [`v2/steps/step-7-calibration.vue`](packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/steps/step-7-calibration.vue) | `useOnboardingStore` / `useAiriCardStore` | Readiness Honesty Matrix, Turn 0 Chat Commit, Atomic Assembly |

---

## 7. Exhaustive Acceptance Scenarios

To ensure independent implementers produce uniform, regression-free behavior across Electron desktop, web, and mobile environments, the implementation must satisfy these end-to-end acceptance test scenarios:

### Scenario 1: Cold Quick Start on Low-End / Unsupported Hardware
- **Preconditions**: Fresh install; browser environment with WebGPU disabled or unavailable; no models in cache.
- **Action**: User opens app, sees Step 0 Welcome, and clicks `[ ⚡ Quick Start: Jump Straight to Stage (ReLU) ]`.
- **Expected Outcome**:
  - Stage window opens immediately (<500ms).
  - Seeded `relu-starter` card is persisted to IndexedDB.
  - `onboarding/completed` is set to `true`.
  - Stage HUD displays a non-blocking informational banner: *"Local WebGPU acceleration is unavailable on this device."*
  - System does NOT attempt to download 4GB model shards or hang in a WebGPU worker crash loop.
  - User can type text messages and companion responds with offline starter dialogue.

### Scenario 2: Failed & Partial Cloudflare R2 Restore
- **Preconditions**: Returning user has 3 companions stored in Cloudflare R2. Cloud storage contains cards A, B, and C; card C references an avatar file that was deleted from the bucket.
- **Action**: User authenticates with Cloudflare on Step 0.5. Checks all 3 cards in `SelectiveSyncPanel` and selects Card C as active, then clicks `[ 🚀 Launch Stage with Restored Companions ]`.
- **Expected Outcome**:
  - Cards A and B hydrate completely with all persona and vessel assets.
  - Card C hydrates its card metadata, but its missing avatar triggers the missing asset fallback policy: avatar swaps to default `Hiyori Live2D` starter body.
  - `RestoreResult.status` is `'partial'`, with `assetPresence['card-c'].fallbackAvatarUsed === true`.
  - Stage launches with Card C active.
  - An informational toast appears: *"Restored companion 'Card C' loaded with default avatar (cloud visual asset unavailable)."*
  - `onboarding/completed` is set to `true`. No unhandled promise rejections occur.

### Scenario 3: Bundle Change After Step Verification (Invalidation & Retention)
- **Preconditions**: User on Step 1 selects *The Casual Companion* (Hearing + Speech enabled). Proceeds to Step 5 (Hearing) and speaks into mic; mic level meter reacts and transcription test passes (Status: `Calibrated`).
- **Action**: User clicks `[ < Back ]` to Step 1. Switches Hero Archetype to *The Dynamic Performer*. Then switches audio provider in customizer to Groq Whisper.
- **Expected Outcome**:
  - Previously entered custom persona names and settings are **not erased**.
  - Changing the provider immediately invalidates the prior `Calibrated` status badge; status resets to `Configured (Untested)`.
  - Step rail dynamically re-computes to include Artistry and Sensory steps.
  - Step indicator accurately updates to reflect the new sequence length without hardcoded step counts.

### Scenario 4: Mid-Flow Browser Reload & Resumption
- **Preconditions**: User progresses to Step 6 (Consciousness), selects cloud provider OpenAI, and enters custom API key `sk-test-12345`.
- **Action**: User refreshes the web browser page (`F5` / `Cmd+R`).
- **Expected Outcome**:
  - Application reloads and reads `onboarding/v2-state` (`stepId: 'consciousness'`) and `onboarding/v2-draft`.
  - Wizard resumes directly on Step 6 (Consciousness).
  - Selected provider (`OpenAI`) and entered API key (`sk-test-12345`) are restored from draft.
  - `onboarding/completed` remains `false`. No premature production records were written to IndexedDB.

### Scenario 5: Rapid Back/Next Navigation During Media Previews
- **Preconditions**: User on Step 7 (Voice Studio). Clicks `[ ▶ Play Preview ]` to synthesize Kokoro audio.
- **Action**: While audio is playing, user immediately clicks `[ < Back ]` to Step 6.
- **Expected Outcome**:
  - Audio playback stops immediately.
  - Web AudioContext source node is disconnected/closed.
  - In-flight fetch or synthesis promises are aborted cleanly.
  - No memory leaks or orphaned audio threads playing in the background while viewing Step 6.

### Scenario 6: Repeated Launch Attempts & Idempotent Card Commit
- **Preconditions**: User reaches the Calibration Finale.
- **Action**: User clicks `[ 🚀 Enter AIRI Stage ]`. The card write succeeds in IndexedDB, but a synthetic network error interrupts the final window focus IPC. The user clicks `[ 🚀 Enter AIRI Stage ]` a second time.
- **Expected Outcome**:
  - The second click detects the existing `card.id` generated during the first attempt.
  - Updates the existing card record in `cardsRepo` rather than creating a duplicate duplicate companion.
  - Chat Turn 0 is committed to `chatSessionStore`.
  - `onboarding/completed` is set to `true`.
  - Transient draft is purged.
  - Stage window launches cleanly with exactly one instance of the new companion in the library.

---

## Relevant Skills

- [[airi-onboarding-v2]]
- [[airi-card-schema]]
- [[airi-character-rendering]]
- [[airi-i18n-localization]]


