/**
 * Test a single transaction to diagnose failures
 */

import { Aptos, AptosConfig, Network, Account, Ed25519PrivateKey } from '@aptos-labs/ts-sdk';

const CONTRACT_ADDRESS = '0x3f13249e31a1fbdb886741f7945cccc40307311abc08ba188894bd1a050e19b4';
const MULTI_MODULE = `${CONTRACT_ADDRESS}::multi_outcome_market`;
const MODULE = `${CONTRACT_ADDRESS}::market`;

const PRIVATE_KEY = '0x6e2fca34586261b6f22a973c20024b78ddb370d87f7c974315fb97ba56716a7f';
const API_KEY = process.env.APTOS_API_KEY || 'AG-3JMDT54EN4DCLULDWAUXCYGQ56JJQCYHH';

async function main() {
  const aptos = new Aptos(new AptosConfig({
    network: Network.TESTNET,
    clientConfig: API_KEY ? { API_KEY } : undefined,
  }));

  const account = Account.fromPrivateKey({ privateKey: new Ed25519PrivateKey(PRIVATE_KEY) });

  console.log('='.repeat(60));
  console.log('SINGLE TRANSACTION TEST');
  console.log('='.repeat(60));
  console.log(`\nAccount: ${account.accountAddress.toString()}`);

  // Get balance
  const balance = await aptos.getAccountAPTAmount({ accountAddress: account.accountAddress });
  console.log(`Balance: ${(balance / 1e8).toFixed(2)} APT`);

  // Get sequence number
  const accInfo = await aptos.getAccountInfo({ accountAddress: account.accountAddress });
  console.log(`Sequence: ${accInfo.sequence_number}`);

  // Get multi-outcome market
  console.log('\n--- Getting market ---');
  const marketsResult = await aptos.view({
    payload: {
      function: `${MULTI_MODULE}::get_all_multi_markets`,
      functionArguments: [],
    },
  });
  const markets = marketsResult[0] as string[];
  console.log(`Multi-outcome markets: ${markets.length}`);

  if (markets.length === 0) {
    console.log('No multi-outcome markets found. Checking binary markets...');
    const binaryResult = await aptos.view({
      payload: {
        function: `${MODULE}::get_all_markets`,
        functionArguments: [],
      },
    });
    const binaryMarkets = binaryResult[0] as string[];
    console.log(`Binary markets: ${binaryMarkets.length}`);

    if (binaryMarkets.length === 0) {
      console.error('ERROR: No markets found!');
      process.exit(1);
    }
  }

  const marketAddress = markets[0];
  console.log(`Market: ${marketAddress}`);

  // Get market info
  const infoResult = await aptos.view({
    payload: {
      function: `${MULTI_MODULE}::get_multi_market_info`,
      functionArguments: [marketAddress],
    },
  });
  console.log(`Outcome count: ${infoResult[3]}`);

  // Try to buy outcome
  console.log('\n--- Attempting buy_outcome ---');
  const amount = BigInt(1_000_000); // 0.01 APT
  const outcomeIndex = 0;
  const minTokens = 0n;

  try {
    const tx = await aptos.transaction.build.simple({
      sender: account.accountAddress,
      data: {
        function: `${MULTI_MODULE}::buy_outcome`,
        functionArguments: [marketAddress, outcomeIndex, amount, minTokens],
      },
    });

    console.log('Transaction built successfully');

    const signedTx = aptos.transaction.sign({
      signer: account,
      transaction: tx,
    });

    console.log('Transaction signed');

    const pending = await aptos.transaction.submit.simple({
      transaction: tx,
      senderAuthenticator: signedTx,
    });

    console.log(`Transaction submitted: ${pending.hash}`);

    // Wait for confirmation
    const result = await aptos.waitForTransaction({ transactionHash: pending.hash });
    console.log(`Transaction confirmed! Success: ${result.success}`);

    if (!result.success) {
      console.error('Transaction failed:', result.vm_status);
    }

  } catch (e: any) {
    console.error('\n!!! TRANSACTION FAILED !!!');
    console.error('Error message:', e.message);
    console.error('\nFull error:');
    console.error(JSON.stringify(e, null, 2));
  }
}

main().catch(console.error);
