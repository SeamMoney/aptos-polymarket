#!/usr/bin/env npx tsx
/**
 * Mint USD1 and spam BUY YES to pump the price
 * Usage: npx tsx scripts/pump-yes.ts [num_trades] [amount_per_trade]
 */

import { Aptos, AptosConfig, Network, Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";

const CONTRACT_ADDRESS = "0x1bd17a9cb5a55a414de956128e332f7744ef260bbdc49303a08105c986adbda3";
const BTC_MARKET = "0x1dff2aac086d63f48f75081fc4b5801a00515d849c1c331c98bdb5de78737b73";

const config = new AptosConfig({ network: Network.TESTNET });
const aptos = new Aptos(config);

function getAccount(): Account {
  const privateKeyHex = "0x6e2fca34586261b6f22a973c20024b78ddb370d87f7c974315fb97ba56716a7f";
  const privateKey = new Ed25519PrivateKey(privateKeyHex);
  return Account.fromPrivateKey({ privateKey });
}

async function getUSD1Balance(address: string): Promise<number> {
  try {
    const result = await aptos.view({
      payload: {
        function: `${CONTRACT_ADDRESS}::usd1::balance`,
        typeArguments: [],
        functionArguments: [address],
      },
    });
    return parseInt(result[0] as string) / 100_000_000;
  } catch {
    return 0;
  }
}

async function mintUSD1(account: Account, amount: number): Promise<string> {
  const amountOctas = Math.floor(amount * 100_000_000);

  const tx = await aptos.transaction.build.simple({
    sender: account.accountAddress,
    data: {
      function: `${CONTRACT_ADDRESS}::usd1::mint`,
      typeArguments: [],
      functionArguments: [account.accountAddress.toString(), amountOctas],
    },
  });

  const committedTx = await aptos.signAndSubmitTransaction({
    signer: account,
    transaction: tx,
  });

  await aptos.waitForTransaction({ transactionHash: committedTx.hash });
  return committedTx.hash;
}

async function getCurrentPrices(marketAddr: string): Promise<{ yes: number; no: number }> {
  const result = await aptos.view({
    payload: {
      function: `${CONTRACT_ADDRESS}::multi_outcome_market::get_all_prices`,
      typeArguments: [],
      functionArguments: [marketAddr],
    },
  });
  const rawPrices = (result[0] as string[]).map(p => parseInt(p));
  const sum = rawPrices.reduce((a, b) => a + b, 0);
  return {
    yes: (rawPrices[0] / sum) * 100,
    no: (rawPrices[1] / sum) * 100,
  };
}

async function buyYes(account: Account, marketAddr: string, amountUSD1: number): Promise<string> {
  const amountOctas = Math.floor(amountUSD1 * 100_000_000);

  const tx = await aptos.transaction.build.simple({
    sender: account.accountAddress,
    data: {
      function: `${CONTRACT_ADDRESS}::multi_outcome_market::buy_outcome`,
      typeArguments: [],
      functionArguments: [marketAddr, 0, amountOctas, 0], // 0 = Yes outcome
    },
  });

  const committedTx = await aptos.signAndSubmitTransaction({
    signer: account,
    transaction: tx,
  });

  await aptos.waitForTransaction({ transactionHash: committedTx.hash });
  return committedTx.hash;
}

async function main() {
  const numTrades = parseInt(process.argv[2] || "20");
  const amountPerTrade = parseInt(process.argv[3] || "500");
  const totalNeeded = numTrades * amountPerTrade;

  console.log("🚀 YES Price Pump Script\n");
  console.log(`📊 Market: BTC $100K Q1 2026`);
  console.log(`📍 Address: ${BTC_MARKET.slice(0, 16)}...`);
  console.log(`🔢 Trades: ${numTrades} x ${amountPerTrade} USD1 = ${totalNeeded} USD1 total\n`);

  const account = getAccount();
  console.log(`👛 Account: ${account.accountAddress.toString()}`);

  // Check current balance
  let balance = await getUSD1Balance(account.accountAddress.toString());
  console.log(`💰 Current USD1 balance: ${balance.toFixed(2)}`);

  // Mint if needed
  if (balance < totalNeeded) {
    const mintAmount = totalNeeded - balance + 1000; // Extra buffer
    console.log(`\n🪙 Minting ${mintAmount.toFixed(0)} USD1...`);
    try {
      const hash = await mintUSD1(account, mintAmount);
      console.log(`   ✅ Minted: ${hash.slice(0, 16)}...`);
      balance = await getUSD1Balance(account.accountAddress.toString());
      console.log(`   💰 New balance: ${balance.toFixed(2)} USD1`);
    } catch (e: any) {
      console.log(`   ❌ Mint failed: ${e.message?.slice(0, 50)}`);
      return;
    }
  }

  // Get starting price
  const startPrices = await getCurrentPrices(BTC_MARKET);
  console.log(`\n📈 Starting prices: Yes ${startPrices.yes.toFixed(1)}% | No ${startPrices.no.toFixed(1)}%`);

  // Spam buys
  console.log(`\n🔥 Pumping YES...\n`);

  let successCount = 0;
  for (let i = 0; i < numTrades; i++) {
    try {
      const hash = await buyYes(account, BTC_MARKET, amountPerTrade);
      const prices = await getCurrentPrices(BTC_MARKET);
      console.log(`   ${i + 1}/${numTrades} ✅ Yes: ${prices.yes.toFixed(1)}% (+${(prices.yes - startPrices.yes).toFixed(1)}%) | ${hash.slice(0, 12)}...`);
      successCount++;
    } catch (e: any) {
      console.log(`   ${i + 1}/${numTrades} ❌ ${e.message?.slice(0, 40)}`);
    }

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 100));
  }

  // Final state
  const endPrices = await getCurrentPrices(BTC_MARKET);
  const finalBalance = await getUSD1Balance(account.accountAddress.toString());

  console.log(`\n${'='.repeat(50)}`);
  console.log(`📊 Results`);
  console.log(`${'='.repeat(50)}`);
  console.log(`   Trades: ${successCount}/${numTrades} successful`);
  console.log(`   USD1 spent: ~${(successCount * amountPerTrade).toLocaleString()}`);
  console.log(`   Remaining balance: ${finalBalance.toFixed(2)} USD1`);
  console.log(`\n   Price change:`);
  console.log(`   Yes: ${startPrices.yes.toFixed(1)}% → ${endPrices.yes.toFixed(1)}% (${endPrices.yes > startPrices.yes ? '+' : ''}${(endPrices.yes - startPrices.yes).toFixed(1)}%)`);
  console.log(`   No:  ${startPrices.no.toFixed(1)}% → ${endPrices.no.toFixed(1)}% (${endPrices.no > startPrices.no ? '+' : ''}${(endPrices.no - startPrices.no).toFixed(1)}%)`);
  console.log(`${'='.repeat(50)}\n`);
}

main().catch(console.error);
