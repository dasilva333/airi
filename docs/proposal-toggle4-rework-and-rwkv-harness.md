# Architectural Proposal: ML-Driven Topic Extraction & RWKV State Harness (Toggle 4 Rework)

**Status:** Proposed Architecture & Research Handoff
**Authors:** AIRI Team & AI Assistant
**Target Component:** `packages/stage-ui/src/stores/chat/recent-topics.ts` & `ChatGroundingPopover.vue`
**Related Docs:**
- [`proposal-dynamic-memory-rag-injection.md`](./proposal-dynamic-memory-rag-injection.md) — Grounding popover & Toggle 4 original vision.
- [`proposal-built-in-llm-webgpu.md`](./proposal-built-in-llm-webgpu.md) — WebGPU RWKV architecture & model execution pipeline.
- [`analysis-gpt-sovits-onnx-webgpu-viability.md`](./analysis-gpt-sovits-onnx-webgpu-viability.md) — Canonical ONNX model vetting checklist for browser runtimes.

---

## 1. Problem Statement: Why Current Toggle 4 Sucks

The current implementation of Toggle 4 (`recent-topics.ts`) relies on a **270-line hardcoded JS stopword list** and primitive whitespace n-gram splitting.

This approach has major flaws:
1. **Low Data Quality**: Generates single-word junk tags (e.g. `"going"`, `"think"`, `"really"`) that clutter the grounding prompt context.
2. **Maintenance Nightmare**: Requires maintaining locale-specific stopword dictionaries for every language supported by AIRI.
3. **Naive Linear Decay**: Uses a hardcoded `0.01` per-message penalty instead of true turn-based, segment-based, or wall-clock decay models.
4. **Card State Pollution**: Mutates the core character card definition on every turn, causing constant local storage IO.

---

## 2. Comprehensive Codebase Path Index for RWKV, CLIP, and Topics

To ensure zero wheel-spinning during research, here are the exact authoritative source paths for all relevant models, state handlers, workers, and repositories in AIRI:

### 2.1 CLIP & Vision Text Encoders
* **CLIP Model Endpoint & Tokenizer**: [`packages/stage-ui/src/utils/flowmdm/clipEncoder.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/utils/flowmdm/clipEncoder.ts) (Loads `Xenova/clip-vit-base-patch32` via `@huggingface/transformers`, generating 512-dimensional text embeddings in `getClipEmbedding()`).
* **Local Vision Inference Adapter**: [`packages/stage-ui/src/libs/inference/index.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/libs/inference/index.ts) (Local vision models `DEFAULT_LOCAL_VISION_MODEL`).

### 2.2 WebGPU RWKV Subsystem
* **RWKV WebGPU Worker**: [`packages/stage-ui/src/workers/web-rwkv/worker.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/workers/web-rwkv/worker.ts) (Loads `@cryscan/web-rwkv-wasm`, executes `Session.from_reader()`, and manages `session.state_len()`).
* **RWKV Stream Adapter**: [`packages/stage-ui/src/libs/inference/adapters/web-rwkv.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/libs/inference/adapters/web-rwkv.ts) (Eventa streaming contract handler).
* **RWKV Store & Formatting**: [`packages/stage-ui/src/stores/providers/web-rwkv/index.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/providers/web-rwkv/index.ts) & [`format.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/providers/web-rwkv/format.ts) (`rwkv_vocab_v20230424.json`).
* **RWKV UI Page**: [`packages/stage-pages/src/pages/settings/providers/chat/web-rwkv.vue`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-pages/src/pages/settings/providers/chat/web-rwkv.vue).

### 2.3 Grounding & Memory Repositories
* **Toggle 4 Extractor**: [`packages/stage-ui/src/stores/chat/recent-topics.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/chat/recent-topics.ts)
* **Grounding UI Popover**: [`packages/stage-ui/src/components/scenarios/chat/ChatGroundingPopover.vue`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/components/scenarios/chat/ChatGroundingPopover.vue)
* **Echo Chips Repository**: [`packages/stage-ui/src/database/repos/echo-chips.repo.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/database/repos/echo-chips.repo.ts)

---

## 3. Distinction: Toggle 4 ("Here & Now") vs. Echo Chips ("Static Historical Ticker")

It is critical to clarify the distinction between **Toggle 4 (Recent Topics)** and **Echo Chips**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Memory & Tagging Distinction                       │
├──────────────────────────────────────────┬──────────────────────────────────┤
│ 🏷️ Echo Chips (Static Historical Ticker)  │ ⚡ Toggle 4 (Dynamic Here & Now) │
├──────────────────────────────────────────┼──────────────────────────────────┤
│ • Batch system task running ~6x/day      │ • Real-time, turn-by-turn topic  │
│   (1 hour after conversation ends).      │   recalculation.                 │
│ • Synthesizes 3-6 multi-word tags        │ • Dynamically updates on turn 1, │
│   representing a dormant conversation.   │   turn 2, turn 3 as dialogue flows│
│ • Static timeline ticker / feed of chat  │ • Independent feature; MUST NOT   │
│   history beats.                         │   require Echo Chips enabled.    │
└──────────────────────────────────────────┴──────────────────────────────────┘
```

* **Toggle 4 MUST NOT require Echo Chips as a hard dependency**: Asking users to enable background Echo Chip synthesis just to use Toggle 4 creates unnecessary feature coupling.
* **Recalculation on the Fly**: While an idle chat turn might initially seed from past topics, the moment the user sends 1 or 2 messages, Toggle 4 **must dynamically recalculate to reflect the immediate, top-of-mind focus of the active turn**.

---

## 4. Four Candidate ML Avenues for Evaluation

The research agent is tasked with researching, web searching, and evaluating four distinct ML avenues to replace hardcoded stopword parsing with high-precision topic extraction:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Candidate Topic Extraction Avenues                     │
├──────────────────────────┬──────────────────────────┬───────────────────────┤
│ Avenue 1: Dedicated ONNX │ Avenue 2: Local CLIP/ViT │ Avenue 3: RWKV Hidden │
│ Model (KeyBERT/MiniLM)   │ Text Encoder Vector Space│ State Delta (wkv)     │
├──────────────────────────┴──────────────────────────┴───────────────────────┤
│ Avenue 4: Pure LLM Synthesis (Echo Chips & STMM Summaries)                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Avenue 1: Dedicated Browser ONNX Model (KeyBERT / MiniLM / Zero-Shot NER)
* **Concept**: Run a lightweight ONNX model in WebAssembly via `onnxruntime-web` specifically trained for keyword/keyphrase extraction.
* **Evaluation Criteria**: Must pass the **Canonical ONNX Model Vetting Checklist** (`analysis-gpt-sovits-onnx-webgpu-viability.md`): single-fused graph, payload <30MB, WASM execution under <15ms.

### Avenue 2: Local CLIP / ViT Text Encoder
* **Source Path**: `clipEncoder.ts` (`Xenova/clip-vit-base-patch32`).
* **Concept**: Leverage AIRI's existing bundled CLIP text encoder (`getClipEmbedding()`) to project dialogue turns into a 512-dimensional vector space and cluster top-of-mind topics without stopword filtering.

### Avenue 3: RWKV Hidden State Vector Delta ($\mathbf{wkv}$)
* **Source Path**: `workers/web-rwkv/worker.ts` & `adapters/web-rwkv.ts`.
* **Concept**: Leverage the attention-free, recurrent nature of RWKV (`@cryscan/web-rwkv-wasm`). RWKV maintains a constant-size hidden state (`session.state_len()`) that inherently acts as a rolling conversational memory. Sampling hidden state deltas ($\Delta \mathbf{h}$) across turns yields topic activation without text parsing.

### Avenue 4: Pure LLM Synthesis (Echo Chips & STMM Summaries)
* **Source Path**: `echo-chips.repo.ts`.
* **Concept**: Restrict topic tracking exclusively to model-synthesized outputs (Echo Chips and daily STMM summaries). Eliminates raw text parsing completely. *(Note: Must adhere to §3 distinction).*

---

## 5. Standalone Cleanroom Test Harness for RWKV (CLI & ONNX)

To tame the "wild horse" of RWKV and empirically test its hidden state vectors for topic extraction without UI overhead, we specify a **standalone cleanroom CLI test harness**.

### Cleanroom Directory Structure (`scripts/tests/rwkv-harness/`)
```
scripts/tests/rwkv-harness/
├── package.json              ← Isolated dependencies (@onnxruntime-node, web-rwkv-wasm)
├── run-rwkv-cli.ts           ← Node.js CLI script for testing RWKV ONNX/WASM execution
├── extract-state.ts          ← Script to inspect & log wkv state vector deltas
└── sample-prompts.json       ← Standardized test conversation turns
```

### Validation & Benchmark Checklist for Harness
1. **Execution Stability**: Run 100 consecutive turns in Node/WASM without memory leaks or state corruption.
2. **State Delta Verification**: Log cosine distance between $\mathbf{wkv}_{t}$ and $\mathbf{wkv}_{t-1}$ when changing topics (e.g. switching from "cooking pasta" to "Rust programming").
3. **Keyword Projections**: Verify if linear projections of $\mathbf{wkv}$ can reliably surface top-5 topic embeddings.
