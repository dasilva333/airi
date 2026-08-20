# Nan0-AIRI Integration: Architectural Realignment & Feedback

This document outlines the architectural feedback and design requirements for integrating the Nan0 cognition system into the AIRI ecosystem. It serves as a guide to realign the integration strategy with AIRI's core design principles, citing established project architecture documents and database schemas.

---

## 1. Core Principle: Native Web-Technology Stack (Zero Python Sidecar)

We reject the proposal to maintain a standalone Python process or sidecar to hoist Nan0's memory and cognition engines. Doing so introduces significant maintenance overhead, installer bloat, and breaks cross-platform desktop/web parity.

### Why a Python Subprocess is Rejected:
* **Breaks Web Stage (`web-stage`)**: As indexed in [docs/rosetta-stone.md](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/docs/rosetta-stone.md#L16), AIRI supports a browser-only deployment (`apps/stage-web`). A web browser cannot spawn a local Python subprocess. To ensure that `web-stage` can leverage the exact same features, the companion's cognition and memory must be written in native TypeScript/JavaScript.
* **Installer Bloat & Distribution**: Packaging a Python environment, compiler tools, and native extensions inside an Electron app adds hundreds of megabytes to the final installer.
* **Dependency Hell**: Spawning and managing a python subprocess on end-user machines (handling virtual environments and native library links) is fragile compared to clean, single-process npm dependencies.

### Why Porting is Highly Straightforward:
The audit states that Nan0's memory skill uses Chroma DB for storing diary entries and episodic events. Porting this to AIRI is simple because AIRI **already implements browser-native vector search**:
* **Vector Indexing & Storage**: As defined in Section 9 of the [Rosetta Stone](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/docs/rosetta-stone.md#L249-L253), AIRI uses [layered-memory.ts](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/libs/search/layered-memory.ts), which manages an in-browser hybrid search index using **Orama** and **Transformers.js** (backed by IndexedDB).
* **Actor & Relationship Schema**: The audit claims AIRI's memory system lacks actor semantics. However, AIRI’s `SearchDocumentMeta` and storage repositories use open schema payloads. Storing actor metadata is as simple as adding `actorId`, `targetActorId`, and `relationship` properties to the document objects during indexing:
  ```typescript
  // Simply feed diaries and episodic events into the existing indexer:
  await layeredMemory.indexDocuments([
    {
      id: 'diary-123',
      content: 'Episodic event details...',
      kind: 'journal_entry', // Automatically routes to long-term memory
      actorId: 'kyo',
      targetActorId: 'richard',
      relationship: 'friendly'
    }
  ])
  ```
  This completely removes the need for Chroma DB or a Python backend.

---

## 2. Discord Revamp Realignment

The integration must adhere strictly to the design principles laid out in the [feat-discord-revamp.md](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/docs/feat-discord-revamp.md) spec.

### A. Restore `puppet` Mode (Default Local Playback)
* **Reference**: [feat-discord-revamp.md: Voice Modes](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/docs/feat-discord-revamp.md#L70-L74)
* **Feedback**: The other agent's audit omitted the `puppet` mode entirely. `puppet` mode is the current default behavior: audio is played locally on the desktop app speaker system while the text interaction is routed to Discord.
* **Importance**: For "home base" users who want the high-fidelity desktop speakers to play speech in their room while commanding the companion remotely, deleting this option breaks the core loop. It must remain an active option.

### B. Real-Time Voice Calls vs. Classic TTS
* **Reference**: [design-gemini-live-api-integration.md](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/docs/content/en/docs/advanced/architecture/design-gemini-live-api-integration.md) and [arch-chat-stt-proactivity-pipelines.md](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/docs/content/en/docs/advanced/architecture/arch-chat-stt-proactivity-pipelines.md)
* **Feedback on Gemini Live**: The other agent proposed a hybrid voice call where Gemini Live is routed through a manual `STT -> thought engine -> TTS` loop. This is architecturally flawed:
  1. As documented in [design-gemini-live-api-integration.md: Overview](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/docs/content/en/docs/advanced/architecture/design-gemini-live-api-integration.md#L13-L20), Gemini Live processes raw audio and returns text transcriptions and audio output **simultaneously** with sub-second latency. Wrapping this in a serial STT-to-thought loop destroys the real-time nature of the connection.
  2. The **Mandatory Audio Rule** ([design-gemini-live-api-integration.md: Line 21](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/docs/content/en/docs/advanced/architecture/design-gemini-live-api-integration.md#L21-L28)) dictates that Gemini Live requires the audio modality to stay active.
  3. **High Cost**: Continuous WebSocket connections with Gemini Live are extremely expensive.
* **Realignment**: Since Kyo wants to utilize Deepgram STT, a custom LLM (e.g., local/custom endpoints), and a custom TTS (rather than Gemini's native voice), the integration should **focus entirely on implementing the classic `tts` mode** (Discord Audio -> STT -> LLM -> TTS -> Discord Audio) and leave the Gemini Live option deferred.

---

## 3. Session & Character Isolation

AIRI currently lacks channel-level session boundaries. We welcome the audit's recommendation for per-channel session tracking, with the following implementation design:

### Character-to-Session Schema:
1. Discord slash command `/character` allows switching characters per channel.
2. Therefore, each channel must maintain its own active character state.
3. The routing mapping must follow:
   $$\text{channelId} \longrightarrow \text{activeCharacterId} \longrightarrow \text{activeSessionId}$$
4. This ensures that:
   * Channel A can talk to Lain, maintaining Session 1.
   * Channel B can talk to Sparkle, maintaining Session 2.
   * Changing the character in Channel A will automatically resolve or instantiate a new session scoped specifically under that character for that channel.

---

## Conclusion & Action Items

To ensure successful integration into the AIRI ecosystem:
1. Re-implement Nan0's memory and cognition router in TypeScript. Do not package or rely on Python sidecars.
2. Implement `/voicemode` with full support for `puppet`, `voicenote`, and `none` modes.
3. Implement `/voicecall` focusing on the classic `tts` engine (Deepgram + Custom LLM/TTS).
4. Enforce per-channel session/character mapping to resolve multi-guild context tracking.

## Relevant Skills

- [[airi-card-editor-wizard]]
