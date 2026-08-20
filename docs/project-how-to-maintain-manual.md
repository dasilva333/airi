# How to Maintain the In-App Manual Documentation

This document explains the files and steps required to add, remove, or modify pages in the in-app documentation viewer (the "Manual").

---

## Architecture Overview

The in-app documentation is rendered using a Vue component that reads Markdown content files directly from the parent `/docs/content` directory.

* **Rendering Engine**: [\[...path\].vue](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/apps/stage-tamagotchi/src/renderer/pages/settings/docs/[...path].vue) utilizes Vite's dynamic `import.meta.glob` to import all raw Markdown files under `docs/content/**/*.md`.
* **Sidebar Navigation**: The sidebar navigation layout is controlled by a structured object in [docs-sidebar.ts](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/apps/stage-tamagotchi/src/renderer/constants/docs-sidebar.ts).

---

## Steps to Add a New Page

### 1. Create the Markdown Document
Create your new documentation file inside the appropriate sub-directory in the English content directory:
`docs/content/en/docs/manual/...`

For configuration guides, add it under:
[docs/content/en/docs/manual/config/](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/docs/content/en/docs/manual/config/)

Example file: `your-new-page.md`
```markdown
---
title: Your Page Title
---

# Your Page Title

Write the page contents here...
```

### 2. Add to the Sidebar Navigation
Open [docs-sidebar.ts](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/apps/stage-tamagotchi/src/renderer/constants/docs-sidebar.ts) and add the entry matching your section structure.

For example, to place your new page under the **User Guides > Configuration** section:
```typescript
{
  text: 'Your Page Link Text',
  link: 'manual/config/your-new-page' // Match the relative path inside docs/content/en/docs/
}
```

---

## Troubleshooting: Page "Not Found" in Dev Mode

### Why it happens:
Vite compiles `import.meta.glob` mappings at build/compile time. Because the markdown files reside in `/docs/content` (which is outside the Vite project root `/apps/stage-tamagotchi`), Vite's file watcher does not monitor this external directory for newly created files.

### How to fix:
To force Vite to re-glob the filesystem and register your new page without restarting the dev server, touch the route file by modifying a comment or adding a newline in [\[...path\].vue](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/apps/stage-tamagotchi/src/renderer/pages/settings/docs/[...path].vue).

This forces Vite to re-compile the component and re-run the glob scan.

## Relevant Skills

- [[airi-codebase-verification]]
