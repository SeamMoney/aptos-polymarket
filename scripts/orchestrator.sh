#!/bin/bash
#
# APTOS POLYMARKET - HFT ORCHESTRATOR
# ====================================
# Coordinates multiple HFT workers for high TPS demos
#
# Usage:
#   ./scripts/orchestrator.sh setup      # Set up VM worker (one-time)
#   ./scripts/orchestrator.sh test       # Test mode: ~100 TPS for 30 seconds
#   ./scripts/orchestrator.sh demo       # Demo mode: Max TPS for 60 seconds
#   ./scripts/orchestrator.sh status     # Check all infrastructure status
#   ./scripts/orchestrator.sh stop       # Stop all workers
#

set -e

# ============================================
# CONFIGURATION
# ============================================

# Your infrastructure
FULLNODE_IP="164.92.117.18"
FULLNODE_URL="http://${FULLNODE_IP}:8080/v1"

# Worker VM (2 vCPU, 4GB)
WORKER_VM_IP="147.182.237.239"
WORKER_VM_USER="root"

# Contract addresses
CONTRACT_ADDRESS="0xa2e5e47aab07fed78a3bcf95135ee2dad20c547499c94cb16a3e047859ffa7e1"
MARKET_ADDRESS="0xfefd1b67818ee4ef12a7953852c83f0efb411a9b92c518a52ba92555e4abdd96"

# API Keys
APTOS_API_KEY="AG-3JMDT54EN4DCLULDWAUXCYGQ56JJQCYHH"

# Account keys split between workers
# Worker 1 (Local Mac): First 10 accounts
LOCAL_KEYS="0x6e2fca34586261b6f22a973c20024b78ddb370d87f7c974315fb97ba56716a7f,0xe61d22b3dc37c537a20d5b301c4d2b409b2f93cd7b2915f3518d49517c2ab6c4,0x4542c2e4a39beee8202eee0cddeceea886687b21b54b8f50c17e729251fdd7f5,0xcf5154af9664bbc2634fddfcce2317ed788b35de7f004ac0e24aefd68a0b10c5,ed25519-priv-0xb7d1f406e48c2eddffe987f98445dd4a353e8e9d1630d878621ded084bdd77c7,ed25519-priv-0xa8088ee787b847f6304807a8b09d1afc15409082ee9c8b7eda6919b0ecb86ea8,ed25519-priv-0xb5305eb83498dcba61242ccc91fac35263d9b44bddaf5e7417adbaceb1cfcb36,ed25519-priv-0xc27a6a8b6ed3013da99dc924b2f6af17f1448dedce91691f97d9e778c0761655,ed25519-priv-0xd6402b3493af005ed02b07f6cd7ffdfd37fae6d4d9c88fec6ff38e90f01b21c1,ed25519-priv-0xd375af1a686835905e15bf82f24fcaeed4b1b5b5fabe22c80e998acb804aa295"

# Worker 2 (VM): Last 10 accounts
VM_KEYS="ed25519-priv-0xC5BA2ED0F5C40EE298E844B1140B6BB31C2671B747C8E9DF4B76054C4C5A8761,ed25519-priv-0x536C886483209657C9B30663B295C7CB007EB57E07931D3E41AF69067897D465,ed25519-priv-0x3E9CB6207207A266F298B1B13648D707BF886766221C3253F30AF68530A79749,ed25519-priv-0x4641D0FDD221B48EF4A45C8DC77D6D4F12D6848E01B7686134564A8CAE5BE637,ed25519-priv-0xFB2AFF37DFED247E9CF407FFA41208A41A78877C1990ADD1F94E00FCE1A5CCAC,ed25519-priv-0x9E338A7FB43F8280CCD82B2929B66F4ED1B7AA7900C40E06EAD934BC7CDEF315,ed25519-priv-0x8E7D4B0196840DA3A7BA6EDEF3784E1B961263F06651B130F440F5D974920B1F,ed25519-priv-0x975CF351CE096E1350C9F9E89ED5CB8D7BEAAEBF7FC235B10F1A0852355EED7A,ed25519-priv-0xD945B44FCFA961B9E4F8DAA5139CF6B4CE9A1DF4838C75701EDC8A429739C097,ed25519-priv-0x292A25EDBE90DCB5F682908C1E7185E1CC127FAD74EEA218167115AA5962866C"

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
    ssh -o ConnectTimeout=5 -o BatchMode=yes ${WORKER_VM_USER}@${WORKER_VM_IP} "echo ok" &>/dev/null
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

    # Check worker VM
    echo -n "Worker VM (${WORKER_VM_IP}): "
    if check_ssh; then
        echo -e "${GREEN}✓ SSH OK${NC}"

        # Check if HFT is set up
        echo -n "  └─ HFT Setup: "
        if ssh ${WORKER_VM_USER}@${WORKER_VM_IP} "test -d /opt/aptos-hft" 2>/dev/null; then
            echo -e "${GREEN}✓ Installed${NC}"
        else
            echo -e "${YELLOW}✗ Not installed (run: ./scripts/orchestrator.sh setup)${NC}"
        fi

        # Check if HFT is running
        echo -n "  └─ HFT Server: "
        if ssh ${WORKER_VM_USER}@${WORKER_VM_IP} "pgrep -f hft-ultra-server" &>/dev/null; then
            echo -e "${GREEN}✓ Running${NC}"
        else
            echo -e "${YELLOW}○ Not running${NC}"
        fi
    else
        echo -e "${RED}✗ SSH failed${NC}"
    fi

    # Check local
    echo -n "Local Mac: "
    if pgrep -f "hft-ultra-server" &>/dev/null; then
        echo -e "${GREEN}✓ HFT Running${NC}"
    else
        echo -e "${YELLOW}○ HFT Not running${NC}"
    fi

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
export EXTRA_RPC_ENDPOINTS=\"${FULLNODE_URL}\"
export ULTRA_PRIVATE_KEYS=\"${VM_KEYS}\"
export HFT_PORT=3001

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
# TEST COMMAND (~100 TPS for 30 seconds)
# ============================================

cmd_test() {
    print_header "TEST MODE: ~100 TPS FOR 30 SECONDS"

    echo "This will:"
    echo "  1. Start VM worker (10 accounts, throttled)"
    echo "  2. Start local worker (10 accounts, throttled)"
    echo "  3. Run for 30 seconds at ~100 TPS total"
    echo "  4. Show combined results"
    echo ""
    read -p "Start test? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 1
    fi

    # Check VM is set up
    if ! ssh ${WORKER_VM_USER}@${WORKER_VM_IP} "test -f /opt/aptos-hft/run-worker.sh" 2>/dev/null; then
        echo -e "${RED}VM not set up. Run: ./scripts/orchestrator.sh setup${NC}"
        exit 1
    fi

    echo ""
    echo "[1/2] Starting VM worker..."
    ssh ${WORKER_VM_USER}@${WORKER_VM_IP} "
        pkill -f hft-ultra-server 2>/dev/null || true
        cd /opt/aptos-hft
        nohup ./run-worker.sh test 30 > /tmp/hft-worker.log 2>&1 &
        echo 'VM worker started (PID: '\$!')'
    "

    sleep 2

    echo "[2/2] Starting local worker..."
    echo ""

    # Run local worker in foreground
    export APTOS_API_KEY="${APTOS_API_KEY}"
    export CONTRACT_ADDRESS="${CONTRACT_ADDRESS}"
    export MULTI_MARKET="${MARKET_ADDRESS}"
    export EXTRA_RPC_ENDPOINTS="${FULLNODE_URL}"
    export ULTRA_PRIVATE_KEYS="${LOCAL_KEYS}"
    export HFT_PORT=3001

    cd /Users/maxmohammadi/aptos-polymarket
    npx tsx server/hft-ultra-server.ts test 30

    echo ""
    print_header "TEST COMPLETE - VM WORKER LOGS"
    ssh ${WORKER_VM_USER}@${WORKER_VM_IP} "tail -50 /tmp/hft-worker.log | grep -E '(TPS|Total|Success|Error)'" || echo "No logs available"

    echo ""
}

# ============================================
# DEMO COMMAND (Full TPS)
# ============================================

cmd_demo() {
    DURATION=${1:-60}

    print_header "DEMO MODE: MAX TPS FOR ${DURATION} SECONDS"

    echo "This will:"
    echo "  1. Start VM worker (10 accounts, full speed)"
    echo "  2. Start local worker (10 accounts, full speed)"
    echo "  3. Target: ~20,000 TPS combined"
    echo "  4. Run for ${DURATION} seconds"
    echo ""
    read -p "Start demo? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 1
    fi

    # Check VM is set up
    if ! ssh ${WORKER_VM_USER}@${WORKER_VM_IP} "test -f /opt/aptos-hft/run-worker.sh" 2>/dev/null; then
        echo -e "${RED}VM not set up. Run: ./scripts/orchestrator.sh setup${NC}"
        exit 1
    fi

    echo ""
    echo "[1/2] Starting VM worker..."
    ssh ${WORKER_VM_USER}@${WORKER_VM_IP} "
        pkill -f hft-ultra-server 2>/dev/null || true
        cd /opt/aptos-hft
        nohup ./run-worker.sh normal ${DURATION} > /tmp/hft-worker.log 2>&1 &
        echo 'VM worker started'
    "

    sleep 2

    echo "[2/2] Starting local worker..."
    echo ""

    # Run local worker in foreground
    export APTOS_API_KEY="${APTOS_API_KEY}"
    export CONTRACT_ADDRESS="${CONTRACT_ADDRESS}"
    export MULTI_MARKET="${MARKET_ADDRESS}"
    export EXTRA_RPC_ENDPOINTS="${FULLNODE_URL}"
    export ULTRA_PRIVATE_KEYS="${LOCAL_KEYS}"
    export HFT_PORT=3001

    cd /Users/maxmohammadi/aptos-polymarket
    npx tsx server/hft-ultra-server.ts normal ${DURATION}

    echo ""
    print_header "DEMO COMPLETE - VM WORKER LOGS"
    ssh ${WORKER_VM_USER}@${WORKER_VM_IP} "tail -50 /tmp/hft-worker.log | grep -E '(TPS|Total|Success|Error)'" || echo "No logs available"

    echo ""
}

# ============================================
# STOP COMMAND
# ============================================

cmd_stop() {
    print_header "STOPPING ALL WORKERS"

    echo "Stopping local worker..."
    pkill -f "hft-ultra-server" 2>/dev/null && echo "  ✓ Stopped" || echo "  ○ Not running"

    echo "Stopping VM worker..."
    ssh ${WORKER_VM_USER}@${WORKER_VM_IP} "pkill -f hft-ultra-server 2>/dev/null" && echo "  ✓ Stopped" || echo "  ○ Not running"

    echo ""
    echo "All workers stopped."
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
    test)
        cmd_test
        ;;
    demo)
        cmd_demo "${2:-60}"
        ;;
    stop)
        cmd_stop
        ;;
    *)
        echo "Usage: $0 {setup|status|test|demo|stop}"
        echo ""
        echo "Commands:"
        echo "  setup   - Set up VM worker (one-time)"
        echo "  status  - Check all infrastructure status"
        echo "  test    - Run ~100 TPS test for 30 seconds"
        echo "  demo    - Run max TPS demo (default 60s)"
        echo "  stop    - Stop all workers"
        exit 1
        ;;
esac
