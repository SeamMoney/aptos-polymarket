#!/bin/bash
# WORKER 3 - VM 138.68.0.124 (SFO2) - accounts 3334-4999
cd /opt/aptos-hft

# USD1 v2 Contract with admin drainers (Jan 11, 2026)
export CONTRACT_ADDRESS="0xbdea15f5b0f5449ae8f3a6ae95a5e090bdeeec91be1fcac8375b2f5f37f1c134"

# USD1 Stablecoin - eliminates APT global state contention for 10K+ TPS
export USE_USD1="true"
export USD1_METADATA="0x4e977d5ee91d77d680972a44b38b9c7a2c5694439169eeae060a48324e5c4597"

# 12 USD1-backed Polymarket-style markets for parallel trading
export MULTI_MARKETS="0x3e690f317df664c413e12b15eaa6e5565606fbd46628464f84f93e0674a3c052,0xf3256638cad294e47c8cc6bb1a6a0fdd85b29ef427b3118028c34b9f061aa50d,0x192f7cfc0c8151deec37c6280c17b55f7557a04b580b486d6076cc11955ddde3,0x9e4583c0af174a119b5316ae84988f4fd988259de35ef95447b371744a355762,0xd82731a9a2259ccfef2fd13db13720c7cc927c5b7879aa160aecc618c4d4654f,0x77a65b92664f992ccbd8a17d73a5f2fc933523ce64a1c475d1db1c0fc2acf42a,0xa84ba7b7364a40031e29d355d7a5f48fd54f922c8eed0ed0009c5d660a6da339,0x8187c1b3b7ca06dbcbac36fe280e0b5343b744c5a299a43263f9162738d4d792,0x551f153ff61f94311a22592550b0ede4b3b57338af161bd9472f21e15da23b4b,0x742e3c66cb6570351ceb7cf1b2df87e726c708b786109a8cdae93b0c3c7b5a04,0x35df09c98f8668c06f6777e98e3a0405fe894c271f06ba2fed0b322e2a5c2f16,0xd3227afa81dce5fa0e8f86f61dc7f3215ee799a0d2e6a112a988e5ac732bf719"

# Worker 3 accounts (15-20) - 10K USD1 each
export ULTRA_PRIVATE_KEYS="0xFB2AFF37DFED247E9CF407FFA41208A41A78877C1990ADD1F94E00FCE1A5CCAC,0x9E338A7FB43F8280CCD82B2929B66F4ED1B7AA7900C40E06EAD934BC7CDEF315,0x8E7D4B0196840DA3A7BA6EDEF3784E1B961263F06651B130F440F5D974920B1F,0x975CF351CE096E1350C9F9E89ED5CB8D7BEAAEBF7FC235B10F1A0852355EED7A,0xD945B44FCFA961B9E4F8DAA5139CF6B4CE9A1DF4838C75701EDC8A429739C097,0x292A25EDBE90DCB5F682908C1E7185E1CC127FAD74EEA218167115AA5962866C"

export APTOS_API_KEY="AG-3JMDT54EN4DCLULDWAUXCYGQ56JJQCYHH"
export FULLNODE_URL="https://aptos.cash.trading/v1"
export EXTRA_RPC_ENDPOINTS="https://polished-evocative-borough.aptos-testnet.quiknode.pro/a0b08bae2dc34e4a8774d91414948d02a5ce2975/v1"
export HFT_PORT=3003

# Mode handling:
#   - No args = STANDBY (wait for coordinator /start signal)
#   - With args = AUTO-START (e.g., "quantum 60")
MODE=${1:-}
DURATION=${2:-60}

echo "════════════════════════════════════════════════════════════════"
echo "  WORKER 3 - USD1 HFT (138.68.0.124)"
echo "  6 accounts @ 10K USD1 each | 12 markets"
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
