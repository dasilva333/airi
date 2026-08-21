# Project Gunslinger: Stage-Mate Companion Weapon & Aiming Mod

## 1. Executive Summary & Context

This document outlines the architectural plan, asset mapping, and cross-platform telemetry pipeline for integrating the **Gunslinger mod** (authored by yirehans in [`Mate-Engine-Gunslinger`](https://github.com/yirehans/Mate-Engine-Gunslinger)) into the AIRI **Stage-Mate** desktop sidecar runtime (`apps/stage-mate`).

### Upstream Reference
- **Source Repository**: `yirehans/Mate-Engine-Gunslinger` (Branch `main`, 9 commits ahead of upstream `shinyflvre/Mate-Engine:main`).
- **Base Commit**: `shinyflvre/Mate-Engine@2c5ea6b8f4cf5e1773a0816b46d9267cda5174d4` ("Prepare 3.4 Features").

---

## 2. Feature Mechanics & Scope

### 2.1 Visual & Interactive Behavior
1. **Dynamic Aiming Transition**: When the cursor enters the upper half of the desktop monitor (`y > yAimTreshold`), the avatar dynamically draws an M1911 handgun, attaches it to `HumanBodyBones.RightHand`, and enters an aiming stance.
2. **Inverse Kinematics (IK) Aiming**: The avatar's spine, upper chest, and right arm smoothly track the cursor position on the screen.
3. **Global Left-Click Firing**: When the user clicks the left mouse button anywhere on the screen:
   - Gun slide recoil animation executes.
   - Brass shell casing ejects.
   - Muzzle flash particle effect instantiates at the muzzle transform.
4. **Holster Transition**: When the cursor moves back below the threshold, the avatar holsters the weapon and returns to idle/locomotion.

### 2.2 Weapon Variants & Selection (The 4-Way Cycler: OFF > CAT > BLK > GRAY)
1. **Weapon Selection Protocol**: Stage-Mate supports switching active weapons via a WebSocket control message (`stage:control:weapon`).
2. **Stance Mapping**:
   - **`off` (Disabled / Safe)**: Companion remains in standard idle/locomotion mode; aiming IK and weapon attachment are completely disabled.
   - **`cat` (Cat Gun - Rapid Spray)**: Spawns the Cat Gun prefab on `HumanBodyBones.RightHand`. Supports holding left-click for continuous automatic firing.
   - **`blk` (M1911 Black)**: Spawns the Black M1911 handgun prefab. Semi-automatic single-shot trigger with slide recoil and brass casing ejection.
   - **`gray` (M1911 Silver)**: Spawns the Silver/Steel custom M1911 handgun prefab. Semi-automatic single-shot trigger.
3. **Purge of Background Keystroke Hooks**:
   - Upstream Gunslinger polled global Windows keyboard hooks (`GetAsyncKeyState(0x31/0x32)`), which intercepted typing in other desktop applications.
   - AIRI completely replaces background keyhooks with typed Control Strip / WebSocket telemetry events (`stage:control:weapon`).

---

## 3. Asset & Patch Manifest (Stage-Mate Overlay Architecture)

In accordance with the **Stage-Mate Workspace Purity Contract** in `AGENTS.md`, no files inside `apps/stage-mate/mate-engine/` may be edited directly. All Gunslinger components map cleanly into `apps/stage-mate/unity-src/`:

```
apps/stage-mate/unity-src/
├── Assets/
│   ├── Gunslinger/
│   │   ├── Nokobot/
│   │   │   └── Modern Guns - Handgun/
│   │   │       ├── Animations/ (M1911 Handgun Controller, M1911@Fire.anim)
│   │   │       ├── Effects/ (MuzzleFlash.mat, MuzzleFlash.prefab, MuzzleFlash_SpriteSheet.png)
│   │   │       ├── Materials/ (M1911 Handgun_Black.mat, 45ACP_Bullet_Silver.mat, etc.)
│   │   │       ├── Meshes/ (M1911 Handgun.fbx, 45ACP Bullet.fbx, M1911 Magazine.fbx)
│   │   │       ├── Textures/ (Albedo, MetallicSmoothness, Normal maps)
│   │   │       └── _Prefabs/ (M1911 Handgun_Black (Shooting).prefab, Bullet_Casing.prefab, etc.)
│   │   └── Cat Gun/
│   │       ├── Cat Gun Controller.controller
│   │       ├── Cat Gun@FIre.anim
│   │       └── Cat Gun Shooting.prefab
│   ├── MATE ENGINE - Animations/
│   │   ├── AM Armed Base.mask
│   │   ├── AM Armed RArm.mask
│   │   ├── AvatarAnimatorControllerV2 1.controller
│   │   ├── Gunslinger_Handgun_Aim_FingerGun.anim
│   │   └── Gunslinger_Handgun_Fire_FingerGun.anim
│   └── Resources/
│       └── Gunslinger/
│           ├── M1911 Handgun_Black (Shooting).prefab
│           ├── M1911 Handgun_Silver (Shooting).prefab
│           └── Cat Gun Shooting.prefab
└── Patches/
    ├── GlobalMouse.cs (Win32 mouse position & click helper)
    ├── WinMonitorUtil.cs
    ├── WinMessageBox.cs
    ├── CustomVRM.prefab (Custom avatar prefab with weapon prefabs populated)
    └── AvatarHandlers/
        ├── AvatarHideHandler.cs (Exposes public Side snappedSide)
        └── AvatarMouseTracking.cs (Gunslinger upper-arm IK, weapon spawner, SetWeaponMode)
```

---

## 4. The Cross-Platform Global Mouse Challenge & Solution

### 4.1 The Platform Bottleneck in Upstream Gunslinger
Upstream `Mate-Engine-Gunslinger` implements `GlobalMouse.cs` by calling Windows Win32 APIs:
```csharp
[DllImport("user32.dll")]
static extern bool GetCursorPos(out POINT lpPoint);
[DllImport("user32.dll")]
static extern short GetAsyncKeyState(int vKey);
```
- **Windows**: Works natively across the entire virtual desktop.
- **macOS**: `user32.dll` is missing. Unity transparent borderless overlay windows cannot read cursor positions outside their window bounds without elevated OS Accessibility API permissions (`CGEventTap` / `NSEvent.mouseLocation`).

### 4.2 The AIRI Compact WebSocket Telemetry Solution
AIRI Electron Main Process already runs cross-platform native cursor tracking via `screen.getCursorScreenPoint()` and mouse event listeners.

Instead of relying on platform-specific P/Invoke inside Unity, AIRI streams cursor coordinates and click events over the local loopback WebSocket (`127.0.0.1`) directly to Stage-Mate:

#### Ultra-Compact Tuple Protocol:
To eliminate JSON serialization overhead and keep latency sub-millisecond ($< 0.3\text{ms}$), we use a positional array tuple payload:

```json
{
  "type": "stage:control:mouse",
  "data": [1420, 850, false]
}
```
*Schema: `[x: number, y: number, isLeftDown: boolean]`*

- **Packet Size**: $\approx 35 \text{ bytes}$
- **Transmission Latency**: $\approx 0.1\text{ms} - 0.2\text{ms}$ over loopback TCP (arrives within the current $16.6\text{ms}$ render frame).
- **Unity Processing**: Zero heap allocations. `StageMateBridge.cs` reads the tuple directly into a `struct MouseState { int x; int y; bool down; }` and smooths aiming in `LateUpdate()`.

---

## 5. Implementation & Build Flow

1. **Extract Assets & Prefabs**:
   Place `Assets/Gunslinger/` and animation clips into `apps/stage-mate/unity-src/Assets/`.
2. **Apply Script Patch**:
   Add cross-platform telemetry listener into `apps/stage-mate/unity-src/Patches/AvatarHandlers/AvatarMouseTracking.cs` with fallback to AIRI WebSocket stream when `user32.dll` is unavailable.
3. **Sync Overlays**:
   ```bash
   pnpm -F @proj-airi/stage-mate run engine:setup
   ```
4. **Compile Sidecar Binary**:
   - macOS: `pnpm -F @proj-airi/stage-mate run build:mac`
   - Windows: `pnpm -F @proj-airi/stage-mate run build:win`

---

## 6. Control Strip & Customizer Integration Specification

To support seamless, in-context weapon toggling and cycling, the Gunslinger mod integrates directly into the Control Strip Customizer under the **Actor & Wardrobe** settings panel.

### 6.1 Customizer Catalog Registration
Add a new 4-way cycler button entry `actor-gunslinger` into the `CUSTOMIZER_CATALOG` in [`packages/stage-ui/src/constants/control-customizer.ts`](file:///c:/Users/h4rdc/Documents/Github/airi-rebase-scratch/packages/stage-ui/src/constants/control-customizer.ts) right below the Macaron Floatie option (`actor-macaron`):

```typescript
{
  id: 'actor-gunslinger',
  label: 'Gunslinger Stance',
  description: 'Cycle companion weapon stance: OFF > CAT > BLK > GRAY.',
  icon: 'i-mdi:pistol',
  type: 'cycler',
  defaultOnStrip: false,
}
```

### 6.2 Settings Store & State Mapping
Extend `packages/stage-ui/src/stores/settings/stage-model.ts` (or `control-strip.ts`) to manage and persist stance:
* **Storage Key**: `settings/stage/gunslinger-stance`
* **Stance Values**:
  * `'off'` (Weapon Mod disabled / safe, default)
  * `'cat'` (Cat Gun active with full-auto spray)
  * `'blk'` (Black M1911 active)
  * `'gray'` (Silver M1911 active)

### 6.3 Telemetry & Weapon Control Event
When the `gunslingerStance` state changes in the renderer store, the Stage-Mate service compiles and dispatches a weapon control message to the Unity sidecar:

```json
{
  "type": "stage:control:weapon",
  "data": {
    "enabled": true,
    "weapon": "cat" | "blk" | "gray"
  }
}
```
*If stance is `'off'`, `enabled` is set to `false`.*

---

## 7. Related Architecture & Cross-References
- **Stage-Mate Architecture**: [`docs/rosetta-stone.md`](./rosetta-stone.md) § Stage-Mate Unity Companion.
- **Workspace Purity Contract**: [`AGENTS.md`](../AGENTS.md) § Stage-Mate & Unity Workspace Purity.
- **Sidecar IPC Contracts**: [`packages/stage-shared/src/stage-mate.ts`](../packages/stage-shared/src/stage-mate.ts).


