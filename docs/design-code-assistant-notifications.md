# Architecture & Design: Code Assistant Notifications (Bridges & Sync)

> **Status**: Design Specification & Architecture Proposal
> **Cluster / Module**: `BRIDGES & SYNC 網` (`/settings/modules/code-assistant`)
> **Primary Stores**: [`packages/stage-ui/src/stores/modules/code-assistant.ts`](../packages/stage-ui/src/stores/modules/code-assistant.ts), [`packages/stage-ui/src/stores/event-log.ts`](../packages/stage-ui/src/stores/event-log.ts), [`packages/stage-ui/src/stores/character-card.ts`](../packages/stage-ui/src/stores/character-card.ts), [`packages/stage-ui/src/stores/display-models.ts`](../packages/stage-ui/src/stores/display-models.ts)
> **Server Runtime**: [`packages/server-runtime/src/index.ts`](../packages/server-runtime/src/index.ts), [`apps/stage-tamagotchi/src/main/services/airi/channel-server/index.ts`](../apps/stage-tamagotchi/src/main/services/airi/channel-server/index.ts)
> **Related Components**: [`ExpressionExplorer.vue`](../packages/stage-ui/src/components/scenarios/settings/model-settings/ExpressionExplorer.vue), [`ModelCustomizer.vue`](../packages/stage-ui/src/components/scenarios/settings/model-settings/ModelCustomizer.vue), [`MotionExplorer.vue`](../packages/stage-ui/src/components/scenarios/settings/model-settings/MotionExplorer.vue)
> **Related Domain Skills**: [`airi-model-customizer`](../.agents/skills/airi-model-customizer/SKILL.md), [`airi-caption-subsystem`](../.agents/skills/airi-caption-subsystem/SKILL.md), [`airi-memory-event-log`](../.agents/skills/airi-memory-event-log/SKILL.md), [`airi-gateway-websocket-protocol`](../.agents/skills/airi-gateway-websocket-protocol/SKILL.md)
> **Settings Catalog**: [`packages/stage-ui/src/constants/settings-catalog.ts`](../packages/stage-ui/src/constants/settings-catalog.ts) §Cluster: `BRIDGES & SYNC 網`

---

## 1. Executive Summary & Core Motivation

Desktop companions like `claude-chan` demonstrated strong developer interest in having an expressive desktop presence that reflects an agent's active execution loop (typing during tool execution, alerting with `!` when awaiting permission, cheering on turn completion).

However, external pet wrappers rely on static sprite gifs, operate in isolation from character personality, and require a separate desktop app.

**Project AIRI** already possesses the ideal avatar rendering engines (Live2D, VRM, MMD, Spine, Stage-Mate Unity sidecar), rich expression/motion capability mappings, a multi-surface caption subsystem, and a hardened local WebSocket server runtime on port `6121`.

This design establishes a native **Code Assistant Notifications** subsystem in AIRI. It provides:
1. **A Secure REST & WebSocket Ingestion Endpoint**: Built directly on `server-runtime`'s H3 engine on port `6121`, accepting state events (`{"state": "work" | "wait" | "done" | "idle" | "error"}`) protected by AIRI's existing `authToken`.
2. **Global Master Killswitch (Safe Degradation)**: When toggled off, the H3 endpoint continues answering with HTTP 200 OK so calling harnesses never crash or stall, but AIRI silently drops the event into the void with zero avatar actuation, zero captions, and zero Event Ledger logging.
3. **Character-Scoped Activation & Dynamic Stage Detection**: Mappings belong to specific character cards. If you switch on stage to a character without mappings, incoming events cleanly drop into the ether for lack of configuration without erroring.
4. **4-Format Capability Parity via `ExpressionExplorer` / `MotionExplorer` Primitives**: Reuses the battle-tested capability resolution and preview dispatch pipeline from `ExpressionExplorer.vue` and `ModelCustomizer.vue` rather than reinventing multi-format normalization for VRM, Live2D, Spine, MMD, and Stage-Mate.
5. **Symmetrical Avatar & Overlay Actuation**: Resolves incoming states to concrete avatar emotions, motions, and audio cues for configured characters.
6. **Symmetrical Caption Integration**: Feeds tool names, permission details, or completion notes into the user's chosen caption surface (in-scene head-tethered comic bubble or desktop floating caption window), with automatic lifecycle dismissal.
7. **Introspective Event Ledger Recording**: Pushes structured state transitions to AIRI's `EventLog` (`useEventLogStore`) rather than polluting conversational chat transcripts with synthetic dialogue bubbles.
8. **New UI Module in Bridges & Sync**: An intuitive settings page under `/settings/modules/code-assistant` featuring the state mapping matrix, caption surface selectors, character mapping management, and 1-click install helpers for Google Antigravity (Gemini), Claude Code, and arbitrary terminal tools.

---

## 2. Global Killswitch & Character Scoping Logic

To ensure the companion never behaves invasively and respects multi-character setups, incoming events pass through two strict evaluation gates:

```
                  POST /api/assistant/state
                             │
                             ▼
              ┌──────────────────────────────┐
              │  Global Master Killswitch?   │───[ Disabled ]───► 200 OK (Drop into void, 0 logging)
              └──────────────┬───────────────┘
                             │ (Enabled)
                             ▼
              ┌──────────────────────────────┐
              │  Active On-Stage Character   │
              │     has valid mappings?      │───[ No Mapping ]──► 200 OK (Drop into ether, 0 logging)
              └──────────────┬───────────────┘
                             │ (Configured)
                             ▼
               Execute Symmetrical Actuation
               (Emotion, Motion, Caption, Log)
```

### 2.1 Gate 1: Global Master Killswitch
- Controlled by `globalEnabled: boolean` in `useCodeAssistantStore`.
- **Behavior when disabled**:
  - The H3 endpoint `/api/assistant/state` returns HTTP 200 `{ "status": "ok", "delivered": false }`.
  - The agent harness (Antigravity, Claude Code, etc.) proceeds uninterrupted without errors or timeouts.
  - AIRI does **nothing**: no avatar movement, no caption broadcast, and **no Event Ledger writes**.

### 2.2 Gate 2: Character-Scoped Activation & Dynamic Stage Switching
- Mappings are stored per **Character Card ID** (`cardId`), with fallback to model ID (`displayModelId`).
- When an event arrives, AIRI inspects `characterCardStore.activeCard?.id`:
  1. If `characterMappings[activeCardId]` exists and `characterMappings[activeCardId].enabled === true`, the event actuates that character.
  2. If the user switches characters on stage to one without a configuration (e.g., swapping from a companion configured for pair-programming to a casual persona or game NPC), the event **drops into the ether**.
  3. When switching back to the configured character on stage, the system automatically detects the active character change and resumes actuation.

---

## 3. The Symmetrical 5-State Lifecycle Matrix

The system models agent lifecycles across **5 canonical states**, each supporting identical configuration facets:

| State Key | Semantic Meaning | Typical Agent Triggers | Default Caption Template | Default Motion / Emotion |
| :--- | :--- | :--- | :--- | :--- |
| **`work`** | Agent is running tools, inspecting code, or synthesizing answers | `PreInvocation`, `PreToolUse` | `🛠️ {tool || 'Working...'}` | Emotion: `think` / `focused`<br>Motion: `typing` / `nod` |
| **`wait`** | Agent paused; awaiting user permission, answer, or confirmation | `PermissionRequest`, `AskUserQuestion`, interactive prompt | `⚠️ {headline || 'Approval Needed'}: {note}` | Emotion: `surprised` / `curious`<br>Motion: `raise_hand` / `alert` |
| **`done`** | Agent successfully completed its task / turn | `Stop` (`NO_TOOL_CALL`), test suite passed | `🎉 {note || 'Task Complete!'}` | Emotion: `happy` / `cool`<br>Motion: `cheer` / `celebrate` |
| **`idle`** | Agent inactive; resting / no active session | `SessionEnd`, 60s timeout after `done`, manual reset | *(None / Cleared)* | Emotion: `neutral` / `idle`<br>Motion: `idle` / `breathing` |
| **`error`** | Execution failed, command crashed, or process hit fatal halt | `StopFailure`, uncaught exception, test failure | `❌ Error: {note}` | Emotion: `sad` / `angry`<br>Motion: `dizzy` / `sigh` |

### Symmetrical Per-State Facet Matrix
For every state above, each character card configures:
1. **`emotion`** *(string | null)*: Expression/blendshape slot mapped from active character capabilities (e.g. `think`, `surprised`, `happy`, `neutral`, `sad`).
2. **`motion`** *(string | null)*: Animation/action mapped from model files (e.g. `typing`, `raise_hand`, `cheer`, `breathing`).
3. **`sound`** *(string | null)*: Audio cue (e.g. `none`, `chime_soft`, `alert_ding`, `success_fanfare`).
4. **`showCaption`** *(boolean)*: Whether to emit the state's text into the caption subsystem.
5. **`captionTemplate`** *(string)*: Template string supporting `{headline}`, `{note}`, `{tool}` interpolation.

---

## 4. Reusing Decomposed ModelCustomizer Primitives (`ExpressionExplorer` & `MotionExplorer`)

A critical goal is **not reinventing the wheel** for avatar actuation. Project AIRI already supports 4 distinct model formats (VRM, Live2D, Spine, MMD) plus the Stage-Mate Unity sidecar. Sourcing their capabilities, parsing raw archives, resolving human display labels, and triggering on-stage previews has already been solved and hardened in `packages/stage-ui/src/components/scenarios/settings/model-settings/`.

### 4.1 Integration with `ExpressionExplorer.vue`
In recent refactoring, expression browsing and actuation were decomposed into [`ExpressionExplorer.vue`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/components/scenarios/settings/model-settings/ExpressionExplorer.vue).
- **Mode `trigger` Support**: `ExpressionExplorer` natively accepts `:mode="'trigger'"` (where editing and renaming affordances are hidden, providing a clean, tap-to-preview palette).
- **Cross-Format Actuation (`triggerExpressionEffect`)**:
  - `live2d`: `live2dStore.triggerEmotion(key, 1.0)`
  - `vrm`: `modelStore.triggerEmotion(key, 1.0)` + Stage-Mate bridge invoke (`electronStageMateTriggerExpression`)
  - `mmd`: `mmdStore.previewExpression = key`
  - `spine`: `spineStore.selectVariantAndSkin(variant, skin)`
- **In Code Assistant Settings**:
  - The state matrix provides an inline selector that opens a compact **Expression Popover** powered by `ExpressionExplorer` in `mode="trigger"`.
  - Dropdown options are hydrated directly from `displayModelsStore.getOrLoadModelCapabilities(modelId)`, guaranteeing 100% label and category consistency with `ModelCustomizer`.

### 4.2 Decomposing `MotionExplorer.vue`
Following the same proven architectural pattern:
- In `ModelCustomizer.vue`, motion browsing is currently housed inline (`lines 323–360, 1184–1250`).
- We extract [`MotionExplorer.vue`](../packages/stage-ui/src/components/scenarios/settings/model-settings/MotionExplorer.vue) as a sibling to `ExpressionExplorer.vue`.
- `MotionExplorer.vue` owns:
  - Sourcing `motionCapabilities` from `getOrLoadModelCapabilities(modelId)`
  - Active animation indicators across `modelStore` (VRM), `live2dStore`, `mmdStore`, and `spineStore`
  - Tap-to-preview dispatch via `triggerMotionEffect(key)`
- This decomposed component is reused directly in both `ModelCustomizer.vue` and `code-assistant.vue` (and future features like Rehearsal Room and Field AI Generator), eliminating duplicated format handling across the monorepo.

---

## 5. Caption Subsystem & Surface Routing

### 5.1 Universal Surface Selection
Rather than binding head-tethered comic bubbles exclusively to `wait` and a generic ticker to `work`, caption surface selection is a clean **module-level preference**:

```typescript
export type AssistantCaptionSurface
  = | 'inherit' // Respects global Caption Settings (Settings -> Floating Controls -> Captions)
    | 'head-tether' // In-scene comic bubble tethered to model head (Live2D / VRM in-scene)
    | 'floating' // Desktop Electron standalone transparent caption window
    | 'disabled' // Avatar emotes and plays sounds, but no caption overlays appear
```

### 5.2 Caption Payload Protocol (`airi-caption-overlay`)
Whenever an active state has `showCaption: true`, the store formats a `CaptionSegment` and broadcasts it to the existing `airi-caption-overlay` channel:

```typescript
const captionChannel = new BroadcastChannel('airi-caption-overlay')

captionChannel.postMessage({
  type: 'caption-assistant',
  segments: [{
    text: formattedText,
    color: stateColors[state], // e.g. '#f59e0b' (wait), '#3b82f6' (work), '#10b981' (done)
    actorId: 'assistant',
    isActive: true,
  }],
})
```

### 5.3 Universal Lifecycle Dismissal
Transient state captions automatically dismiss on state transitions:
1. When transitioning from `wait` &rarr; `work`, the approval caption is instantly replaced with the `work` ticker or vacated.
2. When transitioning from `done` &rarr; `idle`, the completion banner automatically clears.
3. If an agent process crashes or disconnects without emitting `idle`, a configurable **Stale Timeout** (default: 90s) automatically resets the avatar to `idle` and empties `airi-caption-overlay`.

---

## 6. System Awareness via the Event Ledger (Pillar 7)

All state transitions for configured characters stream into **AIRI's Event Ledger** ([`packages/stage-ui/src/stores/event-log.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/event-log.ts)):

```typescript
useEventLogStore().appendEvent({
  category: 'tools',
  type: `assistant:state:${payload.state}`,
  source: payload.source || 'code-assistant',
  textSummary: payload.headline
    ? `[${payload.state.toUpperCase()}] ${payload.headline}: ${payload.note || payload.tool || ''}`
    : `[${payload.state.toUpperCase()}] ${payload.tool || payload.note || 'State transitioned'}`,
  payload: {
    state: payload.state,
    tool: payload.tool,
    note: payload.note,
    headline: payload.headline,
    characterId: activeCardId,
    metadata: payload.metadata,
  },
  inspectable: true,
})
```

---

## 7. Network & Ingestion Protocol Specification

### 7.1 Endpoint Specification
- **URL**: `http://127.0.0.1:6121/api/assistant/state`
- **Method**: `POST`
- **Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer <authToken>` *(Mandatory; matches `channelServerConfigStore.authToken`)*

### 7.2 Request Payload Schema (Valibot / TypeScript)
```typescript
import { enum_, nullable, object, optional, record, string, unknown } from 'valibot'

export const AssistantStatePayloadSchema = object({
  state: enum_(['work', 'wait', 'done', 'idle', 'error']),
  headline: optional(string()),
  note: optional(string()),
  tool: optional(string()),
  source: optional(string()), // e.g. "antigravity", "claude-code", "cursor", "codex"
  sessionId: optional(string()),
  metadata: optional(record(string(), unknown())),
})

export type AssistantStatePayload = InferOutput<typeof AssistantStatePayloadSchema>
```

---

## 8. Store Data Structures (`useCodeAssistantStore`)

```typescript
export interface StateConfig {
  emotion: string | null
  motion: string | null
  sound: string | null
  showCaption: boolean
  captionTemplate: string
}

export interface CharacterAssistantConfig {
  enabled: boolean
  states: Record<'work' | 'wait' | 'done' | 'idle' | 'error', StateConfig>
}

export interface CodeAssistantStoreState {
  globalEnabled: boolean
  captionSurface: AssistantCaptionSurface
  logToEventLedger: boolean
  staleTimeoutMs: number
  characterConfigs: Record<string, CharacterAssistantConfig> // Keyed by cardId
}
```

---

## 9. Phased Implementation Roadmap

To maintain velocity, guard against regressions, and keep verification boundaries small and high-confidence, development proceeds across 5 structured phases:

```
┌────────────────────────────────────────────────────────┐
│ Phase 1: Decompose MotionExplorer.vue in isolation     │
│          • Extract MotionExplorer.vue                  │
│          • Refactor ModelCustomizer.vue to adopt it    │
│          • Validate 4-format animation preview         │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│ Phase 2: Data Models, Protocol & useCodeAssistantStore │
│          • AssistantStatePayload & StateConfig schemas │
│          • Gating logic (globalEnabled + activeCardId) │
│          • Actuation (emotions, motions, captions, log)│
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│ Phase 3: Backend H3 REST Ingestion (server-runtime)    │
│          • POST /api/assistant/state in H3 app         │
│          • Bearer token auth verification              │
│          • WebSocket broadcast to Electron renderer    │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│ Phase 4: Settings UI Page (/settings/modules/code-...) │
│          • Register in settings-catalog.ts (Bridges)   │
│          • Master Killswitch & Surface picker          │
│          • Character scoping header & copy helper      │
│          • 5-state matrix using Expression/MotionExpl. │
│          • Interactive preview test buttons            │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│ Phase 5: Agent Quick-Installers & Verification         │
│          • 1-Click Antigravity plugin installer IPC    │
│          • 1-Click Claude Code hooks installer IPC     │
│          • Copyable live-token cURL snippet card       │
│          • End-to-end multi-character integration test │
└───────────────────────────┬────────────────────────────┘
```

### Phase 1: Decompose `MotionExplorer.vue` in Isolation
- **Scope**:
  1. Author `packages/stage-ui/src/components/scenarios/settings/model-settings/MotionExplorer.vue` mirroring `ExpressionExplorer.vue`.
  2. Supports `modelId: string`, `mode: 'trigger' | 'manage'`, `showInsertActions?: boolean`.
  3. Owns sourcing `motionCapabilities` from `getOrLoadModelCapabilities(modelId)` and preview dispatch (`triggerMotionEffect`) across Live2D, VRM, MMD, Spine, and Stage-Mate.
  4. Refactor `ModelCustomizer.vue` to replace its inline motions block with `<MotionExplorer :model-id="modelId" mode="manage" ... />`.
- **Validation**:
  - Run `pnpm -F @proj-airi/stage-ui typecheck`.
  - Verify ModelCustomizer animation previews in Settings continue working seamlessly.

### Phase 2: Data Models, Protocol & `useCodeAssistantStore`
- **Scope**:
  1. Declare `AssistantStatePayload` and `StateConfig` schemas.
  2. Create Pinia store `packages/stage-ui/src/stores/modules/code-assistant.ts` with local persistence.
  3. Implement Gate 1 (`globalEnabled`) and Gate 2 (`characterConfigs[activeCardId]`).
  4. Implement actuation: emotion & motion triggering, `airi-caption-overlay` broadcast, and `useEventLogStore().appendEvent(...)`.
- **Validation**:
  - Run `pnpm -F @proj-airi/stage-ui typecheck`.
  - Author unit test `packages/stage-ui/src/stores/modules/code-assistant.test.ts` verifying state transitions, gating, and automatic caption clearing.

### Phase 3: Backend H3 REST Ingestion (`server-runtime`)
- **Scope**:
  1. In `packages/server-runtime/src/index.ts`, add route handler `POST /api/assistant/state` on `h3App.app`.
  2. Implement `Authorization: Bearer <token>` check against `options.auth.token`.
  3. Validate request payload against `AssistantStatePayloadSchema`.
  4. Broadcast event `assistant:state` to authenticated peers.
  5. In `stage-ui`, bind `modsServerChannelStore.onEvent('assistant:state', (payload) => codeAssistantStore.handleStateEvent(payload))`.
- **Validation**:
  - Run `pnpm -F @proj-airi/server-runtime typecheck`.
  - Send cURL requests with/without bearer token to `http://127.0.0.1:6121/api/assistant/state` and verify HTTP 200/401/403 responses.

### Phase 4: Settings UI Page (`/settings/modules/code-assistant`)
- **Scope**:
  1. Register `mod-code-assistant` in `settings-catalog.ts` under cluster `BRIDGES & SYNC 網`.
  2. Create `packages/stage-pages/src/pages/settings/modules/code-assistant.vue`.
  3. Build Card 1 (Master Killswitch, Surface Picker, Stale Timeout, Event Ledger toggle).
  4. Build Card 2 (Active Character Scoping Header, Per-Card Enable toggle, Copy Mappings helper).
  5. Build Card 3 (Symmetrical 5-State Matrix embedding `ExpressionExplorer` and `MotionExplorer` in `mode="trigger"`).
  6. Build Card 4 (Interactive Preview test buttons).
- **Validation**:
  - Run `pnpm -F @proj-airi/stage-pages typecheck`.
  - Open Settings &rarr; Modules &rarr; Code Assistant Notifications in desktop Electron; verify UI reflow, dark/light theme, and live test buttons.

### Phase 5: Agent Quick-Installers & End-to-End Verification
- **Scope**:
  1. Add Card 5 (1-Click Agent Connectors & cURL Recipes) to `code-assistant.vue`.
  2. Implement Electron main-process IPC handlers in `apps/stage-tamagotchi`:
     - `installAntigravityPlugin`: Writes `~/.gemini/config/plugins/airi-companion/` (`plugin.json` + `hooks.json`).
     - `linkClaudeCodeHooks`: Backs up `~/.claude/settings.json` and inserts hook entries.
  3. Add copyable cURL recipe with live `authToken` auto-inserted.
- **Validation**:
  - Run `pnpm -F stage-tamagotchi typecheck`.
  - Perform live end-to-end test: fire Antigravity hook &rarr; avatar enters `work` pose; await permission &rarr; head-tethered caption displays command; approve &rarr; avatar cheers on `done`.

---

## 10. Verification & Test Plan

1. **Global Killswitch**:
   - Set `globalEnabled = false`.
   - Send `POST /api/assistant/state` with valid token.
   - Assert HTTP 200 returned (`delivered: false`).
   - Assert avatar does not move, no caption is broadcasted, and no event is logged in `local:event-log`.
2. **Character Scoping & Stage Switch**:
   - Configure character A with mappings; leave character B unconfigured.
   - When character A is on stage &rarr; Events actuate character A.
   - Switch stage to character B &rarr; Send event &rarr; HTTP 200 returned, but event safely drops into the ether with zero actuation or logging.
   - Switch stage back to character A &rarr; Actuation resumes.
3. **Multi-Model Format Parity via `ExpressionExplorer` / `MotionExplorer`**:
   - Verify Live2D model receives parameter cues.
   - Verify VRM model triggers blendshapes and animations.
   - Verify Spine model triggers variant / skin selections.
   - Verify MMD model triggers morphs and action clips.
4. **REST Authentication**:
   - `curl` without header &rarr; HTTP 401 Unauthorized.
   - `curl` with invalid bearer token &rarr; HTTP 403 Forbidden.
   - `curl` with valid bearer token &rarr; HTTP 200 OK + WebSocket broadcast.
5. **1-Click Agent Installers**:
   - Click "Install Antigravity Plugin" &rarr; Verify `~/.gemini/config/plugins/airi-companion/hooks.json` is generated with valid port and auth token.
   - Click "Link Claude Code" &rarr; Verify `~/.claude/settings.json` backup exists and hooks invoke the endpoint properly.
