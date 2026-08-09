# 🚀 AIRI v0.9.23-stable.20260808 — Release Notes

This release introduces **Stage Edge 24/7 Discord Companion Presence**, the **Multi-Instance Provider Studio**, the **Live2D DSL Virtual Machine Engine & Intimacy Overlay**, **MOSS-TTS-Nano Voice Acceleration**, and **WebGL Performance Optimizations**.

---

## ✨ Key Highlights

### 🌐 Stage Edge & 24/7 Discord Companion Presence
* **24/7 Discord Cloud Relay (`stage-edge`)**: Launched the `stage-edge` Cloudflare Worker package! Your companion can now stay online 24/7 in your Discord servers via Cloudflare Workers — even when your desktop app is turned off.
* **2-Step Deployment Review Flow**: Includes a 2-step Cloud Relay deployment wizard with automatic Cloudflare account resolution, OAuth PKCE auto-prompting, and CORS bypass coalescence.
* **Smart Rolling Memory Seeding**: Features 2-way rolling memory and conversation history seeding so your companion retains past context seamlessly between desktop and cloud runs.
* **Visual Memory Review Modal**: Added an interactive memory review modal before deploying, with automatic execution mode handovers.
* **Clean Discord Tag Stripping**: Automatically strips internal visual tags (`<|ACT|>`) from LLM responses before delivering messages to Discord.

### 🎛️ Provider Studio Overhaul & Multi-Instance Providers
* **Multi-Instance Provider Support**: Completely re-architected provider settings! You can now configure and run **multiple concurrent instances** of any provider type (e.g. 3 separate OpenAI-compatible endpoints, multiple Ollama endpoints, etc.) with per-instance API keys and custom configuration.
* **1-Click Model Activation**: Added 1-click active model activation directly from provider cards.
* **Modern Provider Studio UI**: Redesigned the Provider Settings surface with hero headers, endcap console links (`consoleUrl`), API key eye toggles, and exposed form layouts.
* **Smooth Provider Navigation**: Fixed back-button navigation in settings so returning from a provider page lands directly on its category anchor without history loops.

### 🎭 Live2D DSL Engine & Intimacy Overlay (`live2d-runtime`)
* **Standalone Live2D DSL VM (`live2d-runtime`)**: Built a dedicated Live2D Domain-Specific Language (DSL) Virtual Machine package with manifest parsing, heap variable tracking (`VarFloats`), and motion group dispatching.
* **Choice Menus & Intimacy Integration**: Bridged Live2D DSL choice menus and character intimacy tracking directly into the dating-sim overlay interface.
* **Standalone Playground & Headless Harness**: Added a standalone Live2D DSL playground, zip-loader fixes, and a headless scenario runner test suite (`HeadlessDslTestHarness`).

### ⚡ Voice Cloning Acceleration & Speech Polish
* **MOSS-TTS-Nano Acceleration**: Accelerated the MOSS-TTS-Nano voice cloning pipeline with `prompt_audio_codes` audio caching for near-instant speech generation.
* **Smart Field Prioritization**: Speech and transcription settings now intelligently prioritize active credentials and active model options.

### 🚀 WebGL Memory & 512x768 WebP Model Catalog
* **WebGL Background Scene Pausing**: Automatically pauses background 3D WebGL scenes when opening the Model Selector dialog, eliminating GPU memory spikes and frame stutter.
* **High-Res WebP Thumbnails**: Upgraded model preview thumbnails to crisp 512x768 WebP images alongside compressed metadata caching.

### 🛠️ Desktop Windowing & Build Tooling
* **Stage Caption Follow Rules**: Consolidated stage-caption follow rules in the main process and gated ghost capture windows.
* **Multi-Actor Pre-Speech Sync**: Resolved actor model desync on multi-actor pre-speech writes.
* **Portable Windows ZIP Target**: Updated release scripts to automatically package and upload a portable `.zip` release alongside setup `.exe` installers to bypass Windows Defender SmartScreen blocks.
