# 管理后台上游模型发现设计

## 目标

在“官方接入”表单的“上游模型”字段旁增加获取模型功能。管理员可以使用当前 Base URL 与密钥读取 OpenAI-compatible `/models` 列表并直接选择，同时保留手动输入以兼容未实现模型列表接口的上游。

## 交互

- “上游模型”继续使用可编辑输入框，右侧放置“获取模型”按钮。
- 获取成功后，输入框提供可搜索、可直接选择的模型 ID 候选；不自动覆盖当前值。
- 新建配置时使用表单中的 API Key。
- 编辑已有配置且 API Key 留空时，使用当前选中路由及 Key 条目对应的服务器已保存密钥。
- Base URL、Provider、路由选择或 Key 改变后，清空旧候选，避免误选其他上游的模型。
- 加载、空列表和错误均显示本地化状态；错误不清空当前模型值。

## API 与数据流

新增 `POST /api/admin/config/router/models` 管理员模型发现接口。请求包含：

- `providerKind`
- `baseURL`
- 可选的 `plaintextKey`
- 可选的 `configuredModelName` 与 `existingKeyEntryId`

服务端优先使用 `plaintextKey`；未提供时，以 `configuredModelName` 定位 `LLM_ROUTER_CONFIG` 中原路由，再按 `existingKeyEntryId` 查找 Key，并使用既有 envelope crypto 与原路由 AAD 解密。服务端请求规范化后的 `<baseURL>/models`，只返回去重并排序后的非空模型 ID：

```json
{ "models": ["gpt-5-mini"] }
```

密钥、上游原始响应和密文均不返回浏览器，也不写日志。

## 安全与故障处理

- 接口继续使用现有 `authGuard` 与 `adminGuard`。
- Base URL 只允许 `http:` 和 `https:`，拒绝 URL 凭据与无效地址。
- 上游请求超时为 10 秒，可解析响应体上限为 1 MiB。
- 只接受 OpenAI-compatible `{ data: [{ id }] }` 结构；无有效 ID 时返回明确错误。
- 上游非 2xx、超时、无效 JSON 和缺少已保存密钥均映射为稳定的 API 错误，不泄露 Key 或完整上游正文。

## 测试与验收

- 服务端路由测试覆盖新 Key、已保存 Key、模型去重排序、无效 URL、上游错误和缺失 Key。
- Web API 测试覆盖请求路径与负载映射。
- 组件行为覆盖获取、选择、上下文变化清空候选及错误保留输入；若当前组件测试基建不支持，则至少以提取的纯函数测试候选解析和状态失效规则。
- 中英文文案完整，类型检查通过。

验收标准：管理员不重新输入已保存密钥也能获取模型；选择候选会写入“上游模型”；手动输入和保存流程保持兼容；任何响应均不包含密钥。
