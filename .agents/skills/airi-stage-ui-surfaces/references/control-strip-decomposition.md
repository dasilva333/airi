# Control Strip — As-Built Reference

`packages/stage-ui/src/components/scenarios/layout/ControlStrip.vue` is now a **455-line shell** (was 3,952 before decomposition) plus **13 popover components** and **9 shell composables**. One shared component, two modes (`mode: 'desktop' | 'mobile'`), mounted in desktop `WidgetStage` and at the web/pocket page roots.

> Line numbers are deliberately absent below. Cite symbols and files instead — the previous version of this reference rotted within a week because every anchor was a line range.

## 1. Topology

| Piece | Path |
|---|---|
| Shell | `components/scenarios/layout/ControlStrip.vue` |
| Popover chrome | `components/scenarios/layout/StripPopover.vue` |
| Popovers (13) | `components/scenarios/layout/popovers/*.vue` |
| Registry | `components/scenarios/layout/popovers/registry.ts` (`STRIP_POPOVER_COMPONENTS`) |
| Shared geometry panel | `components/scenarios/layout/popovers/components/WindowGeometryPanel.vue` |
| Presentation tables | `constants/control-strip-labels.ts` |
| Shell composables | `composables/use-control-strip-*.ts` (9 implementation files) |

## 2. What the shell still owns

`activePopover` · the `control-strip:popover-changed` watcher · the popover bounds container (`w-64 max-h-[440px]`, and the `w-[360px]` override for `actor-motion-playground`) · `onClickOutside` · `openPresetPopover` / `handleAction` / `handleRightClick` · the menu-button allowlist · the gunslinger watcher · the caption relay + selfie channel wiring.

These five must **not** move out:
1. `control-strip:popover-changed` — `apps/stage-tamagotchi/src/renderer/pages/index.vue` (`applyBoundsUpdate`) resizes the stage window to 324×500 / 500×500 synchronously off it. Never fire it from a lazily-mounted child, never make it async, never move it to Pinia.
2. `activePopover` itself — same reason.
3. `airi-caption-overlay` — exactly one watcher per app.
4. `airi:stage-capture` / `airi:stage-selfie-viewfinder` — one owner; the viewfinder reset on mount depends on it.
5. The `get-monitor-count` IPC — one call per session, in `use-control-strip-window-geometry`.

## 3. Composable contracts

| Composable | Owns | Takes | Returns |
|---|---|---|---|
| `action` | the dispatch table, `airi-control-strip-actions` broadcast, `control-strip:action` event | — | `dispatchAction(id, { skipBroadcast? })` |
| `buttons` | enabled-filter, desktop-only exclusion on mobile, workspace sandbox gate | `{ mode, buttons, isSandboxAllowed, powerState }` | `activeButtons` (`StripButton` = `id/label/icon/enabled`) |
| `button-presentation` | one descriptor per button | `{ buttons, context: () => ControlStripPresentationContext }` | `presentation` |
| `drag` | pointer/touch session, 4px threshold, Electron `control-strip:drag-start` vs web direct position, perpendicular click timer | `{ mode, collapsed, position, isElectron, toggleOrientation }` | `isDragging`, `onDragStart` (rest internal) |
| `geometry` | auto-hide mode, hover expand (400 ms), tab classes, placement, `stripLength` (52 + 44N), `containerStyle` | `{ mode, orientation, dockedEdge, collapsed, activePopover, activeButtons, backgroundTint, isElectron, position }` | `autoHideMode`, `isFullyExpanded`, handlers, `autoHideTabClasses`, `popoverPlacement`, `stripLength`, `containerStyle` |
| `selfie` | both stage-capture channels, 3 s countdown | `{ activeCardId, activePopover, selfieIncludeBg, getCharacterSelfies, updateCardBackground }` | `selfies`, `selfieCountdown`, `triggerSelfie`, `selectSelfieBackground` |
| `caption-relay` | the single `airi-caption-overlay` watcher, hoisted Stage-Mate sender, `installMateSpeechDevtoolsHook()` | `{ isElectron }` | — |
| `settings-route` | **the only** emitter of `control-strip:open-settings` (Electron → host window, web → router) | — | `openSettingsRoute(route)` |
| `window-geometry` | `get-monitor-count` IPC, alignment guard, `control-strip:apply-size-preset` | `{ onPresetApplied? }` | `monitorCount`, `activeMonitor`, `selectedAlignment`, `presetAlignment`, `applySizePreset`, `selectMonitor`, `applyAlignment` |

Placement constraints found the hard way: `geometry` must be called **after** `isElectron` and `position` are declared; `buttons` must be called **after** `powerState`; the presentation block sits next to `buttons` because it consumes `activeButtons`.

## 4. Popover contracts

- Ids: `stage-preset`, `chat-preset`, `gemini-voice`, `actor-characters`, `actor-avatars`, `actor-wardrobe`, `actor-motions`, `actor-motion-playground`, `actor-all-emotions`, `actor-vfx`, `actor-selfies`, `actor-macaron`, `stage-atmosphere`.
- **Self-serving**: a popover reads the stores it needs and emits `close`. It does not receive `open`, and it must not touch `activePopover`.
- 12 live in `STRIP_POPOVER_COMPONENTS`; `actor-selfies` is rendered explicitly with props, because the capture channel must stay single-owner in the shell. New popovers belong in the registry.
- `StripPopover` owns: `flex flex-col` body, `gap`/`headerPadding` props, the default header + close, and an optional `header` slot for popovers with counters/filters/conditional titles. The `w-64 max-h-[440px]` dimensions are on the **shell's** container, not here.
- `WindowGeometryPanel` renders monitor picker → default slot (the size picker) → 9-way alignment grid. The slot exists so both preset popovers keep the original control order; the `actor`/`chat` target arrives through emits, not a prop.

## 5. Presentation layer

`constants/control-strip-labels.ts` holds `resolveControlStripIcon / IconColor / Title / ShortLabel / Dot`, `CONTROL_STRIP_DOT_IDS`, and the option tables (window presets, macaron flavours, stock MMD motions, avatar palette hash). `useControlStripButtonPresentation` turns them into descriptors; the button row renders `btn.icon / btn.iconColor / btn.title / btn.shortLabel / btn.dot`.

Adding a button's visual state means editing the resolvers, not the template. The 21 inline `<span v-if="btn.id === …">` status-dot branches are gone.

## 6. Guards

- `ControlStrip.contract.test.ts` (18 tests) — registry↔router reachability, exactly one render per id, no id rendered by *both* registry and template, affordance ids ⊆ catalog, default buttons actionable, cross-window event/channel sets, no broadcast channel owned by a popover, caption single-owner rule, eager state-bootstrap ratchet (monotone shrink), dot-id guard.
- `use-control-strip-action.test.ts` (19) — dispatcher semantics.
- Five composable suites (18 tests).
- Two guards **self-retired** and `skipIf` themselves: the label-parity test (the component no longer defines the original functions; parity was proven over 792k comparisons first) and the template dot-id guard (no inline badges left). They are deliberately inert, not forgotten.

Run: `pnpm -F @proj-airi/stage-ui test run src/components/scenarios/layout src/composables/use-control-strip`. Mutation-check any new guard (dropped router entry / orphan branch / typo'd id / duplicate branch) — a guard that cannot fail is noise.

## 7. Lazy loading (decision: deferred)

`defineAsyncComponent` for popovers is **not** planned. Measured: the strip's static graph adds only ~26 KB of source that the rest of the stage graph does not already reach, and the expensive stores already defer structurally because each popover owns them. The remaining mount-time bootstraps are all first-paint state. Revisit only if a startup-cost regression appears — then audit the bootstrap list, not the async boundary.

## 8. Traps

- **Do not bump `BUTTONS_CATALOG_VERSION`** (currently `v5`): it wipes every user's arrangement. Accepted stored versions: desktop `v4|v5`, mobile `v4-mobile|v5-mobile`. The keyed merge appends new defaults safely.
- `buttons` stays on plain `useLocalStorage`; `ManualReset` drops array replacements in multi-window Electron.
- Popover-local state resets on close **by design**: macaron tab, motions filter, character search/page, and `cardSyncFilter` (re-seeded from live sync state). `avatarApplyMode` is the exception — persisted under `settings/control-strip/avatar-apply-mode`.
- `extensions.airi…` optionals remain inconsistent in places; use `?.` when touching card paths.
- HMR remount resets `activePopover` and any popover-local state — expected.
- `runtime.test.ts` asserts source text on `ControlStripHost.vue`, not the strip.

## 9. Manual verification (not covered by tests)

Desktop pill on each docked edge · popover placement on all four sides · the window resize when a popover opens · notch click-through · stage-web landscape · pocket portrait · the opposite-edge chatbox rule.
