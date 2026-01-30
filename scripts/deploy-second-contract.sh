#!/bin/bash
# Deploy second instance of multi_outcome_market contract
# This creates a completely separate state tree for parallel TPS

set -e

cd "$(dirname "$0")/../contracts"

# Second deployer key (from new-deployer.key)
DEPLOYER_KEY="0xD7CB72EDEF8545C818EF9C7BECC72EE0332BAD7E0B2A0A12731D810D2765D611"
DEPLOYER_ADDR="0x3f13249e31a1fbdb886741f7945cccc40307311abc08ba188894bd1a050e19b4"

echo "=== Deploying Second Contract Instance ==="
echo "Deployer: $DEPLOYER_ADDR"
echo ""

# Create a temporary Move.toml for second deployment
cp Move.toml Move.toml.backup

# Update Move.toml to use new deployer address
sed -i.bak "s/prediction_market = \"0xca4d40eae9f07fb28a121862d649203fb4335ece9536ee51790e19f812ff7aea\"/prediction_market = \"$DEPLOYER_ADDR\"/" Move.toml

echo "Updated Move.toml for second deployment"
cat Move.toml | grep -A2 "dev-addresses"

echo ""
echo "Compiling contract..."
aptos move compile --named-addresses prediction_market=$DEPLOYER_ADDR

echo ""
echo "Publishing contract to $DEPLOYER_ADDR..."
aptos move publish \
  --named-addresses prediction_market=$DEPLOYER_ADDR \
  --private-key "$DEPLOYER_KEY" \
  --assume-yes \
  --max-gas 200000

echo ""
echo "=== Deployment Complete ==="
echo "Contract B Address: $DEPLOYER_ADDR"
echo ""
echo "Next steps:"
echo "1. Run: npx tsx scripts/create-markets-contract-b.ts"
echo "2. Update workers 8-14 to use this contract"

# Restore original Move.toml
mv Move.toml.backup Move.toml
echo ""
echo "Restored original Move.toml"
