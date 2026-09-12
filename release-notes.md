# 🚀 AIRI v0.9.31-stable.20260911 — Release Notes

This release is highlighted by the debut of **Onboarding V3** featuring an express **Quick Start Cockpit**, a built-in **AI Character Creator**, an **Instant-Response UI Overhaul across Chat, Settings & Model Galleries**, **On-Device Moondream2 WebGPU Vision**, and **Granular Submesh Wardrobe Controls**.

---

## ✨ Key Highlights

### 🌟 1. Onboarding V3: The Complete Companion Setup Reimagined

* ⚡ **Quick Start Cockpit (60-Second Setup)**:
  * Designed for users who want immediate gratification without navigating complex setup menus.
  * Launch instantly with the official AIRI character triad (Airi, Neuro-inspired, or custom) alongside a real-time on-device LLM inference benchmark that validates your local setup before entering the stage.
* 🎨 **Built-in AI Character Creator**:
  * Added as a full-featured creation suite directly within the Persona step alongside Starter Presets and the Community Hub.
  * **Image-to-Character Tagger**: Drop any avatar artwork or reference photo to automatically extract visual traits via the integrated **Waifu Diffusion (WD) Tagger**.
  * **AI Story & Scenario Synthesis**: Select an anime trope archetype (*Tsundere, Kuudere, Genki, Deredere, Dandere, etc.*) and let the LLM generate 3 rich backstory and greeting scenario proposals with in-place editing and instant vessel binding.
* 🎭 **6 Tailored Experience Archetypes (12–19 Dynamic Steps)**:
  * Rather than forcing a rigid checklist, the wizard adapts dynamically based on how you plan to use AIRI:
    1. **The Quiet Observer** *(12 Steps · Minimalist)*: Lightweight text companion with inner thoughts, zero audio/vision overhead.
    2. **The Casual Companion** *(15 Steps · Popular Choice)*: Spoken dialogue, chat photo perception, and long-term memory.
    3. **The Creative Muse** *(15 Steps · Visual Focus)*: Spoken voice, visual generation (Pollinations/ComfyUI), and expressive avatar morphs.
    4. **The Executive Copilot** *(15 Steps · Productivity)*: Voice dialogue, active display perception, window tracking, and filesystem MCP tools.
    5. **The Ambient Roommate** *(15 Steps · Proactive Presence)*: Ambient heartbeats, sleep schedule, quiet hours, and display awareness.
    6. **The Swiss Army Companion** *(19 Steps · Master Journey)*: The complete all-in-one flagship setup across all multimodal faculties.
* 💃 **3D Vessel Coverflow & Dedicated Emotions Cockpit**:
  * **Unified Avatar Coverflow**: Browse local (`✓ Installed`) and community (`🌐 Free Download`) VRM and Live2D avatars side-by-side in a responsive 3D carousel.
  * **Dedicated Emotions Cockpit**: An interactive soundboard and live avatar stage to preview emotional expressions and calibrate 2-pass `<|ACT:...|>` kinetic animations so your companion emotes naturally during speech.
* 🛡️ **Stage Finale & Pre-Flight Honesty Matrix**:
  * Replaces fake completion checkmarks with a real pre-flight diagnostics check verifying your Audio Input, Brain Reasoning Core, Neural Voice Synthesis, and 3D Avatar Stage are 100% operational before launching directly into Turn 0 of your stage.

---

### ⚡ 2. Instant-Response UI & Zero-Hang Performance Overhaul

We systematically hunted down the most frustrating UI freezes across the app—where clicking a tab or opening a window used to leave you staring at an unresponsive screen for seconds—and gave them instant visual feedback and progressive hydration:

* 💬 **Chatbox Fast-Boot & Virtualized History**:
  * Rebuilt the desktop chatbox with a pre-paint shell that opens instantly without window jank, while heavy background services hydrate smoothly in parallel.
  * Added zero-jank reverse-scroll windowing so you can scroll through thousands of past conversation messages with silky-smooth frame rates.
* 👗 **Instant Model Settings & Avatar Customizer**:
  * Eliminated multi-second freezes when clicking into Model Settings or Avatar Customization.
  * Scene engines (`ThreeScene`, `Live2DScene`, `SpineScene`, `MMDScene`) are now asynchronously split with skeleton loading placeholders and a 150ms deferred hydration gate, delivering immediate feedback the moment you click.
* 🎨 **Standalone Card Editor Hub & Instant Discover Avatars**:
  * Decoupled the character editor into its own dedicated route (`/settings/card-editor/:id`) with instant responsive breadcrumbs and skeleton states.
  * The Model Selector and Discover Avatars surfaces now load cached author previews immediately, eliminating empty whiteout states.
* 🛡️ **Eliminated Duplicate T-Pose Avatars & DOM Flickering**:
  * Cached active 3D avatar instances in `modelStore` to prevent models from reloading or flickering during UI redraws, and added defensive scene sweeps to permanently fix duplicate T-pose avatars spawning on route transitions.

---

### 👁️ 3. Local On-Device Vision (Moondream2 WebGPU)

* 🧠 **100% Local Vision Perception**:
  * Integrated **Moondream2** directly via WebGPU, allowing AIRI to analyze shared photos and screen regions locally on your machine with 0 API keys and complete privacy.
* 🧪 **Faux-Chat Vision Simulator**:
  * Integrated a responsive dual-column test simulator in Vision settings to preview 1-hop direct image analysis versus 2-hop OCR/CLIP salience filtering before sending frames to your companion.

---

### 🎮 4. Stage-Mate (Unity Companion) & Wardrobe Polish

* 🪡 **Granular Submesh Wardrobe Controls**:
  * You can now toggle individual submesh primitives on 3D avatars directly within the Wardrobe customizer and Stage-Mate (e.g., toggling specific jackets, hats, glasses, or accessories on and off).
* 🖐️ **Hand-Bone Anchored Border Peeking**:
  * When your companion peeks from the edges of your display, the offset is now anchored directly to the humanoid hand bone across macOS and Windows for a natural window-gripping stance.
* 🎯 **Gunslinger Aiming & Bullet Hole Projections**:
  * Normalized crosshair aiming thresholds and added projected window bullet holes onto desktop targets during interactive shooting play.
* 🖥️ **Multi-Monitor Radial Menu & Break-the-Ice Greet**:
  * The mascot's head-anchored radial menu now detects and spans all connected displays with quick monitor jump slices, and new empty chat sessions feature a friendly "Break the Ice" callout.

---

### ☁️ 5. Cloudflare Zero-Trust & BYOS Sync Hardening

* 🔄 **Zero-Flood Sync Engine**:
  * Rebuilt the Bring-Your-Own-Storage (BYOS) sync pipeline to eliminate redundant database reads and prevent API rate-limiting during high-volume conversations.
* 🔑 **Edge Vault Self-Healing & Account Resolution**:
  * Fixed OAuth token serialization edge cases, added automatic account ID discovery, and enabled self-healing controls that automatically restore encrypted credentials from the Cloudflare Edge Vault.
* 🧹 **Local Storage Pruning & LevelDB Safety Guard**:
  * Added a "Prune Unlinked Local Models" feature with exact byte reporting to free up disk space, paired with startup integrity guards that prevent Chromium from discarding database WAL files.
