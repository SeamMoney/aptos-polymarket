/**
 * Consolidate all APT from bot wallets into the original deployer account
 */

import { Aptos, AptosConfig, Network, Account, Ed25519PrivateKey } from '@aptos-labs/ts-sdk';

// Original deployer - consolidate all funds here
const DEPLOYER_KEY = "0x48ee96658dd826f6541f5ee501c5784e6b341f04c52c641823f4b097b61eb79b";

// All bot wallets to drain
const WALLET_KEYS = [
  "0x6e2fca34586261b6f22a973c20024b78ddb370d87f7c974315fb97ba56716a7f",
  "0xe61d22b3dc37c537a20d5b301c4d2b409b2f93cd7b2915f3518d49517c2ab6c4",
  "0x4542c2e4a39beee8202eee0cddeceea886687b21b54b8f50c17e729251fdd7f5",
  "0xcf5154af9664bbc2634fddfcce2317ed788b35de7f004ac0e24aefd68a0b10c5",
  "ed25519-priv-0xb7d1f406e48c2eddffe987f98445dd4a353e8e9d1630d878621ded084bdd77c7",
  "ed25519-priv-0xa8088ee787b847f6304807a8b09d1afc15409082ee9c8b7eda6919b0ecb86ea8",
  "ed25519-priv-0xb5305eb83498dcba61242ccc91fac35263d9b44bddaf5e7417adbaceb1cfcb36",
  "ed25519-priv-0xc27a6a8b6ed3013da99dc924b2f6af17f1448dedce91691f97d9e778c0761655",
  "ed25519-priv-0xd6402b3493af005ed02b07f6cd7ffdfd37fae6d4d9c88fec6ff38e90f01b21c1",
  "ed25519-priv-0xd375af1a686835905e15bf82f24fcaeed4b1b5b5fabe22c80e998acb804aa295",
];

const MIN_BALANCE_TO_TRANSFER = 100_000_000; // 1 APT minimum to bother transferring
const GAS_BUFFER = 50_000_000; // Keep 0.5 APT for gas

async function main() {
  const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));

  const deployer = Account.fromPrivateKey({
    privateKey: new Ed25519PrivateKey(DEPLOYER_KEY),
  });

  console.log('='.repeat(70));
  console.log('CONSOLIDATING FUNDS TO DEPLOYER');
  console.log('='.repeat(70));
  console.log(`\nDeployer: ${deployer.accountAddress.toString()}`);

  let totalTransferred = 0;

  for (let i = 0; i < WALLET_KEYS.length; i++) {
    const key = WALLET_KEYS[i];
    try {
      const account = Account.fromPrivateKey({
        privateKey: new Ed25519PrivateKey(key),
      });
      const addr = account.accountAddress.toString();

      // Get balance
      let balance = 0;
      try {
        balance = await aptos.getAccountAPTAmount({ accountAddress: account.accountAddress });
      } catch {
        continue;
      }

      if (balance < MIN_BALANCE_TO_TRANSFER) {
        continue;
      }

      const transferAmount = balance - GAS_BUFFER;
      if (transferAmount <= 0) continue;

      console.log(`\nWallet ${i + 1}: ${addr.slice(0, 10)}...`);
      console.log(`  Balance: ${(balance/1e8).toFixed(4)} APT`);
      console.log(`  Transferring: ${(transferAmount/1e8).toFixed(4)} APT`);

      try {
        const tx = await aptos.transferCoinTransaction({
          sender: account.accountAddress,
          recipient: deployer.accountAddress,
          amount: transferAmount,
        });

        const pendingTx = await aptos.signAndSubmitTransaction({
          signer: account,
          transaction: tx,
        });

        const result = await aptos.waitForTransaction({ transactionHash: pendingTx.hash });

        if (result.success) {
          console.log(`  ✓ Transferred ${(transferAmount/1e8).toFixed(2)} APT`);
          totalTransferred += transferAmount / 1e8;
        } else {
          console.log(`  ✗ Failed: ${result.vm_status}`);
        }

        await new Promise(r => setTimeout(r, 500));
      } catch (e: any) {
        console.log(`  ✗ Error: ${e.message.slice(0, 50)}`);
      }
    } catch (e: any) {
      // Skip
    }
  }

  // Check final deployer balance
  const deployerBalance = await aptos.getAccountAPTAmount({ accountAddress: deployer.accountAddress });

  console.log('\n' + '='.repeat(70));
  console.log('CONSOLIDATION COMPLETE');
  console.log('='.repeat(70));
  console.log(`Total transferred: ${totalTransferred.toFixed(2)} APT`);
  console.log(`Deployer final balance: ${(deployerBalance/1e8).toFixed(2)} APT`);
}

main().catch(console.error);
