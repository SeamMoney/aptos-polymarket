#!/bin/bash
#
# START DEMO IN STANDBY MODE - For ARM/LAUNCH Workflow
# =====================================================
#
# This script starts all 3 workers in STANDBY mode, waiting for
# the UI to ARM and LAUNCH. This is the proper workflow for demos.
#
# Workflow:
#   1. Run this script (starts workers in standby)
#   2. Open browser to http://localhost:5173/demo-day
#   3. Click "ARM SYSTEM" - runs pre-flight checks
#   4. Click "LAUNCH DEMO" - starts trading via UI
#   5. Click "STOP DEMO" when done
#
# Usage:
#   ./scripts/start-demo-standby.sh              # Start all workers in standby
#   ./scripts/start-demo-standby.sh --local-only # Only start local worker
#

set -e

LOCAL_ONLY=false
if [ "$1" = "--local-only" ]; then
    LOCAL_ONLY=true
fi

# ============================================
# CONFIGURATION - USD1 v2 (Jan 11, 2026)
# ============================================

# VMs
VM1="178.128.177.88"
VM2="147.182.237.239"
VM3="161.35.231.0"

# USD1 v2 Contract with admin drainers
CONTRACT_ADDRESS="0xbdea15f5b0f5449ae8f3a6ae95a5e090bdeeec91be1fcac8375b2f5f37f1c134"
USD1_METADATA="0x4e977d5ee91d77d680972a44b38b9c7a2c5694439169eeae060a48324e5c4597"

# 12 USD1-backed markets
MULTI_MARKETS="0x3e690f317df664c413e12b15eaa6e5565606fbd46628464f84f93e0674a3c052,0xf3256638cad294e47c8cc6bb1a6a0fdd85b29ef427b3118028c34b9f061aa50d,0x192f7cfc0c8151deec37c6280c17b55f7557a04b580b486d6076cc11955ddde3,0x9e4583c0af174a119b5316ae84988f4fd988259de35ef95447b371744a355762,0xd82731a9a2259ccfef2fd13db13720c7cc927c5b7879aa160aecc618c4d4654f,0x77a65b92664f992ccbd8a17d73a5f2fc933523ce64a1c475d1db1c0fc2acf42a,0xa84ba7b7364a40031e29d355d7a5f48fd54f922c8eed0ed0009c5d660a6da339,0x8187c1b3b7ca06dbcbac36fe280e0b5343b744c5a299a43263f9162738d4d792,0x551f153ff61f94311a22592550b0ede4b3b57338af161bd9472f21e15da23b4b,0x742e3c66cb6570351ceb7cf1b2df87e726c708b786109a8cdae93b0c3c7b5a04,0x35df09c98f8668c06f6777e98e3a0405fe894c271f06ba2fed0b322e2a5c2f16,0xd3227afa81dce5fa0e8f86f61dc7f3215ee799a0d2e6a112a988e5ac732bf719"

# Local worker accounts (1-7)
LOCAL_KEYS="0x6e2fca34586261b6f22a973c20024b78ddb370d87f7c974315fb97ba56716a7f,0xe61d22b3dc37c537a20d5b301c4d2b409b2f93cd7b2915f3518d49517c2ab6c4,0x4542c2e4a39beee8202eee0cddeceea886687b21b54b8f50c17e729251fdd7f5,0xcf5154af9664bbc2634fddfcce2317ed788b35de7f004ac0e24aefd68a0b10c5,ed25519-priv-0xb7d1f406e48c2eddffe987f98445dd4a353e8e9d1630d878621ded084bdd77c7,ed25519-priv-0xa8088ee787b847f6304807a8b09d1afc15409082ee9c8b7eda6919b0ecb86ea8,ed25519-priv-0xb5305eb83498dcba61242ccc91fac35263d9b44bddaf5e7417adbaceb1cfcb36"

# ============================================
# DISPLAY BANNER
# ============================================

echo ""
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║           USD1 HFT DEMO - STANDBY MODE                           ║"
echo "╠══════════════════════════════════════════════════════════════════╣"
echo "║  Workers will start and WAIT for UI to ARM and LAUNCH            ║"
echo "╠══════════════════════════════════════════════════════════════════╣"
echo "║  OPTIMIZATIONS:                                                  ║"
echo "║    - USD1 Collateral (no APT global state contention)            ║"
echo "║    - 12 parallel markets (round-robin distribution)              ║"
echo "║    - 20 accounts across 3 workers                                ║"
echo "║    - Orderless transactions (replay protection nonce)            ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""

# ============================================
# STOP ANY EXISTING WORKERS
# ============================================

echo "[0/4] Stopping any existing workers..."

# Stop local
pkill -f "hft-ultra-server" 2>/dev/null || true

if [ "$LOCAL_ONLY" = false ]; then
    # Stop remote
    ssh root@$VM1 "pkill -f hft-ultra-server 2>/dev/null" 2>/dev/null || true
    ssh root@$VM2 "pkill -f hft-ultra-server 2>/dev/null" 2>/dev/null || true
    ssh root@$VM3 "pkill -f hft-ultra-server 2>/dev/null" 2>/dev/null || true
fi

sleep 2
echo "  Done"
echo ""

# ============================================
# START REMOTE WORKERS (if not local-only)
# ============================================

if [ "$LOCAL_ONLY" = false ]; then
    echo "[1/4] Starting Worker 2 on VM1 ($VM1) in STANDBY..."
    ssh root@$VM1 "cd /opt/aptos-hft && screen -dmS hft bash -c './run-hft.sh > /tmp/hft-worker.log 2>&1'" 2>/dev/null
    echo "  Started (7 accounts)"

    echo "[2/4] Starting Worker 3 on VM2 ($VM2) in STANDBY..."
    ssh root@$VM2 "cd /opt/aptos-hft && screen -dmS hft bash -c './run-hft.sh > /tmp/hft-worker.log 2>&1'" 2>/dev/null
    echo "  Started (7 accounts)"

    echo "[3/4] Starting Worker 4 on VM3 ($VM3) in STANDBY..."
    ssh root@$VM3 "cd /opt/aptos-hft && screen -dmS hft bash -c './run-hft.sh > /tmp/hft-worker.log 2>&1'" 2>/dev/null
    echo "  Started (6 accounts)"

    sleep 3
else
    echo "[1-3/4] Skipping remote workers (--local-only mode)"
fi

# ============================================
# START LOCAL WORKER
# ============================================

echo ""
echo "[4/4] Starting LOCAL worker in STANDBY mode..."
echo ""
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║  LOCAL WORKER STARTING - UI WILL CONNECT HERE                    ║"
echo "║                                                                  ║"
echo "║  Next steps:                                                     ║"
echo "║    1. Open: http://localhost:5173/demo-day                       ║"
echo "║    2. Wait for 'Connected' status                                ║"
echo "║    3. Click 'ARM SYSTEM'                                         ║"
echo "║    4. Click 'LAUNCH DEMO'                                        ║"
echo "║                                                                  ║"
echo "║  Press Ctrl+C to stop all workers                                ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""

# Export environment for local worker
export APTOS_API_KEY="AG-3JMDT54EN4DCLULDWAUXCYGQ56JJQCYHH"
export CONTRACT_ADDRESS="$CONTRACT_ADDRESS"
export USE_USD1="true"
export USD1_METADATA="$USD1_METADATA"
export MULTI_MARKETS="$MULTI_MARKETS"
export ULTRA_PRIVATE_KEYS="$LOCAL_KEYS"
export HFT_PORT=3001
export EXTRA_RPC_ENDPOINTS="https://aptos.cash.trading/v1"

# Start local worker in STANDBY (no mode argument = standby)
# The server will initialize accounts and wait for /start from UI
npx tsx server/hft-ultra-server.ts

# ============================================
# CLEANUP ON EXIT
# ============================================

echo ""
echo "Local worker stopped."

if [ "$LOCAL_ONLY" = false ]; then
    echo "Stopping remote workers..."
    ssh root@$VM1 "pkill -f hft-ultra-server 2>/dev/null; screen -S hft -X quit 2>/dev/null" 2>/dev/null || true
    ssh root@$VM2 "pkill -f hft-ultra-server 2>/dev/null; screen -S hft -X quit 2>/dev/null" 2>/dev/null || true
    ssh root@$VM3 "pkill -f hft-ultra-server 2>/dev/null; screen -S hft -X quit 2>/dev/null" 2>/dev/null || true
    echo "All workers stopped."
fi
