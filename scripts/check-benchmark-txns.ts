/**
 * Quick check of benchmark transactions on-chain
 */
import { Aptos, AptosConfig, Network, Account, Ed25519PrivateKey } from '@aptos-labs/ts-sdk';

const TEST_KEYS = [
  '0x6e2fca34586261b6f22a973c20024b78ddb370d87f7c974315fb97ba56716a7f',
  '0xe61d22b3dc37c537a20d5b301c4d2b409b2f93cd7b2915f3518d49517c2ab6c4',
];

// Note: Address may be rendered without leading zeros after 0x
const BENCHMARK_CONTRACT = '7aa6210d6eb8befe55e0cb983964ad5f2e4edb4eb80be8ea6a2ec7860ff34f0';

async function main() {
  const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));

  for (const keyStr of TEST_KEYS) {
    const privateKey = new Ed25519PrivateKey(keyStr);
    const account = Account.fromPrivateKey({ privateKey });
    console.log('\nAccount:', account.accountAddress.toString().slice(0, 12) + '...');

    // Get recent transactions
    const txns = await aptos.getAccountTransactions({
      accountAddress: account.accountAddress,
      options: { limit: 20 }
    });

    // Filter for our benchmark contract
    const ourTxns = txns.filter((tx: any) =>
      tx.payload?.function?.includes(BENCHMARK_CONTRACT.slice(2))
    );

    console.log(`  Total recent: ${txns.length}, Our contract: ${ourTxns.length}`);

    // Count by module
    const byModule: Record<string, { success: number; failed: number }> = {};
    for (const tx of ourTxns) {
      const fn = (tx as any).payload?.function || '';
      const parts = fn.split('::');
      const module = parts.length >= 2 ? parts[1] : 'unknown';
      if (!byModule[module]) byModule[module] = { success: 0, failed: 0 };
      if ((tx as any).success) {
        byModule[module].success++;
      } else {
        byModule[module].failed++;
      }
    }

    for (const [mod, counts] of Object.entries(byModule)) {
      console.log(`    ${mod}: ${counts.success} success, ${counts.failed} failed`);
    }
  }
}

main().catch(console.error);
