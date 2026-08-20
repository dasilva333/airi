---
title: Custom 3D & 2D Avatars
description: Guide to loading VRM, Live2D, Spine, and MMD models, customizing expressions and idle animations, and tuning rendering performance.
---

# Custom 3D & 2D Avatars

Project AIRI supports multiple avatar rendering engines, allowing you to bring virtually any 3D or 2D character model to life on your desktop.

---

## 1. Supported Model Formats

| Format | Technology | Dimensions | Best For |
| :--- | :--- | :--- | :--- |
| **VRM (.vrm)** | Three.js / WebGL / WebGPU | 3D | Full 3D avatars with spring-bone physics, dynamic lighting, customizable outfits, and rich VRMA animation support. |
| **Live2D (.model3.json)** | PixiJS / Cubism Core WASM | 2.5D | High-fidelity layered 2D anime art with fluid breathing, eye tracking, and expressiveness. |
| **Spine (.skel / .json)** | PixiJS Spine Runtime | 2D | Game sprites, chibi characters, and stylized 2D animations. |
| **MMD (.pmx)** | Three.js MMDLoader | 3D | MikuMikuDance community models and legacy 3D assets. |

---

## 2. Importing a Custom Model

1. Open **Settings &rarr; Character &rarr; Vessel / Display Model**.
2. Click **"Import Model"** or drag-and-drop your model files directly into the window:
   - For **VRM**: Select your `.vrm` file.
   - For **Live2D**: Select the entire model folder or a `.zip` archive containing the `.model3.json` file, textures, and motion files.
   - For **Spine**: Select the `.skel` / `.json`, `.atlas`, and `.png` sprite sheet files together.
3. AIRI will load the model into the stage preview and automatically extract all embedded blendshapes, motion tracks, and textures.

---

## 3. Customizing Expressions & Animations (Model Customizer)

Once your model is loaded, click the **"Customize Model"** button to open the embedded capability editor:

- **Expression Mapping**: Map model blendshapes (e.g., `Joy`, `Angry`, `Sorrow`, `Surprised`, `Blink`) to AIRI's standard emotion vocabulary. This ensures that when AIRI emits an `<|ACT:emotion="happy"|>` token, your custom model smiles naturally.
- **Default Idle Animation**: Choose which `.vrma` motion or resting posture the avatar adopts when waiting.
- **Random Motion Cycles**: Enable motion cycling to let your avatar occasionally shift weight, stretch, or glance around naturally during downtime.
- **Costumes & Outfits**: For VRM models with multi-mesh wardrobes or Live2D models with multiple costume layers, toggle individual parts on or off to create custom outfits.

---

## 4. The Rehearsal Room

To test how your model responds to acting cues:
1. Open the **Rehearsal Room** in Studio.
2. Click any emotion, gesture, or speech prompt button.
3. Watch the avatar perform the blendshape transitions and animations in real time with zero LLM API cost.

---

## 5. Performance Tuning & Optimization

If you are running AIRI alongside demanding PC games or on lower-spec hardware:

- **Target Framerate**: In **Settings &rarr; Appearance & Stage**, cap the renderer to **30 FPS** or **60 FPS** to reduce GPU load.
- **WASM Memory Optimization**: For Live2D models, enable **Texture Subsampling** in Stage settings to lower VRAM usage.
- **Physics Quality**: For VRM models, adjust **Spring Bone Substeps** to balance hair/cloth physics fidelity against CPU usage.
