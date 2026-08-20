# Vision-Language Model (VLM) Costs (March 2026)

This document provides a cost comparison for various Vision models available to AIRI. Use this as a reference when selecting models for the **Vision Store**.

## 1. OpenAI (SaaS)
These models are reliable but carry a higher cost. They are best for complex reasoning and high-fidelity vision tasks.

| Model | Input (per 1M tokens) | Output (per 1M tokens) | Context Window | 1MP Image Cost (High Det) |
| :--- | :--- | :--- | :--- | :--- |
| **GPT-5 Mini** | $0.125 | $1.00 | 400k | **$0.00009** (765 tokens) |
| **GPT-4o-mini**| $0.15 | $0.60 | 128k | $0.00011 (765 tokens) |
| **GPT-5.4 Nano**| $0.20 | $1.25 | 400k | $0.00015 (765 tokens) |
| **GPT-4o** | $2.50 | $10.00 | 128k | $0.0019 (765 tokens) |

## 2. Mistral & Google Gemma (Paid/Instruct)
These are powerful open-weight or instructor models available via APIs or local inference.

| Model | Input (per 1M tokens) | Output (per 1M tokens) | 1MP Image Cost (Approx) |
| :--- | :--- | :--- | :--- |
| **Mistral Small 4** | $0.15 | $0.15 | **$0.0002** (~1340 tokens) |
| **Gemma 3 4B-it** | $0.04 | $0.08 | $0.00005 (~1340 tokens) |

> [!NOTE]
> **1MP Image Definition**: 1024x1024 pixels.
> - **OpenAI** tiling logic: (4 tiles * 170) + 85 = 765 tokens.
> - **Mistral** tiling logic: ~1340 tokens (approximation).
> - **Gemini 3 Pro**: Fixed **560 tokens** ($0.0007 per image).

## 3. OpenRouter Free Models (As of March 2026)
These models are currently free to use on OpenRouter, making them ideal for the AIRI MVP.

| Model | Context Window | Provider | Notes |
| :--- | :--- | :--- | :--- |
| **NVIDIA: Nemotron Nano 12B 2 VL** | 128k | NVIDIA | Hybrid Transformer-Mamba. Optimized for OCR, chart reasoning, and video. |
| **Mistral: Mistral Small 3.1 24B** | 128k | Mistral AI | **Warning**: Free period ends March 29, 2026. |
| **Google: Gemma 3 27B** | 131k | Google | Successor to Gemma 2. Highest param count in the free Gemma family. |
| **Google: Gemma 3 12B** | 33k | Google | Good balance of performance and context for simpler tasks. |
| **Google: Gemma 3 4B** | 33k | Google | Smallest and fastest of the Gemma 3 family. |

## Recommendation for Strategy B (MVP)
1. **Developer Choice**: **GPT-5 Mini** for its 400k context window and high reliability.
2. **User Budget Choice**: **Nemotron Nano 12B 2 VL** (Free/Open Weights) for its modern architecture and excellent performance-to-cost ratio.
3. **Emergency Fallback**: **Gemma 3 4B** for very small footprint and high speed.

## Relevant Skills

- [[airi-attention-ecology-vision]]
