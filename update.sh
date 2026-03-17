#!/bin/bash
# Docker Compose 一键更新脚本
#
# 用法:
#   ./update.sh              # 拉取代码 → 构建 → 迁移 → 重启
#   ./update.sh --no-pull    # 跳过 git pull（本地修改后直接部署）
#   ./update.sh --no-migrate # 跳过数据库迁移

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_step() { printf "\n${GREEN}▶ %s${NC}\n" "$1"; }
log_warn() { printf "${YELLOW}⚠ %s${NC}\n" "$1"; }
log_err()  { printf "${RED}✖ %s${NC}\n" "$1"; }
log_ok()   { printf "${GREEN}✔ %s${NC}\n" "$1"; }

SKIP_PULL=false
SKIP_MIGRATE=false

for arg in "$@"; do
  case $arg in
    --no-pull)    SKIP_PULL=true ;;
    --no-migrate) SKIP_MIGRATE=true ;;
    -h|--help)
      echo "用法: $0 [选项]"
      echo ""
      echo "选项:"
      echo "  --no-pull     跳过 git pull"
      echo "  --no-migrate  跳过数据库迁移"
      echo "  -h, --help    显示帮助"
      exit 0
      ;;
    *)
      log_err "未知参数: $arg"
      exit 1
      ;;
  esac
done

cd "$(dirname "$0")"

START_TIME=$(date +%s)

echo ""
echo "=========================================="
echo "  Docker Compose 更新"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="

# 1. 拉取最新代码
if [ "$SKIP_PULL" = false ]; then
  log_step "拉取最新代码..."
  git pull origin main
else
  log_warn "跳过 git pull"
fi

# 2. 构建镜像
log_step "构建 Docker 镜像..."
docker compose build

# 3. 数据库迁移
if [ "$SKIP_MIGRATE" = false ]; then
  log_step "执行数据库迁移..."
  docker compose run --rm --build migrate pnpm exec prisma db push
else
  log_warn "跳过数据库迁移"
fi

# 4. 重启服务
log_step "重启服务..."
docker compose up -d

# 5. 清理悬空镜像
log_step "清理旧镜像..."
docker image prune -f

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo "=========================================="
log_ok "更新完成！耗时: ${DURATION} 秒"
echo "=========================================="
