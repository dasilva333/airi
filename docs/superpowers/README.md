# 设计与实施索引

本页索引仓库内的正式设计和实施计划。是否需要创建文档由任务复杂度决定，小型任务不要求额外写计划；一旦创建正式文档，就必须在这里登记并维护结果。

## 状态

- `planned`：方案已确定，尚未开始实施。
- `in-progress`：已经实施，但计划范围尚未全部完成或验收。
- `done`：验收目标已经完成，并有对应实现提交。
- `superseded`：文档或方案已被后续实现替代，不再作为执行依据。

## 工作项

| 日期 | 工作项 | 状态 | 设计 | 实施计划 | 实现依据 |
| --- | --- | --- | --- | --- | --- |
| 2026-07-04 | Commercial Backend Phase 0 收尾 | `done` | [Design](specs/2026-07-04-commercial-backend-phase-0-design.md) | [Plan](plans/2026-07-04-commercial-backend-phase-0-closure.md) | [`cee66adea`](https://github.com/riverben-max/airi/commit/cee66adea3b73abcb1c126c77fc2aff4925f0bff) |
| 2026-07-04 | Phase 1 官方 Provider 与本地数据边界 | `done` | [Design](specs/2026-07-04-commercial-backend-phase-1-provider-data-boundary-design.md) | 无有效 Plan（[现存文件为空](plans/2026-07-04-commercial-backend-phase-1-provider-data-boundary.md)） | [`cee66adea`](https://github.com/riverben-max/airi/commit/cee66adea3b73abcb1c126c77fc2aff4925f0bff) |
| 2026-07-04 | Phase 1 私有同步与第三方 Provider 硬阻断 | `done` | [Design](specs/2026-07-04-phase-1-hard-block-design.md) | - | [`cee66adea`](https://github.com/riverben-max/airi/commit/cee66adea3b73abcb1c126c77fc2aff4925f0bff) |
| 2026-07-10 | Character-First Web 性能优化 | `in-progress` | [Design](specs/2026-07-10-character-first-web-performance-design.md) | [Plan](plans/2026-07-10-character-first-web-performance.md) | 已完成 Task 1-5，最近提交 [`755f13bde`](https://github.com/riverben-max/airi/commit/755f13bde365991eb74d04b274fd7371f49b2b25)；Task 6-8 尚未确认完成 |
| 2026-07-10 | Web 首次引导进入登录 | `done` | [Design](specs/2026-07-10-web-onboarding-login-entry-design.md) | [Plan](plans/2026-07-10-web-onboarding-login-entry.md) | [`c868a7fae`](https://github.com/riverben-max/airi/commit/c868a7faec1b07fe09470b3a532d052b643fec8d) |
| 2026-07-11 | 返回用户会话失效自动登录 | `done` | [Design](specs/2026-07-11-returning-user-auth-redirect-design.md) | [Plan](plans/2026-07-11-returning-user-auth-redirect.md) | [`4956a8f9e`](https://github.com/riverben-max/airi/commit/4956a8f9e7e8cd76815a6679e56657a2ed4e5559) |
| 2026-07-11 | 头像菜单 Flux 入口与本地化 | `done` | [Design](specs/2026-07-11-header-avatar-flux-menu-localization-design.md) | [Plan](plans/2026-07-11-header-avatar-flux-menu-localization.md) | [`791812663`](https://github.com/riverben-max/airi/commit/79181266366741c65c3dcf9d1999259faae72782) |
| 2026-07-11 | 管理后台上游模型发现 | `done` | [Design](specs/2026-07-11-admin-upstream-model-discovery-design.md) | [Plan](plans/2026-07-11-admin-upstream-model-discovery.md) | [`141b3eee5`](https://github.com/riverben-max/airi/commit/141b3eee5) |
| 2026-07-12 | Web 语音输入设备刷新 | `done` | [Design](specs/2026-07-12-web-voice-input-device-refresh-design.md) | [Plan](plans/2026-07-12-web-voice-input-device-refresh.md) | [`cfee37470`](https://github.com/riverben-max/airi/commit/cfee374701230c901bd98307cf6ee0550ba21723) |
| 2026-07-13 | Web 用户界面中文化 | `done` | [Design](specs/2026-07-13-web-interface-localization-design.md) | [Plan](plans/2026-07-13-web-interface-localization.md) | [`1519e6165`](https://github.com/riverben-max/airi/commit/1519e61653b4b011c8d1936a44a00c2540ae36a1)；完成全量静态审计、stage-layouts 44/44 测试、生产构建（4,825 个模块）及桌面/移动端浏览器 QA；高复杂度实验/内部界面按批准边界保留 |
| 2026-07-15 | 生产 Redis 公网暴露修复 | `done` | - | [Plan](plans/2026-07-15-production-redis-exposure-fix.md) | [`05a3f117f`](https://github.com/riverben-max/airi/commit/05a3f117f502c522ab6be6f7ebf12903cd75d06e)；Redis 已仅绑定本机，路由配置已恢复并完成生产验收 |
| 2026-07-15 | 管理后台模型接入简化 | `done` | - | [Plan](plans/2026-07-15-admin-gateway-simple-config.md) | [`feb1a0cae`](https://github.com/riverben-max/airi/commit/feb1a0cae)；相关测试、生产构建和线上静态资源验收通过 |
| 2026-07-17 | New API 服务器迁移 | `done` | - | [Plan](plans/2026-07-17-new-api-server-migration.md) | 计划提交 [`63df95ae3`](https://github.com/riverben-max/airi/commit/63df95ae3)；已迁移到 `8.137.153.77`，根页面、状态 API、模型接口和容器重启验收通过，旧服务器保持不变 |

## 维护规则

- 新建正式 design 或 plan 时，新增或更新对应工作项，不为同一主题重复建行。
- 完成或替代方案时，同步更新状态以及实现或替代依据（如有）；状态以代码与验收证据为准，不以计划中的复选框为准。
- 删除或移动文档时同步修正链接，确保本页始终能够作为统一入口。
