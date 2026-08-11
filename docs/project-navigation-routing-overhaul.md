# AIRI Navigation, Routing & Window-Title Overhaul Specification

## 1. Motivation & Core Vision

AIRI's multi-window desktop and web navigation has suffered from routing regressions, fragile per-layout back-button handlers, and drifting window titles.

Recent changes over the last 5 days (Aug 7–8, 2026) revealed that history manipulation was hardcoded in multiple layouts using divergent strategies (`router.push`, `router.back()`, `router.replace`). This caused the web build's Settings layout to fall back to `router.push('/')` when backing out of `/settings`, rendering a duplicate Control Strip inside the Settings window.

### Core Ground Rules
1. **`/settings` (or `#/settings`) is the Root of Settings**: Users must **never** be able to navigate back from `/settings` to `/`. Clicking back at `/settings` must be disabled or early-returned.
2. **Single Source of Truth for Navigation**: Route boundaries must be declared via route metadata (`meta.rootOfSettings: true`) and enforced at the router layer via `router.beforeEach`, rather than string-matching `route.path === '/settings'` inside individual layouts.
3. **Window Title Consistency**: All Electron windows must follow a unified naming convention (`AIRI — {Window}`) and synchronize native main-process titles with dynamic in-page renderer routing.

---

## 2. Current State Analysis

### 2.1 Layout Divergence (Electron vs. Web)
`vite-plugin-vue-layouts` resolves layout directories in order of preference:
- **Electron** (`apps/stage-tamagotchi/electron.vite.config.ts`): Resolves `apps/stage-tamagotchi/src/renderer/layouts/settings.vue` first.
- **Web** (`packages/stage-web/vite.config.ts`): Resolves `packages/stage-layouts/src/layouts/settings.vue`.

In the Web layout (`packages/stage-layouts/src/layouts/settings.vue`), backing out of `/settings` contained `router.push('/')`, which maps to the main Control Strip. In the Electron layout, the back button was disabled at `/settings`, masking the bug in desktop mode while leaving the web build broken.

### 2.2 Window Title & Chrome Fragmentation
Current Electron window titles are inconsistent across main processes (`apps/stage-tamagotchi/src/main/windows/`):
- Main Window: `'AIRI'`
- Actor Stage: `'AIRI - Actor Stage'`
- Settings: `'AIRI - Settings'`
- About: `'About AIRI'` *(Inverted)*
- Customizer / Widgets / Notice / Devtools: `'Customizer'`, `'Widgets'`, `'Notice'` *(Bare, missing AIRI prefix)*

Additionally, `settingsWindow` reuses a single `BrowserWindow` instance and re-targets it via IPC (`electronSettingsNavigate`) or hash route changes (`/settings?action=onboarding`), but main-process `window.setTitle(...)` is never called, causing native OS window title to desync from `document.title`.

### 2.3 Dead Prop Code
`provider-settings-layout.vue` declared an `onBack` prop and `navigateBackToProviders()` logic was built in settings layouts, but no `<button>` in `provider-settings-layout.vue` bound to `:on-back`, leaving category back routing inactive.

---

## 3. Durable Target Architecture

```
                       ┌─────────────────────────────────────────┐
                       │           Vue Router Guard              │
                       │        (renderer/router.ts)             │
                       └────────────────────┬────────────────────┘
                                            │
                                 Intercepts Navigation
                                            │
                    ┌───────────────────────┴───────────────────────┐
                    ▼                                               ▼
     Is `from.path === '/settings'`                  Normal Navigation
     & target is `/` (Root)?                         (Parent / Sub-route)
                    │                                               │
           ⛔ BLOCK & CANCEL                                ✅ ALLOW
```

---

## 4. Implementation Phasing Plan

### Phase 1: Router Boundary Guard (`router.beforeEach`)
- Add `meta: { rootOfSettings: true }` to `/settings` route definitions.
- Implement a global router guard in `renderer/main.ts` / `router.ts`:
  ```ts
  router.beforeEach((to, from) => {
    if (from.meta?.rootOfSettings && to.path === '/') {
      return false // Cancel navigation from Settings root to Control Strip
    }
  })
  ```

### Phase 2: Unified Layout Consolidation
- Consolidate layout logic so both Web and Electron layouts share a single declarative `handleBack` mechanism.
- Remove `router.push('/')` fallback branches.
- Disable back button at root whenever `route.meta?.rootOfSettings` is true.

### Phase 3: Window Title Standardization & IPC Sync
- Standardize all main-process window creation titles to `AIRI — {WindowName}`.
- Wire `document.title` watcher in `settings.vue` layout to emit IPC event `window:set-title`, updating main-process `BrowserWindow.setTitle()`.

### Phase 4: Dead Prop Cleanup
- Bind or remove the unused `onBack` prop in `provider-settings-layout.vue`.

---

## 5. Journal of Fixes & Edge Cases

| Date | Target Area | Description / Edge Case Identified | Status |
|---|---|---|---|
| 2026-08-10 | Spec Creation | Documented initial audit findings, layout divergence, and target architecture. | 🟢 Completed |
| 2026-08-10 | Router Guard | Added `rootOfSettings: true` to Electron `renderer/pages/settings/index.vue` and new web `apps/stage-web/src/pages/settings/index.vue`; added global `beforeEach` guard blocking `from.meta.rootOfSettings && to.path === '/'` in both `renderer/main.ts` (hash) and `apps/stage-web/src/main.ts`. | 🟢 Completed |
| 2026-08-10 | Layout Consolidation | Aligned both `settings.vue` layouts: removed `router.push('/')` fallback (web) and `router.back()` (Electron); all sub-routes back up to `/settings`; back disabled via `route.meta.rootOfSettings` (not `isStageTamagotchi()`). Web keeps `router.replace` for provider anchors (anti-loop), Electron `push`. | 🟢 Completed |
| 2026-08-10 | Window Titles | Standardized 10 main-process titles to `AIRI — {Window}` (Settings/About/Customizer/Caption/Chat/Widgets/Onboarding/Notice/Devtools/Inlay). Left `stage/index.ts:187/204` (`'AIRI'` window-position coordinate keys) and `/actor` dynamic title unchanged. Wired `electronWindowSetTitle` (invoke) renderer→main in `shared/eventa.ts` + `shared/window.ts` (all windows via `setupBaseWindowElectronInvokes`); renderer reports via `document.title` watcher in `App.vue`. | 🟢 Completed |
| 2026-08-10 | Dead Prop Cleanup | Removed `onBack` from `provider-settings-layout.vue` prop contract (was never rendered), `navigateBackToProviders` from `use-provider-validation.ts`, and its bindings in `[providerId]`/`ollama`/`lm-studio`/`web-llm` chat pages + `speech`/`transcription-provider-settings.vue` (incl. orphaned `useRouter`). | 🟢 Completed |
| 2026-08-10 | Validation | `stage-layouts`, `stage-pages` typecheck ✅ 0 errors. `stage-tamagotchi` introduces 0 new errors; 5 pre-existing on `main` remain (baselined via `git stash`): `chat.vue(133)` unused `handleToggleSalienceGate`, `devtools/vision.vue(95,117)` `orchestrator.lastError` null + `.value` on string. Out of scope; flagged for follow-up. | 🟡 Pre-existing |
