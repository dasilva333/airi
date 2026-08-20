# Blueprint: Cognitive Memory & Semantic Search (AIRI)

This blueprint outlines the path to migrating AIRI's memory system from simple keyword matching to a **Cognitive Memory Architecture**. This strategy, inspired by the **[Plast Mem](https://github.com/moeru-ai/plast-mem)** project (kudos to the `moeru-ai` team), moves beyond static search toward a human-like model of forgetting, segmentation, and fact-extraction.

---

## 🏗️ 1. Architecture Overview: The "Human-Like" Brain

We shift from "Search all messages" to **"Manage Episodic, Semantic & Emotional Experiences."**

1.  **Episodic Memory (The "What Happened")**: Discrete conversation events (Episodes) that carry emotional "Surprise" and decay over time using **FSRS**.
2.  **Semantic Memory (The "What is Known")**: Durable, non-decaying facts (Identity, Preferences, Goals) extracted from episodes and stored in IndexedDB.
3.  **Emotional Emission (The "How I Feel")**: During memory consolidation, the system emits "Emotional Deltas" (Mood shifts) based on interaction valence. This feeds the **Character Core** without requiring a second inference pass.

---

## ⚖️ 2. The Philosophy: Hybrid Intelligence

While projects like **Plast Mem** utilize standalone processes to run local 8B models, AIRI utilizes a **Hybrid Intelligence** architecture. We split the workload to achieve "Hyperscale" reasoning while maintaining a zero-install, browser-native storage runtime.

| Layer | Technology | Result |
| :--- | :--- | :--- |
| **Reasoning (Extraction/PCL)** | **Configured User LLM** (Gemini/OpenAI/Anthropic) | Triple/Quad-digit parameter intelligence. |
| **Embedding Vectorization** | **Local Web Worker** (e.g., `qwen3-embedding:0.6b` via Transformers.js) | Zero API cost, instant index generation. |
| **Search (BM25 + Vector RRF)** | **Orama / IndexedDB** | Fast, private, browser-native storage. |
| **Mood Extraction** | **Side-Effect of Reasoning** | Vibe is emitted during the LLM extraction pass. |

---

## 🎭 3. The Tamagotchi Heart: Emotional Awareness

While semantic facts represent what AIRI *knows*, the Mood System represents how she *experiences* the world. Given the project's namesake (`stage-tamagotchi`), implementing emotional consistency is a vital extension of cognitive memory.

### The "Exhaust" Pattern
We treat emotional data as the "exhaust" of the memory engine.
1. When the **Cognitive Worker** summarizes an episode, it extracts `Facts`.
2. In the same prompt/pass, it returns a `SentimentDelta` (e.g., `valence: +0.2`).
3. This delta is emitted to the UI, bypassing the need for a dedicated "Emotion Model."

### Mood Mapping
We track 6 core emotional baselines that correspond to standard VRM expressions:
- **`Neutral`** (Baseline)
- **`Happy`** (Positive Valence, High Arousal)
- **`Sad`** (Negative Valence, Low Arousal)
- **`Angry`** (Negative Valence, High Arousal)
- **`Surprised`** (High Surprise, High Arousal)
- **`Relaxed/Relaxed`** (Positive Valence, Low Arousal)

---

## 🛠️ 4. Strategy: The "Cherry Picks" from Plast Mem

We adapt the best elements of cognitive science while maintaining AIRI's browser-native performance.

### 🧩 A. Event Segmentation (Episodes)
Instead of searching across individual message strings, AIRI groups messages into **Episodes** based on topic shifts, time gaps, or message density.
-   **Benefit**: Searching a single "Episode Summary" provides the LLM with much cleaner context than five disjointed "Message Chunks."

### 🧠 B. FSRS Decay Modeling
We use the **Free Spaced Repetition Scheduler (FSRS)** to determine if a memory should be remembered or forgotten.
-   **Surprise-based Initialization**: High-entropy events (new info, emotional shifts) receive a "Stability Boost" in FSRS, making them stay in "hot" retrieval longer.
-   **Retrievability**: During rank-fusion, we multiply semantic relevance by `FSRS Retrievability`. If a memory is "forgotten," it's archived but doesn't clutter the active context.

### 💎 C. Semantic Consolidation (The PCL Pattern)
An offline background process (Web Worker) performs **Predict-Calibrate Learning (PCL)** to reconcile new information with the agent's current knowledge baseline.

---

## 🧠 5. Logic: Predict-Calibrate Learning (PCL)

To solve the **Contradiction Problem** (e.g., "I like tea" → "I hate tea now"), we use a two-pass "Contrast" strategy.

> [!NOTE]
> **Technical Reference**: This pattern is based on the logic implemented in Plast Mem's **[`predict_calibrate.rs`](https://github.com/moeru-ai/plast-mem/blob/main/crates/worker/src/jobs/predict_calibrate.rs)**.

### 1. The PREDICT Phase
When a new episode is summarized, the agent first **predicts** what the conversation *should* contain based on its existing semantic facts. This creates a "Baseline Expectation."

### 2. The CALIBRATE Phase
The agent compares the **Actual Messages** against its **Prediction**. The "Gaps" between the two drive one of four **Atomic Actions**:

| Action | Logic | Outcome |
| :--- | :--- | :--- |
| **`new`** | Reality contains facts not in the prediction. | Create a new Semantic Fact. |
| **`reinforce`** | Reality confirms the prediction. | Strengthen fact confidence & provenance. |
| **`update`** | Reality **contradicts** the prediction. | Replace old fact with a new, accurate one. |
| **`invalidate`** | Reality proves the prediction is now false. | Tombstone the existing fact. |

---

## ⚙️ 6. Reliable Execution: The "Apalis" Equivalent

The author of Plast Mem leverages **[Apalis](https://github.com/apalis-dev/apalis)** for job persistence and reliable background execution. In AIRI's browser-native environment, we implement a functional equivalent using standard Web APIs and IndexedDB:

### The "Apalis" Mapping for Web
| Feature | Apalis (Rust) | AIRI (Web/TypeScript) |
| :--- | :--- | :--- |
| **Job Storage** | Postgres / SQLite | **IndexedDB** (Persistent storage for pending consolidation tasks). |
| **Execution** | Multi-threaded Workers | **Web Workers** (`cognitive-worker.ts`) to prevent UI blocking. |
| **Scheduling** | `apalis-cron` | **`requestIdleCallback`** + Poll loop for pending DB entries. |
| **Reliability** | Built-in Retries | **State Tracking** (`pending` → `processing` → `done`/`failed`). |

---

## 🛠️ 7. Implementation Steps

### Phase 1: Infrastructure
Add the validated stack to `packages/stage-ui/package.json`:
-   `@xenova/transformers`: Neural inference (Embedding + Reranking).
-   `@orama/orama`: Hybrid search index.
-   `ts-fsrs`: FSRS algorithm implementation.

### Phase 2: The Cognitive Worker (Job Runner)
Create `packages/stage-ui/src/libs/workers/memory/cognitive-worker.ts`:
-   **Persistent Queue**: The worker monitors a "Job" store in IndexedDB.
-   **Execution Logic**: Dispatches the 2-pass PCL summary prompt to the **User's Configured LLM API**.
-   **Local Indexing**: Generates the vector embedding using `qwen3-embedding:0.6b` inside the worker via Transformers.js.

---

## 🧪 8. Nuances & UX Guards

> [!IMPORTANT]
> **Zero-Lag Background Processing**
> To match Apalis's reliability without the overhead of a server, we use **Tombstoning & Retries**. If a tab closes during consolidation, the `consolidated_at` flag remains `null`, allowing the next session to resume the task immediately.

> [!TIP]
> **Surprise-Driven Stability**
> We give episodes with high "surprise" (entropy) a stability boost in FSRS. If a user tells AIRI something life-changing, she should remember it forever; if it's just "Good morning," it should decay quickly.

---

## 📈 9. Benchmarks: The LoCoMo Target

To validate AIRI's memory quality, we benchmark against the **LoCoMo (Long-term Conversational Memory)** dataset.

By utilizing a **Hybrid Intelligence** approach (remote Hyperscale reasoning + local BM25/Vector RRF search), our performance ceiling changes drastically.

-   **Target Score**: **70%+ LoCoMo Score**.
-   **Why**: Since we use the configured API (e.g., Gemini 1.5 Pro, Claude 3.5), we bypass the limitations of a local 8B model. Our reasoning engine has hundreds of billions of parameters.
-   **Validation Axes**:
    -   **Multi-hop Reasoning**: Connecting facts across distant sessions (Hyperscale excels here).
    -   **Temporal Continuity**: Tracking when state changes occurred.

---

## 📈 10. Integration Points Summary

| File | Change |
| :--- | :--- |
| `packages/stage-ui/src/stores/memory-text-journal.ts` | Pivot to manage `Episodes` and `SemanticFacts`. |
| `packages/stage-ui/src/types/text-journal.ts` | Add FSRS fields and `unconsolidated` job status flag. |
| `packages/stage-ui/src/libs/search/` | Implement FSRS-Aware Rank Fusion. |
| `packages/stage-ui/package.json` | Add `ts-fsrs` and `transformers` dependencies. |

## Relevant Skills

- [[airi-memory-retrieval-engine]]
