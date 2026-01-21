#!/bin/bash
# Run HFT on BOTH local machine AND remote VM for maximum TPS
# Usage: ./scripts/run-combined-hft.sh [mode] [duration]
#
# This splits accounts:
#   Local (your Mac): accounts 1-10 (8,000 APT each)
#   Remote VM:        accounts 11-20 (4,080 APT each)

MODE=${1:-normal}
DURATION=${2:-60}
REMOTE_VM="209.38.172.28"

echo "=============================================================="
echo "  COMBINED HFT - LOCAL + REMOTE VM"
echo "=============================================================="
echo "Mode: $MODE | Duration: ${DURATION}s"
echo "Local:  10 accounts (1-10) @ 8,000 APT each"
echo "Remote: 10 accounts (11-20) @ 4,080 APT each"
echo "=============================================================="
echo ""

# Common env vars
export APTOS_API_KEY=AG-3JMDT54EN4DCLULDWAUXCYGQ56JJQCYHH
export QUICKNODE_RPC="https://polished-evocative-borough.aptos-testnet.quiknode.pro/a0b08bae2dc34e4a8774d91414948d02a5ce2975/v1"
export CONTRACT_ADDRESS=0xa2e5e47aab07fed78a3bcf95135ee2dad20c547499c94cb16a3e047859ffa7e1
export MULTI_MARKET=0xfefd1b67818ee4ef12a7953852c83f0efb411a9b92c518a52ba92555e4abdd96
export HFT_PORT=3001

# Local worker gets accounts 1-10 (original high-balance accounts)
export ULTRA_PRIVATE_KEYS="0x6e2fca34586261b6f22a973c20024b78ddb370d87f7c974315fb97ba56716a7f,0xe61d22b3dc37c537a20d5b301c4d2b409b2f93cd7b2915f3518d49517c2ab6c4,0x4542c2e4a39beee8202eee0cddeceea886687b21b54b8f50c17e729251fdd7f5,0xcf5154af9664bbc2634fddfcce2317ed788b35de7f004ac0e24aefd68a0b10c5,ed25519-priv-0xb7d1f406e48c2eddffe987f98445dd4a353e8e9d1630d878621ded084bdd77c7,ed25519-priv-0xa8088ee787b847f6304807a8b09d1afc15409082ee9c8b7eda6919b0ecb86ea8,ed25519-priv-0xb5305eb83498dcba61242ccc91fac35263d9b44bddaf5e7417adbaceb1cfcb36,ed25519-priv-0xc27a6a8b6ed3013da99dc924b2f6af17f1448dedce91691f97d9e778c0761655,ed25519-priv-0xd6402b3493af005ed02b07f6cd7ffdfd37fae6d4d9c88fec6ff38e90f01b21c1,ed25519-priv-0xd375af1a686835905e15bf82f24fcaeed4b1b5b5fabe22c80e998acb804aa295"

# Start remote worker first (in background via SSH)
echo "[1/2] Starting remote worker on $REMOTE_VM..."
ssh root@$REMOTE_VM "cd /opt/aptos-hft && nohup /opt/aptos-hft/run-hft.sh $MODE $DURATION > /tmp/hft-remote.log 2>&1 &"
REMOTE_STARTED=$?

if [ $REMOTE_STARTED -eq 0 ]; then
  echo "      ✓ Remote worker started (logs: ssh root@$REMOTE_VM 'tail -f /tmp/hft-remote.log')"
else
  echo "      ✗ Failed to start remote worker"
fi

sleep 2

# Start local worker
echo "[2/2] Starting local worker..."
echo ""

npx tsx server/hft-ultra-server.ts $MODE $DURATION &
LOCAL_PID=$!

# Wait for local to finish
wait $LOCAL_PID

echo ""
echo "=============================================================="
echo "  LOCAL WORKER COMPLETED"
echo "=============================================================="

# Check remote status
echo ""
echo "Checking remote worker status..."
ssh root@$REMOTE_VM "tail -30 /tmp/hft-remote.log 2>/dev/null | grep -E '(TPS|Fired|completed|Total)'" || echo "Remote log not available"

echo ""
echo "=============================================================="
echo "  COMBINED RUN COMPLETE"
echo "=============================================================="
