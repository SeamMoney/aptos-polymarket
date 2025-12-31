/**
 * Arb script to align on-chain prices with Polymarket prices
 * Uses CSV data to set target prices and executes trades to move prices
 */

import { Aptos, AptosConfig, Network, Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";
import * as fs from "fs";
import * as path from "path";

// Config
const CONTRACT_ADDRESS = "0xa2e5e47aab07fed78a3bcf95135ee2dad20c547499c94cb16a3e047859ffa7e1";
const MARKET_ADDRESS = "0xfefd1b67818ee4ef12a7953852c83f0efb411a9b92c518a52ba92555e4abdd96";

// Get private key from environment - MUST be funded with APT
const PRIVATE_KEY = process.env.APTOS_PRIVATE_KEY;
if (!PRIVATE_KEY) {
  console.error("ERROR: APTOS_PRIVATE_KEY environment variable is required");
  console.error("Usage: APTOS_PRIVATE_KEY=0x... npx tsx scripts/arb-to-polymarket.ts");
  console.error("\nTo fund an account, visit: https://aptos.dev/network/faucet");
  process.exit(1);
}

// Target prices from latest Polymarket data (Dec 31 2025)
// These are percentages that should sum to ~100%
const TARGET_PRICES: Record<string, number> = {
  "J.D. Vance": 53.5,
  "Marco Rubio": 9.0,
  "Donald Trump": 4.75,
  "Ron DeSantis": 4.25,
  "Tucker Carlson": 2.85,
  "Other": 25.65, // Adjusted to make sum closer to 100%
};

const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));

async function getCurrentPrices(): Promise<number[]> {
  const result = await aptos.view({
    payload: {
      function: `${CONTRACT_ADDRESS}::multi_outcome_market::get_all_prices`,
      typeArguments: [],
      functionArguments: [MARKET_ADDRESS],
    },
  });
  return (result[0] as string[]).map(p => parseInt(p));
}

async function getOutcomeLabels(): Promise<string[]> {
  const result = await aptos.view({
    payload: {
      function: `${CONTRACT_ADDRESS}::multi_outcome_market::get_outcome_labels`,
      typeArguments: [],
      functionArguments: [MARKET_ADDRESS],
    },
  });
  return result[0] as string[];
}

async function quoteBuy(outcomeIndex: number, amountOctas: number): Promise<number> {
  try {
    const result = await aptos.view({
      payload: {
        function: `${CONTRACT_ADDRESS}::multi_outcome_market::quote_buy_outcome`,
        typeArguments: [],
        functionArguments: [MARKET_ADDRESS, outcomeIndex, amountOctas],
      },
    });
    return parseInt(result[0] as string);
  } catch {
    return 0;
  }
}

async function quoteSell(outcomeIndex: number, tokenAmount: number): Promise<number> {
  try {
    const result = await aptos.view({
      payload: {
        function: `${CONTRACT_ADDRESS}::multi_outcome_market::quote_sell_outcome`,
        typeArguments: [],
        functionArguments: [MARKET_ADDRESS, outcomeIndex, tokenAmount],
      },
    });
    return parseInt(result[0] as string);
  } catch {
    return 0;
  }
}

async function buyOutcome(account: Account, outcomeIndex: number, amountAPT: number): Promise<string | null> {
  const amountOctas = Math.floor(amountAPT * 100_000_000);

  try {
    const txn = await aptos.transaction.build.simple({
      sender: account.accountAddress,
      data: {
        function: `${CONTRACT_ADDRESS}::multi_outcome_market::buy_outcome`,
        typeArguments: [],
        functionArguments: [MARKET_ADDRESS, outcomeIndex, amountOctas, 0],
      },
    });

    const pending = await aptos.signAndSubmitTransaction({
      signer: account,
      transaction: txn,
    });

    const result = await aptos.waitForTransaction({ transactionHash: pending.hash });
    return result.success ? pending.hash : null;
  } catch (error: any) {
    console.error(`  Buy failed: ${error.message}`);
    return null;
  }
}

async function sellOutcome(account: Account, outcomeIndex: number, tokenAmount: number): Promise<string | null> {
  try {
    const txn = await aptos.transaction.build.simple({
      sender: account.accountAddress,
      data: {
        function: `${CONTRACT_ADDRESS}::multi_outcome_market::sell_outcome`,
        typeArguments: [],
        functionArguments: [MARKET_ADDRESS, outcomeIndex, tokenAmount, 0],
      },
    });

    const pending = await aptos.signAndSubmitTransaction({
      signer: account,
      transaction: txn,
    });

    const result = await aptos.waitForTransaction({ transactionHash: pending.hash });
    return result.success ? pending.hash : null;
  } catch (error: any) {
    console.error(`  Sell failed: ${error.message}`);
    return null;
  }
}

async function getAccountBalance(address: string): Promise<number> {
  try {
    const resources = await aptos.getAccountResource({
      accountAddress: address,
      resourceType: "0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>",
    });
    return Number((resources as any).coin?.value || 0) / 100_000_000;
  } catch {
    return 0;
  }
}

async function main() {
  console.log("=== Polymarket Price Alignment Bot ===\n");

  // Setup account
  const account = Account.fromPrivateKey({
    privateKey: new Ed25519PrivateKey(PRIVATE_KEY),
  });

  const balance = await getAccountBalance(account.accountAddress.toString());
  console.log(`Account: ${account.accountAddress.toString().slice(0, 10)}...`);
  console.log(`Balance: ${balance.toFixed(2)} APT\n`);

  if (balance < 1) {
    console.error("Insufficient balance for arbitrage trades");
    return;
  }

  // Get outcome labels
  const labels = await getOutcomeLabels();
  console.log("Market Outcomes:", labels.join(", "));

  // Get current prices
  const currentPrices = await getCurrentPrices();

  console.log("\n=== Current vs Target Prices ===");
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];
    const current = currentPrices[i];
    const target = TARGET_PRICES[label] || 10;
    const diff = target - current;
    const arrow = diff > 0 ? "↑" : diff < 0 ? "↓" : "=";
    console.log(`  ${label}: ${current}% -> ${target}% (${arrow}${Math.abs(diff).toFixed(1)}%)`);
  }

  // Calculate trades needed
  console.log("\n=== Executing Trades ===");

  // Strategy: Buy outcomes that need to go up, we can't directly sell without tokens
  // First, let's buy into the favorite (J.D. Vance) to push price up
  // The AMM will naturally adjust other prices down

  const tradeSize = 0.5; // APT per trade
  const maxIterations = 20;
  let iteration = 0;

  while (iteration < maxIterations) {
    iteration++;
    console.log(`\n--- Iteration ${iteration} ---`);

    const prices = await getCurrentPrices();
    let maxDiff = 0;
    let maxDiffIndex = -1;
    let shouldBuy = true;

    // Find outcome with largest price difference
    for (let i = 0; i < labels.length; i++) {
      const target = TARGET_PRICES[labels[i]] || 10;
      const diff = target - prices[i];

      if (Math.abs(diff) > Math.abs(maxDiff)) {
        maxDiff = diff;
        maxDiffIndex = i;
        shouldBuy = diff > 0; // Buy if price needs to go up
      }
    }

    if (Math.abs(maxDiff) < 2) {
      console.log("All prices within 2% of target. Done!");
      break;
    }

    const label = labels[maxDiffIndex];
    console.log(`  Target: ${label} (current: ${prices[maxDiffIndex]}%, target: ${TARGET_PRICES[label]}%)`);

    if (shouldBuy) {
      console.log(`  Action: BUY ${tradeSize} APT worth`);
      const hash = await buyOutcome(account, maxDiffIndex, tradeSize);
      if (hash) {
        console.log(`  Success: ${hash.slice(0, 16)}...`);
      }
    } else {
      // To push price down, we need to buy OTHER outcomes instead
      // Find an underpriced outcome to buy
      let buyIndex = -1;
      let buyDiff = 0;
      for (let i = 0; i < labels.length; i++) {
        if (i === maxDiffIndex) continue;
        const target = TARGET_PRICES[labels[i]] || 10;
        const diff = target - prices[i];
        if (diff > buyDiff) {
          buyDiff = diff;
          buyIndex = i;
        }
      }

      if (buyIndex >= 0) {
        console.log(`  Action: BUY ${labels[buyIndex]} to lower ${label}`);
        const hash = await buyOutcome(account, buyIndex, tradeSize);
        if (hash) {
          console.log(`  Success: ${hash.slice(0, 16)}...`);
        }
      }
    }

    // Small delay between trades
    await new Promise(r => setTimeout(r, 2000));
  }

  // Final prices
  console.log("\n=== Final Prices ===");
  const finalPrices = await getCurrentPrices();
  for (let i = 0; i < labels.length; i++) {
    const target = TARGET_PRICES[labels[i]] || 10;
    console.log(`  ${labels[i]}: ${finalPrices[i]}% (target: ${target}%)`);
  }

  const finalBalance = await getAccountBalance(account.accountAddress.toString());
  console.log(`\nFinal Balance: ${finalBalance.toFixed(2)} APT`);
  console.log(`Cost: ${(balance - finalBalance).toFixed(2)} APT`);
}

main().catch(console.error);
