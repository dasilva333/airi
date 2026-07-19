# Returning User Authentication Redirect Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redirect Stage Web returning users with no valid session into the existing OIDC login flow while preserving the first-time welcome flow and allowing the OIDC callback to finish.

**Architecture:** Make the existing auth-store initialization return one stable Promise so callers can wait for refresh/session restoration without racing local cached state. Add a small Stage Web orchestration helper that bypasses first-time onboarding and `/auth/callback`, waits for auth readiness, then starts `authStore.requestLogin()` only when the restored state is unauthenticated.

**Tech Stack:** TypeScript, Vue 3 Composition API, Pinia, Vitest, Vite, Playwright CLI.

---

## File Structure

- Modify `packages/stage-ui/src/stores/auth.ts`: expose an awaitable, single-flight `initialize()` result and completion state without changing existing automatic initialization.
- Create `packages/stage-ui/src/stores/auth-initialization.test.ts`: prove concurrent callers share the same initialization and that completion is observable only after session restoration finishes.
- Create `apps/stage-web/src/modules/returning-user-login.ts`: own the Web-only decision and sequencing for automatic returning-user login.
- Create `apps/stage-web/src/modules/returning-user-login.test.ts`: cover first-time, callback, authenticated, unauthenticated, ordering, and error cases.
- Modify `apps/stage-web/src/App.vue`: invoke the Web-only helper before Stage services initialize.
- Modify `apps/stage-web/src/modules/app-startup.test.ts`: keep a structural regression check that the auth gate runs before Stage initialization.

### Task 1: Make Auth Initialization Awaitable

**Files:**
- Create: `packages/stage-ui/src/stores/auth-initialization.test.ts`
- Modify: `packages/stage-ui/src/stores/auth.ts`

- [ ] **Step 1: Write the failing initialization test**

Create `packages/stage-ui/src/stores/auth-initialization.test.ts`:

```ts
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from './auth'

const mocks = vi.hoisted(() => ({
  fetchSession: vi.fn(),
  refreshAccessToken: vi.fn(),
  triggerSignIn: vi.fn(),
}))

vi.mock('@proj-airi/stage-shared', () => ({
  isStageTamagotchi: () => false,
}))

vi.mock('../composables/api', () => ({
  client: { api: { v1: { flux: { $get: vi.fn() } } } },
}))

vi.mock('../composables/use-breakpoints', async () => {
  const { shallowRef } = await import('vue')
  return { useBreakpoints: () => ({ isMobile: shallowRef(false) }) }
})

vi.mock('../libs/auth', () => ({
  fetchSession: mocks.fetchSession,
  triggerSignIn: mocks.triggerSignIn,
}))

vi.mock('../libs/auth-oidc', () => ({
  refreshAccessToken: mocks.refreshAccessToken,
}))

describe('auth initialization', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('shares the in-flight initialization and resolves only after session restoration', async () => {
    let finishSessionRestore!: () => void
    mocks.fetchSession.mockImplementationOnce(() => new Promise<boolean>((resolve) => {
      finishSessionRestore = () => resolve(false)
    }))

    const store = useAuthStore()
    const first = store.initialize()
    const second = store.initialize()

    expect(first).toBe(second)
    expect(store.initialized).toBe(false)
    await vi.waitFor(() => expect(mocks.fetchSession).toHaveBeenCalledOnce())

    finishSessionRestore()
    await first

    expect(store.initialized).toBe(true)
    await store.initialize()
    expect(mocks.fetchSession).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run the test and verify RED**

Run from `D:\Tools\airi`:

```powershell
& 'D:\Tools\airi\.node24.local\node-v24.13.0-win-x64\node.exe' 'D:\Tools\airi\.node24.local\node-v24.13.0-win-x64\node_modules\corepack\dist\pnpm.js' -F @proj-airi/stage-ui exec vitest run src/stores/auth-initialization.test.ts
```

Expected: FAIL because `initialize` and `initialized` are not exposed and the current `async initialize()` cannot return the same Promise identity to concurrent callers.

- [ ] **Step 3: Implement stable single-flight initialization**

In `packages/stage-ui/src/stores/auth.ts`, replace the current initialization block with:

```ts
const initialized = ref(false)
let initializationPromise: Promise<void> | null = null

function initialize(): Promise<void> {
  if (initializationPromise)
    return initializationPromise

  initializationPromise = (async () => {
    try {
      const hasRefreshToken = !!refreshToken.value
      const hasClientId = !!oidcClientId.value
      if (hasRefreshToken !== hasClientId)
        clearAllAuthState()

      onTokenRefreshed(async (accessToken) => {
        token.value = accessToken
        await fetchSession()
      })

      await restoreRefreshSchedule()
      await fetchSession().catch(() => {})
    }
    finally {
      initialized.value = true
    }
  })()

  return initializationPromise
}

void initialize()
```

Add `initialize` and `initialized` to the returned store object. Keep every existing auth state field and action unchanged.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run the Task 1 Vitest command again.

Expected: 1 test passes; `fetchSession` is called once even though store construction plus two callers request initialization.

- [ ] **Step 5: Run the existing auth regression test**

```powershell
& 'D:\Tools\airi\.node24.local\node-v24.13.0-win-x64\node.exe' 'D:\Tools\airi\.node24.local\node-v24.13.0-win-x64\node_modules\corepack\dist\pnpm.js' -F @proj-airi/stage-ui exec vitest run src/libs/auth.test.ts
```

Expected: existing OIDC ordering test passes.

- [ ] **Step 6: Commit Task 1**

```powershell
git add -- packages/stage-ui/src/stores/auth.ts packages/stage-ui/src/stores/auth-initialization.test.ts
git commit -m "fix(stage-ui): expose auth initialization readiness"
```

### Task 2: Redirect Unauthenticated Returning Users

**Files:**
- Create: `apps/stage-web/src/modules/returning-user-login.ts`
- Create: `apps/stage-web/src/modules/returning-user-login.test.ts`
- Modify: `apps/stage-web/src/App.vue`
- Modify: `apps/stage-web/src/modules/app-startup.test.ts`

- [ ] **Step 1: Write failing Web decision tests**

Create `apps/stage-web/src/modules/returning-user-login.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'

import { startReturningUserLoginIfNeeded } from './returning-user-login'

function createOptions() {
  return {
    needsOnboarding: false,
    isAuthCallback: false,
    initializeAuth: vi.fn(async () => undefined),
    isAuthenticated: vi.fn(() => false),
    requestLogin: vi.fn(async () => undefined),
    onError: vi.fn(),
  }
}

describe('returning user login entry', () => {
  it('preserves first-time onboarding without starting login', async () => {
    const options = { ...createOptions(), needsOnboarding: true }

    await expect(startReturningUserLoginIfNeeded(options)).resolves.toBe(false)

    expect(options.initializeAuth).not.toHaveBeenCalled()
    expect(options.requestLogin).not.toHaveBeenCalled()
  })

  it('allows the OIDC callback to finish without starting another login', async () => {
    const options = { ...createOptions(), isAuthCallback: true }

    await expect(startReturningUserLoginIfNeeded(options)).resolves.toBe(false)

    expect(options.initializeAuth).not.toHaveBeenCalled()
    expect(options.requestLogin).not.toHaveBeenCalled()
  })

  it('waits for auth initialization before accepting an authenticated session', async () => {
    let authenticated = false
    let finishInitialization!: () => void
    const options = createOptions()
    options.initializeAuth.mockImplementationOnce(() => new Promise<void>((resolve) => {
      finishInitialization = () => {
        authenticated = true
        resolve()
      }
    }))
    options.isAuthenticated.mockImplementation(() => authenticated)

    const result = startReturningUserLoginIfNeeded(options)
    await vi.waitFor(() => expect(options.initializeAuth).toHaveBeenCalledOnce())
    expect(options.isAuthenticated).not.toHaveBeenCalled()

    finishInitialization()

    await expect(result).resolves.toBe(false)
    expect(options.isAuthenticated).toHaveBeenCalledOnce()
    expect(options.requestLogin).not.toHaveBeenCalled()
  })

  it('starts one login after restoration confirms there is no session', async () => {
    const events: string[] = []
    const options = createOptions()
    options.initializeAuth.mockImplementation(async () => { events.push('initialize') })
    options.isAuthenticated.mockImplementation(() => {
      events.push('check')
      return false
    })
    options.requestLogin.mockImplementation(async () => { events.push('login') })

    await expect(startReturningUserLoginIfNeeded(options)).resolves.toBe(true)

    expect(events).toEqual(['initialize', 'check', 'login'])
    expect(options.requestLogin).toHaveBeenCalledOnce()
  })

  it('reports initialization and login errors without retrying', async () => {
    const initializationError = new Error('session check failed')
    const initializationOptions = createOptions()
    initializationOptions.initializeAuth.mockRejectedValueOnce(initializationError)

    await expect(startReturningUserLoginIfNeeded(initializationOptions)).resolves.toBe(false)
    expect(initializationOptions.onError).toHaveBeenCalledWith(initializationError)
    expect(initializationOptions.requestLogin).not.toHaveBeenCalled()

    const loginError = new Error('navigation failed')
    const loginOptions = createOptions()
    loginOptions.requestLogin.mockRejectedValueOnce(loginError)

    await expect(startReturningUserLoginIfNeeded(loginOptions)).resolves.toBe(false)
    expect(loginOptions.onError).toHaveBeenCalledWith(loginError)
    expect(loginOptions.requestLogin).toHaveBeenCalledOnce()
  })
})
```

Add this structural test to `apps/stage-web/src/modules/app-startup.test.ts`:

```ts
it('checks returning-user authentication before Stage initialization', () => {
  const source = readFileSync(new URL('../App.vue', import.meta.url), 'utf8')
  const authGateIndex = source.indexOf('const loginStarted = await startReturningUserLoginIfNeeded')
  const stageInitializationIndex = source.indexOf('const { characterReady, optionalReady } = startCharacterFirstInitialization')

  expect(authGateIndex).toBeGreaterThan(-1)
  expect(stageInitializationIndex).toBeGreaterThan(authGateIndex)
  expect(source).toContain('isAuthCallback: route.path === \'/auth/callback\'')
  expect(source).toContain('needsOnboarding: onboardingStore.needsOnboarding')
})
```

- [ ] **Step 2: Run Web tests and verify RED**

```powershell
& 'D:\Tools\airi\.node24.local\node-v24.13.0-win-x64\node.exe' 'D:\Tools\airi\.node24.local\node-v24.13.0-win-x64\node_modules\corepack\dist\pnpm.js' -F @proj-airi/stage-web exec vitest run src/modules/returning-user-login.test.ts src/modules/app-startup.test.ts
```

Expected: FAIL because `returning-user-login.ts` and the App wiring do not exist.

- [ ] **Step 3: Implement the Web-only decision helper**

Create `apps/stage-web/src/modules/returning-user-login.ts`:

```ts
export interface ReturningUserLoginOptions {
  needsOnboarding: boolean
  isAuthCallback: boolean
  initializeAuth: () => Promise<void>
  isAuthenticated: () => boolean
  requestLogin: () => Promise<void>
  onError?: (error: unknown) => void
}

export async function startReturningUserLoginIfNeeded(options: ReturningUserLoginOptions): Promise<boolean> {
  if (options.needsOnboarding || options.isAuthCallback)
    return false

  try {
    await options.initializeAuth()
    if (options.isAuthenticated())
      return false

    await options.requestLogin()
    return true
  }
  catch (error) {
    options.onError?.(error)
    return false
  }
}
```

- [ ] **Step 4: Wire the helper before Stage startup**

In `apps/stage-web/src/App.vue`:

1. Import `useRoute` with `RouterView`.
2. Import `startReturningUserLoginIfNeeded`.
3. Create `const route = useRoute()` beside the existing stores.
4. Change the existing mount callback to `onMounted(async () => { ... })`.
5. Immediately after the mount-start log, add:

```ts
const loginStarted = await startReturningUserLoginIfNeeded({
  needsOnboarding: onboardingStore.needsOnboarding,
  isAuthCallback: route.path === '/auth/callback',
  initializeAuth: () => authStore.initialize(),
  isAuthenticated: () => authStore.isAuthenticated,
  requestLogin: () => authStore.requestLogin(),
  onError: error => console.error('[App] Failed to verify authentication:', error),
})
if (loginStarted)
  return
```

Keep the existing onboarding display and Stage initialization code after this block. Do not alter chat requests or `HeaderAvatar.vue`.

- [ ] **Step 5: Run Web tests and verify GREEN**

Run the Task 2 Vitest command again.

Expected: all returning-user and app-startup tests pass.

- [ ] **Step 6: Run onboarding and OIDC regression tests**

```powershell
& 'D:\Tools\airi\.node24.local\node-v24.13.0-win-x64\node.exe' 'D:\Tools\airi\.node24.local\node-v24.13.0-win-x64\node_modules\corepack\dist\pnpm.js' -F @proj-airi/stage-web exec vitest run src/modules/onboarding-login.test.ts src/modules/returning-user-login.test.ts src/modules/app-startup.test.ts
& 'D:\Tools\airi\.node24.local\node-v24.13.0-win-x64\node.exe' 'D:\Tools\airi\.node24.local\node-v24.13.0-win-x64\node_modules\corepack\dist\pnpm.js' -F @proj-airi/stage-ui exec vitest run src/stores/auth-initialization.test.ts src/libs/auth.test.ts src/components/scenarios/dialogs/onboarding/step-welcome.test.ts
```

Expected: all focused tests pass. The existing Vite remote-font close warning may still print after Stage Web tests, but the test process must exit 0.

- [ ] **Step 7: Commit Task 2**

```powershell
git add -- apps/stage-web/src/App.vue apps/stage-web/src/modules/app-startup.test.ts apps/stage-web/src/modules/returning-user-login.ts apps/stage-web/src/modules/returning-user-login.test.ts
git commit -m "fix(web): redirect unauthenticated returning users"
```

### Task 3: Full Verification and Delivery

**Files:**
- Verify only; no production code changes expected.

- [ ] **Step 1: Run type checks**

```powershell
& 'D:\Tools\airi\.node24.local\node-v24.13.0-win-x64\node.exe' 'D:\Tools\airi\.node24.local\node-v24.13.0-win-x64\node_modules\corepack\dist\pnpm.js' -F @proj-airi/stage-ui typecheck
& 'D:\Tools\airi\.node24.local\node-v24.13.0-win-x64\node.exe' 'D:\Tools\airi\.node24.local\node-v24.13.0-win-x64\node_modules\corepack\dist\pnpm.js' -F @proj-airi/stage-web typecheck
```

Expected: Stage UI exits 0. Stage Web must add no new diagnostics; the unrelated pre-existing `apps/stage-web/src/pages/settings/system/index.vue:63` TS2322 may remain.

- [ ] **Step 2: Run a production build**

```powershell
$env:NODE_OPTIONS='--max-old-space-size=4096'
& 'D:\Tools\airi\.node24.local\node-v24.13.0-win-x64\node.exe' 'D:\Tools\airi\.node24.local\node-v24.13.0-win-x64\node_modules\corepack\dist\pnpm.js' -F @proj-airi/stage-web build
```

Expected: build exits 0 and generates `apps/stage-web/dist`.

- [ ] **Step 3: Verify production server targeting**

```powershell
rg -n "api\.airi\.build" apps/stage-web/dist
rg -n "https://airi\.aifamily\.vip" apps/stage-web/dist/assets
```

Expected: the first command has no matches; the second finds the production URL in a generated JavaScript asset.

- [ ] **Step 4: Verify the three browser entry states**

Use a desktop 1440×900 browser context against the local production preview:

1. Fresh storage: `/` displays “欢迎来到 AIRI！” and does not auto-login.
2. `onboarding/completed=true` with cleared `auth/v1/*` state: `/` navigates through the OIDC authorize URL to `https://airi.aifamily.vip/ui/sign-in` without user interaction.
3. `/auth/callback` with no query parameters stays on the callback error UI and is not intercepted by automatic login.

Record page URLs, visible text, console errors, page errors, and any request to `api.airi.build`. Do not enter account credentials.

- [ ] **Step 5: Run repository integrity checks**

```powershell
git diff --check 'fork/codex/dasilva-commercial-subscription...HEAD'
git status --short
git rev-parse HEAD
git rev-parse '@{u}'
```

Also verify every changed text file is UTF-8 without BOM and contains LF rather than CRLF.

- [ ] **Step 6: Push the tracked branch**

```powershell
git push
git rev-parse HEAD
git rev-parse '@{u}'
```

Expected: push succeeds and local HEAD equals the tracking branch. Do not deploy production without a separate explicit user instruction.
