#!/bin/bash
# Run 3 HFT workers for ~20k TPS
# Local Mac (accounts 1-7) + VM1 (accounts 8-14) + VM2 (accounts 15-20)
#
# Usage: ./scripts/run-3-workers.sh [mode] [duration]

MODE=${1:-normal}
DURATION=${2:-60}

VM1="209.38.172.28"
VM2="147.182.237.239"

echo "=============================================================="
echo "  3-WORKER DISTRIBUTED HFT - TARGET: 20k+ TPS"
echo "=============================================================="
echo "Mode: $MODE | Duration: ${DURATION}s"
echo ""
echo "Worker 1 (Local):  7 accounts (1-7)  @ 8,000 APT each"
echo "Worker 2 ($VM1): 7 accounts (8-14) @ mixed"
echo "Worker 3 ($VM2): 6 accounts (15-20) @ 4,080 APT each"
echo "=============================================================="
echo ""

# Common env vars for local worker
export APTOS_API_KEY=AG-3JMDT54EN4DCLULDWAUXCYGQ56JJQCYHH
export QUICKNODE_RPC="https://polished-evocative-borough.aptos-testnet.quiknode.pro/a0b08bae2dc34e4a8774d91414948d02a5ce2975/v1"
export CONTRACT_ADDRESS=0xa2e5e47aab07fed78a3bcf95135ee2dad20c547499c94cb16a3e047859ffa7e1
export MULTI_MARKET=0xfefd1b67818ee4ef12a7953852c83f0efb411a9b92c518a52ba92555e4abdd96
export HFT_PORT=3001
# YOUR SYNCED FULLNODE - NO RATE LIMITS = 30k+ TPS!
export EXTRA_RPC_ENDPOINTS="https://aptos.cash.trading/v1"

# Local worker gets accounts 1-7 (first 7 high-balance accounts)
export ULTRA_PRIVATE_KEYS="0x6e2fca34586261b6f22a973c20024b78ddb370d87f7c974315fb97ba56716a7f,0xe61d22b3dc37c537a20d5b301c4d2b409b2f93cd7b2915f3518d49517c2ab6c4,0x4542c2e4a39beee8202eee0cddeceea886687b21b54b8f50c17e729251fdd7f5,0xcf5154af9664bbc2634fddfcce2317ed788b35de7f004ac0e24aefd68a0b10c5,ed25519-priv-0xb7d1f406e48c2eddffe987f98445dd4a353e8e9d1630d878621ded084bdd77c7,ed25519-priv-0xa8088ee787b847f6304807a8b09d1afc15409082ee9c8b7eda6919b0ecb86ea8,ed25519-priv-0xb5305eb83498dcba61242ccc91fac35263d9b44bddaf5e7417adbaceb1cfcb36"

# Start remote workers first (in background)
echo "[1/3] Starting Worker 2 on $VM1..."
ssh root@$VM1 "pkill -f hft-ultra-server 2>/dev/null; cd /opt/aptos-hft && nohup ./run-hft.sh $MODE $DURATION > /tmp/hft.log 2>&1 &" &
W1_SSH=$!

echo "[2/3] Starting Worker 3 on $VM2..."
ssh root@$VM2 "pkill -f hft-ultra-server 2>/dev/null; cd /opt/aptos-hft && nohup ./run-hft.sh $MODE $DURATION > /tmp/hft.log 2>&1 &" &
W2_SSH=$!

# Wait for SSH commands to complete
wait $W1_SSH $W2_SSH
sleep 2

echo "[3/3] Starting local worker..."
echo ""
echo "=============================================================="
echo "  ALL 3 WORKERS RUNNING - WATCH FOR TPS!"
echo "=============================================================="
echo ""

# Run local worker in foreground
npx tsx server/hft-ultra-server.ts $MODE $DURATION

echo ""
echo "=============================================================="
echo "  LOCAL WORKER COMPLETE"
echo "=============================================================="
echo ""

# Show remote logs
echo "=== Worker 2 ($VM1) Summary ==="
ssh root@$VM1 "tail -30 /tmp/hft.log 2>/dev/null | grep -E '(TPS|Fired|completed|Total)'" || echo "Logs not available"

echo ""
echo "=== Worker 3 ($VM2) Summary ==="
ssh root@$VM2 "tail -30 /tmp/hft.log 2>/dev/null | grep -E '(TPS|Fired|completed|Total)'" || echo "Logs not available"

echo ""
echo "=============================================================="
echo "  ALL 3 WORKERS COMPLETE"
echo "=============================================================="
