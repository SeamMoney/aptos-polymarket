#!/bin/bash
#
# USD1 HFT DEMO - COMPREHENSIVE RUN SCRIPT
# ========================================
#
# This script runs a complete HFT demo with:
# 1. Pre-flight infrastructure checks
# 2. Worker deployment and startup
# 3. Real-time TPS monitoring
# 4. Post-run TPS analysis
#
# Usage:
#   ./scripts/run-usd1-demo.sh [DURATION] [MODE]
#   ./scripts/run-usd1-demo.sh 60           # 60 seconds, quantum mode
#   ./scripts/run-usd1-demo.sh 120 turbo    # 120 seconds, turbo mode
#
# Prerequisites:
#   - VMs configured with USD1 config (run deploy-vm-usd1-config.sh first)
#   - Accounts funded with USD1 (run fund-usd1-accounts.ts if needed)
#   - Geomi indexer set up for trade visibility (optional but recommended)

set -e

# ============================================
# CONFIGURATION
# ============================================

DURATION=${1:-60}
MODE=${2:-quantum}

# USD1 v2 Contract (Jan 11, 2026)
CONTRACT_ADDRESS="0xbdea15f5b0f5449ae8f3a6ae95a5e090bdeeec91be1fcac8375b2f5f37f1c134"
USD1_METADATA="0x4e977d5ee91d77d680972a44b38b9c7a2c5694439169eeae060a48324e5c4597"

# 12 USD1-backed markets
MULTI_MARKETS="0x3e690f317df664c413e12b15eaa6e5565606fbd46628464f84f93e0674a3c052,0xf3256638cad294e47c8cc6bb1a6a0fdd85b29ef427b3118028c34b9f061aa50d,0x192f7cfc0c8151deec37c6280c17b55f7557a04b580b486d6076cc11955ddde3,0x9e4583c0af174a119b5316ae84988f4fd988259de35ef95447b371744a355762,0xd82731a9a2259ccfef2fd13db13720c7cc927c5b7879aa160aecc618c4d4654f,0x77a65b92664f992ccbd8a17d73a5f2fc933523ce64a1c475d1db1c0fc2acf42a,0xa84ba7b7364a40031e29d355d7a5f48fd54f922c8eed0ed0009c5d660a6da339,0x8187c1b3b7ca06dbcbac36fe280e0b5343b744c5a299a43263f9162738d4d792,0x551f153ff61f94311a22592550b0ede4b3b57338af161bd9472f21e15da23b4b,0x742e3c66cb6570351ceb7cf1b2df87e726c708b786109a8cdae93b0c3c7b5a04,0x35df09c98f8668c06f6777e98e3a0405fe894c271f06ba2fed0b322e2a5c2f16,0xd3227afa81dce5fa0e8f86f61dc7f3215ee799a0d2e6a112a988e5ac732bf719"

# VMs
VM1="178.128.177.88"
VM2="147.182.237.239"
VM3="161.35.231.0"
VM_USER="root"

# Fullnode
FULLNODE="aptos.cash.trading"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ============================================
# HELPER FUNCTIONS
# ============================================

print_header() {
    echo ""
    echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║  $1$(printf '%*s' $((59 - ${#1})) '')║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_section() {
    echo ""
    echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
    echo ""
}

check_ssh() {
    ssh -o ConnectTimeout=5 -o BatchMode=yes ${VM_USER}@$1 "echo ok" &>/dev/null
}

# ============================================
# PRE-FLIGHT CHECKS
# ============================================

preflight_checks() {
    print_section "PRE-FLIGHT CHECKS"

    local ALL_OK=true

    # Check fullnode
    echo -n "  Fullnode ($FULLNODE): "
    if curl -s --connect-timeout 3 "https://${FULLNODE}/v1" | grep -q "chain_id"; then
        BLOCK=$(curl -s "https://${FULLNODE}/v1" | jq -r '.block_height')
        echo -e "${GREEN}✓ Block $BLOCK${NC}"
    else
        echo -e "${RED}✗ Not reachable${NC}"
        ALL_OK=false
    fi

    # Check VMs
    for VM in $VM1 $VM2 $VM3; do
        echo -n "  VM ($VM): "
        if check_ssh $VM; then
            echo -e "${GREEN}✓ SSH OK${NC}"

            # Check HFT setup
            echo -n "    └─ HFT Config: "
            if ssh ${VM_USER}@${VM} "grep -q 'USE_USD1' /opt/aptos-hft/run-hft.sh 2>/dev/null"; then
                echo -e "${GREEN}✓ USD1 configured${NC}"
            else
                echo -e "${YELLOW}⚠ Old config (run deploy-vm-usd1-config.sh)${NC}"
            fi
        else
            echo -e "${RED}✗ SSH failed${NC}"
            ALL_OK=false
        fi
    done

    # Check contract
    echo -n "  Contract: "
    if curl -s "https://fullnode.testnet.aptoslabs.com/v1/accounts/${CONTRACT_ADDRESS}/modules" | grep -q "multi_outcome_market"; then
        echo -e "${GREEN}✓ Deployed${NC}"
    else
        echo -e "${RED}✗ Not found${NC}"
        ALL_OK=false
    fi

    echo ""
    if [ "$ALL_OK" = true ]; then
        echo -e "  ${GREEN}All pre-flight checks passed!${NC}"
        return 0
    else
        echo -e "  ${RED}Some checks failed. Please fix before continuing.${NC}"
        return 1
    fi
}

# ============================================
# STOP WORKERS
# ============================================

stop_workers() {
    echo "  Stopping any existing workers..."
    for VM in $VM1 $VM2 $VM3; do
        ssh ${VM_USER}@${VM} "pkill -f hft-ultra-server 2>/dev/null; screen -S hft -X quit 2>/dev/null" 2>/dev/null || true
    done
    sleep 2
    echo -e "  ${GREEN}✓ Cleared${NC}"
}

# ============================================
# START WORKERS
# ============================================

start_workers() {
    print_section "STARTING WORKERS"

    stop_workers

    echo ""
    echo "  Starting 3 workers in ${MODE} mode for ${DURATION}s..."
    echo ""

    # Start Worker 1
    echo -n "  [1/3] Worker 1 ($VM1): "
    ssh ${VM_USER}@${VM1} "screen -dmS hft bash -c 'cd /opt/aptos-hft && ./run-hft.sh ${MODE} ${DURATION} > /tmp/hft-worker.log 2>&1'" 2>/dev/null
    echo -e "${GREEN}✓ Started (7 accounts)${NC}"

    # Start Worker 2
    echo -n "  [2/3] Worker 2 ($VM2): "
    ssh ${VM_USER}@${VM2} "screen -dmS hft bash -c 'cd /opt/aptos-hft && ./run-hft.sh ${MODE} ${DURATION} > /tmp/hft-worker.log 2>&1'" 2>/dev/null
    echo -e "${GREEN}✓ Started (7 accounts)${NC}"

    # Start Worker 3
    echo -n "  [3/3] Worker 3 ($VM3): "
    ssh ${VM_USER}@${VM3} "screen -dmS hft bash -c 'cd /opt/aptos-hft && ./run-hft.sh ${MODE} ${DURATION} > /tmp/hft-worker.log 2>&1'" 2>/dev/null
    echo -e "${GREEN}✓ Started (6 accounts)${NC}"

    echo ""
    echo "  Waiting 10s for initialization..."
    sleep 10
}

# ============================================
# MONITOR
# ============================================

monitor_progress() {
    print_section "MONITORING (${DURATION}s)"

    local START_TIME=$(date +%s)
    local END_TIME=$((START_TIME + DURATION))

    echo "  ┌────────────┬────────────────────────────────────────────────┐"
    echo "  │  Elapsed   │  Worker Status                                 │"
    echo "  ├────────────┼────────────────────────────────────────────────┤"

    while [ $(date +%s) -lt $END_TIME ]; do
        local ELAPSED=$(($(date +%s) - START_TIME))
        local REMAINING=$((DURATION - ELAPSED))

        # Get quick status from workers
        local W1_TPS=$(ssh -o ConnectTimeout=2 ${VM_USER}@${VM1} "tail -1 /tmp/hft-worker.log 2>/dev/null | grep -o 'TPS: [0-9]*' | head -1" 2>/dev/null || echo "...")
        local W2_TPS=$(ssh -o ConnectTimeout=2 ${VM_USER}@${VM2} "tail -1 /tmp/hft-worker.log 2>/dev/null | grep -o 'TPS: [0-9]*' | head -1" 2>/dev/null || echo "...")
        local W3_TPS=$(ssh -o ConnectTimeout=2 ${VM_USER}@${VM3} "tail -1 /tmp/hft-worker.log 2>/dev/null | grep -o 'TPS: [0-9]*' | head -1" 2>/dev/null || echo "...")

        printf "  │  %3ds/%3ds │  W1: %-8s  W2: %-8s  W3: %-8s   │\n" $ELAPSED $DURATION "$W1_TPS" "$W2_TPS" "$W3_TPS"

        sleep 10
    done

    echo "  └────────────┴────────────────────────────────────────────────┘"
}

# ============================================
# POST-RUN ANALYSIS
# ============================================

post_run_analysis() {
    print_section "POST-RUN ANALYSIS"

    echo "  Waiting 15s for final transactions to land..."
    sleep 15

    echo ""
    echo "  Collecting worker logs..."
    echo ""

    # Get final stats from each worker
    for i in 1 2 3; do
        eval "VM=\$VM${i}"
        echo "  ═══ Worker $i ($VM) ═══"
        ssh ${VM_USER}@${VM} "tail -30 /tmp/hft-worker.log 2>/dev/null | grep -E '(Total|Success|TPS|completed|Fired)' | tail -10" 2>/dev/null || echo "  No logs"
        echo ""
    done

    echo "  Running on-chain TPS analysis..."
    echo ""

    # Calculate approximate block range
    MINUTES=$((DURATION / 60 + 2))

    # Run analyze-tps.ts
    cd "$SCRIPT_DIR/.."
    npx tsx scripts/analyze-tps.ts --minutes $MINUTES
}

# ============================================
# MAIN
# ============================================

main() {
    print_header "USD1 HFT DEMO"

    echo "  Configuration:"
    echo "    Duration:    ${DURATION} seconds"
    echo "    Mode:        ${MODE}"
    echo "    Contract:    ${CONTRACT_ADDRESS:0:12}...${CONTRACT_ADDRESS: -6}"
    echo "    Markets:     12 USD1-backed"
    echo "    Accounts:    20 (7+7+6)"
    echo ""
    echo "  TPS Optimization Stack:"
    echo "    ✓ USD1 collateral (no APT global state contention)"
    echo "    ✓ 12 parallel markets (round-robin distribution)"
    echo "    ✓ 20 accounts across 3 VMs (no sequence conflicts)"
    echo "    ✓ Orderless transactions (replay protection nonce)"
    echo ""

    # Pre-flight
    if ! preflight_checks; then
        echo ""
        echo -e "  ${RED}Pre-flight checks failed. Exiting.${NC}"
        exit 1
    fi

    echo ""
    read -p "  Start demo? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "  Aborted."
        exit 0
    fi

    # Record start block
    START_BLOCK=$(curl -s "https://${FULLNODE}/v1" | jq -r '.block_height')
    echo ""
    echo -e "  ${CYAN}Starting at block: $START_BLOCK${NC}"

    # Start workers
    start_workers

    # Monitor
    monitor_progress

    # Stop workers
    print_section "STOPPING WORKERS"
    stop_workers

    # Record end block
    END_BLOCK=$(curl -s "https://${FULLNODE}/v1" | jq -r '.block_height')
    echo ""
    echo -e "  ${CYAN}Ended at block: $END_BLOCK${NC}"
    echo -e "  ${CYAN}Block range: $((END_BLOCK - START_BLOCK)) blocks${NC}"

    # Post-run analysis
    post_run_analysis

    print_header "DEMO COMPLETE"

    echo "  Next steps:"
    echo "    • View trades on UI: http://localhost:5173/polymarket"
    echo "    • Run detailed analysis: npx tsx scripts/analyze-tps.ts --range $START_BLOCK $END_BLOCK"
    echo "    • Check Geomi for indexed trades (if configured)"
    echo ""
}

main "$@"
