#!/bin/bash
#
# Create Markets Script
#
# Creates prediction markets for load testing and saves addresses to a file.
#
# Usage: ./create_markets.sh [NUM_MARKETS] [OUTPUT_FILE]
#
# Examples:
#   ./create_markets.sh 50                    # Create 50 markets, save to markets.txt
#   ./create_markets.sh 100 my_markets.txt    # Create 100 markets, save to my_markets.txt
#

set -e

# Load environment from .env file if it exists
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/../.env" ]; then
    source "$SCRIPT_DIR/../.env"
fi

# Validate required environment variables
if [ -z "$COIN_SOURCE_KEY" ]; then
    echo "ERROR: COIN_SOURCE_KEY environment variable is required"
    exit 1
fi

# Configuration
NUM_MARKETS="${1:-50}"
OUTPUT_FILE="${2:-markets.txt}"
RPC_URL="${3:-https://fullnode.testnet.aptoslabs.com/v1}"

CONTRACT="0xca4d40eae9f07fb28a121862d649203fb4335ece9536ee51790e19f812ff7aea"
USD1_METADATA="0x14b1ec8a5f31554d0cd19c390be83444ed519be2d7108c3e27dcbc4230c01fa3"

# Initial liquidity: 1000 USD1 per market
INITIAL_LIQUIDITY="1000000000000"  # 1000 USD1

# Market duration: 1 year
DURATION_SECS="31536000"

echo "=========================================="
echo "Create Prediction Markets"
echo "=========================================="
echo "RPC URL:           $RPC_URL"
echo "Contract:          $CONTRACT"
echo "USD1 Metadata:     $USD1_METADATA"
echo "Number of markets: $NUM_MARKETS"
echo "Initial liquidity: $((INITIAL_LIQUIDITY / 100000000)) USD1 per market"
echo "Output file:       $OUTPUT_FILE"
echo "=========================================="
echo ""

cargo run --release --bin create-markets -- \
    --rpc-url "$RPC_URL" \
    --creator-key "$COIN_SOURCE_KEY" \
    --node-api-key "$NODE_API_KEY" \
    --contract "$CONTRACT" \
    --usd1-metadata "$USD1_METADATA" \
    --num-markets "$NUM_MARKETS" \
    --initial-liquidity "$INITIAL_LIQUIDITY" \
    --duration-secs "$DURATION_SECS" \
    --output "$OUTPUT_FILE"

echo ""
echo "Markets saved to: $OUTPUT_FILE"
echo "Use this file with fund_and_run.sh or run_loadtest.sh"
