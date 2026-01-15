#!/usr/bin/env npx tsx
/**
 * Align prices of the newly created markets to target Polymarket prices
 */

import { Aptos, AptosConfig, Network, Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";

const CONTRACT_ADDRESS = "0x1bd17a9cb5a55a414de956128e332f7744ef260bbdc49303a08105c986adbda3";

const config = new AptosConfig({ network: Network.TESTNET });
const aptos = new Aptos(config);

function getAccount(): Account {
  const privateKeyHex = "0x6e2fca34586261b6f22a973c20024b78ddb370d87f7c974315fb97ba56716a7f";
  const privateKey = new Ed25519PrivateKey(privateKeyHex);
  return Account.fromPrivateKey({ privateKey });
}

interface Market {
  name: string;
  address: string;
  outcomes: string[];
  targets: number[];
}

const MARKETS: Market[] = [
  {
    name: "BTC $100K Q1 2026",
    address: "0x1dff2aac086d63f48f75081fc4b5801a00515d849c1c331c98bdb5de78737b73",
    outcomes: ["Yes", "No"],
    targets: [90, 10],
  },
  {
    name: "ETH $4000 Q2 2026",
    address: "0xc1c9143248ddfb645dd1d2c326d75a0a67ac20b913199b50ef265ee279059628",
    outcomes: ["Yes", "No"],
    targets: [55, 45],
  },
  {
    name: "Vision Pro 2 2026",
    address: "0x3d15fa55e7dd07bd2fbd7a584c5963a9b73d2d5f6753ef4d63af3de49d743cd2",
    outcomes: ["Yes", "No"],
    targets: [20, 80],
  },
  {
    name: "World Cup 2026",
    address: "0x5a96eb9e58eec84dfeae631db2a072eccabd981f2709f9d0207a131c77d4ea8a",
    outcomes: ["Spain", "England", "France", "Brazil", "Argentina", "Germany", "Portugal", "Other"],
    targets: [17, 14, 12, 9, 9, 8, 6, 25],
  },
];

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

  await aptos.waitForTransaction({ transactionHash: committedTx.hash });
  return committedTx.hash;
}

async function alignMarket(account: Account, market: Market) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 ${market.name}`);
  console.log(`${'='.repeat(60)}`);

  let totalTrades = 0;

  for (let round = 0; round < 30; round++) {
    const prices = await getCurrentPrices(market.address);

    // Show current state
    if (round === 0) {
      console.log("\n📈 Current vs Target:");
      for (let i = 0; i < market.outcomes.length; i++) {
        const arrow = market.targets[i] > prices[i] + 3 ? "⬆️" :
                      market.targets[i] < prices[i] - 3 ? "⬇️" : "✅";
        console.log(`  ${market.outcomes[i].padEnd(12)}: ${prices[i].toFixed(1).padStart(5)}% → ${market.targets[i].toString().padStart(3)}% ${arrow}`);
      }
    }

    // Check if aligned
    let allAligned = true;
    let maxGap = 0;
    let buyIndex = -1;

    for (let i = 0; i < market.outcomes.length; i++) {
      const gap = market.targets[i] - prices[i];
      if (Math.abs(gap) > 5) {
        allAligned = false;
      }
      if (gap > maxGap) {
        maxGap = gap;
        buyIndex = i;
      }
    }

    if (allAligned || maxGap < 3) {
      console.log(`\n✅ Aligned after ${round} rounds (${totalTrades} trades)`);
      break;
    }

    // Execute trade - bigger trades for bigger pools
    const tradeSize = Math.floor(Math.max(50, Math.min(500, maxGap * 10)));
    console.log(`  Round ${round + 1}: Buy ${market.outcomes[buyIndex]} (${prices[buyIndex].toFixed(1)}% → ${market.targets[buyIndex]}%), ${tradeSize} USD1`);

    try {
      const hash = await buyOutcome(account, market.address, buyIndex, tradeSize);
      console.log(`    ✅ ${hash.slice(0, 16)}...`);
      totalTrades++;
    } catch (e: any) {
      console.log(`    ❌ ${e.message?.slice(0, 50)}`);
      break;
    }

    await new Promise(r => setTimeout(r, 500));
  }

  // Final state
  const finalPrices = await getCurrentPrices(market.address);
  console.log("\n📊 Final State:");
  for (let i = 0; i < market.outcomes.length; i++) {
    const diff = Math.abs(market.targets[i] - finalPrices[i]);
    const status = diff < 3 ? "✅" : diff < 8 ? "🟡" : "🔴";
    console.log(`  ${status} ${market.outcomes[i].padEnd(12)}: ${finalPrices[i].toFixed(1)}% (target: ${market.targets[i]}%)`);
  }
}

async function main() {
  console.log("🎯 Price Alignment Script\n");

  const account = getAccount();
  console.log(`📍 Account: ${account.accountAddress.toString()}`);

  for (const market of MARKETS) {
    await alignMarket(account, market);
  }

  console.log("\n" + "=".repeat(60));
  console.log("✨ Price alignment complete!");
  console.log("=".repeat(60));
}

main().catch(console.error);
