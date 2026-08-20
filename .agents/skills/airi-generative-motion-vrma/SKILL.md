---
name: airi-generative-motion-vrma
description: >-
  Use when developing, compiling, or debugging Text-to-VRMA / Text-to-Motion generation: the dual-engine Motion Module (Procedural LLM Keyframes vs FlowMDM Local WebGPU Neural Diffusion), the Settings > Modules > Text to Motion engine-card selector, the Settings > Providers > Motion (FlowMDM) playground, the generate_motion built-in tool, in-browser VRMA compilation via @pixiv/three-vrm-animation, Mixamo/HumanML3D skeletal retargeting, or <|ACT:motion="..."|> kinetic cues. Also covers the scripts/motion-export Python ONNX export lineage.
---

# AIRI Generative Motion & Text-to-Motion Engine

Text-to-Motion is one of AIRI's flagship differentiators: an on-device, free, fully off-cloud pipeline that turns natural-language motion prompts ("do jumping jacks", "wave hello") into playable avatar animations entirely in the browser. This skill maps the dual-engine runtime, every user-facing surface, the WebGPU diffusion internals, and the offline Python export lineage that produced the shipped model.

## 1. Overview: The Dual Motion Engines

Two generation engines live behind one entry point — `useTextToMotionStore.generateMotion()` (`packages/stage-ui/src/stores/modules/text-to-motion.ts` :57-175):

| Engine | Mode id | Mechanism | Cost profile |
| :--- | :--- | :--- | :--- |
| **Procedural LLM Keyframes** (default) | `procedural` | LLM emits a structured `VRMAMotionSpec` JSON (validated by `VRMAMotionSpecSchema`), compiled to VRMA in-browser | Zero GPU memory; any chat model |
| **FlowMDM (Local WebGPU Diffusion)** | `flowmdm` | CLIP text encoding → 50-step DDIM denoise → 263-dim HumanML3D tensor → VRMA export | ~427 MB local models; needs WebGPU |

Mode is persisted in localStorage (`airi:text-to-motion:mode`, default `'procedural'`), so switching engines never costs a session.

### Key Source Files (Store + Engines)
- `packages/stage-ui/src/stores/modules/text-to-motion.ts` — **Central engine router**. `mode` storage, `isWebGPUSupported()`, `downloadProgress`, `generateMotion()` dispatcher, `downloadResultToDisk()`, `saveResultToLibrary()`.
- `packages/stage-ui/src/composables/llm-marker-parser.ts` — Parses `<|ACT:motion="..."|>` kinetic cues from streaming LLM output.
- Registered as a settings module via `packages/stage-ui/src/composables/use-modules-list.ts` (:95-99, id `text-to-motion`).

## 2. Engine A: Procedural LLM Keyframe Pipeline

1. Store calls `llmStore.generateObject<VRMAMotionSpec>()` with `VRMA_SYSTEM_PROMPT` + the zod `VRMAMotionSpecSchema` (up to 3 attempts) — decoupled from chat turns.
2. The active *consciousness* provider/model is used directly (`text-to-motion.ts` :140-141).
3. Spec (named keyframes: bone rotations/positions + expression presets) is compiled by `buildVRMA(spec)` (`packages/stage-ui/src/utils/vrmaBuilder.ts` :86), which hand-builds the glTF binary with the `VRMC_vrm_animation` extension using the hand-authored `SKELETON` bone map (:5-41), `BONE_NAMES` (:45), `HIPS_HEIGHT` (:43) and `EXPRESSION_PRESETS` (:52). Schema lives in `packages/stage-ui/src/utils/vrmaSchema.ts`.
4. No neural models involved — output is deterministic compilation, cheap and instant on any device.

## 3. Engine B: FlowMDM Local WebGPU Neural Diffusion

This is the cutting-edge path: a distilled `ZeyuLing/hftrainer-flowmdm-humanml3d` checkpoint exported to a self-contained 86.8 MB ONNX (`dasilva333/flowmdm-onnx`) running 100% inside the browser via ONNX Runtime (WebGPU EP first, WASM fallback).

### Live Runtime Stack (`packages/stage-ui/src/utils/flowmdm/`)
- `clipEncoder.ts` — CLIP text encoder (`Xenova/clip-vit-base-patch32` via Transformers.js) → 512-dim conditioning embedding.
- `ddimSolver.ts` — `getDenoisingSession()` loads `flow_mdm.onnx` (on-demand download, persisted in CacheStorage); `runDdimLoop()` (:47) runs the 50-step DDIM loop with linearly spaced timesteps 999→0 (:64-72), CFG pre-fused into the graph.
- `vrmaExporter.ts` — `exportFlowMDMToVRMA()` converts the 263-dim HumanML3D feature tensor into a VRMA binary container.
- `constants.ts` — baked HumanML3D normalization statistics (`hmlMean` / `hmlStd` arrays) needed to denormalize the model output.
- `math.ts` — shared quaternion / 6D-rotation helpers.

### Retargeting: HumanML3D → VRM
Maps the 21 HumanML3D body joints onto VRM standard humanoid bones, converting 6D rotation vectors to normalized quaternions and folding root yaw/planar velocity into translation keyframes (`docs/design-text-to-motion.md` §4.1). For non-HumanML3D sources, `packages/stage-ui/src/utils/vrmaBoneNames.ts` carries the Mixamo ↔ VRM remapping table.

## 4. The Three User-Facing Surfaces

### 4.1 Settings > Modules > Text to Motion (Engine Selector)
`packages/stage-pages/src/pages/settings/modules/text-to-motion.vue` — side-by-side mode cards:
- **Procedural LLM Acting (Default)** — badge "Lightweight"; zero GPU memory overhead.
- **FlowMDM (Local WebGPU Diffusion)** — badge "WebGPU 3D"; on-device text→motion tensor diffusion.
Clicking a card calls `setMode()`; the store default keeps procedural unless explicitly switched.

### 4.2 Settings > Providers > Motion (FlowMDM Playground)
`packages/stage-pages/src/pages/settings/providers/motion/flowmdm.vue` — the FlowMDM provider card + interactive playground:
- Prompts input, output-length and format selection, `downloadProgress` telemetry (CLIP encoder + denoiser download percentages surfaced live), and a status log.
- Actions: generate against the store, download the `.vrma`, or save to the custom animations library; also cross-links to the Modules page (:94 `to="/settings/modules/text-to-motion"`).

### 4.3 The `generate_motion` Built-in Tool
`apps/stage-tamagotchi/src/renderer/stores/tools/builtin/generate-motion.ts` — exported by `generateMotionTools()` (:116). The LLM invokes it during chat with a natural-language motion description; the handler resolves the active engine from the same store settings (:95-96), generates, then saves into the custom-animation library for playback. This is the live, production path (the "world's-first badge" leans on this).

## 5. Output Playback & Rehearsal

- `packages/stage-ui-three/src/stores/custom-vrm-animations.ts` — `useCustomVrmAnimationsStore.addCustomAnimation()/listCustomAnimations()`; `.vrma` binaries cached in `localforage` under `custom-vrma-animation-{id}`.
- `packages/stage-ui-three/src/components/Model/VRMModel.vue` — loads VRMAs with `@pixiv/three-vrm-animation` into the scene, cross-fades idle ↔ kinetic animations, and wires DIR action-name markdowns to expression presets.
- Motivation surfaces for playback: `packages/stage-ui/src/components/scenes/RendererStage.vue` (stage right-click → Custom Animations panel) and the desktop Rehearsal Room (`apps/stage-tamagotchi/src/renderer/components/chat/chat_rehearsal.vue` :209-241) which can run `generateMotion()` directly against the saved library — this is the true in-app test rig for motion work.

## 6. The Offline Lineage: `scripts/motion-export/`

The shipped `flow_mdm.onnx` was produced and verified by committed Python tooling in `scripts/motion-export/` — this is where any re-export, quantization sweep, or parity regression gets debugged:

- `scripts/motion-export/compile_onnx.py` — exports the PyTorch checkpoint (`ZeyuLing/hftrainer-flowmdm-humanml3d`) → self-contained `flow_mdm.onnx`. Carries three critical monkeypatches:
  1. **WebGPU Einsum int64/float32 fix** — patches `ScaledSinusoidalEmbedding` / `BPE_Rotary` to cast position arange tensors to `float32` (onnxruntime-web rejects mixed-type Einsum).
  2. **CFG graph fusion** — classifier-free guidance baked into the graph (`uncond + scale·(cond − uncond)`) so the browser issues one call per step.
  3. **In-memory weight inlining (CORS bypass)** — exports via `io.BytesIO()` so all weights land in one standalone ONNX file; PyTorch's default external `.data` files get blocked by browser sandbox (`MountedFiles` errors).
- `scripts/motion-export/inspect_sampler.py` — extracts `alphas_cumprod` + DDPM/DDIM variance coefficients → `diffusion_stats.json` (source of truth for `ddimSolver.ts` timestep math).
- `scripts/motion-export/test_onnx_parity.py` — PyTorch pipeline vs python-side `onnxruntime` 50-step DDIM numeric parity gate. Run this before publishing any re-export.

## 7. Known Pitfalls & Failure Modes

- **Gimbal Lock & Quaternion Wraps**: never interpolate raw Euler angles across 180° boundaries; convert to normalized `Quaternion.slerp()` before writing VRMA keyframes.
- **VRM 0.0 vs 1.0 bone naming**: 0.0 uses `J_Bip_C_Hips`, 1.0 uses humanoid-standard names; `vrmaBoneNames.ts` remap must be applied before animation binding or the mixer silently no-ops.
- **WebGPU unavailability**: `getDenoisingSession()` falls back with a WASM warning — DDIM in WASM is slow; expect tens of seconds not 2–3s. Check `navigator.gpu` before promising FlowMDM to the user.
- **Model bundling rule**: `flow_mdm.onnx` + CLIP weights are never shipped in installers; treat unfixed-bundle reminders as a correctness issue.
- **Procedural-path provider coupling**: the procedural engine uses the *active consciousness* provider/model, not a dedicated override (the design doc's §2.2 override dropdowns are unshipped); if the chat model can't do structured output, procedural motion fails.
- **HumanML3D denormalization**: `vrmaExporter.ts` must apply `hmlMean`/`hmlStd` from `constants.ts`; a skipped denorm produces near-zero poses ("frozen T-pose").

## 8. Cross-Citations (Pull Before Broad Changes)

- `docs/design-text-to-motion.md` — **canonical, current architecture doc**. Supersedes the founding proposal. Covers dual engine, provider/module/settings integration, three-tier roadmap (FlowMDM core → TMR-SOMA retrieval cache → Kimodo next-gen), ONNX export workarounds, and multi-format decoders (VRMA / VMD / Live2D motion.json).
- `docs/proposal-text-to-vrma-system.md` — original Text-to-VRMA founding proposal (historic reference for the procedural/keyframe lineage).
- `docs/text-to-motion.md` — academic research survey.
- `docs/mocap.md` — mocap companion reference.
- `docs/design-vrm-animation-ecosystem.md` — broader VRM animation ecosystem design.
- `docs/proposal-emotion-motion-library.md` — emotion-motion library proposal.
- `.agents/skills/airi-tool-registry-builtin-tools/` — `generate_motion` registry entry & availability matrix.
- `.agents/skills/airi-character-rendering/` — VRM model mounting & expression pipeline.

## 9. Verification Workflows

- **Typecheck**: `pnpm -F @proj-airi/stage-ui typecheck` (store + flowmdm utils) and `pnpm -F @proj-airi/stage-ui-three typecheck` (playback side).
- **Sandbox test**: use the desktop Rehearsal Room (`chat_rehearsal.vue`) to call `generateMotion()` end-to-end and watch the saved `.vrma` land in `useCustomVrmAnimationsStore`.
- **Re-export parity gate**: `python scripts/motion-export/test_onnx_parity.py` must pass before any `flow_mdm.onnx` replacement is published.

## Related Skills & References

- **Peer Skills**: [[airi-character-rendering]], [[airi-tool-registry-builtin-tools]]
- **Key Documents**: [[design-text-to-motion]], [[proposal-text-to-vrma-system]], [[text-to-motion]], [[mocap]], [[design-vrm-animation-ecosystem]], [[proposal-emotion-motion-library]]
