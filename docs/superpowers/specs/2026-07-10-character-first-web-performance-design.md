# Character-First Web Performance Design

## 目标

本轮优化只解决一个用户可感知目标：打开 `https://airi.aifamily.vip/` 后，人物应尽快出现；人物加载失败时，页面不能长时间保持空白或无限 loading。

用户已确认不需要“首次打开就下载完整离线包”。缓存策略改为按需缓存：资源实际被使用时才下载和缓存，未使用的 WASM、Worker、模型和路由代码不得在首页后台批量下载。

## 已确认基线

2026-07-10 的桌面冷启动和服务器审计得到以下基线：

| 指标 | 当前值 |
|---|---:|
| VPS 回环根 HTML TTFB 中位数 | 约 8.4 ms |
| 客户端冷启动根 HTML TTFB | 约 1.08 s |
| 客户端冷启动 FCP | 约 5.2 s |
| 同一浏览器热缓存 FCP | 约 0.74 s |
| 主入口 JS | 5,582,746 B raw / 约 1.63 MB gzip |
| 当前 Workbox precache | 582 项 / 153.76 MiB raw |
| 当前浏览器 Cache Storage | 约 168 MB |
| 首页无条件 DuckDB WASM | 32,604,029 B / 约 8.64 s |
| Hiyori Free ZIP | 13,048,481 B |
| Hiyori Pro ZIP | 33,154,227 B |

VPS 的 CPU、内存、磁盘 I/O 和 Nginx 响应时间均未显示当前性能瓶颈。根因在客户端冷启动数据量、错误的初始化依赖和缓存头，而不是服务器算力。

## 根因

### 1. 人物 loading 被无用 DuckDB 阻塞

`ControlStripHost.vue` 在 `onMounted` 中无条件初始化 DuckDB，并等待实验表 `memory_test` 创建完成后才把共享状态设为 `mounted`。该数据库没有任何有效业务读写，唯一的插入代码已经注释。

这会产生三个问题：

1. 首页额外下载并实例化约 32.6 MB 的 DuckDB WASM。
2. DuckDB 完成前，页面 loading 状态不能可靠反映人物是否已渲染。
3. DuckDB 初始化失败时，人物区域可能永远不能结束 loading。

### 2. PWA 首次安装预缓存整个产品包

当前 Workbox 配置把单文件上限提高到 64 MiB，但没有收窄 `globPatterns`。生成的 Service Worker 因而预缓存三套 DuckDB WASM、ORT WASM、RWKV WASM、数百个按需 JS 和 Worker。

Service Worker 在 App 挂载后立即注册，批量缓存与人物 ZIP、字体和首屏动态块竞争网络。每次新版本安装也会重新产生大规模缓存写入。

### 3. 内置人物 ZIP 包含运行时不需要的编辑器源文件

Hiyori ZIP 同时打包了 Cubism 编辑器源文件和 Web Runtime 文件：

| 模型 | 当前 ZIP | `.cmo3/.can3` 压缩后占用 | 预计 runtime-only ZIP |
|---|---:|---:|---:|
| Hiyori Free | 12.44 MiB | 9.64 MiB | 约 2.8 MiB |
| Hiyori Pro | 31.62 MiB | 27.34 MiB | 约 4.3 MiB |

运行时 `model3.json` 只引用 `.moc3`、纹理、physics、pose、cdi 和 motions，不引用 `.cmo3` 或 `.can3`。删除编辑器源文件不改变人物外观、动作或物理效果。

### 4. 人物初始化排在可选服务之后

`App.vue` 当前按顺序等待聊天会话、localhost Mods WebSocket、Context Bridge，最后才加载 IndexedDB 中的人物列表并选择舞台模型。Mods WebSocket 有最长 5 秒等待路径，可选服务失败也可能中断后续人物初始化。

### 5. 哈希静态资源没有得到长期缓存

生产 Nginx 外层和内层静态类型规则均漏掉 `.wasm`、`.zip`、`.avif`、`.task`、`.vrm` 等资源。未命中的文件继承 `Cache-Control: no-cache`，Cloudflare 对它们显示 `DYNAMIC` 或频繁 revalidate。

## 目标启动流程

首页启动顺序调整为：

1. HTML 和最小应用壳加载。
2. Vue 挂载后立即读取本地人物列表并解析当前舞台模型。
3. Renderer 根据模型类型加载 runtime-only ZIP 或用户模型。
4. 只有实际 Renderer 报告人物已挂载时，人物 loading 才结束。
5. 聊天历史、Mods WebSocket、Context Bridge、分析、PWA 更新等可选服务独立初始化，不阻塞步骤 2 到 4。
6. 非首屏 WASM、Worker、设置页和本地 AI 功能在用户使用时才下载。

人物渲染状态和可选基础设施状态必须分离。数据库、WebSocket 或分析服务不能再写入或决定人物的 `mounted` 状态。

## 设计

### A. 删除首页 DuckDB 实验初始化

从 `ControlStripHost.vue` 删除：

- DuckDB 类型导入。
- `drizzle` 和 bundle 导入。
- `db` ref。
- `memory_test` 的注释实验代码。
- `onMounted` 中的数据库初始化和建表。

`onMounted` 只保留与人物本身有关的自定义动画加载。共享 `state` 继续由 `RendererStage` 下游的 Live2D、VRM、Spine 或 MMD Renderer 驱动。

这不是把 DuckDB 改成后台加载。完整目标是首页不再请求或实例化 DuckDB；真正需要数据库的功能以后在自己的功能边界内按需导入。

### B. 人物初始化前置并隔离失败

把 `App.vue` 挂载后的工作拆成两个边界：

- `initializeCharacterDisplay`：加载人物列表并初始化舞台模型。这条路径立即启动，有独立错误处理。
- `initializeOptionalServices`：聊天会话、Server Channel、Context Bridge、Character Orchestrator 等按依赖关系初始化，但不被人物路径等待。

可选服务使用显式错误隔离。一个服务失败只能影响自身功能，不能跳过人物初始化。

### C. 构建 runtime-only 内置模型

在 Web 构建流程中，对下载到本地的 Hiyori Free 和 Hiyori Pro ZIP 做可重复的 runtime-only 转换：

- 删除 `.cmo3` 和 `.can3`。
- 保留目录结构、`model3.json`、`.moc3`、纹理、motions、expressions、physics、pose、cdi、许可证和说明文件。
- 重新生成 ZIP 后再交给 Vite 做内容哈希。
- 不提交下载得到的模型二进制；转换逻辑必须进入 Git，保证 clean checkout 可复现。

构建时应校验 ZIP 至少包含一个 `model3.json`，且该文件引用的所有相对资源仍存在。转换后缺少运行时引用必须让构建失败，不能生成一个表面成功但人物不可见的包。

### D. PWA 改为按需缓存

Service Worker 不再预缓存全部 `js/wasm/css/html`。目标行为：

- 导航文档使用 Network First，优先拿到当前部署的 HTML。
- 同源 `/assets/` 哈希资源使用 Cache First，仅在页面实际请求后写入运行时缓存。
- `/api/`、`/auth/`、`/ui/`、第三方 API 和 WebSocket 不进入静态运行时缓存。
- 运行时缓存设置条目数、过期时间和 quota 清理策略。
- PWA 更新不得在人物首次加载期间启动大规模预取。
- 新 Service Worker 激活后清理旧的 168 MB precache。

首轮实现保留 manifest 和现有安装入口，但不承诺完整离线使用。离线时只保证已经访问过并仍在运行时缓存中的资源可能可用。

### E. Nginx 和 Cloudflare 静态缓存

两个 Nginx 层都应明确识别 `/assets/` 下的构建资源，不依赖不完整的扩展名白名单。该 location 必须先执行等价于 `try_files $uri =404` 的存在性检查；缺失资源不能回退到 `index.html`，更不能把 SPA HTML 以静态资源 URL 长期缓存。

目标响应头：

```text
Cache-Control: public, max-age=31536000, immutable
```

该规则覆盖 JS、CSS、WASM、ZIP、AVIF、VRM、TASK、字体和其他 Vite 构建资产。未哈希但目录本身带明确版本号的 Cubism SDK 也可使用该规则。`index.html` 保持 `no-cache` 或 Network First，不设置长期 immutable。`/api/`、`/auth/` 和 `/ui/` 不得被该静态规则误缓存。

修改宝塔/Nginx 配置前必须备份；修改后运行 `nginx -t`，通过后只 reload Nginx，不重启无关 PM2 服务。Cloudflare 公网响应必须复核 `CF-Cache-Status` 和浏览器缓存头。

### F. 人物失败、重试和会话级回退

现有 Live2D 加载器不能再通过 `finally` 把失败伪装成 `mounted`。人物加载应产生明确的成功或错误信号。

处理规则：

1. 网络或解包失败时，对同一 URL 自动重试一次。
2. 内置模型第二次仍失败时，本次会话回退到瘦身后的 Hiyori Free。
3. 会话级回退不修改用户持久化的模型选择。
4. 自定义模型失败时不自动替换用户模型，显示可重试状态并保留设置入口。
5. 回退模型也失败时结束无限 loading，显示明确错误和重试动作。

错误状态不得覆盖聊天区和设置入口，用户仍应能操作页面。

## 测试策略

### 构建和静态检查

- runtime-only ZIP 测试：不含 `.cmo3/.can3`，包含 `model3.json`，所有运行时引用存在。
- 体积断言：Free ZIP 小于 3.2 MiB，Pro ZIP 小于 4.8 MiB。
- Service Worker 清单断言：不含 DuckDB、ORT、RWKV 或未访问的 Worker/WASM 预缓存。
- Service Worker 首装预缓存目标小于 1 MiB；运行时缓存按请求增长。
- 生产产物不含 `api.airi.build`，并包含正确的 `VITE_SERVER_URL`。

### 组件和初始化测试

- `ControlStripHost` 挂载时不调用 DuckDB，不创建 `memory_test`。
- 可选 WebSocket 超时或拒绝时，舞台模型初始化仍立即执行。
- IndexedDB、聊天会话或 Context Bridge 单点失败时，其他初始化边界继续运行。
- Renderer 只有真正完成模型加载时才报告 `mounted`。
- 内置模型失败一次会重试，第二次失败使用会话级 Free 回退。
- 自定义模型失败不会改写持久化选择。

### 浏览器验证

使用桌面视口和全新浏览器存储进行冷启动验证：

- 首页没有 `duckdb-*.wasm` 请求。
- Service Worker 安装不产生数百个预取请求。
- 内置模型请求使用 runtime-only ZIP。
- 人物 Canvas 非空且人物可见。
- 冷启动人物可见目标为 8 秒内；热缓存目标为 2 秒内。
- 模型请求失败时能看到重试或回退结果，不出现无限空白。
- 页面没有 `Electron ipcRenderer is not available` 和 `api.airi.build` 请求。

验证同时记录 navigation timing、FCP、人物 mounted 时间、请求数、传输字节数和 Cache Storage 使用量，和本设计中的基线对比。

### 升级验证

必须覆盖从当前生产 Service Worker 升级到新版本的路径：

- 当前 582 项 precache 能被清理。
- 新旧入口 hash 切换时不出现旧 HTML 引用已删除资源的白屏。
- 普通刷新和 `Ctrl + F5` 均能进入当前版本。

## 部署设计

1. 所有代码先提交并 push 到 `fork/codex/dasilva-commercial-subscription`。
2. 使用项目 Node 24 和 pnpm 10.32.1 构建 Stage Web。
3. 构建前确认 `apps/stage-web/.env.production` 指向 `https://airi.aifamily.vip`。
4. 记录 GitHub commit SHA 和构建产物 hash。
5. 备份 Nginx 配置和当前 Web 静态目录。
6. 发布时保留 `/www/wwwroot/airi-web/ui`。
7. 不覆盖 server `.env` 或 `.env.local`，并验证前后 SHA256 不变。
8. 只在后端代码确实变化时重启 `airi-api`；本轮前端优化默认不重启 PM2。
9. 部署后验证根页面、session API、Auth UI、Nginx 配置、缓存头和真实浏览器人物可见性。

## 非目标

- 不在本轮全面重构 5.58 MB 主入口。
- 不在本轮重做字体体系、所有语言包或 UnoCSS 扫描范围。
- 不把所有设置页和本地 AI 功能重新分包。
- 不改变用户的聊天、人物卡、订阅或计费逻辑。
- 不删除 DuckDB 包本身；只删除首页的无用引用。
- 不承诺完整离线运行。

上述问题可以在人物优先目标达成并取得新基线后进入第二阶段。

## 验收标准

- 首页冷启动不请求任何 DuckDB 资源。
- DuckDB 不再控制人物 loading 或 `mounted` 状态。
- Hiyori Free runtime-only ZIP 小于 3.2 MiB，Hiyori Pro 小于 4.8 MiB。
- 首次 Service Worker 安装不批量缓存 WASM、Worker、路由语言包或全部产品代码。
- 新 Service Worker 能清理当前约 168 MB 的旧 precache。
- `/assets/` 哈希资源公网响应包含一年 immutable 缓存策略。
- HTML、API、Auth UI 不被静态资源规则错误长期缓存。
- 人物初始化不等待 Mods WebSocket、聊天历史或 Context Bridge。
- 内置人物失败时会重试并提供会话级回退；自定义模型失败不会覆盖用户选择。
- 桌面冷启动人物在当前测试链路上目标 8 秒内可见，热缓存目标 2 秒内可见。
- 部署后真实浏览器中人物可见、聊天和设置可用，且没有错误 API 域名请求。
