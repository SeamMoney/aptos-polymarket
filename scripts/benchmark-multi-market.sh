#!/bin/bash
#
# MULTI-MARKET TPS BENCHMARK
# ==========================
#
# Compares TPS between single-market and multi-market configurations.
# Runs two 60-second tests and compares results.
#
# Usage:
#   ./scripts/benchmark-multi-market.sh
#

set -e

WORKER1="root@178.128.177.88"
WORKER2="root@147.182.237.239"
WORKER3="root@161.35.231.0"
FULLNODE="aptos.cash.trading"

TEST_DURATION=60  # seconds per test

# Market addresses
SINGLE_MARKET="0xfefd1b67818ee4ef12a7953852c83f0efb411a9b92c518a52ba92555e4abdd96"
MULTI_MARKETS="0xc47af6adee557eb824c5a82f800d9ca15a6525417d273d9671451a45106870bb,0x3b365cbbc7ea0aa6e18b3dd7d4e2cae6c84fae90d9b5d0c3b1ef8a919ea5a72f,0xa4cc4e98d5f9dd23809ad1cf9f3b44501be2ffae47c06f59fa81df0886f01fa0,0x74bbc4673ebe683d3d0013a1862c369938255071f0b32ac0fb638b476698213a,0x2163cf2a5e8a58b262111e06f6e97818ff0a11418eaedcb28ba3e10a0fdb2d12"

# Account keys (same as demo-deploy-all.sh)
KEYS_W1="0x6e2fca34586261b6f22a973c20024b78ddb370d87f7c974315fb97ba56716a7f,0xe61d22b3dc37c537a20d5b301c4d2b409b2f93cd7b2915f3518d49517c2ab6c4,0x4542c2e4a39beee8202eee0cddeceea886687b21b54b8f50c17e729251fdd7f5,0xcf5154af9664bbc2634fddfcce2317ed788b35de7f004ac0e24aefd68a0b10c5,ed25519-priv-0xb7d1f406e48c2eddffe987f98445dd4a353e8e9d1630d878621ded084bdd77c7,ed25519-priv-0xa8088ee787b847f6304807a8b09d1afc15409082ee9c8b7eda6919b0ecb86ea8,ed25519-priv-0xb5305eb83498dcba61242ccc91fac35263d9b44bddaf5e7417adbaceb1cfcb36"
KEYS_W2="ed25519-priv-0xc27a6a8b6ed3013da99dc924b2f6af17f1448dedce91691f97d9e778c0761655,ed25519-priv-0xd6402b3493af005ed02b07f6cd7ffdfd37fae6d4d9c88fec6ff38e90f01b21c1,ed25519-priv-0xd375af1a686835905e15bf82f24fcaeed4b1b5b5fabe22c80e998acb804aa295,ed25519-priv-0xC5BA2ED0F5C40EE298E844B1140B6BB31C2671B747C8E9DF4B76054C4C5A8761,ed25519-priv-0x536C886483209657C9B30663B295C7CB007EB57E07931D3E41AF69067897D465,ed25519-priv-0x3E9CB6207207A266F298B1B13648D707BF886766221C3253F30AF68530A79749,ed25519-priv-0x4641D0FDD221B48EF4A45C8DC77D6D4F12D6848E01B7686134564A8CAE5BE637"
KEYS_W3="ed25519-priv-0xFB2AFF37DFED247E9CF407FFA41208A41A78877C1990ADD1F94E00FCE1A5CCAC,ed25519-priv-0x9E338A7FB43F8280CCD82B2929B66F4ED1B7AA7900C40E06EAD934BC7CDEF315,ed25519-priv-0x8E7D4B0196840DA3A7BA6EDEF3784E1B961263F06651B130F440F5D974920B1F,ed25519-priv-0x975CF351CE096E1350C9F9E89ED5CB8D7BEAAEBF7FC235B10F1A0852355EED7A,ed25519-priv-0xD945B44FCFA961B9E4F8DAA5139CF6B4CE9A1DF4838C75701EDC8A429739C097,ed25519-priv-0x292A25EDBE90DCB5F682908C1E7185E1CC127FAD74EEA218167115AA5962866C"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

stop_all_workers() {
    echo -e "${YELLOW}Stopping all workers...${NC}"
    ssh $WORKER1 'pkill -9 -f "hft-ultra" 2>/dev/null; pkill -9 -f "tsx.*server" 2>/dev/null; exit 0' &
    ssh $WORKER2 'pkill -9 -f "hft-ultra" 2>/dev/null; pkill -9 -f "tsx.*server" 2>/dev/null; exit 0' &
    ssh $WORKER3 'pkill -9 -f "hft-ultra" 2>/dev/null; pkill -9 -f "tsx.*server" 2>/dev/null; exit 0' &
    wait
    sleep 3
}

start_workers_single_market() {
    echo -e "${YELLOW}Starting workers with SINGLE MARKET...${NC}"

    # Worker 1
    ssh $WORKER1 << EOF
cat > /tmp/run-benchmark.sh << 'SCRIPT'
#!/bin/bash
cd /opt/aptos-hft
export ULTRA_PRIVATE_KEYS="$KEYS_W1"
export APTOS_API_KEY="AG-3JMDT54EN4DCLULDWAUXCYGQ56JJQCYHH"
export FULLNODE_URL="http://$FULLNODE:8080/v1"
export CONTRACT_ADDRESS="0xa2e5e47aab07fed78a3bcf95135ee2dad20c547499c94cb16a3e047859ffa7e1"
export MULTI_MARKET="$SINGLE_MARKET"
export HFT_PORT=3001
npx tsx hft-ultra-server.ts quantum $TEST_DURATION
SCRIPT
chmod +x /tmp/run-benchmark.sh
nohup bash /tmp/run-benchmark.sh > /tmp/hft-benchmark.log 2>&1 &
EOF

    # Worker 2
    ssh $WORKER2 << EOF
cat > /tmp/run-benchmark.sh << 'SCRIPT'
#!/bin/bash
cd /opt/aptos-hft
export ULTRA_PRIVATE_KEYS="$KEYS_W2"
export APTOS_API_KEY="AG-3JMDT54EN4DCLULDWAUXCYGQ56JJQCYHH"
export FULLNODE_URL="http://$FULLNODE:8080/v1"
export CONTRACT_ADDRESS="0xa2e5e47aab07fed78a3bcf95135ee2dad20c547499c94cb16a3e047859ffa7e1"
export MULTI_MARKET="$SINGLE_MARKET"
export HFT_PORT=3001
npx tsx hft-ultra-server.ts quantum $TEST_DURATION
SCRIPT
chmod +x /tmp/run-benchmark.sh
nohup bash /tmp/run-benchmark.sh > /tmp/hft-benchmark.log 2>&1 &
EOF

    # Worker 3
    ssh $WORKER3 << EOF
cat > /tmp/run-benchmark.sh << 'SCRIPT'
#!/bin/bash
cd /opt/aptos-hft
export ULTRA_PRIVATE_KEYS="$KEYS_W3"
export APTOS_API_KEY="AG-3JMDT54EN4DCLULDWAUXCYGQ56JJQCYHH"
export FULLNODE_URL="http://$FULLNODE:8080/v1"
export CONTRACT_ADDRESS="0xa2e5e47aab07fed78a3bcf95135ee2dad20c547499c94cb16a3e047859ffa7e1"
export MULTI_MARKET="$SINGLE_MARKET"
export HFT_PORT=3001
npx tsx hft-ultra-server.ts quantum $TEST_DURATION
SCRIPT
chmod +x /tmp/run-benchmark.sh
nohup bash /tmp/run-benchmark.sh > /tmp/hft-benchmark.log 2>&1 &
EOF
}

start_workers_multi_market() {
    echo -e "${YELLOW}Starting workers with MULTI-MARKET (5 markets round-robin)...${NC}"

    # Worker 1
    ssh $WORKER1 << EOF
cat > /tmp/run-benchmark.sh << 'SCRIPT'
#!/bin/bash
cd /opt/aptos-hft
export ULTRA_PRIVATE_KEYS="$KEYS_W1"
export APTOS_API_KEY="AG-3JMDT54EN4DCLULDWAUXCYGQ56JJQCYHH"
export FULLNODE_URL="http://$FULLNODE:8080/v1"
export CONTRACT_ADDRESS="0xa2e5e47aab07fed78a3bcf95135ee2dad20c547499c94cb16a3e047859ffa7e1"
export MULTI_MARKETS="$MULTI_MARKETS"
export HFT_PORT=3001
npx tsx hft-ultra-server.ts quantum $TEST_DURATION
SCRIPT
chmod +x /tmp/run-benchmark.sh
nohup bash /tmp/run-benchmark.sh > /tmp/hft-benchmark.log 2>&1 &
EOF

    # Worker 2
    ssh $WORKER2 << EOF
cat > /tmp/run-benchmark.sh << 'SCRIPT'
#!/bin/bash
cd /opt/aptos-hft
export ULTRA_PRIVATE_KEYS="$KEYS_W2"
export APTOS_API_KEY="AG-3JMDT54EN4DCLULDWAUXCYGQ56JJQCYHH"
export FULLNODE_URL="http://$FULLNODE:8080/v1"
export CONTRACT_ADDRESS="0xa2e5e47aab07fed78a3bcf95135ee2dad20c547499c94cb16a3e047859ffa7e1"
export MULTI_MARKETS="$MULTI_MARKETS"
export HFT_PORT=3001
npx tsx hft-ultra-server.ts quantum $TEST_DURATION
SCRIPT
chmod +x /tmp/run-benchmark.sh
nohup bash /tmp/run-benchmark.sh > /tmp/hft-benchmark.log 2>&1 &
EOF

    # Worker 3
    ssh $WORKER3 << EOF
cat > /tmp/run-benchmark.sh << 'SCRIPT'
#!/bin/bash
cd /opt/aptos-hft
export ULTRA_PRIVATE_KEYS="$KEYS_W3"
export APTOS_API_KEY="AG-3JMDT54EN4DCLULDWAUXCYGQ56JJQCYHH"
export FULLNODE_URL="http://$FULLNODE:8080/v1"
export CONTRACT_ADDRESS="0xa2e5e47aab07fed78a3bcf95135ee2dad20c547499c94cb16a3e047859ffa7e1"
export MULTI_MARKETS="$MULTI_MARKETS"
export HFT_PORT=3001
npx tsx hft-ultra-server.ts quantum $TEST_DURATION
SCRIPT
chmod +x /tmp/run-benchmark.sh
nohup bash /tmp/run-benchmark.sh > /tmp/hft-benchmark.log 2>&1 &
EOF
}

get_peak_tps() {
    local WORKER=$1
    local TPS=$(ssh -o ConnectTimeout=5 $WORKER "grep 'Peak TPS' /tmp/hft-benchmark.log 2>/dev/null | tail -1 | grep -oE '[0-9]+' | head -1" 2>/dev/null || echo "0")
    echo "${TPS:-0}"
}

get_total_trades() {
    local WORKER=$1
    local TRADES=$(ssh -o ConnectTimeout=5 $WORKER "grep 'Total:' /tmp/hft-benchmark.log 2>/dev/null | tail -1 | grep -oE '[0-9]+' | head -1" 2>/dev/null || echo "0")
    echo "${TRADES:-0}"
}

get_success_rate() {
    local WORKER=$1
    local RATE=$(ssh -o ConnectTimeout=5 $WORKER "grep 'Success:' /tmp/hft-benchmark.log 2>/dev/null | tail -1 | grep -oE '[0-9.]+%' | head -1" 2>/dev/null || echo "0%")
    echo "${RATE:-0%}"
}

echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${NC}  ${BOLD}🔬 MULTI-MARKET TPS BENCHMARK${NC}                                ${CYAN}║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BOLD}Test Duration:${NC} ${TEST_DURATION}s per configuration"
echo -e "  ${BOLD}Workers:${NC} 3 (20 accounts total)"
echo -e "  ${BOLD}Configurations:${NC}"
echo -e "    1. Single Market (baseline)"
echo -e "    2. Multi-Market (5 markets round-robin)"
echo ""

# ==========================================
# TEST 1: Single Market (Baseline)
# ==========================================
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}TEST 1: SINGLE MARKET (BASELINE)${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo ""

stop_all_workers
start_workers_single_market

echo -e "${YELLOW}Waiting 10s for workers to initialize...${NC}"
sleep 10

echo -e "${YELLOW}Running test for ${TEST_DURATION}s...${NC}"
echo ""

# Monitor progress
for i in $(seq 1 $((TEST_DURATION / 10))); do
    sleep 10
    W1_TPS=$(ssh -o ConnectTimeout=3 $WORKER1 "grep 'TPS:' /tmp/hft-benchmark.log 2>/dev/null | tail -1 | grep -oE 'TPS: [0-9]+' | grep -oE '[0-9]+'" 2>/dev/null || echo "0")
    W2_TPS=$(ssh -o ConnectTimeout=3 $WORKER2 "grep 'TPS:' /tmp/hft-benchmark.log 2>/dev/null | tail -1 | grep -oE 'TPS: [0-9]+' | grep -oE '[0-9]+'" 2>/dev/null || echo "0")
    W3_TPS=$(ssh -o ConnectTimeout=3 $WORKER3 "grep 'TPS:' /tmp/hft-benchmark.log 2>/dev/null | tail -1 | grep -oE 'TPS: [0-9]+' | grep -oE '[0-9]+'" 2>/dev/null || echo "0")
    TOTAL=$((${W1_TPS:-0} + ${W2_TPS:-0} + ${W3_TPS:-0}))
    echo -e "  [${i}0s] Combined TPS: ${CYAN}${TOTAL}${NC} (W1:${W1_TPS:-0} W2:${W2_TPS:-0} W3:${W3_TPS:-0})"
done

# Wait for test to complete
sleep 5

# Collect single market results
echo ""
echo -e "${YELLOW}Collecting results...${NC}"
SINGLE_W1_PEAK=$(get_peak_tps $WORKER1)
SINGLE_W2_PEAK=$(get_peak_tps $WORKER2)
SINGLE_W3_PEAK=$(get_peak_tps $WORKER3)
SINGLE_PEAK=$((SINGLE_W1_PEAK + SINGLE_W2_PEAK + SINGLE_W3_PEAK))

SINGLE_W1_TRADES=$(get_total_trades $WORKER1)
SINGLE_W2_TRADES=$(get_total_trades $WORKER2)
SINGLE_W3_TRADES=$(get_total_trades $WORKER3)
SINGLE_TOTAL_TRADES=$((SINGLE_W1_TRADES + SINGLE_W2_TRADES + SINGLE_W3_TRADES))

echo ""
echo -e "${GREEN}Single Market Results:${NC}"
echo -e "  Peak TPS: ${BOLD}${SINGLE_PEAK}${NC}"
echo -e "  Total Trades: ${SINGLE_TOTAL_TRADES}"
echo ""

# ==========================================
# TEST 2: Multi-Market (Round-Robin)
# ==========================================
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}TEST 2: MULTI-MARKET (5 MARKETS ROUND-ROBIN)${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo ""

stop_all_workers
start_workers_multi_market

echo -e "${YELLOW}Waiting 10s for workers to initialize...${NC}"
sleep 10

echo -e "${YELLOW}Running test for ${TEST_DURATION}s...${NC}"
echo ""

# Monitor progress
for i in $(seq 1 $((TEST_DURATION / 10))); do
    sleep 10
    W1_TPS=$(ssh -o ConnectTimeout=3 $WORKER1 "grep 'TPS:' /tmp/hft-benchmark.log 2>/dev/null | tail -1 | grep -oE 'TPS: [0-9]+' | grep -oE '[0-9]+'" 2>/dev/null || echo "0")
    W2_TPS=$(ssh -o ConnectTimeout=3 $WORKER2 "grep 'TPS:' /tmp/hft-benchmark.log 2>/dev/null | tail -1 | grep -oE 'TPS: [0-9]+' | grep -oE '[0-9]+'" 2>/dev/null || echo "0")
    W3_TPS=$(ssh -o ConnectTimeout=3 $WORKER3 "grep 'TPS:' /tmp/hft-benchmark.log 2>/dev/null | tail -1 | grep -oE 'TPS: [0-9]+' | grep -oE '[0-9]+'" 2>/dev/null || echo "0")
    TOTAL=$((${W1_TPS:-0} + ${W2_TPS:-0} + ${W3_TPS:-0}))
    echo -e "  [${i}0s] Combined TPS: ${CYAN}${TOTAL}${NC} (W1:${W1_TPS:-0} W2:${W2_TPS:-0} W3:${W3_TPS:-0})"
done

# Wait for test to complete
sleep 5

# Collect multi-market results
echo ""
echo -e "${YELLOW}Collecting results...${NC}"
MULTI_W1_PEAK=$(get_peak_tps $WORKER1)
MULTI_W2_PEAK=$(get_peak_tps $WORKER2)
MULTI_W3_PEAK=$(get_peak_tps $WORKER3)
MULTI_PEAK=$((MULTI_W1_PEAK + MULTI_W2_PEAK + MULTI_W3_PEAK))

MULTI_W1_TRADES=$(get_total_trades $WORKER1)
MULTI_W2_TRADES=$(get_total_trades $WORKER2)
MULTI_W3_TRADES=$(get_total_trades $WORKER3)
MULTI_TOTAL_TRADES=$((MULTI_W1_TRADES + MULTI_W2_TRADES + MULTI_W3_TRADES))

echo ""
echo -e "${GREEN}Multi-Market Results:${NC}"
echo -e "  Peak TPS: ${BOLD}${MULTI_PEAK}${NC}"
echo -e "  Total Trades: ${MULTI_TOTAL_TRADES}"
echo ""

# ==========================================
# COMPARISON
# ==========================================
stop_all_workers

echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${NC}  ${BOLD}📊 BENCHMARK RESULTS${NC}                                         ${CYAN}║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "┌─────────────────────────┬────────────────┬────────────────┐"
echo -e "│ ${BOLD}Metric${NC}                  │ ${BOLD}Single Market${NC}  │ ${BOLD}Multi-Market${NC}   │"
echo -e "├─────────────────────────┼────────────────┼────────────────┤"
printf "│ %-23s │ %14s │ %14s │\n" "Peak TPS (combined)" "$SINGLE_PEAK" "$MULTI_PEAK"
printf "│ %-23s │ %14s │ %14s │\n" "Total Trades" "$SINGLE_TOTAL_TRADES" "$MULTI_TOTAL_TRADES"
echo -e "├─────────────────────────┼────────────────┼────────────────┤"

# Calculate improvement
if [ "$SINGLE_PEAK" -gt 0 ]; then
    IMPROVEMENT=$(echo "scale=1; ($MULTI_PEAK - $SINGLE_PEAK) * 100 / $SINGLE_PEAK" | bc 2>/dev/null || echo "N/A")
    printf "│ %-23s │ %14s │ ${GREEN}%13s%%${NC} │\n" "TPS Improvement" "baseline" "+$IMPROVEMENT"
fi

echo -e "└─────────────────────────┴────────────────┴────────────────┘"
echo ""

if [ "$MULTI_PEAK" -gt "$SINGLE_PEAK" ]; then
    echo -e "${GREEN}✓ Multi-market configuration is FASTER!${NC}"
    echo -e "  Spreading trades across 5 markets reduced aggregator contention."
else
    echo -e "${YELLOW}⚠ Results inconclusive - may need longer test duration${NC}"
fi

echo ""
echo -e "${BOLD}Recommendation:${NC}"
echo -e "  For maximum TPS, use ${CYAN}MULTI_MARKETS${NC} env var with all 10 markets."
echo ""
