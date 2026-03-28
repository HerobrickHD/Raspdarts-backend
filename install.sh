#!/usr/bin/env bash
# RasPi Manager — one-line installer
# Usage:
#   Install/Update:  curl -sL https://raw.githubusercontent.com/HerobrickHD/Raspdarts-backend/main/install.sh | bash
#   Uninstall:       curl -sL https://raw.githubusercontent.com/HerobrickHD/Raspdarts-backend/main/install.sh | bash -s -- --uninstall
set -e

REPO_URL="https://github.com/HerobrickHD/Raspdarts-backend.git"
INSTALL_DIR="$HOME/raspdarts"
SERVICE_NAME="raspdarts"

# ─── Colors ───────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()    { echo -e "${GREEN}[raspdarts]${NC} $*"; }
warn()    { echo -e "${YELLOW}[raspdarts]${NC} $*"; }
err()     { echo -e "${RED}[raspdarts] ERROR:${NC} $*" >&2; exit 1; }

# ─── Root check ───────────────────────────────────────────────────────────────
if [[ $EUID -eq 0 ]]; then
  err "Do not run as root. Run as a normal Pi user."
fi

# ─── Uninstall ────────────────────────────────────────────────────────────────
if [[ "${1:-}" == "--uninstall" ]]; then
  info "Starting uninstall..."

  if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
    info "Stopping service..."
    sudo systemctl stop "$SERVICE_NAME"
  fi

  if systemctl is-enabled --quiet "$SERVICE_NAME" 2>/dev/null; then
    info "Disabling service..."
    sudo systemctl disable "$SERVICE_NAME"
  fi

  if [[ -f "/etc/systemd/system/$SERVICE_NAME.service" ]]; then
    sudo rm -f "/etc/systemd/system/$SERVICE_NAME.service"
    sudo systemctl daemon-reload
  fi

  if [[ -f "/etc/sudoers.d/$SERVICE_NAME" ]]; then
    info "Removing sudoers entry..."
    sudo rm -f "/etc/sudoers.d/$SERVICE_NAME"
  fi

  if [[ -d "$INSTALL_DIR" ]]; then
    info "Removing installation directory $INSTALL_DIR..."
    rm -rf "$INSTALL_DIR"
  fi

  echo ""
  warn "Hostname was NOT reset. To reset it manually:"
  warn "  sudo hostnamectl set-hostname raspberrypi"
  echo ""
  info "Uninstall complete."
  exit 0
fi

# ─── Prerequisites ────────────────────────────────────────────────────────────
if ! command -v git &>/dev/null; then
  info "Installing git..."
  sudo apt-get update -qq
  sudo apt-get install -y git
fi

if ! command -v curl &>/dev/null; then
  info "Installing curl..."
  sudo apt-get install -y curl
fi

# ─── Update (already installed) ───────────────────────────────────────────────
if [[ -d "$INSTALL_DIR/.git" ]]; then
  info "RasPi Manager already installed — running update..."

  cd "$INSTALL_DIR"
  git pull --ff-only origin main

  info "Installing dependencies..."
  npm install --omit=dev

  info "Restarting service..."
  sudo systemctl restart "$SERVICE_NAME"

  echo ""
  info "Update complete. Backend running at http://raspdarts.local:8743"
  exit 0
fi

# ─── Fresh install ────────────────────────────────────────────────────────────
info "Starting fresh install..."

git clone "$REPO_URL" "$INSTALL_DIR"
cd "$INSTALL_DIR"

info "Running setup (requires sudo)..."
sudo bash setup.sh

echo ""
info "Install complete!"
info "Backend running at http://raspdarts.local:8743"
info "Test with: curl http://raspdarts.local:8743/status"
