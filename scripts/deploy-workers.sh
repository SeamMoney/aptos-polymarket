#!/bin/bash
#
# Deploy and Verify Worker Code
#
# This script ensures ALL workers get the correct compiled code and verifies it's loaded.
#
# Usage:
#   ./scripts/deploy-workers.sh              # Full deploy + verify + quick test
#   ./scripts/deploy-workers.sh --build-only # Just rebuild locally
#   ./scripts/deploy-workers.sh --verify     # Just verify workers have correct code
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Worker IPs
WORKERS=(
  "178.128.177.88"   # Worker 1: accounts 0-1666
  "167.99.164.45"    # Worker 2: accounts 1667-3333
  "138.68.0.124"     # Worker 3: accounts 3334-4999
)

# Version marker - UPDATE THIS when making code changes
VERSION="2026-01-29-v3"

print_header() {
  echo ""
  echo -e "${CYAN}══════════════════════════════════════════════════════════════${NC}"
  echo -e "${CYAN}  $1${NC}"
  echo -e "${CYAN}══════════════════════════════════════════════════════════════${NC}"
}

print_status() {
  echo -e "${GREEN}✓${NC} $1"
}

print_error() {
  echo -e "${RED}✗${NC} $1"
}

print_warning() {
  echo -e "${YELLOW}!${NC} $1"
}

# Step 1: Rebuild the worker code
build_worker() {
  print_header "STEP 1: REBUILDING WORKER CODE"

  echo "Building trading-worker.js with esbuild..."

  # Add version marker to the code
  VERSION_LINE="console.log('[WORKER_VERSION] $VERSION');"

  # Check if version marker exists and update it
  if grep -q "WORKER_VERSION" server/trading-worker.ts; then
    # Update existing version
    sed -i.bak "s/console.log('\[WORKER_VERSION\].*');/console.log('[WORKER_VERSION] $VERSION');/" server/trading-worker.ts
    rm -f server/trading-worker.ts.bak
  else
    # Add version marker after the first comment block
    sed -i.bak "s/\(Started by: hft-piscina-server.ts using worker_threads\)/\1\n \*\/\n$VERSION_LINE\n\/\*\*/" server/trading-worker.ts
    rm -f server/trading-worker.ts.bak
  fi

  # Build with esbuild
  npx esbuild server/trading-worker.ts \
    --bundle \
    --platform=node \
    --outfile=server/trading-worker.js \
    --format=esm \
    --external:@aptos-labs/ts-sdk \
    --external:bip39 \
    --external:@scure/bip32

  if [ $? -eq 0 ]; then
    print_status "Built trading-worker.js ($(wc -c < server/trading-worker.js | tr -d ' ') bytes)"
    print_status "Version: $VERSION"
  else
    print_error "Build failed!"
    exit 1
  fi
}

# Step 2: Deploy to all workers
deploy_to_workers() {
  print_header "STEP 2: DEPLOYING TO ALL WORKERS"

  local failed=0

  for ip in "${WORKERS[@]}"; do
    echo -n "  Deploying to $ip... "

    # Deploy both .ts and .js files
    if scp -o ConnectTimeout=10 -o StrictHostKeyChecking=no \
        server/trading-worker.js \
        server/trading-worker.ts \
        server/hft-piscina-server.ts \
        root@$ip:/opt/aptos-hft/server/ 2>/dev/null; then
      echo -e "${GREEN}OK${NC}"
    else
      echo -e "${RED}FAILED${NC}"
      failed=$((failed + 1))
    fi
  done

  if [ $failed -gt 0 ]; then
    print_error "$failed worker(s) failed to receive code"
    exit 1
  fi

  print_status "Code deployed to all ${#WORKERS[@]} workers"
}

# Step 3: Restart all workers
restart_workers() {
  print_header "STEP 3: RESTARTING ALL WORKERS"

  echo "Stopping all workers..."
  for ip in "${WORKERS[@]}"; do
    # Try graceful stop first, then force kill
    curl -s --max-time 3 -X POST "http://$ip:3001/stop" 2>/dev/null &
  done
  wait
  sleep 2

  for ip in "${WORKERS[@]}"; do
    ssh -o ConnectTimeout=5 root@$ip 'pkill -9 node 2>/dev/null; pkill -9 tsx 2>/dev/null' 2>/dev/null &
  done
  wait
  sleep 3

  echo "Starting all workers..."
  for ip in "${WORKERS[@]}"; do
    ssh -o ConnectTimeout=10 root@$ip \
      'cd /opt/aptos-hft && nohup ./start-hft.sh > /tmp/hft.log 2>&1 &' 2>/dev/null &
  done
  wait

  echo "Waiting for workers to initialize (35s)..."
  sleep 35

  print_status "All workers restarted"
}

# Step 4: Verify correct version is loaded
verify_version() {
  print_header "STEP 4: VERIFYING CODE VERSION"

  local all_ok=true

  for ip in "${WORKERS[@]}"; do
    echo -n "  $ip: "

    # Check if worker is responding
    local status=$(curl -s --max-time 5 "http://$ip:3001/status" 2>/dev/null)
    if [ -z "$status" ]; then
      echo -e "${RED}NOT RESPONDING${NC}"
      all_ok=false
      continue
    fi

    # Check version in logs
    local loaded_version=$(ssh -o ConnectTimeout=10 root@$ip \
      "grep 'WORKER_VERSION' /tmp/hft.log 2>/dev/null | tail -1 | grep -o '$VERSION'" 2>/dev/null)

    if [ "$loaded_version" = "$VERSION" ]; then
      local accounts=$(echo "$status" | jq -r '.accounts.total')
      local workers=$(echo "$status" | jq -r '.workers.ready')
      echo -e "${GREEN}v$VERSION${NC} | $accounts accounts | $workers workers"
    else
      echo -e "${RED}WRONG VERSION (expected $VERSION)${NC}"
      all_ok=false
    fi
  done

  if [ "$all_ok" = true ]; then
    print_status "All workers running correct version: $VERSION"
  else
    print_error "Version mismatch detected! Re-run deploy."
    exit 1
  fi
}

# Step 5: Quick trading test
quick_test() {
  print_header "STEP 5: QUICK TRADING TEST (10s)"

  echo "Starting 10-second test on all workers..."
  for ip in "${WORKERS[@]}"; do
    curl -s -X POST "http://$ip:3001/start?duration=10" 2>/dev/null &
  done
  wait

  sleep 12

  echo ""
  echo "Results:"
  local total_success=0
  local all_working=true

  for ip in "${WORKERS[@]}"; do
    local result=$(curl -s --max-time 5 "http://$ip:3001/status" 2>/dev/null)
    if [ -n "$result" ]; then
      local success=$(echo "$result" | jq -r '.stats.successfulTrades // 0')
      local failed=$(echo "$result" | jq -r '.stats.failedTrades // 0')
      local rate=$(echo "$result" | jq -r '.stats.successRate // "0"')
      total_success=$((total_success + success))

      if [ "$success" -gt 0 ]; then
        echo -e "  $ip: ${GREEN}$success trades${NC} | $rate% success"
      else
        echo -e "  $ip: ${RED}0 trades${NC} - PROBLEM!"
        all_working=false
      fi
    else
      echo -e "  $ip: ${RED}NOT RESPONDING${NC}"
      all_working=false
    fi
  done

  echo ""
  if [ "$all_working" = true ] && [ $total_success -gt 0 ]; then
    print_status "All workers trading successfully! Total: $total_success trades"
    echo ""
    echo -e "${GREEN}══════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  DEPLOYMENT SUCCESSFUL - ALL WORKERS VERIFIED${NC}"
    echo -e "${GREEN}══════════════════════════════════════════════════════════════${NC}"
  else
    print_error "Some workers failed to trade!"
    echo ""
    echo "Troubleshooting:"
    echo "  1. Check logs: ssh root@<ip> 'tail -100 /tmp/hft.log'"
    echo "  2. Check RPC: ssh root@<ip> 'curl -s http://aptos.cash.trading:8080/v1'"
    echo "  3. Re-run: ./scripts/deploy-workers.sh"
    exit 1
  fi
}

# Main
case "${1:-}" in
  --build-only)
    build_worker
    ;;
  --verify)
    verify_version
    ;;
  --restart)
    restart_workers
    verify_version
    ;;
  --test)
    quick_test
    ;;
  *)
    # Full deployment
    build_worker
    deploy_to_workers
    restart_workers
    verify_version
    quick_test
    ;;
esac
