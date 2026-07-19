# AIRI 项目协作指南

这份文件只记录长期有效、确实会影响代码安全或生产部署的约束。临时分支、一次性 worktree、当前提交 SHA 和历史备份位置不要写成永久规则。用户在当前任务中的明确要求优先于这里的默认流程。

## 代码基线与 Git

- 私有仓库是 `riverben-max/airi`，远端名为 `fork`；`fork/main` 是唯一正式主线。
- 开始任务前先了解当前分支和工作区状态，并同步最新 `fork/main`。保留用户已有的未提交改动，不要擅自清理或覆盖。
- 只有需要隔离的改动才创建 `codex/<short-description>` 短期分支。完成后合并回 `main`，并删除不再需要的本地和远端分支。
- 准备部署的代码必须先提交并推送到 GitHub，且能够对应到明确的 commit SHA。不要部署只存在于本机的改动。
- 提交只包含当前任务相关文件。不要强推、重写共享历史或执行破坏性 Git 命令，除非用户明确要求。
- Commit message 优先使用 Conventional Commits，例如 `fix(web): restore flux menu`。

## 修改与验证

- 改动保持聚焦，沿用仓库现有结构、组件和编码风格；不要顺手重构无关代码。
- TypeScript 避免无理由使用 `any`；Vue 使用 Composition API 和 `<script setup lang="ts">`。
- UI 文案统一放在 `packages/i18n`；通用组件优先复用 `@proj-airi/ui`，图标优先使用项目已有图标库。
- Web 代码调用 Electron-only API 前必须判断 `window.electron?.ipcRenderer`，避免网页端抛出 IPC 错误。
- 默认采用快速交付：普通功能、UI、文案和局部 bug 直接实现，不创建 worktree、不写设计或实施计划、不做额外审查、不调用审查代理，也不运行全量测试、全量类型检查、全量构建或浏览器巡检。
- 验证只保留完成当前改动所必需的一项最小检查；纯文案、样式或低风险局部交互可跳过自动化测试。用户要求跳过验证时直接跳过，并在交付说明中如实注明。
- 修复 bug 先确认直接根因；只有该 bug 容易复发且最小测试成本很低时才补回归测试。
- 仅当用户明确要求，或任务涉及生产部署、安全、认证、支付、数据迁移、不可逆数据操作或跨模块架构改动时，才创建正式设计或实施计划；创建后才需要登记到 `docs/superpowers/README.md`。

## 本机环境

- 默认工作目录为 `D:\Tools\airi`，默认 shell 为 PowerShell 7。
- 文本统一使用 UTF-8 无 BOM 和 LF。PowerShell 写文件使用 `-Encoding utf8NoBOM`；Python 使用 `encoding='utf-8'` 和 `newline='\n'`。
- 前端生产构建使用项目专用 Node 24：`D:\Tools\airi\.node24.local\node-v24.13.0-win-x64\node.exe`。
- pnpm 使用该 Node 目录内 Corepack 提供的 `10.32.1`，不要误用 Codex runtime 的全局 pnpm。
- 构建前必须将 `D:\Tools\airi\.node24.local\node-v24.13.0-win-x64` 置于当前 PowerShell 的 `PATH` 首位；否则 pnpm 脚本的 `vite` shebang 会误用系统 Node 20。固定构建命令为：`$node24 = 'D:\Tools\airi\.node24.local\node-v24.13.0-win-x64\node.exe'`、`$corepack24 = 'D:\Tools\airi\.node24.local\node-v24.13.0-win-x64\node_modules\corepack\dist\corepack.js'`、`$env:PATH = 'D:\Tools\airi\.node24.local\node-v24.13.0-win-x64;' + $env:PATH`、`& $node24 $corepack24 pnpm --filter @proj-airi/stage-web build`。
- 若本机 `vite`、`rollup` 或其他 pnpm 链接缺失，先以同一 Node 24/COREPACK 组合修复 `node_modules`；不要以系统 Node 或全局 pnpm 重装。非冻结安装可能重写 `pnpm-lock.yaml`，此类仅为本机恢复产生的锁文件改动不得提交。
- 常用范围：`apps/stage-web` 是 Web 入口，`apps/server` 是 API，`apps/ui-server-auth` 是认证 UI，`packages/stage-ui`、`packages/stage-layouts` 和 `packages/stage-pages` 是主要前端包，翻译位于 `packages/i18n`。

## 生产部署安全

生产站点是 `https://airi.aifamily.vip/`，通过 `ssh airi-vps` 连接。部署仅在用户要求时执行，并默认从已经推送到 `fork/main` 的明确 commit 构建。

- 服务器源码目录是 `/root/airi`，备份放在 `/root/deploy-backups`。主站存在两个必须同步的静态目录：`/www/wwwroot/airi.aifamily.vip`（HTTPS vhost 的资源目录）和 `/www/wwwroot/airi-web`（本机 `5173` vhost 的目录）。认证 UI 位于 `/www/wwwroot/airi-web/ui`。
- 不要只同步其中一个静态目录。当前 HTTPS vhost 的 `/index.html` 与 `/sw.js` 会反向代理到 `127.0.0.1:5173`，而 `5173` 的 root 是 `/www/wwwroot/airi-web`；只更新 `airi.aifamily.vip` 会导致服务器资源已更新、但公网 HTML 仍引用旧版入口。
- 不要把服务器 IP、密钥、token、SMTP 密码或其他 secret 写入仓库和交付说明。
- 部署前备份将被替换的内容。不要覆盖 `/root/airi/apps/server/.env` 和 `.env.local`；部署前后校验这两个文件的 SHA-256，确认没有变化。
- 本地前端构建使用 Node 24；服务器 `airi-api` 固定使用 Node.js `22.20.0`，实际二进制为 `/www/server/nvm/versions/node/v22.20.0/bin/node`。`ssh airi-vps` 的默认 `node` 当前是 Node 18，不能用于判断或操作 API 运行时；用 `ss -ltnp | grep ':6112'` 定位进程，再检查 `/proc/<pid>/exe --version`。
- 非交互 SSH shell 的 `PATH` 不包含 `pm2`。不要因 `pm2: command not found` 重启或重装服务；先通过端口 `6112`、`/proc` 进程路径和 API 响应检查服务。仅在已定位项目 PM2 可执行路径且用户授权时操作 `airi-api`。
- PM2 只操作 `airi-api`。不要重启、删除或清理 `oai-reverse-proxy` 及其他服务。
- `apps/stage-web/.env.production` 必须设置 `VITE_SERVER_URL=https://airi.aifamily.vip`，避免前端错误请求 `api.airi.build`。
- 发布主站静态文件时，必须先分别备份两个静态目录，并将同一份 `apps/stage-web/dist` 同步到两处；每次同步都保留 `/ui`、`.user.ini`、`.htaccess` 与 `.well-known`，例如使用 `rsync --delete --exclude=/ui/*** --exclude=.user.ini --exclude=.htaccess --exclude=.well-known/***`。不要让主站同步删除认证 UI 或服务器控制文件。
- 部署后按改动范围验证，至少确认 `airi-api` online、Node 版本正确、两个静态目录都含有本次构建的入口资源，并用公网请求确认主页 HTML 确实引用该入口；仅看到其中一个服务器目录已更新不能视为发布成功。涉及 UI 时再进行真实浏览器检查。

## 默认收尾

1. 确认改动范围和工作区状态。
2. 运行本次任务必要且未被用户免除的验证。
3. 提交并推送到 `fork`。
4. 使用短期分支时，将其合并到 `main` 后删除，避免长期堆积分支。
5. 只有用户要求发布时才部署，并记录 branch、commit SHA、部署时间和结果。
