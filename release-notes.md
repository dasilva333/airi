# 🚀 AIRI v0.9.42-stable.20261028 — Release Notes

This release delivers a sweeping transformation across local auditory synthesis, multi-format avatar surgery, and procedural 3D motion diffusion: introducing **Ming 3.0 Local Neural TTS with Natural Language Voice Design**—enabling 100% on-device speech synthesis and promptcrafted custom voices running entirely in WebAssembly—alongside the **Universal Hacker Studio** supporting VRM, Live2D, and Spine avatar surgery, the **Generative Motion Studio powered by FlowMDM Neural Diffusion**, a **Snappier, Lazy-Loaded Floating Control Strip**, in-scene **Stage Radial Camera Framing Presets**, and **Resumable Long-Term Memory Vector Indexing**.

Companions can now generate and speak with custom voices designed entirely from text prompts without external cloud APIs, autonomously synthesize fluid skeletal motions on the fly during conversations, allow deep real-time texture and shader adjustments across 3D and 2D avatars, and give you cinematic camera framing control right from the stage radial menu.

---

## ✨ Key Highlights

### 🎙️ Ming 3.0 Local Neural TTS & Voice Design Studio
* **100% On-Device Neural Synthesis**: Integrated Ming 3.0 running directly inside Electron and modern browsers via a dedicated multithreaded WASM compute pool, delivering rich neural speech synthesis with zero cloud latency, zero API keys, and zero telemetry.
* **Natural Language Voice Design**: Design completely custom voice personalities on the fly using freeform text descriptions (e.g. *"Warm, gentle anime heroine with a calm, breathy cadence"*), complete with curated inspiration templates in Onboarding V3 and Voice Settings.
* **Overhauled 2×2 Voice Engine Grid**: Redesigned the voice engine picker into an ergonomic 2×2 modal with purpose badges (*Chat, Roleplay, Ambient*), providing seamless switching between Kokoro, Ming 3.0, Pocket TTS, and Web Speech.
* **Zero-Setup Quick-Start Slot**: Ming 3.0 is integrated as a default keyless local speech engine option during first-run onboarding.

### 👗 Universal Hacker Studio: Multi-Format Avatar Surgery (VRM, Live2D, Spine)
* **Universal Adapter Architecture**: Completely re-engineered Hacker Studio (formerly V-HACK Lab) around an extensible adapter contract, expanding deep asset surgery beyond 3D VRM to natively support **Live2D** and **Spine** avatars.
* **Direct Material & Texture Editing**: Inspect texture material ownership directly on loaded models, tweak color maps in real time, and inspect modifications with gamma-compensated preview lighting.
* **Local Editing vs. AI Promptcraft**: Seamlessly toggle between local manual texture edits and generative promptcraft workflows to customize avatar outfits, hair colors, and accessories.
* **Lossless Model Exporting**: Export customized avatars directly into standard GLB and ZIP formats with texture modifications and material bindings cleanly preserved.

### 💃 Generative Motion Studio & FlowMDM Diffusion
* **Unified Motion Studio Popover**: Debuted a dedicated Motion Studio popover accessible directly from the stage Control Strip, featuring **Create** (Text-to-Motion) and **Library** tabs, an "All vs Gen" filter, and instant animation stop triggers.
* **FlowMDM Neural Sampler Hardening**: Upgraded the on-device text-to-motion engine with calibrated skeletal retargeting, yaw rotation stabilization, biped foot articulation, and contact inverse kinematics (IK) to eliminate foot sliding.
* **ACT-First Autonomous Motion Generation**: Companions can now autonomously generate and trigger custom skeletal animations based on `<|ACT:*|>` emotion and motion tokens during conversational turns.
* **Model Compatibility Gating**: Added an amber guidance notice when opening the Motion Studio with non-VRM models to guide users to compatible 3D avatars.

### ⚡ Snappier Floating Control Strip & Lazy-Loaded Menus
* **Lazy-Loaded Popover Menus**: Control Strip menus, avatar pickers, motions, and settings panels now lazy-load on demand rather than mounting all at once, slashing idle memory footprint and speeding up app launch.
* **Silky Smooth Interactions**: Opening and switching between stage panels is now instantaneous with zero stutter, layout lag, or dropped frames.

### 🎯 Stage Radial Menu & Camera Framing Presets
* **1-Click Camera Framing Presets**: Added calibrated one-click camera framing shortcuts (*Face / Close-up, Bust / Torso, Full-Body, Dynamic Dutch Angle*) directly into the in-scene stage radial menu.
* **Dual-Engine Matrix Calibration**: Camera framing coordinates are mathematically tuned for both 3D VRM camera matrices and Live2D 2D viewport coordinates.

### 🧠 Resumable Long-Term Memory Vector Indexing
* **Checkpointed Background Embedding**: Reworked long-term memory vector indexing to process entries oldest-first with persistent coverage checkpoints, allowing indexing jobs to resume seamlessly across app restarts without starting over.
* **Live Mind Map Telemetry**: Added real-time vector index telemetry to the Mind Map memory viewer, showing active embedder models, indexed chunk counts, and live indexing progress.

### 👂 Voice & Hearing Pipeline Polish
* **Single-Shot Cold-Mic Tap-to-Talk**: Added a cold-mic mode across all microphone surfaces for reliable, one-touch voice dictation without continuous background listening drift.
* **Live Interim STT Deduplication**: Fixed speech recognition buffer updates so interim voice-to-text results stream cleanly without cumulative sentence duplication.
* **Whisper Model Download Chips**: Shortened Whisper model cards in Hearing settings and added live download size badges for clear disk usage transparency.
* **Microphone Permission Visual Alerts**: Voice input cards now clearly display visual warning indicators when system microphone permissions are blocked.

### 🌐 Web Stage & Layout Polish
* **Control Strip Chatbox Toggle on Web**: Added a direct Chatbox visibility toggle button to the Web Stage Control Strip for parity with desktop.
* **Sentence-Sync Highlight Scoping**: Un-scoped CSS rules for sentence-sync subtitle highlighting so text glows accurately across rich HTML message bubbles.
* **Persistent Preview/Apply Avatar State**: Preserved preview vs. applied state selections across avatar popover re-opens.
