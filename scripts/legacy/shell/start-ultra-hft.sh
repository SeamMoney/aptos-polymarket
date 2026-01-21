#!/bin/bash

# Ultra HFT Launcher - Easy one-command startup
# Usage: ./scripts/start-ultra-hft.sh

echo "=============================================="
echo "  ULTRA HFT LAUNCHER"
echo "=============================================="

# Configuration (your keys)
export ULTRA_PRIVATE_KEYS="0x6e2fca34586261b6f22a973c20024b78ddb370d87f7c974315fb97ba56716a7f,0xe61d22b3dc37c537a20d5b301c4d2b409b2f93cd7b2915f3518d49517c2ab6c4,0x4542c2e4a39beee8202eee0cddeceea886687b21b54b8f50c17e729251fdd7f5,0xcf5154af9664bbc2634fddfcce2317ed788b35de7f004ac0e24aefd68a0b10c5"
export APTOS_API_KEY="AG-3JMDT54EN4DCLULDWAUXCYGQ56JJQCYHH"

# Kill any existing server on port 3001 (connects to UI)
echo "Stopping any existing server..."
lsof -ti:3001 | xargs kill -9 2>/dev/null || true
sleep 1

echo ""
echo "Starting Ultra HFT Server on port 3001 (connects to UI)..."
echo "  - 4 parallel accounts"
echo "  - 20 txns/batch, 150ms delay"
echo "  - Target: 200-300 TPS"
echo "  - UI: Open your browser to see HFT visualizer"
echo ""
echo "Press Ctrl+C to stop"
echo "=============================================="
echo ""

# Start the server
npx tsx server/hft-ultra-server.ts
