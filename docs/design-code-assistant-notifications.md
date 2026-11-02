# Architecture & Design: Code Assistant Notifications (Bridges & Sync)

> **Status**: Approved Design Specification & Architecture Proposal
> **Cluster / Module**: `BRIDGES & SYNC 網` (`/settings/modules/code-assistant`)
> **Primary Stores**: [`packages/stage-ui/src/stores/modules/code-assistant.ts`](../packages/stage-ui/src/stores/modules/code-assistant.ts), [`packages/stage-ui/src/stores/event-log.ts`](../packages/stage-ui/src/stores/event-log.ts), [`packages/stage-ui/src/stores/character-card.ts`](../packages/stage-ui/src/stores/character-card.ts), [`packages/stage-ui/src/stores/display-models.ts`](../packages/stage-ui/src/stores/display-models.ts)
> **Server Runtime**: [`packages/server-runtime/src/index.ts`](../packages/server-runtime/src/index.ts), [`apps/stage-tamagotchi/src/main/services/airi/channel-server/index.ts`](../apps/stage-tamagotchi/src/main/services/airi/channel-server/index.ts)
> **Related Components**: [`Select.vue`](../packages/ui/src/components/form/select/select.vue), [`BasicButton.vue`](../packages/ui/src/components/misc/button/basic-button.vue)
> **Related Domain Skills**: [`airi-model-customizer`](../.agents/skills/airi-model-customizer/SKILL.md), [`airi-caption-subsystem`](../.agents/skills/airi-caption-subsystem/SKILL.md), [`airi-memory-event-log`](../.agents/skills/airi-memory-event-log/SKILL.md), [`airi-gateway-websocket-protocol`](../.agents/skills/airi-gateway-websocket-protocol/SKILL.md)
> **Settings Catalog**: [`packages/stage-ui/src/constants/settings-catalog.ts`](../packages/stage-ui/src/constants/settings-catalog.ts) §Cluster: `BRIDGES & SYNC 網`

---

## 1. Executive Summary & Core Motivation

Desktop pets like `claude-chan` demonstrated strong developer excitement for an expressive companion that works alongside coding agents (typing while running tools, raising a hand with `!` when awaiting permission, cheering on turn completion).

However, external pet wrappers rely on static pixel gifs, operate in isolation from character identity, and require running a separate Electron app.

**Project AIRI** already possesses the ideal avatar rendering engines (Live2D, VRM, MMD, Spine, Stage-Mate Unity sidecar), rich expression/motion capability mappings, a multi-surface caption subsystem, and a hardened local WebSocket server runtime on port `6121`.

This design establishes a native **Code Assistant Notifications** subsystem in AIRI. It delivers:
1. **Studio-Grade 2-Tab UX**: Following the visual conventions of *Friends & Companions* and *Discord Bot*, organizing settings into **Reactions** (character behavior, state mappings, and live preview) and **Connections** (agent installers, connection health, and manual integration).
2. **2/3 vs 1/3 Editor & Live Preview Panel**: A responsive 2-column studio layout where selecting states, emotions, and motions on the left immediately updates a live character & caption preview canvas on the right, equipped with a 1-click **Test lifecycle** sequence runner.
3. **Expandable Accordion Caption Templates**: Clean scannable state rows that unfold to reveal `{headline}`, `{note}`, `{tool}` variable chips and live resolved examples without cluttering the screen into a spreadsheet.
4. **4-Format Parity via Native Dropdown Selects**: Feeds normalized capabilities directly from `displayModelsStore.getOrLoadModelCapabilities(modelId)` into standard `@proj-airi/ui` `<Select />` dropdowns with an audition `▶` button, achieving complete VRM, Live2D, MMD, and Spine support with zero refactoring churn on `ModelCustomizer.vue`.
5. **Secure REST & WebSocket Ingestion on H3**: Built on `server-runtime` port `6121` (`POST /api/assistant/state`), verified with bearer authentication against AIRI's existing `authToken`.
6. **Safe Degradation & Stage-Bound Scoping**: When paused or switched to an unconfigured character, incoming webhooks return HTTP 200 OK so agents never fail, while AIRI silently absorbs the event with zero actuation and zero logging.
7. **Pillar 7 Event Ledger Integration**: Structured state transitions stream into `useEventLogStore().appendEvent(...)` (viewable in the desktop chat Event Ledger and consumed by proactivity heartbeats) rather than polluting the user's conversational chat transcript.

---

## 2. Page Hierarchy & Visual Layout

The visual architecture is modeled directly after AIRI's most refined settings pages (*Friends & Companions* and *Discord Bot*).

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ [>_] Code Assistant Notifications                             Enable notifications [●] │
│      Your companion, in sync with your coding assistant.                               │
│      🟢 Ready · ReLU is responding to assistant events                                 │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ [ Reactions ]   [ Connections ]                                                        │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ ┌─ Character reactions ──────────────────────────────────────────────────────────────┐ │
│ │ [Avatar]  These reactions apply while this character is on stage.                  │ │
│ │           [ ReLU ▾ ] [On stage]               Enable for ReLU [●]   [ ··· ]         │ │
│ └────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                        │
│ ┌─ State reactions (2/3 width) ──────────────────┐  ┌─ Reaction preview (1/3 width) ─┐ │
│ │ State      Expression  Motion     Sound   Cap  │  │ 🟡 Needs you                   │ │
│ │ 🟢 Working Focused ▾   Typing ▾   None ▾  [●] ▶│  │ ┌────────────────────────────┐ │ │
│ │ 🟡 Needs you Curious ▾ Raise hand Soft ▾  [●] ▶│  │ │      [Comic Bubble]        │ │ │
│ │   ┌─ Caption template ───────────────────────┐ │  │ │  "Approval needed: Run..." │ │ │
│ │   │ {headline}: {note}  [Head] [Note] [Tool] │ │  │ │         ( Avatar )         │ │ │
│ │   │ Preview: Approval needed: Run test suite?│ │  │ └────────────────────────────┘ │ │
│ │   └──────────────────────────────────────────┘ │  │ [ ▶ Play reaction ] [■]       │ │
│ │ 🔵 Complete Happy ▾    Celebrate  Chime ▾ [●] ▶│  │ [ Test lifecycle → ]          │ │
│ │ ⚪ Idle     Neutral ▾  Breathing  None ▾  [○] ▶│  │ Preview only · No activity     │ │
│ │ 🔴 Error    Concerned▾ Sigh ▾     Alert ▾ [●] ▶│  └────────────────────────────────┘ │
│ └────────────────────────────────────────────────┘                                     │
│                                                                                        │
│ ┌─ Captions & behavior (Full width) ─────────────────────────────────────────────────┐ │
│ │ Show captions in: [ Follow settings (Currently: Above char) ] [Above char] [Win] [Off]│
│ │                                                                                    │ │
│ │ Reset to idle after inactivity: [ 90 seconds ▾ ]                                   │ │
│ │ Record in Event Ledger: [●]                              View assistant events →   │ │
│ └────────────────────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Page Header & Status Bar
- **Header Icon**: Terminal icon `>_` inside a rounded purple squircle.
- **Title**: `Code Assistant Notifications`
- **Subtitle**: `Your companion, in sync with your coding assistant.`
- **Master Switch**: `Enable notifications` toggle on the top right.
- **Dynamic Semantic Status Indicator**:
  - `🟢 Ready · <Character> is responding to assistant events` (Notifications on, active character configured).
  - `⏸️ Paused · Notifications are disabled` (Master toggle off).
  - `⚪ Setup needed · <Character> has no reactions configured` (Active character unmapped).

---

## 3. Tab 1: Reactions

The **Reactions** tab owns the character experience, state mappings, and real-time auditioning.

### 3.1 Character Scope Bar
- **Thumbnail & Heading**: Displays the character whose reactions are being viewed.
- **Stage-Bound Character Dropdown**: `[ ReLU ▾ ]` with pill badge `On stage`.
  - Selecting a different character in the dropdown **swaps the active character on stage**, ensuring all visual previews and physical capability lists are 100% accurate.
- **Character Enable Switch**: `Enable for ReLU` toggle on the right.
- **Overflow Menu (`···`)**:
  - `Copy reactions from...` (opens modal to duplicate mappings from another character).
  - `Reset reactions to default`.
- **Empty State**: For an unconfigured character, shows an intentional setup card with `Set up reactions` and `Copy from another character` rather than five blank rows.

### 3.2 Main Area: Left 2/3 (State Reactions Matrix)
The 5 canonical states are presented with friendly labels:

| State Key | Friendly Label | Dot Indicator | Default Expression | Default Motion | Default Sound | Caption |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `work` | **Working** | 🟢 Green | Focused | Typing | None | On |
| `wait` | **Needs you** | 🟡 Amber | Curious | Raise hand | Soft ding | On |
| `done` | **Complete** | 🔵 Blue | Happy | Celebrate | Chime | On |
| `idle` | **Idle** | ⚪ Gray | Neutral | Breathing | None | Off |
| `error` | **Error** | 🔴 Red | Concerned | Sigh | Alert | On |

#### Symmetrical Row Capabilities & Accordion Templates:
- **Expression Selector**: Streamlined `<Select />` dropdown displaying the model's available expressions (e.g. `Focused`, `Curious`, `Happy`, `Neutral`, `Concerned`) loaded dynamically from `displayModelsStore.getOrLoadModelCapabilities(modelId)`.
- **Motion Selector**: Streamlined `<Select />` dropdown displaying available animations/motions (e.g. `Typing`, `Raise hand`, `Celebrate`, `Breathing`, `Sigh`) from the model capabilities.
- **Sound Selector**: Auditory cue picker (`None`, `Soft ding`, `Chime`, `Alert`, `Success fanfare`).
- **Caption Toggle**: Instant switch to enable/disable caption emission for that state.
- **Play Button (▶)**: Inline audition button to test the complete combination (expression + motion + sound + caption) directly on the live character without saving or altering assistant session state.
- **Expandable Accordion Drawer**: Clicking anywhere on a state row unfolds its caption settings:
  - **Caption template input**: Text field (e.g. `{headline}: {note}`).
  - **Clickable variable chips**: `[ Headline ]`, `[ Note ]`, `[ Tool ]` (clicking inserts at cursor).
  - **Resolved live example**: Dynamic preview string (e.g. *Preview: Approval needed: Run the test suite?*).

### 3.3 Main Area: Right 1/3 (Reaction Preview Panel)
Tethered directly to the matrix to provide instant auditioning:
- **Header**: `Reaction preview` with the active state badge (e.g. `🟡 Needs you`).
- **Visual Canvas**: A rounded viewport rendering the on-stage character performing the selected motion/expression with the in-scene head-tethered comic bubble floating above her head.
- **Action Controls**:
  - `[ ▶ Play reaction ]` (primary purple button) — plays the single selected reaction.
  - `[ ⏹ ]` — halts active preview and settles the avatar.
  - `[ Test lifecycle → ]` — automatically runs the sequential storyline over 12 seconds:
    `Working (3s)` &rarr; `Needs you (3s)` &rarr; `Working (2s)` &rarr; `Complete (3s)` &rarr; `Idle`.
- **Footnote & Architectural Boundary**: `Preview only · No activity recorded`. Previews **never** write to the Event Ledger or alter real assistant session state.

### 3.4 Bottom Card: Captions & Behavior
- **Show captions in**: Segmented pill control:
  - `Follow settings` (active pill displays resolved state: `Currently: Above character`).
  - `Above character` (head-tethered comic bubble in-scene).
  - `Floating window` (desktop Electron transparent caption window).
  - `Off` (emotions and audio play, captions suppressed).
- **Completion Duration vs Stale Recovery Split**:
  - **Completion celebration display**: Avatar cheers and displays completion banner for **12 seconds** before smoothly easing back to idle breathing.
  - **Reset to idle after inactivity**: Dropdown (`30s`, `60s`, `90s`, `180s`, default: `90 seconds`). Watchdog timer that resets the avatar to idle if an agent process dies or disconnects without emitting `idle`.
- **Event Ledger Integration**:
  - `Record in Event Ledger` toggle switch.
  - Direct navigation link: `View assistant events →` (opens the desktop chat Event Ledger drawer).

---

## 4. Tab 2: Connections

The **Connections** tab provides guided 1-click hooks setup and secure manual integration.

### 4.1 Guided Assistant Cards
- **Claude Code Card**:
  - Logo / Badge: Anthropic Claude Code.
  - Status indicator: `🟢 Receiving events (last: 2m ago)` | `🟡 Hooks installed · No events received yet` | `⚪ Not connected`.
  - Action button: `[ Link Claude Code ]` (backs up `~/.claude/settings.json` and inserts hooks) / `[ Remove ]`.
- **Google Antigravity Card**:
  - Logo / Badge: Google Antigravity.
  - Status indicator: `🟢 Receiving events` | `🟡 Plugin installed · No events received yet` | `⚪ Not connected`.
  - Action button: `[ Install Antigravity Plugin ]` (writes to `~/.gemini/config/plugins/airi-companion/hooks.json`).

### 4.2 Collapsible Manual Integration Card
Collapsed by default for clean presentation and security:
- **Endpoint URL**: `http://127.0.0.1:6121/api/assistant/state` with copy button.
- **Authentication Token**: Masked (`••••••••••••••••••••••••`) with `[ Reveal ]` toggle and copy button.
- **Copy Authenticated Command**: One-click copy of a fully formed cURL command with the live token pre-filled.
- **Connection Test**: `[ Test Connection ]` button that sends a ping payload and displays an immediate `✓ Verified: HTTP 200 received` badge.

---

## 5. Multi-Session, Chat & Conflict Resolution Rules

1. **Multi-Session Priority Hierarchy**:
   If multiple agent sessions (e.g. Antigravity in one terminal and Claude Code in another) report concurrently:
   - `Needs you` (`wait`) always **preempts** `Working` (`work`). If any session needs approval, the avatar alerts immediately.
   - `Working` (`work`) takes precedence over `Idle` (`idle`).
   - `Complete` (`done`) is **only celebrated once all active sessions are finished**. One session completing while another is still compiling tests continues showing `Working`.
2. **Character Swapping & Pause Cleanup**:
   Toggling off notifications or switching on stage to an unconfigured character **immediately flushes active assistant captions and releases the avatar from held emotions/motions**. No stale approval bubbles remain on screen.
3. **Chat Speech vs Coding Reactions**:
   If the user initiates a vocal/text chat conversation with AIRI while a coding agent is running:
   - AIRI's spoken dialogue and sentence-sync TTS motions take temporary precedence on stage.
   - Attention alerts (`Needs you`) remain visible in the caption bubble so permission requests are not missed.
4. **Notification-Only Framing**:
   Assistant captions are purely informative notifications. They do not render clickable "Approve / Deny" buttons inside AIRI, maintaining a clear security boundary.

---

## 6. Network & Data Schemas

### 6.1 REST Endpoint (`packages/server-runtime/src/index.ts`)
- **Route**: `POST /api/assistant/state`
- **Auth**: `Authorization: Bearer <authToken>`
- **Response**: HTTP 200 `{ "status": "ok", "delivered": boolean }` (returns `delivered: false` when paused or unmapped).

### 6.2 TypeScript Store State (`useCodeAssistantStore`)
```typescript
export type AssistantState = 'work' | 'wait' | 'done' | 'idle' | 'error'

export interface StateReactionConfig {
  emotion: string | null
  motion: string | null
  sound: string | null
  showCaption: boolean
  captionTemplate: string
}

export interface CharacterReactionsConfig {
  enabled: boolean
  states: Record<AssistantState, StateReactionConfig>
}

export interface CodeAssistantStoreState {
  globalEnabled: boolean
  captionSurface: 'inherit' | 'head-tether' | 'floating' | 'disabled'
  logToEventLedger: boolean
  staleTimeoutSeconds: number
  celebrationDurationSeconds: number
  characterConfigs: Record<string, CharacterReactionsConfig> // Keyed by cardId
}
```

---

## 7. Phased Implementation Roadmap

```
┌────────────────────────────────────────────────────────┐
│ Phase 1: Data Models, Protocol & useCodeAssistantStore │
│          • Store state, multi-session resolver         │
│          • Dual gating (global + activeCardId)         │
│          • Actuation (emotions, motions, captions, log)│
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│ Phase 2: Backend H3 REST Ingestion (server-runtime)    │
│          • POST /api/assistant/state in H3 app         │
│          • Bearer token auth verification              │
│          • WebSocket broadcast to Electron renderer    │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│ Phase 3: Settings UI Page (/settings/modules/code-...) │
│          • Two tabs (Reactions / Connections)          │
│          • 2/3 matrix editor with accordion templates  │
│          • Native <Select /> options from capabilities │
│          • 1/3 reaction preview canvas & lifecycle run │
│          • Captions & behavior bottom card             │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│ Phase 4: Connections Tab & Agent Quick-Installers      │
│          • Claude Code & Antigravity hooks IPC         │
│          • Masked token & authenticated cURL generator │
│          • End-to-end multi-agent verification         │
└───────────────────────────┘
```

---

## 8. Verification Matrix

1. **2-Tab Navigation**:
   - Verify switching between `Reactions` and `Connections` retains local component state.
2. **Active Stage Character Switching**:
   - Changing character in `[ ReLU ▾ ]` dropdown updates the on-stage model and re-hydrates capability options.
3. **Accordion Template Expansion**:
   - Clicking a row expands the template field and chips (`[Headline]`, `[Note]`, `[Tool]`); clicking chips inserts tags correctly.
4. **Preview Isolation**:
   - Clicking `Play reaction` or `Test lifecycle →` actuates preview without adding entries to `useEventLogStore`.
5. **Multi-Session Priority**:
   - Simulate simultaneous `work` and `wait` payloads &rarr; verify `Needs you` displays until resolved.
6. **REST Auth & Silent Absorption**:
   - With `globalEnabled: false`, send cURL with valid token &rarr; HTTP 200 `{ "status": "ok", "delivered": false }`, 0 movements, 0 captions.
