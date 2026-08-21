# 🚀 AIRI v0.9.26-stable.20260820 — Release Notes

This release introduces the **3D Mesh Wardrobe Builder & Modular Outfits System**, **Stage-Mate Unity Lip-Sync & Expression Bridging**, **macOS Dock Snap & Sitting Postures**, **Incremental Lifetime Memory Maintenance**, and **Ultra-Lightweight Desktop Rendering Modes**.

---

## ✨ Key Highlights

### 👗 3D Mesh Wardrobe Builder & Modular Outfits System
* **Inline Wardrobe Builder Tab**: Added a dedicated **Outfits** tab in the Model Customizer to build, preview, and save custom clothing slots with real-time mesh toggle probing.
* **Hierarchical 3D Mesh Discovery**: Automatically inspects native glTF/VRM mesh hierarchies and presents them in an intuitive tri-state tree view with ancestor matching.
* **Hot-Reloading Unity Sidecar Sync**: Dynamically syncs outfit slots directly with the Stage-Mate Unity engine runtime via `MEClothes` injection.

### 🎮 Stage-Mate Unity Companion: Lip-Sync, Expressions & macOS Dock Snap
* **Phonetic Lip-Sync & Expression Bridging**: Stream real-time blendshape mouth shapes and phonetic lip-sync directly from the TTS runtime into the Unity avatar.
* **Fixed vs. Transient Expressions**: Companion now supports persistent resting emotions as well as fleeting facial cues that gracefully decay back to idle.
* **macOS Dock Snap & Sitting Posture**: Your companion can now snap and sit directly atop the macOS Dock or taskbar edge with calibrated seat anchors and unclamped vertical stage overflow.
* **Direct Body Drag & Transparent Click-Through**: Enjoy smooth dragging directly by clicking the avatar's body while maintaining transparent pixel click-through for windows underneath.

### 🧠 Memory Systems: Incremental Lifetime Maintenance
* **STMM-Cadence Lifetime Maintenance**: Short-term memory (STMM) daily blocks now automatically consolidate into the character's overarching **Lifetime Artifact** on daily rollover without requiring manual reprovisioning.
* **Universe-Scoped Changelogs**: Retains incremental maintenance diffs with zero-change deduplication and capped audit logs.

### ⚡ Desktop Performance & Runtime Packaging
* **Headless / Low-Power Mode (`--disable-webgl-stage`)**: Run AIRI in ultra-lightweight tray/sidecar mode or dedicate 100% of GPU rendering to the Unity engine.
* **Prebuilt Stage-Mate Companion Fetcher**: Integrated automated fetching and startup scripts for prebuilt Stage-Mate binaries on Windows and macOS.
* **Texture & Memory Stability**: Fixed VRM texture loading failures, resolved premature Blob URL revocations, and made V-HACK binary captures lazy to save RAM.

### 🪄 Onboarding & Startup Reliability
* **Granular Step-7 Synthesis Error Handling**: Enhanced error recovery, network retries, and example dialogue parsing in the Companion Wizard.
* **Windows VS Code Terminal Fix**: Automatically clears `ELECTRON_RUN_AS_NODE` in Windows startup scripts to prevent terminal launch lockups.
* **DELAY Token Pacing**: Calibrated `<|DELAY:...|>` pause tokens and conversational speech pacing heuristics.
