---
name: airi-codebase-verification
description: >-
  Use when working with AIRI validation commands, verification workflows, typecheck/build selection, lint:fix discipline, or git status reporting. Trigger on choosing minimal verification for a change, running pnpm -F typecheck or a workspace build, deciding whether lint:fix is appropriate, or satisfying the git status / fork release-safety rules in AGENTS.md.
---

Choose the smallest validation that gives useful confidence; validation is not a ritual. Never cite `crates/` (legacy Tauri; current desktop is Electron `apps/stage-tamagotchi/`). This fork is developed directly on `main` and the remote is a release surface — never push untested changes.

## Key Files/Locations

- `AGENTS.md` — the canonical Validation and Commit/Release-safety rules.
- Per-workspace `package.json` scripts — discover the exact `typecheck`/`build` script names for the workspace you touched before running them.

## When to Use

- Deciding what (if anything) to run after a change.
- Running `pnpm -F <workspace> typecheck` or an affected-workspace build.
- Weighing whether `pnpm lint:fix` is appropriate.
- Reporting working-tree state after a modification, commit, or handoff.

## Common Pitfalls

- **Over-validating trivial edits.** A text, label, or comment-only edit normally needs no script. CSS/layout work: inspect the affected surface; run a script only when the change can affect compilation or behavior.
- **Under-validating logic changes.** For TypeScript, Vue logic, interfaces, or imports, run `pnpm -F <workspace> typecheck`. For build configuration, entry points, packaging, or Electron integration, run the affected workspace build.
- **Assuming build always implies typecheck.** `stage-tamagotchi` (Electron) build includes typechecking; `stage-web` build does NOT — run typecheck separately for `stage-web`.
- **Treating `pnpm lint:fix` as validation.** It is a broad mutating cleanup tool, not validation. Use it only deliberately and review its whole diff.
- **Skipping `git status`.** Always run `git status` after every commit or file modification and report exactly what remains open/unstaged/pending. Do not claim the tree is clean while unrelated changes remain.
- **Push/commit without a green run.** Never push untested changes; a requested push still requires successful validation of the full commit. Pre-existing changes in the tree are not invisible — preserve and report them separately; do not silently include or discard them.


### Authoritative Design & Architecture Documents

- [docs/rosetta-stone.md](docs/rosetta-stone.md) — Known-failure-mode index.
- [docs/project-specialized-skills.md](docs/project-specialized-skills.md) — Specialized skills project plan.
- [docs/project-how-to-maintain-manual.md](docs/project-how-to-maintain-manual.md) — How-to-maintain manual.

## Verification

- Match the check to the change surface (none / inspect / `pnpm -F <workspace> typecheck` / affected-workspace build).
- Discover script names from the target workspace's `package.json`; never guess.
- After any modification, run `git status` and report open/unstaged files verbatim.
- Before any user-requested commit/push, inspect full `git status` and the complete intended diff, and confirm the required typecheck/build passed.
- State which validation you ran and why broader validation was unnecessary.
