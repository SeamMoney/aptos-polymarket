#!/bin/bash
#
# Fund Creator and Create Markets Script
#
# This script:
# 1. Mints USD1 to the creator account (for market liquidity)
# 2. Creates prediction markets
#
# Usage: ./fund_and_create_markets.sh [NUM_MARKETS] [OUTPUT_FILE] [CREATOR_USD1_AMOUNT]
#
# Examples:
#   ./fund_and_create_markets.sh 50                      # Create 50 markets
#   ./fund_and_create_markets.sh 100 markets.txt         # Create 100 markets
#   ./fund_and_create_markets.sh 50 markets.txt 10000    # Fund with 10000 USD1 first
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
CREATOR_USD1_AMOUNT="${3:-1000000}"  # Default 1M USD1

RPC_URL="https://fullnode.testnet.aptoslabs.com/v1"
CONTRACT="0xca4d40eae9f07fb28a121862d649203fb4335ece9536ee51790e19f812ff7aea"
USD1_METADATA="0x14b1ec8a5f31554d0cd19c390be83444ed519be2d7108c3e27dcbc4230c01fa3"

# Initial liquidity per market: 1000 USD1
INITIAL_LIQUIDITY="100000000000"  # 1000 USD1 (8 decimals)

# Market duration: 1 year
DURATION_SECS="31536000"

# Convert USD1 amount to smallest units (8 decimals)
CREATOR_USD1_UNITS=$((CREATOR_USD1_AMOUNT * 100000000))

# Get creator address from private key
# The creator is the same account as the minter (COIN_SOURCE_KEY)
CREATOR_KEY="${COIN_SOURCE_KEY#0x}"

echo "=========================================="
echo "Step 1: Fund Creator Account with USD1"
echo "=========================================="
echo "RPC URL:           $RPC_URL"
echo "Amount:            $CREATOR_USD1_AMOUNT USD1"
echo ""

# Fund the creator account (minter's own address) with USD1
cargo run --release --bin fund-accounts -- \
    --rpc-url "$RPC_URL" \
    --coin-source-key "$COIN_SOURCE_KEY" \
    --node-api-key "$NODE_API_KEY" \
    --usd1-contract "$CONTRACT" \
    --self-fund \
    --usd1-amount "$CREATOR_USD1_UNITS"

echo ""
echo "=========================================="
echo "Step 2: Create Prediction Markets"
echo "=========================================="
echo "Contract:          $CONTRACT"
echo "USD1 Metadata:     $USD1_METADATA"
echo "Number of markets: $NUM_MARKETS"
echo "Initial liquidity: $((INITIAL_LIQUIDITY / 100000000)) USD1 per market"
echo "Output file:       $OUTPUT_FILE"
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
echo "=========================================="
echo "Complete!"
echo "=========================================="
echo "Markets saved to: $OUTPUT_FILE"
echo ""
echo "Use with load test:"
echo "  ./fund_and_run.sh --markets-file $OUTPUT_FILE"
