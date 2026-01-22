#!/bin/bash
#
# DUAL TPS DEMO - Run AMM Trading + USD1 Transfers Simultaneously
# ================================================================
#
# This script runs both demos in parallel to show combined TPS on the dashboard.
#
# MODES:
#   Default (500 accounts):
#     - AMM Trading: accounts 0-332 (333 accounts)
#     - USD1 Transfers: accounts 333-499 (167 accounts = 83 senders + 84 recipients)
#
#   Max TPS (2000 accounts, AMM only, orderless=false):
#     - AMM Trading: accounts 0-1999 (2000 accounts)
#     - USE_ORDERLESS=false (avoids ~50% nonce reuse failures)
#
# Usage:
#   ./scripts/dual-demo.sh [duration]         # Run both demos (default: 60s)
#   ./scripts/dual-demo.sh max-tps [duration] # Run AMM only with optimal config
#   ./scripts/dual-demo.sh preflight          # Run pre-flight checks only
#   ./scripts/dual-demo.sh servers            # Start servers and wait (for manual trigger)
#   ./scripts/dual-demo.sh trigger [duration] # Trigger running servers
#   ./scripts/dual-demo.sh stop               # Stop servers
#
# Examples:
#   ./scripts/dual-demo.sh 60                 # Run both for 60 seconds (auto-start)
#   ./scripts/dual-demo.sh max-tps 60         # Run max TPS AMM-only for 60 seconds
#   ./scripts/dual-demo.sh preflight          # Check everything before demo
#   ./scripts/dual-demo.sh servers            # Start servers in standby mode
#

# Exit on error, but handle cleanup
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

# Configuration
AMM_PORT=3001
TRANSFER_PORT=3002
LOG_DIR="/tmp/dual-demo"

# Account configuration - MUST NOT OVERLAP
# Default mode (dual demo)
AMM_ACCOUNT_COUNT=333
AMM_ACCOUNT_START=0
TRANSFER_ACCOUNT_COUNT=83  # 83 senders + 84 recipients = 167 accounts
TRANSFER_ACCOUNT_START=333

# Max TPS mode (AMM only, 2000 accounts, orderless=false)
MAX_TPS_ACCOUNT_COUNT=2000
MAX_TPS_USE_ORDERLESS=false

# RPC endpoint
VFN_URL="http://vfn0.usce1-0.testnet.aptoslabs.com:80/v1"

# Mode flag (set by command line)
MAX_TPS_MODE=false

# Default duration
DURATION=${1:-60}
if [[ "$1" == "servers" ]] || [[ "$1" == "trigger" ]] || [[ "$1" == "stop" ]] || [[ "$1" == "status" ]] || [[ "$1" == "preflight" ]] || [[ "$1" == "max-tps" ]]; then
  DURATION=${2:-60}
fi

# Check for max-tps mode
if [[ "$1" == "max-tps" ]]; then
  MAX_TPS_MODE=true
  AMM_ACCOUNT_COUNT=$MAX_TPS_ACCOUNT_COUNT
  AMM_ACCOUNT_START=0
fi

# ============================================================================
# Environment Loading (handles quoted values properly)
# ============================================================================
load_env() {
  if [ -f .env.seed ]; then
    # Source the file to handle quoted values with spaces
    set -a  # Auto-export all variables
    source .env.seed
    set +a
  else
    print_error ".env.seed not found!"
    exit 1
  fi
}

# ============================================================================
# Cleanup trap - ensures servers are stopped properly on exit/interrupt
# ============================================================================
cleanup() {
  echo ""
  print_status "Cleaning up..."

  # Try graceful stop for AMM server (to save hashes)
  if check_server $AMM_PORT 2>/dev/null; then
    print_status "Stopping AMM server gracefully..."
    curl -s -X POST "http://localhost:$AMM_PORT/stop" > /dev/null 2>&1 || true
    sleep 2
  fi

  # Kill any remaining processes
  if [ -f "$LOG_DIR/amm.pid" ]; then
    kill $(cat "$LOG_DIR/amm.pid") 2>/dev/null || true
    rm -f "$LOG_DIR/amm.pid"
  fi

  if [ -f "$LOG_DIR/transfer.pid" ]; then
    kill $(cat "$LOG_DIR/transfer.pid") 2>/dev/null || true
    rm -f "$LOG_DIR/transfer.pid"
  fi

  pkill -f "hft-piscina-server" 2>/dev/null || true
  pkill -f "transfer-tps-server" 2>/dev/null || true

  print_status "Cleanup complete"
}

# Set trap for cleanup on exit, interrupt, terminate
trap cleanup EXIT INT TERM

# ============================================================================
# Print functions
# ============================================================================
print_banner() {
  echo ""
  echo -e "${CYAN}╔══════════════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${CYAN}║${NC}         ${BOLD}DUAL TPS DEMO - AMM Trading + USD1 Transfers${NC}              ${CYAN}║${NC}"
  echo -e "${CYAN}╠══════════════════════════════════════════════════════════════════════╣${NC}"
  echo -e "${CYAN}║${NC}  Account Split:                                                      ${CYAN}║${NC}"
  echo -e "${CYAN}║${NC}    ${GREEN}AMM Trading${NC}:    accounts ${AMM_ACCOUNT_START}-$((AMM_ACCOUNT_START + AMM_ACCOUNT_COUNT - 1))    ($AMM_ACCOUNT_COUNT accounts)                ${CYAN}║${NC}"
  echo -e "${CYAN}║${NC}    ${GREEN}USD1 Transfers${NC}: accounts ${TRANSFER_ACCOUNT_START}-$((TRANSFER_ACCOUNT_START + TRANSFER_ACCOUNT_COUNT * 2 - 1))  ($TRANSFER_ACCOUNT_COUNT + $((TRANSFER_ACCOUNT_COUNT + 1)) pairs)               ${CYAN}║${NC}"
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

print_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

# ============================================================================
# Validation functions
# ============================================================================
validate_mnemonic() {
  if [ -z "$SEED_MNEMONIC" ]; then
    print_error "SEED_MNEMONIC not set in .env.seed"
    return 1
  fi

  # Count words in mnemonic
  local word_count=$(echo "$SEED_MNEMONIC" | wc -w | tr -d ' ')
  if [ "$word_count" -ne 12 ] && [ "$word_count" -ne 24 ]; then
    print_error "SEED_MNEMONIC has $word_count words (expected 12 or 24)"
    return 1
  fi

  print_success "Mnemonic valid ($word_count words)"
  return 0
}

validate_account_ranges() {
  local amm_end=$((AMM_ACCOUNT_START + AMM_ACCOUNT_COUNT - 1))
  local transfer_end=$((TRANSFER_ACCOUNT_START + TRANSFER_ACCOUNT_COUNT * 2 - 1))

  # Check for overlap
  if [ $TRANSFER_ACCOUNT_START -le $amm_end ]; then
    print_error "Account ranges overlap! AMM ends at $amm_end, Transfers start at $TRANSFER_ACCOUNT_START"
    return 1
  fi

  # Check total accounts needed
  local total_needed=$((transfer_end + 1))
  print_success "Account ranges valid (need $total_needed accounts total)"
  print_status "  AMM:       $AMM_ACCOUNT_START - $amm_end ($AMM_ACCOUNT_COUNT accounts)"
  print_status "  Transfers: $TRANSFER_ACCOUNT_START - $transfer_end ($((TRANSFER_ACCOUNT_COUNT * 2)) accounts)"
  return 0
}

validate_rpc() {
  print_status "Checking RPC endpoint: $VFN_URL"

  local response=$(curl -s --max-time 5 "$VFN_URL" 2>/dev/null || echo "")
  if [ -z "$response" ]; then
    print_error "RPC endpoint not responding: $VFN_URL"
    return 1
  fi

  local chain_id=$(echo "$response" | jq -r '.chain_id // empty' 2>/dev/null || echo "")
  if [ -z "$chain_id" ]; then
    print_error "Invalid RPC response (no chain_id)"
    return 1
  fi

  print_success "RPC endpoint responding (chain_id: $chain_id)"
  return 0
}

check_server() {
  local port=$1
  local max_attempts=${2:-1}
  local attempt=1

  while [ $attempt -le $max_attempts ]; do
    if curl -s --max-time 2 "http://localhost:$port/health" > /dev/null 2>&1; then
      return 0
    fi
    attempt=$((attempt + 1))
    [ $attempt -le $max_attempts ] && sleep 1
  done
  return 1
}

wait_for_server() {
  local port=$1
  local name=$2
  local max_wait=${3:-60}
  local waited=0

  print_status "Waiting for $name to be ready (max ${max_wait}s)..."

  while [ $waited -lt $max_wait ]; do
    if check_server $port; then
      print_success "$name ready after ${waited}s"
      return 0
    fi
    sleep 2
    waited=$((waited + 2))
    echo -ne "\r  ${DIM}Waiting... ${waited}s${NC}    "
  done

  echo ""
  print_error "$name failed to start within ${max_wait}s"
  return 1
}

# ============================================================================
# Stats functions
# ============================================================================
get_amm_stats() {
  curl -s --max-time 2 "http://localhost:$AMM_PORT/stats" 2>/dev/null || echo '{}'
}

show_combined_stats() {
  local elapsed=$1
  local amm_stats=$(get_amm_stats)

  local amm_tps=$(echo "$amm_stats" | jq -r '.currentTps // 0' 2>/dev/null || echo "0")
  local amm_success=$(echo "$amm_stats" | jq -r '.successfulTrades // 0' 2>/dev/null || echo "0")
  local amm_failed=$(echo "$amm_stats" | jq -r '.failedTrades // 0' 2>/dev/null || echo "0")
  local amm_rate=$(echo "$amm_stats" | jq -r '.successRate // "0"' 2>/dev/null || echo "0")

  printf "[%3ds] AMM: ${GREEN}%4d TPS${NC} | Success: %6d | Failed: %4d | Rate: %s%%\n" \
    "$elapsed" "$amm_tps" "$amm_success" "$amm_failed" "$amm_rate"
}

# ============================================================================
# Pre-flight checks
# ============================================================================
cmd_preflight() {
  print_banner
  echo -e "${BOLD}Running Pre-flight Checks${NC}"
  echo "════════════════════════════════════════════════════════════════════"
  echo ""

  local failed=0

  # Load environment
  load_env

  # 1. Validate mnemonic
  validate_mnemonic || failed=1

  # 2. Validate account ranges
  validate_account_ranges || failed=1

  # 3. Validate RPC
  validate_rpc || failed=1

  # 4. Check for required tools
  print_status "Checking required tools..."
  command -v npx > /dev/null || { print_error "npx not found"; failed=1; }
  command -v jq > /dev/null || { print_error "jq not found"; failed=1; }
  command -v curl > /dev/null || { print_error "curl not found"; failed=1; }
  [ $failed -eq 0 ] && print_success "All required tools available"

  # 5. Check for existing servers
  print_status "Checking for existing servers..."
  if check_server $AMM_PORT; then
    print_warn "AMM server already running on port $AMM_PORT"
  fi
  if check_server $TRANSFER_PORT; then
    print_warn "Transfer server already running on port $TRANSFER_PORT"
  fi

  echo ""
  echo "════════════════════════════════════════════════════════════════════"
  if [ $failed -eq 0 ]; then
    echo -e "${GREEN}${BOLD}PRE-FLIGHT PASSED${NC} - Ready to run demo"
    echo ""
    echo "Run: ./scripts/dual-demo.sh $DURATION"
  else
    echo -e "${RED}${BOLD}PRE-FLIGHT FAILED${NC} - Fix issues above before running"
    exit 1
  fi
}

# ============================================================================
# Main run command
# ============================================================================
cmd_run() {
  print_banner

  # Run preflight checks first
  echo -e "${BOLD}Pre-flight Checks${NC}"
  echo "────────────────────────────────────────────────────────────────────"

  load_env

  local preflight_failed=0
  validate_mnemonic || preflight_failed=1
  validate_account_ranges || preflight_failed=1
  validate_rpc || preflight_failed=1

  if [ $preflight_failed -eq 1 ]; then
    print_error "Pre-flight checks failed. Run './scripts/dual-demo.sh preflight' for details."
    exit 1
  fi

  echo ""
  print_status "Starting DUAL DEMO for ${DURATION} seconds..."
  echo ""

  # Create log directory
  mkdir -p "$LOG_DIR"

  # Ensure clean state (cleanup trap will handle any existing)
  pkill -f "hft-piscina-server" 2>/dev/null || true
  pkill -f "transfer-tps-server" 2>/dev/null || true
  sleep 2

  # ─────────────────────────────────────────────────────────────────────────
  # Start AMM server (has HTTP API, waits for trigger)
  # ─────────────────────────────────────────────────────────────────────────
  echo -e "${YELLOW}Starting AMM Trading Server (accounts $AMM_ACCOUNT_START-$((AMM_ACCOUNT_START + AMM_ACCOUNT_COUNT - 1)))...${NC}"

  SEED_MNEMONIC="$SEED_MNEMONIC" \
  ACCOUNT_COUNT=$AMM_ACCOUNT_COUNT \
  ACCOUNT_START_INDEX=$AMM_ACCOUNT_START \
  PORT=$AMM_PORT \
  RPC_MODE=internal \
  npx tsx server/hft-piscina-server.ts turbo > "$LOG_DIR/amm.log" 2>&1 &
  AMM_PID=$!
  echo $AMM_PID > "$LOG_DIR/amm.pid"

  # Wait for AMM server to be ready (polls instead of fixed sleep)
  if ! wait_for_server $AMM_PORT "AMM server" 45; then
    print_error "AMM server failed to start. Last 30 lines of log:"
    echo "────────────────────────────────────────────────────────────────────"
    tail -30 "$LOG_DIR/amm.log" 2>/dev/null || echo "(no log available)"
    exit 1
  fi

  # ─────────────────────────────────────────────────────────────────────────
  # Start Transfer server (starts immediately when launched)
  # We start this AFTER AMM is ready, then trigger AMM immediately
  # ─────────────────────────────────────────────────────────────────────────
  echo -e "${YELLOW}Starting USD1 Transfer Demo (accounts $TRANSFER_ACCOUNT_START-$((TRANSFER_ACCOUNT_START + TRANSFER_ACCOUNT_COUNT * 2 - 1)))...${NC}"

  SEED_MNEMONIC="$SEED_MNEMONIC" \
  ACCOUNTS=$TRANSFER_ACCOUNT_COUNT \
  ACCOUNT_START_INDEX=$TRANSFER_ACCOUNT_START \
  DURATION=$DURATION \
  TOKEN_TYPE=usd1 \
  VFN_URL="$VFN_URL" \
  npx tsx server/transfer-tps-server.ts turbo > "$LOG_DIR/transfer.log" 2>&1 &
  TRANSFER_PID=$!
  echo $TRANSFER_PID > "$LOG_DIR/transfer.pid"

  # Give transfer server a moment to start initializing
  sleep 3

  # ─────────────────────────────────────────────────────────────────────────
  # Trigger AMM server (both demos now running simultaneously)
  # ─────────────────────────────────────────────────────────────────────────
  print_status "Triggering AMM Trading Server..."
  local trigger_response=$(curl -s -X POST "http://localhost:$AMM_PORT/start?duration=$DURATION" 2>/dev/null || echo '{"success":false}')

  if echo "$trigger_response" | jq -e '.success' > /dev/null 2>&1; then
    print_success "AMM server triggered!"
  else
    print_error "Failed to trigger AMM server"
    echo "$trigger_response"
    exit 1
  fi

  echo ""
  echo -e "${CYAN}══════════════════════════════════════════════════════════════════${NC}"
  echo -e "${BOLD}                  RUNNING DUAL DEMO (${DURATION}s)${NC}"
  echo -e "${CYAN}══════════════════════════════════════════════════════════════════${NC}"
  echo ""

  # Monitor progress
  local start_time=$(date +%s)
  local elapsed=0

  while [ $elapsed -lt $DURATION ]; do
    sleep 5
    elapsed=$(( $(date +%s) - start_time ))
    [ $elapsed -gt $DURATION ] && elapsed=$DURATION
    show_combined_stats $elapsed

    # Check if AMM server is still running
    if ! check_server $AMM_PORT; then
      print_warn "AMM server stopped unexpectedly"
      break
    fi
  done

  echo ""
  echo -e "${CYAN}══════════════════════════════════════════════════════════════════${NC}"
  echo -e "${BOLD}                     DEMO COMPLETE${NC}"
  echo -e "${CYAN}══════════════════════════════════════════════════════════════════${NC}"
  echo ""

  # ─────────────────────────────────────────────────────────────────────────
  # Stop AMM server gracefully to trigger hash collection
  # ─────────────────────────────────────────────────────────────────────────
  print_status "Stopping AMM server and collecting transaction hashes..."

  local stop_response=$(curl -s -X POST "http://localhost:$AMM_PORT/stop" 2>/dev/null || echo '{}')
  local amm_total=$(echo "$stop_response" | jq -r '.stats.totalTrades // 0' 2>/dev/null || echo "0")
  local amm_success=$(echo "$stop_response" | jq -r '.stats.successfulTrades // 0' 2>/dev/null || echo "0")
  local amm_peak=$(echo "$stop_response" | jq -r '.stats.peakTps // 0' 2>/dev/null || echo "0")

  # Wait for hash collection to complete
  sleep 3

  echo ""
  echo -e "${CYAN}══════════════════════════════════════════════════════════════════${NC}"
  echo -e "${BOLD}                     RESULTS SUMMARY${NC}"
  echo -e "${CYAN}══════════════════════════════════════════════════════════════════${NC}"
  echo ""

  # ─────────────────────────────────────────────────────────────────────────
  # AMM Results
  # ─────────────────────────────────────────────────────────────────────────
  echo -e "${YELLOW}AMM Trading Results:${NC}"
  echo "  Total Trades:    $amm_total"
  echo "  Successful:      $amm_success"
  echo "  Peak TPS:        $amm_peak"
  echo ""

  # Check for AMM hash file
  local amm_hash_file="/tmp/hft-submitted-txns.json"
  if [ -f "$amm_hash_file" ]; then
    local amm_hash_count=$(jq '.transactions | length' "$amm_hash_file" 2>/dev/null || echo "0")
    echo -e "  ${GREEN}Hash File:${NC} $amm_hash_file"
    echo "  Hashes Saved:    $amm_hash_count"
  else
    echo -e "  ${RED}Hash File:${NC} Not found (server may not have saved)"
  fi

  # ─────────────────────────────────────────────────────────────────────────
  # Transfer Results
  # ─────────────────────────────────────────────────────────────────────────
  echo ""
  echo -e "${YELLOW}USD1 Transfer Results:${NC}"

  # Extract transfer stats from log (handle ANSI escape codes)
  # The log format is: │ Submitted:    15833 │ Success:     6474 │ Failed:   9359 │  21.6s │
  local transfer_submitted=$(grep -oP 'Submitted:\s*\K\d+' "$LOG_DIR/transfer.log" 2>/dev/null | tail -1 || echo "0")
  local transfer_success=$(grep -oP 'Success:\s*\K\d+' "$LOG_DIR/transfer.log" 2>/dev/null | tail -1 || echo "0")
  local transfer_peak=$(grep -oP 'Peak:\s*\K\d+' "$LOG_DIR/transfer.log" 2>/dev/null | tail -1 || echo "0")

  echo "  Total Submitted: $transfer_submitted"
  echo "  Successful:      $transfer_success"
  echo "  Peak TPS:        $transfer_peak"
  echo ""

  # Find transfer hash files (Ralphy format)
  local transfer_demo_id=$(grep -oP 'Demo ID: \K[^\s]+' "$LOG_DIR/transfer.log" 2>/dev/null | tail -1 || echo "")
  if [ -n "$transfer_demo_id" ]; then
    local transfer_hash_files=$(ls .ralphy/hashes/${transfer_demo_id}*.jsonl 2>/dev/null | head -5)
    if [ -n "$transfer_hash_files" ]; then
      local transfer_hash_count=$(wc -l .ralphy/hashes/${transfer_demo_id}*.jsonl 2>/dev/null | tail -1 | awk '{print $1}')
      echo -e "  ${GREEN}Hash Files:${NC} .ralphy/hashes/${transfer_demo_id}*.jsonl"
      echo "  Hashes Saved:    $transfer_hash_count"
    fi
  fi

  # ─────────────────────────────────────────────────────────────────────────
  # Combined Stats
  # ─────────────────────────────────────────────────────────────────────────
  echo ""
  echo -e "${CYAN}────────────────────────────────────────────────────────────────────${NC}"
  local combined_total=$((amm_total + transfer_submitted))
  local combined_success=$((amm_success + transfer_success))
  echo -e "${BOLD}Combined:${NC}"
  echo "  Total Transactions: $combined_total"
  echo "  Total Successful:   $combined_success"
  echo ""

  # ─────────────────────────────────────────────────────────────────────────
  # Post-Run Analytics Commands
  # ─────────────────────────────────────────────────────────────────────────
  echo -e "${CYAN}════════════════════════════════════════════════════════════════════${NC}"
  echo -e "${BOLD}POST-RUN ANALYTICS${NC}"
  echo -e "${CYAN}════════════════════════════════════════════════════════════════════${NC}"
  echo ""
  echo -e "${YELLOW}1. On-chain TPS verification:${NC}"
  echo "   npx tsx scripts/analyze-tps.ts --minutes 3"
  echo ""
  echo -e "${YELLOW}2. AMM transaction verification:${NC}"
  echo "   npx tsx scripts/analyze-submitted-txns.ts"
  echo ""
  echo -e "${YELLOW}3. Transfer hash verification (Ralphy):${NC}"
  if [ -n "$transfer_demo_id" ]; then
    echo "   npx tsx scripts/ralphy-resume.ts --demo $transfer_demo_id"
  else
    echo "   npx tsx scripts/ralphy-resume.ts --latest"
  fi
  echo ""
  echo -e "${YELLOW}4. Explorer links (sample hashes):${NC}"

  # Show a few sample hashes for manual verification
  if [ -f "$amm_hash_file" ]; then
    local sample_hash=$(jq -r '.transactions[0].hash // empty' "$amm_hash_file" 2>/dev/null)
    if [ -n "$sample_hash" ]; then
      echo "   AMM:      https://explorer.aptoslabs.com/txn/$sample_hash?network=testnet"
    fi
  fi
  if [ -n "$transfer_demo_id" ] && [ -f ".ralphy/hashes/${transfer_demo_id}-worker-0.jsonl" ]; then
    local sample_transfer=$(head -1 ".ralphy/hashes/${transfer_demo_id}-worker-0.jsonl" 2>/dev/null | jq -r '.hash // empty' 2>/dev/null)
    if [ -n "$sample_transfer" ]; then
      echo "   Transfer: https://explorer.aptoslabs.com/txn/$sample_transfer?network=testnet"
    fi
  fi

  echo ""
  echo -e "${CYAN}════════════════════════════════════════════════════════════════════${NC}"
  echo ""

  # Disable cleanup trap - we already stopped AMM server gracefully
  trap - EXIT

  # Only kill transfer server if still running
  if [ -f "$LOG_DIR/transfer.pid" ]; then
    kill $(cat "$LOG_DIR/transfer.pid") 2>/dev/null || true
    rm -f "$LOG_DIR/transfer.pid"
  fi
  pkill -f "transfer-tps-server" 2>/dev/null || true
}

# ============================================================================
# MAX TPS MODE - AMM only with 2000 accounts, orderless=false
# ============================================================================
cmd_max_tps() {
  echo ""
  echo -e "${CYAN}╔══════════════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${CYAN}║${NC}         ${BOLD}MAX TPS MODE - Optimal AMM Configuration${NC}                     ${CYAN}║${NC}"
  echo -e "${CYAN}╠══════════════════════════════════════════════════════════════════════╣${NC}"
  echo -e "${CYAN}║${NC}  Accounts:     ${GREEN}$MAX_TPS_ACCOUNT_COUNT${NC} (all funded)                                   ${CYAN}║${NC}"
  echo -e "${CYAN}║${NC}  Orderless:    ${GREEN}false${NC} (avoids ~50% nonce reuse failures)               ${CYAN}║${NC}"
  echo -e "${CYAN}║${NC}  Mode:         ${GREEN}turbo${NC}                                                  ${CYAN}║${NC}"
  echo -e "${CYAN}╚══════════════════════════════════════════════════════════════════════╝${NC}"
  echo ""

  # Run preflight checks
  echo -e "${BOLD}Pre-flight Checks${NC}"
  echo "──────────────────────────────────────────────────────────────────────"

  load_env

  local preflight_failed=0
  validate_mnemonic || preflight_failed=1
  validate_rpc || preflight_failed=1

  if [ $preflight_failed -eq 1 ]; then
    print_error "Pre-flight checks failed."
    exit 1
  fi

  echo ""
  print_status "Starting MAX TPS demo for ${DURATION} seconds..."
  echo ""

  # Create log directory
  mkdir -p "$LOG_DIR"

  # Ensure clean state
  pkill -f "hft-piscina-server" 2>/dev/null || true
  sleep 2

  # ──────────────────────────────────────────────────────────────────────────
  # Start AMM server with MAX TPS config
  # ──────────────────────────────────────────────────────────────────────────
  echo -e "${YELLOW}Starting AMM Server (${MAX_TPS_ACCOUNT_COUNT} accounts, orderless=false)...${NC}"

  SEED_MNEMONIC="$SEED_MNEMONIC" \
  ACCOUNT_COUNT=$MAX_TPS_ACCOUNT_COUNT \
  ACCOUNT_START_INDEX=0 \
  USE_ORDERLESS=false \
  PORT=$AMM_PORT \
  RPC_MODE=internal \
  npx tsx server/hft-piscina-server.ts turbo > "$LOG_DIR/amm.log" 2>&1 &
  AMM_PID=$!
  echo $AMM_PID > "$LOG_DIR/amm.pid"

  # Wait for AMM server to be ready
  if ! wait_for_server $AMM_PORT "AMM server" 90; then
    print_error "AMM server failed to start. Last 30 lines of log:"
    echo "────────────────────────────────────────────────────────────────────────"
    tail -30 "$LOG_DIR/amm.log" 2>/dev/null || echo "(no log available)"
    exit 1
  fi

  # ──────────────────────────────────────────────────────────────────────────
  # Trigger AMM server
  # ──────────────────────────────────────────────────────────────────────────
  print_status "Triggering AMM Trading Server..."
  local trigger_response=$(curl -s -X POST "http://localhost:$AMM_PORT/start?duration=$DURATION" 2>/dev/null || echo '{"success":false}')

  if echo "$trigger_response" | jq -e '.success' > /dev/null 2>&1; then
    print_success "AMM server triggered!"
  else
    print_error "Failed to trigger AMM server"
    echo "$trigger_response"
    exit 1
  fi

  echo ""
  echo -e "${CYAN}════════════════════════════════════════════════════════════════════${NC}"
  echo -e "${BOLD}                    MAX TPS DEMO RUNNING${NC}"
  echo -e "${CYAN}════════════════════════════════════════════════════════════════════${NC}"
  echo ""

  # Monitor progress
  local start_time=$(date +%s)
  local elapsed=0

  while [ $elapsed -lt $DURATION ]; do
    sleep 5
    elapsed=$(( $(date +%s) - start_time ))
    [ $elapsed -gt $DURATION ] && elapsed=$DURATION
    show_combined_stats $elapsed

    # Check if AMM server is still running
    if ! check_server $AMM_PORT; then
      print_warn "AMM server stopped unexpectedly"
      break
    fi
  done

  echo ""
  echo -e "${CYAN}════════════════════════════════════════════════════════════════════${NC}"
  echo -e "${BOLD}                    MAX TPS DEMO COMPLETE${NC}"
  echo -e "${CYAN}════════════════════════════════════════════════════════════════════${NC}"
  echo ""

  # Stop AMM server gracefully to collect hashes
  print_status "Stopping AMM server and collecting transaction hashes..."

  local stop_response=$(curl -s -X POST "http://localhost:$AMM_PORT/stop" 2>/dev/null || echo '{}')
  local amm_total=$(echo "$stop_response" | jq -r '.stats.totalTrades // 0' 2>/dev/null || echo "0")
  local amm_success=$(echo "$stop_response" | jq -r '.stats.successfulTrades // 0' 2>/dev/null || echo "0")
  local amm_peak=$(echo "$stop_response" | jq -r '.stats.peakTps // 0' 2>/dev/null || echo "0")
  local amm_rate=$(echo "$stop_response" | jq -r '.stats.successRate // "0"' 2>/dev/null || echo "0")

  sleep 3

  echo ""
  echo -e "${CYAN}════════════════════════════════════════════════════════════════════${NC}"
  echo -e "${BOLD}                     RESULTS SUMMARY${NC}"
  echo -e "${CYAN}════════════════════════════════════════════════════════════════════${NC}"
  echo ""
  echo -e "${YELLOW}MAX TPS AMM Results:${NC}"
  echo "  Accounts Used:   $MAX_TPS_ACCOUNT_COUNT"
  echo "  Orderless:       false"
  echo "  Total Trades:    $amm_total"
  echo "  Successful:      $amm_success"
  echo "  Peak TPS:        $amm_peak"
  echo "  Success Rate:    $amm_rate%"
  echo ""

  # Check for hash file
  local amm_hash_file="/tmp/hft-submitted-txns.json"
  if [ -f "$amm_hash_file" ]; then
    local amm_hash_count=$(jq '.transactions | length' "$amm_hash_file" 2>/dev/null || echo "0")
    echo -e "  ${GREEN}Hash File:${NC} $amm_hash_file"
    echo "  Hashes Saved:    $amm_hash_count"
  fi

  echo ""
  echo -e "${CYAN}════════════════════════════════════════════════════════════════════${NC}"
  echo -e "${BOLD}POST-RUN ANALYTICS${NC}"
  echo -e "${CYAN}════════════════════════════════════════════════════════════════════${NC}"
  echo ""
  echo -e "${YELLOW}1. On-chain TPS verification:${NC}"
  echo "   npx tsx scripts/analyze-tps.ts --minutes 3"
  echo ""
  echo -e "${YELLOW}2. AMM transaction verification:${NC}"
  echo "   npx tsx scripts/analyze-submitted-txns.ts"
  echo ""

  # Show sample explorer link
  if [ -f "$amm_hash_file" ]; then
    local sample_hash=$(jq -r '.transactions[0].hash // empty' "$amm_hash_file" 2>/dev/null)
    if [ -n "$sample_hash" ]; then
      echo -e "${YELLOW}3. Explorer link (sample):${NC}"
      echo "   https://explorer.aptoslabs.com/txn/$sample_hash?network=testnet"
    fi
  fi

  echo ""
  echo -e "${CYAN}════════════════════════════════════════════════════════════════════${NC}"
  echo ""

  # Disable cleanup trap
  trap - EXIT
}

# ============================================================================
# Start servers in standby mode (for manual triggering)
# ============================================================================
cmd_servers() {
  print_banner

  load_env
  validate_mnemonic || exit 1
  validate_rpc || exit 1

  print_status "Starting servers in STANDBY mode..."
  echo ""

  # Ensure clean state
  pkill -f "hft-piscina-server" 2>/dev/null || true
  sleep 2

  mkdir -p "$LOG_DIR"

  echo -e "${YELLOW}Starting AMM Trading Server (port $AMM_PORT)...${NC}"

  SEED_MNEMONIC="$SEED_MNEMONIC" \
  ACCOUNT_COUNT=$AMM_ACCOUNT_COUNT \
  ACCOUNT_START_INDEX=$AMM_ACCOUNT_START \
  PORT=$AMM_PORT \
  RPC_MODE=internal \
  npx tsx server/hft-piscina-server.ts turbo > "$LOG_DIR/amm.log" 2>&1 &
  echo $! > "$LOG_DIR/amm.pid"

  if ! wait_for_server $AMM_PORT "AMM server" 45; then
    print_error "AMM server failed to start"
    tail -20 "$LOG_DIR/amm.log" 2>/dev/null
    exit 1
  fi

  echo ""
  echo -e "${GREEN}Server ready!${NC}"
  echo ""
  echo -e "${YELLOW}To trigger the demo:${NC}"
  echo "  curl -X POST \"http://localhost:$AMM_PORT/start?duration=60\""
  echo ""
  echo -e "${YELLOW}Note:${NC} For full dual-demo, run: ./scripts/dual-demo.sh 60"
  echo "  (This starts both AMM + USD1 transfers simultaneously)"
  echo ""
  echo -e "${DIM}Press Ctrl+C to stop${NC}"

  # Wait indefinitely (cleanup trap handles Ctrl+C)
  while true; do
    sleep 10
    if ! check_server $AMM_PORT; then
      print_error "Server stopped unexpectedly"
      tail -20 "$LOG_DIR/amm.log" 2>/dev/null
      exit 1
    fi
  done
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

  if [ -f "$LOG_DIR/amm.pid" ]; then
    kill $(cat "$LOG_DIR/amm.pid") 2>/dev/null || true
    rm -f "$LOG_DIR/amm.pid"
  fi

  if [ -f "$LOG_DIR/transfer.pid" ]; then
    kill $(cat "$LOG_DIR/transfer.pid") 2>/dev/null || true
    rm -f "$LOG_DIR/transfer.pid"
  fi

  pkill -f "hft-piscina-server" 2>/dev/null || true
  pkill -f "transfer-tps-server" 2>/dev/null || true

  print_success "Servers stopped"

  # Disable cleanup trap since we already cleaned up
  trap - EXIT
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

  # Disable cleanup trap for status command
  trap - EXIT
}

cmd_help() {
  print_banner

  echo "Usage:"
  echo "  ./scripts/dual-demo.sh [duration]         Run both demos (default: 60s)"
  echo "  ./scripts/dual-demo.sh max-tps [duration] Run AMM only with optimal config (2000 accounts, orderless=false)"
  echo "  ./scripts/dual-demo.sh preflight          Run pre-flight checks only"
  echo "  ./scripts/dual-demo.sh servers            Start AMM server in standby"
  echo "  ./scripts/dual-demo.sh trigger [duration] Trigger running server"
  echo "  ./scripts/dual-demo.sh stop               Stop all servers"
  echo "  ./scripts/dual-demo.sh status             Check status"
  echo "  ./scripts/dual-demo.sh help               Show this help"
  echo ""
  echo "Quick Start:"
  echo "  ./scripts/dual-demo.sh preflight    # Check everything first"
  echo "  ./scripts/dual-demo.sh 60           # Run dual demo for 60 seconds"
  echo "  ./scripts/dual-demo.sh max-tps 60   # Run MAX TPS AMM-only for 60 seconds"
  echo ""
  echo "Modes:"
  echo "  Default (dual demo):"
  echo "    - AMM Trading:    accounts 0-332 (333 accounts)"
  echo "    - USD1 Transfers: accounts 333-499 (167 accounts)"
  echo ""
  echo "  max-tps (optimal AMM-only):"
  echo "    - AMM Trading:    accounts 0-1999 (2000 accounts)"
  echo "    - USE_ORDERLESS:  false (avoids nonce reuse failures)"
  echo ""
  echo "Logs:"
  echo "  $LOG_DIR/amm.log"
  echo "  $LOG_DIR/transfer.log"

  # Disable cleanup trap for help command
  trap - EXIT
}

# ============================================================================
# Main
# ============================================================================
case "${1:-}" in
  max-tps)   cmd_max_tps ;;
  preflight) cmd_preflight ;;
  servers)   cmd_servers ;;
  trigger)   cmd_trigger ;;
  stop)      cmd_stop ;;
  status)    cmd_status ;;
  help|-h|--help) cmd_help ;;
  *)
    if [[ "${1:-}" =~ ^[0-9]+$ ]]; then
      DURATION=$1
      cmd_run
    elif [ -z "${1:-}" ]; then
      cmd_run
    else
      cmd_help
    fi
    ;;
esac
