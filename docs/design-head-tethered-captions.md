# Head-Tethered Caption Plank — Design & Cross-Model Compatibility

This document outlines a design for an **in-scene caption plank**: a subtitle bubble rendered *inside* the active model renderer, anchored to a virtual point above the model's head, and skewed/scaled/rotated each frame from the model's own pose so it appears to float *with* the character instead of over a desktop overlay window.

It is a **clean-room port** of an idea first seen in NekoGPT's *Live2D Accessory Renderer* (a subsystem that pins external sprites to a Live2D model's head/face/chest and applies a fake-perspective skew driven by `ParamAngleX/Y/Z`). No NekoGPT code is being ported; only the underlying geometric principle is being adapted to AIRI's existing Live2D / Spine / VRM / MMD pipelines.

---

## 1. Sourcing — the mechanic we're extracting

NekoGPT's subtitle floats above the model's head **and** appears to "twist" as the model looks around. The twist is not real 3D; it is a 2D perspective fake computed from Live2D pose parameters.

The mechanic consists of three clean ideas:

1. **Pose snapshot** — Every frame, read a small set of normalized pose parameters from the active model:
   `headYaw`, `headPitch`, `headRoll`, `bodyYaw`, `bodyPitch`, `bodyRoll`, plus optional `eyeX`, `eyeY`, `mouthOpen`.
   From `packages/stage-ui-live2d/.../Model.vue`, AIRI already pokes these via `coreModel.setParameterValueById('ParamAngleX', …)`. Reading them uses `coreModel.getParameterValueById('ParamAngleX')` plus a small alias table, because runtime/model authors alternate between `ParamAngleX`, `PARAM_ANGLE_X`, `ParamHeadAngleX`, `FaceAngleX`, `AngleX`, etc.

2. **Anchor attachment** — Locate a screen-space point for the chosen anchor (`head`, `face`, `chest`).
   If the runtime exposes an actual head drawable / bone bound, use its world center. Otherwise, fall back to a percentage of the model's overall bounding box (`head ≈ (50%, 18%)`, `face ≈ (50%, 31%)`, `chest ≈ (50%, 55%)`).

3. **Fake perspective transform** — Convert pose → a non-uniform 2D transform that *suggests* 3D rotation:
   ```
   strength    = perspectiveStrength(anchor) * followStrength     // 0..1
   x           = clamp(headYaw / 30,    -1..1)
   y           = clamp(headPitch / 30,  -1..1)
   flatten     = |x| * 0.18 * strength
   scaleX      = 1 - flatten                                       // squash as head turns
   scaleY      = 1 + |y| * 0.035 * strength
   skewX       = x * 0.12 * strength
   skewY       = -y * 0.045 * strength
   rotation    = headRoll in radians
   position    = anchor stage-space point + user offset
   ```
   The sprite/element is then written with `position/scale/skew/rotation/alpha`. For Pixi, this maps 1:1 to `sprite.position.set`, `sprite.scale.set(sx*scaleX, sy*scaleY)`, `sprite.skew.set(skewX, skewY)`, `sprite.rotation=…`, `sprite.alpha=…`. For DOM/CSS, the same numbers map to a `transform: matrix3d(...)` or split `translate / skew / scale / rotate`.

**Frame cadence**: the transform must update *after* the model has been posed this frame but *before* the canvas is presented. For Pixi-Live2D, NekoGPT hooks `internalModel.on('beforeModelUpdate', …)` and also subscribes to the Pixi ticker as a fallback, so the caption tracks 1:1 with the head movement; AIRI's `Model.vue` already wraps `motionManager.update` and hooks `update` (see lines ~918 and ~1073 in `Model.vue`), so there is a natural latch.

---

## 2. Why this does **not** fit the existing caption window

AIRI's current caption is a separate transparent `BrowserWindow` (`apps/stage-tamagotchi/src/renderer/pages/caption.vue` + `packages/stage-ui/src/components/scenes/CaptionPanel.vue`), positioned by Electron main. Windows cannot shear, skew, or be WebGL-transformed; only translated and resized. Therefore:

* The existing caption window can satisfy `captionDocking: 'top' | 'bottom' | 'none'`.
* It can satisfy `captionDocking: 'character-head'` only in the "float the *rectangle* near the head" sense — repositioned every frame via IPC, but always axis-aligned and overlays *above* the stage, breaking the depth illusion.
* The full effect (squash + skew + slight rotation as the head turns) requires the caption to be a *PIXIDisplayObject* (Live2D / Spine / general WebGL stage) or an in-canvas DOM element on the VRM/MMD three.js stage.

So this is **a new widget, not a setting on the current caption window.**

---

## 3. Proposed design for AIRI

### 3.1 Architecture & Architectural Boundaries

Head-tethered captions operate across two clearly decoupled tiers: a **renderer-agnostic shared data/analysis layer** and **per-runtime rendering backends**.

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        @proj-airi/stage-shared                         │
│  • analyzeCaptionSentence(text)  (30+ regex triggers, negation filter) │
│  • CaptionEffectCue / AnalyzedSentenceEffects types                    │
│  • poseToCaptionTransform(...)   (squash, skew, roll perspective math) │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
           Emits normalized { effects, transform, anchor }
                                    │
          ┌─────────────────────────┴────────────────────────┐
          ▼                                                  ▼
┌──────────────────────────────┐           ┌───────────────────────────────────┐
│     stage-ui-live2d          │           │    Screen-Space Canvas2D Overlay  │
│  • PIXI.Graphics / Container │           │  • CanvasRenderingContext2D       │
│  • PIXI WebGL masks          │           │  • Path2D vector builder & masks  │
│  (Native Pixi WebGL backend) │           │  (Shared: VRM, MMD, and Spine)    │
└──────────────────────────────┘           └───────────────────────────────────┘
```

#### Render Surface Strategy by Model Format:

| Stage Renderer | Engine / Context | Head Anchor Source | Caption Surface & Transform Mechanism |
| :--- | :--- | :--- | :--- |
| `live2d` | Pixi.js v6 | `coreModel` parameters + drawable bounds | In-stage **PIXI child** (`PIXI.Graphics`, `PIXI.Container`, WebGL masks) with native Pixi transform. |
| `vrm` | Three.js | `vrm.humanoid.getNormalizedBoneNode('head')` | **Screen-Space 2D Canvas Overlay**; head world position projected to NDC via `project(camera)`, Euler yaw/pitch/roll into `poseToCaptionTransform`. |
| `mmd` | Three.js | `skeleton.bones['頭']` / `neck` | **Screen-Space 2D Canvas Overlay** (100% shared with VRM via `project(camera)`). |
| `spine` | Spine-WebGL | `skeleton.findBone('head')` | **Screen-Space 2D Canvas Overlay**; feeds 2D bone stage coordinates `(worldX, worldY)` directly. |
| none/configure | Fallback | N/A | Fall back to the existing dedicated caption window. |

The **same component** (`packages/stage-ui/src/components/scenes/HeadTetheredCaption.vue`) orchestrates data, settings, and Sentence-Sync BroadcastChannel events.

### 3.2 Component & Data Flow

```text
┌──────────────────────────────┐
│ CaptionPanel.vue             │  ← shared text/segment typography
│  (existing — keeps Sentence  │     (no pose logic)
│   Sync, theming, layout)     │
└──────────────┬───────────────┘
               │ segments
               ▼
┌──────────────────────────────┐
│ HeadTetheredCaption.vue      │  ← host wrapper: frame loop + Sentence Sync
│  • watches BroadcastChannel  │
│  • reads anchor from settings│
│  • calls analyzeCaptionSentence()
│  • computes poseToCaptionTransform()
└──────┬───────────────┬───────┘
       │               │
       ▼               ▼
┌──────────────────────────────┐  ┌──────────────────────┐
│ Canvas2D Overlay Component   │  │ PixiStageAdapter     │
│ (Shared for VRM/MMD/Spine    │  │ (Live2D only)        │
│  via Canvas2D / Path2D)      │  │  • native PIXI.Graph │
└──────────────────────────────┘  └──────────────────────┘
```

### 3.3 Settings Surface

Reuses the existing `useSettings` slice. Add one new setting and one new binding; do **not** create a parallel system.

* `captionAnchorDocking: 'none' | 'head' | 'face' | 'chest'` — sub-mode under `captionDocking`.
  * When `captionDocking === 'character-head'`, use the head-tethered renderer instead of positioning the Electron window.
  * The other three options select which anchor the plank follows, in case the user wants it on the mouth (subtitles) or chest (signboard).
* `captionAnchorOffset: { x: number; y: number }` — pixel offset from the anchor point for fine-tuning.
* `captionAnchorFollowStrength: 0..100` — attenuates perspective; `0` makes the plank static over the model, `100` is the full "twist".
* Existing `captionFollowStageVisibility`, `captionFollowStagePosition`, theme, opacity, font scale, and Sentence Sync continue to apply unchanged.

### 3.4 Per-Renderer Adapters & The Canvas2D Consolidation

#### Why Canvas2D was chosen over `CSS3DObject` and Pure CSS:
* **`CSS3DObject` (Eliminated)**: Running a secondary `CSS3DRenderer` alongside TresJS/WebGL adds significant multi-renderer sync overhead, does not provide WebGL depth benefits, and suffers from blurry rasterization on camera FOV changes.
* **Pure CSS / DOM (Eliminated)**: Standard CSS `border-radius` and borders cannot draw dynamic 16-spike starburst outlines, frame-by-frame 60 FPS sine-wave wagging tails, or interior-masked particle systems.
* **Canvas2D Overlay (Chosen Solution)**: Standard HTML5 `CanvasRenderingContext2D` provides exact 1:1 syntax parity with PIXI's vector drawing model (`beginPath()`, `bezierCurveTo()`, `arcTo()`, `stroke()`, and `clip()` for the body mask). A single screen-space overlay canvas delivers razor-sharp Retina resolution, 0 GPU texture upload cost, and runs 60 FPS particle layers seamlessly.

#### Adapter Implementation Details:

#### 1. Live2D (`packages/stage-ui-live2d`)
* Reads Cubism parameters (`ParamAngleX/Y/Z`) from `coreModel` with fallback to `focusController`.
* Uses native `PIXI.Graphics`, `PIXI.Container`, and WebGL masks inside the existing Pixi stage canvas.

#### 2. VRM & MMD (`packages/stage-ui-three`, `packages/stage-ui-mmd`)
* VRM reads `vrm.humanoid.getNormalizedBoneNode('head')`; MMD reads `skeleton.bones['頭']`.
* On the frame tick (after animation update), extracts world position `vec3` and quaternion `quat`.
* Projects 3D world coordinate to 2D screen coordinates via Three.js: `vec3.project(camera)`.
* Converts quaternion rotation to Euler `yaw`, `pitch`, `roll`, clamps to `[-1, 1]`, and feeds into `poseToCaptionTransform`.
* Renders the 4-channel vector bubble and particles directly on the screen-space Canvas2D overlay.

#### 3. Spine (`packages/stage-ui-spine`)
* Spine uses `@esotericsoftware/spine-webgl` (raw WebGL canvas, no Pixi).
* Reads `skeleton.findBone('head')` to obtain 2D bone stage coordinates `(bone.worldX, bone.worldY)`.
* Feeds `(worldX, worldY)` directly as the anchor to the shared Canvas2D overlay, getting the full 4-channel expressive vector bubble without building bespoke raw WebGL shader pipelines.

#### Shared Upstream Modules in `@proj-airi/stage-shared`:
1. `packages/stage-shared/src/utils/caption-perspective.ts`: `poseToCaptionTransform(pose, anchor, opts)` — pure transform math.
2. `packages/stage-shared/src/utils/caption-sentiment.ts`: `analyzeCaptionSentence(text)` — pure sentiment, negation filtering, and 30+ regex trigger analyzer.

---

## 4. Compatibility Across Models — Considerations

| Concern | Live2D | Spine | VRM (3D) | MMD (3D) |
| :--- | :--- | :--- | :--- | :--- |
| **Engine** | Pixi.js v6 | `@esotericsoftware/spine-webgl` | Three.js / TresJS | Three.js |
| **Pose Source** | `coreModel` parameters + aliases | `bone.worldRotationX/Y` | `head` bone quaternion | `頭` bone quaternion |
| **Anchor Bound** | `findHeadAnchorPoint(model)` | `skeleton.findBone('head').worldX/Y` | `VRMHumanoid.head` world position | `skeleton.bones['頭']` world position |
| **Render Surface** | In-stage PIXI Container | Screen-Space Canvas2D Overlay | Screen-Space Canvas2D Overlay | Screen-Space Canvas2D Overlay |
| **Perspective Shape** | Fake skew + scale in PIXI | Fake skew + scale on Canvas2D | Quaternion → Euler → 2D skew + scale | Quaternion → Euler → 2D skew + scale |
| **Frame Hook** | `app.ticker` (LOW priority) | After `skeleton.updateWorldTransform()` | After `vrm.update(delta)` in render loop | After `mmd.update(delta)` in render loop |
| **Stage Coords** | PIXI stage pixels | Canvas2D stage pixels | Three.js NDC → `project(camera)` | Three.js NDC → `project(camera)` |

---

## 5. Locked Decisions (MVP Scope)

The original open questions are now resolved for MVP:

| # | Question | Locked decision |
|---|---|---|
| 1 | Toggle shape | **Independent toggle**, not a cycler sub-mode. New global boolean `headTetheredCaptionEnabled`, single toggle row in the `captions-layout` group of the control customizer. |
| 2 | Customizer versioning | **No config version bump.** New rows blend in naturally; version increments are reserved for changing existing options. |
| 3 | Customizer row placement | **`captions-layout` group, second item** (immediately after `caption` master toggle). Description: *"In-scene comic captions for 2D & 3D avatars."* |
| 4 | Settings → Captions panel surface | **Not added** for MVP. Toggle is customizer-only. |
| 5 | Drag-to-offset | **Deferred.** MVP uses fixed `headTetheredCaptionOffset = { x: 0, y: -15 }` in the settings schema; no pointer events on the plank this phase. |
| 6 | Text source | **Sentence Sync BroadcastChannel (`airi-caption-overlay`)** with Micro-Pacer sub-chunking. |
| 7 | Plank sizing | **Proportional to model on-screen height** (width ≈ `modelHeight * 0.35`, capped to 65% viewport). |
| 8 | Plank style | **Comic speech bubble**: continuous vector outline, dynamic tail limb morphing (`wag`, `heart-curl`, `droop`, `jagged-pointer`), interior-masked ambient particles. |
| 9 | Persistence scope | **Single global toggle.** |
| 10 | Off behavior | When off, container / canvas ticker is destroyed (zero residual render cost). |
| 11 | Multi-format rollout | **Phase 1: Live2D** (active). **Phase 2: VRM, MMD & Spine** via shared Canvas2D overlay. |
| 12 | Multi-actor | **Single actor.** |

---

## 6. Files & Implementation Roadmap

| Purpose | Path | Action |
| :--- | :--- | :--- |
| Extract sentiment & trigger analyzer | `packages/stage-shared/src/utils/caption-sentiment.ts` | **NEW**: Move `analyzeCaptionSentence` and cue types from Live2D into shared. |
| Pure pose→transform math | `packages/stage-shared/src/utils/caption-perspective.ts` | **EXISTING**: Shared single-source math. |
| Live2D adapter (Pixi WebGL) | `packages/stage-ui-live2d/src/composables/live2d/head-tethered-caption.ts` | **MODIFY**: Consume `analyzeCaptionSentence` from `@proj-airi/stage-shared`. |
| Shared Canvas2D Overlay Component | `packages/stage-ui/src/components/scenes/HeadTetheredCanvas2D.vue` | **NEW**: Canvas2D vector builder & particle engine for VRM, MMD, and Spine. |
| VRM adapter & bone projection | `packages/stage-ui-three/src/composables/vrm/head-tether.ts` | **NEW**: Expose projected head bone anchor & Euler angles. |
| Spine & MMD bone projection hooks | `packages/stage-ui-spine/...` & `packages/stage-ui-mmd/...` | **NEW**: Expose head bone anchor coordinates. |
| Mount & orchestration host | `packages/stage-ui/src/components/scenes/RendererStage.vue` | **MODIFY**: Mount Canvas2D overlay for VRM, MMD, Spine alongside Live2D Pixi mount. |

The existing `apps/stage-tamagotchi/src/renderer/pages/caption.vue`, `CaptionPanel.vue`, the Electron caption window manager, and the caption BroadcastChannel contract all stay untouched.

---

## 7. MVP Acceptance Gates & Visual Parity Test Suite

1. `pnpm -F stage-ui typecheck && pnpm -F stage-ui-live2d typecheck`.
2. `pnpm -F stage-tamagotchi build`.
3. Manual smoke in dev: Live2D model loaded, toggle on → plank appears above head; turn head → plank skews/flattens; toggle off → plank disappears and PIXI container is destroyed.

---

### 7.1 Cross-Model Visual Parity Test Suite

To ensure 100% visual parity across all model engines (Live2D, VRM, MMD, Spine), execute these test payloads in the DevTools console via the `airi-caption-overlay` BroadcastChannel and verify the resolved 4-channel composition:

```javascript
// Test 1: Gratitude & Praise (Flower Bloom Rim + Floating Stars)
new BroadcastChannel('airi-caption-overlay').postMessage({
  type: 'caption-assistant',
  segments: [{ text: 'Thank you so much, you are amazing! pretty...', isActive: true, color: '#F472B6' }]
})

// Test 2: Sadness & Sniffle (Droop Tail + Falling Raindrops)
new BroadcastChannel('airi-caption-overlay').postMessage({
  type: 'caption-assistant',
  segments: [{ text: 'Don\'t leave me alone... sniff...', isActive: true, color: '#3B82F6' }]
})

// Test 3: Sparkle & Compliment (Star Ambient + Flower Rim Accent)
new BroadcastChannel('airi-caption-overlay').postMessage({
  type: 'caption-assistant',
  segments: [{ text: 'Thank you so much, you are amazing! pretty sparkle star...', isActive: true, color: '#EC4899' }]
})

// Test 4: Yandere & Devotion (Vignette Background + Heartbeat Pulse)
new BroadcastChannel('airi-caption-overlay').postMessage({
  type: 'caption-assistant',
  segments: [{ text: 'You belong to me forever... don\'t leave my side... 🖤', isActive: true, color: '#8B5CF6' }]
})

// Test 5: Tech / Cyber (Cyan Cyber Scanline Beam)
new BroadcastChannel('airi-caption-overlay').postMessage({
  type: 'caption-assistant',
  segments: [{ text: 'Analyzing system telemetry and running data diagnostic...', isActive: true, color: '#06B6D4' }]
})

// Test 6: Affection / Flirt (Rising Hearts + Heart-Curl Tail Pose ♡)
new BroadcastChannel('airi-caption-overlay').postMessage({
  type: 'caption-assistant',
  segments: [{ text: 'I really love spending time with you! ♡', isActive: true, color: '#EC4899' }]
})

// Test 7: Cat Speech / Playful (60 FPS Wagging Tail Sine Wave ~)
new BroadcastChannel('airi-caption-overlay').postMessage({
  type: 'caption-assistant',
  segments: [{ text: 'Nya~ meow! I want a treat right now! purr...', isActive: true, color: '#F472B6' }]
})

// Test 8: Surprise / Shock (Flash Burst + Impact Bounce Motion)
new BroadcastChannel('airi-caption-overlay').postMessage({
  type: 'caption-assistant',
  segments: [{ text: 'WHAT?! No way!! System diagnostic failed?!', isActive: true, color: '#F59E0B' }]
})

// Test 9: Anger / Tsundere (Starburst Outline + Jagged Pointer + Anger Mark 💢 + Shake)
new BroadcastChannel('airi-caption-overlay').postMessage({
  type: 'caption-assistant',
  segments: [{ text: 'Hmph! Shut up! Don\'t get the wrong idea! 💢', isActive: true, color: '#EF4444' }]
})

// Test 10: Stutter & Shyness (Blush Wash + Sweat Drop + Anxious Wobble + Heart-Curl Tail)
new BroadcastChannel('airi-caption-overlay').postMessage({
  type: 'caption-assistant',
  segments: [{ text: 'U-um... w-wait a second! b-dummy!', isActive: true, color: '#F472B6' }]
})

// Test 11: Cozy & Rest (Warm Sunbeam Gradient + Slow Breathing Pulse)
new BroadcastChannel('airi-caption-overlay').postMessage({
  type: 'caption-assistant',
  segments: [{ text: 'Time to relax and have a warm cozy evening... yawn...', isActive: true, color: '#F59E0B' }]
})

// Test 12: Micro-Pacer Dynamic Sub-Chunking (Sequences 100+ chars across animated comic frames)
new BroadcastChannel('airi-caption-overlay').postMessage({
  type: 'caption-assistant',
  segments: [{ text: 'Hello there! I\'m so happy to see you today! Let\'s work together and make this the best session ever! ✨', isActive: true, color: '#10B981' }]
})
```

#### Expected 4-Channel Matrix for Test Cases:

| Test # | Trigger Input | Body Style | Tail Style | Ambient | Accent | Motion | Rim |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | `"Thank you so much, you are amazing! pretty..."` | `standard-rounded` | `pointer` | `stars` | — | — | `flower-bloom` |
| **2** | `"Don't leave me alone... sniff..."` | `standard-rounded` | `droop` | `rain` | — | — | — |
| **3** | `"Thank you... pretty sparkle star..."` | `standard-rounded` | `pointer` | `stars` | — | — | `flower-bloom` |
| **4** | `"You belong to me forever... 🖤"` | `standard-rounded` | `pointer` | `vignette` | — | — | `heartbeat-pulse` |
| **5** | `"Analyzing system telemetry..."` | `standard-rounded` | `pointer` | `scanline` | — | — | — |
| **6** | `"I really love spending time with you! ♡"` | `standard-rounded` | `heart-curl` | `hearts` | — | — | — |
| **7** | `"Nya~ meow! I want a treat... purr..."` | `standard-rounded` | `wagging` | — | — | — | — |
| **8** | `"WHAT?! No way!! System diagnostic failed?!"` | `standard-rounded` | `pointer` | — | `flash-burst` | `bounce` | — |
| **9** | `"Hmph! Shut up! Don't get the wrong idea! 💢"` | `jagged-starburst` | `jagged-pointer` | — | `anger-mark` | `shake` | — |
| **10** | `"U-um... w-wait a second! b-dummy!"` | `standard-rounded` | `heart-curl` | `blush` | `sweat-drop` | `wobble` | — |
| **11** | `"Time to relax and have a warm cozy evening... yawn..."` | `standard-rounded` | `pointer` | `sunbeam` | — | `breath` | — |
| **12** | `"Hello there! I'm so happy to see you today! ... ✨"` | `standard-rounded` | `pointer` | — | — | — | (Paced) |

---

## 8. Implementation History & Discovered Failure Modes Journal

### 8.1 Vue 3 Ref Reactivity & `defineExpose` Double-Unwrapping Trap
- **Symptom**: Toggling Head-Tethered Caption ON in Control Customizer resulted in no bubble appearing on stage at all (silent attach failure).
- **Root Cause**: `Live2DCanvas.vue` exposed `pixiApp` as a `Ref<Application | undefined>`. Originally, `Live2D.vue` wrapped this in `live2dApp: computed(() => live2dCanvasRef.value?.pixiApp)`. In Vue 3, `defineExpose` automatically unwraps top-level ref properties on component instances. Wrapping a `Ref` inside a `computed` produced a double-wrapped `ComputedRef<Ref<Application>>`. When `RendererStage.vue` passed `live2dSceneRef` down to `HeadTetheredCaption.vue`, accessing `live2dApp` yielded the `ComputedRef` object instead of the underlying PIXI `Application` instance. Furthermore, capturing `props.app` statically at initial template render time caused it to evaluate to `undefined` permanently because the canvas boots asynchronously after initial component mount.
- **Resolution**:
  1. `Live2D.vue` exposes `live2dApp` as a function accessor: `live2dApp: () => live2dCanvasRef.value?.pixiApp`.
  2. `HeadTetheredCaption.vue` takes `:live2d-scene-ref` as a prop containing `{ live2dApp?: () => unknown }`.
  3. `HeadTetheredCaption.vue` polls `live2dApp()` lazily until both the PIXI Application and Live2D model instances are ready on stage.

### 8.2 PIXI v6 Scoped Package `BatchRenderer` Injection Error
- **Symptom**: `Graphics` and `Text` rendering threw `Cannot read properties of undefined (reading 'MAX_TEXTURES')`.
- **Root Cause**: In PIXI v6, scoped packages (`@pixi/graphics`, `@pixi/text`) carry `pluginName = 'batch'` and look up `renderer.plugins.batch` at render time. AIRI's Live2D stage canvas runs on Cubism's custom WebGL renderer context without initializing PIXI's standard batch plugin.
- **Resolution**: Implemented `ensureBatchRendererOnLiveRenderer(app)` in `head-tethered-caption.ts` to inject a `BatchRenderer` instance into `renderer.plugins.batch` and trigger `instance.contextChange()` to initialize texture limits against the live WebGL context.

### 8.3 Subtitle Plank Geometry & Anchor Placement Misalignment
- **Symptom**: Speech bubble covered the character's face/eyes, and the tail extended horizontally to the right.
- **Root Cause**: `FALLBACK_HEAD_ANCHOR.y = 0.18` placed the anchor 18% down from `bounds.y` (placing the anchor directly on the character's face/nose). With `container.pivot.set(0, tailHeight)` anchoring the tail tip to `(anchor.x, anchor.y)`, the bubble body (which extends upwards from `y=0` to `y=-bubbleHeight`) sat directly on top of the character's forehead/eyes. When combined with excessive skew, the tail appeared to shear sideways.
- **Resolution**:
  1. `findHeadAnchorPoint(model)` inspects Live2D drawable art meshes (`head`, `hair`, `face`, `頭`, `顔`, `髮`) to resolve the exact top-most Y coordinate of the head/hair.
  2. Top-center bounding-box fallback (`bounds.x + bounds.width * 0.5`, `bounds.y + Math.min(bounds.height * 0.03, 20)`) anchors the tail tip to the top of the hair/head (`bounds.y`), allowing the bubble body to float cleanly above the character.
  3. Tuned default offset to `{ x: 0, y: -15 }` and moderated skew/rotation multipliers in `caption-perspective.ts`.

### 8.4 Cubism Core Model Parameter Enumeration (`count: 0, ids: Array(0)`)
- **Symptom**: Parameter census logged `{count: 0, ids: Array(0)}` and pose values returned `yawRaw: 0, pitchRaw: 0, rollRaw: 0`.
- **Root Cause**: `pixi-live2d-display`'s `CubismModel.getParameterCount()` sometimes returns `0` during early initialization because the underlying `_model` reference is initialized lazily. Public API index queries failed even though parameters were present.
- **Resolution**: Implemented `readCoreModelParamValue()` to inspect `coreModel._parameterIds` and `coreModel._parameterValues` direct arrays first (which are reliable and updated every frame by Cubism), followed by index enumeration and `getParameterValueById()` fallbacks.

### 8.5 Vue Reactive Proxy Unwrapping in High-Frequency Ticker Loops
- **Symptom**: Settings passed to the adapter were logged as `Proxy(Object) {x: 0, y: -40}`.
- **Root Cause**: Reading Vue `useLocalStorage` reactive proxy properties directly inside a 60 FPS PIXI ticker loop causes unnecessary reactivity tracking overhead.
- **Resolution**: Unwrapped `offset` into plain primitive numbers (`offsetPlain = { x: Number(offset?.x) || 0, y: Number(offset?.y) || 0 }`) once at attach time so per-frame tick evaluations remain zero-overhead.

### 8.6 Cubism4InternalModel Direct Array Access vs CDI Parameter Count
- **Symptom**: Parameter census logged `count: 0` despite the model actively animating and `parameterMetadata from CDI: 124` confirming 124 parameters.
- **Root Cause**: In `Cubism4InternalModel`, `getParameterCount()` delegates to `_model`, which is initialized lazily. However, the Cubism runtime maintains `_parameterIds` and `_parameterValues` directly as parallel arrays on `coreModel`.
- **Resolution**: Directly inspecting `_parameterIds` and `_parameterValues` in `readCoreModelParamValue()` guarantees reliable access to all 124 parameters regardless of `getParameterCount()`'s initialization state.

### 8.7 Renderer Batch State & Graphics Object Signature in PIXI v6
- **Symptom**: `guardedRender` in `Canvas.vue` threw `TypeError: Cannot read properties of undefined (reading 'MAX_TEXTURES')` during `app.render()`.
- **Root Cause**: Passing single object signatures to `lineStyle({ width, color })` (a PIXI v7+ API) on PIXI v6 stored invalid stroke metadata inside the `Graphics` instance. When the renderer processed the malformed batch, `BatchRenderer` attempted to read `MAX_TEXTURES` on an uninitialized/missing plugin slot.
- **Resolution**: Enforced positional arguments for `lineStyle(width, color, alpha, alignment)` matching PIXI v6 signatures.

### 8.8 Live WebGL Renderer Batch Plugin Injection (`ensureBatchRendererOnLiveRenderer`)
- **Symptom**: Standalone `@pixi/graphics` and `@pixi/text` v6 objects attached to `app.stage` caused `guardedRender` in `Canvas.vue` to throw `TypeError: Cannot read properties of undefined (reading 'MAX_TEXTURES')` every frame.
- **Root Cause**: `Graphics.pluginName === 'batch'`, so PIXI `Graphics` objects render through the batch plugin system. `BatchRenderer` carries extension metadata `{ name: 'batch', type: RendererPlugin }`, but in PIXI v6 scoped packages, plugins are not automatically self-registered. Because AIRI's Live2D canvas runs on Cubism's custom WebGL renderer context (`pixi-live2d-display/cubism4`), `renderer.plugins.batch` was never constructed on the active `Application`. When `Graphics` entered the render pass, PIXI looked up `renderer.plugins.batch.MAX_TEXTURES` on an undefined instance. Furthermore, `extensions.add` does not inject plugins into already-constructed renderers (`initPlugins` runs inside `Renderer`'s constructor).
- **Resolution**: Implemented `ensureBatchRendererOnLiveRenderer(app)` in `head-tethered-caption.ts`:
  1. Inspects `app.renderer.plugins.batch`.
  2. If missing, constructs `new BatchRenderer(app.renderer)` directly and assigns it to `renderer.plugins.batch`.
  3. Manually invokes `instance.contextChange()` once so `MAX_TEXTURES` is computed from the live WebGL context instead of defaulting to 1.

### 8.9 Real-Time 3D Skew, TypedArray Memory Resolution & Focus Target Fallback
- **Symptom**: The caption plank remained static and did not twist/skew when the character turned her head or looked around.
- **Root Cause**: Two factors combined:
  1. `_parameterValues` in the Cubism 4 SDK is a WebGL `Float32Array` (TypedArray). The previous guard `Array.isArray(_parameterValues)` evaluated to `false`, silently skipping parameter reads from WASM memory.
  2. When a model is in a neutral idle pose, `ParamAngleX/Y/Z` can sit at `0`.
- **Resolution**:
  1. Updated array guard to `typeof directValues.length === 'number'` to seamlessly read `Float32Array` values from WASM memory.
  2. Added fallback to `internalModel.focusController.x / y` (Live2D's internal cursor look-at target) when angle parameters are neutral, ensuring real-time 3D squash (`scaleX`), shear (`skewX`/`skewY`), and rotation (`rotation`) whenever the user moves their cursor across the stage.

### 8.10 Sentence Sync Protocol Integration, Actor Outline Accent & State Persistence
- **Sentence Sync Integration**: `HeadTetheredCaption.vue` subscribes to the `airi-caption-overlay` BroadcastChannel (`{ type: 'caption-assistant', segments }`).
- **`isActive: true` Target**: Filters `const activeSegment = segments?.find(s => s.isActive)`. Updates displayed text dynamically via `updateText(activeSegment.text)`.
- **Actor Identity Accent via Border Outline**:
  - The actor's color (`activeSegment.color` or default slate `0x0F172A`) is applied to the **bubble border outline** (`bubble.lineStyle(outlineWidth, actorOutlineColor, outlineAlpha, 0.5)`).
  - The inner font fill color remains consistent dark slate (`0x0F172A`) for maximum contrast and legibility.
### 8.11 Micro-Pacer & Dynamic Clause Sub-Chunking
- **Symptom / Failure Mode**: Upstream TTS or suggestion pipelines can emit long multi-sentence paragraphs as a single `isActive: true` segment (e.g. 180+ characters). Rendering a giant 6-line bubble causes the top of the bubble to clip off-screen or cover the character's face.
- **Micro-Pacer Algorithm**:
  - `subChunkText(text, maxChars = 80)`: Splits long active segments at natural punctuation/clause boundaries (`~`, `,`, `.`, `!`, `?`, `;`, `—`, `:`) or space boundaries into compact, 2-line sub-phrases (max 80 chars each).
  - **Reading-Speed Pacer**: Calculates sub-phrase display cadence based on character count (~16 characters per second or ~250ms per word, minimum 1.5s per sub-phrase).
  - Sequences through the sub-chunks automatically while `isActive: true` holds on the parent segment.
  - On the final sub-chunk, holds state and persists the last sub-phrase.

---

## 9. 4-Channel In-Bubble Visual Effects & Expressive Tail System Architecture

To elevate the head-tethered caption plank from a static dialogue bubble into a dynamic, expressive comic surface, the system employs a WebGL-accelerated **4-Channel Animation Engine** inside the PIXI container.

```text
Motion container
├── Bubble body + fill
├── Body mask
├── Interior effects container (mask = Body mask)
│   ├── Ambient layer
│   └── Interior accent layer
├── Rim/tail layer
├── Exterior accent layer
└── Text
```

---

### 9.1 The 4-Channel Concurrency Manager

To prevent visual clutter while allowing expressive combinations, effects are organized into **four orthogonal channels**. Each channel permits one selected effect at a time, but all four channels may run concurrently. Same-channel conflicts are resolved by priority; there is no cross-channel suppression:

1. **`ambient` (Background Atmosphere)**: Continuous background textures, particle flows, or gradients (e.g. floating hearts, rain, cyber grid, starfield, gloomy mist).
2. **`accent` (One-Shot Pops & Icons)**: Brief 250ms–600ms visual bursts or overlay icons (e.g. lightbulb flash, impact ring, checkmark sweep, sweat drop sticker, anger mark `💢`).
3. **`motion` (Bubble Physics Transforms)**: Container-level spring/sine transforms (e.g. nervous wobble, excited bounce, angry horizontal shake, breathing pulse, squash-and-stretch).
4. **`rim/tail` (Outline & Tail Limb Expressions)**: Vector border paths and tail limb poses (e.g. tail wagging, tail curling into a heart, tail drooping, jagged starburst outline, scalloped thought-cloud outline, frost border).

#### Cue Structure Interface
```ts
export interface CaptionEffectCue {
  id: string
  channel: 'ambient' | 'accent' | 'motion' | 'rim'
  effect: string
  durationMs: number
  intensity: number // 0.0 .. 1.0
  priority: number // Higher priority pre-empts lower priority in same channel
}
```

---

### 9.2 Expressive Speech-Bubble Tail & Border System

The speech-bubble tail acts as an **expressive character limb** that reacts dynamically to the dialogue mood:

| Body / Tail / Border Pose | Visual Behavior | Emotion / Mood Context |
| :--- | :--- | :--- |
| **`wag`** | Tail wags side-to-side (`~`) in a smooth sine wave. | Playful, happy, teasing, cat-speech (`nya`, `meow`). |
| **`heart-curl`** | Tail tip curls into a sweet heart loop (`♡`). | Affectionate, loving, flirting, compliments. |
| **`droop`** | Tail droops downward limply. | Sadness, disappointment, embarrassment, crying. |
| **`jagged-pointer`** | Border vector redrawn into a sharp, starburst outline with a jagged tail. | Anger, annoyance, shock, screaming (`ALL CAPS`). |
| **`scalloped-cloud`** | Border vector morphs into a 3-part thought cloud with trailing dots. | Thinking, pondering, inner monologues `(parentheses)`. |
| **`heartbeat-pulse`** | Tail and border pulse in a subtle double-beat rhythm (`thump-thump`). | Yandere, intense devotion, possessive affection. |
| **`frost-rim`** | Crystalline frost grows inward from the border edges. | Scared, chilled, creepy, terrified. |
| **`flower-bloom`** | Small flower/star blooms grow along the bottom border. | Gratitude (`thanks`), compliments (`pretty`), achievements. |

---

### 9.3 Parametric Continuous Vector Path Builder (`VectorBubblePathBuilder`)

To guarantee **zero internal seams or stroke overlap**, connected body-and-tail combinations use **one closed outer path and one stroke pass**. Intentionally disconnected decorations, such as thought dots, are emitted as auxiliary paths by the same builder:

```ts
export type BubbleBodyStyle
  = | 'standard-rounded'
    | 'jagged-starburst'
    | 'scalloped-cloud'

export type BubbleTailStyle
  = | 'pointer'
    | 'wagging'
    | 'heart-curl'
    | 'jagged-pointer'
    | 'droop'
    | 'thought-dots'
    | 'none'

export interface VectorBubbleOptions {
  width: number
  height: number
  bodyStyle: BubbleBodyStyle
  tailStyle: BubbleTailStyle
  wagPhase?: number // Driven by 60 FPS ticker for dynamic tail wagging
  color: number
  outlineWidth: number
  outlineAlpha: number
  fillColor: number
  fillAlpha: number
}

export interface VectorBubbleGeometry {
  drawVisibleBubble: (graphics: PIXI.Graphics) => void
  drawInteriorMask: (graphics: PIXI.Graphics) => void
  drawAuxiliaryShapes: (graphics: PIXI.Graphics) => void
}
```

#### Geometry Separation for Clean Rendering:
- **`drawVisibleBubble`**: Draws the complete visible outline including the expressive tail (`pointer`, `wagging`, `heart-curl`, `jagged-pointer`, `droop`).
- **`drawInteriorMask`**: Emits a **body-only** mask path so interior ambient textures (hearts, rain, scanlines) stay inside the bubble body without leaking into the tail.
- **`drawAuxiliaryShapes`**: Emits disconnected auxiliary paths (such as the 3 trailing thought-dots for `thought-dots`).

Redrawing a 20-point PIXI `Graphics` vector path on text change or during a 60 FPS tick takes **under 0.01ms**, preserving 100% smooth rendering.

---

### 9.4 Trigger Resolution Hierarchy & Safeguards

To prevent false positives (e.g., `chassis` triggering `hiss`, or `"I'm not angry"` triggering anger), the resolver evaluates input using a **5-tier priority hierarchy**:

```
1. Explicit <|ACT:emotion|> Tag  (Highest Priority)
   └─► 2. Structural Patterns (Stutters u-um, Ellipses ..., CAPS, Asides)
        └─► 3. Multi-word Phrases ("I miss you", "what if", "we did it")
             └─► 4. Regex Word Boundaries (\bmad\b, \bblush\b)
                  └─► 5. Character Persona Defaults  (Lowest Priority)
```

#### Resolution & Exclusions Rules:
- **Conflict Resolution**: Phrase priority resolves **semantic conflicts** (e.g. `"I'm not angry"`) without preventing compatible structural effects (e.g. `"I miss you!!"` triggers sadness/affection ambient styling **and** an exclamation impact accent).
- **Negation Filtering**: Negation filtering suppresses the matched emotion span (e.g. suppressing the anger match in `"not angry"`) while leaving the rest of the sentence intact for trigger evaluation.
- **Word Boundary Enforcement**: All keyword matches use explicit word boundaries (e.g., `/\b(mad|hiss)\b/i`).
- **Content Exclusions**: Code blocks (` ``` `), URLs (`https://...`), and quoted user text (`"..."`) are excluded from semantic trigger evaluation.

---

### 9.5 Complete 30+ Trigger & Visual Effect Catalog

| Trigger Pattern / Context | Channel Assignment | Visual FX & Bubble Behavior |
| :--- | :--- | :--- |
| **Stutter**: `I-I`, `w-wait`, `u-um`, `b-dummy` | `ambient` + `accent` + `motion` | Nervous wobble transform + rose blush wash + sweat drop sliding down edge. |
| **Pause / Hesitation**: `...`, `…` | `ambient` + `motion` | 3 glowing dots drift like fireflies; bubble container "holds its breath" (slow scale down). |
| **Surprise / Shock**: `!!`, `!?`, `?!`, `[gasp]` | `accent` + `motion` | Comic impact ring + radial speed lines + scale spring punch (`1.12 ➔ 1.0`). |
| **Curious / Ponder**: `??`, `hmm`, `wonder`, `curious` | `ambient` + `rim` | Question marks orbit behind text; scalloped thought cloud outline with trailing dots. |
| **Laughter**: `haha`, `hehe`, `giggle`, `lol` | `ambient` + `motion` | Confetti freckles / bubbles rising + double vertical hop motion. |
| **Affection**: `love`, `cute`, `darling`, `sweetheart` | `ambient` + `rim` | Hearts inflate and float upward + heart-curl tail pose (`♡`). |
| **Compliment Received**: `pretty`, `beautiful`, `amazing` | `ambient` + `rim` | Pink blush wash spreads inward + flower blooms grow along bottom border. |
| **Gratitude**: `thanks`, `thank you`, `appreciate` | `rim` | Small daisy/star blooms sprout along the bottom outline. |
| **Success**: `yay`, `done`, `perfect`, `we did it` | `accent` + `motion` | Confetti burst + gleaming checkmark sweep + upward bounce. |
| **Epiphany**: `aha`, `idea`, `realized`, `what if` | `accent` | Golden lightbulb flash + expanding idea rings. |
| **Apology / Mistake**: `oops`, `uh oh`, `my bad`, `sorry` | `accent` + `motion` | Slight bubble squash + sweat drop / bandage sticker in corner. |
| **Sadness**: `sad`, `miss you`, `cry`, `sniff`, `lonely` | `ambient` + `rim` | Raindrops slide down interior + drooping tail pose + blue gradient wash. |
| **Anger / Tsundere**: `angry`, `hmph`, `grr`, `annoyed` | `ambient` + `accent` + `motion` + `rim` | Jagged starburst outline + anger mark `💢` + red edge pulse + horizontal shake. |
| **Yandere / Possessive**: `mine`, `jealous`, `don't leave` | `ambient` + `rim` | Dark vignette + black hearts `🖤` + heartbeat tail pulse (`thump-thump`). |
| **Fear / Cold**: `scared`, `eek`, `creepy`, `cold` | `ambient` + `motion` + `rim` | Frost crystals creep inward from border + rapid trembling wobble + frost rim. |
| **Sleepy**: `sleep`, `tired`, `yawn`, `goodnight` | `ambient` + `motion` | Floating `Z` `z` `z` letters in sine wave + slow breathing scale cycle. |
| **Cozy / Calm**: `cozy`, `warm`, `relax`, `purr` | `ambient` + `motion` | Warm sunbeam gradient + floating dust motes + soft slow pulse. |
| **Music / Singing**: `sing`, `music`, `la la`, `hum` | `ambient` + `rim` | Musical notes travel along a staff line + outline pulses like a audio waveform. |
| **Magic / Spell**: `magic`, `wish`, `dream`, `spell` | `accent` | Star constellations draw themselves, rotate once, and dissolve into sparkles. |
| **System / Tech**: `analyze`, `code`, `system`, `data` | `ambient` | Cyan scanline + matrix grid drift + blinking cursor accent. |
| **Glitch / Error**: `error`, `glitch`, `404`, malformed text | `accent` | Tasteful RGB split + single scanline tear + pixel block recovery. |
| **Whisper**: `secret`, `psst`, `whisper`, `between us` | `ambient` + `motion` | Background dims around edges + hush ripple travels inward from tail. |
| **Food / Treat**: `yummy`, `sweet`, `cake`, `cookie`, `food` | `accent` | Strawberry / candy sprinkle icons bounce along bottom border. |
| **Playful Cat**: `meow`, `nya`, `purr` | `accent` + `rim` | Paw-print trail crosses bubble background + playful tail wag. |
| **Boop**: `boop`, `poke`, `bonk` | `accent` + `motion` | Contact ripple at edge + elastic squash-and-rebound transform. |
| **Self-Correction**: `—no`, `I mean`, `actually...` | `accent` | Scribble briefly crosses previous motif, then replacement effect pops in. |
| **Elongated Words**: `soooo`, `noooo`, `cuteeee` | `motion` | Stretch background motif in reading direction (duration scaled by repeat count). |
| **ALL CAPS**: Full uppercase sentence | `motion` + `rim` | Chunky comic drop shadow + sharp outline pulse + strong impact motion. |
| **Parenthetical Aside**: `(inner thoughts like this)` | `rim` | Mini floating thought bubbles behind text for an "inner monologue" look. |
| **Countdown**: `3... 2... 1...` | `accent` | Illuminated dots extinguish one by one, ending in a confetti burst. |

### 9.6 Micro-Chunk Sequence Pacing (Comic Book Panel Pacing)

As long messages stream or pace via the Micro-Pacer (~80-char sub-phrases), each sub-phrase operates as its own **animated comic frame**:

```
"U-um... I think I really like you!!"
 ├── 1. "U-um..." ➔ Motion: Wobble | Accent: Sweat Drop | Ambient: Blush Wash
 ├── 2. "I think" ➔ Ambient: Floating ? Dots | Rim: Scalloped Cloud
 └── 3. "I really like you!!" ➔ Ambient: Hearts | Rim: Heart-Curl Tail | Motion: Impact Bounce
```

---

### 9.7 Performance, Texture Pooling & Batching Safeguards

While PIXI WebGL rendering is fast, maintaining high 60 FPS performance requires strict resource bounds:

1. **Sprite Pool Budget**: Max **16–32 active visible sprites** total across all 4 channels. Sprites are pre-allocated and recycled from an in-memory pool.
2. **Texture Atlas Caching**: Reuses a single shared 512×512 texture atlas containing primitive icons (`heart`, `star`, `dot`, `drop`, `flower`, `spark`, `music_note`, `paw`).
3. **No Allocation in Ticker**: Zero `new` object or array instantiations inside the `updateTick(timeMs)` loop.
4. **Target Execution Time**: < **0.08ms per frame** total GPU/CPU execution time.

---

### 9.8 Kinetic Anchor Paradigms: 2D Planar Roll-Tilt vs 3D Projected Perspective

During empirical cross-format implementation across all four avatar renderers, two distinct positioning and rotational behaviors emerged:

#### Group A: 2D Planar Roll-Tilt (Live2D & Spine)
* **Mechanics**: Head anchors are resolved from 2D bounding boxes and planar skeleton transforms (`ParamAngleZ` in Live2D Cubism, `bone.getWorldRotationX()` in Spine).
* **Kinetic Character**: When the user pans/drags the character or when the character tilts their head, the anchor naturally sweeps along the circular arc of the head crown. This causes the speech bubble to dynamically roll, swing, and shift its center of gravity across the top-left or top-right of the avatar.
* **Feel**: Organic, playful, and responsive to direct canvas manipulation—giving a lively comic-strip feel where nudging the character directly redistributes the dialogue bubble.

#### Group B: 3D Camera-Projected Perspective (VRM & MMD)
* **Mechanics**: Head anchors are resolved by projecting 3D humanoid bone coordinates (`headBone.getWorldPosition() + headUp * offset`) through the Three.js `PerspectiveCamera` into 2D Normalized Device Coordinates (`.project(camera)`).
* **Kinetic Character**: The anchor remains rigidly glued to the projected 3D head crown in world space. Rotational dynamics are driven by 3D Euler angles (`yaw`, `pitch`, `roll`) which apply perspective shearing and squashing via `poseToCaptionTransform`.
* **Feel**: Rock-solid spatial stability, depth consistency during camera orbits and zooms, and cinematic anchoring.

Both paradigms offer distinct visual appeal: 2D formats deliver kinetic, tactile interplay, while 3D formats deliver spatial precision.

## Relevant Skills

- [[airi-caption-subsystem]]
