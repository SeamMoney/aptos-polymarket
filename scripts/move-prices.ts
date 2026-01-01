#!/usr/bin/env npx tsx
/**
 * Script to move market prices by making strategic trades
 * This will differentiate the outcome prices to make the chart more interesting
 */

import { Aptos, AptosConfig, Network, Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";

const CONTRACT_ADDRESS = "0xa2e5e47aab07fed78a3bcf95135ee2dad20c547499c94cb16a3e047859ffa7e1";
const MARKET_ADDRESS = "0xfefd1b67818ee4ef12a7953852c83f0efb411a9b92c518a52ba92555e4abdd96";

const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));

// Get private key from environment
const privateKeyHex = process.env.APTOS_PRIVATE_KEY;
if (!privateKeyHex) {
  console.error("Please set APTOS_PRIVATE_KEY environment variable");
  process.exit(1);
}

const privateKey = new Ed25519PrivateKey(privateKeyHex);
const account = Account.fromPrivateKey({ privateKey });

console.log(`Using account: ${account.accountAddress.toString()}`);

// Outcome indices and names
const OUTCOMES = [
  { index: 0, name: "J.D. Vance", targetShare: 45 },      // Make leader
  { index: 1, name: "Marco Rubio", targetShare: 18 },     // Second place
  { index: 2, name: "Donald Trump", targetShare: 12 },    // Third
  { index: 3, name: "Ron DeSantis", targetShare: 10 },    // Fourth
  { index: 4, name: "Tucker Carlson", targetShare: 8 },   // Fifth
  { index: 5, name: "Other", targetShare: 7 },            // Last
];

async function getPrices(): Promise<number[]> {
  const result = await aptos.view({
    payload: {
      function: `${CONTRACT_ADDRESS}::multi_outcome_market::get_all_prices`,
      typeArguments: [],
      functionArguments: [MARKET_ADDRESS],
    },
  });
  return (result[0] as string[]).map(p => parseInt(p));
}

async function getNormalizedPrices(): Promise<number[]> {
  const raw = await getPrices();
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map(p => (p / sum) * 100);
}

async function getBalance(): Promise<number> {
  const balance = await aptos.getAccountAPTAmount({ accountAddress: account.accountAddress });
  return balance / 100_000_000;
}

async function buyOutcome(outcomeIndex: number, amountAPT: number): Promise<string> {
  const amountOctas = Math.floor(amountAPT * 100_000_000);

  const tx = await aptos.transaction.build.simple({
    sender: account.accountAddress,
    data: {
      function: `${CONTRACT_ADDRESS}::multi_outcome_market::buy_outcome`,
      typeArguments: [],
      functionArguments: [MARKET_ADDRESS, outcomeIndex, amountOctas, 0],
    },
  });

  const signed = await aptos.transaction.sign({ signer: account, transaction: tx });
  const result = await aptos.transaction.submit.simple({ transaction: tx, senderAuthenticator: signed });
  await aptos.waitForTransaction({ transactionHash: result.hash });

  return result.hash;
}

async function main() {
  console.log("\n📊 Current prices:");
  let prices = await getNormalizedPrices();
  OUTCOMES.forEach((o, i) => {
    console.log(`  ${o.name}: ${prices[i].toFixed(1)}% (target: ${o.targetShare}%)`);
  });

  const balance = await getBalance();
  console.log(`\n💰 Account balance: ${balance.toFixed(2)} APT`);

  if (balance < 10) {
    console.error("❌ Need at least 10 APT to move prices");
    process.exit(1);
  }

  // Calculate how much to buy for each outcome to move toward targets
  // Buy more of outcomes that need higher prices
  console.log("\n🔄 Making trades to differentiate prices...\n");

  // Strategy: Buy heavily into J.D. Vance to make him the clear leader
  // Buy moderate amounts of Rubio, small amounts of others
  const trades = [
    { index: 0, name: "J.D. Vance", amount: 50 },    // Big buy to push to ~45%
    { index: 1, name: "Marco Rubio", amount: 15 },   // Medium buy
    { index: 2, name: "Donald Trump", amount: 8 },   // Small buy
    { index: 3, name: "Ron DeSantis", amount: 5 },   // Tiny buy
    { index: 4, name: "Tucker Carlson", amount: 3 }, // Tiny buy
    { index: 5, name: "Other", amount: 2 },          // Minimal
  ];

  for (const trade of trades) {
    if (trade.amount > 0) {
      try {
        console.log(`  Buying ${trade.amount} APT of ${trade.name}...`);
        const hash = await buyOutcome(trade.index, trade.amount);
        console.log(`  ✅ Success: ${hash.slice(0, 16)}...`);

        // Show updated price
        const newPrices = await getNormalizedPrices();
        console.log(`     New price: ${newPrices[trade.index].toFixed(1)}%\n`);

        // Small delay between trades
        await new Promise(r => setTimeout(r, 500));
      } catch (error: any) {
        console.log(`  ❌ Failed: ${error.message}`);
      }
    }
  }

  console.log("\n📊 Final prices:");
  prices = await getNormalizedPrices();
  OUTCOMES.forEach((o, i) => {
    const diff = prices[i] - o.targetShare;
    const indicator = Math.abs(diff) < 5 ? "✅" : "⚠️";
    console.log(`  ${indicator} ${o.name}: ${prices[i].toFixed(1)}% (target: ${o.targetShare}%)`);
  });

  const finalBalance = await getBalance();
  console.log(`\n💰 Final balance: ${finalBalance.toFixed(2)} APT (spent ${(balance - finalBalance).toFixed(2)} APT)`);
}

main().catch(console.error);
