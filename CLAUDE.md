# MoeStream 项目约定

## 技术栈

- **Next.js 16** (App Router, Turbopack, `output: "standalone"`)、**React 19**、**TypeScript 5.9** (`strict`)
- **tRPC 11** + **Zod 4** (API)、**TanStack Query 5** (数据获取)、**superjson** (序列化)
- **Prisma 7** + **PostgreSQL** (ORM，适配器 `@prisma/adapter-pg`，客户端输出到 `src/generated/prisma`)
- **Better Auth** (认证，JWT + 邮箱验证码 + 2FA/Passkey)
- **Tailwind CSS v4** + **shadcn/ui** (new-york 风格, Radix 原语) + **Framer Motion**
- **Zustand** (全局状态，`src/stores/`)、**React Context** (`src/contexts/`)
- **Socket.io** (实时通信，独立进程)、**Redis** (`ioredis`)
- **pnpm 10** (包管理)、**Biome** (格式化)、**ESLint** (lint)

## 路径别名

`@/*` → `src/*`（如 `@/components/ui/button`、`@/lib/utils`）

## 命名约定

- 文件和文件夹：**kebab-case**（`cover-input.tsx`、`site-config.ts`）
- React 组件导出：**PascalCase**（`export function CoverInput()`）
- tRPC 路由变量：**camelCase** + `Router` 后缀（`videoRouter`）
- 数据库模型：**PascalCase**（`User`、`Video`、`ImagePost`）
- 界面文案与注释：**中文**

## 项目结构

- `src/app/` — App Router 路由，私有目录用 `_components/`、`_lib/`
- `src/components/ui/` — shadcn/ui 基础组件（~50 个），使用 `pnpm dlx shadcn@latest add` 添加
- `src/components/{feature}/` — 功能组件按领域划分（`video/`、`comment/`、`files/`）
- `src/components/shared/` — 跨功能共享组件
- `src/lib/` — 工具库（`prisma.ts`、`auth.ts`、`redis.ts`、`utils.ts` 等）
- `src/server/trpc.ts` — tRPC 上下文 & procedure 定义
- `src/server/routers/` — tRPC 路由模块，根路由在 `_app.ts`
- `src/server/routers/admin/` — 管理后台路由（通过 `mergeRouters` 合并）
- `src/stores/` — Zustand store
- `src/hooks/` — 自定义 React Hooks

## 关键模式

- 页面拆分：服务端 `page.tsx` 负责数据获取 + 元数据，客户端交互逻辑放 `client.tsx`
- 默认是 Server Component，需要交互时加 `"use client"`
- 导入路径用 `@/` 别名，不用相对路径（同目录内的 `./` 除外）
- 表单用 `react-hook-form` + `@hookform/resolvers` + `zod`
- Toast 提示用 `sonner`（`import { toast } from "sonner"`）
- 日期处理用 `dayjs`（`date-fns` 仅作为 `react-day-picker` 的依赖，业务代码不直接使用）
- 认证客户端：`@/lib/auth-client`（Better Auth，非 next-auth）
- 样式条件合并用 `cn()`（来自 `@/lib/utils`）
- 图标用 `lucide-react`

## tRPC 约定

从 `@/server/trpc` 导入：

- `publicProcedure` — 无需认证
- `protectedProcedure` — 需要登录（ctx 含 `session.user`）
- `adminProcedure` — 需要 ADMIN 或 OWNER 角色（ctx 含 `adminRole`、`adminScopes`）
- `ownerProcedure` — 仅 OWNER
- `requireScope(scope)` — 管理员权限范围检查，链式使用：`.use(requireScope("manage_videos"))`

Context 可用字段：`ctx.prisma`、`ctx.redis`、`ctx.session`、`ctx.ipv4Address`、`ctx.ipv6Address`、`ctx.userAgent`

新路由在 `src/server/routers/_app.ts` 的 `appRouter` 中注册。管理后台路由放 `admin/` 子目录。

## Prisma 约定

- Prisma 7 + PostgreSQL，适配器 `@prisma/adapter-pg`，客户端输出到 `src/generated/prisma`
- Schema 改动后执行 `pnpm db:generate` + `pnpm db:push`
- 模型名 PascalCase，字段名 camelCase，注释用中文 `///`
- 查询用 `select` 限制返回字段

## 认证

- 客户端：`useSession()`（来自 `@/lib/auth-client`），返回 `{ data, status, update }`
- `data.user` 含 `id`、`name`、`email`、`role`、`canUpload`、`adsEnabled`、`twoFactorEnabled`
- 认证操作用 `authClient`（来自 `@/lib/auth-client`）

## 常用命令

- `pnpm dev` — 启动开发（Next + Socket）
- `pnpm db:generate` — 生成 Prisma 客户端
- `pnpm db:push` — 推送 schema 到数据库
- `pnpm lint` — ESLint + TypeScript 检查
- `pnpm biome check .` — Biome 格式 & lint 检查
- `pnpm build` — 构建生产版本（Prisma Generate → Next Build → Serwist Build）

## 代码风格

- 格式化由 **Biome** 负责（`biome.json`），缩进 2 空格，双引号，分号，行宽 120
- Lint 由 **ESLint** 负责（flat config），Biome linter 已禁用避免冲突
- pre-commit hook 自动运行 `lint-staged`（Biome check + ESLint fix）
- 界面文案与代码注释使用**中文**
