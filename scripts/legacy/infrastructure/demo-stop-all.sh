#!/bin/bash
#
# STOP ALL WORKERS
# =================
#
# Usage: ./scripts/demo-stop-all.sh
#

WORKER1="178.128.177.88"
WORKER2="147.182.237.239"
WORKER3="161.35.231.0"

echo "Stopping all workers..."

for IP in $WORKER1 $WORKER2 $WORKER3; do
    echo "  Stopping $IP..."
    ssh root@$IP "pkill -f 'hft-ultra-server' 2>/dev/null; tmux kill-session -t hft 2>/dev/null" 2>/dev/null &
done

wait

echo ""
echo "✓ All workers stopped"
