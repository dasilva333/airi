# 🚀 AIRI v0.9.22-stable.20260803 — Release Notes

This release introduces **Real-Time In-Browser FlowMDM ONNX Motion Diffusion (WebGPU)**, **AnimaDex Story Generator Trope Decks**, **High-Performance Model Selector Pagination**, **Additive Live2D Motion Blending**, **Settings Spotlight Search**, and **Selective Cloud Sync Safeguards**.

---

## ✨ Key Highlights

### ⚡ Real-Time FlowMDM Motion Diffusion (WebGPU)
* **In-Browser FlowMDM Diffusion**: Integrated a client-side ONNX WebGPU motion diffusion pipeline that generates 3D character motions in real time directly inside your browser using local GPU acceleration!
* **Text-to-Motion Module Page**: Added a dedicated **Text to Motion** settings surface with a provider toggle between Procedural Acting and FlowMDM Motion Diffusion.
* **Motion Diffusion Playground**: Includes an interactive FlowMDM settings playground to tweak sampling steps, guidance scales, and model downloads.

### 🃏 AnimaDex Story Generator & Model Selector Performance
* **Story Generator Trope Deck**: Added an interactive trope deck selector to the AnimaDex Wizard (`guided.vue`) for picking narrative archetypes during card creation, and sanitized nickname placeholders.
* **Ultra-Fast Model Selector**: Overhauled the Model Selector dialog with Set lookups, debounced search, and 100-item batch pagination — rendering massive 5,000+ model catalogs smoothly without UI lag.

### 💃 Additive Motion Blending & Stage Polish
* **Additive Live2D Motion Blending**: Enabled additive motion blending for Live2D models, allowing layered animation transitions (e.g. idle breathing + gesture overlays) without harsh cuts.
* **Spine One-Shot Audio Preview**: Motion previews in the customizer now automatically play their mapped audio clips alongside one-shot Spine animations.
* **MMD Sidecar Texture Support**: Properly maps sidecar textures during MMD model preview rendering and made Spine model archive imports non-blocking.
* **LocalForage Proxy Corruption Fix**: Fixed a subtle bug where Vue reactive Proxy objects caused file corruption during `localforage` metadata persistence by un-proxying model objects prior to saving.

### 🔍 Settings Spotlight Search & AnimaDex Hero Guidance
* **Spotlight Search Bar**: Added a global Spotlight-style search bar inside Settings to instantly locate deep settings, toggles, and feature modules.
* **Thematic 2-Row Quick Access Grid**: Re-architected the settings overview into two clean thematic rows featuring square shortcut cards.
* **AnimaDex Hero Guidance Banner**: Added a dismissible, persistent welcome hero banner to Step 1 of the AnimaDex Wizard with contextual tips for choosing templates or creating custom characters.

### ☁️ Cloud Sync Safeguards & AVIF Optimization
* **AVIF Background Optimization**: Optimized default wallpaper images to AVIF format, reducing asset sizes by up to 65% while maintaining image quality.
* **Selective Sync Download Guard**: Enforced strict download guards in `sync-engine.ts` so remote model downloads only pull user-authorized assets.
* **Direction-Aware Quota Guard**: Prevents cloud sync bandwidth and storage quota overruns during heavy sync operations.
* **Voice Profile Catalog Sync**: Added background sync reconciliation for voice profile catalogs.
