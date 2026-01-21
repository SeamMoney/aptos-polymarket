#!/bin/bash
# Stop remote HFT worker
# Usage: ./scripts/stop-remote-hft.sh

REMOTE_VM="209.38.172.28"

echo "Stopping remote HFT worker on $REMOTE_VM..."
ssh root@$REMOTE_VM "pkill -f 'hft-ultra-server' && echo '✓ Worker stopped' || echo 'No worker running'"
