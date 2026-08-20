# Phase B Buy-In: Local-First Mandate & De-Clouding Direction

Companion Docs:
- [`project-selective-upstream-sync-phase-a-buy-in.md`](./project-selective-upstream-sync-phase-a-buy-in.md) (Phase A skipped except #1819 context store hardening)
- [`project-selective-upstream-sync-shortlist.md`](./project-selective-upstream-sync-shortlist.md)

**Status:** WHOSALE REJECT of Upstream #1775. Our direction is active **De-Clouding** to reinforce strict local privacy.

---

## 🏛️ The Architectural Mandate: Strict Local-First Privacy

Upstream introduced signed-in cloud chat sync (#1775) under the guise of a "profile switcher" with no opt-out, quietly routing private user conversations to external hosted servers.

Our fork firmly rejects this direction:
1. **Desktop-First, Offline-Only**: The fork is a desktop-first, local-first application. We do not host external online services or route private chats to remote servers.
2. **De-Clouding Path**: Instead of syncing cloud features, our future path is to actively **strip out** remaining out-of-sync cloud sync hooks and WebSocket sync skeletons. (Note: Upstream sneakily smuggled their cloud sync layers under a deceptive commit titled "profile switcher". The actual character/card switching features—originally the profile switcher on the old Control Island and now the "characters" button on the control strip—remain fully active and protected; only the smuggled cloud sync components are targeted for purging.)
3. **No Cloud-Chat ID Coupling**: Any attempts to introduce `cloudChatId` or upstream's WebSocket cursors are wholesale rejected.

---

## 🗄️ Multi-Session UX: Fork vs Upstream

Upstream historically implemented multi-session capabilities in their data models but failed to expose any UI for users to leverage it.

* **The Upstream Solution**: Recently introduced a `sessions-drawer` UI component tightly coupled to their online cloud-sync WebSocket architecture.
* **The Fork Solution (Already Implemented & Superior)**: We have already built a dedicated **Memory Management** popover and **Session Management** modal directly inside the Chatbox toolbar. This gives users full, intuitive, local control over character-specific session switching and history creation—independent of any cloud infrastructure.

---

## 🔍 Upstream #1775 Diff & Squeeze Assessment

### 1. `session-store.ts` (Reject wholesale)
Upstream's updated store (~1,440 lines) couples in-memory indexing with `libs/chat-sync` and WS clients (`reconcileCloudSessions`, outbox retries, cloud outbox counts).
* **Verdict**: Reject. Adopting this would introduce massive cloud-centric bloat and break our `BroadcastChannel` same-machine multi-window synchronization.

### 2. `data-store.ts` and `chat.ts` edits (Reject)
These are tiny delegation tweaks designed to hook message compositions to remote pushes.
* **Verdict**: Reject. Irrelevant without a cloud server.

### 3. Local IDB Micro Patches (Consider separately)
We will port two critical local IndexedDB bugfixes independent of cloud sync:
* **`deleteSession` Ordering**: Change our current await-persist-first pattern to delete in-memory index **first**, then persist to IDB asynchronously. This prevents in-flight updates from resurrecting deleted sessions.
* **`loadSession` Guard**: Add a post-await check to ensure a session wasn't deleted while loading from IndexedDB.

---

## 🎯 Synthesized Direction Summary

| Area | Upstream (#1775) | Fork Direction |
|------|------------------|----------------|
| **Primary Goal** | Multi-device WebSocket cloud replication | **Absolute Local Privacy & Desktop Autonomy** |
| **Session Control** | Sessions Drawer (cloud-coupled) | **Memory Management Popover (Local IDB)** |
| **Store Architecture** | WS cursors + Outbox retries | **Strictly Offline IDB + same-machine `BroadcastChannel`** |
| **Sync Logic** | Real-time WebSocket replication | **De-clouding** (purge profile switcher remnants) |
| **Action** | Adopt Cloud Store Slice | **Micro-patch local IDB bugs; skip the rest** |

## Relevant Skills

- [[airi-roadmap-upstream-research]]
