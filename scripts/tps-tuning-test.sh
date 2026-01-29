#!/bin/bash
#
# TPS Tuning Test Script
#
# Systematically tests different configurations to maximize TPS.
# Each test runs for 30 seconds and reports results.
#
# Usage:
#   ./scripts/tps-tuning-test.sh                    # Run all tests
#   ./scripts/tps-tuning-test.sh --test <name>      # Run specific test
#   ./scripts/tps-tuning-test.sh --current          # Test current config
#

set -e

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

DURATION=30
RESULTS_FILE="/tmp/tps-tuning-results.csv"

print_header() {
  echo ""
  echo -e "${CYAN}══════════════════════════════════════════════════════════════${NC}"
  echo -e "${CYAN}  $1${NC}"
  echo -e "${CYAN}══════════════════════════════════════════════════════════════${NC}"
}

# Update worker config and restart
update_worker_config() {
  local ip=$1
  local worker_count=$2
  local account_concurrency=$3
  local mode=$4
  local account_start=$5
  local account_count=$6

  ssh -o ConnectTimeout=10 root@$ip "cat > /opt/aptos-hft/start-hft.sh << 'EOFSCRIPT'
#!/bin/bash
export SEED_MNEMONIC=\"venture advance oval deliver profit drill chaos cabbage rapid tag south once rifle call flavor vague sword float town vault calm such grocery elder\"
export ACCOUNT_START_INDEX=$account_start
export ACCOUNT_COUNT=$account_count
export WORKER_COUNT=$worker_count
export ACCOUNT_CONCURRENCY=$account_concurrency
export USE_ORDERLESS=false
export RPC_MODE=custom
export FULLNODE_URL=\"http://aptos.cash.trading:8080/v1\"
export CONTRACT_ADDRESS=\"0xca4d40eae9f07fb28a121862d649203fb4335ece9536ee51790e19f812ff7aea\"
export USD1_METADATA=\"0x14b1ec8a5f31554d0cd19c390be83444ed519be2d7108c3e27dcbc4230c01fa3\"
export MULTI_MARKETS=\"0xaf561030c7ebb22b1d8b99b727c27caab1f6944ce39c141fd2b6b0cfbf614a9e,0xa4ee321c4c642e7b5a3e27b9820f2be4c17a1add79f8129122289fca2c3ca7c3,0xf85c7010d966bc6c3417e52a9b4d86b5f36117e51b43bf5c7a92f0468bac5497,0xcbdddcf6206d2b5956b6c7c6a10d4ac1d6253a2c1c151e8b3af113d8e940f01f,0xe128c8f16a0f07f48c69a38ac75868a2d5fdd9fbf3299958e9b1e2994a0b9f57,0x00f60c218d500eb76c66a4a7fb6c6e5664847d5e9496016000fc953b5a89f6eb,0x287968f6d26efbd291960455ce14e3723a48d32b3dc0a8c545d4603fe842e30f,0xa594c8df003cd232043b34beefe020af744f378ec367a7f65b89e306e06baacb,0x310ccec449c57bf8972feab19c5cb8ba5004e2934e4fa1bd565fdbd1a44f4008,0x8172b2cf4ba365d72fca8b899a54d3c9e2539d63bd2283aca55c0d032fc793f6,0xa550234b5784656e3f3d060134e36ab9a0eecc436d182452955c995984b3e67a,0x9dc3b78821f64119671d7918b824b3b3c4b0e2124643ebe6b1e587efe9591202,0xf508498afdecb2a2f6b40912efb1611b9fe9725e9c35521be5ff2bba3c187efa,0x289aabd338cf7a2bc48512927775b5e1218b15bd83c3c740c3ec43faccef5b21,0x8c4f0da1238adb4486d2a62ff08c85af331e022c1446445059059918d4361cd3\"
export PORT=3001
cd /opt/aptos-hft
npx tsx server/hft-piscina-server.ts $mode
EOFSCRIPT
chmod +x /opt/aptos-hft/start-hft.sh" 2>/dev/null
}

# Restart all workers with current config
restart_workers() {
  echo "Stopping workers..."
  for ip in "${WORKERS[@]}"; do
    curl -s --max-time 3 -X POST "http://$ip:3001/stop" 2>/dev/null &
    ssh -o ConnectTimeout=5 root@$ip 'pkill -9 node 2>/dev/null' 2>/dev/null &
  done
  wait
  sleep 3

  echo "Starting workers..."
  for ip in "${WORKERS[@]}"; do
    ssh -o ConnectTimeout=10 root@$ip 'cd /opt/aptos-hft && nohup ./start-hft.sh > /tmp/hft.log 2>&1 &' 2>/dev/null &
  done
  wait

  echo "Waiting for initialization (40s)..."
  sleep 40

  # Verify all workers ready
  for ip in "${WORKERS[@]}"; do
    local status=$(curl -s --max-time 5 "http://$ip:3001/status" 2>/dev/null)
    if [ -z "$status" ]; then
      echo -e "${RED}Worker $ip not ready!${NC}"
      return 1
    fi
  done
  echo -e "${GREEN}All workers ready${NC}"
}

# Run a test and collect results
run_test() {
  local test_name=$1
  local worker_count=$2
  local account_concurrency=$3
  local mode=$4

  print_header "TEST: $test_name"
  echo "Config: WORKER_COUNT=$worker_count, ACCOUNT_CONCURRENCY=$account_concurrency, MODE=$mode"

  # Update configs
  update_worker_config "${WORKERS[0]}" $worker_count $account_concurrency $mode 0 1667
  update_worker_config "${WORKERS[1]}" $worker_count $account_concurrency $mode 1667 1667
  update_worker_config "${WORKERS[2]}" $worker_count $account_concurrency $mode 3334 1666

  # Restart
  if ! restart_workers; then
    echo "Failed to start workers, skipping test"
    return 1
  fi

  # Run test
  echo "Starting ${DURATION}s test..."
  for ip in "${WORKERS[@]}"; do
    curl -s -X POST "http://$ip:3001/start?duration=$DURATION" 2>/dev/null &
  done
  wait

  # Monitor
  sleep $((DURATION + 5))

  # Collect results
  local total_success=0
  local total_failed=0
  local peak_tps=0

  for ip in "${WORKERS[@]}"; do
    local result=$(curl -s --max-time 5 "http://$ip:3001/status" 2>/dev/null)
    if [ -n "$result" ]; then
      local success=$(echo "$result" | jq -r '.stats.successfulTrades // 0')
      local failed=$(echo "$result" | jq -r '.stats.failedTrades // 0')
      local peak=$(echo "$result" | jq -r '.stats.peakTps // 0')
      total_success=$((total_success + success))
      total_failed=$((total_failed + failed))
      if [ "$peak" -gt "$peak_tps" ]; then
        peak_tps=$peak
      fi
    fi
  done

  local avg_tps=$((total_success / DURATION))
  local success_rate=0
  if [ $((total_success + total_failed)) -gt 0 ]; then
    success_rate=$(echo "scale=1; $total_success * 100 / ($total_success + $total_failed)" | bc)
  fi

  echo ""
  echo -e "${GREEN}Results:${NC}"
  echo "  Total Trades: $total_success"
  echo "  Failed: $total_failed"
  echo "  Avg TPS: $avg_tps"
  echo "  Peak TPS: $peak_tps"
  echo "  Success Rate: ${success_rate}%"

  # Save to CSV
  echo "$test_name,$worker_count,$account_concurrency,$mode,$total_success,$total_failed,$avg_tps,$peak_tps,$success_rate" >> "$RESULTS_FILE"
}

# Initialize results file
init_results() {
  echo "test_name,worker_count,account_concurrency,mode,total_success,total_failed,avg_tps,peak_tps,success_rate" > "$RESULTS_FILE"
}

# Show all results
show_results() {
  print_header "ALL RESULTS"
  if [ -f "$RESULTS_FILE" ]; then
    column -t -s',' "$RESULTS_FILE"
  else
    echo "No results yet"
  fi
}

# Test configurations
run_all_tests() {
  init_results

  # Baseline - current config
  run_test "baseline" 4 40 "turbo"

  # Increase ACCOUNT_CONCURRENCY
  run_test "concurrency_60" 4 60 "turbo"
  run_test "concurrency_80" 4 80 "turbo"
  run_test "concurrency_100" 4 100 "turbo"

  # Increase WORKER_COUNT (threads)
  run_test "threads_8" 8 40 "turbo"
  run_test "threads_8_conc_60" 8 60 "turbo"
  run_test "threads_16" 16 40 "turbo"

  # Try quantum mode
  run_test "quantum_4t_40c" 4 40 "quantum"
  run_test "quantum_8t_60c" 8 60 "quantum"

  show_results
}

# Quick test with current config
test_current() {
  print_header "TESTING CURRENT CONFIGURATION"

  echo "Starting ${DURATION}s test..."
  for ip in "${WORKERS[@]}"; do
    curl -s -X POST "http://$ip:3001/start?duration=$DURATION" 2>/dev/null &
  done
  wait

  # Monitor every 5 seconds
  for i in $(seq 1 $((DURATION / 5 + 1))); do
    sleep 5
    echo ""
    echo "=== $(date +%H:%M:%S) ==="
    local total_tps=0
    for ip in "${WORKERS[@]}"; do
      local result=$(curl -s --max-time 3 "http://$ip:3001/status" 2>/dev/null)
      if [ -n "$result" ]; then
        local tps=$(echo "$result" | jq -r '.stats.currentTps // 0')
        local success=$(echo "$result" | jq -r '.stats.successfulTrades // 0')
        local rate=$(echo "$result" | jq -r '.stats.successRate // "0"')
        total_tps=$((total_tps + tps))
        echo "  $ip: ${tps} TPS | ${success} trades | ${rate}%"
      fi
    done
    echo "  >>> COMBINED: ${total_tps} TPS <<<"
  done
}

# Main
case "${1:-}" in
  --all)
    run_all_tests
    ;;
  --current)
    test_current
    ;;
  --results)
    show_results
    ;;
  --test)
    if [ -z "$2" ]; then
      echo "Usage: $0 --test <worker_count> <account_concurrency> <mode>"
      exit 1
    fi
    init_results
    run_test "custom" "${2:-4}" "${3:-40}" "${4:-turbo}"
    ;;
  *)
    echo "TPS Tuning Test Script"
    echo ""
    echo "Usage:"
    echo "  $0 --all              Run all predefined tests"
    echo "  $0 --current          Quick test with current config"
    echo "  $0 --test W C M       Custom test (Workers, Concurrency, Mode)"
    echo "  $0 --results          Show previous results"
    echo ""
    echo "Examples:"
    echo "  $0 --test 8 60 turbo  # 8 threads, 60 concurrency, turbo mode"
    echo "  $0 --test 16 80 quantum"
    ;;
esac
