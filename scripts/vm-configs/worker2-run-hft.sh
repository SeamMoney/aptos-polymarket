#!/bin/bash
# WORKER 2 - VM 147.182.237.239 - accounts 8-14
cd /opt/aptos-hft

# USD1 v2 Contract with admin drainers (Jan 11, 2026)
export CONTRACT_ADDRESS="0xbdea15f5b0f5449ae8f3a6ae95a5e090bdeeec91be1fcac8375b2f5f37f1c134"

# USD1 Stablecoin - eliminates APT global state contention for 10K+ TPS
export USE_USD1="true"
export USD1_METADATA="0x4e977d5ee91d77d680972a44b38b9c7a2c5694439169eeae060a48324e5c4597"

# 12 USD1-backed Polymarket-style markets for parallel trading
export MULTI_MARKETS="0x3e690f317df664c413e12b15eaa6e5565606fbd46628464f84f93e0674a3c052,0xf3256638cad294e47c8cc6bb1a6a0fdd85b29ef427b3118028c34b9f061aa50d,0x192f7cfc0c8151deec37c6280c17b55f7557a04b580b486d6076cc11955ddde3,0x9e4583c0af174a119b5316ae84988f4fd988259de35ef95447b371744a355762,0xd82731a9a2259ccfef2fd13db13720c7cc927c5b7879aa160aecc618c4d4654f,0x77a65b92664f992ccbd8a17d73a5f2fc933523ce64a1c475d1db1c0fc2acf42a,0xa84ba7b7364a40031e29d355d7a5f48fd54f922c8eed0ed0009c5d660a6da339,0x8187c1b3b7ca06dbcbac36fe280e0b5343b744c5a299a43263f9162738d4d792,0x551f153ff61f94311a22592550b0ede4b3b57338af161bd9472f21e15da23b4b,0x742e3c66cb6570351ceb7cf1b2df87e726c708b786109a8cdae93b0c3c7b5a04,0x35df09c98f8668c06f6777e98e3a0405fe894c271f06ba2fed0b322e2a5c2f16,0xd3227afa81dce5fa0e8f86f61dc7f3215ee799a0d2e6a112a988e5ac732bf719"

# Worker 2 accounts (8-14) - 10K USD1 each
export ULTRA_PRIVATE_KEYS="0xc27a6a8b6ed3013da99dc924b2f6af17f1448dedce91691f97d9e778c0761655,0xd6402b3493af005ed02b07f6cd7ffdfd37fae6d4d9c88fec6ff38e90f01b21c1,0xd375af1a686835905e15bf82f24fcaeed4b1b5b5fabe22c80e998acb804aa295,0xC5BA2ED0F5C40EE298E844B1140B6BB31C2671B747C8E9DF4B76054C4C5A8761,0x536C886483209657C9B30663B295C7CB007EB57E07931D3E41AF69067897D465,0x3E9CB6207207A266F298B1B13648D707BF886766221C3253F30AF68530A79749,0x4641D0FDD221B48EF4A45C8DC77D6D4F12D6848E01B7686134564A8CAE5BE637"

export APTOS_API_KEY="AG-3JMDT54EN4DCLULDWAUXCYGQ56JJQCYHH"
export FULLNODE_URL="https://aptos.cash.trading/v1"
export EXTRA_RPC_ENDPOINTS="https://polished-evocative-borough.aptos-testnet.quiknode.pro/a0b08bae2dc34e4a8774d91414948d02a5ce2975/v1"
export HFT_PORT=3002

# Mode handling:
#   - No args = STANDBY (wait for coordinator /start signal)
#   - With args = AUTO-START (e.g., "quantum 60")
MODE=${1:-}
DURATION=${2:-60}

echo "════════════════════════════════════════════════════════════════"
echo "  WORKER 2 - USD1 HFT (147.182.237.239)"
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
