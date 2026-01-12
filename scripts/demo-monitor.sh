#!/bin/bash
#
# DEMO MONITORING DASHBOARD
# ==========================
#
# Creates a tmux session with panes showing:
#   - Remote HFT server logs
#   - TPS stats (curl polling)
#   - Fullnode status
#
# Usage: ./scripts/demo-monitor.sh
#

SERVER_IP="aptos.cash.trading"
SERVER_PORT="3001"

# Colors
CYAN='\033[0;36m'
GREEN='\033[0;32m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${CYAN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${NC}  ${BOLD}📊 DEMO MONITORING DASHBOARD${NC}                     ${CYAN}║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════╝${NC}"
echo ""

# Kill existing session
tmux kill-session -t demo-monitor 2>/dev/null || true

# Create new session
tmux new-session -d -s demo-monitor -n "demo"

# Pane 0: HFT Server logs (main pane - top)
tmux send-keys -t demo-monitor "ssh root@$SERVER_IP -t 'tmux attach -t hft-demo || (echo \"Waiting for server...\"; sleep 5; tmux attach -t hft-demo)'" Enter

# Split horizontally for bottom row
tmux split-window -t demo-monitor -v -p 30

# Pane 1: Live TPS stats (bottom left)
tmux send-keys -t demo-monitor "watch -n 1 'curl -s http://$SERVER_IP:$SERVER_PORT/stats 2>/dev/null | jq -r \"\\\"TPS: \\(.currentTps) | Peak: \\(.peakTps) | Trades: \\(.totalTrades) | Success: \\(.successRate)%\\\"\" 2>/dev/null || echo \"Waiting for server...\"'" Enter

# Split bottom pane
tmux split-window -t demo-monitor -h

# Pane 2: Fullnode status (bottom right)
tmux send-keys -t demo-monitor "watch -n 5 'echo \"=== FULLNODE STATUS ===\"; curl -s http://$SERVER_IP:8080/v1 2>/dev/null | jq -r \"\\\"Chain: \\(.chain_id) | Block: \\(.block_height) | Epoch: \\(.epoch)\\\"\" 2>/dev/null || echo \"Checking...\"'" Enter

# Select top pane
tmux select-pane -t demo-monitor:0.0

echo -e "${GREEN}✓${NC} Dashboard created!"
echo ""
echo -e "Attaching to session..."
echo -e "Press ${CYAN}Ctrl+B D${NC} to detach"
echo ""

# Attach to session
tmux attach -t demo-monitor
