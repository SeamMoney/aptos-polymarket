/**
 * APT Distribution Script
 * Distributes APT evenly across all 25 orchestrator accounts for optimal TPS
 *
 * Usage: npx tsx scripts/distribute-apt.ts
 */

import { Account, Ed25519PrivateKey, Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';

const QUICKNODE_RPC = 'https://polished-evocative-borough.aptos-testnet.quiknode.pro/a0b08bae2dc34e4a8774d91414948d02a5ce2975/v1';
const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET, fullnode: QUICKNODE_RPC }));

// Bank account (where you sent the 500K APT)
const BANK_KEY = '0xb5305eb83498dcba61242ccc91fac35263d9b44bddaf5e7417adbaceb1cfcb36';

// All 25 orchestrator accounts
const ORCHESTRATOR_KEYS = [
  // Worker 1 (9 accounts)
  '0x6e2fca34586261b6f22a973c20024b78ddb370d87f7c974315fb97ba56716a7f',
  '0xe61d22b3dc37c537a20d5b301c4d2b409b2f93cd7b2915f3518d49517c2ab6c4',
  '0x4542c2e4a39beee8202eee0cddeceea886687b21b54b8f50c17e729251fdd7f5',
  '0xcf5154af9664bbc2634fddfcce2317ed788b35de7f004ac0e24aefd68a0b10c5',
  '0xb7d1f406e48c2eddffe987f98445dd4a353e8e9d1630d878621ded084bdd77c7',
  '0xa8088ee787b847f6304807a8b09d1afc15409082ee9c8b7eda6919b0ecb86ea8',
  '0xb5305eb83498dcba61242ccc91fac35263d9b44bddaf5e7417adbaceb1cfcb36', // BANK
  '0x232111da47ca5b2734ad971b7de318cac066b7fc18c53a6c2c36c23398e1f7d0',
  '0x30cff4bcb9f626c23737ca9f4452d6145716c5b3cbee4b09cfd5e95d67d3d57a',
  // Worker 2 (8 accounts)
  '0xc27a6a8b6ed3013da99dc924b2f6af17f1448dedce91691f97d9e778c0761655',
  '0xd6402b3493af005ed02b07f6cd7ffdfd37fae6d4d9c88fec6ff38e90f01b21c1',
  '0xd375af1a686835905e15bf82f24fcaeed4b1b5b5fabe22c80e998acb804aa295',
  '0xc5ba2ed0f5c40ee298e844b1140b6bb31c2671b747c8e9df4b76054c4c5a8761',
  '0x536c886483209657c9b30663b295c7cb007eb57e07931d3e41af69067897d465',
  '0x3e9cb6207207a266f298b1b13648d707bf886766221c3253f30af68530a79749',
  '0x4641d0fdd221b48ef4a45c8dc77d6d4f12d6848e01b7686134564a8cae5be637',
  '0xfb2aff37dfed247e9cf407ffa41208a41a78877c1990add1f94e00fce1a5ccac',
  // Worker 3 (8 accounts)
  '0x9e338a7fb43f8280ccd82b2929b66f4ed1b7aa7900c40e06ead934bc7cdef315',
  '0x8e7d4b0196840da3a7ba6edef3784e1b961263f06651b130f440f5d974920b1f',
  '0x975cf351ce096e1350c9f9e89ed5cb8d7beaaebf7fc235b10f1a0852355eed7a',
  '0xd945b44fcfa961b9e4f8daa5139cf6b4ce9a1df4838c75701edc8a429739c097',
  '0x292a25edbe90dcb5f682908c1e7185e1cc127fad74eea218167115aa5962866c',
  '0x2b92ec3bfff77589b282d48015f1eabf321a7304e9fc63b6e1c9f6d5e8cfccd2',
  '0x6b2136b0fd86d25c98994c4b4177550547e0d5002c934347fe23397c8a9f7102',
  '0x71e01d192b4988ce655bba295cf86062706eabe5af85b506e33055682cd02e8c',
];

const OCTAS_PER_APT = 100_000_000;

interface AccountBalance {
  address: string;
  balance: number;
  key: string;
  worker: number;
}

async function getBalances(): Promise<AccountBalance[]> {
  const accounts: AccountBalance[] = [];

  for (let i = 0; i < ORCHESTRATOR_KEYS.length; i++) {
    const key = ORCHESTRATOR_KEYS[i];
    const privateKey = new Ed25519PrivateKey(key);
    const account = Account.fromPrivateKey({ privateKey });
    const address = account.accountAddress.toString();

    let balance = 0;
    try {
      balance = await aptos.getAccountAPTAmount({ accountAddress: account.accountAddress });
      balance = balance / OCTAS_PER_APT;
    } catch {
      // Account might not exist
    }

    const worker = i < 9 ? 1 : i < 17 ? 2 : 3;
    accounts.push({ address, balance, key, worker });

    // Rate limit
    await new Promise(r => setTimeout(r, 50));
  }

  return accounts;
}

async function distribute() {
  console.log('='.repeat(70));
  console.log('APT DISTRIBUTION SCRIPT');
  console.log('='.repeat(70));
  console.log('');

  // Get current balances
  console.log('Fetching current balances...\n');
  const accounts = await getBalances();

  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);
  const targetPerAccount = totalBalance / accounts.length;

  console.log(`Total APT across ${accounts.length} accounts: ${totalBalance.toFixed(2)} APT`);
  console.log(`Target per account: ${targetPerAccount.toFixed(2)} APT`);
  console.log('');

  // Find accounts that need funding vs accounts with excess
  const needsFunding: AccountBalance[] = [];
  const hasExcess: AccountBalance[] = [];

  for (const acc of accounts) {
    const diff = acc.balance - targetPerAccount;
    if (diff < -10) { // Needs more than 10 APT
      needsFunding.push(acc);
    } else if (diff > 10) { // Has excess of more than 10 APT
      hasExcess.push(acc);
    }
  }

  console.log(`Accounts needing funding: ${needsFunding.length}`);
  console.log(`Accounts with excess: ${hasExcess.length}`);
  console.log('');

  if (needsFunding.length === 0) {
    console.log('✓ All accounts are balanced! No distribution needed.');
    return;
  }

  // Show distribution plan
  console.log('='.repeat(70));
  console.log('DISTRIBUTION PLAN');
  console.log('='.repeat(70));

  const transfers: { from: AccountBalance; to: AccountBalance; amount: number }[] = [];

  // Sort by excess (descending) and deficit (ascending)
  hasExcess.sort((a, b) => b.balance - a.balance);
  needsFunding.sort((a, b) => a.balance - b.balance);

  let excessIdx = 0;

  for (const recipient of needsFunding) {
    const needed = targetPerAccount - recipient.balance;
    let remaining = needed;

    while (remaining > 10 && excessIdx < hasExcess.length) {
      const donor = hasExcess[excessIdx];
      const donorExcess = donor.balance - targetPerAccount;

      if (donorExcess <= 10) {
        excessIdx++;
        continue;
      }

      const transferAmount = Math.min(remaining, donorExcess - 10); // Keep 10 APT buffer
      if (transferAmount > 10) {
        transfers.push({ from: donor, to: recipient, amount: transferAmount });
        donor.balance -= transferAmount;
        recipient.balance += transferAmount;
        remaining -= transferAmount;
      }

      if (donor.balance - targetPerAccount <= 10) {
        excessIdx++;
      }
    }
  }

  console.log(`\nPlanned transfers: ${transfers.length}\n`);

  for (const t of transfers) {
    console.log(`  W${t.from.worker} ${t.from.address.slice(0, 10)}... → W${t.to.worker} ${t.to.address.slice(0, 10)}...  ${t.amount.toFixed(2)} APT`);
  }

  // Execute transfers
  const dryRun = process.argv.includes('--dry-run');

  if (dryRun) {
    console.log('\n⚠️  DRY RUN - No transfers executed');
    console.log('   Run without --dry-run to execute transfers');
    return;
  }

  console.log('\n' + '='.repeat(70));
  console.log('EXECUTING TRANSFERS');
  console.log('='.repeat(70));

  let successCount = 0;
  let failCount = 0;

  for (const t of transfers) {
    try {
      const privateKey = new Ed25519PrivateKey(t.from.key);
      const sender = Account.fromPrivateKey({ privateKey });

      const amountOctas = Math.floor(t.amount * OCTAS_PER_APT);

      const txn = await aptos.transferCoinTransaction({
        sender: sender.accountAddress,
        recipient: t.to.address,
        amount: amountOctas,
      });

      const pendingTxn = await aptos.signAndSubmitTransaction({
        signer: sender,
        transaction: txn,
      });

      await aptos.waitForTransaction({ transactionHash: pendingTxn.hash });

      console.log(`✓ ${t.from.address.slice(0, 10)}... → ${t.to.address.slice(0, 10)}... ${t.amount.toFixed(2)} APT`);
      successCount++;

      // Rate limit
      await new Promise(r => setTimeout(r, 200));
    } catch (e) {
      console.log(`✗ ${t.from.address.slice(0, 10)}... → ${t.to.address.slice(0, 10)}... FAILED: ${e}`);
      failCount++;
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('COMPLETE');
  console.log('='.repeat(70));
  console.log(`Successful: ${successCount}`);
  console.log(`Failed: ${failCount}`);

  // Show final balances
  console.log('\nFetching final balances...\n');
  const finalAccounts = await getBalances();

  let w1Total = 0, w2Total = 0, w3Total = 0;
  for (const acc of finalAccounts) {
    if (acc.worker === 1) w1Total += acc.balance;
    else if (acc.worker === 2) w2Total += acc.balance;
    else w3Total += acc.balance;
  }

  console.log('Worker Totals:');
  console.log(`  Worker 1 (9 accounts): ${w1Total.toFixed(2)} APT`);
  console.log(`  Worker 2 (8 accounts): ${w2Total.toFixed(2)} APT`);
  console.log(`  Worker 3 (8 accounts): ${w3Total.toFixed(2)} APT`);
  console.log(`  TOTAL: ${(w1Total + w2Total + w3Total).toFixed(2)} APT`);
}

distribute().catch(console.error);
