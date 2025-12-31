/**
 * Drain market TVL using emergency_withdraw
 * Only works for market creator (contract deployer)
 */

import { Aptos, AptosConfig, Network, Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";

const CONTRACT_ADDRESS = "0xa2e5e47aab07fed78a3bcf95135ee2dad20c547499c94cb16a3e047859ffa7e1";
const MARKET_ADDRESS = "0xfefd1b67818ee4ef12a7953852c83f0efb411a9b92c518a52ba92555e4abdd96";

// Contract deployer key (same as market creator)
const DEPLOYER_KEY = process.env.CONTRACT_DEPLOYER_KEY || "0x466C93219D56FC91BBFDD22B127FC9CB717FA9752CB4ED91DF3A1D7B33307BD2";

const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));

async function main() {
  const deployer = Account.fromPrivateKey({
    privateKey: new Ed25519PrivateKey(DEPLOYER_KEY),
  });

  console.log("=".repeat(60));
  console.log("  MARKET TVL DRAIN");
  console.log("=".repeat(60));
  console.log(`Deployer: ${deployer.accountAddress.toString()}`);
  console.log(`Market: ${MARKET_ADDRESS}`);
  console.log("");

  // Get market info
  const [, , , , , , , totalCollateral] = await aptos.view({
    payload: {
      function: `${CONTRACT_ADDRESS}::multi_outcome_market::get_multi_market_info`,
      functionArguments: [MARKET_ADDRESS],
    },
  });

  const tvl = Number(totalCollateral) / 100_000_000;
  console.log(`Current TVL: ${tvl.toFixed(2)} APT`);

  if (tvl < 1) {
    console.log("TVL too low to drain. Exiting.");
    return;
  }

  // Check deployer balance before
  const balanceBefore = await aptos.getAccountAPTAmount({
    accountAddress: deployer.accountAddress,
  });
  console.log(`Deployer balance before: ${(balanceBefore / 100_000_000).toFixed(2)} APT`);

  // Drain amount (leave 1 APT for safety)
  const drainAmount = Math.floor((tvl - 1) * 100_000_000);
  console.log(`\nDraining: ${(drainAmount / 100_000_000).toFixed(2)} APT...`);

  try {
    const txn = await aptos.transaction.build.simple({
      sender: deployer.accountAddress,
      data: {
        function: `${CONTRACT_ADDRESS}::multi_outcome_market::emergency_withdraw`,
        functionArguments: [MARKET_ADDRESS, drainAmount],
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
      console.log(`\n SUCCESS! TX: ${pending.hash}`);

      const balanceAfter = await aptos.getAccountAPTAmount({
        accountAddress: deployer.accountAddress,
      });
      console.log(`Deployer balance after: ${(balanceAfter / 100_000_000).toFixed(2)} APT`);
      console.log(`Recovered: ${((balanceAfter - balanceBefore) / 100_000_000).toFixed(2)} APT`);
    } else {
      console.log(`\n FAILED: ${result.vm_status}`);
    }
  } catch (e: any) {
    console.error(`\nError: ${e.message}`);

    // If it's an authorization error, the deployer might not be the market creator
    if (e.message?.includes("E_NOT_AUTHORIZED") || e.message?.includes("0x4")) {
      console.log("\nThe deployer is not the market creator. Checking who created the market...");

      // The market was created by someone else - need to use that account
      console.log("You'll need to use the account that created this specific market.");
    }
  }
}

main().catch(console.error);
