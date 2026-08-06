# Specification: Phase 5 Upstream Migration Compatibility, Credential Validation & Defensive Failure Recovery

**Status:** Active Architectural Spec & Handoff Plan
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

- **Fork Desynchronization Points**:
  1. **Storage Projection Fallback (`{}` vs `undefined`)**:
     In [`instance-store.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/providers/runtime/instance-store.ts#L193-L204), `providerCredentials.value` uses a computed getter to map `instancesByInstanceKey` to primary options. When a provider has no saved options, the fallback returns `{}` (an empty object):
     ```typescript
     out[providerId] = snap.instancesByInstanceKey[primaryKey]?.options
       ?? (row.isPrimary ? row.options : undefined)
       ?? {} // <-- Causes truthy fallback
     ```
     In [`instances.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/providers/runtime/instances.ts#L58-L64), `getProviderInstance` evaluates `let config = deps.getProviderCredentials()[providerId]`. Because `{}` is truthy, `if (!config)` fails to trigger, and `metadata.createProvider({})` is called with an empty object.

  2. **Upstream Migration Gap in `isProviderConfigured`**:
     `upstream/main` stores single-slot credentials directly as `{ "openrouter-ai": { "apiKey": "..." } }`. In Phase 3, `isProviderConfigured()` was changed to a generic check (`JSON.stringify(config) !== JSON.stringify(defaultOptions)`).
     Because cloud providers (such as `openrouter-ai`) define a default `baseUrl` in their Zod schema, unconfigured or partially migrated storage records evaluate to `true` for `isProviderConfigured`, causing the app to send unauthenticated HTTP requests upstream without a `Bearer <key>` header.

---

## 2. Core Objectives of Phase 5

1. **Seamless Upstream Migration (`migrateUpstreamStorage`)**:
   Safely transform legacy `upstream/main` unversioned storage (`settings/credentials/providers`) into version 2 multi-instance format while discarding empty credential stubs.
2. **Defensive Credential Validation (`requiresCredentials` Gating)**:
   Ensure `isProviderConfigured(providerId)` and `getProviderInstance(providerId)` strictly enforce credential presence (`apiKey` or `accessKeyId`/`secretAccessKey`) for cloud providers before attempting network calls.
3. **Client-Side Failure Prevention**:
   Trap missing key configurations at the client layer and surface friendly UI guidance (or trigger the model configuration modal) rather than making invalid network calls that emit raw 401 server errors.

---

## 3. Detailed Component Plan

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
