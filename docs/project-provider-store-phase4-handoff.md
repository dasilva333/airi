# Handoff Specification: Phase 4 Provider Studio UI Overhaul & Multi-Instance UI Activation

**Status:** Active Handoff Spec for Analysis & Design Review (Phase 4 First Turn)
**Target Directories:**
- `packages/stage-ui/src/stores/providers/`
- `packages/stage-ui/src/components/scenarios/providers/`
- `packages/stage-pages/src/pages/settings/providers/`
**Authors:** AIRI Team
**Related Design Specs & References:**
- [`design-multi-instance-provider-studio.md`](./design-multi-instance-provider-studio.md) — Multi-instance architecture and UX design blueprint.
- [`project-provider-store-phase3-handoff.md`](./project-provider-store-phase3-handoff.md) — Phase 3 completed engine report.
- [`project-provider-metadata-catalog.md`](./project-provider-metadata-catalog.md) — Canonical catalog of provider descriptions, pricing, and URLs.

---

## 1. Executive Summary & Objectives

With Phase 3 (Multi-Instance Engine & Observability Eradication) fully committed (`d30b62772`), the store backend is clean, decoupled, and multi-instance ready.

**Phase 4** focuses on activating the multi-instance engine at runtime (`createProviderInstanceStore`) and delivering the **Provider Studio UI Overhaul**.

### **Core Objectives**:
1. **Activate Multi-Instance Persistence ("Flip the Switch")**:
   - Wire `createProviderInstanceStore()` into [`packages/stage-ui/src/stores/providers.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/providers.ts) to replace single-slot storage with array-backed multi-instance storage (`ProviderInstanceConfig[]`).
2. **Multi-Instance UI Controls**:
   - Provide `[+ Add Instance]`, label editing, instance deletion, and primary instance selection controls in provider setting cards.
3. **Smart Field Prioritization & External Console Links**:
   - Prioritize `Base URL` for local providers (Ollama, LM Studio, ComfyUI, etc.) and `API Key` for cloud providers (OpenAI, Deepgram, ElevenLabs, etc.).
   - Display direct external links to provider developer consoles (`console.deepgram.com`, etc.) derived from registry metadata.
4. **In-Page Model Browser & Playground Guardrails**:
   - Searchable in-page model list browsing and explicit warning banners for risky toggles (e.g. SSML raw XML mode in speech playgrounds).

---

## 2. Comprehensive Codebase File & Path Index

The agent executing or reviewing Phase 4 MUST inspect and reference these exact files:

### **2.1 Store Engine & Runtime (`packages/stage-ui/src/stores/providers/`)**
- [`packages/stage-ui/src/stores/providers.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/providers.ts) — Main store entry point where `createProviderInstanceStore()` gets wired.
- [`packages/stage-ui/src/stores/providers/runtime/instance-store.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/providers/runtime/instance-store.ts) — Multi-instance engine implementation (`ProviderInstanceConfig[]`, migration & facade).
- [`packages/stage-ui/src/stores/providers/types.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/providers/types.ts) — Types for `ProviderInstanceConfig`, `ProviderMetadata`, and provider options.
- [`packages/stage-ui/src/stores/providers/selectors/config.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/providers/selectors/config.ts) — Configuration state getters & instance predicates.
- [`packages/stage-ui/src/stores/providers/selectors/availability.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/providers/selectors/availability.ts) — Category-based provider availability getters.

### **2.2 Shared UI Setting Components (`packages/stage-ui/src/components/scenarios/providers/`)**
- [`packages/stage-ui/src/components/scenarios/providers/provider-settings-layout.vue`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/components/scenarios/providers/provider-settings-layout.vue) — Grid layout container for provider settings and playgrounds.
- [`packages/stage-ui/src/components/scenarios/providers/provider-basic-settings.vue`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/components/scenarios/providers/provider-basic-settings.vue) — Basic setting inputs (API key, Base URL).
- [`packages/stage-ui/src/components/scenarios/providers/provider-advanced-settings.vue`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/components/scenarios/providers/provider-advanced-settings.vue) — Accordion for advanced parameters.
- [`packages/stage-ui/src/components/scenarios/providers/provider-api-key-input.vue`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/components/scenarios/providers/provider-api-key-input.vue) — Reusable API key input control.
- [`packages/stage-ui/src/components/scenarios/providers/provider-base-url-input.vue`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/components/scenarios/providers/provider-base-url-input.vue) — Reusable Base URL input control.
- [`packages/stage-ui/src/components/scenarios/providers/speech-provider-settings.vue`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/components/scenarios/providers/speech-provider-settings.vue) — Specialized speech provider setting wrapper.
- [`packages/stage-ui/src/components/scenarios/providers/speech-playground.vue`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/components/scenarios/providers/speech-playground.vue) — Interactive speech testing playground.

### **2.3 Settings Pages (`packages/stage-pages/src/pages/settings/providers/`)**
- [`packages/stage-pages/src/pages/settings/providers/index.vue`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-pages/src/pages/settings/providers/index.vue) — Main provider settings hub.
- [`packages/stage-pages/src/pages/settings/providers/chat/[providerId].vue`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-pages/src/pages/settings/providers/chat/%5BproviderId%5D.vue) — Dynamic chat provider page layout.
- Specific provider views:
  - Local LLMs: [`chat/ollama.vue`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-pages/src/pages/settings/providers/chat/ollama.vue), [`chat/lm-studio.vue`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-pages/src/pages/settings/providers/chat/lm-studio.vue)
  - Cloud Speech/TTS: [`speech/elevenlabs.vue`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-pages/src/pages/settings/providers/speech/elevenlabs.vue), [`speech/deepgram-tts.vue`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-pages/src/pages/settings/providers/speech/deepgram-tts.vue)
  - Transcription: [`transcription/deepgram-transcription.vue`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-pages/src/pages/settings/providers/transcription/deepgram-transcription.vue)

---

## 3. Workflow for First Turn Agent: Analysis & Design Alignment

**DO NOT WRITE CODE OR MODIFY WORKSPACE FILES ON FIRST TURN.**

The subagent assigned to Phase 4 must conduct an initial research and analysis pass:

1. **Codebase Inspection**:
   - Examine [`packages/stage-ui/src/stores/providers/runtime/instance-store.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/providers/runtime/instance-store.ts) to verify how `createProviderInstanceStore()` manages backward-compatible migration.
   - Inspect existing UI components in `packages/stage-ui/src/components/scenarios/providers/` and `packages/stage-pages/src/pages/settings/providers/`.
2. **Analysis Report**:
   - Compare the Phase 4 specification against the current codebase reality.
   - Identify any open questions, design edge cases, potential breaking changes, or UI layout trade-offs.
3. **Wait for Approval**:
   - Present findings clearly to the pair programmer / user and await explicit green light before making any edits.

---

## 4. Verification Requirements (Post-Approval Execution)
- `pnpm -F @proj-airi/stage-ui typecheck` -> **PASS**
- `pnpm -F @proj-airi/stage-ui test src/stores/providers/ --run` -> **PASS**
- `pnpm -F @proj-airi/stage-pages typecheck` -> **PASS**
