# Admin Upstream Model Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let administrators fetch and select OpenAI-compatible upstream model IDs without exposing API keys to the browser.

**Architecture:** Extend the existing admin router-config service with model discovery. It uses a submitted API key or decrypts a selected stored key, requests `<baseURL>/models`, and returns safe model IDs. The existing web admin API maps the route, while the Vue form adds an editable datalist and compact fetch button.

**Tech Stack:** Hono, Valibot, Node fetch, envelope crypto, Vue 3, Vue I18n, Vitest.

---

### Task 1: Implement model discovery in the router-config service

**Files:**
- Modify: `apps/server/src/services/domain/admin/router-config/index.ts`
- Modify: `apps/server/src/services/domain/admin/router-config/tests/admin-router-config.test.ts`

- [x] **Step 1: Add failing plaintext-key discovery coverage**

```ts
const result = await service.discoverModels({
  providerKind: 'openai-compatible',
  baseURL: 'https://gateway.example/v1',
  plaintextKey: 'sk-new',
})

expect(result).toEqual({ models: ['gpt-5-mini', 'gpt-5-pro'] })
expect(fetch).toHaveBeenCalledWith(
  'https://gateway.example/v1/models',
  expect.objectContaining({ headers: { authorization: 'Bearer sk-new' } }),
)
```

- [x] **Step 2: Run the focused test and confirm it fails**

```powershell
& 'D:\\Tools\\airi\\.node24.local\\node-v24.13.0-win-x64\\node.exe' .\\node_modules\\vitest\\vitest.mjs run apps/server/src/services/domain/admin/router-config/tests/admin-router-config.test.ts
```

Expected: a missing `discoverModels` member.

- [x] **Step 3: Add the minimal service contract and behavior**

```ts
export interface ModelDiscoveryInput {
  providerKind: 'openai-compatible' | 'openrouter'
  baseURL: string
  plaintextKey?: string
  configuredModelName?: string
  existingKeyEntryId?: string
}

export interface ModelDiscoveryResult {
  models: string[]
}
```

Validate a credential-free `http:` or `https:` URL, append `models`, and fetch with a 10-second timeout and Bearer authorization. Use `plaintextKey` first; otherwise find the upstream key under `LLM_ROUTER_CONFIG.llm.models[configuredModelName]` and decrypt it with the original model name and key entry ID. Reject >1 MiB responses, non-2xx responses, malformed JSON, empty IDs, and missing key inputs using stable `ApiError` values without upstream body text or secret values. Return trimmed, deduplicated, sorted `data[*].id` entries.

- [x] **Step 4: Add failing saved-key, invalid-URL, upstream-error, and deduplication tests**

For the saved-key case, seed encrypted config, omit `plaintextKey`, and assert the upstream sees the decrypted Bearer key. Add each test before its implementation branch and re-run the command above until the file is green.

- [x] **Step 5: Commit Task 1**

```powershell
git add apps/server/src/services/domain/admin/router-config/index.ts apps/server/src/services/domain/admin/router-config/tests/admin-router-config.test.ts
git commit -m "feat(server): discover upstream models"
```

### Task 2: Expose the validated admin endpoint

**Files:**
- Modify: `apps/server/src/routes/admin/config/router/index.ts`
- Modify: `apps/server/src/routes/admin/config/router/route.test.ts`

- [x] **Step 1: Add a failing route test**

```ts
const response = await app.request('/api/admin/config/router/models', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    providerKind: 'openai-compatible',
    baseURL: 'https://gateway.example/v1',
    plaintextKey: 'sk-test',
  }),
})

expect(response.status).toBe(200)
expect(await response.json()).toEqual({ models: ['gpt-5-mini'] })
```

The fake service must assert it receives only the validated input; include an invalid-body 400 test.

- [x] **Step 2: Run the focused route test and confirm it fails**

```powershell
& 'D:\\Tools\\airi\\.node24.local\\node-v24.13.0-win-x64\\node.exe' .\\node_modules\\vitest\\vitest.mjs run apps/server/src/routes/admin/config/router/route.test.ts
```

Expected: the new route is absent.

- [x] **Step 3: Add the route before the existing router-config POST**

```ts
.post('/models', async (c) => {
  const raw = await c.req.json().catch(() => null)
  const parsed = safeParse(ModelDiscoveryBodySchema, raw)
  if (!parsed.success)
    throw createBadRequestError('Invalid request body', 'INVALID_BODY', parsed.issues)
  return c.json(await service.discoverModels(parsed.output))
})
```

Use bounded Valibot strings for provider kind, Base URL, plaintext key, configured model name, and existing key entry ID. Existing auth and admin guards cover this route.

- [x] **Step 4: Re-run route tests, then commit Task 2**

```powershell
git add apps/server/src/routes/admin/config/router/index.ts apps/server/src/routes/admin/config/router/route.test.ts
git commit -m "feat(server): expose upstream model discovery"
```

### Task 3: Add the web client mapping

**Files:**
- Modify: `apps/stage-web/src/pages/admin/adminApi.ts`
- Modify: `apps/stage-web/src/pages/admin/adminApi.test.ts`

- [x] **Step 1: Add a failing mapping test**

```ts
await discoverUpstreamModels({
  providerKind: 'openai-compatible',
  baseURL: 'https://gateway.example/v1',
  plaintextKey: 'sk-test',
}, client)

expect(client.api.admin.config.router.models.$post).toHaveBeenCalledWith({
  json: {
    providerKind: 'openai-compatible',
    baseURL: 'https://gateway.example/v1',
    plaintextKey: 'sk-test',
  },
})
```

- [x] **Step 2: Confirm RED**

```powershell
pnpm exec vitest run --config apps/stage-web/src/pages/admin/adminApi.vitest.config.ts apps/stage-web/src/pages/admin/adminApi.test.ts
```

Expected: the helper or `router.models` client shape is missing.

- [x] **Step 3: Add input type, nested route, and helper**

```ts
export async function discoverUpstreamModels(input: UpstreamModelDiscoveryInput, remoteClient: AdminRemoteClient = adminClient, signal?: AbortSignal): Promise<string[]> {
  const response = await remoteClient.api.admin.config.router.models.$post(
    { json: input },
    requestOptions(signal),
  )
  return (await readJson(response, 'Failed to discover upstream models')).models
}
```

- [x] **Step 4: Confirm GREEN and commit Task 3**

```powershell
git add apps/stage-web/src/pages/admin/adminApi.ts apps/stage-web/src/pages/admin/adminApi.test.ts
git commit -m "feat(web): add upstream model discovery client"
```

### Task 4: Add the editable picker and localizations

**Files:**
- Modify: `apps/stage-web/src/pages/admin/components/AdminOfficialGatewayPanel.vue`
- Modify: `packages/i18n/src/locales/zh-Hans/settings.yaml`
- Modify: `packages/i18n/src/locales/en/settings.yaml`

- [x] **Step 1: Add state and request behavior**

Use `discoverUpstreamModels` with current provider, Base URL, plaintext key, selected router model ID, and saved key entry ID. Keep `form.upstreamModel` unchanged after errors. Clear fetched models on provider, Base URL, API Key, router model, or key-entry changes.

- [x] **Step 2: Add a compact button and native editable datalist**

```vue
<input v-model="form.upstreamModel" list="official-gateway-upstream-models" required>

<Button :loading="modelDiscoveryLoading" @click="discoverModels">
  {{ t('settings.pages.admin.officialGateway.actions.fetchModels') }}
</Button>

<datalist id="official-gateway-upstream-models">
  <option v-for="model in discoveredModels" :key="model" :value="model" />
</datalist>
```

Add localizations for `actions.fetchModels`, `messages.modelsFetched`, and `messages.noModelsFound` in Chinese and English. No display strings are hard-coded.

- [x] **Step 3: Run focused web verification and commit Task 4**

```powershell
pnpm -F @proj-airi/stage-web typecheck
pnpm exec vitest run --config apps/stage-web/src/pages/admin/adminApi.vitest.config.ts apps/stage-web/src/pages/admin/adminApi.test.ts
git add apps/stage-web/src/pages/admin/components/AdminOfficialGatewayPanel.vue packages/i18n/src/locales/zh-Hans/settings.yaml packages/i18n/src/locales/en/settings.yaml
git commit -m "feat(web): select discovered upstream models"
```

### Task 5: Verify, close documentation, and push

**Files:**
- Modify: `docs/superpowers/README.md`
- Modify: `docs/superpowers/plans/2026-07-11-admin-upstream-model-discovery.md`

- [x] **Step 1: Run all directly affected checks**

```powershell
& 'D:\\Tools\\airi\\.node24.local\\node-v24.13.0-win-x64\\node.exe' .\\node_modules\\vitest\\vitest.mjs run apps/server/src/services/domain/admin/router-config/tests/admin-router-config.test.ts apps/server/src/routes/admin/config/router/route.test.ts
pnpm exec vitest run --config apps/stage-web/src/pages/admin/adminApi.vitest.config.ts apps/stage-web/src/pages/admin/adminApi.test.ts
pnpm -F @proj-airi/server typecheck
pnpm -F @proj-airi/stage-web typecheck
git diff --check
```

Expected: every command exits 0.

- [x] **Step 2: Mark plan/index done, commit, and push**

Completed. Implementation commit: `141b3eee5`. Documentation closure is recorded in the superpowers index; the final push is performed after this documentation commit.
