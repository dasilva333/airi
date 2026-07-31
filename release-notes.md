# 🚀 AIRI v0.9.21-stable.20260729 — Release Notes

This release introduces the **ComfyUI Workflow Configurator Redesign**, **Live2D Model Loading Race Condition & Mutex Fixes**, **Dedicated Director LLM Overrides**, **Live2D Multi-File Batch Import Queueing**, and **System Settings & Tray Enhancements**.

---

## ✨ Key Highlights

### 🎨 ComfyUI Workflow Configurator Redesign
* **Redesigned Configurator UI**: Overhauled the ComfyUI workflow configuration interface with intuitive target selectors for mapping prompts and generated outputs.
* **Formatted Error Messages**: Improved error message formatting in chat when image generation workflows fail, providing cleaner diagnostic tracebacks.

### 💃 Model Loading Mutex & Concurrency Fixes
* **Serialized Model Updates**: Serialized the `updateStageModel` execution queue to prevent race conditions when rapidly swapping display models.
* **Live2D Mutex Leak Fix**: Resolved Live2D model loading mutex leaks that could freeze model rendering during frequent switches.
* **ControlStrip Persistence Fix**: Corrected the `ControlStrip` `displayModelId` write path so display model switches persist cleanly to the active character card.

### ⚙️ Settings, Tray & System Features
* **Settings Case-Insensitive Search**: Search bar in settings now performs case-insensitive matching across all setting items and sub-tabs.
* **Character Model Quick-Switch**: Added a quick-switch model dropdown directly in settings to swap active display models on the fly.
* **Tray DevTools Toggle**: Added an instant DevTools toggle option directly into the system tray context menu.
* **MCP Third-Party Notice**: Added a security notice dialog when connecting third-party Model Context Protocol (MCP) servers.

### 🎬 Dedicated Director LLM Model Override
* **Custom Director Model**: You can now specify a separate, custom LLM model override exclusively for the Director (Orchestration & RAG) layer! Run a faster or specialized model for background narration and scene directing while keeping your primary model focused on chat.
* **BrainModelPicker in Modules Settings**: Integrated `BrainModelPicker` and `VoiceCreatorModal` into the Settings Modules tab for streamlined AI capability configuration.

### 🎭 Live2D Multi-File Batch Import Queue
* **Batch Model Import Queue**: Drop or select multiple Live2D model files/archives at once with real-time toast progress updates for each item.
* **macOS Archive Artifact Filtering**: Automatically cleans up hidden `__MACOSX/` directories and `.DS_Store` metadata files during ZIP extraction, preventing corrupted model configurations.

### ⚡ Non-Blocking App Startup & Speech Fixes
* **Instant MCP Initialization**: Shifted Model Context Protocol (MCP) server startup off the critical application launch path, allowing AIRI to boot up instantly without waiting for background tool servers.
* **Local Whisper STT Fixes**: Resolved an issue where Local Whisper model download progress could get stuck, fixed a double-multiplication percentage display bug, and smoothed out settings scroll layout transitions.
