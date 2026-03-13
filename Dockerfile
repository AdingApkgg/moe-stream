# ============================================================
# 多阶段构建 - 兼容 Docker / Podman (rootless)
# ============================================================

# ---------- 基础镜像 ----------
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# ---------- 依赖安装 ----------
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/
RUN pnpm install --frozen-lockfile --prod=false

# ---------- 构建 ----------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV REDIS_URL="redis://localhost:6379"
RUN pnpm build

# ---------- 生产依赖 ----------
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

# ---------- Next.js 运行 ----------
FROM node:22-alpine AS runner

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src/generated ./src/generated
COPY --from=builder /app/package.json ./
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/serwist.config.js ./serwist.config.js

RUN mkdir -p uploads logs data && chown -R nextjs:nodejs uploads logs data .next

USER nextjs
EXPOSE 3000

CMD ["npx", "next", "start"]

# ---------- Socket.io 运行 ----------
FROM node:22-alpine AS socket-runner

ENV NODE_ENV=production
ENV SOCKET_PORT=3001

WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src/generated ./src/generated
COPY --from=builder /app/src/socket ./src/socket
COPY --from=builder /app/src/lib/redis.ts ./src/lib/redis.ts
COPY --from=builder /app/src/lib/prisma.ts ./src/lib/prisma.ts
COPY --from=builder /app/package.json ./
COPY --from=builder /app/tsconfig.json ./

RUN mkdir -p logs && chown -R nextjs:nodejs logs

USER nextjs
EXPOSE 3001

CMD ["npx", "tsx", "src/socket/server.ts"]
