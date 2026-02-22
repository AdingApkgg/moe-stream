# ACGN Platform 部署指南

## 架构概览

```
公网机 (Nginx + Rathole Server)
         |
         | TCP 隧道 (:2333)
         v
内网机 (Rathole Client)
    |-- Next.js (:3000)
    |-- PostgreSQL (:5432)
    |-- Redis (:6379)
```

## 技术栈

- **前端**: Next.js 16, React 19, TypeScript, Tailwind CSS v4, shadcn/ui
- **后端**: tRPC, Prisma 7, Better Auth
- **数据库**: PostgreSQL, Redis
- **内容渲染**: MDX (next-mdx-remote + @next/mdx)
- **部署**: PM2 / Podman Compose, Nginx, Rathole

## 内网机部署

### 方式 A: Podman / Docker Compose（推荐）

```bash
git clone https://github.com/your-username/moe-stream.git
cd moe-stream
cp .env.production.example .env.production
# 编辑 .env.production

# 全栈启动（PostgreSQL + Redis + App）
podman compose up -d

# 初始化数据库
podman compose exec app npx prisma db push
```

### 方式 B: PM2

```bash
git clone https://github.com/your-username/moe-stream.git
cd moe-stream
cp .env.example .env
# 编辑 .env 配置

# 安装依赖
pnpm install --frozen-lockfile

# 生成 Prisma Client
pnpm db:generate

# 初始化数据库
pnpm db:push
pnpm db:seed

# 构建生产版本
pnpm build

# 启动/重启服务
pm2 restart ecosystem.config.cjs || pm2 start ecosystem.config.cjs
```

### 4. 配置 Rathole 客户端

```bash
cp deploy/rathole-client.example.toml deploy/rathole-client.toml
# 编辑 remote_addr 和 default_token
rathole -c deploy/rathole-client.toml
```

## 公网机部署

### 1. 安装 Rathole

```bash
wget https://github.com/rapiz1/rathole/releases/latest/download/rathole-x86_64-unknown-linux-musl.zip
unzip rathole-x86_64-unknown-linux-musl.zip
sudo mv rathole /usr/local/bin/
```

### 2. 配置 Rathole 服务端

```bash
cp deploy/rathole-server.example.toml deploy/rathole-server.toml
# 编辑 default_token
rathole -s deploy/rathole-server.toml
```

### 3. 配置 Nginx

```bash
sudo cp deploy/nginx-public.example.conf /etc/nginx/sites-available/app.conf
# 编辑 app.conf，将 example.com 替换为你的域名
sudo ln -s /etc/nginx/sites-available/app.conf /etc/nginx/sites-enabled/
sudo certbot certonly --webroot -w /var/www/certbot -d www.your-domain.com
sudo nginx -t && sudo systemctl reload nginx
```

## SEO 和 AI 端点

| 路径 | 说明 | 缓存 |
|------|------|------|
| `/sitemap.xml` | 动态站点地图 | 1h |
| `/robots.txt` | 爬虫规则 | 1d |
| `/feed.xml` | RSS 订阅 | 1h |
| `/llms.txt` | AI/LLM 友好说明 | 1d |
| `/.well-known/ai-plugin.json` | ChatGPT 插件发现 | 1d |

## 防火墙

```bash
# 公网机
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 2333/tcp
```

## 备份

```bash
# 数据库
pg_dump -U postgres acgn_flow > backup.sql

# 上传文件
tar -czvf uploads-backup.tar.gz uploads/
```

## 更新

**Podman Compose:**

```bash
git pull
podman compose build --no-cache
podman compose up -d
podman compose exec app npx prisma db push
```

**PM2:**

```bash
git pull
pnpm install --frozen-lockfile
pnpm build
pnpm db:push
pm2 restart ecosystem.config.cjs
```
