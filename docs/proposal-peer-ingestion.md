# [Goal Description]
Implement a "Peer Ingestion" system that allows external agents (like Carly/OpenClaw) to inject autonomous assistant messages into the AIRI chat via WebSockets. This bypasses the need for the internal AIRI LLM to "call" the agent via a tool, respecting the external agent's autonomy and avoiding redundant LLM processing.

## Proposed Changes

### [Component Name] Stage UI Stores

Summary: We will extend the `chat-orchestrator` to support direct ingestion of assistant-role messages and add a listener to the `context-bridge` to handle incoming peer-to-peer chat events from the WebSocket server.

#### [MODIFY] [chat.ts](file:///c:/Users/h4rdc/Documents/Github/airi-rebase-scratch/packages/stage-ui/src/stores/chat.ts)
- Add `ingestAssistantResponse` method to the `chat-orchestrator` store.
- This method will take a pre-composed `AssistantMessage` and manually trigger the downstream pipeline (TTS, Stage Replay, Animations) by emitting the orchestrator's response hooks.
- It will also inscribe the turn into the `chatSession` to ensure it persist in history.

#### [MODIFY] [context-bridge.ts](file:///c:/Users/h4rdc/Documents/Github/airi-rebase-scratch/packages/stage-ui/src/stores/mods/api/context-bridge.ts)
- Add a listener for the `output:gen-ai:chat:complete` WebSocket event.
- Implement logic to distinguish between "Internal" events (from other AIRI windows/tabs) and "External" events (from agents like Carly).
- Route external events to the new `ingestAssistantResponse` method.

## Verification Plan

### Manual Verification
- **External Agent Simulation**:
    1. Connect an external WebSocket client (e.g., using a simple Node.js script or Postman) to `ws://localhost:6121/ws`.
    2. Authenticate the client (if a token is set).
    3. Send an `output:gen-ai:chat:complete` event with a custom message.
    4. **Verify**:
        - The message appears in the Tamagotchi chat UI.
        - The character performs the speech animation (TTS).
        - The message is saved in the chat history.
