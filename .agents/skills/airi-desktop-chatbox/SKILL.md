---
name: airi-desktop-chatbox
description: >-
  Build/debug desktop chat workspace navigation, composer, attachments, transcript bubbles, action menus, grounding panel and journal chips. Input routing uses airi-interaction-pipelines; Studio decisions use airi-director-orchestration.
---

# Desktop Chatbox

Own desktop chat surfaces, Quick Settings popover, right dashboard panel, and shared transcript presentation.

## Quick Reference & Specialized Topics

| Task / Domain | Reference Guide |
| :--- | :--- |
| **Quick Settings Popover** (Atmosphere, Wallpaper/Backgrounds, Staging, Voice, Capabilities, Injections, Tools) & **Dashboard Context Panel** | [Chat options & Dashboard](references/chat-options-and-dashboard.md) |
| **Workspace Routes & Left Nav** (`messages`, `director`, `world`, `characters`, `media`, `archives`, `event-log`, `notes`, `rehearsal`) | [Workspace navigation](references/workspace-navigation.md) |
| **Composer & Input** (Drafts, attachments, suggestions, send/stop, `InteractiveArea.vue`, `WhisperDock`) | [Composer](references/composer.md) |
| **Transcript & Bubbles** (Streaming rendering, action menus, grounding panel, journal chips, virtual scroll) | [Transcript rendering](references/transcript-rendering.md) |

---

## Canonical Surface & Component Inventory

### 1. Window Shell & Desktop Layout
- **Desktop Chat Shell**: `apps/stage-tamagotchi/src/renderer/pages/chat.vue`
  - Left navigation sidebar (`messages`, `director`, `world`, `characters`, `media`, etc.).
  - Right collapsible Dashboard context panel (`useChatDashboard()`).
  - Active background crossfader (`chatboxActiveBackgroundUrl`, GPU opacity transition).
- **Desktop Input Area**: `apps/stage-tamagotchi/src/renderer/components/InteractiveArea.vue`
  - Composer input, file drop & attachment tray, producer magic wand suggestions, send/stop lifecycle.

> [!WARNING]
> **Subpixel Antialiasing & Window Opacity Invariant**:
> Never make the desktop chat window semi-transparent or enable `transparent: true` on its `BrowserWindow`. Chromium and OS font engines (DirectWrite/CoreText) mathematically require a 100% opaque RGB backing store for subpixel text antialiasing (ClearType). Introducing window-level alpha drops rendering to blurry grayscale antialiasing, destroys text crispness, and causes severe eye strain. Keep the chat workspace fully opaque; transparent canvas rendering belongs strictly on the isolated Actor Stage (`windows/stage`).

### 2. Quick Settings Popover ("Chat Options")
- **Root Orchestrator**: `packages/stage-layouts/src/components/Layouts/ChatOptionsPopover.vue`
  - Triggered via `triggerVariant="dots"` in `chat.vue` (header action `...`) and `triggerVariant="circle"` in `MobileHeader.vue`.
  - Header renders `< Quick settings` back navigation and close button `(X)`.
  - Houses 7 isolated subviews under `packages/stage-layouts/src/components/Layouts/ChatOptions/`:

| Subview | File Path | Responsibilities & UI Features |
| :--- | :--- | :--- |
| **Root** | `ChatOptionsRootView.vue` | Spawn mode segmented control (`bg`, `widget`, `inline`), chat layout presets (`mini`, `medium`, `large`, `full`), 7 navigation tiles. |
| **Appearance** | `ChatOptionsAppearanceView.vue` | Header theme widget (`SettingsThemeHeaderWidget`), 6 atmosphere cards (`Hearts`, `Sakura`, `Anime Stars`, `Dreamy Bubbles`, `Cyber Crosses`, `Melody`), wallpaper thumbnail grid, scene picker modal trigger. |
| **Capabilities** | `ChatOptionsCapabilitiesView.vue` | Proactive heartbeats, screen watching, offline dreams, autonomous artistry (visual novel), auto-cues, cognitive loop. |
| **Tools** | `ChatOptionsToolsView.vue` | In-memory POSIX terminal sandbox (`bash`), local filesystem access, web search, screenshots, MCP integrations, generative motion. |
| **Injections** | `ChatOptionsInjectionsView.vue` | System sensors telemetry, 3-day recent memory summaries, Universe RAG retrieval, visual scene state scratchpad. |
| **Memories** | `ChatOptionsMemoriesView.vue` | Character context viewer modal, session management modal, memory search jump, deep links to memory & card settings. |
| **Staging** | `ChatOptionsStagingView.vue` | Character speech text color picker, per-actor color overrides with hex input and preview bubble. |
| **Voice** | `ChatOptionsVoiceView.vue` | Speaker output volume slider (0–100%), TTS toggle, single-actor / multi-actor voice dropdown selectors, audition preview buttons (`▶`). |

### 3. Atmosphere & Background Subsystems
- **Atmosphere Particle Patterns**: `packages/stage-layouts/src/components/Backgrounds/patterns/index.ts`
  - Defines `ATMOSPHERE_OPTIONS` (`hearts`, `petals` -> *Sakura*, `stars` -> *Anime Stars*, `bubbles` -> *Dreamy Bubbles*, `crosses` -> *Cyber Crosses*, `notes` -> *Melody*).
  - Individual components in `packages/stage-layouts/src/components/Backgrounds/patterns/`.
- **Background Store**: `packages/stage-ui/src/stores/background.ts` (`useBackgroundStore`)
  - Desktop chat keys: `chatboxActiveAtmosphereId` (`airi:chatbox-active-atmosphere-id`), `chatboxActiveBackgroundId` (`airi:chatbox-active-background-id`).
  - Stage keys: `activeAtmosphereId`, `activeBackgroundId`.
  - Scene Picker Dialog: `StageBackgroundDialogPicker` from `@proj-airi/stage-ui/components`.

### 4. Right Dashboard Context Panel
- **Chassis Host**: `apps/stage-tamagotchi/src/renderer/pages/chat.vue` (`showRightPanel` + `<ChatDashboardPanel />`).
- **Panel Orchestrator**: `apps/stage-tamagotchi/src/renderer/components/chat/ChatDashboardPanel.vue`.
- **Dashboard State & Composables**: `packages/stage-ui/src/composables/use-chat-dashboard.ts` (`useChatDashboard()`, `computeSmartInitialDashboardModules()`).
- **Shared Chassis Primitive**: `packages/stage-ui/src/components/scenarios/chat/ChatDashboardCard.vue`.
- **Persisted State in localStorage**:
  - `airi:chat:right-panel-open`: Panel open/collapsed toggle.
  - `airi:chat:dashboard-active-modules`: Ordered array of active module IDs (`DashboardModuleId[]`).
  - `airi:chat:dashboard-collapsed`: Map of per-module collapsed booleans (`Record<string, boolean>`).
  - `airi:chat:dashboard-has-initialized`: Sentinel boolean preventing overwriting custom user layouts with smart defaults on reload.
- **Built-in Modules & Gating**:
  - `stage`: Companion viewport via `RendererStage` (gated by `embeddedStageSupported ?? true`).
  - `widgets`: Sandboxed micro-apps via `ChatWorkspaceWidgetsPanel.vue` (ungated, available regardless of sandbox/bash status).
  - `terminal`: In-memory bash workstation via `ChatWorkspaceTerminalPanel.vue` (gated by `effectiveSandboxActive`).
  - `nan0`: Somatic cognition & reflexes via `ChatNan0CognitionPanel.vue` (gated by `isNan0Active`).
  - `memories`: Inline STMM daily summaries, echo anchors, and long-term journal snippets.
  - `scene`: Inline current visual background / scene cover preview.
  - `media`: Inline thumbnail gallery of generated imagery and backgrounds.
- **Modes**: View mode (runtime cards with chevrons) vs. Customize mode (`i-solar:tuning-2-linear` with drag-and-drop reordering, eye hide buttons, available module catalog, and "Restore default layout").

### 5. Shared Transcript Rendering
- **Shared Chat Scenario Components**: `packages/stage-ui/src/components/scenarios/chat/`
  - Message bubble presentation, action menus, grounding panel, echo chips, and journal chips.

---

## Key Code Anchors & Jump Targets

| Symbol / Target | Exact Path & Location | Purpose |
| :--- | :--- | :--- |
| Quick Settings Popover Root | `packages/stage-layouts/src/components/Layouts/ChatOptionsPopover.vue:L178` | Reka UI `PopoverContent` styling, subview navigation router |
| Quick Settings Title | `packages/stage-layouts/src/components/Layouts/ChatOptionsPopover.vue:L197` | Header text `Quick settings` |
| Appearance View Root | `packages/stage-layouts/src/components/Layouts/ChatOptions/ChatOptionsAppearanceView.vue:L84` | Appearance subview template |
| Atmosphere Options Definition | `packages/stage-layouts/src/components/Backgrounds/patterns/index.ts:L30` | `ATMOSPHERE_OPTIONS` array of particle effects |
| Wallpaper Quick Grid | `ChatOptionsAppearanceView.vue:L192` | 2×3 thumbnail grid for active character backgrounds |
| Desktop Chat Background Layer | `apps/stage-tamagotchi/src/renderer/pages/chat.vue:L1135` | Crossfaded `backgroundImage` container |
| Dashboard Host Layer | `apps/stage-tamagotchi/src/renderer/pages/chat.vue:L1640` | `<ChatDashboardPanel />` mount & right panel drawer container |
| Dashboard Panel Orchestrator | `apps/stage-tamagotchi/src/renderer/components/chat/ChatDashboardPanel.vue:L1` | Right panel view/customize mode, drag-drop, module cards |
| Dashboard State Composable | `packages/stage-ui/src/composables/use-chat-dashboard.ts:L132` | `useChatDashboard()` module definitions, reordering & persistence |
| Dashboard Chassis Card | `packages/stage-ui/src/components/scenarios/chat/ChatDashboardCard.vue:L1` | Card chassis with icon, title, action slot, chevron collapse |
| Desktop Input Submission | `apps/stage-tamagotchi/src/renderer/components/InteractiveArea.vue:L330` | `handleSend()` draft dispatch and optimistic clear |

---

## Verification

Check the affected surface with streaming text, tool output, empty history, and a switched character/session.
For code changes, run typechecks on affected packages:
- `pnpm -F @proj-airi/stage-layouts typecheck`
- `pnpm -F @proj-airi/stage-tamagotchi typecheck`
- `pnpm -F @proj-airi/stage-ui typecheck`
Shared renderer changes also require a web/pocket smoke check. Follow the selected reference guide's verification checklist.
