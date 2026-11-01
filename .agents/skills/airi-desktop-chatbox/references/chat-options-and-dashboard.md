# Quick Settings (Chat Options Popover) & Customizable Dashboard

## Overview & Ownership

- **Quick Settings Popover**: `packages/stage-layouts/src/components/Layouts/ChatOptionsPopover.vue` (exported as `ChatOptionsPopover` from `@proj-airi/stage-layouts`).
  - Desktop trigger: `apps/stage-tamagotchi/src/renderer/pages/chat.vue` (`triggerVariant="dots"` on `...` header button).
  - Mobile header trigger: `packages/stage-layouts/src/components/Layouts/MobileHeader.vue` (`triggerVariant="circle"` on gear button).
  - Popover Title / Tooltip in UI: **"Quick settings"** (header renders `< Quick settings` back navigation and close button `(X)`).
- **Dashboard Context Panel**: Right panel in `apps/stage-tamagotchi/src/renderer/pages/chat.vue`.
  - State manager: `useChatDashboard()` (persisted in `localStorage` key `airi:chat:dashboard-layout`).
  - Active modules: `Widgets`, `Virtual Terminal`, `Memories`, `Stage`, `Current Scene`, `Media Gallery`, `Nan0 Cognition`.

---

## 1. Quick Settings Popover (`ChatOptionsPopover.vue`)

### Decomposed Modular Architecture
The popover is decomposed into isolated subviews located in `packages/stage-layouts/src/components/Layouts/ChatOptions/`:
- **`ChatOptionsPopover.vue`**: Root orchestrator (~325 lines) owning Reka UI `PopoverRoot`, `PopoverContent`, header bar (`< Quick settings`), dynamic view routing, and dialog wrappers (`StageBackgroundDialogPicker`, `ChatSessionModal`, `CharacterContextDialog`).
- **`ChatOptionsRootView.vue`**: Image spawn mode segmented control (`bg`, `widget`, `inline`), chat layout presets (`mini`, `medium`, `large`, `full`), and 7 category navigation buttons.
- **`ChatOptionsAppearanceView.vue`**: Theme/color mode widget (`SettingsThemeHeaderWidget`), 6-card particle atmosphere grid, and quick wallpaper grid with scene browser picker trigger.
- **`ChatOptionsCapabilitiesView.vue`**: Heartbeats, screen watching, offline dreams, visual novel / autonomous artistry, sticker widgets, auto-cues, and cognitive pipeline.
- **`ChatOptionsToolsView.vue`**: Terminal sandbox (`bash`), local filesystem access, web search, screenshots, MCP tools, generative motion, and text/image journals.
- **`ChatOptionsInjectionsView.vue`**: System sensors telemetry, 3-day recent memory summaries, Universe RAG retrieval, visual scene state scratchpad, and dream/journal/artistry intrusions.
- **`ChatOptionsMemoriesView.vue`**: Quick memory context modal, session manager modal, memory search jump, deep links to memory & card settings.
- **`ChatOptionsStagingView.vue`**: Dialogue text color customization. Supports card default swatch picker and per-actor color overrides with hex input and live preview box. Emits `openStagingSettings`.
- **`ChatOptionsVoiceView.vue`**: Speech playback and actor voice assignments. Emits `openVoiceSettings`.

### Navigation State Machine
```ts
type ChatOptionsView = 'root' | 'capabilities' | 'tools' | 'injections' | 'memories' | 'appearance' | 'staging' | 'voice'
```
- Closing the popover resets `currentView` to `'root'`.
- Horizontal subview navigation uses `<Transition mode="out-in">` with 200ms ease-out enter and 150ms ease-in leave.
- Back button (`< Quick settings`) returns to `'root'`.

---

### Appearance Subview Structure (`ChatOptionsAppearanceView.vue`)

- **Appearance Header Banner**:
  - Amber magic-wand icon (`i-solar:magic-stick-3-bold-duotone`) in rounded badge.
  - Title: **Appearance**; Subtitle: `Atmosphere and wallpaper`.
  - **Theme Widget**: `<SettingsThemeHeaderWidget shrink-0 />` embedded in the header banner. Controls dark/light mode and 24-color preset primary accent popover (`z-[10050]`).

- **ATMOSPHERE Section**:
  - Section header: `ATMOSPHERE` on left, `⊘ Clear effect` button on right (`handleClearAtmosphere`, sets atmosphere to `'none'`).
  - **6-card Visual Grid (2×3)**:
    - Card options mapped from `ATMOSPHERE_OPTIONS` in `packages/stage-layouts/src/components/Backgrounds/patterns/index.ts`:
      1. `Hearts` (`hearts`)
      2. `Sakura` (`petals`)
      3. `Anime Stars` (`stars`)
      4. `Dreamy Bubbles` (`bubbles`)
      5. `Cyber Crosses` (`crosses`)
      6. `Melody` (`notes`)
    - Each pattern component renders a mini canvas with `preview` and `transparent-bg` props for throttled background rendering.
    - Active selection shows a top-right checkmark badge (`i-solar:check-read-bold`) and primary ring border.

- **BACKGROUND Section**:
  - Section header: `BACKGROUND`.
  - **3-Mode Segmented Control**: `Wallpaper` · `Solid` · `Theme`.
    - **Wallpaper**: 2×3 thumbnail grid for active card backgrounds with `"Browse all scenes"` dialog trigger.
    - **Solid**: 6-color custom palette (3 dark / 3 light swatches) with live hex code display, Reset Colors, and native color picker.
    - **Theme**: Follows light or dark theme dynamically (Light: `#FAF9F6` warm paper, Dark: `#18181B` neutral zinc charcoal).
  - Helper copy: *"Follows your light or dark theme. Atmosphere effects stay independent."*

- **Store & Crossfade Pipeline**:
  - Stores:
    - Electron desktop chat: `backgroundStore.setChatboxActiveAtmosphere(id)` and `backgroundStore.setChatboxActiveBackground(id)`.
    - Web stage: `backgroundStore.setActiveAtmosphere(id)` and `backgroundStore.setActiveBackground(id)`.
  - Persistence keys in `localStorage`:
    - Atmosphere: `airi:chatbox-active-atmosphere-id`
    - Background: `airi:chatbox-active-background-id`
  - Rendering in `apps/stage-tamagotchi/src/renderer/pages/chat.vue`: Crossfades `chatboxActiveBackgroundUrl` with 700ms GPU opacity transition (`will-change-opacity`).

---

### Voice & Audio Subview Contracts (`ChatOptionsVoiceView.vue`)
- **Speaker Volume (0%–100%)**: Range slider bound to `settings/speech/output-volume`. Subtext: *"At 0%, speech still generates; lip-sync and captions continue."*
- **Generate Speech (TTS)**: Toggle switch bound to `settings/speech/enabled`. Subtext: *"Turn off to stop TTS requests. Text chat continues."*
- **Adaptive Character Voices**:
  - **Single-Character Mode (`!isMultiActorCard`)**:
    - Callout banner: *"Silent speakers ≠ disabled speech. Use volume for silence. Switch TTS off to stop synthesis requests entirely."*
    - Single card voice profile row with audition preview button (`▶`) and voice dropdown.
  - **Multi-Actor Mode (`isMultiActorCard`)**:
    - **Card default row**: Document icon, system default voice selection, audition preview.
    - **Actor override rows**: Iterates `actorConcepts`, displaying `CharacterAvatar`, actor name, current voice name (*"Uses card default"* with link chain icon or override voice name), audition preview (`▶`), voice dropdown selector, and reset button.
- **Deep Link**: *"Manage voice profiles ↗"* button emitting `openVoiceSettings`.

---

## 2. Dashboard Panel Architecture

### Component Hierarchy & Structural Roles
- **Chassis Host**: `apps/stage-tamagotchi/src/renderer/pages/chat.vue` (`showRightPanel` computed with 768px breakpoint, `<ChatDashboardPanel />` mount).
- **Panel Orchestrator**: `apps/stage-tamagotchi/src/renderer/components/chat/ChatDashboardPanel.vue` (manages View Mode vs. Customize Mode, HTML5 drag-and-drop, module cards, collapse states).
- **Dashboard State & Composables**: `packages/stage-ui/src/composables/use-chat-dashboard.ts` (manages `ALL_DASHBOARD_MODULES`, `activeModuleIds`, `collapsedStates`, `computeSmartInitialDashboardModules()`).
- **Shared Card Chassis**: `packages/stage-ui/src/components/scenarios/chat/ChatDashboardCard.vue` (standard accordion container with title, icon, action slot, badge, and collapse chevron).

### Module Catalog & Gating Invariants

| Module ID | Title | Backing Component | Runtime Gate (`v-if` in View Mode) | Unavailable Tooltip Reason |
| :--- | :--- | :--- | :--- | :--- |
| `stage` | Stage | `RendererStage` (`@proj-airi/stage-ui/components/scenes`) | `embeddedStageSupported ?? true` | Stage model is disabled or not set. |
| `widgets` | Widgets | `ChatWorkspaceWidgetsPanel.vue` | **None** (always visible if added) | None |
| `terminal` | Virtual Terminal | `ChatWorkspaceTerminalPanel.vue` | `effectiveSandboxActive` (`bash` tool allowed) | Sandbox / bash is disabled for this character. |
| `nan0` | Nan0 Cognition | `ChatNan0CognitionPanel.vue` | `props.isNan0Active` | Nan0 Cognition is not active for this character. |
| `memories` | Memories | Inline cards (`STMM` daily summary, `echo` chips, `journal` entries) | None (renders empty state if 0) | None |
| `scene` | Current Scene | Inline cover image (`allImageEntries[0]`) | None (renders dashed empty box) | None |
| `media` | Media Gallery | Inline thumbnail grid with `View More` pagination | None | None |

> [!NOTE]
> **Widgets vs. Sandbox Decoupling**: Widgets authored in `/workspace` run inside sandboxed `srcdoc` iframes. While *authoring* new widgets originally leverages the virtual workstation bash environment, pre-built or imported widgets persist in `widgetsRepo` (`local:widgets/registry`) and remain fully functional even when the character card has bash or sandbox execution disabled. Thus, the `widgets` module has no runtime gate.

### View Mode vs. Customize Mode
- **View Mode (`mode === 'view'`)**: Normal runtime view rendering active modules in user-defined order with accordion collapse chevrons (`^`/`v`).
- **Customize Mode (`mode === 'customize'`)**: Edit mode with drag-and-drop reordering, eye hide buttons, "AVAILABLE MODULES" add catalog, and "Restore default layout".
- **Trigger**: Click sliders button (`i-solar:tuning-2-linear`) or `+ Add module` to enter customize mode. Click `Done` or `<` to exit.

### Boundary: Modules vs. Sandbox Widgets
- **Dashboard Modules**: Own the sidebar layout chassis and arrangement. They are native Vue components with store access.
- **Sandbox Widgets**: Micro-apps running in iframes authored in `/workspace` managed by `useSandbox()` and persisted in `widgetsRepo` (`local:widgets/registry`).
- The `Widgets` dashboard module simply acts as the viewport container for active sandbox widgets. Customizing dashboard layout does not alter `widgetsRepo`.

### Persistence & Storage Invariants
Discrete `localStorage` keys used by the dashboard system:
- **`airi:chat:right-panel-open`** (`boolean`): Whether the right sidebar is visible or collapsed.
- **`airi:chat:dashboard-active-modules`** (`DashboardModuleId[]`): Ordered array of active module IDs. Default: `['widgets', 'terminal', 'memories']`.
- **`airi:chat:dashboard-collapsed`** (`Record<string, boolean>`): Map of module ID to collapsed boolean. Default: `{ stage: true }`.
- **`airi:chat:dashboard-has-initialized`** (`boolean`): Sentinel flag ensuring `computeSmartInitialDashboardModules()` only populates once on fresh installs without clobbering user customizations.

- **Availability Decoupling**: If a module is unavailable (e.g. character lacks cognition, terminal lacks bash permissions), hide it from render in View Mode but keep its slot in `activeModuleIds` so the user's saved order is never destroyed. In Customize Mode, an amber warning badge (`i-solar:danger-triangle-bold`) displays the exact unavailability reason tooltip.
- **Lifecycle Guarantees**: Use stable `:key="moduleId"` so reordering does not unmount or reload running widget iframes.

---

## Verification

1. **Quick Settings Popover**: Open via `...` header button. Verify view transition into each subview (`capabilities`, `tools`, `injections`, `memories`, `appearance`, `staging`, `voice`), test volume slider and TTS toggle, test atmosphere card selection, test wallpaper selection, toggle dark/light mode, pick an accent color swatch, and verify popup closes and resets to `root`.
2. **Dashboard**: Test reordering modules, collapsing cards, hiding/showing via customize mode, toggling sandbox availability, and refreshing page to ensure layout persists.
3. **Typecheck**: Run `pnpm -F @proj-airi/stage-layouts typecheck` and `pnpm -F @proj-airi/stage-tamagotchi typecheck`.
