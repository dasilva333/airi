---
name: airi-broadcast-channels
description: "Use when working with Cross-window BroadcastChannel relay registry, multi-window state synchronization, channel publisher/subscriber roles, and message payloads."
---
# Airi Broadcast Channels

## 1. Overview & Surface Map

- Cross-window `BroadcastChannel` instances across `packages/` and `apps/`
- Component communication across isolated Electron windows
- State synchronization hooks and utilities

## 2. Key Code Paths

- `grep -r "useBroadcastChannel" packages/ apps/`
- `docs/rosetta-stone.md` §13 (canonical registry)

## 3. Core SOPs & Guidelines

- **Registry Conventions:** The canonical registry is defined in `docs/rosetta-stone.md` §13. When introducing a new channel, record it there.
- **Naming Conventions:** Follow established naming conventions (`airi-*` vs `airi:*`).
- **API Styles:** Prefer `useBroadcastChannel` composables where applicable over raw `new BroadcastChannel()` allocations, ensuring proper lifecycle management (teardown on unmount).
- **Payloads:** Define strong typings for message payloads crossing the channel boundaries. Differentiate between publisher (sender) and subscriber (receiver) roles.

## 4. Known Pitfalls & Failure Modes
### 4. Known Failure Modes & Pitfalls

- **Memory Leaks:** Failing to close or destroy a `BroadcastChannel` when a component unmounts.
- **Message Loops:** Emitting a broadcast message in response to a broadcast message without a circuit breaker, leading to infinite loops across windows.
- **Serialization Issues:** Passing non-serializable objects (like DOM nodes or complex classes) through the channel.
- **Data Races:** Assuming immediate delivery or synchronous execution across windows.

## 5. Verification Workflows

- Validate typing with `pnpm -F <workspace> typecheck`
- Ensure tests verify channel message schemas where possible.

### Authoritative Design & Architecture Documents

- [docs/rosetta-stone.md](docs/rosetta-stone.md) — Canonical BroadcastChannel registry (§13).
