/**
 * Benchmark comparison: Baseline (4 aggregator ops) vs TPS Max (2 aggregator ops)
 *
 * Baseline: multi_outcome_market module
 *   - accumulated_fees add (on buy/sell)
 *   - total_collateral add/sub (on buy/sell)
 *   - base_reserve add/sub (required for CPMM)
 *   - outcome.reserve add/sub (required for CPMM)
 *
 * TPS Max: tps_max_market module
 *   - base_reserve add/sub (required for CPMM)
 *   - outcome.reserve add/sub (required for CPMM)
 *   - REMOVED: accumulated_fees, total_collateral
 */
import { Aptos, AptosConfig, Network, Account, Ed25519PrivateKey, InputGenerateTransactionPayloadData } from '@aptos-labs/ts-sdk';

// Baseline contract (with bookkeeping)
const BASELINE_CONTRACT = '0xda51d5f87be27cac0a1d72fe500da145c61b2356547ac811e0cd822c80f99a3b';
const BASELINE_MODULE = 'multi_outcome_market';
const BASELINE_MARKETS = [
  '0xdda603f5809b7e3c873f50ca06137e895883498836d3581894baa69d9e1e79e1',
  '0x568914c73b8aed2a93c01f63dc6e9b7b8c923a5867d40e9a1f5445e6add8e7c0',
  '0x10932ea9a3448eb137ed439ee236c4f76d41ce3e6c5afb61236cd246c0da568a',
  '0xbbfcd32bfc2b653d94d17fcabb6f28f4ea30ada1e3643b3e8a3c8fd8b543b63b',
  '0xbc2240693af5df6478d28d8b7530f1cd1ff99683a3fa1dbb05e989383d3e1257',
  '0xcb0e753cfa2a03059ccabbd74c5818f5b64949b2379ae0cfc1c25255509ba6b2',
  '0xe83d90a6e7229a6aabbbd67388bc34cfb5fada53000c7d2dc27ef98ba1f573d0',
  '0x1267b37dd2c196a1ecf25318e146bc16a798a7da5c7ed99bfee8df5efc4bab24',
  '0x3c704b2a85071b56360e6df0ce7ced87989d048c7f136cdeb679ac6936bdd69f',
  '0x66523f60f28f17e86067ac52a8fa227a73fce050063951e964d540d39caf516c',
];

// TPS Max contract (without bookkeeping)
const TPS_MAX_CONTRACT = '0x39bf8a856da24036d9365d85a59e56545b252a533a0c355353480eb589769307';
const TPS_MAX_MODULE = 'tps_max_market';
const TPS_MAX_MARKETS = [
  '0x44841c5ebbb693726e548b3cfee749d7486ed70274ba3c62dd3a5521f99d4a97',
  '0x1d0b9f00c5dc407c2eee62bc5209c3a8ad44786524a48b277b6b9f848e669767',
  '0x229e88d844e741e73b1bb1b8879c7d219601f4d637962a99e6b0ad0b29beb7a7',
  '0xf86595b56f58a65d7fb64818ab30457c3368200b307c9e95dad61f84dc60222e',
  '0x3bb08a2789675c307a329602bb7c41f97eee5cd319aecfa9d7e2a4c3728edfc2',
  '0xabda4807af7ae75ccb8043517da23df4a08f3c32c68aa249b016fde9d8a1519b',
  '0x4383c34dd223164559008caf48c65de7f5fdf8fc977dce8f9622007a303eeff2',
  '0xc6341ae1e3810bd5e427589508c72b223f066fcf0b1f4ff6696383645f1b846c',
  '0x9c32443a23ee9d443431bb8e07cc0831ab8e6b4e7f9b8d4b59af517b0d6ec051',
  '0x9dec753fc9a3ba3ac34073679277f95eb47d84df1869b221f3ab3eac5e301db0',
];

// Test accounts (same for both)
const TEST_KEYS = [
  '0x6e2fca34586261b6f22a973c20024b78ddb370d87f7c974315fb97ba56716a7f',
  '0xe61d22b3dc37c537a20d5b301c4d2b409b2f93cd7b2915f3518d49517c2ab6c4',
  '0x4542c2e4a39beee8202eee0cddeceea886687b21b54b8f50c17e729251fdd7f5',
  '0xcf5154af9664bbc2634fddfcce2317ed788b35de7f004ac0e24aefd68a0b10c5',
  '0xb7d1f406e48c2eddffe987f98445dd4a353e8e9d1630d878621ded084bdd77c7',
];

interface BenchmarkConfig {
  name: string;
  contract: string;
  module: string;
  markets: string[];
  aggregatorOps: number;
}

interface BenchmarkResult {
  name: string;
  submitted: number;
  mempoolAccepted: number;
  onChainSuccess: number;
  onChainFailed: number;
  submitTps: number;
  successRate: number;
  avgGas: number;
  aggregatorOps: number;
}

async function runBenchmark(aptos: Aptos, config: BenchmarkConfig, durationSec: number): Promise<BenchmarkResult> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`BENCHMARK: ${config.name}`);
  console.log(`  Contract: ${config.contract.slice(0, 20)}...`);
  console.log(`  Module: ${config.module}`);
  console.log(`  Markets: ${config.markets.length}`);
  console.log(`  Aggregator ops per trade: ${config.aggregatorOps}`);
  console.log('='.repeat(60));

  // Load test accounts
  const accounts: Account[] = [];
  for (const key of TEST_KEYS) {
    const privateKey = new Ed25519PrivateKey(key);
    accounts.push(Account.fromPrivateKey({ privateKey }));
  }

  // Get sequence numbers
  const seqNums: Map<string, bigint> = new Map();
  for (const account of accounts) {
    const info = await aptos.getAccountInfo({ accountAddress: account.accountAddress });
    seqNums.set(account.accountAddress.toString(), BigInt(info.sequence_number));
  }

  // Build payloads
  function buildPayload(): InputGenerateTransactionPayloadData {
    const market = config.markets[Math.floor(Math.random() * config.markets.length)];
    const outcomeIndex = Math.floor(Math.random() * 2); // Binary markets
    const amount = Math.floor(1_000 + Math.random() * 4_000); // 0.00001-0.00005 APT
    return {
      function: `${config.contract}::${config.module}::buy_outcome`,
      functionArguments: [market, outcomeIndex, amount, 0],
    };
  }

  // Pre-build transactions
  const TXNS_PER_ACCOUNT = 50;
  console.log(`  Pre-building ${accounts.length * TXNS_PER_ACCOUNT} transactions...`);

  type PreparedTx = { account: Account; transaction: any; authenticator: any };
  const allPrepared: PreparedTx[] = [];

  for (const account of accounts) {
    const seqNum = seqNums.get(account.accountAddress.toString())!;
    for (let i = 0; i < TXNS_PER_ACCOUNT; i++) {
      const transaction = await aptos.transaction.build.simple({
        sender: account.accountAddress,
        data: buildPayload(),
        options: {
          accountSequenceNumber: seqNum + BigInt(i),
          expireTimestamp: Math.floor(Date.now() / 1000) + 120,
          maxGasAmount: 10000,
        },
      });
      const authenticator = aptos.transaction.sign({ signer: account, transaction });
      allPrepared.push({ account, transaction, authenticator });
    }
  }

  // Shuffle for interleaving
  const interleaved = allPrepared.sort(() => Math.random() - 0.5);

  // Record start
  const startLedger = await aptos.getLedgerInfo();
  const startVersion = BigInt(startLedger.ledger_version);

  // Fire transactions
  console.log(`  Firing ${interleaved.length} transactions...`);
  const startTime = Date.now();

  let mempoolAccepted = 0;
  let mempoolRejected = 0;

  const promises = interleaved.map(async (prepared) => {
    try {
      await aptos.transaction.submit.simple({
        transaction: prepared.transaction,
        senderAuthenticator: prepared.authenticator,
      });
      mempoolAccepted++;
    } catch {
      mempoolRejected++;
    }
  });

  await Promise.all(promises);
  const endTime = Date.now();
  const submitDuration = (endTime - startTime) / 1000;

  console.log(`  Submission complete in ${submitDuration.toFixed(2)}s`);
  console.log(`  Mempool: ${mempoolAccepted} accepted, ${mempoolRejected} rejected`);

  // Wait for on-chain
  console.log('  Waiting 10s for transactions to land...');
  await new Promise(r => setTimeout(r, 10000));

  // Analyze results
  let onChainSuccess = 0;
  let onChainFailed = 0;
  let totalGas = 0;

  for (const account of accounts) {
    try {
      const txns = await aptos.getAccountTransactions({
        accountAddress: account.accountAddress,
        options: { limit: TXNS_PER_ACCOUNT + 10 }
      });

      const ourTxns = (txns as any[]).filter((tx: any) => {
        const txVersion = BigInt(tx.version || '0');
        const isOurModule = tx.payload?.function?.toLowerCase().includes(config.module.toLowerCase());
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

  const submitTps = mempoolAccepted / submitDuration;
  const successRate = onChainSuccess / (onChainSuccess + onChainFailed) * 100 || 0;
  const avgGas = onChainSuccess > 0 ? Math.round(totalGas / onChainSuccess) : 0;

  console.log(`\n  RESULTS:`);
  console.log(`    Submit TPS: ${submitTps.toFixed(0)}`);
  console.log(`    On-chain: ${onChainSuccess} success, ${onChainFailed} failed`);
  console.log(`    Success rate: ${successRate.toFixed(1)}%`);
  console.log(`    Avg gas: ${avgGas}`);

  return {
    name: config.name,
    submitted: interleaved.length,
    mempoolAccepted,
    onChainSuccess,
    onChainFailed,
    submitTps,
    successRate,
    avgGas,
    aggregatorOps: config.aggregatorOps,
  };
}

async function main() {
  const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));

  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  TPS MAX BENCHMARK: Baseline (4 ops) vs TPS Max (2 ops)       ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  const configs: BenchmarkConfig[] = [
    {
      name: 'Baseline (4 aggregator ops)',
      contract: BASELINE_CONTRACT,
      module: BASELINE_MODULE,
      markets: BASELINE_MARKETS,
      aggregatorOps: 4,
    },
    {
      name: 'TPS Max (2 aggregator ops)',
      contract: TPS_MAX_CONTRACT,
      module: TPS_MAX_MODULE,
      markets: TPS_MAX_MARKETS,
      aggregatorOps: 2,
    },
  ];

  const results: BenchmarkResult[] = [];

  for (const config of configs) {
    const result = await runBenchmark(aptos, config, 20);
    results.push(result);

    // Cool-down
    console.log('\n  Cooling down for 15 seconds...');
    await new Promise(r => setTimeout(r, 15000));
  }

  // Print comparison
  console.log('\n\n' + '═'.repeat(70));
  console.log('                        COMPARISON RESULTS');
  console.log('═'.repeat(70));
  console.log('┌────────────────────────────┬──────────┬─────────┬──────────┬─────────┐');
  console.log('│ Variant                    │ Submit   │ On-Chain│ Success% │ Gas/Txn │');
  console.log('│                            │ TPS      │ Success │          │         │');
  console.log('├────────────────────────────┼──────────┼─────────┼──────────┼─────────┤');

  for (const r of results) {
    const name = r.name.padEnd(26);
    const tps = r.submitTps.toFixed(0).padStart(6);
    const success = r.onChainSuccess.toString().padStart(7);
    const rate = `${r.successRate.toFixed(0)}%`.padStart(8);
    const gas = r.avgGas.toString().padStart(7);
    console.log(`│ ${name} │ ${tps}   │ ${success} │ ${rate} │ ${gas} │`);
  }

  console.log('└────────────────────────────┴──────────┴─────────┴──────────┴─────────┘');

  // Calculate improvement
  if (results.length === 2) {
    const baseline = results[0];
    const tpsMax = results[1];
    const tpsImprovement = ((tpsMax.submitTps - baseline.submitTps) / baseline.submitTps * 100);
    const gasReduction = ((baseline.avgGas - tpsMax.avgGas) / baseline.avgGas * 100);

    console.log('\n📊 IMPROVEMENT ANALYSIS:');
    console.log(`  TPS improvement: ${tpsImprovement > 0 ? '+' : ''}${tpsImprovement.toFixed(1)}%`);
    console.log(`  Gas reduction: ${gasReduction > 0 ? '-' : '+'}${Math.abs(gasReduction).toFixed(1)}%`);
    console.log(`  Aggregator ops: ${baseline.aggregatorOps} → ${tpsMax.aggregatorOps} (${((baseline.aggregatorOps - tpsMax.aggregatorOps) / baseline.aggregatorOps * 100).toFixed(0)}% reduction)`);
  }
}

main().catch(console.error);
