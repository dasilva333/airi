# OpenJev (151M) System 1 Decision Model: Technical Specification & Local Integration Plan

> **Status**: Proposed Architecture & Integration Plan
> **Target Subsystems**: `packages/stage-ui` (Inference Workers, Adapters, Providers, Search), `packages/stage-pages` (System 1 Settings)
> **Key References**:
> - OpenJev Checkpoint: [`heman10x/rlcd-modernbert-151m`](https://huggingface.co/heman10x/rlcd-modernbert-151m) (Hugging Face)
> - ModernBERT Architecture: [`answerdotai/ModernBERT-base`](https://huggingface.co/answerdotai/ModernBERT-base)
> - Laya Baseline & Candidate Matrix: [`docs/nan0/laya-onnx-candidate-matrix.md`](./nan0/laya-onnx-candidate-matrix.md)
> - System 1 RFC & Integration Map: [`docs/proposal-jev-integration.md`](./proposal-jev-integration.md) & [`docs/design-jev-integrations.md`](./design-jev-integrations.md)

---

## 1. Executive Summary

AIRI currently supports two tiers for its non-autoregressive **System 1** decision substrate:
1. **Remote Cloud Providers**: TypeSafe Jev via Direct API (`typesafe-ai`), OpenRouter (`openrouter-ai`), or OpenCode Go (`opencode-go`), providing 32K context and ~120ms round-trip latency.
2. **Local On-Device Provider**: Laya (`laya-local`) based on ModernBERT-large (421M parameters), executing in-browser via WebGPU or threaded WASM.

While Laya is powerful, running a 421M model directly in the browser introduces practical constraints:
- **Large Download Size**: ~633 MB (INT8) / 847 MB (FP16), which creates a noticeable barrier during first-run download.
- **WASM CPU Latency**: On machines without hardware WebGPU (e.g. Windows Electron without cross-origin isolation or unsupported GPUs), single-threaded CPU execution takes ~3s per question, making multi-question batches too slow for sub-second UI gating.
- **WebGPU Attention Overhead**: 16 attention heads computing dense fp32 matrices ($64 \times \text{batch} \times L^2$ bytes) approach WebGPU's 2 GiB `maxBufferSize` ceiling on long contexts.

**OpenJev (`heman10x/rlcd-modernbert-151m`)** provides an ideal lightweight local alternative. Built on **ModernBERT-base (151M parameters)** and post-trained with Reinforcement Learning for Calibrated Decisions (RLCD), OpenJev maintains full protocol parity with TypeSafe Jev (`choice`, `score`, `noul`) while cutting model size and memory compute by more than **65%**.

---

## 2. Architectural Comparison: Laya vs. OpenJev

| Dimension | Laya (`convaiinnovations/laya`) | OpenJev (`heman10x/rlcd-modernbert-151m`) | Architectural Impact for AIRI |
| :--- | :--- | :--- | :--- |
| **Backbone Architecture** | ModernBERT-large | ModernBERT-base | Shared tokenizer and sequence encoding pipeline |
| **Parameter Count** | 421M | **151M** | **2.8× parameter reduction** |
| **Attention Heads** | 16 heads | **12 heads** | **25% fewer attention matrices** |
| **Hidden Dimension** | 1024 | **768** | Reduced linear projection overhead |
| **Download Size (INT8)**| ~633 MB | **~155 MB** | **4× faster download / cache hydration** |
| **Download Size (FP16)**| ~847 MB | **~300 MB** | Lightweight for desktop WebGPU |
| **Dense Attention Formula** | $64 \times \text{batch} \times L^2 \text{ bytes}$ | **$48 \times \text{batch} \times L^2 \text{ bytes}$** | **25% less VRAM buffer pressure on WebGPU** |
| **Buffer at $L=4096$ (batch=1)**| $1,073.74\text{ MB}$ (1.00 GiB) | **$805.30\text{ MB}$ (0.75 GiB)** | Safe buffer headroom under 2.0 GiB ceiling |
| **Local GPU Latency** | ~170–250ms (512 tokens) | **< 35ms** (512 tokens) | Real-time reflexive gating |
| **CPU WASM Latency** | ~3,000ms / question | **~350–700ms / question** | Usable fallback on CPU-only machines |
| **Logit Capacity** | Dynamic option markers | **25 slots** (24 options + 1 abstention) | Up to 24 candidate options per decision |
| **Abstention Support** | Masked soft-distractor | **Native `__insufficient_evidence__`** | Eliminates false-positive triggers in vision & RAG |

---

## 3. Protocol & Schema Compatibility

OpenJev implements the identical non-autoregressive decision interface as TypeSafe Jev and Laya:

### Sequence Format
Like Laya, OpenJev formats inputs as a single concatenated sequence:
```
[CLS] <qtype> question: instructions [SEP] [MASK] opt0 [MASK] opt1 ... [SEP] state [SEP]
```
Where:
- `[CLS]` token ID: 50281
- `[SEP]` token ID: 50282
- `[PAD]` token ID: 50283
- `[MASK]` token ID: 50284

### Typed Primitives
1. **`choice`**: Selects the optimal categorical option among candidate options. Softmax is temperature-scaled over candidate marker positions.
2. **`score`**: Evaluates ordinal scalar intensity (0 to $K-1$) mapped to rubric levels.
3. **`noul`**: Binary truth evaluation evaluating calibrated $P(\text{true})$ vs $P(\text{false})$.
4. **Explicit Abstention (`__insufficient_evidence__`)**:
   OpenJev's 25th logit slot represents explicit uncertainty. If $P(\text{abstain}) \ge 0.50$, the decision engine recognizes that the context lacks sufficient grounding, preventing hallucinations on ambiguous data.

---

## 4. Comprehensive Integration Inventory

Integrating OpenJev into AIRI touches 7 specific architectural layers:

```
┌────────────────────────────────────────────────────────┐
│ 1. Model Catalog & Checkpoint Specs                    │
│    packages/stage-ui/src/libs/inference/laya-models.ts │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│ 2. Worker Execution & Batch Budgeting                  │
│    packages/stage-ui/src/workers/laya/worker.ts        │
│    packages/stage-ui/src/workers/laya/prep.ts          │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│ 3. Inference Adapter & Coordinator Constants           │
│    packages/stage-ui/src/libs/inference/adapters/laya.ts│
│    packages/stage-ui/src/libs/inference/constants.ts   │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│ 4. Local Provider Registration                         │
│    .../libs/providers/providers/laya-local/index.ts    │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│ 5. System 1 Pinia Store                                │
│    packages/stage-ui/src/stores/modules/system-one.ts  │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│ 6. Settings UI & Model Selector                        │
│    .../pages/settings/providers/system1/laya-local.vue │
│    .../pages/settings/modules/system-one.vue           │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│ 7. Downstream Consumer Surfaces                        │
│    - Universe RAG (layered-memory.ts)                  │
│    - Vision Gating (vision/orchestrator.ts)            │
│    - AnimaDex Voice Matching (guided.vue)              │
│    - Lifetime Day-Gate (memory-lifetime.ts)            │
└────────────────────────────────────────────────────────┘
```

### Detailed Layer Tasks:

#### Layer 1: Model Specs (`laya-models.ts`)
- Add `OPENJEV_MODEL_SPECS` for INT8 and FP16:
  - Repository: `heman10x/rlcd-modernbert-151m`
  - Model files: `model.onnx` (int8) / `model_fp16.onnx` (fp16)
  - Approx download size: ~155 MB (INT8), ~300 MB (FP16)
  - Tokenizer: `heman10x/rlcd-modernbert-151m` (or `answerdotai/ModernBERT-base`)

#### Layer 2: Worker Engine (`worker.ts` & `prep.ts`)
- Generalize `ensureSession` to accept `modelFamily: 'laya' | 'openjev'`.
- Dynamic attention budgeting:
  - For Laya (16 heads): bytes per sequence $= 64 \times L^2$.
  - For OpenJev (12 heads): bytes per sequence $= 48 \times L^2$.
- Support the `__insufficient_evidence__` slot in `decodeAnswers`:
  - When the 25th slot has top probability, output `{ abstained: true, confidence: ... }` so consumers can safely apply fallback heuristics.

#### Layer 3: Constants & VRAM Estimator (`constants.ts`)
- Register `MODEL_IDS.OPENJEV = 'heman10x/rlcd-modernbert-151m'`.
- Add VRAM budget estimates:
  - Laya: ~850 MB (FP16) / ~450 MB (INT8)
  - OpenJev: ~320 MB (FP16) / ~180 MB (INT8)

#### Layer 4: Provider Metadata (`providers/laya-local/index.ts`)
- Update `laya-local` provider definition to export both models in `models`:
  ```typescript
  models: [
    { id: 'convaiinnovations/laya-int8', name: 'Laya Large INT8 (421M)', default: false },
    { id: 'heman10x/rlcd-modernbert-151m-int8', name: 'OpenJev Base INT8 (151M - Fast)', default: true },
    { id: 'convaiinnovations/laya-fp16', name: 'Laya Large FP16 (421M)', default: false },
    { id: 'heman10x/rlcd-modernbert-151m-fp16', name: 'OpenJev Base FP16 (151M)', default: false },
  ]
  ```

#### Layer 5: Settings UI (`laya-local.vue` & `system-one.vue`)
- Add a Model Selector card allowing users to pick:
  - **OpenJev 151M (Recommended)**: Lightest footprint, fastest execution, recommended for laptops and CPU setups.
  - **Laya 421M**: Deeper capacity, recommended for high-end GPUs.

---

## 5. Rollout & Verification Plan

1. **Verify Weights & ONNX Artifacts**:
   - Download `heman10x/rlcd-modernbert-151m` ONNX exports and verify tensor graph compatibility via a local Node.js test harness.
   - Verify that outputs on a known benchmark prompt match expected calibrated logits.
2. **Implement Model Spec & Worker Adaptation**:
   - Add model spec in `laya-models.ts` and wire multi-model resolution in `worker.ts`.
3. **Update Provider Definition & Settings UI**:
   - Expose the new model options in the settings catalog.
4. **End-to-End Subsystem Regression Tests**:
   - Universe RAG: verify `runTriage()` and `runRerank()` complete in <100ms on WebGPU and <1.5s on CPU.
   - Vision Gate: verify screen observations produce calibrated gate decisions.
   - Memory Lifetime: verify day-gate classification and winnow turn compaction.
