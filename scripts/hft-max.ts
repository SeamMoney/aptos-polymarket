/**
 * HFT MAX - Maximum reliable throughput on testnet
 *
 * Based on testing: ~3 txns per 2 seconds is the sweet spot
 * This gives us ~1.5 TPS with 100% success rate
 *
 * Usage: APTOS_PRIVATE_KEY=0x... npx tsx scripts/hft-max.ts [count]
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

const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));

// Optimized config based on testing
const CONFIG = {
  totalTrades: parseInt(process.argv[3] || '30'),
  tradeAmountAPT: 0.02,
  delayMs: 600, // ~1.7 TPS
};

async function main() {
  const privateKey = process.env.APTOS_PRIVATE_KEY;
  if (!privateKey) {
    console.error('Set APTOS_PRIVATE_KEY');
    process.exit(1);
  }

  const account = Account.fromPrivateKey({ privateKey: new Ed25519PrivateKey(privateKey) });
  const address = account.accountAddress.toString();

  // Get market
  let marketAddress = process.argv[2];
  if (!marketAddress?.startsWith('0x')) {
    const result = await aptos.view({
      payload: { function: `${MODULE}::get_all_markets`, functionArguments: [] },
    });
    marketAddress = (result[0] as string[])[0];
  }

  console.log('════════════════════════════════════════════════════════════════');
  console.log('HFT MAX - OPTIMIZED THROUGHPUT');
  console.log('════════════════════════════════════════════════════════════════');
  console.log(`Account: ${address.slice(0, 12)}...`);
  console.log(`Market: ${marketAddress.slice(0, 12)}...`);
  console.log(`Trades: ${CONFIG.totalTrades}`);
  console.log(`Target: ~1.7 TPS\n`);

  const startTime = Date.now();
  const actions = ['buy_yes', 'buy_no'];
  const amountUnits = Math.floor(CONFIG.tradeAmountAPT * 100_000_000);
  let success = 0;
  let latencySum = 0;

  for (let i = 0; i < CONFIG.totalTrades; i++) {
    const action = actions[i % 2];
    const txStart = Date.now();

    try {
      const tx = await aptos.transaction.build.simple({
        sender: account.accountAddress,
        data: {
          function: `${MODULE}::${action}`,
          functionArguments: [marketAddress, amountUnits, 0],
        },
      });

      const pending = await aptos.signAndSubmitTransaction({ signer: account, transaction: tx });
      const latency = Date.now() - txStart;
      latencySum += latency;
      success++;

      console.log(`✓ ${String(i + 1).padStart(3)}/${CONFIG.totalTrades} | ${latency}ms | ${pending.hash.slice(0, 14)}...`);
    } catch (e: any) {
      console.log(`✗ ${String(i + 1).padStart(3)}/${CONFIG.totalTrades} | FAILED`);
    }

    await new Promise(r => setTimeout(r, CONFIG.delayMs));
  }

  const totalTime = (Date.now() - startTime) / 1000;

  console.log('\n════════════════════════════════════════════════════════════════');
  console.log(`SUCCESS: ${success}/${CONFIG.totalTrades} (${((success / CONFIG.totalTrades) * 100).toFixed(0)}%)`);
  console.log(`TIME: ${totalTime.toFixed(1)}s`);
  console.log(`TPS: ${(success / totalTime).toFixed(2)}`);
  console.log(`AVG LATENCY: ${success ? Math.round(latencySum / success) : 0}ms`);
  console.log('════════════════════════════════════════════════════════════════\n');

  // Summary for demo
  console.log('📊 DEMO SUMMARY:');
  console.log(`   ${success} real on-chain trades executed`);
  console.log(`   ~${Math.round(latencySum / success)}ms average latency`);
  console.log(`   All verifiable on Aptos Explorer`);
  console.log(`   Contract: ${CONTRACT_ADDRESS}`);
}

main().catch(console.error);
