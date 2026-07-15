# 🚀 AIRI v0.9.17-stable.20260715 — Release Notes

This release introduces the new **Rehearsal Room Sandbox** for scripting and testing model expressions and actions, implements unified **VRM 1.0 & Morph Target Parsing**, adds enhancements to the **Character Creation Wizard**, revamps the **System Tray**, and delivers major performance optimizations to startup sync routines.

---

## ✨ Key Highlights

### 🎬 Rehearsal Room Sandbox & Model Customizer
* **Rehearsal Room**: Added a sandbox environment to script acting instructions, preview compact model grids, sync stage host mappings, and trigger Live2D/VRM motions.
* **Dialogue Suggestion Presets**: Implemented interactive structured LLM suggest-dialog presets and restricted inputs to visible option keys only.
* **VRM 1.0 & Morph Support**: Implemented unified VRM 1.0 and raw morph target parsing with display key normalization and self-healing backup DB recovery.
* **Unified ModelCustomizer**: Consolidated the emotion/motion editors into a single `ModelCustomizer` component that works across all model types.
* **IndexedDB Guard**: Load full `DisplayModelFile` metadata before updating capability sets to avoid erasing file properties in IndexedDB.
* **Sandbox Preview Gating**: Scoped stage window open warnings for expression/motion previews to the rehearsal sandbox only.

### 🧙 Character Creation Wizard
* **Details & Clipboard Copy**: Expanded active suggestion cards in the creator wizard to display full details and allow quick clipboard copies.

### 💬 Chatbox & Context Enhancements
* **Current Scene Panel**: Added a new "Current Scene" section to the right context panel for active status tracking.
* **Inline Spawn Images**: Resolved inline spawnMode images by title directly from the background store.

### ⚙️ System Tray & Performance QoL
* **Revamped System Tray**: Added positional reset, stage toggles, and direct customizer triggers to the OS system tray menu.
* **Startup Performance Wins**: Resolved startup memory leaks by refactoring `localforage.iterate` loops to optimized key-based lookups.
* **Spam & Lag Reduction**: Silenced redundant dream-state warn logs and skipped texture load lag frames on MMD models.
* **New Providers**: Added OpenCode Go and Alibaba Cloud chat providers.
