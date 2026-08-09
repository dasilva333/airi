# Feat: Discord Revamp

## Vision & Goals
Transitioning the Discord integration from a disconnected "second process" bot into a unified service running directly within the main AIRI architecture.

### Core Principles
- **Unified Context**: Interactions flow through the same Episode/Memory logic as the Desktop app (no isolated session IDs).
- **Single Process**: Logic is bundled into AIRI's Tamagotchi services (no separate bot process required).
- **Live Mode**: A low-latency audio bridge connecting Discord VC directly to the Gemini Live WebSocket.
- **Modern UX**: Native Discord Slash Commands (Proper Plugin Model) instead of hacky text guide triggers.

---

## 1. Supported Slash Commands

These commands are registered with Discord and processed natively.

### Implemented Commands

| Command | Arguments | Description |
| :--- | :--- | :--- |
| `/status` | none | Reports active character, model, and module telemetry. |
| `/imagine` | `prompt: string` | Forces a visual generation using the Artistry pipeline. |
| `/director` | `mode: on \| off` | Toggles Autonomous Artistry (on/off). |
| `/character` | `[id: string]` | Switches the active AIRI card/profile directly from Discord. |
| `/new` | `[message: string]` | Creates a new session/reset, optionally sending an initial message. |
| `/history` | `[turns: numeric]` | Dumps the last 5 messages from the current conversation. Optional `turns` overrides default. |
| `/chatmode` | `mode: followup \| steer \| collect` | Changes the message intake queue mode. |
| `/timelines` | `[id: string]` | Lists or switches the active character's chat sessions/timelines. |
| `/summon` | none | Joins the user's current Voice Channel. |
| `/leave` | none | Leaves the Voice Channel. |
| `/journalmoment` | `prompt: string` | Triggers a background text journal summary entry using the specified guidance/instructions. |
| `/voicecall` | `mode: classic \| gemini` | Selects VC engine (Gemini Live [Active/Implemented] vs Classic TTS [Active/Implemented]). |

### Tool Calls Support (Active)
The Discord integration fully supports LLM-driven tool calls (e.g., creating/searching text journal entries, generating/applying images).
- When the bot triggers a tool, it executes natively in the AIRI core context.
- Completed tool executions are appended directly to the bot's Discord responses using a custom, premium visual layout (e.g., showing a neat journal block rather than raw JSON code block dumps).

### Planned / Extended Commands
Advanced toggles and routing capabilities scheduled for future updates.

| Command | Arguments | Description |
| :--- | :--- | :--- |
| `/voicemode` | `mode: puppet \| voicenote \| none` | Controls TTS audio playback location (Desktop speakers, Discord voice notes, or muted). |
| `/vision` | `mode: on \| off` | Toggles VLM processing for image attachments (supported natively, needs simple toggle guard). |
| `/selfie` | `[emotion: string]` | Captures a stage screenshot as is. Optional `emotion` argument overrides expression (needs command trigger wired up). |


---

## 2. Technical Pathing

### Character Identity & Sync
The Discord service will mirror the **Active Character** on the screen.
- `/status` will report the current AI profile.
- All outbound messages will be prefixed with the Character's name (e.g., `Lain: {content}`) for multi-user clarity.

### Artistry & Inline Media
- **Inline Artistry**: Generated images (widgets/backgrounds) from the Artistry pipeline will be returned as native Discord attachments for a seamless experience.
- **Multimodal Image Journal**: The Image Journal acts as the central repository for generated images, backgrounds, and real-time Stage captures (Selfies). It serves as the primary bridge between the character's internal "Artistry" state and the messaging platforms.
- **Selfie Master Spec**: A specialized schema property `selfie: true` within the Image Journal extension.
    - **Trigger**: When the bot encounters an `imageJournal` request with `selfie: true` (either via AI decision or manual Slash command), it invokes the **same camera control function** available in the Desktop **Control Island**.
    - **Execution**: Triggers `visionStore.heartbeat({ force: true })` in the Renderer process.
    - **Routing**: The resulting stage screenshot is captured, processed as an entry in the Background Store (`type: 'selfie'`), and immediately routed to the Discord channel as a high-quality attachment.

### Context Integration
Discord interactions will feed into the central **Prompt Builder**.
- All users in a channel share a single "Episode" unless otherwise configured.
- Memory sync ensures Discord logs appear in the central system audit history.
- **Proactive Messaging**: Implementation of heuristics to route heartbeats/proactive turns to the last active channel used by the user.

### Master Integration Hooks
The unified service layer exposes deep hooks into existing AIRI store logic:
- **Proactivity Hook**: Monitors `proactivityStore` for heartbeat pulses, allowing character-initiated turns to be routed as native Discord messages.
- **Artistry Hook**: Intercepts `artistryStore` generation results (Widgets/Backgrounds/Remixes). When a character "creates" media, it is automatically uploaded as a Discord attachment.
- **State Sync Hook**: Mirrors `airiCardStore` (Name/Avatar/Bio) directly to the Discord Bot's identity via `@moeru/eventa` and `discord.js`.
- **Camera Hook**: Integrates the **Control Island's** capture logic into the messaging flow via the **Image Journal**.

### 🎙️ Audio Delivery & Voice Modes
The `/voicemode` command dictates how speech is handled for standard text messages:
- **`puppet` (Default - Desktop Speakers Only)**:
  *   **Desktop Speaker Playback**: Active (TTS audio plays through the desktop speakers).
  *   **Discord Attachment**: Disabled (does not upload an `.mp3` voice note to the Discord channel).
  *   *Use Case*: Sit at your desk using Discord as a remote controller; hear voice locally without cluttering channel logs.
- **`voicenote` (Discord Attachments Only)**:
  *   **Desktop Speaker Playback**: Disabled (muted locally on desktop app).
  *   **Discord Attachment**: Active (TTS audio chunks are compiled and uploaded as an `.mp3` voice note attachment).
  *   *Use Case*: Away from your desk (e.g. mobile chatting); hear speech from your phone without playing sound at home.
- **`none` (Muted/Text Only)**:
  *   **Desktop Speaker Playback**: Disabled.
  *   **Discord Attachment**: Disabled.
  *   *Use Case*: Silent operation to conserve bandwidth, resources, or API credits.

### 📞 Voice Call Engines
The `/voicecall` command selects the underlying technology for real-time VC sessions:
1. **`gemini` (Modern - Active/Implemented)**:
   - Discord raw audio -> Gemini Live WebSocket -> Discord raw audio.
   - Low latency, "No text" involved during stream.
   - **CRITICAL PENDING parity task (Gemini Voice Call Sync Parity)**: Read/capture the incoming WebSocket stream transcription text events (for both the user and assistant) and ingest them back into the active message logs so the text log stays perfectly in sync with the spoken conversation during the call.

   #### 🔄 Gemini Voice Call Sync Parity & Session Ownership Spec
   To resolve distributed state and context routing during real-time voice calls, we define the **Session Ownership** model:
   - **Single WebSocket Stream Limitation**: The application maintains a single active Gemini Live WebSocket connection (`live-session.ts`).
   - **Session Owner State**:
     - **Desktop-Owned (Local)**: If the Gemini Live session is running locally (no active Discord VC connection), the desktop UI is the owner. No logs are synchronized to Discord.
     - **Discord-Owned (VC)**: If the bot is active in a Discord Voice Channel (via `/summon` in `gemini` voicecall mode), the active Discord text channel is the owner.
   - **Routing Behavior**:
     - While **Discord-Owned (VC)** is active, all input (user) and output (assistant) text transcriptions generated by the WebSocket stream are automatically routed to the target Discord text channel's message logs (updating both the database timeline and posting them as message updates in the channel).
     - Even if local desktop audio/text inputs feed into the stream concurrently, the active VC text channel remains the sync destination.

2. **`tts` (Classic - Active/Implemented)**:
   - Discord audio -> STT -> LLM -> TTS -> Discord audio.
   - Utilizes high-fidelity desktop/local TTS providers and maintains full text log sync.
   - **Real-Time Streaming**: Audio segments are resampled to 24kHz mono PCM in the frontend (using native `OfflineAudioContext`) and streamed in real-time to the main process voice connection via the existing `gemini-audio-chunk` bridge. This keeps playback in sync with local character mouth animations.
   - **Voice Note Compilation**: Uses a custom WAV merging/stitching algorithm on the backend to combine separate chunk files into a single valid WAV attachment for the Discord chat log without player truncation.
   - *Current Caveats*: No real-time speech interruption handling yet, and further text log sync improvements are pending.

---

## 3. Revamped Settings UI: `messaging-discord.vue`

The Settings page will evolve from a simple configuration box into a **Mission Control** dashboard for the Discord service. This provides essential telemetry for the user and critical debugging tools for development.

### UI Summary Table

| Section | Component | Description |
| :--- | :--- | :--- |
| **Connectivity** | Status Badge + Ping | Real-time Gateway health. |
| **Authentication** | Masked Token + Reset | Secure credential management. |
| **Active Presence** | Table of Guilds/VCs | Shows where AIRI is currently "Summoned." |
| **Logic Routing** | Toggle Group | Enable VLM, Global Artistry Sync, Auto-Prefixing. |
| **Developer Console** | Collapsible Log View | Real-time stream of Discord service events. |
| **Debug Actions** | Button Row | [Test Auth] [Force Card Sync] [Restart Service]. |

---

### UI Feature Detail

#### 1. Live Telemetry (The "Heartbeat")
Provides real-time insight into the native service state:
- **Gateway Status**: A "Connected/Disconnected" indicator with a Ping/Latency readout.
- **Active Guilds/Channels**: A list of where AIRI is currently "present" or "summoned."
- **Shard Info**: Visible scaling data (which shard the local process is handling).

#### 2. Implementation Helpers (The "Dev Dashboard")
Tools to ease development and verification of the new pipeline:
- **Event Stream**: A small, scrollable log of raw Discord events (`MESSAGE_CREATE`, `INTERACTION_CREATE`) to monitor incoming traffic without checking the terminal.
- **"Force Sync" Button**: Immediately pushes the current AIRI Card (Avatar/Bio) to Discord's API to test identity synchronization.
- **"Simulate Event"**: Triggers a mock Discord message from the UI to test context routing and attribution logic.

#### 3. Granular Configuration (The "Controls")
- **Identity Sync Toggle**: Options for how AIRI appears (e.g., "Always use Desktop Character Name" vs. "Use Discord Nickname").
- **Multimodal Toggles**: Enabling/disabling inbound image processing for VLM context.
- **Voice Gates**: Configuration for "Kill Switch" sensitivity and Voice Activity thresholds for the Phase 4 bridge.
- **Access Control & DMs Security**:
  - **Allow Direct Messages (DMs)**: Master toggle to enable/disable bot interactions (slash commands and text messages) in private DMs. Defaults to `false` for absolute safety.

---

## 4. Implementation Roadmap

### Phase 1: Service Migration (No 2nd Process)
The logic will be moved from `services/discord-bot` into a native Electron service. This removes the need for a separate process and WebSocket bridge.
- **Service Root**: `apps/stage-tamagotchi/src/main/services/airi/discord/`
- **Entry Point**: `apps/stage-tamagotchi/src/main/services/airi/discord/index.ts`
- **DI Registration**: Injected into `Injeca` via `apps/stage-tamagotchi/src/main/index.ts`.

### Phase 2: Native Interaction Plugin
Transitioning from passive message listening to a structured Interaction model.
- **REST Registration**: On service start, the bot will use `REST` and `Routes.applicationCommands` to push the schema (built via `SlashCommandBuilder`) to Discord. This enables the native `/` autocomplete UI.
- **Registry Structure**: A new `commands/` directory in the main process will house individual command files. Each file exports a `data` (schema) and an `execute` (logic) function.
- **Interaction Handler**: The service will listen for `Events.InteractionCreate`. It will map the `commandName` to our local registry and execute the corresponding function, ensuring a native "AIRI is thinking..." state is shown during long operations.

### Phase 3: Character & Context Unification
Synchronizing the bot with the Desktop renderer state.
- **State Sync**: Uses `@moeru/eventa` to track the active character profile.
- **Prefix Logic**: Automatically prefixes messages with the character's name (e.g. `Lain: {text}`).
- **Context Routing**: Discord messages are sent via IPC to the Renderer's `ChatStore`, ensuring they pass through the same **Prompt Builder** and **Memory layers**.

### Phase 4: Gemini Live Audio Bridge (Experimental)
The "Holy Grail" of voice interaction on Discord.
- **Pipe**: Connects the Discord `VoiceConnection` (Opus stream) directly to the `GeminiLiveService` WebSocket.
- **Effect**: Real-time, full-duplex audio without text serialization.

---

## 5. Key Files for Adjustment

### [Main Process (Tamagotchi)]
- **[NEW]** `apps/stage-tamagotchi/src/main/services/airi/discord/service.ts`
- **[NEW]** `apps/stage-tamagotchi/src/main/services/airi/discord/commands/*.ts`
- **[MODIFY]** `apps/stage-tamagotchi/src/main/index.ts` (Service injection)
- **[MODIFY]** `apps/stage-tamagotchi/src/shared/eventa.ts` (IPC contracts)

### [Renderer Process (Stage UI)]
- **[MODIFY]** `packages/stage-ui/src/stores/modules/discord.ts` (UI state management)
- **[MODIFY]** `packages/stage-pages/src/pages/settings/modules/messaging-discord.vue` (Unified toggle)

### [Project Cleanup]
- **[DELETE]** `services/discord-bot/` (Deprecated legacy process)
- **[MODIFY]** `package.json` (Adding `@discordjs/voice`, `libsodium-wrappers`, and `@discordjs/opus` to core dependencies)

---

## 6. Interactive Message Widgets (Discord Components)

To replace repetitive text-based commands, the integration features native, click-driven widgets leveraging Discord's Action Rows and Message Components (Buttons).

### A. Timeline Management: `/timelines`
Displays the active character's chat timelines, allowing pagination, switching, and quick branching actions.
*   **Rows 1-4 (Timeline Entries):**
    *   `Button` (Style: Success/Green): **Select** (Triggers `/timelines <id>` for that entry)
    *   `Button` (Style: Primary/Blurple): **Fork** (Creates a new branch/timeline from this point)
    *   *Visual Helper:* Text displays the timeline name and last active timestamp (e.g., `Timeline A (10 mins ago)`).
*   **Row 5 (Navigation & Control):**
    *   `Button` (Style: Secondary/Grey): **◀️ Previous Page**
    *   `Button` (Style: Secondary/Grey): **▶️ Next Page**
    *   `Button` (Style: Primary/Blurple): **➕ New Timeline**

### B. Character Selector: `/characters`
Enables users to browse through installed character cards, view details, and switch the active companion.
*   **Rows 1-4 (Character Entries):**
    *   `Button` (Style: Success/Green): **Switch** (Triggers `/character <id>`)
    *   `Button` (Style: Secondary/Grey): **Details** (Prints a transient/ephemeral summary of bio and status)
    *   *Visual Helper:* Text displays the character's name.
*   **Row 5 (Navigation Control):**
    *   `Button` (Style: Secondary/Grey): **◀️ Previous Page**
    *   `Button` (Style: Secondary/Grey): **▶️ Next Page**

### C. Session & Modality Control: `/manage`
The `/manage` dashboard. The message body itself is the existing `/status` text readout. Clicking any button updates the corresponding state and automatically refreshes the `/status` body text.
*   **Row 1: Voice Mode (`/voicemode`)**
    *   `Button` (Style: Success/Green if active, else Grey): **🔊 Puppet** (Local desktop speakers)
    *   `Button` (Style: Success/Green if active, else Grey): **📝 Voice Note** (Uploads spoken lines as audio attachments)
    *   `Button` (Style: Danger/Red if active, else Grey): **🔇 Mute** (Text-only responses)
*   **Row 2: Voice Call (`/voicecall`)**
    *   `Button` (Style: Primary/Blurple if active, else Grey): **📞 Gemini** (Real-time live WebSocket stream)
    *   `Button` (Style: Primary/Blurple if active, else Grey): **⚙️ Classic TTS** (STT -> LLM -> TTS pipeline)
*   **Row 3: Chat Mode (`/chatmode`)**
    *   `Button` (Style: Success/Green if active, else Grey): **📥 Follow-up**
    *   `Button` (Style: Success/Green if active, else Grey): **🎯 Steer**
    *   `Button` (Style: Success/Green if active, else Grey): **🔋 Collect**
*   **Row 4: Modules (Toggles)**


---

## 7. Future Exploration: Cloud Edge & Micro-VM Relay Architecture (`/togglebot` On-Demand Gateway Gating)

### A. The Protocol Challenge: Serverless vs. Persistent Gateway
Cloudflare Workers provide zero-cost, instant global execution for HTTP Interaction Webhooks (`/slash` commands, buttons), but **cannot maintain persistent WebSocket connections (`wss://gateway.discord.gg`) for raw chat message events (`MESSAGE_CREATE`)** due to serverless execution lifetimes.

To enable raw chat channel listening (`MESSAGE_CREATE`) without sacrificing zero-cost edge hosting or burning compute limits, we specify a **Hybrid Cloud Relay Architecture**.

---

### B. Multi-Hosting Viability Assessment: Fly.io vs. Render vs. Railway

| Platform | Runtime Architecture | `MESSAGE_CREATE` Persistent WebSocket Support | Free Allowance / Plan Structure | Viability Verdict |
| :--- | :--- | :---: | :--- | :--- |
| **Fly.io** | Firecracker Micro-VMs (Docker) | ✅ **Native (24/7 background VM)** | $5 monthly credit / trial allowance (~$2/mo for 256MB micro-VM) | 🌟 **Top Recommendation** (Fast, global edge micro-VMs) |
| **Railway.app** | Container Micro-VMs | ✅ **Native** | $5 monthly credit / usage-based | 🌟 **Strong Alternative** (Zero-config Docker deployment) |
| **Render.com** | Container Web Services | ⚠️ **Limited** (Free tier sleeps after 15m idle) | 750 free hours/mo (Sleeps on idle) | ⚠️ **Requires wake ping** |

---

### C. Zero-Sacrifice `/togglebot` On-Demand Gateway Gating

To maximize compute efficiency and ensure zero wasted usage limits across hosting providers:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   /togglebot On-Demand Gateway Gating Flow                  │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. Default State (100% Free Cloudflare Edge):                                │
│    • Bot handles all /slash commands (/status, /imagine, /character) via    │
│      Cloudflare Workers HTTP Interaction Webhooks.                          │
│    • Gateway daemon on Fly.io / Railway is in STANDBY / DORMANT state.      │
│                                                                             │
│ 2. Upgraded State (/togglebot on):                                          │
│    • User types `/togglebot mode:on` in a Discord text channel.             │
│    • Cloudflare Worker signals the Fly.io / Railway micro-VM daemon.        │
│    • Daemon activates the `MESSAGE_CREATE` Gateway socket bridge for that    │
│      channel, turning AIRI into a full active channel participant.          │
│                                                                             │
│ 3. Standby Reset (/togglebot off):                                          │
│    • User types `/togglebot mode:off` or inactivity timer expires.          │
│    • Daemon disconnects the `MESSAGE_CREATE` listener, dropping back to     │
│      dormant standby state to conserve monthly compute limits.             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### New Command Specification:
| Command | Arguments | Description |
| :--- | :--- | :--- |
| `/togglebot` | `mode: on \| off` | Toggles the persistent `MESSAGE_CREATE` Gateway listener daemon on Fly.io / Railway, enabling full chat channel participation on-demand. |

---

