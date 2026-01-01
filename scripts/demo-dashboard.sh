#!/bin/bash
#
# APTOS HFT DEMO DASHBOARD
# ========================
# Beautiful tmux dashboard showing all 3 workers
#
# Usage: ./scripts/demo-dashboard.sh
#

set -e

# Worker VMs
WORKER1="178.128.177.88"
WORKER2="147.182.237.239"
WORKER3="161.35.231.0"

SESSION="hft-demo"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}"
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║           🚀 APTOS HFT DEMO DASHBOARD 🚀                      ║"
echo "╠═══════════════════════════════════════════════════════════════╣"
echo "║  Worker 1: ${WORKER1}  (9 accounts)                      ║"
echo "║  Worker 2: ${WORKER2}  (8 accounts)                    ║"
echo "║  Worker 3: ${WORKER3}     (8 accounts)                      ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check if tmux is installed
if ! command -v tmux &> /dev/null; then
    echo -e "${RED}Error: tmux is not installed. Install with: brew install tmux${NC}"
    exit 1
fi

# Kill existing session if exists
tmux kill-session -t $SESSION 2>/dev/null || true

echo -e "${GREEN}Creating tmux dashboard...${NC}"

# Create new session with first pane (Worker 1)
tmux new-session -d -s $SESSION -n "HFT Demo"

# Set pane border style
tmux set -g pane-border-style "fg=cyan"
tmux set -g pane-active-border-style "fg=green,bold"
tmux set -g pane-border-format " #{pane_index}: #{pane_title} "
tmux set -g pane-border-status top

# Worker 1 (top-left)
tmux select-pane -T "⚡ Worker 1 (${WORKER1})"
tmux send-keys "echo -e '\\033[36m═══ WORKER 1: ${WORKER1} (9 accounts) ═══\\033[0m'" Enter
tmux send-keys "ssh root@${WORKER1} 'tail -f /tmp/hft-worker.log 2>/dev/null || echo \"Waiting for demo to start...\"'" Enter

# Split horizontally for Worker 2 (top-right)
tmux split-window -h
tmux select-pane -T "⚡ Worker 2 (${WORKER2})"
tmux send-keys "echo -e '\\033[36m═══ WORKER 2: ${WORKER2} (8 accounts) ═══\\033[0m'" Enter
tmux send-keys "ssh root@${WORKER2} 'tail -f /tmp/hft-worker.log 2>/dev/null || echo \"Waiting for demo to start...\"'" Enter

# Split vertically for Worker 3 (bottom-right)
tmux split-window -v
tmux select-pane -T "⚡ Worker 3 (${WORKER3})"
tmux send-keys "echo -e '\\033[36m═══ WORKER 3: ${WORKER3} (8 accounts) ═══\\033[0m'" Enter
tmux send-keys "ssh root@${WORKER3} 'tail -f /tmp/hft-worker.log 2>/dev/null || echo \"Waiting for demo to start...\"'" Enter

# Go to first pane and split for combined stats (bottom-left)
tmux select-pane -t 0
tmux split-window -v
tmux select-pane -T "📊 Combined Stats"
tmux send-keys "echo -e '\\033[33m═══ COMBINED STATS ═══\\033[0m'" Enter
tmux send-keys "watch -n 2 -c './scripts/orchestrator.sh status 2>/dev/null | head -20'" Enter

# Even out the panes
tmux select-layout tiled

# Set window title
tmux rename-window "🚀 30K TPS Demo"

echo ""
echo -e "${GREEN}Dashboard created!${NC}"
echo ""
echo -e "${YELLOW}Commands:${NC}"
echo "  Attach:  tmux attach -t $SESSION"
echo "  Detach:  Ctrl+B, then D"
echo "  Kill:    tmux kill-session -t $SESSION"
echo ""
echo -e "${CYAN}Attaching to dashboard...${NC}"
echo ""

# Attach to session
tmux attach -t $SESSION
