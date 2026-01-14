/**
 * BENCHMARK VARIANTS - Compare TPS across Table, SmartTable, and BigOrderedMap
 *
 * Runs identical workloads against each data structure variant and measures:
 * - Submission TPS (client-side)
 * - Mempool acceptance rate
 * - On-chain success rate
 * - Peak TPS per block
 *
 * Usage:
 *   source .env.benchmark
 *   npx tsx scripts/benchmark-variants.ts [duration_seconds]
 *
 * Example:
 *   npx tsx scripts/benchmark-variants.ts 60    # 60-second test per variant
 */

import {
  Aptos,
  AptosConfig,
  Network,
  Account,
  Ed25519PrivateKey,
  InputGenerateTransactionPayloadData,
  SimpleTransaction,
  AccountAuthenticator,
} from '@aptos-labs/ts-sdk';

const BENCHMARK_CONTRACT = process.env.BENCHMARK_CONTRACT ||
  '0x07aa6210d6eb8befe55e0cb983964ad5f2e4edb4eb80be8ea6a2ec7860ff34f0';

interface VariantConfig {
  name: string;
  module: string;
  markets: string[];
}

const VARIANTS: VariantConfig[] = [
  {
    name: 'Table',
    module: `${BENCHMARK_CONTRACT}::multi_outcome_market`,
    markets: (process.env.TABLE_MARKETS || '').split(',').filter(m => m),
  },
  {
    name: 'SmartTable',
    module: `${BENCHMARK_CONTRACT}::smarttable_market`,
    markets: (process.env.SMARTTABLE_MARKETS || '').split(',').filter(m => m),
  },
  {
    name: 'BigOrderedMap',
    module: `${BENCHMARK_CONTRACT}::bigorderedmap_market`,
    markets: (process.env.BIGORDEREDMAP_MARKETS || '').split(',').filter(m => m),
  },
];

// Test account keys - reuse from existing setup
const TEST_KEYS = [
  '0x6e2fca34586261b6f22a973c20024b78ddb370d87f7c974315fb97ba56716a7f',
  '0xe61d22b3dc37c537a20d5b301c4d2b409b2f93cd7b2915f3518d49517c2ab6c4',
  '0x4542c2e4a39beee8202eee0cddeceea886687b21b54b8f50c17e729251fdd7f5',
  '0xcf5154af9664bbc2634fddfcce2317ed788b35de7f004ac0e24aefd68a0b10c5',
  '0xb7d1f406e48c2eddffe987f98445dd4a353e8e9d1630d878621ded084bdd77c7',
];

const DURATION_SEC = parseInt(process.argv[2]) || 30;
const FULLNODE_URL = process.env.FULLNODE_URL || 'https://api.testnet.aptoslabs.com/v1';

const config = new AptosConfig({
  network: Network.TESTNET,
  fullnode: FULLNODE_URL,
});
const aptos = new Aptos(config);

interface BenchmarkResult {
  variant: string;
  totalSubmitted: number;
  mempoolAccepted: number;
  mempoolRejected: number;
  submitDurationSec: number;
  avgSubmitTps: number;
  peakBlockTxns: number;
  peakTps: number;
  onChainSuccess: number;
  onChainFailed: number;
  avgGasPerTxn: number;
}

function parsePrivateKey(keyStr: string): Ed25519PrivateKey {
  const cleanKey = keyStr.replace('ed25519-priv-', '').replace(/^0x/i, '');
  return new Ed25519PrivateKey('0x' + cleanKey.toLowerCase());
}

interface PreparedTx {
  transaction: SimpleTransaction;
  authenticator: AccountAuthenticator;
}

async function runBenchmark(variant: VariantConfig): Promise<BenchmarkResult> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  BENCHMARKING: ${variant.name}`);
  console.log(`${'='.repeat(60)}`);

  if (variant.markets.length === 0) {
    console.log('  No markets configured for this variant!');
    return {
      variant: variant.name,
      totalSubmitted: 0,
      mempoolAccepted: 0,
      mempoolRejected: 0,
      submitDurationSec: 0,
      avgSubmitTps: 0,
      peakBlockTxns: 0,
      peakTps: 0,
      onChainSuccess: 0,
      onChainFailed: 0,
      avgGasPerTxn: 0,
    };
  }

  // Load accounts
  const accounts: Account[] = [];
  for (const keyStr of TEST_KEYS) {
    try {
      const privateKey = parsePrivateKey(keyStr);
      const account = Account.fromPrivateKey({ privateKey });
      accounts.push(account);
    } catch {}
  }
  console.log(`  Loaded ${accounts.length} accounts`);

  // Get sequence numbers
  const sequenceNumbers: Map<string, bigint> = new Map();
  for (const account of accounts) {
    try {
      const info = await aptos.account.getAccountInfo({ accountAddress: account.accountAddress });
      sequenceNumbers.set(account.accountAddress.toString(), BigInt(info.sequence_number));
    } catch {
      // Account might not exist
      sequenceNumbers.set(account.accountAddress.toString(), 0n);
    }
  }

  // Build function for buy_outcome
  function buildPayload(): InputGenerateTransactionPayloadData {
    const market = variant.markets[Math.floor(Math.random() * variant.markets.length)];
    const outcomeIndex = Math.floor(Math.random() * 4);
    const amount = Math.floor(1_000 + Math.random() * 4_000); // 0.00001-0.00005 APT (minimal for TPS testing)
    return {
      function: `${variant.module}::buy_outcome`,
      functionArguments: [market, outcomeIndex, amount, 0],
    };
  }

  // Pre-build transactions (50 per account - limited by account balances ~0.15 APT each)
  const TXNS_PER_ACCOUNT = 50;
  console.log(`  Pre-building ${accounts.length * TXNS_PER_ACCOUNT} transactions...`);

  const allPrepared: PreparedTx[] = [];
  for (const account of accounts) {
    const addr = account.accountAddress.toString();
    let seqNum = sequenceNumbers.get(addr)!;

    for (let i = 0; i < TXNS_PER_ACCOUNT; i++) {
      try {
        const payload = buildPayload();
        const transaction = await aptos.transaction.build.simple({
          sender: account.accountAddress,
          data: payload,
          options: {
            accountSequenceNumber: seqNum,
            expireTimestamp: Math.floor(Date.now() / 1000) + 120,
            maxGasAmount: 10000, // Limit gas to preserve balance
          },
        });
        const authenticator = aptos.transaction.sign({ signer: account, transaction });
        allPrepared.push({ transaction, authenticator });
        seqNum++;
      } catch {}
    }
  }
  console.log(`  Built ${allPrepared.length} transactions`);

  // Interleave transactions across accounts
  const accountTxns: Map<string, PreparedTx[]> = new Map();
  let txnIndex = 0;
  for (const account of accounts) {
    const addr = account.accountAddress.toString();
    const txns: PreparedTx[] = [];
    for (let i = 0; i < TXNS_PER_ACCOUNT && txnIndex < allPrepared.length; i++) {
      txns.push(allPrepared[txnIndex++]);
    }
    accountTxns.set(addr, txns);
  }

  const interleaved: PreparedTx[] = [];
  for (let i = 0; i < TXNS_PER_ACCOUNT; i++) {
    for (const [_, txns] of accountTxns) {
      if (i < txns.length) interleaved.push(txns[i]);
    }
  }

  // Record start ledger version for filtering results
  const startLedger = await aptos.getLedgerInfo();
  const startVersion = BigInt(startLedger.ledger_version);
  console.log(`  Start version: ${startVersion}`);

  // Fire transactions
  console.log(`  Firing ${interleaved.length} transactions...`);
  const fireStart = Date.now();
  let mempoolAccepted = 0;
  let mempoolRejected = 0;

  const CHUNK_SIZE = 100;
  for (let i = 0; i < interleaved.length && (Date.now() - fireStart) < DURATION_SEC * 1000; i += CHUNK_SIZE) {
    const chunk = interleaved.slice(i, i + CHUNK_SIZE);
    const results = await Promise.all(chunk.map(async ({ transaction, authenticator }) => {
      try {
        await aptos.transaction.submit.simple({ transaction, senderAuthenticator: authenticator });
        return true;
      } catch { return false; }
    }));
    mempoolAccepted += results.filter(r => r).length;
    mempoolRejected += results.filter(r => !r).length;

    const elapsed = ((Date.now() - fireStart) / 1000).toFixed(1);
    process.stdout.write(`\r  [${elapsed}s] Submitted: ${i + chunk.length} | Accepted: ${mempoolAccepted} | Rejected: ${mempoolRejected}  `);
  }

  const submitDuration = (Date.now() - fireStart) / 1000;
  console.log('');

  // Wait for transactions to land
  console.log('  Waiting 10s for transactions to land on-chain...');
  await new Promise(r => setTimeout(r, 10000));

  // Analyze on-chain results by querying account transactions
  console.log(`  Analyzing transactions from test accounts...`);

  let onChainSuccess = 0;
  let onChainFailed = 0;
  let totalGas = 0;
  let peakBlockTxns = 0;
  const moduleShortName = variant.module.split('::')[1]; // e.g., 'multi_outcome_market'

  // Query each test account for recent transactions
  for (const account of accounts) {
    try {
      const txns = await aptos.getAccountTransactions({
        accountAddress: account.accountAddress,
        options: { limit: TXNS_PER_ACCOUNT + 10 }
      });

      // Filter for our module AND only transactions after startVersion
      const ourTxns = (txns as any[]).filter((tx: any) => {
        const txVersion = BigInt(tx.version || '0');
        const isOurModule = tx.payload?.function?.toLowerCase().includes(moduleShortName.toLowerCase());
        const isAfterStart = txVersion > startVersion;
        return isOurModule && isAfterStart;
      });

      for (const tx of ourTxns) {
        if (tx.success) {
          onChainSuccess++;
          totalGas += parseInt(tx.gas_used || '0');
        } else {
          onChainFailed++;
        }
      }
    } catch {}
  }

  // Estimate peak TPS from submission rate (actual block analysis is expensive)
  peakBlockTxns = Math.round(onChainSuccess / (submitDuration * 10)); // Rough estimate

  const result: BenchmarkResult = {
    variant: variant.name,
    totalSubmitted: mempoolAccepted + mempoolRejected,
    mempoolAccepted,
    mempoolRejected,
    submitDurationSec: submitDuration,
    avgSubmitTps: Math.round(mempoolAccepted / submitDuration),
    peakBlockTxns,
    peakTps: Math.round(peakBlockTxns * 10.6), // ~10.6 blocks/sec
    onChainSuccess,
    onChainFailed,
    avgGasPerTxn: onChainSuccess > 0 ? Math.round(totalGas / onChainSuccess) : 0,
  };

  console.log(`\n  Results for ${variant.name}:`);
  console.log(`    Mempool Accept: ${mempoolAccepted}/${mempoolAccepted + mempoolRejected} (${(mempoolAccepted / (mempoolAccepted + mempoolRejected) * 100).toFixed(1)}%)`);
  console.log(`    Submit TPS: ${result.avgSubmitTps}`);
  console.log(`    Peak Block: ${peakBlockTxns} txns (${result.peakTps} TPS)`);
  console.log(`    On-chain: ${onChainSuccess} success, ${onChainFailed} failed`);
  console.log(`    Avg Gas: ${result.avgGasPerTxn}`);

  return result;
}

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     DATA STRUCTURE BENCHMARK: Table vs SmartTable vs B+Tree   ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`  Duration per variant: ${DURATION_SEC}s`);
  console.log(`  Contract: ${BENCHMARK_CONTRACT}`);
  console.log(`  Fullnode: ${FULLNODE_URL}`);

  const results: BenchmarkResult[] = [];

  for (const variant of VARIANTS) {
    if (variant.markets.length === 0) {
      console.log(`\nSkipping ${variant.name} - no markets configured`);
      continue;
    }

    const result = await runBenchmark(variant);
    results.push(result);

    // Cool-down between variants
    console.log('\n  Cooling down 30s before next variant...');
    await new Promise(r => setTimeout(r, 30000));
  }

  // Final comparison
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║                   BENCHMARK COMPARISON                        ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('  Variant        │ Submit TPS │ Peak TPS │ Success% │ Gas/Txn');
  console.log('  ───────────────┼────────────┼──────────┼──────────┼─────────');

  for (const r of results) {
    const successRate = r.mempoolAccepted > 0
      ? ((r.onChainSuccess / r.mempoolAccepted) * 100).toFixed(1)
      : '0.0';
    console.log(
      `  ${r.variant.padEnd(14)} │ ${r.avgSubmitTps.toString().padStart(10)} │ ${r.peakTps.toString().padStart(8)} │ ${successRate.padStart(7)}% │ ${r.avgGasPerTxn.toString().padStart(7)}`
    );
  }

  // Find winner
  const winner = results.reduce((best, r) => r.peakTps > best.peakTps ? r : best, results[0]);
  console.log('');
  console.log(`  🏆 WINNER: ${winner?.variant} with ${winner?.peakTps} peak TPS`);

  // Output as JSON for further analysis
  console.log('\n\n// JSON results for docs/BENCHMARK_RESULTS.md:');
  console.log(JSON.stringify(results, null, 2));
}

main().catch(console.error);
