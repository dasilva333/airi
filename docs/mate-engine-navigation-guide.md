# Mate-Engine Architecture & Navigation Guide

This document serves as the canonical technical navigation manual for developers and AI agents working with the Unity-based **Stage-Mate / Mate-Engine** companion runtime in AIRI.

---

## 0. Golden Rule of Workspace Purity: Never Edit `mate-engine/` Directly

`apps/stage-mate/mate-engine/` is a gitignored clone of upstream `shinyflvre/Mate-Engine`.

- **Pinned Canonical Upstream Commit**: `shinyflvre/Mate-Engine@2c5ea6b8f4cf5e1773a0816b46d9267cda5174d4` (`2c5ea6b8` — *"Prepare 3.4 Features"*).
- **Single Source of Truth**: All persistent modifications must live in `apps/stage-mate/unity-src/`:
  - `apps/stage-mate/unity-src/Assets/` (custom runtime scripts, bridge, probe)
  - `apps/stage-mate/unity-src/Patches/` (patches overlaid on `Assets/MATE ENGINE - Scripts/`)
  - `apps/stage-mate/unity-src/ProjectSettings/` (project configurations)
- **Automated Sync**: Every build command automatically runs `pnpm -F @proj-airi/stage-mate run engine:setup` (`scripts/setup.ts`), which overlays `unity-src/` onto `mate-engine/`.
- **Instant Clean Slate**: Run `pnpm -F @proj-airi/stage-mate run engine:clean` to instantly reset `mate-engine/` back to pristine upstream `2c5ea6b8`.
- **Durable Rule**: If an agent modifies `mate-engine/` directly, those changes pollute the local clone, break cross-platform dev between macOS/Windows, and evade Git tracking. Never edit `mate-engine/` directly.

---

## 0.1 Essential Navigation Tool: Unity Scene Graph Explorer (`scene-tree.ts`)

Instead of manually grepping through the 287,000-line `Mate Engine Main.unity` scene file, use the built-in, ultra-fast streaming Scene Inspector tool (`apps/stage-mate/scripts/scene-tree.ts`). It indexes the entire scene in **<150ms** and resolves GameObject relationships, transforms, and C# MonoBehaviour scripts.

### Available CLI Commands (from repo root or `apps/stage-mate`):

| Command | Usage | Description |
| :--- | :--- | :--- |
| **`pnpm -F @proj-airi/stage-mate run scene stats`** | `scene stats` | Prints total GameObjects, active vs inactive counts, RectTransforms, and MonoBehaviours. |
| **`pnpm -F @proj-airi/stage-mate run scene tree [RootName] [depth]`** | `scene tree SettingsMenuCanvas 3` | Renders an ASCII/Markdown hierarchy tree showing active states (`[🟢 Active]` / `[🔴 Inactive]`), UI RectTransform bounds, and attached scripts. |
| **`pnpm -F @proj-airi/stage-mate run scene find <query>`** | `scene find OuterMenu` | Searches by GameObject name, Script Class, GUID, or fileID. Prints breadcrumb paths and components. |
| **`pnpm -F @proj-airi/stage-mate run scene path <nameOrId>`** | `scene path OuterMenu` | Traverses up `m_Father` pointers to print the exact Root-to-Leaf ancestor chain (critical for discovering inactive parents!). |
| **`pnpm -F @proj-airi/stage-mate run scene dump-md`** | `scene dump-md` | Generates the complete collapsible Markdown reference map: [`docs/mate-scene-hierarchy.md`](./mate-scene-hierarchy.md). |

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

### 11.3. The Radial Scale-Tweening Trap (`IsRadialOpen()` vs `CircleSelector.opened`)
- **The Upstream Implementation**:
  ```csharp
  bool IsRadialOpen() => radialMenuObject && radialMenuObject.transform.localScale.x > 0.01f;
  ```
- **The Pitfall**: In `Mate Engine Main.unity`, `radialMenuObject` (the PieMenu canvas) is saved with default serialized scale `localScale = (1, 1, 1)`. When the application boots, `localScale.x == 1.0f > 0.01f` evaluates to `true` before `CircleSelector` finishes its scale-down tween.
- **The Consequence**: Because `radialBlockMovement == true`, `IsMovementBlocked()` evaluates to `true` on boot, immediately and silently killing left-click Ki dragging on frame tick.
- **The Durable Fix**: In `MenuActions.cs`, `IsRadialOpen()` must check the true semantic boolean `radialMenu.opened`:
  ```csharp
  bool IsRadialOpen()
  {
      if (radialMenu != null) return radialMenu.opened;
      return radialMenuObject && radialMenuObject.transform.localScale.x > 0.01f;
  }
  ```

### 11.4. The Inactive `EventSystem` & UI Pointer Raycast Trap
- **The Problem**: In `Mate Engine Main.unity`, the Unity `EventSystem` GameObject was serialized with `m_IsActive: 0`.
- **The Consequence**: Without an active `EventSystem`, Unity cannot process 2D UI pointer raycasts (`ProbeUIHits` returns `[NoEventSystem]`). Mouse clicks on UI elements fail, right-clicks cannot trigger radial buttons, and coroutine execution throws `Coroutine couldn't be started because the game object is inactive!`.
- **The Invariant**: `StageMateBridge.SuppressStandaloneUI()` must dynamically locate or instantiate an active `EventSystem` + `StandaloneInputModule` on boot:
  ```csharp
  if (EventSystem.current == null)
  {
      var existing = FindFirstObjectByType<EventSystem>(FindObjectsInactive.Include);
      if (existing != null)
      {
          existing.gameObject.SetActive(true);
          existing.enabled = true;
      }
      else
      {
          var esGo = new GameObject("StageMateEventSystem");
          esGo.AddComponent<EventSystem>();
          esGo.AddComponent<StandaloneInputModule>();
      }
  }
  ```

### 11.5. Persistent Modal Canvas Lockout (`SettingsMenuCanvas`)
- Upstream `SettingsMenuCanvas` has `blockMovement: 1` configured in `MenuActions.menuEntries`.
- If the application is closed while the settings menu is open (or serialized active in the scene YAML), `SettingsMenuCanvas.activeInHierarchy` starts `true` on subsequent launches.
- **The Invariant**: `StageMateBridge.cs` must enforce a clean state reset during `SuppressStandaloneUI()`, explicitly calling `menuActions.CloseAllMenus()` and deactivating all known standalone modal canvas names (`SettingsMenuCanvas`, `AvatarLibraryCanvas`, `TutorialMenuCanvas`, `QuickMenuCanvas`, `AlarmsMenuCanvas`, `ChatCanvas`).

### 11.6. The Inactive Root `UI` Hierarchy Trap (`Circle Selector` / Pie Menu Activation)
- **Failure Symptom**: Right-clicking the avatar produces the menu sound effect and triggers character facial/body reactions, but the radial menu never appears on screen. `Player.log` emits:
  ```text
  Coroutine couldn't be started because the game object 'Circle Selector' is inactive!
  ```
- **Forensic YAML Object Chain (`Mate Engine Main.unity`)**:
  ```text
  1. MenuActions (GUID: c347cc09ec9d33a408d0652592dbcaeb, Scene #L103478)
     └── radialMenuObject: {fileID: 534228283}
  2. Circle Selector (GameObject #L19459, Prefab GUID: 483c946d35a69704b9c4e151528ab04c)
     └── PrefabInstance: {fileID: 1096526317} (#L81990)
  3. Parent Canvas (RectTransform &743501261, GameObject #L32860)
     └── m_Father: {fileID: 234665254}
  4. Grandparent UI Root (Transform &234665254, GameObject #L6422)
     ├── m_Name: UI
     └── m_IsActive: 0   ◄── [ROOT CAUSE: Inactive root disables all descendant UI raycasts/renders]
  ```
- **The Invariant**: `CircleSelector.Open()` and `StageMateBridge.SuppressStandaloneUI()` must dynamically traverse `transform.parent` up to root and activate the entire ancestor chain:
  ```csharp
  Transform cur = circleSelector.transform;
  while (cur != null)
  {
      if (!cur.gameObject.activeSelf)
          cur.gameObject.SetActive(true);
      cur = cur.parent;
  }
  ```
- In addition, `CircleSelector.RefreshAllButtonColorsDelayed()` must safely fallback to synchronous `RefreshAllButtonColors()` whenever `!gameObject.activeInHierarchy` to prevent coroutine spawn aborts.

---

## 12. Telemetry & Live Diagnostic Probing (`MateTelemetryProbe.cs`)

Located in `apps/stage-mate/unity-src/Assets/StageMate/Core/MateTelemetryProbe.cs`:
A real-time diagnostic component attached to the sidecar root that streams live telemetry to `Player.log`:

```text
[MateTelemetryProbe:STATE] UnityMouse=(764.0, 333.0) | OSPos=(731.5, 310.8) | WinPos=(0.0, 0.0) | WinSize=(768.0, 512.0) | Screen=(1536x1024) | clickThrough=False | 3DHit=Model (Layer:Model) | UIHits=[None] | Dragging=False | Gates=[TutDone:True, TutActive:False, MoveBlocked:False(None), BlockOverride:False, EventSysActive:True]
```

### The 5 Lockout Gates Monitored in Real Time:
1. **`TutDone`**: `SaveLoadHandler.Instance.data.tutorialDone` (must be `True`).
2. **`TutActive`**: `TutorialMenu.IsActive` (must be `False`).
3. **`MoveBlocked`**: `MenuActions.IsMovementBlocked()` with exact active blocking menu list (must be `False(None)`).
4. **`BlockOverride`**: `AvatarAnimatorController.BlockDraggingOverride` (must be `False` in normal mode).
5. **`EventSysActive`**: `EventSystem.current.isActiveAndEnabled` (must be `True`).

---

## 13. Submodule Isolation & Versioned Overlay Architecture

```text
apps/stage-mate/
├── mate-engine/                 # ◄── Pristine upstream git repository (gitignored, NEVER edited directly)
├── unity-src/                   # ◄── Single Source of Truth (tracked in root AIRI repo)
│   ├── Assets/                  # ◄── Custom scripts & bridge (StageMateBridge, MateTelemetryProbe, VRMLoader)
│   ├── Patches/                 # ◄── Overrides for upstream MATE ENGINE - Scripts/
│   │   ├── AvatarHandlers/      # ◄── AvatarAnimatorController, AvatarGravityController, etc.
│   │   ├── Settings/            # ◄── MenuActions, IgnoredAppsManager, SettingsMenuPosition
│   │   └── Tasty Pie Menu/      # ◄── CircleSelector.cs
│   └── ProjectSettings/         # ◄── Version-controlled Unity project settings
├── backups/                     # ◄── Complete upstream diff patches & WIP safety snapshots
└── scripts/
    ├── setup.ts                 # ◄── Overlay sync engine: copies unity-src/ -> mate-engine/
    └── build.ts                 # ◄── Headless Unity batchmode build orchestrator
```

### The Setup Pipeline (`pnpm run engine:setup`)
1. Ensures `mate-engine/` exists (clones upstream if absent).
2. Overlays `unity-src/Assets/` $\rightarrow$ `mate-engine/Assets/`.
3. Overlays `unity-src/Patches/` $\rightarrow$ `mate-engine/Assets/MATE ENGINE - Scripts/`.
4. Overlays `unity-src/ProjectSettings/` $\rightarrow$ `mate-engine/ProjectSettings/`.
5. Executes automated compatibility transformations (`preserveFramebufferAlpha`, `patchSettingsMenuUI`).

---

## 14. 3D Floatie / Prop Subsystems & Interactive Flavor Cycling

Located in `Assets/noirunn/KawaiiMacaronMotion/` and managed via `AvatarBubbleHandler.cs`:

### 14.1. Asset Anatomy & Skeletal Sync
1. **3D Prop Mesh (`FBX/macaron.fbx`)**:
   - A fully modeled 3D sandwich cookie with whip cream filling and candy heart toppings.
   - Casts dynamic Unity shadows and renders in real-time alongside the avatar.
2. **3-Slot Material Pipeline**:
   - **Slot 0 (Cookie Shell)**: Base color (`pink`, `blue`, `green`, `yellow`, `purple`, `brawn`, `orange`).
   - **Slot 1 (Whip Cream)**: Cream filling (`berry`, `chocolate`, `matcha`, `milk`, `strawberry`).
   - **Slot 2 (Heart Topping)**: Candy topper accent (`pink`, `blue`, `green`, `yellow`, `purple`, `brawn`, `orange`).
3. **Character Skeletal Pose (`KawaiiMacaronMotion01.anim`)**:
   - Synchronized with `AvatarBubbleHandler`: `animator.SetBool("isSitting", true)` switches the VRM avatar into a floating/swimming pose with elbows resting on the top cookie and legs kicking in the air.

### 14.2. Stateless Unity Bridge & Sidecar Wire Protocol (`stage:prop:macaron`)

Rather than mutating upstream C# scripts or hardcoding state cycles into Unity, AIRI adopts a **stateless rendering engine + intelligent sidecar harness** architecture:

1. **Hierarchy Reference in Scene**:
   - The active 3D prop is located at `BarObject/Macaroon` in `Mate Engine Main.unity`.
   - MeshRenderer has 3 material slots:
     - **Slot 0**: `Base` (Cookie Shell)
     - **Slot 1**: `Whip` (Cream Filling)
     - **Slot 2**: `Heart` (Candy Heart Accent)

2. **Wire Protocol Specification (`stage:prop:macaron`)**:
   ```json
   {
     "type": "stage:prop:macaron",
     "data": {
       "materials": {
         "shell": "green", // pink | blue | green | yellow | purple | brawn | orange
         "whip": "matcha", // milk | strawberry | matcha | chocolate | berry
         "heart": "green" // pink | blue | green | yellow | purple | brawn | orange
       }
     }
   }
   ```

3. **Dynamic Material Loading**:
   - `scripts/setup.ts` overlays all 19 material assets into `Assets/Resources/Materials/`.
   - `StageMateBridge.ApplyMacaronMaterials()` dynamically loads materials via `Resources.Load<Material>($"Materials/{Category}/{name}")` and updates `MeshRenderer.sharedMaterials` in runtime memory with zero latency and zero frame hit.

4. **12 Canonical Flavor Presets (Defined in Harness / TypeScript)**:
   | Index | Preset Name | Shell | Whip | Heart |
   | :--- | :--- | :--- | :--- | :--- |
   | 1 | **Strawberry Cream (Default)** | `pink` | `berry` | `pink` |
   | 2 | **Vanilla Strawberry** | `pink` | `milk` | `blue` |
   | 3 | **Chocolate Berry** | `pink` | `chocolate` | `brawn` |
   | 4 | **Mint Fresh** | `blue` | `milk` | `blue` |
   | 5 | **Blueberry Whip** | `blue` | `berry` | `purple` |
   | 6 | **Mint Choco** | `blue` | `chocolate` | `brawn` |
   | 7 | **Matcha Classic** | `green` | `matcha` | `green` |
   | 8 | **Matcha Milk** | `green` | `milk` | `yellow` |
   | 9 | **Matcha Chocolate** | `green` | `chocolate` | `brawn` |
   | 10 | **Lemon Custard** | `yellow` | `milk` | `yellow` |
   | 11 | **Lavender Berry** | `purple` | `berry` | `purple` |
   | 12 | **Mocha Caramel** | `brawn` | `chocolate` | `brawn` |

5. **Interactive Harness Integration**:
   - In `apps/stage-mate/harness/index.ts`, hotkey `[P]` dynamically steps through the 12 presets live over WebSocket.

---

## 15. Window Sitting, Taskbar/Dock Snapping & macOS Coordinate Unification

### 15.1. Architectural Anatomy: `AvatarWindowHandler` vs Legacy `AvatarTaskbarController`
- **Active Scene Component**: In upstream MateEngine (`Mate Engine Main.unity`), both window ledge sitting and taskbar sitting are unified under **`AvatarWindowHandler.cs`** attached to the avatar root.
- **The Core State Machine**:
  - `isWindowSit` (bool) & `isTaskbarSit` (bool): Drive the sitting animation layers and disable standard locomotion.
  - `WindowSitIndex` (float): Cycles through distinct physical sitting postures (e.g., lying flat on chest with legs kicked up, sitting upright, dangling legs, leaning on elbows).
  - `PinToTarget(RECT tr)`: Smoothly dampens and pins the avatar's hip anchor to the target ledge.
  - `FollowSnapped(bool isDragging)`: Keeps the avatar anchored to the target ledge during window moves and unsnaps when pulled away vertically.

### 15.2. macOS Cocoa Coordinate Inversion (Bottom-Up vs Top-Down)
Desktop coordinate geometries differ fundamentally between platforms:
- **Windows (Top-Down)**: Desktop origin `(0, 0)` is at the **top-left**. The taskbar is located at `y = ScreenHeight - TaskbarHeight`, and the sit ledge is `taskbar.top`.
- **macOS Cocoa (Bottom-Up)**: Desktop origin `(0, 0)` is at the **bottom-left**. The Dock is located at `y = 0 .. DockHeight` (default `66px`), and the sit ledge is at `y = DockHeight`.
- **Projection Mapping**:
  - In `ComputeDesktopFromWorld()` and `CalibrateSeatAnchorToDesktopY()`:
    - **macOS**: `py = uCli.Top + (sp.y / cam.pixelHeight) * uCli.Height`
    - **Windows**: `py = uCli.Top + (cam.pixelHeight - sp.y) * uCli.Height`
  - In `MacScreenBridge.mm`: Dock rect is reported as `Rect(visible.origin.x, 0, visible.size.width, visible.origin.y)`.

### 15.3. Vertical Drag Overflow & Hip-Anchored Snapping
- **The Hip Anchor Contract**: Avatars do not sit from their feet; their seat anchor is located at the 3D **`HumanBodyBones.Hips`** bone.
- **Leg Overflow**: To allow the avatar's hips to rest flush on the 66px Dock ledge, the lower half of the Unity transparent window (`y < 0`) must be allowed to sink below the bottom screen edge.
- **Unclamped Window Position**: `UniWindowController.windowPosition` must pass positions directly to `_uniWinCore.SetWindowPosition` without artificial `Mathf.Max(0f, value.y)` clamps.

### 15.4. Cross-Platform P/Invoke Safety Rules
To prevent runtime `DllNotFoundException` crashes on macOS and preserve Windows functionality:
1. **Process ID**: Use standard C# `(uint)Process.GetCurrentProcess().Id` rather than Windows `kernel32.dll!GetCurrentProcessId`.
2. **Cursor Position**: Use `SafeGetCursorPos` reading `UniWindowController.current.cursorPosition` rather than Win32 `user32.dll!GetCursorPos`.
3. **Window Enumeration & Visibility**: Scope `EnumWindows`, `IsIconic`, `GetWindowPlacement`, `GetWindowThreadProcessId`, and `SetWindowPos` under `#if UNITY_STANDALONE_WIN`.
4. **Dock Registration (`cachedWindows`)**: On macOS, `UpdateCachedWindows()` inserts the macOS Dock entry directly into `cachedWindows`, immediately activating the upstream sitting blend tree and gesture engine.
5. **Phase 2 Expansion**: Querying `CGWindowListCopyWindowInfo` to register visible window headers into `cachedWindows` unlocks sitting on top of any macOS app window (Safari, Finder, Discord) with zero extra changes.

## Relevant Skills

- [[airi-stage-mate-unity]]
