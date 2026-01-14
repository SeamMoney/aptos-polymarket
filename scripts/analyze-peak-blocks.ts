/**
 * Analyze high-TPS blocks to understand what transactions are running
 */
import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';

const BLOCKS_TO_ANALYZE = [
  619967192, // 304 txns from screenshot
  619953007, // 279 txns from screenshot
  619963849, // 216 txns from screenshot
  619996917, // 93 txns from screenshot (lower)
];

// Our contract addresses
const OUR_CONTRACTS = [
  '0x07aa6210d6eb8befe55e0cb983964ad5f2e4edb4eb80be8ea6a2ec7860ff34f0', // Benchmark
  '0xda51d5f87be27cac0a1d72fe500da145c61b2356547ac811e0cd822c80f99a3b', // TPS optimized
  '0xb31e712b26fd295357355f6845e77c888298636609e93bc9b05f0f604049f434', // Deployer
];

async function analyzeBlock(aptos: Aptos, blockHeight: number) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`BLOCK ${blockHeight}`);
  console.log('='.repeat(60));

  try {
    const block = await aptos.getBlockByHeight({
      blockHeight,
      options: { withTransactions: true }
    });

    const txns = (block.transactions || []) as any[];
    console.log(`Total transactions: ${txns.length}`);

    // Group by function
    const byFunction: Record<string, { count: number; success: number; failed: number; avgGas: number }> = {};
    let ourTxns = 0;
    let otherTxns = 0;

    for (const tx of txns) {
      const fn = tx.payload?.function || 'system/unknown';
      const shortFn = fn.split('::').slice(-2).join('::');

      if (!byFunction[shortFn]) {
        byFunction[shortFn] = { count: 0, success: 0, failed: 0, avgGas: 0 };
      }
      byFunction[shortFn].count++;
      if (tx.success) {
        byFunction[shortFn].success++;
      } else {
        byFunction[shortFn].failed++;
      }
      byFunction[shortFn].avgGas += parseInt(tx.gas_used || '0');

      // Check if it's our contract
      const isOurs = OUR_CONTRACTS.some(addr =>
        fn.toLowerCase().includes(addr.slice(2).toLowerCase())
      );
      if (isOurs) ourTxns++;
      else otherTxns++;
    }

    // Calculate averages
    for (const fn of Object.keys(byFunction)) {
      byFunction[fn].avgGas = Math.round(byFunction[fn].avgGas / byFunction[fn].count);
    }

    // Sort by count
    const sorted = Object.entries(byFunction)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10);

    console.log(`\nOur transactions: ${ourTxns} (${(ourTxns/txns.length*100).toFixed(1)}%)`);
    console.log(`Other transactions: ${otherTxns} (${(otherTxns/txns.length*100).toFixed(1)}%)`);

    console.log(`\nTop functions:`);
    for (const [fn, stats] of sorted) {
      console.log(`  ${fn.padEnd(50)} | ${stats.count.toString().padStart(4)} txns | ${stats.success}/${stats.count} success | ${stats.avgGas} gas`);
    }

    // Look for contention patterns
    const senders = txns.map((tx: any) => tx.sender).filter(Boolean);
    const uniqueSenders = new Set(senders).size;
    console.log(`\nUnique senders: ${uniqueSenders} (${(uniqueSenders/txns.length*100).toFixed(1)}% unique)`);

    // Check if there are failed transactions and why
    const failedTxns = txns.filter((tx: any) => !tx.success);
    if (failedTxns.length > 0) {
      console.log(`\nFailed transactions: ${failedTxns.length}`);
      const failReasons: Record<string, number> = {};
      for (const tx of failedTxns) {
        const reason = tx.vm_status || 'unknown';
        failReasons[reason] = (failReasons[reason] || 0) + 1;
      }
      for (const [reason, count] of Object.entries(failReasons).slice(0, 5)) {
        console.log(`  ${reason.slice(0, 60)}: ${count}`);
      }
    }

  } catch (e: any) {
    console.log(`Error fetching block: ${e.message}`);
  }
}

async function main() {
  const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));

  console.log('ANALYZING PEAK TPS BLOCKS FROM SCREENSHOTS');
  console.log('Looking for patterns that explain TPS limits...\n');

  for (const blockHeight of BLOCKS_TO_ANALYZE) {
    await analyzeBlock(aptos, blockHeight);
  }

  // Also check a recent block to see current state
  const ledger = await aptos.getLedgerInfo();
  const currentBlock = parseInt(ledger.block_height);
  console.log(`\n\nCURRENT BLOCK: ${currentBlock}`);
  await analyzeBlock(aptos, currentBlock - 10);
}

main().catch(console.error);
