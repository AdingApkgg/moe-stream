# ACGN Platform

ACGN 流式媒体内容分享平台。不存储视频文件，仅通过用户提供的直链（MP4 / HLS）加载视频，同时提供游戏资源分享。

## 功能特性

**视频**
- 直链投稿（MP4 / M3U8 / WebM），支持分P、合集/剧集
- HLS 自适应码率播放（hls.js）
- 收藏、点赞/踩、观看历史、自定义播放列表
- 标签分类、全站搜索、关联视频

**游戏**
- 游戏资源投稿，支持多平台下载链接
- 分类（ADV / SLG / RPG / ACT 等）、标签筛选
- 收藏、点赞/踩、游戏截图展示

**社区**
- 注册 / 登录用户 + 匿名访客评论（视频 & 游戏）
- 评论回复、点赞/踩、置顶、软删除
- 邮箱验证码登录 / 注册、密码重置
- 多账号切换、登录会话管理

**管理后台** (`/dashboard`)
- 视频 & 游戏审核（待审 / 通过 / 驳回）
- 用户管理（封禁 / 权限 / 投稿资格）
- 评论管理、标签管理、友情链接管理
- 站点配置（公告、功能开关、SEO、广告系统）
- 细粒度管理员权限范围（`adminScopes`）

**其他**
- PWA 支持（Serwist Service Worker，离线缓存静态资源）
- MDX 富文本内容（视频/游戏描述）
- 自动封面生成（Sharp）
- 广告系统 & 广告门（可配置点击次数/免广告时长）
- IndexNow + Google Search Console 主动推送
- SEO 全套（Sitemap / RSS / robots.txt / JSON-LD / Open Graph）
- AI/LLM 友好端点（llms.txt / ai-plugin.json / OpenAPI）
- IP 属地显示（ip2region）、设备指纹追踪
- 深色/浅色主题切换

## 技术栈

| 层级 | 技术 |
|------|------|
| **框架** | Next.js 16 + React 19 + TypeScript |
| **构建** | Turbopack (开发) |
| **样式** | Tailwind CSS v4 + shadcn/ui + Framer Motion |
| **状态** | Zustand + TanStack Query |
| **API** | tRPC v11 + Zod v4 |
| **认证** | Better Auth（JWT 策略，邮箱验证码，多账号切换） |
| **数据库** | PostgreSQL 17 + Prisma 7（pg adapter） |
| **缓存** | Redis 7 + ioredis |
| **播放器** | react-player + hls.js |
| **内容** | MDX（@next/mdx + next-mdx-remote） |
| **PWA** | Serwist（Service Worker + 运行时缓存） |
| **图像** | Sharp（封面生成 & 处理） |
| **邮件** | Nodemailer（SMTP） |
| **部署** | Podman / Docker Compose / PM2 / deploy.sh |

## 开始开发

### 1. 安装依赖

```bash
pnpm install
pnpm approve-builds  # 批准依赖的构建脚本（sharp, prisma 等）
```

### 2. 配置环境变量

```bash
cp .env.example .env.development
```

编辑 `.env.development`，必填项：

| 变量 | 说明 |
|------|------|
| `DATABASE_URL` | PostgreSQL 连接串 |
| `REDIS_URL` | Redis 连接串 |
| `BETTER_AUTH_SECRET` | Auth 密钥（`openssl rand -base64 32`） |
| `BETTER_AUTH_BASE_URL` | 站点地址（开发环境 `http://localhost:3000`） |
| `NEXT_PUBLIC_APP_URL` | 前端访问地址 |
| `NEXT_PUBLIC_APP_NAME` | 站点名称 |

可选项：`SMTP_*`（邮件）、`INDEXNOW_KEY`（搜索引擎推送）、`GOOGLE_*`（Search Console）。

### 3. 启动基础服务

**方式 A：Podman / Docker Compose（推荐）**

```bash
pnpm compose:infra   # 启动 PostgreSQL 17 + Redis 7 容器
```

默认连接地址（`.env.development`）：

```
DATABASE_URL="postgresql://postgres:your_password@localhost:5432/acgn?schema=public"
REDIS_URL="redis://localhost:6379"
```

**方式 B：本地安装**

自行安装 PostgreSQL 和 Redis，在 `.env.development` 中修改连接地址。

### 4. 初始化数据库

```bash
pnpm db:generate   # 生成 Prisma Client
pnpm db:push       # 推送数据库 schema
pnpm db:seed       # (可选) 填充初始数据
```

### 5. 启动开发服务器

```bash
pnpm dev   # Turbopack，监听 0.0.0.0:3000
```

访问 http://localhost:3000

### 6. 创建站长账号

```bash
pnpm script:create-owner   # 创建 OWNER 角色用户
```

## 可用脚本

### 开发 & 构建

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 启动开发服务器（Turbopack, 端口 3000） |
| `pnpm build` | 构建生产版本（Prisma Generate → Next Build → Serwist Build） |
| `pnpm start` | 启动生产服务器 |
| `pnpm lint` | 运行 ESLint |

### 数据库

| 命令 | 说明 |
|------|------|
| `pnpm db:generate` | 生成 Prisma Client |
| `pnpm db:push` | 推送 schema 到数据库 |
| `pnpm db:migrate` | 运行数据库迁移 |
| `pnpm db:studio` | 打开 Prisma Studio |
| `pnpm db:seed` | 填充初始数据 |

### 容器

| 命令 | 说明 |
|------|------|
| `pnpm compose:infra` | 启动 PostgreSQL + Redis 容器 |
| `pnpm compose:up` | 全栈启动（含应用容器） |
| `pnpm compose:down` | 停止所有容器 |
| `pnpm compose:logs` | 查看容器日志 |
| `pnpm compose:build` | 重新构建应用镜像 |

### PM2

| 命令 | 说明 |
|------|------|
| `pnpm pm2:start` | 启动 PM2 进程 |
| `pnpm pm2:stop` | 停止 PM2 进程 |
| `pnpm pm2:restart` | 重启 PM2 进程 |
| `pnpm pm2:logs` | 查看 PM2 日志 |
| `pnpm pm2:status` | 查看 PM2 状态 |

### 运维脚本

| 命令 | 说明 |
|------|------|
| `pnpm script:create-user` | 创建用户 |
| `pnpm script:create-owner` | 创建站长账号（OWNER 角色） |
| `pnpm script:migrate-auth` | Better Auth 数据迁移 |
| `pnpm script:fetch-videos` | 导入旧站视频数据 |
| `pnpm script:fetch-games` | 导入旧站游戏数据 |

## 生产部署

### 方式 A：deploy.sh 脚本（推荐）

本地打包源代码（~3MB），传输到服务器后构建。

```bash
# 配置（可选，有默认值）
export DEPLOY_USER=deploy
export DEPLOY_HOST=your-server.com
export DEPLOY_PATH=/opt/app

# 部署
pnpm deploy              # 常规部署
pnpm deploy -- --full    # 完整部署（含 data/ 目录，首次需要）
```

脚本流程：打包源代码 → SCP 传输 → 服务器解压 → `pnpm install` → Prisma Generate → DB Push → Build → PM2 重启。

### 方式 B：Podman / Docker Compose

```bash
cp .env.production.example .env.production
# 编辑 .env.production

pnpm compose:up          # 全栈启动
pnpm compose:logs        # 查看日志
pnpm compose:build && pnpm compose:up   # 重新构建
```

容器使用多阶段构建（Node 22 Alpine + pnpm），非 root 用户运行。

### 方式 C：手动部署

本地：

```bash
pnpm build

rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude '.env' \
  --exclude 'uploads/*' \
  --exclude 'logs/*' \
  --exclude '.git' \
  ./ user@server:/opt/app/
```

服务器：

```bash
pnpm install --frozen-lockfile
pnpm db:push
pm2 restart ecosystem.config.cjs || pm2 start ecosystem.config.cjs
```

更多部署细节（Nginx 反代、Rathole 内网穿透、SSL 配置等）参见 [deploy/README.md](deploy/README.md)。

## 项目结构

```
acgn-platform/
├── prisma/
│   ├── schema.prisma        # 数据模型定义
│   └── seed.ts              # 种子数据
├── scripts/                 # 运维 & 迁移脚本
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── (auth)/          # 认证页面 (登录/注册/找回密码)
│   │   ├── dashboard/       # 管理后台
│   │   │   ├── videos/      #   视频管理
│   │   │   ├── games/       #   游戏管理
│   │   │   ├── tags/        #   标签管理
│   │   │   ├── comments/    #   评论管理
│   │   │   ├── users/       #   用户管理
│   │   │   ├── links/       #   友情链接
│   │   │   └── settings/    #   站点设置
│   │   ├── settings/        # 用户设置 (账号/会话/安全)
│   │   ├── video/           # 视频详情 & 编辑
│   │   ├── game/            # 游戏详情 & 编辑
│   │   ├── series/          # 合集详情
│   │   ├── search/          # 搜索
│   │   ├── upload/          # 投稿
│   │   ├── api/             # API 路由
│   │   │   ├── trpc/        #   tRPC handler
│   │   │   ├── auth/        #   Better Auth
│   │   │   ├── upload/      #   文件上传
│   │   │   ├── cover/       #   封面代理/缓存
│   │   │   ├── email/       #   邮件验证码
│   │   │   ├── captcha/     #   验证码
│   │   │   └── indexnow/    #   搜索引擎推送
│   │   ├── sitemap*.ts      # 站点地图
│   │   ├── feed.xml/        # RSS
│   │   ├── llms.txt/        # LLM 端点
│   │   ├── manifest.ts      # PWA Manifest
│   │   └── sw.ts            # Service Worker
│   ├── components/
│   │   ├── layout/          # 布局 (Header/Footer/Sidebar/底部导航)
│   │   ├── ui/              # shadcn/ui 基础组件
│   │   ├── video/           # 视频组件 (卡片/网格/播放器/表单)
│   │   ├── game/            # 游戏组件 (卡片/网格)
│   │   ├── comment/         # 评论组件
│   │   ├── mdx/             # MDX 渲染器
│   │   ├── ads/             # 广告组件 (广告门/广告位/广告卡片)
│   │   ├── seo/             # SEO (JSON-LD)
│   │   ├── stats/           # 统计组件
│   │   ├── motion/          # Framer Motion 动画
│   │   ├── auth/            # 账号切换
│   │   └── providers.tsx    # 全局 Providers
│   ├── lib/                 # 工具库
│   │   ├── auth.ts          #   Better Auth 服务端配置
│   │   ├── auth-client.ts   #   Better Auth 客户端
│   │   ├── prisma.ts        #   Prisma 客户端
│   │   ├── trpc.ts          #   tRPC 客户端
│   │   ├── redis.ts         #   Redis 客户端
│   │   ├── email.ts         #   Nodemailer
│   │   ├── indexnow.ts      #   IndexNow 推送
│   │   ├── google-indexing.ts  # Google 索引 API
│   │   ├── ip-location.ts   #   IP 属地解析
│   │   ├── device-info.ts   #   设备信息解析
│   │   ├── cover-*.ts       #   封面生成系统
│   │   ├── ads.ts           #   广告配置
│   │   └── utils.ts         #   通用工具 (cn 等)
│   ├── server/              # 服务端
│   │   ├── trpc.ts          #   tRPC 上下文 & 过程定义
│   │   └── routers/         #   tRPC 路由
│   │       ├── _app.ts      #     根路由（聚合全部子路由）
│   │       ├── video.ts     #     视频 CRUD
│   │       ├── game.ts      #     游戏 CRUD
│   │       ├── series.ts    #     合集
│   │       ├── tag.ts       #     标签
│   │       ├── user.ts      #     用户
│   │       ├── comment.ts   #     视频评论
│   │       ├── game-comment.ts  # 游戏评论
│   │       ├── admin.ts     #     管理后台
│   │       └── site.ts      #     站点数据
│   ├── stores/              # Zustand 状态
│   │   ├── app.ts           #   应用状态
│   │   ├── user.ts          #   用户状态
│   │   └── accounts.ts      #   多账号切换
│   └── generated/           # Prisma 生成代码 (gitignore)
├── deploy/                  # 部署配置
│   ├── nginx-public.conf    #   Nginx 配置 (SSL/HTTP2/HTTP3)
│   ├── rathole-*.toml       #   Rathole 内网穿透配置
│   └── *.service            #   systemd 服务文件
├── uploads/                 # 上传文件目录
├── compose.yaml             # Podman / Docker Compose
├── Dockerfile               # 多阶段构建 (Node 22 Alpine)
├── ecosystem.config.cjs     # PM2 配置
├── serwist.config.js        # PWA Service Worker 配置
├── deploy.sh                # 一键部署脚本
└── mdx-components.tsx       # Next.js MDX 约定文件
```

## 数据模型

核心模型关系：

```
User ──┬── Video ──┬── Tag (多对多)
       │           ├── Series / SeriesEpisode
       │           ├── Comment (支持匿名 + 嵌套回复)
       │           ├── Like / Dislike / Confused
       │           ├── Favorite
       │           ├── WatchHistory
       │           └── Playlist / PlaylistItem
       │
       ├── Game ───┬── Tag (多对多)
       │           ├── GameComment
       │           ├── GameLike / GameDislike
       │           └── GameFavorite
       │
       ├── LoginSession (JWT 会话追踪)
       ├── UserDevice (设备指纹)
       └── SearchRecord

SiteConfig (单例) ── 站点配置、公告、广告、备案信息
FriendLink ── 友情链接
```

## SEO & AI 端点

| 路径 | 说明 |
|------|------|
| `/sitemap.xml` | 动态站点地图索引（拆分：视频/游戏/用户/标签/静态页） |
| `/robots.txt` | 爬虫规则 |
| `/feed.xml` | RSS 订阅 |
| `/llms.txt` | AI/LLM 简要说明 |
| `/llms-full.txt` | AI/LLM 完整说明 |
| `/.well-known/ai-plugin.json` | ChatGPT 插件发现 |
| `/.well-known/openapi.yaml` | OpenAPI 规范 |
| `/.well-known/security.txt` | 安全联络信息 |

视频和游戏在创建、更新、审核通过时自动提交 IndexNow + Google Search Console，支持手动批量提交。

## MDX 支持

项目支持使用 MDX 渲染富文本内容（视频/游戏描述等）。

- **客户端渲染**: `import { Markdown } from "@/components/ui/markdown"` — 基于 react-markdown
- **服务端渲染**: `import { MdxContent } from "@/components/mdx/mdx-remote"` — 基于 next-mdx-remote/rsc
- **静态 MDX 页面**: 在 `src/app/` 下创建 `.mdx` 文件即可作为路由页面

共享组件映射和样式定义在 `src/components/mdx/mdx-components.tsx`。

## License

[GNU AGPLv3](LICENSE)
