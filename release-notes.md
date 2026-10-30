# 🚀 AIRI v0.9.43-stable.20261030 — Release Notes

This release introduces a foundational evolution in how AIRI is delivered and maintained: introducing **In-App Over-The-Air (OTA) Updates powered by Ergosphere**—delivering instant, in-place code and interface updates directly within the desktop application without downloading massive installers—alongside the **OpenJev 151M Local Cognition Model** with real-time decision diagnostics, **Smooth Desktop Perception Source Caching**, and **WebGPU Laya Sequence Batch Splitting**.

---

## ⚡ The New Way AIRI Updates: Instant Over-The-Air (OTA) Updates Are Here!

Starting with **v43**, you no longer need to visit the GitHub Releases page every few days to download giant 1 GB+ installers or extract zip files.

AIRI now features built-in **Over-The-Air (OTA) Updates** powered by Ergosphere. Code and interface improvements download seamlessly in the background as tiny, cryptographically signed bundles (typically only 5–15 MB) and apply in seconds.

### 🚀 How to Use It
1. Open AIRI and head to **Settings > About**.
2. You’ll see your current installed version alongside the new **Update Channel** picker:
   - **Stable**: Recommended for everyday companion use. Receives tested, polished feature releases.
   - **Canary**: Our fast-lane testing channel. Used for rapid iterative bugfixes and live patches (perfect for verifying fixes with us on Discord).
   - **Nightly**: Bleeding-edge automated builds updated overnight.
3. Click **Check for Updates**. When an update is ready, AIRI will download the delta package with a live progress indicator.
4. Click **Reload to Apply** (or restart the app normally). AIRI will seamlessly reboot into the new version with zero installer dialogs or system permission prompts.

### 📦 What This Means for GitHub Releases Moving Forward
- **The GitHub Releases page is now reserved for foundational catch-up releases.** We will only publish full installer bundles on GitHub when a core platform shift occurs (such as an Electron major upgrade or new native binary libraries).
- For regular features, fixes, and performance updates, you can simply stay inside AIRI and let the in-app updater keep you current!

---

## ✨ Key Highlights

### 🧠 OpenJev 151M Local Cognition & Real-Time Diagnostics
* **Integrated OpenJev 151M System-1 Model**: Integrated the local OpenJev 151M decision model for rapid, non-autoregressive discrete classification and fast conversational routing.
* **Live Cognition Telemetry**: Added dedicated cognition UI panels and diagnostic telemetry to inspect decision latency, confidence scores, and discrete routing classifications in real time.

### 🖥️ Desktop Perception & WebGPU Performance Polish
* **Desktop Perception Source Caching**: Intelligently caches desktop capture streams across continuous screen perception queries, eliminating micro-stutters and lowering CPU/GPU overhead during background monitoring.
* **WebGPU Laya Sequence Batch Splitting**: Sequence lengths for local Laya System-1 inference are now automatically split into batches above 4096 tokens, preventing WebGPU buffer overflows and driver crashes on integrated GPUs and portable devices.

### 🎨 UI & Localization Polish
* **Standardized Alert Primitives**: Upgraded alert dialogs and warning boxes across settings surfaces to use standardized `@proj-airi/ui` Alert components with consistent styling.
* **Document Language Localization Sync**: The HTML document `lang` attribute now synchronizes dynamically with your selected UI locale, ensuring accurate typography and screen reader pronunciation across languages.

---

## 🌐 Community & Upstream Radar

### 🌊 Community Pull Requests
* **PR [#31](https://github.com/dasilva333/airi/pull/31): `fix(stage-ui): cap Laya sequence at 4096 and split batches to fit WebGPU buffer ceiling`** — Submitted by community contributor **@meckbaig**, resolving WebGPU buffer limits during local System-1 model execution.

### 🌊 Upstream Pull Requests (Forward-Ported from moeru-ai/airi)
* **PRs [#3221](https://github.com/moeru-ai/airi/pull/3221), [#3224](https://github.com/moeru-ai/airi/pull/3224), & [#3232](https://github.com/moeru-ai/airi/pull/3232): `feat(ui): adopt Alert component and migrate legacy alert references`** — Sourced and adapted from upstream by **@nekomeowww**, standardizing UI alert elements across setup and settings surfaces.
* **PR [#3219](https://github.com/moeru-ai/airi/pull/3219): `fix(i18n): set document language to UI locale`** — Sourced and adapted from upstream by **@nekomeowww**, synchronizing the document `lang` tag with the active interface language.
* **PR [#25 (anlmalabs/airi)](https://github.com/anlmalabs/airi/pull/25): `feat(stage-ui): port TS7006 catch annotations and dynamic diagnostics`** — Sourced and adapted from sister fork author **@7n1m4**, bringing dynamic diagnostic annotations and strict TypeScript catch typing.
