/**
 * HFT TURBO - Maximum throughput trading on Aptos
 *
 * Strategies for max speed:
 * 1. No unnecessary API calls (no balance/price checks during trading)
 * 2. Pre-build transactions while waiting for previous
 * 3. Multiple concurrent transactions with sequence number management
 * 4. Direct submission without simulation
 *
 * Usage: APTOS_PRIVATE_KEY=0x... npx tsx scripts/hft-turbo.ts [market_address]
 */

import {
  Aptos,
  AptosConfig,
  Network,
  Account,
  Ed25519PrivateKey,
  AccountSequenceNumber,
  TransactionWorkerEventsEnum,
  InputGenerateTransactionPayloadData,
} from '@aptos-labs/ts-sdk';

const CONTRACT_ADDRESS = '0x3f13249e31a1fbdb886741f7945cccc40307311abc08ba188894bd1a050e19b4';
const MODULE = `${CONTRACT_ADDRESS}::market`;

// Config
const CONFIG = {
  totalTrades: 100,           // Total number of trades
  concurrentBatches: 5,       // Number of concurrent transaction batches
  tradeAmountAPT: 0.02,       // Small amount per trade
  delayBetweenBatches: 200,   // ms between batch submissions
};

interface TradeResult {
  action: string;
  latencyMs: number;
  success: boolean;
  txHash?: string;
  error?: string;
}

const results: TradeResult[] = [];
let successCount = 0;
let failCount = 0;

async function getAccount(): Promise<Account> {
  const privateKey = process.env.APTOS_PRIVATE_KEY;
  if (!privateKey) {
    console.error('ERROR: Set APTOS_PRIVATE_KEY environment variable');
    process.exit(1);
  }
  const pk = new Ed25519PrivateKey(privateKey);
  return Account.fromPrivateKey({ privateKey: pk });
}

async function getMarketAddress(aptos: Aptos): Promise<string> {
  if (process.argv[2] && process.argv[2].startsWith('0x')) {
    return process.argv[2];
  }

  const result = await aptos.view({
    payload: {
      function: `${MODULE}::get_all_markets`,
      functionArguments: [],
    },
  });

  const markets = result[0] as string[];
  if (markets.length === 0) {
    console.error('ERROR: No markets found');
    process.exit(1);
  }
  return markets[0];
}

async function executeTrade(
  aptos: Aptos,
  account: Account,
  marketAddress: string,
  action: 'buy_yes' | 'buy_no',
  sequenceNumber?: bigint
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
      options: sequenceNumber !== undefined ? { accountSequenceNumber: sequenceNumber } : undefined,
    });

    const pendingTx = await aptos.signAndSubmitTransaction({
      signer: account,
      transaction,
    });

    // Don't wait for confirmation for max speed - just check it was submitted
    const latency = Date.now() - startTime;

    return {
      action,
      latencyMs: latency,
      success: true,
      txHash: pendingTx.hash,
    };
  } catch (error: any) {
    return {
      action,
      latencyMs: Date.now() - startTime,
      success: false,
      error: error.message?.slice(0, 50),
    };
  }
}

async function runSequentialTurbo(aptos: Aptos, account: Account, marketAddress: string) {
  console.log('\n🚀 SEQUENTIAL TURBO MODE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Executing trades sequentially with minimal delay...\n');

  const startTime = Date.now();
  const actions: Array<'buy_yes' | 'buy_no'> = ['buy_yes', 'buy_no'];

  for (let i = 0; i < CONFIG.totalTrades; i++) {
    const action = actions[i % 2];
    const result = await executeTrade(aptos, account, marketAddress, action);
    results.push(result);

    if (result.success) {
      successCount++;
      process.stdout.write(`\r✓ ${successCount}/${CONFIG.totalTrades} trades | ${result.latencyMs}ms | ${result.txHash?.slice(0, 10)}...`);
    } else {
      failCount++;
      process.stdout.write(`\r✗ Failed: ${result.error}`);
    }

    // Minimal delay - just enough for sequence number
    await new Promise(r => setTimeout(r, 100));
  }

  const totalTime = Date.now() - startTime;
  console.log('\n');
  return totalTime;
}

async function runBatchTurbo(aptos: Aptos, account: Account, marketAddress: string) {
  console.log('\n🔥 BATCH TURBO MODE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Submitting ${CONFIG.concurrentBatches} concurrent batches...\n`);

  const startTime = Date.now();
  const actions: Array<'buy_yes' | 'buy_no'> = ['buy_yes', 'buy_no'];

  // Get current sequence number
  const accountInfo = await aptos.getAccountInfo({ accountAddress: account.accountAddress });
  let seqNum = BigInt(accountInfo.sequence_number);

  const batchSize = Math.ceil(CONFIG.totalTrades / CONFIG.concurrentBatches);

  for (let batch = 0; batch < CONFIG.concurrentBatches; batch++) {
    const batchPromises: Promise<TradeResult>[] = [];

    for (let i = 0; i < batchSize && (batch * batchSize + i) < CONFIG.totalTrades; i++) {
      const tradeNum = batch * batchSize + i;
      const action = actions[tradeNum % 2];

      // Use pre-assigned sequence numbers for parallel submission
      batchPromises.push(executeTrade(aptos, account, marketAddress, action, seqNum));
      seqNum++;
    }

    console.log(`Batch ${batch + 1}: Submitting ${batchPromises.length} transactions...`);

    const batchResults = await Promise.all(batchPromises);

    for (const result of batchResults) {
      results.push(result);
      if (result.success) {
        successCount++;
      } else {
        failCount++;
      }
    }

    console.log(`  ✓ ${batchResults.filter(r => r.success).length} succeeded, ✗ ${batchResults.filter(r => !r.success).length} failed`);

    // Small delay between batches
    await new Promise(r => setTimeout(r, CONFIG.delayBetweenBatches));
  }

  const totalTime = Date.now() - startTime;
  return totalTime;
}

async function runTransactionWorker(aptos: Aptos, account: Account, marketAddress: string) {
  console.log('\n⚡ TRANSACTION WORKER MODE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Using Aptos SDK TransactionWorker for optimal throughput...\n');

  const startTime = Date.now();

  // Build all transaction payloads
  const payloads: InputGenerateTransactionPayloadData[] = [];
  const amountUnits = Math.floor(CONFIG.tradeAmountAPT * 100_000_000);
  const actions = ['buy_yes', 'buy_no'];

  for (let i = 0; i < CONFIG.totalTrades; i++) {
    payloads.push({
      function: `${MODULE}::${actions[i % 2]}`,
      functionArguments: [marketAddress, amountUnits, 0],
    });
  }

  // Use batch submission
  aptos.transaction.batch.forSingleAccount({
    sender: account,
    data: payloads,
  });

  // Listen for events
  aptos.transaction.batch.on(TransactionWorkerEventsEnum.TransactionSent, (data) => {
    successCount++;
    process.stdout.write(`\r⚡ Sent: ${successCount}/${CONFIG.totalTrades}`);
  });

  aptos.transaction.batch.on(TransactionWorkerEventsEnum.TransactionSendFailed, (data) => {
    failCount++;
  });

  aptos.transaction.batch.on(TransactionWorkerEventsEnum.ExecutionFinish, (data) => {
    console.log('\n\nBatch execution complete!');
  });

  // Wait for completion
  await new Promise<void>((resolve) => {
    aptos.transaction.batch.on(TransactionWorkerEventsEnum.ExecutionFinish, () => {
      resolve();
    });

    // Timeout after 60 seconds
    setTimeout(() => {
      console.log('\nTimeout reached');
      resolve();
    }, 60000);
  });

  const totalTime = Date.now() - startTime;
  return totalTime;
}

async function main() {
  const aptosConfig = new AptosConfig({ network: Network.TESTNET });
  const aptos = new Aptos(aptosConfig);

  const account = await getAccount();
  const marketAddress = await getMarketAddress(aptos);
  const address = account.accountAddress.toString();

  console.log('════════════════════════════════════════════════════════════════');
  console.log('HFT TURBO - MAXIMUM THROUGHPUT');
  console.log('════════════════════════════════════════════════════════════════');
  console.log(`\nAccount: ${address.slice(0, 10)}...${address.slice(-8)}`);
  console.log(`Market: ${marketAddress.slice(0, 10)}...${marketAddress.slice(-8)}`);
  console.log(`Total Trades: ${CONFIG.totalTrades}`);
  console.log(`Trade Amount: ${CONFIG.tradeAmountAPT} APT`);

  // Choose mode based on args
  const mode = process.argv[3] || 'sequential';
  let totalTime: number;

  switch (mode) {
    case 'batch':
      totalTime = await runBatchTurbo(aptos, account, marketAddress);
      break;
    case 'worker':
      totalTime = await runTransactionWorker(aptos, account, marketAddress);
      break;
    default:
      totalTime = await runSequentialTurbo(aptos, account, marketAddress);
  }

  // Stats
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('RESULTS');
  console.log('════════════════════════════════════════════════════════════════');
  console.log(`Total Time: ${(totalTime / 1000).toFixed(2)}s`);
  console.log(`Successful: ${successCount}`);
  console.log(`Failed: ${failCount}`);
  console.log(`Success Rate: ${((successCount / CONFIG.totalTrades) * 100).toFixed(1)}%`);
  console.log(`Throughput: ${(successCount / (totalTime / 1000)).toFixed(2)} TPS`);

  const successfulResults = results.filter(r => r.success);
  if (successfulResults.length > 0) {
    const avgLatency = successfulResults.reduce((a, b) => a + b.latencyMs, 0) / successfulResults.length;
    console.log(`Avg Latency: ${avgLatency.toFixed(0)}ms`);
  }

  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('Sample transactions (verify on explorer):');
  results.slice(0, 5).forEach((r, i) => {
    if (r.txHash) {
      console.log(`  ${i + 1}. https://explorer.aptoslabs.com/txn/${r.txHash}?network=testnet`);
    }
  });
  console.log('════════════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
