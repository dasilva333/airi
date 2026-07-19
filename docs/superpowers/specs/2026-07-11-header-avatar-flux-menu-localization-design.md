# 头像菜单 Flux 入口与本地化设计

## 目标

恢复已登录用户头像菜单中丢失的 Flux 余额和订阅入口，并将菜单及会话提示接入现有 i18n。用户已确认采用方案 1：修复头像菜单，不在设置首页新增订阅卡片。

## 根因

- 订阅页面、前端路由和后端接口都仍然存在，`/settings/flux` 可以直接访问。
- 上游提交 `fc5173820` 曾在 `HeaderAvatar.vue` 中加入 Flux 余额和 `/settings/flux` 入口，但商业版迁移提交 `cee66adea` 只迁移了订阅页面与后端，没有迁移头像菜单入口。
- 服务器源码快照保留了此前手工恢复的入口，但这项改动没有进入 GitHub。后续从可信 GitHub 分支重新构建部署时，该入口被覆盖。
- `Signed in as`、`Active Sessions`、`Settings`、`Logout` 以及会话提示一直是 `HeaderAvatar.vue` 中的英文硬编码，因此不会随当前中文 locale 切换。

## 已选择方案

### 头像菜单

仅修改 `packages/stage-layouts/src/components/Layouts/HeaderAvatar.vue` 的已登录菜单：

1. 从认证 store 读取 `credits`，在用户名下显示格式化后的 Flux 余额。
2. 在“活跃会话”和“设置”之间恢复 Flux 入口，目标路由固定为 `/settings/flux`。
3. 点击 Flux 或设置入口后关闭下拉菜单。
4. 菜单顺序保持为：活跃会话、Flux、设置、退出登录。
5. 不修改未登录状态、主题按钮、关于按钮或设置首页布局。

### 本地化

- 复用 `settings.pages.account.signedInAs`、`settings.title` 和 `settings.pages.account.logout`。
- 复用 `settings.pages.flux.title` 作为 Flux 入口名称。
- 新增 `settings.pages.account.activeSessions`、`activeSessionsCount` 和 `sessionListErrorFallback`。
- 将简体中文 `signedInAs` 从不自然的“登录 为”修正为“已登录为”。
- 同步补齐英文和简体中文词条；其他语言继续按现有机制回退英文。
- 会话接口返回具体错误信息时继续显示该信息；只有未知错误使用本地化 fallback。

## 测试策略

先新增失败的轻量契约测试，再做最小实现。测试沿用 `packages/stage-layouts` 现有读取 Vue SFC 源码的方式，不引入新的 DOM 测试依赖。

测试应断言：

- 头像菜单包含 `/settings/flux` 路由和 Flux 余额展示。
- 四个菜单文案及会话提示使用预期 i18n key。
- 菜单不再包含截图中的英文硬编码。
- 英文和简体中文 locale 都存在新增 key，中文 `signedInAs` 为“已登录为”。

实现后运行该回归测试、Stage Layouts 类型检查、Stage Web 类型检查和 Stage Web 生产构建。

## 浏览器与生产验证

使用桌面视口和已登录账号验证：

1. 头像菜单显示中文文案和当前 Flux 余额。
2. 点击 Flux 进入 `/settings/flux`，订阅方案和当前订阅区域可见。
3. 点击活跃会话后提示为中文。
4. 设置和退出登录行为保持正常。
5. 页面无 `Electron ipcRenderer` 错误，也不请求 `api.airi.build`。

代码验证通过后提交并推送当前 GitHub 跟踪分支，再按项目部署规则发布生产 Web 静态资源并完成 HTTP、资源哈希和真实浏览器检查。

## 非目标

- 不在 `/settings` 首页增加 Flux 或订阅卡片。
- 不修改订阅套餐、支付、续费、Flux 计费或后端接口逻辑。
- 不重构整个头像菜单，也不新增通用菜单配置抽象。
- 不改变移动端专属布局；移动端复用该组件时自然获得相同修复。

## 验收标准

- 已登录用户能够从头像菜单发现并打开 Flux 订阅页面。
- 菜单顶部显示最新认证 store 中的 Flux 余额。
- 截图中的四项英文以及会话数量提示在简体中文 locale 下不再显示英文。
- 设置首页没有新增订阅卡片。
- 回归测试、类型检查和生产构建通过，生产站真实浏览器验证通过。
