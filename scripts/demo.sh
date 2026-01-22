#!/bin/bash
#
# APTOS POLYMARKET - DEMO ORCHESTRATOR
# =====================================
# Simplified demo script for 2000-account high TPS demos
#
# Usage:
#   ./scripts/demo.sh standby     # Start all workers in standby mode
#   ./scripts/demo.sh launch N    # Trigger N-second demo
#   ./scripts/demo.sh stop        # Stop all workers
#   ./scripts/demo.sh status      # Check all workers
#   ./scripts/demo.sh logs        # View worker logs
#   ./scripts/demo.sh deploy      # Deploy latest code to VMs
#

set -e

# ============================================
# CONFIGURATION
# ============================================

# Cloud Worker VMs
WORKER1_IP="178.128.177.88"
WORKER2_IP="147.182.237.239"
WORKER3_IP="161.35.231.0"
WORKER_USER="root"

# Account Distribution (2000 total)
# Each worker gets ~667 accounts to avoid nonce conflicts
WORKER1_START=0
WORKER1_COUNT=667
WORKER2_START=667
WORKER2_COUNT=667
WORKER3_START=1334
WORKER3_COUNT=666

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
    curl -s --connect-timeout 3 "http://${ip}:3001/health" 2>/dev/null | grep -q "ok"
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
    print_header "STARTING WORKERS IN STANDBY MODE"

    # Get seed mnemonic
    if ! get_seed_mnemonic; then
        exit 1
    fi

    echo "Configuration:"
    echo "  - Accounts: 2000 total (split across 3 workers)"
    echo "  - Mode: ${DEFAULT_MODE}"
    echo "  - USE_ORDERLESS: false (avoids ~50% nonce failures)"
    echo "  - RPC: Internal VFN"
    echo ""

    # Stop any existing workers
    echo "[1/4] Stopping existing workers..."
    for i in 1 2 3; do
        eval "IP=\${WORKER${i}_IP}"
        ssh ${WORKER_USER}@${IP} "pkill -f hft-piscina-server 2>/dev/null; screen -S hft -X quit 2>/dev/null" 2>/dev/null || true
    done
    sleep 1
    echo -e "  ${GREEN}Done${NC}"

    # Start workers with account ranges
    echo ""
    for i in 1 2 3; do
        eval "IP=\${WORKER${i}_IP}"
        eval "START=\${WORKER${i}_START}"
        eval "COUNT=\${WORKER${i}_COUNT}"

        echo "[$(($i+1))/4] Starting Worker $i ($IP) - accounts $START to $((START + COUNT - 1))..."

        ssh ${WORKER_USER}@${IP} "
            export SEED_MNEMONIC='${SEED_MNEMONIC}'
            export ACCOUNT_START_INDEX=${START}
            export ACCOUNT_COUNT=${COUNT}
            export USE_ORDERLESS=false
            export RPC_MODE=internal
            export CONTRACT_ADDRESS='${CONTRACT_ADDRESS}'
            export USD1_METADATA='${USD1_METADATA}'
            export MULTI_MARKETS='${MULTI_MARKETS}'
            export PORT=3001
            cd /opt/aptos-hft
            screen -dmS hft bash -c 'npx tsx server/hft-piscina-server.ts ${DEFAULT_MODE} > /tmp/hft-worker.log 2>&1'
        " 2>/dev/null

        echo -e "  ${GREEN}Started${NC}"
    done

    # Wait for servers to be ready
    echo ""
    echo "Waiting for servers to initialize..."
    sleep 5

    # Verify
    echo ""
    echo "Verifying workers..."
    ALL_READY=true
    for i in 1 2 3; do
        eval "IP=\${WORKER${i}_IP}"
        echo -n "  Worker $i ($IP): "

        if check_server $IP; then
            STATUS=$(curl -s "http://${IP}:3001/status" 2>/dev/null)
            ACCOUNTS=$(echo "$STATUS" | grep -o '"total":[0-9]*' | head -1 | grep -o '[0-9]*' || echo "0")
            echo -e "${GREEN}READY${NC} ($ACCOUNTS accounts)"
        else
            echo -e "${RED}NOT READY${NC}"
            ALL_READY=false
        fi
    done

    echo ""
    if [ "$ALL_READY" = true ]; then
        echo -e "${GREEN}╔══════════════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${GREEN}║                    ALL WORKERS READY - STANDBY MODE                   ║${NC}"
        echo -e "${GREEN}╚══════════════════════════════════════════════════════════════════════╝${NC}"
        echo ""
        echo "Next steps:"
        echo "  1. Open browser: http://localhost:5173/demo-day"
        echo "  2. Verify ARM button shows all green"
        echo "  3. Start live feed: npx tsx scripts/live-feed.ts"
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
    print_header "LAUNCHING DEMO - ${DURATION} SECONDS"

    echo "Triggering all workers..."
    echo ""

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

    echo ""
    echo -e "${CYAN}══════════════════════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}                         DEMO RUNNING${NC}"
    echo -e "${CYAN}══════════════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo "Duration: ${DURATION} seconds"
    echo ""
    echo "Watch progress:"
    echo "  - Live feed: npx tsx scripts/live-feed.ts"
    echo "  - Browser: http://localhost:5173/demo-day"
    echo "  - Stats: https://aptos-consensus-visualizer.vercel.app/polymarket-demo"
    echo ""

    # Monitor loop
    for ((t=5; t<=${DURATION}; t+=5)); do
        sleep 5

        TOTAL_TPS=0
        TOTAL_TRADES=0

        for i in 1 2 3; do
            eval "IP=\${WORKER${i}_IP}"
            STATUS=$(curl -s "http://${IP}:3001/stats" 2>/dev/null)
            TPS=$(echo "$STATUS" | grep -o '"currentTps":[0-9]*' | grep -o '[0-9]*' || echo "0")
            TRADES=$(echo "$STATUS" | grep -o '"totalTrades":[0-9]*' | grep -o '[0-9]*' || echo "0")
            TOTAL_TPS=$((TOTAL_TPS + TPS))
            TOTAL_TRADES=$((TOTAL_TRADES + TRADES))
        done

        printf "[%3ds] TPS: %5d | Total Trades: %d\n" "$t" "$TOTAL_TPS" "$TOTAL_TRADES"
    done

    echo ""
    print_header "DEMO COMPLETE"

    # Final stats
    echo "Final Results:"
    for i in 1 2 3; do
        eval "IP=\${WORKER${i}_IP}"
        STATUS=$(curl -s "http://${IP}:3001/stats" 2>/dev/null)
        TRADES=$(echo "$STATUS" | grep -o '"totalTrades":[0-9]*' | grep -o '[0-9]*' || echo "0")
        SUCCESS=$(echo "$STATUS" | grep -o '"successfulTrades":[0-9]*' | grep -o '[0-9]*' || echo "0")
        PEAK=$(echo "$STATUS" | grep -o '"peakTps":[0-9]*' | grep -o '[0-9]*' || echo "0")
        echo "  Worker $i: $TRADES trades | $SUCCESS successful | Peak: $PEAK TPS"
    done
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

        # Stop via API first
        curl -s -X POST "http://${IP}:3001/stop" 2>/dev/null || true

        # Then kill process
        ssh ${WORKER_USER}@${IP} "pkill -f hft-piscina-server 2>/dev/null; screen -S hft -X quit 2>/dev/null" 2>/dev/null || true

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
        echo "=== Worker $i ($IP) ==="
        ssh ${WORKER_USER}@${IP} "tail -30 /tmp/hft-worker.log 2>/dev/null" || echo "No logs"
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

case "${1:-help}" in
    standby)
        cmd_standby
        ;;
    launch)
        cmd_launch "${2:-60}"
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
        echo "  standby       Start all workers in standby mode (2000 accounts)"
        echo "  launch [N]    Trigger N-second demo (default: 60)"
        echo "  stop          Stop all workers"
        echo "  status        Check worker status"
        echo "  logs          View worker logs"
        echo "  deploy        Deploy latest code to VMs"
        echo ""
        echo "Demo Workflow:"
        echo "  1. ./scripts/demo.sh standby     # Start workers"
        echo "  2. npm run dev                   # Start frontend"
        echo "  3. npx tsx scripts/live-feed.ts # Start live feed"
        echo "  4. ./scripts/demo.sh launch 60  # Run 60s demo"
        echo ""
        ;;
esac
