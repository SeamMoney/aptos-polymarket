/**
 * HFT BURST MODE - Optimized for testnet rate limits
 *
 * Strategy: Submit bursts of transactions, then cooldown
 * - Fire-and-forget (don't wait for confirmation)
 * - Use sequence number management for parallel submission
 * - Cooldown between bursts to avoid 429
 *
 * Usage: APTOS_PRIVATE_KEY=0x... npx tsx scripts/hft-burst.ts
 */

import {
  Aptos,
  AptosConfig,
  Network,
  Account,
  Ed25519PrivateKey,
} from '@aptos-labs/ts-sdk';

const CONTRACT_ADDRESS = '0x64a81cb9cbd14d45b87bb32ef73107a44f00069b6a96e70d75369fb7e3da5e68';
const MODULE = `${CONTRACT_ADDRESS}::market`;

const aptosConfig = new AptosConfig({ network: Network.TESTNET });
const aptos = new Aptos(aptosConfig);

// Burst config - tuned for testnet rate limits
const CONFIG = {
  burstSize: 5,           // Transactions per burst
  burstCooldownMs: 3000,  // Wait between bursts
  totalBursts: 10,        // Number of bursts
  tradeAmountAPT: 0.02,
  inBurstDelayMs: 200,    // Delay within burst
};

interface TradeResult {
  action: string;
  latencyMs: number;
  success: boolean;
  txHash?: string;
  burst: number;
}

const results: TradeResult[] = [];

async function getAccount(): Promise<Account> {
  const privateKey = process.env.APTOS_PRIVATE_KEY;
  if (!privateKey) throw new Error('Set APTOS_PRIVATE_KEY');
  return Account.fromPrivateKey({ privateKey: new Ed25519PrivateKey(privateKey) });
}

async function getMarketAddress(): Promise<string> {
  if (process.argv[2]?.startsWith('0x')) return process.argv[2];
  const result = await aptos.view({
    payload: {
      function: `${MODULE}::get_all_markets`,
      functionArguments: [],
    },
  });
  const markets = result[0] as string[];
  if (!markets.length) throw new Error('No markets');
  return markets[0];
}

async function fireAndForgetTrade(
  account: Account,
  marketAddress: string,
  action: 'buy_yes' | 'buy_no',
  burst: number
): Promise<TradeResult> {
  const startTime = Date.now();
  const amountUnits = Math.floor(CONFIG.tradeAmountAPT * 100_000_000);

  try {
    const transaction = await aptos.transaction.build.simple({
      sender: account.accountAddress,
      data: {
        function: `${MODULE}::${action}`,
        functionArguments: [marketAddress, amountUnits, 0],
      },
    });

    const pendingTx = await aptos.signAndSubmitTransaction({
      signer: account,
      transaction,
    });

    // DON'T wait for confirmation - fire and forget for speed
    return {
      action,
      latencyMs: Date.now() - startTime,
      success: true,
      txHash: pendingTx.hash,
      burst,
    };
  } catch (error: any) {
    return {
      action,
      latencyMs: Date.now() - startTime,
      success: false,
      burst,
    };
  }
}

async function main() {
  const account = await getAccount();
  const marketAddress = await getMarketAddress();
  const address = account.accountAddress.toString();

  console.log('════════════════════════════════════════════════════════════════');
  console.log('HFT BURST MODE - OPTIMIZED FOR TESTNET');
  console.log('════════════════════════════════════════════════════════════════');
  console.log(`\nAccount: ${address.slice(0, 10)}...`);
  console.log(`Market: ${marketAddress.slice(0, 10)}...`);
  console.log(`\nConfig:`);
  console.log(`  Burst Size: ${CONFIG.burstSize} txns`);
  console.log(`  Bursts: ${CONFIG.totalBursts}`);
  console.log(`  Cooldown: ${CONFIG.burstCooldownMs}ms`);
  console.log(`  Total Expected: ${CONFIG.burstSize * CONFIG.totalBursts} txns\n`);

  const startTime = Date.now();
  const actions: Array<'buy_yes' | 'buy_no'> = ['buy_yes', 'buy_no'];
  let successCount = 0;
  let tradeNum = 0;

  for (let burst = 0; burst < CONFIG.totalBursts; burst++) {
    console.log(`\n⚡ BURST ${burst + 1}/${CONFIG.totalBursts}`);

    const burstStart = Date.now();
    const burstResults: TradeResult[] = [];

    for (let i = 0; i < CONFIG.burstSize; i++) {
      const action = actions[tradeNum % 2];
      const result = await fireAndForgetTrade(account, marketAddress, action, burst + 1);
      burstResults.push(result);
      results.push(result);
      tradeNum++;

      if (result.success) {
        successCount++;
        console.log(`  ✓ ${result.latencyMs}ms | ${result.txHash?.slice(0, 12)}...`);
      } else {
        console.log(`  ✗ FAILED`);
      }

      // Small delay within burst
      if (i < CONFIG.burstSize - 1) {
        await new Promise(r => setTimeout(r, CONFIG.inBurstDelayMs));
      }
    }

    const burstTime = Date.now() - burstStart;
    const burstSuccess = burstResults.filter(r => r.success).length;
    console.log(`  → ${burstSuccess}/${CONFIG.burstSize} in ${burstTime}ms`);

    // Cooldown between bursts (except last)
    if (burst < CONFIG.totalBursts - 1) {
      console.log(`  ⏳ Cooling down ${CONFIG.burstCooldownMs}ms...`);
      await new Promise(r => setTimeout(r, CONFIG.burstCooldownMs));
    }
  }

  const totalTime = Date.now() - startTime;
  const totalTrades = CONFIG.burstSize * CONFIG.totalBursts;

  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('FINAL RESULTS');
  console.log('════════════════════════════════════════════════════════════════');
  console.log(`Total Time: ${(totalTime / 1000).toFixed(2)}s`);
  console.log(`Successful: ${successCount}/${totalTrades} (${((successCount/totalTrades)*100).toFixed(0)}%)`);
  console.log(`Throughput: ${(successCount / (totalTime / 1000)).toFixed(2)} TPS`);
  console.log(`Effective TPS: ${(successCount / (totalTime / 1000)).toFixed(2)} (including cooldowns)`);

  const successful = results.filter(r => r.success);
  if (successful.length) {
    const avg = successful.reduce((a, b) => a + b.latencyMs, 0) / successful.length;
    const min = Math.min(...successful.map(r => r.latencyMs));
    const max = Math.max(...successful.map(r => r.latencyMs));
    console.log(`\nLatency:`);
    console.log(`  Avg: ${avg.toFixed(0)}ms`);
    console.log(`  Min: ${min}ms`);
    console.log(`  Max: ${max}ms`);
  }

  // Burst breakdown
  console.log(`\nBy Burst:`);
  for (let b = 1; b <= CONFIG.totalBursts; b++) {
    const burstResults = results.filter(r => r.burst === b);
    const success = burstResults.filter(r => r.success).length;
    console.log(`  Burst ${b}: ${success}/${burstResults.length}`);
  }

  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('Verify on explorer (first 5):');
  successful.slice(0, 5).forEach((r, i) => {
    console.log(`  ${i + 1}. https://explorer.aptoslabs.com/txn/${r.txHash}?network=testnet`);
  });
  console.log('════════════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
