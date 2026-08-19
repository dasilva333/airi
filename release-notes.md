# 🚀 AIRI v0.9.25-stable.20260818 — Release Notes

This release introduces the **Unity Stage-Mate Engine & Companion Floaties**, the **Full 9-Step Companion Wizard with Cloudflare Edge Vault**, **Stage-Mobile Dual Presentation Modes**, and **Proactivity Sub-Tabs with a Sneak Peek at Screen Watching**.

---

## ✨ Key Highlights

### 🎮 Unity Stage-Mate Engine & Interactive Companion Floaties
* **Modular Unity Engine Sidecar (`stage-mate`)**: Integrated the new `stage-mate` Unity engine sidecar! Brings dynamic 3D VRM model loading, realistic sway dynamics, C# IPC sidecar relays, radial pie menus, and 2-tier positioning persistence across both Windows and macOS.
* **Companion Floaties & Snack Props**: Give your companion interactive props and snacks directly from the Control Strip! Choose from pre-made presets (boba, tea, taiyaki, game controllers) or use the custom recipe builder to spawn floating items around your companion on the stage.
* **Settings Model Preview Sync**: Fixed VRM expression preview propagation in settings so expressions and materials update seamlessly in real time.

### 🪄 The Full 9-Step Companion Wizard & Cloudflare Edge Vault
* **Complete 9-Step Guided Setup**: Modernized the companion creation flow into an end-to-end guided sequence: **Hearing (STT) ➔ Speech (TTS) ➔ Body Vessel ➔ User Profile ➔ Persona ➔ Consciousness Brain ➔ Cloudflare Restore ➔ Calibration**.
* **Sign-In with Cloudflare & Edge Vault**: Connect your Cloudflare account directly within the setup wizard to instantly back up or selectively restore your credentials and companion states with `airi-edge-vault` encrypted KV storage and zero-CORS edge routing.
* **Local Provider Auto-Wiring**: Overhauled under-the-hood provider initialization during setup — Local Whisper now cleanly reclaims VRAM on model switches, resolves word truncation, and configures alongside WebLLM and Kokoro with zero friction.

### 📱 Stage-Mobile & Stage-Pocket Revamp
* **Dual Mobile Presentation Modes**: Unified the mobile chat experience with 4 distinct sheet postures, smooth drag controls, Producer Guidance modals, and Producer Choice bubbles.
* **Theme-Aware Ambient Floating Hearts**: Added a theme-aware floating hearts stage scene layer alongside a frosted light control strip.

### ⚡ Proactivity, Audio Engine & Developer Previews
* **Proactivity Settings Revamp**: Re-architected Proactivity settings into 5 thematic sub-tabs with a busy pipe mutex and prefix-cache tail framing to keep automated heartbeats cost-effective and responsive.
* **Screen Watching (Developer Sneak Peek)**: A glimpse into our upcoming vision awareness engine! The developer preview tab and visual source picker UI are now in place as we finalize the background perception pipeline.
* **Real-Time SSE Audio Streaming**: Added real-time SSE audio streaming with actor pacing and synchronized character voice profiles across desktop and mobile.
* **Comprehensive Event Ledger**: Wired text/image journals, voice STT events, and tool execution results directly into the real-time Event Ledger.
