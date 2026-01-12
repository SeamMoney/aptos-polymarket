/**
 * Recover APT from multi-outcome market by selling tokens back
 * This recycles the testnet APT that was used for buy_outcome trades
 */

import { Aptos, AptosConfig, Network, Account, Ed25519PrivateKey } from '@aptos-labs/ts-sdk';

const CONTRACT_ADDRESS = '0xa2e5e47aab07fed78a3bcf95135ee2dad20c547499c94cb16a3e047859ffa7e1';
const MULTI_MODULE = `${CONTRACT_ADDRESS}::multi_outcome_market`;
const MARKET_ADDRESS = '0xfefd1b67818ee4ef12a7953852c83f0efb411a9b92c518a52ba92555e4abdd96';
const API_KEY = process.env.APTOS_API_KEY || 'AG-3JMDT54EN4DCLULDWAUXCYGQ56JJQCYHH';

// All 20 trading accounts
const TRADING_ACCOUNTS = [
  '0x6e2fca34586261b6f22a973c20024b78ddb370d87f7c974315fb97ba56716a7f',
  '0xe61d22b3dc37c537a20d5b301c4d2b409b2f93cd7b2915f3518d49517c2ab6c4',
  '0x4542c2e4a39beee8202eee0cddeceea886687b21b54b8f50c17e729251fdd7f5',
  '0xcf5154af9664bbc2634fddfcce2317ed788b35de7f004ac0e24aefd68a0b10c5',
  'ed25519-priv-0xb7d1f406e48c2eddffe987f98445dd4a353e8e9d1630d878621ded084bdd77c7',
  'ed25519-priv-0xa8088ee787b847f6304807a8b09d1afc15409082ee9c8b7eda6919b0ecb86ea8',
  'ed25519-priv-0xb5305eb83498dcba61242ccc91fac35263d9b44bddaf5e7417adbaceb1cfcb36',
  'ed25519-priv-0xc27a6a8b6ed3013da99dc924b2f6af17f1448dedce91691f97d9e778c0761655',
  'ed25519-priv-0xd6402b3493af005ed02b07f6cd7ffdfd37fae6d4d9c88fec6ff38e90f01b21c1',
  'ed25519-priv-0xd375af1a686835905e15bf82f24fcaeed4b1b5b5fabe22c80e998acb804aa295',
  'ed25519-priv-0xC5BA2ED0F5C40EE298E844B1140B6BB31C2671B747C8E9DF4B76054C4C5A8761',
  'ed25519-priv-0x536C886483209657C9B30663B295C7CB007EB57E07931D3E41AF69067897D465',
  'ed25519-priv-0x3E9CB6207207A266F298B1B13648D707BF886766221C3253F30AF68530A79749',
  'ed25519-priv-0x4641D0FDD221B48EF4A45C8DC77D6D4F12D6848E01B7686134564A8CAE5BE637',
  'ed25519-priv-0xFB2AFF37DFED247E9CF407FFA41208A41A78877C1990ADD1F94E00FCE1A5CCAC',
  'ed25519-priv-0x9E338A7FB43F8280CCD82B2929B66F4ED1B7AA7900C40E06EAD934BC7CDEF315',
  'ed25519-priv-0x8E7D4B0196840DA3A7BA6EDEF3784E1B961263F06651B130F440F5D974920B1F',
  'ed25519-priv-0x975CF351CE096E1350C9F9E89ED5CB8D7BEAAEBF7FC235B10F1A0852355EED7A',
  'ed25519-priv-0xD945B44FCFA961B9E4F8DAA5139CF6B4CE9A1DF4838C75701EDC8A429739C097',
  'ed25519-priv-0x292A25EDBE90DCB5F682908C1E7185E1CC127FAD74EEA218167115AA5962866C',
];

function parseKey(k: string): Ed25519PrivateKey {
  return new Ed25519PrivateKey(k.replace('ed25519-priv-', ''));
}

async function main() {
  const aptos = new Aptos(new AptosConfig({
    network: Network.TESTNET,
    clientConfig: { API_KEY },
  }));

  console.log('='.repeat(60));
  console.log('RECOVER APT FROM MULTI-OUTCOME MARKET');
  console.log('='.repeat(60));

  // Use the known market address directly
  const marketAddress = MARKET_ADDRESS;
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
  let totalRecovered = 0;
  for (const privateKey of TRADING_ACCOUNTS) {
    const account = Account.fromPrivateKey({ privateKey: parseKey(privateKey) });
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
      totalRecovered += recovered;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`TOTAL RECOVERED: ${totalRecovered.toFixed(4)} APT`);
  console.log('Run this periodically to recycle APT from trades.');
  console.log('='.repeat(60));
}

main().catch(console.error);
