#!/bin/bash
#
# APTOS POLYMARKET - HFT ORCHESTRATOR
# ====================================
# Coordinates multiple HFT workers for high TPS demos
#
# Usage:
#   ./scripts/orchestrator.sh deploy     # Deploy latest code to all workers
#   ./scripts/orchestrator.sh standby    # Start all workers in STANDBY mode (wait for UI)
#   ./scripts/orchestrator.sh demo       # Auto-start demo mode (quantum for 60s)
#   ./scripts/orchestrator.sh status     # Check all infrastructure status
#   ./scripts/orchestrator.sh stop       # Stop all workers
#   ./scripts/orchestrator.sh logs       # View logs from all workers
#

set -e

# ============================================
# CONFIGURATION
# ============================================

# Your infrastructure
FULLNODE_IP="aptos.cash.trading"
FULLNODE_URL="http://${FULLNODE_IP}:8080/v1"

# All 3 Worker VMs (no local Mac needed!)
WORKER_VM1_IP="178.128.177.88"   # Worker 1: 7 accounts (1-7)
WORKER_VM2_IP="147.182.237.239"  # Worker 2: 8 accounts (8-15)
WORKER_VM3_IP="161.35.231.0"     # Worker 3: 5 accounts (16-20)
WORKER_VM_USER="root"

# USD1 v2 Contract with admin drainers (Jan 11, 2026)
CONTRACT_ADDRESS="0xbdea15f5b0f5449ae8f3a6ae95a5e090bdeeec91be1fcac8375b2f5f37f1c134"
USD1_METADATA="0x4e977d5ee91d77d680972a44b38b9c7a2c5694439169eeae060a48324e5c4597"

# 12 USD1-backed Polymarket-style markets
MULTI_MARKETS="0x3e690f317df664c413e12b15eaa6e5565606fbd46628464f84f93e0674a3c052,0xf3256638cad294e47c8cc6bb1a6a0fdd85b29ef427b3118028c34b9f061aa50d,0x192f7cfc0c8151deec37c6280c17b55f7557a04b580b486d6076cc11955ddde3,0x9e4583c0af174a119b5316ae84988f4fd988259de35ef95447b371744a355762,0xd82731a9a2259ccfef2fd13db13720c7cc927c5b7879aa160aecc618c4d4654f,0x77a65b92664f992ccbd8a17d73a5f2fc933523ce64a1c475d1db1c0fc2acf42a,0xa84ba7b7364a40031e29d355d7a5f48fd54f922c8eed0ed0009c5d660a6da339,0x8187c1b3b7ca06dbcbac36fe280e0b5343b744c5a299a43263f9162738d4d792,0x551f153ff61f94311a22592550b0ede4b3b57338af161bd9472f21e15da23b4b,0x742e3c66cb6570351ceb7cf1b2df87e726c708b786109a8cdae93b0c3c7b5a04,0x35df09c98f8668c06f6777e98e3a0405fe894c271f06ba2fed0b322e2a5c2f16,0xd3227afa81dce5fa0e8f86f61dc7f3215ee799a0d2e6a112a988e5ac732bf719"

# Legacy single market (for backwards compatibility)
MARKET_ADDRESS="0x3e690f317df664c413e12b15eaa6e5565606fbd46628464f84f93e0674a3c052"

# API Keys
APTOS_API_KEY="AG-3JMDT54EN4DCLULDWAUXCYGQ56JJQCYHH"

# Account keys split between 3 workers (25 accounts total - for >30K TPS headroom)
# Worker 1 (VM - 178.128.177.88): 9 accounts (1-7 + 2 new)
VM1_KEYS_W1="0x6e2fca34586261b6f22a973c20024b78ddb370d87f7c974315fb97ba56716a7f,0xe61d22b3dc37c537a20d5b301c4d2b409b2f93cd7b2915f3518d49517c2ab6c4,0x4542c2e4a39beee8202eee0cddeceea886687b21b54b8f50c17e729251fdd7f5,0xcf5154af9664bbc2634fddfcce2317ed788b35de7f004ac0e24aefd68a0b10c5,ed25519-priv-0xb7d1f406e48c2eddffe987f98445dd4a353e8e9d1630d878621ded084bdd77c7,ed25519-priv-0xa8088ee787b847f6304807a8b09d1afc15409082ee9c8b7eda6919b0ecb86ea8,ed25519-priv-0xb5305eb83498dcba61242ccc91fac35263d9b44bddaf5e7417adbaceb1cfcb36,ed25519-priv-0x232111DA47CA5B2734AD971B7DE318CAC066B7FC18C53A6C2C36C23398E1F7D0,ed25519-priv-0x30CFF4BCB9F626C23737CA9F4452D6145716C5B3CBEE4B09CFD5E95D67D3D57A"

# Worker 2 (VM - 147.182.237.239): 8 accounts (8-15)
VM1_KEYS="ed25519-priv-0xc27a6a8b6ed3013da99dc924b2f6af17f1448dedce91691f97d9e778c0761655,ed25519-priv-0xd6402b3493af005ed02b07f6cd7ffdfd37fae6d4d9c88fec6ff38e90f01b21c1,ed25519-priv-0xd375af1a686835905e15bf82f24fcaeed4b1b5b5fabe22c80e998acb804aa295,ed25519-priv-0xC5BA2ED0F5C40EE298E844B1140B6BB31C2671B747C8E9DF4B76054C4C5A8761,ed25519-priv-0x536C886483209657C9B30663B295C7CB007EB57E07931D3E41AF69067897D465,ed25519-priv-0x3E9CB6207207A266F298B1B13648D707BF886766221C3253F30AF68530A79749,ed25519-priv-0x4641D0FDD221B48EF4A45C8DC77D6D4F12D6848E01B7686134564A8CAE5BE637,ed25519-priv-0xFB2AFF37DFED247E9CF407FFA41208A41A78877C1990ADD1F94E00FCE1A5CCAC"

# Worker 3 (VM - 161.35.231.0): 8 accounts (16-20 + 3 new)
VM2_KEYS="ed25519-priv-0x9E338A7FB43F8280CCD82B2929B66F4ED1B7AA7900C40E06EAD934BC7CDEF315,ed25519-priv-0x8E7D4B0196840DA3A7BA6EDEF3784E1B961263F06651B130F440F5D974920B1F,ed25519-priv-0x975CF351CE096E1350C9F9E89ED5CB8D7BEAAEBF7FC235B10F1A0852355EED7A,ed25519-priv-0xD945B44FCFA961B9E4F8DAA5139CF6B4CE9A1DF4838C75701EDC8A429739C097,ed25519-priv-0x292A25EDBE90DCB5F682908C1E7185E1CC127FAD74EEA218167115AA5962866C,ed25519-priv-0x2B92EC3BFFF77589B282D48015F1EABF321A7304E9FC63B6E1C9F6D5E8CFCCD2,ed25519-priv-0x6B2136B0FD86D25C98994C4B4177550547E0D5002C934347FE23397C8A9F7102,ed25519-priv-0x71E01D192B4988CE655BBA295CF86062706EABE5AF85B506E33055682CD02E8C"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================
# HELPER FUNCTIONS
# ============================================

print_header() {
    echo ""
    echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
    echo ""
}

check_ssh() {
    local ip=$1
    ssh -o ConnectTimeout=5 -o BatchMode=yes ${WORKER_VM_USER}@${ip} "echo ok" &>/dev/null
}

# ============================================
# STATUS COMMAND
# ============================================

cmd_status() {
    print_header "INFRASTRUCTURE STATUS"

    # Check fullnode
    echo -n "Fullnode (${FULLNODE_IP}): "
    if curl -s --connect-timeout 3 "${FULLNODE_URL}" | grep -q "chain_id"; then
        BLOCK=$(curl -s "${FULLNODE_URL}" | jq -r '.block_height')
        echo -e "${GREEN}✓ Running${NC} (Block: ${BLOCK})"
    else
        echo -e "${RED}✗ Not reachable${NC}"
    fi

    # Check all 3 Worker VMs
    for i in 1 2 3; do
        eval "VM_IP=\${WORKER_VM${i}_IP}"
        echo -n "Worker $i ($VM_IP): "
        if check_ssh $VM_IP; then
            echo -e "${GREEN}✓ SSH OK${NC}"
            echo -n "  └─ HFT Setup: "
            if ssh ${WORKER_VM_USER}@${VM_IP} "test -d /opt/aptos-hft" 2>/dev/null; then
                echo -e "${GREEN}✓ Installed${NC}"
            else
                echo -e "${YELLOW}✗ Not installed${NC}"
            fi
            echo -n "  └─ HFT Server: "
            if ssh ${WORKER_VM_USER}@${VM_IP} "pgrep -f hft-ultra-server" &>/dev/null; then
                echo -e "${GREEN}✓ Running${NC}"
            else
                echo -e "${YELLOW}○ Not running${NC}"
            fi
        else
            echo -e "${RED}✗ SSH failed${NC}"
        fi
    done

    # Check contract
    echo ""
    echo -n "Contract: "
    if curl -s "https://fullnode.testnet.aptoslabs.com/v1/accounts/${CONTRACT_ADDRESS}/modules" | grep -q "multi_outcome_market"; then
        echo -e "${GREEN}✓ Deployed${NC}"
    else
        echo -e "${RED}✗ Not found${NC}"
    fi

    # Check market
    echo -n "Market: "
    PRICES=$(curl -s -X POST "https://fullnode.testnet.aptoslabs.com/v1/view" \
        -H "Content-Type: application/json" \
        -d "{\"function\": \"${CONTRACT_ADDRESS}::multi_outcome_market::get_all_prices\", \"type_arguments\": [], \"arguments\": [\"${MARKET_ADDRESS}\"]}" 2>/dev/null)
    if echo "$PRICES" | grep -q "\["; then
        echo -e "${GREEN}✓ Active${NC}"
    else
        echo -e "${RED}✗ Not found${NC}"
    fi

    echo ""
}

# ============================================
# SETUP COMMAND
# ============================================

cmd_setup() {
    print_header "SETTING UP WORKER VM (${WORKER_VM_IP})"

    echo "This will:"
    echo "  1. Clone aptos-polymarket to /opt/aptos-hft"
    echo "  2. Install npm dependencies"
    echo "  3. Create run script with VM's account keys"
    echo ""
    read -p "Continue? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 1
    fi

    echo ""
    echo "[1/4] Checking SSH connection..."
    if ! check_ssh; then
        echo -e "${RED}Cannot SSH to ${WORKER_VM_IP}${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ SSH OK${NC}"

    echo ""
    echo "[2/4] Cloning repository..."
    ssh ${WORKER_VM_USER}@${WORKER_VM_IP} "
        rm -rf /opt/aptos-hft
        git clone https://github.com/SeamMoney/aptos-polymarket.git /opt/aptos-hft
    "
    echo -e "${GREEN}✓ Cloned${NC}"

    echo ""
    echo "[3/4] Installing dependencies..."
    ssh ${WORKER_VM_USER}@${WORKER_VM_IP} "
        cd /opt/aptos-hft && npm install
    "
    echo -e "${GREEN}✓ Dependencies installed${NC}"

    echo ""
    echo "[4/4] Creating run script..."
    ssh ${WORKER_VM_USER}@${WORKER_VM_IP} "cat > /opt/aptos-hft/run-worker.sh << 'SCRIPT'
#!/bin/bash
# HFT Worker Script - Auto-generated by orchestrator

export APTOS_API_KEY=\"${APTOS_API_KEY}\"
export CONTRACT_ADDRESS=\"${CONTRACT_ADDRESS}\"
export MULTI_MARKET=\"${MARKET_ADDRESS}\"
export MULTI_MARKETS=\"${MULTI_MARKETS}\"
export EXTRA_RPC_ENDPOINTS=\"${FULLNODE_URL}\"
export ULTRA_PRIVATE_KEYS=\"${VM_KEYS}\"
export HFT_PORT=3001

# USD1 Stablecoin - eliminates APT global state contention for 10K+ TPS
export USE_USD1=\"true\"
export USD1_METADATA=\"${USD1_METADATA}\"

MODE=\${1:-normal}
DURATION=\${2:-60}

cd /opt/aptos-hft
npx tsx server/hft-ultra-server.ts \$MODE \$DURATION
SCRIPT
chmod +x /opt/aptos-hft/run-worker.sh"
    echo -e "${GREEN}✓ Run script created${NC}"

    print_header "SETUP COMPLETE"
    echo "Worker VM is ready. Test with:"
    echo "  ./scripts/orchestrator.sh status"
    echo ""
}

# ============================================
# DRYRUN COMMAND (~100 TPS for 5 seconds, minimal APT)
# ============================================

cmd_dryrun() {
    print_header "DRY RUN: ~100 TPS FOR 5 SECONDS"

    echo "This is a quick test to verify everything works:"
    echo ""
    echo "  • 1 worker only (Worker 1)"
    echo "  • 2 accounts only (~100 TPS)"
    echo "  • 5 seconds duration"
    echo "  • Tiny trades (0.001-0.005 APT)"
    echo "  • Estimated cost: < 0.5 APT"
    echo ""
    echo "Perfect for testing the UI flow before the real demo!"
    echo ""
    read -p "Start dry run? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 1
    fi

    # Stop any existing workers
    echo ""
    echo "[1/2] Stopping any existing workers..."
    for i in 1 2 3; do
        eval "VM_IP=\${WORKER_VM${i}_IP}"
        ssh ${WORKER_VM_USER}@${VM_IP} "pkill -f hft-ultra-server 2>/dev/null; screen -S hft -X quit 2>/dev/null" 2>/dev/null || true
    done
    echo "  ✓ Cleared"

    echo ""
    echo "[2/2] Starting Worker 1 in dryrun mode (${WORKER_VM1_IP})..."

    # Only use 2 accounts for ~100 TPS
    DRYRUN_KEYS="0x6e2fca34586261b6f22a973c20024b78ddb370d87f7c974315fb97ba56716a7f,0xe61d22b3dc37c537a20d5b301c4d2b409b2f93cd7b2915f3518d49517c2ab6c4"

    ssh ${WORKER_VM_USER}@${WORKER_VM1_IP} "
        export APTOS_API_KEY='${APTOS_API_KEY}'
        export CONTRACT_ADDRESS='${CONTRACT_ADDRESS}'
        export MULTI_MARKET='${MARKET_ADDRESS}'
        export EXTRA_RPC_ENDPOINTS='${FULLNODE_URL}'
        export ULTRA_PRIVATE_KEYS='${DRYRUN_KEYS}'
        export HFT_PORT=3001
        export HFT_DRYRUN=true
        cd /opt/aptos-hft
        screen -dmS hft bash -c 'npx tsx server/hft-ultra-server.ts dryrun 5 > /tmp/hft-worker.log 2>&1'
    " 2>/dev/null
    echo "  ✓ Started"

    echo ""
    print_header "DRY RUN ACTIVE"
    echo "Server is running on ${WORKER_VM1_IP}:3001"
    echo ""
    echo "Now open your browser and test the UI flow:"
    echo "  1. Go to the Breaking page"
    echo "  2. Click 'Start Demo'"
    echo "  3. ARM → LAUNCH"
    echo "  4. Watch ~100 TPS for 5 seconds"
    echo ""
    echo "The server will auto-stop after 5 seconds."
    echo "Run './scripts/orchestrator.sh stop' to stop early."
    echo ""
}

# ============================================
# DEMO COMMAND (Full TPS)
# ============================================

cmd_demo() {
    DURATION=${1:-60}

    print_header "DEMO MODE: 30K TPS FOR ${DURATION} SECONDS"

    echo "All 3 workers run on cloud VMs (your Mac stays free for the browser!):"
    echo ""
    echo "  Worker 1 (${WORKER_VM1_IP}):  9 accounts  → ~13K TPS"
    echo "  Worker 2 (${WORKER_VM2_IP}):  8 accounts  → ~12K TPS"
    echo "  Worker 3 (${WORKER_VM3_IP}):  8 accounts  → ~12K TPS"
    echo "  ─────────────────────────────────────────────────"
    echo "  TOTAL:                       25 accounts  → ~37K TPS"
    echo ""
    echo "Duration: ${DURATION} seconds"
    echo ""
    read -p "Start demo? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 1
    fi

    echo ""
    echo "[1/3] Starting Worker 1 (${WORKER_VM1_IP}) in QUANTUM mode..."
    ssh -t ${WORKER_VM_USER}@${WORKER_VM1_IP} "screen -dmS hft bash -c 'cd /opt/aptos-hft && ./run-worker.sh quantum ${DURATION} > /tmp/hft-worker.log 2>&1'" 2>/dev/null || true
    echo "  ✓ Started"

    echo "[2/3] Starting Worker 2 (${WORKER_VM2_IP}) in QUANTUM mode..."
    ssh -t ${WORKER_VM_USER}@${WORKER_VM2_IP} "screen -dmS hft bash -c 'cd /opt/aptos-hft && ./run-worker.sh quantum ${DURATION} > /tmp/hft-worker.log 2>&1'" 2>/dev/null || true
    echo "  ✓ Started"

    echo "[3/3] Starting Worker 3 (${WORKER_VM3_IP}) in QUANTUM mode..."
    ssh -t ${WORKER_VM_USER}@${WORKER_VM3_IP} "screen -dmS hft bash -c 'cd /opt/aptos-hft && ./run-worker.sh quantum ${DURATION} > /tmp/hft-worker.log 2>&1'" 2>/dev/null || true
    echo "  ✓ Started"

    echo ""
    print_header "ALL WORKERS RUNNING - MONITORING"
    echo "Workers will run for ${DURATION} seconds."
    echo "Your Mac is free - start the frontend with: npm run dev"
    echo ""
    echo "Press Ctrl+C to stop monitoring (workers will continue)."
    echo ""

    # Monitor loop - show TPS from all workers
    for ((t=0; t<${DURATION}; t+=10)); do
        sleep 10
        echo "--- ${t}s elapsed ---"
        for i in 1 2 3; do
            eval "VM_IP=\${WORKER_VM${i}_IP}"
            TPS=$(ssh ${WORKER_VM_USER}@${VM_IP} "tail -5 /tmp/hft-worker.log 2>/dev/null | grep -o 'Fired: [0-9]*' | tail -1" 2>/dev/null || echo "...")
            echo "  Worker $i: $TPS"
        done
    done

    echo ""
    print_header "DEMO COMPLETE - FINAL LOGS"

    for i in 1 2 3; do
        eval "VM_IP=\${WORKER_VM${i}_IP}"
        echo "=== Worker $i ($VM_IP) ==="
        ssh ${WORKER_VM_USER}@${VM_IP} "tail -20 /tmp/hft-worker.log 2>/dev/null | grep -E '(TPS|Total|Success|Error|completed)' | tail -5" || echo "No logs"
        echo ""
    done
}

# ============================================
# STOP COMMAND
# ============================================

cmd_stop() {
    print_header "STOPPING ALL WORKERS"

    for i in 1 2 3; do
        eval "VM_IP=\${WORKER_VM${i}_IP}"
        echo -n "Stopping Worker $i ($VM_IP)..."
        ssh ${WORKER_VM_USER}@${VM_IP} "pkill -f hft-ultra-server 2>/dev/null; screen -S hft -X quit 2>/dev/null" 2>/dev/null
        if [ $? -eq 0 ]; then
            echo " ✓ Stopped"
        else
            echo " ○ Not running"
        fi
    done

    echo ""
    echo "All workers stopped."
}

# ============================================
# DEPLOY COMMAND - Push latest code to workers
# ============================================

cmd_deploy() {
    print_header "DEPLOYING LATEST CODE TO ALL WORKERS"

    LOCAL_FILE="server/hft-ultra-server.ts"
    if [ ! -f "$LOCAL_FILE" ]; then
        echo -e "${RED}Error: $LOCAL_FILE not found. Run from project root.${NC}"
        exit 1
    fi

    LOCAL_LINES=$(wc -l < "$LOCAL_FILE")
    echo "Local server code: ${LOCAL_LINES} lines"
    echo ""

    for i in 1 2 3; do
        eval "VM_IP=\${WORKER_VM${i}_IP}"
        echo -n "Worker $i ($VM_IP): "

        # Deploy server code
        scp -o ConnectTimeout=10 "$LOCAL_FILE" ${WORKER_VM_USER}@${VM_IP}:/opt/aptos-hft/server/hft-ultra-server.ts 2>/dev/null

        # Verify
        REMOTE_LINES=$(ssh ${WORKER_VM_USER}@${VM_IP} "wc -l /opt/aptos-hft/server/hft-ultra-server.ts" 2>/dev/null | awk '{print $1}')

        if [ "$REMOTE_LINES" = "$LOCAL_LINES" ]; then
            echo -e "${GREEN}✓ Deployed (${REMOTE_LINES} lines)${NC}"
        else
            echo -e "${RED}✗ Mismatch (remote: ${REMOTE_LINES}, local: ${LOCAL_LINES})${NC}"
        fi
    done

    echo ""
    echo -e "${GREEN}Deployment complete.${NC}"
}

# ============================================
# STANDBY COMMAND - Start workers without auto-trading
# ============================================

cmd_standby() {
    print_header "STARTING ALL WORKERS IN STANDBY MODE"

    echo "This starts all 3 workers waiting for UI to trigger trading."
    echo "No auto-trading - you control start/stop from the frontend."
    echo ""

    # Stop any existing workers first
    echo "[1/4] Stopping any existing workers..."
    for i in 1 2 3; do
        eval "VM_IP=\${WORKER_VM${i}_IP}"
        ssh ${WORKER_VM_USER}@${VM_IP} "pkill -f hft-ultra-server 2>/dev/null; screen -S hft -X quit 2>/dev/null" 2>/dev/null || true
    done
    sleep 1
    echo "  ✓ Cleared"

    # Start workers in standby (no mode = no auto-trading)
    echo ""
    echo "[2/4] Starting Worker 1 (${WORKER_VM1_IP}) - PRIMARY (frontend connects here)..."
    ssh ${WORKER_VM_USER}@${WORKER_VM1_IP} "screen -dmS hft bash -c 'cd /opt/aptos-hft && ./run-worker.sh > /tmp/hft-worker.log 2>&1'" 2>/dev/null
    echo "  ✓ Started on port 3001"

    echo "[3/4] Starting Worker 2 (${WORKER_VM2_IP})..."
    ssh ${WORKER_VM_USER}@${WORKER_VM2_IP} "screen -dmS hft bash -c 'cd /opt/aptos-hft && ./run-worker.sh > /tmp/hft-worker.log 2>&1'" 2>/dev/null
    echo "  ✓ Started on port 3001"

    echo "[4/4] Starting Worker 3 (${WORKER_VM3_IP})..."
    ssh ${WORKER_VM_USER}@${WORKER_VM3_IP} "screen -dmS hft bash -c 'cd /opt/aptos-hft && ./run-worker.sh > /tmp/hft-worker.log 2>&1'" 2>/dev/null
    echo "  ✓ Started on port 3001"

    # Wait for servers to initialize
    echo ""
    echo "Waiting for servers to initialize..."
    sleep 3

    # Verify all workers are running
    echo ""
    echo "Verifying workers..."
    ALL_OK=true
    for i in 1 2 3; do
        eval "VM_IP=\${WORKER_VM${i}_IP}"
        echo -n "  Worker $i ($VM_IP): "
        if ssh ${WORKER_VM_USER}@${VM_IP} "pgrep -f hft-ultra-server" &>/dev/null; then
            # Check if WebSocket is listening
            if ssh ${WORKER_VM_USER}@${VM_IP} "ss -tlnp | grep -q ':3001'" 2>/dev/null; then
                echo -e "${GREEN}✓ Running & listening on :3001${NC}"
            else
                echo -e "${YELLOW}○ Running but port not ready yet${NC}"
            fi
        else
            echo -e "${RED}✗ Not running${NC}"
            ALL_OK=false
        fi
    done

    echo ""
    if [ "$ALL_OK" = true ]; then
        print_header "ALL WORKERS READY - STANDBY MODE"
        echo "Workers are initialized and waiting."
        echo ""
        echo "Frontend connection:"
        echo "  VITE_HFT_WS_URL=ws://${WORKER_VM1_IP}:3001"
        echo ""
        echo "To start trading from UI:"
        echo "  1. Open http://localhost:5173/demo-day"
        echo "  2. Click ARM SYSTEM"
        echo "  3. Click LAUNCH"
        echo ""
        echo "Or to auto-start in a specific mode:"
        echo "  ./scripts/orchestrator.sh demo turbo 60"
    else
        echo -e "${RED}Some workers failed to start. Check logs with:${NC}"
        echo "  ./scripts/orchestrator.sh logs"
    fi
}

# ============================================
# LOGS COMMAND - View logs from all workers
# ============================================

cmd_logs() {
    print_header "WORKER LOGS"

    for i in 1 2 3; do
        eval "VM_IP=\${WORKER_VM${i}_IP}"
        echo "=== Worker $i ($VM_IP) ==="
        ssh ${WORKER_VM_USER}@${VM_IP} "tail -30 /tmp/hft-worker.log 2>/dev/null" || echo "No logs found"
        echo ""
    done
}

# ============================================
# MAIN
# ============================================

case "${1:-status}" in
    setup)
        cmd_setup
        ;;
    status)
        cmd_status
        ;;
    deploy)
        cmd_deploy
        ;;
    standby)
        cmd_standby
        ;;
    dryrun)
        cmd_dryrun
        ;;
    demo)
        cmd_demo "${2:-60}"
        ;;
    stop)
        cmd_stop
        ;;
    logs)
        cmd_logs
        ;;
    *)
        echo "Usage: $0 {deploy|standby|demo|status|stop|logs}"
        echo ""
        echo "Commands:"
        echo "  deploy  - Deploy latest server code to all workers"
        echo "  standby - Start all workers in STANDBY (wait for UI to launch)"
        echo "  demo    - Auto-start demo in quantum mode (default 60s)"
        echo "  status  - Check all infrastructure status"
        echo "  stop    - Stop all workers"
        echo "  logs    - View logs from all workers"
        echo ""
        echo "Workflow:"
        echo "  1. ./scripts/orchestrator.sh deploy   # Deploy code"
        echo "  2. ./scripts/orchestrator.sh standby  # Start in standby"
        echo "  3. Open browser, ARM → LAUNCH         # Start trading from UI"
        exit 1
        ;;
esac
