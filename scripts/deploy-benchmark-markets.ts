/**
 * Deploy benchmark markets to all 3 contract variants
 *
 * Variants:
 * 1. multi_outcome_market (Table)
 * 2. smarttable_market (SmartTable)
 * 3. bigorderedmap_market (BigOrderedMap)
 *
 * Usage: npx tsx scripts/deploy-benchmark-markets.ts
 */

import {
  Aptos,
  AptosConfig,
  Network,
  Account,
  Ed25519PrivateKey,
} from '@aptos-labs/ts-sdk';
import { readFileSync } from 'fs';

// Benchmark contract address (all variants deployed here)
const BENCHMARK_CONTRACT = '0x07aa6210d6eb8befe55e0cb983964ad5f2e4edb4eb80be8ea6a2ec7860ff34f0';

// Modules for each variant
const VARIANTS = {
  table: `${BENCHMARK_CONTRACT}::multi_outcome_market`,
  smarttable: `${BENCHMARK_CONTRACT}::smarttable_market`,
  bigorderedmap: `${BENCHMARK_CONTRACT}::bigorderedmap_market`,
};

// APT metadata address
const APT_METADATA = '0xa';

// Market definitions for benchmarking
const MARKETS = [
  { question: 'BM1: Trump 2028', outcomes: ['Trump', 'DeSantis', 'Haley', 'Other'] },
  { question: 'BM2: Fed Rate Jan', outcomes: ['Cut 25bp', 'Hold', 'Hike 25bp', 'Other'] },
  { question: 'BM3: BTC Q1 2026', outcomes: ['Below 80K', '80K-100K', '100K-120K', 'Above 120K'] },
  { question: 'BM4: ETH/BTC Ratio', outcomes: ['Below 0.03', '0.03-0.04', '0.04-0.05', 'Above 0.05'] },
  { question: 'BM5: S&P 500 EOY', outcomes: ['Below 5000', '5000-5500', '5500-6000', 'Above 6000'] },
  { question: 'BM6: Oil Price', outcomes: ['Below 60', '60-80', '80-100', 'Above 100'] },
  { question: 'BM7: Gold Price', outcomes: ['Below 2000', '2000-2200', '2200-2400', 'Above 2400'] },
  { question: 'BM8: AAPL Stock', outcomes: ['Below 180', '180-200', '200-220', 'Above 220'] },
  { question: 'BM9: NVDA Stock', outcomes: ['Below 400', '400-500', '500-600', 'Above 600'] },
  { question: 'BM10: Interest Rates', outcomes: ['Below 4%', '4-4.5%', '4.5-5%', 'Above 5%'] },
];

const config = new AptosConfig({
  network: Network.TESTNET,
  fullnode: process.env.FULLNODE_URL || 'https://api.testnet.aptoslabs.com/v1',
});
const aptos = new Aptos(config);

// Use the benchmark account private key
const BENCHMARK_PRIVATE_KEY = process.env.BENCHMARK_PRIVATE_KEY ||
  '0x' + readFileSync('/tmp/benchmark_key', 'utf8').trim();

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║       DEPLOYING BENCHMARK MARKETS TO ALL VARIANTS            ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  // Load account
  let privateKey: Ed25519PrivateKey;
  try {
    const keyStr = BENCHMARK_PRIVATE_KEY.replace('ed25519-priv-', '').replace(/^0x/i, '');
    privateKey = new Ed25519PrivateKey('0x' + keyStr.toLowerCase());
  } catch (e) {
    console.error('Failed to load private key. Set BENCHMARK_PRIVATE_KEY or ensure /tmp/benchmark_key exists');
    process.exit(1);
  }

  const account = Account.fromPrivateKey({ privateKey });
  console.log(`Deployer: ${account.accountAddress.toString()}`);

  // Check balance
  const balance = await aptos.getAccountAPTAmount({ accountAddress: account.accountAddress });
  console.log(`Balance: ${(balance / 100_000_000).toFixed(2)} APT`);

  if (balance < 100_000_000) { // Need at least 1 APT
    console.log('\nInsufficient balance! Funding from faucet...');
    // Would need to fund here
  }

  const results: Record<string, string[]> = {
    table: [],
    smarttable: [],
    bigorderedmap: [],
  };

  // Initial liquidity: 1 APT per market (8 decimals)
  const INITIAL_LIQUIDITY = 100_000_000; // 1 APT
  const END_TIME = Math.floor(Date.now() / 1000) + 86400 * 365; // 1 year from now

  for (const [variantName, module] of Object.entries(VARIANTS)) {
    console.log(`\n=== Creating markets for ${variantName.toUpperCase()} variant ===`);

    for (let i = 0; i < MARKETS.length; i++) {
      const market = MARKETS[i];

      try {
        const txn = await aptos.transaction.build.simple({
          sender: account.accountAddress,
          data: {
            function: `${module}::create_multi_market_with_collateral`,
            functionArguments: [
              market.question,
              `Benchmark market ${i + 1} for ${variantName}`,
              'Benchmark',
              market.outcomes,
              END_TIME,
              INITIAL_LIQUIDITY,
              APT_METADATA,
            ],
          },
        });

        const signedTxn = await aptos.signAndSubmitTransaction({
          signer: account,
          transaction: txn,
        });

        const result = await aptos.waitForTransaction({ transactionHash: signedTxn.hash });

        if (result.success) {
          // Extract market address from events
          const createEvent = (result as any).events?.find((e: any) =>
            e.type.includes('MultiMarketCreated')
          );
          const marketAddr = createEvent?.data?.market_address || 'unknown';
          results[variantName].push(marketAddr);
          console.log(`  ✓ ${market.question}: ${marketAddr.slice(0, 10)}...`);
        } else {
          console.log(`  ✗ ${market.question}: Failed - ${result.vm_status}`);
        }

        // Small delay between transactions
        await new Promise(r => setTimeout(r, 200));

      } catch (e: any) {
        console.log(`  ✗ ${market.question}: Error - ${e.message?.slice(0, 50)}`);
      }
    }
  }

  // Output results
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║                   DEPLOYMENT RESULTS                          ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  for (const [variant, markets] of Object.entries(results)) {
    console.log(`\n${variant.toUpperCase()} (${markets.length} markets):`);
    console.log(markets.join(','));
  }

  // Output as env vars
  console.log('\n\n# Add to .env.benchmark:');
  console.log(`BENCHMARK_CONTRACT=${BENCHMARK_CONTRACT}`);
  console.log(`TABLE_MARKETS=${results.table.join(',')}`);
  console.log(`SMARTTABLE_MARKETS=${results.smarttable.join(',')}`);
  console.log(`BIGORDEREDMAP_MARKETS=${results.bigorderedmap.join(',')}`);
}

main().catch(console.error);
