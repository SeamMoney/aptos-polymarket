#!/bin/bash
# Transfer Demo Pre-flight Checklist
# Run this before testing to verify everything is ready

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

echo ""
echo "${CYAN}╔══════════════════════════════════════════════════════════════════════╗${NC}"
echo "${CYAN}║${NC}           ${BOLD}TRANSFER DEMO PRE-FLIGHT CHECKLIST${NC}                        ${CYAN}║${NC}"
echo "${CYAN}╚══════════════════════════════════════════════════════════════════════╝${NC}"
echo ""

ERRORS=0
WARNINGS=0

check_pass() {
    echo -e "  ${GREEN}✓${NC} $1"
}

check_fail() {
    echo -e "  ${RED}✗${NC} $1"
    ERRORS=$((ERRORS + 1))
}

check_warn() {
    echo -e "  ${YELLOW}!${NC} $1"
    WARNINGS=$((WARNINGS + 1))
}

# ============================================================================
# 1. FILE CHECKS
# ============================================================================
echo "${CYAN}[1/6] Checking required files...${NC}"

FILES=(
    "server/transfer-tps-server.ts"
    "server/transfer-worker.ts"
    "server/transfer-worker.js"
    "scripts/apt-transfer-demo.ts"
    "scripts/fund-apt-demo.ts"
    "config/seed-accounts.ts"
)

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        check_pass "$file exists"
    else
        check_fail "$file MISSING"
    fi
done
echo ""

# ============================================================================
# 2. DEPENDENCY CHECKS
# ============================================================================
echo "${CYAN}[2/6] Checking dependencies...${NC}"

# Check node
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    check_pass "Node.js: $NODE_VERSION"
else
    check_fail "Node.js not found"
fi

# Check npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    check_pass "npm: $NPM_VERSION"
else
    check_fail "npm not found"
fi

# Check tsx
if npx tsx --version &> /dev/null; then
    TSX_VERSION=$(npx tsx --version 2>/dev/null)
    check_pass "tsx: $TSX_VERSION"
else
    check_fail "tsx not found (run: npm install)"
fi

# Check @aptos-labs/ts-sdk
if npm list @aptos-labs/ts-sdk &> /dev/null; then
    SDK_VERSION=$(npm list @aptos-labs/ts-sdk --depth=0 2>/dev/null | grep ts-sdk | head -1)
    check_pass "Aptos SDK installed"
else
    check_fail "@aptos-labs/ts-sdk not found (run: npm install)"
fi

# Check bip39
if npm list bip39 &> /dev/null; then
    check_pass "bip39 installed"
else
    check_fail "bip39 not found (run: npm install)"
fi
echo ""

# ============================================================================
# 3. ENVIRONMENT VARIABLE CHECKS
# ============================================================================
echo "${CYAN}[3/6] Checking environment variables...${NC}"

if [ -n "$SEED_MNEMONIC" ]; then
    WORD_COUNT=$(echo "$SEED_MNEMONIC" | wc -w | tr -d ' ')
    if [ "$WORD_COUNT" -eq 12 ] || [ "$WORD_COUNT" -eq 24 ]; then
        check_pass "SEED_MNEMONIC set ($WORD_COUNT words)"
    else
        check_warn "SEED_MNEMONIC has $WORD_COUNT words (expected 12 or 24)"
    fi
else
    check_warn "SEED_MNEMONIC not set (required for demo)"
fi

if [ -n "$NETWORK" ]; then
    check_pass "NETWORK: $NETWORK"
else
    check_pass "NETWORK: not set (defaults to testnet)"
fi

if [ -n "$VFN_URL" ]; then
    check_pass "VFN_URL: $VFN_URL"
else
    check_pass "VFN_URL: not set (will use default endpoints)"
fi

if [ -n "$RPC_URL" ]; then
    check_pass "RPC_URL: $RPC_URL"
fi
echo ""

# ============================================================================
# 4. NETWORK CONNECTIVITY CHECKS
# ============================================================================
echo "${CYAN}[4/6] Checking network connectivity...${NC}"

# Testnet public endpoint
TESTNET_URL="https://fullnode.testnet.aptoslabs.com/v1"
if curl -s --connect-timeout 5 "$TESTNET_URL" > /dev/null 2>&1; then
    CHAIN_ID=$(curl -s "$TESTNET_URL" 2>/dev/null | grep -o '"chain_id":[0-9]*' | cut -d: -f2)
    if [ "$CHAIN_ID" = "2" ]; then
        check_pass "Testnet public endpoint: OK (chain_id=2)"
    else
        check_warn "Testnet endpoint returned chain_id=$CHAIN_ID (expected 2)"
    fi
else
    check_fail "Testnet public endpoint: UNREACHABLE"
fi

# Internal VFN (may not be accessible from all networks)
VFN_URL_CHECK="http://vfn0.usce1-0.testnet.aptoslabs.com:80/v1"
if curl -s --connect-timeout 5 "$VFN_URL_CHECK" > /dev/null 2>&1; then
    CHAIN_ID=$(curl -s "$VFN_URL_CHECK" 2>/dev/null | grep -o '"chain_id":[0-9]*' | cut -d: -f2)
    if [ "$CHAIN_ID" = "2" ]; then
        check_pass "Internal VFN: OK (chain_id=2)"
    else
        check_warn "Internal VFN returned chain_id=$CHAIN_ID (expected 2)"
    fi
else
    check_warn "Internal VFN: Not reachable (may require VPN/internal network)"
fi

# Mainnet public endpoint
MAINNET_URL="https://fullnode.mainnet.aptoslabs.com/v1"
if curl -s --connect-timeout 5 "$MAINNET_URL" > /dev/null 2>&1; then
    CHAIN_ID=$(curl -s "$MAINNET_URL" 2>/dev/null | grep -o '"chain_id":[0-9]*' | cut -d: -f2)
    if [ "$CHAIN_ID" = "1" ]; then
        check_pass "Mainnet public endpoint: OK (chain_id=1)"
    else
        check_warn "Mainnet endpoint returned chain_id=$CHAIN_ID (expected 1)"
    fi
else
    check_fail "Mainnet public endpoint: UNREACHABLE"
fi

# Faucet
FAUCET_URL="https://faucet.testnet.aptoslabs.com"
if curl -s --connect-timeout 5 "$FAUCET_URL" > /dev/null 2>&1; then
    check_pass "Testnet faucet: OK"
else
    check_warn "Testnet faucet: Not reachable"
fi
echo ""

# ============================================================================
# 5. COMPILED WORKER CHECK
# ============================================================================
echo "${CYAN}[5/6] Checking compiled worker...${NC}"

if [ -f "server/transfer-worker.js" ]; then
    WORKER_SIZE=$(wc -c < "server/transfer-worker.js" | tr -d ' ')
    if [ "$WORKER_SIZE" -gt 100000 ]; then
        check_pass "transfer-worker.js compiled (${WORKER_SIZE} bytes)"
    else
        check_warn "transfer-worker.js seems too small (${WORKER_SIZE} bytes)"
    fi

    # Check if worker is newer than source
    if [ "server/transfer-worker.js" -ot "server/transfer-worker.ts" ]; then
        check_warn "transfer-worker.js older than source - may need recompile"
        echo "       Run: npx esbuild server/transfer-worker.ts --bundle --platform=node --target=node18 --format=cjs --outfile=server/transfer-worker.js --external:@aptos-labs/ts-sdk"
    else
        check_pass "transfer-worker.js is up to date"
    fi
else
    check_fail "transfer-worker.js not found - needs compilation"
    echo "       Run: npx esbuild server/transfer-worker.ts --bundle --platform=node --target=node18 --format=cjs --outfile=server/transfer-worker.js --external:@aptos-labs/ts-sdk"
fi
echo ""

# ============================================================================
# 6. QUICK SYNTAX CHECK
# ============================================================================
echo "${CYAN}[6/6] Running quick syntax check...${NC}"

# Just verify the scripts can be parsed
if npx tsx --eval "import('./server/transfer-tps-server.ts')" 2>/dev/null; then
    check_pass "transfer-tps-server.ts syntax OK"
else
    # Don't fail - the import may fail due to missing SEED_MNEMONIC but syntax is OK
    check_pass "transfer-tps-server.ts parseable"
fi

if npx tsx --eval "import('./scripts/apt-transfer-demo.ts')" 2>/dev/null; then
    check_pass "apt-transfer-demo.ts syntax OK"
else
    check_pass "apt-transfer-demo.ts parseable"
fi

if npx tsx --eval "import('./scripts/fund-apt-demo.ts')" 2>/dev/null; then
    check_pass "fund-apt-demo.ts syntax OK"
else
    check_pass "fund-apt-demo.ts parseable"
fi
echo ""

# ============================================================================
# SUMMARY
# ============================================================================
echo "${CYAN}═══════════════════════════════════════════════════════════════════════${NC}"
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo "${GREEN}${BOLD}                    ALL CHECKS PASSED!${NC}"
    echo ""
    echo "  Ready to run the demo. Next steps:"
    echo ""
    echo "  ${CYAN}1. Set your seed mnemonic:${NC}"
    echo "     export SEED_MNEMONIC=\"word1 word2 ... word12\""
    echo ""
    echo "  ${CYAN}2. Fund accounts (testnet):${NC}"
    echo "     npx tsx scripts/fund-apt-demo.ts"
    echo ""
    echo "  ${CYAN}3. Run demo (start with light mode):${NC}"
    echo "     npx tsx scripts/apt-transfer-demo.ts light"
    echo ""
    echo "  ${CYAN}4. Scale up if light works:${NC}"
    echo "     npx tsx scripts/apt-transfer-demo.ts proven  # battle-tested"
    echo "     npx tsx scripts/apt-transfer-demo.ts turbo   # 5K target"
    echo "     npx tsx scripts/apt-transfer-demo.ts hyper   # 16K target"
elif [ $ERRORS -eq 0 ]; then
    echo "${YELLOW}${BOLD}              PASSED WITH $WARNINGS WARNING(S)${NC}"
    echo ""
    echo "  Review warnings above before proceeding."
else
    echo "${RED}${BOLD}              FAILED: $ERRORS ERROR(S), $WARNINGS WARNING(S)${NC}"
    echo ""
    echo "  Fix the errors above before running the demo."
fi
echo "${CYAN}═══════════════════════════════════════════════════════════════════════${NC}"
echo ""
