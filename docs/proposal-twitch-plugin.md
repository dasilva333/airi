# Proposal: `airi-plugin-twitch-chat`

> **Status**: Draft
> **Author**: Richard Pinedo
> **Date**: 2026-06-24
> **Inspired by**: `airi-plugin-bilibili-laplace`, `airi-plugin-web-extension`

---

## Overview

This document proposes a new first-party plugin, `airi-plugin-twitch-chat`, that bridges a Twitch channel's live chat into the AIRI character runtime via the existing plugin protocol. The plugin would allow the AI character to passively read chat messages and react to high-priority events (subscriptions, channel point redemptions, raids, etc.) in real time.

The core infrastructure for this already exists. The plugin protocol, `server-sdk` client, `context:update` data plane, and `spark:notify` event system are all fully wired. This plugin would be a new **inbound data source** — nothing in the framework itself needs to change.

---

## Background

### Existing Plugin Precedents

| Plugin | Purpose | Status |
|---|---|---|
| `airi-plugin-bilibili-laplace` | Bilibili live stream chat ingest | WIP (stub) |
| `airi-plugin-homeassistant` | Home Assistant event ingest | WIP (stub) |
| `airi-plugin-web-extension` | Browser page/video/subtitle context | ✅ Fully implemented |
| `airi-plugin-claude-code` | Claude Code hook integration | ✅ Functional |

The Bilibili plugin (`airi-plugin-bilibili-laplace`) was the proof-of-concept for this pattern, establishing that the framework can support live streaming chat as an ambient context source. This proposal formalizes the same design for Twitch.

---

## Architecture

### Hub-and-Spoke Model

The AIRI runtime uses a central WebSocket server (`server-runtime`, listening on `ws://localhost:6121/ws`) as a message bus. All modules — the AI character, the UI stage, and plugins — connect to this bus as peer clients. Plugins are **separate processes** that push data into the bus; they do not call the character directly.

```
┌──────────────────────────────────────┐
│        airi-plugin-twitch-chat       │
│                                      │
│  Twitch EventSub / IRC               │
│     ↓ on chat message                │
│  format → context:update             │
│     ↓ on sub / bits / raid           │
│  format → spark:notify               │
└───────────────┬──────────────────────┘
                │  WebSocket + authToken
                │  ws://localhost:6121/ws
                ↓
┌──────────────────────────────────────┐
│         server-runtime (hub)         │
│  - Module registry                   │
│  - Event routing                     │
│  - Auth enforcement                  │
└──────┬──────────────┬────────────────┘
       ↓              ↓
  stage-tamagotchi  stage-web
  (AI character)    (web UI)
```

### Two Logical Planes

The SDK distinguishes between two communication planes:

| Plane | Channel | Purpose |
|---|---|---|
| **Control plane** | `host` | Lifecycle: authenticate → announce → configure → ready |
| **Data plane** | `data` | Runtime: context updates, spark notifications, input events |

---

## Authentication Requirement

> [!IMPORTANT]
> Since this plugin was first conceived, the `server-runtime` WebSocket endpoint now **requires a valid `authToken`** to accept a connection. Unauthenticated connections are rejected before the `module:announce` handshake can complete.
>
> This is a security boundary — plugins have access to the data plane and can inject arbitrary context into the character's LLM context window, so uncontrolled access would be a significant attack surface.

Every plugin **must** supply a token in its `Client` constructor:

```ts
new Client({
  name: 'proj-airi:plugin-twitch-chat',
  url: settings.wsUrl,
  token: settings.airiAuthToken, // ← required, no longer optional
  identity: createIdentity(),
  possibleEvents: ['context:update', 'spark:notify', 'spark:emit'],
  autoReconnect: true,
})
```

The token is exchanged via the `module:authenticate` → `module:authenticated` handshake before any data is accepted:

```
Plugin → server:  { type: 'module:authenticate', data: { token: '...' } }
server → Plugin:  { type: 'module:authenticated', data: { authenticated: true } }
Plugin → server:  { type: 'module:announce', data: { name, identity, possibleEvents } }
server → Plugin:  { type: 'module:announced', data: { name, index, identity } }
```

The `server-sdk` `Client` class handles this handshake automatically — the plugin just needs to pass the token.

---

## Module Lifecycle

The full lifecycle a plugin goes through after connecting:

```
1. module:authenticate       → module:authenticated
2. module:announce           → module:announced
3. module:prepared
4. module:configuration:*    (validate / plan / commit)
5. module:configuration:configured
6. module:contribute:capability:offer
7. module:status (phase: ready)
```

The plugin declares what events it can emit (`possibleEvents`) and what config schema it expects (e.g., Twitch channel name, OAuth token). The host handles config storage and delivery.

---

## Data Flow: Chat Messages

Every incoming Twitch chat message maps to a `context:update` event. The `lane` field namespaces the stream so the LLM context assembler knows where data comes from and can apply the correct strategy:

```ts
client.send({
  type: 'context:update',
  data: {
    id: nanoid(),
    contextId: nanoid(),
    lane: 'twitch:chat', // namespaced topic
    strategy: ContextUpdateStrategy.AppendSelf, // rolling log, not replace
    text: `[${username}]: ${messageText}`,
    metadata: {
      source: 'twitch-chat',
      channelId,
      channelName,
      username,
      displayName,
      userId,
      color: user.color,
      badges: user.badges,
      isSubscriber: user.isSubscriber,
      isMod: user.isMod,
      isBroadcaster: user.isBroadcaster,
      timestamp: Date.now(),
    },
  },
})
```

### Context Strategies

| Strategy | Use Case |
|---|---|
| `ReplaceSelf` | Single-source facts (e.g., "stream title is X") — only the latest matters |
| `AppendSelf` | Chat feed — new messages accumulate as a rolling log |

---

## Data Flow: High-Priority Events

Subscriptions, bits, raids, and channel point redemptions should fire `spark:notify` events. These are routed directly to the character with urgency metadata, allowing the AI to interrupt or react immediately rather than waiting for the next LLM pass:

```ts
// New subscription
client.send({
  type: 'spark:notify',
  data: {
    id: nanoid(),
    eventId: nanoid(),
    kind: 'alarm',
    urgency: 'immediate',
    headline: `${username} just subscribed! (${tier})`,
    note: giftMessage || undefined,
    payload: {
      username,
      userId,
      tier, // 'prime' | '1000' | '2000' | '3000'
      isGift: false,
      cumulativeMonths,
    },
    destinations: ['character'],
  },
})

// Raid
client.send({
  type: 'spark:notify',
  data: {
    id: nanoid(),
    eventId: nanoid(),
    kind: 'alarm',
    urgency: 'immediate',
    headline: `${fromBroadcasterName} is raiding with ${viewers} viewers!`,
    payload: { fromBroadcasterId, fromBroadcasterName, viewers },
    destinations: ['character'],
  },
})
```

### Event → Urgency Mapping

| Twitch Event | `kind` | `urgency` |
|---|---|---|
| Chat message | — | `context:update` (not spark) |
| Subscription / resub | `alarm` | `immediate` |
| Gift sub | `alarm` | `immediate` |
| Bits / cheer | `alarm` | `soon` |
| Channel point redemption | `ping` | `soon` |
| Raid incoming | `alarm` | `immediate` |
| Stream goes live/offline | `reminder` | `later` |

---

## Plugin Config Schema

The plugin would declare this config schema during `module:announce`:

```ts
const configSchema: ModuleConfigSchema = {
  id: 'airi.config.plugin-twitch-chat',
  version: 1,
  schema: {
    type: 'object',
    required: ['channelName', 'twitchOAuthToken', 'airiAuthToken'],
    properties: {
      channelName: {
        type: 'string',
        description: 'Twitch channel to join (without #)',
      },
      twitchOAuthToken: {
        type: 'string',
        description: 'Twitch OAuth token for IRC/EventSub authentication',
      },
      airiAuthToken: {
        type: 'string',
        description: 'AIRI server auth token (required to connect to the WebSocket hub)',
      },
      wsUrl: {
        type: 'string',
        default: 'ws://localhost:6121/ws',
        description: 'AIRI server WebSocket endpoint',
      },
      chatHistorySize: {
        type: 'number',
        default: 50,
        description: 'Max number of chat messages to keep in rolling context',
      },
      enableSubAlerts: { type: 'boolean', default: true },
      enableRaidAlerts: { type: 'boolean', default: true },
      enableBitsAlerts: { type: 'boolean', default: true },
      enableChannelPoints: { type: 'boolean', default: false },
      sendSparkNotify: { type: 'boolean', default: true },
      chatMode: {
        type: 'string',
        default: 'followup',
        description: 'The chat strategy to handle incoming messages (followup: reply sequentially, steer: interrupt ongoing typing with new message context, collect: bundle messages during rapid-fire and respond after a lull)',
      },
      collectLullMs: {
        type: 'number',
        default: 5000,
        description: 'Wait time in milliseconds of silence before flushing a collected batch of messages (only active in collect mode)',
      },
    },
  },
}

---

## Chat Ingestion Strategies (chatMode)

To prevent the LLM from being overwhelmed by high-frequency twitch chat messages, the plugin supports three group-chat strategies mirrored from AIRI's Discord integration:

1. **`followup` (Default)**: Replies to everything sequentially.
2. **`steer` (Interrupt Mode)**: If the bot is in the middle of generating a response and a new chat message arrives, it halts the current thought, rolls the new message into context, and generates a fresh response.
3. **`collect` (Lull Mode)**: If chat is highly active, messages are accumulated/batched. Once a silence/lull of `collectLullMs` (default: 5000ms) occurs, the batch is joined and submitted as a single context block. This avoids spamming requests.
```

---

## Twitch API Integration

### Recommended Approach: EventSub (WebSocket transport)

Twitch's modern event system. Requires only a **User OAuth token** with appropriate scopes. Supports all the events we care about and is officially maintained.

```
Required OAuth scopes:
  chat:read                   — read chat messages
  channel:read:subscriptions
  bits:read
  channel:read:redemptions
  channel:read:raids           (via eventsub)
```

### Alternative: Twitch IRC (TMI)

Simpler to set up, but officially deprecated by Twitch. Avoid for new implementations unless fast prototyping.

### Recommended Library

[`@twurple/eventsub-websocket`](https://twurple.js.org/) — maintained TypeScript library that wraps the Twitch EventSub WebSocket transport cleanly. Handles reconnection, token refresh, and event parsing.

---

## Proposed File Structure

```
plugins/
└── airi-plugin-twitch-chat/
    ├── package.json
    ├── tsconfig.json
    ├── tsdown.config.ts
    └── src/
        ├── index.ts          ← entry point: definePlugin()
        ├── client.ts         ← AIRI server-sdk Client wrapper
        ├── twitch.ts         ← EventSub connection + event handlers
        ├── context.ts        ← context:update helpers
        ├── spark.ts          ← spark:notify helpers
        └── config.ts         ← config schema + types
```

---

## Reference Implementations

| File | What to study |
|---|---|
| [`airi-plugin-web-extension/src/background/client.ts`](../plugins/airi-plugin-web-extension/src/background/client.ts) | Full working example of `Client` usage, `context:update`, `spark:notify` |
| [`packages/server-sdk/src/client.ts`](../packages/server-sdk/src/client.ts) | The `Client` class internals — auth handshake, reconnect, `send()` |
| [`packages/plugin-protocol/src/types/events.ts`](../packages/plugin-protocol/src/types/events.ts) | All typed events, `ContextUpdate`, `SparkNotifyEvent`, `ModuleConfigSchema` |
| [`packages/plugin-sdk/src/plugin/define.ts`](../packages/plugin-sdk/src/plugin/define.ts) | `definePlugin()` — the entry point pattern |
| [`packages/plugin-sdk/src/channels/index.ts`](../packages/plugin-sdk/src/channels/index.ts) | How control vs data channels are set |

---

## Open Questions

- [ ] Should the plugin run as a standalone Node process or be embeddable inside Electron (like the web-extension background)?
- [ ] Who manages the Twitch OAuth token lifecycle / refresh? The plugin, or does AIRI's config system store + rotate it?
- [ ] Should chat history windowing (trimming older messages from context) be handled inside the plugin or by the server-runtime context assembler?
- [ ] Channel point redemption handling: should only specific redemption titles trigger sparks, or all of them?

## Relevant Skills

- [[airi-discord-integration]]
