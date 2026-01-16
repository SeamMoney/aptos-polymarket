#!/usr/bin/env npx tsx
/**
 * Create a fresh market with small liquidity, then pump YES price
 */

import { Aptos, AptosConfig, Network, Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";

const CONTRACT_ADDRESS = "0x1bd17a9cb5a55a414de956128e332f7744ef260bbdc49303a08105c986adbda3";
const USD1_METADATA = "0xa89bf8c3480600cf0b30914b3370fed8ebfd7a638df6a6edee0e45b2a1dfff82";

const config = new AptosConfig({ network: Network.TESTNET });
const aptos = new Aptos(config);

function getAccount(): Account {
  const privateKeyHex = "0x6e2fca34586261b6f22a973c20024b78ddb370d87f7c974315fb97ba56716a7f";
  const privateKey = new Ed25519PrivateKey(privateKeyHex);
  return Account.fromPrivateKey({ privateKey });
}

async function getCurrentPrices(marketAddr: string): Promise<{ yes: number; no: number }> {
  const result = await aptos.view({
    payload: {
      function: `${CONTRACT_ADDRESS}::multi_outcome_market::get_all_prices`,
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
      functionArguments: [marketAddr, 0, amountOctas, 0],
    },
  });

  const committedTx = await aptos.signAndSubmitTransaction({
    signer: account,
    transaction: tx,
  });

  await aptos.waitForTransaction({ transactionHash: committedTx.hash });
  return committedTx.hash;
}

async function createMarket(account: Account): Promise<string | null> {
  const endTime = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // 30 days
  const initialLiquidity = 500 * 100_000_000; // 500 USD1 - small pool for visible price movement

  console.log("\n📊 Creating fresh test market with 500 USD1 liquidity...\n");

  const tx = await aptos.transaction.build.simple({
    sender: account.accountAddress,
    data: {
      function: `${CONTRACT_ADDRESS}::multi_outcome_market::create_multi_market_with_collateral`,
      typeArguments: [],
      functionArguments: [
        "Test: Will this price move? (Demo)",
        "A test market with small liquidity to demonstrate price movement",
        "Test",
        ["Yes", "No"],
        endTime,
        initialLiquidity,
        USD1_METADATA,
      ],
    },
  });

  const committedTx = await aptos.signAndSubmitTransaction({
    signer: account,
    transaction: tx,
  });

  const result = await aptos.waitForTransaction({ transactionHash: committedTx.hash });

  if (!result.success) {
    console.log("❌ Market creation failed");
    return null;
  }

  // Extract market address from events
  const events = (result as any).events || [];
  const createEvent = events.find((e: any) => e.type.includes("MultiMarketCreated"));

  if (createEvent) {
    return createEvent.data.market_address;
  }

  console.log("⚠️ Could not extract market address from events");
  return null;
}

async function main() {
  const account = getAccount();
  console.log("🚀 Create Market & Pump YES Demo\n");
  console.log(`👛 Account: ${account.accountAddress.toString()}`);

  // Create market
  const marketAddr = await createMarket(account);
  if (!marketAddr) {
    console.log("Failed to create market");
    return;
  }

  console.log(`✅ Market created: ${marketAddr}`);

  // Get starting prices
  let prices = await getCurrentPrices(marketAddr);
  console.log(`\n📈 Starting: Yes ${prices.yes.toFixed(1)}% | No ${prices.no.toFixed(1)}%`);

  // Pump with increasing amounts
  const tradeAmounts = [50, 75, 100, 150, 200, 250];

  console.log("\n🔥 Pumping YES with increasing trade sizes...\n");

  for (let i = 0; i < tradeAmounts.length; i++) {
    const amount = tradeAmounts[i];
    try {
      const hash = await buyYes(account, marketAddr, amount);
      prices = await getCurrentPrices(marketAddr);
      console.log(`   Trade ${i + 1}: ${amount} USD1 → Yes: ${prices.yes.toFixed(1)}% | ${hash.slice(0, 12)}...`);
    } catch (e: any) {
      console.log(`   Trade ${i + 1}: ❌ ${e.message?.slice(0, 40)}`);
    }
    await new Promise(r => setTimeout(r, 200));
  }

  // Final prices
  prices = await getCurrentPrices(marketAddr);
  console.log(`\n📊 Final: Yes ${prices.yes.toFixed(1)}% | No ${prices.no.toFixed(1)}%`);
  console.log(`\n📍 Market address (add to VITE_MULTI_MARKETS):`);
  console.log(`   ${marketAddr}\n`);
}

main().catch(console.error);
