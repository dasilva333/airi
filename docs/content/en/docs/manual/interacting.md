---
title: Ways to Talk & Interact
description: Explore all the ways to communicate and converse with your companion across text, voice, live streaming audio, and Discord.
---

# Ways to Talk & Interact

Project AIRI is designed to feel alive across multiple sensory channels. You are not limited to typing in a standard chat box—you can speak aloud via push-to-talk, engage in continuous natural conversations with open-mic voice activity detection, experience sub-second real-time streaming with Gemini Live, or chat through Discord.

---

## 1. Interaction Modes Overview

| Interaction Mode | Input Method | Audio Latency | Ideal Use Case |
| :--- | :--- | :--- | :--- |
| **Desktop Chatbox** | Keyboard / Text input | N/A (Instant text) | Detailed roleplay, tweaking prompts, issuing complex multi-step commands. |
| **Push-to-Talk (PTT)** | Hold Hotkey + Microphone | ~1–2s (STT &rarr; LLM &rarr; TTS) | Precise voice commands while gaming or working without accidental mic pickup. |
| **Open Mic (VAD)** | Voice Activity Detection | ~1–2s | Hands-free conversations while your desktop companion sits on screen. |
| **Gemini Live Bidi** | Real-Time WebSocket Audio | < 500ms (Sub-second) | Instant fluid banter with natural human-like voice inflections and mid-sentence interruptions. |
| **Discord Voice & Chat** | Slash Commands & Voice Channel | ~1–3s | Hanging out with friends and your AI companion in a shared Discord server. |

---

## 2. Desktop Chatbox

The persistent Desktop Chatbox is your primary hub for deep interactions.

- **Workspace Layout**: The chat surface features a 3-column workspace layout:
  - **Left Sidebar**: Navigation drawer with shortcuts to the Studio, Media Library, Eternal Memory Thread, and Event Ledger.
  - **Main Conversation Stream**: Interleaved message bubbles, tool-call cards, and emotion tokens.
  - **Right Context Rail**: Shows active memory chips (Echo Chips), current mood, and active character cards.
- **Journal Chips**: Text and image journal entries written by AIRI appear inline as interactive chips. Clicking a chip opens the full entry or image preview.
- **Composer Toolbar**: Use the bottom composer bar to send messages, attach images for vision analysis, trigger suggestion prompts (AI Producer), or toggle between characters.

---

## 3. Voice Input: Push-to-Talk vs. Open Mic

You can talk to AIRI directly using your microphone.

### Setting Up Hearing (STT)
1. Open **Settings &rarr; Modules &rarr; Speech-to-Text (Hearing)**.
2. Select your STT provider (e.g., Local Whisper WebGPU, Groq Whisper, OpenAI Whisper, or Cloudflare Workers AI).
3. Select your preferred microphone in the **Audio Devices** selector.

### Push-to-Talk (PTT)
- Press and hold your configured PTT key (configured in **Settings &rarr; General &rarr; Shortcuts**).
- Speak your message. When you release the key, AIRI transcribes your speech, sends it to the mind model, and replies with synthesized voice.

### Open Mic with Voice Activity Detection (VAD)
- When enabled in the Control Strip or Settings, AIRI listens continuously.
- The built-in Silero VAD / WebRTC VAD detects when you start speaking and automatically finalizes the turn when you pause.

> [!TIP]
> **VAD Sensitivity**: If AIRI cuts you off too early, increase the **Silence Detection Threshold** in Hearing Settings to allow for natural pauses while thinking.

---

## 4. Gemini Live API (Bidirectional Audio)

For ultra-low latency, conversational audio that feels like a real phone call, AIRI supports Google's **Gemini Live Bidi WebSocket streaming**.

### What Makes Gemini Live Different?
- **Native Audio-to-Audio**: Instead of separate STT &rarr; Text LLM &rarr; TTS hops, Gemini processes your raw audio PCM stream and generates conversational speech audio directly.
- **Sub-Second Latency**: Audio starts streaming back in under 500ms.
- **Natural Interruptions**: If AIRI is speaking and you start talking, the audio output immediately stops, yielding the floor back to you naturally.

### How to Enable Gemini Live
1. Go to **Settings &rarr; Providers &rarr; Google Gemini** and enter your Gemini API Key.
2. Open the **Gemini Live** modal from the Control Strip or Chatbox header.
3. Choose a voice model and click **Connect**.
4. Speak freely without needing push-to-talk triggers.

---

## 5. Discord Integration

AIRI can run as a Discord bot on your personal server:

- **Text Chat**: Mention `@AIRI` or reply to her messages in any authorized channel.
- **Slash Commands**: Use `/chat`, `/steer`, `/voice join`, or `/voice leave` to control the bot.
- **Voice Channels**: When in a voice channel, AIRI listens to users speaking and responds with synthesized voice directly into the Discord voice room.

*(See the [Discord Commands Reference](/en/docs/manual/config/discord-commands) for full setup instructions.)*

---

## 6. Interruptions & Stopping Output

If AIRI is speaking or generating a long response and you want to stop her:
- Click the **Stop** button on the floating Control Strip or Chat composer.
- In Gemini Live mode, simply speak aloud—the system detects your voice and cancels in-flight playback immediately.
