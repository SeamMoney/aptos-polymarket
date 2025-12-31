/**
 * Sell all remaining outcome tokens back to the AMM to recover APT
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
];

async function main() {
  const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));

  console.log('='.repeat(70));
  console.log('SELLING REMAINING TOKENS');
  console.log('='.repeat(70));

  let totalSold = 0;

  for (let i = 0; i < WALLET_KEYS.length; i++) {
    const key = WALLET_KEYS[i];
    try {
      const account = Account.fromPrivateKey({
        privateKey: new Ed25519PrivateKey(key),
      });
      const addr = account.accountAddress.toString();

      // Check APT balance for gas
      let balance = 0;
      try {
        balance = await aptos.getAccountAPTAmount({ accountAddress: account.accountAddress });
      } catch {}

      // Get positions
      let positions: number[] = [];
      try {
        const posResult = await aptos.view({
          payload: {
            function: `${OLD_MODULE}::get_user_multi_positions`,
            functionArguments: [OLD_MARKET, addr],
          },
        });
        positions = (posResult[0] as string[]).map(p => Number(p));
      } catch {
        continue;
      }

      const totalTokens = positions.reduce((a, b) => a + b, 0);
      if (totalTokens < 1000000) continue; // Less than 0.01 APT worth

      console.log(`\nWallet ${i + 1}: ${addr.slice(0, 10)}...`);
      console.log(`  APT Balance: ${(balance/1e8).toFixed(4)}`);
      console.log(`  Positions: ${positions.map(p => (p/1e8).toFixed(2)).join(', ')}`);

      if (balance < 500000) { // Less than 0.005 APT for gas
        console.log(`  Skipping - needs gas`);
        continue;
      }

      // Sell each outcome with tokens
      for (let outcomeIndex = 0; outcomeIndex < positions.length; outcomeIndex++) {
        const tokensHeld = positions[outcomeIndex];
        if (tokensHeld < 1000000) continue; // Less than 0.01 worth

        // Sell 95% to leave buffer
        const tokensToSell = Math.floor(tokensHeld * 0.95);

        try {
          const tx = await aptos.transaction.build.simple({
            sender: account.accountAddress,
            data: {
              function: `${OLD_MODULE}::sell_outcome`,
              functionArguments: [OLD_MARKET, outcomeIndex, tokensToSell, 0], // 0 min out (accept any)
            },
          });

          const pendingTx = await aptos.signAndSubmitTransaction({
            signer: account,
            transaction: tx,
          });

          const result = await aptos.waitForTransaction({ transactionHash: pendingTx.hash });

          if (result.success) {
            const sold = tokensToSell / 1e8;
            console.log(`  ✓ Sold ${sold.toFixed(2)} tokens of outcome ${outcomeIndex}`);
            totalSold += sold;
          } else {
            console.log(`  ✗ Failed outcome ${outcomeIndex}: ${result.vm_status}`);
          }

          await new Promise(r => setTimeout(r, 300));
        } catch (e: any) {
          console.log(`  ✗ Error outcome ${outcomeIndex}: ${e.message.slice(0, 50)}`);
        }
      }
    } catch (e: any) {
      // Skip
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log(`TOTAL TOKENS SOLD: ${totalSold.toFixed(2)}`);
  console.log('='.repeat(70));
}

main().catch(console.error);
