# Project Testing Parity & Regression Protection Blueprint

**Document ID:** `docs/project-testing-parity.md`
**Status:** Living Strategy & Execution Plan · Active
**Initial Baseline Date:** 2026-09-08
**Scope:** Test Harness Modernization, CI Enforcement, Core Runtime Isolation, and Regression Parity with Upstream (`moeru-ai/airi`)
**Target Repository:** `dasilva333/airi`
**Related Documents:**
- [`docs/UPSTREAM_RADAR.md`](./UPSTREAM_RADAR.md) — Upstream commit delta & PR tracking ledger.
- [`docs/rosetta-stone.md`](./rosetta-stone.md) — Canonical concept-to-file path index.
- [`docs/project-specialized-skills.md`](./project-specialized-skills.md) — Skill domain catalog (including `airi-codebase-verification`).
- [`docs/project-selective-upstream-sync-protocol.md`](./project-selective-upstream-sync-protocol.md) — Upstream porting safety protocol.

---

## 1. Executive Summary & The "Roast" Audit

A comparative architectural evaluation between our fork (`dasilva333/airi@1c6085b`) and upstream (`moeru-ai/airi@f679616`) revealed an acute and actionable reality:

```
┌────────────────────────────────────────┬────────┬──────────┬───────────┐
│ Dimension                              │ Weight │ Upstream │ Your Fork │
├────────────────────────────────────────┼────────┼──────────┼───────────┤
│ Architecture and maintainability       │  25%   │   8.5    │    7.0    │
│ Automated regression protection        │  20%   │   8.5    │    5.5    │
│ Integrated companion capabilities      │  25%   │   7.0    │    9.0    │
│ Local control and data portability     │  15%   │   7.0    │    9.0    │
│ Operational infrastructure             │  10%   │   8.5    │    6.5    │
│ Contributor guidance                   │   5%   │   8.0    │    8.0    │
├────────────────────────────────────────┼────────┼──────────┼───────────┤
│ Weighted Overall                       │ 100%   │   7.9    │    7.5    │
└────────────────────────────────────────┴────────┴──────────┴───────────┘
```

### The Honest Truth
1. **The Fork Won the Product / Companion Battle (9.0 vs 7.0):**
   Our fork is significantly more sophisticated in areas defining a true persistent, personal AI companion:
   - Layered memory architecture (STMM daily summaries, LTMM Sacred Journal, DRMM dreaming consolidation, Lifetime memory threads).
   - Autonomous Director loop with Base/Layer stack resolution, manifestations, and speech overrides.
   - Studio concept stacks, multi-actor coordination, and live staging.
   - Conversational Pacing (`packages/stage-ui/src/libs/pacing/`) with prewarmed thinking fillers, turn lifecycle management, and dynamic asides.
   - Complete local control & BYOS (Bring Your Own Storage) data sync across S3/R2/local storage with binary asset reconciliation.

2. **Upstream Won the Engineering Rigor & Regression Safety Battle (8.5 vs 5.5):**
   - **Test File Volume:** Upstream maintains **501 test files**; our fork maintains **~113 test files**.
   - **CI Gatekeeping:** Upstream runs an explicit `unit-test` job in GitHub Actions with Chromium on every push and PR (`test:run`). Our fork's `.github/workflows/ci.yml` runs `lint`, `build-test`, and `typecheck`, but **has no automated unit test runner in CI**.
   - **Architectural Seams:** Upstream cleanly separated runtime orchestration into `packages/core-agent` (573-line adapter, 1,063-line orchestrator), tested purely in Node with explicit contracts for sessions, streaming, cancellation, and tool history. Our `chat.ts` remains a 2,215-line coordination store where chat, memory, vision, proactivity, and staging are deeply intertwined.
   - **Cross-Window Ownership:** Upstream standardized cross-window state on `pinia-plugin-synced` with browser tests (`session-store.browser.test.ts`) covering follower initialization, disposal, and leader failover. Our fork coordinates via custom `BroadcastChannel` events, storage reloads, and manual flags.

3. **The Divergence Reality:**
   The apparent `2,234 ahead / 4,365 behind` metric stems from Git root history divergence (no common ancestor), not 4,365 missing features. The trees share **1,136 identical files** and **943 matching paths with divergent content**. We do not need to rebase or ingest upstream wholesale; we need to import upstream's **testing discipline, isolation boundaries, and regression safety**.

---

## 2. Empirical Ground-Truth: Current Test Suite Baseline

A raw execution of `pnpm run test:run` in `dasilva333/airi` revealed an encouraging yet critical finding:

```
Test Files:  10 failed | 72 passed | 1 skipped (83 suites total in root test:run)
Tests:       5 failed  | 704 passed | 1 skipped (710 tests total)
Duration:    8.67s
```

### Key Takeaway
**We already have 704 passing unit tests.**
Our regression score was 5.5 not because we lack tests entirely, but because:
1. **10 broken test suites** block `pnpm run test:run` from completing with an exit code of 0.
2. Because the test run failed or was uncurated, **tests were completely disabled in GitHub Actions CI**.
3. Tests that sit idle in the repository without blocking CI provide zero regression protection to developers.

### Failure Triage Matrix (The 10 Failing Suites)

| Subsystem | Failing File | Root Cause | Fix Classification |
|---|---|---|---|
| **Build Virtuals** | `packages/stage-ui/src/stores/memory-text-journal.test.ts` | Vitest cannot resolve `~build/time` and `~build/git` imported via `use-build-info.ts`. | **Build Config**: Add virtual module aliases/mocks in `packages/stage-ui/vitest.config.ts`. |
| **Missing Export** | `packages/stage-ui/src/stores/provider-catalog.test.ts` | `Failed to resolve entry for package "@lemonneko/crop-empty-pixels"` via `stage-ui-live2d/src/utils/live2d-preview.ts`. | **Dependency/Stub**: Stub `live2d-preview` or alias the missing export in vitest config. |
| **Missing Export** | `packages/stage-ui/src/stores/modules/speech.test.ts` | Identical `@lemonneko/crop-empty-pixels` resolution failure via transitive live2d preview import. | **Dependency/Stub**: Same as above; decouple speech store unit test from avatar preview rasterizer. |
| **Ad-hoc Fixtures** | `packages/live2d-runtime/test/headless-scenario-runner.test.ts` (2 tests) | Expects downloaded Steam models in `SCRATCH_TMP_DIR` (`live2d_2883004043`, `live2d_2262182171`) that only exist during ad-hoc local harness runs. | **Test Hygiene**: Wrap in `it.skipIf(!fs.existsSync(manifestPath))` so unit test run is deterministic without external assets. |
| **Ad-hoc Fixtures** | `packages/live2d-runtime/test/integration-extracted-models.test.ts` (2 tests) | Expects the same external scratch models in `SCRATCH_TMP_DIR`. | **Test Hygiene**: Wrap in `it.skipIf(!fs.existsSync(manifestPath))`. |
| **Mock Signature** | `packages/live2d-runtime/test/interpreter.test.ts:180` (1 test) | `onCostumeWillSwap` assertion expected `['model1.json']`, received `['model1.json', undefined]` due to an added optional parameter in the VM contract. | **Test Fix**: Update expected mock assertion to match current runtime contract. |
| **Transcribe Config** | `packages/audio-pipelines-transcribe` | Vitest project configuration / runner environment mismatch. | **Test Config**: Standardize project vitest config. |
| **Plugin SDK** | `packages/plugin-sdk` | Minor environment mock mismatch in plugin host core. | **Test Fix**: Fix host mock context. |

Resolving these 10 issues will immediately transform our repository from **failing tests / zero CI** to **83 passing test suites and 710+ automated checks running on every commit**.

---

## 3. Architectural Gap Analysis: Upstream vs Fork

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                           AIRI RUNTIME LANDSCAPE                              │
├───────────────────────────────────────┬───────────────────────────────────────┤
│        UPSTREAM ARCHITECTURE          │            FORK ARCHITECTURE          │
├───────────────────────────────────────┼───────────────────────────────────────┤
│ packages/core-agent                   │ packages/stage-ui/src/stores/chat.ts  │
│  - Pure Node orchestrator (1,063 lines)│  - Monolithic store (2,215 lines)    │
│  - Decoupled from Vue / Electron      │  - Chat + Memory + Staging + Vision   │
│  - Explicit contracts for sessions,   │  - Deep companion features integrated │
│    context, streaming, cancellations  │  - Hard to test in isolation          │
│  - Extensive queue & stream tests     │  - Regression risk on edits           │
├───────────────────────────────────────┼───────────────────────────────────────┤
│ packages/provider-inference           │ packages/stage-ui/src/stores/providers│
│  - Runtime-neutral package            │  - Clean store refactor (392 lines)   │
│  - Pure Node & browser test configs   │  - Modularity inside stage-ui store   │
│  - Zero UI or storage coupling        │  - Tied to unstorage / Web & Electron │
├───────────────────────────────────────┼───────────────────────────────────────┤
│ Cross-Window State                    │ Cross-Window State                    │
│  - pinia-plugin-synced                │  - Dedicated BroadcastChannel relays  │
│  - Leader / follower snapshot model   │  - Storage reload hooks & guards      │
│  - Browser tests for failover         │  - Flexible, but race condition risk  │
├───────────────────────────────────────┼───────────────────────────────────────┤
│ Automated Regression Gates            │ Automated Regression Gates            │
│  - 501 test files                     │  - 113 test files                     │
│  - CI test job with Chromium          │  - No test execution in CI            │
│  - Blocks PRs on test failure         │  - CI only checks lint & typecheck    │
└───────────────────────────────────────┴───────────────────────────────────────┘
```

### 3.1 Core Runtime Isolation: The `chat.ts` Bottleneck
- **Upstream Pattern:** Upstream extracts all agent orchestration into `packages/core-agent/src/runtime`. It passes explicit interfaces for `ChatContextManager`, `LLMClient`, `SessionStore`, and `StreamingHandler`. This allows tests to simulate:
  - Aborting mid-stream while a second turn is queued.
  - Deleting a session while streaming tokens.
  - Verification of hook dispatch order (before/after turn, on tool execute).
  - Stale generation discarding when user input interrupts.
- **Fork Opportunity:** We do not need to throw away our rich companion behavior. We must extract the **execution engine** of `chat.ts` into a testable orchestrator (`packages/stage-ui/src/libs/chat-orchestrator/` or a dedicated runtime harness) that accepts pluggable context generators (memory RAG, salience, proactivity). This allows us to write deterministic unit tests for the complex companion turn lifecycle.

### 3.2 Multi-Window Lifecycle & State Ownership
- In our desktop application (`apps/stage-tamagotchi`), multiple Electron windows interact:
  - **Stage window**: Avatar rendering, animation, speech output.
  - **Chatbox window**: User message composition, transcript rendering, tool chip interactions.
  - **Control Strip window**: Persistent toolbar, quick toggles, status pills.
  - **Customizer / Settings window**: Model configurations, memory inspection.
- We coordinate using `BroadcastChannel` messages (e.g. `broadcastChannelStageEvents`), persistence event triggers, and active-state locks.
- **Vulnerability:** When a user hits **Stop** in the Chatbox:
  1. Does the LLM streaming call abort immediately?
  2. Does the TTS pipeline stop generating new audio?
  3. Does the Stage window cancel current sentence playback and flush the audio queue?
  4. Does Conversational Pacing cancel any queued thinking filler?
  5. Does the transcript record a partial generation without corruption?
- **Target:** Write automated tests simulating multi-window broadcast interactions and testing invariant safety during Stop, Session Switch, and Avatar Reload.

### 3.3 Data Portability: Hardening the 3,624-line Sync Engine
- Our fork includes a state-of-the-art BYOS (Bring Your Own Storage) Sync Engine in `packages/stage-ui/src/stores/sync-engine.ts` (3,624 lines).
- It performs:
  - Interception of all IndexedDB storage operations (`local:*`, `outbox:*`).
  - Queueing mutations into an outbox ledger.
  - Binary asset chunking, deduplication, and localforage blob reconciliation.
  - S3/R2 cloud transport and conflict resolution.
- **The Risk:** This is the single most critical subsystem for user data integrity, yet it currently lacks deterministic automated regression tests.
- **Target:** A complete cleanroom test harness for `sync-engine.ts` using memory storage and mock S3 adapters to test write batching, idempotency, conflicted writes, and network disconnect recovery.

---

## 4. Boots-to-the-Ground Action Plan: 5-Phase Road to Parity

```mermaid
graph TD
    P1[Phase 1: Zero-Failure Baseline & CI Activation] --> P2[Phase 2: High-Risk Companion Core Regressions]
    P2 --> P3[Phase 3: Core Runtime Extraction & Headless Tests]
    P3 --> P4[Phase 4: Multi-Window & Vitest Browser Mode]
    P4 --> P5[Phase 5: Subsystem Test Expansion & Parity Ledger]

    style P1 fill:#4ade80,stroke:#16a34a,color:#000
    style P2 fill:#60a5fa,stroke:#2563eb,color:#000
    style P3 fill:#facc15,stroke:#ca8a04,color:#000
    style P4 fill:#f87171,stroke:#dc2626,color:#000
    style P5 fill:#c084fc,stroke:#9333ea,color:#000
```

### Phase 1: Zero-Failure Baseline & CI Activation — ✅ COMPLETED & VERIFIED
**Objective:** Get the existing test suites green and enable automated test enforcement in GitHub Actions CI.
**Empirical Verification Result:** `pnpm run test:run` achieved **79 passed suites / 740 passed tests (0 failed, 4 files / 8 tests skipped)** with exit code 0.

- [x] **1.1 Fix Stage-UI Vitest Config Virtual Imports & Plugins:**
  Configured `packages/stage-ui/vitest.config.ts` with `Vue()`, `Info()`, `Yaml()`, aliases for `@lemonneko/crop-empty-pixels`, `@proj-airi/i18n`, `@proj-airi/stage-shared`, and `vitest.setup.ts`.
- [x] **1.2 Resolve Node Environment Stubs:**
  Added lightweight Web Audio API stubs (`AudioWorkletNode`, `AudioNode`, `AudioContext`), `EventTarget` listeners on `window`, and `localStorage`/`sessionStorage` in `packages/stage-ui/vitest.setup.ts`.
- [x] **1.3 Guard Live2D DSL External Fixtures:**
  Added `describe.skipIf(!hasScratchModels)` in:
  - `packages/live2d-runtime/test/headless-scenario-runner.test.ts`
  - `packages/live2d-runtime/test/integration-extracted-models.test.ts`
- [x] **1.4 Correct VM Mock Assertion:**
  Updated `packages/live2d-runtime/test/interpreter.test.ts:180` to accept the 2-argument call signature (`['model1.json', undefined]`).
- [x] **1.5 Text Journal Defensive Search Fallback:**
  Made `packages/stage-ui/src/stores/memory-text-journal.ts` fall back to local heuristic ranking when `layeredMemory.search` / Web Worker is unavailable, and updated test mocks.
- [x] **1.6 Add `unit-test` Job to `.github/workflows/ci.yml`:**
  Added dedicated `unit-test` CI job executing `pnpm run test:run` on every push and PR after `build:packages`.
- [x] **Phase 1 Verification:**
  - `pnpm run test:run` exits 0 locally across all 83 projects (740 tests passing).
  - CI job defined to block regressions on `main` and pull requests.

---

### Phase 2: High-Risk Companion Core Regressions (Sprint 1)
**Objective:** Write targeted, deterministic unit and lifecycle tests for the highest-consequence async pathways in our fork.

- [x] **2.1 Stop & Cancellation Lifecycle Suite (`chat-cancellation.test.ts`):**
  - Verify that invoking `chatStore.stopGeneration()` triggers the LLM `AbortSignal`.
  - Verify that audio speech synthesis requests in flight are cancelled.
  - Verify that active Conversational Pacing thinking fillers are halted immediately.
  - Verify that the message status in the active session is finalized cleanly without dangling stream markers (`[ACT...]`).
- [x] **2.2 Session Switching During Active Generation (`session-switch-race.test.ts`):**
  - Simulate streaming tokens arriving after the user switches active session ID.
  - Verify that incoming chunks for the abandoned session do NOT leak into the newly selected session.
  - Verify that speech playback queues for the abandoned session are flushed.
- [x] **2.3 BYOS Sync Engine Outbox Ledger Suite (`sync-engine-outbox.test.ts`):**
  - Verify outbox queuing when writes occur via IndexedDB interception (`storage.setItem`/`setItemRaw`).
  - Verify outbox compaction and idempotency across rapid successive updates to the same key.
  - Verify outbox deletion actions when local items are removed (`storage.removeItem`).
  - Verify successful remote write drains outbox queue items.
  - Verify retry backoff and data preservation on simulated 500/network disconnect errors.
- [x] **2.4 Conversational Pacing Stress Suite (`packages/stage-ui/src/libs/pacing/`):**
  - Verified and cataloged across 6 dedicated pacing test suites (78 tests total):
    - `turn-pacing-coordinator.test.ts` (28 tests): Fast direct answer suppression (200ms), cold deadline arming, 1200ms vs 1400ms races, barge-in cancellation, long CoT reasoning cadence, dynamic asides, deep CoT profile.
    - `pacing-playback-bridge.test.ts` (26 tests): Playback bridge, filler scheduling, audio sync.
    - `category-classifier.test.ts` (11 tests): Aside category classification.
    - `pacing-cache.test.ts` (6 tests): Filler audio cache & prewarming.
    - `pacing-policy.test.ts` (4 tests): Pacing policies & thresholds.
    - `pacing-prewarm.test.ts` (3 tests): Prewarm pipeline.

---

### Phase 3: Core Runtime Boundary Extraction & Headless Agent Tests (Sprint 2)
**Objective:** Decouple agent orchestration from the Vue store layer, mirroring upstream's `packages/core-agent` modularity without losing our companion policies.

- [ ] **3.1 Extract Chat Orchestration Seam:**
  - Isolate turn state management, tool dispatch loops, stream handling, and cancellation into `packages/stage-ui/src/libs/chat-orchestrator/` or a dedicated engine module.
  - Keep `chat.ts` as the Pinia reactivity wrapper that binds UI state to the orchestrator.
- [ ] **3.2 Implement Upstream-Equivalent Runtime Tests:**
  - `queue-cancellation.test.ts`: Queueing multiple turns and ensuring priority/cancellation rules hold.
  - `stale-generation.test.ts`: Discarding delayed responses if context was invalidated.
  - `hook-ordering.test.ts`: Strict validation of execution order: `beforeTurn` $\rightarrow$ `salienceGate` $\rightarrow$ `memoryRetrieval` $\rightarrow$ `systemPromptAssemble` $\rightarrow$ `streamChunk` $\rightarrow$ `afterTurn` $\rightarrow$ `memoryConsolidation`.
  - `tool-round-limits.test.ts`: Enforcing tool loop termination and recursion depth limits.

---

### Phase 4: Multi-Window & Vitest Browser Mode (Sprint 3)
**Objective:** Add deterministic browser testing for multi-window state synchronization, following upstream's `@vitest/browser` pattern.

- [ ] **4.1 Configure Vitest Browser Mode:**
  - Add `@vitest/browser` and `playwright` / `chromium` to devDependencies.
  - Create `vitest.browser.config.ts` for browser-dependent store testing.
- [ ] **4.2 Multi-Window Broadcast Channel Contract Tests:**
  - Test `BroadcastChannel` messaging contracts between Stage, Chatbox, and Control Strip.
  - Test leader failover and window close/reload event propagation.
- [ ] **4.3 Replicated Session Store Browser Suite:**
  - Adapt upstream's `session-store.browser.test.ts` to test session selection sync, message append notifications, and transcript reactivity across simulated multi-window contexts.

---

### Phase 5: Subsystem Test Expansion & Parity Metric Ledger (Ongoing)
**Objective:** Close the numerical and qualitative gap with upstream across all companion subsystems.

- [ ] **5.1 Autonomous Director & Studio Concept Stacks (`artistry-autonomous.test.ts`):**
  - Test Base/Layer stack resolution.
  - Test speech override and manifestation locks during multi-character dialogue.
- [ ] **5.2 Layered Memory Lifecycle & Dreaming (`memory-dreaming.test.ts`):**
  - Test STMM $\rightarrow$ LTMM transition and daily summary rollup.
  - Test Dreaming Worker Emotional Exhaustion and MoodState updates.
  - Test Sacred Journal immutability rules.
- [ ] **5.3 Test File Count Milestones:**
  - **Milestone 1 (Immediate):** 83 suites / 710 tests passing in CI.
  - **Milestone 2 (Sprint 1):** 120 suites / 900+ tests (Sync Engine, Stop lifecycle, Session switches).
  - **Milestone 3 (Sprint 2):** 160 suites / 1,200+ tests (Extracted Chat Orchestrator, Tool loops).
  - **Milestone 4 (Sprint 3):** 220+ suites / 1,600+ tests (Browser multi-window, Director, Memory).
  - **Target (Parity Horizon):** 300+ comprehensive suites matching or exceeding upstream's regression resilience.

---

## 5. Developer Testing SOPs & Invariant Rules

### 5.1 Local Test Execution Commands
```bash
# Run entire repository test suite (fast headless)
pnpm run test:run

# Run test suite with interactive watch mode
pnpm vitest

# Run tests for a specific workspace
pnpm -F @proj-airi/stage-ui test:run
pnpm -F @proj-airi/live2d-runtime test

# Run a specific test file
pnpm vitest run packages/stage-ui/src/libs/pacing/pacing-policy.test.ts

# Run cleanroom domain harnesses
pnpm run test:dsl          # Live2D DSL interpreter harness
pnpm run test:attention    # Attention Ecology vision/perception harness
```

### 5.2 Test Authoring Standards in AIRI
1. **Zero External Network Dependencies:**
   Tests must run in air-gapped environments. Mock all LLM HTTP endpoints, WebSocket transports, and cloud sync providers.
2. **Deterministic Time & Clocks:**
   Always use Vitest fake timers (`vi.useFakeTimers()`, `vi.advanceTimersByTime(ms)`) when testing pacing delays, debounce intervals, or proactivity heartbeats.
3. **Storage Isolation:**
   Use memory drivers (`unstorage/drivers/memory`) or in-memory IndexedDB stubs (`fake-indexeddb`) when testing repository and store persistence. Never mutate real disk storage or local profile data.
4. **Clean Teardown:**
   Every test suite must register `afterEach(() => { vi.clearAllMocks(); vi.restoreAllMocks(); })` to eliminate cross-test state leakage.

---

## 6. Authoritative Subsystem & Test Seam Index

| Subsystem | Source Path | Existing / Target Test Path | Priority |
|---|---|---|---|
| **Chat Orchestration** | [`packages/stage-ui/src/stores/chat.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/chat.ts) | `packages/stage-ui/src/stores/chat-orchestrator.test.ts` | **P0 (Critical)** |
| **BYOS Sync Engine** | [`packages/stage-ui/src/stores/sync-engine.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/sync-engine.ts) | `packages/stage-ui/src/stores/sync-engine.test.ts` | **P0 (Critical)** |
| **Speech Runtime** | [`packages/stage-ui/src/stores/modules/speech.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/modules/speech.ts) | `packages/stage-ui/src/stores/modules/speech.test.ts` | **P0 (Fix Existing)** |
| **Conversational Pacing** | [`packages/stage-ui/src/libs/pacing/`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/libs/pacing/) | `packages/stage-ui/src/libs/pacing/*.test.ts` (Existing Exemplar) | **P1 (Maintain)** |
| **Autonomous Director** | [`packages/stage-ui/src/stores/modules/artistry-autonomous.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/modules/artistry-autonomous.ts) | `packages/stage-ui/src/stores/modules/artistry-autonomous.test.ts` | **P1 (High)** |
| **Memory Consolidation** | [`packages/stage-ui/src/stores/memory-consolidation-dreaming.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/memory-consolidation-dreaming.ts) | `packages/stage-ui/src/stores/memory-consolidation-dreaming.test.ts` | **P1 (High)** |
| **Provider Registry** | [`packages/stage-ui/src/stores/providers/`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/providers/) | `packages/stage-ui/src/stores/provider-catalog.test.ts` | **P1 (Fix Existing)** |
| **Live2D Runtime VM** | [`packages/live2d-runtime/src/`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/live2d-runtime/src/) | `packages/live2d-runtime/test/` | **P0 (Fix Existing)** |
| **CI Automation** | [`.github/workflows/ci.yml`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/.github/workflows/ci.yml) | GitHub Actions Automated Test Job | **P0 (Critical)** |

---

## 7. Canonical Test Suite Catalog & Inventory

Permanent, authoritative inventory of all active test suites in the repository, their exact file paths, test counts, and functional subsystems.
> [!IMPORTANT]
> **Consult this catalog before assuming a feature lacks test coverage or writing duplicate tests.** Whenever adding, renaming, or refactoring test suites, update this catalog to maintain an accurate repository map.

### 7.1 Package Summary

| Package / Workspace | Test Suites (Files) | Total Tests | Subsystem Focus |
|---|:---:|:---:|---|
| [`packages/stage-ui`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui) | 54 | 474 | Chat, Pacing, Inference/Local Workers, BYOS Sync, Providers, Live2D, Memory |
| [`packages/live2d-runtime`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/live2d-runtime) | 5 | 79 | Live2D Scripting DSL VM, Command Parser, Selector, Template, VarStore |
| [`packages/stage-pages`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-pages) | 2 | 34 | Settings Topology & Devtools Context Flow Formatters |
| [`apps/stage-tamagotchi`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/apps/stage-tamagotchi) | 6 | 32 | Desktop Multi-Window, Display Math, Location, Widgets, Airi Plugins |
| [`apps/server`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/apps/server) | 4 | 29 | Server Character & Provider API Endpoints / Services |
| [`packages/pipelines-audio`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/pipelines-audio) | 4 | 27 | Audio Speech Pipeline, Lead Coordinator, Pause Aligner, TTS Chunker |
| [`packages/stage-shared`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-shared) | 1 | 24 | Caption Sentiment & Shared Stage Utilities |
| [`packages/cap-vite`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/cap-vite) | 4 | 22 | Capacitor Vite Plugin, CLI Integration & Native Wrappers |
| [`packages/plugin-sdk`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/plugin-sdk) | 1 | 22 | Plugin SDK Host Core |
| [`packages/server-runtime`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/server-runtime) | 1 | 9 | Server Route Middleware |
| **Total Monorepo Baseline** | **82 Suites** | **752 Tests** | **Full Monorepo Active Test Baseline (0 Failures)** |

*(Note: 4 additional test files in `@proj-airi/stage-ui` and `@proj-airi/live2d-runtime` contain 8 tests conditional on external models or live API keys, yielding 86 total test files discovered).*

---

### 7.2 Detailed Inventory by Functional Subsystem

#### Conversational Pacing & Dynamic Asides
| File Path | Package | Tests | Functional Scope |
|---|---|:---:|---|
| [`packages/stage-ui/src/libs/pacing/turn-pacing-coordinator.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/libs/pacing/turn-pacing-coordinator.test.ts) | `@proj-airi/stage-ui` | 28 | TTFT fast answer suppression (200ms), 1800ms cold deadlines, 1200ms vs 1400ms answer vs filler races, barge-in cancellation, long CoT reasoning cadence, dynamic asides, deep CoT profile |
| [`packages/stage-ui/src/libs/pacing/pacing-playback-bridge.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/libs/pacing/pacing-playback-bridge.test.ts) | `@proj-airi/stage-ui` | 26 | Playback bridge integration, filler audio scheduling, audio completion handoff |
| [`packages/stage-ui/src/libs/pacing/category-classifier.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/libs/pacing/category-classifier.test.ts) | `@proj-airi/stage-ui` | 11 | Query sentiment, intent, and thinking category classification for aside selection |
| [`packages/stage-ui/src/libs/pacing/pacing-cache.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/libs/pacing/pacing-cache.test.ts) | `@proj-airi/stage-ui` | 6 | Synthesized filler audio LRU caching and key hashing |
| [`packages/stage-ui/src/libs/pacing/pacing-policy.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/libs/pacing/pacing-policy.test.ts) | `@proj-airi/stage-ui` | 4 | Persisted pacing policy configuration, thresholds, and synthesis budget overrides |
| [`packages/stage-ui/src/libs/pacing/pacing-prewarm.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/libs/pacing/pacing-prewarm.test.ts) | `@proj-airi/stage-ui` | 3 | Background audio prewarming and voice pipeline readiness |

#### Chat Lifecycle, Streaming & Session State
| File Path | Package | Tests | Functional Scope |
|---|---|:---:|---|
| [`packages/stage-ui/src/stores/chat-cancellation.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/chat-cancellation.test.ts) | `@proj-airi/stage-ui` | 3 | In-flight generation abort, LLM `AbortSignal`, TTS speech queue flush, and post-LLM speech stop |
| [`packages/stage-ui/src/stores/session-switch-race.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/session-switch-race.test.ts) | `@proj-airi/stage-ui` | 2 | Rapid session switching during active streaming; prevents chunk cross-contamination and speech queue leakage |
| [`packages/stage-ui/src/stores/chat/session-message-merge.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/chat/session-message-merge.test.ts) | `@proj-airi/stage-ui` | 5 | Session message deduplication, timestamp sorting, and remote sync merge |
| [`packages/stage-ui/src/stores/llm.sanitize.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/llm.sanitize.test.ts) | `@proj-airi/stage-ui` | 5 | Message payload sanitization: vision stripping when disabled, error role mapping, multimodal flattening |
| [`packages/stage-ui/src/components/scenarios/chat/message-key.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/components/scenarios/chat/message-key.test.ts) | `@proj-airi/stage-ui` | 4 | Stable key resolution for virtualized chat transcript items |
| [`packages/stage-ui/src/components/scenarios/chat/utils.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/components/scenarios/chat/utils.test.ts) | `@proj-airi/stage-ui` | 1 | Chat UI utility helpers |
| [`packages/stage-ui/src/utils/chat-actor-slices.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/utils/chat-actor-slices.test.ts) | `@proj-airi/stage-ui` | 9 | Multi-actor transcript slicing and turn demarcation |

#### Data Persistence & BYOS Sync Engine
| File Path | Package | Tests | Functional Scope |
|---|---|:---:|---|
| [`packages/stage-ui/src/stores/sync-engine-outbox.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/sync-engine-outbox.test.ts) | `@proj-airi/stage-ui` | 7 | Intercepted IndexedDB write queueing, compaction across rapid writes, item removal, remote sync drainage, and 500 error retention |
| [`packages/stage-ui/src/stores/sync-engine-merge.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/sync-engine-merge.test.ts) | `@proj-airi/stage-ui` | 3 | Cloud vs local voice profile reconciliation using Last-Writer-Wins (LWW) |
| [`packages/stage-ui/src/stores/character.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/character.test.ts) | `@proj-airi/stage-ui` | 5 | Character store state management, card switching, and active character lifecycle |
| [`packages/stage-ui/src/stores/character/orchestrator/index.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/character/orchestrator/index.test.ts) | `@proj-airi/stage-ui` | 2 | Character orchestrator lifecycle |
| [`packages/stage-ui/src/stores/memory-text-journal.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/memory-text-journal.test.ts) | `@proj-airi/stage-ui` | 18 | Long-Term Text Journal entry creation, searching, keyword/token ranking, and search fallback |

#### Local Inference, WebGPU & Audio Processing Workers
| File Path | Package | Tests | Functional Scope |
|---|---|:---:|---|
| [`packages/stage-ui/src/libs/inference/protocol.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/libs/inference/protocol.test.ts) | `@proj-airi/stage-ui` | 33 | Web Worker request/response RPC wire protocol and error framing |
| [`packages/stage-ui/src/libs/inference/contract.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/libs/inference/contract.test.ts) | `@proj-airi/stage-ui` | 23 | Inference engine capability interfaces and schema validation |
| [`packages/stage-ui/src/workers/web-rwkv/safetensors.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/workers/web-rwkv/safetensors.test.ts) | `@proj-airi/stage-ui` | 21 | Binary safetensors parsing, header extraction, and tensor slice loading in WebGPU worker |
| [`packages/stage-ui/src/libs/inference/adapters/kokoro.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/libs/inference/adapters/kokoro.test.ts) | `@proj-airi/stage-ui` | 17 | Local WebGPU Kokoro TTS worker adapter, phoneme generation, and audio stream assembly |
| [`packages/stage-ui/src/libs/inference/adapters/whisper.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/libs/inference/adapters/whisper.test.ts) | `@proj-airi/stage-ui` | 13 | Local WebGPU Whisper STT worker adapter and streaming transcription |
| [`packages/stage-ui/src/libs/inference/gpu-executor.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/libs/inference/gpu-executor.test.ts) | `@proj-airi/stage-ui` | 12 | WebGPU command pipeline queueing and kernel dispatch |
| [`packages/stage-ui/src/libs/inference/gpu-resource-coordinator.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/libs/inference/gpu-resource-coordinator.test.ts) | `@proj-airi/stage-ui` | 11 | VRAM management, device acquisition, and cooperative release under memory pressure |
| [`packages/stage-ui/src/libs/inference/gpu-worker-host.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/libs/inference/gpu-worker-host.test.ts) | `@proj-airi/stage-ui` | 9 | Web Worker lifetime, crash recovery, and message ping-pong |
| [`packages/stage-ui/src/workers/kokoro/constants.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/workers/kokoro/constants.test.ts) | `@proj-airi/stage-ui` | 8 | Kokoro voice mapping tables and voice token validation |
| [`packages/stage-ui/src/workers/web-rwkv/stop.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/workers/web-rwkv/stop.test.ts) | `@proj-airi/stage-ui` | 8 | Stop sequence scanner with sliding window and trailing boundary buffer flush |
| [`packages/stage-ui/src/libs/inference/adapters/background-removal.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/libs/inference/adapters/background-removal.test.ts) | `@proj-airi/stage-ui` | 7 | Client-side RMBG background removal and mask processing |
| [`packages/stage-ui/src/libs/inference/adapters/needle-client.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/libs/inference/adapters/needle-client.test.ts) | `@proj-airi/stage-ui` | 5 | Needle 2 subconscious runtime: fast reaction probing and CoT pivot detection |

#### Providers & Model Registries
| File Path | Package | Tests | Functional Scope |
|---|---|:---:|---|
| [`packages/stage-ui/src/stores/providers/runtime/instance-store.phase5.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/providers/runtime/instance-store.phase5.test.ts) | `@proj-airi/stage-ui` | 21 | Multi-instance provider store, configuration persistence, active profile selection |
| [`packages/stage-ui/src/stores/providers/web-rwkv/format.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/providers/web-rwkv/format.test.ts) | `@proj-airi/stage-ui` | 13 | Web-RWKV prompt format templates, user/bot turn tags |
| [`packages/stage-ui/src/libs/providers/providers/ollama/index.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/libs/providers/providers/ollama/index.test.ts) | `@proj-airi/stage-ui` | 9 | Ollama provider client, model enumeration, and payload serialization |
| [`packages/stage-ui/src/libs/providers/providers/amazon-bedrock/index.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/libs/providers/providers/amazon-bedrock/index.test.ts) | `@proj-airi/stage-ui` | 7 | Amazon Bedrock provider, signature generation, and Converse API formatting |
| [`packages/stage-ui/src/stores/providers/aliyun/token.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/providers/aliyun/token.test.ts) | `@proj-airi/stage-ui` | 5 | Aliyun token acquisition, refresh cycle, and expiry calculation |
| [`packages/stage-ui/src/libs/providers/validators/openai-compatible.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/libs/providers/validators/openai-compatible.test.ts) | `@proj-airi/stage-ui` | 5 | OpenAI-compatible endpoint schema validation |
| [`packages/stage-ui/src/stores/providers/converters.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/providers/converters.test.ts) | `@proj-airi/stage-ui` | 4 | Audio format converters (PCM/WAV/MP3/Base64) across providers |
| [`packages/stage-ui/src/stores/providers/registry/index.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/providers/registry/index.test.ts) | `@proj-airi/stage-ui` | 3 | Provider backend registry wiring and capability lookup |
| [`packages/stage-ui/src/stores/provider-catalog.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/provider-catalog.test.ts) | `@proj-airi/stage-ui` | 2 | Provider metadata catalog enumeration |
| [`packages/stage-ui/src/stores/providers/moss-audio-utils.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/providers/moss-audio-utils.test.ts) | `@proj-airi/stage-ui` | 1 | MOSS audio chunking and header utilities |
| [`packages/stage-ui/src/stores/providers/registry/metadata-contract.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/providers/registry/metadata-contract.test.ts) | `@proj-airi/stage-ui` | 1 | Provider contract metadata schema compliance |

#### Avatar, Live2D & Motion Runtime
| File Path | Package | Tests | Functional Scope |
|---|---|:---:|---|
| [`packages/live2d-runtime/test/var-store.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/live2d-runtime/test/var-store.test.ts) | `@proj-airi/live2d-runtime` | 26 | Live2D variable store: float parameters, state interpolation, clamping |
| [`packages/live2d-runtime/test/command-parser.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/live2d-runtime/test/command-parser.test.ts) | `@proj-airi/live2d-runtime` | 19 | Live2D DSL command syntax tokenizer and syntax validation |
| [`packages/stage-ui/src/libs/character/expression-noise-gate.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/libs/character/expression-noise-gate.test.ts) | `@proj-airi/stage-ui` | 16 | Emotion jitter suppression and micro-expression hysteresis gate |
| [`packages/live2d-runtime/test/interpreter.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/live2d-runtime/test/interpreter.test.ts) | `@proj-airi/live2d-runtime` | 13 | Live2D DSL execution virtual machine (start_mtn, change_cos, timers) |
| [`packages/live2d-runtime/test/template.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/live2d-runtime/test/template.test.ts) | `@proj-airi/live2d-runtime` | 11 | Live2D script templating and parameter substitution |
| [`packages/live2d-runtime/test/selector.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/live2d-runtime/test/selector.test.ts) | `@proj-airi/live2d-runtime` | 10 | Motion and expression candidate probabilistic selection |
| [`packages/stage-ui/src/features/motions/live2d/settings.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/features/motions/live2d/settings.test.ts) | `@proj-airi/stage-ui` | 4 | Live2D motion settings, breathing multipliers, physics overrides |
| [`packages/stage-ui/src/features/motions/live2d/view-target.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/features/motions/live2d/view-target.test.ts) | `@proj-airi/stage-ui` | 2 | Gaze tracking target computation and eye-forward constraint during head turns |
| [`packages/stage-ui/src/components/scenes/runtime.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/components/scenes/runtime.test.ts) | `@proj-airi/stage-ui` | 1 | Live2D lip sync run loop lifecycle when active vs paused |
| [`packages/stage-ui/src/features/motions/live2d/use-live2d-motion-magic.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/features/motions/live2d/use-live2d-motion-magic.test.ts) | `@proj-airi/stage-ui` | 1 | Procedural motion overlay composable |

#### Audio Pipeline & Speech Processing
| File Path | Package | Tests | Functional Scope |
|---|---|:---:|---|
| [`packages/pipelines-audio/src/processors/pause-aligner.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/pipelines-audio/src/processors/pause-aligner.test.ts) | `@proj-airi/pipelines-audio` | 10 | Punctuation pause alignment and DELAY token duration insertion |
| [`packages/pipelines-audio/src/processors/tts-chunker.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/pipelines-audio/src/processors/tts-chunker.test.ts) | `@proj-airi/pipelines-audio` | 8 | Sentence-boundary TTS text chunker and punctuation lookahead |
| [`packages/pipelines-audio/src/processors/lead-coordinator.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/pipelines-audio/src/processors/lead-coordinator.test.ts) | `@proj-airi/pipelines-audio` | 7 | Audio playback lead coordinator, queue sequencing, and jitter buffer |
| [`packages/stage-ui/src/stores/modules/speech.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/modules/speech.test.ts) | `@proj-airi/stage-ui` | 3 | Speech store helpers: pitch/rate percentage formatting and sign guards |
| [`packages/pipelines-audio/src/speech-pipeline.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/pipelines-audio/src/speech-pipeline.test.ts) | `@proj-airi/pipelines-audio` | 2 | End-to-end audio pipeline processor chaining and teardown |

#### Desktop Shell & Electron Integration
| File Path | Package | Tests | Functional Scope |
|---|---|:---:|---|
| [`apps/stage-tamagotchi/src/main/windows/shared/display.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/apps/stage-tamagotchi/src/main/windows/shared/display.test.ts) | `@proj-airi/stage-tamagotchi` | 11 | Multi-monitor display bounds, DPI scaling, and screen edge clamping |
| [`apps/stage-tamagotchi/src/renderer/stores/tools/builtin/widgets.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/apps/stage-tamagotchi/src/renderer/stores/tools/builtin/widgets.test.ts) | `@proj-airi/stage-tamagotchi` | 10 | Built-in desktop widget lifecycle, visibility toggles, and state persistence |
| [`apps/stage-tamagotchi/src/main/libs/electron/location.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/apps/stage-tamagotchi/src/main/libs/electron/location.test.ts) | `@proj-airi/stage-tamagotchi` | 3 | Window coordinate calculations and multi-display snap positioning |
| [`apps/stage-tamagotchi/src/main/services/airi/plugins/index.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/apps/stage-tamagotchi/src/main/services/airi/plugins/index.test.ts) | `@proj-airi/stage-tamagotchi` | 3 | Electron main process plugin discovery and registration |
| [`apps/stage-tamagotchi/src/renderer/stores/stage-three-runtime-diagnostics.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/apps/stage-tamagotchi/src/renderer/stores/stage-three-runtime-diagnostics.test.ts) | `@proj-airi/stage-tamagotchi` | 3 | Three.js WebGL renderer diagnostics and FPS monitoring |
| [`apps/stage-tamagotchi/src/renderer/stores/stage-window-lifecycle.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/apps/stage-tamagotchi/src/renderer/stores/stage-window-lifecycle.test.ts) | `@proj-airi/stage-tamagotchi` | 2 | Desktop window open/close lifecycle and event listener detachment |

#### UI Composables, Shared Utilities & Devtools
| File Path | Package | Tests | Functional Scope |
|---|---|:---:|---|
| [`packages/stage-pages/src/composables/settings-topology/topology.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-pages/src/composables/settings-topology/topology.test.ts) | `@proj-airi/stage-pages` | 32 | Settings topology node dependency graph and navigation layout |
| [`packages/stage-ui/src/composables/response-categoriser.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/composables/response-categoriser.test.ts) | `@proj-airi/stage-ui` | 35 | Streaming response categorization and emotion tag extraction |
| [`packages/stage-shared/src/utils/caption-sentiment.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-shared/src/utils/caption-sentiment.test.ts) | `@proj-airi/stage-shared` | 24 | Text sentiment scoring for dynamic subtitle tinting |
| [`packages/stage-ui/src/composables/llm-marker-parser.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/composables/llm-marker-parser.test.ts) | `@proj-airi/stage-ui` | 13 | LLM marker token parsing (`[ACT:...]`, `[DELAY:...]`, `[SCENE:...]`) |
| [`packages/stage-ui/src/libs/search/__tests__/search.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/libs/search/__tests__/search.test.ts) | `@proj-airi/stage-ui` | 6 | Local search index tokenization and fuzzy matching |
| [`packages/stage-ui/src/composables/use-optimistic.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/composables/use-optimistic.test.ts) | `@proj-airi/stage-ui` | 5 | Optimistic UI state updates and automatic rollback on failure |
| [`packages/stage-ui/src/components/markdown/actor-colors.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/components/markdown/actor-colors.test.ts) | `@proj-airi/stage-ui` | 4 | Actor persona color hashing for chat bubble styling |
| [`packages/stage-ui/src/composables/canvas-alpha.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/composables/canvas-alpha.test.ts) | `@proj-airi/stage-ui` | 3 | Canvas alpha channel manipulation and transparency detection |
| [`packages/stage-pages/src/pages/devtools/context-flow/composables/use-context-flow-formatters.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-pages/src/pages/devtools/context-flow/composables/use-context-flow-formatters.test.ts) | `@proj-airi/stage-pages` | 2 | Context flow debugger tree visualization formatters |
| [`packages/stage-ui/src/composables/canvas-alpha-use-pixel.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/composables/canvas-alpha-use-pixel.test.ts) | `@proj-airi/stage-ui` | 1 | Pixel alpha sampling for transparent click-through stage areas |

#### Backend Server, SDK & Build Tools
| File Path | Package | Tests | Functional Scope |
|---|---|:---:|---|
| [`packages/plugin-sdk/src/plugin-host/core.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/plugin-sdk/src/plugin-host/core.test.ts) | `@proj-airi/plugin-sdk` | 22 | Plugin host lifecycle, hook registration, sandboxing, and inter-plugin events |
| [`packages/cap-vite/src/native.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/cap-vite/src/native.test.ts) | `@proj-airi/cap-vite` | 11 | Capacitor native bridge configuration generation |
| [`apps/server/src/routes/__test__/characters.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/apps/server/src/routes/__test__/characters.test.ts) | `@proj-airi/server` | 9 | REST API endpoints for character card listing, retrieval, and updates |
| [`packages/server-runtime/src/middlewares/route.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/server-runtime/src/middlewares/route.test.ts) | `@proj-airi/server-runtime` | 9 | Server routing middleware, path normalization, and error handling |
| [`apps/server/src/routes/__test__/providers.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/apps/server/src/routes/__test__/providers.test.ts) | `@proj-airi/server` | 8 | REST API endpoints for provider status and configuration |
| [`packages/cap-vite/src/cli.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/cap-vite/src/cli.test.ts) | `@proj-airi/cap-vite` | 6 | Capacitor CLI commands and build target arguments |
| [`apps/server/src/services/__test__/characters.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/apps/server/src/services/__test__/characters.test.ts) | `@proj-airi/server` | 6 | Server character data service persistence and cache layers |
| [`apps/server/src/services/__test__/providers.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/apps/server/src/services/__test__/providers.test.ts) | `@proj-airi/server` | 6 | Server provider management service and connection checking |
| [`packages/cap-vite/src/index.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/cap-vite/src/index.test.ts) | `@proj-airi/cap-vite` | 4 | Cap-vite plugin initialization and configuration hooks |
| [`packages/cap-vite/src/vite-wrapper-config.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/cap-vite/src/vite-wrapper-config.test.ts) | `@proj-airi/cap-vite` | 1 | Vite config wrapper resolution for Capacitor mobile packaging |

