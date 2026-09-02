# 🚀 AIRI v0.9.29-stable.20260902 — Release Notes

This release marks the **Official Production Graduation of the Proactivity & Screen Watching Engine**, alongside the **Complete Settings Architecture & Navigation Overhaul**, **Apple Core AI On-Device LLM Inference for iOS**, **Revamped Artistry Studio with Free Pollinations AI**, and **5 Progressive Tool Capability Packs**.

---

## ✨ Key Highlights

### 🌟 Proactivity & Screen Watching: Graduating to Production
* **Out of Preview Mode**: Proactivity has officially graduated from preview status! The experimental warning banners have been retired in favor of a polished, production-ready continuous companion loop.
* **Zero-Leak WebGPU & Vision Tensor Engine**: Completely plugged WebGPU tensor memory leaks, eliminated duplicate image decoding overhead, and streamlined the screen watcher daemon for 24/7 background operation.
* **Silero VAD & Audio Recorder Memory Cleanup**: Prevented audio buffer accumulation with bounded streaming buffers and lazy on-demand VAD model loading.
* **Unified 4-Layer Attention Gate**: Multi-tier heuristic filtering intelligently balances screen changes, AFK presence detection, active conversation context, and transparent dream consolidation cycles without interrupting you.

### ⚙️ Settings Hub Overhaul & Master-Detail Navigation
* **4-Cluster Modules Taxonomy**: Reorganized settings into 4 intuitive clusters (Sensory, Intelligence, Manifestation, Memory) with an architectural explainer banner and data-driven topology index.
* **Master-Detail Layout & Live Avatar Viewport**: Redesigned companion settings into a responsive two-pane split featuring a live, expandable stage preview while editing character parameters.
* **Omnibar Search & Subpage Discovery**: Added instant global settings search with deep hash-aware breadcrumb navigation.
* **24-Color Theme Spectrum**: Customize your interface with a 24-color swatch palette and live vibrancy tuning.
* **4-Tier In-Memory Card Gallery**: Ultra-fast character card browsing with cached author avatars and lazy dialog rendering.

### 🍎 Apple Core AI & CoreML On-Device Inference (iOS & Pocket)
* **Native CoreLLMKit Runtime**: Run quantized LLMs 100% locally on Apple Silicon and iOS using the Apple Neural Engine (ANE) via a dedicated Swift native plugin.
* **Prompt Delta Caching & Batched Prefill**: Deep memory residency optimizations ensuring rapid on-device token generation without draining mobile battery.
* **Wizard Consciousness Integration**: Choose Apple Core AI directly as your character’s brain in the mobile onboarding flow.

### 🎨 Artistry Studio Revamp & Free Pollinations AI
* **Free Pollinations AI Provider**: Generate scene backgrounds and character art with 0 API keys required out-of-the-box.
* **Segmented Artistry Tab**: Split character artistry into 3 clean sub-tabs (Presets, Autonomous Artistry, Backgrounds) for effortless image workflow management.

### 🧰 5 Progressive Tool Capability Packs & 0-Key MCP Web Search
* **5 Capability Packs**: Organized character tools into 5 progressive disclosure packs (Core, Web Search, Filesystem, Canvas, DevTools) with card-level ACL filtering.
* **0-Key Open Web Search & Filesystem MCP**: Enable live web searching with zero API keys and manage character filesystem tools safely.

### 🧠 User Memory Deletion & Sparkle Expression Gating
* **Direct Record Deletion for STMM & Journals**: Full control to view, inspect, and selectively delete daily short-term continuity blocks and journal memories.
* **Deterministic Expression Noise Gate**: Eliminates rapid facial expression flickering and adds a 3-step Sparkle AI curation wizard.
* **Spoken Karaoke Highlights**: Resolved multi-instance text highlight deletion races in MarkdownRenderer during speech playback.
* **Modern System Tray Menu**: Updated system tray with quick-launch links for the AnimaDex Wizard and Control Strip.
