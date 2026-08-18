# Mate-Engine Architecture & Navigation Guide

This document serves as the canonical technical navigation manual for developers and AI agents working with the Unity-based **Stage-Mate / Mate-Engine** companion runtime in AIRI.

---

## 0. Golden Rule of Workspace Purity: Never Edit `mate-engine/` Directly

`apps/stage-mate/mate-engine/` is a gitignored clone of upstream `shinyflvre/Mate-Engine`.

- **Single Source of Truth**: All persistent modifications must live in `apps/stage-mate/unity-src/`:
  - `apps/stage-mate/unity-src/Assets/` (custom runtime scripts, bridge, probe)
  - `apps/stage-mate/unity-src/Patches/` (patches overlaid on `Assets/MATE ENGINE - Scripts/`)
  - `apps/stage-mate/unity-src/ProjectSettings/` (project configurations)
- Every build command automatically runs `pnpm -F @proj-airi/stage-mate run engine:setup` (`scripts/setup.ts`), which overlays `unity-src/` onto `mate-engine/`.
- If an agent modifies `mate-engine/` directly, those changes pollute the local clone and evade root Git versioning and bisections.

---

## 1. Anatomy of Unity's "Kraken" File (`.unity` Scene YAML)

When inspecting `apps/stage-mate/mate-engine/Assets/MATE ENGINE - Scenes/Mate Engine Main.unity` (~287,000 lines), it looks like an insurmountable monolith. In reality, **it is not code—it is a declarative YAML object graph of the entire game world**.

### How Unity Serializes a Scene

In Unity YAML serialization:
1. **GameObjects (`!u!1`)**: Containers in the hierarchy (e.g., `Model`, `Camera`, `RadialMenu`, `Canvas`).
2. **Transforms / RectTransforms (`!u!4` / `!u!224`)**: Position, rotation, scale, and UI anchoring.
3. **MonoBehaviours (`!u!114`)**: Custom C# scripts attached to GameObjects.
4. **Prefabs & PrefabInstances (`!u!1001`)**: Reusable component templates stamped into the scene.

```yaml
--- !u!1 &1274733643              # ◄── GameObject Unique File ID in this scene
GameObject:
  m_Name: Smoothie                # ◄── Hierarchy Name
  m_Component:
  - component: {fileID: 1274733647} # Transform / RectTransform
  - component: {fileID: 1274733644} # C# MonoBehaviour (Xamin.Button)
--- !u!114 &1274733644            # ◄── MonoBehaviour instance
MonoBehaviour:
  m_Script: {fileID: 11500000, guid: 1cd1666868d70ec4281ca5d7234c891a, type: 3} # ◄── Points to C# Script GUID
  id: smoothie                    # ◄── Serialized Public Field
```

> [!TIP]
> **Why Line Numbers Drift, But GUIDs & IDs Are Eternal**:
> Never rely purely on raw `.unity` line numbers because adding a GameObject renumbers the entire file. Instead, search by:
> - **C# Script GUID** (found in `ScriptName.cs.meta`)
> - **Component Field Name / String** (e.g. `id: chat`, `id: chibi`)
> - **Class Name** (e.g. `class AvatarAnimatorController`)

---

## 2. Minimalist Subtractive Philosophy: How We Disabled Features

When the user asks to remove buttons or bypass features, **we do NOT excise, delete, or rewrite the underlying subsystems**.

### The Strategy
1. **Underpinnings Intact**: All feature code (`AvatarBigScreenHandler`, `DancePlayer`, `ChatBox`, `Alarms`) remains 100% compiled and unharmed in the scene.
2. **View-Layer Filter**: We intercepted `CircleSelector.ShouldHideButton(btn)`:
   ```csharp
   bool ShouldHideButton(Xamin.Button btn)
   {
       if (btn != null)
       {
           // Filter out alarms, standalone chatbox, and play button
           if (btn.id == "alarm" || btn.id == "chat" || btn.id == "dances")
               return true;
       }
       // ... standard state checks (animator booleans, clothing checks)
   }
   ```
3. **Dynamic Redistribution**: `CircleSelector` reads `visibleCount`, divides $360^\circ$ by the new count, and animates the remaining buttons into a perfect ring with zero gaps or dead slots.

---

## 3. The Radial Pie Menu (`CircleSelector.cs`) Button Registry

The radial menu is triggered via `F1` (or middle click) and dynamically builds its slices around the avatar's head bone.

| Button `id` | Hierarchy Name | C# Target / Method | Purpose / Description | Status in AIRI |
| :--- | :--- | :--- | :--- | :--- |
| `chibi` | Chibi | `UISetOnOff.ToggleChibiMode()` | Toggles SD / Chibi bobblehead avatar mode | **Active** |
| `bigscreen` | BigScreen | `UISetOnOff.ToggleBigScreenFeature()` | **Face Mode**: Zooms camera close-up to avatar face | **Active** |
| `settings` | Settings | `UISetOnOff.SetOnOff()` | Opens settings gear overlay | **Active** |
| `blendshapes` | Blendshapes | `UISetOnOff.SetOnOff()` | Opens facial expression slider drawer | **Active** |
| `clothes` | Clothes | `UISetOnOff.SetOnOff()` | Modular outfit / costume selector | **Active** |
| `macaroon` | Macaroon | `UISetOnOff.ToggleBubbleFeature()` | Spawn macaron bed / furniture bubble | **Active** |
| `cake` | Cake | `AvatarFoodController.ToggleById("cake")` | Feed avatar strawberry cake | **Active** |
| `smoothie` | Smoothie | `AvatarFoodController.ToggleById("smoothie")` | Feed avatar smoothie drink | **Active** |
| `jumpoff` | JumpOff | `UISetOnOff.UnsnapAllAvatars()` | Force avatar to jump off window/taskbar | **Active (Conditional)** |
| `alarm` | Alarm | `UISetOnOff.SetOnOff()` | Standalone alarm & timer UI window | ❌ **Hidden (Filtered)** |
| `chat` | Chat | `UISetOnOff.SetOnOff()` | Standalone AI chatbox (AIRI replaces this) | ❌ **Hidden (Filtered)** |
| `dances` | Dances | `UISetOnOff.SetOnOff()` | Standalone MMD dance playlist trigger | ❌ **Hidden (Filtered)** |

---

## 4. Key Script & Component Catalog

### 4.1. Core Avatar Lifecycle & Model Loading
* **`AvatarModelLoader.cs`**: Instantiates and initializes loaded models under the `Model` root.
* **`VrmLoader.cs` / `Vrm10Instance`**: UniVRM importer that parses `.vrm` 0.x and 1.0 models at runtime.
* **`StageMateBridge.cs`** (`Assets/StageMate/StageMateBridge.cs`):
  - AIRI's injected sidecar listener.
  - Connects to `ws://localhost:6171`.
  - Receives `stage:state:sync` and routes models directly to `VrmLoader.LoadModel(filePath)`.

### 4.2. Animation & Expressions
* **`AvatarAnimatorController.cs`**: Master state machine manager for idle, dragging, sitting, sleeping, and head turns.
  - *Patch*: `NAudio.CoreAudioApi` guarded with `#if UNITY_STANDALONE_WIN`.
* **`AvatarBlendshapeController.cs`**: Direct blendshape proxy driving ARKit / VRM facial morphs (`Joy`, `Angry`, `Sorrow`, `Fun`, `Blink`, `MouthOpen`).
* **`AvatarAnimatorReceiver.cs`**: Dispatches animation events between UI buttons and the avatar's active `Animator`.

### 4.3. Window Management & Desktop Transparency
* **`UniWindowController.cs`**: Handles desktop transparency, borderless click-through, hit-testing, and window dragging.
* **`AvatarWindowHandler.cs`**:
  - Detects active OS windows for the avatar to sit on.
  - *Patch*: `SetWindowPos` guarded with `#if UNITY_STANDALONE_WIN`.
* **`AvatarGravityController.cs`**:
  - Applies inertia/gravity physics forces to VRM SpringBones during companion movement.
  - *Patch*: `GetWindowRect` guarded with `#if UNITY_STANDALONE_WIN`.

### 4.4. LookAt & Eye Tracking
* **`AvatarLookAtController.cs` / `MateSidecar.cs`**:
  - Gaze tracking solver.
  - *Critical Invariant*: UniVRM internal `VRMLookAtHead` and `Vrm10Instance.LookAtTarget` **must be set to null / disabled** when gaze is inactive, or the solver will invert the avatar's head 180° backwards.

---

## 5. Cheat Sheet: How Future Agents Should Search & Patch

### Searching for Components in Unity YAML
```bash
# 1. Find the GUID of a script:
cat "apps/stage-mate/mate-engine/Assets/MATE ENGINE - Scripts/Settings/MenuActions.cs.meta"

# 2. Find every GameObject in the scene using that script:
grep -n "guid: <GUID_HERE>" "apps/stage-mate/mate-engine/Assets/MATE ENGINE - Scenes/Mate Engine Main.unity"

# 3. Find specific button configurations by string ID:
grep -n "id: <BUTTON_ID>" "apps/stage-mate/mate-engine/Assets/MATE ENGINE - Scenes/Mate Engine Main.unity"
```

### Applying Patches Safely (`unity-src/Patches/` and `scripts/setup.ts`)
1. Never edit `mate-engine/` directly for custom code—those are ephemeral and overwritten during setup.
2. Put modified scripts in `apps/stage-mate/unity-src/Patches/<RelativePath>/ScriptName.cs`.
3. Put modified package runtime scripts in `apps/stage-mate/unity-src/Packages/<RelativePath>/ScriptName.cs`.
4. Run `pnpm -F @proj-airi/stage-mate run engine:setup` (or `build:mac` / `build:win`).
5. `setup.ts` automatically overlays patches, synchronizes packages, and runs automated scene/C# pre-compilation passes before building.

---

## 6. Settings Panel Hierarchy & Modular Cleanups

The settings overlay is a scrollable UI panel managed by `AvatarSettingsMenu.cs` and modular handler classes under `MATE ENGINE - Scripts/Settings/SettingsMenu/`.

### 6.1. Scene Hierarchy Map (`Mate Engine Main.unity`)
Inside the scene YAML, the main settings view is grouped under **`Main Menu`** (Transform `3252351821447245177`):

| Section Name Anchor (`m_Name`) | Purpose / Feature | Default State | Status in AIRI |
| :--- | :--- | :--- | :--- |
| `= MOVEMENT` | Head/Eye/Spine follow, IK Feet, Hand Holding, Husbando toggle | `m_IsActive: 1` | **Active** |
| `= APPEARANCE` | Particle themes, Hue Shift, Saturation, Bloom, Day/Night | `m_IsActive: 1` | **Active** |
| `= AUDIO` | Pet volume, Sound effects, Menu volume, Voice pack | `m_IsActive: 1` | **Active** |
| `= DANCING` | Auto-dance intervals, Dance transitions, Allowed music apps | `m_IsActive: 1` | **Active** |
| `= SCREENSAVER` | Inactivity timer close-up / screensaver | `m_IsActive: 1` | **Active** |
| `= WINDOW FEATURE` | Window sitting Y-offset, Title-bar latching | `m_IsActive: 1` | **Active** |
| `= GENERAL` | Topmost toggle, FPS limiter, Language selector | `m_IsActive: 1` | **Active** |
| `= AI` | Standalone local LLaMA prompt box & context length | `m_IsActive: 1` | ❌ **Disabled (`setup.ts`)** |
| `= STEAM DLC` | Standalone Steam Halo/Mask upsell promo card | `m_IsActive: 1` | ❌ **Disabled (`setup.ts`)** |
| `= FOOD SYSTEM` | Standalone Smoothie/Cake early-access paywall card | `m_IsActive: 1` | ❌ **Disabled (`setup.ts`)** |
| `= MINECRAFT` | Standalone Minecraft UDP event integration promo card | `m_IsActive: 1` | ❌ **Disabled (`setup.ts`)** |
| `= Steam Exklusives` | Standalone Steam exclusive accessories list | `m_IsActive: 1` | ❌ **Disabled (`setup.ts`)** |

### 6.2. Decoupled Card Backgrounds & Graphics Containers
Unlike standard UI layout systems where background containers enclose their children, Mate Engine decouples background visuals into parallel sibling GameObjects:
1. **`Category Background` Container** (GO `1621117029`):
   - Contains individual rectangular translucent image cards (`Image (2)` through `Image (14)`), each positioned at fixed manual Y offsets.
   - `Image (10)` (GO `1420350588`, height $803.5\text{px}$): AI card frame.
   - `Image (12)` (GO `1409282222`, height $436\text{px}$): Steam DLC card frame.
   - `Image (14)` (GO `839638719`, height $284\text{px}$): Food System card frame.
   - `Image (13)` (GO `1922270003`, height $284\text{px}$): Minecraft card frame.
   - **Fix**: All 4 unused background frames are deactivated via `m_IsActive: 0`.
2. **Graphic Artwork Containers**:
   - The Smoothie wallpaper (`Food System` GO `234303499`), Minecraft background (`MinecraftPanel` GO `1344334329`), and Steam Halo illustrations (`SteamContent` GO `1247369941`) are deactivated via `m_IsActive: 0`.

### 6.3. Geometry Alignment & Scroll Bounds Clamping
Because the menu does not use a `VerticalLayoutGroup`, removing the 800px AI block leaves a void between `= SCREENSAVER` and `= DEBUG`.
- **DEBUG Repositioning**:
  - `DEBUG` header (RT `976934797`) shifted from $y = -3418$ up to $y = -2604$.
  - `Image (11)` DEBUG card frame (RT `820205948`) shifted from $y = -3643$ up to $y = -2828$.
- **Scroll Bounds Clamping**:
  - Scroll container (RT `6157687972013927576`) trimmed from hardcoded height $5000\text{px} \rightarrow 3100\text{px}$, completely eliminating trailing whitespace.

> [!NOTE]
> **Automated Scene Patching (`patchSettingsMenuUI`)**:
> `apps/stage-mate/scripts/setup.ts` automatically executes these deactivations, coordinate shifts, and scroll bounds resizings during every `engine:setup`.

---

## 7. Coordinate Space Inversion & macOS Cocoa Blur Safeguard

### 7.1. The Root Cause of the Negative Y Underflow Bug
- **Windows / Web / Unity UI**: Desktop origin $(0, 0)$ is at **top-left**, with $Y$ increasing downwards.
- **macOS Cocoa (`NSWindow`)**: Desktop origin $(0, 0)$ is at **bottom-left**, with $Y$ increasing upwards.
- `LibUniWinC` (the native macOS windowing plugin) converts coordinates via:
  $$Y_{\text{cocoa}} = \text{ScreenHeight} - Y_{\text{topleft}} - \text{WindowHeight}$$
- When focus leaves the window, `UniWindowController.UpdateClickThrough()` calls `SetClickThrough(true)`, altering the Cocoa window mask (`[window setIgnoresMouseEvents:YES]`).
- On Retina / high-DPI displays, changing the mask triggers a Cocoa frame recalculation with mismatched scale factors, causing $Y$ to jump into negative numbers (e.g. `(35, -354)`), pushing the avatar under the Dock.

### 7.2. The Durable Coordinate Clamp
In `UniWindowController.cs`:
1. **Clamped Setter**:
   ```csharp
   public Vector2 windowPosition
   {
       get { return (_uniWinCore != null ? _uniWinCore.GetWindowPosition() : Vector2.zero); }
       set
       {
           #if (UNITY_STANDALONE_OSX || UNITY_EDITOR_OSX)
           Vector2 safeVal = new Vector2(value.x, Mathf.Max(0f, value.y));
           _uniWinCore?.SetWindowPosition(safeVal);
           #else
           _uniWinCore?.SetWindowPosition(value);
           #endif
       }
   }
   ```
2. **Blur Event Recovery**:
   ```csharp
   private void OnApplicationFocus(bool focus)
   {
       if (focus) { ... }
       #if (UNITY_STANDALONE_OSX || UNITY_EDITOR_OSX)
       else
       {
           Vector2 cur = windowPosition;
           if (cur.y < 0f) windowPosition = new Vector2(cur.x, 0f);
       }
       #endif
   }
   ```

---

## 8. Character Profiles & Motion Modes (`Husbando` vs `Waifu`)

Located in `AvatarAnimatorController.cs` (lines 44-65):
* **`enableHusbandoMode == false` (Default / Waifu Mode)**:
  - Sets animator parameters: `isFemale = 1.0f`, `isMale = 0.0f`.
  - Stance: Narrower feet, inward toes, cute hip sway during idle cycles, soft resting arm gestures.
* **`enableHusbandoMode == true` (Husbando Mode)**:
  - Sets animator parameters: `isFemale = 0.0f`, `isMale = 1.0f`.
  - Stance: Broader shoulder-width stance, neutral grounded posture, masculine idle breathing cycles tailored for male VRM avatars.

---

## 10. Native Avatar Rigs vs. Dynamic Runtime VRM Importers

### 10.1. The Authored Scene Rig
In `Mate Engine Main.unity`, the native `DEFAULT AVATAR` (`VRMModel`) contains a rich nested GameObject hierarchy pre-authored in the Unity editor:
```text
DEFAULT AVATAR (VRMModel)
├── ADS_ProxyRoot                # ◄── Physics proxy for Ki dragging & body drag inertia
├── TransformFX                  # ◄── Ki Aura particle system & drag glow
├── HandColliders (L/R)          # ◄── Trigger zones for cursor hand-holding IK
├── HeadPettingTriggerZone       # ◄── Mesh collider for blush / petting reactions
└── AudioSources (DragStart/End) # ◄── Audio emitters for dragging sounds
```

### 10.2. The Runtime Importer Limitation (`VRMLoader.LoadVRM`)
When a model is dynamically loaded at runtime via `VRMLoader.LoadVRM()`:
1. `VRMLoader` instantiates the raw imported GLB/VRM root (`CustomVRM(Clone)`).
2. `InjectComponentsFromPrefab()` copies flat `MonoBehaviour` script components onto the model.
3. **Critical Trap**: `InjectComponentsFromPrefab()` copies C# scripts, but **does not construct nested child GameObjects** (`ADS_ProxyRoot`, hand colliders, audio source objects).
4. **The Consequence**: `AvatarAnimatorController` and `AvatarLocomotionController` require `ADS_ProxyRoot` to calculate dragging momentum. If `ADS_ProxyRoot` is absent or unassigned, dragging silently aborts every frame and locks the model in its idle stance.
5. **Architectural Invariant**: `StageMateBridge` must **never eagerly swap the native avatar on boot**. The pristine `DEFAULT AVATAR` must remain active for standalone/default companion mode, and dynamic imports must only occur on explicit IPC commands (`stage:vrm:load` / `stage:state:sync`).

---

## 11. Global Interaction Gates & Lockouts

Mate Engine contains two global static lockouts that can silently disable 100% of companion physics, dragging, and locomotion:

### 11.1. `TutorialMenu.IsActive` Lockout
- When `settings.json` is fresh or missing (`data.tutorialDone == false`), `TutorialMenu.cs` sets `TutorialMenu.IsActive = true`.
- While `TutorialMenu.IsActive == true`:
  - `AvatarAnimatorController.cs` (lines 140/156): `if (TutorialMenu.IsActive) { if (isDragging) SetDragging(false); return; }`
  - `MenuActions.cs` (line 88): `moveCanvas.SetActive(!TutorialMenu.IsActive)`
- **The Pitfall**: If an agent hides the tutorial Canvas without setting `tutorialDone = true`, `TutorialMenu.IsActive` remains stuck at `true` in static memory forever, freezing all waist-dragging and ki physics.
- **The Invariant**: `StageMateBridge.cs` must explicitly set `SaveLoadHandler.Instance.data.tutorialDone = true` and auto-dismiss `TutorialMenu` on startup.

### 11.2. `MenuActions.IsMovementBlocked()` Lockout
- `MenuActions.cs` scans all `menuEntries`. If any menu whose `blockMovement == true` is currently `activeInHierarchy`, all movement and dragging are blocked globally.
- When customizing UI or opening custom drawers, always call `menuActions.CloseAllMenus()` or ensure standalone modal menus are deactivated.


