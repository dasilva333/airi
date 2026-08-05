# Handoff Specification: Phase 4 Provider Studio UI Overhaul & Multi-Instance UI Activation

**Status:** Active Handoff Spec (Approved & Finalized)
**Target Directories:**
- `packages/stage-pages/src/pages/settings/providers/`
- `packages/stage-ui/src/stores/providers/`
**Authors:** AIRI Team
**Related Docs:**
- [`design-multi-instance-provider-studio.md`](./design-multi-instance-provider-studio.md) — Multi-instance architecture and UX design blueprint.
- [`project-provider-store-phase3-handoff.md`](./project-provider-store-phase3-handoff.md) — Phase 3 completed engine report.

---

## 1. Executive Summary & Objectives

With Phase 3 (Multi-Instance Engine & Observability Eradication) fully committed (`d30b62772`), the store backend is clean, decoupled, and multi-instance ready.

**Phase 4** focuses on activating the multi-instance engine at runtime and delivering the **Provider Studio UI Overhaul**.

### **Core Deliverables**:
1. **Activate Multi-Instance Persistence**:
   - Wire `createProviderInstanceStore()` into `packages/stage-ui/src/stores/providers.ts` to replace single-slot storage with array-backed multi-instance storage (`ProviderInstanceConfig[]`).
2. **Multi-Instance UI Controls**:
   - Provide `[+ Add Instance]`, label editing, and instance deletion controls in provider setting cards.
3. **Smart Field Prioritization & External Links**:
   - Prioritize `Base URL` for local providers (Ollama, LM Studio, ComfyUI, etc.) and `API Key` for cloud providers (OpenAI, Deepgram, ElevenLabs, etc.).
   - Display direct external links to provider developer consoles (`console.deepgram.com`, etc.) derived from registry metadata.
4. **Embedded Model Browser & Playground Guardrails**:
   - In-page model list searching and explicit warning banners for risky toggles (e.g. SSML raw XML mode).

---

## 2. Target File Index & Tasks

| Target Component / File | Objective / Action |
|---|---|
| `packages/stage-ui/src/stores/providers.ts` | Wire `createProviderInstanceStore()` into `providerCredentials` facade. |
| `packages/stage-pages/src/pages/settings/providers/components/` | Update/create shared provider card layout components for multi-instance management. |
| `packages/stage-ui/src/stores/providers/selectors/availability.ts` | Ensure category getters cleanly expose multi-instance metadata definitions. |

---

## 3. Execution Steps for Phase 4 Agent

### **Step 4A: Instance Store Activation**
- In `packages/stage-ui/src/stores/providers.ts`, initialize `providerCredentials` via `createProviderInstanceStore()`.
- Run typecheck (`pnpm -F @proj-airi/stage-ui typecheck`) and provider unit tests (`pnpm -F @proj-airi/stage-ui test src/stores/providers/ --run`) to verify zero regressions.

### **Step 4B: Provider Studio UI Components**
- Upgrade provider setting card layouts to support multi-instance lists (`instanceId`, `label`, `isPrimary`).
- Implement Smart Field Prioritization (Local = Base URL first; Cloud = API Key first + Console Link header).
- Add clear inline warning banners on raw/ssml toggles.

### **Step 4C: Verification & Validation**
- Run workspace typechecks (`pnpm -F @proj-airi/stage-ui typecheck` & `pnpm -F @proj-airi/stage-pages typecheck`) to ensure zero broken layout bindings.

---

## 4. Verification Requirements
- `pnpm -F @proj-airi/stage-ui typecheck` -> **PASS**
- `pnpm -F @proj-airi/stage-ui test src/stores/providers/ --run` -> **PASS**
- `pnpm -F @proj-airi/stage-pages typecheck` -> **PASS**
