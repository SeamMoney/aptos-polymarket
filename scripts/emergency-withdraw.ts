/**
 * Emergency Withdraw - Pull APT from market (creator only)
 * This recovers the locked TVL from the market contract
 */

import { Aptos, AptosConfig, Network, Account, Ed25519PrivateKey } from '@aptos-labs/ts-sdk';

const CONTRACT_ADDRESS = '0xa2e5e47aab07fed78a3bcf95135ee2dad20c547499c94cb16a3e047859ffa7e1';
const MULTI_MODULE = `${CONTRACT_ADDRESS}::multi_outcome_market`;
const MARKET_ADDRESS = '0xfefd1b67818ee4ef12a7953852c83f0efb411a9b92c518a52ba92555e4abdd96';

// Deployer private key (market creator)
const DEPLOYER_KEY = process.env.APTOS_PRIVATE_KEY || '0x48ee96658dd826f6541f5ee501c5784e6b341f04c52c641823f4b097b61eb79b';

async function main() {
  const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));

  console.log('='.repeat(60));
  console.log('EMERGENCY WITHDRAW - RECOVER MARKET TVL');
  console.log('='.repeat(60));

  // Load deployer account
  const deployer = Account.fromPrivateKey({
    privateKey: new Ed25519PrivateKey(DEPLOYER_KEY)
  });
  console.log(`\nDeployer: ${deployer.accountAddress.toString()}`);

  // Check current market TVL
  const info = await aptos.view({
    payload: {
      function: `${MULTI_MODULE}::get_multi_market_info`,
      functionArguments: [MARKET_ADDRESS],
    },
  });
  const tvl = Number(info[7]);
  const tvlApt = tvl / 100_000_000;
  console.log(`Market TVL: ${tvlApt.toFixed(2)} APT (${tvl} octas)`);

  if (tvl === 0) {
    console.log('\nNo APT to withdraw!');
    return;
  }

  // Check deployer balance before
  const balanceBefore = await aptos.getAccountAPTAmount({ accountAddress: deployer.accountAddress });
  console.log(`Deployer balance before: ${(balanceBefore / 1e8).toFixed(4)} APT`);

  // Withdraw amount (leave a small buffer for gas)
  const withdrawAmount = Math.floor(tvl * 0.99); // Withdraw 99% to be safe
  console.log(`\nWithdrawing: ${(withdrawAmount / 1e8).toFixed(2)} APT...`);

  try {
    const tx = await aptos.transaction.build.simple({
      sender: deployer.accountAddress,
      data: {
        function: `${MULTI_MODULE}::emergency_withdraw`,
        functionArguments: [MARKET_ADDRESS, withdrawAmount],
      },
    });

    const signed = aptos.transaction.sign({ signer: deployer, transaction: tx });
    const pending = await aptos.transaction.submit.simple({
      transaction: tx,
      senderAuthenticator: signed,
    });

    console.log(`Tx submitted: ${pending.hash}`);

    const result = await aptos.waitForTransaction({ transactionHash: pending.hash });
    console.log(`Tx confirmed: ${result.success ? 'SUCCESS' : 'FAILED'}`);

    // Check balance after
    const balanceAfter = await aptos.getAccountAPTAmount({ accountAddress: deployer.accountAddress });
    const recovered = (balanceAfter - balanceBefore) / 1e8;
    console.log(`\nDeployer balance after: ${(balanceAfter / 1e8).toFixed(4)} APT`);
    console.log(`RECOVERED: +${recovered.toFixed(4)} APT`);

    // Check remaining TVL
    const infoAfter = await aptos.view({
      payload: {
        function: `${MULTI_MODULE}::get_multi_market_info`,
        functionArguments: [MARKET_ADDRESS],
      },
    });
    const tvlAfter = Number(infoAfter[7]) / 1e8;
    console.log(`\nRemaining market TVL: ${tvlAfter.toFixed(2)} APT`);

  } catch (e: any) {
    console.log(`\nError: ${e.message}`);
    if (e.message?.includes('E_NOT_AUTHORIZED')) {
      console.log('\nYou are not the market creator. Only the creator can emergency withdraw.');
    }
  }

  console.log('\n' + '='.repeat(60));
}

main().catch(console.error);
