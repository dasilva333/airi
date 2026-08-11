---
name: airi-i18n-localization
description: >-
  Use when working with AIRI monorepo i18n localization, translations, or locale YAML in packages/i18n. Trigger on adding translation keys, checking render/key completeness, per-locale updates, or any task touching settings.yaml, stage.yaml, or base.yaml. Always run scripts/yaml-manager.js per docs/settings-yaml.md instead of brute-force-searching locale files.
---

LOCALE YAML IS MANAGED, NOT GREPPED. Before locating or editing any translation key, read `docs/settings-yaml.md` and drive the task through `scripts/yaml-manager.js`. Never brute-force search the locale tree or read the manager source, and never cite `crates/` (legacy Tauri; current desktop is Electron `apps/stage-tamagotchi/`).

## Key Files/Locations

- `packages/i18n/` — the i18n package root.
- `packages/i18n/src/locales/<locale>/` — per-locale translation files live here; inspect this directory to learn which locales actually exist before deciding cross-locale targets (do not assume a fixed locale list).
- `scripts/yaml-manager.js` — the only sanctioned interface for locating, validating, and mutating locale YAML.
- `docs/settings-yaml.md` — the canonical key→file map and command interface guide. Read it first.

Key→file map (from `docs/settings-yaml.md`):
- `settings.*` → `settings.yaml` (strip the leading `settings.` prefix)
- `stage.*` → `stage.yaml` (strip the leading `stage.` prefix)
- any other prefix → `base.yaml` (use the key as-is)

## When to Use

- Adding a new translation key or updating an existing one.
- Checking render completeness / finding which keys a target locale is missing.
- Doing a per-locale update or propagating a new source-language key across locales.
- Any edit that touches `settings.yaml`, `stage.yaml`, or `base.yaml`.

## Common Pitfalls

- **Brute-force search instead of the manager.** Discover hierarchy with `analyze`, locate exact segments with `find-key`, and only use `search` when you know the display text but not the key. Do not `grep`/`rg` through raw locale YAML; the docs say to use the manager unless the guide and `--help` cannot answer the task.
- **Wrong file or wrong prefix.** Confirm the key→file map first. Example: `settings.pages.providers.provider.blip-local.title` belongs at `pages.providers.provider.blip-local.title` inside `settings.yaml`.
- **Skipping `audit` after a structural edit.** YAML parsers silently overwrite duplicate keys; run `audit` after any structural change.
- **Assuming a fixed locale list for cross-locale work.** After adding a source key, run `sync` against each locale actually in scope for the task — inspect `packages/i18n/src/locales/`, don't guess.
- **Reaching for recovery-only commands during normal work.** `clean`, `fix-syntax`, `truncate`, `truncate-at-line`, `replace-line`, and `insert-line` rewrite or discard raw YAML. Use them only when the task is explicitly repairing corrupted YAML, then review the complete diff immediately afterward.

## Verification

- After a structural edit, run `audit` on the edited file.
- For cross-locale completeness, run `sync <source> <destination>` to list source keys missing from the target locale.
- Review the YAML diff before finishing.
- A text/translation/label edit normally needs no typecheck script (per `AGENTS.md` validation rules) — but always run `git status` afterward and report any open/unstaged files.

Command form (all commands):
```bash
npx tsx scripts/yaml-manager.js <command> <file> [args]
```
Typical sequence: `analyze` → `find-key`/`search` → `update <file> <dotted-path> <value>` → `audit` → `sync` → review diff.
