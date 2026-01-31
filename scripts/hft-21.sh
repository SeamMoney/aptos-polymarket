#!/bin/bash
# =============================================================================
# HFT-21: Simple orchestrator for 21 HFT workers
# =============================================================================
#
# Usage:
#   ./scripts/hft-21.sh status          Check all workers
#   ./scripts/hft-21.sh start [N]       Start all workers for N seconds (default: 30)
#   ./scripts/hft-21.sh stop            Stop all workers
#   ./scripts/hft-21.sh restart         Restart all workers
#   ./scripts/hft-21.sh deploy          Deploy configs to all workers
#   ./scripts/hft-21.sh logs [N]        View logs from worker N (default: 1)
#

set -e

# All 21 worker IPs
ALL_IPS=(
  178.128.177.88    # W1  - Contract A
  167.99.164.45     # W2  - Contract A
  138.68.0.124      # W3  - Contract A
  138.197.221.123   # W4  - Contract A
  167.172.120.193   # W5  - Contract A
  138.68.22.167     # W6  - Contract A
  157.245.168.139   # W7  - Contract A
  206.189.160.224   # W8  - Contract B
  165.227.20.62     # W9  - Contract B
  165.227.4.56      # W10 - Contract B
  104.248.79.36     # W11 - Contract B
  165.227.27.110    # W12 - Contract B
  178.128.70.11     # W13 - Contract B
  138.197.196.42    # W14 - Contract B
  178.128.176.238   # W15 - Contract B
  178.128.75.159    # W16 - Contract B
  157.245.165.252   # W17 - Contract B
  64.227.62.177     # W18 - Contract B
  138.68.31.100     # W19 - Contract B
  64.225.127.89     # W20 - Contract B
  134.209.6.169     # W21 - Contract B
)

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

cmd_status() {
  echo ""
  echo -e "${CYAN}═══════════════════════════════════════════════════════════════════════${NC}"
  echo -e "${CYAN}  21-WORKER HFT STATUS${NC}"
  echo -e "${CYAN}═══════════════════════════════════════════════════════════════════════${NC}"
  echo ""
  printf "%-4s %-18s %-8s %-8s %-10s %s\n" "ID" "IP" "Status" "Threads" "Accounts" "Trading"
  echo "───────────────────────────────────────────────────────────────────────"

  total_accounts=0
  online_count=0

  for i in "${!ALL_IPS[@]}"; do
    ip="${ALL_IPS[$i]}"
    worker_num=$((i + 1))

    resp=$(curl -s --connect-timeout 3 "http://$ip:3001/status" 2>/dev/null || echo "")

    if [ -n "$resp" ]; then
      threads=$(echo "$resp" | jq -r '.workers.ready // 0')
      accounts=$(echo "$resp" | jq -r '.accounts.total // 0')
      running=$(echo "$resp" | jq -r '.isRunning // false')
      tps=$(echo "$resp" | jq -r '.stats.currentTps // 0')

      total_accounts=$((total_accounts + accounts))
      online_count=$((online_count + 1))

      if [ "$running" = "true" ]; then
        printf "%-4s %-18s ${GREEN}%-8s${NC} %-8s %-10s ${YELLOW}%s TPS${NC}\n" "W$worker_num" "$ip" "READY" "${threads}/2" "$accounts" "$tps"
      else
        printf "%-4s %-18s ${GREEN}%-8s${NC} %-8s %-10s %s\n" "W$worker_num" "$ip" "READY" "${threads}/2" "$accounts" "standby"
      fi
    else
      printf "%-4s %-18s ${RED}%-8s${NC} %-8s %-10s %s\n" "W$worker_num" "$ip" "OFFLINE" "-" "-" "-"
    fi
  done

  echo "───────────────────────────────────────────────────────────────────────"
  echo -e "  Total: ${GREEN}$online_count/21 workers${NC} | ${GREEN}$total_accounts accounts${NC}"
  echo ""
}

cmd_start() {
  local duration=${1:-30}
  echo ""
  echo -e "${CYAN}Starting all 21 workers for ${duration} seconds...${NC}"
  echo ""

  for ip in "${ALL_IPS[@]}"; do
    curl -s -X POST "http://$ip:3001/start?duration=$duration" > /dev/null 2>&1 &
  done
  wait

  echo -e "${GREEN}All workers started.${NC}"
  echo ""
  echo "Monitor with: ./scripts/hft-21.sh status"
}

cmd_stop() {
  echo ""
  echo -e "${CYAN}Stopping all 21 workers...${NC}"
  echo ""

  for ip in "${ALL_IPS[@]}"; do
    curl -s -X POST "http://$ip:3001/stop" > /dev/null 2>&1 &
  done
  wait

  echo -e "${GREEN}All workers stopped.${NC}"
}

cmd_restart() {
  echo ""
  echo -e "${CYAN}Restarting all 21 workers...${NC}"
  echo ""

  for i in "${!ALL_IPS[@]}"; do
    ip="${ALL_IPS[$i]}"
    worker_num=$((i + 1))
    echo -n "  W$worker_num ($ip): "

    ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no root@$ip "
      pkill -f 'hft-piscina-server' 2>/dev/null || true
      sleep 1
      cd /opt/aptos-hft && nohup ./start-hft.sh > /tmp/hft.log 2>&1 &
    " 2>/dev/null && echo -e "${GREEN}restarted${NC}" || echo -e "${RED}failed${NC}"
  done

  echo ""
  echo "Waiting 30 seconds for initialization..."
  sleep 30
  cmd_status
}

cmd_deploy() {
  echo ""
  echo -e "${CYAN}Deploying configs to all 21 workers...${NC}"
  echo ""

  # Source the config
  source "$(dirname "$0")/vm-configs-21/worker-configs.sh" 2>/dev/null

  for i in $(seq 1 21); do
    eval "config=\$WORKER_$i"
    IFS='|' read -r ip start count vfn contract_type <<< "$config"
    echo -n "  W$i ($ip): "

    # Deploy the pre-generated script
    scp -o ConnectTimeout=10 -o StrictHostKeyChecking=no \
      "$(dirname "$0")/vm-configs-21/start-hft-w${i}.sh" \
      root@$ip:/opt/aptos-hft/start-hft.sh 2>/dev/null && \
    ssh -o ConnectTimeout=5 root@$ip "chmod +x /opt/aptos-hft/start-hft.sh" 2>/dev/null && \
    echo -e "${GREEN}deployed${NC}" || echo -e "${RED}failed${NC}"
  done

  echo ""
  echo -e "${GREEN}Deployment complete.${NC}"
  echo "Run './scripts/hft-21.sh restart' to apply changes."
}

cmd_logs() {
  local worker_num=${1:-1}
  local ip="${ALL_IPS[$((worker_num - 1))]}"

  echo ""
  echo -e "${CYAN}Logs from W$worker_num ($ip):${NC}"
  echo "───────────────────────────────────────────────────────────────────────"
  ssh -o ConnectTimeout=10 root@$ip "tail -50 /tmp/hft.log" 2>/dev/null || echo "Failed to fetch logs"
}

cmd_help() {
  echo ""
  echo -e "${CYAN}HFT-21: 21-Worker Orchestrator${NC}"
  echo ""
  echo "Usage:"
  echo "  ./scripts/hft-21.sh status          Check all workers"
  echo "  ./scripts/hft-21.sh start [N]       Start all for N seconds (default: 30)"
  echo "  ./scripts/hft-21.sh stop            Stop all workers"
  echo "  ./scripts/hft-21.sh restart         Restart all workers"
  echo "  ./scripts/hft-21.sh deploy          Deploy configs from repo"
  echo "  ./scripts/hft-21.sh logs [N]        View logs from worker N"
  echo ""
  echo "Quick commands:"
  echo "  ./scripts/hft-21.sh status && ./scripts/hft-21.sh start 60"
  echo ""
}

case "${1:-help}" in
  status)  cmd_status ;;
  start)   cmd_start "${2:-30}" ;;
  stop)    cmd_stop ;;
  restart) cmd_restart ;;
  deploy)  cmd_deploy ;;
  logs)    cmd_logs "${2:-1}" ;;
  *)       cmd_help ;;
esac
