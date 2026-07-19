# Web Onboarding Login Entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Stage Web welcome button start the current OIDC login flow directly, while completing onboarding only after a valid callback session and showing the welcome page again after cancellation or failure.

**Architecture:** Keep the shared multi-step onboarding as the default for other clients, but add an optional welcome action that Stage Web supplies. A focused Stage Web module owns the session-scoped pending marker and legacy onboarding progress cleanup; the OIDC callback consumes that marker only after `fetchSession()` confirms an authenticated session.

**Tech Stack:** Vue 3 `<script setup>`, TypeScript, Pinia, Vitest 4, Vite, Vue `createApp` DOM tests, OIDC Authorization Code + PKCE.

---

## File Map

- Create `apps/stage-web/src/modules/onboarding-login.ts`: own pending-login and saved-progress storage keys plus start/finalize helpers.
- Create `apps/stage-web/src/modules/onboarding-login.test.ts`: verify storage ordering, cleanup, valid-session completion, cancellation, and ordinary-login isolation.
- Modify `apps/stage-web/src/App.vue`: clear legacy Web onboarding progress before the dialog mounts and pass the Web welcome action.
- Modify `apps/stage-web/src/pages/auth/callback.vue`: finalize onboarding only after a valid Stage Web session.
- Modify `packages/stage-ui/vitest.config.ts`: enable Vue SFC transformation for focused component tests.
- Create `packages/stage-ui/src/components/scenarios/dialogs/onboarding/step-welcome.test.ts`: click the real welcome component and prove custom/default behavior.
- Modify `packages/stage-ui/src/components/scenarios/dialogs/onboarding/types.ts`: define the optional welcome action type.
- Modify `packages/stage-ui/src/components/scenarios/dialogs/onboarding/step-welcome.vue`: invoke the custom welcome action when supplied.
- Modify `packages/stage-ui/src/components/scenarios/dialogs/onboarding/onboarding.vue`: pass the optional action only to the welcome step.
- Modify `packages/stage-ui/src/components/scenarios/dialogs/onboarding/onboarding-dialog.vue`: forward the optional action through desktop dialog and mobile drawer variants.

Use the project runtime for every pnpm command:

```powershell
$Node = 'D:\Tools\airi\.node24.local\node-v24.13.0-win-x64\node.exe'
$Pnpm = 'D:\Tools\airi\.node24.local\node-v24.13.0-win-x64\node_modules\corepack\dist\pnpm.js'
```

### Task 1: Add Session-Scoped Login Start State

**Files:**

- Create: `apps/stage-web/src/modules/onboarding-login.test.ts`
- Create: `apps/stage-web/src/modules/onboarding-login.ts`

- [ ] **Step 1: Write the failing storage and login-start tests**

Create `apps/stage-web/src/modules/onboarding-login.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'

import {
  clearOnboardingProgress,
  ONBOARDING_LOGIN_PENDING_KEY,
  ONBOARDING_STATE_KEY,
  startOnboardingLogin,
} from './onboarding-login'

describe('web onboarding login state', () => {
  it('clears saved multi-step onboarding progress', () => {
    const removeItem = vi.fn()

    clearOnboardingProgress({ removeItem })

    expect(removeItem).toHaveBeenCalledWith(ONBOARDING_STATE_KEY)
  })

  it('marks the onboarding login before requesting OIDC sign-in', async () => {
    const events: string[] = []
    const setItem = vi.fn(() => { events.push('pending') })
    const removeItem = vi.fn()
    const requestLogin = vi.fn(async () => { events.push('login') })

    await startOnboardingLogin(requestLogin, { setItem, removeItem })

    expect(setItem).toHaveBeenCalledWith(ONBOARDING_LOGIN_PENDING_KEY, 'true')
    expect(events).toEqual(['pending', 'login'])
    expect(removeItem).not.toHaveBeenCalled()
  })

  it('clears the pending marker when login cannot start', async () => {
    const failure = new Error('OIDC navigation failed')
    const setItem = vi.fn()
    const removeItem = vi.fn()

    await expect(startOnboardingLogin(
      async () => { throw failure },
      { setItem, removeItem },
    )).rejects.toBe(failure)

    expect(removeItem).toHaveBeenCalledWith(ONBOARDING_LOGIN_PENDING_KEY)
  })
})
```

- [ ] **Step 2: Run the test and verify RED**

From `D:\Tools\airi\apps\stage-web`, run:

```powershell
& $Node $Pnpm exec vitest run 'src/modules/onboarding-login.test.ts' --config 'vite.config.ts'
```

Expected: FAIL because `./onboarding-login` does not exist.

- [ ] **Step 3: Implement the minimal storage and start helpers**

Create `apps/stage-web/src/modules/onboarding-login.ts`:

```ts
type StorageRemover = Pick<Storage, 'removeItem'>
type PendingStorageWriter = Pick<Storage, 'removeItem' | 'setItem'>

export const ONBOARDING_LOGIN_PENDING_KEY = 'onboarding/web-login-pending'
export const ONBOARDING_STATE_KEY = 'airi-onboarding-state'

export function clearOnboardingProgress(storage: StorageRemover = localStorage): void {
  storage.removeItem(ONBOARDING_STATE_KEY)
}

export async function startOnboardingLogin(
  requestLogin: () => Promise<void>,
  storage: PendingStorageWriter = sessionStorage,
): Promise<void> {
  storage.setItem(ONBOARDING_LOGIN_PENDING_KEY, 'true')

  try {
    await requestLogin()
  }
  catch (error) {
    storage.removeItem(ONBOARDING_LOGIN_PENDING_KEY)
    throw error
  }
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

```powershell
& $Node $Pnpm exec vitest run 'src/modules/onboarding-login.test.ts' --config 'vite.config.ts'
```

Expected: 3 tests PASS.

- [ ] **Step 5: Commit Task 1**

```powershell
git add -- 'apps/stage-web/src/modules/onboarding-login.ts' 'apps/stage-web/src/modules/onboarding-login.test.ts'
git commit -m 'feat(web): track onboarding login start'
```

### Task 2: Add an Optional Shared Welcome Action

**Files:**

- Modify: `packages/stage-ui/vitest.config.ts`
- Create: `packages/stage-ui/src/components/scenarios/dialogs/onboarding/step-welcome.test.ts`
- Modify: `packages/stage-ui/src/components/scenarios/dialogs/onboarding/types.ts`
- Modify: `packages/stage-ui/src/components/scenarios/dialogs/onboarding/step-welcome.vue`
- Modify: `packages/stage-ui/src/components/scenarios/dialogs/onboarding/onboarding.vue`
- Modify: `packages/stage-ui/src/components/scenarios/dialogs/onboarding/onboarding-dialog.vue`

- [ ] **Step 1: Enable Vue SFC tests in Stage UI**

Update `packages/stage-ui/vitest.config.ts` to load the existing Vue plugin dependency:

```ts
import { join } from 'node:path'
import { cwd } from 'node:process'

import Vue from '@vitejs/plugin-vue'

import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

export default defineConfig(({ mode }) => {
  return ({
    plugins: [Vue()],
    test: {
      include: ['src/**/*.test.ts'],
      env: loadEnv(mode, join(cwd(), 'packages', 'stage-ui'), ''),
    },
  })
})
```

- [ ] **Step 2: Write the failing welcome-click test**

Create `packages/stage-ui/src/components/scenarios/dialogs/onboarding/step-welcome.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
// @vitest-environment jsdom
import { createApp, nextTick } from 'vue'

import StepWelcome from './step-welcome.vue'

vi.mock('@proj-airi/ui', async () => {
  const { defineComponent, h } = await import('vue')

  return {
    Button: defineComponent({
      props: { label: String },
      emits: ['click'],
      setup(props, { emit }) {
        return () => h('button', {
          type: 'button',
          onClick: () => emit('click'),
        }, props.label)
      },
    }),
  }
})

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

async function clickWelcome(props: { onNext: () => void, onStart?: () => void | Promise<void> }) {
  const root = document.createElement('div')
  document.body.append(root)
  const app = createApp(StepWelcome, props)
  app.directive('motion', {})
  app.mount(root)

  root.querySelector('button')?.click()
  await nextTick()
  await Promise.resolve()

  app.unmount()
  root.remove()
}

describe('onboarding welcome step', () => {
  it('uses the custom start action without entering the next step', async () => {
    const onNext = vi.fn()
    const onStart = vi.fn()

    await clickWelcome({ onNext, onStart })

    expect(onStart).toHaveBeenCalledOnce()
    expect(onNext).not.toHaveBeenCalled()
  })

  it('keeps the existing next action when no custom action is supplied', async () => {
    const onNext = vi.fn()

    await clickWelcome({ onNext })

    expect(onNext).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 3: Run the component test and verify RED**

From `D:\Tools\airi`, run:

```powershell
& $Node $Pnpm -F '@proj-airi/stage-ui' test:run -- 'src/components/scenarios/dialogs/onboarding/step-welcome.test.ts'
```

Expected: the custom-action test FAILS because the current component calls `onNext` and has no `onStart` prop.

- [ ] **Step 4: Define and handle the optional welcome action**

Add to `packages/stage-ui/src/components/scenarios/dialogs/onboarding/types.ts`:

```ts
export type OnboardingWelcomeStartHandler = () => Promise<void> | void
```

Update `step-welcome.vue` to import that type, accept the optional prop, and select one action:

```ts
interface Props {
  onNext: OnboardingStepNextHandler
  onStart?: OnboardingWelcomeStartHandler
}

async function handleStart() {
  if (props.onStart) {
    await props.onStart()
    return
  }

  await props.onNext()
}
```

Replace the button listener with:

```vue
@click="handleStart"
```

- [ ] **Step 5: Forward the action through the onboarding containers**

In `onboarding.vue`, import `OnboardingWelcomeStartHandler`, accept `onWelcomeStart`, and add it to the welcome step props:

```ts
const { extraSteps = [], onWelcomeStart } = defineProps<{
  extraSteps?: OnboardingStep[]
  onWelcomeStart?: OnboardingWelcomeStartHandler
}>()
```

```ts
{
  id: 'welcome',
  component: StepWelcome,
  props: () => ({ onStart: onWelcomeStart }),
},
```

In `onboarding-dialog.vue`, import the same handler type, extend the props, and forward it in both render branches:

```ts
const props = defineProps<{
  extraSteps?: OnboardingStep[]
  onWelcomeStart?: OnboardingWelcomeStartHandler
}>()
```

```vue
<Onboarding
  :extra-steps="props.extraSteps"
  :on-welcome-start="props.onWelcomeStart"
  @configured="emit('configured')"
  @skipped="emit('skipped')"
/>
```

Apply the same `:on-welcome-start` binding to the mobile drawer branch.

- [ ] **Step 6: Run tests and typecheck Stage UI**

```powershell
& $Node $Pnpm -F '@proj-airi/stage-ui' test:run -- 'src/components/scenarios/dialogs/onboarding/step-welcome.test.ts'
& $Node $Pnpm -F '@proj-airi/stage-ui' typecheck
```

Expected: 2 focused tests PASS; Stage UI typecheck exits 0.

- [ ] **Step 7: Commit Task 2**

```powershell
git add -- 'packages/stage-ui/vitest.config.ts' 'packages/stage-ui/src/components/scenarios/dialogs/onboarding/types.ts' 'packages/stage-ui/src/components/scenarios/dialogs/onboarding/step-welcome.vue' 'packages/stage-ui/src/components/scenarios/dialogs/onboarding/step-welcome.test.ts' 'packages/stage-ui/src/components/scenarios/dialogs/onboarding/onboarding.vue' 'packages/stage-ui/src/components/scenarios/dialogs/onboarding/onboarding-dialog.vue'
git commit -m 'feat(stage-ui): allow custom onboarding welcome action'
```

### Task 3: Complete Onboarding After a Verified Callback

**Files:**

- Modify: `apps/stage-web/src/modules/onboarding-login.test.ts`
- Modify: `apps/stage-web/src/modules/onboarding-login.ts`
- Modify: `apps/stage-web/src/App.vue`
- Modify: `apps/stage-web/src/pages/auth/callback.vue`

- [ ] **Step 1: Add failing callback-finalization tests**

Append to the existing `describe` block in `onboarding-login.test.ts`:

```ts
it('completes onboarding only after the callback confirms a valid session', async () => {
  const fetchSession = vi.fn().mockResolvedValue(true)
  const markCompleted = vi.fn()
  const session = {
    getItem: vi.fn().mockReturnValue('true'),
    removeItem: vi.fn(),
  }
  const local = { removeItem: vi.fn() }

  const completed = await finalizeOnboardingLogin(fetchSession, markCompleted, session, local)

  expect(completed).toBe(true)
  expect(markCompleted).toHaveBeenCalledOnce()
  expect(local.removeItem).toHaveBeenCalledWith(ONBOARDING_STATE_KEY)
  expect(session.removeItem).toHaveBeenCalledWith(ONBOARDING_LOGIN_PENDING_KEY)
})

it('keeps onboarding incomplete when the callback has no valid session', async () => {
  const fetchSession = vi.fn().mockResolvedValue(false)
  const markCompleted = vi.fn()
  const session = {
    getItem: vi.fn().mockReturnValue('true'),
    removeItem: vi.fn(),
  }
  const local = { removeItem: vi.fn() }

  const completed = await finalizeOnboardingLogin(fetchSession, markCompleted, session, local)

  expect(completed).toBe(false)
  expect(markCompleted).not.toHaveBeenCalled()
  expect(session.removeItem).not.toHaveBeenCalled()
})

it('does not complete onboarding for a login started outside the welcome flow', async () => {
  const fetchSession = vi.fn().mockResolvedValue(true)
  const markCompleted = vi.fn()
  const session = {
    getItem: vi.fn().mockReturnValue(null),
    removeItem: vi.fn(),
  }
  const local = { removeItem: vi.fn() }

  const completed = await finalizeOnboardingLogin(fetchSession, markCompleted, session, local)

  expect(completed).toBe(false)
  expect(markCompleted).not.toHaveBeenCalled()
})
```

Add `finalizeOnboardingLogin` to the test import list.

- [ ] **Step 2: Run the focused test and verify RED**

From `D:\Tools\airi\apps\stage-web`, run:

```powershell
& $Node $Pnpm exec vitest run 'src/modules/onboarding-login.test.ts' --config 'vite.config.ts'
```

Expected: FAIL because `finalizeOnboardingLogin` is not exported.

- [ ] **Step 3: Implement verified-session finalization**

Add these types and function to `onboarding-login.ts`:

```ts
type PendingStorageReader = Pick<Storage, 'getItem' | 'removeItem'>

export async function finalizeOnboardingLogin(
  fetchSession: () => Promise<boolean>,
  markCompleted: () => void,
  pendingStorage: PendingStorageReader = sessionStorage,
  progressStorage: StorageRemover = localStorage,
): Promise<boolean> {
  const hasSession = await fetchSession()
  if (!hasSession || pendingStorage.getItem(ONBOARDING_LOGIN_PENDING_KEY) !== 'true')
    return false

  markCompleted()
  progressStorage.removeItem(ONBOARDING_STATE_KEY)
  pendingStorage.removeItem(ONBOARDING_LOGIN_PENDING_KEY)
  return true
}
```

- [ ] **Step 4: Wire Stage Web welcome start before child mount**

In `apps/stage-web/src/App.vue`:

```ts
import { useAuthStore } from '@proj-airi/stage-ui/stores/auth'
```

```ts
import { clearOnboardingProgress, startOnboardingLogin } from './modules/onboarding-login'
```

After creating `onboardingStore`, create the auth store and clear stale Web wizard state synchronously:

```ts
const onboardingStore = useOnboardingStore()
const authStore = useAuthStore()

if (onboardingStore.needsOnboarding)
  clearOnboardingProgress()
```

Add the welcome handler:

```ts
async function handleOnboardingStart() {
  await startOnboardingLogin(() => authStore.requestLogin())
}
```

Pass it to the dialog:

```vue
<OnboardingDialog
  v-model="showingSetup"
  :on-welcome-start="handleOnboardingStart"
  @configured="handleSetupConfigured"
  @skipped="handleSetupSkipped"
/>
```

- [ ] **Step 5: Finalize onboarding from the successful OIDC callback**

In `apps/stage-web/src/pages/auth/callback.vue`, import the onboarding store and helper:

```ts
import { useOnboardingStore } from '@proj-airi/stage-ui/stores/onboarding'

import { finalizeOnboardingLogin } from '../../modules/onboarding-login'
```

Create the store next to the router:

```ts
const router = useRouter()
const onboardingStore = useOnboardingStore()
```

Replace the standalone session fetch with verified finalization:

```ts
await finalizeOnboardingLogin(
  fetchSession,
  () => onboardingStore.markSetupCompleted(),
)
router.replace('/')
```

Error callbacks and failed token exchange continue to return before this function, so they do not complete onboarding.

- [ ] **Step 6: Run focused tests and Web typecheck**

```powershell
Set-Location 'D:\Tools\airi\apps\stage-web'
& $Node $Pnpm exec vitest run 'src/modules/onboarding-login.test.ts' --config 'vite.config.ts'
Set-Location 'D:\Tools\airi'
& $Node $Pnpm -F '@proj-airi/stage-web' typecheck
```

Expected: all onboarding-login tests PASS; Stage Web typecheck exits 0.

- [ ] **Step 7: Commit Task 3**

```powershell
git add -- 'apps/stage-web/src/modules/onboarding-login.ts' 'apps/stage-web/src/modules/onboarding-login.test.ts' 'apps/stage-web/src/App.vue' 'apps/stage-web/src/pages/auth/callback.vue'
git commit -m 'fix(web): route onboarding welcome to sign-in'
```

### Task 4: Full Verification and GitHub Save

**Files:**

- Verify only; no new production files expected.

- [ ] **Step 1: Run both focused suites**

```powershell
Set-Location 'D:\Tools\airi\packages\stage-ui'
& $Node $Pnpm test:run -- 'src/components/scenarios/dialogs/onboarding/step-welcome.test.ts'
Set-Location 'D:\Tools\airi\apps\stage-web'
& $Node $Pnpm exec vitest run 'src/modules/onboarding-login.test.ts' --config 'vite.config.ts'
```

Expected: both suites PASS with no test failures.

- [ ] **Step 2: Run package typechecks**

```powershell
Set-Location 'D:\Tools\airi'
& $Node $Pnpm -F '@proj-airi/stage-ui' typecheck
& $Node $Pnpm -F '@proj-airi/stage-web' typecheck
```

Expected: both commands exit 0.

- [ ] **Step 3: Build the production Web app**

```powershell
$env:NODE_OPTIONS = '--max-old-space-size=4096'
& $Node $Pnpm -F '@proj-airi/stage-web' build
rg -n 'api\.airi\.build' 'apps/stage-web/dist'
```

Expected: Vite production build exits 0; `rg` exits 1 because generated output contains no `api.airi.build` reference.

- [ ] **Step 4: Start a local Web server and verify the desktop flow**

Start the Stage Web dev server on an unused port and keep it running:

```powershell
& $Node $Pnpm -F '@proj-airi/stage-web' dev --host 127.0.0.1 --port 4173
```

In a fresh desktop browser context:

1. Open `http://127.0.0.1:4173/` and confirm the welcome dialog appears.
2. Seed `airi-onboarding-state` with `{"step":1}`, reload, and confirm the welcome dialog still appears.
3. Click “开始吧” and confirm navigation uses OIDC and reaches `/ui/sign-in` without rendering `Get Started`.
4. Go back to the local Stage Web page and confirm the welcome dialog appears again.
5. Confirm there is no `Electron ipcRenderer is not available` error and no `api.airi.build` request.

- [ ] **Step 5: Verify diff scope and text encoding**

```powershell
git diff --check '@{u}'...HEAD
$ChangedTextFiles = @(
  'apps/stage-web/src/modules/onboarding-login.ts',
  'apps/stage-web/src/modules/onboarding-login.test.ts',
  'apps/stage-web/src/App.vue',
  'apps/stage-web/src/pages/auth/callback.vue',
  'packages/stage-ui/vitest.config.ts',
  'packages/stage-ui/src/components/scenarios/dialogs/onboarding/types.ts',
  'packages/stage-ui/src/components/scenarios/dialogs/onboarding/step-welcome.vue',
  'packages/stage-ui/src/components/scenarios/dialogs/onboarding/step-welcome.test.ts',
  'packages/stage-ui/src/components/scenarios/dialogs/onboarding/onboarding.vue',
  'packages/stage-ui/src/components/scenarios/dialogs/onboarding/onboarding-dialog.vue'
)
foreach ($File in $ChangedTextFiles) {
  $Bytes = [System.IO.File]::ReadAllBytes((Resolve-Path $File))
  if ($Bytes.Length -ge 3 -and $Bytes[0] -eq 0xEF -and $Bytes[1] -eq 0xBB -and $Bytes[2] -eq 0xBF) {
    throw "$File contains a UTF-8 BOM"
  }
  if ($Bytes -contains 13) {
    throw "$File contains CRLF line endings"
  }
}
```

Expected: `git diff --check` exits 0 and the encoding loop produces no error.

- [ ] **Step 6: Review scope and push the tracked branch**

```powershell
git status --short
git log -5 --oneline
git push
```

Expected: worktree is clean before push; `fork/codex/dasilva-commercial-subscription` advances to the final implementation commit.

Record the pushed branch and final commit SHA in the handoff. Production deployment is a separate external-state step and is not performed by this implementation plan without explicit deployment direction.
