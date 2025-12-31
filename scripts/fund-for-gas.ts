/**
 * Send small amounts of APT to wallets that need gas for recovery
 */

import { Aptos, AptosConfig, Network, Account, Ed25519PrivateKey } from '@aptos-labs/ts-sdk';

// Wallet with lots of APT to send from
const FUNDER_KEY = "0x6e2fca34586261b6f22a973c20024b78ddb370d87f7c974315fb97ba56716a7f";

// Wallets 9-10 need more gas for redemptions
const WALLETS_NEEDING_GAS = [
  "ed25519-priv-0xd6402b3493af005ed02b07f6cd7ffdfd37fae6d4d9c88fec6ff38e90f01b21c1", // wallet 9
  "ed25519-priv-0xd375af1a686835905e15bf82f24fcaeed4b1b5b5fabe22c80e998acb804aa295", // wallet 10
];

const GAS_AMOUNT = 50_000_000; // 0.5 APT per wallet (need lots for big redemptions)

async function main() {
  const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));

  const funder = Account.fromPrivateKey({
    privateKey: new Ed25519PrivateKey(FUNDER_KEY),
  });

  console.log('Funding wallets for gas...');
  console.log(`Funder: ${funder.accountAddress.toString()}`);

  for (const key of WALLETS_NEEDING_GAS) {
    try {
      const recipient = Account.fromPrivateKey({
        privateKey: new Ed25519PrivateKey(key),
      });

      // Check if already has enough
      let balance = 0;
      try {
        balance = await aptos.getAccountAPTAmount({ accountAddress: recipient.accountAddress });
      } catch {}

      // Force send gas even if they have some (need lots for big redemptions)
      if (balance > 50_000_000) { // 0.5 APT threshold
        console.log(`${recipient.accountAddress.toString().slice(0, 10)}... already has ${(balance/1e8).toFixed(4)} APT`);
        continue;
      }

      const tx = await aptos.transferCoinTransaction({
        sender: funder.accountAddress,
        recipient: recipient.accountAddress,
        amount: GAS_AMOUNT,
      });

      const pendingTx = await aptos.signAndSubmitTransaction({
        signer: funder,
        transaction: tx,
      });

      await aptos.waitForTransaction({ transactionHash: pendingTx.hash });
      console.log(`✓ Sent 0.01 APT to ${recipient.accountAddress.toString().slice(0, 10)}...`);

      await new Promise(r => setTimeout(r, 200));
    } catch (e: any) {
      console.log(`✗ Error: ${e.message}`);
    }
  }

  console.log('Done!');
}

main().catch(console.error);
