# Project AIRI Agent Guide

Concise but detailed reference for contributors working across the `moeru-ai/airi` monorepo. Improve code when you touch it; avoid one-off patterns.

## Tech Stack (by surface)

- **Desktop (stage-tamagotchi)**: Electron, Vue, Vite, TypeScript, Pinia, VueUse, Eventa (IPC/RPC), UnoCSS, Vitest, ESLint.
- **Web (stage-web)**: Vue 3 + Vue Router, Vite, TypeScript, Pinia, VueUse, UnoCSS, Vitest, ESLint. Backend: WIP.
- **Mobile (stage-pocket)**: Vue 3 + Vue Router, Vite, TypeScript, Pinia, VueUse, UnoCSS, Vitest, ESLint, Kotlin, Swift, Capacitor.
- **UI/Shared Packages**:
  - `packages/stage-ui`: Core business components, composables, stores shared by stage-web & stage-tamagotchi (heart of stage work).
  - `packages/stage-ui-three`: Three.js bindings + Vue components.
  - `packages/stage-ui-pixi`: Planned Pixi bindings.
  - `packages/stage-shared`: Shared logic across stage-ui, stage-ui-three, stage-web, stage-tamagotchi.
  - `packages/ui`: Standardized primitives (inputs, textarea, buttons, layout) built on reka-ui; minimal business logic.
  - `packages/i18n`: Central translations.
  - Server channel: `packages/server-runtime`, `packages/server-sdk`, `packages/server-shared` (power `services/` and `plugins/`).
  - Legacy: `crates/` (old Tauri desktop; current desktop is Electron).

## Structure & Responsibilities

- **Apps**
  - `apps/stage-web`: Web app; composables/stores in `src/composables`, `src/stores`; pages in `src/pages`; devtools in `src/pages/devtools`; router config via `vite.config.ts`.
  - `apps/stage-tamagotchi`: Electron app; renderer pages in `src/renderer/pages`; devtools in `src/renderer/pages/devtools`; settings layout at `src/renderer/layouts/settings.vue`; router config via `electron.vite.config.ts`.
  - Settings/devtools routes rely on `<route lang="yaml"> meta: layout: settings </route>`; ensure routes/icons are registered accordingly (`apps/stage-tamagotchi/src/renderer/layouts/settings.vue`, `apps/stage-web/src/layouts/settings.vue`).
  - Shared page bases: `packages/stage-pages`.
  - Stage pages: `apps/stage-web/src/pages`, `apps/stage-tamagotchi/src/renderer/pages` (plus devtools folders).
- **Stage UI internals** (`packages/stage-ui/src`)
  - Providers: `stores/providers.ts` and `stores/providers/` (standardized provider definitions).
  - Modules: `stores/modules/` (AIRI orchestration building blocks).
  - Composables: `composables/` (business-oriented Vue helpers).
  - Components: `components/`; scenarios in `components/scenarios/` for page/use-case-specific pieces.
  - Stories: `packages/stage-ui/stories`, `packages/stage-ui/histoire.config.ts` (e.g. `components/misc/Button.story.vue`).
- **IPC/Eventa**: Always use `@moeru/eventa` for type-safe, framework/runtime-agnostic IPC/RPC. Define contracts centrally (e.g., `apps/stage-tamagotchi/src/shared`) and follow usage patterns in `apps/stage-tamagotchi/src/main/services/electron` for main/renderer integration.
- **Dependency Injection**: Use `injeca` for services/electron modules/plugins/frontend; see `apps/stage-tamagotchi/src/main/index.ts` for composition patterns.
- **Build/CI/Lint**: `.github/workflows` for pipelines; `eslint.config.js` for lint rules.
- **Bundling libs**: Use `tsdown` for new modules (see `packages/vite-plugin-warpdrive`).
- **Styles**: UnoCSS config at `uno.config.ts`; check `apps/stage-web/src/styles` for existing animations; prefer UnoCSS over Tailwind.

## The Rosetta Stone (Key Path Index)

Concise mapping of conceptual features to technical file paths for rapid context retrieval.

### Core UI & Surfaces
- **Floating Island (Stage)**: `packages/stage-ui/src/components/scenes/Stage.vue` (Host for models, speech, background)
- **Control Island (Original)**: `apps/stage-tamagotchi/src/renderer/components/stage-islands/controls-island/index.vue` (Main chevron/drag logic)
- **Gemini Control Island**: `.../controls-island/gemini-controls.vue` (Left-side sparkle controls)
- **Whisperbox**: `packages/stage-ui/src/components/scenarios/chat/WhisperDock.vue` (Mid-center keyboard input)
- **Resource Island**: `apps/stage-tamagotchi/src/renderer/components/stage-islands/resource-status-island/index.vue`
- **VRM Character**: `packages/stage-ui-three/src/components/Model/VRMModel.vue` (3D rendering & expressions)
- **Live2D Character**: `packages/stage-ui-live2d/src/components/scenes/live2d/Canvas.vue`
- **Gemini Panel**: `apps/stage-tamagotchi/src/renderer/pages/notice/gemini.vue` (UI) | `packages/stage-ui/src/stores/modules/live-session.ts` (Bidi WebSocket)
- **System Tray**: `apps/stage-tamagotchi/src/main/tray/index.ts` (Electron main process)
- **Caption Overlay**: `apps/stage-tamagotchi/src/renderer/pages/caption.vue` (UI) | `apps/stage-tamagotchi/src/main/windows/caption/` (Manager)
- **Widgets Host (Standalone)**: `apps/stage-tamagotchi/src/renderer/pages/widgets.vue` (Renderer window for all widgets)
- **Widget Window Manager**: `apps/stage-tamagotchi/src/main/windows/widgets/index.ts` (Handles life-cycle, snapshots, and TTL)

### Settings & Editing
- **AIRI Card Editor**: `packages/stage-pages/src/pages/settings/airi-card/index.vue`
    - **Identity Tab**: `.../tabs/CardCreationTabIdentity.vue`
    - **Behavior Tab**: `.../tabs/CardCreationTabBehavior.vue`
    - **Generation Tab**: `.../tabs/CardCreationTabGeneration.vue`
    - **Acting Tab**: `.../tabs/CardCreationTabActing.vue`
    - **Artistry Tab**: `.../tabs/CardCreationTabArtistry.vue`
    - **Modules Tab**: `.../tabs/CardCreationTabModules.vue`
    - **Proactivity Tab**: `.../tabs/CardCreationTabProactivity.vue`
- **Vision Settings**: `packages/stage-pages/src/pages/settings/modules/vision.vue` | `visionStore`
- **Modules/Systems**: `packages/stage-pages/src/pages/settings/modules/`
- **Providers Config**: `packages/stage-pages/src/pages/settings/providers/`

### Engine & Subsystems
- **ACT Pipeline**: `packages/stage-ui/src/composables/use-llm-marker-parser.ts` (Parser) | `packages/stage-ui-three/src/services/expression.ts` (Execution)
- **Memory (Long-term)**: `packages/stage-ui/src/stores/memory-text-journal.ts` (IndexedDB) | `Settings -> Memory -> Long Term`
- **Text Journal Operations**: `write`, `search` (Involved in tool definitions)
- **Semantic Search Index**: `Transformers.js` / `Orama` / `Voy` (Local indexing in `IndexedDB`)
- **Memory (Short-term)**: `packages/stage-ui/src/stores/memory-short-term.ts` (Daily summaries)
- **VRM Animations**: `packages/stage-ui-three/src/assets/vrm/animations/index.ts` (Assets) | `packages/stage-ui-three/src/stores/model-store.ts` (State)
- **Artistry/ComfyUI**: `apps/stage-tamagotchi/src/main/services/airi/widgets/providers/comfyui.ts` (Native HTTP API)
- **Scene/Background**: `packages/stage-ui/src/components/scenes/Stage.vue` (Layer) | `packages/stage-pages/src/pages/settings/scene/index.vue` (UI)
- **Model Position/Lights**: `packages/stage-ui/src/components/scenarios/settings/model-settings/vrm.vue`
- **Proactivity/Heartbeats**: `packages/stage-ui/src/stores/proactivity.ts` (Idle logic)
- **Control Island State**: `packages/stage-ui/src/stores/settings/controls-island.ts` (Shared) | `apps/stage-tamagotchi/src/renderer/stores/controls-island.ts` (Renderer)
- **Image Journal Store**: `packages/stage-ui/src/stores/background.ts` (Handles Builtin, Scene, Journal, and Selfie types)
- **Artistry Bridge**: `apps/stage-tamagotchi/src/main/services/airi/widgets/artistry-bridge.ts` (Main process bridge for image widgets)
- **Image Attachments**: `packages/stage-layouts/src/components/Widgets/ChatArea.vue` (State) | `packages/ui/src/components/form/textarea/basic-text-area.vue` (Drop)
- **User Image Render**: `packages/stage-ui/src/components/scenarios/chat/user-item.vue`
- **STT/Microphone**: `apps/stage-tamagotchi/src/renderer/pages/index.vue` (Tamagotchi) | `apps/stage-web/src/pages/index.vue` (Web)
- **Discord Service**: `apps/stage-tamagotchi/src/main/services/airi/discord/index.ts` (Main) | `packages/stage-ui/src/stores/modules/discord.ts` (Renderer)
    - **Slash Commands**: Definitions & Handler in `packages/stage-ui/src/stores/modules/discord.ts` (COMMANDS_VERSION: 4)
    - **Vision Plumbing**: Intercepts Discord attachments and maps to `chatOrchestrator.ingest` as base64.
- **Character Artistry DNA**: `packages/stage-ui/src/constants/prompts/character-defaults.ts` (Weighted visual prompt constants for Hyori, Lupin, Aria, etc.)

### Chatbox Elements
- **Chat History (Host)**: `packages/stage-ui/src/components/scenarios/chat/history.vue`
- **Assistant Bubble**: `.../chat/assistant-item.vue`
- **User Bubble**: `.../chat/user-item.vue`
- **Bubble Render Parts**: `.../chat/response-part.vue` (Text) | `.../chat/tool-call-block.vue` (Tools)
- **Journal Strip (Chips)**: `apps/stage-tamagotchi/src/renderer/components/InteractiveArea.vue` (Scrollable Image/Text previews)
- **Toolbar Strip**: `apps/stage-tamagotchi/src/renderer/components/InteractiveArea.vue` (Buttons: Grounding, Memory, Trash, Send)
- **Bubble Styling (ACT)**: extracted from performance tokens in `ChatArea.vue`

### Key Directories
- `packages/stage-ui`: Core business logic, components, and Pinia stores.
- `packages/stage-shared`: Common constants (`emotions.ts`, `events.ts`) and utils.
- `apps/stage-tamagotchi`: Electron-specific main/renderer code.
- `docs/content/en/docs/advanced/architecture/`: Source for all detailed architecture specifications.

### Nicknames Index
- **"chatbox"** -> `ChatArea.vue` / `Interaction*.vue`
- **"the island"** -> `controls-island/index.vue` (aka original island / og island)
- **"the floating widget"** / **"the standalone window"** / **"the tamagotchi"** -> `Stage.vue`
- **"pencil artistry"** -> `CardCreationTabArtistry.vue`
- **"the staging_widgets thing"** -> `apps/stage-tamagotchi/src/renderer/stores/tools/builtin/widgets.ts` (The spawning tool)
- **"the backends"** -> `packages/stage-ui/src/stores/providers.ts`
- **"the brain"** -> `packages/stage-ui/src/stores/modules/`

## Commands (pnpm with filters)

> Use pnpm workspace filters to scope tasks. Examples below are generic; replace the filter with the target workspace name (e.g. `@proj-airi/stage-tamagotchi`, `@proj-airi/stage-web`, `@proj-airi/stage-ui`, etc.).

- **Typecheck**
  - `pnpm -F <package.json name> typecheck`
  - Example: `pnpm -F @proj-airi/stage-tamagotchi typecheck` (runs `tsc` + `vue-tsc`).
- **Unit tests (Vitest)**
  - Targeted: `pnpm exec vitest run <path/to/file>`
    e.g. `pnpm exec vitest run apps/stage-tamagotchi/src/renderer/stores/tools/builtin/widgets.test.ts`
  - Workspace: `pnpm -F <package.json name> exec vitest run`
    e.g. `pnpm -F @proj-airi/stage-tamagotchi exec vitest run`
  - Root `pnpm test:run`: runs all tests across registered projects. If no tests are found, check `vitest.config.ts` include patterns.
  - Root `vitest.config.ts` includes `apps/stage-tamagotchi` and other projects; each app/package can have its own `vitest.config`.
- **Lint**
  - `pnpm lint` and `pnpm lint:fix`
  - Formatting is handled via ESLint; `pnpm lint:fix` applies formatting.
- **Build**
  - `pnpm -F <package.json name> build`
  - Example: `pnpm -F @proj-airi/stage-tamagotchi build` (typecheck + electron-vite build).

## Development Practices

- Favor clear module boundaries; shared logic goes in `packages/`.
- Keep runtime entrypoints lean; move heavy logic into services/modules.
- Prefer functional patterns + DI (`injeca`) for testability.
- Use Valibot for schema validation; keep schemas close to their consumers.
- Use Eventa (`@moeru/eventa`) for structured IPC/RPC contracts where needed.
- Do not add backward-compatibility guards. If extended support is required, write refactor docs and spin up another Codex or Claude Code instance via shell command to complete the implementation with clear instructions and the expected post-refactor shape.
- If the refactor scope is small, do a progressive refactor step by step.
- When modifying code, always check for opportunities to do small, minimal progressive refactors alongside the change.

## Styling & Components

- Prefer Vue v-bind class arrays for readability when working with UnoCSS & tailwindcss: do `:class="['px-2 py-1','flex items-center','bg-white/50 dark:bg-black/50']"`, don't do `class="px-2 py-1 flex items-center bg-white/50 dark:bg-black/50"`, don't do `px="2" py="1" flex="~ items-center" bg="white/50 dark:black/50"`; avoid long inline `class=""`. Refactor legacy when you touch it.
- Use/extend UnoCSS shortcuts/rules in `uno.config.ts`; add new shortcuts/rules/plugins there when standardizing styles. Prefer UnoCSS over Tailwind.
- Check `apps/stage-web/src/styles` for existing animations; reuse or extend before adding new ones. If you need config references, see `apps/stage-web/tsconfig.json` and `uno.config.ts`.
- Build primitives on `@proj-airi/ui` (reka-ui) instead of raw DOM; see `packages/ui/src/components/Form` for patterns.
- Use Iconify icon sets; avoid bespoke SVGs.
- Animations: keep intuitive, lively, and readable.
- `useDark` (VueUse): set `disableTransition: false` or use existing composables in `packages/ui`.

## Testing Practices

- Vitest per project; keep runs targeted for speed.
- Mock IPC/services with `vi.fn`/`vi.mock`; do not rely on real Electron runtime.
- For external providers/services, add both mock-based tests and integration-style tests (with env guards) when feasible. You can mock imports with Vitest.
- Grow component/e2e coverage progressively (Vitest browser env where possible). Use `expect` and assert mock calls/params.

## TypeScript / IPC / Tools

- Keep JSON Schemas provider-compliant (explicit `type: object`, required fields; avoid unbounded records).
- Favor functional patterns + DI (`injeca`); avoid new class hierarchies unless extending browser APIs (classes are harder to mock/test).
- Centralize Eventa contracts; use `@moeru/eventa` for all events.
- When a user asks to use a specific tool or dependency, first check Context7 docs with the search tool, then inspect actual usage of the dependency in this repo.
- If multiple names are returned from Context7 without a clear distinction, ask the user to choose or confirm the desired one.
- If docs conflict with typecheck results, inspect the dependency source under `node_modules` to diagnose root cause and fix types/bugs.

## i18n

- Add/modify translations in `packages/i18n`; avoid scattering i18n across apps/packages.
- **Large YAML Management**: For large files (e.g., `en.yaml` with 3500+ lines), use `scripts/yaml-manager.js` to avoid memory issues and ensure structural integrity.
  - **Commands**:
    - `node scripts/yaml-manager.js analyze <file>`: Show compact tree structure with line numbers.
    - `node scripts/yaml-manager.js audit <file>`: Check for duplicate keys.
    - `node scripts/yaml-manager.js search <file> <string>`: Find line numbers for a specific string.
    - `node scripts/yaml-manager.js find-key <file> <key>`: Locate specific YAML keys.
    - `node scripts/yaml-manager.js update <file> <path.to.key> <value>`: Safely update or insert a value.
    - `node scripts/yaml-manager.js sync <src> <dest>`: Find keys in source missing from destination.
    - `node scripts/yaml-manager.js clean <file>`: Strip trailing garbage/fix corruption.
    - `node scripts/yaml-manager.js fix-syntax <file>`: Quote scalars containing colons.

## CSS/UNO

- Use/extend UnoCSS shortcuts in `uno.config.ts`.
- Prefer grouped class arrays for readability; refactor legacy inline strings when possible.

## Naming & Comments

- File names: kebab-case.
- Avoid classes unless extending runtime/browser APIs; FP + DI is easier to test/mock.
- Add clear, concise comments for utils, math, OS-interaction, algorithm, shared, and architectural functions that explain what the function does.
- When using a workaround, add a `// NOTICE:` comment explaining why, the root cause, and any source context. If validated via `node_modules` inspection or external sources (e.g., GitHub), include relevant line references and links in code-formatted text.
- When moving/refactoring/fixing/updating code, keep existing comments intact and move them with the code. If a comment is truly unnecessary, replace it with a comment stating it previously described X and why it was removed.
- Avoid stubby/hacky scaffolding; prefer small refactors that leave code cleaner.
- Use markers:
  - `// TODO:` follow-ups
  - `// REVIEW:` concerns/needs another eye
  - `// NOTICE:` magic numbers, hacks, important context, external references/links

## PR / Workflow Tips

- Rebase pulls; branch naming `username/feat/short-name`; clear commit messages (gitmoji optional).
- Summarize changes, how tested (commands), and follow-ups.
- Improve legacy you touch; avoid one-off patterns.
- Keep changes scoped; use workspace filters (`pnpm -F <workspace> <script>`).
- Maintain structured `README.md` documentation for each `packages/` and `apps/` entry, covering what it does, how to use it, when to use it, and when not to use it.
- Always run `pnpm typecheck` and `pnpm lint:fix` after finishing a task.
- **Commit & Push Etiquette**:
  - **Never** commit or push untested changes. Verify that your specific changes work as expected in the target environment.
  - Commit messages must signify **what is actually being submitted**, not just the intent or a vague "fix". If you fixed X, say `fix: X`; if you refactored Y, say `refactor: Y`.
- Use Conventional Commits for commit messages (e.g., `feat: add runner reconnect backoff`).
