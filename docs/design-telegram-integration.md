# Project Design: Telegram Integration (Local Service & Pure HTTP Cloud Relay)

**Status:** Proposed Architecture & Design Specification
**Target Workspaces:** `apps/stage-tamagotchi` (Local Service) & `apps/stage-edge` (Cloud Relay Worker)

**Related Documents:**
- [`design-cloud-relay.md`](./design-cloud-relay.md) — Universal Cloud Relay architecture & Cloudflare Edge KV memory model.
- [`feat-discord-revamp.md`](./feat-discord-revamp.md) — In-process messaging platform service pattern & interactive component UX.
- [`design-discord-context-routing.md`](./design-discord-context-routing.md) — Multi-user channel context isolation & ACL permission matrix.

---

## 1. Executive Summary & Vision

Telegram is one of AIRI's core community channels. The legacy implementation (`services/telegram-bot/`) was built as a standalone, server-side Node.js process requiring a dedicated PostgreSQL database, Ollama embedding instance, and Docker Compose setup.

This design document modernizes Telegram integration into AIRI's unified architecture:
1. **Local Desktop Service Mode (`stage-tamagotchi`)**: An in-process service running directly inside AIRI's Tamagotchi application, sharing the active character card, memory layers, and prompt builder.
2. **Remote Cloud Relay Mode (`stage-edge`)**: A 100% serverless, zero-cost Cloudflare Worker deployment.

---

## 2. The Pure HTTP Webhook Advantage (Telegram vs. Discord)

A critical architectural distinction makes Telegram **vastly superior for serverless edge hosting**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Telegram Pure HTTP Webhook Advantage                     │
├──────────────────────────────────────────┬──────────────────────────────────┤
│ 🟦 Discord API Protocol                  │ ✈️ Telegram Bot API (setWebhook) │
├──────────────────────────────────────────┼──────────────────────────────────┤
│ • Raw chat messages (MESSAGE_CREATE)     │ • ALL events (chat text, photos,  │
│   require persistent WebSockets (wss://).│   stickers, commands, buttons)    │
│ • Requires micro-VM container daemons    │   are pushed as HTTP POST webhooks│
│   (Fly.io / Railway) for 24/7 listening. │   directly to the Webhook URL!   │
│ • Complex heartbeat & reconnect logic.   │ • 100% Serverless Edge Native!   │
└──────────────────────────────────────────┴──────────────────────────────────┘
```

### Zero Container Overhead:
- **No Fly.io / Railway Micro-VMs Required**: Because Telegram pushes `MESSAGE_CREATE` updates via HTTP POST (`setWebhook`), a standard Cloudflare Worker receives **100% of all chat interactions out-of-the-box**.
- **Zero Idle Compute**: Compute runs strictly when a user sends a message. The worker wakes (<5ms), reads KV context, executes LLM inference, posts the reply, and goes dormant.
- **100% Free Tier Compatibility**: Easily stays within Cloudflare Workers' 100k free requests/day allowance.

---

## 3. Dual Deployment Modes

AIRI supports two complementary deployment models depending on user preference:

```
                  ┌─────────────────────────────────────────┐
                  │          AIRI Control Plane             │
                  │   (Desktop Studio / Authoring UI)       │
                  └────────────────────┬────────────────────┘
                                       │
                   ┌───────────────────┴───────────────────┐
                   ▼                                       ▼
    ┌─────────────────────────────┐         ┌─────────────────────────────┐
    │     MODE A: LOCAL SERVICE   │         │    MODE B: REMOTE RELAY     │
    │    (apps/stage-tamagotchi)  │         │     (apps/stage-edge)       │
    ├─────────────────────────────┤         ├─────────────────────────────┤
    │ • Runs in AIRI main process │         │ • Stateless Cloudflare      │
    │ • Long-polling / Webhook    │         │   Worker on Edge            │
    │ • Shares Desktop Memory     │         │ • Cloudflare KV Memory      │
    │ • Desktop must be powered ON│         │ • 24/7 Always-On (PC OFF)   │
    └─────────────────────────────┘         └─────────────────────────────┘
```

### Mode A: Local In-Process Service (`stage-tamagotchi`)
- **Use Case**: Sit at your desk using Telegram on your phone or desktop as a remote controller for AIRI.
- **Implementation**: The service runs inside `apps/stage-tamagotchi`. Incoming Telegram updates flow through `chatOrchestrator.ingest()`, passing through the same **Prompt Builder**, **Card Store**, and **Memory System** as the desktop app.
- **Identity Sync**: Outbound messages mirror the active desktop character card (name, avatar, tone).

### Mode B: Remote Cloud Relay (`stage-edge`)
- **Use Case**: 24/7 mobile access when the desktop PC is powered off or during commutes.
- **Implementation**: Deploys a stateless Cloudflare Worker with a Cloudflare KV namespace (`airi-kv-<characterId>`).
- **Webhook Binding**: The worker issues `setWebhook({ url: 'https://airi-relay.workers.dev/telegram' })` on deployment.

---

## 4. Multimodal & Media Handling

Telegram users rely heavily on stickers, voice notes, and photo attachments. The integration handles media cleanly while establishing strict protocol boundaries:

### 4.1 Protocol Boundaries: Voice Notes vs. Real-Time Voice Calls

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 Protocol Boundaries: Voice Notes vs. Calls                  │
├──────────────────────────────────────────┬──────────────────────────────────┤
│ ❌ Voice Calls (/voicecall)              │ 🎙️ Voice Notes (/voicemode)       │
├──────────────────────────────────────────┼──────────────────────────────────┤
│ • UNSUPPORTED on Telegram Bot API.       │ • FULLY SUPPORTED on Telegram.   │
│ • Telegram Voice Chats require MTProto   │ • Sends outbound .ogg (Opus) /   │
│   userbots (violates serverless edge).   │   .mp3 voice note attachments    │
│ • Marked as explicitly UNSUPPORTED.      │   directly to Telegram chats!    │
└──────────────────────────────────────────┴──────────────────────────────────┘
```

### 4.2 Outbound Voice Note Audio Pipeline (Traced from `discord.ts`)

Following the audio delivery architecture in `packages/stage-ui/src/stores/modules/discord.ts` (lines 2170–2205):

```
[TTS Worker / Speech Store]
          │
          ▼ (Emits PCM Audio Chunks)
[OfflineAudioContext (Main Thread)]
          │
          ▼ (24kHz Mono Resampling & Peak Normalization)
[WAV Stitching Engine]
          │
          ▼ (Appends 44-byte RIFF/WAVE Header)
[IPC / Eventa Bridge (`sendVoiceToTelegram`)]
          │
          ▼
[Telegram Bot API: sendVoice / sendAudio Webhook]
```

1. **TTS Audio Generation**: When the character speaks, `speechStore` / worker emits raw PCM audio chunks.
2. **Resampling**: `OfflineAudioContext` in the main thread resamples audio to 24kHz mono PCM.
3. **WAV/Opus Stitching**: A DataView constructs a valid 44-byte WAV header (`RIFF` marker + 16kHz/24kHz sample rate + 16-bit depth).
4. **IPC / Webhook Dispatch**: Transferred as base64 to the Cloud Relay or Local Telegram service, which issues `sendVoice({ chat_id, voice: audioBlob })` to Telegram.

---

### 4.3 Incoming User Voice Note Ingestion (Two-Way Asynchronous Voice Dialogue)

Unlike Discord (where normal users cannot send voice notes in text channels), **Telegram allows users to record and send voice notes (`.ogg` / Opus) directly to the bot**.

AIRI leverages this to support **Full Two-Way Asynchronous Spoken Dialogue**:

```
[User records Voice Note on Phone (Telegram)]
          │
          ▼ (Telegram Webhook: message.voice { file_id })
[Telegram Bot API: getFile(file_id)]
          │
          ▼ (Downloads .ogg / Opus Audio Binary)
[AIRI Hearing Pipeline (`transcribeForRecording`)]
          │
          ▼ (Local Whisper WASM / Groq STT)
[Transcribed Text String]
          │
          ▼
[`chatOrchestrator.ingest(text, { metadata })`]
          │
          ▼ (Generates Assistant Reply + Outbound TTS Voice Note)
[AIRI Outbound Voice Note (.ogg / .mp3) sent to User!]
```

#### Step-by-Step Processing Flow:
1. **Webhook Ingestion**: Telegram delivers a `message.voice` object containing `file_id` and duration.
2. **Audio Download**: The service requests the audio file URL via `bot.api.getFile(file_id)` and fetches the `.ogg` binary buffer.
3. **STT Transcription**: The buffer is passed to `useHearingSpeechInputPipeline().transcribeForRecording(audioBlob)`.
4. **Orchestrator Feed**: The transcribed text is ingested via `chatOrchestrator.ingest(transcribedText)`, attributing the message to the Telegram user.
5. **Two-Way Loop**: If `/voicemode voicenote` is active, AIRI's reply is synthesized via TTS and returned as an outbound voice note attachment—enabling hands-free spoken conversations while walking or commuting!

---

### 4.4 Media Matrix Overview

| Media Type | Processing Strategy | Execution Pipeline |
| :--- | :--- | :--- |
| **Text Messages** | Direct text ingestion into Prompt Builder | Unified Chat Engine |
| **Photos / Screenshots** | Passed to Vision LLM (BLIP / Moondream / GPT-4o) | Visual Context Ingestion |
| **Telegram Stickers (`.webp` / `.tgs` / `.webm`)** | Converted to static image frame for Vision LLM interpretation | Canvas / WebCodecs / FFmpeg |
| **Voice Notes (`.ogg` / Opus)** | Transcribed via Whisper / Speech STT | Audio Ingestion Pipeline |
| **Outbound TTS Spoken Lines** | Encoded as `.mp3` / `.ogg` voice note attachments | Pocket TTS / Kokoro / ElevenLabs |

---

## 5. Telegram Interactive Widget DSL & Button Callback Architecture

Following the interactive component pattern established in Discord's `/status` and `/timelines` dashboard widgets (`packages/stage-ui/src/stores/modules/discord.ts`), Telegram leverages native **Inline Keyboards** (`InlineKeyboardMarkup`) and `callback_query` updates to provide a responsive, in-place dashboard without generating chat log clutter:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                  AIRI Telegram Interactive Status Dashboard                  │
├─────────────────────────────────────────────────────────────────────────────┤
│ 🎭 Active Character: Gura (Seaside Cottage)                                  │
│ 🧠 Active Engine: Gemini 2.5 Flash | 🔊 Voice Mode: Voice Note              │
│ 📜 Active Timeline: Seaside Date #3 (id: sess_941a, 42 turns)               │
├─────────────────────────────────────────────────────────────────────────────┤
│ [ 🔊 Voice Note ]  [ 🔊 Puppet ]  [ 🔇 Mute ]                               │
│ [ 🎭 Character Browser ]  [ 📜 Timeline Browser ]  [ 📸 Take Selfie ]        │
│ [ 🔄 Refresh Dashboard ]                                                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Callback Query Dispatcher (`callback_query` Handling)
When a user taps an inline button on Telegram, Telegram fires a `callback_query` HTTP POST payload containing `callback_data` (e.g. `'voicemode:puppet'` or `'timelines:select:sess_123'`).

```typescript
// 1. Telegram Inline Keyboard Payload Structure
const inlineKeyboard = {
  reply_markup: {
    inline_keyboard: [
      [
        { text: mode === 'voicenote' ? '🟢 Voice Note' : '🔊 Voice Note', callback_data: 'voicemode:voicenote' },
        { text: mode === 'puppet' ? '🟢 Puppet' : '🔊 Puppet', callback_data: 'voicemode:puppet' },
        { text: mode === 'none' ? '🟢 Mute' : '🔇 Mute', callback_data: 'voicemode:none' },
      ],
      [
        { text: '🎭 Character Browser', callback_data: 'widget:characters:0' },
        { text: '📜 Timeline Browser', callback_data: 'widget:timelines:0' },
        { text: '📸 Take Selfie', callback_data: 'action:selfie' },
      ],
      [
        { text: '🔄 Refresh Dashboard', callback_data: 'widget:status:refresh' },
      ],
    ],
  },
}

// 2. In-Place Widget Update
await bot.api.answerCallbackQuery(callbackQueryId, { text: 'Voice mode updated!' })
await bot.api.editMessageText(chatId, messageId, updatedDashboardMarkdown, inlineKeyboard)
```

---

### Interactive Sub-Widgets:

#### A. Character Browser Widget (`widget:characters:<page>`)
- **Interactive List**: Displays a paginated list of installed AIRI cards with `Select #N` buttons.
- **In-Place Swap**: Clicking a character button invokes `airiCardStore.setActiveCard(id)` and updates the Telegram bot presence, avatar, and system prompt immediately.

#### B. Timeline Browser Widget (`widget:timelines:<page>`)
- **Timeline Pagination**: Lists active chat sessions inside the current Universe.
- **Actions**:
  - `Select #N` (`timelines:select:<sessionId>`): Switches the active conversation session.
  - `Fork #N` (`timelines:fork:<sessionId>`): Creates a new conversation branch from that checkpoint.

#### C. Selfie / Stage Capture Trigger (`action:selfie`)
- Triggers `visionStore.heartbeat({ force: true })` on the active Desktop stage.
- Captures the current Live2D/3D model pose & camera view and sends the resulting screenshot image back to the Telegram chat as a high-quality photo attachment!

---

## 6. Native Slash Commands Reference

| Command | Arguments | Description |
| :--- | :--- | :--- |
| `/status` | none | Renders the interactive Status Dashboard widget. |
| `/character` | `[id: string]` | Opens the Character Browser widget or switches directly by ID. |
| `/imagine` | `prompt: string` | Triggers the Artistry pipeline to generate an image attachment. |
| `/selfie` | `[emotion: string]` | Captures a live Stage screenshot and sends it as a photo attachment. |
| `/timelines` | `[id: string]` | Opens the Interactive Timeline Browser widget. |
| `/voicemode` | `mode: puppet \| voicenote \| none` | Sets TTS audio output mode. |


---

## 7. Real-Time Text Streaming: Debounced SSE & `onMessageUpdate` Protocol

Standard messaging bots wait for full LLM completion before sending a single massive text block—creating a laggy, unresponsive feel. AIRI introduces **Debounced Real-Time SSE Streaming** on Telegram, matching the fluid "typing out" experience of the Desktop web interface while respecting Telegram's HTTP rate limits.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 Debounced Real-Time SSE Text Streaming Protocol             │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. Initial Webhook & Placeholder Reply:                                     │
│    • User sends message $\rightarrow$ Cloud Relay Worker responds immediately. │
│    • Bot posts placeholder message: "AIRI is typing..." $\rightarrow$ returns   │
│      Telegram `message_id`.                                                 │
│                                                                             │
│ 2. SSE Stream Accumulator & Debounced Emitter:                              │
│    • LLM streams tokens via SSE (`onMessageUpdate` callback).               │
│    • Worker buffers incoming tokens into a local text accumulator.          │
│    • A Debounced Emitter (800ms – 1,200ms interval throttle) fires:          │
│      `bot.api.editMessageText(chatId, messageId, accumulatedText)`          │
│    • User sees AIRI's response type out smoothly in real-time chunks!       │
│                                                                             │
│ 3. Rate-Limit Safety & Final Lock (`[DONE]`):                               │
│    • Telegram `editMessageText` rate limit: ~1 request/sec per chat.        │
│    • 800ms–1,200ms debounce rate fits 100% within Telegram rate limits!    │
│    • On final stream token (`[DONE]`), locks the final completed message    │
│      and appends any relevant Inline Keyboard buttons.                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### TypeScript Code Pattern (`apps/stage-edge/src/telegram/stream-handler.ts`):

```typescript
export async function handleStreamingTelegramReply(
  bot: Bot,
  chatId: number,
  stream: AsyncIterable<{ text?: string }>,
) {
  // 1. Send initial placeholder message
  const sentMessage = await bot.api.sendMessage(chatId, '💭 *AIRI is thinking...*', {
    parse_mode: 'Markdown',
  })
  const messageId = sentMessage.message_id

  let accumulatedText = ''
  let lastEditTime = 0
  const DEBOUNCE_INTERVAL_MS = 1000 // 1s throttle rate fits Telegram rate limits cleanly

  // 2. Consume SSE token stream
  for await (const chunk of stream) {
    if (!chunk.text)
      continue
    accumulatedText += chunk.text

    const now = Date.now()
    // Throttle editMessageText calls to avoid Telegram 429 Too Many Requests
    if (now - lastEditTime >= DEBOUNCE_INTERVAL_MS) {
      lastEditTime = now
      await bot.api.editMessageText(chatId, messageId, accumulatedText, {
        parse_mode: 'Markdown',
      }).catch((err) => {
        // Ignore duplicate content errors if stream text didn't change
        if (!err.message?.includes('message is not modified')) {
          console.warn('[Telegram Stream] Throttle edit warning:', err.message)
        }
      })
    }
  }

  // 3. Final Lock: Send full completed response
  await bot.api.editMessageText(chatId, messageId, accumulatedText, {
    parse_mode: 'Markdown',
  })
}
```

---

## 8. Versioned Command Auto-Syncing (`setMyCommands` Protocol)

Following the command registration and versioning pattern in `packages/stage-ui/src/stores/modules/discord.ts` (lines 480–498), Telegram slash commands are registered dynamically with Telegram's Bot API whenever the command version increases or upon initial deployment:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                Versioned Command Auto-Sync Pipeline                         │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. Version Increment Check:                                                 │
│    • `TELEGRAM_COMMANDS_VERSION` constant (e.g. `v1`).                     │
│    • Compares against `lastRegisteredVersion` in local storage / KV.       │
│                                                                             │
│ 2. Command Sync Execution (`setMyCommands`):                                │
│    • If `lastRegisteredVersion < TELEGRAM_COMMANDS_VERSION` (or `force=true`):│
│      Issues `bot.api.setMyCommands(TELEGRAM_CORE_COMMANDS)`.                │
│    • Updates Telegram's native command menu popover instantly for all users!│
└─────────────────────────────────────────────────────────────────────────────┘
```

### TypeScript Code Pattern (`apps/stage-edge/src/telegram/commands-sync.ts`):

```typescript
const TELEGRAM_COMMANDS_VERSION = 1

export const TELEGRAM_CORE_COMMANDS = [
  { command: 'status', description: 'View AIRI status dashboard & interactive controls' },
  { command: 'character', description: 'Switch active AIRI character profile' },
  { command: 'imagine', description: 'Generate a visual image using Autonomous Artistry' },
  { command: 'selfie', description: 'Capture a live Stage screenshot of active character' },
  { command: 'timelines', description: 'Open interactive chat timeline browser' },
  { command: 'voicemode', description: 'Set TTS voice mode (puppet, voicenote, none)' },
  { command: 'new', description: 'Reset chat session and start fresh' },
]

export async function syncTelegramCommands(bot: Bot, lastVersion: number, force = false): Promise<number> {
  if (!force && lastVersion >= TELEGRAM_COMMANDS_VERSION) {
    console.log(`[Telegram] Commands up to date (v${lastVersion})`)
    return lastVersion
  }

  try {
    console.log(`[Telegram] Syncing commands with Telegram API (v${TELEGRAM_COMMANDS_VERSION})...`)
    await bot.api.setMyCommands(TELEGRAM_CORE_COMMANDS)
    return TELEGRAM_COMMANDS_VERSION
  }
  catch (err) {
    console.error('[Telegram] Failed to sync commands:', err)
    return lastVersion
  }
}
```

---

## 9. Telegram Mini Apps Architecture: Dedicated Mobile Stage & Control Island

Telegram Mini Apps (`Telegram.WebApp`) run full HTML5/Vue 3 web applications inside Telegram's mobile and desktop apps. By pairing AIRI's Electron local host process (`apps/stage-tamagotchi`) with a secure tunnel (e.g. Cloudflare Tunnel or local HTTPS proxy), tapping an **`🎭 Open Companion Stage`** button in Telegram opens a dedicated mobile UI connected directly to your desktop AIRI instance!

```
┌─────────────────────────────────────────────────────────────────────────────┐
│               Telegram Mini App Architecture & Dual-Phase Roadmap           │
├─────────────────────────────────────────────────────────────────────────────┤
│ 📱 Telegram Mobile App (`Telegram.WebApp` iframe)                            │
│    ├── Phase 1 (Fast-Path): Web-Stage Responsive View                      │
│    │   • Loads existing `@proj-airi/stage-pages` responsive canvas.        │
│    │   • Session detection identifies Telegram client via `initDataUnsafe`. │
│    └── Phase 2 (Dedicated Mobile Stage & Remote Control Island):            │
│        • Custom 60fps Live2D/3D Mobile Stage view optimized for portrait. │
│        • Remote Control Panel (Trigger emotions, take selfies, toggle AI).  │
│        • WebRTC / WebSocket Gemini Live real-time Voice Call bridge!        │
├─────────────────────────────────────────────────────────────────────────────┤
│ 🌐 Cloud Relay / Tunnel (`apps/stage-edge` / Cloudflare Tunnel)             │
│    └──► Secure HTTPS / WebSocket Bridge to Local Desktop AIRI Host.         │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 9.1 Phased Rollout Plan:

#### Phase 1: Web-Stage Responsive Embed (Quick Win)
- **Host Route**: Serves `@proj-airi/stage-pages` at `#/telegram-miniapp` via local host process.
- **Session Detection**: Uses `window.Telegram.WebApp.initDataUnsafe` to authenticate the user and adjust UI parameters.
- **Responsive Layout**: Adjusts stage canvas aspect ratio automatically to fit portrait mobile viewports.

#### Phase 2: Dedicated Mobile Telegram Avatar Stage & Remote Control Island
- **Dedicated Mobile Canvas**: A lightweight, mobile-optimized Vue 3 component rendering AIRI's Live2D avatar (`@proj-airi/stage-ui-live2d`) with low-bandwidth texture scaling and touch gesture support (head pats, drags).
- **Remote Director's Control Panel**:
  - Expression & Motion Triggers (`blush`, `happy`, `flustered`, `surprised`).
  - Stage Controls (Lighting, background scene swaps, camera angles).
  - Snapshot Trigger (Captures high-res 4K selfie on desktop and sends to phone).
- **WebRTC Voice Call Bridge**: Opens a direct WebRTC stream to AIRI's `live-session.ts` (Gemini Live), bypassing Telegram Bot API limitations to deliver **Real-Time Low-Latency Voice Calls inside Telegram!**

---

## 10. Security ACL & Local Long-Polling Dev Mode

To ensure complete privacy and ease of local development, AIRI implements granular access control and a zero-tunnel local development mode:

### 10.1 Security & Access Control (ACL)
1. **User ID / Chat ID Whitelisting**:
   - `allowedUserIds: number[]` — Restricts bot interaction strictly to your authorized Telegram User IDs.
2. **Webhook Secret Token Verification**:
   - Every incoming HTTP POST request from Telegram is verified against `X-Telegram-Bot-Api-Secret-Token` configured during `setWebhook`.
3. **Group Chat Mention Guard**:
   - In group chats, AIRI responds only when explicitly mentioned (`@AiriBot`) or when replying directly to AIRI's messages.

---

### 10.2 Local Development Mode: Long Polling (`getUpdates`) Fallback
When developing locally inside `apps/stage-tamagotchi` without a Cloudflare Tunnel or public HTTPS URL:
- **Automatic Fallback**: If no public webhook URL is configured in settings, the local service automatically switches from Webhook mode (`setWebhook`) to **Long Polling mode (`bot.start()`)**.
- **Tunnel-Free Dev Experience**: You can test the Telegram integration on your local machine offline with zero ngrok or tunnel setup!

---

## 11. Summary of Migration & Implementation Roadmap

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Telegram Migration Plan                              │
├─────────────────────────────────────────────────────────────────────────────┤
│ Phase 1: Codify Architecture & Design Spec (This Document) ✅                │
│ Phase 2: Implement Telegram Webhook & SSE Streamer in `apps/stage-edge`     │
│ Phase 3: Implement In-Process Telegram Service & Polling in `stage-tamagotchi`│
│ Phase 4: Implement Telegram Mini App Mobile Stage & Control Island         │
│ Phase 5: Deprecate Legacy `services/telegram-bot/` (Remove Docker/Postgres)│
└─────────────────────────────────────────────────────────────────────────────┘
```

## Relevant Skills

- [[airi-discord-integration]]
