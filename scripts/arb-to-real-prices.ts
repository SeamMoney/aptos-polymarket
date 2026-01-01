#!/usr/bin/env npx tsx
/**
 * Arbitrage script to align on-chain market prices with real Polymarket prices
 *
 * Target prices (from real Polymarket data Dec 31, 2025):
 * - J.D. Vance: 53.5%
 * - Marco Rubio: 9.1%
 * - Donald Trump: 4.8%
 * - Ron DeSantis: 4.25%
 * - Tucker Carlson: 2.85%
 * - Donald Trump Jr.: 2.45%
 */

import { Aptos, AptosConfig, Network, Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";

const CONTRACT_ADDRESS = "0xa2e5e47aab07fed78a3bcf95135ee2dad20c547499c94cb16a3e047859ffa7e1";
const MARKET_ADDRESS = "0xfefd1b67818ee4ef12a7953852c83f0efb411a9b92c518a52ba92555e4abdd96";

// Target prices from real Polymarket (as percentages)
const TARGET_PRICES: Record<string, number> = {
  "J.D. Vance": 53.5,
  "Marco Rubio": 9.1,
  "Donald Trump": 4.8,
  "Ron DeSantis": 4.25,
  "Tucker Carlson": 2.85,
  "Donald Trump Jr.": 2.45,
};

// Initialize Aptos client with API key
const API_KEY = process.env.APTOS_API_KEY || "AG-3JMDT54EN4DCLULDWAUXCYGQ56JJQCYHH";
const config = new AptosConfig({
  network: Network.TESTNET,
  clientConfig: { API_KEY },
});
const aptos = new Aptos(config);
console.log(`Using API key: ${API_KEY.slice(0, 10)}...`);

// Use one of the funded accounts (8000 APT)
const FUNDED_PRIVATE_KEY = "0x6e2fca34586261b6f22a973c20024b78ddb370d87f7c974315fb97ba56716a7f";

function getAccount(): Account {
  const privateKeyHex = process.env.APTOS_PRIVATE_KEY || FUNDED_PRIVATE_KEY;
  const privateKey = new Ed25519PrivateKey(privateKeyHex);
  return Account.fromPrivateKey({ privateKey });
}

// Fetch current market state
async function getMarketState() {
  // Get outcome labels
  const labelsResult = await aptos.view({
    payload: {
      function: `${CONTRACT_ADDRESS}::multi_outcome_market::get_outcome_labels`,
      typeArguments: [],
      functionArguments: [MARKET_ADDRESS],
    },
  });
  const labels = labelsResult[0] as string[];

  // Get current prices
  const pricesResult = await aptos.view({
    payload: {
      function: `${CONTRACT_ADDRESS}::multi_outcome_market::get_all_prices`,
      typeArguments: [],
      functionArguments: [MARKET_ADDRESS],
    },
  });
  const rawPrices = (pricesResult[0] as string[]).map(p => parseInt(p));

  // Normalize to sum to 100%
  const priceSum = rawPrices.reduce((a, b) => a + b, 0);
  const normalizedPrices = rawPrices.map(p => (p / priceSum) * 100);

  return { labels, rawPrices, normalizedPrices };
}

// Buy outcome tokens
async function buyOutcome(account: Account, outcomeIndex: number, amountAPT: number) {
  const amountOctas = Math.floor(amountAPT * 100_000_000);

  const tx = await aptos.transaction.build.simple({
    sender: account.accountAddress,
    data: {
      function: `${CONTRACT_ADDRESS}::multi_outcome_market::buy_outcome`,
      typeArguments: [],
      functionArguments: [MARKET_ADDRESS, outcomeIndex, amountOctas, 0],
    },
  });

  const committedTx = await aptos.signAndSubmitTransaction({
    signer: account,
    transaction: tx,
  });

  const result = await aptos.waitForTransaction({
    transactionHash: committedTx.hash,
  });

  return { hash: committedTx.hash, success: result.success };
}

// Mint complete set (1 of each outcome token for APT)
async function mintCompleteSet(account: Account, amountAPT: number) {
  const amountOctas = Math.floor(amountAPT * 100_000_000);

  const tx = await aptos.transaction.build.simple({
    sender: account.accountAddress,
    data: {
      function: `${CONTRACT_ADDRESS}::multi_outcome_market::mint_complete_set`,
      typeArguments: [],
      functionArguments: [MARKET_ADDRESS, amountOctas],
    },
  });

  const committedTx = await aptos.signAndSubmitTransaction({
    signer: account,
    transaction: tx,
  });

  const result = await aptos.waitForTransaction({
    transactionHash: committedTx.hash,
  });

  return { hash: committedTx.hash, success: result.success };
}

// Sell outcome tokens
async function sellOutcome(account: Account, outcomeIndex: number, tokensToSell: number) {
  const tokensOctas = Math.floor(tokensToSell * 100_000_000);

  const tx = await aptos.transaction.build.simple({
    sender: account.accountAddress,
    data: {
      function: `${CONTRACT_ADDRESS}::multi_outcome_market::sell_outcome`,
      typeArguments: [],
      functionArguments: [MARKET_ADDRESS, outcomeIndex, tokensOctas, 0],
    },
  });

  const committedTx = await aptos.signAndSubmitTransaction({
    signer: account,
    transaction: tx,
  });

  const result = await aptos.waitForTransaction({
    transactionHash: committedTx.hash,
  });

  return { hash: committedTx.hash, success: result.success };
}

async function main() {
  console.log("🎯 Arbitrage Script - Aligning with Real Polymarket Prices\n");

  const account = getAccount();
  console.log(`📍 Using account: ${account.accountAddress.toString()}\n`);

  // Check balance
  const balance = await aptos.getAccountAPTAmount({ accountAddress: account.accountAddress });
  console.log(`💰 Account balance: ${(balance / 100_000_000).toFixed(2)} APT\n`);

  if (balance < 100_000_000) {
    console.log("❌ Insufficient balance. Need at least 1 APT.");
    return;
  }

  // Get current state
  console.log("📊 Current Market State:");
  const { labels, normalizedPrices } = await getMarketState();

  for (let i = 0; i < labels.length; i++) {
    const target = TARGET_PRICES[labels[i]] || 0;
    const current = normalizedPrices[i];
    const diff = target - current;
    const arrow = diff > 0 ? "⬆️" : diff < 0 ? "⬇️" : "➡️";
    console.log(`  [${i}] ${labels[i]}: ${current.toFixed(1)}% → ${target.toFixed(1)}% ${arrow}`);
  }
  console.log();

  // Strategy:
  // 1. Buy JD Vance (decreases his outcome_reserve, increases base_reserve)
  // 2. Sell OTHER outcomes (increases their outcome_reserves, decreases base_reserve)
  // This creates relative price difference more effectively

  const vanceIndex = labels.findIndex(l => l.includes("Vance") || l.includes("J.D."));
  if (vanceIndex === -1) {
    console.log("❌ Could not find JD Vance outcome");
    return;
  }

  console.log(`Found JD Vance at index ${vanceIndex}`);

  // First, let's mint complete sets to get tokens of all outcomes
  // Then we'll sell the non-Vance tokens to push their prices down (relative to Vance)

  let tradesExecuted = 0;
  const maxRounds = 15;
  const tradeSize = 50; // 50 APT per round
  console.log(`Strategy: Mint complete sets, keep Vance, sell others`);
  console.log(`Trade size: ${tradeSize} APT per round (${maxRounds} max rounds)\n`);

  for (let round = 0; round < maxRounds; round++) {
    const state = await getMarketState();
    const currentVancePrice = state.normalizedPrices[vanceIndex];

    if (currentVancePrice >= 53) {
      console.log(`  ✅ JD Vance at ${currentVancePrice.toFixed(1)}% - reached target!`);
      break;
    }

    console.log(`  📈 Round ${round + 1}: Vance at ${currentVancePrice.toFixed(1)}%`);

    try {
      // Step 1: Mint complete set (gives us 1 of each token for our APT)
      console.log(`     Minting complete set (${tradeSize} APT)...`);
      const mintResult = await mintCompleteSet(account, tradeSize);
      if (!mintResult.success) {
        console.log(`     ❌ Mint failed`);
        break;
      }
      console.log(`     ✅ Minted: ${mintResult.hash.slice(0, 16)}...`);
      tradesExecuted++;

      // Step 2: Sell all non-Vance tokens back to market
      // This increases their reserves, pushing their prices down relative to Vance
      for (let i = 0; i < labels.length; i++) {
        if (i === vanceIndex) continue; // Keep Vance tokens

        // We got tradeSize tokens of each outcome from complete set
        // Sell most of them (keep a small amount)
        const tokensToSell = tradeSize * 0.9; // Sell 90% of non-Vance tokens
        try {
          console.log(`     Selling ${tokensToSell.toFixed(1)} ${labels[i]} tokens...`);
          const sellResult = await sellOutcome(account, i, tokensToSell);
          if (sellResult.success) {
            tradesExecuted++;
          }
        } catch (e: any) {
          console.log(`     ⚠️ Sell ${labels[i]} failed: ${e.message?.slice(0, 50)}`);
        }
      }
    } catch (e: any) {
      console.log(`     ❌ Error: ${e.message?.slice(0, 80)}`);
      break;
    }

    // Longer delay between rounds to avoid rate limits
    console.log(`     Waiting 5 seconds...`);
    await new Promise(r => setTimeout(r, 5000));
  }

  // Final state
  console.log("\n📊 Final Market State:");
  const finalState = await getMarketState();
  for (let i = 0; i < finalState.labels.length; i++) {
    const target = TARGET_PRICES[finalState.labels[i]] || 0;
    const current = finalState.normalizedPrices[i];
    const diff = Math.abs(target - current);
    const status = diff < 5 ? "✅" : diff < 15 ? "🟡" : "🔴";
    console.log(`  ${status} ${finalState.labels[i]}: ${current.toFixed(1)}% (target: ${target.toFixed(1)}%)`);
  }

  console.log(`\n✨ Executed ${tradesExecuted} trades`);
}

main().catch(console.error);
