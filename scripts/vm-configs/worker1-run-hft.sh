#!/bin/bash
# WORKER 1 - VM 178.128.177.88 - accounts 1-7
cd /opt/aptos-hft

# USD1 v2 Contract with admin drainers (Jan 11, 2026)
export CONTRACT_ADDRESS="0xbdea15f5b0f5449ae8f3a6ae95a5e090bdeeec91be1fcac8375b2f5f37f1c134"

# USD1 Stablecoin - eliminates APT global state contention for 10K+ TPS
export USE_USD1="true"
export USD1_METADATA="0x4e977d5ee91d77d680972a44b38b9c7a2c5694439169eeae060a48324e5c4597"

# 12 USD1-backed Polymarket-style markets for parallel trading
export MULTI_MARKETS="0x3e690f317df664c413e12b15eaa6e5565606fbd46628464f84f93e0674a3c052,0xf3256638cad294e47c8cc6bb1a6a0fdd85b29ef427b3118028c34b9f061aa50d,0x192f7cfc0c8151deec37c6280c17b55f7557a04b580b486d6076cc11955ddde3,0x9e4583c0af174a119b5316ae84988f4fd988259de35ef95447b371744a355762,0xd82731a9a2259ccfef2fd13db13720c7cc927c5b7879aa160aecc618c4d4654f,0x77a65b92664f992ccbd8a17d73a5f2fc933523ce64a1c475d1db1c0fc2acf42a,0xa84ba7b7364a40031e29d355d7a5f48fd54f922c8eed0ed0009c5d660a6da339,0x8187c1b3b7ca06dbcbac36fe280e0b5343b744c5a299a43263f9162738d4d792,0x551f153ff61f94311a22592550b0ede4b3b57338af161bd9472f21e15da23b4b,0x742e3c66cb6570351ceb7cf1b2df87e726c708b786109a8cdae93b0c3c7b5a04,0x35df09c98f8668c06f6777e98e3a0405fe894c271f06ba2fed0b322e2a5c2f16,0xd3227afa81dce5fa0e8f86f61dc7f3215ee799a0d2e6a112a988e5ac732bf719"

# Worker 1 accounts (1-7) - 10K USD1 each
export ULTRA_PRIVATE_KEYS="0x6e2fca34586261b6f22a973c20024b78ddb370d87f7c974315fb97ba56716a7f,0xe61d22b3dc37c537a20d5b301c4d2b409b2f93cd7b2915f3518d49517c2ab6c4,0x4542c2e4a39beee8202eee0cddeceea886687b21b54b8f50c17e729251fdd7f5,0xcf5154af9664bbc2634fddfcce2317ed788b35de7f004ac0e24aefd68a0b10c5,0xb7d1f406e48c2eddffe987f98445dd4a353e8e9d1630d878621ded084bdd77c7,0xa8088ee787b847f6304807a8b09d1afc15409082ee9c8b7eda6919b0ecb86ea8,0xb5305eb83498dcba61242ccc91fac35263d9b44bddaf5e7417adbaceb1cfcb36"

export APTOS_API_KEY="AG-3JMDT54EN4DCLULDWAUXCYGQ56JJQCYHH"
export FULLNODE_URL="https://aptos.cash.trading/v1"
export EXTRA_RPC_ENDPOINTS="https://polished-evocative-borough.aptos-testnet.quiknode.pro/a0b08bae2dc34e4a8774d91414948d02a5ce2975/v1"
export HFT_PORT=3001

# Mode handling:
#   - No args = STANDBY (wait for coordinator /start signal)
#   - With args = AUTO-START (e.g., "quantum 60")
MODE=${1:-}
DURATION=${2:-60}

echo "════════════════════════════════════════════════════════════════"
echo "  WORKER 1 - USD1 HFT (178.128.177.88)"
echo "  7 accounts @ 10K USD1 each | 12 markets"
if [ -z "$MODE" ]; then
  echo "  Mode: STANDBY (waiting for UI to launch)"
else
  echo "  Mode: $MODE for ${DURATION}s"
fi
echo "════════════════════════════════════════════════════════════════"

# Pass mode only if provided (empty = standby mode)
if [ -z "$MODE" ]; then
  npx tsx hft-ultra-server.ts
else
  npx tsx hft-ultra-server.ts $MODE $DURATION
fi
