# AIRI Artistry Porting Catalog (Image Generation)

This document catalogs all the components, views, stores, and backend logic required to port the full **Artistry (Image Generation)** system from the fork to the main branch.

> [!IMPORTANT]
> **Porting Priority & Dependencies**
> Artistry is technically and visually decoupled without **Scenes** and the **New Providers Layout**.
> - **Scenes** uses the same `image_journal` store to manage "global" backgrounds.
> - **Providers Layout** provides the tabbed interface necessary to isolate and configure Artistry without UI bloat.
> - **Architecture Update**: The Chatbridge logic in `InteractiveArea.vue` will be refactored to use the **`useChatSyncStore`** pattern (Moeru's pattern) for Electron synchronization, moving away from direct orchestrator calls in the renderer.
> - **Scoped Scope**: Subsystems for **Heartbeats**, **Generation Config**, and **Acting Prompts** are explicitly **EXCLUDED** from this porting pass to maintain high reliability and contract stability.

## 1. Core Logic & State Management (The "Invisible" Engine)

These files handle the generation logic, provider integration, and the main-process bridge.

| **Artistry Store** | [artistry.ts](file:///packages/stage-ui/src/stores/modules/artistry.ts) | Manages global generation state, provider configs, and workflow templates. |
| **Background Store** | [background.ts](file:///packages/stage-ui/src/stores/background.ts) | The "brain" for image storage. Handles IndexedDB persistence and **Pre-seeding Logic** for default Scenes. |
| **Artistry Main Bridge** | [artistry-bridge.ts](file:///apps/stage-tamagotchi/src/main/services/airi/widgets/artistry-bridge.ts) | Electron main-process bridge that handles the actual HTTP requests to image backends (bypassing CORS). |
| **ComfyUI Provider** | [comfyui.ts](file:///apps/stage-tamagotchi/src/main/services/airi/widgets/providers/comfyui.ts) | Native implementation for the ComfyUI HTTP API. |
| **Bubble Renderer** | [tool-call-block.vue](file:///packages/stage-ui/src/components/scenarios/chat/tool-call-block.vue) | Custom rendering for `image_journal` tool calls (inline generation feedback and results). |
| **Image Journal Tool** | [image-journal.ts](file:///apps/stage-tamagotchi/src/renderer/stores/tools/builtin/image-journal.ts) | The LLM-callable tool definition that allows AIRI to save/retrieve images from the journal. |

### 🏞️ Scenes: The Pre-seeding Bundle
To provide a polished "out-of-the-box" experience, the Scenes feature includes a preset bundle of bundled assets.

- **Asset Path**: `packages/stage-ui/src/assets/backgrounds/`
- **Bundled Files**:
    - `cozy-tea-corner-in-pastel-hues.png`
    - `cute-streaming-room-with-pastel-decor.png`
- **Seeding Logic**: Defined in `background.ts` via `BUILTIN_BACKGROUNDS`.
- **Trigger**: Logic within `initializeStore()` automatically fetches these assets as Blobs and seeds the IndexedDB on the first run if no scenes are detected.

## 2. Shared Utilities & Data Portability

| Feature | Path / Reference | Description |
| :--- | :--- | :--- |
| **AiriCard Integration** | `AiriCard` Schema | Updated to include `artistry` extensions (provider, model, prompt prefix, and workflow mapping). |
| **Prompt Builder Logic** | `character-defaults.ts` | The core "Agreement" engine. Handles dynamic injection/stripping of technical instructions based on module state. |
| **Widget Protocols**  | `airi-card.ts`         | Standardized JSON contracts for widget spawning and tool-calling consistency (The "Agreement"). |
| **Data Export/Import** | `Settings -> Data`     | Logic to include the `Image Journal` (IndexedDB) and `Artistry Config` in the system-wide ZIP backup. |

## 2.5 The Artistry Widget Protocol (The "Agreement")

To ensure the LLM understands how to interact with the visual interface, AIRI uses a standardized "Widget Protocol" contract. This is injected into the `systemPrompt` only when Artistry is enabled.

### The Contract: Step-by-Step
1.  **Spawn a Canvas**: The LLM picks a unique ID (e.g., `art-01`) and uses the `artistry` component tool to spawn a persistent widget.
2.  **Trigger Generation**: To create an image, the LLM updates the widget with `prompt` metadata and sets `status: "generating"`.
3.  **Refinement/Repetition**: The LLM can update the *same* ID with new prompts/status to change the content without re-spawning a new canvas.

### Prompt Consolidation & "Stripping" (The Agreement)
- **Identity Isolation**: Human-readable personality traits remain in the `Description` field.
- **Protocol Stripping**: Technical instructions (ACT tokens, Widget JSON schemas, Tool definitions) are stripped from the base identity and moved to the dedicated **`widgetInstruction`** field in the Artistry extension.
- **Prompt Builder Logic**: The `AiriCard` store dynamically assembles these pieces into a final system prompt. This ensures the LLM receives the protocol only when enabled, and without polluting the character's core persona.
- **Reactive Syncing**: Uses `refreshActiveSystemMessage()` in the `SessionStore` to hot-swap these instructions if settings change during a live chat, bypassing the need for a character reset.

## 3. UI Views & Settings (Breadcrumb Trails)

### 🎨 Settings - Providers Layout
**Path:** `packages/stage-pages/src/pages/settings/providers/index.vue`
**Purpose:** The new tabbed navigation system (`Chat`, `Speech`, `Transcription`, `Artistry`).
- **Requirement:** Highly recommended for Artistry to prevent horizontal scroll/bloat.
- **Note on Revamp:** The `providers.ts` store in the target branch has been structurally revamped. The porting will focus on the **Tabbed Layout Navigation** and Category registration while maintaining compatibility with the target's new provider metadata schema.
- **Features:** Categorized `RippleGrid` blocks, price/deployment filters (Omitted if conflicting with revamp).

### 🧩 Settings - Providers - Artistry
**Path:** `packages/stage-pages/src/pages/settings/providers/artistry/index.vue`
**Purpose:** Global backend selection. Configure API keys for Replicate, NanoBanana, or the URL for a local ComfyUI instance.

### ⚙️ Settings - Modules - Artistry
**Path:** `packages/stage-pages/src/pages/settings/modules/artistry.vue`
**Purpose:** Global master switch. Status indicator (e.g., "Ready", "Config Required") and quick toggle for the entire artistry subsystem.

### 🎭 Settings - AIRI Card - Edit - Artistry Tab
**Path:** `packages/stage-pages/src/pages/settings/airi-card/components/tabs/CardCreationTabArtistry.vue`
**Purpose:** Per-character creative control.
- **Provider Overrides:** Let specific characters use different backends.
- **Prompt Prefixes:** "Style" markers (e.g., "Manga style, high contrast").
- **BYOW Mapping:** Visual node-mapping for ComfyUI workflows.

### 🖼️ Settings - AIRI Card - Edit - Gallery Tab
**Path:** `packages/stage-pages/src/pages/settings/airi-card/components/CardDetailDialog.vue` (Gallery Section)
**Purpose:** Character-scoped image management.
- **Flip-Card Preview:** View prompts and metadata for generated images.
- **"Set as Background":** One-click application of any journal image to the character's active scene.
- **Cleanup:** Delete or download images directly from the card view.

### 🏞️ Settings - Scenes
**Path:** `packages/stage-pages/src/pages/settings/scene/index.vue`
**Purpose:** Global background management.
- **Integration:** Directly utilizes the `BackgroundStore` to manage "Scene" and "Builtin" types.
- **Functionality:** Users can upload custom wallpapers that are shared across all character profiles, providing a global visual environment separate from the per-character "Image Journal".

### ⚡ Dynamic System Prompt Hot-Swapping (High QoL)
**Path:** `packages/stage-ui/src/stores/chat/session-store.ts`
**Mechanism:** `refreshActiveSystemMessage()` + reactive watcher on `systemPrompt`.
**Purpose:** Automatically updates the first `system` message in a chat history whenever character fields (Prompt, Personality, Artistry Modules) are edited.
- **Impact:** Eliminates the need for a full character reset/history clear to apply settings changes.
- **Feature Creep Check:** Explicitly identified as a "fork-first" logic extension that leverages the new modular prompt builder.

---

## 4. Chatbox & Interaction Area (The "Goodies")

To ensure a seamless user experience, the chatbox enhancements should be ported **en masse**.

| Component | Path | Description |
| :--- | :--- | :--- |
| **Interaction Area** | [InteractiveArea.vue](file:///apps/stage-tamagotchi/src/renderer/components/InteractiveArea.vue) | The bottom-strip UI containing the Interaction carousel, Token Counter, Grounding toggle, and Send Key configuration. |
| **Artistry Widget**  | [renderer/widgets/artistry/](file:///apps/stage-tamagotchi/src/renderer/widgets/artistry/) | The actual visual canvas for image generation (ComfyUI workflow renders, progress bars, and prompt history). |
| **Inline Tool Renderer**| [tool-call-block.vue](file:///packages/stage-ui/src/components/scenarios/chat/tool-call-block.vue) | Custom rendering for `image_journal` tool calls (inline generation, background shifts, and widget triggers). |

---

## 5. Clean Room Porting Strategy

The migration follows a strict "Clean Room" protocol to ensure the Target maintainability remains high and no legacy "fork-drift" is accidentally introduced.

### Working Environments
- **Source of Truth (`airi-rebase-scratch`)**: This is the "Production Live" copy containing the full Artistry implementation. It serves as a **Read-Only** reference.
- **Clean Room (`airi-clean-pr`)**: This is the dedicated target folder. It is initialized from the latest **Upstream HEAD** (`moeru-ai/airi:main`). All porting efforts occur here.

### Roadmap Steps
1.  **Alignment**: Verify that `airi-clean-pr` is perfectly aligned with upstream `main` and has no uncommitted changes.
2.  **Manual Porting**: Systematically move logic from the source (`airi-rebase-scratch`) to the clean room (`airi-clean-pr`) following the file catalog above.
3.  **Refactoring**: Apply the **Prompt Builder Agreement** (Section 2.5) during the porting process to align with the new modular architecture.
4.  **Verification**:
    - Full typecheck of `@proj-airi/stage-ui` and `@proj-airi/stage-tamagotchi` within the clean room.
    - Validate the Image Generation → Journal → Scene Background loop in the fresh build.
5.  **Pull Request Submission (`gh` CLI)**:
    - **Drafting**: Create a detailed PR description in a temporary file (e.g., `PR_BODY.md`). This should be a "Complete-Vision" synthesis of all ported features, architecture changes, and manual verification logs from Section 4.
    - **Creation**: Use the GitHub CLI (`C:\Program Files\GitHub CLI\gh.exe`) to initialize the PR from the clean room:
      ```powershell
      gh pr create --title "feat: port artistry & chatbox enhancements" --body-file PR_BODY.md
      ```
    - **Outcome**: Ensures the PR is professional, well-documented, and ready for immediate stakeholder review.

## Relevant Skills

- [[airi-artistry-comfyui-widgets]]
- [[airi-scenes-backgrounds]]
