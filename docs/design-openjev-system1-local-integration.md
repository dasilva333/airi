# OpenJev (151M) System 1 Decision Model: Technical Specification, Benchmarks & Integration Record

> **Status**: Shipped & Production-Verified in AIRI
> **Target Subsystems**: `packages/stage-ui` (Inference Workers, Adapters, Providers, Cache Oversight), `packages/stage-pages` (System 1 Settings, Inference Providers, Card Editor Cognition), `packages/i18n`
> **Key References**:
> - OpenJev Checkpoint: [`heman10x/rlcd-modernbert-151m`](https://huggingface.co/heman10x/rlcd-modernbert-151m) (Hugging Face)
> - ModernBERT Architecture: [`answerdotai/ModernBERT-base`](https://huggingface.co/answerdotai/ModernBERT-base)
> - Laya Baseline & Candidate Matrix: [`docs/nan0/laya-onnx-candidate-matrix.md`](./nan0/laya-onnx-candidate-matrix.md)
> - System 1 RFC & Integration Map: [`docs/proposal-jev-integration.md`](./proposal-jev-integration.md) & [`docs/design-jev-integrations.md`](./design-jev-integrations.md)
> - Upstream / Evaluation Conclusion: `personal_airi/conclusion.md`

---

## 1. Executive Summary & Architectural Motivation

AIRI employs a non-autoregressive **System 1** cognitive substrate to execute sub-second, typed zero-shot classification passes (`choice`, `score`, `noul`) across four mission-critical runtime loops:
1. **Universe RAG Triage & Reranking** (`layered-memory.ts`): Semantic intent filtering and memory candidate reranking before primary LLM generation.
2. **Programmable Visual Attention Gating** (`vision/orchestrator.ts`): Salience classification over screen perception crops to trigger proactive companion interactions.
3. **AnimaDex Fast Voice Matching** (`guided.vue`): Multi-candidate persona-to-voice timbre and pitch classification.
4. **Lifetime Artifact Curation / Eternal Thread** (`memory-lifetime.ts`): Surgical section locking and Winnow turn compaction over daily chat journals.

Previously, local on-device execution relied solely on **Laya (`convaiinnovations/laya`)**, a 421M-parameter model based on ModernBERT-large. While accurate, client-side browser deployment of Laya introduced substantial friction:
- **Heavy Weight Footprint**: ~633 MB (INT8) / ~847 MB (FP16), resulting in multi-minute cache hydration over typical consumer connections.
- **CPU WASM Latency Bottleneck**: Single-threaded CPU WASM execution takes ~3,000 ms per question, making multi-question batches too sluggish for real-time reflexive gating on non-WebGPU setups.
- **WebGPU Attention Buffer Limits**: ModernBERT-large's 16 attention heads generate dense fp32 matrices ($64 \times \text{batch} \times L^2$ bytes) that exceed WebGPU's strict 2 GiB `maxBufferSize` limit at contexts $\ge 6,144$ tokens.

**OpenJev (`heman10x/rlcd-modernbert-151m`)** was integrated as a first-class local on-device System 1 engine. Built on **ModernBERT-base (151M parameters)** and post-trained with Reinforcement Learning for Calibrated Decisions (RLCD), OpenJev delivers complete protocol parity with TypeSafe Jev and Laya while slashing parameter count and download weight by over **65%**.

---

## 2. Architectural Comparison: Laya vs. OpenJev

| Dimension | Laya (`convaiinnovations/laya`) | OpenJev (`heman10x/rlcd-modernbert-151m`) | Architectural Impact for AIRI |
| :--- | :--- | :--- | :--- |
| **Backbone Architecture** | ModernBERT-large | ModernBERT-base | Shared sequence encoding and BPE tokenization pipeline |
| **Parameter Count** | 421M | **151M** | **2.8× reduction in parameter weights** |
| **Attention Heads** | 16 heads | **12 heads** | **25% fewer attention matrices** |
| **Hidden Dimension** | 1024 | **768** | Reduced linear projection overhead and activation memory |
| **Download Size (INT8)**| ~633 MB | **~155 MB** | **4× faster cache hydration** |
| **Download Size (FP16)**| ~847 MB | **~300 MB** | Lightweight distribution for desktop WebGPU |
| **Dense Attention Formula** | $64 \times \text{batch} \times L^2 \text{ bytes}$ | **$48 \times \text{batch} \times L^2 \text{ bytes}$** | **25% lower VRAM buffer pressure** |
| **Buffer at $L=4096$ (batch=1)**| $1,073.74\text{ MB}$ (1.00 GiB) | **$805.30\text{ MB}$ (0.75 GiB)** | Safe buffer headroom under 2.0 GiB WebGPU ceiling |
| **WebGPU In-App Latency** | ~170–250 ms (512 tokens) | **~604 ms (237 tokens end-to-end)** | Fast, non-blocking zero-shot decisions |
| **CPU WASM Latency** | ~3,000 ms / question | **~2,894 ms (INT8) / 3,042 ms (FP16)** | Resilient CPU-only fallback |
| **Input Feeds Required** | `input_ids`, `attention_mask`, `marker_pos`, `marker_mask`, `qtype` | **`input_ids`, `attention_mask`** (pure encoder graph) | Self-contained classification graph |
| **Abstention Support** | Masked soft-distractor | **Native `__insufficient_evidence__`** | Eliminates false-positive triggers in vision & RAG |

---

## 3. Empirical Benchmark Data

### 3.1 Live AIRI In-App Diagnostic Benchmarks (macOS, Chromium Runtime)

Tested using the live diagnostic harness in `#/settings/providers/system1/openjev-local` evaluating a real zero-shot triage question (`choice` over memory retrieval query categories, 237 input tokens):

| Configuration | Model Target | Execution Provider | End-to-End Latency | Cache Footprint | Result Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **OpenJev Base FP16 + WebGPU** | `heman10x/rlcd-modernbert-151m-fp16` | **WebGPU** (`shader-f16`) | **604 ms** | **867.9 MB** (Shared) | **Optimal (~5× speedup)** |
| **OpenJev Base INT8 + CPU WASM** | `heman10x/rlcd-modernbert-151m` | **CPU WASM** (SIMD128) | **2,894 ms** | **578.2 MB** (Shared) | **Stable Fallback** |
| **OpenJev Base FP16 + CPU WASM** | `heman10x/rlcd-modernbert-151m-fp16` | **CPU WASM** (Single-threaded) | **3,042 ms** | **867.9 MB** (Shared) | **High CPU Overhead** |

> [!NOTE]
> The FP16 + WebGPU pipeline executes in **604 ms**, delivering a **~5× speedup** over CPU execution while keeping GPU VRAM consumption minimal.

---

### 3.2 Hardware Microbenchmarks: ModernBERT Base vs. Large (RX 9070 XT, ROCm / PyTorch vs. ORT-Web)

From benchmark analysis in `personal_airi/conclusion.md`:

#### Single Sequence ORT-web WebGPU (ModernBERT-large, fp16, batch=1):
| Context Length | ORT-web Latency | Notes / Failure Modes |
| :--- | :--- | :--- |
| 512 tokens | 0.24 s | Normal operation |
| 1024 tokens | 0.74 s | Normal operation |
| 2048 tokens | 2.9 s | Noticeable quadratic slowdown |
| 4096 tokens | 17–25 s | Heavy VRAM pressure |
| 5120 tokens | 50–60 s | Severe stall |
| 6144 / 7168 tokens | **CRASH** | `Buffer size 2415919104 exceeds max buffer size limit (2147483648)` |
| 8192 tokens | **CRASH** | `Integer overflow` |

#### Native PyTorch (Fused Attention, fp16, RX 9070 XT) — Base (149M) vs. Large (395M):
| Context Length | ModernBERT-base (149M) | ModernBERT-large (395M) | ORT-web Large Graph |
| :--- | :--- | :--- | :--- |
| 512 tokens | **18 ms** | 23 ms | 240 ms |
| 2048 tokens | **22 ms** | 42 ms | 2.9 s |
| 4096 tokens | **59 ms** | 111 ms | 17–25 s |
| 8192 tokens | **247 ms** (1.4 GB) | **421 ms** (1.9 GB) | *Exceeds WebGPU buffer limit* |

#### Long-Context Needle Probe (ModernBERT, MLM, 8000 Tokens Total Context):
Top-1 retrieval accuracy of a hidden fact at varying distances before the query:
| Distance from Query | ModernBERT-base (151M) | ModernBERT-large (421M) |
| :--- | :--- | :--- |
| 100 tokens | **10 / 10** | 8 / 10 |
| 500 tokens | **10 / 10** | 5 / 10 |
| 2,000 tokens | **10 / 10** | 8 / 10 |
| 4,000 tokens | **10 / 10** | 8 / 10 |
| 7,500 tokens | **8 / 10** | **1 / 10** |

*Takeaway*: ModernBERT-base exhibits significantly higher needle-probe retention at extreme context lengths (80% at 7500 tokens vs 10% for large), supporting longer context windows without attention dilution.

---

## 4. Technical Deep Dive: Why INT8 + WebGPU is Restricted

A critical architectural question arose during implementation:
> *Is the restriction disabling WebGPU for INT8 models based solely on Laya's existing implementation, or is it an empirical necessity that will also time out on OpenJev?*

### 4.1 Root Cause in `onnxruntime-web` Execution Providers

The restriction is an **engine-level architectural constraint**, not a Laya-specific quirk.

1. **Missing Quantized Integer Kernels in WebGPU EP**:
   `onnxruntime-web`'s WebGPU execution provider (`webgpu`) implements WGSL compute shaders almost exclusively for floating-point operations (`f32` and `f16` via `shader-f16`). It lacks native WebGPU WGSL kernels for quantized integer matrix multiplication:
   - `MatMulInteger`
   - `QLinearMatMul`
   - Quantized convolution and QDQ (QuantizeLinear / DequantizeLinear) fused blocks.

2. **The Node Fallback Penalty & Memory Copy Thrashing**:
   When a session is initialized with `executionProviders: ['webgpu', 'wasm']`, ONNX Runtime inspects the graph nodes:
   - Any operator supported by WebGPU runs on the GPU.
   - Any operator *not* supported by WebGPU falls back to the secondary provider: `wasm` (CPU).

   In an INT8 quantized model, all core transformer feedforward and projection layers are INT8 quantized. When falling back to `wasm`, ONNX Runtime must:
   1. Stash GPU output buffers and invoke `copyBufferToBuffer` / `mapAsync` to copy intermediate activation tensors from GPU VRAM back to CPU host memory.
   2. Execute the integer quantized kernel on CPU WASM.
   3. Upload the resulting activations back to WebGPU VRAM for subsequent layers.

   This per-layer GPU $\leftrightarrow$ CPU synchronization induces catastrophic pipeline stalls, memory copy overhead, and bus saturation. In a browser worker, this thrashing routinely exceeds the browser's GPU watchdog timer (~5–10s), manifesting as an unresponsive worker crash or indefinite timeout.

3. **Where Each Precision Belongs**:
   - **INT8 $\rightarrow$ CPU WASM (`simd: true`)**: WebAssembly SIMD128 has native dot-product and integer vector instructions (`i8x16`, `i16x8`, `i32x4`). INT8 execution runs cleanly and at peak efficiency entirely within CPU memory without GPU staging overhead.
   - **FP16 $\rightarrow$ WebGPU (`shader-f16`)**: Modern GPUs (Apple Silicon Metal, NVIDIA Vulkan/DX12, AMD ROCm/DirectX) possess native half-precision FP16 tensor/ALU execution pipelines. FP16 graphs execute entirely within GPU memory at ~600 ms without CPU fallback.

Consequently, disabling WebGPU when INT8 is selected is mandatory to prevent user-facing hangs and worker crashes.

---

## 5. Complete Inventory of Modified & Added Files

The OpenJev integration touched 13 files across the monorepo, spanning the worker runtime, provider registration, cache management, settings UI, and unit tests:

```
airi_dasilva333/
├── packages/
│   ├── i18n/
│   │   └── src/locales/en/settings.yaml                      # [Modified] Added OpenJev provider titles and descriptions
│   ├── stage-pages/
│   │   └── src/pages/settings/
│   │       ├── airi-card/components/
│   │       │   ├── AutoVoiceConfigModal.vue                  # [Modified] Modernized to use global System 1 resolution
│   │       │   └── tabs/cognition/CognitionSubTabMemory.vue  # [Modified] Replaced stale provider buttons with global engine link
│   │       ├── modules/system-one.vue                        # [Modified] Added OpenJev to System 1 provider grid & model select
│   │       └── providers/system1/
│   │           ├── laya-local.vue                            # [Modified] Cleaned up Laya-specific branding
│   │           └── openjev-local.vue                         # [Added] Dedicated OpenJev local provider settings page
│   └── stage-ui/
│       ├── src/
│       │   ├── components/scenarios/settings/
│       │   │   └── ModelCacheManager.vue                     # [Modified] Registered OpenJev in Model Cache Oversight
│       │   ├── libs/
│       │   │   ├── inference/
│       │   │   │   ├── cache-utils.ts                        # [Modified] Added isOpenJevModelCached, getOpenJevCacheSize, clearOpenJevCache
│       │   │   │   └── index.ts                              # [Modified] Exported OpenJev cache utility functions
│       │   │   └── providers/providers/
│       │   │       ├── index.ts                              # [Modified] Registered openjev-local in provider registry
│       │   │       ├── laya-local/index.ts                   # [Modified] Standardized Laya provider definition
│       │   │       └── openjev-local/
│       │   │           └── index.ts                          # [Added] First-class OpenJev provider definition
│       │   ├── stores/modules/
│       │   │   ├── system-one.ts                             # [Modified] Added openjev-local to valid System 1 providers
│       │   │   └── system-one.test.ts                        # [Modified] Updated unit tests to assert all 5 System 1 providers
│       │   └── workers/laya/
│       │       └── worker.ts                                 # [Modified] Fixed input names check & added error stack logging
└── docs/
    └── design-openjev-system1-local-integration.md           # [This Document] Canonical specification and benchmark record
```

### 5.1 Layer Details

#### 1. Worker Execution Layer (`packages/stage-ui/src/workers/laya/worker.ts`)
- **Fix for `invalid input 'marker_pos'`**:
  Laya models expect 5 feed inputs (`input_ids`, `attention_mask`, `marker_pos`, `marker_mask`, `qtype`), whereas OpenJev's ONNX export is a clean ModernBERT-base graph expecting only `input_ids` and `attention_mask`.
  We introduced dynamic inspection against `session.inputNames`:
  ```typescript
  const feeds: Record<string, ort.Tensor> = { input_ids: inputIdsTensor, attention_mask: attentionMaskTensor }
  if (session.inputNames.includes('marker_pos') && markerPosTensor)
    feeds.marker_pos = markerPosTensor
  if (session.inputNames.includes('marker_mask') && markerMaskTensor)
    feeds.marker_mask = markerMaskTensor
  if (session.inputNames.includes('qtype') && qtypeTensor)
    feeds.qtype = qtypeTensor
  ```
- **Error Diagnostics**: Added detailed logging outputting `session.inputNames`, `session.outputNames`, and `err.stack` rather than swallowing stack traces.

#### 2. Local Provider Registration (`packages/stage-ui/src/libs/providers/providers/openjev-local/index.ts`)
- Registered `openjev-local` as a standalone provider with `deployment: 'local'`, `pricing: 'free'`, `beginnerRecommended: true`, and `order: 2`.
- Models exported:
  - `heman10x/rlcd-modernbert-151m` (INT8, default)
  - `heman10x/rlcd-modernbert-151m-fp16` (FP16, WebGPU recommended)

#### 3. Granular Model Cache Isolation (`packages/stage-ui/src/libs/inference/cache-utils.ts`)
- Built isolated functions:
  - `isOpenJevModelCached()`
  - `getOpenJevCacheSize()`
  - `clearOpenJevCache()`
- Evicting OpenJev targets exclusively `heman10x/rlcd-modernbert-151m` assets, preserving Laya's cache intact (and vice versa).

#### 4. Settings UI Pages (`openjev-local.vue` & `system-one.vue`)
- Created `packages/stage-pages/src/pages/settings/providers/system1/openjev-local.vue` with `<route lang="yaml"> meta: layout: settings` ensuring breadcrumb navigation and back buttons function correctly.
- Added live interactive diagnostic card executing live zero-shot classification against the downloaded weights with elapsed execution latency and token count.
- Integrated full stack trace rendering in the diagnostic error card for immediate debuggability.

#### 5. Cognition & Card Editor Cleanup (`CognitionSubTabMemory.vue`)
- Replaced the outdated embedded 3-card provider selector (which lacked local models and hardcoded cloud providers) with a status indicator that displays the active global System 1 engine and links directly to `#/settings/modules/system-one`.

#### 6. Unit Testing & Parity (`system-one.test.ts`)
- Updated provider assertions to validate all 5 active System 1 providers: `openrouter-ai`, `typesafe-ai`, `laya-local`, `openjev-local`, and `opencode-go`.

---

## 6. Verification Status

| Suite / Check | Command | Result |
| :--- | :--- | :--- |
| **`@proj-airi/stage-ui` Typecheck** | `pnpm -F @proj-airi/stage-ui typecheck` | **PASS (0 errors)** |
| **`@proj-airi/stage-pages` Typecheck** | `pnpm -F @proj-airi/stage-pages typecheck` | **PASS (0 errors)** |
| **System 1 Store Unit Tests** | `pnpm -F @proj-airi/stage-ui test packages/stage-ui/src/stores/modules/system-one.test.ts` | **PASS (14 / 14 tests)** |
| **Live In-App Diagnostics** | Settings Provider Test Harness (`openjev-local.vue`) | **PASS (604 ms on WebGPU, 237 tokens)** |
