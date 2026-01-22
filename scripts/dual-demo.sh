#!/bin/bash
#
# DUAL TPS DEMO - Run AMM Trading + USD1 Transfers Simultaneously
# ================================================================
#
# This script runs both demos in parallel to show combined TPS on the dashboard.
#
# Account Split (500 total):
#   - AMM Trading: accounts 0-332 (333 accounts)
#   - USD1 Transfers: accounts 333-499 (167 accounts = 83 senders + 84 recipients)
#
# Usage:
#   ./scripts/dual-demo.sh [duration]         # Run both demos (default: 60s)
#   ./scripts/dual-demo.sh servers            # Start servers and wait (for manual trigger)
#   ./scripts/dual-demo.sh trigger [duration] # Trigger running servers
#   ./scripts/dual-demo.sh stop               # Stop servers
#
# Examples:
#   ./scripts/dual-demo.sh 60                 # Run both for 60 seconds (auto-start)
#   ./scripts/dual-demo.sh servers            # Start servers in standby mode
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Ports
AMM_PORT=3001
TRANSFER_PORT=3002

# Default duration
DURATION=${1:-60}
if [[ "$1" == "servers" ]] || [[ "$1" == "trigger" ]] || [[ "$1" == "stop" ]] || [[ "$1" == "status" ]]; then
  DURATION=${2:-60}
fi

# Load environment
if [ -f .env.seed ]; then
  export $(grep -v '^#' .env.seed | xargs)
fi

print_banner() {
  echo ""
  echo -e "${CYAN}╔══════════════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${CYAN}║${NC}         ${BOLD}DUAL TPS DEMO - AMM Trading + USD1 Transfers${NC}              ${CYAN}║${NC}"
  echo -e "${CYAN}╠══════════════════════════════════════════════════════════════════════╣${NC}"
  echo -e "${CYAN}║${NC}  Account Split:                                                      ${CYAN}║${NC}"
  echo -e "${CYAN}║${NC}    ${GREEN}AMM Trading${NC}:    accounts 0-332    (333 accounts)                ${CYAN}║${NC}"
  echo -e "${CYAN}║${NC}    ${GREEN}USD1 Transfers${NC}: accounts 333-499  (83 + 84 pairs)               ${CYAN}║${NC}"
  echo -e "${CYAN}╚══════════════════════════════════════════════════════════════════════╝${NC}"
  echo ""
}

print_status() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
  echo -e "${GREEN}[OK]${NC} $1"
}

print_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

# Check if server is running
check_server() {
  local port=$1
  curl -s "http://localhost:$port/health" > /dev/null 2>&1
}

# Get stats from AMM server
get_amm_stats() {
  curl -s "http://localhost:$AMM_PORT/stats" 2>/dev/null || echo '{}'
}

# Combined stats display
show_combined_stats() {
  local elapsed=$1
  local amm_stats=$(get_amm_stats)

  local amm_tps=$(echo $amm_stats | jq -r '.currentTps // 0' 2>/dev/null || echo "0")
  local amm_success=$(echo $amm_stats | jq -r '.successfulTrades // 0' 2>/dev/null || echo "0")
  local amm_failed=$(echo $amm_stats | jq -r '.failedTrades // 0' 2>/dev/null || echo "0")

  echo -e "[${elapsed}s] AMM: ${GREEN}$amm_tps TPS${NC} | Success: $amm_success | Failed: $amm_failed"
}

# Run both demos (simple mode - just run in parallel)
cmd_run() {
  print_banner

  print_status "Starting DUAL DEMO for ${DURATION} seconds..."
  echo ""

  # Create log directory
  mkdir -p /tmp/dual-demo

  # Ensure clean state
  pkill -f "hft-piscina-server" 2>/dev/null || true
  pkill -f "transfer-tps-server" 2>/dev/null || true
  sleep 2

  echo -e "${YELLOW}Starting AMM Trading Server (accounts 0-332)...${NC}"

  # Start AMM server (has HTTP API)
  ACCOUNT_COUNT=333 \
  ACCOUNT_START_INDEX=0 \
  PORT=$AMM_PORT \
  RPC_MODE=internal \
  npx tsx server/hft-piscina-server.ts turbo > /tmp/dual-demo/amm.log 2>&1 &
  AMM_PID=$!
  echo $AMM_PID > /tmp/dual-demo/amm.pid

  echo -e "${YELLOW}Starting USD1 Transfer Demo (accounts 333-499)...${NC}"

  # Start transfer demo (runs immediately for DURATION)
  ACCOUNTS=83 \
  ACCOUNT_START_INDEX=333 \
  DURATION=$DURATION \
  TOKEN_TYPE=usd1 \
  VFN_URL="http://vfn0.usce1-0.testnet.aptoslabs.com:80/v1" \
  npx tsx server/transfer-tps-server.ts turbo > /tmp/dual-demo/transfer.log 2>&1 &
  TRANSFER_PID=$!
  echo $TRANSFER_PID > /tmp/dual-demo/transfer.pid

  echo ""
  print_status "Waiting for servers to initialize (30s)..."
  sleep 30

  # Trigger AMM server
  if check_server $AMM_PORT; then
    print_status "Triggering AMM Trading Server..."
    curl -s -X POST "http://localhost:$AMM_PORT/start?duration=$DURATION" > /dev/null
    print_success "AMM server triggered!"
  else
    print_error "AMM server failed to start. Check /tmp/dual-demo/amm.log"
    cat /tmp/dual-demo/amm.log | tail -20
    exit 1
  fi

  echo ""
  echo -e "${CYAN}══════════════════════════════════════════════════════════════════${NC}"
  echo -e "${BOLD}                  RUNNING DUAL DEMO (${DURATION}s)${NC}"
  echo -e "${CYAN}══════════════════════════════════════════════════════════════════${NC}"
  echo ""

  # Monitor progress
  for i in $(seq 5 5 $DURATION); do
    sleep 5
    show_combined_stats $i
  done

  echo ""
  echo -e "${CYAN}══════════════════════════════════════════════════════════════════${NC}"
  echo -e "${BOLD}                     DEMO COMPLETE${NC}"
  echo -e "${CYAN}══════════════════════════════════════════════════════════════════${NC}"
  echo ""

  # Wait for processes to finish
  sleep 5

  # Show final stats
  echo -e "${YELLOW}Final AMM Stats:${NC}"
  get_amm_stats | jq '.' 2>/dev/null || echo "unavailable"

  echo ""
  echo -e "${YELLOW}Transfer Demo Results (from log):${NC}"
  grep -A 20 "RESULTS" /tmp/dual-demo/transfer.log 2>/dev/null | head -25 || echo "Check /tmp/dual-demo/transfer.log"

  echo ""
  print_status "Analyze on-chain results with:"
  echo "  npx tsx scripts/analyze-tps.ts --minutes 3"

  # Cleanup
  cmd_stop_quiet
}

# Start servers in standby mode (for manual triggering)
cmd_servers() {
  print_banner

  print_status "Starting servers in STANDBY mode..."
  echo ""

  # Ensure clean state
  pkill -f "hft-piscina-server" 2>/dev/null || true
  sleep 2

  mkdir -p /tmp/dual-demo

  echo -e "${YELLOW}Starting AMM Trading Server (port $AMM_PORT)...${NC}"

  ACCOUNT_COUNT=333 \
  ACCOUNT_START_INDEX=0 \
  PORT=$AMM_PORT \
  RPC_MODE=internal \
  npx tsx server/hft-piscina-server.ts turbo > /tmp/dual-demo/amm.log 2>&1 &
  echo $! > /tmp/dual-demo/amm.pid

  print_status "Waiting for server to initialize (30s)..."
  sleep 30

  if check_server $AMM_PORT; then
    print_success "AMM server ready on port $AMM_PORT"
  else
    print_error "AMM server failed to start"
    exit 1
  fi

  echo ""
  echo -e "${YELLOW}To trigger the demo:${NC}"
  echo "  curl -X POST \"http://localhost:$AMM_PORT/start?duration=60\""
  echo ""
  echo -e "${YELLOW}Note:${NC} For full dual-demo, run: ./scripts/dual-demo.sh 60"
  echo "  (This starts both AMM + USD1 transfers simultaneously)"
}

cmd_trigger() {
  if ! check_server $AMM_PORT; then
    print_error "AMM server not running. Start with: ./scripts/dual-demo.sh servers"
    exit 1
  fi

  print_status "Triggering AMM demo for ${DURATION}s..."
  curl -s -X POST "http://localhost:$AMM_PORT/start?duration=$DURATION" | jq '.'

  echo ""
  print_status "Monitoring..."
  for i in $(seq 5 5 $DURATION); do
    sleep 5
    show_combined_stats $i
  done
}

cmd_stop() {
  print_status "Stopping demo servers..."

  if [ -f /tmp/dual-demo/amm.pid ]; then
    kill $(cat /tmp/dual-demo/amm.pid) 2>/dev/null || true
    rm -f /tmp/dual-demo/amm.pid
  fi

  if [ -f /tmp/dual-demo/transfer.pid ]; then
    kill $(cat /tmp/dual-demo/transfer.pid) 2>/dev/null || true
    rm -f /tmp/dual-demo/transfer.pid
  fi

  pkill -f "hft-piscina-server" 2>/dev/null || true
  pkill -f "transfer-tps-server" 2>/dev/null || true

  print_success "Servers stopped"
}

cmd_stop_quiet() {
  if [ -f /tmp/dual-demo/amm.pid ]; then
    kill $(cat /tmp/dual-demo/amm.pid) 2>/dev/null || true
    rm -f /tmp/dual-demo/amm.pid
  fi
  pkill -f "hft-piscina-server" 2>/dev/null || true
}

cmd_status() {
  echo ""
  echo -e "${YELLOW}Server Status:${NC}"

  if check_server $AMM_PORT; then
    echo -e "  AMM Server (port $AMM_PORT): ${GREEN}RUNNING${NC}"
    get_amm_stats | jq '{tps: .currentTps, success: .successfulTrades, rate: .successRate}' 2>/dev/null || true
  else
    echo -e "  AMM Server (port $AMM_PORT): ${RED}STOPPED${NC}"
  fi

  echo ""
}

cmd_help() {
  print_banner

  echo "Usage:"
  echo "  ./scripts/dual-demo.sh [duration]         Run both demos (default: 60s)"
  echo "  ./scripts/dual-demo.sh servers            Start AMM server in standby"
  echo "  ./scripts/dual-demo.sh trigger [duration] Trigger running server"
  echo "  ./scripts/dual-demo.sh stop               Stop all servers"
  echo "  ./scripts/dual-demo.sh status             Check status"
  echo "  ./scripts/dual-demo.sh help               Show this help"
  echo ""
  echo "Quick Start:"
  echo "  ./scripts/dual-demo.sh 60"
  echo ""
  echo "Account Split:"
  echo "  - AMM Trading:    accounts 0-332    (333 accounts)"
  echo "  - USD1 Transfers: accounts 333-499  (83 senders + 84 recipients)"
  echo ""
  echo "Logs:"
  echo "  /tmp/dual-demo/amm.log"
  echo "  /tmp/dual-demo/transfer.log"
}

# Main
case "${1:-}" in
  servers) cmd_servers ;;
  trigger) cmd_trigger ;;
  stop)    cmd_stop ;;
  status)  cmd_status ;;
  help|-h|--help) cmd_help ;;
  *)
    if [[ "$1" =~ ^[0-9]+$ ]]; then
      DURATION=$1
      cmd_run
    else
      cmd_help
    fi
    ;;
esac
