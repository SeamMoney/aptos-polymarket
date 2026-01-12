#!/bin/bash
# Deploy USD1 HFT configuration to all VM workers
#
# This script updates all VMs with the new USD1-based HFT config:
# - New contract address with USD1 support
# - 12 USD1-backed markets
# - Correct account distribution per worker
#
# Usage: ./scripts/deploy-vm-usd1-config.sh

set -e

VM1="178.128.177.88"
VM2="147.182.237.239"
VM3="161.35.231.0"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_DIR="$SCRIPT_DIR/vm-configs"

echo "════════════════════════════════════════════════════════════════"
echo "  DEPLOYING USD1 HFT CONFIG TO VMs"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Function to deploy to a VM
deploy_to_vm() {
    local vm_ip=$1
    local worker_num=$2
    local config_file="$CONFIG_DIR/worker${worker_num}-run-hft.sh"

    echo "[Worker $worker_num] Deploying to $vm_ip..."

    # Upload new run-hft.sh
    scp -o ConnectTimeout=10 "$config_file" root@$vm_ip:/opt/aptos-hft/run-hft.sh

    # Make executable
    ssh root@$vm_ip "chmod +x /opt/aptos-hft/run-hft.sh"

    # Verify
    echo "[Worker $worker_num] Verifying config..."
    ssh root@$vm_ip "grep -q 'USE_USD1' /opt/aptos-hft/run-hft.sh && echo '  ✓ USD1 config deployed' || echo '  ✗ Config missing USD1'"
    ssh root@$vm_ip "grep -q 'MULTI_MARKETS' /opt/aptos-hft/run-hft.sh && echo '  ✓ 12 markets configured' || echo '  ✗ Missing markets'"
    echo ""
}

# Deploy to each VM
deploy_to_vm "$VM1" 1
deploy_to_vm "$VM2" 2
deploy_to_vm "$VM3" 3

echo "════════════════════════════════════════════════════════════════"
echo "  USD1 CONFIG DEPLOYED TO ALL VMs"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "Configuration summary:"
echo "  - Contract: 0xbdea15f5b0f5449ae8f3a6ae95a5e090bdeeec91be1fcac8375b2f5f37f1c134"
echo "  - USD1 Metadata: 0x4e977d5ee91d77d680972a44b38b9c7a2c5694439169eeae060a48324e5c4597"
echo "  - Markets: 12 USD1-backed markets"
echo "  - Accounts: 20 total (7+7+6 across workers)"
echo ""
echo "To run the HFT test:"
echo "  ./scripts/run-3-workers.sh quantum 60"
