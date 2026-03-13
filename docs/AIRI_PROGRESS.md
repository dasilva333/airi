# AIRI Progress Overview

This document tracks the current development state of the AIRI project, specifically within the `airi-rebase-scratch` workspace.

## Feature Branches

| Branch Name | Description | Status |
|-------------|-------------|--------|
| `feat/artistry` | AI-generated art and image generation features (e.g., DALL-E integration). | Active |
| `feat/control-islands-camera` | Enhanced camera controls and positioning for the application's scenes/islands. | Active |
| `feat/live2d-customizations-panel` | A dedicated settings panel for fine-tuning Live2D model behaviors and visuals. | Active |
| `feat/model-selector-redesign` | (PR #1297) Re-engineered model selector with categorized grouping and real-time validation. | Submitted |
| `feat/scrolllock-mic-toggle` | (PR #1298) Feature to toggle the microphone mute state using the ScrollLock key. | Submitted |
| `feat/speech-pipeline-stability` | (PR #1299) Improvements to the VAD and speech processing pipeline for better stability and lower latency. | Submitted |
| `feat/stt-feedback-log-cleanup` | (PR #1300) Visual STT feedback toasts and refined terminal logging. | Submitted |
| `feat/tray-position-startup-fix` | (PR #1289) Auto-restore window position from snapshot on startup. | Submitted |
| `feat/vrm-live2d-expressions-customizations` | Shared logic and UI for emotion/expression mapping across both VRM and Live2D models. | Active |
| `feat/artistry-enhancements` | Reorganizing Artistry UI and automating widget prompt injection. | Active |

## Recent Changes (in `airi-rebase-scratch`)

- **STT Chat Inscription**: Implemented universal STT chat inscription. Transcribed voice input is now automatically added to the chat history, ensuring a seamless record of conversation regardless of input method.
- **LLM Log Cleanup**: Silenced verbose `[LLM Delta]` console logs and fixed a bug causing duplicate `[LLM Final Output]` logs in the terminal.
- **Workaround Documentation**: Added `// NOTICE:` comments throughout the codebase to explain critical hacks, OS-specific workarounds (like Electron main process logic), and upstream dependency fixes.
- **Proactivity Lifecycle**: Refined heartbeat timing and basic gates. Added localized time sensors for context-aware AI initiation.

## Project Structure

- **Primary Workspace**: `airi-rebase-scratch`
    - A fork of the main project with rolled-in changes.
    - Connected to `dasilva333/airi` (main branch).
- **Staging/Clean Room**: `airi-clean-pr`
    - Used for isolating and preparing individual features into clean PR branches.

## 🚀 Roadmap & Future Improvements

### 🧠 Proactivity Enrichment
Further enhancements to the proactivity system are detailed in the [Proactivity Enrichment Roadmap](file:///C:/Users/h4rdc/Documents/Github/airi-rebase-scratch/docs/Proactivity-Enrichment-Roadmap.md). Key focuses include:
- Active Window History ("Rich Context")
- Clipboard Metadata (Security-first approach)
- Interaction Milestones and Temporal Tropes (e.g., "Happy Friday")

### 🎴 Character Card & Avatar Association
Planned improvements to the **Settings > AIRI CARD > EDIT CARD** flow:
- **UI Reorganization**: Move "Artistry" from the modules tab to its own high-level tab for cleaner separation of concerns.
- **Model / Avatar Selection**:
    - Add a new "Models / Avatar" dropdown to the Modules tab.
    - Group selection by `Live2D` first, then `VRM`, using display names from the model selector.
    - Implement lazy-loaded options for high responsiveness.
- **Character-Avatar Binding**: Associate specific models with cards. Hitting "Play" on a card will automatically call the `selectModel` function to set the associated avatar as active.

### 🛠️ Technical Improvements
- **Model Centering & Preview Cache**: Investigation into the image preview cache algorithm for when model files load. Some models are currently displayed way off-center (e.g., only head and neck visible at the bottom edge) during the initial load/render.
- **Configurable Global Hotkey**: Provide settings UI to change the microphone toggle key (replacing hardcoded ScrollLock) and maintain LED sync.
