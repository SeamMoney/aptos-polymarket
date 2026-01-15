#!/usr/bin/env npx tsx
/**
 * Add Political/World Markets:
 * 1. Republican 2028 Nominee
 * 2. Iran Khamenei
 * 3. WLFI Banking Charter
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

interface MarketConfig {
  question: string;
  description: string;
  category: string;
  outcomes: string[];
  daysUntilEnd: number;
  initialLiquidity: number; // USD1
}

const MARKETS: MarketConfig[] = [
  {
    question: "Who will be the Republican Presidential Nominee in 2028?",
    description: "Who will win the Republican nomination for President of the United States in 2028?",
    outcomes: ["J.D. Vance", "Marco Rubio", "Ron DeSantis", "Vivek Ramaswamy", "Other"],
    category: "Politics",
    daysUntilEnd: 1000, // ~2.7 years until 2028 primaries
    initialLiquidity: 1000,
  },
  {
    question: "Khamenei out as Iran Supreme Leader by end of 2026?",
    description: "Will Ayatollah Ali Khamenei no longer be Supreme Leader of Iran by December 31, 2026? Resolves YES if he dies, resigns, or is removed from power.",
    outcomes: ["Yes", "No"],
    category: "World",
    daysUntilEnd: 350, // End of 2026
    initialLiquidity: 500,
  },
  {
    question: "Will WLFI receive OCC banking charter in 2026?",
    description: "World Liberty Financial (Trump-affiliated crypto venture) has applied for a national trust bank charter from the Office of the Comptroller of the Currency. Will it be approved in 2026?",
    outcomes: ["Yes", "No", "Withdrawn", "Delayed to 2027"],
    category: "Business",
    daysUntilEnd: 350,
    initialLiquidity: 800,
  },
];

async function createMarket(account: Account, market: MarketConfig): Promise<string | null> {
  console.log(`\n📊 Creating: ${market.question.slice(0, 50)}...`);
  console.log(`   Outcomes: ${market.outcomes.join(", ")}`);
  console.log(`   Category: ${market.category}`);

  try {
    const endTime = Math.floor(Date.now() / 1000) + market.daysUntilEnd * 24 * 60 * 60;
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
          endTime,
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
    return null;
  } catch (e: any) {
    console.log(`   ❌ Error: ${e.message?.slice(0, 100)}`);
    return null;
  }
}

async function main() {
  console.log("🚀 Creating Political/World Markets\n");

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
  } catch {
    console.log("⚠️ Could not check USD1 balance");
  }

  const createdMarkets: string[] = [];

  for (const market of MARKETS) {
    const addr = await createMarket(account, market);
    if (addr) {
      createdMarkets.push(addr);
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log("\n" + "=".repeat(60));
  console.log("📋 New Market Addresses");
  console.log("=".repeat(60));

  for (let i = 0; i < createdMarkets.length; i++) {
    console.log(`${i + 1}. ${MARKETS[i].question.slice(0, 40)}...`);
    console.log(`   ${createdMarkets[i]}`);
  }

  // Output for .env.local
  if (createdMarkets.length > 0) {
    console.log("\n📝 Add these to VITE_MULTI_MARKETS in .env.local:");
    console.log(createdMarkets.join(","));
  }
}

main().catch(console.error);
