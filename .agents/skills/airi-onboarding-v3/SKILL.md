---
name: airi-onboarding-v3
description: >-
  Build/debug canonical first-run Onboarding V3: 18 semantic steps, Quick Start (60s), 5-item sliding stepper, archetype presets, dynamic module pruning, draft store, starter card atomic commit, and Electron/Web/Pocket window routing. Deprecates legacy V2.
---

# AIRI Onboarding (Canonical V3 Architecture)

The V3 onboarding flow is the **single canonical, fully shipped first-run wizard** across all platforms (Electron `/onboarding-v3`, Web, and Pocket).

> [!IMPORTANT]
> **V2 is Deprecated / Legacy Reference Only**: Legacy V2 files under `packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/` are preserved strictly for historical/reference purposes. All active development, routing, and first-run experiences run on **V3** (`v3/`). Do NOT route to, mount, or rebuild V2.

---

## 1. Authoritative Specification & Documentation

- **`docs/design-onboarding-v3.md`**: The canonical technical architecture specification, design decision record, and live implementation progress journal for Onboarding V3. Consult this for comprehensive field-by-field and step-by-step specifications.
- **`docs/design-onboarding-v3-emotions.md`**: Deep specification for Step 11 (Emotions & 2-Pass ACT Expression Bridge).

---

## 2. Key Files & Locations

### 2.1 Platform Mounting & Routing

1. **Desktop Electron**:
   - Window Manager: `apps/stage-tamagotchi/src/main/windows/onboarding/index.ts` loads `/onboarding-v3`.
   - Page Route: `apps/stage-tamagotchi/src/renderer/pages/onboarding-v3.vue` mounts `<OnboardingV3 @close="handleCloseV3" @finish="handleCloseV3" />`.
   - Tray Launch: "Start Companion Wizard" invokes `onboardingWindow.openWindow('/onboarding-v3')`.
2. **Web Stage**:
   - `apps/stage-web/src/App.vue` imports and mounts `<OnboardingV3 />`.
3. **Pocket Stage (Mobile)**:
   - `apps/stage-pocket/src/App.vue` imports and mounts `<OnboardingV3 />`.

---

### 2.2 Core Orchestrator & State Components

Directory: `packages/stage-ui/src/components/scenarios/dialogs/onboarding/v3/`

| Component / Utility | File Path | Responsibility |
|---|---|---|
| **Orchestrator** | `onboarding-v3.vue` | Master stepper container, dynamic step filtering, responsive sliding navigation bar, next/back state. |
| **Quick Start (60s)** | `quick-start.vue` | Rapid 60-second setup path offering instant zero-friction companion onboarding. |
| **Sliding Stepper** | `components/sliding-stepper.vue` | 5-item centered sliding-window breadcrumb stepper with chevron anchors (`<` / `>`) and popover jump menu. |
| **Draft Store** | `stores/useOnboardingV3Draft.ts` | Transient composition draft (`onboarding/v3-draft`) holding in-flight selections without writing to production stores until finale. |
| **Atomic Card Commit** | `composables/useStarterCardCommit.ts` | Atomic synthesis of character card, display model bindings, and initial chat session Turn 0 greeting into `cardsRepo`. |
| **Step Definitions & Types** | `types.ts` | Canonical `ONBOARDING_V3_STEPS` registry, module keys, and type contracts. |
| **Barrel Export** | `index.ts` | Exports `OnboardingV3`, `QuickStart`, and types. |

---

## 3. The 18-Step Journey Topology

```
[ 0. Welcome ] ──▶ [ 1. Triage ] ──▶ [ 2. Appearance ] ──▶ [ 3. Experience Archetypes ]
                                                                        │
   ┌────────────────────────────────────────────────────────────────────┘
   ▼
[ 4. User Profile ] ──▶ [ 5. Physical Vessel ] ──▶ [ 6. Consciousness (LLM) ]
                                                               │
   ┌───────────────────────────────────────────────────────────┘
   ▼
[ 7. Soul & Persona ] ──▶ [ 8. Hearing (STT)* ] ──▶ [ 9. Speech (TTS)* ]
                                                                    │
   ┌───────────────────────────────────────────────────────────────┘
   ▼
[ 10. Thinking (Pacing)* ] ──▶ [ 11. Emotions (ACT Bridge)* ] ──▶ [ 12. Vision (Chat VLM)* ]
                                                                             │
   ┌────────────────────────────────────────────────────────────────────────┘
   ▼
[ 13. Proactivity & Screen* ] ──▶ [ 14. Artistry (Visuals)* ] ──▶ [ 15. Memory Hierarchy* ]
                                                                             │
   ┌─────────────────────────────────────────────────────────────────────────┘
   ▼
[ 16. Automation & Tools* ] ──▶ [ 17. Stage Finale & Launch ]
```
*\* Denotes optional modular steps dynamically governed by the selected Experience Archetype.*

---

### Step Catalog (`v3/steps/`)

| # | Step ID | Component | Domain & Responsibility |
|---|---|---|---|
| 0 | `welcome` | `step-welcome.vue` | Welcome quote, brand visual, `Quick Start (60s)` vs `Guided Setup` toggle, and tray dismissal. |
| 1 | `triage` | `step-triage.vue` | Account Sign-In (Cloudflare Zero-Trust PKCE) vs Local Air-Gapped Companion; cloud companion restore. |
| 2 | `appearance` | `step-appearance.vue` | Display language (8 locales), Dark/Light theme mode, 24-color accent palette. |
| 3 | `experience` | `step-experience.vue` | 6 Archetype Presets (*Casual Companion*, *Quiet Observer*, *Creative Muse*, *Executive Copilot*, *Ambient Roommate*, *Swiss Army*) & 9-module pruning. |
| 4 | `profile` | `step-profile.vue` | User persona, callout name, user preferences. |
| 5 | `vessel` | `step-vessel.vue` | Unified 3D Vessel Coverflow (Live2D, VRM, MMD, Spine) with instant preview. |
| 6 | `consciousness` | `step-consciousness.vue` | LLM mind (WebLLM WebGPU or 77+ Cloud providers). |
| 7 | `persona` | `step-persona.vue` | Character card & soul selection (`STARTER_CHARACTERS`, SillyTavern imports). |
| 8 | `hearing` | `step-hearing.vue` | Microphone capture, VAD threshold, STT engine (Whisper WebGPU / Web Speech). |
| 9 | `speech` | `step-speech.vue` | Neural TTS (Kokoro WebGPU, Cloud TTS, ElevenLabs) with pitch/rate controls. |
| 10 | `thinking` | `step-thinking.vue` | Conversational pacing presets (*Snappy*, *Balanced*, *Deep CoT*) & subconscious asides. |
| 11 | `emotions` | `step-emotions.vue` | 2-pass ACT Expression Bridge (normalizing morphs to `<\|ACT:*\|>` tokens). |
| 12 | `vision` | `step-vision.vue` | Chat photo & VLM 2-hop visual test. |
| 13 | `proactivity` | `step-proactivity.vue` | Schedule, ambient heartbeats, quiet hours, and desktop display perception. |
| 14 | `artistry` | `step-artistry.vue` | Visual generation (Pollinations AI free tier or ComfyUI Bring-Your-Own-Workflow). |
| 15 | `memory` | `step-memory.vue` | 4 Temporal Memory Quadrants (STMM daily summaries, Sacred Journal LTMM, Lifetime Thread, Echo Chips). |
| 16 | `tools` | `step-tools.vue` | External tools (0-Key Web Search, Desktop Filesystem MCP, Screen Snapshots `take_screenshot`, 3D Motion Generator). |
| 17 | `finale` | `step-finale.vue` | Pre-Flight Honesty Matrix & seamless Turn 0 greeting launch into Stage. |

---

## 4. Architectural Rules

1. **Draft Isolation**: Steps write strictly into `useOnboardingV3Draft`. No production stores (`airi-card`, `consciousness`, `hearing`, `speech`) are mutated until the finale step (`step-finale.vue`) executes atomic synthesis.
2. **Dynamic Step Pruning**: Never hardcode numeric step indices. Step traversal is computed reactively from `activeSteps` based on `draftStore.state.modules`.
3. **Sliding Breadcrumb Stepper**: Header navigation displays a maximum 5-item sliding window around the active step, preventing horizontal scrollbars and layout shifts.
4. **Quick Start (60s)**: Always maintain the fast path in `quick-start.vue` so users who desire instant setup can start talking to an avatar immediately without navigating all 18 modular chapters.
