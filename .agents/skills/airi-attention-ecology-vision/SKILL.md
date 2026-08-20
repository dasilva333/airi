---
name: airi-attention-ecology-vision
description: >-
  Use when configuring, maintaining, or debugging continuous 24/7 background vision perception, Cascaded Salience Gate (pHash → CLIP vision embedding → WASM OCR / RWKV-7 gate → VLM forwarder), privacy app exclusion filters, or Vibe Island integration.
---

# AIRI Attention Ecology & Vision Perception

This skill provides comprehensive technical guidelines and exact code paths for AIRI's continuous background vision perception architecture, Cascaded Salience Gate, and privacy exclusion filters.

## 1. Overview & Surface Map

The Attention Ecology Vision engine provides non-intrusive 24/7 visual awareness for AI characters:
- **Cascaded Salience Gate**: 4-stage filter pipeline designed to minimize VLM API costs:
  - *Stage 0 (pHash)*: Fast perceptual hash check for desktop screen changes.
  - *Stage 1 (CLIP Embedding)*: Micro vision embedding & novelty scoring.
  - *Stage 2 (WASM OCR / RWKV-7)*: Subconscious OCR and local text salience filtering.
  - *Stage 3 (VLM Forwarder)*: High-level vision-language model context injection.
- **Privacy Exclusion Filters**: Excludes password managers, banking apps, and private browser windows from screen capture.
- **Vibe Island Integration**: Ambient desktop status indicator.

## 2. Key Code Paths

### Core Vision Store & Orchestrator
- `packages/stage-ui/src/stores/modules/vision/orchestrator.ts` — `visionOrchestrator`. Manages background screen snapshot intervals, salience gate triage, and privacy app filtering.
- `packages/stage-ui/src/stores/modules/vision.ts` — `visionStore`. Pinia store for active VLM provider configuration and image attachment handling.

### DevTools Surface
- `apps/stage-tamagotchi/src/renderer/pages/devtools/vision.vue` — Vision DevTools inspection panel for testing screen captures, pHash deltas, and CLIP embeddings.

### Related Specs & RFCs
- `docs/proposal-attention-ecology-local-webgpu-guard.md` — Specification document for the Attention Ecology local WebGPU salience guard.
- `docs/proposal-vision-witness.md` — Vision witness implementation plan and salience scoring harness.
- `docs/proposal-poc-attention-ecology-vibe-island.md` — Vibe Island proof-of-concept design specification.
- `docs/proposal-wd14tagged-models.md` — WD14 tagger auto-indexing of local model previews into semantic search (Model Selector).

## 3. Core SOPs & Guidelines

### 1. Configuring Privacy App Exclusion Filters
1. Define excluded window process names (e.g., 1Password, Bitwarden, private browser windows) in `orchestrator.ts`.
2. Check `active-win` window metadata before triggering Stage 0 screen capture. If an excluded application is active, skip snapshot.

### 2. Tuning Salience Thresholds
- Adjust pHash threshold and CLIP cosine similarity threshold in `orchestrator.ts` to balance visual sensitivity vs API cost.

## 4. Known Pitfalls & Failure Modes

- **Unbound Canvas Snapshot Leaks**: Capturing 4K screen snapshots directly into HTML5 canvas objects without calling `.width = 0; .height = 0` creates DOM memory leaks. Always dispose temporary canvas elements.
- **VLM API Cost Explosion**: Bypassing the Stage 0/1/2 salience gates and forwarding every 2-second screen frame to cloud VLMs will consume thousands of API tokens per minute. Always enforce the gate pipeline.

## 5. Verification Workflows

- **Typecheck**: `pnpm -F @proj-airi/stage-ui typecheck`
- **DevTools Inspection**: Open `/devtools/vision` in app settings to inspect live screen capture frames and salience scores.

### Authoritative Design & Architecture Documents

- [docs/proposal-attention-ecology-local-webgpu-guard.md](docs/proposal-attention-ecology-local-webgpu-guard.md) — Attention ecology local WebGPU salience guard spec.
- [docs/proposal-vision-witness.md](docs/proposal-vision-witness.md) — Vision witness implementation plan and salience scoring harness.
- [docs/proposal-poc-attention-ecology-vibe-island.md](docs/proposal-poc-attention-ecology-vibe-island.md) — Vibe Island proof-of-concept design.
- [docs/design-vision-system-support.md](docs/design-vision-system-support.md) — Vision system support design.
- [docs/design-vision-system-support.md](docs/design-vision-system-support.md) — Vision system support (localized architecture copy).
- [docs/design-vision-api-cost-analysis.md](docs/design-vision-api-cost-analysis.md) — Vision API cost analysis.
- [docs/research-vision-witness-report.md](docs/research-vision-witness-report.md) — Vision witness research report.
- [docs/project-vision-architecture-review-alpha22.md](docs/project-vision-architecture-review-alpha22.md) — Vision architecture review alpha22.
- [docs/proposal-salience-gate-ui-integration.md](docs/proposal-salience-gate-ui-integration.md) — Salience gate UI integration proposal.
- [docs/proposal-vlm-forward-to-llm.md](docs/proposal-vlm-forward-to-llm.md) — VLM forward-to-LLM proposal.
- [docs/content/en/docs/showcase/08-situational-awareness.md](docs/content/en/docs/showcase/08-situational-awareness.md) — Situational awareness showcase.

## Related Skills & References

- **Key Documents**: [[proposal-attention-ecology-local-webgpu-guard]], [[proposal-vision-witness]], [[proposal-poc-attention-ecology-vibe-island]], [[proposal-wd14tagged-models]], [[design-vision-system-support]], [[design-vision-api-cost-analysis]], [[research-vision-witness-report]], [[project-vision-architecture-review-alpha22]], [[proposal-salience-gate-ui-integration]], [[proposal-vlm-forward-to-llm]], [[08-situational-awareness]]
