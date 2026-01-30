#!/bin/bash
# =============================================================================
# ULTRA-CONSERVATIVE WORKER CONFIG FOR 100% SUCCESS RATE
# =============================================================================
#
# Settings:
#   - ACCOUNT_CONCURRENCY: 10
#   - BATCH_SIZE: 10
#   - BATCH_DELAY_MS: 80
#   - WORKER_THREADS: 2
#   - 3-4 workers per VFN
#
# Expected load per worker: 2 threads × 10 concurrency × 10 batch = 200 HTTP
# Expected load per VFN: ~600-800 concurrent HTTP requests

set -e

# Contract addresses
CONTRACT_A="0xca4d40eae9f07fb28a121862d649203fb4335ece9536ee51790e19f812ff7aea"
CONTRACT_B="0x27d2d721a0afb28a003741fb413bfe97424d38aa3b939f1c9789274517871668"

# Markets
MARKETS_A="0xaf561030c7ebb22b1d8b99b727c27caab1f6944ce39c141fd2b6b0cfbf614a9e,0xa4ee321c4c642e7b5a3e27b9820f2be4c17a1add79f8129122289fca2c3ca7c3,0xf85c7010d966bc6c3417e52a9b4d86b5f36117e51b43bf5c7a92f0468bac5497,0xcbdddcf6206d2b5956b6c7c6a10d4ac1d6253a2c1c151e8b3af113d8e940f01f,0xe128c8f16a0f07f48c69a38ac75868a2d5fdd9fbf3299958e9b1e2994a0b9f57,0x00f60c218d500eb76c66a4a7fb6c6e5664847d5e9496016000fc953b5a89f6eb,0x287968f6d26efbd291960455ce14e3723a48d32b3dc0a8c545d4603fe842e30f,0xa594c8df003cd232043b34beefe020af744f378ec367a7f65b89e306e06baacb,0x310ccec449c57bf8972feab19c5cb8ba5004e2934e4fa1bd565fdbd1a44f4008,0x8172b2cf4ba365d72fca8b899a54d3c9e2539d63bd2283aca55c0d032fc793f6,0xa550234b5784656e3f3d060134e36ab9a0eecc436d182452955c995984b3e67a,0x9dc3b78821f64119671d7918b824b3b3c4b0e2124643ebe6b1e587efe9591202,0xf508498afdecb2a2f6b40912efb1611b9fe9725e9c35521be5ff2bba3c187efa,0x289aabd338cf7a2bc48512927775b5e1218b15bd83c3c740c3ec43faccef5b21,0x8c4f0da1238adb4486d2a62ff08c85af331e022c1446445059059918d4361cd3"

MARKETS_B="0xc42bc8fd13829bbe4b60d1af184f89b49731a6c2af39270246c99bc7a1bdec5,0x58f1ec6a003bfa02652fc999f28869a6f68f539cb52ab050519fdc51f8914cf4,0xb0071ae6aafddc899344459db5e5ec1012c3e97067675ac988e052bc53a2f6d9,0x7ee2862500e68cce391d50719da318e7bd0c3223aa7333d7431514440d94fd47,0xe389ee67bdaffa192952ad52e2eb8eeedc0bc735ce4a3bb46379e29b9481a6c5,0x6fa05e7a940c6fe2a0f747bd23f7d6153476e3f363a2adc13f2f1d6f52a1aaea,0xc3371396a3bbb085d31c06d4fb6bd1a1f42573c598f4360c93766a0a6bb4e09b,0xafe7b43af0d99ad8537299654b36cd3033edc1d92d50ce7b3a3c1161c3b5a8d3,0x8fb8b0b32ade467f8abf1d5e89142c885e40dbe94ed2c0678e0f320fc978417f,0xa537214ba3a8d0e7a8740a2016721ba1bb174ed73c33797007343148248c11bf,0x3c58cf1cddb01d452dbbb28ba9721d02b80fb3cbe1a6062423016ef82ab27144,0xa204c76f2d1b2f03d3cde08a96193f1ec621ffcabca8ef69653a6a64b76e7f38,0x6199d1bb20d3290a0c023b2a8d5ea978baeca30108c05f20cf5a4467ba7729cb,0xb5217a1c7805e617f8c139fdcf4a2424d1bbab7dff4c7324f37ede2649c1deb6,0xa7724e3537d5448b303ed216534bd7b82c63830739c85d78fc432ea33765d721"

USD1_METADATA="0x14b1ec8a5f31554d0cd19c390be83444ed519be2d7108c3e27dcbc4230c01fa3"

# VFN endpoints
VFN_1="http://vfn0.usce1-0.testnet.aptoslabs.com:80/v1"
VFN_2="http://vfn0.usce1-1.testnet.aptoslabs.com:80/v1"
VFN_3="http://vfn0.apne1-0.testnet.aptoslabs.com:80/v1"
VFN_4="http://aptos.cash.trading:8080/v1"

# All worker info
ALL_IPS=(
  "178.128.177.88"   # W1
  "167.99.164.45"    # W2
  "138.68.0.124"     # W3
  "138.197.221.123"  # W4
  "167.172.120.193"  # W5
  "138.68.22.167"    # W6
  "157.245.168.139"  # W7
  "206.189.160.224"  # W8
  "165.227.20.62"    # W9
  "165.227.4.56"     # W10
  "104.248.79.36"    # W11
  "165.227.27.110"   # W12
  "178.128.70.11"    # W13
  "138.197.196.42"   # W14
)

WORKER_NAMES=(W1 W2 W3 W4 W5 W6 W7 W8 W9 W10 W11 W12 W13 W14)

# Better VFN distribution - 3-4 workers per endpoint, spread contracts evenly
WORKER_VFNS=(
  "$VFN_1"  # W1 - Contract A
  "$VFN_2"  # W2 - Contract A
  "$VFN_3"  # W3 - Contract A
  "$VFN_4"  # W4 - Contract A
  "$VFN_1"  # W5 - Contract A
  "$VFN_2"  # W6 - Contract A
  "$VFN_3"  # W7 - Contract A
  "$VFN_4"  # W8 - Contract B
  "$VFN_1"  # W9 - Contract B
  "$VFN_2"  # W10 - Contract B
  "$VFN_3"  # W11 - Contract B
  "$VFN_4"  # W12 - Contract B
  "$VFN_1"  # W13 - Contract B
  "$VFN_2"  # W14 - Contract B
)

# Account ranges
WORKER_STARTS=(0 357 714 1071 1428 1785 2142 2500 2857 3214 3571 3928 4285 4642)
WORKER_COUNTS=(357 357 357 357 357 357 358 357 357 357 357 357 357 358)

# Contract assignment
WORKER_CONTRACTS=("$CONTRACT_A" "$CONTRACT_A" "$CONTRACT_A" "$CONTRACT_A" "$CONTRACT_A" "$CONTRACT_A" "$CONTRACT_A" "$CONTRACT_B" "$CONTRACT_B" "$CONTRACT_B" "$CONTRACT_B" "$CONTRACT_B" "$CONTRACT_B" "$CONTRACT_B")
WORKER_MARKETS=("$MARKETS_A" "$MARKETS_A" "$MARKETS_A" "$MARKETS_A" "$MARKETS_A" "$MARKETS_A" "$MARKETS_A" "$MARKETS_B" "$MARKETS_B" "$MARKETS_B" "$MARKETS_B" "$MARKETS_B" "$MARKETS_B" "$MARKETS_B")

# Ultra-conservative settings
ACCOUNT_CONCURRENCY=10
BATCH_SIZE=10
BATCH_DELAY_MS=80
WORKER_THREADS=2

MNEMONIC="venture advance oval deliver profit drill chaos cabbage rapid tag south once rifle call flavor vague sword float town vault calm such grocery elder"

echo "========================================================================"
echo "   ULTRA-CONSERVATIVE CONFIG FOR 100% SUCCESS"
echo "========================================================================"
echo ""
echo "Settings:"
echo "  - ACCOUNT_CONCURRENCY: $ACCOUNT_CONCURRENCY"
echo "  - BATCH_SIZE: $BATCH_SIZE"
echo "  - BATCH_DELAY_MS: $BATCH_DELAY_MS"
echo "  - WORKER_THREADS: $WORKER_THREADS"
echo ""
echo "Expected HTTP load:"
echo "  - Per worker: $WORKER_THREADS threads × $ACCOUNT_CONCURRENCY × $BATCH_SIZE = $((WORKER_THREADS * ACCOUNT_CONCURRENCY * BATCH_SIZE)) concurrent"
echo "  - Per VFN (~4 workers): ~$((4 * WORKER_THREADS * ACCOUNT_CONCURRENCY * BATCH_SIZE)) concurrent"
echo ""

# Update each worker
echo "[1/2] Updating all workers..."
echo ""

for i in "${!ALL_IPS[@]}"; do
  ip="${ALL_IPS[$i]}"
  name="${WORKER_NAMES[$i]}"
  vfn="${WORKER_VFNS[$i]}"
  start="${WORKER_STARTS[$i]}"
  count="${WORKER_COUNTS[$i]}"
  contract="${WORKER_CONTRACTS[$i]}"
  markets="${WORKER_MARKETS[$i]}"

  echo "  $name ($ip): accounts $start-$((start + count - 1))"

  script_content="#!/bin/bash
# Worker $name - Ultra-conservative config
export SEED_MNEMONIC=\"$MNEMONIC\"
export ACCOUNT_START_INDEX=$start
export ACCOUNT_COUNT=$count
export ACCOUNT_CONCURRENCY=$ACCOUNT_CONCURRENCY
export BATCH_SIZE=$BATCH_SIZE
export BATCH_DELAY_MS=$BATCH_DELAY_MS
export WORKER_COUNT=$WORKER_THREADS
export USE_ORDERLESS=false
export RPC_MODE=custom
export FULLNODE_URL=\"$vfn\"
export CONTRACT_ADDRESS=\"$contract\"
export USD1_METADATA=\"$USD1_METADATA\"
export MULTI_MARKETS=\"$markets\"
export PORT=3001

cd /opt/aptos-hft
exec npx tsx server/hft-piscina-server.ts turbo"

  echo "$script_content" | ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no root@$ip "cat > /opt/aptos-hft/start-hft.sh && chmod +x /opt/aptos-hft/start-hft.sh" 2>/dev/null && echo "    Updated" || echo "    FAILED"
done

echo ""
echo "[2/2] Restarting all workers..."
echo ""

for ip in "${ALL_IPS[@]}"; do
  ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no root@$ip "
    cd /opt/aptos-hft
    pm2 delete hft 2>/dev/null || true
    pm2 start start-hft.sh --name hft
  " 2>/dev/null &
done
wait

echo ""
echo "Waiting 45 seconds for workers to initialize (account derivation)..."
sleep 45

# Verify
echo ""
echo "========================================================================"
echo "   VERIFICATION"
echo "========================================================================"
echo ""

printf "%-4s %-18s %-8s %-10s %s\n" "ID" "IP" "Status" "Accounts" "VFN"
echo "-------------------------------------------------------------------"

for i in "${!ALL_IPS[@]}"; do
  ip="${ALL_IPS[$i]}"
  name="${WORKER_NAMES[$i]}"
  vfn="${WORKER_VFNS[$i]}"

  status=$(curl -s --connect-timeout 5 "http://$ip:3001/status" 2>/dev/null | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
  accounts=$(curl -s --connect-timeout 5 "http://$ip:3001/status" 2>/dev/null | grep -o '"total":[0-9]*' | head -1 | cut -d':' -f2)

  if [ -n "$status" ]; then
    printf "%-4s %-18s %-8s %-10s %s\n" "$name" "$ip" "$status" "${accounts:-?}" "${vfn:7:30}"
  else
    printf "%-4s %-18s %-8s %-10s %s\n" "$name" "$ip" "OFFLINE" "-" "${vfn:7:30}"
  fi
done

echo "-------------------------------------------------------------------"
echo ""
echo "Done! Run a test with:"
echo "  for ip in ${ALL_IPS[*]}; do curl -X POST \"http://\$ip:3001/start?duration=30\" & done"
