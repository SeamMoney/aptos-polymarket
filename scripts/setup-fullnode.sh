#!/bin/bash
# Aptos Testnet Fullnode Setup Script
# Run this on a fresh Ubuntu 22.04 server with:
#   - 8+ CPU cores
#   - 32GB RAM
#   - 300GB+ SSD
#
# Usage: curl -sSL <url> | bash
#   Or: ./setup-fullnode.sh

set -e

echo "=============================================================="
echo "  APTOS TESTNET FULLNODE SETUP"
echo "=============================================================="
echo ""

# Check system requirements
CORES=$(nproc)
RAM_GB=$(free -g | awk '/^Mem:/{print $2}')
DISK_GB=$(df -BG / | awk 'NR==2{print $4}' | tr -d 'G')

echo "System Check:"
echo "  CPU Cores: $CORES (need 8+)"
echo "  RAM: ${RAM_GB}GB (need 32+)"
echo "  Free Disk: ${DISK_GB}GB (need 300+)"
echo ""

if [ "$CORES" -lt 4 ]; then
  echo "WARNING: CPU cores ($CORES) is below recommended (8+)"
fi

if [ "$RAM_GB" -lt 16 ]; then
  echo "WARNING: RAM (${RAM_GB}GB) is below recommended (32GB)"
fi

if [ "$DISK_GB" -lt 200 ]; then
  echo "ERROR: Insufficient disk space (${DISK_GB}GB). Need at least 300GB."
  exit 1
fi

echo "Proceeding with setup..."
echo ""

# Step 1: Update system
echo "[1/6] Updating system packages..."
apt update && apt upgrade -y
apt install -y curl jq

# Step 2: Install Docker
echo "[2/6] Installing Docker..."
if ! command -v docker &> /dev/null; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
  echo "Docker installed successfully"
else
  echo "Docker already installed"
fi

# Step 3: Create directories
echo "[3/6] Creating directories..."
mkdir -p /opt/aptos/testnet/data
cd /opt/aptos/testnet

# Step 4: Download configuration files
echo "[4/6] Downloading testnet configuration..."

# Download fullnode.yaml
curl -sSL -o fullnode.yaml https://raw.githubusercontent.com/aptos-labs/aptos-core/testnet/docker/compose/aptos-node/fullnode.yaml

# Download genesis and waypoint
curl -sSL -o waypoint.txt https://raw.githubusercontent.com/aptos-labs/aptos-networks/main/testnet/waypoint.txt
curl -sSL -o genesis.blob https://raw.githubusercontent.com/aptos-labs/aptos-networks/main/testnet/genesis.blob

echo "Downloaded:"
ls -la /opt/aptos/testnet/

# Step 5: Open firewall ports
echo "[5/6] Configuring firewall..."
ufw allow 8080/tcp  # REST API
ufw allow 6182/tcp  # P2P
ufw allow 9101/tcp  # Metrics
echo "y" | ufw enable || true

# Step 6: Start fullnode container
echo "[6/6] Starting Aptos fullnode..."

# Stop existing container if running
docker stop aptos-fullnode 2>/dev/null || true
docker rm aptos-fullnode 2>/dev/null || true

# Start new container
docker run --pull=always -d \
  --restart unless-stopped \
  --name aptos-fullnode \
  -p 8080:8080 \
  -p 9101:9101 \
  -p 6182:6182 \
  -v /opt/aptos/testnet:/opt/aptos/etc \
  -v /opt/aptos/testnet/data:/opt/aptos/data \
  --workdir /opt/aptos/etc \
  aptoslabs/validator:testnet aptos-node \
  -f /opt/aptos/etc/fullnode.yaml

echo ""
echo "=============================================================="
echo "  FULLNODE STARTED!"
echo "=============================================================="
echo ""
echo "Container Status:"
docker ps --filter name=aptos-fullnode
echo ""
echo "Useful Commands:"
echo "  - Check logs:    docker logs -f aptos-fullnode --tail 100"
echo "  - Check sync:    curl -s localhost:9101/metrics | grep 'aptos_state_sync_version.*synced'"
echo "  - Check API:     curl -s localhost:8080/v1 | jq"
echo "  - Restart:       docker restart aptos-fullnode"
echo "  - Stop:          docker stop aptos-fullnode"
echo ""
echo "RPC Endpoint (use in HFT server):"
echo "  http://$(curl -s ifconfig.me):8080/v1"
echo ""
echo "Sync will take 1-24 hours. Monitor with:"
echo "  watch -n 10 'curl -s localhost:9101/metrics | grep synced'"
echo ""
