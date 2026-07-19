# Character-First Web Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让私有 Web 站点优先加载并可靠显示人物，移除首页无用 DuckDB，缩小内置 Live2D 模型，并把 PWA、浏览器和 Cloudflare 缓存改为按需策略。

**Architecture:** 人物初始化成为独立的首要启动链，Web 端实际 Renderer 是唯一的舞台 `mounted` 状态来源；Electron 控制条因为 Renderer 位于独立窗口，只保留一个不依赖数据库的兼容就绪分支。内置模型在构建期删除 Cubism 编辑器源文件，Service Worker 只缓存实际请求的资源；可选服务、WASM 和其他页面功能不再竞争人物冷启动。模型错误沿 RendererStage -> ControlStripHost -> Web 首页传递，并由纯策略函数决定重试、会话级回退或显示错误。

**Tech Stack:** Vue 3, Pinia, TypeScript, Vite 6, Vitest 4, vite-plugin-pwa/Workbox, JSZip, UnoCSS, Nginx, Cloudflare, Playwright CLI.

**Execution workspace:** 按仓库 `AGENTS.md` 使用固定 checkout `D:\Tools\airi` 和分支 `codex/dasilva-commercial-subscription`，不另建 worktree。每次构建前必须确认 HEAD 等于 upstream。

---

### Task 1: Remove DuckDB From the Stage Mount Boundary

**Files:**
- Modify: `packages/stage-ui/src/components/scenes/runtime.test.ts`
- Modify: `packages/stage-ui/src/components/scenes/ControlStripHost.vue:1-66,1169-1207`

- [ ] **Step 1: Add a failing architecture regression test**

Add the Node import before the Vitest import:

```ts
import { readFileSync } from 'node:fs'
```

Append this test after the existing `describe` block:

```ts
it('keeps stage mount independent from the experimental DuckDB runtime', () => {
  const source = readFileSync(new URL('./ControlStripHost.vue', import.meta.url), 'utf8')

  expect(source).not.toContain('@proj-airi/drizzle-duckdb-wasm')
  expect(source).not.toContain('getImportUrlBundles')
  expect(source).not.toContain('memory_test')
  expect(source).toContain('if (isElectron.value)\n    state.value = \'mounted\'')
})
```

- [ ] **Step 2: Run the focused test and verify it fails**

```powershell
$nodeRoot = 'D:\Tools\airi\.node24.local\node-v24.13.0-win-x64'
$env:PATH = "$nodeRoot;$env:PATH"
& "$nodeRoot\node.exe" "$nodeRoot\node_modules\corepack\dist\pnpm.js" -F '@proj-airi/stage-ui' exec vitest run src/components/scenes/runtime.test.ts
```

Expected: FAIL because `ControlStripHost.vue` still imports DuckDB, creates `memory_test`, and sets mounted unconditionally.

- [ ] **Step 3: Remove the unused runtime and preserve renderer ownership**

Delete the DuckDB type import, `drizzle`, `getImportUrlBundles`, `db` ref, and commented embedding insert. Replace the existing `onMounted` block exactly with:

```ts
onMounted(() => {
  // The Electron control strip renders its model in a separate actor window.
  if (isElectron.value)
    state.value = 'mounted'

  void customVrmAnimationsStore.loadCustomAnimations()
})
```

The Web branch must not write `mounted`; its `RendererStage` child owns the same v-model. The Electron-only assignment preserves the desktop control-strip loading contract without waiting for DuckDB.

- [ ] **Step 4: Prove no production import remains**

```powershell
rg -n '@proj-airi/drizzle-duckdb-wasm|memory_test|getImportUrlBundles' apps/stage-web packages/stage-ui --glob '!**/dist/**' --glob '!**/node_modules/**'
```

Expected: only Vite optimize-deps exclusions and package metadata remain. Do not remove the DuckDB workspace package or dependency metadata in this task; the design scope only removes the unconditional stage import.

- [ ] **Step 5: Run focused verification**

```powershell
$nodeRoot = 'D:\Tools\airi\.node24.local\node-v24.13.0-win-x64'
$env:PATH = "$nodeRoot;$env:PATH"
& "$nodeRoot\node.exe" "$nodeRoot\node_modules\corepack\dist\pnpm.js" -F '@proj-airi/stage-ui' exec vitest run src/components/scenes/runtime.test.ts
& "$nodeRoot\node.exe" "$nodeRoot\node_modules\corepack\dist\pnpm.js" -F '@proj-airi/stage-ui' typecheck
```

Expected: focused test PASS; Stage UI typecheck exits 0.

- [ ] **Step 6: Commit the isolated fix**

```powershell
git add packages/stage-ui/src/components/scenes/runtime.test.ts packages/stage-ui/src/components/scenes/ControlStripHost.vue
git commit -m "fix(web): remove blocking duckdb startup"
git push
$head = git rev-parse HEAD
$upstream = git rev-parse '@{u}'
if ($head -ne $upstream) { throw 'Task 1 commit is not on upstream' }
```

### Task 2: Start Character Initialization Before Optional Services

**Files:**
- Create: `apps/stage-web/src/modules/app-startup.ts`
- Create: `apps/stage-web/src/modules/app-startup.test.ts`
- Modify: `apps/stage-web/src/App.vue:1-115`

- [ ] **Step 1: Write failing startup-order tests**

Create `apps/stage-web/src/modules/app-startup.test.ts`:

```ts
import { readFileSync } from 'node:fs'

import { describe, expect, it, vi } from 'vitest'

import { startCharacterFirstInitialization } from './app-startup'

describe('startCharacterFirstInitialization', () => {
  it('finishes character steps before starting optional services', async () => {
    const calls: string[] = []
    const { characterReady, optionalReady } = startCharacterFirstInitialization({
      characterSteps: [
        { name: 'models', run: async () => { calls.push('models') } },
        { name: 'stage', run: async () => { calls.push('stage') } },
      ],
      optionalSteps: [
        { name: 'chat', run: async () => { calls.push('chat') } },
      ],
      onError: vi.fn(),
    })

    await characterReady
    await optionalReady

    expect(calls).toEqual(['models', 'stage', 'chat'])
  })

  it('isolates optional failures and continues later optional steps', async () => {
    const onError = vi.fn()
    const laterStep = vi.fn(async () => undefined)
    const { optionalReady } = startCharacterFirstInitialization({
      characterSteps: [],
      optionalSteps: [
        { name: 'server', run: async () => { throw new Error('offline') } },
        { name: 'context', run: laterStep },
      ],
      onError,
    })

    await optionalReady

    expect(laterStep).toHaveBeenCalledOnce()
    expect(onError).toHaveBeenCalledWith('server', expect.any(Error))
  })

  it('continues character setup and optional services after a character storage failure', async () => {
    const calls: string[] = []
    const onError = vi.fn()
    const { characterReady, optionalReady } = startCharacterFirstInitialization({
      characterSteps: [
        { name: 'models', run: async () => { throw new Error('indexeddb unavailable') } },
        { name: 'stage', run: async () => { calls.push('stage') } },
      ],
      optionalSteps: [
        { name: 'chat', run: async () => { calls.push('chat') } },
      ],
      onError,
    })

    await characterReady
    await optionalReady

    expect(calls).toEqual(['stage', 'chat'])
    expect(onError).toHaveBeenCalledWith('models', expect.any(Error))
  })

  it('keeps the App wiring character-first', () => {
    const source = readFileSync(new URL('../App.vue', import.meta.url), 'utf8')
    const characterIndex = source.indexOf('name: \'display models\'')
    const optionalIndex = source.indexOf('name: \'chat session\'')

    expect(source).toContain('startCharacterFirstInitialization({')
    expect(characterIndex).toBeGreaterThan(-1)
    expect(optionalIndex).toBeGreaterThan(characterIndex)
  })
})
```

- [ ] **Step 2: Run the test and verify the missing module failure**

```powershell
$nodeRoot = 'D:\Tools\airi\.node24.local\node-v24.13.0-win-x64'
$env:PATH = "$nodeRoot;$env:PATH"
& "$nodeRoot\node.exe" "$nodeRoot\node_modules\corepack\dist\pnpm.js" -F '@proj-airi/stage-web' exec vitest run src/modules/app-startup.test.ts
```

Expected: FAIL because `app-startup.ts` does not exist.

- [ ] **Step 3: Implement the startup coordinator**

Create `apps/stage-web/src/modules/app-startup.ts`:

```ts
export interface StartupStep {
  name: string
  run: () => Promise<void> | void
}

export interface CharacterFirstInitializationOptions {
  characterSteps: StartupStep[]
  optionalSteps: StartupStep[]
  onError: (name: string, error: unknown) => void
}

async function runSteps(steps: StartupStep[], onError: CharacterFirstInitializationOptions['onError']) {
  for (const step of steps) {
    try {
      await step.run()
    }
    catch (error) {
      onError(step.name, error)
    }
  }
}

export function startCharacterFirstInitialization(options: CharacterFirstInitializationOptions) {
  const characterReady = runSteps(options.characterSteps, options.onError)
  const optionalReady = characterReady.then(() => runSteps(options.optionalSteps, options.onError))

  return { characterReady, optionalReady }
}
```

- [ ] **Step 4: Rewire App mounted initialization**

In `App.vue`, import `startCharacterFirstInitialization` from `./modules/app-startup` and replace the complete mounted hook with:

```ts
onMounted(() => {
  console.log('[App] onMounted start')
  proactivityStore.startHeartbeatLoop()

  console.log('[App] Initializing Analytics & Card stores...')
  analyticsStore.initialize()
  cardStore.initialize()

  if (onboardingStore.needsOnboarding)
    onboardingStore.showingSetup = true

  const { characterReady, optionalReady } = startCharacterFirstInitialization({
    characterSteps: [
      { name: 'display models', run: () => displayModelsStore.loadDisplayModelsFromIndexedDB() },
      { name: 'stage model', run: () => settingsStore.initializeStageModel() },
    ],
    optionalSteps: [
      { name: 'chat session', run: () => chatSessionStore.initialize() },
      { name: 'server channel', run: () => serverChannelStore.initialize({ possibleEvents: ['ui:configure'] }) },
      { name: 'context bridge', run: () => contextBridgeStore.initialize() },
      { name: 'character orchestrator', run: () => characterOrchestratorStore.initialize() },
    ],
    onError: (name, error) => console.error(`[App] Failed to initialize ${name}:`, error),
  })

  void characterReady
  void optionalReady

  const airi = {
    providers: providersStore,
    consciousness: consciousnessStore,
    speech: speechStore,
    cards: cardStore,
    models: displayModelsStore,
    stageModel: stageModelStore,
    settings: settingsStore,
    onboarding: onboardingStore,
    chat: chatSessionStore,
    orchestrator: characterOrchestratorStore,
  }
  // @ts-expect-error - exposing to window for debugging
  window.airi = airi
  console.log('--- [AIRI DEBUG] Store bridge active: window.airi is ready ---')
  console.log('[App] onMounted complete')
})
```

Do not expose optional service readiness as stage readiness.

- [ ] **Step 5: Verify tests and Web typecheck**

```powershell
$nodeRoot = 'D:\Tools\airi\.node24.local\node-v24.13.0-win-x64'
$env:PATH = "$nodeRoot;$env:PATH"
& "$nodeRoot\node.exe" "$nodeRoot\node_modules\corepack\dist\pnpm.js" -F '@proj-airi/stage-web' exec vitest run src/modules/app-startup.test.ts
& "$nodeRoot\node.exe" "$nodeRoot\node_modules\corepack\dist\pnpm.js" -F '@proj-airi/stage-web' typecheck
```

Expected: tests PASS; Web typecheck exits 0.

- [ ] **Step 6: Commit**

```powershell
git add apps/stage-web/src/modules/app-startup.ts apps/stage-web/src/modules/app-startup.test.ts apps/stage-web/src/App.vue
git commit -m "fix(web): prioritize character initialization"
git push
$head = git rev-parse HEAD
$upstream = git rev-parse '@{u}'
if ($head -ne $upstream) { throw 'Task 2 commit is not on upstream' }
```

### Task 3: Build Runtime-Only Hiyori Archives

**Files:**
- Create: `apps/stage-web/build/live2d-runtime-archive.ts`
- Create: `apps/stage-web/build/live2d-runtime-archive.test.ts`
- Modify: `apps/stage-web/vite.config.ts:1-55,220-250`

- [ ] **Step 1: Write a failing archive transformation test**

Create a JSZip fixture with `model3.json`, all referenced runtime files, license text, and editor sources. The test must assert removal and reference preservation:

```ts
import JSZip from 'jszip'

import { describe, expect, it } from 'vitest'

import { createRuntimeOnlyLive2dArchive } from './live2d-runtime-archive'

describe('createRuntimeOnlyLive2dArchive', () => {
  it('removes Cubism editor sources and preserves every runtime reference', async () => {
    const source = new JSZip()
    source.file('model/runtime/model.model3.json', JSON.stringify({
      FileReferences: {
        Moc: 'model.moc3',
        Textures: ['textures/texture_00.png'],
        Physics: 'model.physics3.json',
        Motions: { Idle: [{ File: 'motions/idle.motion3.json' }] },
      },
    }))
    source.file('model/runtime/model.moc3', new Uint8Array([1]))
    source.file('model/runtime/textures/texture_00.png', new Uint8Array([2]))
    source.file('model/runtime/model.physics3.json', '{}')
    source.file('model/runtime/motions/idle.motion3.json', '{}')
    source.file('model/source.cmo3', new Uint8Array([3]))
    source.file('model/source.can3', new Uint8Array([4]))
    source.file('model/LICENSE.txt', 'license')

    const input = await source.generateAsync({ type: 'uint8array' })
    const output = await createRuntimeOnlyLive2dArchive(input)
    const runtime = await JSZip.loadAsync(output)

    expect(runtime.file(/\.cmo3$/i)).toHaveLength(0)
    expect(runtime.file(/\.can3$/i)).toHaveLength(0)
    expect(runtime.file('model/runtime/model.model3.json')).not.toBeNull()
    expect(runtime.file('model/runtime/model.moc3')).not.toBeNull()
    expect(runtime.file('model/runtime/textures/texture_00.png')).not.toBeNull()
    expect(runtime.file('model/LICENSE.txt')).not.toBeNull()
  })

  it('rejects an archive without a model3 manifest', async () => {
    const source = new JSZip()
    source.file('model/model.moc3', new Uint8Array([1]))
    const input = await source.generateAsync({ type: 'uint8array' })

    await expect(createRuntimeOnlyLive2dArchive(input)).rejects.toThrow('model3.json')
  })

  it('rejects an archive with a missing runtime reference', async () => {
    const source = new JSZip()
    source.file('model/model.model3.json', JSON.stringify({
      FileReferences: {
        Moc: 'missing.moc3',
        Textures: [],
      },
    }))
    const input = await source.generateAsync({ type: 'uint8array' })

    await expect(createRuntimeOnlyLive2dArchive(input)).rejects.toThrow('model/missing.moc3')
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

```powershell
$nodeRoot = 'D:\Tools\airi\.node24.local\node-v24.13.0-win-x64'
$env:PATH = "$nodeRoot;$env:PATH"
& "$nodeRoot\node.exe" "$nodeRoot\node_modules\corepack\dist\pnpm.js" -F '@proj-airi/stage-web' exec vitest run build/live2d-runtime-archive.test.ts
```

Expected: FAIL because the transformer module is missing.

- [ ] **Step 3: Implement archive validation and rewriting**

Create `apps/stage-web/build/live2d-runtime-archive.ts` with these exported boundaries:

```ts
import type { Plugin } from 'vite'

import { readFile, writeFile } from 'node:fs/promises'

import JSZip from 'jszip'

interface Model3Manifest {
  FileReferences?: {
    Moc?: string
    Textures?: string[]
    Physics?: string
    Pose?: string
    DisplayInfo?: string
    UserData?: string
    Expressions?: Array<{ File?: string }>
    Motions?: Record<string, Array<{ File?: string, Sound?: string }>>
  }
}

function runtimeReferences(manifest: Model3Manifest): string[] {
  const refs = manifest.FileReferences
  if (!refs)
    return []

  return [
    refs.Moc,
    ...(refs.Textures ?? []),
    refs.Physics,
    refs.Pose,
    refs.DisplayInfo,
    refs.UserData,
    ...(refs.Expressions ?? []).map(item => item.File),
    ...Object.values(refs.Motions ?? {}).flatMap(items => items.flatMap(item => [item.File, item.Sound])),
  ].filter((value): value is string => Boolean(value))
}

export async function createRuntimeOnlyLive2dArchive(input: Uint8Array): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(input)
  for (const path of Object.keys(zip.files)) {
    if (/\.(?:cmo3|can3)$/i.test(path))
      zip.remove(path)
  }

  const manifests = Object.keys(zip.files).filter(path => /model3\.json$/i.test(path))
  if (manifests.length === 0)
    throw new Error('Live2D archive does not contain model3.json')

  for (const manifestPath of manifests) {
    const manifestFile = zip.file(manifestPath)
    if (!manifestFile)
      throw new Error(`Missing Live2D manifest: ${manifestPath}`)
    const manifest = JSON.parse(await manifestFile.async('string')) as Model3Manifest
    const base = manifestPath.slice(0, manifestPath.lastIndexOf('/') + 1)
    for (const reference of runtimeReferences(manifest)) {
      if (!zip.file(`${base}${reference}`))
        throw new Error(`Missing Live2D runtime reference: ${base}${reference}`)
    }
  }

  return zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  })
}

export function runtimeOnlyLive2dArchives(paths: string[]): Plugin {
  return {
    name: 'airi-runtime-only-live2d-archives',
    enforce: 'post',
    async configResolved() {
      for (const path of paths) {
        const input = await readFile(path)
        const output = await createRuntimeOnlyLive2dArchive(input)
        await writeFile(path, output)
      }
    },
  }
}
```

- [ ] **Step 4: Register the post-download transformer in Vite**

Import `runtimeOnlyLive2dArchives` from `./build/live2d-runtime-archive`, then add this plugin immediately after the conditional array of `Download(...)` plugins. All three plugins use `configResolved`; their array order guarantees the transformer runs after the two ZIP downloads and before Vite resolves the ZIP imports.

```ts
runtimeOnlyLive2dArchives([
  resolve(stageUIAssetsRoot, 'live2d/models/hiyori_free_zh.zip'),
  resolve(stageUIAssetsRoot, 'live2d/models/hiyori_pro_zh.zip'),
])
```

- [ ] **Step 5: Run focused tests and Web typecheck**

```powershell
$nodeRoot = 'D:\Tools\airi\.node24.local\node-v24.13.0-win-x64'
$env:PATH = "$nodeRoot;$env:PATH"
& "$nodeRoot\node.exe" "$nodeRoot\node_modules\corepack\dist\pnpm.js" -F '@proj-airi/stage-web' exec vitest run build/live2d-runtime-archive.test.ts
& "$nodeRoot\node.exe" "$nodeRoot\node_modules\corepack\dist\pnpm.js" -F '@proj-airi/stage-web' typecheck
```

Expected: tests PASS and Web typecheck exits 0.

- [ ] **Step 6: Commit and push before building**

```powershell
git add apps/stage-web/build/live2d-runtime-archive.ts apps/stage-web/build/live2d-runtime-archive.test.ts apps/stage-web/vite.config.ts
git commit -m "perf(web): strip Live2D editor sources"
git push
$head = git rev-parse HEAD
$upstream = git rev-parse '@{u}'
if ($head -ne $upstream) { throw 'Task 3 commit is not on upstream' }
```

- [ ] **Step 7: Build the pushed commit and enforce model budgets**

```powershell
if (git status --porcelain) { throw 'Worktree must be clean before build' }
$head = git rev-parse HEAD
$upstream = git rev-parse '@{u}'
if ($head -ne $upstream) { throw 'HEAD must equal upstream before build' }
if ((Get-Content 'apps\stage-web\.env.production' -Raw -Encoding UTF8) -notmatch '(?m)^VITE_SERVER_URL=https://airi\.aifamily\.vip\s*$') { throw 'VITE_SERVER_URL is not the production domain' }

$nodeRoot = 'D:\Tools\airi\.node24.local\node-v24.13.0-win-x64'
$env:PATH = "$nodeRoot;$env:PATH"
$env:NODE_OPTIONS = '--max-old-space-size=4096'
& "$nodeRoot\node.exe" "$nodeRoot\node_modules\corepack\dist\pnpm.js" -F '@proj-airi/stage-web' build
if ($LASTEXITCODE -ne 0) { throw 'Stage Web build failed' }

$free = @(Get-ChildItem 'apps\stage-web\dist\assets\hiyori_free_zh-*.zip')
$pro = @(Get-ChildItem 'apps\stage-web\dist\assets\hiyori_pro_zh-*.zip')
if ($free.Count -ne 1) { throw "Expected one Free model archive, found $($free.Count)" }
if ($pro.Count -ne 1) { throw "Expected one Pro model archive, found $($pro.Count)" }
if ($free[0].Length -ge 3.2MB) { throw "Free model too large: $($free[0].Length)" }
if ($pro[0].Length -ge 4.8MB) { throw "Pro model too large: $($pro[0].Length)" }
$free[0], $pro[0] | Select-Object Name,Length
```

Expected: build succeeds from the pushed commit; exactly one Free and one Pro ZIP exist and both remain below budget. If it fails, make a new focused commit, push it, and repeat this step from a clean upstream-matched HEAD.

### Task 4: Replace Bulk PWA Precache With On-Demand Runtime Caching

**Files:**
- Create: `apps/stage-web/src/modules/pwa-cache.ts`
- Create: `apps/stage-web/src/modules/pwa-cache.test.ts`
- Modify: `apps/stage-web/vite.config.ts:174-212`
- Modify: `apps/stage-web/src/stores/pwa.ts`
- Modify: `apps/stage-web/src/App.vue`

- [ ] **Step 1: Write failing cache-policy tests**

The test should call both URL predicates directly and inspect Workbox options:

```ts
import { describe, expect, it } from 'vitest'

import { shouldCacheStageAsset, shouldCacheStageNavigation, stageWebWorkbox } from './pwa-cache'

describe('stageWebWorkbox', () => {
  it('does not precache product bundles', () => {
    expect(stageWebWorkbox.globPatterns).toEqual([])
    expect(stageWebWorkbox.navigateFallback).toBeNull()
    expect(stageWebWorkbox.cleanupOutdatedCaches).toBe(true)
  })

  it('uses NetworkFirst only for stage-web navigations', () => {
    const rule = stageWebWorkbox.runtimeCaching?.find(item => item.options?.cacheName === 'airi-pages-v1')
    expect(rule?.handler).toBe('NetworkFirst')

    expect(shouldCacheStageNavigation({ request: { mode: 'navigate' }, url: { pathname: '/settings' }, sameOrigin: true })).toBe(true)
    expect(shouldCacheStageNavigation({ request: { mode: 'navigate' }, url: { pathname: '/ui/sign-in' }, sameOrigin: true })).toBe(false)
    expect(shouldCacheStageNavigation({ request: { mode: 'navigate' }, url: { pathname: '/api/auth/get-session' }, sameOrigin: true })).toBe(false)
    expect(shouldCacheStageNavigation({ request: { mode: 'navigate' }, url: { pathname: '/auth/callback' }, sameOrigin: true })).toBe(false)
    expect(shouldCacheStageNavigation({ request: { mode: 'same-origin' }, url: { pathname: '/settings' }, sameOrigin: true })).toBe(false)
  })

  it('caches only requested same-origin assets', () => {
    const rule = stageWebWorkbox.runtimeCaching?.find(item => item.options?.cacheName === 'airi-assets-v1')
    expect(rule?.handler).toBe('CacheFirst')

    expect(shouldCacheStageAsset({ url: { pathname: '/assets/index-hash.js' }, sameOrigin: true })).toBe(true)
    expect(shouldCacheStageAsset({ url: { pathname: '/model.wasm' }, sameOrigin: false })).toBe(false)
  })
})
```

- [ ] **Step 2: Verify the test fails**

```powershell
$nodeRoot = 'D:\Tools\airi\.node24.local\node-v24.13.0-win-x64'
$env:PATH = "$nodeRoot;$env:PATH"
& "$nodeRoot\node.exe" "$nodeRoot\node_modules\corepack\dist\pnpm.js" -F '@proj-airi/stage-web' exec vitest run src/modules/pwa-cache.test.ts
```

Expected: FAIL because `pwa-cache.ts` is missing.

- [ ] **Step 3: Implement the Workbox configuration as a testable module**

Create `apps/stage-web/src/modules/pwa-cache.ts`:

```ts
import type { VitePWAOptions } from 'vite-plugin-pwa'

type WorkboxOptions = NonNullable<VitePWAOptions['workbox']>

interface StageNavigationRouteInput {
  request: Pick<Request, 'mode'>
  url: Pick<URL, 'pathname'>
  sameOrigin: boolean
}

interface StageAssetRouteInput {
  url: Pick<URL, 'pathname'>
  sameOrigin: boolean
}

export function shouldCacheStageNavigation({ request, url, sameOrigin }: StageNavigationRouteInput) {
  return sameOrigin
    && request.mode === 'navigate'
    && !url.pathname.startsWith('/docs/')
    && !url.pathname.startsWith('/ui/')
    && !url.pathname.startsWith('/remote-assets/')
    && !url.pathname.startsWith('/api/')
    && !url.pathname.startsWith('/auth/')
}

export function shouldCacheStageAsset({ url, sameOrigin }: StageAssetRouteInput) {
  return sameOrigin && url.pathname.startsWith('/assets/')
}

export const stageWebWorkbox = {
  cleanupOutdatedCaches: true,
  globPatterns: [],
  navigateFallback: null,
  runtimeCaching: [
    {
      urlPattern: shouldCacheStageNavigation,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'airi-pages-v1',
        networkTimeoutSeconds: 3,
        cacheableResponse: { statuses: [0, 200] },
        expiration: { maxEntries: 4, maxAgeSeconds: 86400, purgeOnQuotaError: true },
      },
    },
    {
      urlPattern: shouldCacheStageAsset,
      handler: 'CacheFirst',
      options: {
        cacheName: 'airi-assets-v1',
        cacheableResponse: { statuses: [0, 200] },
        expiration: { maxEntries: 128, maxAgeSeconds: 2592000, purgeOnQuotaError: true },
      },
    },
  ],
} satisfies WorkboxOptions
```

Use `stageWebWorkbox` in `VitePWA({ workbox: stageWebWorkbox })`, remove the 64 MiB single-file limit, and remove the now-unused `stageWebNavigateFallbackDenylist` import from `vite.config.ts`. The two route functions deliberately contain no free runtime variables because Workbox serializes each callback with `Function.prototype.toString()`.

- [ ] **Step 4: Make PWA registration explicit and character-last**

In `apps/stage-web/src/stores/pwa.ts`, remove `onMounted` from the Vue import and replace the mounted hook with this idempotent method:

```ts
const registered = ref(false)

async function register() {
  if (registered.value || import.meta.env.SSR || isEnvTruthy(import.meta.env.VITE_APP_TARGET_HUGGINGFACE_SPACE))
    return

  registered.value = true
  try {
    const { registerSW } = await import('../modules/pwa')
    const updateSW = registerSW({
      onNeedRefresh: () => {
        const id = nanoid()
        toast(markRaw(h(ToasterPWAUpdateReady, { id, onUpdate: () => updateSW() })), {
          id,
          duration: 30000,
          position: isMobile.value ? 'top-center' : 'bottom-right',
        })
      },
    })
    updateReadyHooks.value.push(updateSW)
  }
  catch (error) {
    registered.value = false
    throw error
  }
}

return { register, updateReadyHooks }
```

In `App.vue`, replace the standalone `usePWAStore()` call with `const pwaStore = usePWAStore()`. Append this exact entry after the `character orchestrator` entry in `optionalSteps`:

```ts
{ name: 'pwa', run: () => pwaStore.register() },
```

The runtime precache is below 1 MiB, so registration can occur after the character URL is configured without triggering the former 153 MiB competing download.

- [ ] **Step 5: Verify policy tests, navigation tests, and Web types**

```powershell
$nodeRoot = 'D:\Tools\airi\.node24.local\node-v24.13.0-win-x64'
$env:PATH = "$nodeRoot;$env:PATH"
& "$nodeRoot\node.exe" "$nodeRoot\node_modules\corepack\dist\pnpm.js" -F '@proj-airi/stage-web' exec vitest run src/modules/pwa-cache.test.ts src/modules/pwa-navigation.test.ts src/modules/app-startup.test.ts
& "$nodeRoot\node.exe" "$nodeRoot\node_modules\corepack\dist\pnpm.js" -F '@proj-airi/stage-web' typecheck
```

Expected: all tests PASS and Web typecheck exits 0.

- [ ] **Step 6: Commit**

```powershell
git add apps/stage-web/src/modules/pwa-cache.ts apps/stage-web/src/modules/pwa-cache.test.ts apps/stage-web/src/stores/pwa.ts apps/stage-web/src/App.vue apps/stage-web/vite.config.ts
git commit -m "perf(web): cache stage assets on demand"
git push
$head = git rev-parse HEAD
$upstream = git rev-parse '@{u}'
if ($head -ne $upstream) { throw 'Task 4 commit is not on upstream' }
```

- [ ] **Step 7: Build the pushed commit and assert the generated precache budget**

```powershell
if (git status --porcelain) { throw 'Worktree must be clean before build' }
$head = git rev-parse HEAD
$upstream = git rev-parse '@{u}'
if ($head -ne $upstream) { throw 'HEAD must equal upstream before build' }
if ((Get-Content 'apps\stage-web\.env.production' -Raw -Encoding UTF8) -notmatch '(?m)^VITE_SERVER_URL=https://airi\.aifamily\.vip\s*$') { throw 'VITE_SERVER_URL is not the production domain' }

$nodeRoot = 'D:\Tools\airi\.node24.local\node-v24.13.0-win-x64'
$env:PATH = "$nodeRoot;$env:PATH"
$env:NODE_OPTIONS = '--max-old-space-size=4096'
& "$nodeRoot\node.exe" "$nodeRoot\node_modules\corepack\dist\pnpm.js" -F '@proj-airi/stage-web' build
if ($LASTEXITCODE -ne 0) { throw 'Stage Web build failed' }

$dist = (Resolve-Path 'apps\stage-web\dist').Path
$sw = Get-Content (Join-Path $dist 'sw.js') -Raw -Encoding UTF8
$urls = @([regex]::Matches($sw, 'url:"([^"]+)"') | ForEach-Object { $_.Groups[1].Value })
$precacheBytes = 0
foreach ($url in $urls) {
  $relative = [Uri]::UnescapeDataString($url.TrimStart('/'))
  $file = Join-Path $dist $relative
  if (Test-Path -LiteralPath $file) { $precacheBytes += (Get-Item -LiteralPath $file).Length }
}
if ($urls.Count -ge 10) { throw "Precache has too many entries: $($urls.Count)" }
if ($precacheBytes -ge 1MB) { throw "Precache is too large: $precacheBytes bytes" }
if ($sw -match 'duckdb|ort-wasm|web_rwkv|worker-') { throw 'Heavy optional runtime remains in precache' }
if ($sw -match 'stageWebNavigateFallbackDenylist|isDeniedPath') { throw 'Generated route contains an unresolved closure reference' }
[pscustomobject]@{ Entries = $urls.Count; Bytes = $precacheBytes; URLs = ($urls -join ', ') }
```

Expected: build succeeds from the pushed commit; the explicit icon precache is below 10 entries and 1 MiB, contains no heavy runtime, and the generated route has no unresolved closure identifiers.

### Task 5: Make Renderer Failures Observable

**Files:**
- Create: `packages/stage-ui-live2d/src/components/scenes/live2d/model-load-state.test.ts`
- Create: `packages/stage-ui-spine/src/components/scenes/spine/model-load-state.test.ts`
- Modify: `packages/stage-ui-live2d/src/components/scenes/live2d/Model.vue:612-1277`
- Modify: `packages/stage-ui-live2d/src/components/scenes/Live2D.vue:55-62,189-214`
- Modify: `packages/stage-ui-spine/src/components/scenes/spine/Model.vue:261-640`
- Modify: `packages/stage-ui-spine/src/components/scenes/Spine.vue:42-49,158-180`
- Modify: `packages/stage-ui/src/components/scenes/RendererStage.vue:38-48,390-419`
- Modify: `packages/stage-ui/src/components/scenes/ControlStripHost.vue:57-65,1247-1257`

- [ ] **Step 1: Add failing source-level regression tests for false success and mutex leaks**

Create `model-load-state.test.ts`:

```ts
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

describe('Live2D model load state', () => {
  it('has one conditional mounted transition and one mutex release', () => {
    const source = readFileSync(new URL('./Model.vue', import.meta.url), 'utf8')
    const loadModel = source.slice(source.indexOf('async function loadModel()'), source.indexOf('async function setMotion('))

    expect(loadModel.match(/componentState\.value = 'mounted'/g)).toHaveLength(1)
    expect(loadModel.match(/modelLoadMutex\.release\(\)/g)).toHaveLength(1)
    expect(loadModel).toContain('if (loaded)\n      componentState.value = \'mounted\'')
    expect(loadModel).toContain('componentState.value = \'pending\'')
    expect(loadModel).toContain('throw new Error(\'No Live2D model source provided\')')
  })
})
```

Create the Spine counterpart at `packages/stage-ui-spine/src/components/scenes/spine/model-load-state.test.ts`:

```ts
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

describe('Spine model load state', () => {
  it('has one conditional mounted transition, one error emission, and one mutex release', () => {
    const source = readFileSync(new URL('./Model.vue', import.meta.url), 'utf8')
    const loadModel = source.slice(source.indexOf('async function loadModel()'), source.indexOf('/**\n * Plays'))

    expect(loadModel.match(/componentState\.value = 'mounted'/g)).toHaveLength(1)
    expect(loadModel.match(/modelLoadMutex\.release\(\)/g)).toHaveLength(1)
    expect(loadModel.match(/emits\('error'/g)).toHaveLength(1)
    expect(loadModel).toContain('if (loaded)\n      componentState.value = \'mounted\'')
    expect(loadModel).toContain('componentState.value = \'pending\'')
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

```powershell
$nodeRoot = 'D:\Tools\airi\.node24.local\node-v24.13.0-win-x64'
$env:PATH = "$nodeRoot;$env:PATH"
& "$nodeRoot\node.exe" 'node_modules\vitest\vitest.mjs' run --root packages/stage-ui-live2d src/components/scenes/live2d/model-load-state.test.ts
& "$nodeRoot\node.exe" 'node_modules\vitest\vitest.mjs' run --root packages/stage-ui-spine src/components/scenes/spine/model-load-state.test.ts
```

Expected: both tests FAIL because early returns and `finally` currently mark failures as mounted; the Live2D mutex can also be skipped and Spine can emit the same error twice.

- [ ] **Step 3: Put the complete Live2D load lifecycle under one try/finally**

Apply these exact control-flow diffs; the omitted lines are untouched by the patch rather than instructions to invent code:

```diff
   await modelLoadMutex.acquire()
+  let loaded = false

-  modelLoading.value = true
-  availableExpressions.value = []
-  expressionData.value = []
-  settledIdleParameterBaseline.value = []
-  componentState.value = 'loading'
-
-  if (!pixiApp.value || !pixiApp.value.stage) {
-    try {
-      await until(() => !!pixiApp.value && !!pixiApp.value.stage).toBeTruthy({ timeout: 1500 })
-    }
-    catch {
-      modelLoading.value = false
-      componentState.value = 'mounted'
-      return
-    }
-  }
+  try {
+    modelLoading.value = true
+    availableExpressions.value = []
+    expressionData.value = []
+    settledIdleParameterBaseline.value = []
+    componentState.value = 'loading'
+
+    if (!pixiApp.value || !pixiApp.value.stage)
+      await until(() => !!pixiApp.value && !!pixiApp.value.stage).toBeTruthy({ timeout: 1500 })
```

```diff
-  if (!modelSrcRef.value) {
-    console.warn('No Live2D model source provided.')
-    modelLoading.value = false
-    componentState.value = 'mounted'
-    return
-  }
-
-  try {
-    if (isUnmounted) {
-      modelLoading.value = false
-      componentState.value = 'mounted'
-      return
-    }
+    if (!modelSrcRef.value)
+      throw new Error('No Live2D model source provided')
+
+    if (isUnmounted)
+      return
```

```diff
-    if (isUnmounted || !pixiApp.value || !pixiApp.value.stage) {
+    if (isUnmounted) {
       live2DModel.destroy()
-      modelLoading.value = false
-      componentState.value = 'mounted'
       return
     }
+    if (!pixiApp.value || !pixiApp.value.stage) {
+      live2DModel.destroy()
+      throw new Error('Live2D canvas became unavailable during model setup')
+    }
```

```diff
-    emits('modelLoaded')
+    loaded = true
+    emits('modelLoaded')
   }
   catch (error) {
-    console.error('[Live2D] Failed to load model:', error)
-    emits('error', error instanceof Error ? error : new Error(String(error)))
+    if (!isUnmounted) {
+      componentState.value = 'pending'
+      const normalized = error instanceof Error ? error : new Error(String(error))
+      console.error('[Live2D] Failed to load model:', normalized)
+      emits('error', normalized)
+    }
   }
   finally {
     modelLoading.value = false
-    componentState.value = 'mounted'
+    if (loaded)
+      componentState.value = 'mounted'
     modelLoadMutex.release()
   }
```

The final function must have exactly one `mounted` assignment and one `modelLoadMutex.release()` as enforced by Step 1.

- [ ] **Step 4: Apply the same lifecycle contract to Spine**

In Spine `Model.vue`, declare `let loaded = false` immediately after acquiring the mutex. Move the initialization assignments into its outer `try`; run `await nextTick()` before testing `canvas.value`; throw `new Error('Spine canvas is not available')` or `new Error('No Spine model source provided')` instead of returning mounted. The unmounted branch cleans `assetCleanup` and returns without an error. Immediately before the existing successful `emits('modelLoaded')`, set `loaded = true`.

Delete the two inner `emits('error', error)` calls that precede `reject(error)` so only the outer catch emits once. Replace the outer tail exactly with:

```ts
catch (error) {
  if (!isUnmounted) {
    componentState.value = 'pending'
    const normalized = error instanceof Error ? error : new Error(String(error))
    console.error('[Spine] Failed to load model:', normalized)
    emits('error', normalized)
  }
}
finally {
  modelLoading.value = false
  if (loaded)
    componentState.value = 'mounted'
  modelLoadMutex.release()
}
```

- [ ] **Step 5: Forward normalized errors and derive success from renderer state**

Add an `error` emit to `Live2D.vue` and forward it from `Live2DModel`:

```vue
@error="emits('error', $event)"
```

Add the same `error` emit to Spine `Spine.vue` and forward `SpineModel`'s error. In `RendererStage.vue`, add `modelLoaded` and `modelError` emits plus this normalizer:

```ts
function emitModelError(error: unknown) {
  emits('modelError', error instanceof Error ? error : new Error(String(error)))
}
```

Inside the existing `watch(componentState, ...)`, emit `modelLoaded` in the `state === 'mounted'` branch before posting the broadcast signal. This makes the shared state the success source for Live2D, VRM, Spine, and MMD. Replace the Live2D, Three, Spine, and MMD error listeners with `@error="emitModelError"`.

Add `modelLoaded` and `modelError` emits to `ControlStripHost.vue` and forward them from `RendererStage`:

```vue
@model-loaded="emits('modelLoaded')"
@model-error="emits('modelError', $event)"
```

- [ ] **Step 6: Verify both regression tests and all affected typechecks**

```powershell
$nodeRoot = 'D:\Tools\airi\.node24.local\node-v24.13.0-win-x64'
$env:PATH = "$nodeRoot;$env:PATH"
& "$nodeRoot\node.exe" 'node_modules\vitest\vitest.mjs' run --root packages/stage-ui-live2d src/components/scenes/live2d/model-load-state.test.ts
& "$nodeRoot\node.exe" 'node_modules\vitest\vitest.mjs' run --root packages/stage-ui-spine src/components/scenes/spine/model-load-state.test.ts
& "$nodeRoot\node.exe" "$nodeRoot\node_modules\corepack\dist\pnpm.js" -F '@proj-airi/stage-ui-live2d' typecheck
& "$nodeRoot\node.exe" "$nodeRoot\node_modules\corepack\dist\pnpm.js" -F '@proj-airi/stage-ui-spine' typecheck
& "$nodeRoot\node.exe" "$nodeRoot\node_modules\corepack\dist\pnpm.js" -F '@proj-airi/stage-ui' typecheck
```

Expected: both tests PASS and all three typechecks exit 0.

- [ ] **Step 7: Commit and push**

```powershell
git add packages/stage-ui-live2d/src/components/scenes/live2d/model-load-state.test.ts packages/stage-ui-live2d/src/components/scenes/live2d/Model.vue packages/stage-ui-live2d/src/components/scenes/Live2D.vue packages/stage-ui-spine/src/components/scenes/spine/model-load-state.test.ts packages/stage-ui-spine/src/components/scenes/spine/Model.vue packages/stage-ui-spine/src/components/scenes/Spine.vue packages/stage-ui/src/components/scenes/RendererStage.vue packages/stage-ui/src/components/scenes/ControlStripHost.vue
git commit -m "fix(web): surface character load failures"
git push
$head = git rev-parse HEAD
$upstream = git rev-parse '@{u}'
if ($head -ne $upstream) { throw 'Task 5 commit is not on upstream' }
```

### Task 6: Add Automatic Retry, Session Fallback, and Error UI

**Files:**
- Create: `apps/stage-web/src/modules/model-load-recovery.ts`
- Create: `apps/stage-web/src/modules/model-load-recovery.test.ts`
- Modify: `packages/stage-ui/src/components/scenes/runtime.test.ts`
- Modify: `packages/stage-ui/src/stores/settings/stage-model.ts:12-32,67-272`
- Modify: `packages/stage-ui/src/stores/settings/index.ts:72-131`
- Modify: `packages/stage-ui/src/components/scenes/RendererStage.vue:55-106,388-491`
- Modify: `apps/stage-web/src/pages/index.vue:1-100,217-259`
- Modify: `packages/i18n/src/locales/en/stage.yaml`
- Modify: `packages/i18n/src/locales/zh-Hans/stage.yaml`

- [ ] **Step 1: Write the recovery decision tests**

```ts
import { describe, expect, it } from 'vitest'

import { decideModelLoadRecovery } from './model-load-recovery'

describe('decideModelLoadRecovery', () => {
  it('retries the current model after its first failure', () => {
    expect(decideModelLoadRecovery({ failureCount: 1, selectedModelId: 'preset-live2d-1', activeModelId: 'preset-live2d-1' })).toEqual({ type: 'retry' })
  })

  it('falls back from a built-in model after the retry fails', () => {
    expect(decideModelLoadRecovery({ failureCount: 2, selectedModelId: 'preset-live2d-1', activeModelId: 'preset-live2d-1' })).toEqual({ type: 'fallback', modelId: 'preset-live2d-2' })
  })

  it('does not replace a failed custom model', () => {
    expect(decideModelLoadRecovery({ failureCount: 2, selectedModelId: 'display-model-custom', activeModelId: 'display-model-custom' })).toEqual({ type: 'show-error' })
  })

  it('stops after retrying the fallback model', () => {
    expect(decideModelLoadRecovery({ failureCount: 2, selectedModelId: 'preset-live2d-1', activeModelId: 'preset-live2d-2' })).toEqual({ type: 'show-error' })
  })
})
```

Append this store-boundary assertion to `packages/stage-ui/src/components/scenes/runtime.test.ts`:

```ts
it('keeps a temporary fallback out of the persisted model selection', () => {
  const source = readFileSync(new URL('../../stores/settings/stage-model.ts', import.meta.url), 'utf8')
  const temporaryModelFunction = source.match(/async function useTemporaryStageModel[\s\S]*?\n {2}\}/)?.[0] ?? ''

  expect(temporaryModelFunction).toContain('applyStageModel(modelId, reason)')
  expect(temporaryModelFunction).not.toContain('stageModelSelectedState')
  expect(source).not.toContain('stageModelSelectedState.value = modelId')
})
```

- [ ] **Step 2: Run the test and verify it fails**

```powershell
$nodeRoot = 'D:\Tools\airi\.node24.local\node-v24.13.0-win-x64'
$env:PATH = "$nodeRoot;$env:PATH"
& "$nodeRoot\node.exe" "$nodeRoot\node_modules\corepack\dist\pnpm.js" -F '@proj-airi/stage-web' exec vitest run src/modules/model-load-recovery.test.ts
& "$nodeRoot\node.exe" "$nodeRoot\node_modules\corepack\dist\pnpm.js" -F '@proj-airi/stage-ui' exec vitest run src/components/scenes/runtime.test.ts
```

Expected: Web test FAIL because the recovery module is missing; Stage UI test FAIL because the temporary model method does not exist.

- [ ] **Step 3: Implement the pure recovery policy**

```ts
export const BUILT_IN_FALLBACK_MODEL_ID = 'preset-live2d-2'

export interface ModelLoadRecoveryContext {
  failureCount: number
  selectedModelId: string
  activeModelId?: string
}

export type ModelLoadRecoveryAction
  = | { type: 'retry' }
    | { type: 'fallback', modelId: string }
    | { type: 'show-error' }

export function decideModelLoadRecovery(context: ModelLoadRecoveryContext): ModelLoadRecoveryAction {
  if (context.failureCount <= 1)
    return { type: 'retry' }

  if (context.failureCount === 2 && context.selectedModelId.startsWith('preset-') && context.activeModelId !== BUILT_IN_FALLBACK_MODEL_ID)
    return { type: 'fallback', modelId: BUILT_IN_FALLBACK_MODEL_ID }

  return { type: 'show-error' }
}
```

- [ ] **Step 4: Add session-only active model and reload revision to the stage store**

Apply these exact store-boundary changes. They leave URL creation and renderer selection inside the existing function body while changing only how its model ID is supplied and exposed:

```diff
   const stageModelSelectedFile = refManualReset<File | undefined>(undefined)
   const stageModelRenderer = refManualReset<StageModelRenderer>(undefined)
+  const stageModelActiveId = ref<string>()
+  const stageModelLoadRevision = ref(0)
```

```diff
-  async function updateStageModel(reason?: string) {
+  async function applyStageModel(selectedModelId: string, reason?: string) {
     if (reason)
       lastReloadReason.value = reason
     const requestId = ++stageModelUpdateSequence
-    const selectedModelId = stageModelSelectedState.value

     if (!selectedModelId) {
+      stageModelActiveId.value = undefined
+      stageModelLoadRevision.value += 1
       replaceStageModelUrl(undefined)
```

```diff
     if (requestId !== stageModelUpdateSequence)
       return
+
+    stageModelActiveId.value = selectedModelId
+    stageModelLoadRevision.value += 1
```

Insert these methods immediately after `applyStageModel`:

```ts
async function updateStageModel(reason?: string) {
  await applyStageModel(stageModelSelectedState.value, reason)
}

function retryStageModel(reason = 'retry model load') {
  lastReloadReason.value = reason
  stageModelLoadRevision.value += 1
}

async function useTemporaryStageModel(modelId: string, reason = 'temporary model fallback') {
  await applyStageModel(modelId, reason)
}
```

Add `stageModelActiveId` and `stageModelLoadRevision` beside the other returned refs, and `retryStageModel` plus `useTemporaryStageModel` beside the returned methods. In `resetState`, set the active ID to `undefined` and revision to `0` before calling `updateStageModel('reset state')`.

In the unified settings store, insert these exact properties:

```ts
stageModelActiveId: toRef(stageModel, 'stageModelActiveId'),
stageModelLoadRevision: toRef(stageModel, 'stageModelLoadRevision'),
```

```ts
retryStageModel: stageModel.retryStageModel,
useTemporaryStageModel: stageModel.useTemporaryStageModel,
```

- [ ] **Step 5: Key the actual renderer by load revision**

In `RendererStage.vue`, add `stageModelActiveId` and `stageModelLoadRevision` to the existing `storeToRefs(settingsStore)` destructure. Add this key to Live2D, Three, Spine, and MMD scene elements:

```vue
:key="`${stageModelRenderer}:${stageModelActiveId}:${stageModelLoadRevision}`"
```

Replace Live2D and Spine `:model-id="stageModelSelected"` plus Three `:model-identity="stageModelSelected"` with `stageModelActiveId || stageModelSelected`. MMD has no identity prop and only receives the key. Do not change `resolvedIdleAnimations` or positioning lookups, which intentionally remain keyed by the persisted selection.

- [ ] **Step 6: Handle recovery and final error in the home page**

Import `Button` from `@proj-airi/ui`, `useI18n` from `vue-i18n`, and `decideModelLoadRecovery` from `../modules/model-load-recovery`. Replace `lastReloadReason` in the settings refs with `stageModelActiveId`. Add:

```ts
const { t } = useI18n()
const modelLoadFailureCount = ref(0)
const modelLoadError = ref<Error>()
const modelLoadStatus = ref<'loading' | 'retrying' | 'fallback'>('loading')
const modelLoadStatusMessage = computed(() => t(`stage.operations.load-models-status.${modelLoadStatus.value}`))

function handleModelLoaded() {
  modelLoadFailureCount.value = 0
  modelLoadError.value = undefined
  modelLoadStatus.value = 'loading'
}

async function handleModelError(error: Error) {
  modelLoadFailureCount.value += 1
  const action = decideModelLoadRecovery({
    failureCount: modelLoadFailureCount.value,
    selectedModelId: stageModelSelected.value,
    activeModelId: stageModelActiveId.value,
  })

  if (action.type === 'retry') {
    modelLoadStatus.value = 'retrying'
    settingsStore.retryStageModel('automatic model retry')
    return
  }
  if (action.type === 'fallback') {
    modelLoadFailureCount.value = 0
    modelLoadStatus.value = 'fallback'
    try {
      await settingsStore.useTemporaryStageModel(action.modelId, 'built-in model fallback')
    }
    catch (fallbackError) {
      modelLoadError.value = fallbackError instanceof Error ? fallbackError : new Error(String(fallbackError))
    }
    return
  }

  modelLoadError.value = error
}

function retryModelLoad() {
  modelLoadFailureCount.value = 0
  modelLoadError.value = undefined
  modelLoadStatus.value = 'retrying'
  settingsStore.retryStageModel('manual model retry')
}
```

Add `@model-loaded="handleModelLoaded"` and `@model-error="handleModelError"` to `WidgetStage`. Replace lines 231-259 of the current loading overlay with:

```vue
<div v-if="isLoading" class="pointer-events-none absolute inset-0 z-100 h-full w-full">
  <div class="absolute inset-0 flex items-center justify-center overflow-hidden px-4">
    <div
      :class="[
        'w-full max-w-sm rounded-lg px-5 py-4',
        'flex items-center justify-center',
        'bg-white/85 text-primary-700 shadow-lg dark:bg-neutral-950/85 dark:text-primary-300',
        'backdrop-blur-md',
      ]"
    >
      <div v-if="modelLoadError" class="flex flex-col items-center gap-3 text-center">
        <div class="i-solar:danger-triangle-bold-duotone text-2xl" />
        <div class="text-base font-medium">
          {{ t('stage.operations.load-models-status.error') }}
        </div>

        <Button
          class="pointer-events-auto"
          :label="t('stage.operations.load-models-status.retry')"
          icon="i-solar:refresh-bold-duotone"
          size="sm"
          variant="secondary"
          @click="retryModelLoad"
        />

      </div>
      <div v-else class="flex items-center gap-3 text-base font-medium">
        <div class="i-svg-spinners:ring-resize text-xl" />
        <span>{{ modelLoadStatusMessage }}</span>
      </div>
    </div>
  </div>
</div>
```

Only the Retry button accepts pointer events; chat, header, and settings controls remain clickable around the compact status panel.

- [ ] **Step 7: Add localized loading/error copy**

Under `operations.load-models-status` in English and Simplified Chinese stage locales add:

```yaml
# en
error: The character could not be loaded.
retry: Retry
retrying: Retrying the character...
fallback: Loading the lightweight fallback character...

# zh-Hans
error: 人物加载失败。
retry: 重试
retrying: 正在重新加载人物……
fallback: 正在加载轻量备用人物……
```

The `modelLoadStatusMessage` computed value uses the existing `loading` key and the new retry/fallback keys; remove the hardcoded loading and reload-reason strings.

- [ ] **Step 8: Run focused and type verification**

```powershell
$nodeRoot = 'D:\Tools\airi\.node24.local\node-v24.13.0-win-x64'
$env:PATH = "$nodeRoot;$env:PATH"
& "$nodeRoot\node.exe" "$nodeRoot\node_modules\corepack\dist\pnpm.js" -F '@proj-airi/stage-web' exec vitest run src/modules/model-load-recovery.test.ts src/modules/app-startup.test.ts
& "$nodeRoot\node.exe" "$nodeRoot\node_modules\corepack\dist\pnpm.js" -F '@proj-airi/stage-ui' exec vitest run src/components/scenes/runtime.test.ts
& "$nodeRoot\node.exe" 'node_modules\vitest\vitest.mjs' run --root packages/stage-ui-live2d src/components/scenes/live2d/model-load-state.test.ts
& "$nodeRoot\node.exe" 'node_modules\vitest\vitest.mjs' run --root packages/stage-ui-spine src/components/scenes/spine/model-load-state.test.ts
& "$nodeRoot\node.exe" "$nodeRoot\node_modules\corepack\dist\pnpm.js" -F '@proj-airi/stage-ui-live2d' typecheck
& "$nodeRoot\node.exe" "$nodeRoot\node_modules\corepack\dist\pnpm.js" -F '@proj-airi/stage-ui-spine' typecheck
& "$nodeRoot\node.exe" "$nodeRoot\node_modules\corepack\dist\pnpm.js" -F '@proj-airi/stage-ui' typecheck
& "$nodeRoot\node.exe" "$nodeRoot\node_modules\corepack\dist\pnpm.js" -F '@proj-airi/stage-web' typecheck
```

Expected: all focused tests PASS and all four typechecks exit 0.

- [ ] **Step 9: Commit**

```powershell
git add apps/stage-web/src/modules/model-load-recovery.ts apps/stage-web/src/modules/model-load-recovery.test.ts apps/stage-web/src/pages/index.vue packages/stage-ui/src/components/scenes/runtime.test.ts packages/stage-ui/src/stores/settings/stage-model.ts packages/stage-ui/src/stores/settings/index.ts packages/stage-ui/src/components/scenes/RendererStage.vue packages/i18n/src/locales/en/stage.yaml packages/i18n/src/locales/zh-Hans/stage.yaml
git commit -m "fix(web): recover failed character loads"
git push
$head = git rev-parse HEAD
$upstream = git rev-parse '@{u}'
if ($head -ne $upstream) { throw 'Task 6 commit is not on upstream' }
```

### Task 7: Track Cache Configuration, Build, and Measure

**Files:**
- Create: `deploy/nginx/airi-web.conf`
- Create: `deploy/nginx/airi-assets-cache.conf`
- Verify: `apps/stage-web/dist/**`
- Verify: working tree and Git history

- [ ] **Step 1: Add the tracked inner Nginx configuration**

Create `deploy/nginx/airi-web.conf` with LF line endings:

```nginx
server {
    listen 5173;
    server_name _;

    root /www/wwwroot/airi-web;
    index index.html;

    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript application/rss+xml application/atom+xml image/svg+xml application/wasm;
    gzip_min_length 1000;

    location = /index.html {
        try_files /index.html =404;
        expires off;
        add_header Cache-Control "no-store, no-cache, must-revalidate, max-age=0" always;
        add_header Pragma "no-cache" always;
    }

    location = /ui/index.html {
        try_files /ui/index.html =404;
        expires off;
        add_header Cache-Control "no-store, no-cache, must-revalidate, max-age=0" always;
        add_header Pragma "no-cache" always;
    }

    location = /sw.js {
        try_files /sw.js =404;
        expires off;
        add_header Cache-Control "no-store, no-cache, must-revalidate, max-age=0" always;
        add_header Pragma "no-cache" always;
    }

    location = /sw.js.map {
        try_files /sw.js.map =404;
        expires off;
        add_header Cache-Control "no-store, no-cache, must-revalidate, max-age=0" always;
        add_header Pragma "no-cache" always;
    }

    location = /manifest.webmanifest {
        try_files /manifest.webmanifest =404;
        expires off;
        add_header Cache-Control "no-store, no-cache, must-revalidate, max-age=0" always;
        add_header Pragma "no-cache" always;
    }

    location ^~ /ui/assets/ {
        try_files $uri =404;
        expires off;
        add_header Cache-Control "public, max-age=31536000, immutable" always;
    }

    location ^~ /assets/js/CubismSdkForWeb- {
        try_files $uri =404;
        expires off;
        add_header Cache-Control "public, max-age=31536000, immutable" always;
    }

    location ~ "^/assets/(?:.*/)?[^/]+-[A-Za-z0-9_-]{8,}\.[^/]+$" {
        try_files $uri =404;
        expires off;
        add_header Cache-Control "public, max-age=31536000, immutable" always;
    }

    location /assets/ {
        try_files $uri =404;
        expires off;
        add_header Cache-Control "no-cache" always;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        try_files $uri =404;
        expires off;
        add_header Cache-Control "public, max-age=3600" always;
    }

    location = /ui {
        try_files /ui/index.html =404;
    }

    location ^~ /ui/ {
        try_files $uri $uri/ /ui/index.html;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:6112;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

The hash regex intentionally excludes unversioned `assets/animadex-catalog.json` and `assets/mmd/animations/*.vmd`; those paths remain revalidated instead of being frozen for a year.

- [ ] **Step 2: Add the public asset proxy include**

Create `deploy/nginx/airi-assets-cache.conf`:

```nginx
location ^~ /assets/js/CubismSdkForWeb- {
    proxy_pass http://127.0.0.1:5173;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_hide_header Cache-Control;
    proxy_hide_header Expires;
    proxy_hide_header Pragma;
    expires off;
    add_header Cache-Control "public, max-age=31536000, immutable" always;
}

location ~ "^/assets/(?:.*/)?[^/]+-[A-Za-z0-9_-]{8,}\.[^/]+$" {
    proxy_pass http://127.0.0.1:5173;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_hide_header Cache-Control;
    proxy_hide_header Expires;
    proxy_hide_header Pragma;
    expires off;
    add_header Cache-Control "public, max-age=31536000, immutable" always;
}

location /assets/ {
    proxy_pass http://127.0.0.1:5173;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_hide_header Cache-Control;
    proxy_hide_header Expires;
    proxy_hide_header Pragma;
    expires off;
    add_header Cache-Control "no-cache" always;
}
```

This file is installed through the public vhost's existing `extension/airi.aifamily.vip/*.conf` include. The longer `/assets/` prefix outranks the generated `location ^~ /` proxy, and the origin's `try_files` guarantees missing assets return 404 instead of SPA HTML.

- [ ] **Step 3: Commit and push the deployable Nginx artifacts**

```powershell
git add deploy/nginx/airi-web.conf deploy/nginx/airi-assets-cache.conf
git diff --cached --check
git commit -m "ops(web): define immutable asset caching"
git push
$head = git rev-parse HEAD
$upstream = git rev-parse '@{u}'
if ($head -ne $upstream) { throw 'Nginx config commit is not on upstream' }
```

- [ ] **Step 4: Confirm the exact branch, commit, environment, and toolchain**

```powershell
if (git status --porcelain) { throw 'Worktree must be clean before verification' }
$branch = git branch --show-current
$head = git rev-parse HEAD
$upstream = git rev-parse '@{u}'
if ($branch -ne 'codex/dasilva-commercial-subscription') { throw "Wrong branch: $branch" }
if ($head -ne $upstream) { throw 'HEAD must equal upstream before build' }
if ((Get-Content 'apps\stage-web\.env.production' -Raw -Encoding UTF8) -notmatch '(?m)^VITE_SERVER_URL=https://airi\.aifamily\.vip\s*$') { throw 'VITE_SERVER_URL is not the production domain' }

$nodeRoot = 'D:\Tools\airi\.node24.local\node-v24.13.0-win-x64'
$env:PATH = "$nodeRoot;$env:PATH"
$nodeVersion = & "$nodeRoot\node.exe" --version
$pnpmVersion = & "$nodeRoot\node.exe" "$nodeRoot\node_modules\corepack\dist\pnpm.js" --version
if ($nodeVersion -ne 'v24.13.0') { throw "Unexpected Node: $nodeVersion" }
if ($pnpmVersion -ne '10.32.1') { throw "Unexpected pnpm: $pnpmVersion" }
```

- [ ] **Step 5: Run all focused tests**

```powershell
$nodeRoot = 'D:\Tools\airi\.node24.local\node-v24.13.0-win-x64'
$env:PATH = "$nodeRoot;$env:PATH"
& "$nodeRoot\node.exe" "$nodeRoot\node_modules\corepack\dist\pnpm.js" -F '@proj-airi/stage-ui' exec vitest run src/components/scenes/runtime.test.ts
& "$nodeRoot\node.exe" "$nodeRoot\node_modules\corepack\dist\pnpm.js" -F '@proj-airi/stage-web' exec vitest run src/modules/app-startup.test.ts src/modules/pwa-cache.test.ts src/modules/pwa-navigation.test.ts src/modules/model-load-recovery.test.ts build/live2d-runtime-archive.test.ts
& "$nodeRoot\node.exe" 'node_modules\vitest\vitest.mjs' run --root packages/stage-ui-live2d src/components/scenes/live2d/model-load-state.test.ts
& "$nodeRoot\node.exe" 'node_modules\vitest\vitest.mjs' run --root packages/stage-ui-spine src/components/scenes/spine/model-load-state.test.ts
```

Expected: all focused tests PASS.

- [ ] **Step 6: Run all affected typechecks**

```powershell
$nodeRoot = 'D:\Tools\airi\.node24.local\node-v24.13.0-win-x64'
$env:PATH = "$nodeRoot;$env:PATH"
& "$nodeRoot\node.exe" "$nodeRoot\node_modules\corepack\dist\pnpm.js" -F '@proj-airi/stage-ui-live2d' typecheck
& "$nodeRoot\node.exe" "$nodeRoot\node_modules\corepack\dist\pnpm.js" -F '@proj-airi/stage-ui-spine' typecheck
& "$nodeRoot\node.exe" "$nodeRoot\node_modules\corepack\dist\pnpm.js" -F '@proj-airi/stage-ui' typecheck
& "$nodeRoot\node.exe" "$nodeRoot\node_modules\corepack\dist\pnpm.js" -F '@proj-airi/stage-web' typecheck
```

Expected: all commands exit 0. A new failure blocks deployment.

- [ ] **Step 7: Build the exact pushed commit**

```powershell
if (git status --porcelain) { throw 'Worktree must be clean before build' }
$head = git rev-parse HEAD
$upstream = git rev-parse '@{u}'
if ($head -ne $upstream) { throw 'HEAD must equal upstream before build' }

$nodeRoot = 'D:\Tools\airi\.node24.local\node-v24.13.0-win-x64'
$env:PATH = "$nodeRoot;$env:PATH"
$env:NODE_OPTIONS = '--max-old-space-size=4096'
& "$nodeRoot\node.exe" "$nodeRoot\node_modules\corepack\dist\pnpm.js" -F '@proj-airi/stage-web' build
if ($LASTEXITCODE -ne 0) { throw 'Stage Web build failed' }
```

Expected: Vite succeeds under Node 24 and `dist/index.html` references a hashed module entry under `/assets/`.

- [ ] **Step 8: Assert artifact, API-domain, and precache budgets**

```powershell
$dist = (Resolve-Path 'apps\stage-web\dist').Path
$free = @(Get-ChildItem "$dist\assets\hiyori_free_zh-*.zip")
$pro = @(Get-ChildItem "$dist\assets\hiyori_pro_zh-*.zip")
$indexHtml = Get-Content (Join-Path $dist 'index.html') -Raw -Encoding UTF8
$entryMatch = [regex]::Match($indexHtml, '<script[^>]+src="/assets/(index-[^"]+\.js)"')
if (-not $entryMatch.Success) { throw 'Could not find the module entry in index.html' }
$indexEntry = Get-Item (Join-Path $dist "assets\$($entryMatch.Groups[1].Value)")
if ($free.Count -ne 1) { throw "Expected one Free ZIP, found $($free.Count)" }
if ($pro.Count -ne 1) { throw "Expected one Pro ZIP, found $($pro.Count)" }
if ($free[0].Length -ge 3.2MB) { throw "Free model too large: $($free[0].Length)" }
if ($pro[0].Length -ge 4.8MB) { throw "Pro model too large: $($pro[0].Length)" }
if (@(Get-ChildItem $dist -Recurse -File -Filter 'duckdb-*.wasm').Count -ne 0) { throw 'DuckDB WASM is still emitted' }

$sw = Get-Content (Join-Path $dist 'sw.js') -Raw -Encoding UTF8
$urls = @([regex]::Matches($sw, 'url:"([^"]+)"') | ForEach-Object { $_.Groups[1].Value })
$precacheBytes = 0
foreach ($url in $urls) {
  $file = Join-Path $dist ([Uri]::UnescapeDataString($url.TrimStart('/')))
  if (Test-Path -LiteralPath $file) { $precacheBytes += (Get-Item -LiteralPath $file).Length }
}
if ($urls.Count -ge 10) { throw "Precache has too many entries: $($urls.Count)" }
if ($precacheBytes -ge 1MB) { throw "Precache is too large: $precacheBytes" }
if ($sw -match 'duckdb|ort-wasm|web_rwkv|worker-') { throw 'Heavy runtime remains in precache' }

$wrongDomain = & rg -a -l 'https://api\.airi\.build' $dist
if ($LASTEXITCODE -eq 0) { throw "Wrong API domain found in: $wrongDomain" }
if ($LASTEXITCODE -gt 1) { throw 'API-domain scan failed' }
$rightDomain = & rg -a -l 'https://airi\.aifamily\.vip' $dist
if ($LASTEXITCODE -ne 0) { throw 'Production API domain is absent from output' }

Get-FileHash (Join-Path $dist 'index.html'), (Join-Path $dist 'sw.js'), $indexEntry.FullName, $free[0].FullName, $pro[0].FullName -Algorithm SHA256
[pscustomobject]@{ FreeBytes = $free[0].Length; ProBytes = $pro[0].Length; PrecacheEntries = $urls.Count; PrecacheBytes = $precacheBytes }
```

Expected: every assertion passes and SHA256 values are retained for the deployment report.

- [ ] **Step 9: Run local cold, warm, retry, fallback, and UI acceptance**

Start the preview in a long-running terminal session:

```powershell
$nodeRoot = 'D:\Tools\airi\.node24.local\node-v24.13.0-win-x64'
$env:PATH = "$nodeRoot;$env:PATH"
& "$nodeRoot\node.exe" "$nodeRoot\node_modules\corepack\dist\pnpm.js" -F '@proj-airi/stage-web' preview --host 127.0.0.1 --port 4173
```

Use the `playwright` skill with a fresh Chromium desktop context at `1440x900`. Record navigation timing, FCP, the first `modelLoaded`/mounted time, requests, transferred bytes, Cache Storage entries/bytes, and screenshots. Assert no DuckDB request, no `api.airi.build`, no page error, a nontransparent character canvas, cold character visibility within 8 seconds, warm visibility within 2 seconds, chat input usability, and settings navigation.

Repeat with route interception: abort only the first Pro ZIP request and confirm one retry succeeds; abort every Pro ZIP request and confirm the Free ZIP loads without changing `localStorage['settings/stage/model']`. In the isolated browser profile, import a small intentionally invalid `.zip` as a custom Live2D model, select it, and confirm the retry UI appears while its custom model ID remains in the same localStorage key. Stop the preview session after collecting evidence.

- [ ] **Step 10: Seed the pre-deployment Service Worker upgrade profile**

Before publishing, use the `playwright` skill to open current production with a dedicated persistent Chromium profile outside the repository. Wait for the current Service Worker installation to settle, then record cache names, entry count, and estimated bytes; confirm the old `workbox-precache` contains hundreds of entries. Preserve this exact profile for Task 8 so the new release is tested as an upgrade rather than a clean install.

- [ ] **Step 11: Request code review and repush confirmed fixes**

Use the `requesting-code-review` skill against the design and this plan. For each accepted finding, add a focused commit, push it, then repeat Steps 4-10 from the new clean upstream-matched HEAD. Do not bundle unrelated cleanup.

### Task 8: Push, Deploy, and Apply Static Cache Rules

**Files/servers:**
- Deploy source: pushed GitHub branch `fork/codex/dasilva-commercial-subscription`
- Web root: `/www/wwwroot/airi-web`
- Preserve: `/www/wwwroot/airi-web/ui`
- Active inner Nginx: `/www/server/panel/vhost/nginx/airi-web.conf`
- Public extension target: `/www/server/panel/vhost/nginx/extension/airi.aifamily.vip/airi-assets-cache.conf`
- Read-only evidence: `/www/server/panel/vhost/nginx/airi.aifamily.vip.conf` and its generated proxy include
- Inactive legacy copy: `/www/server/nginx/conf/vhost/airi-web.conf` (do not deploy to it; `nginx -T` does not load it)

- [ ] **Step 1: Rebuild and verify the exact deployable commit**

```powershell
git push
if (git status --porcelain) { throw 'Worktree must be clean before deployment' }
$branch = git branch --show-current
$sha = git rev-parse HEAD
$upstream = git rev-parse '@{u}'
if ($branch -ne 'codex/dasilva-commercial-subscription') { throw "Wrong branch: $branch" }
if ($sha -ne $upstream) { throw 'HEAD does not match upstream' }
if ((Get-Content 'apps\stage-web\.env.production' -Raw -Encoding UTF8) -notmatch '(?m)^VITE_SERVER_URL=https://airi\.aifamily\.vip\s*$') { throw 'VITE_SERVER_URL is not the production domain' }

$nodeRoot = 'D:\Tools\airi\.node24.local\node-v24.13.0-win-x64'
$env:PATH = "$nodeRoot;$env:PATH"
$env:NODE_OPTIONS = '--max-old-space-size=4096'
& "$nodeRoot\node.exe" "$nodeRoot\node_modules\corepack\dist\pnpm.js" -F '@proj-airi/stage-web' build
if ($LASTEXITCODE -ne 0) { throw 'Stage Web build failed' }

$dist = (Resolve-Path 'apps\stage-web\dist').Path
$free = @(Get-ChildItem "$dist\assets\hiyori_free_zh-*.zip")
$pro = @(Get-ChildItem "$dist\assets\hiyori_pro_zh-*.zip")
if ($free.Count -ne 1 -or $free[0].Length -ge 3.2MB) { throw 'Free model artifact is missing, duplicated, or oversized' }
if ($pro.Count -ne 1 -or $pro[0].Length -ge 4.8MB) { throw 'Pro model artifact is missing, duplicated, or oversized' }
if (@(Get-ChildItem $dist -Recurse -File -Filter 'duckdb-*.wasm').Count -ne 0) { throw 'DuckDB WASM is still emitted' }
$sw = Get-Content (Join-Path $dist 'sw.js') -Raw -Encoding UTF8
if ($sw -match 'duckdb|ort-wasm|web_rwkv|worker-') { throw 'Heavy runtime remains in precache' }
$urls = @([regex]::Matches($sw, 'url:"([^"]+)"') | ForEach-Object { $_.Groups[1].Value })
$precacheBytes = 0
foreach ($url in $urls) {
  $file = Join-Path $dist ([Uri]::UnescapeDataString($url.TrimStart('/')))
  if (Test-Path -LiteralPath $file) { $precacheBytes += (Get-Item -LiteralPath $file).Length }
}
if ($urls.Count -ge 10 -or $precacheBytes -ge 1MB) { throw "Precache budget exceeded: $($urls.Count) entries / $precacheBytes bytes" }
$wrongDomain = & rg -a -l 'https://api\.airi\.build' $dist
if ($LASTEXITCODE -eq 0) { throw "Wrong API domain found in: $wrongDomain" }
if ($LASTEXITCODE -gt 1) { throw 'API-domain scan failed' }
[pscustomobject]@{ Branch = $branch; SHA = $sha; FreeBytes = $free[0].Length; ProBytes = $pro[0].Length; PrecacheEntries = $urls.Count; PrecacheBytes = $precacheBytes }
```

Expected: clean upstream-matched branch, successful Node 24 build, exact production API domain, and all artifact assertions pass.

- [ ] **Step 2: Package, hash, verify, and upload the build**

```powershell
$sha = git rev-parse HEAD
$dist = (Resolve-Path 'apps\stage-web\dist').Path
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$archive = Join-Path $env:TEMP "airi-stage-web-$sha-$stamp.tar.gz"
tar.exe -czf $archive -C $dist .
if ($LASTEXITCODE -ne 0) { throw 'Failed to create Web archive' }
$listing = tar.exe -tzf $archive
if ($listing -notcontains './index.html' -or $listing -notcontains './sw.js') { throw 'Archive does not contain dist contents at its root' }
$archiveHash = (Get-FileHash $archive -Algorithm SHA256).Hash
scp $archive "airi-vps:/tmp/airi-stage-web-$sha.tar.gz"
if ($LASTEXITCODE -ne 0) { throw 'Failed to upload Web archive' }
[pscustomobject]@{ Archive = $archive; SHA256 = $archiveHash; Bytes = (Get-Item $archive).Length }
```

Expected: the tar root contains `index.html` and `sw.js`; its SHA256 and byte length are recorded; upload succeeds.

- [ ] **Step 3: Prove the loaded Nginx path and back up all mutable production state**

```powershell
$loadedConfig = ssh airi-vps '/www/server/nginx/sbin/nginx -T 2>&1 | grep "configuration file /www/server/panel/vhost/nginx/airi-web.conf"'
if ($loadedConfig -notmatch '/www/server/panel/vhost/nginx/airi-web.conf') { throw 'Expected 5173 vhost is not loaded' }

$sha = git rev-parse HEAD
$backupScript = @'
set -eu
sha="$1"
stamp="$(date +%Y%m%d-%H%M%S)"
dir="/root/deploy-backups/character-first-${sha}-${stamp}"
mkdir -p "$dir/airi-web"
sha256sum /root/airi/apps/server/.env /root/airi/apps/server/.env.local > "$dir/server-env.sha256"
cp -a /www/server/panel/vhost/nginx/airi-web.conf "$dir/airi-web.active.conf"
cp -a /www/server/panel/vhost/nginx/airi.aifamily.vip.conf "$dir/airi.aifamily.vip.conf"
cp -a /www/server/panel/vhost/nginx/proxy/airi.aifamily.vip/53e297e9349176562d00e63740050ce6_airi.aifamily.vip.conf "$dir/public-proxy.conf"
if test -f /www/server/panel/vhost/nginx/extension/airi.aifamily.vip/airi-assets-cache.conf; then
  cp -a /www/server/panel/vhost/nginx/extension/airi.aifamily.vip/airi-assets-cache.conf "$dir/airi-assets-cache.previous.conf"
else
  touch "$dir/airi-assets-cache.was-absent"
fi
rsync -a /www/wwwroot/airi-web/ "$dir/airi-web/"
test -f "$dir/airi-web/index.html"
test -f "$dir/airi-web/ui/index.html"
printf '%s\n' "$dir"
'@
$backupDir = ($backupScript | ssh airi-vps "bash -s -- $sha").Trim()
if ($LASTEXITCODE -ne 0 -or $backupDir -notmatch "^/root/deploy-backups/character-first-$sha-") { throw 'Production backup failed' }
$backupDir
```

Expected: `nginx -T` proves the active path; the backup contains both server env hashes, current Nginx files, the complete Web root, and Auth UI. Do not continue if any backup assertion fails.

- [ ] **Step 4: Install the tracked Nginx files without touching generated vhosts**

```powershell
$sha = git rev-parse HEAD
scp deploy/nginx/airi-web.conf "airi-vps:/tmp/airi-web-$sha.conf"
scp deploy/nginx/airi-assets-cache.conf "airi-vps:/tmp/airi-assets-cache-$sha.conf"
if ($LASTEXITCODE -ne 0) { throw 'Failed to upload Nginx files' }

$installScript = @'
set -eu
sha="$1"
mkdir -p /www/server/panel/vhost/nginx/extension/airi.aifamily.vip
install -m 0644 "/tmp/airi-web-${sha}.conf" /www/server/panel/vhost/nginx/airi-web.conf
install -m 0644 "/tmp/airi-assets-cache-${sha}.conf" /www/server/panel/vhost/nginx/extension/airi.aifamily.vip/airi-assets-cache.conf
'@
$installScript | ssh airi-vps "bash -s -- $sha"
if ($LASTEXITCODE -ne 0) { throw 'Failed to install Nginx files' }
```

Do not edit `/www/server/panel/vhost/nginx/airi.aifamily.vip.conf`, its generated proxy include, or the inactive `/www/server/nginx/conf/vhost/airi-web.conf`.

- [ ] **Step 5: Validate Nginx and restore configs automatically on failure**

```powershell
ssh airi-vps '/www/server/nginx/sbin/nginx -t'
if ($LASTEXITCODE -ne 0) {
  $sha = git rev-parse HEAD
  $backupDir = (ssh airi-vps "ls -dt /root/deploy-backups/character-first-$sha-* | head -n 1").Trim()
  $restoreScript = @'
set -eu
dir="$1"
cp -a "$dir/airi-web.active.conf" /www/server/panel/vhost/nginx/airi-web.conf
if test -f "$dir/airi-assets-cache.was-absent"; then
  rm -f /www/server/panel/vhost/nginx/extension/airi.aifamily.vip/airi-assets-cache.conf
else
  cp -a "$dir/airi-assets-cache.previous.conf" /www/server/panel/vhost/nginx/extension/airi.aifamily.vip/airi-assets-cache.conf
fi
/www/server/nginx/sbin/nginx -t
'@
  $restoreScript | ssh airi-vps "bash -s -- $backupDir"
  throw 'Nginx validation failed; previous configs were restored'
}
```

Expected: `syntax is ok` and `test is successful`. A failure restores the prior files and stops before publish or reload.

- [ ] **Step 6: Extract and publish Web assets while preserving Auth UI**

```powershell
$sha = git rev-parse HEAD
$releaseDir = (ssh airi-vps "mktemp -d /tmp/airi-stage-web-$sha-XXXXXX").Trim()
if ($LASTEXITCODE -ne 0 -or $releaseDir -notmatch "^/tmp/airi-stage-web-$sha-") { throw 'Failed to create remote release directory' }
ssh airi-vps "tar -xzf /tmp/airi-stage-web-$sha.tar.gz -C $releaseDir"
ssh airi-vps "test -f $releaseDir/index.html && test -f $releaseDir/sw.js"
if ($LASTEXITCODE -ne 0) { throw 'Remote archive extraction failed' }
ssh airi-vps "rsync -a --delete --exclude=/ui/*** $releaseDir/ /www/wwwroot/airi-web/"
if ($LASTEXITCODE -ne 0) { throw 'Web publish failed' }
ssh airi-vps 'test -f /www/wwwroot/airi-web/index.html && test -f /www/wwwroot/airi-web/ui/index.html'
if ($LASTEXITCODE -ne 0) { throw 'Main or Auth UI index is missing after publish' }
```

Expected: the main root exactly matches the new dist except for the preserved `/ui/***` subtree; both index files exist.

- [ ] **Step 7: Reload Nginx only**

```powershell
ssh airi-vps '/www/server/nginx/sbin/nginx -s reload'
```

Do not restart `airi-api` and do not touch `oai-reverse-proxy`; this release contains no backend runtime change.

- [ ] **Step 8: Verify server processes, endpoints, cache safety, and environment integrity**

```powershell
$sha = git rev-parse HEAD
$backupDir = (ssh airi-vps "ls -dt /root/deploy-backups/character-first-$sha-* | head -n 1").Trim()
ssh airi-vps "cd / && sha256sum -c $backupDir/server-env.sha256"
if ($LASTEXITCODE -ne 0) { throw 'Server environment files changed' }

$pm2 = ssh airi-vps 'export PATH=/www/server/nvm/versions/node/v22.20.0/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin; /www/server/nvm/versions/node/v22.20.0/bin/pm2 ls; /www/server/nvm/versions/node/v22.20.0/bin/pm2 describe airi-api'
if ($pm2 -notmatch 'airi-api' -or $pm2 -notmatch 'online' -or $pm2 -notmatch '22\.20\.0') { throw 'airi-api is not online under Node 22.20.0' }

function Assert-Http200([string]$Url) {
  $status = curl.exe -sS -o NUL -w '%{http_code}' $Url
  if ($status -ne '200') { throw "$Url returned $status" }
}
Assert-Http200 'https://airi.aifamily.vip/'
Assert-Http200 'https://airi.aifamily.vip/api/auth/get-session'
Assert-Http200 'https://airi.aifamily.vip/ui/sign-in'

$rootHtml = curl.exe -sS https://airi.aifamily.vip/
$localHtml = Get-Content 'apps\stage-web\dist\index.html' -Raw -Encoding UTF8
$entryMatch = [regex]::Match($localHtml, '<script[^>]+src="/assets/(index-[^"]+\.js)"')
if (-not $entryMatch.Success) { throw 'Local build entry was not found' }
$entryName = $entryMatch.Groups[1].Value
if ($rootHtml -notmatch [regex]::Escape("/assets/$entryName")) { throw 'Production HTML does not reference the deployed index bundle' }
$authHtml = curl.exe -sS https://airi.aifamily.vip/ui/sign-in
if ($authHtml -notmatch '/ui/assets/index-[^"'']+\.js') { throw 'Auth UI route did not return the Auth UI shell' }

$free = @(Get-ChildItem 'apps\stage-web\dist\assets\hiyori_free_zh-*.zip')
$indexUrl = "https://airi.aifamily.vip/assets/$entryName"
$freeUrl = "https://airi.aifamily.vip/assets/$($free[0].Name)"
$indexHeaders = curl.exe -sS -D - -o NUL $indexUrl
$freeHeadersFirst = curl.exe -sS -D - -o NUL $freeUrl
$freeHeadersSecond = curl.exe -sS -D - -o NUL $freeUrl
if ($indexHeaders -notmatch 'Cache-Control:\s*public, max-age=31536000, immutable') { throw 'Index bundle is not immutable' }
if ($freeHeadersFirst -notmatch 'Cache-Control:\s*public, max-age=31536000, immutable') { throw 'Free model ZIP is not immutable' }
if ($freeHeadersSecond -notmatch 'Cf-Cache-Status:\s*(HIT|REVALIDATED)') { throw 'Cloudflare did not cache or revalidate the model ZIP' }

$rootHeaders = curl.exe -sS -D - -o NUL https://airi.aifamily.vip/
$swHeaders = curl.exe -sS -D - -o NUL https://airi.aifamily.vip/sw.js
if ($rootHeaders -match 'immutable' -or $swHeaders -match 'immutable') { throw 'HTML or Service Worker was incorrectly made immutable' }
$unhashedHeaders = curl.exe -sS -D - -o NUL https://airi.aifamily.vip/assets/animadex-catalog.json
if ($unhashedHeaders -match 'immutable') { throw 'Unhashed asset was incorrectly made immutable' }
$missingStatus = curl.exe -sS -o NUL -w '%{http_code}' https://airi.aifamily.vip/assets/missing-deadbeef.js
if ($missingStatus -ne '404') { throw "Missing asset returned $missingStatus instead of 404" }
```

Expected:

- Env hashes pass `sha256sum -c`; `airi-api` remains online under Node 22.20.0.
- Root, session API, and actual Auth UI shell return 200.
- Root HTML references the local build's exact index hash.
- Hashed JS and Hiyori ZIP are one-year immutable; a second ZIP request reaches Cloudflare cache or revalidation.
- HTML, Service Worker, and unhashed assets are not immutable; a missing asset returns 404.

- [ ] **Step 9: Verify the real Service Worker upgrade path**

Using the persistent profile seeded in Task 7, open production normally and wait for the new Service Worker to activate. Confirm the old hundreds-entry precache is reduced to the explicit small precache plus resources actually requested in runtime caches, and record cache names/count/bytes. Verify the page changes from the old index hash to the new one without a blank screen, then test both an ordinary reload and a hard reload (`Ctrl+F5`) in the same profile.

- [ ] **Step 10: Run fresh production browser acceptance**

Use the `playwright` skill with a fresh `1440x900` desktop context. Record navigation timing, FCP, model-loaded time, request count, transferred bytes, and Cache Storage usage for cold and warm loads. Verify no page error, no `Electron ipcRenderer` error, no `api.airi.build`, no DuckDB request, a nontransparent visible character canvas, cold character visibility within 8 seconds, warm visibility within 2 seconds, a usable chat input, and working settings navigation.

Repeat the production request-interception checks from Task 7: one failed Pro request retries once and repeated Pro failures load Free. In this disposable context, import and select the same intentionally invalid custom Live2D ZIP; verify its failures expose the retry UI and leave `localStorage['settings/stage/model']` on that custom ID.

- [ ] **Step 11: Report deployment and exact rollback**

The final report must include:

- GitHub remote `riverben-max/airi`.
- Branch `codex/dasilva-commercial-subscription`.
- Exact commit SHA.
- Node 24 / pnpm 10.32.1 build command.
- Deployment time in Asia/Shanghai.
- Nginx backup directory.
- Build archive SHA256 and deployed asset hashes.
- Before/after cold and warm timing.
- Model ZIP sizes and Service Worker cache count/bytes.
- Endpoint, cache header, browser, and environment-hash results.
- Confirmation that `/www/server/nginx/conf/vhost/airi-web.conf` was not modified because it is inactive.

Record this rollback command sequence with the concrete backup path; do not execute it after a successful deployment:

```powershell
$sha = git rev-parse HEAD
$backupDir = (ssh airi-vps "ls -dt /root/deploy-backups/character-first-$sha-* | head -n 1").Trim()
$rollbackScript = @'
set -eu
dir="$1"
rsync -a --delete "$dir/airi-web/" /www/wwwroot/airi-web/
cp -a "$dir/airi-web.active.conf" /www/server/panel/vhost/nginx/airi-web.conf
if test -f "$dir/airi-assets-cache.was-absent"; then
  rm -f /www/server/panel/vhost/nginx/extension/airi.aifamily.vip/airi-assets-cache.conf
else
  cp -a "$dir/airi-assets-cache.previous.conf" /www/server/panel/vhost/nginx/extension/airi.aifamily.vip/airi-assets-cache.conf
fi
/www/server/nginx/sbin/nginx -t
/www/server/nginx/sbin/nginx -s reload
sha256sum -c "$dir/server-env.sha256"
'@
$rollbackScript | ssh airi-vps "bash -s -- $backupDir"
```

Rollback restores the complete previous Web snapshot including Auth UI, both changed Nginx files, and reloads only Nginx. It does not restart or alter either PM2 process.
