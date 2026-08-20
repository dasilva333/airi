---
title: Discord Slash Commands
description: Complete reference for AIRI's Discord slash commands, setup, and how they work.
---

# Discord Slash Commands

AIRI's Discord integration lets you interact with your AI directly from Discord using native slash commands. This page covers everything from getting started to the full command reference.

---

## Setup: Getting a Bot Token

To use AIRI on Discord, you need a Discord Bot Token from the [Discord Developer Portal](https://discord.com/developers/applications).

### Step-by-Step

1. Go to [https://discord.com/developers/applications](https://discord.com/developers/applications).
2. Click **New Application**, give it a name (e.g., "AIRI"), and create it.
3. Go to the **Bot** tab on the left sidebar.
4. Under the **Token** section, click **Reset Token** (or copy the existing one if available).
5. Copy the token — this is your `DISCORD_BOT_TOKEN`.
6. Under **Privileged Gateway Intents**, enable:
   - **Message Content Intent** (required for reading messages).
   - **Server Members Intent** (recommended).
   - **Voice State Intent** (required for voice commands like `/summon`).
7. Go to the **OAuth2 > URL Generator** tab.
8. Select scopes: `bot` and `applications.commands`.
9. Select permissions:
   - `Send Messages`
   - `Read Message History`
   - `Use Slash Commands`
   - `Connect` and `Speak` (for voice features)
   - `Attach Files` (for selfies and generated images)
10. Use the generated URL to invite the bot to your server.

### Configure in AIRI

Once you have the token, open AIRI's **Settings > Discord** (under *Messaging*), paste the token, and enable the integration. AIRI will automatically register all slash commands with Discord.

---

## How Slash Commands Work

AIRI's slash commands are registered with Discord's API using `SlashCommandBuilder` from `discord.js`. On service startup, AIRI pushes the command schema via Discord's REST API so your server sees the native `/` autocomplete UI.

When you type a command:

1. Discord sends an `INTERACTION_CREATE` event to AIRI.
2. AIRI's interaction handler maps the `commandName` to its local registry.
3. The corresponding `execute` function runs, showing **"AIRI is thinking..."** while processing.
4. The result is posted back to the channel as a native Discord message — often with rich embeds or file attachments.

All interactions flow through the same **Episode/Memory** system as the desktop app, so Discord conversations are synced with your chat history.

## Tool Calls

AIRI's built-in tools (text journal, stickers, stage widgets, MCP, dating sim) are **available from Discord** — not just from the desktop Whisperbox. When you send a message from Discord, it enters the same LLM pipeline as desktop input. The tools array is resolved via a global fallback (`toolsResolver`), so you can ask AIRI to write into her journal, spawn a widget, or call MCP tools directly from a Discord channel.

The only case where tools are disabled is when you send an image attachment — vision models often don't support tool calling, and this applies to all sources equally (Discord, desktop, voice).

---

## Command Reference

### Core Commands

These are the essential commands available in the baseline integration.

| Command | Arguments | Description |
| :--- | :--- | :--- |
| `/character` | `id?: string` | Switches the active character card. Lists available characters if `id` is omitted. |
| `/new` | `msg?: string` | Resets the conversation context. Optionally seeds the new session with a starting message. |
| `/status` | *(none)* | Reports the active character, loaded model, module states, and Discord ping. |
| `/history` | `turns?: number` | Dumps the last N messages (default 5) from the current conversation. |
| `/summon` | *(none)* | Joins your current voice channel. |
| `/leave` | *(none)* | Leaves the current voice channel. |

#### Details

**`/character`** — Calls into the AIRI Card Store to load a different profile. The bot's identity (name, avatar, bio) syncs to Discord. All subsequent messages use the new character until you switch again.

**`/new`** — Clears short-term context and starts a fresh Episode. The optional `msg` immediately seeds the new conversation with a prompt.

**`/status`** — Queries main-process state stores and formats a rich embed with:
- Active character name
- Loaded LLM model
- Module state (vision, proactivity, etc.)
- Discord gateway health (ping/latency)

**`/history`** — Pulls recent messages from the active Episode's short-term memory and displays them as a formatted list.

**`/summon`** — Connects to the Discord Voice Gateway via `@discordjs/voice`. Audio routing depends on the active voice engine (see `/voicecall`).

**`/leave`** — Disconnects the active `VoiceConnection` and cleans up the audio pipeline.

---

### Extended Commands

Advanced toggles and routing capabilities.

| Command | Arguments | Description |
| :--- | :--- | :--- |
| `/voicemode` | `mode: puppet \| voicenote \| none` | Controls TTS playback destination (desktop speakers, voice note attachment, or muted). |
| `/voicecall` | `mode: classic \| gemini` | Selects the VC engine (standard TTS pipeline vs native Gemini Live WebSocket). |
| `/director` | `mode: on \| off` | Toggles Autonomous Artistry (character-initiated generation). |
| `/vision` | `mode: on \| off` | Toggles VLM processing of image attachments in the channel. |
| `/imagine` | `prompt: string` | Forces a visual generation through the Artistry pipeline. |
| `/selfie` | `emotion?: string` | Captures a stage screenshot. Optional emotion overrides the character expression. |

#### Details

**`/voicemode`** — Dictates how speech is delivered for text messages:
- **`puppet`** (default): Audio plays locally on the desktop app.
- **`voicenote`**: TTS chunks are combined into a single `.ogg`/`.mp3` and uploaded as a voice note attachment.
- **`none`**: No TTS generated — saves API credits and resources.

**`/voicecall`** — Selects the real-time voice call engine:
- **`gemini`**: Discord Opus audio → Gemini Live WebSocket → Discord Opus. Ultra-low latency, no text serialization.
- **`classic`**: Audio → STT → LLM → TTS → Audio. Slower but uses high-fidelity desktop TTS providers and keeps a full text transcript.

**`/director`** — When `on`, AIRI can autonomously decide to generate images (widgets, backgrounds) through Artistry. When `off`, all generation must be explicitly requested.

**`/vision`** — When `on`, image attachments in Discord are intercepted, converted to base64, and fed into the VLM processor via the chat orchestrator. AIRI can "see" and respond to images.

**`/imagine`** — Sends the prompt to the configured Artistry backend (e.g., ComfyUI). The result is posted as a native Discord attachment.

**`/selfie`** — Triggers `visionStore.heartbeat({ force: true })` — the same capture function used by the desktop Control Island. The screenshot is stored as a "selfie" entry in the Image Journal and posted as a high-quality attachment.

---

## Telemetry & Settings UI

The Discord settings page at **Settings > Discord** (under *Messaging*) provides a real-time dashboard with:

| Section | What It Shows |
| :--- | :--- |
| **Connectivity** | Gateway status badge + ping/latency readout. |
| **Authentication** | Masked token display + reset button. |
| **Active Presence** | Table of guilds and voice channels AIRI is currently in. |
| **Logic Routing** | Toggles for VLM processing, Global Artistry Sync, and auto-prefixing. |
| **Developer Console** | Collapsible real-time log of Discord service events. |

---

## Troubleshooting

**Commands not showing up?**
Slash commands are registered on service startup. Try restarting the Discord integration from Settings, or re-invite the bot with `applications.commands` scope.

**Bot not responding?**
Check the token is valid and the bot has the required intents enabled (Message Content, Voice State) in the Discord Developer Portal.

**Voice not working?**
Ensure the bot has `Connect` and `Speak` permissions in the voice channel, and that `@discordjs/voice` dependencies are installed.

---

## Further Reading

- [Discord Developer Portal — Bot Tokens](https://discord.com/developers/applications)
- [discord.js Guide — Slash Commands](https://discordjs.guide/interactions/slash-commands.html)
- [Feature Showcase: Discord Integration](../../showcase/10-discord-integration)
