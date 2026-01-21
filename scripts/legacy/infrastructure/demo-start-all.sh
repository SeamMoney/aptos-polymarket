#!/bin/bash
#
# START ALL WORKERS FOR 30K TPS DEMO
# ===================================
#
# Two-Key Activation:
#   KEY 1: This script starts all workers
#   KEY 2: ARM button in UI
#   → LAUNCH button appears
#
# Usage: ./scripts/demo-start-all.sh
#

set -e

# Worker VMs
WORKER1="178.128.177.88"   # MASTER - UI connects here
WORKER2="147.182.237.239"  # Secondary
WORKER3="161.35.231.0"     # Secondary

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${NC}  ${BOLD}🚀 30K TPS DEMO - STARTING ALL WORKERS${NC}                       ${CYAN}║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BOLD}Two-Key Activation:${NC}"
echo -e "  ${CYAN}KEY 1:${NC} This script (CLI)"
echo -e "  ${CYAN}KEY 2:${NC} ARM SYSTEM button (UI)"
echo -e "  ${GREEN}→${NC} Both needed to LAUNCH"
echo ""

# Stop any existing workers
echo -e "${YELLOW}▶ Stopping any existing workers...${NC}"
for IP in $WORKER1 $WORKER2 $WORKER3; do
    ssh root@$IP "pkill -f 'hft-ultra-server' 2>/dev/null || true; tmux kill-session -t hft 2>/dev/null || true" 2>/dev/null &
done
wait
sleep 2
echo -e "${GREEN}✓${NC} Cleared existing processes"
echo ""

# Start Worker 1 (MASTER - standby mode)
echo -e "${YELLOW}▶ Starting Worker 1 (MASTER - UI connects here)...${NC}"
ssh root@$WORKER1 << 'EOF'
tmux kill-session -t hft 2>/dev/null || true
tmux new-session -d -s hft
tmux send-keys "cd /opt/aptos-hft && ./run-hft.sh 2>&1 | tee /tmp/hft.log" Enter
EOF
echo -e "${GREEN}✓${NC} Worker 1 started in STANDBY mode (waiting for UI)"

# Start Workers 2 & 3 (Secondary - auto-start)
echo -e "${YELLOW}▶ Starting Worker 2 (auto-start quantum mode)...${NC}"
ssh root@$WORKER2 << 'EOF'
tmux kill-session -t hft 2>/dev/null || true
tmux new-session -d -s hft
tmux send-keys "cd /opt/aptos-hft && ./run-hft.sh 2>&1 | tee /tmp/hft.log" Enter
EOF
echo -e "${GREEN}✓${NC} Worker 2 started"

echo -e "${YELLOW}▶ Starting Worker 3 (auto-start quantum mode)...${NC}"
ssh root@$WORKER3 << 'EOF'
tmux kill-session -t hft 2>/dev/null || true
tmux new-session -d -s hft
tmux send-keys "cd /opt/aptos-hft && ./run-hft.sh 2>&1 | tee /tmp/hft.log" Enter
EOF
echo -e "${GREEN}✓${NC} Worker 3 started"

# Wait for servers to initialize
echo ""
echo -e "${YELLOW}▶ Waiting for servers to initialize...${NC}"
sleep 8

# Check Worker 1 health (the one UI connects to)
echo -e "${YELLOW}▶ Checking Worker 1 (master) health...${NC}"
if curl -s --connect-timeout 5 "http://$WORKER1:3001/health" | grep -q "ok"; then
    echo -e "${GREEN}✓${NC} Worker 1 is healthy and ready!"
else
    echo -e "${YELLOW}⚠${NC} Worker 1 may still be starting. Check in a moment."
fi

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║${NC}  ${BOLD}✓ KEY 1 COMPLETE - ALL WORKERS RUNNING${NC}                       ${GREEN}║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BOLD}Worker Status:${NC}"
echo -e "  Worker 1 (${CYAN}$WORKER1${NC}): MASTER - STANDBY (waiting for UI)"
echo -e "  Worker 2 (${CYAN}$WORKER2${NC}): Running quantum mode"
echo -e "  Worker 3 (${CYAN}$WORKER3${NC}): Running quantum mode"
echo ""
echo -e "${BOLD}Now complete KEY 2:${NC}"
echo ""
echo -e "  1. Open: ${CYAN}https://aptos-polymarket.vercel.app/demo-day${NC}"
echo -e "  2. Click ${YELLOW}ARM SYSTEM${NC}"
echo -e "  3. Click ${GREEN}LAUNCH DEMO${NC}"
echo ""
echo -e "${BOLD}Monitor all workers:${NC}"
echo -e "  ${CYAN}./scripts/demo-monitor-all.sh${NC}"
echo ""
echo -e "${BOLD}Stop all workers:${NC}"
echo -e "  ${CYAN}./scripts/demo-stop-all.sh${NC}"
echo ""
