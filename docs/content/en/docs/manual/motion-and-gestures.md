---
title: Generative Motion & Gestures
description: How AIRI generates procedural 3D motions, triggers animations on the fly, and uses Text-to-Motion neural diffusion.
---

# Generative Motion & Gestures

In AIRI, your 3D avatar does not simply repeat the same static idle loop. Through the **Motion Engine**, avatars can gesture while speaking, react emotionally to your words, perform procedural dances, and even synthesize brand-new full-body skeletal animations on demand using neural diffusion models.

---

## 1. How Motion Works in AIRI

AIRI uses a dual-engine motion architecture:

```
[ LLM Turn / User Command ] 
              │
              ├──► Built-in Presets (11+ VRMA animations: waving, thinking, jumping, dancing)
              │
              ├──► Kinetic ACT Tokens (<|ACT:motion="excited_wave"|>)
              │
              └──► Generative Text-to-Motion (FlowMDM Neural Diffusion via WebGPU)
```

---

## 2. ACT Motion Tokens

When chatting, your character's LLM can embed kinetic performance markers:
- `<|ACT:motion="wave"|>`: Triggers a friendly greeting wave.
- `<|ACT:motion="think"|>`: Puts hand to chin thoughtfully during deep answers.
- `<|ACT:motion="shy_fidget"|>`: Shifts feet and looks away during romantic or awkward moments.

These tokens are automatically intercepted by the parser and dispatched to the avatar renderer, blending smoothly with the current speech audio.

---

## 3. Generative Text-to-Motion (FlowMDM)

AIRI includes experimental support for **FlowMDM (Local WebGPU Neural Motion Diffusion)**:
- **How It Works**: Given a text description (e.g., *"Take two steps back and do a dramatic bow"* or *"Celebrate with a victory spin"*), the local WebGPU worker synthesizes a 3D skeletal animation track and compiles it into standard VRMA bytecode directly inside your browser or desktop app.
- **Zero Cloud Rendering**: Runs on your local GPU with zero external cloud dependencies.

### Enabling FlowMDM:
1. Open **Settings &rarr; Modules &rarr; Text to Motion**.
2. Select **FlowMDM (Local WebGPU)**.
3. Click **"Download Model Weights"** (once downloaded, the weights are cached locally).
4. Test custom motion prompts in the **Motion Playground**.

---

## 4. Resting Postures & Random Cycles

In **Settings &rarr; Character &rarr; Vessel &rarr; Customize Model**:
- **Default Idle**: Set your character's base resting posture.
- **Random Motion Cycles**: Enable subtle random shifts (weight transfers, head tilts, hair adjustments) every 15–30 seconds to make the avatar feel alive when idle.
