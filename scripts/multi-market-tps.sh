#!/bin/bash
#
# MULTI-MARKET TPS DEMO
# =====================
#
# Distributes 10 markets across 3 workers for maximum TPS.
# Each worker gets ~3-4 dedicated markets to reduce aggregator contention.
#
# TPS SCALING THEORY:
# - Single market: ~30K TPS ceiling (aggregator contention at ~53%)
# - 3 markets (1 per worker): ~60K TPS (contention drops to ~35%)
# - 10 markets (round-robin): ~90K TPS (contention drops to ~18%)
#
# Usage:
#   ./scripts/multi-market-tps.sh              # Start with default 300s
#   ./scripts/multi-market-tps.sh 600          # Run for 600 seconds
#   ./scripts/multi-market-tps.sh 300 sharded  # 1 market per worker (safest)
#   ./scripts/multi-market-tps.sh 300 all      # All 10 markets per worker (max TPS)
#

set -e

# Worker VMs
WORKER1="root@178.128.177.88"   # MASTER - UI connects here
WORKER2="root@147.182.237.239"  # Secondary
WORKER3="root@161.35.231.0"     # Secondary

DURATION=${1:-300}
MODE=${2:-sharded}  # sharded (safe) or all (max TPS)

# 10 Demo Markets deployed Jan 10, 2026
MARKET_1="0xc47af6adee557eb824c5a82f800d9ca15a6525417d273d9671451a45106870bb"  # WLFI Charter
MARKET_2="0x3b365cbbc7ea0aa6e18b3dd7d4e2cae6c84fae90d9b5d0c3b1ef8a919ea5a72f"  # Greenland
MARKET_3="0xa4cc4e98d5f9dd23809ad1cf9f3b44501be2ffae47c06f59fa81df0886f01fa0"  # Fed Chair
MARKET_4="0x74bbc4673ebe683d3d0013a1862c369938255071f0b32ac0fb638b476698213a"  # Iran
MARKET_5="0x2163cf2a5e8a58b262111e06f6e97818ff0a11418eaedcb28ba3e10a0fdb2d12"  # Taiwan
MARKET_6="0x9ead4f745267b70bf8f80858876552dff8b3752d67580deb0ef211a441230ebd"  # Ukraine
MARKET_7="0xc0c821e880662d8f4c35d6e88521f489aa61c97fe42662a348fdb4333922f3dc"  # Venezuela
MARKET_8="0x23c79ba59fdffe66abd5243ebf98d9dd13661d86a355cfcb1872eeb58e088278"  # Fed Rate
MARKET_9="0xb297b277d82a364b2f98d2e8fac549d921acd565dfb46c598c09eab2e93e776d"  # BTC Q1
MARKET_10="0xaba7e1a1ca41899757215bac86bd71ca5d8db24d53acf18332421b0424dac8f3" # BTC 150K

# Old presidential market (high liquidity)
MARKET_PRESIDENTIAL="0xfefd1b67818ee4ef12a7953852c83f0efb411a9b92c518a52ba92555e4abdd96"

# All markets comma-separated for round-robin mode
ALL_MARKETS="${MARKET_1},${MARKET_2},${MARKET_3},${MARKET_4},${MARKET_5},${MARKET_6},${MARKET_7},${MARKET_8},${MARKET_9},${MARKET_10}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${NC}  ${BOLD}🚀 MULTI-MARKET TPS DEMO${NC}                                     ${CYAN}║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BOLD}Mode:${NC}     $MODE"
echo -e "  ${BOLD}Duration:${NC} ${DURATION}s"
echo ""

# Determine market assignment based on mode
if [ "$MODE" = "sharded" ]; then
    echo -e "${YELLOW}▶ SHARDED MODE: Each worker gets dedicated markets${NC}"
    echo ""
    # Worker 1: Markets 1-4 (Trump/WLFI themed)
    W1_MARKETS="$MARKET_1,$MARKET_2,$MARKET_3,$MARKET_PRESIDENTIAL"
    W1_DESC="WLFI, Greenland, Fed Chair, Presidential"

    # Worker 2: Markets 4-7 (Geopolitics)
    W2_MARKETS="$MARKET_4,$MARKET_5,$MARKET_6,$MARKET_7"
    W2_DESC="Iran, Taiwan, Ukraine, Venezuela"

    # Worker 3: Markets 8-10 (Crypto/Economic)
    W3_MARKETS="$MARKET_8,$MARKET_9,$MARKET_10"
    W3_DESC="Fed Rate, BTC Q1, BTC 150K"

elif [ "$MODE" = "all" ]; then
    echo -e "${YELLOW}▶ ALL MODE: Every worker trades all 10 markets (max TPS)${NC}"
    echo ""
    W1_MARKETS="$ALL_MARKETS"
    W2_MARKETS="$ALL_MARKETS"
    W3_MARKETS="$ALL_MARKETS"
    W1_DESC="All 10 markets"
    W2_DESC="All 10 markets"
    W3_DESC="All 10 markets"

else
    echo -e "${RED}Unknown mode: $MODE${NC}"
    echo "Use: sharded (default) or all"
    exit 1
fi

echo -e "  ${CYAN}Worker 1:${NC} $W1_DESC"
echo -e "  ${CYAN}Worker 2:${NC} $W2_DESC"
echo -e "  ${CYAN}Worker 3:${NC} $W3_DESC"
echo ""

# Step 1: Kill all existing processes
echo -e "${YELLOW}▶ Stopping all workers...${NC}"
ssh $WORKER1 'pkill -9 -f "hft-ultra" 2>/dev/null; pkill -9 -f "tsx.*server" 2>/dev/null; exit 0' &
ssh $WORKER2 'pkill -9 -f "hft-ultra" 2>/dev/null; pkill -9 -f "tsx.*server" 2>/dev/null; exit 0' &
ssh $WORKER3 'pkill -9 -f "hft-ultra" 2>/dev/null; pkill -9 -f "tsx.*server" 2>/dev/null; exit 0' &
wait
sleep 2
echo -e "${GREEN}✓${NC} All workers stopped"
echo ""

# Step 2: Create run scripts with market assignments
echo -e "${YELLOW}▶ Configuring workers with market assignments...${NC}"

# Worker 1 - with MULTI_MARKETS env
ssh $WORKER1 << EOF
cat > /opt/aptos-hft/run-multi-market.sh << 'SCRIPT'
#!/bin/bash
export MULTI_MARKETS="$W1_MARKETS"
cd /opt/aptos-hft
npx tsx hft-ultra-server.ts quantum $DURATION
SCRIPT
chmod +x /opt/aptos-hft/run-multi-market.sh
EOF
echo -e "${GREEN}✓${NC} Worker 1 configured"

# Worker 2
ssh $WORKER2 << EOF
cat > /opt/aptos-hft/run-multi-market.sh << 'SCRIPT'
#!/bin/bash
export MULTI_MARKETS="$W2_MARKETS"
cd /opt/aptos-hft
npx tsx hft-ultra-server.ts quantum $DURATION
SCRIPT
chmod +x /opt/aptos-hft/run-multi-market.sh
EOF
echo -e "${GREEN}✓${NC} Worker 2 configured"

# Worker 3
ssh $WORKER3 << EOF
cat > /opt/aptos-hft/run-multi-market.sh << 'SCRIPT'
#!/bin/bash
export MULTI_MARKETS="$W3_MARKETS"
cd /opt/aptos-hft
npx tsx hft-ultra-server.ts quantum $DURATION
SCRIPT
chmod +x /opt/aptos-hft/run-multi-market.sh
EOF
echo -e "${GREEN}✓${NC} Worker 3 configured"
echo ""

# Step 3: Start all workers
echo -e "${YELLOW}▶ Starting all workers...${NC}"
ssh $WORKER1 'cd /opt/aptos-hft && nohup bash run-multi-market.sh > /tmp/hft.log 2>&1 &' &
ssh $WORKER2 'cd /opt/aptos-hft && nohup bash run-multi-market.sh > /tmp/hft.log 2>&1 &' &
ssh $WORKER3 'cd /opt/aptos-hft && nohup bash run-multi-market.sh > /tmp/hft.log 2>&1 &' &
wait
echo -e "${GREEN}✓${NC} All workers started"
echo ""

# Step 4: Wait for startup
echo -e "${YELLOW}▶ Waiting 15s for workers to initialize...${NC}"
sleep 15
echo ""

# Step 5: Show status
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║${NC}  ${BOLD}✓ MULTI-MARKET TPS DEMO ACTIVE${NC}                               ${GREEN}║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BOLD}Workers running:${NC}"
echo -e "  Worker 1 (${CYAN}178.128.177.88${NC}): $W1_DESC"
echo -e "  Worker 2 (${CYAN}147.182.237.239${NC}): $W2_DESC"
echo -e "  Worker 3 (${CYAN}161.35.231.0${NC}): $W3_DESC"
echo ""
echo -e "${BOLD}Expected TPS:${NC}"
if [ "$MODE" = "sharded" ]; then
    echo -e "  Single market baseline: ~30K TPS"
    echo -e "  With 11 markets sharded: ${GREEN}~60-80K TPS${NC}"
else
    echo -e "  Single market baseline: ~30K TPS"
    echo -e "  With 10 markets round-robin: ${GREEN}~80-100K TPS${NC}"
fi
echo ""
echo -e "${BOLD}Monitor:${NC}"
echo -e "  ${CYAN}./scripts/monitor-tps.sh${NC}          # Basic stats"
echo -e "  ${CYAN}./scripts/multi-market-monitor.sh${NC} # Per-market breakdown"
echo ""
echo -e "${BOLD}Stop:${NC}"
echo -e "  ${CYAN}./scripts/demo-stop-all.sh${NC}"
echo ""
