#!/bin/bash
# Watch TPS across all 3 workers in real-time

WORKER1="root@178.128.177.88"
WORKER2="root@147.182.237.239"
WORKER3="root@161.35.231.0"

while true; do
  clear
  echo "╔══════════════════════════════════════════════════════════╗"
  echo "║  📊 LIVE TPS MONITOR - $(date '+%H:%M:%S')                         ║"
  echo "╚══════════════════════════════════════════════════════════╝"
  echo ""

  echo "Worker 1 (178.128.177.88):"
  ssh -o ConnectTimeout=3 $WORKER1 'tail -20 /tmp/hft.log 2>/dev/null | grep -E "TPS:.*Peak:" | tail -1' 2>/dev/null || echo "  (connecting...)"
  echo ""

  echo "Worker 2 (147.182.237.239):"
  ssh -o ConnectTimeout=3 $WORKER2 'tail -20 /tmp/hft.log 2>/dev/null | grep -E "TPS:.*Peak:" | tail -1' 2>/dev/null || echo "  (connecting...)"
  echo ""

  echo "Worker 3 (161.35.231.0):"
  ssh -o ConnectTimeout=3 $WORKER3 'tail -20 /tmp/hft.log 2>/dev/null | grep -E "TPS:.*Peak:" | tail -1' 2>/dev/null || echo "  (connecting...)"
  echo ""

  echo "────────────────────────────────────────────────────────────"
  echo "  Combined Peak Target: 10K+ TPS"
  echo "  Press Ctrl+C to exit"
  echo "────────────────────────────────────────────────────────────"

  sleep 5
done
