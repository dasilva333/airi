# Design: Browser-Native Semantic Search

This document outlines research and proposed architectures for implementing local, privacy-preserving semantic search within the AIRI ecosystem (Web and Electron) using modern browser technologies.

---

## 1. Overview

Semantic search moves beyond simple keyword matching by understanding the **context and meaning** of text. In the context of AIRI, this enables "Long-Term Memory" retrieval that can find relevant past interactions even if the exact words don't match.

### The Two-Pillar Architecture
1.  **Embedding Pipeline**: Converts text (journals, chat logs) into high-dimensional numerical vectors.
2.  **Vector Indexing & Retrieval**: Stores these vectors and performs efficient "Approximate Nearest Neighbor" (ANN) searches to find the most "similar" text to a user's query.

---

## 2. Technology Options for Web/JS

### A. Embedding Generation (The "Encoder")

| Tool | Approach | Pros | Cons |
|:---|:---|:---|:---|
| **[Transformers.js](https://github.com/xenova/transformers.js)** | WASM/WebGPU | Industry standard; supports `all-MiniLM-L6-v2` (tiny/fast); running 100% locally. | Model download size (~40MB-100MB); high initial load time. |
| **Native API (Future)** | [WebNN](https://webmachinelearning.github.io/webnn/) | Near-native performance; potentially zero-download if OS-integrated. | Experimental/Draft; patchy browser support. |

### B. Vector Search & Indexing (The "Database")

| Tool | Approach | Best For | Pros |
|:---|:---|:---|:---|
| **[Voy](https://github.com/tantara/voy)** | WASM (Rust) | Performance-first | Extremely fast HNSW implementation; tiny (<100KB); very memory efficient. |
| **[Orama](https://oramasearch.com/)** | Pure JS | All-in-one | Supports **Hybrid Search** (Keyword + Semantic) out of the box; excellent developer experience. |
| **[hnswlib-js](https://github.com/yoshoku/hnswlib-js)** | WASM (C++) | Low-level control | Direct port of the gold-standard HNSWLib; very mature algorithm. |

---

## 3. Proposed Pipeline for AIRI

Given AIRI's focus on character-scoped memories and privacy, a **fully local pipeline** is recommended.

### Phase 1: Ingestion (Background)
1.  **Chunking**: Split long journals or chat history into semantic chunks (e.g., 512 characters with 50-character overlap).
2.  **Embedding**: Run chunks through `Transformers.js` (using `feature-extraction` pipeline) in a **dedicated Web Worker** to avoid blocking the UI thread.
3.  **Persistence**: Save the raw vectors in **IndexedDB**.

### Phase 2: Indexing
- On app load, hydrate a **Voy** or **Orama** index from the vectors stored in IndexedDB.
- For small datasets (<10k sentences), Orama is preferred for its ease of use and hybrid capabilities.
- For very large journals, Voy provides better search latency.

### Phase 3: Retrieval (Inference)
1.  User asks a question or AIRI's "Mind" triggers a recall check.
2.  The query is embedded using the same `Transformers.js` model.
3.  The index (Voy/Orama) performs an ANN search and returns the top $k$ relevant text chunks.
4.  These chunks are injected into the LLM context as "Relevant Past Memories."

---

## 4. Technical Feasibility & Constraints

-   **Memory Usage**: Storing thousands of 384-dimensional vectors (standard for MiniLM) is trivial (~1.5KB per vector).
-   **Performance**: On modern machines, a vector search across 10,000 items takes **<5ms** in the browser.
-   **Storage**: IndexedDB handles the overhead well. The primary constraint is the **initial model download** for `Transformers.js`, which should be cached aggressively using the Cache API.

---

## 5. Integration Notes

- **Electron Advantages**: In the `@proj-airi/stage-tamagotchi` context, we can leverage even faster libraries if we moved indexing to a Node.js sidecar, but keeping it in the renderer ensures the **Web version** (`@proj-airi/stage-web`) shares the same features.
- **Privacy**: No vectors or text are sent to a third-party server (unlike using Pinecone or OpenAI Embeddings), aligning with AIRI's "Local First" philosophy.

## Relevant Skills

- [[airi-memory-retrieval-engine]]
