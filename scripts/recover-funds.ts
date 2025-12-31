/**
 * Recover funds from old market by redeeming complete sets
 * Complete set = 1 of each outcome token = redeemable for 1 APT
 */

import { Aptos, AptosConfig, Network, Account, Ed25519PrivateKey } from '@aptos-labs/ts-sdk';

const OLD_CONTRACT = '0x64a81cb9cbd14d45b87bb32ef73107a44f00069b6a96e70d75369fb7e3da5e68';
const OLD_MARKET = '0x43709b978ab28e43636944edcbad91efcffbf4ec0de026ae0fcf05e0f425f912';
const OLD_MODULE = `${OLD_CONTRACT}::multi_outcome_market`;

// All wallet private keys
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
  "ed25519-priv-0xf867c21b74502fa0104d421c294df0df23fd9ae3fc6882a33bb6c71a4fec90d3",
  "ed25519-priv-0x58045d9ecc12e6fbe3d6e9df215bb4e7f4c81231a09da5ba49afb674b2b58b05",
  "ed25519-priv-0xb63580da8bd96b068b4c1b1908aa2b9b93464afae0e56fec642c7bccd743c73f",
  "ed25519-priv-0x875277477fe8ea624ef1d05f5f62b247bfba5eaf02fac1fb256c4fc2c0981765",
  "ed25519-priv-0x27c178ae51e80be6be562267032c28c12ec6dcd075367361716e110c21183472",
  "ed25519-priv-0x0daa5cbc98056deab6d77577afcdc99f01a9a60a3b1ad72731049b3e0163bdb3",
  "ed25519-priv-0xa5cf70d36ca2579d99bd5ac0dbc94ca6eab7553d04db4f804141c441a19c9b1c",
  "ed25519-priv-0x314c74ce712385f6eb7f7c3eceb3edac35e7a882d20f3f221a12028d905679da",
  "ed25519-priv-0xca837a1738f1d9874f7988d3ff7f4a1e634bc8747d70f49fa053d0b126f8f5d9",
  "ed25519-priv-0xa7e23d7901bed3bcaff4061248edb56ce4209010e8fc9024f6d3cb3beed66db5",
];

async function main() {
  const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));

  console.log('='.repeat(70));
  console.log('RECOVERING FUNDS FROM OLD MARKET');
  console.log('='.repeat(70));

  let totalRecovered = 0;

  for (let i = 0; i < WALLET_KEYS.length; i++) {
    const key = WALLET_KEYS[i];
    try {
      const account = Account.fromPrivateKey({
        privateKey: new Ed25519PrivateKey(key),
      });
      const addr = account.accountAddress.toString();

      // Get positions
      const posResult = await aptos.view({
        payload: {
          function: `${OLD_MODULE}::get_user_multi_positions`,
          functionArguments: [OLD_MARKET, addr],
        },
      });
      const positions = (posResult[0] as string[]).map(p => Number(p));

      // Find minimum across all outcomes (complete sets we can redeem)
      const minPosition = Math.min(...positions);

      if (minPosition < 1000000) { // Less than 0.01 APT worth
        continue;
      }

      // Calculate how many complete sets we can redeem (leave some buffer)
      const setsToRedeem = Math.floor(minPosition * 0.99); // 99% to leave buffer for rounding
      const aptRecoverable = setsToRedeem / 1e8;

      console.log(`\nWallet ${i + 1}: ${addr.slice(0, 10)}...`);
      console.log(`  Positions: ${positions.map(p => (p/1e8).toFixed(2)).join(', ')}`);
      console.log(`  Min position: ${(minPosition/1e8).toFixed(2)}`);
      console.log(`  Complete sets to redeem: ${aptRecoverable.toFixed(2)} APT`);

      if (setsToRedeem > 0) {
        try {
          const tx = await aptos.transaction.build.simple({
            sender: account.accountAddress,
            data: {
              function: `${OLD_MODULE}::redeem_complete_set`,
              functionArguments: [OLD_MARKET, setsToRedeem],
            },
          });

          const pendingTx = await aptos.signAndSubmitTransaction({
            signer: account,
            transaction: tx,
          });

          const result = await aptos.waitForTransaction({ transactionHash: pendingTx.hash });

          if (result.success) {
            console.log(`  ✓ Redeemed ${aptRecoverable.toFixed(2)} APT`);
            totalRecovered += aptRecoverable;
          } else {
            console.log(`  ✗ Failed: ${result.vm_status}`);
          }
        } catch (e: any) {
          console.log(`  ✗ Error: ${e.message}`);
        }
      }

      // Small delay to avoid rate limits
      await new Promise(r => setTimeout(r, 500));
    } catch (e: any) {
      // Skip errors
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log(`TOTAL RECOVERED: ${totalRecovered.toFixed(2)} APT`);
  console.log('='.repeat(70));
}

main().catch(console.error);
