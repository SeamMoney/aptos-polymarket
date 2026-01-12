#!/bin/bash
# Fix Worker 1 to use quantum mode instead of dryrun

echo "Fixing Worker 1 run script to use QUANTUM mode..."

ssh root@178.128.177.88 'sed -i "s/npx tsx hft-ultra-server.ts$/npx tsx hft-ultra-server.ts quantum/" /opt/aptos-hft/run-hft.sh'

echo "✓ Worker 1 now set to quantum mode"
echo ""
echo "Verifying:"
ssh root@178.128.177.88 'grep "npx tsx" /opt/aptos-hft/run-hft.sh'
