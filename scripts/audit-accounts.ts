/**
 * Account Audit Script
 * Derives addresses from all private keys found in scripts and checks balances
 */

import { Account, Ed25519PrivateKey, Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';

const QUICKNODE_RPC = 'https://polished-evocative-borough.aptos-testnet.quiknode.pro/a0b08bae2dc34e4a8774d91414948d02a5ce2975/v1';
const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET, fullnode: QUICKNODE_RPC }));

// All unique private keys found in scripts
const ALL_KEYS = [
  '0x0daa5cbc98056deab6d77577afcdc99f01a9a60a3b1ad72731049b3e0163bdb3',
  '0x232111da47ca5b2734ad971b7de318cac066b7fc18c53a6c2c36c23398e1f7d0',
  '0x27c178ae51e80be6be562267032c28c12ec6dcd075367361716e110c21183472',
  '0x292a25edbe90dcb5f682908c1e7185e1cc127fad74eea218167115aa5962866c',
  '0x2b92ec3bfff77589b282d48015f1eabf321a7304e9fc63b6e1c9f6d5e8cfccd2',
  '0x30cff4bcb9f626c23737ca9f4452d6145716c5b3cbee4b09cfd5e95d67d3d57a',
  '0x314c74ce712385f6eb7f7c3eceb3edac35e7a882d20f3f221a12028d905679da',
  '0x3e9cb6207207a266f298b1b13648d707bf886766221c3253f30af68530a79749',
  '0x3f13249e31a1fbdb886741f7945cccc40307311abc08ba188894bd1a050e19b4',
  '0x4542c2e4a39beee8202eee0cddeceea886687b21b54b8f50c17e729251fdd7f5',
  '0x4641d0fdd221b48ef4a45c8dc77d6d4f12d6848e01b7686134564a8cae5be637',
  '0x466c93219d56fc91bbfdd22b127fc9cb717fa9752cb4ed91df3a1d7b33307bd2',
  '0x48ee96658dd826f6541f5ee501c5784e6b341f04c52c641823f4b097b61eb79b',
  '0x536c886483209657c9b30663b295c7cb007eb57e07931d3e41af69067897d465',
  '0x58045d9ecc12e6fbe3d6e9df215bb4e7f4c81231a09da5ba49afb674b2b58b05',
  '0x6b2136b0fd86d25c98994c4b4177550547e0d5002c934347fe23397c8a9f7102',
  '0x6e2fca34586261b6f22a973c20024b78ddb370d87f7c974315fb97ba56716a7f',
  '0x71e01d192b4988ce655bba295cf86062706eabe5af85b506e33055682cd02e8c',
  '0x875277477fe8ea624ef1d05f5f62b247bfba5eaf02fac1fb256c4fc2c0981765',
  '0x8e7d4b0196840da3a7ba6edef3784e1b961263f06651b130f440f5d974920b1f',
  '0x975cf351ce096e1350c9f9e89ed5cb8d7beaaebf7fc235b10f1a0852355eed7a',
  '0x9e338a7fb43f8280ccd82b2929b66f4ed1b7aa7900c40e06ead934bc7cdef315',
  '0x9ec8c2987a5d0598969bb48f3acee94dd6bd5570420cbe5993d65e48500380c4',
  '0xa5cf70d36ca2579d99bd5ac0dbc94ca6eab7553d04db4f804141c441a19c9b1c',
  '0xa7e23d7901bed3bcaff4061248edb56ce4209010e8fc9024f6d3cb3beed66db5',
  '0xa8088ee787b847f6304807a8b09d1afc15409082ee9c8b7eda6919b0ecb86ea8',
  '0xb5305eb83498dcba61242ccc91fac35263d9b44bddaf5e7417adbaceb1cfcb36',
  '0xb63580da8bd96b068b4c1b1908aa2b9b93464afae0e56fec642c7bccd743c73f',
  '0xb7d1f406e48c2eddffe987f98445dd4a353e8e9d1630d878621ded084bdd77c7',
  '0xc27a6a8b6ed3013da99dc924b2f6af17f1448dedce91691f97d9e778c0761655',
  '0xc5ba2ed0f5c40ee298e844b1140b6bb31c2671b747c8e9df4b76054c4c5a8761',
  '0xca837a1738f1d9874f7988d3ff7f4a1e634bc8747d70f49fa053d0b126f8f5d9',
  '0xcf5154af9664bbc2634fddfcce2317ed788b35de7f004ac0e24aefd68a0b10c5',
  '0xd375af1a686835905e15bf82f24fcaeed4b1b5b5fabe22c80e998acb804aa295',
  '0xd6402b3493af005ed02b07f6cd7ffdfd37fae6d4d9c88fec6ff38e90f01b21c1',
  '0xd945b44fcfa961b9e4f8daa5139cf6b4ce9a1df4838c75701edc8a429739c097',
  '0xe61d22b3dc37c537a20d5b301c4d2b409b2f93cd7b2915f3518d49517c2ab6c4',
  '0xf867c21b74502fa0104d421c294df0df23fd9ae3fc6882a33bb6c71a4fec90d3',
  '0xfb2aff37dfed247e9cf407ffa41208a41a78877c1990add1f94e00fce1a5ccac',
];

// Keys currently in orchestrator.sh (25 accounts)
const ORCHESTRATOR_KEYS = new Set([
  // Worker 1 (9)
  '0x6e2fca34586261b6f22a973c20024b78ddb370d87f7c974315fb97ba56716a7f',
  '0xe61d22b3dc37c537a20d5b301c4d2b409b2f93cd7b2915f3518d49517c2ab6c4',
  '0x4542c2e4a39beee8202eee0cddeceea886687b21b54b8f50c17e729251fdd7f5',
  '0xcf5154af9664bbc2634fddfcce2317ed788b35de7f004ac0e24aefd68a0b10c5',
  '0xb7d1f406e48c2eddffe987f98445dd4a353e8e9d1630d878621ded084bdd77c7',
  '0xa8088ee787b847f6304807a8b09d1afc15409082ee9c8b7eda6919b0ecb86ea8',
  '0xb5305eb83498dcba61242ccc91fac35263d9b44bddaf5e7417adbaceb1cfcb36',
  '0x232111da47ca5b2734ad971b7de318cac066b7fc18c53a6c2c36c23398e1f7d0',
  '0x30cff4bcb9f626c23737ca9f4452d6145716c5b3cbee4b09cfd5e95d67d3d57a',
  // Worker 2 (8)
  '0xc27a6a8b6ed3013da99dc924b2f6af17f1448dedce91691f97d9e778c0761655',
  '0xd6402b3493af005ed02b07f6cd7ffdfd37fae6d4d9c88fec6ff38e90f01b21c1',
  '0xd375af1a686835905e15bf82f24fcaeed4b1b5b5fabe22c80e998acb804aa295',
  '0xc5ba2ed0f5c40ee298e844b1140b6bb31c2671b747c8e9df4b76054c4c5a8761',
  '0x536c886483209657c9b30663b295c7cb007eb57e07931d3e41af69067897d465',
  '0x3e9cb6207207a266f298b1b13648d707bf886766221c3253f30af68530a79749',
  '0x4641d0fdd221b48ef4a45c8dc77d6d4f12d6848e01b7686134564a8cae5be637',
  '0xfb2aff37dfed247e9cf407ffa41208a41a78877c1990add1f94e00fce1a5ccac',
  // Worker 3 (8)
  '0x9e338a7fb43f8280ccd82b2929b66f4ed1b7aa7900c40e06ead934bc7cdef315',
  '0x8e7d4b0196840da3a7ba6edef3784e1b961263f06651b130f440f5d974920b1f',
  '0x975cf351ce096e1350c9f9e89ed5cb8d7beaaebf7fc235b10f1a0852355eed7a',
  '0xd945b44fcfa961b9e4f8daa5139cf6b4ce9a1df4838c75701edc8a429739c097',
  '0x292a25edbe90dcb5f682908c1e7185e1cc127fad74eea218167115aa5962866c',
  '0x2b92ec3bfff77589b282d48015f1eabf321a7304e9fc63b6e1c9f6d5e8cfccd2',
  '0x6b2136b0fd86d25c98994c4b4177550547e0d5002c934347fe23397c8a9f7102',
  '0x71e01d192b4988ce655bba295cf86062706eabe5af85b506e33055682cd02e8c',
]);

interface AccountInfo {
  keyIndex: number;
  privateKey: string;
  address: string;
  balance: number;
  inOrchestrator: boolean;
}

async function main() {
  console.log('='.repeat(80));
  console.log('FULL ACCOUNT AUDIT - All Private Keys Found in Codebase');
  console.log('='.repeat(80));
  console.log('');

  const accounts: AccountInfo[] = [];
  let totalBalance = 0;
  let orchestratorBalance = 0;
  let unusedBalance = 0;

  console.log('Checking balances for', ALL_KEYS.length, 'accounts...\n');

  for (let i = 0; i < ALL_KEYS.length; i++) {
    const key = ALL_KEYS[i];
    try {
      const privateKey = new Ed25519PrivateKey(key);
      const account = Account.fromPrivateKey({ privateKey });
      const address = account.accountAddress.toString();

      let balance = 0;
      try {
        balance = await aptos.getAccountAPTAmount({ accountAddress: account.accountAddress });
        balance = balance / 100_000_000; // Convert to APT
      } catch {
        // Account might not exist on chain
      }

      const inOrchestrator = ORCHESTRATOR_KEYS.has(key);

      accounts.push({
        keyIndex: i + 1,
        privateKey: key,
        address,
        balance,
        inOrchestrator,
      });

      totalBalance += balance;
      if (inOrchestrator) {
        orchestratorBalance += balance;
      } else {
        unusedBalance += balance;
      }

      // Progress indicator
      const status = inOrchestrator ? '✓' : '○';
      const balanceStr = balance > 0 ? `${balance.toFixed(2)} APT` : '0 APT';
      console.log(`[${(i + 1).toString().padStart(2)}] ${status} ${address.slice(0, 16)}... ${balanceStr.padStart(15)}`);

      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 100));
    } catch (e) {
      console.log(`[${(i + 1).toString().padStart(2)}] ✗ Invalid key: ${key.slice(0, 20)}...`);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));

  const inOrchCount = accounts.filter(a => a.inOrchestrator).length;
  const notInOrchCount = accounts.filter(a => !a.inOrchestrator).length;
  const fundedCount = accounts.filter(a => a.balance > 0).length;
  const fundedInOrch = accounts.filter(a => a.inOrchestrator && a.balance > 0).length;
  const fundedNotInOrch = accounts.filter(a => !a.inOrchestrator && a.balance > 0).length;

  console.log(`\nTotal Accounts Found:     ${accounts.length}`);
  console.log(`  - In Orchestrator:      ${inOrchCount} (used for demo)`);
  console.log(`  - Not in Orchestrator:  ${notInOrchCount} (unused)`);
  console.log('');
  console.log(`Funded Accounts:          ${fundedCount}`);
  console.log(`  - In Orchestrator:      ${fundedInOrch}`);
  console.log(`  - Not in Orchestrator:  ${fundedNotInOrch}`);
  console.log('');
  console.log(`Total Balance:            ${totalBalance.toFixed(2)} APT`);
  console.log(`  - Orchestrator Balance: ${orchestratorBalance.toFixed(2)} APT`);
  console.log(`  - Unused Balance:       ${unusedBalance.toFixed(2)} APT`);

  // List accounts NOT in orchestrator that have balance
  const unusedWithBalance = accounts.filter(a => !a.inOrchestrator && a.balance > 0);
  if (unusedWithBalance.length > 0) {
    console.log('\n' + '='.repeat(80));
    console.log('UNUSED ACCOUNTS WITH BALANCE (not in orchestrator.sh)');
    console.log('='.repeat(80));
    for (const acc of unusedWithBalance) {
      console.log(`  ${acc.address}`);
      console.log(`    Key: ${acc.privateKey}`);
      console.log(`    Balance: ${acc.balance.toFixed(2)} APT`);
      console.log('');
    }
  }

  // List accounts IN orchestrator
  console.log('\n' + '='.repeat(80));
  console.log('ORCHESTRATOR ACCOUNTS (25 accounts across 3 workers)');
  console.log('='.repeat(80));

  const orchAccounts = accounts.filter(a => a.inOrchestrator).sort((a, b) => b.balance - a.balance);
  let w1 = 0, w2 = 0, w3 = 0;
  for (const acc of orchAccounts) {
    const worker = acc.keyIndex <= 9 ? 'W1' : acc.keyIndex <= 17 ? 'W2' : 'W3';
    console.log(`  [${worker}] ${acc.address.slice(0, 20)}... ${acc.balance.toFixed(2).padStart(12)} APT`);
  }
}

main().catch(console.error);
