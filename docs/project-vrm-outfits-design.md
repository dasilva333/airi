# AIRI & StageMate VRM Modular Outfits & Mesh Wardrobe Architecture

---

## 1. Executive Summary & Mission

This document defines the architectural design, reverse-engineered engine mechanics, and end-to-end implementation for **Modular 3D VRM Outfits, Accessories, and Mesh Toggling** across both **AIRI (Three.js WebGL Stage)** and **StageMate (Unity Desktop Sidecar)**.

### Primary Goal
To empower users to take **any standard VRM 0.X or VRM 1.X model**, automatically inspect and discover all internal 3D mesh nodes (e.g., floaties, bunny ears, coats, glasses, dresses, shoes), and map them into toggleable wardrobe slots **without needing the Unity Editor, without compiling proprietary `.me` AssetBundles, and with 100% feature parity between WebGL and Desktop**.

```text
                  ┌──────────────────────────────────────────────────────────┐
                  │                 Active VRM Avatar Loaded                 │
                  └─────────────────────────────┬────────────────────────────┘
                                                │
                                                ▼
                   ┌────────────────────────────────────────────────────────┐
                   │  🔍 Automated Mesh Probe (Traverse Scene & Sub-Meshes) │
                   │  Found: SwimsuitRing, HeadbandEar, Shoes, HeadPiece...  │
                   └────────────────────────────┬───────────────────────────┘
                                                │
                                                ▼
                   ┌────────────────────────────────────────────────────────┐
                   │  🎛️ Wardrobe & Mesh Mapper UI                          │
                   │  - Define Slot (e.g. "FLOATIE", "BUNNY EARS")          │
                   │  - Select Meshes (Checkboxes for detected nodes)       │
                   │  - Tag Group (Independent toggle vs Exclusive outfit)  │
                   └────────────────────────────┬───────────────────────────┘
                                                │
                         ┌──────────────────────┴──────────────────────┐
                         ▼                                             ▼
         ┌───────────────────────────────┐             ┌───────────────────────────────┐
         │ 🌐 AIRI Stage (Three.js)      │             │ 🎮 Stage-Mate (Unity)         │
         │ - Live `mesh.visible = true`  │             │ - Dynamic `MEClothes` Patch   │
         │ - AiriCard / Outfits Slice    │             │ - Native Radial Pie Menu      │
         │ - LLM `<|ACT:outfit=...|>`    │             │ - Animated Tag Cloud Buttons  │
         └───────────────────────────────┘             └───────────────────────────────┘
```

---

## 2. Historical Context & Root Cause Analysis

### The Failure of the Legacy Outfit Builder
In previous iterations of the AIRI codebase, outfit configuration lived in [`packages/stage-ui/src/components/scenarios/settings/model-settings/vrm-expressions.vue`](file:///c:/Users/h4rdc/Documents/Github/airi-rebase-scratch/packages/stage-ui/src/components/scenarios/settings/model-settings/vrm-expressions.vue). This subsystem became dormant and ineffective due to a fundamental mismatch in architectural assumptions:

1. **The Flawed Assumption**: The legacy system assumed outfits were managed through **facial blendshapes / morph targets** (`availableExpressions`, mapping keys to float weights `Record<string, number>`).
2. **The 3D Model Reality**: In virtually all VRM 0.X and VRM 1.X avatars (from Booth.pm, VRoid Studio, and creators like Nilcat), clothing articles, accessories, and alternate hair styles are **separate 3D Mesh / `SkinnedMeshRenderer` GameObjects** (`SwimsuitRing`, `HeadbandEar`, `Dress`, `Sleeves`, `Glasses`, `Shoes`, `Pants`), **not blendshapes**.
3. **The Result**: Because the legacy UI only queried `vrm.expressionManager` / morph targets, it only ever displayed facial expressions (like `blink`, `joy`, `angry`, `surprised`), leaving users completely unable to see or toggle actual 3D clothes or accessories.

---

## 3. Reverse-Engineering the StageMate `.me` Format vs. `.vrm`

### 3.1 Format Comparison

| Attribute | Standard `.vrm` (glTF 2.0 / GLB) | StageMate `.me` (Unity AssetBundle) |
|---|---|---|
| **Underlying Container** | Binary glTF container with JSON chunk + binary buffer chunk. | Proprietary Unity binary `AssetBundle` containing serialized `GameObject` hierarchies, prefabs, and compiled MonoBehaviour state. |
| **Outfits & Toggle Concept** | **None.** Standard VRM has no native spec for UI labels, mutual exclusivity, or outfit slots. | **Native.** Contains an attached [`MEClothes`](file:///c:/Users/h4rdc/Documents/Github/airi-rebase-scratch/apps/stage-mate/mate-engine/Assets/MATE%20ENGINE%20-%20Mod%20SDK/MEClothes.cs) component serialized directly into the prefab. |
| **Creation Method** | Exported from Blender, VRoid Studio, or Unity UniVRM. | Requires Unity Hub, opening the full `Mate-Engine` Unity project, dragging meshes into `MEClothes` inspector arrays, and exporting via Unity's `BuildPipeline.BuildAssetBundles`. |
| **Scriptability Outside Unity** | **Extremely high.** Standard JSON chunk can be parsed, edited, and read by Node.js/browser in milliseconds. | **Virtually impossible.** Serialized with Unity's internal type-tree and engine version checksums. |

### 3.2 Why Raw `.vrm` Files in StageMate Builds Are Redundant Deadweight
- When StageMate is built in Unity (`MateSidecarBuild.BuildWindows` / `BuildMac`), all built-in avatars referenced in `Mate Engine Main.unity` (e.g. `Zome`, `Aldina`, `Lazuli`) are compiled directly into Unity's binary archives:
  - `StageMate_Data/sharedassets0.assets` (~107 MB)
  - `StageMate_Data/sharedassets0.assets.resS` (~116 MB)
- Unity **never reads loose `.vrm` files from disk** for its built-in avatars at runtime.
- Any loose `.vrm` files present in `Build/Windows/` or `Build/StageMate.app/` were purely redundant leftovers.
- **Rule Enforced**: In [`apps/stage-tamagotchi/electron-builder.config.ts`](file:///c:/Users/h4rdc/Documents/Github/airi-rebase-scratch/apps/stage-tamagotchi/electron-builder.config.ts), `STAGE_MATE_RESOURCE_FILTERS` strips all `!*.vrm`, `!*.me`, `!*.prefab`, `!*.log`, and `!*.dmp` from the release payload, preventing personal test models from leaking and stripping deadweight while keeping built-in avatars 100% intact.

---

## 4. StageMate Mate-Engine Outfits Subsystem Architecture

The outfit toggling behavior in StageMate is governed by three primary C# components:

```
[ Active Avatar GameObject ]
           │
           ▼
    [ MEClothes.cs ] ◄── (Holds max 8 OutfitEntry slots + Mesh References)
           ▲
           │ (Checks if MEClothes != null)
           ├────────────────────────┐
           │                        │
  [ CircleSelector.cs ]   [ AvatarClothesHandler.cs ]
  (Pie Menu: Dress Icon)   (Floating Animated Tag Cloud Buttons)
```

### 4.1 `MEClothes.cs` (Data Model & Toggle Engine)
Located at: [`apps/stage-mate/mate-engine/Assets/MATE ENGINE - Mod SDK/MEClothes.cs`](file:///c:/Users/h4rdc/Documents/Github/airi-rebase-scratch/apps/stage-mate/mate-engine/Assets/MATE%20ENGINE%20-%20Mod%20SDK/MEClothes.cs)

```csharp
public class MEClothes : MonoBehaviour
{
    [System.Serializable]
    public class OutfitEntry
    {
        public string name;           // Display Label (e.g., "FLOATIE", "DRESS")
        public string tag;            // Mutual Exclusivity Group (e.g., "main_outfit")
        public GameObject[] gameObjects; // GameObjects toggled by this entry
    }

    [Header("Outfit Entries (Max 8)")]
    public OutfitEntry[] entries = new OutfitEntry[8];

    public void ActivateOutfit(int index)
    {
        if (index < 0 || index >= entries.Length) return;
        OutfitEntry selected = entries[index];
        if (selected == null || selected.gameObjects == null) return;

        bool isCurrentlyOn = IsAnyActive(selected.gameObjects);
        bool hasTag = !string.IsNullOrEmpty(selected.tag);

        // MUTUAL EXCLUSIVITY RULE:
        // If a non-empty tag is present, de-activate all other entries sharing that exact tag.
        if (hasTag)
        {
            for (int i = 0; i < entries.Length; i++)
            {
                if (i == index) continue;
                OutfitEntry entry = entries[i];
                if (entry == null || entry.gameObjects == null) continue;
                if (entry.tag == selected.tag)
                {
                    foreach (var obj in entry.gameObjects)
                        if (obj != null) obj.SetActive(false);
                }
            }
        }

        // Toggle selected meshes
        foreach (var obj in selected.gameObjects)
            if (obj != null) obj.SetActive(!isCurrentlyOn);
    }
}
```

#### Key Mechanics of `tag`:
- **Independent / Additive Accessory (`tag: ""` or `null`)**: Toggles only its own meshes without affecting any other button (e.g. Floatie, Bunny Ears, Glasses, Hat).
- **Mutually Exclusive Outfit (`tag: "outfit"`)**: When clicked, automatically shuts off any other slot that shares `"outfit"` before turning itself on (e.g. switching between "Casual Dress" and "Swimsuit").

### 4.2 `CircleSelector.cs` (Radial Menu Hook)
Located at: [`apps/stage-mate/mate-engine/Assets/MATE ENGINE - Scripts/Tasty Pie Menu/Scripts/CircleSelector.cs`](file:///c:/Users/h4rdc/Documents/Github/airi-rebase-scratch/apps/stage-mate/mate-engine/Assets/MATE%20ENGINE%20-%20Scripts/Tasty%20Pie%20Menu/Scripts/CircleSelector.cs#L468-L473)

When the radial pie menu opens, it dynamically evaluates:
```csharp
if (btn != null && btn.id == "clothes")
{
    GameObject avatarGO = animatorReceiver?.avatarAnimator?.gameObject;
    bool hasClothes = avatarGO != null && (avatarGO.GetComponent<MEClothes>() ?? avatarGO.GetComponentInChildren<MEClothes>(true)) != null;
    if (!hasClothes) return true; // Hides the dress icon if no MEClothes is attached!
}
```

### 4.3 `AvatarClothesHandler.cs` (Floating Animated Tag Cloud)
Located at: [`apps/stage-mate/mate-engine/Assets/MATE ENGINE - Mod SDK/AvatarClothesHandler.cs`](file:///c:/Users/h4rdc/Documents/Github/airi-rebase-scratch/apps/stage-mate/mate-engine/Assets/MATE%20ENGINE%20-%20Mod%20SDK/AvatarClothesHandler.cs#L84-L147)

- Reflects over `MEClothes.entries` array.
- For each entry with a non-empty `name`, spawns an animated, floating button.
- Adds click listeners invoking `MEClothes.ActivateOutfit(index)`.

---

## 5. Dynamic Sidecar Injection Engine

To avoid requiring users to build `.me` AssetBundles in Unity, we developed the **Dynamic Sidecar Injection Engine** inside the StageMate C# runtime.

### 5.1 The Sidecar Schema (`<modelName>.outfits.json`)
Placed right next to any `.vrm` file on disk:

```json
{
  "entries": [
    {
      "name": "FLOATIE",
      "tag": "",
      "meshes": ["SwimsuitRing", "EmoSwimsuitRing"]
    },
    {
      "name": "BUNNY EARS",
      "tag": "",
      "meshes": ["HeadbandEar"]
    },
    {
      "name": "HEADBAND",
      "tag": "",
      "meshes": ["Headband"]
    },
    {
      "name": "HEAD PIECE",
      "tag": "",
      "meshes": ["HeadPiece"]
    },
    {
      "name": "EARRINGS",
      "tag": "",
      "meshes": ["Earing"]
    },
    {
      "name": "SHOES",
      "tag": "",
      "meshes": ["SwimsuitShoes", "Swimsuit.001"]
    }
  ]
}
```

### 5.2 Runtime Injection in `VRMLoader.cs`
Patched in: [`apps/stage-mate/unity-src/Patches/VRMLoader/VRMLoader.cs`](file:///c:/Users/h4rdc/Documents/Github/airi-rebase-scratch/apps/stage-mate/unity-src/Patches/VRMLoader/VRMLoader.cs)

When `VRMLoader.FinalizeLoadedModel` runs on **any** standard VRM:
1. It checks if `MEClothes` is already populated.
2. It scans for `<modelName>.outfits.json`, `<modelName.vrm>.outfits.json`, or `outfits.json`.
3. If found, it dynamically executes:
   - `var clothes = model.GetComponent<MEClothes>() ?? model.AddComponent<MEClothes>();`
   - Traverses all child `Transform` / `Renderer` nodes in the loaded VRM hierarchy.
   - Matches mesh names (case-insensitive) to GameObjects.
   - Populates `clothes.entries[i]`.
4. **Immediate Effect**: `CircleSelector` detects `MEClothes`, the radial dress icon appears, and the tag cloud operates seamlessly.

---

## 6. Empirical Case Study: Komoe (小萌衣 こもえ)

### Model Identity
- **Source**: `小萌衣 こもえ Komoe by 空猫 Nilcat - 3832634725106865639.vrm` (24.5 MB)
- **Extracted glTF Structure**: 12 Sub-Meshes & 12 Object Nodes.

### Mesh Mapping & Toggle Catalog

| glTF Node Name | Mesh Asset Name | Visual Part | Configured Button Slot | Tag Mode |
|---|---|---|---|---|
| `SwimsuitRing` | `EmoSwimsuitRing` | 🛟 Inflatable Swim Floatie | **`FLOATIE`** | Independent (`""`) |
| `HeadbandEar` | `HeadbandEar` | 🐰 Bunny Ears | **`BUNNY EARS`** | Independent (`""`) |
| `Headband` | `Headband` | 🎀 Headband Base | **`HEADBAND`** | Independent (`""`) |
| `HeadPiece` | `HeadPiece` | 🌸 Flower Hair Ornament | **`HEAD PIECE`** | Independent (`""`) |
| `Earing` | `Earing` | ✨ Earrings / Jewelry | **`EARRINGS`** | Independent (`""`) |
| `SwimsuitShoes` | `Swimsuit.001` | 👡 Bunny Platform Sandals | **`SHOES`** | Independent (`""`) |
| `Swimsuit` | `Swimsuit` | 👙 Swimsuit Top & Bottom | *Base Attire* | Exclusive (`"outfit"`) |
| `Ponytail` | `Ponytail` | 👱‍♀️ Side Ponytail Hair | *Hair Option* | Independent (`""`) |
| `Body`, `Face`, `Hairs` | Various | 👤 Core Anatomy | *Immutable Core* | None (Always active) |

### Verification Milestone
- Launched via Stage-Mate Test Harness (`pnpm -F @proj-airi/stage-mate run dev:harness`).
- Synced via hotkey **`[F]`** (`stage:vrm:load`).
- Verified that right-clicking Komoe in StageMate opens the radial dress menu and dynamically toggles her floatie and bunny ears with zero errors.

---

## 7. Unified Mesh Wardrobe Customizer Specification (AIRI + StageMate)

### 7.1 Slot Definition & Open-Ended Group Tags (`tag`)
In the StageMate and AIRI unified data model, an outfit slot is **not restricted to a single mesh** and the `tag` is **not a boolean**:

- **Multi-Mesh Bundling**: A single slot can bundle **multiple meshes together** into its `meshes: string[]` array. For example, bundling `["Headband", "HeadbandEar", "HeadPiece", "Earing"]` into a single button labeled `"HEADWEAR"`.
- **Open-Ended Exclusivity Groups (`tag: string`)**:
  - **Independent / Additive Accessory (`tag: ""` or `null`)**: Toggles only its own bundled meshes without affecting any other slot (e.g., `"FLOATIE"` or `"GLASSES"`).
  - **Named Group Exclusivity (`tag: "hair"`, `tag: "body_outfit"`, `tag: "shoes"`)**: Selecting any slot in that group automatically shuts off all other slots that share the same tag string.
    - *Example Hair Group*: Slot 1: `"PONYTAIL"` (`tag: "hair"`), Slot 2: `"SHORT HAIR"` (`tag: "hair"`), Slot 3: `"TWIN TAILS"` (`tag: "hair"`).
    - *Example Outfit Group*: Slot 1: `"SUMMER SWIMSUIT"` (`tag: "body"`), Slot 2: `"GOTHIC DRESS"` (`tag: "body"`).

### 7.2 Data Model & Character Card Slice
Stored in `activeCard.extensions.airi.modules.outfits` and exported to disk cache as `<modelId>.outfits.json`:

```ts
export interface AiriVrmMeshOutfitEntry {
  id: string
  name: string // Display Label on the Button (e.g., "HEADWEAR", "SUMMER DRESS")
  tag: string // Open-ended mutual exclusivity group string (or empty "" for independent)
  meshes: string[] // Array of mesh/node names bundled into this slot
  icon?: string // Optional icon string
  defaultEnabled?: boolean // Default state on model load
}

export interface AiriVrmWardrobeManifest {
  version: 1
  entries: AiriVrmMeshOutfitEntry[]
}
```

---

## 8. Four-Phase Rollout Roadmap

```text
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 1: Pure UI & Modal Architecture + Store Persistence             │
│ - Probe & discover 3D meshes from model data                           │
│ - Rip out stale blendshape modal and replace with modern Mesh Wardrobe │
│ - Up to 8 Slots: Name, Open-Ended Group Tag, Multi-Mesh Checklist      │
│ - Persist to Pinia & AiriCard storage (No real-time 3D mutations yet) │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 2: Three.js Real-Time Rendering & Toggling                      │
│ - Consume stored wardrobe config in VRMModel.vue / Three.js stage      │
│ - Live mesh.visible = true/false evaluation across active slots & tags │
│ - Stage UI / Customizer interactive toggle buttons                     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 3: StageMate Bridge & Auto-Sidecar Sync                          │
│ - Auto-generate <modelId>.outfits.json in stage-mate-cache/            │
│ - StageMate VRMLoader dynamic MEClothes injection on sync              │
│ - Native radial Pie Menu & animated tag cloud verification             │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 4: LLM Action Tokens & Roleplay Tool Calling                     │
│ - <|ACT:outfit="..."|> and <|ACT:accessory="..."|> marker parsing      │
│ - Built-in tool calling (set_outfit_mesh / toggle_accessory)           │
└────────────────────────────────────────────────────────────────────────┘
```

### Phase 1: Pure UI & Modal Architecture + Store Persistence (Current Target)
1. **Mesh Discovery**: Scan the model's glTF structure to extract all child mesh node names.
2. **Revamp Settings UI**: In [`packages/stage-ui/src/components/scenarios/settings/model-settings/vrm.vue`](file:///c:/Users/h4rdc/Documents/Github/airi-rebase-scratch/packages/stage-ui/src/components/scenarios/settings/model-settings/vrm.vue) and [`vrm-expressions.vue`](file:///c:/Users/h4rdc/Documents/Github/airi-rebase-scratch/packages/stage-ui/src/components/scenarios/settings/model-settings/vrm-expressions.vue), remove the legacy blendshape outfit modal.
3. **New Wardrobe Modal**:
   - Discovered mesh catalog checklist.
   - Slot builder (Up to 8 slots):
     - Display Name (`name`).
     - Group Tag (`tag` - open-ended string input with common suggestions like `"outfit"`, `"hair"`, `"headwear"` or empty for independent).
     - Mesh multi-select (assign 1 or more meshes to the slot).
     - Delete / reorder slots.
4. **State Persistence**: Save to Pinia (`useAiriCardStore` / `activeCard.extensions.airi.modules.outfits`) and IndexedDB.
5. *Boundary*: Pure UI & persistence; does not alter Three.js stage rendering state yet.

### Phase 2: Three.js Real-Time Rendering & Toggling
1. Integrate wardrobe state into `VRMModel.vue` in `packages/stage-ui-three/`.
2. Map slot activation to `node.visible = true/false` on the active Three.js scene graph.
3. Support interactive toggling from the stage viewport and character customizer controls.

### Phase 3: StageMate Bridge & Auto-Sidecar Sync
1. In `apps/stage-tamagotchi/src/main/services/airi/stage-mate/index.ts`, automatically write `<modelId>.outfits.json` alongside `.vrm` files in `stage-mate-cache/`.
2. StageMate's patched `VRMLoader.cs` dynamically attaches `MEClothes` with matching entries on load.
3. Verify full parity in StageMate's radial pie menu.

### Phase 4: LLM Action Tokens & Roleplay Tool Calling
1. Parse `<|ACT:outfit="..."|>` and `<|ACT:accessory="..."|>` in `packages/stage-ui/src/composables/llm-marker-parser.ts`.
2. Register built-in tool for conversational wardrobe modification.

---

## 9. Codebase Reference Index

| Subsystem / Area | Key File Path | Purpose |
|---|---|---|
| **StageMate Injection Patch** | [`apps/stage-mate/unity-src/Patches/VRMLoader/VRMLoader.cs`](file:///c:/Users/h4rdc/Documents/Github/airi-rebase-scratch/apps/stage-mate/unity-src/Patches/VRMLoader/VRMLoader.cs) | Injects dynamic `MEClothes` on VRM load if sidecar JSON exists. |
| **StageMate Bridge** | [`apps/stage-mate/unity-src/Assets/StageMate/Core/StageMateBridge.cs`](file:///c:/Users/h4rdc/Documents/Github/airi-rebase-scratch/apps/stage-mate/unity-src/Assets/StageMate/Core/StageMateBridge.cs) | Electron/WebSocket IPC bridge and model load router. |
| **StageMate Socket & Auth** | [`apps/stage-mate/unity-src/Assets/StageMate/Core/StageMateSocket.cs`](file:///c:/Users/h4rdc/Documents/Github/airi-rebase-scratch/apps/stage-mate/unity-src/Assets/StageMate/Core/StageMateSocket.cs) | Authenticates with `server-channel-config.json` token. |
| **StageMate Data Model** | [`apps/stage-mate/mate-engine/Assets/MATE ENGINE - Mod SDK/MEClothes.cs`](file:///c:/Users/h4rdc/Documents/Github/airi-rebase-scratch/apps/stage-mate/mate-engine/Assets/MATE%20ENGINE%20-%20Mod%20SDK/MEClothes.cs) | 8-slot outfit engine and mutual exclusivity toggle logic. |
| **StageMate Tag UI** | [`apps/stage-mate/mate-engine/Assets/MATE ENGINE - Mod SDK/AvatarClothesHandler.cs`](file:///c:/Users/h4rdc/Documents/Github/airi-rebase-scratch/apps/stage-mate/mate-engine/Assets/MATE%20ENGINE%20-%20Mod%20SDK/AvatarClothesHandler.cs) | Floating animated tag cloud generator and click dispatcher. |
| **StageMate Radial Menu** | [`apps/stage-mate/mate-engine/Assets/MATE ENGINE - Scripts/Tasty Pie Menu/Scripts/CircleSelector.cs`](file:///c:/Users/h4rdc/Documents/Github/airi-rebase-scratch/apps/stage-mate/mate-engine/Assets/MATE%20ENGINE%20-%20Scripts/Tasty%20Pie%20Menu/Scripts/CircleSelector.cs) | Detects `MEClothes` and displays dress icon. |
| **StageMate Dev Harness** | [`apps/stage-mate/harness/index.ts`](file:///c:/Users/h4rdc/Documents/Github/airi-rebase-scratch/apps/stage-mate/harness/index.ts) | Standalone mock WebSocket server with `[F]` outfit test key. |
| **Electron Packaging Filters** | [`apps/stage-tamagotchi/electron-builder.config.ts`](file:///c:/Users/h4rdc/Documents/Github/airi-rebase-scratch/apps/stage-tamagotchi/electron-builder.config.ts) | Strips loose VRMs and deadweight from release installer bundles. |
| **AIRI Three.js VRM Scene** | [`packages/stage-ui-three/src/components/Model/VRMModel.vue`](file:///c:/Users/h4rdc/Documents/Github/airi-rebase-scratch/packages/stage-ui-three/src/components/Model/VRMModel.vue) | WebGL stage mesh node loader and visibility renderer. |
| **AIRI Model Customizer** | [`packages/stage-ui/src/components/scenarios/settings/model-settings/ModelCustomizer.vue`](file:///c:/Users/h4rdc/Documents/Github/airi-rebase-scratch/packages/stage-ui/src/components/scenarios/settings/model-settings/ModelCustomizer.vue) | Unified avatar customization controller across VRM, Live2D, Spine, MMD. |

