#!/bin/bash
# 快速部署脚本：本地打包 → 传输 → 服务器构建
#
# 只传输源代码（约 3MB），在服务器上构建
#
# 用法:
#   ./deploy.sh           # 常规部署
#   ./deploy.sh --full    # 完整部署（含 data/ 目录）

set -e

# ============================================================
# 配置（从 .env.deploy 加载，或通过环境变量覆盖）
# ============================================================
[[ -f .env.deploy ]] && set -a && source .env.deploy && set +a

DEPLOY_USER="${DEPLOY_USER:?请在 .env.deploy 中设置 DEPLOY_USER}"
DEPLOY_HOST="${DEPLOY_HOST:?请在 .env.deploy 中设置 DEPLOY_HOST}"
DEPLOY_PATH="${DEPLOY_PATH:?请在 .env.deploy 中设置 DEPLOY_PATH}"
APP_NAME="${APP_NAME:-app}"
DEPLOY_TARGET="${DEPLOY_USER}@${DEPLOY_HOST}"

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_step() { echo -e "\n${GREEN}▶ $1${NC}"; }
log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }

# ============================================================
# 参数解析
# ============================================================
FULL_DEPLOY=false

for arg in "$@"; do
    case $arg in
        --full) FULL_DEPLOY=true ;;
        -h|--help)
            echo "用法: $0 [选项]"
            echo ""
            echo "选项:"
            echo "  --full     完整部署（包含 data/ 目录，首次需要）"
            echo "  -h, --help 显示帮助"
            exit 0
            ;;
    esac
done

# ============================================================
# 开始部署
# ============================================================
START_TIME=$(date +%s)
ARCHIVE="/tmp/${APP_NAME}-deploy.tar.gz"

echo ""
echo "=========================================="
echo "  快速部署"
echo "  目标: ${DEPLOY_TARGET}:${DEPLOY_PATH}"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="

# 1. 打包源代码（不含 node_modules 和 .next）
log_step "打包源代码..."

EXCLUDES=(
    --exclude='node_modules'
    --exclude='.git'
    --exclude='.next'
    --exclude='.pnpm-store'
    --exclude='uploads/*'
    --exclude='public/cache'
    --exclude='src/generated'
    --exclude='legacy_*.json'
    --exclude='legacy_*.txt'
    --exclude='deploy'
    --exclude='tsconfig.tsbuildinfo'
    --exclude='.env.development'
    --exclude='.env.production.local'
    --exclude='.env.local'
    --exclude='.history'
    --exclude='.cursor'
    --exclude='.vscode'
    --exclude='*.log'
    --exclude='.DS_Store'
)

# 默认不包含 data 目录
if [ "$FULL_DEPLOY" = false ]; then
    EXCLUDES+=(--exclude='data')
    log_info "跳过 data/ 目录（使用 --full 首次部署）"
fi

# macOS: 使用 --no-mac-metadata 或 COPYFILE_DISABLE 排除扩展属性
COPYFILE_DISABLE=1 tar "${EXCLUDES[@]}" -czf "$ARCHIVE" .
ARCHIVE_SIZE=$(du -h "$ARCHIVE" | cut -f1)
log_success "打包完成: ${ARCHIVE_SIZE}"

# 2. 传输到服务器
log_step "传输到服务器..."
scp -C "$ARCHIVE" "${DEPLOY_TARGET}:/tmp/"
log_success "传输完成"

# 3. 服务器解压并构建
log_step "服务器构建..."

ssh "${DEPLOY_TARGET}" "bash -l" << DEPLOY_SCRIPT
set -e

# 加载 pnpm 和 node 环境
export PNPM_HOME="\$HOME/.local/share/pnpm"
export PATH="\$PNPM_HOME:\$PATH"
export NODE_ENV=production
export APP_NAME="${APP_NAME}"

cd ${DEPLOY_PATH}

echo "🧹 清理旧源代码..."
rm -rf src/ prisma/ scripts/ public/

echo "📦 解压文件..."
tar -xzf /tmp/${APP_NAME}-deploy.tar.gz --overwrite 2>/dev/null
rm /tmp/${APP_NAME}-deploy.tar.gz

echo "📥 安装依赖..."
pnpm install --frozen-lockfile

echo "🔧 生成 Prisma Client..."
pnpm db:generate

echo "🗄️  同步数据库..."
pnpm db:push --accept-data-loss

echo "🔨 构建项目..."
# 备份旧静态资源，构建后合并回新产物实现平滑过渡
if [ -d .next/static ]; then
  rm -rf /tmp/next-old-static
  cp -r .next/static /tmp/next-old-static
fi
pnpm build
# 将旧 chunk 合并到新构建（不覆盖同名文件）
# 确保持有旧 HTML 的用户仍能加载旧 chunk
if [ -d /tmp/next-old-static/chunks ]; then
  cp -rn /tmp/next-old-static/chunks/ .next/static/chunks/ 2>/dev/null || true
fi
rm -rf /tmp/next-old-static

echo "🚀 重启服务..."
# 清理可能存在的错误命名进程（如 app vs mikiacg 冲突）
pm2 delete app 2>/dev/null || true
pm2 restart ecosystem.config.cjs 2>/dev/null || pm2 start ecosystem.config.cjs
pm2 save
DEPLOY_SCRIPT

# 4. 清理
rm -f "$ARCHIVE"

# ============================================================
# 完成
# ============================================================
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo "=========================================="
log_success "部署完成！"
echo "  耗时: ${DURATION} 秒"
echo "  地址: https://${DEPLOY_HOST}"
echo "=========================================="
