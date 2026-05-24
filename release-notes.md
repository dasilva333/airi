# Release Notes: AIRI v0.9.2-stable

Welcome to **AIRI v0.9.2-stable**! This update delivers massive structural upgrades to our UI layering, a highly-customizable modular Control Strip, significant reliability improvements to long-term memory retrieval, and robust fixes for application crashes and window lifecycles.

## 🚀 Key Highlights

### 🎭 Decoupled Actor Stage & Modular Control Strip
* **Standalone Actor Window**: Decoupled the character renderer from the main controls, allowing for a dedicated standalone window with premium rounded-xl borders, a bottom-right drag handle, and optimal aspect ratio rendering.
* **Control Strip Customizer & Window Manager**: Introduced a brand new customizer window manager with a bottom-placement popover, master button catalog, and an option for left-sidebar layout configurations.
* **Smart Window Snapping & Position Persistence**: Windows now feature smart edge-snapping behavior and remember their last position across application restarts.
* **Interactive Status Dot Indicators**: Added explicit state-driven indicators on the control strip, including red/green microphone toggles and a 5-way speech session indicator.

### 💬 Reliable Ingestion & Cross-Window Chat
* **Draft Salvaging & Timeout Prevention**: Implemented highly-robust cross-window message acknowledgment that broadcasts chat updates before database persistence, preventing frustrating draft timeouts.
* **Message Editing & Deduplication**: Added the ability to edit user messages in the chatbox, and eliminated duplicate chat bubble rendering.
* **Unified Chat Input Routing**: Streamlined input routing between different application surfaces via serialization-friendly hooks.

### 🧠 Semantic Search Refinement
* **Advanced Memory Retrieval**: Upgraded the local semantic search engine with **Reciprocal Rank Fusion (RRF)** and **Maximal Marginal Relevance (MMR)** to balance search relevance and diversity.
* **Multilingual Expansion**: Integrated native **CJK (Chinese, Japanese, Korean) Tokenization** to ensure accurate memory retrieval across multiple languages.

### 🎨 Live2D & UI Polishing
* **Expression Persistence**: Resolved issues with Live2D character expression memory and applied essential artmesh rendering patches.
* **AIRI Card Layouts**: Re-engineered Card Editor layouts to enforce square image crops, consistent toolbars/labels, and light fallback backgrounds.

### 🛡️ System Stability & Lifecycle Safeguards
* **Crash-on-Quit Prevention**: Deployed a global prototype-level guard against accessing destroyed `BrowserWindow` and `webContents` instances, resolving the most prominent crash during quit transitions.
* **Caption Visibility Synchronization**: Added support for caption windows to dynamically align with and follow the visibility of the primary stage.

***

## 📝 Detailed Changelog

### 🖥️ Desktop (stage-tamagotchi) & Electron Main Process
* Implemented standalone control strip sizing, dragging, and customizer menu layouts.
* Enforced window boundaries and edge-snapping logic.
* Global prototype-level safety wrapper on Electron windows to preemptively block "Object has been destroyed" crashes on close.
* Premium design tweaks for caption window styling and docking indicators.

### 📦 UI & Shared Modules (stage-ui / stage-shared)
* Refined semantic search indexing algorithm to support CJK text and MMR/RRF rank merging.
* Fixed duplicate rendering issues in the conversational history stream.
* Enabled live broadcast of chat updates prior to DB write completion to prevent UI locks.
* Persisted Live2D artmesh fixes and expressions correctly.
