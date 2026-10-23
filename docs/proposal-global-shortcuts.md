# Proposal: Configurable System-Wide Global Shortcuts Architecture

> **Status**: Proposed Architecture & Evaluation RFC  
> **Target Subsystems**:
> - `packages/stage-shared/src/global-shortcut/` & `packages/stage-shared/src/shortcuts.ts` (Universal Key IR & Accelerator Normalization)
> - `apps/stage-tamagotchi/src/main/services/shortcuts/` (Main Process Global Shortcut Manager & Electron Dispatcher)
> - `apps/stage-tamagotchi/src/main/services/shortcuts/mic-toggle.ts` & `macos-capslock-check.cpp` (Preserved Darwin Lock-Key Polling)
> - `packages/stage-ui/src/stores/shortcuts.ts` & `packages/stage-ui/src/components/stage/ControlStrip.vue` (Desktop Action Bindings)
> - `packages/stage-pages/src/pages/settings/system/window-shortcuts.vue` (User-Facing Shortcut Authoring & Recording UX)  
> **Key Upstream References**:
> - Upstream PR [#3049](https://github.com/moeru-ai/airi/pull/3049): `fix(stage-shared): parse Electron punctuation accelerators` *(Merged into upstream/main at commit `d67487067`)*
> - Upstream Issue [#3030](https://github.com/moeru-ai/airi/issues/3030): `parseAccelerator throws on literal punctuation keys like CmdOrCtrl+,`
> - Upstream commit `eb2faff28`: Universal W3C key token parsing and Electron accelerator stringification
> **Related Fork Skills & Specs**:
> - [`airi-controlstrip-customizer`](../.agents/skills/airi-controlstrip-customizer/SKILL.md) & [`airi-stage-ui-surfaces`](../.agents/skills/airi-stage-ui-surfaces/SKILL.md)
> - [`airi-ipc-eventa`](../.agents/skills/airi-ipc-eventa/SKILL.md)
> - [`docs/project-selective-upstream-sync-protocol.md`](./project-selective-upstream-sync-protocol.md)

---

## 1. Executive Summary & Problem Statement

Currently in `dasilva333/airi`, global shortcut handling is strictly limited to audio capture toggling:
- Users can bind single lock keys (`ScrollLock`, `CapsLock`, `NumLock`) via [`apps/stage-tamagotchi/src/main/services/shortcuts/mic-toggle.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/apps/stage-tamagotchi/src/main/services/shortcuts/mic-toggle.ts).
- On macOS Darwin, Caps Lock is handled via a specialized native C++ polling module ([`macos-capslock-check.cpp`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/apps/stage-tamagotchi/src/main/services/shortcuts/macos-capslock-check.cpp)) to bypass Electron's notorious unreliability with lock key state changes.

However, desktop users expect comprehensive, system-wide key bindings to control their companion without having to bring the window into focus or manually click desktop controls:
1. **Show/Hide Floating Control Strip**: Quickly summon or dismiss the companion's main UI ribbon (`CmdOrCtrl+Shift+A` or user choice).
2. **Toggle Chat Drawer**: Pop open the quick chat composer anywhere (`CmdOrCtrl+K` or ``CmdOrCtrl+` ``).
3. **Emergency Silence / Boss Key**: Instantly stop TTS speech playback, interrupt the agent loop, and hide the Actor Stage (`CmdOrCtrl+Esc` or `CmdOrCtrl+Alt+M`).
4. **Quick Preferences**: Open the settings window (`CmdOrCtrl+,`).
5. **Universal Push-to-Talk / Mute**: Combine multi-key combos (e.g. `Alt+Space`, `CmdOrCtrl+Shift+M`) in addition to lock keys.

Upstream recently tackled arbitrary accelerator parsing in `packages/stage-shared/src/global-shortcut/accelerators.ts`. While upstream's execution ran into punctuation parsing bugs (PR [#3049](https://github.com/moeru-ai/airi/pull/3049), Issue [#3030](https://github.com/moeru-ai/airi/issues/3030)) and suffered from multi-window Eventa broadcast leaks, the underlying accelerator parser design provides a solid mathematical foundation that this fork can adapt cleanly.

---

## 2. Piggybacking Upstream: The Accelerator Parser Foundation

Upstream's parser solves the difficult impedance mismatch between:
- **W3C Code Strings**: `KeyK`, `Comma`, `BracketLeft`, `ArrowUp` (used by web keyboard events).
- **Electron Accelerator Strings**: `CmdOrCtrl+,`, `Alt+[`, `Shift+Command+K` (used by Electron's native `globalShortcut`).
- **Human-Readable Labels**: `⌘ + ,`, `Ctrl + Shift + K` (used for UI display).

### The Codada Fix (PR #3049)
Prior to PR #3049, parsing `CmdOrCtrl+,` crashed because `,` was literal punctuation rather than a W3C name. Upstream inverted the formatter map into `ELECTRON_PUNCTUATION_ALIASES`:

```ts
const ELECTRON_PUNCTUATION_ALIASES: ReadonlyMap<string, ShortcutKey> = new Map(
  Object.entries(ELECTRON_KEY_OVERRIDES)
    .filter(([, token]) => token.length === 1)
    .map(([key, token]) => [token, key]),
)
```

By porting this standalone parser module into `packages/stage-shared/src/global-shortcut/`, our fork gets:
- Zero-dependency parsing of complex key combinations.
- Safe handling of all standard keyboard punctuation (`` ` ``, `-`, `=`, `[`, `]`, `\`, `;`, `'`, `,`, `.`, `/`).
- Canonical normalization and idempotent round-tripping (`parseAccelerator(formatElectronAccelerator(acc)) === acc`).

---

## 3. Architectural Distinction: Fork Control Strip vs. Upstream Control Island

Upstream struggled with window IPC collisions (PRs #3083, #3087) because their global shortcuts were routed ambiguously across multiple windows that shared identical IPC listeners.

In our fork, the architecture is strictly authoritative:

```
                  +----------------------------------------------+
                  |  Electron Main Process (globalShortcut API)  |
                  +----------------------+-----------------------+
                                         |
                                         | Typed IPC / Dispatch
                                         v
                  +----------------------------------------------+
                  |        Main Window / Control Strip Host      |
                  |             (Authoritative Anchor)           |
                  +----+-------------------+----------------+----+
                       |                   |                |
                       v                   v                v
             +-------------------+  +-------------+  +-------------+
             | Control Strip Bar |  | Chat Drawer |  | Actor Stage |
             |    (Show/Hide)    |  |  (Open/Pop) |  |   (Mute)    |
             +-------------------+  +-------------+  +-------------+
```

1. **Single Point of Registration**: The Electron main process owns the `globalShortcut` registry. No individual window registers raw global shortcuts.
2. **Authoritative Dispatching**: Invocations dispatch directly to the main desktop window host. The host routes the action to the relevant surface (e.g. toggling the `ControlStrip.vue` floating ribbon or opening the chat composer).
3. **Preservation of Lock-Key High-Performance Polling**: The macOS Caps Lock C++ polling worker (`macos-capslock-check.cpp`) is retained as a specialized provider for lock keys, while standard modifier combos use Electron's event-driven `globalShortcut.register`.

---

## 4. Planned Action Catalog & Default Bindings

| Action Identifier | Description | Default macOS Binding | Default Windows/Linux Binding | Target Surface |
| :--- | :--- | :--- | :--- | :--- |
| `shortcut:strip:toggle` | Toggle Control Strip visibility | `Cmd+Shift+A` | `Ctrl+Shift+A` | Control Strip Host |
| `shortcut:chat:toggle` | Pop open quick chat drawer | `Cmd+Shift+K` | `Ctrl+Shift+K` | Chat Workspace |
| `shortcut:mic:toggle` | Toggle microphone mute | `ScrollLock` / `CapsLock` | `ScrollLock` / `CapsLock` | Audio Pipeline |
| `shortcut:stage:boss-key` | Emergency audio mute & hide stage | `Cmd+Alt+Esc` | `Ctrl+Alt+Esc` | Actor Stage |
| `shortcut:settings:open` | Open settings window | `Cmd+,` | `Ctrl+,` | Settings Window |

---

## 5. Phased Implementation Roadmap

- [ ] **Phase 1: Shared Accelerator Parser Port**
  - Port `packages/stage-shared/src/global-shortcut/accelerators.ts` and test suite from upstream commit `d67487067`.
  - Verify complete unit test parity with Vitest across all punctuation and modifier tokens.
- [ ] **Phase 2: Main Process Shortcut Service**
  - Create `apps/stage-tamagotchi/src/main/services/shortcuts/global-shortcuts.ts`.
  - Wire configuration loading from local persistence (`createConfig`).
  - Graceful fallback on registration collisions (with user notification via toast).
- [ ] **Phase 3: Control Strip Action Integration**
  - Connect actions to `ControlStrip.vue` and `useAiriCardStore`.
  - Implement the Emergency Boss Key (stopping Kokoro/audio synthesis immediately).
- [ ] **Phase 4: Settings UI & Key Recording Component**
  - Implement a dedicated shortcut recorder input in `packages/stage-pages` allowing users to press any key combination to record their custom bindings.
