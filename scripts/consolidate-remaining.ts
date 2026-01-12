/**
 * Consolidate remaining APT from 10 wallets not covered by consolidate-funds.ts
 * These wallets have ~24k APT each = ~241k total
 */

import { Aptos, AptosConfig, Network, Account, Ed25519PrivateKey } from '@aptos-labs/ts-sdk';

const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));

// Deployer key (destination)
const DEPLOYER_KEY = "0x48ee96658dd826f6541f5ee501c5784e6b341f04c52c641823f4b097b61eb79b";

// Remaining wallet keys with ~24k APT each
const REMAINING_KEYS = [
  "0xC5BA2ED0F5C40EE298E844B1140B6BB31C2671B747C8E9DF4B76054C4C5A8761",
  "0x536C886483209657C9B30663B295C7CB007EB57E07931D3E41AF69067897D465",
  "0x3E9CB6207207A266F298B1B13648D707BF886766221C3253F30AF68530A79749",
  "0x4641D0FDD221B48EF4A45C8DC77D6D4F12D6848E01B7686134564A8CAE5BE637",
  "0xFB2AFF37DFED247E9CF407FFA41208A41A78877C1990ADD1F94E00FCE1A5CCAC",
  "0x9E338A7FB43F8280CCD82B2929B66F4ED1B7AA7900C40E06EAD934BC7CDEF315",
  "0x8E7D4B0196840DA3A7BA6EDEF3784E1B961263F06651B130F440F5D974920B1F",
  "0x975CF351CE096E1350C9F9E89ED5CB8D7BEAAEBF7FC235B10F1A0852355EED7A",
  "0xD945B44FCFA961B9E4F8DAA5139CF6B4CE9A1DF4838C75701EDC8A429739C097",
  "0x292A25EDBE90DCB5F682908C1E7185E1CC127FAD74EEA218167115AA5962866C",
];

async function main() {
  console.log('='.repeat(60));
  console.log('CONSOLIDATE REMAINING APT');
  console.log('='.repeat(60));

  // Get deployer account
  const deployerKey = DEPLOYER_KEY.replace('0x', '');
  const deployer = Account.fromPrivateKey({
    privateKey: new Ed25519PrivateKey(deployerKey),
  });
  const deployerAddr = deployer.accountAddress.toString();
  console.log(`\nDeployer: ${deployerAddr}`);

  let totalTransferred = 0;
  let successCount = 0;

  for (const key of REMAINING_KEYS) {
    try {
      const cleanKey = key.replace('0x', '').toLowerCase();
      const account = Account.fromPrivateKey({
        privateKey: new Ed25519PrivateKey(cleanKey),
      });
      const addr = account.accountAddress.toString();

      // Get balance
      const balance = await aptos.getAccountAPTAmount({ accountAddress: addr });
      const apt = balance / 1e8;

      if (apt < 0.1) {
        console.log(`\n${addr.slice(0, 16)}... : ${apt.toFixed(2)} APT (skip - too low)`);
        continue;
      }

      // Leave 0.1 APT for gas
      const transferAmount = balance - 10_000_000; // 0.1 APT for gas
      if (transferAmount <= 0) {
        console.log(`\n${addr.slice(0, 16)}... : ${apt.toFixed(2)} APT (skip - not enough for gas)`);
        continue;
      }

      console.log(`\n${addr.slice(0, 16)}... : ${apt.toFixed(2)} APT`);
      console.log(`  Transferring ${(transferAmount / 1e8).toFixed(2)} APT to deployer...`);

      // Transfer
      const txn = await aptos.transaction.build.simple({
        sender: account.accountAddress,
        data: {
          function: "0x1::aptos_account::transfer",
          functionArguments: [deployerAddr, transferAmount],
        },
      });

      const pendingTxn = await aptos.signAndSubmitTransaction({
        signer: account,
        transaction: txn,
      });

      await aptos.waitForTransaction({ transactionHash: pendingTxn.hash });
      console.log(`  Done! Hash: ${pendingTxn.hash.slice(0, 20)}...`);

      totalTransferred += transferAmount / 1e8;
      successCount++;

      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 500));

    } catch (err: any) {
      console.log(`  Error: ${err.message?.slice(0, 50) || err}`);
    }
  }

  // Final deployer balance
  const finalBalance = await aptos.getAccountAPTAmount({ accountAddress: deployerAddr });

  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`  Wallets consolidated: ${successCount}/${REMAINING_KEYS.length}`);
  console.log(`  Total transferred:    ${totalTransferred.toFixed(2)} APT`);
  console.log(`  Deployer balance:     ${(finalBalance / 1e8).toFixed(2)} APT`);
  console.log('='.repeat(60));
}

main().catch(console.error);
