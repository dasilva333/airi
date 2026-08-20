---
title: V-HACK Avatar Modding Studio
description: Discover the hidden V-HACK DevTools panel for real-time 3D VRM material tuning, live texture swaps, and surgical GLB export.
---

# V-HACK Avatar Modding Studio

**V-HACK DevTools** is a built-in power-user suite designed for 3D model creators and modders. Hidden inside Model Settings, V-HACK provides a Unity-like inspector for examining avatar mesh trees, fine-tuning Three.js MToon shader properties, hot-swapping clothing textures live, and exporting modded GLB/VRM binaries without opening external 3D software.

---

## 1. Accessing V-HACK Studio

To open the V-HACK panel:
1. Open **Settings &rarr; Character &rarr; Vessel / Display Model**.
2. Click **"Customize Model"**.
3. In the model editor toolbar, click the **"V-HACK Studio"** tab (or press the developer shortcut `Ctrl+Alt+V`).

---

## 2. Key Tools & Features

### 1. Hierarchy & Stage Tree Inspector
- View the complete 3D scene hierarchy: Root, Armature, Bones, and Skinned Meshes.
- Inspect individual sub-meshes, material slots, and polygon counts.
- Toggle visibility of specific mesh parts (e.g., hiding hats, glasses, or jacket overlays).

### 2. MToon Material Lab
Fine-tune how your VRM reacts to lighting and environment reflections:
- **Shade Shift & Toon Boundaries**: Adjust the sharpness of cel-shaded anime shadows.
- **Rim Lighting (`_RimWidth` & `_RimColor`)**: Add or customize atmospheric halo glows around character hair and clothing edges.
- **Outline Width**: Increase or soften ink outline lines.

### 3. Texture Forge & Hot-Swapper
- Click on any material slot (e.g., *Eye Texture*, *Shirt Texture*, *Hair Texture*).
- Drag-and-drop a new `.png` or `.webp` image directly into the slot to see the avatar's texture update live on screen with zero reload lag.
- Use the **AI Texture Inpainter** to generate custom patterns or logos onto character clothing.

### 4. Surgical GLB / VRM Export
Once you have customized materials, textures, and mesh toggles:
- Click **"Export Modified VRM"**.
- V-HACK compiles your changes into a clean, optimized `.vrm` binary with all material edits permanently saved.
