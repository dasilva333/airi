# 生产 Redis 公网暴露修复实施计划

## 背景与直接根因

生产 AIRI API 将运行时 LLM 路由配置保存在 Redis。生产 Redis 端口曾以
`6379:6379` 发布到所有网络接口，同时未启用认证。Redis 命令统计显示已发生
多次 `FLUSHALL` 和 `FLUSHDB`，配置丢失时间与 RDB 保存空状态的时间一致，导致
API 返回 `CONFIG_NOT_SET`。

## 实施范围

1. 立即在宿主机阻断来自公网的 Redis 6379 访问。
2. 将 Compose 端口映射固定为 `127.0.0.1:6379:6379`，从部署配置层永久移除公网入口。
3. 备份生产 Compose、Redis 数据文件及 API 环境文件哈希。
4. 仅重建 Redis 容器，不重启或修改其他生产服务。
5. 清除可能被外部写入的 Redis 临时数据，重新写入加密的 LLM 路由配置并持久化。

## 验收标准

- Docker 与宿主机只在 `127.0.0.1:6379` 监听 Redis。
- AIRI API 继续使用既有 Node.js 22.20.0 进程运行并能连接 Redis。
- `LLM_ROUTER_CONFIG` 和 `DEFAULT_CHAT_MODEL` 存在且无过期时间。
- 上游模型请求返回合法的 Chat Completions 流式响应。
- 部署前后 `.env` 与 `.env.local` SHA-256 保持不变。
- 修复提交已推送到 `fork/main`。

## 回滚

若 Redis 容器重建失败，恢复备份的 Compose 文件和 Redis 数据文件，仅重建 Redis
容器；API 环境文件不得参与回滚或覆盖。

## 实施结果

2026-07-15 已按计划完成：Redis 仅监听 `127.0.0.1:6379`，公网连通测试失败；
API 进程保持原 PID 与 Node.js 22.20.0，健康检查为 200；两个路由配置键均无
过期时间并已执行持久化；上游 Chat Completions 流式请求返回 200；API 环境文件
部署前后 SHA-256 一致。
