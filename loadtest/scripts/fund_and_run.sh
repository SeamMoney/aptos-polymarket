#!/bin/bash
#
# Polymarket Load Test - Fund and Run
#
# This script:
# 1. Pre-funds test accounts with USD1 collateral (unless --no-fund)
# 2. Runs the load test
#
# Required environment variables:
#   COIN_SOURCE_KEY      - Ed25519 private key (hex) for funding accounts
#   ACCOUNT_MINTER_SEED  - Seed for generating test accounts
#
# Usage: ./fund_and_run.sh [OPTIONS] [RPC_URLS] [DURATION] [MEMPOOL_BACKLOG] [NUM_ACCOUNTS] [USD1_AMOUNT]
#
# Options:
#   --no-fund              Skip USD1 funding step
#   --markets-file FILE    Read market addresses from FILE (one per line)
#
# RPC_URLS can be comma-separated for multiple endpoints:
#   ./fund_and_run.sh "https://node1.example.com/v1,https://node2.example.com/v1" 60 5000
#
# Examples:
#   ./fund_and_run.sh --markets-file markets.txt 60 5000
#   ./fund_and_run.sh --no-fund --markets-file markets.txt 60 5000
#

set -e

# Parse options
NO_FUND=false
MARKETS_FILE=""

while [[ "$1" == --* ]]; do
    case "$1" in
        --no-fund)
            NO_FUND=true
            shift
            ;;
        --markets-file)
            MARKETS_FILE="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

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

if [ -z "$ACCOUNT_MINTER_SEED" ]; then
    echo "ERROR: ACCOUNT_MINTER_SEED environment variable is required"
    exit 1
fi

DEFAULT_RPC_URLS="http://vfn0.apne1-0.testnet.aptoslabs.com/,http://vfn0.usce1-0.testnet.aptoslabs.com/,http://vfn0.euwe4-0.testnet.aptoslabs.com/,http://vfn0.euwe4-1.testnet.aptoslabs.com/"

# Configuration
# RPC_URLS can be comma-separated for multiple endpoints
RPC_URLS="${1:-$DEFAULT_RPC_URLS}"
DURATION="${2:-60}"
MEMPOOL_BACKLOG="${3:-15000}"
NUM_ACCOUNTS="${4:-2000}"
USD1_AMOUNT="${5:-1000000000000}"  # 1000 USD1 (8 decimals)

# Extract first RPC URL for funding (only need one endpoint for sequential funding)
FIRST_RPC_URL="${RPC_URLS%%,*}"

# Convert comma-separated URLs to space-separated for --targets flag
RPC_URLS_SPACED="${RPC_URLS//,/ }"

USD1_CONTRACT="0xca4d40eae9f07fb28a121862d649203fb4335ece9536ee51790e19f812ff7aea"
CONTRACT="0xca4d40eae9f07fb28a121862d649203fb4335ece9536ee51790e19f812ff7aea"

# Load markets from file or use defaults
if [ -n "$MARKETS_FILE" ] && [ -f "$MARKETS_FILE" ]; then
    echo "Loading markets from: $MARKETS_FILE"
    MARKETS=()
    while IFS= read -r line || [ -n "$line" ]; do
        # Skip empty lines and comments
        line=$(echo "$line" | xargs)  # trim whitespace
        if [ -n "$line" ] && [[ ! "$line" =~ ^# ]]; then
            MARKETS+=("$line")
        fi
    done < "$MARKETS_FILE"
    echo "Loaded ${#MARKETS[@]} markets from file"
else
    # Default 15 markets
    MARKETS=(
        "0xaf561030c7ebb22b1d8b99b727c27caab1f6944ce39c141fd2b6b0cfbf614a9e"
        "0xa4ee321c4c642e7b5a3e27b9820f2be4c17a1add79f8129122289fca2c3ca7c3"
        "0xf85c7010d966bc6c3417e52a9b4d86b5f36117e51b43bf5c7a92f0468bac5497"
        "0xcbdddcf6206d2b5956b6c7c6a10d4ac1d6253a2c1c151e8b3af113d8e940f01f"
        "0xe128c8f16a0f07f48c69a38ac75868a2d5fdd9fbf3299958e9b1e2994a0b9f57"
        "0x00f60c218d500eb76c66a4a7fb6c6e5664847d5e9496016000fc953b5a89f6eb"
        "0x287968f6d26efbd291960455ce14e3723a48d32b3dc0a8c545d4603fe842e30f"
        "0xa594c8df003cd232043b34beefe020af744f378ec367a7f65b89e306e06baacb"
        "0x310ccec449c57bf8972feab19c5cb8ba5004e2934e4fa1bd565fdbd1a44f4008"
        "0x8172b2cf4ba365d72fca8b899a54d3c9e2539d63bd2283aca55c0d032fc793f6"
        "0xa550234b5784656e3f3d060134e36ab9a0eecc436d182452955c995984b3e67a"
        "0x9dc3b78821f64119671d7918b824b3b3c4b0e2124643ebe6b1e587efe9591202"
        "0xf508498afdecb2a2f6b40912efb1611b9fe9725e9c35521be5ff2bba3c187efa"
        "0x289aabd338cf7a2bc48512927775b5e1218b15bd83c3c740c3ec43faccef5b21"
        "0x8c4f0da1238adb4486d2a62ff08c85af331e022c1446445059059918d4361cd3"
    )
fi

# Build market arguments
MARKET_ARGS=""
for market in "${MARKETS[@]}"; do
    MARKET_ARGS="$MARKET_ARGS --market $market"
done

OUTPUT_FILE="loadtest_results_$(date +%Y%m%d_%H%M%S).json"

if [ "$NO_FUND" = false ]; then
    echo "=========================================="
    echo "Step 1: Mint USD1 to Test Accounts"
    echo "=========================================="
    echo "RPC URL:       $FIRST_RPC_URL"
    echo "USD1 Contract: $USD1_CONTRACT"
    echo "Num Accounts:  $NUM_ACCOUNTS"
    echo "USD1 Amount:   $((USD1_AMOUNT / 100000000)) USD1 per account"
    echo ""

    cargo run --release --bin fund-accounts -- \
        --rpc-url "$FIRST_RPC_URL" \
        --coin-source-key "$COIN_SOURCE_KEY" \
        --account-minter-seed "$ACCOUNT_MINTER_SEED" \
        --node-api-key "$NODE_API_KEY" \
        --usd1-contract "$USD1_CONTRACT" \
        --usd1-amount "$USD1_AMOUNT" \
        --num-accounts "$NUM_ACCOUNTS" \
        --batch-size 100

    echo ""
else
    echo "=========================================="
    echo "Skipping USD1 funding (--no-fund)"
    echo "=========================================="
    echo ""
fi

echo "=========================================="
echo "Run Load Test"
echo "=========================================="
echo "RPC Endpoints:   $RPC_URLS"
echo "Duration:        ${DURATION}s"
echo "Mempool Backlog: $MEMPOOL_BACKLOG"
echo "Markets:         ${#MARKETS[@]}"
echo "Output:          $OUTPUT_FILE"
echo ""

cargo run --release --bin polymarket-loadtest -- \
    --targets $RPC_URLS_SPACED \
    --coin-source-key "$COIN_SOURCE_KEY" \
    --account-minter-seed "$ACCOUNT_MINTER_SEED" \
    --txn-expiration-time-secs 120 \
    --init-gas-price-multiplier 2 \
    --expected-gas-per-txn 100 \
    --expected-gas-per-transfer 600 \
    --max-transactions-per-account 20 \
    --max-gas-per-txn 1200 \
    --init-max-gas-per-txn 10000 \
    --expected-max-txns 1000000 \
    --skip-funding-accounts \
    --contract "$CONTRACT" \
    $MARKET_ARGS \
    --num-outcomes 2 \
    --duration "$DURATION" \
    --mempool-backlog "$MEMPOOL_BACKLOG" \
    --output "$OUTPUT_FILE"

echo ""
echo "Results saved to: $OUTPUT_FILE"
