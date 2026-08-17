# Architecture: Onboarding Character Selection (Shipped V2)

> [!NOTE]
> **Implementation Status**: This specification is fully implemented and active in **Onboarding V2** via decoupled steps:
> - **Step 4: Soul & Persona** ([`packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/steps/step-4-persona.vue`](file:///c:/Users/h4rdc/Documents/Github/airi-rebase-scratch/packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/steps/step-4-persona.vue))
> - **Step 5: Physical Vessel** ([`packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/steps/step-5-vessel.vue`](file:///c:/Users/h4rdc/Documents/Github/airi-rebase-scratch/packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/steps/step-5-vessel.vue))

The Character Selection experience presents each starter trope with its **Built-in Thumbnail**, **Name**, and **Brief Bio** to create a compelling "Choose Your Starter" moment.

## 1. Character Grid (The "Starter Souls")

| Character | Role | Model Assignment | Bio Snippet |
| :--- | :--- | :--- | :--- |
| **ReLU** | The Companion | `Hiyori (Pro)` | "A soulful connection that evolves alongside your data and heart." |
| **Dr. Aria** | The Scientist | `AvatarSample_A` | "A brilliant, sharp-witted guide managing the AIRI research layer." |
| **Lupin** | The Guardian | `AvatarSample_B` | "A loyal wolf-girl with fierce instincts and a protective heart." |
| **Custom** | Import | *Dynamic* | "Import your own soul from .json or .png character cards." |

---

## 2. Active Components & Stores

### [Component] Step Persona (Soul)
- [`packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/steps/step-4-persona.vue`](file:///c:/Users/h4rdc/Documents/Github/airi-rebase-scratch/packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/steps/step-4-persona.vue)
- 3-tier structure: Seeded starter cards, Anime Archetypes (`assets/animadex-catalog.json`), and Community Hub imports (JannyAI, Chub.ai, CharacterHub).

### [Component] Step Vessel (Body)
- [`packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/steps/step-5-vessel.vue`](file:///c:/Users/h4rdc/Documents/Github/airi-rebase-scratch/packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/steps/step-5-vessel.vue)
- 3D VRM & 2D Live2D preset selector with dropzone for custom models and explore links.

### [Store] Transient Draft & AIRI Card Stores
- [`packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/draft-store.ts`](file:///c:/Users/h4rdc/Documents/Github/airi-rebase-scratch/packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/draft-store.ts)
- [`packages/stage-ui/src/stores/modules/airi-card.ts`](file:///c:/Users/h4rdc/Documents/Github/airi-rebase-scratch/packages/stage-ui/src/stores/modules/airi-card.ts)


