#!/bin/bash
# =============================================================================
# DUAL CONTRACT SETUP FOR 2X TPS
# =============================================================================
#
# This script sets up two independent contract deployments for parallel trading:
# - Contract A: 0xca4d40eae9f07fb28a121862d649203fb4335ece9536ee51790e19f812ff7aea (existing)
# - Contract B: 0x3f13249e31a1fbdb886741f7945cccc40307311abc08ba188894bd1a050e19b4 (new)
#
# Workers 1-7 will trade on Contract A markets
# Workers 8-14 will trade on Contract B markets
#
# Usage: ./scripts/setup-dual-contracts.sh
#

set -e

cd "$(dirname "$0")/.."

CONTRACT_A="0xca4d40eae9f07fb28a121862d649203fb4335ece9536ee51790e19f812ff7aea"
CONTRACT_B="0x3f13249e31a1fbdb886741f7945cccc40307311abc08ba188894bd1a050e19b4"
CONTRACT_B_KEY="0xD7CB72EDEF8545C818EF9C7BECC72EE0332BAD7E0B2A0A12731D810D2765D611"

echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║           DUAL CONTRACT SETUP FOR 2X TPS                            ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""

# Step 1: Check Contract B deployer balance
echo "[1/5] Checking Contract B deployer balance..."
APT_BALANCE=$(npx tsx -e "
const { Aptos, AptosConfig, Network } = require('@aptos-labs/ts-sdk');
const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));
aptos.getAccountAPTAmount({ accountAddress: '$CONTRACT_B' })
  .then(b => console.log(b / 1e8))
  .catch(() => console.log('0'));
" 2>/dev/null)
echo "   Contract B deployer APT: $APT_BALANCE"

if (( $(echo "$APT_BALANCE < 1" | bc -l) )); then
  echo "   ⚠️  Need to fund Contract B deployer with APT first"
  echo "   Run: aptos account transfer --account $CONTRACT_B --amount 500000000"
  exit 1
fi
echo "   ✓ Has enough APT for deployment"

# Step 2: Deploy Contract B (if not already deployed)
echo ""
echo "[2/5] Checking if Contract B is deployed..."
DEPLOYED=$(curl -s "https://fullnode.testnet.aptoslabs.com/v1/accounts/$CONTRACT_B/modules" 2>/dev/null | grep -c "multi_outcome_market" || echo "0")

if [ "$DEPLOYED" == "0" ]; then
  echo "   Contract B not deployed. Deploying..."
  cd contracts

  # Backup and update Move.toml
  cp Move.toml Move.toml.backup
  sed -i.bak "s|prediction_market = \"$CONTRACT_A\"|prediction_market = \"$CONTRACT_B\"|" Move.toml

  # Compile
  aptos move compile --named-addresses prediction_market=$CONTRACT_B 2>&1 | tail -3

  # Publish
  echo "   Publishing contract..."
  aptos move publish \
    --named-addresses prediction_market=$CONTRACT_B \
    --private-key "$CONTRACT_B_KEY" \
    --assume-yes \
    --max-gas 200000 2>&1 | tail -5

  # Restore Move.toml
  mv Move.toml.backup Move.toml
  rm -f Move.toml.bak

  cd ..
  echo "   ✓ Contract B deployed"
else
  echo "   ✓ Contract B already deployed"
fi

# Step 3: Mint USD1 to Contract B deployer
echo ""
echo "[3/5] Checking Contract B deployer USD1 balance..."
USD1_BALANCE=$(npx tsx -e "
const { Aptos, AptosConfig, Network } = require('@aptos-labs/ts-sdk');
const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));
aptos.view({
  payload: { function: '$CONTRACT_A::usd1::balance', functionArguments: ['$CONTRACT_B'] }
}).then(b => console.log(Number(b[0]) / 1e8)).catch(() => console.log('0'));
" 2>/dev/null)
echo "   Contract B deployer USD1: $USD1_BALANCE"

if (( $(echo "$USD1_BALANCE < 15000" | bc -l) )); then
  echo "   Need to mint USD1 to Contract B deployer..."
  npx tsx -e "
const { Aptos, AptosConfig, Network, Account, Ed25519PrivateKey } = require('@aptos-labs/ts-sdk');

async function main() {
  const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));

  // Use Contract A deployer to mint (has minting rights)
  const minter = Account.fromPrivateKey({
    privateKey: new Ed25519PrivateKey('0xba4df2d482e616c52fae0bfb177fdfd9099e80d827ffa36933955480cc79b461')
  });

  const amount = 20000 * 1e8; // 20,000 USD1

  const txn = await aptos.transaction.build.simple({
    sender: minter.accountAddress,
    data: {
      function: '$CONTRACT_A::usd1::mint',
      functionArguments: ['$CONTRACT_B', amount.toString()],
    },
  });

  const pending = await aptos.signAndSubmitTransaction({ signer: minter, transaction: txn });
  await aptos.waitForTransaction({ transactionHash: pending.hash });
  console.log('Minted 20,000 USD1 to Contract B deployer');
}
main().catch(console.error);
" 2>/dev/null
  echo "   ✓ USD1 minted"
else
  echo "   ✓ Has enough USD1"
fi

# Step 4: Create markets on Contract B
echo ""
echo "[4/5] Checking Contract B markets..."
echo "   Running create-markets-contract-b.ts..."
npx tsx scripts/create-markets-contract-b.ts 2>&1 | tail -20

# Step 5: Get market addresses and display config
echo ""
echo "[5/5] Setup complete!"
echo ""
echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║                      CONFIGURATION                                   ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""
echo "Contract A (existing): $CONTRACT_A"
echo "Contract B (new):      $CONTRACT_B"
echo ""
echo "Worker Distribution:"
echo "  Workers 1-7:  → Contract A (accounts 0-2499)"
echo "  Workers 8-14: → Contract B (accounts 2500-4999)"
echo ""
echo "Next steps:"
echo "  1. Update workers 8-14 with Contract B address and markets"
echo "  2. Run: ./scripts/update-workers-dual-contract.sh"
echo "  3. Start test: ./scripts/start-all-workers.sh"
