# Live2D Interactive Runtime & DSL

![Live2D System & Expression Curation](/showcase/model-customizer-ai-curation.avif)

The **Live2D Interactive Runtime** brings Cubism models into deep parity with AIRI's 3D VRM embodiment pipeline. Beyond standard rendering, AIRI introduces a custom **Live2D Scripting DSL (Domain-Specific Language)**, an automated multi-model archive normalizer, cross-model tactile hit zones with audio reactions, and shared Hacker Studio texture editing.

---

## Multi-Moc3 Extraction & Self-Healing

- **Multi-Moc3 Zip Normalizer**: Drag and drop archives containing multiple `.moc3` files. AIRI automatically detects nested subdirectories, separates bundled assets, and normalizes them into individually selectable models.
- **In-Memory Manifest Healing**: Automatically repairs broken expression filenames, corrects malformed physics configurations, and resolves missing motion dictionaries at runtime without touching original disk files.

---

## Tactile Hit Zones & Body Area Pooling

- **Dynamic Tactile Hit Zones**: Clicking or tapping specific body areas on Live2D models triggers contextual audio lines, emotional expressions, and speech captions.
- **Expression Pooling**: Head taps, arm gestures, and chest clicks map to separate expression candidate pools, creating varied, non-repetitive physical reactions.
- **Decoupled Stage Physics**: Physics calculations remain butter-smooth even when scaling or docking the stage window.

---

## Hacker Studio: Real-Time Texture Surgery

![Live2D Texture Surgery](/showcase/model-customizer-vhack-texture-deck.avif)

The shared **Hacker Studio** section empowers creators to modify Live2D atlas pages without reopening Cubism Editor:
- **Texture Deck**: Inspect, download, and hot-swap texture atlas sheets in real time.
- **Surgical Eraser**: Non-destructively mask out unwanted accessory layers, clothing elements, or visual artifacts.
- **ZIP Export**: Rewrites the replaced atlas pages inside the source Live2D ZIP for a clean, re-importable bundle.
- **In-Place Revert**: Removes a replacement without reloading the live model.

---

## Key Capabilities

- **3-Panel Architecture**: Modular Character Customization, Scene Layout, and Advanced Tuning panels.
- **Multi-Moc3 Auto-Splitting**: Normalizes complex archives into clean individual models.
- **In-Memory Self-Healing**: Resilient handling of malformed manifests and nested paths.
- **Tactile Body Hit Zones**: Audio feedback and dynamic expression pooling per body region.
- **Hacker Studio Tools**: Live Live2D atlas swapping, PNG upload, preview/revert, and ZIP export (Parts/drawables deferred).
- **AiriCard Integration**: Custom Live2D mappings serialize directly into character card exports.
