# Design Document: Discord Context Routing & Access Control

**Status:** Proposed / Under Review

**Goal:** Provide granular control over how Discord channels and Direct Messages (DMs) map to AIRI characters and session histories, alongside a robust permission matrix to restrict slash commands and bot interactions.

---

## 🏛️ Core Architecture

The new system will introduce a **Discord Router** layer and an **Access Control List (ACL)** layer in the Electron main service.

### 1. Global Routing Modes
Users will be able to select the default behavior for how incoming messages and commands are mapped:
1. **Shared / Legacy (Default Active)**: All incoming Discord interactions share the single active character and session currently selected in the desktop app GUI (mirroring the current behavior).
2. **Strict Fallback (Ignore)** *[Default]*: Any channel or DM that is not explicitly mapped in the routing table will be completely ignored by the bot.
3. **Isolated Fallback (Auto-Create)**: Unmapped channels/DMs will automatically create a dedicated, isolated session for that channel (or user ID, in DMs) using a specified default character card.

---

## 🗺️ Context Mapping & Routing Table

The router maintains a key-value mapping of incoming Discord channel contexts to internal AIRI resources:

```typescript
interface DiscordRoute {
  channelId: string // Guild channel ID or Private DM channel ID
  characterId: string // Target AiriCard ID
  sessionId: string // Target ChatSession ID
}
```

### Direct Message (DM) Handling
To ensure absolute privacy:
* Direct Messages are treated as virtual channels keyed by `dm-{userId}`.
* They are automatically routed to a private session isolated to that specific Discord User ID, preventing other users from seeing or interacting with that session.

---

## 🔐 Permission Matrix (Access Control)

Slash commands and raw message ingestion are gated by an access check:

### Command Classifications

1. **Admin / Configuration Commands**:
   * Commands: `/settings`, `/character`, `/summon`, `/leave`.
   * Scope: Strictly restricted to **Owner Only** (matching the owner's Discord User ID configured in the app).

2. **Standard / Conversational Commands**:
   * Commands: `/selfie`, `/history`, `/voicecall`, and raw text messages.
   * Access Levels:
     * `Owner Only`: Only the bot owner can trigger them.
     * `Whitelisted Only`: Only specified Discord User IDs or Role IDs can trigger them.
     * `Everyone`: Publicly accessible to anyone in allowed channels.
     * `Disabled`: The command is disabled and will ignore all incoming inputs.

---

## 🖥️ UI Integration: Settings Revamp

We will update `MessagingDiscord.vue` to expose these routing and access controls under a new section: **Access Control & Routing**.

### Proposed UI Layout:
* **Global Routing Mode Dropdown**: Choose between *Shared*, *Strict (Ignore)*, or *Auto-Create*.
* **Active Routes Table**: A dynamic table listing:
  * Discord Channel/DM Name
  * Mapped Character Card (Dropdown)
  * Mapped Session History (Dropdown)
  * Action: `[Remove Route]` / `[Add Route]`
* **Command Permission Table**:
  * Row for each Slash Command.
  * Columns with radio buttons for: `Owner Only` | `Whitelisted` | `Everyone` | `Disabled`.
  * Text area for **Whitelisted User/Role IDs** (comma-separated).
