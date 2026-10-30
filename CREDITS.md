# Third-Party Asset Attributions & Credits

This document acknowledges third-party assets, models, and community animations utilized within AIRI.

---

## 3D Avatar Animations (.vrma)

The pre-bundled VRM animation library in `packages/stage-ui-three/src/assets/vrm/animations/` includes:

### 1. Pixiv VRoid Hub & VRM Consortium Samples
- **Assets**: `idle_loop.vrma`, `peace_sign.vrma`, `sitting_to_wave.vrma`, `agent_007.vrma`, `confident_pose.vrma`, `grandstand.vrma`, `arms_swing.vrma`.
- **Source**: Pixiv Inc. / VRM Consortium sample releases.
- **Tools**: Exported via UniGLTF and `THREE.GLTFExporter`.
- **License**: Permissive sample distribution for VRM avatar presentation.

### 2. BOOTH Community Motions
- **Assets**: `bling_bang.vrma`, `hito_mania.vrma`, `crab_dance.vrma`, `kawaii_kaiwai.vrma`, `arms_up_down_dance.vrma`, `ai_cat_dance.vrma`, `tetris.vrma`, `magic_eye_wink.vrma`, `flamboyant.vrma`, `innocent.vrma`, `shy.vrma`, `cool.vrma`, `energetic.vrma`, `powerful.vrma`, `ladylake.vrma`, `humans_are_just_cylinders.vrma`, `showcase.vrma`.
- **Source**: Free downloadable 3D animations and dance motions published by community creators on [BOOTH](https://booth.pm/).
- **Attribution & Usage**: All rights, motion choreography, and original asset data belong to their respective creators. These assets are bundled for free, non-commercial interactive avatar presentation in accordance with community guidelines. Commercial re-distribution or separate resale of raw animation files is strictly prohibited.

### 3. Procedural & On-Device Generative Motions
- **Pipeline**: Procedural keyframe synthesis and FlowMDM neural diffusion (`packages/stage-ui/src/utils/flowmdm/`).
- **Lineage**: Generated directly on-device using AIRI's integrated Text-to-Motion compiler and distilled FlowMDM checkpoints (`dasilva333/flowmdm-onnx`).

---

## Core Avatar Runtimes

- **`@pixiv/three-vrm` & `@pixiv/three-vrm-animation`**: Copyright (c) Pixiv Inc., MIT License.
- **Three.js**: Copyright (c) 2010-2026 Three.js authors, MIT License.
- **PixiJS & `pixi-live2d-display`**: Copyright (c) PixiJS team / guansss, MIT License.
- **Live2D Cubism Core**: Proprietary runtime under the Live2D Open Software License.
