# 🚀 AIRI v0.9.19-stable.20260721 — Release Notes

This release brings major **Actor Stage & WhisperDock upgrades**, a **Spine Model overhaul**, new **Model Marketplaces**, an **Adhoc Custom Character Creator with local vision auto-tagging**, and a full **Captions Position/Visibility split**.

---

## ✨ Key Highlights

### 🎭 Actor Stage & WhisperDock
* **WhisperDock Notch**: Moved the static keyboard shortcut icon off the stage surface and into a hidden notch — tap the notch to expand it, click anywhere else to dismiss it.
* **Stage Config Overlay**: Replaced the old hide-stage button with a cog icon that opens a dedicated config overlay for fine-tuned stage control.
* **Quick Resize**: Added the ability to instantly pick between 4 preset stage sizes directly from the config overlay.
* **Quick Position**: Added corner-snap controls to quickly reposition the stage to any screen corner with one click.
* **Window Bounds Clamping**: Fixed an issue where resizing the stage window could push it outside the visible screen area — it will now always stay fully on screen.

### 🃏 AnimaDex & Custom Characters
* **Adhoc Custom Character Creator**: Added an inline flow for creating, editing, cloning, and deleting custom characters directly within the AnimaDex Wizard (`guided.vue`). Custom characters persist locally (`airi:animadex:custom-characters`) and merge transparently into catalog searches, synthesis steps, and card generation pipelines.
* **In-Browser Local Vision Auto-Tagging**: Integrated headless `blip-local` vision tag extraction inside the Custom Character dialog. Users can pick a reference artwork to automatically generate comma-separated visual tags into the modifiers field in seconds with zero persistent image overhead.
* **Two-Row Filter Layout Restructure**: Restructured the AnimaDex character selection header into two distinct, purpose-driven control rows: Row 1 for primary actions (`+ Add Custom Character`) and feature toggles (`Has Bound Model`), and Row 2 for gender trait filters (`All`, `Female`, `Male`, `Ambiguous`, `Non-Human`).
* **Custom Card Badges & Hover Management**: Overlaid purple `CUSTOM` badges on custom character cards in the wizard grid, along with fallback gradient portraits and inline hover controls for **Edit**, **Clone**, and **Delete**.

### 🦴 Spine Model Overhaul
* **Emotions List Normalization**: Revamped the `ModelCustomizer` to normalize all Spine variants and skins into a unified static Emotions list.
* **Dual Hit-Detection Architecture**: Added a dual hit-detection system with a new settings UI for Spine models.
* **Track Collision Fixes**: Resolved track collision bugs and removed destructive `setToSetupPose` calls during motion updates.
* **ACT Token Outfit Trigger Fix**: Resolved ACT token outfit triggers not correctly applying for Spine models during motion updates.
* **Thumbnail Generator Fix**: Fixed a non-empty skin bug in the preview generator for full-body thumbnail capture.
* **Spine 3.x → 4.1 Upgrader**: Integrated an in-memory WebAssembly-based Spine skeleton upgrader that automatically converts legacy Spine 3.x archives on import.

### 🌐 Model Marketplaces & Cloud Browser
* **Eikanya Archive**: Integrated the Eikanya Archive directly into the model selector — featuring **5,000+ free Live2D models** available to browse and download instantly.
* **SillyTavern Live2D Portal**: Integrated the SillyTavern Live2D community portal as a second marketplace tab in the model selector.
* **Cloud Model Browser Improvements**: Enhanced the remote cloud model browser with metadata caching and tab-scoped loading states.
* **CORS Bypass Auto-Coalesce**: Automatically merges default CORS bypass URLs with user-defined proxy configurations.

### 📝 Captions Overhaul
* **Split Position & Visibility Settings**: Separated captions position and visibility into independent controls, along with a full overhaul of the customizer and control-strip toggles.

### 💬 Chatbox Window
* **Rehearsal Room Voice Inheritance Fix**: Fixed the Rehearsal Room not inheriting the active character's voice — the ACT token was defaulting to the global voice instead of respecting the character-specific voice assignment.
* **Generation Stats Popover**: Added a new popover that surfaces live token output statistics and exposes token output limit controls.
* **TTS Markdown Stripping**: Strip markdown image embeds from TTS pre-processing to prevent garbled audio output.
* **Live2D Caption System**: Documented and improved the Live2D caption system with module config and model selector improvements.

### 🔧 Bug Fixes & Stability
* **Control Strip Notch Simplification**: Simplified the Control Strip from a 3–4 state proximity peek mechanism to a clean 2-state hover — the notch now only reveals itself when you hover directly over it, reducing accidental triggers.
* **Live2D Motion Hooks**: Resolved motion group/index resolution before firing local hooks and broadcasting.
* **ModelAssignmentModal**: Added a new model self-healing resolver with a `ModelAssignmentModal` fallback.
* **Layout Overflow Fix**: Resolved layout overflow in `ModelCustomizer` list items.
* **Self-Healing Backup Path**: Dynamically resolves the hardcoded self-healing backup path using active sync configurations.

