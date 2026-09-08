# Architecture: Onboarding Character Selection & Physical Vessel (V3)

> [!NOTE]
> **Implementation Status**: This specification defines the decoupled soul-and-form companion selection in **Onboarding V3**:
> - **Step 2: Soul & Persona (Emotional Payoff First)** ([`packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/steps/step-4-persona.vue`](packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/steps/step-4-persona.vue))
> - **Step 3: Physical Vessel (DiscoverCarousel 3D Coverflow)** ([`packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/steps/step-5-vessel.vue`](packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/steps/step-5-vessel.vue))
>
> Moving Persona and Vessel to Steps 2 & 3 places the companion connection at the front of the journey, before hardware or provider calibration.

The Character Selection experience presents each starter trope with its **Built-in Thumbnail**, **Name**, and **Brief Bio** to create a compelling "Choose Your Starter" moment.

---

## 1. Step 2: Soul & Persona (The Starter Souls)

| Character | Role | Default Vessel | Bio Snippet |
| :--- | :--- | :--- | :--- |
| **ReLU** | The Companion | `Hiyori (Live2D)` | "A soulful connection that evolves alongside your data and heart." |
| **Dr. Aria** | The Scientist | `AvatarSample_A (VRM)` | "A brilliant, sharp-witted guide managing the AIRI research layer." |
| **Lupin** | The Guardian | `AvatarSample_B (VRM)` | "A loyal wolf-girl with fierce instincts and a protective heart." |
| **Custom** | Import | *Dynamic / User File* | "Import your own soul from .json or .png character cards." |

### 3-Tier Soul Structure:
1. **Tier 1 (Instant Starter Tropes)**: ReLU, Dr. Aria, Lupin, plus anime archetypes (Tsundere, Kuudere, Yandere) from `assets/animadex-catalog.json`.
2. **Tier 2 (Community Interceptor Hub)**: Seamless import from Chub.ai, JannyAI, JanitorAI, and Risu Realm with automatic `{{user}}` templating replacement.
3. **Tier 3 (AI Guided Creator)**: Feature-preview card for deep custom synthesis.

---

## 2. Step 3: Physical Vessel (DiscoverCarousel 3D Coverflow)

Step 3 completely overhauls avatar selection by integrating the spotlight coverflow carousel component directly from [`packages/stage-pages/src/pages/settings/models/components/DiscoverCarousel.vue`](packages/stage-pages/src/pages/settings/models/components/DiscoverCarousel.vue):

- **Primary View — 3D Drag & Snap Coverflow**:
  - Smooth momentum drag physics (`useElementSize`, drag inertia).
  - Spotlight showcase of bundled 3D VRM (`AvatarSample_A`, `AvatarSample_B`) and 2D Live2D (`Hiyori`) starter bodies.
  - Interactive format chips: `[ All Formats ]`, `[ VRM (3D) ]`, `[ Live2D (2D) ]`, `[ Spine ]`, `[ MMD ]`.
- **Secondary View Toggle — Installed Library**:
  - `[ 📂 Choose from Installed Library ]` toggles the full grid view for users with pre-existing models.
- **Ever-Present Dropzone**:
  - Drag-and-drop support for `.vrm`, `.model3.json`, `.skel`, and `.zip` archives.

---

## 3. Active Components & Stores

### [Component] Step Persona (Soul)
- [`packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/steps/step-4-persona.vue`](packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/steps/step-4-persona.vue)
- Manages character card identity, system prompts, and trope definitions.

### [Component] Step Vessel (Body)
- [`packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/steps/step-5-vessel.vue`](packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/steps/step-5-vessel.vue)
- Integrates `DiscoverCarousel.vue` for 3D coverflow body selection.

### [Store] Transient Draft & AIRI Card Stores
- [`packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/draft-store.ts`](packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/draft-store.ts)
- [`packages/stage-ui/src/stores/modules/airi-card.ts`](packages/stage-ui/src/stores/modules/airi-card.ts)
- [`packages/stage-ui/src/stores/display-models.ts`](packages/stage-ui/src/stores/display-models.ts)

## Relevant Skills

- [[airi-onboarding-v2]]
- [[airi-character-rendering]]
- [[airi-card-schema]]

