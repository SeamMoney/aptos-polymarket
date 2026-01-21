/**
 * Demo Faucet - Fund any wallet for the demo
 * This acts as a testnet faucet using the deployer's APT
 *
 * Usage:
 *   npx tsx scripts/demo-faucet.ts <wallet_address> [amount_apt]
 *   npx tsx scripts/demo-faucet.ts 0x123...abc 100
 */

import { Aptos, AptosConfig, Network, Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";

const DEPLOYER_KEY = process.env.CONTRACT_DEPLOYER_KEY || "0x466C93219D56FC91BBFDD22B127FC9CB717FA9752CB4ED91DF3A1D7B33307BD2";
const DEFAULT_AMOUNT = 100; // Default 100 APT per fund

const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
Demo Faucet - Fund wallets for the demo

Usage:
  npx tsx scripts/demo-faucet.ts <wallet_address> [amount_apt]

Examples:
  npx tsx scripts/demo-faucet.ts 0x123...abc          # Fund 100 APT (default)
  npx tsx scripts/demo-faucet.ts 0x123...abc 50      # Fund 50 APT
  npx tsx scripts/demo-faucet.ts 0x123...abc 500     # Fund 500 APT

Environment:
  CONTRACT_DEPLOYER_KEY - Override the faucet source key
`);
    process.exit(0);
  }

  const recipientAddress = args[0];
  const amount = parseFloat(args[1] || String(DEFAULT_AMOUNT));

  if (!recipientAddress.startsWith('0x') || recipientAddress.length < 10) {
    console.error("Invalid address format. Must be a hex address starting with 0x");
    process.exit(1);
  }

  if (isNaN(amount) || amount <= 0) {
    console.error("Invalid amount. Must be a positive number");
    process.exit(1);
  }

  const deployer = Account.fromPrivateKey({
    privateKey: new Ed25519PrivateKey(DEPLOYER_KEY),
  });

  console.log("=".repeat(60));
  console.log("  DEMO FAUCET");
  console.log("=".repeat(60));
  console.log(`From: ${deployer.accountAddress.toString().slice(0, 12)}...`);
  console.log(`To: ${recipientAddress}`);
  console.log(`Amount: ${amount} APT`);
  console.log("");

  // Check deployer balance
  const deployerBalance = await aptos.getAccountAPTAmount({
    accountAddress: deployer.accountAddress,
  });
  console.log(`Faucet balance: ${(deployerBalance / 100_000_000).toFixed(2)} APT`);

  if (deployerBalance < amount * 100_000_000) {
    console.error(`\nInsufficient faucet balance!`);
    process.exit(1);
  }

  // Check recipient exists
  let recipientExists = true;
  try {
    await aptos.getAccountInfo({ accountAddress: recipientAddress });
  } catch {
    recipientExists = false;
    console.log(`\nRecipient account doesn't exist yet. Will create on first transfer.`);
  }

  // Transfer APT
  const amountOctas = Math.floor(amount * 100_000_000);
  console.log(`\nTransferring ${amount} APT...`);

  try {
    const txn = await aptos.transaction.build.simple({
      sender: deployer.accountAddress,
      data: {
        function: "0x1::aptos_account::transfer",
        functionArguments: [recipientAddress, amountOctas],
      },
    });

    const pending = await aptos.signAndSubmitTransaction({
      signer: deployer,
      transaction: txn,
    });

    const result = await aptos.waitForTransaction({
      transactionHash: pending.hash,
    });

    if (result.success) {
      console.log(`\n SUCCESS!`);
      console.log(`TX: ${pending.hash}`);
      console.log(`Explorer: https://explorer.aptoslabs.com/txn/${pending.hash}?network=testnet`);

      // Check new balance
      const newBalance = await aptos.getAccountAPTAmount({
        accountAddress: recipientAddress,
      });
      console.log(`\nRecipient new balance: ${(newBalance / 100_000_000).toFixed(2)} APT`);
    } else {
      console.log(`\n FAILED: ${result.vm_status}`);
    }
  } catch (e: any) {
    console.error(`\nError: ${e.message}`);
  }
}

main().catch(console.error);
