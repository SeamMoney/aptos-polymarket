/**
 * Create a multi-outcome prediction market
 */

import {
  Aptos,
  AptosConfig,
  Network,
  Account,
  Ed25519PrivateKey,
} from '@aptos-labs/ts-sdk';

const CONTRACT_ADDRESS = '0x64a81cb9cbd14d45b87bb32ef73107a44f00069b6a96e70d75369fb7e3da5e68';
const MODULE = `${CONTRACT_ADDRESS}::multi_outcome_market`;

async function main() {
  const privateKey = process.env.APTOS_PRIVATE_KEY;
  if (!privateKey) {
    console.error('Set APTOS_PRIVATE_KEY env var');
    process.exit(1);
  }

  const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));
  const account = Account.fromPrivateKey({
    privateKey: new Ed25519PrivateKey(privateKey),
  });

  console.log('Creating multi-outcome market...');
  console.log('Account:', account.accountAddress.toString());

  // Check balance
  const balance = await aptos.getAccountAPTAmount({
    accountAddress: account.accountAddress,
  });
  console.log('Balance:', balance / 100_000_000, 'APT');

  // Create market
  const question = 'Who will win the 2024 US Presidential Election?';
  const description = 'Predict the winner of the 2024 US presidential race';
  const category = 'Politics';
  const outcomes = ['Trump', 'Biden', 'DeSantis', 'RFK Jr', 'Other'];
  const endTime = Math.floor(Date.now() / 1000) + 86400 * 30; // 30 days
  const initialLiquidity = 5_00000000; // 5 APT

  console.log('\nMarket Details:');
  console.log('  Question:', question);
  console.log('  Outcomes:', outcomes.join(', '));
  console.log('  Initial Liquidity:', initialLiquidity / 100_000_000, 'APT');

  try {
    const transaction = await aptos.transaction.build.simple({
      sender: account.accountAddress,
      data: {
        function: `${MODULE}::create_multi_market`,
        functionArguments: [
          question,
          description,
          category,
          outcomes,
          endTime,
          initialLiquidity,
        ],
      },
    });

    const pendingTx = await aptos.signAndSubmitTransaction({
      signer: account,
      transaction,
    });

    console.log('\nTransaction submitted:', pendingTx.hash);
    console.log('Explorer:', `https://explorer.aptoslabs.com/txn/${pendingTx.hash}?network=testnet`);

    // Wait for confirmation
    const result = await aptos.waitForTransaction({
      transactionHash: pendingTx.hash,
    });

    console.log('\nResult:', result.success ? 'SUCCESS' : 'FAILED');

    // Get market address from events
    if (result.success) {
      // Fetch all multi-outcome markets
      const markets = await aptos.view({
        payload: {
          function: `${MODULE}::get_all_multi_markets`,
          functionArguments: [],
        },
      });
      console.log('\nAll multi-outcome markets:', markets[0]);
    }
  } catch (error: any) {
    console.error('Error:', error.message);
    if (error.transaction) {
      console.log('VM Status:', error.transaction.vm_status);
    }
  }
}

main();
