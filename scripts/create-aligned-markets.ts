#!/usr/bin/env npx tsx
/**
 * Create fresh demo markets with prices aligned to real Polymarket odds
 *
 * Strategy: Create markets with asymmetric initial liquidity to start at target prices
 * For CPMM: price = base_reserve / (base_reserve + outcome_reserve)
 *
 * To start at 35% YES: we need base_reserve / total = 0.35
 * So if total initial = 100 USD1, and we have 2 outcomes:
 * - Each outcome gets 50 USD1 reserve
 * - Then we trade to move prices to target
 */

import { Aptos, AptosConfig, Network, Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";

const CONTRACT_ADDRESS = "0x1bd17a9cb5a55a414de956128e332f7744ef260bbdc49303a08105c986adbda3";
const USD1_METADATA = "0xa89bf8c3480600cf0b30914b3370fed8ebfd7a638df6a6edee0e45b2a1dfff82";

// Initialize Aptos client
const config = new AptosConfig({ network: Network.TESTNET });
const aptos = new Aptos(config);

// fresh_deploy private key
function getAccount(): Account {
  const privateKeyHex = "0x6e2fca34586261b6f22a973c20024b78ddb370d87f7c974315fb97ba56716a7f";
  const privateKey = new Ed25519PrivateKey(privateKeyHex);
  return Account.fromPrivateKey({ privateKey });
}

interface MarketConfig {
  name: string;
  question: string;
  description: string;
  category: string;
  outcomes: string[];
  endTime: number;
  initialLiquidity: number; // In USD1
  targetPrices: number[]; // Target percentages for each outcome
}

// Markets aligned with real Polymarket data
const MARKETS: MarketConfig[] = [
  {
    name: "BTC $100K Q1 2026",
    question: "Will Bitcoin be above $100,000 by March 31, 2026?",
    description: "Resolves YES if BTC/USD reaches or exceeds $100,000 before April 1, 2026 on Binance.",
    category: "Crypto",
    outcomes: ["Yes", "No"],
    endTime: Math.floor(Date.now() / 1000) + 75 * 24 * 60 * 60, // ~75 days
    initialLiquidity: 1000, // 1000 USD1
    targetPrices: [90, 10], // 90% YES based on real Polymarket (~92%)
  },
  {
    name: "ETH $4000 Q2 2026",
    question: "Will Ethereum be above $4,000 by June 30, 2026?",
    description: "Resolves YES if ETH/USD reaches or exceeds $4,000 before July 1, 2026 on Binance.",
    category: "Crypto",
    outcomes: ["Yes", "No"],
    endTime: Math.floor(Date.now() / 1000) + 165 * 24 * 60 * 60, // ~165 days
    initialLiquidity: 1000,
    targetPrices: [55, 45], // ~55% YES (more realistic than $5K target)
  },
  {
    name: "Vision Pro 2 2026",
    question: "Will Apple release Vision Pro 2 before 2027?",
    description: "Resolves YES if Apple releases a device marketed as 'Vision Pro 2' before January 1, 2027.",
    category: "Tech",
    outcomes: ["Yes", "No"],
    endTime: Math.floor(Date.now() / 1000) + 350 * 24 * 60 * 60, // ~350 days
    initialLiquidity: 500,
    targetPrices: [20, 80], // 20% YES based on real Polymarket (~19%)
  },
  {
    name: "World Cup 2026",
    question: "Who will win the 2026 FIFA World Cup?",
    description: "The 2026 FIFA World Cup will be hosted in USA, Mexico, and Canada. July 2026.",
    category: "Sports",
    outcomes: ["Spain", "England", "France", "Brazil", "Argentina", "Germany", "Portugal", "Other"],
    endTime: Math.floor(Date.now() / 1000) + 200 * 24 * 60 * 60, // ~200 days (July 2026)
    initialLiquidity: 2000, // Need more for 8 outcomes
    targetPrices: [17, 14, 12, 9, 9, 8, 6, 25], // Based on real Polymarket
  },
];

async function createMarket(account: Account, market: MarketConfig): Promise<string | null> {
  console.log(`\n📊 Creating: ${market.name}`);
  console.log(`   Question: ${market.question}`);
  console.log(`   Outcomes: ${market.outcomes.join(", ")}`);
  console.log(`   Target prices: ${market.targetPrices.join("%, ")}%`);

  try {
    const initialLiquidityOctas = market.initialLiquidity * 100_000_000;

    const tx = await aptos.transaction.build.simple({
      sender: account.accountAddress,
      data: {
        function: `${CONTRACT_ADDRESS}::multi_outcome_market::create_multi_market_with_collateral`,
        typeArguments: [],
        functionArguments: [
          market.question,
          market.description,
          market.category,
          market.outcomes,
          market.endTime,
          initialLiquidityOctas,
          USD1_METADATA,
        ],
      },
    });

    const committedTx = await aptos.signAndSubmitTransaction({
      signer: account,
      transaction: tx,
    });

    const result = await aptos.waitForTransaction({
      transactionHash: committedTx.hash,
    });

    if (!result.success) {
      console.log(`   ❌ Transaction failed`);
      return null;
    }

    // Extract market address from events
    const events = (result as any).events || [];
    const createEvent = events.find((e: any) =>
      e.type.includes("MultiMarketCreated")
    );

    if (createEvent) {
      const marketAddr = createEvent.data.market_address;
      console.log(`   ✅ Created: ${marketAddr}`);
      return marketAddr;
    }

    console.log(`   ✅ Tx: ${committedTx.hash}`);
    console.log(`   ⚠️ Could not extract market address from events`);
    return null;
  } catch (e: any) {
    console.log(`   ❌ Error: ${e.message?.slice(0, 100)}`);
    return null;
  }
}

async function alignPrice(
  account: Account,
  marketAddr: string,
  outcomeIndex: number,
  currentPrice: number,
  targetPrice: number,
  label: string
): Promise<void> {
  if (Math.abs(targetPrice - currentPrice) < 3) {
    return; // Close enough
  }

  const diff = targetPrice - currentPrice;
  // Start with smaller trades relative to initial liquidity - use integer
  const tradeSize = Math.floor(Math.max(10, Math.min(200, Math.abs(diff) * 5)));

  console.log(`   📈 Adjusting ${label}: ${currentPrice.toFixed(1)}% → ${targetPrice}% (+${tradeSize} USD1)`);

  try {
    const tx = await aptos.transaction.build.simple({
      sender: account.accountAddress,
      data: {
        function: `${CONTRACT_ADDRESS}::multi_outcome_market::buy_outcome`,
        typeArguments: [],
        functionArguments: [marketAddr, outcomeIndex, tradeSize * 100_000_000, 0],
      },
    });

    const committedTx = await aptos.signAndSubmitTransaction({
      signer: account,
      transaction: tx,
    });

    await aptos.waitForTransaction({ transactionHash: committedTx.hash });
  } catch (e: any) {
    console.log(`   ⚠️ Trade error: ${e.message?.slice(0, 50)}`);
  }
}

async function getCurrentPrices(marketAddr: string): Promise<number[]> {
  const result = await aptos.view({
    payload: {
      function: `${CONTRACT_ADDRESS}::multi_outcome_market::get_all_prices`,
      typeArguments: [],
      functionArguments: [marketAddr],
    },
  });
  const rawPrices = (result[0] as string[]).map(p => parseInt(p));
  const sum = rawPrices.reduce((a, b) => a + b, 0);
  return rawPrices.map(p => (p / sum) * 100);
}

async function alignMarketPrices(
  account: Account,
  marketAddr: string,
  market: MarketConfig
): Promise<void> {
  console.log(`\n🎯 Aligning prices for ${market.name}...`);

  // Multiple rounds of alignment
  for (let round = 0; round < 10; round++) {
    const currentPrices = await getCurrentPrices(marketAddr);

    let allAligned = true;
    for (let i = 0; i < market.outcomes.length; i++) {
      if (Math.abs(currentPrices[i] - market.targetPrices[i]) > 5) {
        allAligned = false;
        break;
      }
    }

    if (allAligned) {
      console.log(`   ✅ Prices aligned after ${round} rounds`);
      break;
    }

    // Find outcome that needs the biggest increase
    let maxGap = 0;
    let buyIndex = -1;
    for (let i = 0; i < market.outcomes.length; i++) {
      const gap = market.targetPrices[i] - currentPrices[i];
      if (gap > maxGap) {
        maxGap = gap;
        buyIndex = i;
      }
    }

    if (buyIndex >= 0 && maxGap > 3) {
      await alignPrice(
        account,
        marketAddr,
        buyIndex,
        currentPrices[buyIndex],
        market.targetPrices[buyIndex],
        market.outcomes[buyIndex]
      );
      await new Promise(r => setTimeout(r, 500));
    } else {
      break;
    }
  }

  // Show final prices
  const finalPrices = await getCurrentPrices(marketAddr);
  console.log(`   Final prices: ${market.outcomes.map((o, i) =>
    `${o}: ${finalPrices[i].toFixed(1)}%`).join(", ")}`);
}

async function main() {
  console.log("🚀 Creating Demo Markets with Polymarket-Aligned Prices\n");

  const account = getAccount();
  console.log(`📍 Account: ${account.accountAddress.toString()}`);

  // Check USD1 balance
  try {
    const result = await aptos.view({
      payload: {
        function: "0x1::primary_fungible_store::balance",
        typeArguments: ["0x1::fungible_asset::Metadata"],
        functionArguments: [account.accountAddress.toString(), USD1_METADATA],
      },
    });
    const balance = parseInt(result[0] as string) / 100_000_000;
    console.log(`💰 USD1 Balance: ${balance.toFixed(2)} USD1`);

    if (balance < 5000) {
      console.log("\n⚠️ Need at least 5000 USD1 to create all markets");
      return;
    }
  } catch {
    console.log("⚠️ Could not check USD1 balance");
  }

  const createdMarkets: Array<{ config: MarketConfig; address: string }> = [];

  // Create each market
  for (const market of MARKETS) {
    const addr = await createMarket(account, market);
    if (addr) {
      createdMarkets.push({ config: market, address: addr });
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  // Align prices for each market
  for (const { config, address } of createdMarkets) {
    await alignMarketPrices(account, address, config);
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📋 Summary - New Market Addresses");
  console.log("=".repeat(60));

  for (const { config, address } of createdMarkets) {
    console.log(`\n${config.name}:`);
    console.log(`  Address: ${address}`);
    console.log(`  Targets: ${config.targetPrices.join("%, ")}%`);
  }

  // Output env format
  console.log("\n📝 For .env.local (replace VITE_MULTI_MARKETS):");
  console.log(`VITE_MULTI_MARKETS=${createdMarkets.map(m => m.address).join(",")}`);
}

main().catch(console.error);
