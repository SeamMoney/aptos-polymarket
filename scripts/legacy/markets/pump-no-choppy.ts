#!/usr/bin/env npx tsx
/**
 * Pump NO to ~90% with choppy trading (some YES buys mixed in)
 */

import { Aptos, AptosConfig, Network, Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";

const CONTRACT = "0x1bd17a9cb5a55a414de956128e332f7744ef260bbdc49303a08105c986adbda3";
const MARKET = "0x1f230e7720655ee87e08b9c434989d7ad82f21f9eea4f083c7dd74861f23d939";
const USD1 = "0xa89bf8c3480600cf0b30914b3370fed8ebfd7a638df6a6edee0e45b2a1dfff82";

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

async function mintUSD1(amount: number) {
  const tx = await aptos.transaction.build.simple({
    sender: account.accountAddress,
    data: {
      function: `${CONTRACT}::usd1::mint`,
      functionArguments: [account.accountAddress.toString(), Math.floor(amount * 1e8)],
    },
  });
  const committed = await aptos.signAndSubmitTransaction({ signer: account, transaction: tx });
  await aptos.waitForTransaction({ transactionHash: committed.hash });
}

async function buyOutcome(outcomeIndex: number, amount: number) {
  const tx = await aptos.transaction.build.simple({
    sender: account.accountAddress,
    data: {
      function: `${CONTRACT}::multi_outcome_market::buy_outcome`,
      functionArguments: [MARKET, outcomeIndex, Math.floor(amount * 1e8), 0],
    },
  });
  const committed = await aptos.signAndSubmitTransaction({ signer: account, transaction: tx });
  await aptos.waitForTransaction({ transactionHash: committed.hash });
  return committed.hash;
}

async function main() {
  console.log("\n" + "=".repeat(50));
  console.log("  PUMP NO to 90% (with choppy YES trades)");
  console.log("=".repeat(50));

  let prices = await getPrices();
  console.log(`\nStarting: Yes ${prices.yes.toFixed(1)}% | No ${prices.no.toFixed(1)}%`);

  // Mint enough USD1
  console.log("\nMinting 50,000 USD1...");
  await mintUSD1(50000);
  console.log("Done minting!\n");

  // Trade pattern: mostly NO buys with occasional YES to make it choppy
  // Each trade: 70% chance NO, 30% chance YES
  // NO amounts: 200-800 USD1 (bigger to drive price)
  // YES amounts: 50-150 USD1 (smaller, just for choppiness)

  let tradeCount = 0;
  const targetNo = 88; // Target NO percentage

  console.log("Trading to drive NO up...\n");

  while (prices.no < targetNo) {
    const isNoBuy = Math.random() > 0.25; // 75% NO, 25% YES

    if (isNoBuy) {
      // Buy NO with larger amounts
      const amount = 150 + Math.floor(Math.random() * 400); // 150-550
      try {
        await buyOutcome(1, amount); // 1 = NO
        tradeCount++;
        prices = await getPrices();
        console.log(`  ${tradeCount}. BUY NO  ${amount} USD1 -> No: ${prices.no.toFixed(1)}%`);
      } catch (e: any) {
        console.log(`  ${tradeCount}. NO failed: ${e.message?.slice(0, 30)}`);
      }
    } else {
      // Buy YES with smaller amounts (creates choppiness)
      const amount = 50 + Math.floor(Math.random() * 100); // 50-150
      try {
        await buyOutcome(0, amount); // 0 = YES
        tradeCount++;
        prices = await getPrices();
        console.log(`  ${tradeCount}. BUY YES ${amount} USD1 -> No: ${prices.no.toFixed(1)}%`);
      } catch (e: any) {
        console.log(`  ${tradeCount}. YES failed: ${e.message?.slice(0, 30)}`);
      }
    }

    // Small delay
    await new Promise(r => setTimeout(r, 100));

    // Safety: stop after 100 trades
    if (tradeCount > 100) break;
  }

  prices = await getPrices();
  console.log("\n" + "=".repeat(50));
  console.log("  COMPLETE");
  console.log(`  Final: Yes ${prices.yes.toFixed(1)}% | No ${prices.no.toFixed(1)}%`);
  console.log(`  Total trades: ${tradeCount}`);
  console.log("=".repeat(50) + "\n");
}

main().catch(console.error);
