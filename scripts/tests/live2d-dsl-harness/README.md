# live2d-dsl-harness

Headless Phase 1 verification for the Live2D **DSL interpreter virtual machine** — driving
[`@proj-airi/live2d-runtime`](../../../packages/live2d-runtime/) (the canonical, render-agnostic
engine) directly against the extracted model fixtures under `apps/stage-edge/.models/`.

## What it asserts

- **Task 1 — VarFloats heap:** Type 1 guards (`equal`/`greater_equal`) + Type 2 mutators
  (`assign rand(min,max)`, `assign <int>`) mutate / gate as expected. Chat timer rolls, festival
  flags route, engine vars persist across dispatches.
- **Task 2 — Command sequencing:** `start_mtn` / `clear_exp` split into ordered instructions,
  and `change_cos` preserves the VarFloats heap.
- **Task 3 — Intimacy gates:** `Taphead`/`Tapbody` are dispatched headlessly; `Intimacy.Min`
  unlocks the gating ladder, `Intimacy.Bonus` writes back to the host intimacy store (NOT the
  VarFloats heap), and `Intimacy.Max` gates the low-intimacy fallback line.

## Model-under-test roles

- **`2262182171` (Flandre)** — intimacy-gating ladder (`Taphead`/`Tapbody`). Dispatched here.
- **`3626567931.zip` (Kasane)** — VarFloats heap + intimacy/Max/negative-Bonus gating on the
  `DREFTouchBox*` touch groups. Its authored *Choices / double-click* DSL (`Tap`/`DoubliClick`)
  was pruned during extraction (see `docs/research-live2d-special-sauce.md`), so the Choices /
  command-chain assertions run on those authored DSL groups instead.

## Run

```bash
pnpm test:dsl
```

(See the `test:dsl` script in the repo-root `package.json`.)

## Isolation

Intentionally not a pnpm workspace member (keeps the lockfile untouched), matching the
`scripts/tests/rwkv-harness` precedent. It imports the engine by **relative source path** (no
build step, no `dist` requirement).
