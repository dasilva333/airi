# Control Strip Decomposition Reference

Shell + popovers topology for `packages/stage-ui/src/components/scenarios/layout/ControlStrip.vue` (~3,950 lines at Motion Studio landing). The strip is one shared component (`mode: 'desktop' | 'mobile'`) mounted in desktop `WidgetStage` and at web/pocket page roots.

## 1. Topology

- Shell: `ControlStrip.vue` — pill, drag, geometry, button loop, `activePopover` state, 13 inline `v-if` popover branches (target: ~250-350 lines).
- Shell composables (additive, unwired until cutover): `packages/stage-ui/src/composables/use-control-strip-{drag,geometry,selfie,caption-relay,buttons}.ts`
- Additive tables (parallel agent): `constants/control-strip-labels.ts` + `composables/use-control-strip-button-presentation.ts`
- Popovers (extraction owner does all 11-13 atomically): `components/scenarios/layout/popovers/*.vue` + shared `StripPopover.vue` chrome + `index.ts` registry
- Guards: `components/scenarios/layout/ControlStrip.contract.test.ts` (16 contract tests) + `composables/use-control-strip-action.test.ts` (19 dispatcher tests)

## 2. Shell composable contracts

| Composable | Owns | Takes in | Must not own |
|---|---|---|---|
| `use-control-strip-drag` | `isDragging`, `onDragStart/onDragging/onDragEnd`, perpendicular single/double-click timer, Electron `control-strip:drag-start` vs web direct-position branch | `{ mode, collapsed, position, isElectron, toggleOrientation }` | `position` storage key (caller owns `useLocalStorageManualReset`) |
| `use-control-strip-geometry` | `autoHideMode`, `isFullyExpanded`, hover timers (400ms), `autoHideTabClasses`, `popoverPlacement`, `stripLength` (52 + 44N), `containerStyle` | `{ mode, orientation, dockedEdge, collapsed, activePopover, activeButtons, backgroundTint, isElectron, position }` | window-bounds writes |
| `use-control-strip-selfie` | `airi:stage-capture` + `airi:stage-selfie-viewfinder` channels, 3s countdown, `triggerSelfie` | `{ activeCardId, activePopover, selfieIncludeBg, getCharacterSelfies, updateCardBackground }` | card-store shape |
| `use-control-strip-caption-relay` | single-owner `airi-caption-overlay` watcher, hoisted Stage-Mate `sendCaption` handle, `installMateSpeechDevtoolsHook()` | `{ isElectron }` | any second watcher |
| `use-control-strip-buttons` | `activeButtons` filter (`desktopOnly` on mobile, `workspace` sandbox gate) + `geminiDotClasses` | `{ mode, buttons, isSandboxAllowed, powerState }` | icon/title/label chains (P1/A owns) |

## 3. Popover contracts

- 13 ids: `stage-preset`, `chat-preset`, `gemini-voice`, `actor-characters`, `actor-avatars`, `actor-wardrobe`, `actor-motions`, `actor-motion-playground` (Motion Studio, widest + container-width override), `actor-all-emotions`, `actor-vfx`, `actor-selfies`, `actor-macaron`, `stage-atmosphere`.
- `activePopover: string | null` stays in the shell. Each popover receives `open` / `@close`; only the shell fires `control-strip:popover-changed`, `control-strip:apply-size-preset`, `control-strip:open-settings`.
- `popover-changed` is synchronous with the click: `apps/stage-tamagotchi/src/renderer/pages/index.vue:applyBoundsUpdate` resizes to 324x500 / 500x500 off it. Never fire from a lazily-mounted child, never make it async, never move to Pinia.
- `StripPopover.vue` chrome owns: `w-64 max-h-[440px]` skeleton dims (prevents bounds thrash), `Transition`, header + close, `@close` -> `activePopover = null`.
- Each popover owns its stores/refs; collapse the duplicated 9-way alignment grid into one `WindowGeometryPanel.vue` (`target: 'actor' | 'chat'`).
- Motion Studio rule: new popovers are born as components, never inline. Its `h()` SVG builders live in the component file at minimum.

## 4. Lazy-load rules

- `defineAsyncComponent({ loader, loadingComponent: StripPopoverSkeleton, delay: 0 })` only with P3 registry + lazy `dispatchAction` split; otherwise the flash is unpaid.
- Prefetch on button `mouseenter` + `requestIdleCallback` for default-on buttons.
- Stores defer only when the popover owns the import; shell-level `useControlStripAction()` still wakes 6+ stores at mount until the dispatcher is split — async components alone defer nothing (~26 KB strip-exclusive source per module-graph count; the win is store deferral, not bytes).
- Never `<Suspense>`, never `v-show` for popovers (Transition + Electron bounds depend on mount/unmount).

## 5. Cross-window ownership

- `airi-caption-overlay`: exactly one watcher per app lifetime. During migration the shell watcher and `useControlStripCaptionRelay` must not coexist — the contract guard fails on dual textual ownership.
- Shell-only events with no composable counterpart: `control-strip:popover-changed`, `control-strip:apply-size-preset`, `control-strip:open-settings`. Pinned by contract test.
- Channel/event scan surface is `layout/**.vue` + `composables/use-control-strip-*.ts` so moving code doesn't trip the guard.

## 6. Traps

- Do NOT bump `BUTTONS_CATALOG_VERSION` (wipes user layouts); keyed merge picks up new buttons.
- `buttons` stays on plain `useLocalStorage`; `ManualReset` drops array replacements in multi-window Electron.
- `useLocalStorageManualReset` position key has one owner; drag takes `position` as a param.
- `extensions.airi.…` optionals are inconsistent in the shell; use `?.` when touching card paths.
- HMR remount drops `activePopover`, selfie countdown, macaron picks — expected, not a bug to chase here.
- `runtime.test.ts` asserts source text on `ControlStripHost.vue` only; unaffected.

## 7. Verification

- `pnpm -F @proj-airi/stage-ui typecheck` after every phase.
- Contract + dispatcher suites green (35 tests); mutation-check new guards against dropped-router-entry / orphan-branch / typo'd-badge / duplicate-branch synthetics.
- P4/P6 need a manual pass: desktop pill on each edge, popover placement, window resize, stage-web landscape, pocket portrait; notch click-through; opposite-edge chatbox rule.
