#!/bin/bash
# 10K+ TPS Demo Script
# Uses ULTRA mode (best balance of speed + tracking)
# Combined peak: 9-12K TPS across 3 workers

WORKER1="root@178.128.177.88"
WORKER2="root@147.182.237.239"
WORKER3="root@161.35.231.0"

DURATION=${1:-180}  # Default 3 minutes

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║          🚀 10K+ TPS DEMO LAUNCHER 🚀                    ║"
echo "║  Mode: ULTRA (80 batch, 10K target, 90% fire-and-forget) ║"
echo "║  Duration: ${DURATION}s                                          ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Kill all
echo "[1/4] Stopping workers..."
ssh $WORKER1 'killall -9 node 2>/dev/null; true' &
ssh $WORKER2 'killall -9 node 2>/dev/null; true' &
ssh $WORKER3 'killall -9 node 2>/dev/null; true' &
wait
sleep 2

# Update scripts
echo "[2/4] Configuring ULTRA mode..."
ssh $WORKER1 "sed -i 's/npx tsx hft-ultra-server.ts.*/npx tsx hft-ultra-server.ts ultra $DURATION/' /opt/aptos-hft/run-hft.sh" &
ssh $WORKER2 "sed -i 's/npx tsx hft-ultra-server.ts.*/npx tsx hft-ultra-server.ts ultra $DURATION/' /opt/aptos-hft/run-hft.sh" &
ssh $WORKER3 "sed -i 's/npx tsx hft-ultra-server.ts.*/npx tsx hft-ultra-server.ts ultra $DURATION/' /opt/aptos-hft/run-hft.sh" &
wait

# Clear old logs
echo "[3/4] Clearing logs..."
ssh $WORKER1 'rm -f /tmp/hft.log' &
ssh $WORKER2 'rm -f /tmp/hft.log' &
ssh $WORKER3 'rm -f /tmp/hft.log' &
wait

# Start all
echo "[4/4] Launching workers..."
ssh $WORKER1 'cd /opt/aptos-hft && nohup bash run-hft.sh > /tmp/hft.log 2>&1 &' &
ssh $WORKER2 'cd /opt/aptos-hft && nohup bash run-hft.sh > /tmp/hft.log 2>&1 &' &
ssh $WORKER3 'cd /opt/aptos-hft && nohup bash run-hft.sh > /tmp/hft.log 2>&1 &' &
wait
echo ""

echo "╔══════════════════════════════════════════════════════════╗"
echo "║  ✓ ALL 3 WORKERS LAUNCHED IN ULTRA MODE                  ║"
echo "║                                                          ║"
echo "║  Expected Peak: 9-12K TPS (combined)                     ║"
echo "║  Per Worker: ~3-4K TPS                                   ║"
echo "║                                                          ║"
echo "║  Monitor: ./scripts/watch-tps.sh                         ║"
echo "║  Workers will run for ${DURATION}s                               ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Wait and show initial stats
echo "Waiting 20s for initialization..."
sleep 20

echo ""
echo "═══════════════════ INITIAL STATS ═══════════════════"
echo ""

# Worker 1
echo "Worker 1 (178.128.177.88):"
W1_STATS=$(ssh $WORKER1 'tail -100 /tmp/hft.log 2>/dev/null | grep -E "TPS:.*Peak:" | tail -1')
echo "  $W1_STATS"
echo ""

# Worker 2
echo "Worker 2 (147.182.237.239):"
W2_STATS=$(ssh $WORKER2 'tail -100 /tmp/hft.log 2>/dev/null | grep -E "TPS:.*Peak:" | tail -1')
echo "  $W2_STATS"
echo ""

# Worker 3
echo "Worker 3 (161.35.231.0):"
W3_STATS=$(ssh $WORKER3 'tail -100 /tmp/hft.log 2>/dev/null | grep -E "TPS:.*Peak:" | tail -1')
echo "  $W3_STATS"
echo ""

echo "═════════════════════════════════════════════════════"
echo ""
echo "Workers running for ${DURATION}s. Use Ctrl+C to exit monitoring."
