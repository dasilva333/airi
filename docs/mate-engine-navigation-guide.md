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

### Applying Patches Safely (`unity-src/Patches/`)
1. Never edit `mate-engine/` directly for custom code—those are ephemeral and overwritten during setup.
2. Put modified scripts in `apps/stage-mate/unity-src/Patches/<RelativePath>/ScriptName.cs`.
3. Run `pnpm -F @proj-airi/stage-mate run engine:setup` (or `build:mac` / `build:win`).
4. `setup.ts` automatically overlays the patch into the engine directory before building.
