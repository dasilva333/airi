# Selective Upstream Sync — Integration Shortlist

**Saved artifact:** `docs/project-selective-upstream-sync-shortlist.md` (in the repo, not a local scratch file).

Companion to [`project-selective-upstream-sync-protocol.md`](./project-selective-upstream-sync-protocol.md).

**Source repo:** `moeru-ai/airi`
**Review window:** ~2026-04-20 → 2026-05-27
**Fork constraints:** local-first desktop; no online sign-in; no upstream memory work; MCP stack kept local.

---

## Priority overview

| Tier | Focus | PRs |
|------|--------|-----|
| **P1** | Core agent & chat | #1826, #1819, #1775 |
| **P3** | Server / gateway (optional) | #1837, #1833 |
| **P4** | Computer-use / desktop agent | #1647, #1648, #1649, #1734, #1805 |
| **P5** | Godot stage — **paused** (spike upstream `main` first) | #1697, #1724, #1830 |

**Dropped from shortlist:** #1818 (warpdrive → basemove) — web/S3 remote hosting only; not relevant to this fork.

**File manifest for next pass:** [`project-selective-upstream-sync-p1-file-manifest.md`](./project-selective-upstream-sync-p1-file-manifest.md)

**Phase A buy-in (read before any port):** [`project-selective-upstream-sync-phase-a-buy-in.md`](./project-selective-upstream-sync-phase-a-buy-in.md)

**Clean room branch (`airi-clean-pr`):** `selective-sync/core-agent-eval-2026-05` off `fork/main` — prep only, no upstream merges yet.

**Suggested pass order:**
`#1826 → #1819 → #1775` → skip P3 unless running cloud server → skip P4 unless using computer-use → skip P5 (try upstream Godot on `main` before any port)

---

## Concept explainers

### What is core-agent? (P1 cluster)

**`core-agent`** is upstream’s package for **chat orchestration** — turning scattered stage-ui store logic into a runtime with:

- A **chat orchestrator** (#1826) for turns, streaming, tools
- **Registry buckets** + **ingest isolation** (#1819) so Discord/Telegram/desktop feeds don’t stomp each other
- **Chat sync** (#1775) in stage-ui so routes/windows see the same conversation state

**Relevance:** This is the highest-value architectural drift for your fork’s “brain,” but also the highest **hand-merge** risk vs your stabilized chat/LLM stores.

---

### What is the server optional tier? (P3)

**`apps/server`** on moeru’s main is their **hosted product backend**: auth, billing, Flux currency, LLM/TTS **gateway**, admin APIs.

Your fork’s server is **slim** (auth, characters, chats, providers) and you **don’t ship online sign-in** on desktop. #1837 / #1833 matter only if you intentionally maintain cloud parity—not for tamagotchi-only selective sync.

---

### Godot stage — paused (P5, lowest)

**Not a model format** — an alternate **Godot 4 sidecar window** (Electron host + local WebSocket). Upstream merged it to `main` while still **experimental**:

| Stage | PR | Integration level (upstream) |
|-------|-----|------------------------------|
| Bootstrap | #1697 | Godot project + empty scene (box + camera). **No avatars.** |
| Glue | #1724 | Settings toggle; launch/stop sidecar; packaging/CI for Godot binary. **Skeleton only.** |
| VRM path | #1830 | **VRM-only** — bytes written to disk, imported in Godot via vendored VRM addon. **Not** Live2D / Spine / MMD. VRM 1.0 runtime incomplete. |

**No parity** with the main Three.js stage (ACT expressions, full settings, etc.) is claimed in PR text — it’s a **G1 experiment**, large vendored trees, unclear end-user value until you try it.

**Fork stance (2026-05):** **Pause porting.** Optionally install/checkout **upstream `main`** locally later, enable Godot sidecar in settings, and decide if “juice worth squeeze” before any selective sync of #1697–#1830. Tier is **below computer-use** (~138 unique files across those PRs).

---

## Integration shortlist (detail)

Higher tier = integrate sooner. All **merged** upstream unless noted.

---

### P1 — Core agent & chat (highest)

#### [#1826](https://github.com/moeru-ai/airi/pull/1826) — `feat(core-agent): add chat orchestrator runtime`

**What it actually is**
Introduces a **chat orchestrator runtime** in `core-agent` — central coordination for chat turns, tool flow, and streaming instead of ad-hoc wiring in stage-ui stores.

**Relevance to your fork**
Directly affects the “brain” path on desktop. High conflict risk with fork chat/LLM stores; **`hand-merge`**, preserve fork behavior first.

**Sync class:** `hand-merge`

---

#### [#1819](https://github.com/moeru-ai/airi/pull/1819) — `feat(core-agent): harden registry buckets and bridge ingest isolation`

**What it actually is**
Hardens **registry buckets** and **ingest isolation** in core-agent — structural boundaries for modules/tools/channels feeding the orchestrator.

**Relevance to your fork**
Pairs with #1826; same subsystem. Assimilate only if you are taking the orchestrator model.

**Sync class:** `hand-merge`

---

#### [#1775](https://github.com/moeru-ai/airi/pull/1775) — `feat(stage-ui): chat sync`

**What it actually is**
**Chat sync** across routes/surfaces — keeps conversation state consistent when navigating (e.g. stage vs settings), not a cosmetic chat UI tweak.

**Relevance to your fork**
Useful for tamagotchi multi-window / multi-route UX. Touch `packages/stage-ui` chat stores and related composables.

**Sync class:** `hand-merge`

---

### P3 — Server / gateway (optional — cloud product)

Only if you intentionally maintain parity with moeru’s hosted `apps/server` product. Default: **`ignore`**.

#### [#1837](https://github.com/moeru-ai/airi/pull/1837) — `feat: llm & tts gateway`

**What it actually is**
**LLM & TTS gateway** on the server — proxy/billing/routing for cloud API access, not desktop provider settings.

**Relevance to your fork**
Low for local-first desktop. Skip unless you run their gateway service.

**Sync class:** `ignore` (default)

---

#### [#1833](https://github.com/moeru-ai/airi/pull/1833) — `ref(server-*): refactor and cleanup server stuffs`

**What it actually is**
Broad **`server-*` package refactor** — structure/cleanup across server runtime packages.

**Relevance to your fork**
Your `apps/server` is slim (auth, characters, chats, providers). Most churn likely irrelevant.

**Sync class:** `ignore` or cherry-pick docs only

---

### P4 — Computer-use / desktop agent

Integrate only if you actively use `computer-use-mcp`. Otherwise **`ignore`**. (~86 unique files across tier.)

#### [#1647](https://github.com/moeru-ai/airi/pull/1647) — `[1/3] feat(desktop): add desktop observation and overlay baseline`

**What it actually is**
**Part 1/3** of desktop grounding: observation + overlay baseline (macOS Chrome-first trajectory).

**Relevance to your fork**
New automation subsystem; unrelated to character stage.

**Sync class:** `ignore` (deprioritized)

---

#### [#1648](https://github.com/moeru-ai/airi/pull/1648) — `feat(stage-tamagotchi,computer-use-mcp): implement browser-native DOM action routing`

**What it actually is**
**Browser-native DOM action routing** between tamagotchi and `computer-use-mcp`.

**Relevance to your fork**
Only if you ship computer-use.

**Sync class:** `ignore` (deprioritized)

---

#### [#1649](https://github.com/moeru-ai/airi/pull/1649) — `[3/3] feat(desktop): intro agent-owned session and ghost pointer phases`

**What it actually is**
**Part 3/3:** agent-owned session + ghost pointer UX for desktop control.

**Relevance to your fork**
Automation architecture only.

**Sync class:** `ignore` (deprioritized)

---

#### [#1734](https://github.com/moeru-ai/airi/pull/1734) — `feat(computer-use-mcp): add transcript truth source and safe projection`

**What it actually is**
**Transcript truth source** and safe projection for computer-use agents.

**Relevance to your fork**
computer-use-mcp only.

**Sync class:** `ignore` (deprioritized)

---

#### [#1805](https://github.com/moeru-ai/airi/pull/1805) — `feat(computer-use-mcp): add background desktop scheduler`

**What it actually is**
**Background desktop scheduler** for observe/click tasks.

**Relevance to your fork**
Automation infra only.

**Sync class:** `ignore` (deprioritized)

---

### P5 — Godot stage sidecar (paused — spike upstream first)

Do **not** port until you’ve tried upstream `main` and judged value. **VRM-only** on Godot path; does not extend Live2D / Spine / MMD.

#### [#1697](https://github.com/moeru-ai/airi/pull/1697) — `feat(stage-tamagotchi-godot): initiation of Godot stage`

**What it actually is**
**G0 bootstrap:** Godot 4 + C# project, minimal scene. **No avatar loading.**

**Relevance to your fork**
Foundation only for later PRs. Large new tree for an unproven experiment.

**Sync class:** `ignore` until spike says yes → then `import`

---

#### [#1724](https://github.com/moeru-ai/airi/pull/1724) — `feat(stage-tamagotchi-godot): add Godot stage G0 sidecar preview`

**What it actually is**
Electron ↔ Godot lifecycle, settings entry, WebSocket handshake, export/packaging contract. **Preview / skeleton.**

**Relevance to your fork**
Requires Godot 4 dev toolchain + packaging work. Only after #1697 and after manual upstream trial.

**Sync class:** `ignore` (paused)

---

#### [#1830](https://github.com/moeru-ai/airi/pull/1830) — `feat(stage-tamagotchi): add experimental Godot stage sidecar`

**What it actually is**
**VRM-only** sidecar display path + massive vendored VRM/MToon addons.

**Relevance to your fork**
Duplicates VRM capability you already have in Three.js unless Godot buys something specific (performance, shaders, platform). High cost, low proven benefit.

**Sync class:** `ignore` (paused)

---

## Filtered out (not on shortlist)

| PR | Title | Reason |
|----|--------|--------|
| #1870, #1589, #1707, #1748 | Memory / EDA / STM | No upstream memory work |
| #1892 | plugin-sdk extension kit | Open |
| #1622, #1599 | WebGPU inference unify | In progress on fork / duplicate |
| #1702 | pipelines-audio UST | Fork origin; deprecated there |
| #1810 | Spine runtime | Already done on fork |
| #1722 | MCP settings rewrite | Fork MCP richer; do not merge |
| #1818 | warpdrive → unplugin-basemove | Web/S3 remote asset hosting; not relevant |
| #1792 | drop redis stream + worker | Cloud billing only |
| #1873 | better-auth admin plugin | Cloud admin |
| #1788 | admin api | Flux grant batches |
| #1592 | config syncing for providers | Online sign-in provider sync |
| #1753, #1674 | OIDC / email auth flows | Official-server auth |
| (misc) | Provider adds, i18n, fixes, docs | Out of scope |

---

## Tracking

When a PR lands on fork `main`, record upstream merge SHA + fork commit here or in [`project-critical-upstream-sync-hashes.md`](./project-critical-upstream-sync-hashes.md).

| PR | Upstream merged | Fork landing commit | Notes |
|----|-----------------|---------------------|-------|
| | | | |

## Relevant Skills

- [[airi-roadmap-upstream-research]]
