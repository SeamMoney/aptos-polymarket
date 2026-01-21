/**
 * Burst Trading Per Market
 *
 * Runs targeted burst trading on specific markets to stack TPS demos.
 * Use this to build up trade volume on each of the 10 demo markets.
 *
 * Usage:
 *   npx tsx scripts/burst-per-market.ts                    # All markets
 *   npx tsx scripts/burst-per-market.ts 0xc47af6ad...      # Specific market
 *   npx tsx scripts/burst-per-market.ts --count 100        # 100 trades per market
 */

import {
  Account,
  Aptos,
  AptosConfig,
  Network,
  Ed25519PrivateKey,
} from '@aptos-labs/ts-sdk';

const CONTRACT_ADDRESS = '0xa2e5e47aab07fed78a3bcf95135ee2dad20c547499c94cb16a3e047859ffa7e1';
const MODULE = `${CONTRACT_ADDRESS}::multi_outcome_market` as const;

// All 10 demo markets deployed
const DEMO_MARKETS = [
  { address: '0xc47af6adee557eb824c5a82f800d9ca15a6525417d273d9671451a45106870bb', name: 'WLFI Banking Charter' },
  { address: '0x3b365cbbc7ea0aa6e18b3dd7d4e2cae6c84fae90d9b5d0c3b1ef8a919ea5a72f', name: 'Trump Greenland' },
  { address: '0xa4cc4e98d5f9dd23809ad1cf9f3b44501be2ffae47c06f59fa81df0886f01fa0', name: 'Fed Chair Nominee' },
  { address: '0x74bbc4673ebe683d3d0013a1862c369938255071f0b32ac0fb638b476698213a', name: 'Iran Khamenei' },
  { address: '0x2163cf2a5e8a58b262111e06f6e97818ff0a11418eaedcb28ba3e10a0fdb2d12', name: 'China Taiwan' },
  { address: '0x9ead4f745267b70bf8f80858876552dff8b3752d67580deb0ef211a441230ebd', name: 'Russia-Ukraine' },
  { address: '0xc0c821e880662d8f4c35d6e88521f489aa61c97fe42662a348fdb4333922f3dc', name: 'Venezuela' },
  { address: '0x23c79ba59fdffe66abd5243ebf98d9dd13661d86a355cfcb1872eeb58e088278', name: 'Fed Rate Jan 2026' },
  { address: '0xb297b277d82a364b2f98d2e8fac549d921acd565dfb46c598c09eab2e93e776d', name: 'BTC Q1 2026' },
  { address: '0xaba7e1a1ca41899757215bac86bd71ca5d8db24d53acf18332421b0424dac8f3', name: 'BTC $150K' },
];

// Deployer key (has ~994 APT)
const DEPLOYER_KEY = '0x48ee96658dd826f6541f5ee501c5784e6b341f04c52c641823f4b097b61eb79b';

interface MarketStats {
  address: string;
  name: string;
  tradesExecuted: number;
  successRate: number;
  avgLatency: number;
}

async function getMarketInfo(aptos: Aptos, marketAddress: string): Promise<{ numOutcomes: number; prices: number[] }> {
  try {
    const result = await aptos.view({
      payload: {
        function: `${MODULE}::get_market_info`,
        functionArguments: [marketAddress],
      },
    });
    const numOutcomes = Number(result[0]);
    const prices = (result[1] as string[]).map((p) => Number(p));
    return { numOutcomes, prices };
  } catch {
    return { numOutcomes: 4, prices: [25, 25, 25, 25] };
  }
}

async function executeTrade(
  aptos: Aptos,
  account: Account,
  marketAddress: string,
  outcomeIndex: number,
  isBuy: boolean,
  amount: number
): Promise<{ success: boolean; latency: number }> {
  const start = Date.now();
  try {
    const functionName = isBuy ? 'buy_outcome' : 'sell_outcome';
    // buy_outcome(buyer, market_addr, outcome_index, collateral_in, min_tokens_out)
    // sell_outcome(seller, market_addr, outcome_index, tokens_in, min_collateral_out)
    const tx = await aptos.transaction.build.simple({
      sender: account.accountAddress,
      data: {
        function: `${MODULE}::${functionName}`,
        functionArguments: [marketAddress, outcomeIndex, amount, 0], // 0 = no slippage protection
      },
    });

    const pendingTx = await aptos.signAndSubmitTransaction({
      signer: account,
      transaction: tx,
    });

    await aptos.waitForTransaction({ transactionHash: pendingTx.hash });
    return { success: true, latency: Date.now() - start };
  } catch (error) {
    return { success: false, latency: Date.now() - start };
  }
}

async function burstOnMarket(
  aptos: Aptos,
  accounts: Account[],
  market: { address: string; name: string },
  tradesPerMarket: number
): Promise<MarketStats> {
  console.log(`\n📊 ${market.name}`);
  console.log(`   Address: ${market.address.slice(0, 20)}...`);

  const info = await getMarketInfo(aptos, market.address);
  console.log(`   Outcomes: ${info.numOutcomes}, Prices: ${info.prices.join(', ')}%`);

  let successes = 0;
  let totalLatency = 0;
  const amount = 1_000_000; // 0.01 APT per trade

  // Execute trades in parallel batches
  const batchSize = Math.min(accounts.length, 5);
  const batches = Math.ceil(tradesPerMarket / batchSize);

  for (let batch = 0; batch < batches; batch++) {
    const promises: Promise<{ success: boolean; latency: number }>[] = [];

    for (let i = 0; i < batchSize && batch * batchSize + i < tradesPerMarket; i++) {
      const account = accounts[i % accounts.length];
      const outcomeIndex = Math.floor(Math.random() * info.numOutcomes);
      const isBuy = Math.random() > 0.3; // 70% buys

      promises.push(executeTrade(aptos, account, market.address, outcomeIndex, isBuy, amount));
    }

    const results = await Promise.all(promises);
    for (const result of results) {
      if (result.success) successes++;
      totalLatency += result.latency;
    }

    process.stdout.write(`   Progress: ${Math.min((batch + 1) * batchSize, tradesPerMarket)}/${tradesPerMarket} trades\r`);
  }

  const stats: MarketStats = {
    address: market.address,
    name: market.name,
    tradesExecuted: successes,
    successRate: (successes / tradesPerMarket) * 100,
    avgLatency: totalLatency / tradesPerMarket,
  };

  console.log(`   ✓ ${successes}/${tradesPerMarket} trades (${stats.successRate.toFixed(1)}% success, ${stats.avgLatency.toFixed(0)}ms avg)`);

  return stats;
}

async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  let tradesPerMarket = 20;
  let targetMarket: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--count' && args[i + 1]) {
      tradesPerMarket = parseInt(args[i + 1]);
      i++;
    } else if (args[i].startsWith('0x')) {
      targetMarket = args[i];
    }
  }

  console.log('='.repeat(60));
  console.log('  Per-Market Burst Trading');
  console.log('='.repeat(60));

  const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));

  // Load deployer account
  const accounts: Account[] = [];
  const deployer = Account.fromPrivateKey({
    privateKey: new Ed25519PrivateKey(DEPLOYER_KEY),
  });
  accounts.push(deployer);

  if (accounts.length === 0) {
    console.error('No valid accounts found!');
    process.exit(1);
  }

  console.log(`\nAccounts loaded: ${accounts.length}`);
  console.log(`Trades per market: ${tradesPerMarket}`);

  // Determine which markets to trade
  const marketsToTrade = targetMarket
    ? DEMO_MARKETS.filter((m) => m.address.toLowerCase() === targetMarket.toLowerCase())
    : DEMO_MARKETS;

  if (marketsToTrade.length === 0) {
    console.error(`Market not found: ${targetMarket}`);
    process.exit(1);
  }

  console.log(`Markets to trade: ${marketsToTrade.length}`);

  // Execute bursts
  const allStats: MarketStats[] = [];

  for (const market of marketsToTrade) {
    const stats = await burstOnMarket(aptos, accounts, market, tradesPerMarket);
    allStats.push(stats);

    // Small delay between markets to avoid rate limiting
    await new Promise((r) => setTimeout(r, 1000));
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('  Summary');
  console.log('='.repeat(60));

  const totalTrades = allStats.reduce((sum, s) => sum + s.tradesExecuted, 0);
  const avgSuccess = allStats.reduce((sum, s) => sum + s.successRate, 0) / allStats.length;

  console.log(`\nTotal trades executed: ${totalTrades}`);
  console.log(`Average success rate: ${avgSuccess.toFixed(1)}%`);

  console.log('\nPer-market breakdown:');
  for (const stat of allStats) {
    console.log(`  ${stat.name}: ${stat.tradesExecuted} trades`);
  }

  console.log('\n✓ Burst complete! Check Geomi in ~10 seconds to see indexed trades.');
}

main().catch(console.error);
