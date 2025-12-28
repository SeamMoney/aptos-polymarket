#!/bin/bash

# Ultra HFT Monitor - Live stats display
# Usage: ./scripts/monitor-ultra.sh

echo "=============================================="
echo "  ULTRA HFT MONITOR"
echo "=============================================="
echo "Connecting to ws://localhost:3001..."
echo "Press Ctrl+C to stop monitoring"
echo ""

node -e "
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:3001');

ws.on('open', () => {
  console.log('Connected! Monitoring trades...\n');
});

ws.on('message', (data) => {
  try {
    const msg = JSON.parse(data);
    if (msg.stats) {
      const s = msg.stats;
      const line = \`TPS: \${String(s.currentTps).padStart(4)} | Peak: \${String(s.peakTps).padStart(4)} | Trades: \${String(s.totalTrades).padStart(6)} | Success: \${s.successRate}% | Accounts: \${s.activeAccounts}/\${s.totalAccounts}\`;
      process.stdout.write('\r' + line + '          ');
    }
  } catch(e) {}
});

ws.on('error', (e) => {
  console.error('Error:', e.message);
  console.log('Make sure the Ultra HFT server is running: ./scripts/start-ultra-hft.sh');
  process.exit(1);
});

ws.on('close', () => {
  console.log('\nConnection closed');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n\nMonitoring stopped');
  ws.close();
  process.exit(0);
});
"
