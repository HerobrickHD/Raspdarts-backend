#!/usr/bin/env bash
# backend/setup.sh
# Run with: sudo bash setup.sh
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== RasPi Manager Setup ==="

# 1. Install Node.js 20 (idempotent)
if ! command -v node &>/dev/null || [[ "$(node -v)" != v20* ]]; then
  echo "[1/5] Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
else
  echo "[1/5] Node.js already installed: $(node -v)"
fi

# 2. npm install
echo "[2/5] Installing backend dependencies..."
cd "$SCRIPT_DIR"
sudo -u pi npm install --omit=dev
sudo -u pi npm audit fix --omit=dev

# 3. Set hostname
echo "[3/5] Setting hostname to 'raspdarts'..."
hostnamectl set-hostname raspdarts
echo "raspdarts" > /etc/hostname
sed -i 's/127\.0\.1\.1.*/127.0.1.1\traspdarts/' /etc/hosts
systemctl restart avahi-daemon || true
# mDNS collision check
sleep 2
ACTUAL=$(avahi-resolve --name raspdarts.local 2>/dev/null | awk '{print $1}' || echo "")
if [[ "$ACTUAL" == "raspdarts-2.local" || "$ACTUAL" == "" ]]; then
  echo "WARNING: mDNS collision detected — another device on the network is already named 'raspdarts'."
  echo "         The extension may not be able to find the Pi."
fi

# 4. Passwordless sudo for backend operations
echo "[4/5] Configuring sudo permissions..."
cat > /etc/sudoers.d/raspdarts << 'EOF'
pi ALL=(root) NOPASSWD: /usr/bin/apt-get update, /usr/bin/apt-get upgrade -y, /bin/bash -c *, /sbin/reboot, /sbin/shutdown -h now
EOF
chmod 440 /etc/sudoers.d/raspdarts

# 5. systemd service
echo "[5/5] Registering systemd service..."
cp "$SCRIPT_DIR/raspdarts.service" /etc/systemd/system/raspdarts.service
systemctl daemon-reload
systemctl enable raspdarts
systemctl restart raspdarts

echo ""
echo "=== Setup complete! ==="
echo "Backend running at http://raspdarts.local:8743"
echo "Test with: curl http://raspdarts.local:8743/status"
