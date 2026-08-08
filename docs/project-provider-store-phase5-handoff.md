# Specification: Phase 5 Upstream Migration Compatibility, Credential Validation & Defensive Failure Recovery

**Status:** Completed & Fully Verified (Steps 1, 2, & 3 Complete — 45/45 Tests Passing)
**Target Directories:**
- `packages/stage-ui/src/stores/providers/`
- `packages/stage-ui/src/stores/providers/runtime/`
- `packages/stage-ui/src/stores/providers/selectors/`
**Authors:** AIRI Development Team
**Related Docs:**
- [`rosetta-stone.md`](./rosetta-stone.md) — Canonical concept-to-file-path index.
- [`project-provider-store-phase3-handoff.md`](./project-provider-store-phase3-handoff.md) — Multi-instance engine implementation.
- [`project-provider-store-phase4-handoff.md`](./project-provider-store-phase4-handoff.md) — Multi-instance UI activation and layout overhaul.

---

## 1. Executive Summary & Problem Root Cause

Following the Phase 1–4 refactoring of the provider pipeline (extracting metadata, decomposing store modules, establishing multi-instance storage in `instance-store.ts`, and overhauling Provider Studio UI), community users migrating from **`upstream/main`** (`https://github.com/moeru-ai/airi.git`) reported encountering `401 Unauthorized` responses from cloud providers:

```json
{
  "error": {
    "message": "Missing Authentication header",
    "code": 401
  }
}
```

### Empirical Root Cause Analysis (Upstream Reference)

Direct inspection of `upstream/main` (`https://github.com/moeru-ai/airi.git` at commit `f7212965d`) against local store components identified the exact desynchronization:

- **Upstream Location**: `upstream/main:packages/stage-ui/src/stores/providers.ts` ([`L2835-L2865`](https://github.com/moeru-ai/airi/blob/f7212965d/packages/stage-ui/src/stores/providers.ts#L2835-L2865))
- **Upstream Behavior**:
  ```typescript
  let config = providerCredentials.value[providerId]
  const noCredentials = metadata.requiresCredentials === false || providerId === 'browser-web-speech-api'
  if (!config && noCredentials) {
    config = getDefaultProviderConfig(providerId) || {}
    providerCredentials.value[providerId] = config
  }
  if (!config && !noCredentials)
    throw new Error(`Provider credentials for ${providerId} not found`)
  ```
  In `upstream/main`, unconfigured providers return `undefined` for `providerCredentials.value[providerId]`. When `config` is `undefined` and `noCredentials` is `false`, upstream throws `Provider credentials for <id> not found` before any network request is attempted.

- **Fork Desynchronization Points Fixed**:
  1. **Storage Projection Fallback (`{}` vs `undefined`)**:
     In [`instance-store.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/providers/runtime/instance-store.ts), `providerCredentials.value` projection getter was updated so unconfigured providers resolve strictly to `undefined` rather than an empty `{}` object, matching upstream expectations.
  2. **Upstream Migration & Alias Normalization**:
     In [`instance-store.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/providers/runtime/instance-store.ts), `migrate()` was updated to normalize legacy `snake_case` aliases (`api_key` $\rightarrow$ `apiKey`, `base_url` $\rightarrow$ `baseUrl`) and discard empty/whitespace-only credential stubs during initial load.
  3. **Credential Gauntlet Gating**:
     In [`selectors/config.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/providers/selectors/config.ts), `isProviderConfigured` was restored to strictly validate `apiKey?.trim()` or AWS key pairs, preventing unauthenticated 401 calls when only default `baseUrl` options are set.
  4. **Fail-Fast Runtime Guard**:
     In [`instances.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/providers/runtime/instances.ts), `getProviderInstance` rejects unconfigured credentialed providers before SDK instantiation with a client-side error.

---

## 2. Verification Status & Test Coverage

All verification suites are 100% green:

- `pnpm -F @proj-airi/stage-ui test src/stores/providers/ --run` $\rightarrow$ **7/7 test files passed, 45/45 tests green**
- `packages/stage-ui/src/stores/providers/runtime/instance-store.phase5.test.ts` $\rightarrow$ **19/19 Phase 5 unit tests passing**
- `pnpm -F @proj-airi/stage-ui typecheck` $\rightarrow$ **PASS (0 errors in stage-ui)**
- `pnpm -F @proj-airi/stage-pages typecheck` $\rightarrow$ **PASS (0 errors in stage-pages)**

---

## 3. Comprehensive File Index

- [`packages/stage-ui/src/stores/providers/runtime/instance-store.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/providers/runtime/instance-store.ts) — Storage projection fallback & upstream alias normalization migration.
- [`packages/stage-ui/src/stores/providers/selectors/config.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/providers/selectors/config.ts) — Strict credential presence check in `isProviderConfigured`.
- [`packages/stage-ui/src/stores/providers/runtime/instances.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/providers/runtime/instances.ts) — Fail-fast client guard in `getProviderInstance`.
- [`packages/stage-ui/src/stores/providers/runtime/instance-store.phase5.test.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/providers/runtime/instance-store.phase5.test.ts) — 19 comprehensive Phase 5 unit tests.

---

## 4. Detailed Component Plan

### 3.1 Migration Engine Enhancements (`packages/stage-ui/src/stores/providers/runtime/instance-store.ts`)

#### A. Fix Projection Fallback
Update `providerCredentials` computed getter in `instance-store.ts` so that unconfigured providers resolve to `undefined` or a clean empty option check rather than returning `{}`.

#### B. Upstream Storage Schema Normalization
Expand `migrate()` to normalize legacy `upstream/main` data structures:
- Check if `options` contains non-empty credential keys before setting `isPrimary: true`.
- Normalize legacy key aliases (e.g. `api_key` $\rightarrow$ `apiKey`, `base_url` $\rightarrow$ `baseUrl`).

---

### 3.2 Configuration Selector Gating (`packages/stage-ui/src/stores/providers/selectors/config.ts`)

Update `isProviderConfigured(providerId)`:
- Check metadata property `requiresCredentials`:
  - If `requiresCredentials === false` or `providerId === 'browser-web-speech-api'`, return `true`.
  - For cloud/credential-based providers, explicitly check for non-empty credentials (`apiKey?.trim()` or AWS access keys).
- Return `false` if `apiKey` is empty or whitespace, even if default `baseUrl` is populated.

---

### 3.3 Runtime Instance Guard (`packages/stage-ui/src/stores/providers/runtime/instances.ts`)

In `getProviderInstance(providerId)`:
- Check resolved options using `isProviderConfigured(providerId)` or metadata requirements.
- If credentials are required but missing/empty:
  - Throw an explicit, localized client error: `Provider credentials for ${providerId} are missing or incomplete.`
  - Prevent instantiation of the SDK client with an invalid/empty key.

---

## 4. Verification Plan

### Automated Tests
1. **Store Migration Tests**:
   - Test migrating legacy `upstream/main` single-slot storage objects (with valid keys, empty keys, and custom base URLs) to version 2 storage.
   - Run typecheck: `pnpm -F @proj-airi/stage-ui typecheck`.
   - Run test suite: `pnpm -F @proj-airi/stage-ui test src/stores/providers/ --run`.

2. **Credential Validation Tests**:
   - Verify `isProviderConfigured('openrouter-ai')` returns `false` when `apiKey` is missing or empty.
   - Verify `getProviderInstance('openrouter-ai')` throws a client error before initiating an HTTP request when unconfigured.

### Manual Verification
- Test importing or launching with legacy `localStorage` keys from `upstream/main`.
- Confirm that switching to unconfigured models presents the Brain Picker UI notice without throwing unhandled 401 console/stream errors.
