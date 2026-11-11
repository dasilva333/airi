---
name: airi-desktop-system-tray
description: >-
  Configure/debug desktop system tray and menu bar: Tray instance lifecycle,
  macOS template images, native context menu, locale sync, platform click
  handlers, and window coordination. Tray popover design uses docs/design-desktop-tray-popover-menu.md.
---

# AIRI Desktop System Tray & Menu Bar

This skill provides domain procedures, source anchors, platform-specific mechanics, and failure modes for AIRI's desktop system tray and status bar integration in Electron (`apps/stage-tamagotchi`).

## 1. Overview & Surface Map

The desktop system tray lives in the Electron main process:
- **Tray Initialization & Lifecycle**: `apps/stage-tamagotchi/src/main/tray/index.ts` owns the `Tray` instance, icon asset selection, context menu construction, and app lifecycle hooks (`onAppBeforeQuit`).
- **Composition Root Injection**: `apps/stage-tamagotchi/src/main/index.ts` declares `app:tray` via `injeca.provide`, injecting dependencies (`mainWindow`, `settingsWindow`, `onboardingWindow`, `captionWindow`, `widgetsWindow`, `beatSyncBgWindow`, `aboutWindow`, `chatWindow`, `stageWindow`, `customizerWindow`, `serverChannel`, `i18n`, `appConfig`).
- **Tray & Dock Icon Visibility**: `apps/stage-tamagotchi/src/main/windows/shared/app-icon.ts` provides `AppIconVisibility`, synchronizing the user's `hideAppIcon` preference with the macOS Dock (`app.dock.hide()`) and Windows taskbar (`window.setSkipTaskbar(true)`).
- **Icons Assets**:
  - `apps/stage-tamagotchi/resources/tray-icon-macos.png`: 16×16 monochrome alpha template image for macOS menu bar.
  - `apps/stage-tamagotchi/resources/icon.png`: Standard AIRI icon for Windows and Linux notification areas.

---

## 2. Authoritative Source Anchors

| Component / Function | File Path | Responsibility |
| --- | --- | --- |
| `setupTray` / `setupTrayOnce` | `apps/stage-tamagotchi/src/main/tray/index.ts` | Creates `Tray`, builds native context menu, binds lifecycle and click events |
| `injeca.provide('app:tray')` | `apps/stage-tamagotchi/src/main/index.ts` | Injects all window managers and services into the tray builder |
| `AppIconVisibility` | `apps/stage-tamagotchi/src/main/windows/shared/app-icon.ts` | Controls Dock/Taskbar presence when tray-only mode is active |
| `toggleWindowShow` | `apps/stage-tamagotchi/src/main/windows/shared/window.ts` | Safe window show/hide toggling with `isDestroyed()` verification |
| `electronAppIconGet` / `electronAppIconSet` | `apps/stage-tamagotchi/src/shared/eventa.ts` | Eventa IPC contracts for querying and updating app icon visibility |

---

## 3. Tray Mechanics & Runtime Setup

### 3.1 Icon Resolution & macOS Template Images
```typescript
const trayImage = nativeImage
  .createFromPath(isMacOS ? macOSTrayIcon : icon)
  .resize({ width: 16 })
trayImage.setTemplateImage(isMacOS)
```
- **macOS Template Mode**: `trayImage.setTemplateImage(true)` tells macOS Cocoa to treat the image as a monochrome template. macOS automatically tints the icon to white or black based on system dark mode and menu bar translucency.
- **Windows / Linux**: Standard color icon resized to 16×16.

### 3.2 Native Context Menu Construction
The native menu is constructed using Electron's `Menu.buildFromTemplate([...])` and attached to the tray via `appTray.setContextMenu(contextMenu)`:
- **Toggle Chat**: Asynchronously calls `params.chatWindow?.openChat()`.
- **Toggle Character Stage**: Resolves live stage window via `ActorStageWindowManager.getExistingWindow()` or lazily instantiates via `manager.ensureWindow()`.
- **Reset Window Positions**: Emits main-process IPC event `reset-window-positions-action`.
- **Control Strip Settings**: Opens floating customizer window via `params.customizerWindow.toggleVisibility()`.
- **Companion Wizard**: Launches Onboarding V3 via `params.onboardingWindow.openWindow('/onboarding-v3')`.
- **AnimaDex Wizard**: Opens guided card setup via `params.settingsWindow.openWindow('/settings/airi-card/guided')`.
- **Settings**: Opens main settings page via `params.settingsWindow.openWindow('/settings')`.
- **About**: Opens the about dialog window via `params.aboutWindow()`.
- **Toggle Developer Tools**: Toggles detached DevTools on `mainWindow.webContents`.
- **Quit**: Calls `app.quit()`.

### 3.3 Reactive Locale Synchronization
Menu strings are internationalized using `params.i18n.t(...)`. To ensure menu labels update immediately when language changes in settings:
```typescript
const rebuildContextMenu = debounce((): void => {
  if (!appTray || appTray.isDestroyed() || !params.mainWindow || params.mainWindow.isDestroyed())
    return
  // ... Menu.buildFromTemplate(...) ...
  appTray.setContextMenu(contextMenu)
}, 50)

effect(() => {
  const locale = params.i18n.locale as (() => string | undefined)
  locale()
  rebuildContextMenu()
})
```
- Wrapped in an `alien-signals` `effect(...)` watching `params.i18n.locale`.
- Debounced by 50ms using `es-toolkit` to avoid rapid churn.

### 3.4 Platform Click Event Differences
- **macOS**:
  - Left-click is intercepted by the native `NSMenu` bound via `setContextMenu(contextMenu)`.
  - Double-click listener brings `mainWindow` to front:
    ```typescript
    if (isMacOS) {
      appTray.addListener('double-click', () => {
        params.mainWindow.show()
        params.mainWindow.focus()
      })
    }
    ```
- **Windows / Linux**:
  - Single left-click brings `mainWindow` to front:
    ```typescript
    if (!isMacOS) {
      appTray.addListener('click', () => {
        params.mainWindow.show()
        params.mainWindow.focus()
      })
    }
    ```
  - Right-click natively opens the context menu bound by `setContextMenu`.

---

## 4. Known Pitfalls & Failure Modes

1. **macOS `setContextMenu` Left-Click Hijacking**:
   - Calling `appTray.setContextMenu(menu)` on macOS delegates single left-clicks directly to AppKit to show the native menu. The `'click'` event does NOT fire reliably on macOS when a context menu is attached.
   - For custom popover windows (see `docs/design-desktop-tray-popover-menu.md`), `setContextMenu` must NOT be called on macOS. Instead, listen to `'click'` for the custom window and `'right-click'` for the native `Menu.popup({ window })`.

2. **Destroyed Window & Tray References**:
   - Calling methods on an Electron `Tray` or `BrowserWindow` after app quit crashes the process with `Object has been destroyed`.
   - Always guard with `!appTray.isDestroyed()` and `!win.isDestroyed()`.
   - Cancel debounced menu rebuilds on quit:
     ```typescript
     onAppBeforeQuit(() => {
       rebuildContextMenu.cancel()
       appTray.destroy()
     })
     ```

3. **Template Image Contrast Bugs**:
   - Omitting `setTemplateImage(true)` on macOS causes the tray icon to remain dark on dark menu bars, rendering it invisible.

4. **Taskbar Restoration on Windows**:
   - Hiding the app icon on Windows requires setting `setSkipTaskbar(true)` on every created window. `AppIconVisibility` listens to `app.on('browser-window-created')` to enforce this dynamically.

---

## 5. Verification Workflows

- **Typecheck Main Process**:
  ```bash
  pnpm -F @proj-airi/stage-tamagotchi run typecheck:node
  ```
- **Full Tamagotchi Typecheck**:
  ```bash
  pnpm -F @proj-airi/stage-tamagotchi typecheck
  ```
- **Manual Tray Verification**:
  1. Launch desktop app (`pnpm -F @proj-airi/stage-tamagotchi dev`).
  2. Verify tray icon appears in macOS menu bar / Windows taskbar notification area.
  3. Verify clicking all items (Toggle Chat, Toggle Stage, Settings, Wizards) successfully toggles or focuses target windows without throwing errors in console.
  4. Change application language in Settings and verify tray menu labels update reactively.
  5. Quit via tray menu and ensure clean process exit without unhandled rejection crashes.
