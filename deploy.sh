#!/bin/bash
# 部署脚本：本地构建后同步到服务器

set -e

# ============================================================
# 配置
# ============================================================
DEPLOY_USER="${DEPLOY_USER:-i}"
DEPLOY_HOST="${DEPLOY_HOST:-205.198.64.243}"
DEPLOY_PATH="${DEPLOY_PATH:-/home/i/mikiacg}"
DEPLOY_TARGET="${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}"

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================================
# 函数
# ============================================================
log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }
log_step() { echo -e "\n${GREEN}▶ $1${NC}"; }

show_help() {
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  --skip-build    跳过本地构建"
    echo "  --skip-install  跳过服务器依赖安装"
    echo "  --skip-db       跳过数据库迁移"
    echo "  --dry-run       仅显示将执行的操作"
    echo "  -h, --help      显示帮助"
    echo ""
    echo "环境变量:"
    echo "  DEPLOY_USER     服务器用户名 (默认: i)"
    echo "  DEPLOY_HOST     服务器地址 (默认: 205.198.64.243)"
    echo "  DEPLOY_PATH     部署路径 (默认: /home/i/mikiacg)"
}

# ============================================================
# 参数解析
# ============================================================
SKIP_BUILD=false
SKIP_INSTALL=false
SKIP_DB=false
DRY_RUN=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-build) SKIP_BUILD=true; shift ;;
        --skip-install) SKIP_INSTALL=true; shift ;;
        --skip-db) SKIP_DB=true; shift ;;
        --dry-run) DRY_RUN=true; shift ;;
        -h|--help) show_help; exit 0 ;;
        *) log_error "未知选项: $1"; show_help; exit 1 ;;
    esac
done

# ============================================================
# 开始部署
# ============================================================
START_TIME=$(date +%s)
echo ""
echo "=========================================="
echo "  咪咔次元 部署脚本"
echo "  目标: ${DEPLOY_USER}@${DEPLOY_HOST}"
echo "  时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="

# 1. 本地构建
if [ "$SKIP_BUILD" = false ]; then
    log_step "构建生产版本..."
    if [ "$DRY_RUN" = true ]; then
        log_info "[dry-run] pnpm build"
    else
        pnpm build
    fi
else
    log_warn "跳过本地构建"
fi

# 2. 同步文件
log_step "同步文件到服务器..."
RSYNC_OPTS="-avz --delete"
RSYNC_EXCLUDES=(
    --exclude 'node_modules'
    --exclude '.git'
    --exclude '.next/cache'
    --exclude '.env.development'
    --exclude '.env.production.local'
    --exclude '.env.local'
    --exclude '.env.*.local'
    --exclude 'uploads/*'
    --exclude '!uploads/.gitkeep'
    --exclude 'logs'
    --exclude '.history'
    --exclude '.cursor'
    --exclude '*.log'
)

if [ "$DRY_RUN" = true ]; then
    log_info "[dry-run] rsync ${RSYNC_OPTS} ${RSYNC_EXCLUDES[*]} ./ ${DEPLOY_TARGET}/"
else
    rsync ${RSYNC_OPTS} "${RSYNC_EXCLUDES[@]}" ./ "${DEPLOY_TARGET}/"
fi
log_success "文件同步完成"

# 3. 服务器操作
log_step "在服务器上执行部署操作..."

REMOTE_COMMANDS=""

# 安装依赖
if [ "$SKIP_INSTALL" = false ]; then
    REMOTE_COMMANDS+="echo '📦 安装依赖...' && pnpm install --frozen-lockfile && "
fi

# 生成 Prisma Client
REMOTE_COMMANDS+="echo '🔧 生成 Prisma Client...' && pnpm db:generate && "

# 数据库迁移
if [ "$SKIP_DB" = false ]; then
    REMOTE_COMMANDS+="echo '🗄️  同步数据库...' && pnpm db:push && "
fi

# 重启服务
REMOTE_COMMANDS+="echo '🚀 重启服务...' && (pm2 restart mikiacg 2>/dev/null || pm2 start ecosystem.config.cjs) && pm2 save"

if [ "$DRY_RUN" = true ]; then
    log_info "[dry-run] ssh ${DEPLOY_USER}@${DEPLOY_HOST} \"cd ${DEPLOY_PATH} && ${REMOTE_COMMANDS}\""
else
    ssh "${DEPLOY_USER}@${DEPLOY_HOST}" "cd ${DEPLOY_PATH} && ${REMOTE_COMMANDS}"
fi

# ============================================================
# 完成
# ============================================================
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo "=========================================="
log_success "部署完成！"
echo "  耗时: ${DURATION} 秒"
echo "  地址: https://mikiacg.vip"
echo "=========================================="
