#!/bin/bash
#
# APTOS POLYMARKET - DEMO ORCHESTRATOR
# =====================================
# Simplified demo script for 5000-account high TPS demos
#
# Usage:
#   ./scripts/demo.sh preflight         # Pre-flight validation
#   ./scripts/demo.sh preflight --dual  # Pre-flight with transfer checks
#   ./scripts/demo.sh standby           # AMM only (5000 accounts)
#   ./scripts/demo.sh standby --dual    # AMM + USD1 transfers (4000 + 1000)
#   ./scripts/demo.sh launch N          # Trigger N-second demo
#   ./scripts/demo.sh stop              # Stop all workers
#   ./scripts/demo.sh status            # Check all workers
#   ./scripts/demo.sh logs              # View worker logs
#   ./scripts/demo.sh collect           # Collect results from workers
#   ./scripts/demo.sh analyze           # Run post-run analysis
#   ./scripts/demo.sh deploy            # Deploy latest code to VMs
#

set -e

# Dual mode flag (set by --dual argument)
DUAL_MODE=false

# ============================================
# CONFIGURATION
# ============================================

# Cloud Worker VMs (all in SFO2 region)
WORKER1_IP="178.128.177.88"
WORKER2_IP="167.99.164.45"
WORKER3_IP="138.68.0.124"
WORKER_USER="root"

# Account Distribution - AMM Only (5000 total)
# Each worker gets ~1667 accounts to avoid nonce conflicts
WORKER1_AMM_START=0
WORKER1_AMM_COUNT=1667
WORKER2_AMM_START=1667
WORKER2_AMM_COUNT=1667
WORKER3_AMM_START=3334
WORKER3_AMM_COUNT=1666

# Account Distribution - Dual Mode (AMM 4000 + Transfers 1000)
# AMM: accounts 0-3999 (~1333 per worker)
# Transfers: accounts 4000-4999 (~333 per worker)
WORKER1_AMM_DUAL_START=0
WORKER1_AMM_DUAL_COUNT=1333
WORKER2_AMM_DUAL_START=1333
WORKER2_AMM_DUAL_COUNT=1334
WORKER3_AMM_DUAL_START=2667
WORKER3_AMM_DUAL_COUNT=1333

WORKER1_TRANSFER_START=4000
WORKER1_TRANSFER_COUNT=333
WORKER2_TRANSFER_START=4333
WORKER2_TRANSFER_COUNT=334
WORKER3_TRANSFER_START=4667
WORKER3_TRANSFER_COUNT=333

# Contract Configuration (AMM-fixed contract, Jan 14 2026)
# SYNCED WITH .env.local and .env.seed - DO NOT EDIT MANUALLY
CONTRACT_ADDRESS="0xca4d40eae9f07fb28a121862d649203fb4335ece9536ee51790e19f812ff7aea"
USD1_METADATA="0x14b1ec8a5f31554d0cd19c390be83444ed519be2d7108c3e27dcbc4230c01fa3"

# 15 Polymarket-style markets on AMM-fixed contract
# 1. WLFI Banking Charter     2. Trump Greenland        3. Fed Chair Nomination
# 4. Khamenei Iran            5. China Taiwan           6. Russia-Ukraine (short addr)
# 7. Venezuela                8. Fed Rate Jan 2026      9. Bitcoin Q1 2026
# 10. Bitcoin $150K           11. BTC $100K Test        12. Insurrection Act 2026
# 13. Midterm Elections 2026  14. Trump Third Term      15. Republican 2028 Nominee
MULTI_MARKETS="0xaf561030c7ebb22b1d8b99b727c27caab1f6944ce39c141fd2b6b0cfbf614a9e,0xa4ee321c4c642e7b5a3e27b9820f2be4c17a1add79f8129122289fca2c3ca7c3,0xf85c7010d966bc6c3417e52a9b4d86b5f36117e51b43bf5c7a92f0468bac5497,0xcbdddcf6206d2b5956b6c7c6a10d4ac1d6253a2c1c151e8b3af113d8e940f01f,0xe128c8f16a0f07f48c69a38ac75868a2d5fdd9fbf3299958e9b1e2994a0b9f57,0x00f60c218d500eb76c66a4a7fb6c6e5664847d5e9496016000fc953b5a89f6eb,0x287968f6d26efbd291960455ce14e3723a48d32b3dc0a8c545d4603fe842e30f,0xa594c8df003cd232043b34beefe020af744f378ec367a7f65b89e306e06baacb,0x310ccec449c57bf8972feab19c5cb8ba5004e2934e4fa1bd565fdbd1a44f4008,0x8172b2cf4ba365d72fca8b899a54d3c9e2539d63bd2283aca55c0d032fc793f6,0xa550234b5784656e3f3d060134e36ab9a0eecc436d182452955c995984b3e67a,0x9dc3b78821f64119671d7918b824b3b3c4b0e2124643ebe6b1e587efe9591202,0xf508498afdecb2a2f6b40912efb1611b9fe9725e9c35521be5ff2bba3c187efa,0x289aabd338cf7a2bc48512927775b5e1218b15bd83c3c740c3ec43faccef5b21,0x8c4f0da1238adb4486d2a62ff08c85af331e022c1446445059059918d4361cd3"

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
    echo "║                    5000 Accounts | 3 Workers                          ║"
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
        echo "  - AMM Accounts: 4000 (~1333 per worker)"
        echo "  - Transfer Accounts: 1000 (~333 per worker)"
        echo "  - Total: 5000 accounts"
    else
        print_header "STARTING WORKERS IN STANDBY MODE (AMM ONLY)"
        echo "Configuration:"
        echo "  - Accounts: 5000 total (split across 3 workers)"
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
            export RPC_MODE=custom
            export FULLNODE_URL='http://aptos.cash.trading:8080/v1'
            export CONTRACT_ADDRESS='${CONTRACT_ADDRESS}'
            export USD1_METADATA='${USD1_METADATA}'
            export MULTI_MARKETS='${MULTI_MARKETS}'
            export PORT=3001
            cd /opt/aptos-hft
            screen -dmS hft bash -c 'npx tsx server/hft-piscina-server.ts ${DEFAULT_MODE} > /tmp/hft-amm.log 2>&1'
        " 2>/dev/null

        echo -e "  ${GREEN}Started on port 3001${NC}"
    done

    # Note: Transfer workers are started by 'launch --dual' command, not standby
    # (Transfer server doesn't have HTTP standby mode - it runs for a duration)
    if [ "$DUAL_MODE" = true ]; then
        echo ""
        echo -e "${YELLOW}Note:${NC} Transfer servers will be started when you run 'launch --dual'"
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

    echo ""
    ALL_READY=$AMM_READY

    if [ "$ALL_READY" = true ]; then
        if [ "$DUAL_MODE" = true ]; then
            echo -e "${GREEN}╔══════════════════════════════════════════════════════════════════════╗${NC}"
            echo -e "${GREEN}║              AMM WORKERS READY - DUAL MODE                            ║${NC}"
            echo -e "${GREEN}╠══════════════════════════════════════════════════════════════════════╣${NC}"
            echo -e "${GREEN}║  AMM:       $TOTAL_AMM_ACCOUNTS accounts ready (port 3001)                         ║${NC}"
            echo -e "${GREEN}║  Transfers: Will start with 'launch --dual' command                  ║${NC}"
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

    # Get seed mnemonic for transfer servers
    if [ "$DUAL_MODE" = true ]; then
        if ! get_seed_mnemonic; then
            exit 1
        fi
    fi

    # Start AMM servers (via HTTP API)
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

    # Start Transfer servers (dual mode only - via SSH, no HTTP API)
    if [ "$DUAL_MODE" = true ]; then
        echo ""
        echo "Transfer Servers (starting via SSH):"
        for i in 1 2 3; do
            eval "IP=\${WORKER${i}_IP}"
            eval "TRANSFER_START=\${WORKER${i}_TRANSFER_START}"
            eval "TRANSFER_COUNT=\${WORKER${i}_TRANSFER_COUNT}"
            echo -n "  Worker $i ($IP): "

            # Start transfer server via SSH (it runs for DURATION and exits)
            ssh ${WORKER_USER}@${IP} "
                export SEED_MNEMONIC='${SEED_MNEMONIC}'
                export ACCOUNT_START_INDEX=${TRANSFER_START}
                export ACCOUNT_COUNT=${TRANSFER_COUNT}
                export USE_ORDERLESS=false
                export RPC_MODE=internal
                export USD1_METADATA='${USD1_METADATA}'
                export DURATION=${DURATION}
                cd /opt/aptos-hft
                nohup npx tsx server/transfer-tps-server.ts turbo > /tmp/hft-transfer.log 2>&1 &
            " 2>/dev/null

            echo -e "${GREEN}STARTED${NC} (accounts ${TRANSFER_START}-$((TRANSFER_START + TRANSFER_COUNT - 1)))"
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

        for i in 1 2 3; do
            eval "IP=\${WORKER${i}_IP}"

            # AMM stats (via HTTP API)
            STATUS=$(curl -s "http://${IP}:3001/stats" 2>/dev/null)
            TPS=$(echo "$STATUS" | grep -o '"currentTps":[0-9]*' | grep -o '[0-9]*' || echo "0")
            TRADES=$(echo "$STATUS" | grep -o '"totalTrades":[0-9]*' | grep -o '[0-9]*' || echo "0")
            AMM_TPS=$((AMM_TPS + TPS))
            AMM_TRADES=$((AMM_TRADES + TRADES))
        done

        if [ "$DUAL_MODE" = true ]; then
            # Transfer servers don't have HTTP stats - running in background
            printf "[%3ds] ${GREEN}AMM: %5d TPS${NC} | ${CYAN}Transfers: running${NC} | AMM Trades: %d\n" "$t" "$AMM_TPS" "$AMM_TRADES"
        else
            printf "[%3ds] TPS: %5d | Total Trades: %d\n" "$t" "$AMM_TPS" "$AMM_TRADES"
        fi
    done

    echo ""
    print_header "DEMO COMPLETE"

    # Final stats
    echo "Final Results:"
    echo ""
    echo "AMM Trading:"
    TOTAL_AMM_TRADES=0
    TOTAL_AMM_SUCCESS=0
    TOTAL_AMM_PEAK=0
    for i in 1 2 3; do
        eval "IP=\${WORKER${i}_IP}"
        STATUS=$(curl -s "http://${IP}:3001/stats" 2>/dev/null)
        TRADES=$(echo "$STATUS" | grep -o '"totalTrades":[0-9]*' | grep -o '[0-9]*' || echo "0")
        SUCCESS=$(echo "$STATUS" | grep -o '"successfulTrades":[0-9]*' | grep -o '[0-9]*' || echo "0")
        PEAK=$(echo "$STATUS" | grep -o '"peakTps":[0-9]*' | grep -o '[0-9]*' || echo "0")
        TOTAL_AMM_TRADES=$((TOTAL_AMM_TRADES + TRADES))
        TOTAL_AMM_SUCCESS=$((TOTAL_AMM_SUCCESS + SUCCESS))
        if [ "$PEAK" -gt "$TOTAL_AMM_PEAK" ]; then
            TOTAL_AMM_PEAK=$PEAK
        fi
        echo "  Worker $i: $TRADES trades | $SUCCESS successful | Peak: $PEAK TPS"
    done
    echo "  ────────────────────────────────────────────"
    echo -e "  ${BOLD}Total: $TOTAL_AMM_TRADES trades | $TOTAL_AMM_SUCCESS successful | Peak: $TOTAL_AMM_PEAK TPS${NC}"

    if [ "$DUAL_MODE" = true ]; then
        echo ""
        echo "USD1 Transfers:"
        echo "  (Stats available via logs - run './scripts/demo.sh logs')"
        echo "  Transfer servers wrote results to /tmp/hft-transfer.log on each worker"
    fi

    echo ""
    echo "Next steps:"
    echo "  1. Collect transaction hashes: ./scripts/demo.sh collect"
    echo "  2. Verify on-chain TPS: npx tsx scripts/analyze-tps.ts --minutes 5"
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
# COLLECT COMMAND - Gather results from all workers
# ============================================

cmd_collect() {
    print_header "COLLECTING RESULTS FROM ALL WORKERS"

    TIMESTAMP=$(date +%Y%m%d-%H%M%S)
    OUTPUT_DIR="results/${TIMESTAMP}"
    mkdir -p "$OUTPUT_DIR"

    echo "Output directory: $OUTPUT_DIR"
    echo ""

    # Collect AMM results
    echo "Collecting AMM transaction hashes..."
    for i in 1 2 3; do
        eval "IP=\${WORKER${i}_IP}"
        echo -n "  Worker $i ($IP): "

        scp -o ConnectTimeout=5 ${WORKER_USER}@${IP}:/tmp/hft-submitted-txns.json "${OUTPUT_DIR}/amm-worker${i}.json" 2>/dev/null
        if [ -f "${OUTPUT_DIR}/amm-worker${i}.json" ]; then
            COUNT=$(grep -o '"hash"' "${OUTPUT_DIR}/amm-worker${i}.json" 2>/dev/null | wc -l | tr -d ' ')
            echo -e "${GREEN}Downloaded${NC} ($COUNT hashes)"
        else
            echo -e "${YELLOW}No file${NC}"
        fi
    done

    # Collect Transfer results
    echo ""
    echo "Collecting Transfer transaction hashes..."
    for i in 1 2 3; do
        eval "IP=\${WORKER${i}_IP}"
        echo -n "  Worker $i ($IP): "

        scp -o ConnectTimeout=5 ${WORKER_USER}@${IP}:/tmp/transfer-submitted-txns.json "${OUTPUT_DIR}/transfer-worker${i}.json" 2>/dev/null
        if [ -f "${OUTPUT_DIR}/transfer-worker${i}.json" ]; then
            COUNT=$(grep -o '"hash"' "${OUTPUT_DIR}/transfer-worker${i}.json" 2>/dev/null | wc -l | tr -d ' ')
            echo -e "${GREEN}Downloaded${NC} ($COUNT hashes)"
        else
            echo -e "${YELLOW}No file${NC}"
        fi
    done

    # Merge all results
    echo ""
    echo "Merging results..."

    # Create merged AMM file
    AMM_TOTAL=0
    echo '{"transactions":[' > "${OUTPUT_DIR}/all-amm.json"
    FIRST=true
    for f in "${OUTPUT_DIR}"/amm-worker*.json; do
        if [ -f "$f" ]; then
            TXNS=$(cat "$f" | grep -o '"transactions":\[.*\]' | sed 's/"transactions":\[//' | sed 's/\]$//' || echo "")
            if [ -n "$TXNS" ] && [ "$TXNS" != "null" ]; then
                if [ "$FIRST" = true ]; then
                    FIRST=false
                else
                    echo "," >> "${OUTPUT_DIR}/all-amm.json"
                fi
                echo "$TXNS" >> "${OUTPUT_DIR}/all-amm.json"
            fi
        fi
    done
    echo ']}' >> "${OUTPUT_DIR}/all-amm.json"

    # Create merged Transfer file
    echo '{"transactions":[' > "${OUTPUT_DIR}/all-transfers.json"
    FIRST=true
    for f in "${OUTPUT_DIR}"/transfer-worker*.json; do
        if [ -f "$f" ]; then
            TXNS=$(cat "$f" | grep -o '"transactions":\[.*\]' | sed 's/"transactions":\[//' | sed 's/\]$//' || echo "")
            if [ -n "$TXNS" ] && [ "$TXNS" != "null" ]; then
                if [ "$FIRST" = true ]; then
                    FIRST=false
                else
                    echo "," >> "${OUTPUT_DIR}/all-transfers.json"
                fi
                echo "$TXNS" >> "${OUTPUT_DIR}/all-transfers.json"
            fi
        fi
    done
    echo ']}' >> "${OUTPUT_DIR}/all-transfers.json"

    echo -e "  ${GREEN}Done${NC}"

    # Summary
    echo ""
    echo -e "${CYAN}════════════════════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}                     RESULTS COLLECTED${NC}"
    echo -e "${CYAN}════════════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo "Files saved to: $OUTPUT_DIR/"
    ls -la "$OUTPUT_DIR/"
    echo ""
    echo "Run analytics:"
    echo "  1. On-chain TPS (recommended):"
    echo "     npx tsx scripts/analyze-tps.ts --minutes 5"
    echo ""
    echo "  2. Hash-based analysis:"
    echo "     npx tsx scripts/analyze-submitted-txns.ts ${OUTPUT_DIR}/all-amm.json"
    echo ""
}

# ============================================
# PREFLIGHT COMMAND
# ============================================

cmd_preflight() {
    print_header "PRE-FLIGHT CHECK FOR 5000 ACCOUNTS"

    if ! get_seed_mnemonic; then
        exit 1
    fi

    local PREFLIGHT_ARGS=""
    if [ "$DUAL_MODE" = true ]; then
        PREFLIGHT_ARGS="--dual"
    fi

    echo "Running comprehensive pre-flight validation..."
    echo ""

    SEED_MNEMONIC="${SEED_MNEMONIC}" \
    ACCOUNT_COUNT=5000 \
    AMM_ACCOUNTS=4000 \
    FULLNODE_URL="${INTERNAL_VFN}" \
    CONTRACT_ADDRESS="${CONTRACT_ADDRESS}" \
    MULTI_MARKETS="${MULTI_MARKETS}" \
    npx tsx scripts/pre-flight-2000.ts $PREFLIGHT_ARGS

    local EXIT_CODE=$?
    if [ $EXIT_CODE -eq 0 ]; then
        echo -e "${GREEN}Pre-flight check passed!${NC}"
    else
        echo -e "${RED}Pre-flight check failed. Fix issues before demo.${NC}"
    fi

    return $EXIT_CODE
}

# ============================================
# ANALYZE COMMAND
# ============================================

cmd_analyze() {
    print_header "POST-RUN ANALYSIS"

    local TARGET="${1:-}"
    local ANALYZE_ARGS=""

    if [ -n "$TARGET" ]; then
        if [ -f "$TARGET" ]; then
            ANALYZE_ARGS="$TARGET"
        elif [ -d "$TARGET" ]; then
            # If it's a directory, look for all-amm.json
            if [ -f "$TARGET/all-amm.json" ]; then
                ANALYZE_ARGS="$TARGET/all-amm.json"
            fi
        fi
    fi

    echo "Running unified post-run analysis..."
    echo ""

    npx tsx scripts/auto-analyze.ts $ANALYZE_ARGS

    local EXIT_CODE=$?
    if [ $EXIT_CODE -eq 0 ]; then
        echo -e "${GREEN}Analysis complete!${NC}"
    else
        echo -e "${YELLOW}Analysis completed with warnings${NC}"
    fi
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
# FULL COMMAND - One command to rule them all
# ============================================

cmd_full() {
    DURATION=${1:-60}

    print_banner
    echo -e "${CYAN}╔══════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║                    FULL AUTOMATED DEMO                                ║${NC}"
    echo -e "${CYAN}║              Preflight → Standby → Launch → Analyze                   ║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "Duration: ${DURATION} seconds"
    echo "Mode: ${DUAL_MODE:+Dual (AMM + Transfers)}${DUAL_MODE:-AMM Only}"
    echo ""

    # Step 1: Preflight
    echo -e "${BOLD}[Step 1/5] Running pre-flight check...${NC}"
    echo "────────────────────────────────────────────────────────────────"
    if ! cmd_preflight; then
        echo -e "${RED}Pre-flight failed. Aborting.${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Pre-flight passed${NC}"
    echo ""

    # Step 2: Start workers
    echo -e "${BOLD}[Step 2/5] Starting workers in standby...${NC}"
    echo "────────────────────────────────────────────────────────────────"
    cmd_standby
    echo ""

    # Step 3: Wait for workers to be ready
    echo -e "${BOLD}[Step 3/5] Verifying all workers ready...${NC}"
    echo "────────────────────────────────────────────────────────────────"
    sleep 3
    READY_COUNT=0
    for i in 1 2 3; do
        eval "IP=\${WORKER${i}_IP}"
        if check_server $IP 3001; then
            READY_COUNT=$((READY_COUNT + 1))
        fi
    done

    if [ "$READY_COUNT" -lt 3 ]; then
        echo -e "${RED}Only $READY_COUNT/3 workers ready. Aborting.${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ All 3 workers ready${NC}"
    echo ""

    # Step 4: Countdown and launch
    echo -e "${BOLD}[Step 4/5] Launching demo in 5 seconds...${NC}"
    echo "────────────────────────────────────────────────────────────────"
    for i in 5 4 3 2 1; do
        echo -n "$i... "
        sleep 1
    done
    echo "GO!"
    echo ""

    cmd_launch "$DURATION"
    echo ""

    # Step 5: Collect and analyze
    echo -e "${BOLD}[Step 5/5] Collecting results and analyzing...${NC}"
    echo "────────────────────────────────────────────────────────────────"
    cmd_collect
    echo ""
    cmd_analyze
    echo ""

    # Final summary
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                      DEMO COMPLETE                                    ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "Results saved to: results/"
    echo ""
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
    full)
        cmd_full "${ARGS[1]:-60}"
        ;;
    preflight)
        cmd_preflight
        ;;
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
    collect)
        cmd_collect
        ;;
    analyze)
        cmd_analyze "${ARGS[1]:-}"
        ;;
    deploy)
        cmd_deploy
        ;;
    help|*)
        print_banner
        echo "Usage: ./scripts/demo.sh <command> [options]"
        echo ""
        echo -e "${GREEN}ONE COMMAND TO RUN EVERYTHING:${NC}"
        echo "  ./scripts/demo.sh full 60 --dual"
        echo ""
        echo "This runs: preflight → standby → launch → collect → analyze"
        echo ""
        echo "Commands:"
        echo "  full [N]             Run full demo (N seconds) - does everything automatically"
        echo "  full [N] --dual      Full demo with AMM + transfers"
        echo "  preflight            Pre-flight check (validates all 5000 accounts)"
        echo "  standby              Start workers via SSH (handles everything)"
        echo "  launch [N]           Trigger N-second demo (default: 60)"
        echo "  stop                 Stop all workers"
        echo "  status               Check worker status"
        echo "  logs                 View worker logs"
        echo "  collect              Collect results from all workers"
        echo "  analyze [path]       Run unified post-run analysis"
        echo "  deploy               Deploy latest code to VMs"
        echo ""
        echo "Examples:"
        echo "  ./scripts/demo.sh full 60 --dual   # Full 60s demo with transfers"
        echo "  ./scripts/demo.sh full 30          # Quick 30s AMM-only demo"
        echo ""
        ;;
esac
