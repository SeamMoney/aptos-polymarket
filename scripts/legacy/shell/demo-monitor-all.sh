#!/bin/bash
#
# MONITOR ALL WORKERS - TMUX DASHBOARD
# =====================================
#
# Shows all 3 workers + aggregated stats
#
# Usage: ./scripts/demo-monitor-all.sh
#

WORKER1="178.128.177.88"
WORKER2="147.182.237.239"
WORKER3="161.35.231.0"

# Colors
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${NC}  ${BOLD}📊 30K TPS DEMO MONITOR${NC}                                      ${CYAN}║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Kill existing session
tmux kill-session -t demo-monitor 2>/dev/null || true

# Create new session with 4 panes
tmux new-session -d -s demo-monitor -n "demo"

# Top pane: Worker 1 (Master)
tmux send-keys "echo -e '\\033[1;36m═══ WORKER 1 - MASTER ($WORKER1) ═══\\033[0m' && ssh root@$WORKER1 -t 'tmux attach -t hft 2>/dev/null || tail -f /tmp/hft.log 2>/dev/null || echo Waiting...'" Enter

# Split for bottom row
tmux split-window -v -p 50

# Bottom left: Worker 2
tmux send-keys "echo -e '\\033[1;33m═══ WORKER 2 ($WORKER2) ═══\\033[0m' && ssh root@$WORKER2 -t 'tmux attach -t hft 2>/dev/null || tail -f /tmp/hft.log 2>/dev/null || echo Waiting...'" Enter

# Split bottom row
tmux split-window -h

# Bottom right: Worker 3
tmux send-keys "echo -e '\\033[1;32m═══ WORKER 3 ($WORKER3) ═══\\033[0m' && ssh root@$WORKER3 -t 'tmux attach -t hft 2>/dev/null || tail -f /tmp/hft.log 2>/dev/null || echo Waiting...'" Enter

# Create a stats pane at very bottom
tmux split-window -v -p 20
tmux send-keys "watch -n 2 'echo \"=== AGGREGATED STATS ===\"; echo \"\"; W1=\$(curl -s http://$WORKER1:3001/stats 2>/dev/null); W2=\$(curl -s http://$WORKER2:3001/stats 2>/dev/null); W3=\$(curl -s http://$WORKER3:3001/stats 2>/dev/null); TPS1=\$(echo \$W1 | jq -r .currentTps 2>/dev/null || echo 0); TPS2=\$(echo \$W2 | jq -r .currentTps 2>/dev/null || echo 0); TPS3=\$(echo \$W3 | jq -r .currentTps 2>/dev/null || echo 0); TOTAL=\$((TPS1 + TPS2 + TPS3)); echo \"Worker 1: \$TPS1 TPS  |  Worker 2: \$TPS2 TPS  |  Worker 3: \$TPS3 TPS\"; echo \"\"; echo \"TOTAL TPS: \$TOTAL\"; echo \"\"'" Enter

# Select top pane
tmux select-pane -t 0

echo "Attaching to dashboard..."
echo "Press Ctrl+B D to detach"
echo ""

tmux attach -t demo-monitor
