# Proposal: Default Cards Revamp & Multi-Character Starter

This proposal outlines the revamp of AIRI's default starter cards. It introduces a pre-configured **Multi-Character Combo Card** to showcase AIRI's visual studio, multi-actor staging, and local Kokoro TTS voice system immediately out-of-the-box, alongside adding voice profiles to the existing single-character starters.

---

## 1. The Core Objective

Currently, AIRI seeds three standalone starter cards: **ReLU** (Companion), **Dr. Aria** (Scientist), and **Lupin** (Guardian).

We want to:
1.  **Add a Multi-Character Starter**: A new default card featuring multiple built-in models working together in a single scenario.
2.  **Showcase Core Tech**: Use the combo card to demonstrate real-time visual model swapping (using `AvatarSample_A`, `AvatarSample_B`, and `Hiyori`) and voice switching (via Kokoro TTS profiles).
3.  **Upgrade Existing Starters**: Go back to the single-character cards and configure native, high-quality Kokoro voice profiles for each.

---

## 2. The Multi-Character Starter Concept

To showcase the multi-actor capabilities without immediately resorting to a harem trope, we need a setting where multiple archetypes naturally collaborate.

### Suggested Scenario: "The Aria Lab & Workshop"
*   **Characters Included**: Dr. Aria (The Lead Scientist) and Lupin (The Stage Security/Assistant).
*   **The Premise**: The user is entering the AIRI research layer as a new lab technician or guest observer.
*   **Dynamics**:
    *   **Dr. Aria** behaves as the sharp, professional lead investigator, explaining the system telemetry.
    *   **Lupin** acts as the guard/mechanic, chiming in with protective remarks or hardware updates.
*   **Actor Concepts**:
    *   `actor_aria`: Maps to the `AvatarSample_A` VRM model and a mature Kokoro voice profile.
    *   `actor_lupin`: Maps to the `AvatarSample_B` VRM model and a tomboyish/energetic Kokoro voice profile.

---

## 3. End-to-End Voice & Visual Configurations

### A. Kokoro TTS Profile Assignments
We will pre-define and bundle Kokoro voice profiles directly inside the card extensions:
*   **ReLU**: Assigned to a gentle, soft voice profile (e.g., Kokoro `af_bella` or `af_sarah` with light ASMR effects).
*   **Dr. Aria**: Assigned to a mature, articulate voice profile (e.g., Kokoro `af_nicole` or `am_adam` adjusted for clear scientific delivery).
*   **Lupin**: Assigned to an energetic, slightly raspy voice profile (e.g., Kokoro `af_aoi` or `af_jessica`).

### B. Concept Registry & Outfit Mapping (Production Studio)
The Multi-Character card will include a pre-configured registry under `extensions.airi.concepts`:
*   `actor_aria`: Appends prompt triggers for a lab coat, glasses, and professional demeanor. Swaps stage model to `AvatarSample_A`.
*   `actor_lupin`: Appends prompt triggers for tactical gear or a mechanic's jumpsuit. Swaps stage model to `AvatarSample_B`.
*   `concept_workshop_bg`: Sets the Stage background to a high-fidelity laboratory/workshop render.

---

## 4. Onboarding Integration

The final step of the onboarding flow (`step-character-selection.vue`) will be updated to offer this new selection.

*   **UI Layout**: Add a 4th "Choose Your Starter" card option alongside the standalone ReLU, Aria, and Lupin options.
*   **The "Combo" Option Card**:
    *   *Title*: "The Lab Crew (Aria & Lupin)"
    *   *Bio*: "Begin your journey with Dr. Aria and Lupin in a collaborative workshop scenario. Perfect for experiencing multi-actor transitions and voice profiles."
*   **Action**: Selecting the combo card seeds the multi-character card definition into the user's permanent library.

---

## Open Questions

1.  **Hiyori Inclusion in Combo**: Should we keep the combo card restricted to Aria and Lupin (making it a duo), or should we find a premise that naturally integrates ReLU (Hiyori) as well, showcasing all three built-in models?
2.  **Voice Profile ID Clashes**: How do we ensure that importing the default card dynamically registers the default Kokoro profiles in the global speech store without clashing if the user resets their data or edits them?

## Relevant Skills

- [[airi-card-editor-wizard]]
