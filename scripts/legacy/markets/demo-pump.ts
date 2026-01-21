#!/usr/bin/env npx tsx
/**
 * Demo pump script - trades every 5 seconds for screen recording
 * Run this while viewing the market page to see chart updates
 */

import { Aptos, AptosConfig, Network, Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";

const CONTRACT = "0x1bd17a9cb5a55a414de956128e332f7744ef260bbdc49303a08105c986adbda3";
const MARKET = "0x1f230e7720655ee87e08b9c434989d7ad82f21f9eea4f083c7dd74861f23d939";

const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));
const privateKey = new Ed25519PrivateKey("0x6e2fca34586261b6f22a973c20024b78ddb370d87f7c974315fb97ba56716a7f");
const account = Account.fromPrivateKey({ privateKey });

async function getPrices() {
  const result = await aptos.view({
    payload: {
      function: `${CONTRACT}::multi_outcome_market::get_all_prices`,
      functionArguments: [MARKET],
    },
  });
  const prices = (result[0] as string[]).map(p => parseInt(p));
  const sum = prices.reduce((a, b) => a + b, 0);
  return { yes: prices[0] / sum * 100, no: prices[1] / sum * 100 };
}

async function buyYes(amount: number) {
  const tx = await aptos.transaction.build.simple({
    sender: account.accountAddress,
    data: {
      function: `${CONTRACT}::multi_outcome_market::buy_outcome`,
      functionArguments: [MARKET, 0, Math.floor(amount * 1e8), 0],
    },
  });
  const committed = await aptos.signAndSubmitTransaction({ signer: account, transaction: tx });
  await aptos.waitForTransaction({ transactionHash: committed.hash });
  return committed.hash;
}

async function main() {
  const startPrices = await getPrices();

  console.log("\n" + "=".repeat(50));
  console.log("  DEMO PUMP - BTC $100K Market");
  console.log("  Trading every 5 seconds for 2 minutes");
  console.log("=".repeat(50));
  console.log(`\n  Starting: Yes ${startPrices.yes.toFixed(1)}% | No ${startPrices.no.toFixed(1)}%\n`);
  console.log("  START SCREEN RECORDING NOW!");
  console.log("  Trades begin in 5 seconds...\n");

  await new Promise(r => setTimeout(r, 5000));

  const numTrades = 24; // 2 minutes at 5 sec intervals
  const amounts = [80, 100, 120, 90, 110, 130, 85, 95, 115, 125, 100, 140];

  for (let i = 0; i < numTrades; i++) {
    const amount = amounts[i % amounts.length];
    const time = new Date().toLocaleTimeString();

    try {
      await buyYes(amount);
      const prices = await getPrices();
      const change = prices.yes - startPrices.yes;
      console.log(`  [${time}] Trade ${i + 1}/${numTrades}: +${amount} USD1 -> Yes ${prices.yes.toFixed(1)}% (${change > 0 ? '+' : ''}${change.toFixed(1)}%)`);
    } catch (e: any) {
      console.log(`  [${time}] Trade ${i + 1} failed: ${e.message?.slice(0, 30)}`);
    }

    await new Promise(r => setTimeout(r, 5000));
  }

  const endPrices = await getPrices();
  console.log("\n" + "=".repeat(50));
  console.log("  DEMO COMPLETE");
  console.log(`  Yes: ${startPrices.yes.toFixed(1)}% -> ${endPrices.yes.toFixed(1)}%`);
  console.log(`  Total change: ${(endPrices.yes - startPrices.yes) > 0 ? '+' : ''}${(endPrices.yes - startPrices.yes).toFixed(1)}%`);
  console.log("=".repeat(50) + "\n");
}

main().catch(console.error);
