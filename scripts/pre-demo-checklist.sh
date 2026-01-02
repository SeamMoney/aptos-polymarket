#!/bin/bash
#
# PRE-DEMO CHECKLIST - Verify everything before the 30K TPS demo
# ================================================================
# Run this before the demo to ensure all systems are GO!
#
# Usage: ./scripts/pre-demo-checklist.sh
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Infrastructure
WORKER1_IP="178.128.177.88"
WORKER2_IP="147.182.237.239"
WORKER3_IP="161.35.231.0"
FULLNODE_IP="164.92.117.18"
WORKER_USER="root"

# Contract addresses
CONTRACT_ADDRESS="0xa2e5e47aab07fed78a3bcf95135ee2dad20c547499c94cb16a3e047859ffa7e1"
MARKET_ADDRESS="0xfefd1b67818ee4ef12a7953852c83f0efb411a9b92c518a52ba92555e4abdd96"

# QuickNode
QUICKNODE_RPC="https://polished-evocative-borough.aptos-testnet.quiknode.pro/a0b08bae2dc34e4a8774d91414948d02a5ce2975/v1"

# Counters
PASS=0
FAIL=0
WARN=0

print_header() {
    echo ""
    echo -e "${BLUE}${BOLD}══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}${BOLD}  $1${NC}"
    echo -e "${BLUE}${BOLD}══════════════════════════════════════════════════════════════${NC}"
    echo ""
}

check_pass() {
    echo -e "  ${GREEN}✓${NC} $1"
    ((PASS++))
}

check_fail() {
    echo -e "  ${RED}✗${NC} $1"
    ((FAIL++))
}

check_warn() {
    echo -e "  ${YELLOW}⚠${NC} $1"
    ((WARN++))
}

# ============================================
# 1. INFRASTRUCTURE CHECKS
# ============================================

print_header "1. INFRASTRUCTURE CHECKS"

# Check Worker 1
echo -n "Worker 1 (${WORKER1_IP}): "
if ssh -o ConnectTimeout=5 -o BatchMode=yes ${WORKER_USER}@${WORKER1_IP} "echo ok" &>/dev/null; then
    check_pass "SSH connection OK"

    # Check HFT setup
    if ssh ${WORKER_USER}@${WORKER1_IP} "test -d /opt/aptos-hft" 2>/dev/null; then
        check_pass "HFT code installed"
    else
        check_fail "HFT code NOT installed - run: ./scripts/orchestrator.sh setup"
    fi
else
    check_fail "SSH connection FAILED"
fi

# Check Worker 2
echo -n "Worker 2 (${WORKER2_IP}): "
if ssh -o ConnectTimeout=5 -o BatchMode=yes ${WORKER_USER}@${WORKER2_IP} "echo ok" &>/dev/null; then
    check_pass "SSH connection OK"
else
    check_fail "SSH connection FAILED"
fi

# Check Worker 3
echo -n "Worker 3 (${WORKER3_IP}): "
if ssh -o ConnectTimeout=5 -o BatchMode=yes ${WORKER_USER}@${WORKER3_IP} "echo ok" &>/dev/null; then
    check_pass "SSH connection OK"
else
    check_fail "SSH connection FAILED"
fi

# Check Fullnode
echo -n "Fullnode (${FULLNODE_IP}): "
FULLNODE_RESP=$(curl -s --connect-timeout 5 "http://${FULLNODE_IP}:8080/v1" 2>/dev/null || echo "")
if echo "$FULLNODE_RESP" | grep -q "chain_id"; then
    BLOCK=$(echo "$FULLNODE_RESP" | jq -r '.block_height' 2>/dev/null || echo "unknown")
    check_pass "Running (Block: ${BLOCK})"
else
    check_warn "Not reachable (will use public RPCs)"
fi

# ============================================
# 2. BLOCKCHAIN CHECKS
# ============================================

print_header "2. BLOCKCHAIN CHECKS"

# Check contract
echo -n "Contract deployed: "
CONTRACT_RESP=$(curl -s "https://fullnode.testnet.aptoslabs.com/v1/accounts/${CONTRACT_ADDRESS}/modules" 2>/dev/null || echo "")
if echo "$CONTRACT_RESP" | grep -q "multi_outcome_market"; then
    check_pass "multi_outcome_market module found"
else
    check_fail "Contract NOT found at ${CONTRACT_ADDRESS:0:20}..."
fi

# Check market exists
echo -n "Market active: "
MARKET_RESP=$(curl -s -X POST "https://fullnode.testnet.aptoslabs.com/v1/view" \
    -H "Content-Type: application/json" \
    -d "{\"function\": \"${CONTRACT_ADDRESS}::multi_outcome_market::get_all_prices\", \"type_arguments\": [], \"arguments\": [\"${MARKET_ADDRESS}\"]}" 2>/dev/null || echo "")
if echo "$MARKET_RESP" | grep -q "\["; then
    check_pass "GOP 2028 market responding"

    # Parse prices
    echo -n "Current prices: "
    PRICES=$(echo "$MARKET_RESP" | jq -r '.[0] | map(tonumber) | map(. / 100 | floor) | join("%, ") + "%"' 2>/dev/null || echo "unknown")
    echo -e "${CYAN}${PRICES}${NC}"
else
    check_fail "Market NOT found at ${MARKET_ADDRESS:0:20}..."
fi

# Check outcome labels
echo -n "Outcome labels: "
LABELS_RESP=$(curl -s -X POST "https://fullnode.testnet.aptoslabs.com/v1/view" \
    -H "Content-Type: application/json" \
    -d "{\"function\": \"${CONTRACT_ADDRESS}::multi_outcome_market::get_outcome_labels\", \"type_arguments\": [], \"arguments\": [\"${MARKET_ADDRESS}\"]}" 2>/dev/null || echo "")
if echo "$LABELS_RESP" | grep -q "Vance"; then
    LABELS=$(echo "$LABELS_RESP" | jq -r '.[0] | join(", ")' 2>/dev/null || echo "unknown")
    check_pass "${LABELS}"
else
    check_warn "Could not fetch labels"
fi

# ============================================
# 3. RPC ENDPOINTS
# ============================================

print_header "3. RPC ENDPOINT CHECKS"

# QuickNode
echo -n "QuickNode: "
QN_RESP=$(curl -s --connect-timeout 5 "${QUICKNODE_RPC}" 2>/dev/null || echo "")
if echo "$QN_RESP" | grep -q "chain_id"; then
    check_pass "Responding"
else
    check_fail "NOT responding"
fi

# Aptos Labs
echo -n "Aptos Labs API: "
AL_RESP=$(curl -s --connect-timeout 5 "https://fullnode.testnet.aptoslabs.com/v1" 2>/dev/null || echo "")
if echo "$AL_RESP" | grep -q "chain_id"; then
    check_pass "Responding"
else
    check_warn "Rate limited or down"
fi

# ============================================
# 4. ACCOUNT BALANCE CHECKS
# ============================================

print_header "4. ACCOUNT BALANCE CHECKS"

# Function to check balance
check_balance() {
    local addr=$1
    local name=$2
    local min_apt=$3

    BALANCE_RESP=$(curl -s "https://fullnode.testnet.aptoslabs.com/v1/accounts/${addr}/resources" 2>/dev/null || echo "")
    BALANCE_RAW=$(echo "$BALANCE_RESP" | jq -r '.[] | select(.type | contains("CoinStore")) | .data.coin.value' 2>/dev/null | head -1 || echo "0")

    if [ -n "$BALANCE_RAW" ] && [ "$BALANCE_RAW" != "null" ]; then
        BALANCE_APT=$(echo "scale=2; $BALANCE_RAW / 100000000" | bc 2>/dev/null || echo "0")
        if (( $(echo "$BALANCE_APT >= $min_apt" | bc -l) )); then
            check_pass "${name}: ${BALANCE_APT} APT"
        else
            check_warn "${name}: ${BALANCE_APT} APT (< ${min_apt} APT minimum)"
        fi
    else
        check_fail "${name}: Could not fetch balance"
    fi
}

# Check contract account (where market fees go)
echo "Contract account:"
check_balance "${CONTRACT_ADDRESS}" "Contract" 100

# Sample a few trading accounts (we can't easily enumerate them without keys)
echo ""
echo -e "${CYAN}Note: Trading account balances are checked when HFT server starts${NC}"
echo -e "${CYAN}Run './scripts/orchestrator.sh status' for full account check${NC}"

# ============================================
# 5. FRONTEND CHECKS
# ============================================

print_header "5. FRONTEND CHECKS"

# Check if frontend is running locally
echo -n "Local dev server: "
if curl -s --connect-timeout 2 "http://localhost:5173" &>/dev/null; then
    check_pass "Running on localhost:5173"
else
    check_warn "Not running (start with: npm run dev)"
fi

# Check Vercel deployment
echo -n "Vercel deployment: "
VERCEL_RESP=$(curl -s --connect-timeout 5 "https://aptos-polymarket.vercel.app" 2>/dev/null || echo "")
if echo "$VERCEL_RESP" | grep -q "html"; then
    check_pass "https://aptos-polymarket.vercel.app is live"
else
    check_warn "Could not reach Vercel"
fi

# Check .env.local
echo -n "WebSocket config: "
if [ -f ".env.local" ]; then
    WS_URL=$(grep "VITE_HFT_WS_URL" .env.local 2>/dev/null | cut -d'=' -f2)
    if [ -n "$WS_URL" ]; then
        check_pass "Configured: ${WS_URL}"
    else
        check_warn ".env.local exists but VITE_HFT_WS_URL not set"
    fi
else
    check_fail ".env.local not found"
fi

# ============================================
# 6. MODE VERIFICATION
# ============================================

print_header "6. HFT SERVER MODES"

echo -e "${CYAN}Available modes:${NC}"
echo "  🧪 dryrun  - ~10 TPS (UI testing)"
echo "  🔄 normal  - ~1,000 TPS (light demo)"
echo "  ⚡ turbo   - ~3,000 TPS (medium)"
echo "  🔥 ultra   - ~10,000 TPS (high)"
echo "  🚀 quantum - ~30,000+ TPS (DEMO DAY)"
echo ""
echo -e "${CYAN}Usage:${NC}"
echo "  npx tsx server/hft-ultra-server.ts <mode> <duration_seconds>"
echo ""
echo -e "${CYAN}Example:${NC}"
echo "  npx tsx server/hft-ultra-server.ts quantum 60"

# ============================================
# SUMMARY
# ============================================

print_header "CHECKLIST SUMMARY"

TOTAL=$((PASS + FAIL + WARN))

echo -e "  ${GREEN}✓ Passed:${NC}  ${PASS}"
echo -e "  ${RED}✗ Failed:${NC}  ${FAIL}"
echo -e "  ${YELLOW}⚠ Warnings:${NC} ${WARN}"
echo ""

if [ $FAIL -eq 0 ]; then
    if [ $WARN -eq 0 ]; then
        echo -e "${GREEN}${BOLD}🚀 ALL SYSTEMS GO! Ready for demo.${NC}"
    else
        echo -e "${YELLOW}${BOLD}⚠️  READY WITH WARNINGS - Review items above${NC}"
    fi
else
    echo -e "${RED}${BOLD}❌ NOT READY - Fix failed checks before demo${NC}"
fi

echo ""
echo -e "${CYAN}Next steps:${NC}"
echo "  1. Fix any failed checks above"
echo "  2. Run: ./scripts/orchestrator.sh demo"
echo "  3. Open: https://aptos-polymarket.vercel.app/demo-day"
echo "  4. ARM → LAUNCH"
echo ""

exit $FAIL
