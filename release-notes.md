# 🚀 AIRI v0.9.14-stable.20260706 — Release Notes

This release introduces **Introspective Memory Feedback Loops**, implements **Automatic Edge-Snapping Auto-Hide** for the Control Strip, adds **Discord Direct Message (DM) controls**, and refines the **AnimaDex Wizard** with auto-assignment utilities.

---

## ✨ Key Highlights

### 🧠 Memory Features & Introspective Feedback Loops
* **Action Reflection Loops**: Implemented introspective feedback loops where your character's recent activities (such as journaling, dreaming, or creating art) are injected into their immediate context. This allows them to reflect on their own recent actions and naturally incorporate those memories into their next response.
* **Dream & Artistry Reflective Prompts**: Created guided prompts that let your character know what they just dreamed or painted, allowing them to reference these moments dynamically during chat.
* **Memory Summary Stability**: Added safety locking to the short-term memory manager to prevent duplicate concurrent summary runs, ensuring memory histories remain stable.
* **Custom Journal Prompts**: Added a customizable system prompt template for shaping Journal Moments.

### 🎛️ Control Strip Snap-to-Edge & Auto-Hide
* **Auto-Hide Mode**: Implemented an automatic edge-snapping auto-hide mode with full support for macOS work area/screen boundaries.
* **Popover Retention**: Automatically holds the Control Strip in an expanded state whenever a popover menu is actively open.

### 💬 Discord DM Access Control
* **Master Toggle for DMs**: Added a settings toggle to restrict or enable DM command ingestion and private message listening on Discord.
* **Sync Isolation**: Excluded the `settings/discord/enabled` configuration flag from cloud sync to avoid syncing local integration status.

### 🧙 AnimaDex Wizard & Auto-Assign Tools
* **Studio Auto-Assign Utility**: Added a new utility to batch auto-assign voices and motions to existing cards directly in the Studio panel.
* **Extensible Voice Assigner**: Refactored the voice auto-assigner tool to hook into an extensible provider registry.
* **Wizard Action Splits**: Split the final "Confirm & Create" step in the onboarding wizard into 3 explicit actions and resolved Step 3 scrolling issues.

### 🗣️ TTS & Choice Improvements
* **AWS Polly Enhancements**: Integrated new AWS Polly generative and long-form voice models.
* **Punctuation Filtering**: Automatically filters out and drops punctuation-only text chunks before sending them to the TTS dispatcher to prevent silent vocal triggers.
* **Producer Choice Mutings**: Instantly cancels suggestion audio playback when a message is sent or when the producer bubble component unmounts.
