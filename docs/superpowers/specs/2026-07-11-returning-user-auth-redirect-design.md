# Returning User Authentication Redirect Design

## 目标

修复 Stage Web 已完成首次引导的浏览器在服务端会话失效后仍停留在主界面、且没有登录入口的问题。

采用用户确认的方案 2：

- 首次用户继续看到现有“欢迎来到 AIRI”页面，点击“开始吧”后进入现有 OIDC 登录流程。
- 已完成首次引导的用户只要当前没有有效会话，打开 Stage Web 任意普通页面时自动进入同域 Auth UI `/ui/sign-in`。
- 登录回调页必须始终放行，避免回调被再次重定向而形成循环。

## 根因

- `packages/stage-layouts/src/components/Layouts/HeaderAvatar.vue` 在提交 `536868b48` 的界面改版中删除了未登录态的桌面和移动登录控件，但“Settings & Login”注释仍然保留。
- `useAuthStore()` 能在会话校验失败后把 `isAuthenticated` 正确更新为 `false`，因此截图中的未登录状态判断本身没有错误。
- Stage Web 没有针对“已完成引导但会话无效”的入口守卫，所以用户被放行到主界面，同时顶栏又没有登录控件。
- 聊天请求返回 401 只是未登录后的结果，不是本次修复目标。

## 已选择方案

### 1. 保留首次欢迎流程

当 `onboardingStore.needsOnboarding` 为 `true` 时，不自动发起登录：

1. 继续显示现有欢迎页。
2. 点击“开始吧”时继续使用已经实现的 `startOnboardingLogin()`。
3. 登录成功后由 OIDC callback 完成 onboarding，之后回到主界面。
4. 登录取消、失败或浏览器返回时仍回到欢迎页。

这样不会推翻上一项已经确认的“欢迎页 → 开始吧 → 登录”行为。

### 2. 返回用户自动进入登录

Stage Web 根入口增加一个仅用于 Web 的返回用户认证检查。普通页面挂载时按以下顺序执行：

1. 等待认证 store 的首次恢复流程完成，包括 refresh token 恢复和服务端 session 校验。
2. 如果会话有效，继续现有应用初始化，不发生导航。
3. 如果会话无效，调用 `authStore.requestLogin()`。
4. `requestLogin()` 继续构造 OIDC Authorization Code + PKCE 请求并进入 `/ui/sign-in`；不直接导航裸登录 URL，也不使用旧 `/auth/login` 页面。
5. 发起登录后停止本轮非必要的 Stage 初始化，等待浏览器离开当前页面。

必须先等待认证恢复完成，再判断 `isAuthenticated`。否则有效 access token 正在刷新时，页面可能把已登录用户误判为未登录并送回登录页。

### 3. 认证初始化就绪状态

共享认证 store 的 `initialize()` 改为返回同一个可等待的初始化 Promise：

- 多个调用方同时调用时只执行一次恢复和 session 校验。
- 初始化完成前，调用方可以可靠等待，不依赖本地缓存中暂时的 `user/session` 值。
- 初始化完成后再次调用会直接复用已完成的 Promise。
- 现有自动初始化行为保留，桌面端和其他调用方不需要改调用方式。

该变化只暴露“首次认证检查何时结束”，不改变登录、刷新、登出或 token 的业务规则。

### 4. 回调和错误处理

- `/auth/callback` 不执行自动登录检查，由现有 callback 页面完成 code/token/session 流程。
- 首次 onboarding 页面不执行自动登录检查。
- 认证初始化或登录发起如果异常，不循环重试；记录明确错误并继续显示当前页面，避免空白页或导航风暴。
- OIDC callback 成功返回 `/` 后，认证 store 已有有效会话，因此不会再次跳登录。
- 本次不根据聊天接口的 401 触发登录，也不修改聊天错误展示。

## 状态流

```text
首次用户：
needsOnboarding=true
  -> 显示欢迎页
  -> 点击“开始吧”
  -> OIDC /ui/sign-in
  -> callback 成功并完成 onboarding
  -> 主界面

返回用户且会话有效：
needsOnboarding=false
  -> 等待认证初始化
  -> isAuthenticated=true
  -> 主界面

返回用户且会话失效：
needsOnboarding=false
  -> 等待认证初始化
  -> isAuthenticated=false
  -> authStore.requestLogin()
  -> OIDC /ui/sign-in

认证回调：
/auth/callback
  -> 跳过入口检查
  -> 交换 token 并校验 session
  -> router.replace('/')
```

## 测试策略

测试先失败，再做最小实现。

### 单元测试

- 首次用户不会自动调用认证初始化或登录。
- `/auth/callback` 不会自动调用登录。
- 返回用户必须先等待认证初始化，再读取认证状态。
- 返回用户会话有效时不调用登录。
- 返回用户会话无效时只调用一次 `requestLogin()`。
- 认证初始化并发调用时复用同一个 Promise，不重复恢复 session。
- 初始化或登录发起异常不会触发循环调用。

### 回归验证

- 现有 onboarding 登录测试继续通过。
- Stage UI 与 Stage Web 类型检查不新增错误。
- Stage Web 生产构建成功，构建结果只包含 `https://airi.aifamily.vip`，不包含 `api.airi.build`。

### 浏览器验证

使用桌面视口验证：

1. 全新存储打开主站仍显示欢迎页。
2. 欢迎页点击“开始吧”直接进入 `/ui/sign-in`。
3. 设置 `onboarding/completed=true` 且清空认证状态后打开主站，会自动进入 `/ui/sign-in`，不再停留在截图中的主界面。
4. 打开 `/auth/callback` 不会在 callback 处理前再次跳登录。
5. 已有有效会话时打开主站不会跳登录。

## 非目标

- 不恢复右上角登录按钮；返回用户改为自动登录入口。
- 不删除或重写首次欢迎页。
- 不修改聊天请求、401 展示、模型配置或提供商配置。
- 不修改 Auth UI 表单、订阅、计费或后端鉴权规则。
- 不改变 Pocket、Tamagotchi 或其他客户端的页面入口行为。
- 本次只提交和推送代码，不自动部署生产环境。

## 验收标准

- 首次用户仍按“欢迎页 → 开始吧 → 登录”运行。
- 已完成 onboarding 的未登录用户打开 Stage Web 时自动进入真实 OIDC 登录页。
- 会话仍有效的用户不会被误重定向。
- OIDC callback 不发生重定向循环。
- 不需要依赖顶栏登录按钮才能重新登录。
- 401 聊天错误处理保持原样。
