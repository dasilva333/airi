# 🚀 AIRI v0.9.27-stable.20260824 — Release Notes

This release introduces the **Proactivity Engine Overhaul & Chatbox Memory Controls**, the **Stage-Mate "Gunslinger" Mod & Screen Decals**, **Universal 4-Format Head-Tethered Speech Captions (VRM, MMD, Spine, Live2D)**, **Head-Anchored In-Scene Radial Menus**, and **Stage-Mate Locomotion & Media Dance Detection**.

---

## ✨ Key Highlights

### 🧠 Proactivity Engine Overhaul, Memory Controls & Chatbox Revamp
* **Revamped Chatbox Options Menu**: Re-architected the chatbox action menu with streamlined option grouping, instant access to system settings, and cleaner modal transitions.
* **Inline Short-Term Memory (STMM) Toggle**: Added an instant STMM toggle directly inside the chatbox memory popover, giving you immediate control over daily context injection on the fly.
* **Card Dream State Persistence**: Fixed character dream state persistence and lifecycle tracking so emotional anchors, mood exhaust, and memory consolidations stay consistent across sessions.
* **Proactivity Sensor Sync & Message Deduplication**: Fine-tuned the proactivity engine with synchronized OS sensory telemetry (idle time, active window tracking, sound levels) and eliminated duplicate chat triggering.
* **Composer Typing Soft Gate**: Added active typing awareness so proactive heartbeats gracefully wait while you are typing instead of interrupting mid-thought.
* **KV Prefix-Cache Decoupled Grounding**: Decoupled short-term daily summaries and lifetime artifacts into trailing grounding blocks to maximize DeepSeek/Gemini prefix-cache hit rates and keep automated proactivity cost-effective.

### 🤠 Stage-Mate "Gunslinger" Mod & Interactive Chaos
* **Gunslinger Stance & 4-Way Cycler**: Equip your companion with a sidearm directly from the Control Strip stance cycler!
* **Global Mouse & Aiming Telemetry**: Streams cross-platform mouse coordinates to dynamically track and aim at targets on your screen.
* **Procedural Cartoon Bullet Holes & Screen Tears**: Spawns playful comic bullet holes and glass crack decal overlays upon firing with interactive hover border glow highlights.

### 💬 Universal 4-Format Head-Tethered Speech Captions
* **Full 4-Format 3D Parity**: 3D head-tethered comic speech bubbles now dynamically track head bone coordinates and perspective across **VRM**, **MMD**, **Spine**, and **Live2D** avatars alike!
* **Decoupled Sentiment Engine & Visual FX**: Real-time sentiment analysis dynamically morphs speech bubbles with floating hearts, impact rings, and thought clouds across every model engine.
* **Unity Speech Bubble Bridging**: Streams real-time TTS dialogue captions directly into Stage-Mate Unity dialogue speech bubbles.

### 🎯 Head-Anchored In-Scene Radial Menu
* **Cross-Model Head-Tethered Radial Menu**: Quick-action menu controls now anchor directly above your companion’s head, dynamically following their movements across the screen on all model engines.
* **Frictionless In-Scene Actions**: Access expressions, quick actions, and settings directly from the avatar's head anchor without reaching for secondary toolbars.

### 🎮 Locomotion, Screen Edge Peeking & Media Dance Detection
* **Screen Edge Peeking & Locomotion**: Calibrated dock and window ledge snap thresholds, enabling your companion to naturally wander, sit, or peek out from screen borders.
* **Media Player Dance Detection**: Automatically senses macOS and Windows media playback to trigger rhythmic companion dance routines.
* **Head-Focus Lock**: Automatically pauses locomotion and walking when engaging in dialogue or looking directly at the camera.

### 🎙️ Audio Pipeline & Mobile Auth Polish
* **Robust Audio Stream Fallbacks**: Added binary audio streaming and SSE error fallback recovery to ensure uninterrupted voice playback.
* **API Token Auth & Mobile OAuth Fallback**: Smooth API token onboarding with mobile OAuth fallbacks and automated Android release signing.
