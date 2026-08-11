---
name: airi-roadmap-upstream-research
description: >-
  Use when working with the AIRI project roadmap, proposal RFC analysis, fork research, or upstream sync planning. Trigger on triaging unbuilt roadmap features, reading architectural proposal docs, inspecting upstream repo changes or PRs, comparing divergent fork paths, or planning ports safely without scope creep. Never push/rebase/fetch the upstream remote unless the user explicitly authorizes it.
---

Research first, port deliberately. This fork is highly divergent; the `upstream` remote is reference-only. Never push, rebase from, fetch, or otherwise inspect `upstream` unless the user explicitly authorizes it. Never cite `crates/` (legacy Tauri; current desktop is Electron `apps/stage-tamagotchi/`).

## Key Files/Locations

- `docs/content/en/docs/chronicles/roadmap.md` — the "AIRI Pending Items Catalog": the source of truth for triaging unbuilt features (core infra, local runtimes, consciousness/cognitive pipeline, memory & RAG, speech/audio, visual manifestation, integration architecture). Note some entries are already `[COMPLETED]` — read carefully before treating a feature as unbuilt.
- `docs/memory_lab/` — a folder of memory-system design specs, plans, and analysis docs (retrieval/ranking, schema/lifecycle, replay/eval plans, benchmark history).
- `docs/proposal-*.md` (and `docs/design-*.md`) — the architectural proposal RFCs and design docs under `docs/`.
- Git remotes — run `git remote -v` to enumerate the fork's named remotes (e.g. `origin` = `dasilva333/airi`, `upstream` = `moeru-ai/airi`, plus several fork remotes). Upstream diff comes from these remotes, not from invented paths.

## When to Use

- Triage an unbuilt roadmap feature to decide whether/how to build it.
- Read or evaluate an architectural proposal RFC before implementing.
- Inspect upstream repo changes / PRs to understand what upstream did.
- Compare divergent fork paths across the named remotes.
- Plan a port of upstream/fork work into this divergent fork.

## Common Pitfalls

- **Touching `upstream` without authorization.** Upstream is reference-only. No `push`/`rebase`/`fetch`/`inspect` of `upstream` (or any remote mutation) unless the user explicitly authorizes it — and a greenlight is one-time, for that checkpoint only.
- **Treating the roadmap as all-unbuilt.** Read each roadmap entry; several are already marked `[COMPLETED]` or carry priority tags. Verify current source before assuming a feature is missing.
- **Assuming a proposal doc reflects shipped code.** Proposal documents are design intent. If a proposal conflicts with current source, source wins — verify against the actual files before planning.
- **Scope creep on a port.** Port narrowly and deliberately; do not bundle a broad refactor into a research/port task. Root-cause and state the proposed approach and tradeoffs, and wait for approval before changing application code (pair-programming rule).
- **Momentum toward commit/push.** Never proactively commit or push. The user decides when a tested checkpoint becomes a commit and when it is published; validate before any push.

## Verification

- Read the specific roadmap entry and locate (or confirm the absence of) the corresponding current source before concluding a feature is unbuilt.
- Confirm remote names with `git remote -v`; cite upstream/fork diffs from real remotes, not invented paths.
- For any research that leads to a code change proposal, state the decision point and tradeoffs and get approval before implementing.
- After any modification made during the task, run `git status` and report open/unstaged files.
