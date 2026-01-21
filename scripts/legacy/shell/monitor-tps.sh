#!/bin/bash
# Monitor TPS across all 3 workers

WORKER1="root@178.128.177.88"
WORKER2="root@147.182.237.239"
WORKER3="root@161.35.231.0"

while true; do
  clear
  echo "=============================================="
  echo "  📊 LIVE TPS MONITOR - $(date '+%H:%M:%S')"
  echo "=============================================="
  echo ""

  # Get stats from each worker
  W1_STATS=$(ssh -o ConnectTimeout=3 $WORKER1 'grep "TPS:" /tmp/hft.log 2>/dev/null | tail -1' 2>/dev/null)
  W2_STATS=$(ssh -o ConnectTimeout=3 $WORKER2 'grep "TPS:" /tmp/hft.log 2>/dev/null | tail -1' 2>/dev/null)
  W3_STATS=$(ssh -o ConnectTimeout=3 $WORKER3 'grep "TPS:" /tmp/hft.log 2>/dev/null | tail -1' 2>/dev/null)

  # Extract TPS numbers (crude but works)
  W1_TPS=$(echo "$W1_STATS" | grep -oP 'TPS:\s*\K[0-9,]+' | tr -d ',')
  W2_TPS=$(echo "$W2_STATS" | grep -oP 'TPS:\s*\K[0-9,]+' | tr -d ',')
  W3_TPS=$(echo "$W3_STATS" | grep -oP 'TPS:\s*\K[0-9,]+' | tr -d ',')

  # Extract Peak TPS
  W1_PEAK=$(echo "$W1_STATS" | grep -oP 'Peak:\s*\K[0-9,]+' | tr -d ',')
  W2_PEAK=$(echo "$W2_STATS" | grep -oP 'Peak:\s*\K[0-9,]+' | tr -d ',')
  W3_PEAK=$(echo "$W3_STATS" | grep -oP 'Peak:\s*\K[0-9,]+' | tr -d ',')

  # Calculate totals
  TOTAL_TPS=$((${W1_TPS:-0} + ${W2_TPS:-0} + ${W3_TPS:-0}))
  TOTAL_PEAK=$((${W1_PEAK:-0} + ${W2_PEAK:-0} + ${W3_PEAK:-0}))

  echo "Worker 1: ${W1_TPS:-0} TPS (Peak: ${W1_PEAK:-0})"
  echo "Worker 2: ${W2_TPS:-0} TPS (Peak: ${W2_PEAK:-0})"
  echo "Worker 3: ${W3_TPS:-0} TPS (Peak: ${W3_PEAK:-0})"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  COMBINED: $TOTAL_TPS TPS (Peak: $TOTAL_PEAK)"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "Press Ctrl+C to stop monitoring"

  sleep 5
done
