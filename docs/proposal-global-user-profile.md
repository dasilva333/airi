# Proposal: Global User Profile & Concept Hooks

This proposal outlines the design, implementation, and integration hooks of a **Global User Profile** within the AIRI architecture.

---

## 1. The Core Concept: "Global User Profile"

Historically, AIRI cards have been highly configured around character models, voices, and settings, but the User (player, coach, manager) has remained a flat string nickname.
This proposal introduces a persistent **Global User Profile** containing identity, visual prompt tags, and vocal configurations to unify the user's presence across different modules.

### State Data Model (`useUserProfileStore`)
A new global store to persist the user's profile state in `localStorage` or IndexedDB:

```typescript
interface UserProfile {
  name: string // User's display name (e.g. "Coach", "Manager")
  description: string // Narrative description (used by LLMs / Director)
  prompt: string // SD/ComfyUI visual prompt tags (e.g. "short hair, blue jacket")
  voiceProfileId?: string // Bound Audio Studio VoiceProfile ID for User speech
}
```

---

## 2. Integration Hooks

The Global User Profile integrates into four primary hooks across the system:

### Hook 1: Character Card Import Wizard (Chara2 Metadata Capture)
When importing a card via an uploaded PNG card image:
*   The system parses the EXIF/PNG metadata to extract the Character V2 json payload.
*   **The Change**: In the onboarding/import setup modal, instead of prompting the user *"What is your name?"* with a blank input, the field **automatically pre-fills** with `userProfile.name` from the global profile.

### Hook 2: AnimaDex Synthesis Wizard (Step 3 Setup)
In Step 3 (Context & Story Prompts) of the AnimaDex Wizard:
*   **The Change**: The **User Nickname / Identity** text field defaults to the `userProfile.name`.
*   The user's global description is automatically injected into the LLM synthesis payload under a new `user_context` schema entry to help the LLM contextualize relationships in greetings.

### Hook 3: Quick Add Buttons in Image Studio (Concept Injection)
In the Image Studio / ComfyUI prompt crafting panels:
*   **The Change**: A new **`+ Add User`** button is displayed.
*   Clicking it dynamically inserts the user's visual prompt tags (`userProfile.prompt`) directly at the cursor location inside the ComfyUI text area.
*   Treats the user as a virtual concept `user_actor` (decoupled from characters) for regional prompt positioning.

### Hook 4: Auditory Feedback in Producer Lite (Suggestions Text-To-Speech)
Under the **Producer Directives** suggestions drawer (Producer Lite / OE):
*   **The Change**: Add a small **Speaker Icon** (🎙️/🔊) next to each of the 4 suggestion cards.
*   When clicked, it uses the user's bound `voiceProfileId` to dynamically synthesize and play the suggestion text as an in-character voice clip.
*   This lets the user listen to their custom voice profile speaking the suggested dialogue line before confirming the turn.

---

## 3. Next Milestones & Task Breakdown

### Phase A: Global Store & Settings Panel
- [ ] Create `useUserProfileStore` inside `@proj-airi/stage-ui/stores`.
- [ ] Add a "User Profile" configuration section under settings UI (`stage-pages` Settings view) to let users customize their name, description, prompt tags, and select/create their own Voice Profile.

### Phase B: UI Elements
- [ ] Refactor the Chara2 PNG import parser to pre-fill the name.
- [ ] Refactor AnimaDex Wizard Step 3 to read default nickname from user profile store.
- [ ] Add the `+ Add User` button in the Image Studio prompt panels.
- [ ] Add the Speaker Playback button next to Producer suggestions in `DatingSimOverlay.vue` or suggestion drawers.

---

## 4. Future Immersive Speech Routing

When previewing or playing user speech (such as Producer Directive suggestions in the overlay view):
*   **Dynamic Playback Routing:**
    *   **Option A (Isolated Preview - Default):** When the user does *not* have an active 3D/2D model representation configured in their profile, speech plays back in isolation using a localized HTML5 `Audio` instance. This prevents story timeline pollution and avoids interrupting active character dialog.
    *   **Option B (Stage-Linked Playback - Immersive):** When the user *has* a bound 3D/2D display model representation on the stage, the preview routes the text through the main speech pipeline (`speechRuntimeStore.openIntent`). This dynamically activates the user's model, registers the speech segment in the live captions system, and triggers physical LipSync and visual animations on the user's avatar for a fully immersive preview.

## Relevant Skills

- [[airi-onboarding-v2]]
