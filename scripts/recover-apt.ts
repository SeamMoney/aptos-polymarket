/**
 * Recover APT from multi-outcome market by selling tokens back
 * This recycles the testnet APT that was used for buy_outcome trades
 */

import { Aptos, AptosConfig, Network, Account, Ed25519PrivateKey } from '@aptos-labs/ts-sdk';

const CONTRACT_ADDRESS = '0x3f13249e31a1fbdb886741f7945cccc40307311abc08ba188894bd1a050e19b4';
const MULTI_MODULE = `${CONTRACT_ADDRESS}::multi_outcome_market`;
const API_KEY = process.env.APTOS_API_KEY || 'AG-3JMDT54EN4DCLULDWAUXCYGQ56JJQCYHH';

const TRADING_ACCOUNTS = [
  '0x6e2fca34586261b6f22a973c20024b78ddb370d87f7c974315fb97ba56716a7f',
  '0xe61d22b3dc37c537a20d5b301c4d2b409b2f93cd7b2915f3518d49517c2ab6c4',
  '0x4542c2e4a39beee8202eee0cddeceea886687b21b54b8f50c17e729251fdd7f5',
  '0xcf5154af9664bbc2634fddfcce2317ed788b35de7f004ac0e24aefd68a0b10c5',
];

async function main() {
  const aptos = new Aptos(new AptosConfig({
    network: Network.TESTNET,
    clientConfig: { API_KEY },
  }));

  console.log('='.repeat(60));
  console.log('RECOVER APT FROM MULTI-OUTCOME MARKET');
  console.log('='.repeat(60));

  // Get market address
  const marketsResult = await aptos.view({
    payload: {
      function: `${MULTI_MODULE}::get_all_multi_markets`,
      functionArguments: [],
    },
  });
  const markets = marketsResult[0] as string[];
  if (markets.length === 0) {
    console.log('No multi-outcome markets found');
    return;
  }
  const marketAddress = markets[0];
  console.log(`\nMarket: ${marketAddress}`);

  // Get market info
  const info = await aptos.view({
    payload: {
      function: `${MULTI_MODULE}::get_multi_market_info`,
      functionArguments: [marketAddress],
    },
  });
  const outcomeCount = Number(info[3]);
  const totalCollateral = Number(info[7]) / 100_000_000;
  console.log(`Outcomes: ${outcomeCount}`);
  console.log(`Total Collateral (TVL): ${totalCollateral.toFixed(2)} APT`);

  // For each trading account, sell all tokens
  for (const privateKey of TRADING_ACCOUNTS) {
    const account = Account.fromPrivateKey({ privateKey: new Ed25519PrivateKey(privateKey) });
    const addr = account.accountAddress.toString();
    console.log(`\n--- Account: ${addr.slice(0, 12)}... ---`);

    // Check balance before
    const balanceBefore = await aptos.getAccountAPTAmount({ accountAddress: account.accountAddress });
    console.log(`Balance before: ${(balanceBefore / 1e8).toFixed(4)} APT`);

    // Get all positions at once
    try {
      const positionsResult = await aptos.view({
        payload: {
          function: `${MULTI_MODULE}::get_user_multi_positions`,
          functionArguments: [marketAddress, addr],
        },
      });
      const positions = positionsResult[0] as string[];

      // For each outcome with tokens, sell them
      for (let i = 0; i < positions.length; i++) {
        const tokens = Number(positions[i]);
        if (tokens > 0) {
          console.log(`  Outcome ${i}: ${(tokens / 1e8).toFixed(4)} tokens`);

          try {
            // Sell tokens
            const tx = await aptos.transaction.build.simple({
              sender: account.accountAddress,
              data: {
                function: `${MULTI_MODULE}::sell_outcome`,
                functionArguments: [marketAddress, i, tokens, 0], // sell all, min 0 APT
              },
            });

            const signed = aptos.transaction.sign({ signer: account, transaction: tx });
            const pending = await aptos.transaction.submit.simple({
              transaction: tx,
              senderAuthenticator: signed,
            });
            await aptos.waitForTransaction({ transactionHash: pending.hash });
            console.log(`    Sold! tx: ${pending.hash.slice(0, 20)}...`);
          } catch (e: any) {
            console.log(`    Sell error: ${e.message?.slice(0, 60)}`);
          }
        }
      }
    } catch (e: any) {
      console.log(`  Error getting positions: ${e.message?.slice(0, 60)}`);
    }

    // Check balance after
    const balanceAfter = await aptos.getAccountAPTAmount({ accountAddress: account.accountAddress });
    const recovered = (balanceAfter - balanceBefore) / 1e8;
    console.log(`Balance after: ${(balanceAfter / 1e8).toFixed(4)} APT`);
    if (recovered > 0) {
      console.log(`  Recovered: +${recovered.toFixed(4)} APT`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('Done! Run this periodically to recycle APT.');
  console.log('='.repeat(60));
}

main().catch(console.error);
