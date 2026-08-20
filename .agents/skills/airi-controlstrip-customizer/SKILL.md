---
name: airi-controlstrip-customizer
description: >-
  Use when working with the AIRI Control Strip Customizer — the user-facing Customizer floating window (NOT the inline ModelCustomizer widget; see airi-model-customizer for that). Covers the floating customizer window (apps/stage-tamagotchi/src/main/windows/customizer/index.ts), customizer page (apps/stage-tamagotchi/src/renderer/pages/customizer.vue), customizer catalog (packages/stage-ui/src/constants/control-customizer.ts), eventa IPC contracts (electronCustomizerToggleVisibility, electronGetCustomizerWindowState), or live 3D/2D parameter tweaking across all Pinia stores.
---

# AIRI Control Strip Customizer

The Control Strip Customizer is the **user-facing "Customizer"** — a floating, glassmorphic in-app configuration panel, opened from the Control Strip / tray / hotkey, to tweak 3D/2D avatar display models, facial expressions, motion triggers, stage backgrounds, audio voice profiles, captions, and proactivity telemetry in real-time. It is distinct from the inline **ModelCustomizer** widget (see the `airi-model-customizer` skill), which is an embedded settings widget for per-model expression/motion editing with no window of its own.

> **Naming note**: both features go by "customizer" in the UI. The floating window is the **Control Strip Customizer**; the embedded settings widget is the **ModelCustomizer**. Keep `airi-controlstrip-customizer` scoped to the window/catalog/IPC and `airi-model-customizer` scoped to the inline widget.

---

## 1. Architecture & Cross-Window State Sync

```
  [ Control Strip / Tray / Hotkey ]
                 │
                 ▼ (via eventa IPC)
  [ Customizer Window Manager ] ───openRoute('/customizer')──► [ Customizer Studio Page ]
  (main/windows/customizer/index.ts)                            (renderer/pages/customizer.vue)
                                                                           │
                                                                           ▼
  [ Direct Store Reactive Binding ] ◄─────────────────────────── [ CUSTOMIZER_CATALOG ]
  • displayModelsStore (Models/Assets)                           (constants/control-customizer.ts)
  • modelStore (Live2D/VRM Expressions)
  • backgroundStore (Scenes/Backgrounds)
  • speechStore (TTS/Voice Profiles)
  • settingsStore (Captions/Window/Stage)
```

---

## 2. Exhaustive File Index

### Main Process & Electron IPC
- **`apps/stage-tamagotchi/src/main/windows/customizer/index.ts`**: Creates and manages the floating customizer drawer window (`/customizer`). Handles IPC group navigation (`set-customizer-group`) and window visibility state (`customizer-window-state`).
- **`apps/stage-tamagotchi/src/shared/eventa.ts`**: Eventa IPC contracts:
  - `electronCustomizerToggleVisibility`: Toggles window visibility or opens directly to a specified control group.
  - `electronGetCustomizerWindowState`: Returns current visibility boolean.

### Renderer Pages & Control Catalogs
- **`apps/stage-tamagotchi/src/renderer/pages/customizer.vue`**: Main Customizer Studio UI page. Renders interactive control sections, sliders, toggles, and cyclers. Listens to `set-customizer-group` IPC to auto-scroll to active control groups.
- **`packages/stage-ui/src/constants/control-customizer.ts`**: Central catalog definition (`CUSTOMIZER_CATALOG`). Defines all section groups, control items, icons, and Pinia store bindings.
- **`apps/stage-tamagotchi/src/renderer/pages/index.vue`**: Control Strip host page. Listens to `'control-strip:open-customizer'` events and handles tray/strip customizer triggers.

### Bound Pinia Stores & Services
- **`packages/stage-ui/src/stores/display-models.ts`**: 3D/2D model assets, VRM/Live2D/Spine/MMD model switching.
- **`packages/stage-ui-three/src/stores/model.ts`**: Active VRM expression parameters, blendshapes, and bone retargeting.
- **`packages/stage-ui/src/stores/background.ts`**: Stage background images, solid colors, and canvas shaders.
- **`packages/stage-ui/src/stores/modules/speech.ts`**: TTS providers, active voice profile IDs, STT models.
- **`packages/stage-ui/src/stores/settings/settings.ts`**: Stage viewport coordinates, drag/tactile modes, caption docking, and window stay-on-top flags.

### Authoritative Design & Architecture Documents
- **`docs/modelcustomizer-design.md`**: Design document defining `ModelCustomizer.vue` separation of concerns, settings panel adoption matrix (`live2d.vue`, `mmd.vue`, `spine.vue`, `vrm.vue`), Rehearsal Room (`chat_rehearsal.vue`) sandbox integration, `@insert-token` events, and transient motion previewing.
- **`docs/catalog-control-strip.md`**: Master catalog of control strip items, customizer rows, and default visibility flags.
- [docs/project-control-strip-rfc.md](docs/project-control-strip-rfc.md) — Control strip RFC.
- [docs/content/en/docs/advanced/architecture/design-stage-ui-context-bridge-control-island.md](docs/content/en/docs/advanced/architecture/design-stage-ui-context-bridge-control-island.md) — Stage UI context bridge / control island architecture.
- [docs/bugfix-apply-btn-race.md](docs/bugfix-apply-btn-race.md) — Apply-button race bugfix.

---
## 3. Customizer Catalog Schema (`CUSTOMIZER_CATALOG`)

All control groups and items in `packages/stage-ui/src/constants/control-customizer.ts` follow a typed schema:

```typescript
export interface CustomizerItem {
  id: string
  label: string
  description: string
  icon: string
  type: 'toggle' | 'cycler' | 'action' | 'menu'
  defaultOnStrip: boolean
  binding?: 'chatOpen' | 'stageEnabled' | 'stageMateEnabled' | 'micEnabled' | 'captionOpen' | 'geminiSession' | 'headTetheredCaptionEnabled'
  /** If true, this item is specific to desktop multi-window managers and hidden on mobile */
  desktopOnly?: boolean
}

export interface CustomizerGroup {
  id: string
  name: string
  description: string
  icon: string
  items: CustomizerItem[]
}
```

### Catalog Sections (`CUSTOMIZER_CATALOG`):
1. **`stage-view`** — Stage View (Actor Stage toggle `stageEnabled`, Stage-Mate toggle `stageMateEnabled`, Always-on-Top, Tactile/Drag/Positioning/Orbit/Cycle-Modes/Reset-Coordinates, Auto-Hide). `desktopOnly` items cover the multi-window Stage/Stage-Mate managers.
2. **`system-window`** — System & Window (Chat Toggle `chatOpen`, Microphone Toggle `micEnabled`, Settings action, Theme Mode, Exit Application, Layout).
3. **`captions-layout`** — Captions (Captions Toggle `captionOpen`, Head-Tethered Caption `headTetheredCaptionEnabled`, Docking cycler, Sync Position, Sync Visibility, Theme Mode, Font Size/Opacity, Layout Mode).
4. **`actor-wardrobe`** — Actor & Wardrobe (character/avatar selectors, wardrobe slots, expressions, idle animations, motions, all-emotions capture, selfies, macaron).
5. **`ai-gemini`** — AI & Gemini (Gemini Session `geminiSession`, Witness, Manual Capture, Frequency, TTS, Voice, Schedule, Grounding).

---

## 4. IPC Eventa Contracts & Deep-Link Navigation

### Opening Customizer to a Specific Group:
When a user clicks a customizer shortcut (e.g. caption settings icon on control strip), the renderer calls `electronCustomizerToggleVisibility`:

```typescript
import { useElectronEventaInvoke } from '@proj-airi/stage-ui/composables/use-electron-eventa'
import { electronCustomizerToggleVisibility } from 'shared/eventa'

const toggleCustomizer = useElectronEventaInvoke(electronCustomizerToggleVisibility)

// Opens customizer and auto-scrolls to the 'captions-layout' section:
await toggleCustomizer({ enabled: true, group: 'captions-layout' })
```

### Main Process Group Dispatch (`index.ts`):
```typescript
// main/windows/customizer/index.ts
if (group && currentWindow) {
  currentWindow.webContents.send('set-customizer-group', group)
}
```

### Renderer Group Listener (`customizer.vue`):
```typescript
// renderer/pages/customizer.vue
window.electron.ipcRenderer.on('set-customizer-group', (_event, group: string) => {
  const el = document.getElementById(`group-${group}`)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth' })
  }
})
```

---

## 5. Development & Verification Rules

1. **Instant Reactive Mutations**:
   Customizer controls bind directly to Pinia store refs. Never introduce temporary local buffer state inside `customizer.vue` unless explicitly requested — mutations must take effect immediately on the active avatar / stage.
2. **Catalog Registration**:
   Whenever adding a new toggleable feature, setting, or mode to AIRI, add its definition to `CUSTOMIZER_CATALOG` in `packages/stage-ui/src/constants/control-customizer.ts`.
3. **IPC Eventa Discipline**:
   Use `electronCustomizerToggleVisibility` and `electronGetCustomizerWindowState` for window management. Do not bypass eventa with raw IPC strings.
4. **Verification**:
   Run `pnpm -F @proj-airi/stage-ui typecheck` after modifying `control-customizer.ts` or `customizer.vue`.

## Related Skills & References

- **Peer Skills**: [[airi-model-customizer]]
- **Key Documents**: [[modelcustomizer-design]], [[catalog-control-strip]], [[project-control-strip-rfc]], [[design-stage-ui-context-bridge-control-island]], [[bugfix-apply-btn-race]]
