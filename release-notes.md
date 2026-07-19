# 🚀 AIRI v0.9.18-stable.20260719 — Release Notes

This release introduces a major **Light Theme Visual Polish**, launches **Autonomous Motion (VRMA) Generation**, integrates new **Free LLM/TTS Providers**, and implements **Custom Actor Highlight Color Coding** inside the Concept Studio.

---

## ✨ Key Highlights

### 🎨 Universal Light/Dark Theme Polish
* **Light Theme Normalization**: Conducted a comprehensive layout and styling pass to fully normalize light theme support. Optimized backgrounds, borders, and text contrasts on key surfaces:
  * **AnimaDex Card Creator** (`guided.vue` wizard steps).
  * **AutoVoiceConfigModal** & Contextual hint strips.
  * **Persistent World Dock (Hotbar)** & Character selection card overlays.
  * **Producer Suggestion Choice Bubbles**.
  * **Chatbox** light theme styling.

### 🕺 Rehearsal Room & Motion (VRMA) Generation
* **Create Motion Generator**: Added a custom animation generator to the Rehearsal Playground to create, test, and save custom VRMA motions directly to the database.
* **Autonomous Motion Tool Calling**: Enabled autonomous `generate_motion` tool calling, allowing your companion to generate new custom animations dynamically.
* **Suggest Mode Keybinding**: Restored the quick-suggest keybinding trigger inside the Rehearsal Playground as a configurable trigger.

### 🌈 Concept Studio & Actor Color Coding
* **Actor Color Picker**: Added a custom actor highlight color picker inside the Concept Studio with support for runtime overrides.
* **Streaming Color Propagation**: Automatically propagates custom actor highlight colors to the chatbox headers and speech bubbles in real time.
* **Concept Cloning**: Added a new **Clone** button directly inside the Concept Studio to quickly duplicate active cards and concept configurations.

### 📇 AIRI Card Creator & Settings
* **Motion Tool Gating**: Added a new checkbox toggle to the Card Creator Tools tab to selectively enable or disable autonomous motion generation capabilities.
* **Character-Scoped Prompt Templates**: Made the Producer panel's suggestion prompt templates character-scoped so companions retain unique guidance rules.
* **Tool Filter Decoupling**: Decoupled the `allowedTools` capability filter from standard card generation toggles.
* **Composer Button Settings**: Added right-click configuration menus to the Send and Suggest composer buttons to quickly customize their respective keybindings.
* **Suggestion Settings Popover**: Added a new settings popover directly to the Suggestions button for configuring suggestion behaviors.
* **Onboarding Info Tooltip**: Added a new information tooltip helper to guide users through the initial onboarding flow.
* **Camera Selfie Fix**: Fixed the camera selfie countdown overlay behavior.

### 🔌 New Free Providers & Remote Catalog Sync
* **Remote Model Selector**: Integrated remote model browsing inside the model selector dialog, allowing users to view display models stored in the remote cloud sync server.
* **Pollinations AI & Xiaomi MiMo**: Integrated Pollinations AI (free image/text generation) and Xiaomi MiMo (free speech TTS) as out-of-the-box providers.
* **CORS Turnstile Fixes**: Resolved Turnstile captcha validation issues affecting settings layouts.
* **Remote Model Catalog Sync**: Implemented background remote model catalog syncs and selective model asset downloads.
