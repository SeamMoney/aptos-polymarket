#!/bin/bash
#
# DRYRUN VIEWER - Simple view for quick 100 TPS test
#
# Usage: ./scripts/dryrun-view.sh
#

WORKER1="178.128.177.88"

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║           🧪 DRYRUN VIEWER (~100 TPS, 5 sec)               ║"
echo "╠════════════════════════════════════════════════════════════╣"
echo "║  Worker 1: ${WORKER1}                                 ║"
echo "║  Accounts: 2                                               ║"
echo "║  Duration: 5 seconds                                       ║"
echo "║  Est. Cost: < 0.5 APT                                      ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "Streaming logs from Worker 1..."
echo "Press Ctrl+C to stop"
echo ""

ssh root@${WORKER1} 'tail -f /tmp/hft-worker.log'
