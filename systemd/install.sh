#!/bin/bash
# ============================================================
# MoeStream systemd 服务安装脚本
# ============================================================
#
# 用法:
#   sudo ./systemd/install.sh                    # 交互式安装
#   sudo ./systemd/install.sh --uninstall        # 卸载服务
#   sudo ./systemd/install.sh --user moestream   # 指定用户
#   sudo ./systemd/install.sh --dir /opt/moestream  # 指定目录
#
# 前置条件:
#   - Node.js >= 22
#   - pnpm
#   - PostgreSQL、Redis 已安装并运行
#
# ============================================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

log_step() { echo -e "\n${GREEN}▶ $1${NC}"; }
log_info() { echo -e "${BLUE}  $1${NC}"; }
log_warn() { echo -e "${YELLOW}⚠ $1${NC}"; }
log_error() { echo -e "${RED}✗ $1${NC}"; }
log_ok() { echo -e "${GREEN}✓ $1${NC}"; }

# ============================================================
# 参数解析
# ============================================================
SERVICE_USER="moestream"
INSTALL_DIR="/opt/moestream"
APP_PORT="80"
SOCKET_PORT="3001"
UNINSTALL=false
NODE_PATH=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --user)       SERVICE_USER="$2"; shift 2 ;;
        --dir)        INSTALL_DIR="$2"; shift 2 ;;
        --port)       APP_PORT="$2"; shift 2 ;;
        --socket-port) SOCKET_PORT="$2"; shift 2 ;;
        --node)       NODE_PATH="$2"; shift 2 ;;
        --uninstall)  UNINSTALL=true; shift ;;
        -h|--help)
            echo "用法: sudo $0 [选项]"
            echo ""
            echo "选项:"
            echo "  --user USER       服务运行用户 (默认: moestream)"
            echo "  --dir PATH        安装目录 (默认: /opt/moestream)"
            echo "  --port PORT       Next.js 端口 (默认: 80)"
            echo "  --socket-port PORT Socket.io 端口 (默认: 3001)"
            echo "  --node PATH       Node.js 可执行文件路径 (自动检测)"
            echo "  --uninstall       卸载 systemd 服务"
            echo "  -h, --help        显示帮助"
            exit 0
            ;;
        *) log_error "未知选项: $1"; exit 1 ;;
    esac
done

# ============================================================
# 权限检查
# ============================================================
if [[ $EUID -ne 0 ]]; then
    log_error "请使用 sudo 运行此脚本"
    exit 1
fi

# ============================================================
# 卸载
# ============================================================
if [[ "$UNINSTALL" == true ]]; then
    log_step "卸载 MoeStream systemd 服务..."

    systemctl stop moestream.target 2>/dev/null || true
    systemctl disable moestream-app.service moestream-socket.service moestream.target 2>/dev/null || true
    rm -f /etc/systemd/system/moestream-app.service
    rm -f /etc/systemd/system/moestream-socket.service
    rm -f /etc/systemd/system/moestream.target
    systemctl daemon-reload

    log_ok "systemd 服务已卸载"
    log_info "应用文件和用户未删除，如需清理请手动操作："
    log_info "  sudo userdel -r ${SERVICE_USER}"
    log_info "  sudo rm -rf ${INSTALL_DIR}"
    exit 0
fi

# ============================================================
# 检测 Node.js 路径
# ============================================================
detect_node() {
    if [[ -n "$NODE_PATH" ]]; then
        if [[ -x "$NODE_PATH" ]]; then
            echo "$NODE_PATH"
            return
        fi
        log_error "指定的 Node.js 路径不可执行: $NODE_PATH"
        exit 1
    fi

    local candidates=(
        /usr/local/bin/node
        /usr/bin/node
        "$HOME/.local/share/fnm/aliases/default/bin/node"
        "$HOME/.nvm/versions/node/$(ls "$HOME/.nvm/versions/node/" 2>/dev/null | sort -V | tail -1)/bin/node"
    )

    for candidate in "${candidates[@]}"; do
        if [[ -x "$candidate" ]]; then
            echo "$candidate"
            return
        fi
    done

    local found
    found=$(which node 2>/dev/null) || true
    if [[ -n "$found" && -x "$found" ]]; then
        echo "$found"
        return
    fi

    log_error "未找到 Node.js，请使用 --node 参数指定路径"
    exit 1
}

DETECTED_NODE=$(detect_node)
NODE_VERSION=$("$DETECTED_NODE" --version 2>/dev/null || echo "unknown")

log_step "安装 MoeStream systemd 服务"
echo ""
log_info "Node.js:     ${DETECTED_NODE} (${NODE_VERSION})"
log_info "用户:        ${SERVICE_USER}"
log_info "目录:        ${INSTALL_DIR}"
log_info "App 端口:    ${APP_PORT}"
log_info "Socket 端口: ${SOCKET_PORT}"
echo ""

# ============================================================
# 创建系统用户
# ============================================================
log_step "配置系统用户..."

if id "$SERVICE_USER" &>/dev/null; then
    log_info "用户 ${SERVICE_USER} 已存在"
else
    useradd --system --shell /usr/sbin/nologin --home-dir "$INSTALL_DIR" --create-home "$SERVICE_USER"
    log_ok "已创建系统用户: ${SERVICE_USER}"
fi

# ============================================================
# 创建目录结构
# ============================================================
log_step "创建目录结构..."

mkdir -p "${INSTALL_DIR}"/{uploads,logs,data,.backup-tmp,.next/cache}
chown -R "${SERVICE_USER}:${SERVICE_USER}" "${INSTALL_DIR}"

log_ok "目录结构已就绪"

# ============================================================
# 安装 systemd 单元文件
# ============================================================
log_step "安装 systemd 服务文件..."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

for unit in moestream-app.service moestream-socket.service moestream.target; do
    SRC="${SCRIPT_DIR}/${unit}"
    if [[ ! -f "$SRC" ]]; then
        log_error "找不到 ${SRC}"
        exit 1
    fi
    cp "$SRC" /etc/systemd/system/
done

# 替换模板变量
sed -i "s|User=moestream|User=${SERVICE_USER}|g" /etc/systemd/system/moestream-app.service /etc/systemd/system/moestream-socket.service
sed -i "s|Group=moestream|Group=${SERVICE_USER}|g" /etc/systemd/system/moestream-app.service /etc/systemd/system/moestream-socket.service
sed -i "s|WorkingDirectory=/opt/moestream|WorkingDirectory=${INSTALL_DIR}|g" /etc/systemd/system/moestream-app.service /etc/systemd/system/moestream-socket.service
sed -i "s|EnvironmentFile=/opt/moestream/|EnvironmentFile=${INSTALL_DIR}/|g" /etc/systemd/system/moestream-app.service /etc/systemd/system/moestream-socket.service
sed -i "s|/opt/moestream|${INSTALL_DIR}|g" /etc/systemd/system/moestream-app.service
sed -i "s|/opt/moestream|${INSTALL_DIR}|g" /etc/systemd/system/moestream-socket.service
sed -i "s|ExecStart=/usr/bin/node|ExecStart=${DETECTED_NODE}|g" /etc/systemd/system/moestream-app.service /etc/systemd/system/moestream-socket.service
sed -i "s|Environment=PORT=80|Environment=PORT=${APP_PORT}|g" /etc/systemd/system/moestream-app.service
sed -i "s|Environment=SOCKET_PORT=3001|Environment=SOCKET_PORT=${SOCKET_PORT}|g" /etc/systemd/system/moestream-socket.service

systemctl daemon-reload

log_ok "systemd 服务文件已安装"

# ============================================================
# 启用服务
# ============================================================
log_step "启用服务..."

systemctl enable moestream.target
systemctl enable moestream-app.service
systemctl enable moestream-socket.service

log_ok "服务已启用（开机自启）"

# ============================================================
# 检查环境文件
# ============================================================
if [[ ! -f "${INSTALL_DIR}/.env.production" ]]; then
    log_warn "未找到 ${INSTALL_DIR}/.env.production"
    log_warn "请先配置环境变量文件，然后执行:"
    log_warn "  sudo systemctl start moestream.target"
else
    echo ""
    read -p "是否立即启动服务? [y/N] " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        systemctl start moestream.target
        log_ok "服务已启动"
    fi
fi

# ============================================================
# 完成
# ============================================================
echo ""
echo "=========================================="
log_ok "安装完成！"
echo ""
echo "  常用命令:"
echo "    systemctl start moestream.target      # 启动所有服务"
echo "    systemctl stop moestream.target       # 停止所有服务"
echo "    systemctl restart moestream-app       # 重启 Next.js"
echo "    systemctl restart moestream-socket    # 重启 Socket.io"
echo "    systemctl status moestream-app        # 查看状态"
echo "    journalctl -u moestream-app -f        # 实时日志"
echo "    journalctl -u moestream-socket -f     # Socket 日志"
echo "    journalctl -u moestream-app --since '1h ago'  # 最近 1 小时日志"
echo "=========================================="
