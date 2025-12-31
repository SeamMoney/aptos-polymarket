#!/bin/bash
# Check status of remote HFT worker
# Usage: ./scripts/check-remote-hft.sh

REMOTE_VM="209.38.172.28"

echo "Checking remote HFT worker on $REMOTE_VM..."
echo ""

# Check if process is running
echo "=== Process Status ==="
ssh root@$REMOTE_VM "pgrep -f 'hft-ultra-server' && echo 'HFT worker is RUNNING' || echo 'HFT worker is NOT running'"

echo ""
echo "=== Recent Logs ==="
ssh root@$REMOTE_VM "tail -50 /tmp/hft-remote.log 2>/dev/null" || echo "No logs available"
