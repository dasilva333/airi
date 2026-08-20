# AIRI Fork Ecosystem Catalog

A living document tracking active forks of [moeru-ai/airi](https://github.com/moeru-ai/airi), sorted by technical interest. Updated periodically by trawling the [forks page](https://github.com/moeru-ai/airi/forks?include=active&page=1&period=2y&sort_by=last_updated).

**Purpose:** Cherry-pick compelling work, spot convergent ideas, and avoid reinventing things that other forks have already solved.

Last surveyed: **June 8, 2026**

---

## 🌟 High Interest — Watch Closely

### [NashChennc/airi](https://github.com/NashChennc/airi)
**Also known as:** NaN in the AIRI Discord

**Background:** M.S. student at LDS@USTC (Laboratory for Data Science, University of Science and Technology of China) researching LLM interpretability and alignment. Author of [NExTGuard](https://arxiv.org/), a training-free framework for streaming LLM safety using Sparse Autoencoders (SAEs). Brings genuine academic AI expertise.

**What they're building:**
- **Alaya Memory Layer** — likely the originator or primary architect of this concept. Designed a planner-centric semantic/episodic memory system with:
  - Neuroscience-inspired time-decay mechanisms
  - Hierarchical consciousness-level memory streams
  - Dispatcher/event-trigger architecture for memory reinforcement and reconsolidation
- **Core Agent extraction** — pulling runtime logic into a `core-agent` module; connected Minecraft and Telegram integrations; working on dispatcher-centric action registries
- **Live2D bug reports** — filed the ZIP archive loading bug (#1933) that was independently fixed in dasilva333/airi ~4-5 weeks prior

**PRs to main:** Yes — multiple, including core agent architecture and Alaya memory design

**Why this matters for dasilva333/airi:**
The Alaya memory architecture is directly adjacent to the work in `proposal-dynamic-memory-rag-injection.md`. His academic background in LLM interpretability and SAE-based safety may inform a more principled approach to memory recall and context injection than the purely engineering-driven design in this fork. Worth engaging with directly — there may be complementary ideas or at minimum a shared vocabulary.

**core-agent scoping verdict (assessed June 8, 2026):**
Nash's `core-agent` work is **3 commits, 46 files**, all in a new `packages/core-agent/` package. The restructuring extracts logic that already exists in `packages/stage-ui/src/stores/chat.ts` (~1,320 lines) into a framework-agnostic package with typed ports (`AgentContextPort`, `AgentLLMPort`, `AgentSessionPort`). The benefit is a cleaner package boundary, unit-testability without Pinia, and shareability across runtimes (Discord, Telegram, desktop).

**For this fork specifically — skip the restructuring, cherry-pick one file:**
- The dasilva333 `chat.ts` `performSend` is a **strict superset** of Nash's runtime: it adds vision/VLM handover, grounding injection, autonomous artistry hooks, bridged marker tool loop (`tryBridgeMarker`, up to 5 steps), multi-window `BroadcastChannel` ingest, and `skipAssistant`/`triggerOnly` — none of which exist in his runtime.
- Adopting his package boundary would require re-expressing all of those behaviors as DI ports into a thin facade — a large one-time rewrite with no new capabilities gained.
- The context registry (#1819) is already implemented in this fork as `context-store.ts` with the same `ReplaceSelf`/`AppendSelf` semantics. His version adds `Map` over `Record` (prototype-pollution hardening) and bounded history (400 entries) — marginal improvements.
- **One file is worth a direct copy:** `packages/core-agent/src/messages/context-prompt.ts` (~30 lines). The `formatContextPromptText()` function produces the `[Context]\n- sourceKey: text` bullet format that is exactly the injection block shape designed in `proposal-dynamic-memory-rag-injection.md`. Take this function, not the package.

Full assessment documented in [`project-selective-upstream-sync-phase-a-buy-in.md`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/docs/project-selective-upstream-sync-phase-a-buy-in.md).

---

### [YoukiAkito/airi](https://github.com/YoukiAkito/airi)
**Also known as:** LiMomo

**What they're building:**
- **Alaya memory layer review and optimization** — active PR work on the memory subsystem, likely in collaboration with or building on NashChennc's foundational work
- CI/CD workflow improvements

**PRs to main:** Yes — memory optimization work actively in progress

**Why this matters:**
Two people working on Alaya independently is a signal the architecture has real momentum upstream. Their optimization work may be directly importable once Alaya stabilizes enough to evaluate.

---

### [lulu0119/airi](https://github.com/lulu0119/airi)

**What they're building:**
- **Scale settings UI** — added character view scale controls (PR #1554 and related)
- **AIRI Whiteboard** — proposed and potentially prototyped a whiteboard feature inside AIRI
- **svg-whiteboard-mcp** — standalone MCP server that renders SVG-based whiteboards, usable as an agent tool
- **Shion Eria (詩音エリア)** — a parallel personal project: a custom digital companion built on the [OpenClaw](https://github.com/) framework, a separate runtime for "continuously existing AI assistants"

**PRs to main:** Yes — scale settings, whiteboard concept

**Why this matters:**
The OpenClaw + Shion Eria side project is the interesting thread. They appear to be building a parallel "character workspace persistence" system with different goals than AIRI's browser-first approach. OpenClaw is also the framework where the `NO_REPLY` / `HEARTBEAT_OK` directive convention originates. Worth watching their character architecture decisions as a design reference.

**Cherry-pick candidate:** `svg-whiteboard-mcp` — if AIRI ever wants an agent-driven whiteboard/canvas tool, this is already built.

---

## 🟡 Medium Interest — Check Periodically

### [Perilavumme/airi](https://github.com/Perilavumme/airi)

**What they're building:**
- **DeepSeek latency optimization** — added toggles to default DeepSeek thinking mode off to optimize MVP response times.
- **Steam builds customization** — introduced options to hide BYOK (Bring Your Own Key) providers for custom Steam distribution builds via environment variables.

**PRs to main:** No evidence yet

**Why this matters:**
This user is optimizing model latency and tailoring the UI specifically for platform distribution (Steam). Their work on bypassing BYOK features is highly relevant if this fork targets standalone game-like packaging.

---

### [hydraerozine/airi](https://github.com/hydraerozine/airi)

**What they're building:**
- **Polytrade Presenter** — custom integration for spoken names of HIP-3 equity assets.

**PRs to main:** No evidence yet

**Why this matters:**
A highly customized, domain-specific companion extension. Shows how others are extending the TTS/voice output layer to read financial or custom market data.

---

### [felixtremblay/airi](https://github.com/felixtremblay/airi)

**What they're building:**
- **Screenshot tool** — built a modular `airi-screenshot` functionality for the agent's workspace.

**PRs to main:** No evidence yet

**Why this matters:**
A very practical utility for agents that need to observe and record visual workspace states. Highly reusable candidate.

---

### [btechioi/NOVA](https://github.com/btechioi/NOVA)

**What they're building:** Unknown — this fork was renamed from "airi" to **NOVA**, which is the strongest signal of intent to build a distinctly branded independent project rather than a staging branch for upstream PRs.

**PRs to main:** No evidence

**Why this matters:**
The rename is meaningful. Most forks that stay close to upstream don't rename. NOVA suggests a custom character or product vision. The repo has almost no indexed content (very new or intentionally minimal public presence), so confidence is low. Check back in a few weeks.

**Open question:** Is this someone building their own VTuber/companion character on the AIRI stack, or just a personal branding exercise?

---

### [BeanDz/airi](https://github.com/BeanDz/airi)

**What they're building:**
- Stage rendering architecture cleanup — replaced warpdrive plugin with unplug in stage-web/stage-ui
- Electron/Tamagotchi desktop mouse coordinate fixes

**PRs to main:** Yes — merged in v0.10.2

**Why this matters:**
Clean infrastructure contributor focused on the desktop rendering path. Their Electron coordinate work overlaps with areas dasilva333/airi has also touched. Low divergence, high upstream value. Not a cherry-pick target — their work flows back to main.

---

## 📌 Low Interest — Passive Forks

### [CaoMeiYouRen/airi](https://github.com/CaoMeiYouRen/airi)
**Background:** 草梅友仁 — prominent Chinese TypeScript developer and tech blogger known for RSS automation tools (`rss-impact-server`, `push-all-in-one`). Covers AIRI in Chinese developer newsletters on Juejin.

**Assessment:** Reference/observer fork. No code contributions detected. If they ever build something, it would likely be RSS/notification integration tooling — a natural fit given their background. On the radar as a future contributor, not an active one.

---

### [TheTechOddBug/airi](https://github.com/TheTechOddBug/airi)
**Background:** José María Gutiérrez — Spanish developer whose known activity is issue reports to VS Code, Yarn, and related tooling.

**Assessment:** Personal reference fork. No AIRI-specific contributions found. Safe to deprioritize.

---

## Summary Table

| Fork | Person | Type | Divergence | PRs to Main | Focus |
|---|---|---|---|---|---|
| [dasilva333/airi](https://github.com/dasilva333/airi) | Richard | **Independent** | **High** | 3 merged historically, currently blocked on coordination | Full platform fork — this one |
| [NashChennc/airi](https://github.com/NashChennc/airi) | NaN (LDS@USTC) | Active contributor | Low (staging) | ✅ Yes | Core agent, Alaya memory, LLM alignment research |
| [YoukiAkito/airi](https://github.com/YoukiAkito/airi) | LiMomo | Active contributor | Low (staging) | ✅ Yes | Alaya memory optimization |
| [lulu0119/airi](https://github.com/lulu0119/airi) | lulu0119 | Active contributor | Low (staging) | ✅ Yes | Scale UI, Whiteboard MCP, OpenClaw Shion Eria |
| [Perilavumme/airi](https://github.com/Perilavumme/airi) | Perilavumme | Contributor | Low | ❌ None | DeepSeek latency optimization, Steam BYOK disable |
| [hydraerozine/airi](https://github.com/hydraerozine/airi) | hydraerozine | Contributor | Low | ❌ None | Polytrade Presenter, HIP-3 equities |
| [felixtremblay/airi](https://github.com/felixtremblay/airi) | felixtremblay | Contributor | Low | ❌ None | Screenshot tool (`airi-screenshot`) |
| [btechioi/NOVA](https://github.com/btechioi/NOVA) | Unknown | **Independent?** | Unknown | ❌ None | Renamed fork — NOVA character? |
| [BeanDz/airi](https://github.com/BeanDz/airi) | BeanDz | Active contributor | Low (staging) | ✅ Yes | Stage rendering, Electron desktop |
| [CaoMeiYouRen/airi](https://github.com/CaoMeiYouRen/airi) | 草梅友仁 | Passive | None | ❌ None | Chinese dev blogger, observer |
| [TheTechOddBug/airi](https://github.com/TheTechOddBug/airi) | José María | Passive | None | ❌ None | Spanish developer, observer |

---

## Key Observations

**The Alaya convergence is notable.** Two separate contributors (NashChennc and YoukiAkito) are actively working on the Alaya memory architecture upstream. This is the same problem space addressed in `proposal-dynamic-memory-rag-injection.md`. Their work may be worth evaluating once Alaya stabilizes — either as a foundation to build the RAG injection proposal on top of, or as a design reference to learn from and differentiate against.

**Most "forks" are just PR staging branches.** The real activity to track is not the fork repos themselves but the PRs and issues those contributors open on upstream moeru-ai/airi. The fork list is a contributor map, not a divergent-projects map.

**The dasilva333 ↔ upstream relationship requires pre-coordination for further contributions.** Three PRs were merged historically (smaller fixes). The Live2D engine in this fork is now so substantially ahead of main — and so deeply interconnected — that contributing it upstream isn't a simple PR. It would require: upstream maintainer agreement on scope and approach upfront, a dedicated feature branch from upstream main, and a lengthy review process with no guarantee of acceptance. The model is: upstream maintainers describe what they want and don't want, dasilva333 agrees on scope, then a PR gets submitted. Without that handshake, submitting a large-scope PR cold is a donation of engineering time with no guaranteed return. Upstream has been unresponsive on Discord to coordination attempts; this is the current blocker.

**Two genuinely independent forks:** dasilva333/airi (this one) and btechioi/NOVA (unconfirmed). The rest are upstream contributors using the standard fork-PR workflow.

**The competitive/inspiration dynamic mirrors the Shinobu situation.** NashChennc is building memory architecture from an LLM interpretability research angle; dasilva333 is building it from a product engineering angle. Neither is ahead on everything. The approaches are probably more complementary than competing.

---

## How to Update This Document

To survey active forks on a regular basis:

1. Run the update script:
   ```bash
   node scripts/github/update-forks-catalog.mjs
   ```
2. The script uses the GitHub API to fetch the 50 newest created forks, sorts them in-memory by their recent `pushed_at` timestamp, compares their commits against upstream `moeru-ai/airi` to filter out passive synced forks, and outputs a list of active forks showing their custom commits.
3. Review any forks with significant custom commits not already cataloged in this document, and add them under the appropriate category.
4. Update the "Last surveyed" date at the top.

## Relevant Skills

- [[airi-roadmap-upstream-research]]
