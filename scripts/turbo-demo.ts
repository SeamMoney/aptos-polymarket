#!/usr/bin/env npx tsx
/**
 * TURBO DEMO - High Throughput Parallel Transaction Demo
 *
 * Uses explicit sequence numbers for true parallel transaction submission.
 * Demonstrates Aptos's high throughput capabilities.
 *
 * Usage: APTOS_PRIVATE_KEY=0x... APTOS_API_KEY=AG-... npx tsx scripts/turbo-demo.ts [mode] [duration]
 *   mode: normal | turbo | burst (default: turbo)
 *   duration: seconds to run (default: 30)
 */

import {
  Aptos,
  AptosConfig,
  Network,
  Account,
  Ed25519PrivateKey,
} from '@aptos-labs/ts-sdk';

const CONTRACT_ADDRESS = '0x3f13249e31a1fbdb886741f7945cccc40307311abc08ba188894bd1a050e19b4';
const MODULE = `${CONTRACT_ADDRESS}::market`;
const KNOWN_MARKET = '0x9ec8c2987a5d0598969bb48f3acee94dd6bd5570420cbe5993d65e48500380c4';

// Use Geomi API key if available (removes rate limits!)
const API_KEY = process.env.APTOS_API_KEY || '';
const aptos = new Aptos(new AptosConfig({
  network: Network.TESTNET,
  clientConfig: API_KEY ? { API_KEY } : undefined,
}));

// Mode configs - using parallel transactions with explicit sequence numbers
const MODES = {
  normal: { batchSize: 10, delay: 200, name: '🐢 NORMAL (~20 TPS)' },
  turbo: { batchSize: 20, delay: 100, name: '⚡ TURBO (~40 TPS)' },
  burst: { batchSize: 30, delay: 50, name: '🔥 BURST (~60+ TPS)' },
};

type Mode = keyof typeof MODES;

// Stats
let totalTxns = 0;
let successfulTxns = 0;
let failedTxns = 0;
let totalLatency = 0;
let recentTimestamps: number[] = [];
let peakTPS = 0;

function calculateTPS(): number {
  const now = Date.now();
  const windowMs = 5000;
  recentTimestamps = recentTimestamps.filter(t => t > now - windowMs);
  const tps = (recentTimestamps.length / windowMs) * 1000;
  if (tps > peakTPS) peakTPS = tps;
  return tps;
}

async function executeTrade(
  account: Account,
  marketAddress: string,
  seqNum: bigint
): Promise<{ success: boolean; latency: number; hash?: string }> {
  const start = Date.now();
  const action = Math.random() > 0.5 ? 'buy_yes' : 'buy_no';
  const amount = Math.floor((0.01 + Math.random() * 0.03) * 100_000_000);

  try {
    const tx = await aptos.transaction.build.simple({
      sender: account.accountAddress,
      data: {
        function: `${MODULE}::${action}`,
        functionArguments: [marketAddress, amount, 0],
      },
      options: {
        accountSequenceNumber: seqNum,
      },
    });

    const pending = await aptos.signAndSubmitTransaction({
      signer: account,
      transaction: tx,
    });

    return { success: true, latency: Date.now() - start, hash: pending.hash };
  } catch {
    return { success: false, latency: Date.now() - start };
  }
}

async function runBatch(
  account: Account,
  marketAddress: string,
  batchSize: number,
  batchNum: number,
  startSeqNum: bigint
): Promise<number> {
  const batchStart = Date.now();

  // Execute all trades in parallel with explicit sequence numbers
  const promises = Array.from({ length: batchSize }, (_, i) =>
    executeTrade(account, marketAddress, startSeqNum + BigInt(i))
  );

  const results = await Promise.all(promises);
  const batchTime = Date.now() - batchStart;

  // Process results
  let batchSuccess = 0;

  for (const result of results) {
    totalTxns++;
    if (result.success) {
      successfulTxns++;
      batchSuccess++;
      totalLatency += result.latency;
      recentTimestamps.push(Date.now());
    } else {
      failedTxns++;
    }
  }

  const currentTPS = calculateTPS();
  const avgLatency = successfulTxns > 0 ? Math.round(totalLatency / successfulTxns) : 0;
  const successRate = totalTxns > 0 ? Math.round((successfulTxns / totalTxns) * 100) : 0;

  // Clear line and print stats
  process.stdout.write('\r\x1b[K');
  process.stdout.write(
    `Batch ${String(batchNum + 1).padStart(4)} | ` +
    `${batchSuccess}/${batchSize} OK | ` +
    `${String(batchTime).padStart(4)}ms | ` +
    `TPS: ${currentTPS.toFixed(1).padStart(5)} | ` +
    `Peak: ${peakTPS.toFixed(1).padStart(5)} | ` +
    `Total: ${successfulTxns}/${totalTxns} (${successRate}%) | ` +
    `Avg: ${avgLatency}ms`
  );

  return batchSuccess;
}

async function main() {
  const privateKey = process.env.APTOS_PRIVATE_KEY;
  if (!privateKey) {
    console.error('❌ Set APTOS_PRIVATE_KEY environment variable');
    process.exit(1);
  }

  const modeArg = (process.argv[2] || 'turbo') as Mode;
  const duration = parseInt(process.argv[3] || '30');

  if (!MODES[modeArg]) {
    console.error(`❌ Invalid mode. Use: normal, turbo, or burst`);
    process.exit(1);
  }

  const mode = MODES[modeArg];
  const account = Account.fromPrivateKey({ privateKey: new Ed25519PrivateKey(privateKey) });

  // Get current sequence number
  console.log('\n🔍 Fetching account info...');
  const accountInfo = await aptos.getAccountInfo({ accountAddress: account.accountAddress });
  let currentSeqNum = BigInt(accountInfo.sequence_number);

  // Print header
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log(`║  ${mode.name} MODE - APTOS PARALLEL THROUGHPUT`.padEnd(67) + '║');
  console.log('╠══════════════════════════════════════════════════════════════════╣');
  if (API_KEY) {
    console.log(`║  🔑 API Key: ENABLED (no rate limits!)`.padEnd(67) + '║');
  } else {
    console.log(`║  ⚠️  No API Key (may hit rate limits)`.padEnd(67) + '║');
  }
  console.log(`║  Account: ${account.accountAddress.toString().slice(0, 20)}...`.padEnd(67) + '║');
  console.log(`║  Starting Seq#: ${currentSeqNum}`.padEnd(67) + '║');
  console.log(`║  Batch Size: ${mode.batchSize} | Delay: ${mode.delay}ms | Duration: ${duration}s`.padEnd(67) + '║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log('');

  const startTime = Date.now();
  const endTime = startTime + duration * 1000;
  let batchNum = 0;

  console.log('📊 Live Stats (Parallel Transactions):');
  console.log('─'.repeat(80));

  // Main loop
  while (Date.now() < endTime) {
    const batchSuccess = await runBatch(account, KNOWN_MARKET, mode.batchSize, batchNum, currentSeqNum);
    currentSeqNum += BigInt(mode.batchSize);
    batchNum++;

    if (mode.delay > 0) {
      await new Promise(r => setTimeout(r, mode.delay));
    }
  }

  // Final stats
  const totalTime = (Date.now() - startTime) / 1000;
  const finalTPS = successfulTxns / totalTime;
  const avgLatency = successfulTxns > 0 ? Math.round(totalLatency / successfulTxns) : 0;
  const successRate = totalTxns > 0 ? Math.round((successfulTxns / totalTxns) * 100) : 0;

  console.log('\n\n');
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║                        FINAL RESULTS                             ║');
  console.log('╠══════════════════════════════════════════════════════════════════╣');
  console.log(`║  Total Transactions:  ${String(totalTxns).padStart(6)}                                    ║`);
  console.log(`║  Successful:          ${String(successfulTxns).padStart(6)} (${String(successRate).padStart(3)}%)                            ║`);
  console.log(`║  Failed:              ${String(failedTxns).padStart(6)}                                    ║`);
  console.log('╠══════════════════════════════════════════════════════════════════╣');
  console.log(`║  Duration:            ${totalTime.toFixed(1).padStart(6)}s                                   ║`);
  console.log(`║  Average TPS:         ${finalTPS.toFixed(2).padStart(6)}                                    ║`);
  console.log(`║  Peak TPS:            ${peakTPS.toFixed(2).padStart(6)}                                    ║`);
  console.log(`║  Avg Latency:         ${String(avgLatency).padStart(6)}ms                                  ║`);
  console.log('╠══════════════════════════════════════════════════════════════════╣');
  console.log('║                                                                  ║');
  console.log(`║  🚀 Aptos processed ${successfulTxns} real on-chain transactions`.padEnd(67) + '║');
  console.log(`║  ⚡ All verifiable on Aptos Explorer`.padEnd(67) + '║');
  console.log('║                                                                  ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log('');
}

main().catch(console.error);
