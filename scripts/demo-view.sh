#!/bin/bash
#
# APTOS HFT DEMO VIEWER
# =====================
# Clean, sexy view of all 3 workers streaming logs
#
# Usage: ./scripts/demo-view.sh
#

SESSION="hft-view"
WORKER1="178.128.177.88"
WORKER2="147.182.237.239"
WORKER3="161.35.231.0"

# Kill existing
tmux kill-session -t $SESSION 2>/dev/null || true

# Create session
tmux new-session -d -s $SESSION

# Configure beautiful appearance
tmux set-option -t $SESSION status-style "bg=#1a1a2e,fg=#e94560"
tmux set-option -t $SESSION status-left "#[fg=#00ff00,bold] ⚡ 30K TPS DEMO "
tmux set-option -t $SESSION status-right "#[fg=#ffd700] %H:%M:%S "
tmux set-option -t $SESSION pane-border-style "fg=#3a3a5c"
tmux set-option -t $SESSION pane-active-border-style "fg=#e94560,bold"

# Pane 0: Worker 1 (top)
tmux send-keys "clear && printf '\\033[36m\\033[1m╔══════════════════════════════════════════════════════════╗\\n║  ⚡ WORKER 1: ${WORKER1} │ 9 Accounts │ ~13K TPS  ║\\n╚══════════════════════════════════════════════════════════╝\\033[0m\\n' && ssh root@${WORKER1} 'tail -f /tmp/hft-worker.log'" Enter

# Pane 1: Worker 2 (middle)
tmux split-window -v
tmux send-keys "clear && printf '\\033[33m\\033[1m╔══════════════════════════════════════════════════════════╗\\n║  ⚡ WORKER 2: ${WORKER2} │ 8 Accounts │ ~12K TPS  ║\\n╚══════════════════════════════════════════════════════════╝\\033[0m\\n' && ssh root@${WORKER2} 'tail -f /tmp/hft-worker.log'" Enter

# Pane 2: Worker 3 (bottom)
tmux split-window -v
tmux send-keys "clear && printf '\\033[35m\\033[1m╔══════════════════════════════════════════════════════════╗\\n║  ⚡ WORKER 3: ${WORKER3}     │ 8 Accounts │ ~12K TPS  ║\\n╚══════════════════════════════════════════════════════════╝\\033[0m\\n' && ssh root@${WORKER3} 'tail -f /tmp/hft-worker.log'" Enter

# Balance panes evenly (horizontal stacking)
tmux select-layout even-vertical

# Show instructions
echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║              🚀 HFT DEMO VIEWER READY 🚀                   ║"
echo "╠════════════════════════════════════════════════════════════╣"
echo "║                                                            ║"
echo "║  Step 1: Start the demo                                    ║"
echo "║    ./scripts/orchestrator.sh demo                          ║"
echo "║                                                            ║"
echo "║  Step 2: Attach to this view                               ║"
echo "║    tmux attach -t hft-view                                 ║"
echo "║                                                            ║"
echo "║  Controls:                                                 ║"
echo "║    Ctrl+B, then D    → Detach                              ║"
echo "║    Ctrl+B, then ↑↓   → Switch panes                        ║"
echo "║    Ctrl+C            → Stop current tail                   ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Attach
exec tmux attach -t $SESSION
