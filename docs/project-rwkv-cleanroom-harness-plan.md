# Architectural Blueprint: The Standalone RWKV Cleanroom Test Harness & Experiment Matrix

**Status:** Proposed Architecture & Execution Plan
**Target Directory:** `scripts/tests/rwkv-harness/`
**Authors:** AIRI Team & AI Assistant
**Related Docs:**
- [`proposal-built-in-llm-webgpu.md`](./proposal-built-in-llm-webgpu.md) — Built-in WebGPU RWKV architecture, OPFS caching, and state-file merge limitation notes.
- [`proposal-toggle4-rework-and-rwkv-harness.md`](./proposal-toggle4-rework-and-rwkv-harness.md) — Toggle 4 ML topic extraction & vector state delta specification.
- [`proposal-attention-ecology-local-webgpu-guard.md`](./proposal-attention-ecology-local-webgpu-guard.md) — Cascaded salience gating & subconscious RWKV perception loop.

---

## 1. Executive Summary & Problem Context

AIRI currently packages a WebGPU-native RWKV-7 provider (`packages/stage-ui/src/workers/web-rwkv/worker.ts`). However, because the current loader in `worker.ts` loads raw, un-tuned 0.1B base model weights (`DanielClough/rwkv7-g1-safetensors`) without instruction or roleplay state tuning, the model behaves like a "wild horse"—rambling, hallucinating user turns (`"\nUser:"`), and failing to adhere to structured JSON or constrained output grammars.

Furthermore, the entire RWKV-7 roleplay community relies on **State Files** (such as [`shoumenchougou/RWKV-7-G1-RolePlay-State`](https://huggingface.co/shoumenchougou/RWKV-7-G1-RolePlay-State), updated Jan 2026 with bilingual English/Chinese data) to overlay instruction and roleplay vectors onto base model weights. AIRI currently lacks in-browser state-file merging capabilities.

To systematically tame RWKV without UI overhead, we establish a **Standalone Cleanroom CLI Test Harness** (`scripts/tests/rwkv-harness/`) in Node.js. This harness allows us to validate state-file merging, test instruction adherence, and run four phased experiments.

---

## 2. Comprehensive Codebase File & Path Index

To ensure zero wheel-spinning during research and execution, the research agent must reference these authoritative source files:

| Subsystem | File / Directory Path | Role / Function |
|---|---|---|
| **RWKV Web Worker** | [`packages/stage-ui/src/workers/web-rwkv/worker.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/workers/web-rwkv/worker.ts) | `@cryscan/web-rwkv-wasm` session creation (`Session.from_reader`), sampler loops, and tokenizer setup. |
| **RWKV OPFS Cache** | [`packages/stage-ui/src/workers/web-rwkv/cache.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/workers/web-rwkv/cache.ts) | OPFS caching, tensor indexing, and cache verification. |
| **RWKV Safetensors Parser** | [`packages/stage-ui/src/workers/web-rwkv/safetensors.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/workers/web-rwkv/safetensors.ts) | Safetensors header parsing, f16 byte conversions, and matrix orientation. |
| **RWKV Inference Adapter** | [`packages/stage-ui/src/libs/inference/adapters/web-rwkv.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/libs/inference/adapters/web-rwkv.ts) | Eventa contract interface (`webRwkvGenerateEvent`, `webRwkvLoadEvent`). |
| **RWKV UI Settings** | [`packages/stage-pages/src/pages/settings/providers/chat/web-rwkv.vue`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-pages/src/pages/settings/providers/chat/web-rwkv.vue) | UI model selector & setting configuration page. |
| **Vocabulary Vocab JSON** | [`packages/stage-ui/src/workers/web-rwkv/rwkv_vocab_v20230424.json`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/workers/web-rwkv/rwkv_vocab_v20230424.json) | Bundled RWKV "World" tokenizer vocabulary. |

---

## 3. Cleanroom Directory & Architecture Layout

The cleanroom harness operates as a standalone CLI environment under `scripts/tests/rwkv-harness/`:

```
scripts/tests/rwkv-harness/
├── package.json               ← Isolated dependencies (@onnxruntime-node, @cryscan/web-rwkv-wasm)
├── tsconfig.json              ← TypeScript config for Node.js ESM execution
├── engine/
│   ├── fetcher.ts             ← HuggingFace Range-request model & state file downloader
│   ├── state-merger.ts        ← Pure JS/WASM tensor overlay engine (Base .safetensors + .state file)
│   └── rwkv-session.ts        ← Wrapper for Session.from_reader and token sampling
├── experiments/
│   ├── 00-epilogue-validation.ts ← Phase 0: Validate state-file merge & bilingual roleplay output
│   ├── 01-toggle4-topics.ts     ← Phase 1: Test wkv hidden state deltas across turns (Toggle 4)
│   ├── 02-echo-chip-tagger.ts   ← Phase 2: Test background multi-word tag synthesis (Echo Chips)
│   └── 03-salience-gate.ts      ← Phase 3 (Final Boss): Constrained decoding salience gate (Attention Ecology)
└── test-prompts/
    ├── roleplay-dialogue.json  ← Standardized multi-turn roleplay turns
    └── screen-telemetry.json   ← OCR & window title telemetry samples
```

---

## 4. Phased Experiment Sequence

The experiments are ordered logically, starting with validating the core cleanroom setup and progressing toward the "final boss" attention ecology gate.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Phased Experiment Sequence                           │
├─────────────────────────────────────────────────────────────────────────────┤
│  Phase 0 (Epilogue Setup): Validate State-File Merge & Roleplay Benchmark   │
│  └─ Merge `rwkv7-g1d-0.1b.safetensors` + `shoumenchougou/RolePlay-State`      │
│  └─ Verify model output changes from "wild horse" to coherent roleplay.    │
├─────────────────────────────────────────────────────────────────────────────┤
│  Phase 1: Toggle 4 Real-Time Topic Vector Deltas (First Experiment)        │
│  └─ Measure cosine distance of recurrent state vector `wkv_t` across turns. │
│  └─ Prove zero-stopword, model-intrinsic topic activation.                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  Phase 2: Echo Chip Multi-Word Theme Tag Synthesis                          │
│  └─ Test slice-based background tag generation without rambling.            │
├─────────────────────────────────────────────────────────────────────────────┤
│  Phase 3 (Final Boss): Cascaded Salience Gate (Attention Ecology)           │
│  └─ Constrained logit decoding for `PROMOTE` | `IGNORE` on screen OCR feeds.│
└─────────────────────────────────────────────────────────────────────────────┘
```

### Phase 0: Epilogue & Cleanroom Setup Verification (`00-epilogue-validation.ts`)
* **Goal**: Validate that the cleanroom harness can successfully download base weights (`DanielClough/rwkv7-g1-safetensors`), overlay the proven third-party state file ([`shoumenchougou/RWKV-7-G1-RolePlay-State`](https://huggingface.co/shoumenchougou/RWKV-7-G1-RolePlay-State)), and run in Node.js/WASM.
* **Benchmark Criteria**: Verify that the merged model stops hallucinating role markers (`"\nUser:"`) and produces coherent bilingual English/Chinese dialogue.

### Phase 1: Toggle 4 Real-Time Topic Vector Deltas (`01-toggle4-topics.ts`)
* **Reference**: [`proposal-toggle4-rework-and-rwkv-harness.md`](./proposal-toggle4-rework-and-rwkv-harness.md)
* **Goal**: Stream multi-turn conversation dialogue into `session.run()` *without resetting recurrent state*. Measure the cosine distance of the hidden state vector $\mathbf{wkv}_t$ across topic shifts (e.g. switching from "cooking pasta" to "Rust programming").
* **Why Phase 1**: Easiest experiment to evaluate because it measures vector math ($\Delta \mathbf{wkv}$) rather than complex text generation.

### Phase 2: Echo Chip Multi-Word Theme Tag Synthesis (`02-echo-chip-tagger.ts`)
* **Goal**: Feed a 10-turn conversation slice into the state-merged RWKV session and test if it can reliably output 3–5 multi-word theme tags without rambling or dropping into repetitive loops.

### Phase 3 (Final Boss): Cascaded Salience Gate (`03-salience-gate.ts`)
* **Reference**: [`proposal-attention-ecology-local-webgpu-guard.md`](./proposal-attention-ecology-local-webgpu-guard.md)
* **Goal**: Stream raw OS window titles and OCR screen telemetry into the RWKV state and test constrained logit decoding (masking vocabulary logits to force strict grammar outputs: `PROMOTE <frame_id>` vs. `IGNORE`).

---

## 5. Next Steps for Research Subagent

1. Initialize `scripts/tests/rwkv-harness/package.json` with Node.js ESM dependencies (`@cryscan/web-rwkv-wasm`, `@onnxruntime-node`).
2. Implement `engine/state-merger.ts` to overlay `RWKV-7-G1-RolePlay-State` tensor weights onto base safetensors headers.
3. Run `00-epilogue-validation.ts` to establish the baseline cleanroom verification pass.
