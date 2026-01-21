#!/bin/bash
# HFT Demo Launcher - 10k TPS Target
# Usage: ./scripts/start-demo.sh [mode] [duration]
#   mode: normal (default), turbo, ultra
#   duration: seconds to run (default: 60)

set -e

# Load environment variables
if [ -f .env.local ]; then
  export $(cat .env.local | grep -v '^#' | xargs)
else
  echo "Error: .env.local not found. Run from project root."
  exit 1
fi

MODE=${1:-normal}
DURATION=${2:-60}

echo "=================================="
echo "  Aptos Polymarket HFT Demo"
echo "=================================="
echo "Mode: $MODE"
echo "Duration: ${DURATION}s"
echo "Accounts: 20"
echo "Market: ${MARKET_ADDRESS:0:12}..."
echo "=================================="
echo ""

# Run the HFT server
npx tsx server/hft-ultra-server.ts $MODE $DURATION
