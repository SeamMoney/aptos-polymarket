/**
 * Test a single buy_outcome transaction to verify the setup
 */
import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';
import { deriveAccount } from '../config/seed-accounts';

const CONTRACT = '0xca4d40eae9f07fb28a121862d649203fb4335ece9536ee51790e19f812ff7aea';
const MARKET = '0xaf561030c7ebb22b1d8b99b727c27caab1f6944ce39c141fd2b6b0cfbf614a9e';

async function main() {
  const aptos = new Aptos(new AptosConfig({
    network: Network.TESTNET,
    // Use official testnet API which has indexer
    fullnode: 'https://api.testnet.aptoslabs.com/v1',
  }));

  const mnemonic = process.env.SEED_MNEMONIC;
  if (!mnemonic) {
    console.error('SEED_MNEMONIC not set');
    process.exit(1);
  }

  const account = deriveAccount(mnemonic, 0);
  console.log('Account:', account.accountAddress.toString());
  console.log('Contract:', CONTRACT);
  console.log('Market:', MARKET);

  // Check USD1 balance
  try {
    const balance = await aptos.view({
      payload: {
        function: `${CONTRACT}::usd1::balance`,
        functionArguments: [account.accountAddress.toString()],
      },
    });
    console.log('USD1 Balance:', Number(balance[0]) / 1e8, 'USD1');
  } catch (e: any) {
    console.log('Balance check error:', e.message);
  }

  // Try buying outcome 0
  console.log('\nTrying buy_outcome...');
  try {
    const txn = await aptos.transaction.build.simple({
      sender: account.accountAddress,
      data: {
        function: `${CONTRACT}::multi_outcome_market::buy_outcome`,
        functionArguments: [MARKET, 0, 1_000_000n, 0n], // market, outcome 0, 0.01 USD1, min 0
      },
    });

    console.log('Built transaction, submitting...');

    const result = await aptos.signAndSubmitTransaction({
      signer: account,
      transaction: txn,
    });

    console.log('Submitted:', result.hash);

    const receipt = await aptos.waitForTransaction({ transactionHash: result.hash });
    console.log('Success:', (receipt as any).success);
    console.log('VM Status:', (receipt as any).vm_status);
    if (!(receipt as any).success) {
      console.log('Full result:', JSON.stringify(receipt, null, 2).slice(0, 1000));
    }

  } catch (e: any) {
    console.error('Error:', e.message);
    if (e.message?.includes('Move abort')) {
      console.log('This is a Move VM abort - the contract execution failed');
    }
  }
}

main().catch(console.error);
