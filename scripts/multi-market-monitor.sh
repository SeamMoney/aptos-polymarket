#!/bin/bash
#
# MULTI-MARKET TPS MONITOR
# ========================
#
# Shows TPS breakdown per market and worker status
#
# Usage:
#   ./scripts/multi-market-monitor.sh
#   ./scripts/multi-market-monitor.sh --watch   # Auto-refresh every 5s
#

WORKER1="root@178.128.177.88"
WORKER2="root@147.182.237.239"
WORKER3="root@161.35.231.0"

WATCH=${1:-""}

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

function show_stats() {
    clear
    echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${NC}  ${BOLD}📊 MULTI-MARKET TPS MONITOR${NC}                                 ${CYAN}║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "  ${BOLD}Time:${NC} $(date '+%H:%M:%S')"
    echo ""

    # Get stats from each worker
    echo -e "${YELLOW}═══ WORKER 1 (178.128.177.88) - MASTER ═══${NC}"
    ssh -o ConnectTimeout=3 $WORKER1 "tail -30 /tmp/hft.log 2>/dev/null | grep -E 'TPS|MULTI-MARKET|trades|Market:' | tail -5" 2>/dev/null || echo "  (not responding)"
    echo ""

    echo -e "${YELLOW}═══ WORKER 2 (147.182.237.239) ═══${NC}"
    ssh -o ConnectTimeout=3 $WORKER2 "tail -30 /tmp/hft.log 2>/dev/null | grep -E 'TPS|MULTI-MARKET|trades|Market:' | tail -5" 2>/dev/null || echo "  (not responding)"
    echo ""

    echo -e "${YELLOW}═══ WORKER 3 (161.35.231.0) ═══${NC}"
    ssh -o ConnectTimeout=3 $WORKER3 "tail -30 /tmp/hft.log 2>/dev/null | grep -E 'TPS|MULTI-MARKET|trades|Market:' | tail -5" 2>/dev/null || echo "  (not responding)"
    echo ""

    # Calculate combined TPS
    echo -e "${GREEN}═══ COMBINED STATS ═══${NC}"

    W1_TPS=$(ssh -o ConnectTimeout=3 $WORKER1 "grep 'HFT STATS' /tmp/hft.log 2>/dev/null | tail -1 | grep -oE 'TPS: [0-9]+' | grep -oE '[0-9]+'" 2>/dev/null || echo "0")
    W2_TPS=$(ssh -o ConnectTimeout=3 $WORKER2 "grep 'HFT STATS' /tmp/hft.log 2>/dev/null | tail -1 | grep -oE 'TPS: [0-9]+' | grep -oE '[0-9]+'" 2>/dev/null || echo "0")
    W3_TPS=$(ssh -o ConnectTimeout=3 $WORKER3 "grep 'HFT STATS' /tmp/hft.log 2>/dev/null | tail -1 | grep -oE 'TPS: [0-9]+' | grep -oE '[0-9]+'" 2>/dev/null || echo "0")

    TOTAL_TPS=$((${W1_TPS:-0} + ${W2_TPS:-0} + ${W3_TPS:-0}))

    echo -e "  Worker 1: ${CYAN}${W1_TPS:-0}${NC} TPS"
    echo -e "  Worker 2: ${CYAN}${W2_TPS:-0}${NC} TPS"
    echo -e "  Worker 3: ${CYAN}${W3_TPS:-0}${NC} TPS"
    echo -e "  ${BOLD}TOTAL: ${GREEN}${TOTAL_TPS}${NC} TPS${NC}"
    echo ""

    # Show market distribution from Geomi (if available)
    echo -e "${CYAN}═══ GEOMI TRADE DISTRIBUTION ═══${NC}"
    npx tsx -e "
const GEOMI_URL = 'https://api.testnet.aptoslabs.com/nocode/v1/api/cmk83k7ov0003s6017cgn7stm/v1/graphql';
const API_KEY = 'aptoslabs_9XPRa9Cn5Ym_LS3sjbgqKdh59PBWxoTQyBwszzPT964g8';

async function main() {
  const query = \`query { trades(limit: 100, order_by: {timestamp: desc}) { market_address } }\`;
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
  for (const [market, count] of Object.entries(byMarket)) {
    console.log('  ' + market + '...: ' + count + ' trades');
  }
  console.log('  Total: ' + trades.length + ' (last 100)');
}
main().catch(() => console.log('  (Geomi unavailable)'));
" 2>/dev/null
    echo ""

    if [ "$WATCH" = "--watch" ]; then
        echo -e "${BOLD}Auto-refreshing every 5s. Press Ctrl+C to stop.${NC}"
    fi
}

if [ "$WATCH" = "--watch" ]; then
    while true; do
        show_stats
        sleep 5
    done
else
    show_stats
fi
