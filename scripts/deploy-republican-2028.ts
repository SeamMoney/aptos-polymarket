#!/usr/bin/env npx tsx
/**
 * Deploy Republican 2028 Nominee Market to the NEW AMM-fixed contract
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
  console.log("  DEPLOY REPUBLICAN 2028 NOMINEE MARKET");
  console.log("  To new AMM-fixed contract");
  console.log("=".repeat(70));
  console.log();

  // Use contract deployer (can mint USD1)
  const deployerKey = new Ed25519PrivateKey(cleanKey(CONTRACTS.deployerKey));
  const deployer = Account.fromPrivateKey({ privateKey: deployerKey });

  console.log(`Contract: ${CONTRACT_ADDRESS}`);
  console.log(`USD1 Metadata: ${USD1_METADATA}`);
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

  const mintPending = await aptos.signAndSubmitTransaction({
    signer: deployer,
    transaction: mintTx,
  });
  await aptos.waitForTransaction({ transactionHash: mintPending.hash });
  console.log("✓ USD1 minted\n");

  // Create the market
  const question = "Who will be the Republican Presidential Nominee in 2028?";
  const description = "Who will win the Republican nomination for President of the United States in 2028?";
  const category = "Politics";
  const outcomes = ["J.D. Vance", "Marco Rubio", "Donald Trump", "Ron DeSantis", "Tucker Carlson", "Other"];
  const endTime = Math.floor(new Date("2028-08-01").getTime() / 1000); // Aug 2028 (after RNC convention)

  console.log(`Creating market: ${question}`);
  console.log(`Outcomes: ${outcomes.join(", ")}`);
  console.log(`Category: ${category}`);
  console.log(`Initial Liquidity: 1000 USD1`);
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

    console.log(`Transaction submitted: ${pending.hash}`);

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
      console.log();
      console.log("=".repeat(70));
      console.log("  ✅ MARKET CREATED SUCCESSFULLY");
      console.log("=".repeat(70));
      console.log();
      console.log(`  Market Address: ${marketAddr}`);
      console.log();
      console.log("  Add this to config/wallets.ts markets array:");
      console.log(`    "${marketAddr}", // 15. Republican 2028 Nominee`);
      console.log();
    } else {
      console.log("✓ Transaction successful but couldn't extract market address");
      console.log(`  Check tx: ${pending.hash}`);
    }
  } catch (e: any) {
    console.error("❌ Error:", e.message);
    process.exit(1);
  }
}

main().catch(console.error);
