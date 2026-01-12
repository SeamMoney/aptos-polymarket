#!/bin/bash
#
# MAXIMUM TPS - 10 MARKET ROUND-ROBIN
# ===================================
#
# Uses ALL available infrastructure for maximum TPS:
# - 3 workers (20 accounts total)
# - 10 markets (round-robin to reduce aggregator contention)
# - Custom fullnode + QuikNode (RPC round-robin)
# - Quantum mode (150 batch, 20ms delay)
#
# Expected TPS: 40,000-60,000+ (vs ~30K single market)
#
# Usage:
#   ./scripts/max-tps-multi-market.sh           # Run for 120s (default)
#   ./scripts/max-tps-multi-market.sh 300       # Run for 300s
#   ./scripts/max-tps-multi-market.sh 60 --dry  # Dry run (check config only)
#

set -e

# ============================================
# INFRASTRUCTURE
# ============================================

# Workers
WORKER1="root@178.128.177.88"   # 7 accounts - MASTER
WORKER2="root@147.182.237.239"  # 7 accounts
WORKER3="root@161.35.231.0"     # 6 accounts

# RPC Endpoints (round-robin for load distribution)
FULLNODE="http://aptos.cash.trading:8080/v1"
QUICKNODE="https://polished-evocative-borough.aptos-testnet.quiknode.pro/a0b08bae2dc34e4a8774d91414948d02a5ce2975/v1"

# Contract
CONTRACT="0xa2e5e47aab07fed78a3bcf95135ee2dad20c547499c94cb16a3e047859ffa7e1"

# ALL 10 DEMO MARKETS (for round-robin)
ALL_MARKETS="0xc47af6adee557eb824c5a82f800d9ca15a6525417d273d9671451a45106870bb,0x3b365cbbc7ea0aa6e18b3dd7d4e2cae6c84fae90d9b5d0c3b1ef8a919ea5a72f,0xa4cc4e98d5f9dd23809ad1cf9f3b44501be2ffae47c06f59fa81df0886f01fa0,0x74bbc4673ebe683d3d0013a1862c369938255071f0b32ac0fb638b476698213a,0x2163cf2a5e8a58b262111e06f6e97818ff0a11418eaedcb28ba3e10a0fdb2d12,0x9ead4f745267b70bf8f80858876552dff8b3752d67580deb0ef211a441230ebd,0xc0c821e880662d8f4c35d6e88521f489aa61c97fe42662a348fdb4333922f3dc,0x23c79ba59fdffe66abd5243ebf98d9dd13661d86a355cfcb1872eeb58e088278,0xb297b277d82a364b2f98d2e8fac549d921acd565dfb46c598c09eab2e93e776d,0xaba7e1a1ca41899757215bac86bd71ca5d8db24d53acf18332421b0424dac8f3"

# Account keys (20 total across 3 workers)
KEYS_W1="0x6e2fca34586261b6f22a973c20024b78ddb370d87f7c974315fb97ba56716a7f,0xe61d22b3dc37c537a20d5b301c4d2b409b2f93cd7b2915f3518d49517c2ab6c4,0x4542c2e4a39beee8202eee0cddeceea886687b21b54b8f50c17e729251fdd7f5,0xcf5154af9664bbc2634fddfcce2317ed788b35de7f004ac0e24aefd68a0b10c5,ed25519-priv-0xb7d1f406e48c2eddffe987f98445dd4a353e8e9d1630d878621ded084bdd77c7,ed25519-priv-0xa8088ee787b847f6304807a8b09d1afc15409082ee9c8b7eda6919b0ecb86ea8,ed25519-priv-0xb5305eb83498dcba61242ccc91fac35263d9b44bddaf5e7417adbaceb1cfcb36"
KEYS_W2="ed25519-priv-0xc27a6a8b6ed3013da99dc924b2f6af17f1448dedce91691f97d9e778c0761655,ed25519-priv-0xd6402b3493af005ed02b07f6cd7ffdfd37fae6d4d9c88fec6ff38e90f01b21c1,ed25519-priv-0xd375af1a686835905e15bf82f24fcaeed4b1b5b5fabe22c80e998acb804aa295,ed25519-priv-0xC5BA2ED0F5C40EE298E844B1140B6BB31C2671B747C8E9DF4B76054C4C5A8761,ed25519-priv-0x536C886483209657C9B30663B295C7CB007EB57E07931D3E41AF69067897D465,ed25519-priv-0x3E9CB6207207A266F298B1B13648D707BF886766221C3253F30AF68530A79749,ed25519-priv-0x4641D0FDD221B48EF4A45C8DC77D6D4F12D6848E01B7686134564A8CAE5BE637"
KEYS_W3="ed25519-priv-0xFB2AFF37DFED247E9CF407FFA41208A41A78877C1990ADD1F94E00FCE1A5CCAC,ed25519-priv-0x9E338A7FB43F8280CCD82B2929B66F4ED1B7AA7900C40E06EAD934BC7CDEF315,ed25519-priv-0x8E7D4B0196840DA3A7BA6EDEF3784E1B961263F06651B130F440F5D974920B1F,ed25519-priv-0x975CF351CE096E1350C9F9E89ED5CB8D7BEAAEBF7FC235B10F1A0852355EED7A,ed25519-priv-0xD945B44FCFA961B9E4F8DAA5139CF6B4CE9A1DF4838C75701EDC8A429739C097,ed25519-priv-0x292A25EDBE90DCB5F682908C1E7185E1CC127FAD74EEA218167115AA5962866C"

# ============================================
# CONFIGURATION
# ============================================

DURATION=${1:-120}
DRY_RUN=""
[[ "$2" == "--dry" ]] && DRY_RUN="true"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ============================================
# FUNCTIONS
# ============================================

print_header() {
    echo ""
    echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${NC}  ${BOLD}🚀 MAXIMUM TPS - 10 MARKET ROUND-ROBIN${NC}                      ${CYAN}║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "  ${BOLD}Duration:${NC}    ${DURATION}s"
    echo -e "  ${BOLD}Workers:${NC}     3 (20 accounts)"
    echo -e "  ${BOLD}Markets:${NC}     10 (round-robin)"
    echo -e "  ${BOLD}Mode:${NC}        QUANTUM (150 batch, 20ms delay)"
    echo -e "  ${BOLD}RPC:${NC}         Fullnode + QuikNode (round-robin)"
    echo ""
    echo -e "  ${BOLD}Expected TPS:${NC} ${GREEN}40,000 - 60,000+${NC}"
    echo ""
}

check_infrastructure() {
    echo -e "${YELLOW}▶ Checking infrastructure...${NC}"

    # Check fullnode
    echo -n "  Fullnode (aptos.cash.trading): "
    if curl -s --connect-timeout 3 "$FULLNODE" | grep -q "chain_id"; then
        BLOCK=$(curl -s "$FULLNODE" | jq -r '.block_height' 2>/dev/null || echo "?")
        echo -e "${GREEN}✓${NC} (block $BLOCK)"
    else
        echo -e "${RED}✗ NOT RESPONDING${NC}"
        exit 1
    fi

    # Check QuikNode
    echo -n "  QuikNode: "
    if curl -s --connect-timeout 5 "$QUICKNODE" | grep -q "chain_id"; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${YELLOW}⚠ slow/unavailable${NC}"
    fi

    # Check workers
    for i in 1 2 3; do
        WORKER_VAR="WORKER$i"
        WORKER="${!WORKER_VAR}"
        IP=$(echo $WORKER | cut -d@ -f2)
        echo -n "  Worker $i ($IP): "
        if ssh -o ConnectTimeout=3 $WORKER "echo ok" >/dev/null 2>&1; then
            echo -e "${GREEN}✓${NC}"
        else
            echo -e "${RED}✗ NOT REACHABLE${NC}"
            exit 1
        fi
    done

    echo ""
}

stop_workers() {
    echo -e "${YELLOW}▶ Stopping existing workers...${NC}"
    ssh $WORKER1 'pkill -9 -f "hft-ultra" 2>/dev/null; pkill -9 -f "tsx.*server" 2>/dev/null; exit 0' &
    ssh $WORKER2 'pkill -9 -f "hft-ultra" 2>/dev/null; pkill -9 -f "tsx.*server" 2>/dev/null; exit 0' &
    ssh $WORKER3 'pkill -9 -f "hft-ultra" 2>/dev/null; pkill -9 -f "tsx.*server" 2>/dev/null; exit 0' &
    wait
    sleep 3
    echo -e "${GREEN}✓${NC} All workers stopped"
    echo ""
}

start_worker() {
    local WORKER=$1
    local WORKER_NUM=$2
    local KEYS=$3

    echo -e "  Starting Worker $WORKER_NUM..."

    ssh $WORKER << REMOTE_SCRIPT
cat > /tmp/max-tps-run.sh << 'SCRIPT'
#!/bin/bash
cd /opt/aptos-hft

# Account keys
export ULTRA_PRIVATE_KEYS="$KEYS"

# API key
export APTOS_API_KEY="AG-3JMDT54EN4DCLULDWAUXCYGQ56JJQCYHH"

# RPC endpoints (fullnode + QuikNode for round-robin)
export FULLNODE_URL="$FULLNODE"
export EXTRA_RPC_ENDPOINTS="$QUICKNODE"

# Contract
export CONTRACT_ADDRESS="$CONTRACT"

# ALL 10 MARKETS for round-robin (key optimization!)
export MULTI_MARKETS="$ALL_MARKETS"

# Port
export HFT_PORT=3001

echo "=============================================="
echo "  WORKER $WORKER_NUM - MAX TPS MODE"
echo "  Accounts: $(echo "$KEYS" | tr ',' '\n' | wc -l)"
echo "  Markets: 10 (round-robin)"
echo "  RPC: Fullnode + QuikNode"
echo "=============================================="

# Run in QUANTUM mode
npx tsx hft-ultra-server.ts quantum $DURATION
SCRIPT
chmod +x /tmp/max-tps-run.sh
nohup bash /tmp/max-tps-run.sh > /tmp/hft-max-tps.log 2>&1 &
REMOTE_SCRIPT
}

start_all_workers() {
    echo -e "${YELLOW}▶ Starting all workers in QUANTUM mode...${NC}"

    start_worker "$WORKER1" 1 "$KEYS_W1"
    start_worker "$WORKER2" 2 "$KEYS_W2"
    start_worker "$WORKER3" 3 "$KEYS_W3"

    echo ""
    echo -e "${GREEN}✓${NC} All workers started"
    echo ""
}

monitor_tps() {
    echo -e "${YELLOW}▶ Monitoring TPS (Geomi-based)...${NC}"
    echo ""

    START_TIME=$(date -u +"%Y-%m-%dT%H:%M:%S")

    # Monitor every 10 seconds
    for i in $(seq 10 10 $DURATION); do
        sleep 10

        # Query Geomi for trade count
        TRADE_DATA=$(npx tsx -e "
const GEOMI_URL = 'https://api.testnet.aptoslabs.com/nocode/v1/api/cmk83k7ov0003s6017cgn7stm/v1/graphql';
const API_KEY = 'aptoslabs_9XPRa9Cn5Ym_LS3sjbgqKdh59PBWxoTQyBwszzPT964g8';

async function main() {
  const query = \\\`
    query {
      trades_aggregate(where: { timestamp: { _gte: \"$START_TIME\" } }) {
        aggregate { count }
      }
    }
  \\\`;

  const res = await fetch(GEOMI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + API_KEY },
    body: JSON.stringify({ query }),
  });

  const data = await res.json();
  const count = data.data?.trades_aggregate?.aggregate?.count || 0;
  const tps = Math.round(count / $i);
  console.log(count + ',' + tps);
}
main();
" 2>/dev/null)

        TRADES=$(echo $TRADE_DATA | cut -d, -f1)
        TPS=$(echo $TRADE_DATA | cut -d, -f2)

        # Get worker stats
        W1_TPS=$(ssh -o ConnectTimeout=2 $WORKER1 "grep -E 'TPS:.*[0-9]' /tmp/hft-max-tps.log 2>/dev/null | tail -1 | grep -oE 'TPS: [0-9]+' | grep -oE '[0-9]+'" 2>/dev/null || echo "?")
        W2_TPS=$(ssh -o ConnectTimeout=2 $WORKER2 "grep -E 'TPS:.*[0-9]' /tmp/hft-max-tps.log 2>/dev/null | tail -1 | grep -oE 'TPS: [0-9]+' | grep -oE '[0-9]+'" 2>/dev/null || echo "?")
        W3_TPS=$(ssh -o ConnectTimeout=2 $WORKER3 "grep -E 'TPS:.*[0-9]' /tmp/hft-max-tps.log 2>/dev/null | tail -1 | grep -oE 'TPS: [0-9]+' | grep -oE '[0-9]+'" 2>/dev/null || echo "?")

        echo -e "  [${i}s] ${BOLD}${TRADES}${NC} trades | ${GREEN}${TPS} TPS${NC} (on-chain) | Workers: W1=${W1_TPS} W2=${W2_TPS} W3=${W3_TPS}"
    done

    echo ""

    # Final summary
    echo -e "${YELLOW}▶ Waiting 10s for final trades to index...${NC}"
    sleep 10

    FINAL_DATA=$(npx tsx -e "
const GEOMI_URL = 'https://api.testnet.aptoslabs.com/nocode/v1/api/cmk83k7ov0003s6017cgn7stm/v1/graphql';
const API_KEY = 'aptoslabs_9XPRa9Cn5Ym_LS3sjbgqKdh59PBWxoTQyBwszzPT964g8';

async function main() {
  const query = \\\`
    query {
      trades(where: { timestamp: { _gte: \"$START_TIME\" } }, limit: 50000) {
        market_address
      }
    }
  \\\`;

  const res = await fetch(GEOMI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + API_KEY },
    body: JSON.stringify({ query }),
  });

  const data = await res.json();
  const trades = data.data?.trades || [];

  const byMarket = {};
  for (const t of trades) {
    const prefix = t.market_address.slice(0, 10);
    byMarket[prefix] = (byMarket[prefix] || 0) + 1;
  }

  console.log('TOTAL:' + trades.length);
  console.log('TPS:' + Math.round(trades.length / $DURATION));
  for (const [m, c] of Object.entries(byMarket).sort((a,b) => b[1] - a[1])) {
    console.log('MARKET:' + m + ':' + c);
  }
}
main();
" 2>/dev/null)

    FINAL_TRADES=$(echo "$FINAL_DATA" | grep "TOTAL:" | cut -d: -f2)
    FINAL_TPS=$(echo "$FINAL_DATA" | grep "TPS:" | cut -d: -f2)

    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║${NC}  ${BOLD}📊 FINAL RESULTS${NC}                                            ${GREEN}║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "  ${BOLD}Total Trades:${NC}    ${FINAL_TRADES}"
    echo -e "  ${BOLD}Average TPS:${NC}     ${GREEN}${FINAL_TPS}${NC}"
    echo -e "  ${BOLD}Duration:${NC}        ${DURATION}s"
    echo ""
    echo -e "  ${BOLD}Market Distribution:${NC}"
    echo "$FINAL_DATA" | grep "MARKET:" | while read line; do
        MARKET=$(echo $line | cut -d: -f2)
        COUNT=$(echo $line | cut -d: -f3)
        echo -e "    ${MARKET}...: ${COUNT} trades"
    done
    echo ""
}

# ============================================
# MAIN EXECUTION
# ============================================

print_header
check_infrastructure

if [[ -n "$DRY_RUN" ]]; then
    echo -e "${YELLOW}DRY RUN - would start workers with above config${NC}"
    exit 0
fi

stop_workers
start_all_workers

echo -e "${YELLOW}▶ Waiting 15s for workers to initialize...${NC}"
sleep 15

monitor_tps

stop_workers

echo -e "${GREEN}✓ Max TPS run complete!${NC}"
echo ""
