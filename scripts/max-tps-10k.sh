#!/bin/bash
# MAX TPS SCRIPT - Target 10K+ TPS across 3 workers
# Uses QUANTUM mode (150 batch, 20ms delay) for maximum throughput

WORKER1="root@178.128.177.88"
WORKER2="root@147.182.237.239"
WORKER3="root@161.35.231.0"

DURATION=${1:-300}  # Default 5 minutes

echo "=============================================="
echo "  🚀 MAX TPS LAUNCHER - QUANTUM MODE 🚀"
echo "  Target: 10,000+ TPS across 3 workers"
echo "  Duration: ${DURATION}s"
echo "=============================================="
echo ""

# Step 1: Kill all existing processes
echo "=== Stopping all workers ==="
ssh $WORKER1 'pkill -9 -f "hft-ultra" 2>/dev/null; pkill -9 -f "tsx.*server" 2>/dev/null; killall node 2>/dev/null; exit 0' &
ssh $WORKER2 'pkill -9 -f "hft-ultra" 2>/dev/null; pkill -9 -f "tsx.*server" 2>/dev/null; killall node 2>/dev/null; exit 0' &
ssh $WORKER3 'pkill -9 -f "hft-ultra" 2>/dev/null; pkill -9 -f "tsx.*server" 2>/dev/null; killall node 2>/dev/null; exit 0' &
wait
sleep 2
echo "✓ All workers stopped"
echo ""

# Step 2: Update scripts to QUANTUM mode
echo "=== Updating all workers to QUANTUM mode ==="
ssh $WORKER1 "sed -i 's/npx tsx hft-ultra-server.ts.*/npx tsx hft-ultra-server.ts quantum $DURATION/' /opt/aptos-hft/run-hft.sh" &
ssh $WORKER2 "sed -i 's/npx tsx hft-ultra-server.ts.*/npx tsx hft-ultra-server.ts quantum $DURATION/' /opt/aptos-hft/run-hft.sh" &
ssh $WORKER3 "sed -i 's/npx tsx hft-ultra-server.ts.*/npx tsx hft-ultra-server.ts quantum $DURATION/' /opt/aptos-hft/run-hft.sh" &
wait
echo "✓ All workers set to quantum mode"
echo ""

# Step 3: Start all workers
echo "=== Starting all workers ==="
ssh $WORKER1 'cd /opt/aptos-hft && nohup bash run-hft.sh > /tmp/hft.log 2>&1 &' &
ssh $WORKER2 'cd /opt/aptos-hft && nohup bash run-hft.sh > /tmp/hft.log 2>&1 &' &
ssh $WORKER3 'cd /opt/aptos-hft && nohup bash run-hft.sh > /tmp/hft.log 2>&1 &' &
wait
echo "✓ All workers started"
echo ""

# Step 4: Wait for startup
echo "=== Waiting 15s for workers to initialize... ==="
sleep 15
echo ""

# Step 5: Show initial stats
echo "=============================================="
echo "  📊 INITIAL STATS"
echo "=============================================="
echo ""
echo "--- Worker 1 (178.128.177.88) ---"
ssh $WORKER1 'grep "HFT STATS" -A 6 /tmp/hft.log 2>/dev/null | tail -7 || echo "Starting up..."'
echo ""
echo "--- Worker 2 (147.182.237.239) ---"
ssh $WORKER2 'grep "HFT STATS" -A 6 /tmp/hft.log 2>/dev/null | tail -7 || echo "Starting up..."'
echo ""
echo "--- Worker 3 (161.35.231.0) ---"
ssh $WORKER3 'grep "HFT STATS" -A 6 /tmp/hft.log 2>/dev/null | tail -7 || echo "Starting up..."'
echo ""

echo "=============================================="
echo "  🎯 QUANTUM MODE ACTIVE"
echo "  Run ./scripts/monitor-tps.sh to watch stats"
echo "  Workers will run for ${DURATION}s"
echo "=============================================="
