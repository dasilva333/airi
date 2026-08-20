# Design: Gemini Live API Integration

Documentation for integrating the Gemini Live API into the AIRI ecosystem to support real-time, bidirectional multimodal interaction (Audio, Video, Text).

## 🔗 References & SDK
- **Official Guide**: [Get Started with Gemini Live API](https://ai.google.dev/gemini-api/docs/live-api/get-started-sdk)
- **SDK**: `google-genai` (Node.js/TypeScript)
- **Key Concepts**:
    - **Session**: A persistent WebSocket connection for real-time I/O.
    - **Config**: Modality setup (audio/text), voice selection, and system instructions.
    - **Real-time Input**: Continuous streaming of audio/video frames as blobs.

## Overview

The Gemini Live API allows AIRI to interact with users with sub-second latency using native audio/video streaming. This integration will replace or augment the existing turn-based STT -> LLM -> TTS pipeline for compatible models.

1.  **Real-time Multimodal I/O**:
    - **Input**: Send raw PCM audio (16kHz, 16-bit) and video frames (JPEG/PNG) via WebSockets.
    - **Output**: Receive and play back native audio chunks from the model.

> [!CAUTION]
> ### 🛑 THE MANDATORY AUDIO RULE (NON-NEGOTIABLE)
> **The `responseModalities` array MUST ALWAYS contain `['AUDIO']`.**
>
> Attempting to set it to `['TEXT']` (e.g. to save tokens/bandwidth when using Custom TTS) is **EXPLICITLY FORBIDDEN**. It will cause the Bidi session to disconnect with **Error 1007 (Unsupported Data)** or fail reasoning/tools with **Error 1011 (Internal Error)**.
>
> **NEVER fork the modality at the connection level.** If using "Custom TTS" mode, the system MUST still request `['AUDIO']` and simply ignore the incoming PCM bytes.

2.  **Tool Call Plumbing**:
    - Naturally integrate the existing tool calling pipeline.
    - Use the established tool collection/orchestration system (currently in `ProactivityStore`).
3.  **Chat History Inscription**:
    - Transcriptions for both user input and model output must be inscribed into the `ChatSession` history.
4.  **Token & Tag Parsing**:
    - Prevent technical markers (ACT tokens, bracket tags) from bleeding into TTS or visible chat.

## Proposed Architecture

### 1. New Store: `LiveSessionStore`
A dedicated Pinia store (`packages/stage-ui/src/stores/modules/live-session.ts`) to manage the WebSocket lifecycle and the `google-genai` client.

- **State**:
    - `isActive`: Boolean indicating if a live session is running.
    - `session`: The active `google-genai` session object.
- **Actions**:
    - `connect(model, config)`: Initializes the WebSocket connection.
    - `sendMediaChunk(blob)`: Forwards audio/video data to the session.
    - `handleResponse(response)`: Routes incoming server content (audio, text, tool calls).

### 2. Tool Integration (`ToolOrchestrator`)
Discovery and execution of tools (MCP and local) via the `resolveRegisteredTools()` registry. Gemini Live tool calls will be mapped to AIRI's tool execution logic.

### 3. Special Token & ACT Handling (TTS Safety)
AIRI uses a centralized parsing pipeline to handle special markers (like `<|ACT...|>`) or bracket-style tags (`[ACT: ...]`) without them bleeding into the TTS.

- **Centralized Parser**: `useLlmmarkerParser` (`packages/stage-ui/src/composables/llm-marker-parser.ts`) uses a stream-safe buffer to split incoming text.
- **Robustness**:
    - **Separation**: Only `onLiteral` chunks are forwarded to the speech pipeline.
    - **Execution**: `onSpecial` events are forwarded to `SpecialTokenQueue` to trigger VRM expressions in `Stage.vue`.
    - **Extensibility**: The parser can be extended with Regex profiles to handle different bracket styles (e.g. `[...]` vs `<|...|>`) depending on the model's preferred syntax.
- **TTS Jumble Prevention**: By intercepting markers at the parser level, we ensure the native audio output (or 3rd party TTS) never "speaks" technical syntax.

### 4. History & Transcriptions
- When `input_transcription` or `output_transcription` is received, it is piped into the parser.
- The literal output is added to the visible chat and TTS.
- The raw output (with tags) is stored in the `ChatSession` index for full context persistence.

## Development Issues & Mitigations

### ⚠️ OOBE / State Loss on Linux (Origin Mismatch)
**Problem**: Users on Linux (Saha) report that settings and onboarding state are wiped on app restart.
**Root Cause**:
1.  AIRI stores state (Onboarding/Settings) in `localStorage` which is keyed to the **Renderer Origin** (e.g., `http://localhost:5173`).
2.  In `pnpm dev` environments, if 5173 is occupied, the port may jump to 5174.
3.  This change in port changes the Origin, making `localStorage` completely inaccessible (appearing empty).
**Mitigation**:
- **Strict Port**: Ensure `strictPort: true` is enforced in both `stage-web` and `stage-tamagotchi` to prevent silent port-jumping.
- **Main State**: Move critical "IsOnboarded" and "API Keys" state from `localStorage` to the Main process `config.json` (filesystem), which is origin-agnostic.

## Implementation Workflow
1.  Add `google-genai` dependency.
2.  Implement `LiveSessionStore`.
3.  Bridge `useLlmmarkerParser` to the live transcription stream.
4.  Standardize `strictPort` across all dev environments to stabilize Linux development.

## 🛠️ Hardening & Verified Wire Formats (Phase 2)

Recent "Clean Room" testing has verified the following stable configurations for the Gemini Live Bidi API:

### 1. Verification POCs
The following scripts in `scripts/gemini-live-pocs/` serve as the ground truth for the implementation:
- `01-inference-rick.ts`: Baseline Bidi connection and text/audio inference.
- `02-grounding-search.ts`: **Working** Google Search grounding implementation.
- `03-function-calling.ts`: Experimental synchronous tool-calling structure.

### 2. Mandatory Modality: AUDIO
Through testing, it was discovered that **`AUDIO` must be present in `responseModalities`** for the Bidi endpoint to correctly trigger reasoning tools (like Grounding).
- **Why?**: The Bidi alpha preview appears to tie its advanced tool-calling logic to the multimodal "Live" state. Using `['TEXT']` only often results in `1011: Internal Error`.
- **Note**: This is likely because the model is optimized for real-time speech-to-speech interaction.

### 3. Tool Declaration: `google_search`
The correct tool key for search grounding is **`google_search: {}`**.
> [!WARNING]
> Previous versions used `google_search_retrieval`. Using the wrong key will cause 1011 errors or silent failure to ground.

### 4. Auth Caveat (401 Errors)
When using the OpenAI-compatible endpoint (`https://generativelanguage.googleapis.com/v1beta/openai/`), a standard API key (`AIza...`) will return a **401 Unauthenticated** error.
- **Requirement**: This specific endpoint path requires an **OAuth2 Access Token** (`AQ...`).
- **Bidi Exception**: The Bidi WebSocket endpoint (`wss://.../BidiGenerateContent?key=...`) *does* support standard API keys, though quota limits are significantly stricter than OAuth-authenticated sessions.

## 🔧 Phase 3: Production Hardening (Grounding + Tools)

This phase bridges the existing AIRI proactive tool ecosystem with the Gemini Live WebSocket session.

### Design Decisions (Finalized)

1. **Shared Execution Context**: Tool execution in the Live Session has access to the full `ChatSession` state, including character memories and conversation history. Tools are NOT isolated—they share the same context as standard chat tools.

3. **Rate Limiting**: A safety cap of **5 tool-call invocations** per turn chain prevents expensive or recursive tool loops. The counter resets on every new user utterance (voice or text).

4. **AUDIO Modality**: `responseModalities: ['AUDIO']` is mandatory and already enforced. This is NOT a new change—it is the existing requirement for the Bidi endpoint to activate reasoning/grounding. **NEVER ATTEMPT TO REMOVE THIS.**

### Tool Schema Bridge

AIRI tools use the `@xsai/shared-chat` `Tool` interface, which already stores `function.parameters` as JSON Schema (produced by `@xsai/tool` from Zod). The bridge maps these directly to Gemini's `functionDeclarations` format:

```
AIRI Tool.function → Gemini functionDeclaration
  .name           → .name
  .description    → .description
  .parameters     → .parameters (already JSON Schema, pass-through)
```

### Tool Execution Loop (WebSocket Mid-Turn)

When the Bidi stream delivers a `toolCall` message:
1. Resolve the matching tool from the merged registry (proactive + MCP).
2. Execute it with provided args via the tool's `execute()` function.
3. Send a `toolResponse` message back through the WebSocket immediately.
4. Increment the turn-chain counter; abort if ≥ 5.

### Grounding Metadata

When `google_search` is enabled, the server may include `groundingMetadata` in responses. This metadata contains search result citations that should be parsed and associated with the streaming assistant message for future UI rendering.

## Relevant Skills

- [[airi-gemini-live-api]]
- [[airi-interaction-pipelines]]
