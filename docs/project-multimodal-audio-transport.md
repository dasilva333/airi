# Project Report: Multimodal Audio Transport Layer

## Background
This report documents a technical breakthrough achieved during the "Manco Fork" collaboration. The primary objective was to transition AIRI from a text-centric audio pipeline to a first-class **Multimodal Audio-to-Audio Transport Layer**.

Historically, AIRI relied on a staggered pipeline:
`Audio Input → STT (Transcription) → Text → LLM → Text → TTS → Audio Output`

While functional, this architecture introduces latency and loses the emotional/tonal nuance present in raw audio. The "Manco Fork" proved that AIRI's existing infrastructure (VAD, Mic Worklets, PCM Buffering) could be repurposed into a continuous, bidirectional transport layer that bypasses traditional STT entirely.

## Project Vision & Goals
The overarching goal is to make AIRI **modality-agnostic** and **offline-first**.

- **Offline-First**: Enable 100% local operation using `llama-server` and multimodal models like `Gemma-4 E2B` or `Ultravox`.
- **Modality-Agnostic**: Create a standard `RealtimeProvider` interface so AIRI can swap between cloud backends (Gemini Live) and local backends (Llama.cpp) without core logic changes.
- **Latency Reduction**: By streaming raw audio to a model that "hears" natively, we eliminate the STT bottleneck.

---

## Technical Dissection

### 1. The Realtime Transport breakthrough
The core discovery was that the "plumbing" for realtime audio (buffering, backpressure, session orchestration, and gapless playback) was the hardest part to build—and it is already solved in the `live-session.ts` store.

By treating the session as a "gold" transport layer, we can swap the backend protocol while keeping the user experience (hearing detection, speaking indicators, animation triggers) identical.

### 2. The Bridge Solution (`audio-proxy.ts`)
Because AIRI's frontend speaks stateful WebSockets (OpenAI Realtime/Gemini Bidi style) and `llama-server` currently speaks stateless HTTP REST, a proxy bridge was developed.
- **Role**: Translates persistent WebSocket frames into discrete HTTP payloads.
- **Audio Packaging**: Wraps raw PCM chunks into valid RIFF/WAV containers for model consumption.
- **Streaming**: Redirects Server-Sent Events (SSE) from the model back into the WebSocket as text tokens.

### 3. Key Optimizations & Fixes
- **The "Turn Protector"**: An `isClosingTurn` guard was implemented in the store to prevent race conditions that caused duplicate messages to be inscribed in the chat history.
- **Hardware Tuning**: Local multimodal models (like Gemma) require large ubatch sizes (`--ubatch-size 2048`) to handle the massive influx of audio tokens without asserting.
- **Output Routing**: By forcing `outputMode: 'custom'`, AIRI consumes text tokens from the local model and routes them through its existing high-quality TTS (Edge-TTS) and ACT (Expression) pipeline. This achieves a "Hybrid Audio-to-Audio" flow: Native Hearing + Synthetic Speaking.

---

## Abstracted Implementation Plan

To support both Gemini and Local backends seamlessly, the following abstraction is proposed:

### The `RealtimeProvider` Interface
A standardized contract for any backend that supports bidirectional audio/text streams.

```ts
interface RealtimeProvider {
  id: string
  connect: (config: ProviderConfig) => Promise<void>
  sendAudio: (base64: string) => void
  sendText: (text: string) => void
  sendEnd: () => void
  disconnect: () => void

  // Hooks for the Orchestrator
  onReady: () => void
  onAudioOutput: (base64: string) => void
  onTextOutput: (text: string) => void
  onTurnEnd: () => void
  onToolCall: (name: string, args: any, id: string) => Promise<any>
  onError: (error: string) => void
}
```

### Proposed Refactor
1. **Orchestrator**: `live-session.ts` becomes a generic store focused on UI state and token accounting.
2. **Adapters**:
   - `GeminiLiveProvider`: Implements Google's Bidi protocol.
   - `LocalLlamaProvider`: Implements the proxy protocol (session_start, audio_input).
3. **Settings**: A new "Realtime Engine" toggle to allow users to switch between Cloud and Local sessions instantly.

---

## Conclusion
The "Manco Fork" demonstrates that AIRI is no longer just a "chat wrapper." It is now a sophisticated transport layer for multimodal intelligence, capable of bridging the gap between cloud-scale performance and private, local execution.

## Relevant Skills

- [[airi-audio-pipeline]]
- [[airi-gemini-live-api]]
