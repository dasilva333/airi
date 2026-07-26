# 🚀 AIRI v0.9.20-stable.20260725 — Release Notes

This release introduces **Scoped Outfit & Weapon State Memory**, **Spine Mesh Deformation (Cheek Stretching!)**, the **AnimaDex Ultra-Dense Grid**, fixes the infamous **Double Enter Bug**, removes the silent **Model Disk Purge Mechanism**, and synchronizes **Model Assignment Bindings**.

---

## ✨ Key Highlights

### 🔄 Scoped Outfit & Weapon State Memory (The "ACT as a Setter" Hook)
* **Visual State Continuity**: Ever changed into a costume mid-conversation only to have the character "flash" back to their default outfit on the very next turn? We've completely solved this visual reset loop.
* **Smart Local Memory**: Inline visual commands (like `<|ACT:emotion="French Maid [Gun]"|>`) now act as persistent state setters within the character's active scope. If your companion equips a weapon or changes outfits mid-speech, the stage *remembers* it—ensuring they start their next turn exactly as they left off, maintaining flawless visual immersion throughout your roleplay.

### 🦴 Spine Mesh Deformation & Tactile Pulling (Cheek Stretching!)
* **Tactile Mesh Deformation**: Added interactive mesh deformation and stretching to Spine models in tactile mode! For supported models (such as Trickcal models), you can now click and drag directly on specific model meshes to stretch and deform them dynamically with cursor movement (yes, cheek pulling is officially here!).
* **Dynamic Active Expression Sync**: Integrated automatic syncing for Spine variant and skin parameters directly from the Concept Registry's active expressions list.
* **Separated Emotions & Motions**: Split emotion tags and motion triggers into distinct, dedicated helper pill sections in the Card Creation Acting tab (`CardCreationTabActing`).

### ⚡ Fix: The Infamous "Double Enter" Bug
* **Double Enter & Event Deduplication**: Fixed the infamous "Double Enter" bug! Resolved an issue where pressing Enter or sending messages with multiple active Electron renderer windows open would fire duplicate `input:text` events, ensuring single-delivery broadcast isolation across all windows.

### 🃏 AnimaDex Wizard & Ultra-Dense Character Grid
* **Compact Single-Row Control Bar**: Redesigned the AnimaDex wizard search and filter bar into a sleek single-row toolbar, cutting header height by ~70% and showing far more character cards above the fold.
* **Ultra-Dense Edge-to-Edge Grid**: Upgraded the character collection grid to a flush, gapless tile layout with centered typography and subtle hover elevations—perfect for browsing and screenshotting large character rosters.

### 🧹 Sync Engine & Model Assignment Fixes
* **Silent Model Disk Purge Removed**: Completely removed the unrequested local model deletion block in `sync-engine.ts` that was silently purging local display model files from disk if they were missing from a remote server manifest.
* **Synchronized Model Assignments**: When assigning a model to a character via `model-assignment-modal.vue`, assignments now cleanly persist across both `local:airi-cards` and `settings/airi-card/character-bindings` simultaneously.

### 👁️ Vision Auto-Tagging Fine-Tuning
* **Tagger Sensitivity Tuning**: Tuned the in-browser vision tagger threshold to `0.20` and expanded the maximum tag extraction depth to `25` tags, extracting richer visual attributes from reference artwork.

### 🎨 Studio Monitor Layout Consolidation
* **Clean Two-Row Studio Header**: Restructured the Studio header into a consolidated 2-row layout — placing status indicators cleanly on the top row and the workspace title on the second row for improved vertical spacing.
