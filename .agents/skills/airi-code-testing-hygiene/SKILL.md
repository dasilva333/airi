---
name: airi-code-testing-hygiene
description: >-
  Enforce TypeScript reactive-safety, deep-module cohesion, fallback precedence, Vitest root-cause reproduction, import boundary integrity, and Vue/Pinia testing invariants across the AIRI monorepo.
---

# AIRI Code & Testing Hygiene

This skill enforces strict engineering discipline across TypeScript implementation, Vue reactive safety, and Vitest test authoring. It prevents the common anti-patterns, reactive memory traps, and superficial testing hacks that degrade large monorepos over time.

---

## 1. Reactive Reference Safety (The Vue 3 Fallback Trap)

> [!CAUTION]
> **Never use inline object or array fallbacks in reactive contexts.**
> Expressions such as `value ?? {}`, `value ?? []`, `value || {}`, and `value || []` allocate a **new object reference** every time they execute.

- **The Failure Mode**: Placing `props.options ?? {}` or `store.items ?? []` inside a `computed()` getter, a `watch()` source, or a Pinia state projection causes Vue's reactivity system to detect a new reference on every evaluation. This triggers:
  1. Infinite watcher recursion loops.
  2. Component re-render thrashing.
  3. Continuous BroadcastChannel / Eventa IPC serialization storms across Electron windows.
- **The Invariant**: If an empty fallback is needed in a reactive context, reuse a **stable, module-level frozen constant**:

```ts
// ❌ WRONG: Creates a new array reference on every tick
const activeItems = computed(() => store.items ?? [])

// ✅ CORRECT: Reuses a stable, immutable reference
const EMPTY_ITEMS = Object.freeze([])
const activeItems = computed(() => store.items ?? EMPTY_ITEMS)
```

---

## 2. Deep Module Cohesion (Anti-Shallow Module Rule)

- **Avoid Shallow File Shuffling**: Resist the urge to fragment a cohesive 200–400 line domain flow into 5 tiny 15-line "pass-through" helper files that merely forward context to each other.
- **Meaningful Boundaries Only**: A module or helper boundary must encapsulate a meaningful decision:
  - Policy or business logic
  - Persistence boundary (unstorage / localforage)
  - Protocol or schema contract (`eventa`, `xsai`, Valibot)
  - Scheduling / timing semantics
  - Domain invariants or lifecycle management
- **No Pass-Through Wrappers**: Never create glue abstractions like `createXService({ yService })` when `X` adds zero policy, validation, state, or error handling. Keep local helpers private or inline them.

---

## 3. Fallback & Precedence Rigor

- **Explicit Operators**:
  - Use `??` **only** when `null` and `undefined` indicate a missing value (preserving valid falsy values like `0`, `""`, and `false`).
  - Use `||` **only** when falsy values (`0`, `""`, `false`) must genuinely trigger the fallback.
- **No Nested Ternaries for Complex Chains**: If a fallback chain exceeds two sources (e.g. user override → card extension → system default), use named intermediate variables or explicit `if / else if` blocks so each fallback branch can be clearly commented.

---

## 4. Root-Cause Bug Reproduction Protocol

Before modifying production code to resolve a bug or regression:

1. **Write a Failing Test First**: Create a minimal reproduction test in the owning package. Name the test with the issue or tracking identifier (e.g. `it('reproduces Issue #2686: main process i18n fallback', ...)`).
2. **Mandatory Root-Cause Comment**: Place a structured `// ROOT CAUSE:` comment block directly above the reproduction test explaining the exact mechanism:

```ts
// ROOT CAUSE:
//
// If translated locales omit keys, @intlify/core-base defaults
// fallbackLocale to the current locale itself instead of 'en'.
// This caused missing strings to render raw key paths in the tray menu.
//
// BEFORE: createI18n({ messages, locale })
//
// FIXED BY: Passing fallbackLocale: 'en' explicitly to createI18n.
```

3. **Verify Red-First**: Confirm that the test fails for the exact reported reason *before* touching application source files.

---

## 5. Import Boundary Integrity ("Fix Boundaries, Not Tests")

> [!IMPORTANT]
> **Never conceal import errors with test-only hacks.**
> Do not use `as unknown as`, dynamic `await import()`, Vitest hoisting tricks, or test-only alternate paths to bypass a module import failure.

If a test cannot import a module cleanly, investigate and fix the real production architectural defect:
- Circular dependencies between files
- Missing exports in `package.json` (`exports` map)
- Mixed Node.js and browser runtime dependencies
- Side effects executed at import time
- Misplaced type declarations

Keep the test consuming the exact same public boundary that production runtime code uses.

---

## 6. Vue & Pinia Testing & Reactivity Invariants

- **Never Mock Pinia or Core Stores**: Unit tests should instantiate a real Pinia root (`setActivePinia(createPinia())`) and test public store actions and computed properties. Do not stub or mock internal store implementations.
- **Async Reactivity Settling**: AIRI test suites run headlessly without `@vue/test-utils`. To settle reactive effects, watchers, and asynchronous store queues:
  ```ts
  import { nextTick } from 'vue'

  // Settle synchronous DOM / reactive watcher ticks:
  await nextTick()

  // Drain microtask queues / resolved promises:
  await Promise.resolve()

  // Advance simulated clocks in timer-dependent tests:
  vi.advanceTimersByTime(500)
  ```
- **`shallowRef` for Heavy Opaque Instances**: Never wrap Three.js `Scene`/`Object3D`, Pixi `Application`, VRM avatars, or WebGPU device instances in standard `ref()` or `reactive()`. Deep reactive proxy traversal over massive external object graphs causes severe frame drops and proxy traps. Always use `shallowRef()`.
- **Store Destructuring Trap**: Never destructure properties directly from a Pinia store (`const { activeCard } = useAiriCardStore()`), which strips reactivity. Access properties directly on the store (`store.activeCard`) or wrap with `storeToRefs()`.
- **Mocking Platform Boundaries**: Never require a real Electron runtime in unit tests. Mock Electron IPC (`ipcRenderer`, `ipcMain`) and native OS services using `vi.fn()` or `vi.mock()`.
- **Runner boundary (node default, browser opt-in)**: Suites run headless node by default (`docs/project-testing-parity.md`). Only `packages/audio-pipelines-transcribe/vitest.config.ts` provisions a `browser` project (`**/*.browser.{spec,test}.ts` on Playwright Chromium; zero such files exist today). Real CSS, `getBoundingClientRect` geometry, or resize-observer claims belong in a `*.browser.test.ts` under a package with that project configured — never in JSDOM mocks. No Playwright E2E harness exists in this fork.

---

## 7. Vue SFC Hygiene

- **SFC order**: `<script setup lang="ts">` → `<template>` → `<style>`. Keep templates declarative; no DOM math in templates.
- **Split triggers**: extract when orchestration mixes with presentational markup, a view exceeds ~3 UI sections, or blocks repeat. Routes/views stay thin composition surfaces.
- **Typed contracts**: `defineProps<T>()` / `defineEmits<E>()`; `provide/inject` for deep drilling only; reuse and side effects go in composables. Component selection, class arrays, and theming stay in `airi-ui-design-conventions`.
- **Lifecycle hook registration**: Register `onUnmounted()` (and other lifecycle hooks) synchronously at the top level of `setup()` before any `await` — never inside `onMounted()`, `watch()`, or async callbacks, where `getCurrentInstance()` is `null` and cleanup silently fails to register. In Pinia stores or shared composables that may be initialized outside `setup()`, guard with `if (getCurrentInstance()) onUnmounted(...)` or use `onScopeDispose()`.
