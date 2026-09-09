# AIRI Onboarding V3: Architecture Specification & Progress Journal

---

## 1. Document Mission & Scope

This document serves as the **canonical technical architecture specification**, **design decision record**, and **live implementation progress journal** for the clean-slate **Onboarding V3** wizard.

### 1.1 Relationship to Prior Documentation
- **`docs/project-onboarding-modernize.md`**: Preserved as the reference specification for the legacy V2 overhaul concept and Cloudflare PKCE / WebGPU background analysis.
- **`docs/design-onboarding-v3.md` (This Document)**: The authoritative, living implementation ledger that tracks every architectural distinction, file boundary, and component responsibility of the canonical V3 implementation.

---

## 2. Core Architectural Distinctions (V2 Overhaul vs. Canonical V3)

| Architectural Pillar | Legacy V2 Overhaul Plan (`project-onboarding-modernize.md`) | Canonical V3 Architecture (This Specification) |
| :--- | :--- | :--- |
| **File & Step Naming** | Monolithic numbered steps (`0:welcome.vue`, `1:experience.vue`, `3:voice.vue`). Step numbers became meaningless and brittle when steps were reordered or conditionally omitted. | **Domain-driven semantic names** (`welcome.vue`, `experience.vue`, `thinking.vue`, `emotions.vue`, `artistry.vue`, `sensory.vue`, `tools.vue`). No leading numbers. |
| **Breadcrumb Stepper** | Monolithic list of 15 buttons stretching across the window header, causing horizontal overflow, truncated labels, and cognitive clutter. | **5-Item Sliding-Window Stepper**: Dynamic centered window showing `[current - 2]` to `[current + 2]` with subtle `···` overflow anchors. Constant width, zero layout shift. |
| **Physical Avatar Selection** | Segregated into installed models vs. a secondary modal dialog triggered by a "Find Free Bodies" top-right button. | **Unified Vessel Coverflow**: Local avatars (`✓ Installed`) and downloadable models (`🌐 Free Download`) presented side-by-side in a single 3D coverflow carousel with source and format filters. |
| **Cognition & Acting Division** | Combined "Acting & Calibration" into a single overloaded tab conflating conversational fillers, Live2D/VRM morph mapping, and motion delays. | **Cleanly Unbundled into Thinking vs. Emotions**: <br>• **Thinking**: Cognitive latency, 3 conversational pacing presets (*Snappy*, *Balanced*, *Deep CoT*), and 3-tier subconscious aside extraction (Needle 2 WASM).<br>• **Emotions**: The ACT Bridge. 2-pass AI Expression Curation (Pass 1: raw morph normalization to `<|ACT:*|>` tokens; Pass 2: prompt directives teaching character how to express them). |
| **Artistry & Visual Synthesis** | Buried deep within advanced card editor with complex routing mode dropdowns, JSON parameter blocks, and 12+ Director evaluation sliders. | **Streamlined Provider & Character Setup**: <br>• **Top 2 Engines**: Pollinations AI (100% Free / Zero-Config with Quick Pick models) vs. ComfyUI (Local Node:8188) vs. None.<br>• **Visual Style Prompt Box**: Auto-injected with selected vessel's physical traits, preset style chips (+ Ghibli, + Cyberpunk, + Shinkai, + Cozy Cafe), and a bottom-right `[🎨 Preview]` button opening a fast, non-disruptive preview modal.<br>• **Autonomous Director**: Single clean toggle switch, hiding all low-level evaluation knobs. |
| **Sensory & Proactivity** | Spread across disconnected tabs (Proactivity, Attention Ecology, Sleep Gate). | **Unified Sensory Step**: Screen Watching with 4 delivery modes (`Voice & Bubble`, `Bubble Only`, `Voice Only`, `Muted`), Zero-Cost Salience Gating (Lightweight OCR vs Moondream2 VLM), Ambient Heartbeats with `NO_REPLY` sentinel, and Bedtime / Quiet Hours schedule. |
| **Memory & Tool Placement** | Memory and external tools split across separate wizard steps. Dream State required 8 technical parameter sliders. | **Consolidated Tools & Skills Step**: Complete memory hierarchy in one view: **24h Short-Term Memory (STMM)** positioned directly above **Long-Term Text Journal (LTMM)**, Image Journal, and **Dream State** (reduced to a single clean checkbox), followed by Web Search and Filesystem MCP tools. |
| **Stage Handoff** | Generic completion dialog with artificial 100% checkmarks. | **Stage Finale & Pre-Flight Honesty Matrix**: Real verification across 4 pillars (Audio Input, Reasoning Core, Voice Synthesis, Avatar Stage) + seamless Turn 0 greeting continuity into Stage. |

---

## 3. Canonical 15-Step Journey Topology

```
[ 0. Welcome ] ──▶ [ 1. Triage ] ──▶ [ 2. Experience Archetypes ]
                                                 │
   ┌─────────────────────────────────────────────┘
   ▼
[ 3. Soul & Persona ] ──▶ [ 4. Physical Vessel ] ──▶ [ 5. User Profile ]
                                                             │
   ┌─────────────────────────────────────────────────────────┘
   ▼
[ 6. Hearing (STT) ] ──▶ [ 7. Consciousness (LLM) ] ──▶ [ 8. Thinking (Pacing & Asides) ]
                                                                     │
   ┌─────────────────────────────────────────────────────────────────┘
   ▼
[ 9. Speech (TTS) ] ──▶ [ 10. Emotions (ACT Bridge) ] ──▶ [ 11. Artistry & Visuals ]
                                                                     │
   ┌─────────────────────────────────────────────────────────────────┘
   ▼
[ 12. Sensory & Proactivity ] ──▶ [ 13. Tools & Skills ] ──▶ [ 14. Stage Finale ]
```

### Dynamic Step Pruning by Archetype
While 15 steps exist globally, the wizard reactively prunes steps based on the user's selected archetype in Step 2:
- **The Quiet Observer (Text Only)**: Skips Hearing, Speech, Thinking, and Artistry (4-step streamlined path).
- **The Casual Companion (Voice & Soul)**: Full audio, reasoning, and emotions; defaults Artistry and Proactivity to zero-overhead presets.
- **The Executive Copilot (Productivity)**: Prioritizes Consciousness, Screen Watching, Web Search, and Filesystem MCP.
- **The Dynamic Performer (Full Multimodal)**: Traverses the complete 15-step pipeline with all visual and acting modules active.

---

## 4. Component Responsibility & File Topology

To prevent maintaining a fragile, monolithic file, Onboarding V3 is structured into modular components with clear separation of concerns under `packages/stage-ui/src/components/scenarios/dialogs/onboarding/v3/`:

```
packages/stage-ui/src/components/scenarios/dialogs/onboarding/v3/
├── OnboardingV3Dialog.vue             # Host dialog, window chrome, step router
├── components/
│   ├── SlidingStepper.vue             # 5-item sliding-window breadcrumb stepper
│   ├── VesselCoverflow.vue            # 3D Coverflow carousel for avatar bodies
│   ├── PersonaCardGrid.vue            # 2-column character card selector
│   └── ArtPreviewModal.vue            # Non-disruptive visual style preview modal
├── steps/
│   ├── StepWelcome.vue                # Step 0: Welcome & initial language selector
│   ├── StepTriage.vue                 # Step 1: Local-first vs Cloudflare sync
│   ├── StepExperience.vue             # Step 2: 4 Hero Archetype cards
│   ├── StepPersona.vue                # Step 3: Soul & Persona selection / creation
│   ├── StepVessel.vue                 # Step 4: Physical Vessel selection / import
│   ├── StepProfile.vue                # Step 5: User name & companion honorific
│   ├── StepHearing.vue                # Step 6: Mic selection, VAD, and STT engine
│   ├── StepConsciousness.vue          # Step 7: Local WebGPU / Cloud LLM provider
│   ├── StepThinking.vue               # Step 8: Conversational pacing & subconscious asides
│   ├── StepSpeech.vue                 # Step 9: Neural TTS provider & voice timbre
│   ├── StepEmotions.vue               # Step 10: 2-Pass AI Expression Curation & ACT tokens
│   ├── StepArtistry.vue               # Step 11: Pollinations/ComfyUI, visual prompt & director
│   ├── StepSensory.vue                # Step 12: Screen watching, salience gate & quiet hours
│   ├── StepTools.vue                  # Step 13: 24h STMM, LTMM, Dream State, MCP tools
│   └── StepFinale.vue                 # Step 14: 4-pillar readiness honesty matrix & launch
├── stores/
│   └── useOnboardingV3Draft.ts        # Transient Pinia state store (zero dirty writes to DB)
└── types/
    └── onboarding-v3.ts               # Canonical TypeScript interfaces & archetype contracts
```

---

## 5. Implementation Progress Journal

### Phase 1: UX Alignment & Interactive Prototype
- [x] Align on clean-slate V3 architecture (no numbered filenames, 5-item sliding stepper).
- [x] Design Unified Vessel Coverflow merging installed and community models with status badges.
- [x] Unbundle Thinking (pacing presets, subconscious asides) vs Emotions (2-pass ACT bridge).
- [x] Streamline Artistry: Pollinations vs ComfyUI vs None, character visual style prompt with auto-injected vessel descriptors, bottom-right `[🎨 Preview]` button opening quick loading modal, and single toggle for Autonomous Director.
- [x] Consolidate Sensory: Screen watching delivery modes, salience gating, ambient heartbeats, bedtime schedule.
- [x] Consolidate Tools & Skills: 24h Short-Term Memory (STMM) right above Long-Term Text Journal (LTMM), Image Journal, Dream State single checkbox, and MCP tool switches.
- [x] Validate full 15-step interactive prototype (`tmp/onboarding_v3_flow_prototype.html` & `docs/prototypes/onboarding_v3_flow_prototype.html`).

### Phase 2: Core Contracts, Types & Transient Draft Store
- [ ] Implement `packages/stage-ui/src/components/scenarios/dialogs/onboarding/v3/types/onboarding-v3.ts`.
- [ ] Implement `packages/stage-ui/src/components/scenarios/dialogs/onboarding/v3/stores/useOnboardingV3Draft.ts`.
- [ ] Wire hardware detection seam (`isWebGPUSupported()`, audio input stream check).

### Phase 3: Stepper & Host Shell
- [ ] Implement `SlidingStepper.vue` (5-item dynamic sliding window with `···` anchors).
- [ ] Implement `OnboardingV3Dialog.vue` (shell layout, route navigation, archetype step pruning).

### Phase 4: Personality & Form Steps
- [ ] Implement `StepWelcome.vue` & `StepTriage.vue`.
- [ ] Implement `StepExperience.vue` (Hero Archetypes).
- [ ] Implement `StepPersona.vue` & `PersonaCardGrid.vue`.
- [ ] Implement `StepVessel.vue` & `VesselCoverflow.vue` (Installed + Community models).
- [ ] Implement `StepProfile.vue` (User name & companion honorific).

### Phase 5: Voice & Cognitive Steps
- [ ] Implement `StepHearing.vue` (Mic test, Whisper WebGPU / Web Speech).
- [ ] Implement `StepConsciousness.vue` (WebLLM / OpenAI-compatible / Cloud).
- [ ] Implement `StepThinking.vue` (Pacing presets, Needle 2 subconscious asides).
- [ ] Implement `StepSpeech.vue` (Kokoro WebGPU / Edge TTS / Pocket-TTS).
- [ ] Implement `StepEmotions.vue` (2-pass ACT expression curation bridge).

### Phase 6: Autonomous World & Memory Steps
- [ ] Implement `StepArtistry.vue` & `ArtPreviewModal.vue` (Visual style prompt, preview modal, Director toggle).
- [ ] Implement `StepSensory.vue` (Screen watching, reaction delivery mode, salience gating, quiet hours).
- [ ] Implement `StepTools.vue` (24h STMM, LTMM, Dream State checkbox, MCP tools).

### Phase 7: Stage Finale & Atomic Synthesis
- [ ] Implement `StepFinale.vue` (4-pillar honesty readiness verification matrix).
- [ ] Implement atomic card synthesis (compile draft store into target `AiriCard` and `AiriExtension`).
- [ ] Implement Turn 0 continuity transition into live stage runtime.
