/**
 * Add liquidity to market for demo
 * Mints complete sets to add TVL
 */

import { Aptos, AptosConfig, Network, Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";

const CONTRACT_ADDRESS = "0xa2e5e47aab07fed78a3bcf95135ee2dad20c547499c94cb16a3e047859ffa7e1";
const MARKET_ADDRESS = process.env.MARKET_ADDRESS || "0xfefd1b67818ee4ef12a7953852c83f0efb411a9b92c518a52ba92555e4abdd96";

// Use deployer key to fund the market
const DEPLOYER_KEY = process.env.CONTRACT_DEPLOYER_KEY || "0x466C93219D56FC91BBFDD22B127FC9CB717FA9752CB4ED91DF3A1D7B33307BD2";

// Amount to add in APT
const LIQUIDITY_APT = parseFloat(process.env.LIQUIDITY_APT || "5000");

const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));

async function main() {
  const deployer = Account.fromPrivateKey({
    privateKey: new Ed25519PrivateKey(DEPLOYER_KEY),
  });

  console.log("=".repeat(60));
  console.log("  ADD MARKET LIQUIDITY");
  console.log("=".repeat(60));
  console.log(`Account: ${deployer.accountAddress.toString()}`);
  console.log(`Market: ${MARKET_ADDRESS}`);
  console.log(`Amount: ${LIQUIDITY_APT} APT`);
  console.log("");

  // Check current market TVL
  const [, , , , , , , totalCollateral] = await aptos.view({
    payload: {
      function: `${CONTRACT_ADDRESS}::multi_outcome_market::get_multi_market_info`,
      functionArguments: [MARKET_ADDRESS],
    },
  });

  const currentTvl = Number(totalCollateral) / 100_000_000;
  console.log(`Current TVL: ${currentTvl.toFixed(2)} APT`);

  // Check deployer balance
  const balance = await aptos.getAccountAPTAmount({
    accountAddress: deployer.accountAddress,
  });
  console.log(`Deployer balance: ${(balance / 100_000_000).toFixed(2)} APT`);

  if (balance < LIQUIDITY_APT * 100_000_000) {
    console.error(`\n❌ Insufficient balance! Need ${LIQUIDITY_APT} APT`);
    process.exit(1);
  }

  // Add liquidity via mint_complete_set
  const amountOctas = Math.floor(LIQUIDITY_APT * 100_000_000);
  console.log(`\nMinting complete sets with ${LIQUIDITY_APT} APT...`);

  try {
    const txn = await aptos.transaction.build.simple({
      sender: deployer.accountAddress,
      data: {
        function: `${CONTRACT_ADDRESS}::multi_outcome_market::mint_complete_set`,
        functionArguments: [MARKET_ADDRESS, amountOctas],
      },
    });

    const pending = await aptos.signAndSubmitTransaction({
      signer: deployer,
      transaction: txn,
    });

    const result = await aptos.waitForTransaction({
      transactionHash: pending.hash,
    });

    if (result.success) {
      console.log(`\n✅ SUCCESS! TX: ${pending.hash}`);

      // Check new TVL
      const [, , , , , , , newCollateral] = await aptos.view({
        payload: {
          function: `${CONTRACT_ADDRESS}::multi_outcome_market::get_multi_market_info`,
          functionArguments: [MARKET_ADDRESS],
        },
      });

      const newTvl = Number(newCollateral) / 100_000_000;
      console.log(`New TVL: ${newTvl.toFixed(2)} APT`);
      console.log(`Added: ${(newTvl - currentTvl).toFixed(2)} APT`);
    } else {
      console.log(`\n❌ FAILED: ${result.vm_status}`);
    }
  } catch (e: any) {
    console.error(`\nError: ${e.message}`);
  }
}

main().catch(console.error);
