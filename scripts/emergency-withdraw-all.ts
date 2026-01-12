/**
 * Emergency withdraw all TVL from old markets
 */

import { Aptos, AptosConfig, Network, Account, Ed25519PrivateKey } from '@aptos-labs/ts-sdk';

const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));

// Deployer key (market creator)
const DEPLOYER_KEY = "0x48ee96658dd826f6541f5ee501c5784e6b341f04c52c641823f4b097b61eb79b";

// Markets with TVL
const MARKETS = [
  {
    name: "V3 Active Market",
    contract: "0xa2e5e47aab07fed78a3bcf95135ee2dad20c547499c94cb16a3e047859ffa7e1",
    market: "0xfefd1b67818ee4ef12a7953852c83f0efb411a9b92c518a52ba92555e4abdd96"
  },
  {
    name: "Old V1 Market",
    contract: "0x64a81cb9cbd14d45b87bb32ef73107a44f00069b6a96e70d75369fb7e3da5e68",
    market: "0x43709b978ab28e43636944edcbad91efcffbf4ec0de026ae0fcf05e0f425f912"
  },
];

async function main() {
  console.log('='.repeat(60));
  console.log('EMERGENCY WITHDRAW ALL TVL');
  console.log('='.repeat(60));

  // Get deployer account
  const deployerKey = DEPLOYER_KEY.replace('0x', '');
  const deployer = Account.fromPrivateKey({
    privateKey: new Ed25519PrivateKey(deployerKey),
  });
  const deployerAddr = deployer.accountAddress.toString();
  console.log(`\nDeployer: ${deployerAddr}`);

  const startBalance = await aptos.getAccountAPTAmount({ accountAddress: deployerAddr });
  console.log(`Starting balance: ${(startBalance / 1e8).toFixed(2)} APT\n`);

  let totalWithdrawn = 0;

  for (const m of MARKETS) {
    console.log(`\n${m.name}:`);

    try {
      // Get market info to find TVL
      const info = await aptos.view({
        payload: {
          function: `${m.contract}::multi_outcome_market::get_multi_market_info`,
          functionArguments: [m.market],
        },
      });

      const tvl = Number(info[7]); // total_collateral in octas
      const tvlApt = tvl / 1e8;

      if (tvl === 0) {
        console.log(`  TVL: 0 APT (skip)`);
        continue;
      }

      console.log(`  TVL: ${tvlApt.toFixed(2)} APT`);
      console.log(`  Withdrawing...`);

      // Call emergency_withdraw
      const txn = await aptos.transaction.build.simple({
        sender: deployer.accountAddress,
        data: {
          function: `${m.contract}::multi_outcome_market::emergency_withdraw`,
          functionArguments: [m.market, tvl.toString()],
        },
      });

      const pendingTxn = await aptos.signAndSubmitTransaction({
        signer: deployer,
        transaction: txn,
      });

      const result = await aptos.waitForTransaction({ transactionHash: pendingTxn.hash });

      if (result.success) {
        console.log(`  Success! Hash: ${pendingTxn.hash.slice(0, 20)}...`);
        totalWithdrawn += tvlApt;
      } else {
        console.log(`  Failed: ${result.vm_status}`);
      }

    } catch (err: any) {
      console.log(`  Error: ${err.message?.slice(0, 100) || err}`);
    }
  }

  // Final balance
  const endBalance = await aptos.getAccountAPTAmount({ accountAddress: deployerAddr });

  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`  Total withdrawn:  ${totalWithdrawn.toFixed(2)} APT`);
  console.log(`  Final balance:    ${(endBalance / 1e8).toFixed(2)} APT`);
  console.log(`  Net gain:         ${((endBalance - startBalance) / 1e8).toFixed(2)} APT`);
  console.log('='.repeat(60));
}

main().catch(console.error);
