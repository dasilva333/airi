# Settings Localization Management

Use this guide before locating or editing a translation key. It is the interface guide for `scripts/yaml-manager.js`; do not brute-force-search locale YAML files or read the manager source unless this guide and the command help cannot answer the task.

## Map a translation key to its file

Translation files live in `packages/i18n/src/locales/<locale>/`.

| Key prefix | File | Path passed to the manager |
| :--- | :--- | :--- |
| `settings.` | `settings.yaml` | Remove the leading `settings.` prefix |
| `stage.` | `stage.yaml` | Remove the leading `stage.` prefix |
| Any other prefix | `base.yaml` | Use the key as-is |

For example, `settings.pages.providers.provider.blip-local.title` belongs at `pages.providers.provider.blip-local.title` in `settings.yaml`.

## Normal workflow

1. Select the locale file from the table above.
2. Discover its hierarchy with `analyze`; do not scan the raw YAML file.
3. Use `find-key` for an exact YAML key segment, or `search` only when you know text but not the key. Both return numbered matches.
4. Add or update the full dotted path with `update`.
5. Run `audit` after a structural edit. Use `sync` to find keys missing from another locale.
6. Review the YAML diff before finishing.

All commands use this form:

```bash
npx tsx scripts/yaml-manager.js <command> <file> [args]
```

## Discovery and safe editing commands

| Command | Use it for | Example |
| :--- | :--- | :--- |
| `analyze <file>` | Listing the dotted key hierarchy with line numbers | `npx tsx scripts/yaml-manager.js analyze packages/i18n/src/locales/en/settings.yaml` |
| `find-key <file> <key>` | Finding a YAML key segment such as `blip-local` | `npx tsx scripts/yaml-manager.js find-key packages/i18n/src/locales/en/settings.yaml blip-local` |
| `search <file> <text>` | Finding known display text when the key is unknown | `npx tsx scripts/yaml-manager.js search packages/i18n/src/locales/en/settings.yaml "Refresh Status"` |
| `view-lines <file> <start> <end>` | Inspecting a small, numbered range after discovery | `npx tsx scripts/yaml-manager.js view-lines packages/i18n/src/locales/en/settings.yaml 120 150` |
| `update <file> <path> <value>` | Inserting or replacing a scalar value at a dotted path | `npx tsx scripts/yaml-manager.js update packages/i18n/src/locales/en/settings.yaml pages.modules.mcp-server.actions.refresh "Refresh Status"` |
| `audit <file>` | Detecting duplicate keys that YAML parsers can silently overwrite | `npx tsx scripts/yaml-manager.js audit packages/i18n/src/locales/en/settings.yaml` |
| `sync <source> <destination>` | Listing source keys missing from a target locale | `npx tsx scripts/yaml-manager.js sync packages/i18n/src/locales/en/settings.yaml packages/i18n/src/locales/ja/settings.yaml` |

## Recovery-only commands

`clean`, `fix-syntax`, `truncate`, `truncate-at-line`, `replace-line`, and `insert-line` can rewrite or discard raw YAML. Do not use them for normal translation work. Use them only when the task is explicitly repairing corrupted YAML, and review the complete diff immediately afterward.

## Cross-locale work

When a new source-language key is added, run `sync` against each locale that is in scope for the task. Do not assume a fixed locale list; inspect `packages/i18n/src/locales/` when deciding targets.
