# AIRI 客户部署交付指南

> 文档版本：V1.0
> 更新日期：2026-07-17
> 适用版本：以《交付清单》中记录的 Git commit SHA 为准
> 适用对象：客户 IT 管理员、运维工程师、实施人员

## 1. 文档说明

本文档用于指导客户在自有 Linux 服务器上部署 AIRI Web 版，包括主站、认证页面、API、PostgreSQL、Redis、Nginx 与 HTTPS。本文采用生产部署方式，不适用于直接在个人电脑上运行开发环境。

文中所有 `example.com`、`<...>` 和示例密码均为占位符，必须替换为客户自己的信息。不要把真实密码、Token、私钥或 SMTP 凭据提交到 Git 仓库，也不要通过截图或普通聊天工具传播。

### 1.1 部署结果

完成后应提供以下入口：

| 服务 | 示例地址 | 用途 |
|---|---|---|
| AIRI 主站 | `https://airi.example.com` | 用户访问和使用 AIRI |
| 认证中心 | `https://accounts.example.com/ui/` | 登录、注册、验证邮箱和重置密码 |
| API | `https://api.example.com` | HTTP API、WebSocket、OAuth 回调和健康检查 |
| 管理入口 | `https://airi.example.com/admin` | 管理员配置上游模型和业务参数 |

### 1.2 推荐架构

```text
Internet
   |
   +-- airi.example.com -------- Nginx -------- AIRI Web 静态文件
   +-- accounts.example.com ---- Nginx -------- 认证 UI 静态文件
   +-- api.example.com --------- Nginx -------- API 容器 127.0.0.1:6112
                                                     |
                                                     +-- PostgreSQL（Docker 内网）
                                                     +-- Redis（Docker 内网）
```

数据库和 Redis 不对公网开放。Nginx 是唯一公网入口，负责 HTTPS、静态文件和 API 反向代理。

## 2. 部署前准备

### 2.1 服务器建议

| 项目 | 最低配置 | 推荐配置 |
|---|---|---|
| 操作系统 | Ubuntu Server 22.04 LTS 64 位 | Ubuntu Server 24.04 LTS 64 位 |
| CPU | 2 核 | 4 核或以上 |
| 内存 | 4 GB | 8 GB 或以上 |
| 磁盘 | 40 GB SSD | 80 GB SSD 或以上 |
| 网络 | 固定公网 IP | 固定公网 IP，带宽 10 Mbps 或以上 |

模型推理由外部上游服务提供时，服务器通常不需要 GPU。如果客户计划在同一台服务器部署本地模型，应按模型要求单独评估 GPU、显存、内存和磁盘，本手册不包含本地模型部署。

### 2.2 客户需准备的信息

- 三个已解析到服务器公网 IP 的域名：主站、认证中心、API。
- AIRI 私有仓库的只读访问权限，以及交付方确认的 commit SHA。
- Google OAuth Client ID 和 Client Secret。
- GitHub OAuth Client ID 和 Client Secret。
- 可发送邮件的 SMTP 账号，或 Resend API Key。
- 至少一个兼容 OpenAI 协议的模型上游地址、API Key 和模型名称。
- 如启用支付：Stripe 或易支付商户参数。
- 一个用于接收管理员权限的已验证邮箱。

### 2.3 DNS 与防火墙

为三个域名创建 `A` 记录并指向服务器公网 IP。服务器安全组和防火墙只需放行：

- `22/tcp`：SSH，仅建议对管理 IP 放行。
- `80/tcp`：HTTP，用于证书签发和跳转 HTTPS。
- `443/tcp`：HTTPS。

不要对公网放行 `5432`、`6379`、`6112`。本方案中的 API 端口只监听 `127.0.0.1`。

## 3. 安装基础软件

以下命令均在 Ubuntu 服务器的 Bash 中执行。建议使用具备 `sudo` 权限的独立运维账号，不建议长期直接使用 root。

```bash
sudo apt update
sudo apt install -y ca-certificates curl git nginx certbot python3-certbot-nginx rsync

curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
newgrp docker

docker --version
docker compose version
nginx -v
```

安装 Node.js 24 和项目指定的 pnpm 10.32.1，仅用于构建 Web 静态文件：

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm install 24
nvm use 24
corepack enable
corepack prepare pnpm@10.32.1 --activate

node --version
pnpm --version
```

预期：Node.js 显示 `v24.x`，pnpm 显示 `10.32.1`。

## 4. 获取交付代码

```bash
sudo mkdir -p /opt/airi
sudo chown -R "$USER":"$USER" /opt/airi
cd /opt/airi

git clone <CUSTOMER_REPOSITORY_URL> source
cd source
git fetch --all --tags
git checkout <DELIVERY_COMMIT_SHA>
git rev-parse HEAD
```

`git rev-parse HEAD` 的结果必须与《交付清单》中的 SHA 完全一致。正式环境不要直接部署来源不明的分支最新代码。

## 5. 创建生产配置

### 5.1 生成密钥

在服务器执行以下命令，并把结果暂存到客户的密码管理器。不要把输出粘贴到工单或提交到 Git。

```bash
openssl rand -hex 24       # PostgreSQL 密码
openssl rand -hex 24       # Redis 密码
openssl rand -base64 48    # BETTER_AUTH_SECRET
openssl rand -base64 32    # LLM_ROUTER_MASTER_KEY
```

`BETTER_AUTH_SECRET` 和 `LLM_ROUTER_MASTER_KEY` 必须长期保存。随意更换前者会使现有登录会话失效；丢失后者会导致已加密的模型上游密钥无法解密。

### 5.2 创建部署目录

```bash
cd /opt/airi/source
mkdir -p deploy /opt/airi/config
chmod 700 deploy /opt/airi/config
```

密钥文件单独放在 `/opt/airi/config`，不放入 `/opt/airi/source`，以避免进入 Git 工作区或 Docker build context。

创建 `/opt/airi/config/airi.env`，权限设为仅当前用户可读：

```dotenv
# 基础域名
API_SERVER_URL=https://api.example.com
WEB_APP_URL=https://airi.example.com
AUTH_UI_URL=https://accounts.example.com/ui
ADMIN_UI_URL=https://airi.example.com/admin
ADDITIONAL_TRUSTED_ORIGINS=https://airi.example.com,https://accounts.example.com

# 基础设施。密码建议仅使用上一步生成的十六进制字符。
POSTGRES_PASSWORD=<POSTGRES_PASSWORD>
DATABASE_URL=postgresql://postgres:<POSTGRES_PASSWORD>@db:5432/airi
REDIS_PASSWORD=<REDIS_PASSWORD>
REDIS_URL=redis://:<REDIS_PASSWORD>@redis:6379/0

# 应用密钥
BETTER_AUTH_SECRET=<BETTER_AUTH_SECRET>
LLM_ROUTER_MASTER_KEY=<LLM_ROUTER_MASTER_KEY>

# Google OAuth
AUTH_GOOGLE_CLIENT_ID=<GOOGLE_CLIENT_ID>
AUTH_GOOGLE_CLIENT_SECRET=<GOOGLE_CLIENT_SECRET>

# GitHub OAuth
AUTH_GITHUB_CLIENT_ID=<GITHUB_CLIENT_ID>
AUTH_GITHUB_CLIENT_SECRET=<GITHUB_CLIENT_SECRET>

# 管理员邮箱，多个邮箱用英文逗号分隔
ADMIN_EMAILS=admin@example.com

# SMTP 邮件（推荐）
EMAIL_FROM_EMAIL=noreply@example.com
EMAIL_FROM_NAME=AIRI
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<SMTP_USER>
SMTP_PASSWORD=<SMTP_PASSWORD>

# 未使用 SMTP 时可改用 Resend；二选一即可
RESEND_API_KEY=
RESEND_FROM_EMAIL=noreply@example.com
RESEND_FROM_NAME=AIRI

# 可选支付配置；暂不启用时保持为空
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
EPAY_API_URL=
EPAY_PID=
EPAY_KEY=
EPAY_CALLBACK_BASE_URL=

# 生产环境禁止设置测试鉴权 Token
TEST_AUTH_TOKEN=

# 运行参数
HOST=0.0.0.0
PORT=3000
DB_POOL_MAX=20
```

```bash
chmod 600 /opt/airi/config/airi.env
```

注意：`DATABASE_URL` 中的密码必须与 `POSTGRES_PASSWORD` 完全一致，`REDIS_URL` 中的密码必须与 `REDIS_PASSWORD` 完全一致。

### 5.3 创建 Docker Compose 文件

创建 `/opt/airi/source/deploy/docker-compose.prod.yml`：

```yaml
name: airi-production

services:
  db:
    image: ghcr.io/tensorchord/vchord-postgres:pg18-v1.0.0
    restart: unless-stopped
    environment:
      POSTGRES_DB: airi
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - airi_db:/var/lib/postgresql
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U postgres -d airi']
      interval: 10s
      timeout: 5s
      retries: 10

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: ['redis-server', '--appendonly', 'yes', '--requirepass', '${REDIS_PASSWORD}']
    volumes:
      - airi_redis:/data
    healthcheck:
      test: ['CMD-SHELL', 'redis-cli -a "${REDIS_PASSWORD}" ping | grep PONG']
      interval: 10s
      timeout: 5s
      retries: 10

  api:
    build:
      context: ..
      dockerfile: apps/server/Dockerfile
    restart: unless-stopped
    env_file:
      - /opt/airi/config/airi.env
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    ports:
      - '127.0.0.1:6112:3000'
    healthcheck:
      test: ['CMD', 'node', '-e', "fetch('http://127.0.0.1:3000/livez').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 15s
      timeout: 5s
      retries: 8

volumes:
  airi_db:
  airi_redis:
```

该文件不映射 PostgreSQL 和 Redis 端口，避免数据库直接暴露到公网。不要照搬仓库中的开发示例密码用于生产。

## 6. 配置第三方平台

### 6.1 Google OAuth

在 Google Cloud Console 创建 Web application 类型的 OAuth Client，并配置：

- Authorized JavaScript origin：`https://api.example.com`
- Authorized redirect URI：`https://api.example.com/api/auth/callback/google`

将 Client ID 和 Client Secret 写入 `/opt/airi/config/airi.env` 对应项。

### 6.2 GitHub OAuth

在 GitHub Developer settings 创建 OAuth App，并配置：

- Homepage URL：`https://airi.example.com`
- Authorization callback URL：`https://api.example.com/api/auth/callback/github`

将 Client ID 和 Client Secret 写入 `/opt/airi/config/airi.env` 对应项。

### 6.3 邮件服务

注册、邮箱验证、密码重置等功能需要邮件服务。推荐先使用 SMTP：

- `SMTP_PORT=587` 时通常设置 `SMTP_SECURE=false`，由 STARTTLS 升级加密。
- `SMTP_PORT=465` 时通常设置 `SMTP_SECURE=true`。
- 发件地址必须是邮件服务商允许使用或已验证的地址。

如果使用 Resend，清空 `SMTP_HOST`、`SMTP_USER`、`SMTP_PASSWORD`，填写 `RESEND_API_KEY` 和已验证的发件地址。

## 7. 构建并启动服务

### 7.1 安装依赖

```bash
cd /opt/airi/source
nvm use 24
corepack enable
pnpm install --frozen-lockfile
```

### 7.2 写入前端构建变量

创建 `apps/stage-web/.env.production.local`：

```dotenv
VITE_SERVER_URL=https://api.example.com
```

创建 `apps/ui-server-auth/.env.production.local`：

```dotenv
VITE_SERVER_URL=https://api.example.com
```

这两个文件包含的是公开 API 地址，不应包含任何服务端密钥。

### 7.3 构建前端

```bash
pnpm --filter @proj-airi/stage-web build
pnpm --filter @proj-airi/ui-server-auth build

test -f apps/stage-web/dist/index.html
test -f apps/ui-server-auth/dist/index.html
```

### 7.4 发布静态文件

```bash
RELEASE="$(date +%Y%m%d%H%M%S)-$(git rev-parse --short HEAD)"
sudo mkdir -p "/var/www/airi/releases/$RELEASE"
sudo cp -a apps/stage-web/dist "/var/www/airi/releases/$RELEASE/web"
sudo cp -a apps/ui-server-auth/dist "/var/www/airi/releases/$RELEASE/auth"
sudo ln -sfn "/var/www/airi/releases/$RELEASE" /var/www/airi/current
sudo chown -R www-data:www-data "/var/www/airi/releases/$RELEASE"

readlink -f /var/www/airi/current
```

保留最近两个或三个 release 目录，便于快速回滚。确认新版本稳定后再清理更早的目录。

### 7.5 启动数据库、Redis 和 API

```bash
cd /opt/airi/source
docker compose --env-file /opt/airi/config/airi.env -f deploy/docker-compose.prod.yml up -d --build
docker compose --env-file /opt/airi/config/airi.env -f deploy/docker-compose.prod.yml ps
docker compose --env-file /opt/airi/config/airi.env -f deploy/docker-compose.prod.yml logs --tail=100 api
```

API 启动时会自动检查数据库并执行项目内置迁移。首次启动可能比普通重启稍慢。日志中应出现数据库连接成功、迁移完成和 Server started 等信息。

## 8. 配置 Nginx

### 8.1 主站

创建 `/etc/nginx/sites-available/airi-web`：

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name airi.example.com;

    root /var/www/airi/current/web;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location = /index.html {
        add_header Cache-Control "no-cache";
    }

    location = /sw.js {
        add_header Cache-Control "no-cache";
    }

    location /assets/ {
        try_files $uri =404;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### 8.2 认证中心

创建 `/etc/nginx/sites-available/airi-auth`：

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name accounts.example.com;

    root /var/www/airi/current/auth;
    index index.html;

    location = / {
        return 302 /ui/;
    }

    location /ui/ {
        try_files $uri /index.html;
    }

    location /assets/ {
        try_files $uri =404;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location = /index.html {
        add_header Cache-Control "no-cache";
    }
}
```

### 8.3 API 与 WebSocket

创建 `/etc/nginx/sites-available/airi-api`：

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name api.example.com;

    client_max_body_size 20m;

    location / {
        proxy_pass http://127.0.0.1:6112;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}
```

启用配置并检查语法：

```bash
sudo ln -sfn /etc/nginx/sites-available/airi-web /etc/nginx/sites-enabled/airi-web
sudo ln -sfn /etc/nginx/sites-available/airi-auth /etc/nginx/sites-enabled/airi-auth
sudo ln -sfn /etc/nginx/sites-available/airi-api /etc/nginx/sites-enabled/airi-api
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

## 9. 启用 HTTPS

确认 DNS 已生效且 80/443 端口可访问后执行：

```bash
sudo certbot --nginx \
  -d airi.example.com \
  -d accounts.example.com \
  -d api.example.com

sudo certbot renew --dry-run
```

证书签发后，Certbot 会自动修改 Nginx 配置并设置续期任务。不要在 DNS 尚未生效时反复申请，以免触发签发频率限制。

## 10. 首次初始化

1. 打开 `https://airi.example.com`，注册管理员邮箱。
2. 完成邮箱验证后，重新登录。
3. 确认该邮箱已列入 `ADMIN_EMAILS`；如刚修改配置，重启 API。
4. 进入 `https://airi.example.com/admin`。
5. 配置模型上游的名称、Base URL、API Key、模型别名和并发限制。
6. 至少完成一次文本对话测试；启用语音时再测试 TTS。

模型上游 API Key 会由 `LLM_ROUTER_MASTER_KEY` 加密后保存。不要把上游 API Key 写进前端 `.env.production.local`。

## 11. 部署验收

### 11.1 命令行检查

```bash
curl -fsS https://api.example.com/livez
curl -fsS https://api.example.com/readyz
curl -I https://airi.example.com/
curl -I https://accounts.example.com/ui/

cd /opt/airi/source
docker compose --env-file /opt/airi/config/airi.env -f deploy/docker-compose.prod.yml ps
```

预期：

- `/livez` 返回 `{"status":"live"}`。
- `/readyz` 返回 `status: ready`，并且 `db`、`redis` 均为 `ok`。
- 主站与认证页返回 HTTP 200。
- `api`、`db`、`redis` 三个容器状态为 running/healthy。

### 11.2 浏览器验收清单

- 主站可以正常加载，页面无明显资源 404。
- 新用户可以注册并收到验证邮件。
- Google 和 GitHub 登录至少各验证一次。
- 登录后刷新页面，登录状态可以保持。
- 文本对话可获得模型回复。
- 管理员可以进入管理入口，普通用户不能访问管理功能。
- 浏览器开发者工具中没有请求旧域名或 `api.airi.build`。
- HTTPS 证书有效，页面没有 Mixed Content 警告。

## 12. 日常运维

### 12.1 查看状态和日志

```bash
cd /opt/airi/source
docker compose --env-file /opt/airi/config/airi.env -f deploy/docker-compose.prod.yml ps
docker compose --env-file /opt/airi/config/airi.env -f deploy/docker-compose.prod.yml logs -f --tail=200 api
sudo journalctl -u nginx -n 100 --no-pager
```

不要把包含用户信息、Token、请求正文或支付参数的完整日志发送到公共渠道。

### 12.2 重启服务

```bash
cd /opt/airi/source
docker compose --env-file /opt/airi/config/airi.env -f deploy/docker-compose.prod.yml restart api
sudo systemctl reload nginx
```

不要用 `docker compose down -v`。`-v` 会删除数据库和 Redis 数据卷。

### 12.3 数据库备份

建议至少每日备份 PostgreSQL，并把备份同步到另一台服务器或对象存储。

```bash
cd /opt/airi/source
mkdir -p /opt/airi/backups
BACKUP="/opt/airi/backups/airi-$(date +%Y%m%d-%H%M%S).dump"
docker compose --env-file /opt/airi/config/airi.env -f deploy/docker-compose.prod.yml \
  exec -T db pg_dump -U postgres -d airi -Fc > "$BACKUP"
test -s "$BACKUP" && echo "Backup OK: $BACKUP"
```

备份成功不等于可恢复。至少每季度在隔离环境执行一次恢复演练。

### 12.4 恢复数据库

恢复会覆盖目标数据库内容，只能在维护窗口执行，并应先再次备份当前数据。

```bash
cd /opt/airi/source
docker compose --env-file /opt/airi/config/airi.env -f deploy/docker-compose.prod.yml stop api
docker compose --env-file /opt/airi/config/airi.env -f deploy/docker-compose.prod.yml \
  exec -T db dropdb -U postgres --if-exists airi
docker compose --env-file /opt/airi/config/airi.env -f deploy/docker-compose.prod.yml \
  exec -T db createdb -U postgres airi
docker compose --env-file /opt/airi/config/airi.env -f deploy/docker-compose.prod.yml \
  exec -T db pg_restore -U postgres -d airi --clean --if-exists < <BACKUP_FILE>
docker compose --env-file /opt/airi/config/airi.env -f deploy/docker-compose.prod.yml start api
```

## 13. 版本升级

升级前必须获得交付方确认的新 commit SHA，并先备份数据库和当前配置。

```bash
cd /opt/airi/source

# 1. 备份数据库，命令见 12.3

# 2. 保存当前版本号
OLD_SHA="$(git rev-parse HEAD)"
echo "$OLD_SHA"

# 3. 获取并切换到指定版本
git fetch --all --tags
git checkout <NEW_DELIVERY_COMMIT_SHA>
git rev-parse HEAD

# 4. 使用 Node.js 24 重新安装与构建
nvm use 24
pnpm install --frozen-lockfile
pnpm --filter @proj-airi/stage-web build
pnpm --filter @proj-airi/ui-server-auth build

# 5. 创建新静态 release
RELEASE="$(date +%Y%m%d%H%M%S)-$(git rev-parse --short HEAD)"
sudo mkdir -p "/var/www/airi/releases/$RELEASE"
sudo cp -a apps/stage-web/dist "/var/www/airi/releases/$RELEASE/web"
sudo cp -a apps/ui-server-auth/dist "/var/www/airi/releases/$RELEASE/auth"
sudo chown -R www-data:www-data "/var/www/airi/releases/$RELEASE"

# 6. 重建 API，再切换静态文件
docker compose --env-file /opt/airi/config/airi.env -f deploy/docker-compose.prod.yml up -d --build api
curl -fsS http://127.0.0.1:6112/readyz
sudo ln -sfn "/var/www/airi/releases/$RELEASE" /var/www/airi/current
sudo nginx -t && sudo systemctl reload nginx
```

完成后按第 11 节重新验收。不要跳过登录、对话和邮件链路检查。

## 14. 回滚

### 14.1 仅回滚前端

如果 API 正常、仅页面异常，可把 `current` 链接切回上一个 release：

```bash
ls -1dt /var/www/airi/releases/*
sudo ln -sfn /var/www/airi/releases/<PREVIOUS_RELEASE> /var/www/airi/current
sudo nginx -t && sudo systemctl reload nginx
```

### 14.2 回滚代码与 API

```bash
cd /opt/airi/source
git checkout <PREVIOUS_COMMIT_SHA>
docker compose --env-file /opt/airi/config/airi.env -f deploy/docker-compose.prod.yml up -d --build api
curl -fsS http://127.0.0.1:6112/readyz
```

注意：API 启动会自动执行数据库迁移。若新版本包含不向后兼容的数据迁移，仅回滚代码可能不足，必须按交付方提供的版本说明决定是否恢复数据库备份。不要在未确认迁移兼容性的情况下直接回滚生产数据库。

## 15. 常见问题

### 15.1 `/readyz` 返回 503

查看响应中的 `checks`：

- `db: fail`：检查数据库容器状态、`DATABASE_URL` 和 PostgreSQL 密码是否一致。
- `redis: fail`：检查 Redis 容器状态、`REDIS_URL` 和 Redis 密码是否一致。

```bash
docker compose --env-file /opt/airi/config/airi.env -f deploy/docker-compose.prod.yml ps
docker compose --env-file /opt/airi/config/airi.env -f deploy/docker-compose.prod.yml logs --tail=200 db redis api
```

### 15.2 登录后跳回错误域名

检查：

- `API_SERVER_URL`、`WEB_APP_URL`、`AUTH_UI_URL` 是否为实际 HTTPS 地址。
- 前端两个 `.env.production.local` 是否在构建前写入正确 API 地址。
- OAuth 平台回调 URL 是否与第 6 节完全一致。
- 修改配置后是否重建前端或重启 API。

### 15.3 认证页打开但资源 404

确认认证站点的 Nginx `root` 指向 `/var/www/airi/current/auth`，并且 `/assets/` 从认证站点自己的静态目录读取。不要把认证 UI 简单复制到主站的 `/ui` 子目录，否则根路径资源可能冲突。

### 15.4 页面仍请求旧 API

Vite 变量在构建时写入静态文件，修改 `.env.production.local` 后必须重新执行对应的 `pnpm ... build`，再发布新的 release。只重启 Nginx 或 API 不会修改前端地址。

### 15.5 收不到邮件

检查 SMTP 端口、安全模式、账号、密码和发件地址；再查看 API 日志中的邮件发送错误。部分云服务器默认限制 25 端口，推荐使用 465 或 587。

### 15.6 模型无法回复

确认管理员已配置上游 Base URL、API Key、模型名和默认模型别名；检查上游余额、并发限制及网络连通性。不要把上游 API Key 放进浏览器端配置。

## 16. 安全要求

- `/opt/airi/config/airi.env` 权限必须为 `600`，并纳入客户密码管理制度。
- PostgreSQL、Redis 和 API 容器端口不得直接暴露公网。
- 禁止设置生产 `TEST_AUTH_TOKEN`。
- 管理员邮箱使用专用、已验证的企业邮箱。
- 定期更新系统、Docker 镜像和 AIRI 交付版本，但每次升级前必须备份。
- 定期检查证书续期、磁盘空间、数据库备份和 API 健康状态。
- 离职或权限变更时及时撤销 SSH、Git、OAuth、SMTP、支付和模型上游凭据。
- 发生密钥泄露时，先限制访问并保留审计证据，再按影响范围轮换凭据；不要直接删除全部数据或日志。

## 17. 交付验收记录

| 项目 | 客户填写 |
|---|---|
| 部署日期 |  |
| 服务器环境 |  |
| 主站域名 |  |
| 认证域名 |  |
| API 域名 |  |
| Git commit SHA |  |
| 数据库备份位置 |  |
| 管理员邮箱 |  |
| 验收人员 |  |
| 验收结果 | 通过 / 有条件通过 / 不通过 |

生产验收完成后，客户应保存本记录、部署版本 SHA、配置备份位置和运维联系人。文档中不记录任何真实密码、Token 或私钥。
