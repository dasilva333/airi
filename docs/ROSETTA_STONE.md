# AIRI AI Reference Sheet

Concise mapping of conceptual features to technical file paths for rapid context retrieval.

## Core UI & Surfaces

- **Control Strip Window (Main Window)**: `apps/stage-tamagotchi/src/main/windows/main/index.ts` (Electron window manager) | `packages/stage-ui/src/components/scenarios/layout/ControlStrip.vue` (UI component)
- **Actor Stage Window**: `apps/stage-tamagotchi/src/main/windows/stage/index.ts` (Electron window manager) | `packages/stage-ui/src/components/scenes/Stage.vue` (UI component)
- **Chatbox Window**: `apps/stage-tamagotchi/src/main/windows/chat/index.ts` (Electron window manager) | `apps/stage-tamagotchi/src/renderer/pages/chat.vue` (UI page) | `apps/stage-tamagotchi/src/renderer/components/InteractiveArea.vue` (Hosts input, chat history, visual indicators)
- **Floating Island (Stage)**: `packages/stage-ui/src/components/scenes/Stage.vue` (Host for models, speech, background)
- **Control Island (Original)**: `apps/stage-tamagotchi/src/renderer/components/stage-islands/controls-island/index.vue` (Main chevron/drag logic)
- **Gemini Control Island**: `.../controls-island/gemini-controls.vue` (Left-side sparkle controls)
- **Whisperbox**: `packages/stage-ui/src/components/scenarios/chat/WhisperDock.vue` (Mid-center keyboard input)
- **Resource Island**: `apps/stage-tamagotchi/src/renderer/components/stage-islands/resource-status-island/index.vue`
- **VRM Character**: `packages/stage-ui-three/src/components/Model/VRMModel.vue` (3D rendering & expressions)
- **Live2D Character**: `packages/stage-ui-live2d/src/components/scenes/live2d/Canvas.vue`
- **Gemini Panel**: `apps/stage-tamagotchi/src/renderer/pages/notice/gemini.vue` (UI) | `packages/stage-ui/src/stores/modules/live-session.ts` (Bidi WebSocket)
- **System Tray**: `apps/stage-tamagotchi/src/main/tray/index.ts` (Electron main process)
- **Caption Overlay**: `apps/stage-tamagotchi/src/renderer/pages/caption.vue` (UI) | `apps/stage-tamagotchi/src/main/windows/caption/` (Manager)
- **Widgets Host (Standalone)**: `apps/stage-tamagotchi/src/renderer/pages/widgets.vue` (Renderer window for all widgets)
- **Widget Window Manager**: `apps/stage-tamagotchi/src/main/windows/widgets/index.ts` (Handles life-cycle, snapshots, and TTL)

## Settings & Editing

- **AIRI Card Editor**: `packages/stage-pages/src/pages/settings/airi-card/index.vue`
    - **Identity Tab**: `.../tabs/CardCreationTabIdentity.vue`
    - **Behavior Tab**: `.../tabs/CardCreationTabBehavior.vue`
    - **Generation Tab**: `.../tabs/CardCreationTabGeneration.vue`
    - **Acting Tab**: `.../tabs/CardCreationTabActing.vue`
    - **Artistry Tab**: `.../tabs/CardCreationTabArtistry.vue`
    - **Modules Tab**: `.../tabs/CardCreationTabModules.vue`
    - **Proactivity Tab**: `.../tabs/CardCreationTabProactivity.vue`
- **Vision Settings**: `packages/stage-pages/src/pages/settings/modules/vision.vue` | `visionStore`
- **Modules/Systems**: `packages/stage-pages/src/pages/settings/modules/`
- **Providers Config**: `packages/stage-pages/src/pages/settings/providers/`

## Engine & Subsystems

- **ACT Pipeline**: `packages/stage-ui/src/composables/use-llm-marker-parser.ts` (Parser) | `packages/stage-ui-three/src/services/expression.ts` (Execution)
- **Memory (Long-term / Semantic)**: `packages/stage-ui/src/stores/memory-text-journal.ts` (IndexedDB) | `Settings -> Memory -> Long Term`
- **Memory (Short-term / Episodic)**: `packages/stage-ui/src/stores/memory-short-term.ts` (Daily summaries / Episode segmentation)
- **Cognitive Dreaming (Consolidation)**: `packages/stage-ui/src/stores/proactivity.ts` (Idle task logic)
- **Text Journal Operations**: `write`, `search` (Involved in tool definitions)
- **Semantic Search Index**: `Transformers.js` / `Orama` / `Voy` (Local indexing in `IndexedDB`)
- **VRM Animations**: `packages/stage-ui-three/src/assets/vrm/animations/index.ts` (Assets) | `packages/stage-ui-three/src/stores/model-store.ts` (State)
- **Artistry/ComfyUI**: `apps/stage-tamagotchi/src/main/services/airi/widgets/providers/comfyui.ts` (Native HTTP API)
- **Scene/Background**: `packages/stage-ui/src/components/scenes/Stage.vue` (Layer) | `packages/stage-pages/src/pages/settings/scene/index.vue` (UI)
- **Model Position/Lights**: `packages/stage-ui/src/components/scenarios/settings/model-settings/vrm.vue`
- **Proactivity/Heartbeats**: `packages/stage-ui/src/stores/proactivity.ts` (Idle logic / Amusement loop)
- **Control Island State**: `packages/stage-ui/src/stores/settings/controls-island.ts` (Shared) | `apps/stage-tamagotchi/src/renderer/stores/controls-island.ts` (Renderer)
- **Image Journal Store**: `packages/stage-ui/src/stores/background.ts` (Handles Builtin, Scene, Journal, and Selfie types)
- **Artistry Bridge**: `apps/stage-tamagotchi/src/main/services/airi/widgets/artistry-bridge.ts` (Main process bridge for image widgets)
- **Image Attachments**: `packages/stage-layouts/src/components/Widgets/ChatArea.vue` (State) | `packages/ui/src/components/form/textarea/basic-text-area.vue` (Drop)
- **User Image Render**: `packages/stage-ui/src/components/scenarios/chat/user-item.vue`
- **STT/Microphone**: `apps/stage-tamagotchi/src/renderer/pages/index.vue` (Tamagotchi) | `apps/stage-web/src/pages/index.vue` (Web)

## Chatbox Elements
- **Chat History (Host)**: `packages/stage-ui/src/components/scenarios/chat/history.vue`
- **Assistant Bubble / Assistant Turn**: `.../chat/assistant-item.vue`
- **User Bubble / User Turn / Chat Bubble**: `packages/stage-ui/src/components/scenarios/chat/user-item.vue` (Handles user message rendering, text, VLM image attachments, right-click triggers, and edit mode inline editor)
- **Bubble Actions Menu / Context Menu**: `packages/stage-ui/src/components/scenarios/chat/components/action-menu/index.vue` (Reka-based right-click/long-press menu offering copy, delete, edit, retry, fork, and journal moment options)
- **Bubble Render Parts**: `.../chat/response-part.vue` (Text) | `.../chat/tool-call-block.vue` (Tools)
- **Journal Strip (Chips)**: `apps/stage-tamagotchi/src/renderer/components/InteractiveArea.vue` (Scrollable Image/Text/Episode previews)
- **Mood / Vibe Indicator**: `apps/stage-tamagotchi/src/renderer/components/InteractiveArea.vue` (Emotional baseline display)
- **Toolbar Strip**: `apps/stage-tamagotchi/src/renderer/components/InteractiveArea.vue` (Buttons: Grounding, Memory, Trash, Send)
- **Bubble Styling (ACT)**: extracted from performance tokens in `ChatArea.vue`

## Key Directories

- `packages/stage-ui`: Core business logic, components, and Pinia stores.
- `packages/stage-shared`: Common constants (`emotions.ts`, `events.ts`) and utils.
- `apps/stage-tamagotchi`: Electron-specific main/renderer code.
- `docs/content/en/docs/advanced/architecture/`: Source for all detailed architecture specifications.
- `docs/design-prospective-rich-journal.md`: Specification for the Cognitive Memory / Dreaming UI.

## Nicknames Index

- **"chatbox"** -> `ChatArea.vue` / `InteractiveArea.vue` / `renderer/pages/chat.vue`
- **"control strip"** / **"the strip"** -> `ControlStrip.vue` / `ControlStripHost.vue` (The always-on-top status bar / mini-control tray)
- **"the island"** -> `controls-island/index.vue` (aka original island / og island)
- **"the floating widget"** / **"the standalone window"** / **"the tamagotchi"** -> `Stage.vue` (Actor Stage Window)
- **"the rich journal"** -> `design-prospective-rich-journal.md`
- **"dreaming"** -> Memory consolidation via proactive idle tasks.
- **"vibe indicator"** -> The emotional dashboard in the chatbox.
- **"pencil artistry"** -> `CardCreationTabArtistry.vue`
- **"the staging_widgets thing"** -> `apps/stage-tamagotchi/src/renderer/stores/tools/builtin/widgets.ts` (The spawning tool)
- **"the backends"** -> `packages/stage-ui/src/stores/providers.ts`
- **"the brain"** -> `packages/stage-ui/src/stores/modules/`
- **"chat bubble context menu"** / **"bubble context menu"** -> Context menu triggered by right-clicking a message bubble (`action-menu/index.vue`)
- **"bubble layer"** / **"user bubble layer"** -> `user-item.vue`
- **"edit mode"** -> Inline editing of a user message inside `user-item.vue` (`handleEdit`, `handleCommitEdit`)

## Ingestion & Input Pipeline Architecture (Lessons Learned)

- **Main vs. Secondary Windows**: The Main Window is the Control Strip (serving `/` or `#` route, where `isMainWindow` is `true`). Secondary windows (like the Chatbox `#/chat` and Actor Stage `#/actor`) are not the main window.
- **Fire-and-Forget Pitfall**: Since input textareas / WhisperDocks are located in secondary windows, calling `chatStore.ingest` historically resolved instantly (Promise.resolve) after posting the input to the main window over `useBroadcastChannel('airi-chat-input-bridge')`. If the main window was deadlocked, out-of-sync due to HMR, or reloaded, the message was swallowed and permanently lost since the secondary window had already cleared the input.
- **Verification Loop Implementation**: To prevent message loss:
  1. Secondary window `ingest` generates a `clientMessageId` and appends it to metadata.
  2. It returns a promise that sets up a 5-second safety timeout and watches the local `chatSession.getSessionMessages()` for the matching `clientMessageId`.
  3. When the main window processes the input and writes it to history, the `session-store` broadcasts `session-updated` cross-window.
  4. The secondary window's store receives the broadcast, appends the message, and the watcher resolves the promise.
  5. If it times out, the promise rejects, allowing the UI (`InteractiveArea` and `WhisperDock`) to restore the draft text/attachments and show a toast warning.

## Toast Notifications & Event Bridging (Lessons Learned)

- **RPC/IPC Flow**:
  1. **Invoke/Trigger**: A renderer window invokes `electronShowToast` (`defineInvokeEventa` in `apps/stage-tamagotchi/src/shared/eventa.ts`).
  2. **Resolution & Dispatch**: The main process (`apps/stage-tamagotchi/src/main/index.ts`) handles the invocation, decides which window should receive the toast (prioritizing the visible Chatbox, falling back to Actor Stage, and finally the Main/Control Strip window), and emits the `electronShowToastEvent` to it.
  3. **Display**: The target window's renderer (`apps/stage-tamagotchi/src/renderer/App.vue`) listens to `electronShowToastEvent` and triggers `toast(...)` from `vue-sonner`.
- **Eventa Context Pitfall**: Directly using `targetWin.webContents.send('eventa:event:electron:show-toast', payload)` bypasses the Eventa serializer/deserializer. Eventa's renderer context only listens on the global `'eventa-message'` channel and emits event objects wrapped with a `'body'` key.
- **Correct Eventa Dispatch**: To send an Eventa event from the main process to a specific window, you must instantiate a window-specific main context and call emit:
  ```typescript
  const { context: winContext, dispose } = createContext(ipcMain, targetWin)
  winContext.emit(electronShowToastEvent, payload)
  dispose() // Clean up listeners on ipcMain to prevent memory leaks
  ```

## Autonomous Artistry & Director's Notes Sync (Lessons Learned)

- **Subsystem Architecture**:
  - **Triggers**: The LLM agent's turn triggers `runArtistTask` in `artistry-autonomous.ts` (either after user input or companion reply, depending on settings).
  - **Decision & Grading**: The Director LLM grades visual interest (1-100), parses selected concepts, and saves a `DirectorNote` via `recordDirectorDecision(...)` into `director-notes.repo.ts` (IndexedDB).
  - **Rendering**: In `history.vue`, `renderMessages` reactively merges active chat messages and unarchived director notes. The list is sorted by `createdAt` timestamp, and `DirectorNoteBubble.vue` renders notes inline with chat bubbles.
- **Cross-Window Sync Problem**: Because Pinia stores run independently in each window's renderer process, writing a note to IndexedDB from one window (e.g. Main Window where background analysis tasks run) does not automatically update the in-memory store state in other windows (e.g. Chatbox).
- **Sync Implementation**: Real-time cross-window synchronization is achieved by broadcasting note modifications over a custom `BroadcastChannel` (`'airi:director-notes-sync'`):
  1. Modifying operations (`recordDirectorDecision`, `updateDirectorDecision`, `archiveSessionNotes`) post a synchronization event: `broadcastDirectorEvent({ type: 'director-note-added', sessionId, note })`.
  2. Every store instance listens to the channel, filters events matching the currently active `sessionId`, and reactively updates its local `directorNotes` ref in memory.


