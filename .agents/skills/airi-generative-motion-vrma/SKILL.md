---
name: airi-generative-motion-vrma
description: >-
  Use when developing, compiling, or debugging Text-to-VRMA generative motion pipelines, @pixiv/three-vrm-animation GLB keyframe compilation in the browser, Mixamo-to-VRM bone retargeting maps, or <|ACT:motion="..."|> kinetic cues.
---

# AIRI Generative Motion & Text-to-VRMA Engine

This skill provides comprehensive technical guidelines and exact code paths for AIRI's Text-to-VRMA generative motion pipeline, browser-based GLB keyframe compilation, and skeletal bone retargeting.

## 1. Overview & Surface Map

The Generative Motion engine enables AI characters to generate and perform dynamic physical actions (e.g., *"do jumping jacks"*, *"wave hello"*) in real-time:
- **LLM Kinetic Cues**: LLMs output `<|ACT:motion="..."|>` tokens or call the `generate_motion` tool.
- **In-Browser VRMA Compilation**: Converts LLM keyframe JSON into `.vrma` binary GLB buffers using `@pixiv/three-vrm-animation`.
- **Skeletal Retargeting**: Maps bone rotations (Mixamo / Humanoid standard) to active VRM avatar bones with safety clamping.

## 2. Key Code Paths

### Core Rendering & Animation Code
- `packages/stage-ui-three/src/components/Model/VRMModel.vue` — Mounts VRMA mixers, manages cross-fading between idle loops and kinetic action poses.
- `packages/stage-ui-three/src/stores/custom-vrm-animations.ts` — Store for user custom `.vrma` binary files cached in `localforage` (`custom-vrma-animation-{id}`).
- `packages/stage-ui/src/composables/llm-marker-parser.ts` — Parses `<|ACT:motion="..."|>` kinetic tokens from streaming LLM output.

### Related Specs & Design RFCs
- `docs/proposal-text-to-vrma-system.md` — Technical proposal for in-browser Text-to-VRMA keyframe compilation.
- `docs/design-text-to-motion.md` — Architecture design document for text-to-motion generation and skeletal safety bounds.

## 3. Core SOPs & Guidelines

### 1. Compiling VRMA Keyframes in Browser
1. Construct keyframe Euler angle rotations for humanoid bones (`hips`, `spine`, `chest`, `upperArm`, `lowerArm`, `hand`, `thigh`, `shin`).
2. Convert Euler angles to quaternions.
3. Build the GLB binary buffer using `@pixiv/three-vrm-animation` GLTF exporter.
4. Load into Three.js `AnimationMixer` on the target VRM model.

### 2. Clamping Joint Safety Bounds
- Clamp joint rotations to anatomical limits (e.g., elbow flex 0°–145°, knee flex 0°–140°) to prevent unnatural skeletal distortion.

## 4. Known Pitfalls & Failure Modes

- **Gimbal Lock & Quaternion Inversion**: Never interpolate raw Euler angles directly across 180° boundaries. Always convert to normalized `Quaternion.slerp()` for smooth bone interpolation.
- **VRM 0.0 vs 1.0 Bone Naming Mismatches**: VRM 0.0 uses legacy bone names (`J_Bip_C_Hips`), while VRM 1.0 uses humanoid standard (`hips`). Retargeting maps must normalize bone names before animation binding.

## 5. Verification Workflows

- **Typecheck**: `pnpm -F @proj-airi/stage-ui-three typecheck`
- **Sandbox Test**: Test VRMA animation loading in devtools Rehearsal Room sandbox (`apps/stage-tamagotchi/src/renderer/pages/devtools/`).
