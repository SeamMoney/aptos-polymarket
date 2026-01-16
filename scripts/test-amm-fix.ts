#!/usr/bin/env npx tsx
/**
 * Test script to verify the AMM fix works
 * Creates a market and verifies prices can diverge properly
 */

import { Aptos, AptosConfig, Network, Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";

const CONTRACT = "0xca4d40eae9f07fb28a121862d649203fb4335ece9536ee51790e19f812ff7aea";
const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));

// Use the deployer key
const privateKey = new Ed25519PrivateKey("0xCD5A6456DC16CD34BF5CDAE7A20D1DF1674FCF46D8084F2A864DE4CB246BC659");
const account = Account.fromPrivateKey({ privateKey });

async function initUSD1() {
  console.log("\n1. Initializing USD1...");
  try {
    const tx = await aptos.transaction.build.simple({
      sender: account.accountAddress,
      data: {
        function: `${CONTRACT}::usd1::initialize`,
        functionArguments: [],
      },
    });
    const committed = await aptos.signAndSubmitTransaction({ signer: account, transaction: tx });
    await aptos.waitForTransaction({ transactionHash: committed.hash });
    console.log("   USD1 initialized!");
    return true;
  } catch (e: any) {
    if (e.message?.includes("already exists")) {
      console.log("   USD1 already initialized");
      return true;
    }
    console.log(`   Error: ${e.message?.slice(0, 50)}`);
    return false;
  }
}

async function getUSD1Metadata(): Promise<string> {
  try {
    const result = await aptos.view({
      payload: {
        function: `${CONTRACT}::usd1::get_metadata`,
        functionArguments: [],
      },
    });
    // The result is an object with inner field for the address
    const metadata = result[0] as any;
    if (typeof metadata === 'object' && metadata.inner) {
      return metadata.inner;
    }
    return String(metadata);
  } catch {
    return "";
  }
}

async function mintUSD1(amount: number) {
  console.log(`   Minting ${amount} USD1...`);
  const tx = await aptos.transaction.build.simple({
    sender: account.accountAddress,
    data: {
      function: `${CONTRACT}::usd1::mint`,
      functionArguments: [account.accountAddress.toString(), Math.floor(amount * 1e8)],
    },
  });
  const committed = await aptos.signAndSubmitTransaction({ signer: account, transaction: tx });
  await aptos.waitForTransaction({ transactionHash: committed.hash });
  console.log("   Minted!");
}

async function createMarket(): Promise<string> {
  console.log("\n2. Creating test market...");

  const usd1Metadata = await getUSD1Metadata();
  if (!usd1Metadata) {
    throw new Error("USD1 metadata not found");
  }
  console.log(`   USD1 Metadata: ${usd1Metadata}`);

  // Mint initial USD1 for liquidity
  await mintUSD1(10);

  const endTime = Math.floor(Date.now() / 1000) + 86400 * 30; // 30 days from now

  const tx = await aptos.transaction.build.simple({
    sender: account.accountAddress,
    data: {
      function: `${CONTRACT}::multi_outcome_market::create_multi_market_with_collateral`,
      functionArguments: [
        "Will BTC be above $100K by Feb 2026?",
        "Test market to verify AMM fix",
        "Crypto",
        ["Yes", "No"],
        endTime,
        Math.floor(5 * 1e8), // 5 USD1 initial liquidity
        usd1Metadata,
      ],
    },
  });

  const committed = await aptos.signAndSubmitTransaction({ signer: account, transaction: tx });
  const result = await aptos.waitForTransaction({ transactionHash: committed.hash, options: { checkSuccess: true } });

  // Find market address from events
  const events = (result as any).events || [];
  const createEvent = events.find((e: any) => e.type.includes("MultiMarketCreated"));

  if (createEvent) {
    const marketAddr = createEvent.data.market_address;
    console.log(`   Market created: ${marketAddr}`);
    return marketAddr;
  }

  throw new Error("Could not find market address in events");
}

async function getPrices(marketAddr: string): Promise<{yes: number, no: number}> {
  const result = await aptos.view({
    payload: {
      function: `${CONTRACT}::multi_outcome_market::get_all_prices`,
      functionArguments: [marketAddr],
    },
  });
  const prices = (result[0] as string[]).map(p => parseInt(p));
  const sum = prices.reduce((a, b) => a + b, 0);
  return { yes: prices[0] / sum * 100, no: prices[1] / sum * 100 };
}

async function buyOutcome(marketAddr: string, outcomeIndex: number, amount: number) {
  const tx = await aptos.transaction.build.simple({
    sender: account.accountAddress,
    data: {
      function: `${CONTRACT}::multi_outcome_market::buy_outcome`,
      functionArguments: [marketAddr, outcomeIndex, Math.floor(amount * 1e8), 0],
    },
  });
  const committed = await aptos.signAndSubmitTransaction({ signer: account, transaction: tx });
  await aptos.waitForTransaction({ transactionHash: committed.hash });
}

async function main() {
  console.log("=".repeat(60));
  console.log("  AMM FIX VERIFICATION TEST");
  console.log("  Testing per-outcome base_reserve implementation");
  console.log("=".repeat(60));

  console.log(`\nDeployer: ${account.accountAddress.toString()}`);
  console.log(`Contract: ${CONTRACT}`);

  // Step 1: Initialize USD1
  await initUSD1();

  // Step 2: Create market
  const marketAddr = await createMarket();

  // Step 3: Get initial prices
  console.log("\n3. Testing price divergence...");
  let prices = await getPrices(marketAddr);
  console.log(`   Initial: Yes ${prices.yes.toFixed(1)}% | No ${prices.no.toFixed(1)}%`);

  // Step 4: Mint more USD1 for trading
  console.log("\n4. Minting USD1 for trading...");
  await mintUSD1(100);

  // Step 5: Pump YES with multiple trades
  console.log("\n5. Pumping YES price...");
  const tradeAmounts = [5, 10, 15, 20, 25];

  for (let i = 0; i < tradeAmounts.length; i++) {
    const amount = tradeAmounts[i];
    await buyOutcome(marketAddr, 0, amount); // 0 = YES
    prices = await getPrices(marketAddr);
    console.log(`   Trade ${i+1}: +${amount} USD1 -> Yes ${prices.yes.toFixed(1)}% | No ${prices.no.toFixed(1)}%`);
  }

  // Step 6: Verify results
  console.log("\n" + "=".repeat(60));
  console.log("  RESULTS");
  console.log("=".repeat(60));

  const finalPrices = await getPrices(marketAddr);
  const yesMoved = finalPrices.yes > 60; // Did YES move above 60%?
  const noMoved = finalPrices.no < 40;   // Did NO move below 40%?

  console.log(`\n  Final Prices: Yes ${finalPrices.yes.toFixed(1)}% | No ${finalPrices.no.toFixed(1)}%`);
  console.log(`  YES moved above 60%: ${yesMoved ? "✅ YES" : "❌ NO"}`);
  console.log(`  NO moved below 40%: ${noMoved ? "✅ YES" : "❌ NO"}`);

  if (yesMoved && noMoved) {
    console.log("\n  🎉 AMM FIX VERIFIED! Prices can now diverge properly!");
    console.log(`\n  Market address: ${marketAddr}`);
    console.log(`  Contract: ${CONTRACT}`);
  } else {
    console.log("\n  ⚠️ Prices didn't diverge as expected. Check implementation.");
  }

  console.log("\n" + "=".repeat(60));
}

main().catch(console.error);
