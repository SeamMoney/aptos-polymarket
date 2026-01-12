/**
 * Deploy 10 Demo Markets for TPS Demo
 *
 * Markets selected for: World Liberty Financial, Trump Team, Polymarket, Aptos
 * All based on real Polymarket markets with significant volume
 *
 * Usage:
 *   APTOS_PRIVATE_KEY=0x... npx tsx scripts/deploy-demo-markets.ts
 */

import {
  Aptos,
  AptosConfig,
  Network,
  Account,
  Ed25519PrivateKey,
} from '@aptos-labs/ts-sdk';

// Use the V3 contract with full Aggregator support
const DEFAULT_CONTRACT = '0xa2e5e47aab07fed78a3bcf95135ee2dad20c547499c94cb16a3e047859ffa7e1';
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS ?? DEFAULT_CONTRACT;
const MODULE = `${DEFAULT_CONTRACT}::multi_outcome_market` as const;

// Market definitions - 10 serious real-world markets
const DEMO_MARKETS = [
  // === Trump / WLFI (3 markets) ===
  {
    question: 'Will WLFI receive OCC banking charter in 2026?',
    description: 'World Liberty Financial has applied for a national trust bank charter from the Office of the Comptroller of the Currency. Will it be approved in 2026?',
    category: 'Business',
    outcomes: ['Yes', 'No', 'Withdrawn', 'Delayed to 2027'],
    daysUntilEnd: 365,
    initialLiquidity: 50_000_000, // 0.5 APT
  },
  {
    question: 'Will Trump acquire Greenland before 2027?',
    description: 'Will the United States successfully acquire or establish significant territorial control over Greenland by the end of 2026?',
    category: 'Politics',
    outcomes: ['Yes', 'No', 'Partial Agreement', 'Negotiations Fail'],
    daysUntilEnd: 365,
    initialLiquidity: 50_000_000,
  },
  {
    question: 'Who will Trump nominate as Fed Chair?',
    description: 'Who will President Trump nominate to replace Jerome Powell as Federal Reserve Chair?',
    category: 'Politics',
    outcomes: ['Kevin Warsh', 'Kevin Hassett', 'Powell Stays', 'Other'],
    daysUntilEnd: 365,
    initialLiquidity: 50_000_000,
  },

  // === Geopolitics (4 markets) ===
  {
    question: 'Khamenei out as Iran Supreme Leader by June 2026?',
    description: 'Will Ayatollah Ali Khamenei no longer be Supreme Leader of Iran by June 30, 2026?',
    category: 'World',
    outcomes: ['Yes', 'No'],
    daysUntilEnd: 180,
    initialLiquidity: 50_000_000,
  },
  {
    question: 'Will China invade Taiwan in 2026?',
    description: 'Will China launch a military invasion or armed attack on Taiwan during 2026?',
    category: 'World',
    outcomes: ['Yes', 'No'],
    daysUntilEnd: 365,
    initialLiquidity: 50_000_000,
  },
  {
    question: 'Russia-Ukraine ceasefire by Q2 2026?',
    description: 'Will Russia and Ukraine agree to a formal ceasefire by June 30, 2026?',
    category: 'World',
    outcomes: ['Yes', 'No', 'Partial Ceasefire', 'Escalation'],
    daysUntilEnd: 180,
    initialLiquidity: 50_000_000,
  },
  {
    question: 'Venezuela leadership end of 2026?',
    description: 'Who will be the leader of Venezuela at the end of 2026?',
    category: 'World',
    outcomes: ['Delcy Rodriguez', 'Maria Corina Machado', 'Military Junta', 'Other'],
    daysUntilEnd: 365,
    initialLiquidity: 50_000_000,
  },

  // === Crypto / Economic (3 markets) ===
  {
    question: 'Fed rate decision January 2026?',
    description: 'What will the Federal Reserve decide at the January 27-28, 2026 FOMC meeting?',
    category: 'Business',
    outcomes: ['Cut 25bps', 'Cut 50bps', 'No Change', 'Hike'],
    daysUntilEnd: 30,
    initialLiquidity: 50_000_000,
  },
  {
    question: 'Bitcoin price end of Q1 2026?',
    description: 'What will be the price of Bitcoin at the end of Q1 2026 (March 31)?',
    category: 'Crypto',
    outcomes: ['<$90K', '$90K-$100K', '$100K-$120K', '>$120K'],
    daysUntilEnd: 90,
    initialLiquidity: 50_000_000,
  },
  {
    question: 'Will Bitcoin hit $150K before 2027?',
    description: 'Will Bitcoin reach $150,000 USD at any point before January 1, 2027?',
    category: 'Crypto',
    outcomes: ['Yes', 'No'],
    daysUntilEnd: 365,
    initialLiquidity: 50_000_000,
  },
];

// Deployer key (same as consolidate-funds.ts, emergency-withdraw.ts, etc.)
const DEPLOYER_KEY = '0x48ee96658dd826f6541f5ee501c5784e6b341f04c52c641823f4b097b61eb79b';

async function main() {
  const privateKey = process.env.APTOS_PRIVATE_KEY || DEPLOYER_KEY;

  const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));
  const account = Account.fromPrivateKey({
    privateKey: new Ed25519PrivateKey(privateKey.replace('ed25519-priv-', '')),
  });

  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║        DEMO MARKETS DEPLOYMENT - 10 SERIOUS MARKETS          ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  Account: ${account.accountAddress.toString().slice(0, 20)}...`.padEnd(65) + '║');
  console.log(`║  Contract: ${CONTRACT_ADDRESS.slice(0, 20)}...`.padEnd(65) + '║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  // Check balance
  const balance = await aptos.getAccountAPTAmount({
    accountAddress: account.accountAddress,
  });
  const requiredApt = DEMO_MARKETS.reduce((sum, m) => sum + m.initialLiquidity, 0) / 100_000_000;
  console.log(`Balance: ${(balance / 100_000_000).toFixed(2)} APT`);
  console.log(`Required: ~${requiredApt.toFixed(2)} APT (${DEMO_MARKETS.length} markets x 0.5 APT)`);

  if (balance < requiredApt * 100_000_000) {
    console.error(`\nInsufficient balance! Need at least ${requiredApt} APT`);
    process.exit(1);
  }
  console.log('');

  const deployedMarkets: { question: string; address: string; txHash: string }[] = [];
  const failedMarkets: { question: string; error: string }[] = [];

  for (let i = 0; i < DEMO_MARKETS.length; i++) {
    const market = DEMO_MARKETS[i];
    const endTime = Math.floor(Date.now() / 1000) + (86400 * market.daysUntilEnd);

    console.log(`[${i + 1}/${DEMO_MARKETS.length}] Creating: ${market.question.slice(0, 50)}...`);

    try {
      const transaction = await aptos.transaction.build.simple({
        sender: account.accountAddress,
        data: {
          function: `${MODULE}::create_multi_market`,
          functionArguments: [
            market.question,
            market.description,
            market.category,
            market.outcomes,
            endTime,
            market.initialLiquidity,
          ],
        },
      });

      const pendingTx = await aptos.signAndSubmitTransaction({
        signer: account,
        transaction,
      });

      // Wait for confirmation
      const result = await aptos.waitForTransaction({
        transactionHash: pendingTx.hash,
      });

      if (result.success) {
        // Get the latest market address
        const markets = await aptos.view({
          payload: {
            function: `${MODULE}::get_all_multi_markets`,
            functionArguments: [],
          },
        });
        const allMarkets = markets[0] as string[];
        const newMarketAddress = allMarkets[allMarkets.length - 1];

        deployedMarkets.push({
          question: market.question,
          address: newMarketAddress,
          txHash: pendingTx.hash,
        });

        console.log(`   ✓ SUCCESS - ${newMarketAddress.slice(0, 20)}...`);
      } else {
        failedMarkets.push({ question: market.question, error: 'Transaction failed' });
        console.log(`   ✗ FAILED`);
      }

      // Small delay between deployments to avoid sequence number issues
      await new Promise(r => setTimeout(r, 1000));

    } catch (error: any) {
      failedMarkets.push({ question: market.question, error: error.message });
      console.log(`   ✗ ERROR: ${error.message.slice(0, 50)}...`);
    }
  }

  // Summary
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║                    DEPLOYMENT SUMMARY                        ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  Deployed: ${deployedMarkets.length}/${DEMO_MARKETS.length} markets`.padEnd(65) + '║');
  console.log(`║  Failed: ${failedMarkets.length} markets`.padEnd(65) + '║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  if (deployedMarkets.length > 0) {
    console.log('Deployed Market Addresses (for MULTI_MARKETS env):');
    console.log('─'.repeat(66));
    const addresses = deployedMarkets.map(m => m.address).join(',');
    console.log(addresses);
    console.log('');
    console.log('Individual Markets:');
    deployedMarkets.forEach((m, i) => {
      console.log(`  ${i + 1}. ${m.question.slice(0, 45)}...`);
      console.log(`     Address: ${m.address}`);
      console.log(`     Explorer: https://explorer.aptoslabs.com/txn/${m.txHash}?network=testnet`);
    });
  }

  if (failedMarkets.length > 0) {
    console.log('');
    console.log('Failed Markets:');
    failedMarkets.forEach((m, i) => {
      console.log(`  ${i + 1}. ${m.question}`);
      console.log(`     Error: ${m.error}`);
    });
  }

  // Output env var for easy copy-paste
  if (deployedMarkets.length > 0) {
    console.log('');
    console.log('═'.repeat(66));
    console.log('Copy this to your .env or worker config:');
    console.log('═'.repeat(66));
    console.log(`MULTI_MARKETS="${deployedMarkets.map(m => m.address).join(',')}"`);
  }
}

main().catch(console.error);
