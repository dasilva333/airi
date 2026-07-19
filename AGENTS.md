Read the relevant section of [`docs/rosetta-stone.md`](./docs/rosetta-stone.md) before broad architecture exploration or a cross-cutting change. It is the canonical concept-to-path index and records known failure modes. If it conflicts with current source, source wins; correct the Rosetta Stone when the change moves a canonical entry point or establishes a durable lesson.

## Pair programming

- Treat this as pair programming: stay in sync with the user's intent instead of racing to code.
- A request to explore, review, diagnose, research, design, plan, or "talk/hash it out" is not authorization to change application code. Root-cause the issue, state the concrete proposed solution and tradeoffs, then wait for approval to implement. If asked to write a design document, change the document only—not code—unless the user also asks for implementation.
- For a clearly requested, low-ambiguity code change, proceed within scope. For a material product, behavior, or architecture decision, first state the decision point and proposed approach; do not silently choose a direction that the user may reasonably want to review.

## Fork safety

- Never push to, rebase from, fetch, or otherwise inspect the `upstream` remote unless the user explicitly authorizes it. This fork is highly divergent, and upstream is reference-only.
- `crates/` is the legacy Tauri application. The current desktop application is Electron in `apps/stage-tamagotchi`.
- Do not run broad formatting, cleanup, or unrelated refactors as a completion ritual. Keep the diff scoped to the request.

## Commit and release safety

- This fork is developed directly on `main`, and community users may pull every published commit. Treat the remote as a release surface, never as agent-owned scratch space.
- Never proactively commit or push. The user decides when a tested checkpoint becomes a local commit and when a local commit is published.
- Never push untested changes. A requested push still requires appropriate successful validation for the complete commit being pushed; do not push around a failure or an unrun required check.
- If a meaningful `.ts`, `.tsx`, `.vue`, or build/automation `.js` change is part of a requested commit or push, run the affected workspace's typecheck or build as appropriate first. Successful verification is required before any push; a compile/typecheck failure is a hard stop for publishing. A local WIP snapshot after a failure requires the user's explicit instruction.
- Before a requested commit or push, inspect the full `git status` and review the complete intended diff. Pre-existing changes are not invisible: preserve them, report them separately, and do not include or discard them without authorization.
- If the user asks for a clean working tree, account for every pending path—not only files changed in the current task. Do not claim it is clean while unrelated changes remain.
- At handoff, mention an uncommitted tested checkpoint when one is ready, but leave the commit and push decision to the user.
- Never automatically create, pop, or drop a Git stash. Before `git checkout`, `git switch`, or another worktree-changing operation, inspect `git status`; if it is dirty, pause, review the pending changes, and ask whether the user wants to commit them, explicitly stash them, or choose another path. If the user authorizes a stash, report its identifier immediately, keep it prominent through handoff, and explicitly resolve restoration with the user before the task is complete.
- Never run `git reset --hard`, `git checkout -- <path>`, `git restore`, `git clean`, or another command that can discard work without explicit, current user permission for the exact operation. User frustration, criticism, or a request to fix a mistake is never permission to erase work.
- Do not use a second worktree, temporary branch, index manipulation, or implicit autostash to evade the dirty-worktree decision. Use such a workflow only with explicit approval when it materially changes repository state.

## Local implementation choices

- Follow the nearest existing pattern before introducing a new abstraction. For service composition and typed IPC/RPC, use the established `injeca` and `@moeru/eventa` patterns described in the Rosetta Stone.
- Prefer `@proj-airi/ui` primitives and Iconify icons over raw controls or bespoke SVGs. Prefer UnoCSS to Tailwind.
- For substantial UnoCSS class lists, use readable Vue class arrays, for example `:class="['px-2 py-1', 'flex items-center']"`. Do not use UnoCSS attribute-mode syntax. Reuse existing animations before adding a new one.
- Do not add backward-compatibility guards or shims unless the task explicitly requires extended support. Make the intended current shape clear instead.
- Put translations in `packages/i18n`. Before locating or editing a YAML key, read [`docs/settings-yaml.md`](./docs/settings-yaml.md) and use `scripts/yaml-manager.js` as it directs. Do not brute-force-search locale YAML or read the manager source unless the documented interface cannot answer the task.
- Add comments for non-obvious decisions, workarounds, platform behavior, or algorithms—not narration. Use `// NOTICE:` for a workaround and include its cause and relevant reference when useful.

## Validation

Choose the smallest validation that gives useful confidence; validation is not a ritual.

- A text, label, or comment-only edit normally needs no script.
- For CSS or layout work, inspect the affected surface. Run a script only when the change can affect compilation or behavior.
- For TypeScript, Vue logic, interfaces, or imports, run the affected workspace's typecheck: `pnpm -F <workspace> typecheck`.
- For build configuration, entry points, packaging, or Electron integration, run the affected workspace build. `stage-tamagotchi`'s build includes typechecking; `stage-web`'s does not.
- Treat `pnpm lint:fix` as a broad mutating cleanup tool, not validation. Use it only deliberately and review its whole diff.
- State which validation you ran and why broader validation was unnecessary.
