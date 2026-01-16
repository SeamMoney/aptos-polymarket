#!/usr/bin/env npx tsx
/**
 * Create Russia-Ukraine market on the new AMM-fixed contract
 * (The original address was truncated/invalid)
 */

import { Aptos, AptosConfig, Network, Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";
import { CONTRACTS, cleanKey } from "../config/wallets";

const CONTRACT_ADDRESS = CONTRACTS.address;
const USD1_METADATA = CONTRACTS.usd1Metadata;
const MODULE = `${CONTRACT_ADDRESS}::multi_outcome_market`;

const config = new AptosConfig({ network: Network.TESTNET });
const aptos = new Aptos(config);

async function main() {
  console.log("=".repeat(70));
  console.log("  FIX RUSSIA-UKRAINE MARKET");
  console.log("  (Recreating with correct address)");
  console.log("=".repeat(70));
  console.log();

  const deployerKey = new Ed25519PrivateKey(cleanKey(CONTRACTS.deployerKey));
  const deployer = Account.fromPrivateKey({ privateKey: deployerKey });

  console.log(`Contract: ${CONTRACT_ADDRESS}`);
  console.log(`Deployer: ${deployer.accountAddress.toString()}`);
  console.log();

  // Mint USD1 for initial liquidity
  const initialLiquidity = 1000_00000000; // 1000 USD1
  console.log("Minting 1000 USD1 for initial liquidity...");

  const mintTx = await aptos.transaction.build.simple({
    sender: deployer.accountAddress,
    data: {
      function: `${CONTRACT_ADDRESS}::usd1::mint`,
      functionArguments: [deployer.accountAddress.toString(), initialLiquidity],
    },
  });

  await aptos.signAndSubmitTransaction({ signer: deployer, transaction: mintTx });
  console.log("✓ USD1 minted\n");

  // Create the market
  const question = "Russia-Ukraine ceasefire by Q2 2026?";
  const description = "Will Russia and Ukraine agree to a formal ceasefire by June 30, 2026?";
  const category = "World";
  const outcomes = ["Yes", "No"];
  const endTime = Math.floor(new Date("2026-06-30").getTime() / 1000);

  console.log(`Creating market: ${question}`);
  console.log(`Outcomes: ${outcomes.join(", ")}`);
  console.log();

  try {
    const createTx = await aptos.transaction.build.simple({
      sender: deployer.accountAddress,
      data: {
        function: `${MODULE}::create_multi_market_with_collateral`,
        functionArguments: [
          question,
          description,
          category,
          outcomes,
          endTime,
          initialLiquidity,
          USD1_METADATA,
        ],
      },
    });

    const pending = await aptos.signAndSubmitTransaction({
      signer: deployer,
      transaction: createTx,
    });

    const result = await aptos.waitForTransaction({
      transactionHash: pending.hash,
      options: { checkSuccess: true },
    });

    // Get market address from events
    const events = (result as any).events || [];
    const createEvent = events.find((e: any) =>
      e.type?.includes("MultiMarketCreated")
    );

    if (createEvent) {
      const marketAddr = createEvent.data.market_address;
      console.log("=".repeat(70));
      console.log("  ✅ MARKET CREATED SUCCESSFULLY");
      console.log("=".repeat(70));
      console.log();
      console.log(`  Market Address: ${marketAddr}`);
      console.log();
      console.log("  Update config/wallets.ts market #6 with:");
      console.log(`    "${marketAddr}", // 6. Russia-Ukraine`);
      console.log();
    }
  } catch (e: any) {
    console.error("❌ Error:", e.message);
    process.exit(1);
  }
}

main().catch(console.error);
