#!/bin/bash
#
# APTOS POLYMARKET - DEMO ORCHESTRATOR
# =====================================
# Simplified demo script for 2000-account high TPS demos
#
# Usage:
#   ./scripts/demo.sh standby           # AMM only (2000 accounts)
#   ./scripts/demo.sh standby --dual    # AMM + USD1 transfers (1500 + 500)
#   ./scripts/demo.sh launch N          # Trigger N-second demo
#   ./scripts/demo.sh stop              # Stop all workers
#   ./scripts/demo.sh status            # Check all workers
#   ./scripts/demo.sh logs              # View worker logs
#   ./scripts/demo.sh deploy            # Deploy latest code to VMs
#

set -e

# Dual mode flag (set by --dual argument)
DUAL_MODE=false

# ============================================
# CONFIGURATION
# ============================================

# Cloud Worker VMs
WORKER1_IP="178.128.177.88"
WORKER2_IP="147.182.237.239"
WORKER3_IP="161.35.231.0"
WORKER_USER="root"

# Account Distribution - AMM Only (2000 total)
# Each worker gets ~667 accounts to avoid nonce conflicts
WORKER1_AMM_START=0
WORKER1_AMM_COUNT=667
WORKER2_AMM_START=667
WORKER2_AMM_COUNT=667
WORKER3_AMM_START=1334
WORKER3_AMM_COUNT=666

# Account Distribution - Dual Mode (AMM 1500 + Transfers 500)
# AMM: accounts 0-1499 (500 per worker)
# Transfers: accounts 1500-1999 (~167 per worker)
WORKER1_AMM_DUAL_START=0
WORKER1_AMM_DUAL_COUNT=500
WORKER2_AMM_DUAL_START=500
WORKER2_AMM_DUAL_COUNT=500
WORKER3_AMM_DUAL_START=1000
WORKER3_AMM_DUAL_COUNT=500

WORKER1_TRANSFER_START=1500
WORKER1_TRANSFER_COUNT=167
WORKER2_TRANSFER_START=1667
WORKER2_TRANSFER_COUNT=167
WORKER3_TRANSFER_START=1834
WORKER3_TRANSFER_COUNT=166

# Contract Configuration
CONTRACT_ADDRESS="0xca4d40eae9f07fb28a121862d649203fb4335ece9536ee51790e19f812ff7aea"
USD1_METADATA="0x4e977d5ee91d77d680972a44b38b9c7a2c5694439169eeae060a48324e5c4597"

# Markets (15 total)
MULTI_MARKETS="0xaf561030c7ebb22b1d8b99b727c27caab1f6944ce39c141fd2b6b0cfbf614a9e,0x1c5b4c6b0a8e1b9e8b6a4f3d2e1c0b9a8f7e6d5c4b3a2918f7e6d5c4b3a29180,0x2d6c5d7c1b9f2c0f9c7b5g4e3f2d1c0a9f8e7d6c5b4a3928f8e7d6c5b4a39281,0x3e7d6e8d2c0g3d1g0d8c6h5f4g3e2d1b0g9f8e7d6c5b4a3938g9f8e7d6c5b4a3,0x4f8e7f9e3d1h4e2h1e9d7i6g5h4f3e2c1h0g9f8e7d6c5b4a4948h0g9f8e7d6c5b,0x5g9f8g0f4e2i5f3i2f0e8j7h6i5g4f3d2i1h0g9f8e7d6c5b5a58i1h0g9f8e7d6c,0x6h0g9h1g5f3j6g4j3g1f9k8i7j6h5g4e3j2i1h0g9f8e7d6c6b68j2i1h0g9f8e7d,0x7i1h0i2h6g4k7h5k4h2g0l9j8k7i6h5f4k3j2i1h0g9f8e7d7c78k3j2i1h0g9f8e,0x8j2i1j3i7h5l8i6l5i3h1m0k9l8j7i6g5l4k3j2i1h0g9f8e8d88l4k3j2i1h0g9f,0x9k3j2k4j8i6m9j7m6j4i2n1l0m9k8j7h6m5l4k3j2i1h0g9f9e98m5l4k3j2i1h0g,0xal4k3l5k9j7n0k8n7k5j3o2m1n0l9k8i7n6m5l4k3j2i1h0ga0fa8n6m5l4k3j2i1h,0xbm5l4m6l0k8o1l9o8l6k4p3n2o1m0l9j8o7n6m5l4k3j2i1hb1gb8o7n6m5l4k3j2i,0xcn6m5n7m1l9p2m0p9m7l5q4o3p2n1m0k9p8o7n6m5l4k3j2ic2hc8p8o7n6m5l4k3j,0xdo7n6o8n2m0q3n1q0n8m6r5p4q3o2n1l0q9p8o7n6m5l4k3jd3id8q9p8o7n6m5l4k,0xep8o7p9o3n1r4o2r1o9n7s6q5r4p3o2m1r0q9p8o7n6m5l4ke4je8r0q9p8o7n6m5l"

# RPC - Internal VFN for best TPS
INTERNAL_VFN="http://vfn0.usce1-0.testnet.aptoslabs.com:80/v1"

# Mode Configuration (turbo is safest for demos)
DEFAULT_MODE="turbo"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ============================================
# HELPER FUNCTIONS
# ============================================

print_banner() {
    echo -e "${CYAN}"
    echo "╔══════════════════════════════════════════════════════════════════════╗"
    echo "║              APTOS POLYMARKET - DEMO ORCHESTRATOR                     ║"
    echo "║                    2000 Accounts | 3 Workers                          ║"
    echo "╚══════════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_header() {
    echo ""
    echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
    echo ""
}

check_ssh() {
    local ip=$1
    ssh -o ConnectTimeout=5 -o BatchMode=yes -o StrictHostKeyChecking=no ${WORKER_USER}@${ip} "echo ok" &>/dev/null
}

check_server() {
    local ip=$1
    local port=${2:-3001}
    curl -s --connect-timeout 3 "http://${ip}:${port}/health" 2>/dev/null | grep -q "ok"
}

get_seed_mnemonic() {
    # Load from .env.seed
    if [ -f ".env.seed" ]; then
        SEED_MNEMONIC=$(grep '^SEED_MNEMONIC' .env.seed | sed 's/SEED_MNEMONIC="//' | sed 's/"$//')
        if [ -n "$SEED_MNEMONIC" ]; then
            return 0
        fi
    fi
    echo -e "${RED}Error: SEED_MNEMONIC not found in .env.seed${NC}"
    return 1
}

# ============================================
# STATUS COMMAND
# ============================================

cmd_status() {
    print_banner
    print_header "WORKER STATUS"

    echo "Checking cloud workers..."
    echo ""

    TOTAL_ACCOUNTS=0
    WORKERS_READY=0

    for i in 1 2 3; do
        eval "IP=\${WORKER${i}_IP}"
        eval "START=\${WORKER${i}_START}"
        eval "COUNT=\${WORKER${i}_COUNT}"

        echo -n "  Worker $i ($IP): "

        if check_ssh $IP; then
            if check_server $IP; then
                # Get status from server
                STATUS=$(curl -s "http://${IP}:3001/status" 2>/dev/null)
                ACCOUNTS=$(echo "$STATUS" | grep -o '"total":[0-9]*' | head -1 | grep -o '[0-9]*' || echo "0")
                RUNNING=$(echo "$STATUS" | grep -o '"isRunning":[a-z]*' | grep -o 'true\|false' || echo "false")

                if [ "$RUNNING" = "true" ]; then
                    TPS=$(echo "$STATUS" | grep -o '"currentTps":[0-9]*' | grep -o '[0-9]*' || echo "0")
                    echo -e "${GREEN}RUNNING${NC} | $ACCOUNTS accounts | $TPS TPS"
                else
                    echo -e "${GREEN}READY${NC} | $ACCOUNTS accounts"
                fi
                TOTAL_ACCOUNTS=$((TOTAL_ACCOUNTS + ACCOUNTS))
                WORKERS_READY=$((WORKERS_READY + 1))
            else
                echo -e "${YELLOW}SSH OK, server not running${NC}"
            fi
        else
            echo -e "${RED}SSH FAILED${NC}"
        fi
    done

    echo ""
    echo "────────────────────────────────────────────────────────────────"
    echo -e "  Total: ${BOLD}$WORKERS_READY/3 workers${NC} | ${BOLD}$TOTAL_ACCOUNTS accounts${NC}"
    echo ""

    # Check RPC
    echo -n "  Internal VFN: "
    if curl -s --connect-timeout 3 "${INTERNAL_VFN}" 2>/dev/null | grep -q "chain_id"; then
        BLOCK=$(curl -s "${INTERNAL_VFN}" 2>/dev/null | grep -o '"block_height":"[0-9]*"' | grep -o '[0-9]*')
        echo -e "${GREEN}OK${NC} (block $BLOCK)"
    else
        echo -e "${RED}NOT RESPONDING${NC}"
    fi

    echo ""
}

# ============================================
# STANDBY COMMAND
# ============================================

cmd_standby() {
    print_banner

    if [ "$DUAL_MODE" = true ]; then
        print_header "STARTING WORKERS IN DUAL MODE (AMM + TRANSFERS)"
        echo "Configuration:"
        echo "  - AMM Accounts: 1500 (500 per worker)"
        echo "  - Transfer Accounts: 500 (~167 per worker)"
        echo "  - Total: 2000 accounts"
    else
        print_header "STARTING WORKERS IN STANDBY MODE (AMM ONLY)"
        echo "Configuration:"
        echo "  - Accounts: 2000 total (split across 3 workers)"
    fi

    echo "  - Mode: ${DEFAULT_MODE}"
    echo "  - USE_ORDERLESS: false (avoids ~50% nonce failures)"
    echo "  - RPC: Internal VFN"
    echo ""

    # Get seed mnemonic
    if ! get_seed_mnemonic; then
        exit 1
    fi

    # Stop any existing workers
    echo "[1/5] Stopping existing workers..."
    for i in 1 2 3; do
        eval "IP=\${WORKER${i}_IP}"
        ssh ${WORKER_USER}@${IP} "pkill -f hft-piscina-server 2>/dev/null; pkill -f transfer-tps-server 2>/dev/null; screen -S hft -X quit 2>/dev/null; screen -S transfer -X quit 2>/dev/null" 2>/dev/null || true
    done
    sleep 1
    echo -e "  ${GREEN}Done${NC}"

    # Start AMM workers
    echo ""
    for i in 1 2 3; do
        eval "IP=\${WORKER${i}_IP}"

        if [ "$DUAL_MODE" = true ]; then
            eval "AMM_START=\${WORKER${i}_AMM_DUAL_START}"
            eval "AMM_COUNT=\${WORKER${i}_AMM_DUAL_COUNT}"
        else
            eval "AMM_START=\${WORKER${i}_AMM_START}"
            eval "AMM_COUNT=\${WORKER${i}_AMM_COUNT}"
        fi

        echo "[$(($i+1))/5] Starting AMM Worker $i ($IP) - accounts $AMM_START to $((AMM_START + AMM_COUNT - 1))..."

        ssh ${WORKER_USER}@${IP} "
            export SEED_MNEMONIC='${SEED_MNEMONIC}'
            export ACCOUNT_START_INDEX=${AMM_START}
            export ACCOUNT_COUNT=${AMM_COUNT}
            export USE_ORDERLESS=false
            export RPC_MODE=internal
            export CONTRACT_ADDRESS='${CONTRACT_ADDRESS}'
            export USD1_METADATA='${USD1_METADATA}'
            export MULTI_MARKETS='${MULTI_MARKETS}'
            export PORT=3001
            cd /opt/aptos-hft
            screen -dmS hft bash -c 'npx tsx server/hft-piscina-server.ts ${DEFAULT_MODE} > /tmp/hft-amm.log 2>&1'
        " 2>/dev/null

        echo -e "  ${GREEN}Started on port 3001${NC}"
    done

    # Start Transfer workers (dual mode only)
    if [ "$DUAL_MODE" = true ]; then
        echo ""
        for i in 1 2 3; do
            eval "IP=\${WORKER${i}_IP}"
            eval "TRANSFER_START=\${WORKER${i}_TRANSFER_START}"
            eval "TRANSFER_COUNT=\${WORKER${i}_TRANSFER_COUNT}"

            echo "[$(($i+4))/7] Starting Transfer Worker $i ($IP) - accounts $TRANSFER_START to $((TRANSFER_START + TRANSFER_COUNT - 1))..."

            ssh ${WORKER_USER}@${IP} "
                export SEED_MNEMONIC='${SEED_MNEMONIC}'
                export ACCOUNT_START_INDEX=${TRANSFER_START}
                export ACCOUNT_COUNT=${TRANSFER_COUNT}
                export USE_ORDERLESS=false
                export RPC_MODE=internal
                export USD1_METADATA='${USD1_METADATA}'
                export PORT=3002
                cd /opt/aptos-hft
                screen -dmS transfer bash -c 'npx tsx server/transfer-tps-server.ts ${DEFAULT_MODE} > /tmp/hft-transfer.log 2>&1'
            " 2>/dev/null

            echo -e "  ${GREEN}Started on port 3002${NC}"
        done
    fi

    # Wait for servers to be ready
    echo ""
    echo "Waiting for servers to initialize..."
    sleep 5

    # Verify AMM servers
    echo ""
    echo "Verifying AMM workers..."
    AMM_READY=true
    TOTAL_AMM_ACCOUNTS=0
    for i in 1 2 3; do
        eval "IP=\${WORKER${i}_IP}"
        echo -n "  AMM Worker $i ($IP:3001): "

        if check_server $IP 3001; then
            STATUS=$(curl -s "http://${IP}:3001/status" 2>/dev/null)
            ACCOUNTS=$(echo "$STATUS" | grep -o '"total":[0-9]*' | head -1 | grep -o '[0-9]*' || echo "0")
            TOTAL_AMM_ACCOUNTS=$((TOTAL_AMM_ACCOUNTS + ACCOUNTS))
            echo -e "${GREEN}READY${NC} ($ACCOUNTS accounts)"
        else
            echo -e "${RED}NOT READY${NC}"
            AMM_READY=false
        fi
    done

    # Verify Transfer servers (dual mode only)
    TRANSFER_READY=true
    TOTAL_TRANSFER_ACCOUNTS=0
    if [ "$DUAL_MODE" = true ]; then
        echo ""
        echo "Verifying Transfer workers..."
        for i in 1 2 3; do
            eval "IP=\${WORKER${i}_IP}"
            echo -n "  Transfer Worker $i ($IP:3002): "

            if check_server $IP 3002; then
                STATUS=$(curl -s "http://${IP}:3002/status" 2>/dev/null)
                ACCOUNTS=$(echo "$STATUS" | grep -o '"total":[0-9]*' | head -1 | grep -o '[0-9]*' || echo "0")
                TOTAL_TRANSFER_ACCOUNTS=$((TOTAL_TRANSFER_ACCOUNTS + ACCOUNTS))
                echo -e "${GREEN}READY${NC} ($ACCOUNTS accounts)"
            else
                echo -e "${RED}NOT READY${NC}"
                TRANSFER_READY=false
            fi
        done
    fi

    echo ""
    ALL_READY=true
    if [ "$AMM_READY" != true ]; then ALL_READY=false; fi
    if [ "$DUAL_MODE" = true ] && [ "$TRANSFER_READY" != true ]; then ALL_READY=false; fi

    if [ "$ALL_READY" = true ]; then
        if [ "$DUAL_MODE" = true ]; then
            echo -e "${GREEN}╔══════════════════════════════════════════════════════════════════════╗${NC}"
            echo -e "${GREEN}║              ALL WORKERS READY - DUAL MODE (AMM + TRANSFERS)          ║${NC}"
            echo -e "${GREEN}╠══════════════════════════════════════════════════════════════════════╣${NC}"
            echo -e "${GREEN}║  AMM:       $TOTAL_AMM_ACCOUNTS accounts on port 3001                              ║${NC}"
            echo -e "${GREEN}║  Transfers: $TOTAL_TRANSFER_ACCOUNTS accounts on port 3002                              ║${NC}"
            echo -e "${GREEN}╚══════════════════════════════════════════════════════════════════════╝${NC}"
        else
            echo -e "${GREEN}╔══════════════════════════════════════════════════════════════════════╗${NC}"
            echo -e "${GREEN}║                    ALL WORKERS READY - STANDBY MODE                   ║${NC}"
            echo -e "${GREEN}╚══════════════════════════════════════════════════════════════════════╝${NC}"
        fi
        echo ""
        echo "Next steps:"
        echo "  1. Open browser: http://localhost:5173/demo-day"
        echo "  2. Verify ARM button shows all green"
        echo "  3. Start live feed: npx tsx scripts/live-feed.ts --workers"
        echo "  4. Launch demo: ./scripts/demo.sh launch 60"
        echo ""
    else
        echo -e "${RED}Some workers failed to start. Check logs:${NC}"
        echo "  ./scripts/demo.sh logs"
    fi
}

# ============================================
# LAUNCH COMMAND
# ============================================

cmd_launch() {
    DURATION=${1:-60}

    print_banner

    if [ "$DUAL_MODE" = true ]; then
        print_header "LAUNCHING DUAL DEMO - ${DURATION} SECONDS"
        echo "Triggering AMM + Transfer workers..."
    else
        print_header "LAUNCHING DEMO - ${DURATION} SECONDS"
        echo "Triggering AMM workers..."
    fi
    echo ""

    # Start AMM servers
    echo "AMM Servers (port 3001):"
    for i in 1 2 3; do
        eval "IP=\${WORKER${i}_IP}"
        echo -n "  Worker $i ($IP): "

        RESPONSE=$(curl -s -X POST "http://${IP}:3001/start?duration=${DURATION}" 2>/dev/null)
        if echo "$RESPONSE" | grep -q "started\|ok"; then
            echo -e "${GREEN}STARTED${NC}"
        else
            echo -e "${RED}FAILED${NC}"
        fi
    done

    # Start Transfer servers (dual mode only)
    if [ "$DUAL_MODE" = true ]; then
        echo ""
        echo "Transfer Servers (port 3002):"
        for i in 1 2 3; do
            eval "IP=\${WORKER${i}_IP}"
            echo -n "  Worker $i ($IP): "

            RESPONSE=$(curl -s -X POST "http://${IP}:3002/start?duration=${DURATION}" 2>/dev/null)
            if echo "$RESPONSE" | grep -q "started\|ok"; then
                echo -e "${GREEN}STARTED${NC}"
            else
                echo -e "${RED}FAILED${NC}"
            fi
        done
    fi

    echo ""
    echo -e "${CYAN}══════════════════════════════════════════════════════════════════════${NC}"
    if [ "$DUAL_MODE" = true ]; then
        echo -e "${BOLD}                    DUAL DEMO RUNNING (AMM + TRANSFERS)${NC}"
    else
        echo -e "${BOLD}                         DEMO RUNNING${NC}"
    fi
    echo -e "${CYAN}══════════════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo "Duration: ${DURATION} seconds"
    echo ""
    echo "Watch progress:"
    echo "  - Live feed: npx tsx scripts/live-feed.ts --workers"
    echo "  - Browser: http://localhost:5173/demo-day"
    echo "  - Stats: https://aptos-consensus-visualizer.vercel.app/polymarket-demo"
    echo ""

    # Monitor loop
    for ((t=5; t<=${DURATION}; t+=5)); do
        sleep 5

        AMM_TPS=0
        AMM_TRADES=0
        TRANSFER_TPS=0
        TRANSFER_TRADES=0

        for i in 1 2 3; do
            eval "IP=\${WORKER${i}_IP}"

            # AMM stats
            STATUS=$(curl -s "http://${IP}:3001/stats" 2>/dev/null)
            TPS=$(echo "$STATUS" | grep -o '"currentTps":[0-9]*' | grep -o '[0-9]*' || echo "0")
            TRADES=$(echo "$STATUS" | grep -o '"totalTrades":[0-9]*' | grep -o '[0-9]*' || echo "0")
            AMM_TPS=$((AMM_TPS + TPS))
            AMM_TRADES=$((AMM_TRADES + TRADES))

            # Transfer stats (dual mode)
            if [ "$DUAL_MODE" = true ]; then
                STATUS=$(curl -s "http://${IP}:3002/stats" 2>/dev/null)
                TPS=$(echo "$STATUS" | grep -o '"currentTps":[0-9]*' | grep -o '[0-9]*' || echo "0")
                TRADES=$(echo "$STATUS" | grep -o '"totalTrades":[0-9]*' | grep -o '[0-9]*' || echo "0")
                TRANSFER_TPS=$((TRANSFER_TPS + TPS))
                TRANSFER_TRADES=$((TRANSFER_TRADES + TRADES))
            fi
        done

        TOTAL_TPS=$((AMM_TPS + TRANSFER_TPS))
        TOTAL_TRADES=$((AMM_TRADES + TRANSFER_TRADES))

        if [ "$DUAL_MODE" = true ]; then
            printf "[%3ds] ${GREEN}AMM: %5d TPS${NC} | ${CYAN}Transfer: %5d TPS${NC} | ${BOLD}TOTAL: %5d TPS${NC} | Trades: %d\n" "$t" "$AMM_TPS" "$TRANSFER_TPS" "$TOTAL_TPS" "$TOTAL_TRADES"
        else
            printf "[%3ds] TPS: %5d | Total Trades: %d\n" "$t" "$TOTAL_TPS" "$TOTAL_TRADES"
        fi
    done

    echo ""
    print_header "DEMO COMPLETE"

    # Final stats
    echo "Final Results:"
    echo ""
    echo "AMM Trading:"
    for i in 1 2 3; do
        eval "IP=\${WORKER${i}_IP}"
        STATUS=$(curl -s "http://${IP}:3001/stats" 2>/dev/null)
        TRADES=$(echo "$STATUS" | grep -o '"totalTrades":[0-9]*' | grep -o '[0-9]*' || echo "0")
        SUCCESS=$(echo "$STATUS" | grep -o '"successfulTrades":[0-9]*' | grep -o '[0-9]*' || echo "0")
        PEAK=$(echo "$STATUS" | grep -o '"peakTps":[0-9]*' | grep -o '[0-9]*' || echo "0")
        echo "  Worker $i: $TRADES trades | $SUCCESS successful | Peak: $PEAK TPS"
    done

    if [ "$DUAL_MODE" = true ]; then
        echo ""
        echo "USD1 Transfers:"
        for i in 1 2 3; do
            eval "IP=\${WORKER${i}_IP}"
            STATUS=$(curl -s "http://${IP}:3002/stats" 2>/dev/null)
            TRADES=$(echo "$STATUS" | grep -o '"totalTrades":[0-9]*' | grep -o '[0-9]*' || echo "0")
            SUCCESS=$(echo "$STATUS" | grep -o '"successfulTrades":[0-9]*' | grep -o '[0-9]*' || echo "0")
            PEAK=$(echo "$STATUS" | grep -o '"peakTps":[0-9]*' | grep -o '[0-9]*' || echo "0")
            echo "  Worker $i: $TRADES transfers | $SUCCESS successful | Peak: $PEAK TPS"
        done
    fi
    echo ""
}

# ============================================
# STOP COMMAND
# ============================================

cmd_stop() {
    print_header "STOPPING ALL WORKERS"

    for i in 1 2 3; do
        eval "IP=\${WORKER${i}_IP}"
        echo -n "  Worker $i ($IP): "

        # Stop via API first (both servers)
        curl -s -X POST "http://${IP}:3001/stop" 2>/dev/null || true
        curl -s -X POST "http://${IP}:3002/stop" 2>/dev/null || true

        # Then kill processes
        ssh ${WORKER_USER}@${IP} "pkill -f hft-piscina-server 2>/dev/null; pkill -f transfer-tps-server 2>/dev/null; screen -S hft -X quit 2>/dev/null; screen -S transfer -X quit 2>/dev/null" 2>/dev/null || true

        echo -e "${GREEN}Stopped${NC}"
    done

    echo ""
    echo "All workers stopped."
}

# ============================================
# LOGS COMMAND
# ============================================

cmd_logs() {
    print_header "WORKER LOGS"

    for i in 1 2 3; do
        eval "IP=\${WORKER${i}_IP}"
        echo "=== Worker $i ($IP) - AMM ==="
        ssh ${WORKER_USER}@${IP} "tail -20 /tmp/hft-amm.log 2>/dev/null" || echo "No AMM logs"
        echo ""

        echo "=== Worker $i ($IP) - Transfers ==="
        ssh ${WORKER_USER}@${IP} "tail -20 /tmp/hft-transfer.log 2>/dev/null" || echo "No transfer logs"
        echo ""
    done
}

# ============================================
# DEPLOY COMMAND
# ============================================

cmd_deploy() {
    print_header "DEPLOYING CODE TO WORKERS"

    # Check local files exist
    if [ ! -f "server/hft-piscina-server.ts" ]; then
        echo -e "${RED}Error: server/hft-piscina-server.ts not found. Run from project root.${NC}"
        exit 1
    fi

    for i in 1 2 3; do
        eval "IP=\${WORKER${i}_IP}"
        echo -n "  Worker $i ($IP): "

        # Sync server directory
        rsync -az --delete \
            --exclude='node_modules' \
            --exclude='.git' \
            server/ ${WORKER_USER}@${IP}:/opt/aptos-hft/server/ 2>/dev/null

        # Sync package files for npm install
        scp -q package.json ${WORKER_USER}@${IP}:/opt/aptos-hft/ 2>/dev/null
        scp -q tsconfig.json ${WORKER_USER}@${IP}:/opt/aptos-hft/ 2>/dev/null

        # Install dependencies if needed
        ssh ${WORKER_USER}@${IP} "cd /opt/aptos-hft && npm install --silent 2>/dev/null" 2>/dev/null || true

        echo -e "${GREEN}Deployed${NC}"
    done

    echo ""
    echo "Deployment complete."
}

# ============================================
# MAIN
# ============================================

# Check for --dual flag in any position
for arg in "$@"; do
    if [ "$arg" = "--dual" ]; then
        DUAL_MODE=true
    fi
done

# Remove --dual from args for command parsing
ARGS=()
for arg in "$@"; do
    if [ "$arg" != "--dual" ]; then
        ARGS+=("$arg")
    fi
done

case "${ARGS[0]:-help}" in
    standby)
        cmd_standby
        ;;
    launch)
        cmd_launch "${ARGS[1]:-60}"
        ;;
    stop)
        cmd_stop
        ;;
    status)
        cmd_status
        ;;
    logs)
        cmd_logs
        ;;
    deploy)
        cmd_deploy
        ;;
    help|*)
        print_banner
        echo "Usage: ./scripts/demo.sh <command> [options]"
        echo ""
        echo "Commands:"
        echo "  standby              Start AMM workers (2000 accounts)"
        echo "  standby --dual       Start AMM + Transfer workers (1500 + 500)"
        echo "  launch [N]           Trigger N-second demo (default: 60)"
        echo "  launch [N] --dual    Trigger dual demo (AMM + transfers)"
        echo "  stop                 Stop all workers"
        echo "  status               Check worker status"
        echo "  logs                 View worker logs"
        echo "  deploy               Deploy latest code to VMs"
        echo ""
        echo "Demo Workflow (AMM only):"
        echo "  1. ./scripts/demo.sh standby"
        echo "  2. ./scripts/demo.sh launch 60"
        echo ""
        echo "Demo Workflow (Dual - MAX TPS):"
        echo "  1. ./scripts/demo.sh standby --dual"
        echo "  2. ./scripts/demo.sh launch 60 --dual"
        echo ""
        ;;
esac
