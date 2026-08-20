# P1 Upstream File Manifest (#1826, #1819, #1775)

Companion to [`project-selective-upstream-sync-shortlist.md`](./project-selective-upstream-sync-shortlist.md).

**Purpose:** Unique file list across the **P1 core-agent + chat sync** PRs so the next selective-sync pass can diff against **`moeru-ai/airi` `main`** directly—without re-reading PR threads.

**Generated:** 2026-05-27 (from GitHub PR file lists via `gh pr view`)

---

## Summary

| Metric | Count |
|--------|------:|
| PRs | 3 |
| Total file entries (with duplicates) | 73 |
| **Unique paths** | **66** |
| Excluding churn + i18n + `apps/server` | 51 |
| **Meaningful production paths** (also excl. `*.test.*` / `*.contract.*`) | **31** |

**Verdict:** Manageable in **one phased pass**, not 200–300 files. Suggested phases below.

### Other tiers (for scale only — not in this manifest)

| Tier | PRs | Unique files |
|------|-----|-------------:|
| P3 server optional | #1837, #1833 | 43 |
| P4 computer-use | #1647–#1649, #1734, #1805 | 86 |
| P5 Godot | #1697, #1724, #1830 | 138 |

---

## Noise to skip on fork (11 paths)

| Path | PR(s) | Skip reason |
|------|-------|-------------|
| `pnpm-lock.yaml` | all three | Lockfile churn |
| `.gitignore` | #1775 | Repo hygiene |
| `AGENTS.md` | #1775 | Agent docs |
| `packages/core-agent/package.json` | #1826 | Merge when porting package |
| `packages/stage-ui/package.json` | #1775 | Deps churn |
| `packages/electron-screen-capture/package.json` | #1826 | Unrelated dep bump |
| `packages/i18n/src/locales/en/stage.yaml` | #1775 | i18n |
| `packages/i18n/src/locales/es/server/auth.yaml` | #1826, #1775 | i18n |
| `packages/i18n/src/locales/ru/settings.yaml` | #1826, #1775 | i18n |
| `packages/i18n/src/locales/zh-Hans/settings.yaml` | #1826 | i18n |
| `packages/i18n/src/locales/zh-Hans/stage.yaml` | #1775 | i18n |

---

## Cloud / online paths — likely skip (11 paths)

Fork has **no online sign-in**; these exist for **hosted chat WebSocket + cloud session sync**.

| Path | PR | Notes |
|------|-----|--------|
| `apps/server/src/app.ts` | #1775 | Wire chat broadcast routes |
| `apps/server/src/routes/chat-ws/index.ts` | #1775 | Server WS chat |
| `apps/server/src/utils/chat-broadcast.ts` | #1775 | |
| `apps/server/src/utils/tests/chat-broadcast.test.ts` | #1775 | |
| `packages/server-runtime/src/index.ts` | #1775 | |
| `packages/server-runtime/src/index.test.ts` | #1775 | |
| `packages/server-runtime/src/server.test.ts` | #1775 | |
| `packages/server-runtime/src/server-ws/core/index.ts` | #1775 | |
| `packages/server-runtime/src/server-ws/core/index.test.ts` | #1775 | |
| `packages/server-runtime/src/server-ws/airi/index.ts` | #1775 | |
| `packages/server-runtime/src/server-ws/airi/index.test.ts` | #1775 | |
| `packages/stage-ui/src/libs/chat-sync/cloud-mapper.ts` | #1775 | Cloud ↔ local mapper |
| `packages/stage-ui/src/libs/chat-sync/cloud-mapper.test.ts` | #1775 | |

**Local-only fork:** Review whether `chat-sync/ws-client` and friends are still useful for **desktop-local** sync without `cloud-mapper` + server paths. If not, skip entire `libs/chat-sync/` except patterns you want for tamagotchi multi-window.

---

## Phase A — New `packages/core-agent` (port from `main`)

**PRs:** #1826 (primary), #1819 (registry)

Fork **does not have** `packages/core-agent` today; chat logic largely lives under `packages/stage-ui/src/stores/chat/`.

| Path | PR(s) |
|------|--------|
| `packages/core-agent/package.json` | #1826 |
| `packages/core-agent/src/index.ts` | #1826, #1819 |
| `packages/core-agent/src/messages/context-prompt.ts` | #1826 |
| `packages/core-agent/src/messages/context-prompt.test.ts` | #1826 |
| `packages/core-agent/src/messages/datetime-prefix.ts` | #1826 |
| `packages/core-agent/src/messages/datetime-prefix.test.ts` | #1826 |
| `packages/core-agent/src/runtime/chat-orchestrator-runtime.ts` | #1826 |
| `packages/core-agent/src/runtime/chat-orchestrator-runtime.test.ts` | #1826 |
| `packages/core-agent/src/runtime/context-registry.ts` | #1819 |
| `packages/core-agent/src/runtime/context-registry.test.ts` | #1819 |
| `packages/core-agent/src/runtime/llm-marker-parser.ts` | #1826 |
| `packages/core-agent/src/runtime/llm-marker-parser.test.ts` | #1826 |
| `packages/core-agent/src/runtime/response-categoriser.ts` | #1826 |
| `packages/core-agent/src/runtime/response-categoriser.test.ts` | #1826 |

**Also wire** workspace `package.json` / consumers (`stage-ui`, tamagotchi) when importing—those dep lines may live outside this PR file list.

**Deletes upstream moved out of stage-ui:**

| Path | PR |
|------|-----|
| `packages/stage-ui/src/composables/llm-marker-parser.ts` | #1826 |
| `packages/stage-ui/src/composables/response-categoriser.ts` | #1826 |

---

## Phase B — Chat store refactor (`hand-merge` vs fork `stores/chat/`)

Fork **already has** split chat stores (`context-store`, `data-store`, `session-store`, `stream-store`, etc.). Upstream’s layout differs—**do not blind copy**.

| Path | PR(s) | Fork note |
|------|--------|-----------|
| `packages/stage-ui/src/stores/chat.ts` | #1826, #1775 | Central facade; high conflict |
| `packages/stage-ui/src/stores/chat/context-prompt.ts` | #1826 | |
| `packages/stage-ui/src/stores/chat/datetime-prefix.ts` | #1826 | |
| `packages/stage-ui/src/stores/chat/context-store.ts` | #1819 | Fork has own `context-store.ts` |
| `packages/stage-ui/src/stores/chat/context-store.test.ts` | #1819 | |
| `packages/stage-ui/src/stores/chat/data-store.ts` | #1775 | Fork has `data-store.ts` |
| `packages/stage-ui/src/stores/chat/session-store.ts` | #1775 | Fork has `session-store.ts` |
| `packages/stage-ui/src/stores/chat/session-store.test.ts` | #1775 | |
| `packages/stage-ui/src/stores/chat.contract.test.ts` | #1826, #1775 | |
| `packages/stage-ui/src/stores/mods/api/context-bridge.ts` | #1819 | Ingest isolation |
| `packages/stage-ui/src/stores/mods/api/context-bridge.contract.browser.test.ts` | #1819 | |
| `packages/stage-ui/src/stores/devtools/context-observability.ts` | #1819 | |
| `packages/stage-ui/src/stores/exports.contract.test.ts` | #1775 | |

---

## Phase C — Chat sync lib + UI (#1775)

| Path | PR |
|------|-----|
| `packages/stage-ui/src/libs/chat-sync/index.ts` | #1775 |
| `packages/stage-ui/src/libs/chat-sync/pending-tracker.ts` | #1775 |
| `packages/stage-ui/src/libs/chat-sync/pending-tracker.test.ts` | #1775 |
| `packages/stage-ui/src/libs/chat-sync/wire-message.ts` | #1775 |
| `packages/stage-ui/src/libs/chat-sync/wire-message.test.ts` | #1775 |
| `packages/stage-ui/src/libs/chat-sync/ws-client.ts` | #1775 |
| `packages/stage-ui/src/libs/chat-sync/ws-client.test.ts` | #1775 |
| `packages/stage-ui/src/database/repos/chat-sessions.repo.ts` | #1775 |
| `packages/stage-ui/src/database/repos/chat-sessions.repo.test.ts` | #1775 |
| `packages/stage-ui/src/types/chat-session.ts` | #1775 |
| `packages/stage-ui/src/components/scenarios/chat/components/sessions-drawer.vue` | #1775 |
| `packages/stage-ui/src/components/scenarios/chat/index.ts` | #1775 |
| `packages/stage-layouts/src/components/Widgets/ChatArea.vue` | #1775 |
| `packages/stage-layouts/src/components/Layouts/MobileInteractiveArea.vue` | #1775 |

---

## Clean room workflow

| Repo | Branch | Rule |
|------|--------|------|
| `airi-rebase-scratch` | `main` only | Never port experiments here |
| `airi-clean-pr` | `selective-sync/core-agent-eval-2026-05` | All P1 ports and diffs |

See [`project-selective-upstream-sync-phase-a-buy-in.md`](./project-selective-upstream-sync-phase-a-buy-in.md) before copying `packages/core-agent`.

---

## Suggested workflow (your “look at main” pass)

1. Check out file paths from **Phase A** on `moeru-ai/airi` `main` (new package—mostly safe to `import`).
2. For **Phase B**, open fork + upstream side-by-side on `stores/chat*` and `context-bridge`; port **ideas** (orchestrator hook-up), not files wholesale.
3. For **Phase C**, decide if any chat-sync is needed without cloud; if yes, port `wire-message` / `pending-tracker` first, skip `cloud-mapper` + `apps/server` + `server-runtime`.
4. Run `pnpm -F @proj-airi/stage-ui typecheck` and tamagotchi smoke after each phase.

---

## Full unique list (66 paths, sorted)

```
.gitignore
AGENTS.md
apps/server/src/app.ts
apps/server/src/routes/chat-ws/index.ts
apps/server/src/utils/chat-broadcast.ts
apps/server/src/utils/tests/chat-broadcast.test.ts
packages/core-agent/package.json
packages/core-agent/src/index.ts
packages/core-agent/src/messages/context-prompt.test.ts
packages/core-agent/src/messages/context-prompt.ts
packages/core-agent/src/messages/datetime-prefix.test.ts
packages/core-agent/src/messages/datetime-prefix.ts
packages/core-agent/src/runtime/chat-orchestrator-runtime.test.ts
packages/core-agent/src/runtime/chat-orchestrator-runtime.ts
packages/core-agent/src/runtime/context-registry.test.ts
packages/core-agent/src/runtime/context-registry.ts
packages/core-agent/src/runtime/llm-marker-parser.test.ts
packages/core-agent/src/runtime/llm-marker-parser.ts
packages/core-agent/src/runtime/response-categoriser.test.ts
packages/core-agent/src/runtime/response-categoriser.ts
packages/electron-screen-capture/package.json
packages/i18n/src/locales/en/stage.yaml
packages/i18n/src/locales/es/server/auth.yaml
packages/i18n/src/locales/ru/settings.yaml
packages/i18n/src/locales/zh-Hans/settings.yaml
packages/i18n/src/locales/zh-Hans/stage.yaml
packages/server-runtime/src/index.test.ts
packages/server-runtime/src/index.ts
packages/server-runtime/src/server-ws/airi/index.test.ts
packages/server-runtime/src/server-ws/airi/index.ts
packages/server-runtime/src/server-ws/core/index.test.ts
packages/server-runtime/src/server-ws/core/index.ts
packages/server-runtime/src/server.test.ts
packages/stage-layouts/src/components/Layouts/MobileInteractiveArea.vue
packages/stage-layouts/src/components/Widgets/ChatArea.vue
packages/stage-ui/package.json
packages/stage-ui/src/components/scenarios/chat/components/sessions-drawer.vue
packages/stage-ui/src/components/scenarios/chat/index.ts
packages/stage-ui/src/composables/llm-marker-parser.ts
packages/stage-ui/src/composables/response-categoriser.ts
packages/stage-ui/src/database/repos/chat-sessions.repo.test.ts
packages/stage-ui/src/database/repos/chat-sessions.repo.ts
packages/stage-ui/src/libs/chat-sync/cloud-mapper.test.ts
packages/stage-ui/src/libs/chat-sync/cloud-mapper.ts
packages/stage-ui/src/libs/chat-sync/index.ts
packages/stage-ui/src/libs/chat-sync/pending-tracker.test.ts
packages/stage-ui/src/libs/chat-sync/pending-tracker.ts
packages/stage-ui/src/libs/chat-sync/wire-message.test.ts
packages/stage-ui/src/libs/chat-sync/wire-message.ts
packages/stage-ui/src/libs/chat-sync/ws-client.test.ts
packages/stage-ui/src/libs/chat-sync/ws-client.ts
packages/stage-ui/src/stores/chat.contract.test.ts
packages/stage-ui/src/stores/chat.ts
packages/stage-ui/src/stores/chat/context-prompt.ts
packages/stage-ui/src/stores/chat/context-store.test.ts
packages/stage-ui/src/stores/chat/context-store.ts
packages/stage-ui/src/stores/chat/data-store.ts
packages/stage-ui/src/stores/chat/datetime-prefix.ts
packages/stage-ui/src/stores/chat/session-store.test.ts
packages/stage-ui/src/stores/chat/session-store.ts
packages/stage-ui/src/stores/devtools/context-observability.ts
packages/stage-ui/src/stores/exports.contract.test.ts
packages/stage-ui/src/stores/mods/api/context-bridge.contract.browser.test.ts
packages/stage-ui/src/stores/mods/api/context-bridge.ts
packages/stage-ui/src/types/chat-session.ts
pnpm-lock.yaml
```

## Relevant Skills

- [[airi-roadmap-upstream-research]]
