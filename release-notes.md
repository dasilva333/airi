# 🚀 AIRI v0.9.24-stable.20260813 — Release Notes

This release introduces **Live2D Head-Tethered Captions & WebGL Comic FX**, the all-new **Companion Creation Wizard**, a **Built-in WebLLM WebGPU Provider (Zero API Keys)**, the **Kyutai Pocket TTS Engine with 26 Voices**, **Attention Ecology 24/7 Vision Perception**, and the **Unified Event Ledger**.

---

## ✨ Key Highlights

### 💬 Live2D Head-Tethered Speech Captions & WebGL Comic FX Engine
* **3D Head-Tethered Speech Bubbles**: Speech captions now dynamically anchor directly above your character’s head in real time! Features 3D perspective tracking, 0-seam continuous vector paths, and automatic viewport clamping so bubbles never clip off-screen.
* **Dynamic 4-Channel WebGL Comic FX**: Your companion’s dialogue now transforms the bubble into an animated comic panel per-phrase based on emotions, punctuation, and natural speech habits:
  * 💖 **Flustered / Affection**: Floating vector hearts, pink blush wash, and heart-curled tails (`♡`).
  * 💭 **Thought Cloud**: Morphs into a scalloped cloud bubble with trailing thought-dots for inner monologues `(parentheses)`.
  * ⚡ **Shock / Exclamation**: Comic impact ring bursts, radial speed lines, and spring scale punches on `!!` / `!?`.
  * 💢 **Tsundere / Angry**: Jagged starburst vector outline, pulsing anger marks (`💢`), and horizontal shake.
  * 🌧️ **Melancholic Rain**: Translucent blue teardrop rain sliding down the interior and drooping tail.
  * 🖤 **Yandere / Obsessive**: Dark violet vignette glow and heartbeat outline pulse (`🖤`).
  * 🌸 **Star Blooms**: 6-pointed vector star blooms sprouting along the top outline for compliments and praise.
  * 🐾 **Playful Cat**: Dynamic 60 FPS sine-wave tail wagging on cat speech (`nya~`, `meow`, `purr`).
  * 🌐 **Cyber Scanlines**: Animated cyan scanlines and data grid drift for tech / system diagnostics.
* **How to Enable**: Open **Customizer ➔ Captions** window and toggle **"Head-Tethered Captions"** ON (*Active for Live2D models today, with VRM 3D & Spine support coming soon!*).

### 🪄 The All-New Companion Wizard
* **Redesigned Setup Experience**: We've completely replaced the old setup screens with a sleek, step-by-step **Companion Wizard**.
* **Frictionless Guided Flow**: New users get a smooth, friendly walkthrough to set up their companion's hearing (speech-to-text), speech (voice engine), 2D/3D body model, persona card, user profile, and AI brain — explained in plain, simple words.
* **Multi-Companion Creation**: Existing users can launch the wizard anytime to quickly craft brand-new companions, seamlessly reusing their existing API keys, local models, and saved provider settings without starting from scratch.
* **Easy Access**: Launch the Companion Wizard anytime from the **"+ Create Companion"** button in the AIRI Cards page or directly from the **System Tray** menu!

### 🧠 Native WebLLM WebGPU Provider (Zero API Keys)
* **Local WebGPU AI Engine**: Run top open models (Gemma 3, Llama 3.2, Qwen 2.5, Phi 3.5, SmolLM2) locally on your GPU with **zero API keys** and zero external servers!
* **Model Search & VRAM Tiering**: Includes model catalog search indexing and Local Free AI quick shortcuts.

### 🗣️ Kyutai Pocket TTS Engine & 26 Preset Voices
* **Local Neural Speech Flow**: Integrated the local Kyutai Pocket TTS neural flow sampling engine for ultra-fast local speech synthesis.
* **26 Predefined Kyutai Voices**: Cataloged 26 Kyutai Pocket TTS voices filtered by language selection, complete with HuggingFace gated model token support and voice presets.

### 👁️ Attention Ecology & 24/7 Vision Perception
* **Cascaded Salience Gate**: Implemented a 4-tier salience gate (pHash → CLIP vision embedding → WASM Tesseract.js OCR → VLM forwarder) for zero-cost 24/7 background vision perception.
* **DevTools Perception Inspector**: Added a live ASCII terminal dashboard script and DevTools inspector for background perception metrics.

### 📊 Unified Event Ledger
* **Real-time Event Logging**: Integrated a unified Event Log store emitting live user input ingestion, tool calls, and assistant response events into a workspace route drawer UI.

### 🎭 Live2D Runtime Enhancements
* **State-Preserving Costume Swaps (`change_cos`)**: Added support for structured target costume hot-swaps (`change_cos`) without resetting motion state.
* **Motion Gating**: Added `MotionEnable` and `MotionDisable` instruction toggles to control character motion triggers.
