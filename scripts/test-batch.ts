import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';
import { deriveAccount } from '../config/seed-accounts';

const MNEMONIC = "venture advance oval deliver profit drill chaos cabbage rapid tag south once rifle call flavor vague sword float town vault calm such grocery elder";
const CONTRACT = "0xca4d40eae9f07fb28a121862d649203fb4335ece9536ee51790e19f812ff7aea";
const MARKET = "0xaf561030c7ebb22b1d8b99b727c27caab1f6944ce39c141fd2b6b0cfbf614a9e";

async function testBatch() {
  const aptos = new Aptos(new AptosConfig({
    network: Network.TESTNET,
    fullnode: 'https://api.testnet.aptoslabs.com/v1',
  }));
  
  const account = deriveAccount(MNEMONIC, 0);
  console.log('Account:', account.accountAddress.toString());
  
  // Test building 5 transactions in parallel
  const BATCH_SIZE = 5;
  console.log(`Building ${BATCH_SIZE} transactions in parallel...`);
  
  const buildPromises = [];
  for (let i = 0; i < BATCH_SIZE; i++) {
    const amount = BigInt(1_000_000);
    const payload = {
      function: `${CONTRACT}::multi_outcome_market::buy_outcome` as const,
      functionArguments: [MARKET, 0, amount, 0n],
    };
    
    buildPromises.push(
      aptos.transaction.build.simple({
        sender: account.accountAddress,
        data: payload,
        options: {
          replayProtectionNonce: BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)),
          expireTimestamp: Math.floor(Date.now() / 1000) + 55,
        },
      }).then(tx => {
        console.log(`TX ${i}: Built successfully`);
        return tx;
      }).catch(err => {
        console.log(`TX ${i}: Build FAILED - ${err.message}`);
        return null;
      })
    );
  }
  
  const results = await Promise.all(buildPromises);
  const successCount = results.filter(r => r !== null).length;
  console.log(`\nBuilt ${successCount}/${BATCH_SIZE} transactions`);
}

testBatch().catch(console.error);
