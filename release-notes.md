# 🚀 AIRI v0.9.30-stable.20260907 — Release Notes

This release introduces **Conversational Pacing & Dynamic Thinking Fillers (Phases 0–6 & Contract 2)** with in-bubble Chain-of-Thought streaming, the **3D Spotlight Character Carousel & Steam Workshop Avatar Extraction**, **Global Fallbacks & Faculty Defaults Matrix**, **Procedural Avatar Auras & VFX Shaders**, **Live2D Autoregressive Ambient Motion**, and the **Next-Gen Audio Pipeline with AIRI Audio Server**.

---

## ✨ Key Highlights

### ⏱️ Conversational Pacing & Dynamic Thinking Fillers
* **Zero-Gap Conversational Flow**: Eliminated awkward delays between user input and assistant responses with an instant, zero-lag thinking audio pre-cache and playback bridge.
* **Intentional Spoken Asides & Fillers**: Companions now naturally speak brief, context-aware thinking fillers (*"Hmm, let me see..."*, *"Looking into that..."*) while awaiting deep LLM reasoning, managed by a 4-state commitment lifecycle.
* **One-Click Pacing Profiles**: Choose between **Snappy** (fast, minimal fillers), **Balanced** (natural conversational cadence), and **Deep CoT Explorer** (rich reasoning vocalization).
* **Needle 2 On-Device Semantic Extractor**: Local model analyzes prompt complexity in real time to intelligently budget turn pacing and filler frequency.
* **In-Bubble Chain-of-Thought (CoT) Streaming Drawer**: Live reasoning thoughts stream inside an expandable, tail-chasing glass drawer within the chat bubble, complete with reading-speed ambient crawl and salience snap viewing.
* **Card Editor Pacing Controls**: Fine-tune maximum filler durations, customize character filler pools, and configure fail-safe voice profile fallbacks.

### 🎭 3D Spotlight Character Carousel & Avatar Discovery
* **Fluid Character Lineup Carousel**: Replaced the legacy card grid with an interactive 3D character spotlight carousel featuring smooth swipe transitions and quick roster switching.
* **Standalone "Discover Avatars" Surface**: Decoupled avatar exploration into a dedicated discovery hub with curated avatar archives and community showcase tips.
* **Steam Workshop Extraction**: Directly inspect, extract, and import 3D VRM and Live2D avatars from Steam Workshop archives and local package bundles.
* **Spine Model Framing & High-Res Previews**: Added dedicated camera framing for Spine 2D models, format badges (VRM, Live2D, Spine, MMD), and an automated gallery thumbnail reprocessor.

### 🛡️ Global Fallbacks & Faculty Defaults Matrix
* **Centralized Faculty Defaults**: Unified fallback matrix for core companion faculties (LLM Brain, Speech TTS, Hearing STT, Vision VLM) with speech 3-tuples (provider, model, voice) to guarantee companions never fall mute when third-party services degrade.
* **OpenCode Go Routing Affinity**: Added persistent session routing via `x-opencode-session` headers for seamless multi-turn conversations on OpenCode Go clusters.

### ✨ Procedural Avatar Auras & VFX Shaders
* **Real-Time GLSL Aura Shaders**: Render procedural elemental auras directly onto 3D VRM and Live2D avatars via Three.js shaders and universal bone sockets.
* **Kinetic Elemental Effects**: Added **Verdant Boost**, **Sacred Grove Mandala**, and glowing floating spores, triggerable via `<|ACT:...|>` kinetic tokens or the Model Customizer.

### 🍃 Live2D Autoregressive Ambient Motion & Gaze Blending
* **Natural Autoregressive Motion**: Integrated continuous, physics-based micro-movements, breathing, and natural head sways into the main stage and settings.
* **Additive Mouse Cursor Tracking**: Smoothly blended cursor tracking on top of ambient motion, preventing rigid cursor fixation while maintaining realistic eye and head contact.

### ⚡ Chatbox Performance & Fast-Boot Shell
* **Fast-Boot Pre-Paint Shell**: The desktop chatbox now renders chrome instantly on launch, hydrating complex sub-surfaces asynchronously in the background.
* **Zero-Jank Reverse-Scroll History**: Virtualized message list with inverted DOM windowing provides effortless scrolling through massive conversation histories.
* **Desktop Theme Layers & Popovers**: Synced stage backdrops, blur-behind styling, and floating target switchers for the desktop chatbox.

### 🎙️ Next-Gen Audio Pipeline & AIRI Audio Server
* **5-Slot Concurrent TTS & Pause Aligner**: Multi-worker audio synthesis queue with sentence boundary pause alignment prevents speech clipping and robotic cadence.
* **Tier 0 Prosodic Chunker**: Contextual clause chunker groups complete semantic thoughts before synthesis for human-like intonation.
* **AIRI Audio Server Provider**: First-class integration with the dedicated AIRI Audio Server runtime, deprecating legacy browser-local speech.
* **Voice Profile Synchronization by ID**: Multi-device sync merges voice profiles idempotently and automatically registers card voices.

### 🌌 Stage Atmospheres & Cloudflare Ecosystem
* **6 Atmospheric Particle Systems**: Added interactive floating Bubbles, Sakura Petals, Hearts, Stars, Musical Notes, and Crosses with a one-click Control Strip theme popover.
* **Cloudflare Settings Hub & Connect Wizard**: Complete Cloudflare module in Settings with token validation, account health telemetry, and relay management.
* **iPadOS Compatibility & Native Linux Packaging**: Official iPad screen and multitasking support on iOS, alongside native `.deb`, `.rpm`, and `.flatpak` distributions for Linux.
