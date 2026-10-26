# Proposal: Persistent Recurrent State Memory via MemT 1.0 (Alternative & Synergy with RWKV State Cartridges)

> **Status**: Proposed RFC
> **Document**: `docs/proposal-memt-recurrent-state-memory.md`
> **Target Audience**: Core AI Researchers, Memory Architecture Engineers, Local Runtime Contributors
> **Key References**:
> - [`docs/design-rwkv-persona-foundry-and-state-cartridges.md`](docs/design-rwkv-persona-foundry-and-state-cartridges.md) — RWKV Persona Foundry & Character State Cartridges
> - [`docs/proposal-built-in-llm-webgpu.md`](docs/proposal-built-in-llm-webgpu.md) — Built-in WebGPU RWKV architecture
> - [`docs/content/en/docs/chronicles/roadmap.md`](docs/content/en/docs/chronicles/roadmap.md) — System Layer §2 & §3 (Local Runtimes & Cognitive Pipeline)
> - [`docs/rosetta-stone.md`](docs/rosetta-stone.md) §9 — AIRI Memory Systems (Eight Pillars)

---

## 🧭 1. Executive Summary & Architectural Context

### 1.1 The Context Window Paradox in Long-Term Companions
In traditional transformer architectures (Claude, GPT-4, Llama 3, Qwen 2.5), conversational continuity is maintained through **context stuffing**: every conversational turn re-injects system prompts, character sheets, episodic summaries, and recent turns into the prompt window.

As documented in [`docs/design-rwkv-persona-foundry-and-state-cartridges.md`](docs/design-rwkv-persona-foundry-and-state-cartridges.md) §1.1, this approach has severe failure modes:
1. **Self-Attention Dilution & Identity Drift**: As context expands, quadratic self-attention spreads weights across thousands of tokens, diluting persona instructions and character voice.
2. **Prompt Tax & Prefill Latency**: Reprocessing thousands of tokens on every turn wastes unified memory bandwidth and introduces high Time-to-First-Token (TTFT) latency.
3. **KV Cache Explosion**: Storing multi-turn KV caches quickly exhausts unified RAM on client devices.

### 1.2 Two Paradigms of State-Based Memory
To solve this, modern non-transformer and hybrid architectures move conversational memory into **internal recurrent states**:
1. **RWKV-7 Linear RNN State Cartridges ($h_0$)**: Captures persona, tone, and syntactic brevity into a static 10–15 MB recurrent state tensor derived from golden dialogue exemplars via forward-pass state freezing.
2. **MemT 1.0 (MEM Tensor)**: An open model architecture trained explicitly to absorb, update, and recall conversational facts inside a **compact internal memory state**, allowing raw conversational context to be discarded while retaining persistent factual memory across turns.

---

## 🔬 2. Deep Dive: MemT 1.0 vs. RWKV-7 In-Situ State Priming

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                   PERSISTENT RECURRENT MEMORY PARADIGMS COMPARISON                     │
├──────────────────────────┬─────────────────────────────┬───────────────────────────────┤
│ Architectural Dimension  │ RWKV-7 State Cartridge ($h_0$)│ MemT 1.0 Recurrent Memory   │
├──────────────────────────┼─────────────────────────────┼───────────────────────────────┤
│ Foundation               │ Linear Attention RNN (Goose)│ Recurrent Transformer / State │
│ State Representation     │ Float tensor $h \in \mathbb{R}^{d}$│ Compact internal memory state │
│ In-Situ Update Mechanism │ Forward-pass hidden state   │ Explicit memory update        │
│                          │ snapshotting / priming      │ learning objectives           │
│ Footprint & Hardware     │ 0.1B–1.5B–5B (WebGPU ready) │ 3B active Nano (~70 GB dl)    │
│                          │ ~12–15 MB .state file       │ 17B/288B MoE Flash (~576 GB dl)│
│ Primary Specialization   │ Zero-shot persona, style,   │ Persistent factual recall     │
│                          │ syntactic brevity, low VRAM │ across cleared context windows│
│ Runtime Deployment       │ In-browser Web Worker       │ High-end desktop / Workstation│
└──────────────────────────┴─────────────────────────────┴───────────────────────────────┘
```

### 2.1 How RWKV-7 In-Situ State Priming Operates
In RWKV-7, the network recurrence is governed by:
$$\mathbf{wkv}_{t} = \alpha_t \mathbf{wkv}_{t-1} + \mathbf{v}_t \mathbf{k}_t^T$$

To build a **Character State Cartridge**, AIRI runs a forward pass through a curated persona conversation. The final hidden state vector $h_{\text{final}}$ is serialized to a `.state` file. On subsequent sessions:
* $h_0$ is initialized directly with the cartridge.
* The model speaks immediately in-character with zero prompt prefill tokens.
* However, updating this state during continuous live conversation requires either periodic state checkpoints or re-priming.

### 2.2 How MemT 1.0 Approaches Persistent Recall
MemT 1.0 treats the internal state not only as a static persona anchor, but as an **active, updateable factual store**:
* **Dynamic Fact Ingestion**: When the user provides new biographical facts (e.g. "I have a kitten named Mei who is 3 months old and loves shrimp"), the model writes these representations into its internal memory state tensor.
* **Context Purging**: The conversation history can be cleared entirely from the context buffer.
* **Stateful Querying**: When subsequent prompts query the fact ("What was my cat's name?"), MemT decodes the information directly from its internal state without requiring the original dialogue tokens in the prompt.
* **Benchmark Provenance**: MemT demonstrates top-tier retention on persistent AI memory benchmarks, proving that a model can retain structured factual grounding without a quadratic KV cache.

---

## 💡 3. Architectural Synergies with AIRI's Eight Pillars

MemT's architecture provides valuable design lessons for AIRI's memory hierarchy:

```
[ Active User Turn ]
         │
         ├──► [ System 1: Echo-Chips & Salience Gate (RWKV 0.1B WebGPU) ]
         │       └─ Detects emotional & factual milestones
         │
         ├──► [ STMM / LTMM: Daily Summaries & Sacred Journal ]
         │       └─ IndexedDB persistent text records
         │
         ├──► [ RWKV-7 State Cartridge ($h_0$) ]
         │       └─ Maintains Character Persona & Voice (Static / Semi-Static)
         │
         └──► [ MemT-Inspired Dynamic State Accumulator ]
                 └─ Compresses session turns into an episodic latent state vector
```

1. **Episodic State Compression**: Rather than compressing history solely into natural language summaries (STMM daily blocks and Lifetime Eternal Thread text), AIRI can explore hybridizing text records with **episodic state vectors** that can be injected directly into local recurrent models.
2. **Workstation Brain Tier**: While RWKV-7 (1.5B/5B) remains the primary in-browser WebGPU starter brain, MemT Nano (3B active) represents a compelling option for high-end Electron desktop users seeking multi-session memory with zero prompt overhead.

---

## 📅 4. Roadmap & Research Plan

- [ ] **Phase 1: Hugging Face Weights & Benchmark Evaluation**:
  - Download and evaluate MemT 1.0 Nano locally on Apple Silicon / CUDA workstation.
  - Test factual retention across 10+ cleared context cycles using personal AIRI test fixtures.
- [ ] **Phase 2: Recurrent State Serialization Study**:
  - Compare MemT's internal state compression efficiency against RWKV-7 forward-pass state extraction (`scripts/tests/rwkv-harness/`).
- [ ] **Phase 3: Integration into Local Runtimes Catalog**:
  - If quantized 4-bit/8-bit checkpoints become viable on consumer GPUs (<16 GB VRAM), draft a provider adapter under `packages/stage-ui/src/stores/providers/memt/`.
