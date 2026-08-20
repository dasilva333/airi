---
name: airi-docs-site-maintenance
description: >-
  Use when developing, maintaining, or restructuring the AIRI documentation site: VitePress setup in docs/, canonical sidebar single-source-of-truth in docs/shared-sidebar.ts, content folders in docs/content/ (en, ja, zh-Hans), Markdown frontmatter rules (title, description, category, date, preview-cover), relative asset resolution (@assets rules, avoiding missing local mp4/gif imports), and separation between technical root docs (docs/*.md) and user-facing public guides (docs/content/en/docs/manual/).
---

# AIRI Docs Site Maintenance

## Key Files/Locations

- `docs/shared-sidebar.ts` — Canonical single-source-of-truth sidebar definition consumed by both the VitePress standalone site (`withBase('/en/docs/{link}')`) and the in-app documentation modal (relative links as-is).
- `docs/.vitepress/config.ts` — Main VitePress configuration: multi-locale routing (`en`, `ja`, `zh-Hans`), Markdown plugins (UnoCSS, `@mdit/plugin-footnote`, `@mdit/plugin-tasklist`), navigation bars, and frontmatter asset resolvers.
- `docs/content/en/` — English source documentation:
  - `docs/overview/` — Introduction, versions, concept background.
  - `docs/manual/` — End-user configuration guides (`config/`) and practical feature guides (`interacting.md`, `proactivity.md`, `vision.md`, `comfyui.md`, `memory.md`, `mcp-tools.md`, `custom-models.md`, `desktop-controls.md`).
  - `docs/showcase/` — Visual feature galleries with `.avif` hero images.
  - `docs/contributing/` — Community open-source setup guides and design system rules.
  - `docs/chronicles/` — Historical release chronicles and fork feature status.
  - `blog/` — DevLogs, DreamLogs, and seasonal community announcements.
- `docs/content/ja/` & `docs/content/zh-Hans/` — Localized mirrors of public documentation.
- `docs/*.md` (Root) — Technical developer documentation: internal RFCs, architectural deep dives, state machine specs, and maintainer checklists.

## Separation Contract: Technical vs. User-Facing Docs

- **Root `docs/*.md`**: Internal engineering assets. Contains implementation details, raw research papers, data schemas, and PR planning documents. These live flat in `docs/` so coding agents and maintainers can locate them without recursive folder traversal.
- **`docs/content/`**: Public user-facing documentation. Explains *how to use* AIRI, configure settings, import models, and connect tools without overwhelming the user with internal store schemas or implementation blueprints.

## Content & Asset Conventions

1. **Frontmatter Standards**:
   ```yaml
   ---
   title: Page Title
   description: Brief description for search engines and VitePress previews.
   ---
   ```
2. **Asset Resolution Rules**:
   - Store images in an `assets/` subfolder next to the markdown file (e.g., `./assets/screenshot.avif`).
   - Use `.avif`, `.webp`, or `.png` for static images.
   - **Avoid Uncommitted Local Video/GIF Imports**: Vite's rollup bundler resolves relative image/video links at build time. Never reference local `.mp4` or `.gif` files that are not checked into git; host large videos on CDN or use static image fallbacks.
   - In blog frontmatter `preview-cover`, use `@assets('./assets/image.avif')` with existing files.
3. **Sidebar Updates**:
   - Whenever adding or moving a page in `docs/content/`, update `docs/shared-sidebar.ts`.
   - Never add dead links to `shared-sidebar.ts`—VitePress validation will fail the build.

## Common Pitfalls

- **Broken Internal Links**: Relative markdown links must match actual files in `docs/content/`. If a document was moved to root `docs/`, link to the corresponding public manual guide or feature showcase instead.
- **Translating Shared Sidebar**: `shared-sidebar.ts` contains `titleKey` properties for internationalization in the in-app viewer. Ensure section IDs and paths match expected locale structures.
- **Duplicate Architecture Files**: Do not duplicate internal design docs inside `docs/content/en/docs/advanced/`. Keep technical specs in root `docs/` and summarize user-facing functionality in `docs/manual/`.

## Verification

- Validation command: `pnpm -F @proj-airi/docs build` (or `pnpm dev:docs` to preview locally).
- Always verify that all cross-references in `docs/shared-sidebar.ts` resolve to existing markdown files.

## Related Skills & References

- **Key Documents**: [[interacting]], [[proactivity]], [[vision]], [[comfyui]], [[memory]], [[mcp-tools]], [[custom-models]], [[desktop-controls]]
