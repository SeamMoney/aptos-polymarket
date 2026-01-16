#!/usr/bin/env npx tsx
/**
 * Price Alignment Script - Align on-chain market prices with real Polymarket odds
 *
 * Target prices (from real Polymarket data Jan 14, 2026):
 *
 * BTC $95K DEMO (already ended): ~95% YES
 * ETH $5000 by June 2026: ~35% YES
 * Vision Pro 2 by March 2026: ~15% YES
 * World Cup 2026:
 *   - Spain: 17%, England: 14%, France: 12%, Argentina: 9%
 *   - Brazil: 9%, Germany: 8%, Portugal: 6%, Netherlands: 6%
 */

import { Aptos, AptosConfig, Network, Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";

const CONTRACT_ADDRESS = "0x1bd17a9cb5a55a414de956128e332f7744ef260bbdc49303a08105c986adbda3";
const USD1_METADATA = "0xa89bf8c3480600cf0b30914b3370fed8ebfd7a638df6a6edee0e45b2a1dfff82";

// Our demo markets
const MARKETS = {
  BTC_95K: "0x427469beed867c3285604d97d12354feab5053759cd71568ee26877fb96d26ec",
  APT_10: "0x51ba8a543c6d8699401bcd6e5c422c23a82f280bcbc3d1dcc797b0189a10d32",
  WORLD_CUP: "0xb7e0cff8435d6fe107ac8f2838f094858fc9f9fb6ba0efd800f1c8fe77a417d2",
  VISION_PRO: "0x19ba6bb9f168d8fc935fd6eb396c392c94e17c903c7f8058517ca0c489c2ae7b",
  ETH_5000: "0x4db267d2e1d166ed0c332bae1ec2eed66370fb90415c4f461b9a9580c86f488e",
};

// Target prices from real Polymarket (as percentages)
// Use partial label matching since exact labels may vary
const TARGET_PRICES: Record<string, Record<string, number>> = {
  [MARKETS.BTC_95K]: {
    "Yes": 95, // BTC is ~$97K, so above $95K is very likely
    "No": 5,
  },
  [MARKETS.APT_10]: {
    "Yes": 50, // No Polymarket equivalent, keep at 50%
    "No": 50,
  },
  [MARKETS.WORLD_CUP]: {
    "Argentina": 9,
    "Brazil": 9,
    "France": 12,
    "Germany": 8,
    "Spain": 17,
    "England": 14,
    "Portugal": 6,
    "Netherlands": 6,
  },
  [MARKETS.VISION_PRO]: {
    "Yes": 15,
    "No": 85,
  },
  [MARKETS.ETH_5000]: {
    "Yes": 35,
    "No": 65,
  },
};

// Helper to find target price by partial label match
function getTargetForLabel(targets: Record<string, number>, label: string): number | null {
  // First try exact match
  if (targets[label] !== undefined) return targets[label];

  // Then try partial match (label contains key or key contains label)
  for (const [key, value] of Object.entries(targets)) {
    if (label.toLowerCase().includes(key.toLowerCase()) ||
        key.toLowerCase().includes(label.toLowerCase())) {
      return value;
    }
  }
  return null;
}

// Initialize Aptos client
const config = new AptosConfig({ network: Network.TESTNET });
const aptos = new Aptos(config);

// Load account (using fresh_deploy profile)
function getAccount(): Account {
  // fresh_deploy private key from contracts/.aptos/config.yaml
  const privateKeyHex = "0x6e2fca34586261b6f22a973c20024b78ddb370d87f7c974315fb97ba56716a7f";
  const privateKey = new Ed25519PrivateKey(privateKeyHex);
  return Account.fromPrivateKey({ privateKey });
}

// Fetch current market state
async function getMarketState(marketAddr: string) {
  const labelsResult = await aptos.view({
    payload: {
      function: `${CONTRACT_ADDRESS}::multi_outcome_market::get_outcome_labels`,
      typeArguments: [],
      functionArguments: [marketAddr],
    },
  });
  const labels = labelsResult[0] as string[];

  const pricesResult = await aptos.view({
    payload: {
      function: `${CONTRACT_ADDRESS}::multi_outcome_market::get_all_prices`,
      typeArguments: [],
      functionArguments: [marketAddr],
    },
  });
  const rawPrices = (pricesResult[0] as string[]).map(p => parseInt(p));

  return { labels, rawPrices };
}

// Buy outcome tokens (using USD1 collateral)
async function buyOutcome(account: Account, marketAddr: string, outcomeIndex: number, amountUSD1: number) {
  const amountOctas = Math.floor(amountUSD1 * 100_000_000);

  const tx = await aptos.transaction.build.simple({
    sender: account.accountAddress,
    data: {
      function: `${CONTRACT_ADDRESS}::multi_outcome_market::buy_outcome`,
      typeArguments: [],
      functionArguments: [marketAddr, outcomeIndex, amountOctas, 0],
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

// Get USD1 balance
async function getUSD1Balance(account: Account): Promise<number> {
  try {
    const result = await aptos.view({
      payload: {
        function: "0x1::primary_fungible_store::balance",
        typeArguments: ["0x1::fungible_asset::Metadata"],
        functionArguments: [account.accountAddress.toString(), USD1_METADATA],
      },
    });
    return parseInt(result[0] as string) / 100_000_000;
  } catch {
    return 0;
  }
}

// Calculate trade needed to move price
// With large pools, need MUCH larger trades to move prices
function calculateTradeSize(currentPrice: number, targetPrice: number, baseAmount: number = 500): number {
  const diff = Math.abs(targetPrice - currentPrice);
  // Scale up to 50K USD1 max per trade for large pools
  return Math.max(5000, Math.min(50000, diff * baseAmount));
}

async function alignMarket(account: Account, marketAddr: string, marketName: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 ${marketName}`);
  console.log(`${'='.repeat(60)}`);

  const targets = TARGET_PRICES[marketAddr];
  if (!targets) {
    console.log("  ⚠️ No target prices defined, skipping");
    return;
  }

  // Get current state
  const { labels, rawPrices } = await getMarketState(marketAddr);

  // Calculate current normalized prices
  const priceSum = rawPrices.reduce((a, b) => a + b, 0);
  const currentPrices = rawPrices.map(p => (p / priceSum) * 100);

  console.log("\n📈 Current vs Target:");
  for (let i = 0; i < labels.length; i++) {
    const target = getTargetForLabel(targets, labels[i]) ?? currentPrices[i];
    const current = currentPrices[i];
    const diff = target - current;
    const arrow = diff > 2 ? "⬆️" : diff < -2 ? "⬇️" : "✅";
    console.log(`  [${i}] ${labels[i].padEnd(20)}: ${current.toFixed(1).padStart(5)}% → ${target.toFixed(1).padStart(5)}% ${arrow}`);
  }

  // Find outcomes that need price increase
  const needsIncrease: Array<{ index: number; label: string; diff: number; target: number }> = [];
  for (let i = 0; i < labels.length; i++) {
    const target = getTargetForLabel(targets, labels[i]) ?? currentPrices[i];
    const diff = target - currentPrices[i];
    if (diff > 3) { // Only if more than 3% off
      needsIncrease.push({ index: i, label: labels[i], diff, target });
    }
  }

  if (needsIncrease.length === 0) {
    console.log("\n  ✅ Market already aligned within tolerance");
    return;
  }

  // Sort by largest difference first
  needsIncrease.sort((a, b) => b.diff - a.diff);

  console.log("\n🎯 Trade Plan:");
  for (const { label, diff } of needsIncrease) {
    console.log(`  - Buy ${label}: need +${diff.toFixed(1)}%`);
  }

  // Execute trades
  console.log("\n🔄 Executing trades...");
  let tradesExecuted = 0;
  const maxRounds = 20; // More rounds for larger movements

  for (let round = 0; round < maxRounds; round++) {
    const state = await getMarketState(marketAddr);
    const sum = state.rawPrices.reduce((a, b) => a + b, 0);
    const prices = state.rawPrices.map(p => (p / sum) * 100);

    let allAligned = true;
    let maxGap = 0;
    let buyIndex = -1;
    let buyTarget = 0;

    for (let i = 0; i < state.labels.length; i++) {
      const target = getTargetForLabel(targets, state.labels[i]) ?? prices[i];
      const gap = target - prices[i];

      if (Math.abs(gap) > 5) {
        allAligned = false;
      }
      if (gap > maxGap) {
        maxGap = gap;
        buyIndex = i;
        buyTarget = target;
      }
    }

    if (allAligned) {
      console.log(`  ✅ Market aligned after ${round} rounds!`);
      break;
    }

    if (buyIndex === -1 || maxGap < 3) {
      console.log(`  ✅ All outcomes within tolerance`);
      break;
    }

    const tradeSize = calculateTradeSize(prices[buyIndex], buyTarget);
    console.log(`  Round ${round + 1}: Buy ${state.labels[buyIndex]} (${prices[buyIndex].toFixed(1)}% → ${buyTarget.toFixed(1)}%), ${tradeSize.toFixed(0)} USD1`);

    try {
      const result = await buyOutcome(account, marketAddr, buyIndex, tradeSize);
      if (result.success) {
        console.log(`    ✅ ${result.hash.slice(0, 16)}...`);
        tradesExecuted++;
      } else {
        console.log(`    ❌ Trade failed`);
      }
    } catch (e: any) {
      console.log(`    ❌ Error: ${e.message?.slice(0, 60)}`);
      if (e.message?.includes("INSUFFICIENT")) {
        console.log("    💰 Need more USD1 to continue");
        break;
      }
    }

    await new Promise(r => setTimeout(r, 1000));
  }

  // Show final state
  const finalState = await getMarketState(marketAddr);
  const finalSum = finalState.rawPrices.reduce((a, b) => a + b, 0);
  const finalPrices = finalState.rawPrices.map(p => (p / finalSum) * 100);

  console.log("\n📊 Final State:");
  for (let i = 0; i < finalState.labels.length; i++) {
    const target = getTargetForLabel(targets, finalState.labels[i]) ?? finalPrices[i];
    const diff = Math.abs(target - finalPrices[i]);
    const status = diff < 3 ? "✅" : diff < 10 ? "🟡" : "🔴";
    console.log(`  ${status} ${finalState.labels[i].padEnd(20)}: ${finalPrices[i].toFixed(1)}% (target: ${target.toFixed(1)}%)`);
  }

  console.log(`  📈 Trades executed: ${tradesExecuted}`);
}

async function main() {
  console.log("🎯 Price Alignment Script - Aligning with Real Polymarket Prices\n");

  const account = getAccount();
  console.log(`📍 Account: ${account.accountAddress.toString()}`);

  // Check USD1 balance
  const usd1Balance = await getUSD1Balance(account);
  console.log(`💰 USD1 Balance: ${usd1Balance.toFixed(2)} USD1`);

  if (usd1Balance < 10) {
    console.log("\n⚠️ Low USD1 balance. You may need to mint more USD1 first.");
    console.log("   Run: npx tsx scripts/disperse-usd1.ts");
  }

  // Align each market
  await alignMarket(account, MARKETS.WORLD_CUP, "2026 FIFA World Cup");
  await alignMarket(account, MARKETS.ETH_5000, "ETH $5000 by June 2026");
  await alignMarket(account, MARKETS.VISION_PRO, "Vision Pro 2 by March 2026");
  await alignMarket(account, MARKETS.BTC_95K, "BTC $95K (DEMO - ended)");

  console.log("\n" + "=".repeat(60));
  console.log("✨ Price alignment complete!");
  console.log("=".repeat(60));
}

main().catch(console.error);
