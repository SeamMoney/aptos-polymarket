#!/usr/bin/env npx tsx
/**
 * PARALLEL DEMO - High Throughput with Explicit Sequence Numbers
 *
 * Sends transactions in parallel by managing sequence numbers explicitly.
 * This enables true parallel submission from a single account.
 *
 * Usage: APTOS_PRIVATE_KEY=0x... APTOS_API_KEY=AG-... npx tsx scripts/parallel-demo.ts [count] [batch_size]
 */

import {
  Aptos,
  AptosConfig,
  Network,
  Account,
  Ed25519PrivateKey,
  AccountSequenceNumber,
} from '@aptos-labs/ts-sdk';

const CONTRACT_ADDRESS = '0x64a81cb9cbd14d45b87bb32ef73107a44f00069b6a96e70d75369fb7e3da5e68';
const MODULE = `${CONTRACT_ADDRESS}::market`;
const KNOWN_MARKET = '0x9ec8c2987a5d0598969bb48f3acee94dd6bd5570420cbe5993d65e48500380c4';

// Setup with API key
const API_KEY = process.env.APTOS_API_KEY || '';
const aptos = new Aptos(new AptosConfig({
  network: Network.TESTNET,
  clientConfig: API_KEY ? { API_KEY } : undefined,
}));

interface TxResult {
  success: boolean;
  hash?: string;
  latency: number;
  seqNum: number;
  error?: string;
}

async function main() {
  const privateKey = process.env.APTOS_PRIVATE_KEY;
  if (!privateKey) {
    console.error('❌ Set APTOS_PRIVATE_KEY');
    process.exit(1);
  }

  const totalCount = parseInt(process.argv[2] || '50');
  const batchSize = parseInt(process.argv[3] || '10');
  const account = Account.fromPrivateKey({ privateKey: new Ed25519PrivateKey(privateKey) });

  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║        ⚡ APTOS PARALLEL DEMO - EXPLICIT SEQ NUMBERS           ║');
  console.log('╠════════════════════════════════════════════════════════════════╣');
  if (API_KEY) {
    console.log('║  🔑 API Key: ENABLED                                           ║');
  } else {
    console.log('║  ⚠️  No API Key (may be rate limited)                           ║');
  }
  console.log(`║  Total Txns: ${totalCount} | Batch Size: ${batchSize}                             ║`);
  console.log(`║  Account: ${account.accountAddress.toString().slice(0, 20)}...              ║`);
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');

  // Get current sequence number
  const accountInfo = await aptos.getAccountInfo({ accountAddress: account.accountAddress });
  let currentSeqNum = BigInt(accountInfo.sequence_number);
  console.log(`📊 Starting sequence number: ${currentSeqNum}`);
  console.log('');

  const startTime = Date.now();
  const allResults: TxResult[] = [];
  let batchNum = 0;

  console.log('📊 Parallel Batches:');
  console.log('────────────────────────────────────────────────────────────────');

  // Process in batches
  for (let i = 0; i < totalCount; i += batchSize) {
    const batchStart = Date.now();
    const thisBatchSize = Math.min(batchSize, totalCount - i);

    // Build all transactions in this batch with explicit sequence numbers
    const txPromises: Promise<TxResult>[] = [];

    for (let j = 0; j < thisBatchSize; j++) {
      const seqNum = currentSeqNum + BigInt(j);
      const action = (i + j) % 2 === 0 ? 'buy_yes' : 'buy_no';
      const amount = Math.floor((0.01 + Math.random() * 0.02) * 100_000_000);

      txPromises.push(
        (async (): Promise<TxResult> => {
          const txStart = Date.now();
          try {
            // Build with explicit sequence number
            const tx = await aptos.transaction.build.simple({
              sender: account.accountAddress,
              data: {
                function: `${MODULE}::${action}`,
                functionArguments: [KNOWN_MARKET, amount, 0],
              },
              options: {
                accountSequenceNumber: seqNum,
              },
            });

            const pending = await aptos.signAndSubmitTransaction({
              signer: account,
              transaction: tx,
            });

            return {
              success: true,
              hash: pending.hash,
              latency: Date.now() - txStart,
              seqNum: Number(seqNum),
            };
          } catch (e: any) {
            return {
              success: false,
              latency: Date.now() - txStart,
              seqNum: Number(seqNum),
              error: e.message?.slice(0, 50) || 'Unknown',
            };
          }
        })()
      );
    }

    // Wait for all in batch to complete
    const batchResults = await Promise.all(txPromises);
    allResults.push(...batchResults);

    const batchTime = Date.now() - batchStart;
    const successCount = batchResults.filter(r => r.success).length;
    const elapsed = (Date.now() - startTime) / 1000;
    const totalSuccess = allResults.filter(r => r.success).length;
    const tps = totalSuccess / elapsed;

    console.log(
      `Batch ${String(++batchNum).padStart(3)} | ` +
      `${successCount}/${thisBatchSize} OK | ` +
      `${batchTime}ms | ` +
      `TPS: ${tps.toFixed(2)} | ` +
      `Total: ${totalSuccess}/${allResults.length}`
    );

    // Update sequence number for next batch
    currentSeqNum += BigInt(thisBatchSize);

    // Small delay between batches to avoid overwhelming
    if (i + batchSize < totalCount) {
      await new Promise(r => setTimeout(r, 100));
    }
  }

  // Wait for confirmations (optional but good practice)
  console.log('\n⏳ Waiting for confirmations...');
  const successfulHashes = allResults.filter(r => r.success && r.hash).map(r => r.hash!);

  let confirmed = 0;
  let confirmFailed = 0;

  for (const hash of successfulHashes.slice(0, 20)) { // Check first 20
    try {
      await aptos.waitForTransaction({ transactionHash: hash, options: { checkSuccess: true } });
      confirmed++;
    } catch {
      confirmFailed++;
    }
  }

  // Calculate stats
  const totalTime = (Date.now() - startTime) / 1000;
  const successCount = allResults.filter(r => r.success).length;
  const failedCount = allResults.filter(r => !r.success).length;
  const latencies = allResults.filter(r => r.success).map(r => r.latency);
  const avgLatency = latencies.length > 0
    ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
    : 0;
  const minLatency = latencies.length > 0 ? Math.min(...latencies) : 0;
  const maxLatency = latencies.length > 0 ? Math.max(...latencies) : 0;
  const finalTPS = successCount / totalTime;

  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                      FINAL RESULTS                             ║');
  console.log('╠════════════════════════════════════════════════════════════════╣');
  console.log(`║  Submitted:      ${String(successCount).padStart(4)} / ${totalCount}                                  ║`);
  console.log(`║  Failed Submit:  ${String(failedCount).padStart(4)}                                        ║`);
  console.log(`║  Confirmed:      ${String(confirmed).padStart(4)} / ${Math.min(20, successfulHashes.length)} (sampled)                          ║`);
  console.log('╠════════════════════════════════════════════════════════════════╣');
  console.log(`║  Total Time:     ${totalTime.toFixed(1).padStart(6)}s                                    ║`);
  console.log(`║  Submit TPS:     ${finalTPS.toFixed(2).padStart(6)}                                      ║`);
  console.log('╠════════════════════════════════════════════════════════════════╣');
  console.log(`║  Avg Latency:    ${String(avgLatency).padStart(6)}ms (submit only)                      ║`);
  console.log(`║  Min Latency:    ${String(minLatency).padStart(6)}ms                                    ║`);
  console.log(`║  Max Latency:    ${String(maxLatency).padStart(6)}ms                                    ║`);
  console.log('╠════════════════════════════════════════════════════════════════╣');
  console.log('║                                                                ║');
  console.log(`║  ⚡ ${successCount} transactions submitted in parallel!            ║`);
  console.log('║  🔗 All verifiable on Aptos Explorer                           ║');
  console.log('║                                                                ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');

  // Show any errors
  const errors = allResults.filter(r => !r.success);
  if (errors.length > 0) {
    console.log('⚠️  Failed transactions:');
    errors.slice(0, 5).forEach(e => {
      console.log(`   SeqNum ${e.seqNum}: ${e.error}`);
    });
    if (errors.length > 5) {
      console.log(`   ... and ${errors.length - 5} more`);
    }
  }
}

main().catch(console.error);
