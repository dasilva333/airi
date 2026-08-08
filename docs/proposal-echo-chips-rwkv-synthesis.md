# Architectural Proposal: RWKV-Driven Echo Chips Offline Synthesis & Ground-Truth Evaluation

**Status:** Proposed Architecture & Research Handoff
**Authors:** AIRI Team & AI Assistant
**Target Components:**
- `packages/stage-ui/src/stores/echo-chips.ts`
- `packages/stage-ui/src/database/repos/echo-chips.repo.ts` (`local:memory/echo-chips/{userId}`)

**Related Docs:**
- [`project-rwkv-cleanroom-harness-plan.md`](./project-rwkv-cleanroom-harness-plan.md) — RWKV cleanroom CLI test harness & 6-phase roadmap.
- [`proposal-toggle4-rework-and-rwkv-harness.md`](./proposal-toggle4-rework-and-rwkv-harness.md) — Real-time per-turn Toggle 4 topic tracking.
- [`proposal-attention-ecology-local-webgpu-guard.md`](./proposal-attention-ecology-local-webgpu-guard.md) — Cascaded salience gating & subconscious perception loop.

---

## 1. Problem Statement & Executive Summary

AIRI's **Echo Chips** system (`echo-chips.ts`) provides a timeline ticker of multi-word tags (`mood`, `flavor`, `journal_candidate`) synthesized from completed conversation sessions.

Currently, synthesizing Echo Chips requires dispatching background LLM requests to cloud providers (OpenAI / Claude / Gemini). Running continuous local background extraction using heavy LLM models can freeze local hardware or drain battery.

By pairing a WebGPU-native RWKV-7 model (`packages/stage-ui/src/workers/web-rwkv/`) with fine-tuned roleplay `.state` files (e.g. HuggingFace `shoumenchougou/RWKV-7-G1-RolePlay-State`), we can execute offline background Echo Chip synthesis locally in WebGPU at zero API cost.

---

## 2. Echo Chips vs. Toggle 4: Decoupled Architecture

It is critical to maintain a strict separation between **Echo Chips** and **Toggle 4**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Subsystem Architecture                             │
├──────────────────────────────────────────┬──────────────────────────────────┤
│ 🏷️ Echo Chips (Offline Theme Ticker)     │ ⚡ Toggle 4 (Real-Time Per-Turn) │
├──────────────────────────────────────────┼──────────────────────────────────┤
│ • Runs offline / in background (~6x/day  │ • Runs synchronously on every    │
│   or 1h after chat session ends).        │   chat turn.                     │
│ • Synthesizes multi-word tags & pills:   │ • Recalculates top-of-mind focus  │
│   mood, flavor, journal candidates.      │   for instant RAG grounding.     │
│ • Persisted in IndexedDB:                │ • Persisted per active session in│
│   local:memory/echo-chips/{userId}       │   useLocalStorageManualReset.    │
└──────────────────────────────────────────┴──────────────────────────────────┘
```

---

## 3. Ground-Truth Baseline Dataset Evaluation Methodology

To evaluate whether a small 0.1B / 1.5B local RWKV model can reliably produce quality Echo Chips, we use a **Ground-Truth Baseline Comparison Method**:

1. **Extraction of Existing Chat Corpus**:
   - Extract real user conversation histories from AIRI local storage that **already have ground-truth Echo Chips generated** by primary cloud models (Claude 3.5 Sonnet / GPT-4o).
2. **Standardized Dataset Structure (`scripts/tests/rwkv-harness/test-prompts/echo-chips-corpus.json`)**:
   ```json
   {
     "sessionId": "session-1029",
     "chatTranscript": [
       { "role": "user", "content": "I tried baking sourdough today, but the crust got burned." },
       { "role": "assistant", "content": "Ah, temperature control is tricky! What temp did you set?" }
     ],
     "groundTruthChips": {
       "pills": [
         { "content": "Baking Sourdough", "type": "flavor", "relevanceScore": 0.9 },
         { "content": "Kitchen Failure / Frustration", "type": "mood", "relevanceScore": 0.8 }
       ]
     }
   }
   ```
3. **Semantic Similarity & Precision Metrics**:
   - Feed `chatTranscript` into the cleanroom harness (`03-echo-chip-eval.ts`) running RWKV + Roleplay `.state`.
   - Calculate embedding cosine similarity between RWKV-synthesized chips and `groundTruthChips`.
   - Benchmark throughput, token output adherence, and JSON schema compliance.

---

## 4. Codebase Reference Index

| Component | Path | Function |
|---|---|---|
| **Echo Chips Store** | [`packages/stage-ui/src/stores/echo-chips.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/echo-chips.ts) | `ChipSchema`, `ArtifactsSchema`, `synthesizeEchoChips()` logic |
| **Echo Chips Repo** | [`packages/stage-ui/src/database/repos/echo-chips.repo.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/database/repos/echo-chips.repo.ts) | Storage client key `local:memory/echo-chips/{userId}` |
| **RWKV Worker** | [`packages/stage-ui/src/workers/web-rwkv/worker.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/workers/web-rwkv/worker.ts) | WebGPU RWKV runner & tokenizer session |
| **Cleanroom Harness** | `scripts/tests/rwkv-harness/` | Node.js CLI experiment environment |
