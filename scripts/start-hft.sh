#!/bin/bash
# HFT Server Startup Script
# Starts the ultra HFT server with 6 accounts for ~1000 TPS

# Kill any existing server on port 3001
lsof -ti:3001 | xargs -r kill 2>/dev/null

# Private keys for 6 trading accounts
ULTRA_PRIVATE_KEYS="0x6e2fca34586261b6f22a973c20024b78ddb370d87f7c974315fb97ba56716a7f,0xe61d22b3dc37c537a20d5b301c4d2b409b2f93cd7b2915f3518d49517c2ab6c4,0x4542c2e4a39beee8202eee0cddeceea886687b21b54b8f50c17e729251fdd7f5,0xcf5154af9664bbc2634fddfcce2317ed788b35de7f004ac0e24aefd68a0b10c5,ed25519-priv-0xb7d1f406e48c2eddffe987f98445dd4a353e8e9d1630d878621ded084bdd77c7,ed25519-priv-0xa8088ee787b847f6304807a8b09d1afc15409082ee9c8b7eda6919b0ecb86ea8"

# API key for higher rate limits
APTOS_API_KEY="AG-3JMDT54EN4DCLULDWAUXCYGQ56JJQCYHH"

echo "Starting HFT Server with 6 accounts..."
echo "Target: ~1000 TPS"
echo ""

cd "$(dirname "$0")/.."

ULTRA_PRIVATE_KEYS="$ULTRA_PRIVATE_KEYS" \
APTOS_API_KEY="$APTOS_API_KEY" \
npx tsx server/hft-ultra-server.ts
