import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';
import { deriveAccount } from '../config/seed-accounts';

const CONTRACT = '0xca4d40eae9f07fb28a121862d649203fb4335ece9536ee51790e19f812ff7aea';
const MARKET = '0xaf561030c7ebb22b1d8b99b727c27caab1f6944ce39c141fd2b6b0cfbf614a9e';

async function main() {
  const aptos = new Aptos(new AptosConfig({
    network: Network.TESTNET,
    fullnode: 'http://vfn0.usce1-0.testnet.aptoslabs.com:80',
  }));

  const mnemonic = process.env.SEED_MNEMONIC!;
  const account = deriveAccount(mnemonic, 0);
  console.log('Account:', account.accountAddress.toString());

  // Check USD1 balance
  const balance = await aptos.view({
    payload: {
      function: \`\${CONTRACT}::usd1::balance\`,
      functionArguments: [account.accountAddress.toString()],
    },
  });
  console.log('USD1 Balance:', Number(balance[0]) / 1e8);

  // Try buy
  console.log('\nBuying outcome 0...');
  try {
    const tx = await aptos.transaction.build.simple({
      sender: account.accountAddress,
      data: {
        function: \`\${CONTRACT}::multi_outcome_market::buy_outcome\`,
        functionArguments: [MARKET, 0, 1000000n, 0n],
      },
    });
    const signed = aptos.transaction.sign({ signer: account, transaction: tx });
    const result = await aptos.transaction.submit.simple({ transaction: tx, senderAuthenticator: signed });
    console.log('Hash:', result.hash);
    const receipt = await aptos.waitForTransaction({ transactionHash: result.hash });
    console.log('Success:', receipt.success, 'VM:', receipt.vm_status);
  } catch (e: any) {
    console.log('Error:', e.message);
  }
}

main();
