#!/bin/bash
#
# Quick Worker Status Check
#
# Usage:
#   ./scripts/worker-status.sh          # Check all workers
#   ./scripts/worker-status.sh --logs   # Also show recent logs
#

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

WORKERS=(
  "178.128.177.88"
  "167.99.164.45"
  "138.68.0.124"
)

WORKER_NAMES=(
  "Worker 1 (0-1666)"
  "Worker 2 (1667-3333)"
  "Worker 3 (3334-4999)"
)

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  WORKER STATUS                                                        ${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════════${NC}"
echo ""

all_ok=true
total_accounts=0

for i in "${!WORKERS[@]}"; do
  ip="${WORKERS[$i]}"
  name="${WORKER_NAMES[$i]}"

  # Get status
  result=$(curl -s --max-time 5 "http://$ip:3001/status" 2>/dev/null)

  if [ -n "$result" ]; then
    accounts=$(echo "$result" | jq -r '.accounts.total // 0')
    workers=$(echo "$result" | jq -r '.workers.ready // 0')
    running=$(echo "$result" | jq -r '.isRunning // false')
    mode=$(echo "$result" | jq -r '.mode // "unknown"')

    total_accounts=$((total_accounts + accounts))

    if [ "$running" = "true" ]; then
      tps=$(echo "$result" | jq -r '.stats.currentTps // 0')
      success=$(echo "$result" | jq -r '.stats.successfulTrades // 0')
      rate=$(echo "$result" | jq -r '.stats.successRate // "0"')
      echo -e "  ${GREEN}●${NC} $name"
      echo -e "    IP: $ip | Mode: $mode | Accounts: $accounts"
      echo -e "    ${YELLOW}TRADING${NC}: $tps TPS | $success trades | $rate% success"
    else
      echo -e "  ${GREEN}●${NC} $name"
      echo -e "    IP: $ip | Mode: $mode | Accounts: $accounts | Workers: $workers"
      echo -e "    Status: ${GREEN}READY${NC} (standby)"
    fi

    # Get version from logs
    version=$(ssh -o ConnectTimeout=5 root@$ip "grep 'WORKER_VERSION' /tmp/hft.log 2>/dev/null | tail -1" 2>/dev/null | grep -o '\[WORKER_VERSION\].*' || echo "unknown")
    echo -e "    Version: $version"
  else
    echo -e "  ${RED}●${NC} $name"
    echo -e "    IP: $ip"
    echo -e "    Status: ${RED}NOT RESPONDING${NC}"
    all_ok=false
  fi
  echo ""
done

echo -e "${CYAN}───────────────────────────────────────────────────────────────────────${NC}"
if [ "$all_ok" = true ]; then
  echo -e "  Total Accounts: ${GREEN}$total_accounts${NC}"
  echo -e "  Status: ${GREEN}ALL WORKERS ONLINE${NC}"
else
  echo -e "  Status: ${RED}SOME WORKERS OFFLINE${NC}"
  echo ""
  echo "  Fix with: ./scripts/deploy-workers.sh"
fi
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════════${NC}"
echo ""

# Show logs if requested
if [ "$1" = "--logs" ]; then
  for i in "${!WORKERS[@]}"; do
    ip="${WORKERS[$i]}"
    name="${WORKER_NAMES[$i]}"
    echo -e "${CYAN}=== $name ($ip) - Last 20 log lines ===${NC}"
    ssh -o ConnectTimeout=5 root@$ip 'tail -20 /tmp/hft.log' 2>/dev/null || echo "Could not fetch logs"
    echo ""
  done
fi
