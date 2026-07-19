# Web Onboarding Login Entry Design

## 目标

Web 端首次访问仍显示现有“欢迎来到 AIRI”弹窗，但点击“开始吧”后不再进入 `Get Started`、新用户/返回用户选择、服务来源或角色配置等后续新手步骤，而是通过当前 OIDC + PKCE 流程进入同域 Auth UI `/ui/sign-in`。

只有登录成功并返回 Stage Web 后才完成 onboarding。用户取消登录、登录失败或使用浏览器返回时，重新进入主站仍应显示欢迎弹窗。

## 已确认现状

- `step-welcome.vue` 的按钮调用通用 `onNext`。
- `onboarding.vue` 把 `welcome` 后的下一步固定为 `start-choice`，所以当前点击必然进入 `Get Started`。
- Web 的正确登录入口是 `authStore.requestLogin()`。它会构造 OIDC Authorization Code + PKCE 请求，服务端随后把用户带到 `/ui/sign-in`。
- 直接导航到 `/ui/sign-in` 不带完整 OIDC 上下文，登录成功后不能可靠回到 Stage Web 并签发所需 token，因此不采用。
- `onboarding/completed` 和 `onboarding/skipped` 决定欢迎弹窗是否再次出现；`airi-onboarding-state` 保存当前向导步骤。

## 设计

### 1. Web 端覆盖欢迎按钮行为

为共享 `OnboardingDialog` / `Onboarding` 增加一个可选的欢迎开始回调。只有 `apps/stage-web` 传入该回调：

1. Web 模式固定从 `welcome` 开始，不恢复旧 `airi-onboarding-state` 中的步骤。
2. 进入 Web 模式时清除已有向导进度，确保已经停在 `Get Started` 的浏览器升级后回到欢迎页。
3. 当前步骤为 `welcome` 时调用 Web 提供的回调。
4. 不执行通用 `navigateNext()`，因此 `step` 保持为 `0`。
5. 未传入回调的 Pocket、桌面或其他消费者继续恢复并使用现有完整 onboarding，不改变其行为。

展示组件 `step-welcome.vue` 只负责显示并调用注入的欢迎开始回调；未注入时仍发出通用 `onNext`，不直接依赖认证 store。

### 2. 发起登录

Stage Web 的欢迎开始处理函数执行以下操作：

1. 调用 `authStore.requestLogin()`，继续使用现有 OIDC + PKCE 流程。
2. 共享认证层在 `buildAuthorizationURL()` 生成本次 `flowState.state` 并完成 `persistFlowState()` 后、执行任何 `window.location` 或 social 导航前，通过可选 `onFlowState(state)` 回调暴露该 state。
3. Stage Web 收到回调后，将真实 OIDC state 写入 `sessionStorage` 的一次性 onboarding pending 项，而不是写入通用布尔值。
4. 如果发起登录在离开当前页面前抛错或 Promise 被拒绝，则 best-effort 删除 pending 项，并原样保留认证错误；cleanup 失败不能覆盖原错误。

现有不传 `onFlowState` 的 `triggerSignIn()`、`signIn()` 和 `requestLogin()` 调用保持原行为。pending 写入、删除以及 App setup 清理旧 `airi-onboarding-state` 都是 best-effort；storage 不可用时不能让 App 根组件崩溃，也不能把已成功的认证判定为失败。

不在点击时写入 `onboarding/completed`。

### 3. 登录成功后完成 onboarding

Stage Web OIDC callback 使用已持久化的 `persisted.flowState.state` 作为本次登录的唯一 expected state。在以下条件全部成立后完成 onboarding：

1. OIDC callback 没有返回错误。
2. token 交换成功。
3. `fetchSession()` 返回有效用户会话。
4. `sessionStorage` 中的 onboarding pending state 与 expected state 严格相等。

处理匹配 attempt 时：

- 在终态尽早 best-effort 消费一次性 pending state，防止同一 attempt 被重复使用。
- `fetchSession()` 确认有效会话后，best-effort 调用 onboarding store 的完成逻辑并清理 `airi-onboarding-state`。
- pending 删除、进度删除或 `markSetupCompleted()` 异常都不能改变已经验证的认证成功结果，也不能阻止现有 `router.replace('/')` 返回主页面。
- `fetchSession()` 和 token 交换本身的错误仍进入现有 callback 错误处理，不被 cleanup 隔离逻辑吞掉。

普通登录 callback 使用新的 OIDC state；只要它与 onboarding pending state 不匹配，就不改 onboarding 完成状态。

### 4. 取消与失败行为

- callback 的 error、缺少 code/state、缺少或无效 flow state、token 交换失败、session 获取失败等终态都不完成 onboarding；能与 pending state 匹配时 best-effort 消费该 pending 项。
- 错误页仅在确认本次错误来自 onboarding attempt 时，在内存中保留 retry 意图。用户点击“重试”会再次通过 onboarding 登录 helper 发起 OIDC，并保存新生成的 state；普通 callback 的重试不会凭空变成 onboarding 登录。
- 登录发起失败时 best-effort 清除一次性 pending 项，并保留当前欢迎页和原始认证错误。
- 用户通过浏览器返回而没有到达 callback 时，旧 pending state 可能留在当前 `sessionStorage`。后续普通登录会生成不同的新 state，因此严格匹配不会误完成 onboarding；后续新的 onboarding attempt 会写入自己的新 state。
- pending 只存于 `sessionStorage`，不会跨浏览器会话长期残留。

## 状态流

```text
欢迎页 step=0
  -> 点击“开始吧”
  -> authStore.requestLogin()
  -> buildAuthorizationURL() 生成 flowState.state=S
  -> persistFlowState()
  -> onFlowState(S)，Stage Web 写 pending=S
  -> OIDC authorize
  -> /ui/sign-in

取消/返回/失败
  -> callback 终态若 state 匹配则 best-effort 消费 pending
  -> 错误页在内存中保留 onboarding retry 意图，重试时生成新 state
  -> browser back 遗留的旧 state 不匹配后续普通登录的新 state
  -> completed 仍为 false
  -> 主站再次显示欢迎页 step=0

登录成功
  -> Stage Web callback 换取 token
  -> 使用 persisted.flowState.state 精确匹配 pending
  -> best-effort 消费匹配的 pending
  -> fetchSession() 确认有效会话
  -> best-effort completed=true，清理 onboarding 步骤状态
  -> cleanup/mark 异常不改变认证成功
  -> 返回主站，不再显示欢迎页
```

## 测试策略

### 单元与组件测试

- 点击 Web 欢迎页“开始吧”会调用欢迎开始回调，且不会进入 `start-choice`。
- Web 模式忽略并清除已保存的 `step=1` 或其他旧向导进度，始终显示欢迎页。
- 共享认证层在 `persistFlowState()` 之后、导航之前调用 `onFlowState`，且不传 callback 的现有调用保持不变。
- Stage Web 只在收到真实 OIDC state 时写入 pending；发起函数失败时 best-effort 删除 pending，删除失败不能覆盖原始错误。
- callback 只有在 token/session 成功且 pending state 与 `persisted.flowState.state` 精确匹配时才完成 onboarding。
- pending 缺失、state mismatch 或 pending 读取异常时不修改 onboarding 状态。
- callback 出错或 session 为空时不完成 onboarding，并 best-effort 消费匹配的 pending。
- pending/progress 删除异常或 `markSetupCompleted()` 异常不改变已经验证的认证成功结果；App setup 清理旧进度时 storage 异常不抛出。
- onboarding 错误 retry 生成并保存新 state；普通 callback retry 不创建 onboarding pending。

测试先以当前行为建立失败用例，再做最小实现。

### 浏览器验证

使用桌面视口和全新浏览器存储验证：

1. 首次打开主站只看到欢迎页。
2. 点击“开始吧”直接进入同域 `/ui/sign-in`，不出现 `Get Started`。
3. 在登录页返回主站后欢迎页再次出现。
4. 完成真实登录后回到主站，欢迎页不再出现。
5. 页面没有 `api.airi.build` 请求或 `Electron ipcRenderer is not available` 错误。

## 非目标

- 本次不删除共享 onboarding 的后续步骤文件。
- 本次不改变 Pocket、Tamagotchi 或其他客户端的 onboarding。
- 本次不恢复或修改顶栏登录按钮；该问题单独处理。
- 本次不改变 Auth UI 的表单、认证提供商、订阅或计费流程。
- 本次不直接跳转裸 `/ui/sign-in`，也不恢复旧 `/auth/login` 路径。

## 验收标准

- Stage Web 点击欢迎页“开始吧”后不会渲染 `Get Started`。
- 已保存旧 onboarding 步骤的浏览器升级后也只显示欢迎页，不恢复 `Get Started`。
- 浏览器通过 OIDC + PKCE 进入 `https://airi.aifamily.vip/ui/sign-in`。
- 取消、失败或返回时欢迎页再次显示。
- 只有成功建立 Stage Web 会话后 onboarding 才标记完成。
- 成功登录返回主站后不再显示欢迎页。
- 其他客户端的现有 onboarding 行为不变。
