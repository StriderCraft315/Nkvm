#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
#  vpanel - auto installer
#  Usage:
#    sudo bash install.sh                # interactive admin creation
#    sudo bash install.sh --no-pm2       # skip pm2, run with node directly
#    sudo bash install.sh --admin-pass PASSWORD
#    sudo bash install.sh --branch main  # checkout a branch before installing
# =============================================================================

log()  { printf '\033[1;36m[install]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[warn]\033[0m %s\n' "$*"; }
err()  { printf '\033[1;31m[error]\033[0m %s\n' "$*" >&2; }

[ "$(id -u)" -eq 0 ] || { err "Please run as root: sudo bash install.sh"; exit 1; }

cd "$(dirname "$0")"

# --- flags ----------------------------------------------------------------
USE_PM2=1
ADMIN_PASS="${ADMIN_PASSWORD:-}"
BRANCH=""
while [ $# -gt 0 ]; do
  case "$1" in
    --no-pm2)    USE_PM2=0 ;;
    --admin-pass) shift; ADMIN_PASS="${1:-}" ;;
    --branch)    shift; BRANCH="${1:-}" ;;
    *) warn "Unknown option: $1" ;;
  esac
  shift
done

if [ -n "$BRANCH" ]; then
  log "Switching to branch: $BRANCH"
  git fetch --all
  git checkout "$BRANCH" || git checkout -B "$BRANCH" origin/"$BRANCH"
fi

# --- OS detection ---------------------------------------------------------
DISTRO=""
if [ -f /etc/os-release ]; then
  . /etc/os-release
  case "$ID" in
    debian|ubuntu)      DISTRO="debian" ;;
    rhel|centos|fedora|rocky|almalinux) DISTRO="redhat" ;;
    arch)               DISTRO="arch" ;;
    *) err "Unsupported distribution: $ID"; exit 1 ;;
  esac
else
  err "Cannot detect OS (/etc/os-release missing)."
  exit 1
fi
log "Detected OS family: $DISTRO ($ID)"

# --- system dependencies --------------------------------------------------
install_system_deps() {
  log "Installing system dependencies..."
  case "$DISTRO" in
    debian)
      export DEBIAN_FRONTEND=noninteractive
      apt-get update -y
      apt-get install -y --no-install-recommends \
        git curl wget openssl ca-certificates \
        nodejs npm python3 build-essential \
        qemu-system-x86 qemu-utils cloud-image-utils
      ;;
    redhat)
      command -v dnf >/dev/null 2>&1 && PKG=dnf || PKG=yum
      $PKG install -y git curl wget openssl ca-certificates \
        nodejs npm python3 gcc gcc-c++ make \
        qemu-system-x86 qemu-img cloud-utils || warn "Some QEMU/cloud packages may be missing; npm run build will report them."
      ;;
    arch)
      pacman -Sy --noconfirm \
        git curl wget openssl ca-certificates \
        nodejs npm python base-devel \
        qemu-full cloud-utils
      ;;
  esac
}

has_node() { command -v node >/dev/null 2>&1; }

node_ok() {
  has_node || return 1
  local v; v="$(node -v | sed 's/^v//; s/\..*$//')"
  [ "${v:-0}" -ge 18 ] 2>/dev/null
}

install_node() {
  if node_ok; then
    log "Node.js $(node -v) detected"
    return
  fi
  log "Installing Node.js 20 LTS..."
  case "$DISTRO" in
    debian)
      curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
      apt-get install -y nodejs
      ;;
    redhat)
      curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
      command -v dnf >/dev/null 2>&1 && dnf install -y nodejs || yum install -y nodejs
      ;;
    arch)
      pacman -S --noconfirm nodejs npm
      ;;
  esac
  node_ok || { err "Node.js 18+ is required. Install it manually then re-run."; exit 1; }
}

# --- npm install ----------------------------------------------------------
npm_install() {
  log "Installing npm dependencies (this can take a while)..."
  npm install --no-audit --no-fund
}

# --- build (downloads noVNC, creates dirs, verifies deps) ------------------
run_build() {
  log "Running build (downloads noVNC, prepares directories)..."
  npm run build || warn "Build reported warnings above. Fix missing deps if VMs/console don't work."
}

# --- .env ------------------------------------------------------------------
setup_env() {
  if [ ! -f .env ]; then
    log "Creating .env from .env.example (random JWT_SECRET generated)"
    cp .env.example .env
    local secret
    secret="$(openssl rand -hex 32)"
    sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${secret}|" .env
  else
    log ".env already exists - leaving it untouched"
  fi
  # ports need to be open on the host
  local port
  port="$(grep -E '^PANEL_PORT=' .env | cut -d= -f2)"
  warn "Make sure ports ${port} (web) and the API port are open in your firewall."
}

# --- admin user ------------------------------------------------------------
create_admin() {
  if [ -z "$ADMIN_PASS" ]; then
    if [ -n "${ADMIN_PASSWORD:-}" ]; then
      ADMIN_PASS="$ADMIN_PASSWORD"
    else
      ADMIN_PASS="$(openssl rand -hex 6)"
      warn "No --admin-pass given; generated admin password: ${ADMIN_PASS}"
    fi
  fi
  local uname="${ADMIN_USERNAME:-admin}"
  local email="${ADMIN_EMAIL:-admin@vpanel.local}"
  log "Creating admin user '${uname}' (email ${email})"
  CREATEUSER_USERNAME="$uname" \
  CREATEUSER_EMAIL="$email" \
  CREATEUSER_PASSWORD="$ADMIN_PASS" \
  CREATEUSER_ROLE=admin \
    npm run createuser < /dev/null || warn "Could not create admin user; run: npm run createuser"
  printf '\n  Panel:     http://<this-host>:%s\n  Username:  %s\n  Password:  %s\n' \
    "$(grep -E '^PANEL_PORT=' .env | cut -d= -f2)" "$uname" "$ADMIN_PASS"
}

# --- start -----------------------------------------------------------------
start_panel() {
  if [ "$USE_PM2" -eq 1 ]; then
    if ! command -v pm2 >/dev/null 2>&1; then
      log "Installing pm2 globally..."
      npm install -g pm2 --no-audit --no-fund
    fi
    log "Starting vpanel under pm2"
    pm2 start ecosystem.config.js
    pm2 save
    pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true
  else
    log "Starting vpanel with node (no pm2)..."
    nohup node src/server.js > storage/logs/panel.out.log 2>&1 &
    warn "Started with PID $!  (logs: storage/logs/panel.out.log)"
  fi
}

# --- run --------------------------------------------------------------------
install_system_deps
install_node
npm_install
run_build
setup_env
create_admin
start_panel

log "Installation complete."
