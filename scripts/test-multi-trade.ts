/**
 * Test trading on multi-outcome market
 */

import {
  Aptos,
  AptosConfig,
  Network,
  Account,
  Ed25519PrivateKey,
} from '@aptos-labs/ts-sdk';

const CONTRACT_ADDRESS = '0x3f13249e31a1fbdb886741f7945cccc40307311abc08ba188894bd1a050e19b4';
const MODULE = `${CONTRACT_ADDRESS}::multi_outcome_market`;
const MARKET_ADDRESS = '0x43709b978ab28e43636944edcbad91efcffbf4ec0de026ae0fcf05e0f425f912';

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

  console.log('Testing multi-outcome market trading...\n');

  // Get initial prices
  const pricesBefore = await aptos.view({
    payload: {
      function: `${MODULE}::get_all_prices`,
      functionArguments: [MARKET_ADDRESS],
    },
  });
  console.log('Prices BEFORE trade:', (pricesBefore[0] as string[]).map((p, i) =>
    `${['Trump', 'Biden', 'DeSantis', 'RFK Jr', 'Other'][i]}: ${p}%`
  ).join(', '));

  // Buy Trump (outcome 0) for 0.5 APT
  console.log('\nBuying Trump (outcome 0) for 0.5 APT...');

  try {
    const tx = await aptos.transaction.build.simple({
      sender: account.accountAddress,
      data: {
        function: `${MODULE}::buy_outcome`,
        functionArguments: [
          MARKET_ADDRESS,
          0,              // outcome_index (Trump)
          50_000_000,     // 0.5 APT
          0,              // min_tokens_out (no slippage protection for test)
        ],
      },
    });

    const pendingTx = await aptos.signAndSubmitTransaction({
      signer: account,
      transaction: tx,
    });

    console.log('Transaction:', pendingTx.hash);

    const result = await aptos.waitForTransaction({
      transactionHash: pendingTx.hash,
    });

    console.log('Result:', result.success ? 'SUCCESS' : 'FAILED');

    // Get prices after
    const pricesAfter = await aptos.view({
      payload: {
        function: `${MODULE}::get_all_prices`,
        functionArguments: [MARKET_ADDRESS],
      },
    });
    console.log('\nPrices AFTER trade:', (pricesAfter[0] as string[]).map((p, i) =>
      `${['Trump', 'Biden', 'DeSantis', 'RFK Jr', 'Other'][i]}: ${p}%`
    ).join(', '));

    // Sum of prices
    const sum = (pricesAfter[0] as string[]).reduce((acc, p) => acc + parseInt(p), 0);
    console.log('\nSum of prices:', sum, '% (should be ~100% via arbitrage)');

    // Get user positions
    const positions = await aptos.view({
      payload: {
        function: `${MODULE}::get_user_multi_positions`,
        functionArguments: [MARKET_ADDRESS, account.accountAddress.toString()],
      },
    });
    console.log('\nUser positions (tokens):', (positions[0] as string[]).map((p, i) =>
      `${['Trump', 'Biden', 'DeSantis', 'RFK Jr', 'Other'][i]}: ${(parseInt(p) / 100_000_000).toFixed(4)}`
    ).join(', '));

  } catch (error: any) {
    console.error('Error:', error.message);
    if (error.transaction) {
      console.log('VM Status:', error.transaction.vm_status);
    }
  }
}

main();
