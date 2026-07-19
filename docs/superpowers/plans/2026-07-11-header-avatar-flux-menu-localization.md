# Header Avatar Flux Menu Localization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the authenticated avatar menu's Flux balance and subscription link, and localize all menu and session feedback text without adding a settings-home subscription card.

**Architecture:** Keep the change inside the existing `HeaderAvatar.vue` component and existing `settings` locale namespace. Add a source-contract regression test following the package's current Vitest pattern, then port the smallest known-good balance/link behavior and replace hardcoded menu strings with i18n keys.

**Tech Stack:** Vue 3 Composition API, Pinia, Vue I18n, Vue Router, Vitest, pnpm 10.32.1, Node.js 24 for frontend build.

---

## File Map

- Create `packages/stage-layouts/src/components/Layouts/HeaderAvatar.test.ts`: regression contract for the Flux link, balance display, i18n calls, and locale entries.
- Modify `packages/stage-layouts/src/components/Layouts/HeaderAvatar.vue`: read Flux credits, render the subscription entry, and replace hardcoded menu/session strings.
- Modify `packages/i18n/src/locales/en/settings.yaml`: add the missing session-menu messages.
- Modify `packages/i18n/src/locales/zh-Hans/settings.yaml`: add Chinese session-menu messages and correct `signedInAs`.
- Do not modify `packages/stage-pages/src/pages/settings/index.vue` or the Flux subscription implementation.

### Task 1: Add the failing avatar-menu regression contract

**Files:**
- Create: `packages/stage-layouts/src/components/Layouts/HeaderAvatar.test.ts`
- Read: `packages/stage-layouts/src/components/Layouts/HeaderAvatar.vue`
- Read: `packages/i18n/src/locales/en/settings.yaml`
- Read: `packages/i18n/src/locales/zh-Hans/settings.yaml`

- [ ] **Step 1: Create the source-contract test**

```ts
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

function read(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')
}

describe('header avatar account menu', () => {
  const source = read('./HeaderAvatar.vue')
  const enSettings = read('../../../../i18n/src/locales/en/settings.yaml')
  const zhHansSettings = read('../../../../i18n/src/locales/zh-Hans/settings.yaml')

  it('keeps the Flux balance and subscription entry discoverable', () => {
    expect(source).toContain('const { isAuthenticated, user, credits } = storeToRefs(authStore)')
    expect(source).toContain('const formattedCredits = computed(() => credits.value.toLocaleString())')
    expect(source).toContain('{{ formattedCredits }} Flux')
    expect(source).toContain('to="/settings/flux"')
  })

  it('uses localized account-menu and session feedback text', () => {
    expect(source).toContain('t(\'settings.pages.account.signedInAs\')')
    expect(source).toContain('t(\'settings.pages.account.activeSessions\')')
    expect(source).toContain('t(\'settings.pages.flux.title\')')
    expect(source).toContain('t(\'settings.title\')')
    expect(source).toContain('t(\'settings.pages.account.logout\')')
    expect(source).toContain('t(\'settings.pages.account.activeSessionsCount\', { count: sessions.length })')
    expect(source).toContain('t(\'settings.pages.account.sessionListErrorFallback\')')

    expect(source).not.toMatch(/>\s*(Signed in as|Active Sessions|Settings|Logout)\s*</)
    expect(source).not.toContain('You have ${sessions.length} active sessions.')
    expect(source).not.toContain('An unknown error occurred')
  })

  it('defines the new English and Simplified Chinese locale entries', () => {
    expect(enSettings).toContain('activeSessions: Active sessions')
    expect(enSettings).toContain('activeSessionsCount: \'You have {count} active sessions.\'')
    expect(enSettings).toContain('sessionListErrorFallback: Could not load active sessions.')

    expect(zhHansSettings).toContain('signedInAs: 已登录为')
    expect(zhHansSettings).toContain('activeSessions: 活跃会话')
    expect(zhHansSettings).toContain('activeSessionsCount: \'当前共有 {count} 个活跃会话。\'')
    expect(zhHansSettings).toContain('sessionListErrorFallback: 无法加载活跃会话，请稍后重试。')
  })
})
```

- [ ] **Step 2: Verify the test fails for the reported regression**

Run in PowerShell:

```powershell
& 'D:\Tools\airi\.node24.local\node-v24.13.0-win-x64\node.exe' 'D:\Tools\airi\.node24.local\node-v24.13.0-win-x64\node_modules\corepack\dist\pnpm.js' -F @proj-airi/stage-layouts exec vitest run src/components/Layouts/HeaderAvatar.test.ts
```

Expected: FAIL because `HeaderAvatar.vue` does not read `credits`, does not contain `to="/settings/flux"`, still contains the four English literals, and the new locale keys do not exist.

### Task 2: Restore the Flux entry and localize the menu

**Files:**
- Modify: `packages/stage-layouts/src/components/Layouts/HeaderAvatar.vue`
- Modify: `packages/i18n/src/locales/en/settings.yaml`
- Modify: `packages/i18n/src/locales/zh-Hans/settings.yaml`
- Test: `packages/stage-layouts/src/components/Layouts/HeaderAvatar.test.ts`

- [ ] **Step 1: Read and format the Flux balance from the auth store**

Change the store refs and add the computed formatter:

```ts
const { isAuthenticated, user, credits } = storeToRefs(authStore)
const { isDark, toggleDark } = useTheme()
const { t } = useI18n()
const userName = computed(() => user.value?.name)
const userAvatar = computed(() => user.value?.image)
const formattedCredits = computed(() => credits.value.toLocaleString())
```

- [ ] **Step 2: Localize session feedback**

Replace `handleListSessions()` with:

```ts
async function handleListSessions() {
  try {
    const { data: sessions } = await listSessions()
    if (sessions) {
      toast.success(t('settings.pages.account.activeSessionsCount', { count: sessions.length }))
    }
  }
  catch (error) {
    toast.error(error instanceof Error ? error.message : t('settings.pages.account.sessionListErrorFallback'))
  }
}
```

- [ ] **Step 3: Restore the balance and subscription link and localize visible labels**

Render the balance below the username:

```vue
<div class="mt-1 flex items-center gap-1.5 text-xs text-primary-600 font-medium dark:text-primary-400">
  <div class="i-solar:battery-charge-bold-duotone text-sm" />
  <span>{{ formattedCredits }} Flux</span>
</div>
```

Replace visible literals with:

```vue
{{ t('settings.pages.account.signedInAs') }}
{{ t('settings.pages.account.activeSessions') }}
{{ t('settings.title') }}
{{ t('settings.pages.account.logout') }}
```

Insert this route link between active sessions and settings:

```vue
<RouterLink
  to="/settings/flux"
  class="group w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-neutral-700 transition hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
  @click="showDropdown = false"
>
  <div class="i-solar:battery-charge-bold-duotone text-lg text-neutral-400 transition group-hover:text-primary-500" />
  {{ t('settings.pages.flux.title') }}
</RouterLink>
```

- [ ] **Step 4: Add English locale entries**

Under `pages.account`, keep the existing account keys and add:

```yaml
activeSessions: Active sessions
activeSessionsCount: 'You have {count} active sessions.'
sessionListErrorFallback: Could not load active sessions.
```

- [ ] **Step 5: Add Simplified Chinese locale entries and correct `signedInAs`**

Under `pages.account`, use:

```yaml
signedInAs: 已登录为
activeSessions: 活跃会话
activeSessionsCount: '当前共有 {count} 个活跃会话。'
sessionListErrorFallback: 无法加载活跃会话，请稍后重试。
```

- [ ] **Step 6: Verify the focused regression test passes**

Run:

```powershell
& 'D:\Tools\airi\.node24.local\node-v24.13.0-win-x64\node.exe' 'D:\Tools\airi\.node24.local\node-v24.13.0-win-x64\node_modules\corepack\dist\pnpm.js' -F @proj-airi/stage-layouts exec vitest run src/components/Layouts/HeaderAvatar.test.ts
```

Expected: PASS, 3 tests passed.

- [ ] **Step 7: Run package type checks**

```powershell
& 'D:\Tools\airi\.node24.local\node-v24.13.0-win-x64\node.exe' 'D:\Tools\airi\.node24.local\node-v24.13.0-win-x64\node_modules\corepack\dist\pnpm.js' -F @proj-airi/stage-layouts typecheck
& 'D:\Tools\airi\.node24.local\node-v24.13.0-win-x64\node.exe' 'D:\Tools\airi\.node24.local\node-v24.13.0-win-x64\node_modules\corepack\dist\pnpm.js' -F @proj-airi/stage-web typecheck
```

Expected: both commands exit 0 with no TypeScript errors.

- [ ] **Step 8: Verify encoding and diff integrity**

Run `git diff --check`, then verify every modified Chinese text file has no UTF-8 BOM and no CRLF bytes.

Expected: `git diff --check` exits 0; `HasBom` is `False`; `CrLfCount` is `0`.

- [ ] **Step 9: Commit the implementation**

```powershell
git add -- 'packages/stage-layouts/src/components/Layouts/HeaderAvatar.vue' 'packages/stage-layouts/src/components/Layouts/HeaderAvatar.test.ts' 'packages/i18n/src/locales/en/settings.yaml' 'packages/i18n/src/locales/zh-Hans/settings.yaml'
git commit -m "fix(web): restore localized Flux account menu"
```

Expected: one implementation commit containing only the four files above.

### Task 3: Build, publish, and verify production

**Files:**
- Build input: committed repository HEAD
- Build output: `apps/stage-web/dist`
- Deployment target: `/www/wwwroot/airi-web`
- Preserved target: `/www/wwwroot/airi-web/ui`

- [ ] **Step 1: Run the production build with project-pinned Node 24 and pnpm**

```powershell
$env:NODE_OPTIONS = '--max-old-space-size=4096'
& 'D:\Tools\airi\.node24.local\node-v24.13.0-win-x64\node.exe' 'D:\Tools\airi\.node24.local\node-v24.13.0-win-x64\node_modules\corepack\dist\pnpm.js' -F @proj-airi/stage-web build
```

Expected: exit 0 and a fresh `apps/stage-web/dist/index.html` referencing `/assets/index-*.js`.

- [ ] **Step 2: Verify the production bundle configuration**

Run:

```powershell
rg -n -F 'api.airi.build' 'apps/stage-web/dist/assets'
Select-String -Path 'apps/stage-web/.env.production' -SimpleMatch 'VITE_SERVER_URL=https://airi.aifamily.vip'
```

Expected: `rg` exits 1 with no matches; `Select-String` prints the configured production server URL.

- [ ] **Step 3: Push the exact commit that will be deployed**

```powershell
git push fork codex/dasilva-commercial-subscription
$commitSha = git rev-parse HEAD
$upstreamSha = git rev-parse '@{u}'
if ($commitSha -ne $upstreamSha) { throw "HEAD $commitSha does not match upstream $upstreamSha" }
```

Expected: push succeeds and local HEAD equals upstream.

- [ ] **Step 4: Record server environment hashes before deployment**

```powershell
$envHashesBefore = ssh airi-vps 'sha256sum /root/airi/apps/server/.env /root/airi/apps/server/.env.local'
$envHashesBefore
```

Expected: two SHA-256 lines, retained in `$envHashesBefore` for the after-deployment comparison.

- [ ] **Step 5: Back up the current Web root**

Run:

```powershell
$deployTimestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupPath = "/root/deploy-backups/airi-web-$deployTimestamp"
ssh airi-vps "mkdir -p '$backupPath'"
ssh airi-vps "rsync -a /www/wwwroot/airi-web/ '$backupPath/'"
ssh airi-vps "test -f '$backupPath/index.html'"
```

Expected: all commands exit 0 and `$backupPath/index.html` exists.

- [ ] **Step 6: Package and upload the build**

Run:

```powershell
$archive = Join-Path $env:TEMP "airi-web-$commitSha.tar.gz"
$remoteArchive = "/tmp/airi-web-$commitSha.tar.gz"
$stagingPath = "/tmp/airi-web-$commitSha"
tar -czf $archive -C 'D:\Tools\airi\apps\stage-web\dist' .
scp $archive "airi-vps:$remoteArchive"
ssh airi-vps "mkdir -p '$stagingPath'"
ssh airi-vps "tar -xzf '$remoteArchive' -C '$stagingPath'"
ssh airi-vps "test -f '$stagingPath/index.html'"
```

Expected: all commands exit 0 and the staged `index.html` exists.

- [ ] **Step 7: Publish while preserving Auth UI**

Run:

```powershell
ssh airi-vps "rsync -a --delete --exclude='/ui/***' '$stagingPath/' /www/wwwroot/airi-web/"
ssh airi-vps 'test -f /www/wwwroot/airi-web/ui/sign-in.html -o -f /www/wwwroot/airi-web/ui/index.html'
```

Expected: the Stage Web root is replaced, while `/www/wwwroot/airi-web/ui` remains intact. Do not restart `airi-api` because this deployment changes only Web static assets.

- [ ] **Step 8: Verify server state and HTTP endpoints**

Run:

```powershell
$node22Path = '/www/server/nvm/versions/node/v22.20.0/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'
ssh airi-vps "export PATH=$node22Path && /www/server/nvm/versions/node/v22.20.0/bin/pm2 ls"
ssh airi-vps "export PATH=$node22Path && /www/server/nvm/versions/node/v22.20.0/bin/pm2 describe airi-api"
(Invoke-WebRequest -Uri 'https://airi.aifamily.vip/' -UseBasicParsing).StatusCode
(Invoke-WebRequest -Uri 'https://airi.aifamily.vip/api/auth/get-session' -UseBasicParsing).StatusCode
(Invoke-WebRequest -Uri 'https://airi.aifamily.vip/ui/sign-in' -UseBasicParsing).StatusCode
$rootHtml = (Invoke-WebRequest -Uri 'https://airi.aifamily.vip/' -UseBasicParsing).Content
$assetName = [regex]::Match($rootHtml, '/assets/index-[^"'']+\.js').Value
if (-not $assetName) { throw 'Root HTML does not reference an index asset' }
$assetName
```

Expected: `airi-api` is online, `pm2 describe` reports Node.js 22.20.0, all three HTTP status codes are 200, and `$assetName` is the newly built `/assets/index-*.js`.

- [ ] **Step 9: Confirm server environment files are unchanged**

Re-run:

```powershell
$envHashesAfter = ssh airi-vps 'sha256sum /root/airi/apps/server/.env /root/airi/apps/server/.env.local'
if (($envHashesBefore -join "`n") -ne ($envHashesAfter -join "`n")) { throw 'Server environment hashes changed during Web deployment' }
$envHashesAfter
```

Expected: both hashes exactly match Step 4.

- [ ] **Step 10: Verify the authenticated desktop UI in a real browser**

Open `https://airi.aifamily.vip/` with a desktop viewport and an authenticated account. Confirm the avatar menu shows Chinese labels, a formatted Flux balance, and the Flux link; click it and confirm `/settings/flux` displays the subscription surface. Confirm there are no page errors, no `Electron ipcRenderer` errors, and no requests to `api.airi.build`.

- [ ] **Step 11: Record deployment evidence**

Include these concrete values in the completion report: remote `fork`, branch `codex/dasilva-commercial-subscription`, `$commitSha`, the Node 24 build command from Step 1, `$deployTimestamp`, `$backupPath`, `$assetName`, the three HTTP 200 results, the matching before/after environment hashes, and the authenticated browser verification result.
