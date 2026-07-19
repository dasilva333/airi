---
date: 2026-07-04
topic: commercial-backend-subscription
status: requirements
source: customer-confirmed
---

# AIRI 商业化后端、订阅与服务来源精简需求

## Summary

客户要求把当前 AIRI 开源项目改造成带商业化后端的产品形态：账号、积分、周期订阅和模型计费由服务端统一管理；聊天、角色和记忆继续保存在用户本地浏览器；前端只暴露自家官方服务来源，并补齐中文、个人中心和订阅页面。

本文件是客户需求整理和后续实施依据，不是 Agent 行为规范。`AGENTS.md` 只记录仓库协作规则；本需求应放在 `docs/brainstorms/` 或后续拆成 `docs/ai/context/plans/` 设计文档。

## Confirmed Decisions

- **数据边界已确认：**账号、积分、订阅走服务端 DB；聊天、角色、记忆存在浏览器本地。
- **服务来源已确认：**只保留一个官方服务来源；前端不暴露第三方 LLM / TTS / 图像供应商配置。
- **代理网关已确认：**所有 LLM / TTS / 图像生成请求都必须改为走后端代理，前端只暴露“官方”一个 provider。
- **模型选择已确认：**前端只显示官方 provider，但官方 provider 下可选择不同模型。
- **计费方式已确认：**模型请求按次固定扣积分，不按文本长度、token 数或字符数动态计费。
- **TTS 计费已确认：**语音合成按次固定扣 Flux。
- **易支付已确认：**客户已有商户号；这一期需要跑通真实支付，不只是预留接口。
- **订阅已确认：**客户要求周期订阅，不是一次性充值套餐。
- **UI 方案已确认：**订阅/个人中心直接参考 `https://airi.moeru.ai/`，优先选择简单可落地的方案，不做过度设计；暂时不按额外截图删除 UI。

## Problem Frame

当前仓库已有一部分服务端能力：Better Auth 账号、Postgres/Redis、Flux 积分、OpenAI-compatible 网关、TTS 网关、易支付一次性充值、个人中心和 Flux 页面基础。但它还不是客户要求的最终商业化产品。

主要差距：

1. 当前 Flux 套餐是硬编码的一次性充值包，不是周期订阅。
2. 当前模型计费仍包含全局 token/字符相关配置，不是每个模型固定按次扣费。
3. 当前服务端没有统一的模型 CRUD + 每模型定价表。
4. 当前图像生成模型和图像计费链路不完整。
5. 当前服务端存在 chats / characters 表和路由，需要按客户要求明确禁用用户私有聊天/角色云存储，避免数据边界混乱。
6. 当前前端 provider 注册层已经倾向只保留 official，但设置页、路由文件和 UI 分类仍有第三方入口残留。
7. 当前中文翻译已有基础，但仍有英文残留。
8. 当前个人中心有基础，订阅中心未完成。

## Goals

- G1. 服务端管理账号、积分、订阅、支付订单、模型目录、模型价格和请求扣费流水。
- G2. 浏览器本地管理聊天记录、角色卡和记忆，不把用户私有聊天/角色/记忆上传到服务端。
- G3. 用户只能通过官方 provider 发起 LLM / TTS / 图像请求。
- G4. 管理员可以配置模型、模型能力、模型价格、订阅套餐和用户状态。
- G5. 用户可以注册登录、查看个人中心、查看积分、购买周期订阅、查看订阅状态。
- G6. 所有模型调用按次固定扣积分，并写入服务端积分流水。
- G7. 前端完整中文化，并按客户截图删除不需要的入口。

## Non-Goals

- 不保留用户自填第三方 API Key 的入口。
- 不做聊天记录云同步。
- 不做角色卡云同步。
- 不做长期记忆云同步。
- 不把易支付订阅伪装成一次性充值；如果易支付不支持周期扣款，需要在产品上明确为周期套餐人工/回调续期，不能混淆。
- 不在本需求中实现代码；本文件只定义范围、阶段和验收标准。

## Data Ownership

| 数据 | 存储位置 | 说明 |
|---|---|---|
| 用户账号 | 服务端 Postgres | Better Auth user/session/account 等表 |
| 用户封禁状态 | 服务端 Postgres | `user.banned / banReason / banExpires` |
| 用户角色权限 | 服务端 Postgres | admin/user 等角色 |
| Flux 积分余额 | 服务端 Postgres，Redis 只做缓存 | DB 是唯一 truth |
| Flux 流水 | 服务端 Postgres | 每次充值、订阅发放、模型扣费都写流水 |
| 订阅套餐 | 服务端 Postgres | 管理员配置周期、价格、赠送积分 |
| 用户订阅 | 服务端 Postgres | 当前订阅、状态、周期起止、续期记录 |
| 易支付订单/回调 | 服务端 Postgres | 支付审计和幂等处理 |
| 模型目录 | 服务端 Postgres | 官方 provider 下有哪些可用模型 |
| 模型价格 | 服务端 Postgres | 每模型、每能力、每次固定扣多少 Flux |
| 聊天记录 | 浏览器本地 | 不上传服务端 |
| 角色卡 | 浏览器本地 | 不上传服务端 |
| 记忆 | 浏览器本地 | 不上传服务端 |
| Provider 凭据 | 服务端管理 | 用户前端不再保存第三方 provider key |

## Requirements

### R1. 后端基础

- R1.1. 保留并完善 `apps/server` 作为产品后端。
- R1.2. 后端必须提供健康检查：`/livez` 和 `/readyz`。
- R1.3. 所有商业化接口都必须走服务端鉴权。
- R1.4. 所有积分变更必须通过服务端事务完成，不能由前端直接写余额。

### R2. 用户管理

- R2.1. 支持用户注册、登录、登出。
- R2.2. 支持邮箱验证和密码重置。
- R2.3. 支持管理员查看用户列表、搜索用户、查看用户详情。
- R2.4. 支持管理员封禁 / 解封用户。
- R2.5. 被封禁用户不能登录或使用模型接口。
- R2.6. 支持管理员调整用户 Flux 余额，并写入审计流水。
- R2.7. 管理员角色不能只能靠手动改 DB；至少需要初始化/授予方案文档，最好有后台操作闭环。

### R3. 数据边界

- R3.1. 账号、积分、订阅必须存在服务端 DB。
- R3.2. 聊天、角色、记忆必须存在浏览器本地。
- R3.3. 前端不得调用服务端私有聊天同步接口保存用户聊天。
- R3.4. 前端不得调用服务端私有角色同步接口保存用户角色卡。
- R3.5. 如果保留服务端 marketplace/public character 表，必须与用户本地角色明确隔离，并在代码和 UI 上避免混用。
- R3.6. 本地数据应支持清理、导入、导出或备份提示，避免用户误以为服务端会保存聊天/角色/记忆。

### R4. 官方服务来源

- R4.1. 前端服务来源页只显示一个官方 provider。
- R4.2. 删除或隐藏 OpenAI、OpenRouter、Ollama、LM Studio、Azure、ElevenLabs、Replicate、ComfyUI 等第三方供应商入口。
- R4.3. 官方 provider 内部可以提供多个模型供用户选择。
- R4.4. 用户请求 LLM / TTS / 图像生成时必须经过服务端代理，以便鉴权、扣费、审计和限流。
- R4.5. 用户端不展示第三方 API Key 输入框。
- R4.6. 前端不能绕过官方 provider 直接请求任何第三方模型 API。
- R4.7. 官方 provider 下可以显示模型选择器；模型列表来自服务端启用模型目录。

### R5. 模型管理

- R5.1. 服务端需要模型目录表，至少支持：聊天/文字、TTS、图像生成。
- R5.2. 每个模型包含：模型 ID、显示名称、能力类型、是否启用、排序、描述。
- R5.3. 管理员可以新增模型。
- R5.4. 管理员可以编辑模型。
- R5.5. 管理员可以禁用模型。
- R5.6. 如需删除模型，优先软删除，避免历史扣费流水无法解释。
- R5.7. 前端只显示启用模型。
- R5.8. 模型配置与 provider 上游密钥、base URL、fallback 策略解耦；模型目录负责用户可见和计费，router config 负责真实上游路由。

### R6. 模型定价与扣费

- R6.1. 所有模型按次固定扣 Flux。
- R6.2. 不按 token、字符数、文本长度动态扣费。
- R6.3. 每个模型可以配置自己的每次扣费价格。
- R6.4. 聊天/文字模型按每次请求扣费。
- R6.5. TTS 语音模型按每次合成请求扣费。
- R6.6. 图像生成模型按每次生成请求扣费。
- R6.7. 请求开始前必须检查余额是否足够。
- R6.8. 请求成功后扣费并写 Flux 流水。
- R6.9. 请求失败是否扣费必须定义清楚。建议：上游未成功生成则不扣费；成功生成但前端网络中断仍按成功扣费。
- R6.10. 扣费流水必须包含 userId、modelId、capability、amount、requestId、时间、状态和必要审计信息。

### R7. 周期订阅管理

- R7.1. 订阅是周期订阅，不是一次性充值包。
- R7.2. 服务端需要订阅套餐表，至少包含：套餐 ID、名称、周期、价格、每周期赠送 Flux、是否启用、排序。
- R7.3. 周期单位必须可表达，如 monthly / quarterly / yearly，具体周期由管理员配置或按客户最终套餐定稿。
- R7.4. 用户购买订阅后，服务端记录用户订阅状态。
- R7.5. 用户订阅应包含：userId、planId、status、currentPeriodStart、currentPeriodEnd、cancelAtPeriodEnd、lastPaymentOrderId。
- R7.6. 每个计费周期成功支付后发放对应 Flux。
- R7.7. 订阅续期成功必须幂等，不能重复发放 Flux。
- R7.8. 订阅到期或支付失败后，状态必须可查询。
- R7.9. 用户个人中心显示当前订阅、周期、下次到期时间和本周期获得积分。
- R7.10. 管理员可以新增、编辑、禁用订阅套餐。

### R8. 易支付集成

- R8.1. 使用客户提供的易支付商户号、接口地址和密钥。
- R8.2. 本期必须跑通真实支付链路；不能只保留空接口或 dummy 配置作为交付结果。
- R8.3. 支持创建真实支付订单并返回可跳转支付 URL。
- R8.4. 支持异步回调验签。
- R8.5. 支持同步返回页跳转到前端订阅/个人中心。
- R8.6. 支付成功后更新订阅状态并发放 Flux。
- R8.7. 回调处理必须幂等。
- R8.8. 如果易支付无法原生周期扣款，则必须定义替代方案：周期套餐到期前提示续费，用户每期手动支付，支付成功后延长周期并发放 Flux。
- R8.9. 支付订单、回调 payload、验签结果和发放结果必须保留审计记录。
- R8.10. 真实易支付必须使用客户自己的易支付商户账号；没有商户 `pid` 和商户密钥 `key` 不能跑通真实收款。
- R8.11. `notify_url` 必须由服务端验签、校验订单归属/金额/商户号并幂等处理；不能把前端返回页当作发货依据。
- R8.12. `return_url` 只负责把用户带回订阅/个人中心展示支付结果或触发刷新；最终订阅和 Flux 发放状态以服务端异步回调处理结果为准。
- R8.13. 真实回调 URL 必须是易支付服务器可访问的公网 HTTPS/HTTP 地址；本地开发可以用 mock/假回调验证代码路径，但不能作为真实联调完成标准。

#### R8a. 真实 Epay 联调配置

真实 Epay 联调前必须向客户确认并配置以下服务端环境变量：

| 环境变量 | 必填场景 | 说明 | 示例 |
|---|---|---|---|
| `EPAY_PID` | 真实支付必填 | 易支付商户 ID / pid，由客户的易支付商户后台提供。 | `1001` |
| `EPAY_KEY` | 真实支付必填 | 易支付商户密钥，只能配置在服务端环境变量或 secret manager 中；不得入库，不得写入 migration、seed、admin config table、前端包、日志、错误详情或验收截图。 | `********` |
| `EPAY_API_URL` | 真实支付必填 | 易支付接口网关 base URL，服务端会拼接 `/submit.php` 生成跳转支付地址。 | `https://pay.example.com` |
| `EPAY_CALLBACK_BASE_URL` | 真实支付必填 | 易支付回调公网 base URL；只用于生成 `notify_url` 和 `return_url`。必须是易支付服务器可访问的公网 HTTP/HTTPS 地址。 | `https://api.example.com` |
| `API_SERVER_URL` | 已有服务端基础配置；仅在未设置 `EPAY_CALLBACK_BASE_URL` 且自身是公网地址时可作为回调 base URL 兜底 | 如果是 `localhost`、`127.0.0.1`、内网地址或只在开发机可访问的地址，不能用于真实易支付回调。 | `https://api.example.com` |
| `WEB_APP_URL` | 支付返回展示必填 | 同步 `return_url` 验签后重定向到的前端站点，用于刷新订阅/Flux 展示。 | `https://airi.example.com` |

当前 checkout 缺少真实商户配置或回调地址不是公网地址时应返回 `EPAY_NOT_CONFIGURED`，错误详情只列变量名：`EPAY_API_URL`、`EPAY_PID`、`EPAY_KEY`、`EPAY_CALLBACK_BASE_URL`；不得泄露 `EPAY_KEY` 的真实值，也不得回显任何完整商户配置。

联调和安全规则：

1. 真实支付必须先具备易支付商户账号、商户 `pid`、商户 `key` 和正确的网关地址。
2. 本地开发可以直接构造已签名或假回调请求验证订单状态、验签失败、金额不一致、重复回调幂等等代码路径。
3. Cloudflare Tunnel 只允许用于临时联调和演示，不是正式上线方案；Tunnel 重启可能更换域名，域名变化后必须更新 `EPAY_CALLBACK_BASE_URL`，并重新生成新的支付订单，不能继续使用旧订单的 `notify_url` / `return_url`。
4. 真实易支付服务器回调必须打到公网 `notify_url`：`${EPAY_CALLBACK_BASE_URL}/api/v1/epay/notify`；只有当 `API_SERVER_URL` 本身就是公网服务端地址时，才允许作为未显式设置 `EPAY_CALLBACK_BASE_URL` 的兜底。
5. 用户浏览器同步返回到 `${EPAY_CALLBACK_BASE_URL或API_SERVER_URL}/api/v1/epay/return` 后，只能用于展示“已支付/处理中/失败”并让前端查询 `/api/v1/epay/order/:outTradeNo`；不能在 `return_url` 里发放 Flux 或延长订阅。
6. `notify_url` 处理必须继续保持服务端验签、商户号校验、金额校验和以 `outTradeNo` 为幂等键的发放逻辑。
7. 配置了真实 `EPAY_API_URL`、`EPAY_PID`、`EPAY_KEY` 后，checkout 必须拒绝 `localhost`、`127.0.0.1`、`::1`、`0.0.0.0`、常见内网段和 link-local 地址作为回调 base URL，避免用户已付款但异步回调无法到达服务端。
8. 真实 `EPAY_KEY` 只能存在于服务端环境变量或 secret manager；不得写入数据库、migration、seed、admin config table、前端包、日志、错误详情或验收截图。所有错误响应、审计记录和验收材料只能出现变量名或脱敏占位符。

### R9. 前端中文化

- R9.1. Web 前端默认支持中文。
- R9.2. 设置页、个人中心、订阅页、服务来源页、模型选择页不能出现明显英文残留。
- R9.3. 错误提示、按钮、空状态、加载状态都需要中文。
- R9.4. i18n 文案统一放在 `packages/i18n`，不要散落在组件中。

### R10. 个人中心

- R10.1. 个人中心显示用户昵称、邮箱、头像、登录状态。
- R10.2. 个人中心显示 Flux 余额。
- R10.3. 个人中心显示当前订阅状态。
- R10.4. 个人中心显示当前周期起止时间。
- R10.5. 个人中心显示充值/订阅支付入口。
- R10.6. 个人中心提供退出登录。
- R10.7. UI 直接参考 `https://airi.moeru.ai/` 的个人中心/订阅方向，但按客户要求做更简洁版本。

### R11. 订阅页面

- R11.1. 显示所有启用订阅套餐。
- R11.2. 每个套餐显示价格、周期、赠送 Flux、说明。
- R11.3. 用户可以选择套餐并跳转易支付。
- R11.4. 支付返回后显示成功、处理中或失败状态。
- R11.5. 支付成功后刷新用户 Flux 和订阅状态。

### R12. UI 精简

- R12.1. 服务来源页删除第三方供应商入口。
- R12.2. 暂时不按额外截图删除 UI；后续若客户提供明确删除截图，再把每个删除点记录为独立清单项。
- R12.3. 保留必要的官方服务来源、模型选择、订阅、个人中心入口。
- R12.4. 不保留会误导用户自行配置第三方 key 的提示。

## Proposed Server Tables

### `commercial_models`

| 字段 | 说明 |
|---|---|
| id | 内部主键 |
| modelKey | 用户请求使用的模型 ID |
| displayName | 展示名 |
| capability | `chat` / `tts` / `image` |
| routerModelId | 映射到 LLM router 的模型 ID |
| enabled | 是否启用 |
| displayOrder | 排序 |
| description | 描述 |
| createdAt / updatedAt / deletedAt | 审计字段 |

### `model_prices`

| 字段 | 说明 |
|---|---|
| id | 内部主键 |
| modelId | FK → `commercial_models.id` |
| priceFluxPerCall | 每次请求扣多少 Flux |
| enabled | 是否启用 |
| effectiveFrom | 生效时间 |
| createdAt / updatedAt | 审计字段 |

### `subscription_plans`

| 字段 | 说明 |
|---|---|
| id | 内部主键 |
| planKey | 套餐 ID |
| displayName | 展示名 |
| periodUnit | `month` / `quarter` / `year` 等 |
| periodCount | 周期数量 |
| amountFen | 价格，单位分 |
| fluxAmount | 每周期赠送 Flux |
| enabled | 是否启用 |
| displayOrder | 排序 |
| description | 描述 |
| createdAt / updatedAt / deletedAt | 审计字段 |

### `user_subscriptions`

| 字段 | 说明 |
|---|---|
| id | 内部主键 |
| userId | 用户 ID |
| planId | FK → `subscription_plans.id` |
| status | `active` / `past_due` / `canceled` / `expired` |
| currentPeriodStart | 当前周期开始 |
| currentPeriodEnd | 当前周期结束 |
| cancelAtPeriodEnd | 是否到期取消 |
| lastPaymentOrderId | 最近支付订单 |
| createdAt / updatedAt | 审计字段 |

### `payment_orders`

可以扩展现有 `epay_orders`，或新建统一订单表。最小要求：

| 字段 | 说明 |
|---|---|
| outTradeNo | 本系统订单号 |
| userId | 用户 ID |
| planId | 订阅套餐 ID |
| amountFen | 支付金额 |
| status | `pending` / `paid` / `failed` 等 |
| periodStart / periodEnd | 此订单覆盖的订阅周期 |
| fluxAmount | 此订单成功后发放 Flux |
| fluxCredited | 是否已发放 |
| notifyPayload | 易支付回调原文 |
| createdAt / paidAt / updatedAt | 审计字段 |

## Current Implementation Disposition

| Area | Current evidence | Disposition | Target action | Completion condition |
|---|---|---|---|---|
| Server app foundation | `apps/server/src/app.ts` already mounts auth, health checks, Flux, OpenAI-compatible routes, audio routes, admin routes, and epay routes. | Reuse | Keep `apps/server` as the commercial backend entrypoint and add missing subscription/model-pricing modules through existing Hono + injeca patterns. | `/livez`, `/readyz`, auth, Flux, model, subscription, payment, and admin routes run from one server with targeted tests. |
| Better Auth account system | `apps/server/src/libs/auth.ts` enables email/password, email verification, OAuth/OIDC, admin plugin, bearer/JWT, and DB-backed sessions. | Reuse | Keep Better Auth and extend operational admin flows around it instead of replacing auth. | Users can register, verify, sign in/out, reset password, and access official-provider APIs through authenticated server sessions. |
| User schema and ban fields | `apps/server/src/schemas/accounts.ts` includes `role`, `banned`, `banReason`, and `banExpires`. | Keep | Preserve these fields as the source for admin/user state. | Banned users are blocked from login/session use and model gateway requests. |
| Admin user routes | `apps/server/src/routes/admin/index.ts` lists users and adjusts Flux; `apps/server/src/routes/admin/users/index.ts` sets balances; Better Auth admin plugin owns ban/unban endpoints. | Refactor | Consolidate admin UX/API around user listing, ban/unban, Flux adjustment, and role initialization. | Admin can search users, view detail, ban/unban, and adjust Flux without manual DB edits except documented bootstrap. |
| Flux balance and ledger | `apps/server/src/services/domain/billing/billing-service.ts`, `apps/server/src/routes/flux/index.ts`, and Flux transaction schemas already own server-side balance and history. | Reuse | Keep DB-ledger semantics but route all model/subscription credits and debits through fixed per-call/subscription flows. | Every subscription grant and model call writes an idempotent Flux transaction with audit metadata. |
| Current epay one-time top-up | `apps/server/src/routes/epay/index.ts` exposes hard-coded `FLUX_PACKAGES`; `apps/server/src/services/domain/epay.ts` creates and verifies epay orders. | Refactor | Convert from one-time package purchase to periodic subscription payment orders, or keep only shared signing/order helpers. | Real epay checkout creates subscription-cycle orders, verifies callback, extends subscription period, and grants Flux exactly once. |
| Stripe payment/subscription code | `apps/server/src/routes/stripe/*` and `apps/server/src/schemas/stripe.ts` exist, but Stripe subscription Flux crediting is explicitly incomplete. | Delete / Hide | Hide from customer-facing subscription flow unless explicitly retained for another market; do not mix Stripe into the epay customer delivery. | Customer-facing UI and docs use epay subscription only; Stripe code is isolated or removed from this track. |
| OpenAI-compatible backend gateway | `apps/server/src/routes/openai/v1` routes chat through the server and already has billing middleware. | Refactor | Keep gateway proxy, replace token/fallback pricing with model-catalog fixed price lookup. | Chat request to any enabled official model is authorized, proxied, and charged fixed Flux per call. |
| TTS backend gateway | `apps/server/src/routes/openai/v1/operations/speech-generation/index.ts`, audio routes, and TTS billing already route speech through server. | Reuse | Keep server-routed TTS and bind pricing to model catalog fixed per-call price. | TTS request charges the configured model price once per successful synthesis, independent of text length. |
| Image generation capability | Frontend has artistry provider pages; server-side image generation gateway/catalog/charging is not complete. | Refactor | Add official image generation model catalog and backend proxy before exposing image generation as a billed feature. | Image generation request goes through server, uses enabled image model, and charges fixed Flux per successful generation. |
| Router config | `apps/server/src/routes/admin/config/router/index.ts` writes `LLM_ROUTER_CONFIG` and upstream slices. | Reuse | Keep router config as operator-facing upstream routing, separate from user-visible model catalog and pricing. | Admin can map each commercial model to a router model/upstream without exposing upstream keys to users. |
| Provider catalog | `apps/server/src/routes/admin/provider-catalog/index.ts` and schema curate aliases/TTS voices. | Reuse | Keep curation concepts where useful, but do not treat it as full commercial model pricing. | TTS voices/models can be curated while commercial model pricing remains in dedicated tables. |
| Official provider frontend runtime | `packages/stage-ui/src/libs/providers/providers/index.ts` imports only `./official`; `official/shared.ts` routes through `SERVER_URL`. | Reuse | Keep the official provider as the only user-facing runtime provider. | User-facing provider registry exposes only official provider entries. |
| Third-party provider frontend UI/routes | `packages/stage-pages/src/pages/settings/providers/**` still contains OpenAI-compatible, Ollama, cloud, speech, transcription, and artistry provider pages. | Delete / Hide | Remove, hide, or redirect third-party provider pages and tabs for this customer build. | Service source UI shows only official provider and no third-party API-key setup paths. |
| Account/profile page | `packages/stage-pages/src/pages/settings/account/account-settings-page.vue` already shows account basics, auth actions, Flux, password, linked accounts, and deletion. | Refactor | Keep the page but add subscription status and simplify around the customer product flow. | Personal center shows profile, Flux, current subscription, period dates, and payment entry in Chinese. |
| Flux settings page | `packages/stage-pages/src/pages/settings/flux.vue` shows balance, history, and epay package purchase. | Refactor | Convert from top-up package page to subscription/pricing page, or split subscription UI into a focused page. | User can view plans, start epay checkout, return from payment, and see updated subscription/Flux status. |
| Chat persistence | Server has `apps/server/src/schemas/chats.ts` and `/api/v1/chats`; frontend also has browser session stores. | Refactor | Disable or avoid private server chat persistence for this customer flow; keep local browser chat as source of truth. | Normal user chat remains available after browser refresh through local storage and is not uploaded to server DB. |
| Character card persistence | Server has marketplace-style `characters` schema/routes; frontend has local Airi card stores. | Refactor | Keep server character tables only if isolated for marketplace/public catalog; user private character cards stay browser-local. | Private role/character card edits do not call server character persistence APIs. |
| Memory persistence | Memory modules/settings exist in frontend; customer requires local browser memory. | Reuse | Keep memory local and add copy/UX that explains local-only storage when needed. | User memory remains browser-local and is not included in server DB sync. |
| Chinese localization | `packages/i18n/src/locales/zh-Hans/settings.yaml` exists but still contains English strings. | Refactor | Complete Chinese strings for affected settings, provider, subscription, account, and error states. | Key customer flows show no obvious English fallback in zh-Hans locale. |
| Customer screenshot deletion list | Customer clarified that extra deletion screenshots are not needed for now; subscription/profile UI should directly reference `https://airi.moeru.ai/` with the simplest workable design. | Keep | Do not block on more screenshots. Only create deletion checklist items if the customer later provides explicit screenshots or instructions. | Phase 0 marks the screenshot deletion-list item complete; future UI work follows the website reference first. |
| Epay periodic billing capability | Customer has merchant credentials; whether epay supports automatic recurring billing remains unknown. | Investigate | Verify epay capability; if no auto recurring support, implement periodic plan with manual renewal per period. | Subscription behavior is documented and matches what the real epay provider can support. |
| Local development setup | Project requires Node 24; a project-local Node 24 zip setup exists in `.node24.local` and `use-node24.local.cmd`. | Keep | Use project-local Node 24 for this repo without changing global Node. | Developers can start web with Node 24 while other projects keep system Node unchanged. |

## Epay Periodic Billing Decision

Current decision: implement periodic subscriptions as renewable paid periods through Epay checkout. Each successful Epay payment buys or renews one subscription period, extends `currentPeriodEnd`, and grants that period's Flux exactly once.

Rationale: public documentation for common Chinese 易支付 / Epay / YiPay integrations describes an order-based checkout and notification flow (`submit.php` / `mapi.php`, `out_trade_no`, `notify_url`, `return_url`, and signature verification). It does not prove an automatic recurring-charge API. Until the customer's Epay provider supplies explicit recurring-charge documentation or a contract capability, the product must not promise unattended recurring billing. The UI should call this a subscription period and provide renewal before expiry.

Security and audit rule: do not store real merchant credentials in source-controlled files or database-backed configuration. The real `EPAY_KEY` must only come from server-side environment variables or a secret manager, and must not appear in migrations, seeds, admin config tables, frontend bundles, logs, error details, or acceptance screenshots.

Research references consulted:

- `https://zhunfu.cn/doc/index.php`
- `https://pay.yzfpay.com/doc/index.html`
- `https://www.ezfpy.top/doc`
- `https://docs.epay.dk/integration/web-service/recurring` — reviewed only as a different ePay product family; not evidence that common Chinese 易支付 supports recurring billing.

## Implementation Phases

### Phase 0 — 需求冻结与现状审计

- [x] 输出本需求文档。
- [x] 对当前已实现能力打标：保留、复用、重构、删除。
- [x] 明确客户要删除的 UI 截图清单：当前不按额外截图删除 UI，订阅/个人中心直接参考 `https://airi.moeru.ai/` 做简单方案。
- [x] 确认易支付是否支持自动周期扣款。

完成规则：每完成并验证一个清单项，立即把对应 `[ ]` 改成 `[x]`，并在会话可见任务列表中标记完成；不要等到整期结束再批量标记。

### Phase 1 — 数据边界和官方 provider 收敛

- [x] 前端服务来源只保留官方 provider。
- [x] 隐藏/删除第三方 provider 设置页入口。
- [x] 禁用用户私有聊天/角色/记忆服务端同步路径。
- [x] 明确本地存储 key、导出/清理入口和提示文案。

### Phase 2 — 模型目录与固定按次计费

- [x] 增加模型目录表和模型价格表。
- [x] 增加管理员模型 CRUD API。
- [x] 增加公开模型列表接口 `/api/v1/models`，前端 official provider 列表读取服务端启用模型。
- [x] Chat/TTS/ASR/Image 请求按 provider catalog 模型固定价格预检和扣费。
- [x] 移除或旁路 Chat token / TTS 字符动态计费逻辑，改为按模型固定按次扣费；token/字符仅保留为审计元数据。
- [x] Image 请求按模型固定价格预检和扣费：`/api/v1/images/generations` 已接入统一 official image generation route 和固定计费。

### Phase 3 — 周期订阅和易支付

- [x] 增加订阅套餐表和用户订阅表，并接入 subscription schema/domain。
- [x] 补齐 R7.5 用户订阅字段：`cancelAtPeriodEnd`、`lastPaymentOrderId`。
- [x] 增加订阅套餐管理 API：`/api/admin/subscriptions/plans` 支持 admin CRUD，`POST /api/admin/subscriptions/plans/defaults` 显式初始化 `monthly_basic` / `monthly_pro` 示例套餐；客户可在后台修改。
- [x] 改造易支付 checkout / notify：订单从一次性充值改为订阅周期订单。
- [x] Epay 订阅订单冻结 periodDays、planName、subject、金额和 Flux 快照，真实付款后即使管理员修改或禁用套餐，也按下单时承诺结算。
- [x] 支付成功后记录订阅周期并发放 Flux。
- [x] 处理重复回调幂等：以 `outTradeNo` 作为幂等键，避免同一订单重复发放 Flux。
- [x] 补齐 `epay_orders` migration 字段：`order_kind`、`plan_id`、`period_start`、`period_end`。
- [x] 修复 server-schema 虚拟迁移打包：内置 migrator 可识别 `0020_epay_subscriptions`。
- [x] 补齐真实 Epay 联调配置说明、缺失配置错误码和服务端安全校验：真实支付必须配置商户 `pid`、`key`、网关 URL 和公网回调 base URL。

### Phase 4 — 前端个人中心 / 订阅中心 / 中文化

- [x] 新增 `GET /api/v1/subscriptions/current`，用于显示当前订阅状态和 Flux。
- [x] Flux 设置页切换为订阅套餐 UX，并调用 `/api/v1/epay/plans`、`/api/v1/epay/checkout`（`planId`）和 `/api/v1/subscriptions/current`。
- [x] 支付返回后刷新订阅和 Flux 状态。
- [x] 补齐中文和英文文案。
- [x] 按客户澄清处理截图删除项：当前不按额外截图删除 UI，订阅/个人中心先参考 `https://airi.moeru.ai/` 做简单方案。

### Phase 5 — 验收与回归

- [x] 本轮聚焦类型检查通过：`node_modules/.bin/tsc.cmd -p apps/server/tsconfig.json --noEmit --pretty false`、`node_modules/.bin/vue-tsc.cmd --noEmit -p packages/stage-ui/tsconfig.json`、`node_modules/.bin/vue-tsc.cmd --noEmit -p packages/stage-pages/tsconfig.json` 均为 exit 0。
- [x] 添加后端单元测试和集成式测试。
- [x] 添加前端关键页面测试。
- [x] 本地验证 Docker + API + Web：本地 server/Docker 已由主线程启动；`GET http://localhost:3000/api/v1/epay/plans` 返回 200；stage-web 使用项目本地 Node 24 + `node_modules/.bin/vite.CMD` 启动在 `http://127.0.0.1:5174/`，`VITE_SERVER_URL=http://localhost:3000` 生效；未登录浏览器会按预期跳转 OIDC 登录页，使用浏览器验收脚本仅 stub 用户态鉴权接口后，`/settings/flux` 可渲染订阅套餐，套餐数据来自真实本地 API。
- [x] 输出客户验收清单。

## Acceptance Examples

- AE1. 新用户注册并登录后，服务端 DB 有用户记录，浏览器本地没有第三方 provider key 输入要求。
- AE2. 管理员封禁用户后，该用户不能使用模型接口。
- AE3. 管理员新增一个 chat 模型，设置每次 5 Flux；用户选择该模型请求一次，成功后扣 5 Flux。
- AE4. 管理员新增一个 TTS 模型，设置每次 3 Flux；用户合成一次语音，成功后扣 3 Flux，不随文本长短变化。
- AE5. 管理员新增一个图像模型，设置每次 20 Flux；用户生成一次图片，成功后扣 20 Flux。
- AE6. 用户购买月度订阅套餐，易支付回调成功后，服务端记录订阅周期并发放对应 Flux。
- AE7. 易支付重复回调同一订单，不会重复发放 Flux。
- AE8. 用户打开个人中心，可以看到当前订阅状态、周期到期时间和 Flux 余额。
- AE9. 用户打开服务来源页，只能看到官方 provider，看不到 OpenAI、Ollama、ElevenLabs、ComfyUI 等第三方入口。
- AE10. 用户刷新浏览器后，聊天、角色和记忆仍来自本地浏览器；服务端 DB 不保存这些私有数据。
- AE11. 前端中文页面没有明显英文残留。

## Open Questions

- Q1 当前结论：本期不承诺自动扣款，按“周期套餐 + 每期手动续费/支付成功后延长周期”交付；若 Epay 服务商后续提供明确自动扣款文档，再评估是否扩展。
- Q2. 客户要保留哪些具体模型？聊天、TTS、图像分别有哪些模型名称和上游？
- Q3. 每个模型每次请求扣多少 Flux？是否不同订阅等级有不同折扣？
- Q4. 订阅套餐周期和价格是什么？月付、季付、年付是否都需要？
- Q5. 图像生成是否已有目标上游 API？如果没有，需要先选定官方图像生成供应商。
- Q6. 管理后台是复用现有 `/admin`，还是需要单独设计新的后台 UI？
- Q7. 客户截图中“需要删东西”的完整列表是否已经提供？如果没有，需要逐页截图确认。

## Current Repo References

- 后端入口：`apps/server/src/app.ts`
- Auth：`apps/server/src/libs/auth.ts`
- 用户 schema：`apps/server/src/schemas/accounts.ts`
- Flux routes：`apps/server/src/routes/flux/index.ts`
- Billing：`apps/server/src/services/domain/billing/billing-service.ts`
- 当前易支付 routes：`apps/server/src/routes/epay/index.ts`
- 当前易支付 service：`apps/server/src/services/domain/epay.ts`
- 当前模型/router config：`apps/server/src/routes/admin/config/router/index.ts`
- 当前 provider catalog：`apps/server/src/routes/admin/provider-catalog/index.ts`
- 当前前端 Flux 页面：`packages/stage-pages/src/pages/settings/flux.vue`
- 当前账号设置页：`packages/stage-pages/src/pages/settings/account/account-settings-page.vue`
- 当前 provider 设置页：`packages/stage-pages/src/pages/settings/providers/index.vue`
- 当前 provider registry：`packages/stage-ui/src/libs/providers/providers/index.ts`
- 中文文案：`packages/i18n/src/locales/zh-Hans/settings.yaml`
