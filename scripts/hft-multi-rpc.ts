/**
 * HFT MULTI-RPC - Rotate between multiple RPC endpoints for max throughput
 *
 * Uses multiple Aptos clients to distribute load across RPC providers
 *
 * Usage: APTOS_PRIVATE_KEY=0x... npx tsx scripts/hft-multi-rpc.ts [market_address]
 */

import {
  Aptos,
  AptosConfig,
  Network,
  Account,
  Ed25519PrivateKey,
} from '@aptos-labs/ts-sdk';

const CONTRACT_ADDRESS = '0x64a81cb9cbd14d45b87bb32ef73107a44f00069b6a96e70d75369fb7e3da5e68';
const MODULE = `${CONTRACT_ADDRESS}::market`;

// Multiple testnet RPC endpoints
const TESTNET_ENDPOINTS = [
  'https://api.testnet.aptoslabs.com/v1',
  'https://testnet.aptoslabs.com/v1',
  'https://fullnode.testnet.aptoslabs.com/v1',
];

// Create multiple Aptos clients
const clients = TESTNET_ENDPOINTS.map(url => {
  const config = new AptosConfig({
    network: Network.TESTNET,
    fullnode: url,
  });
  return new Aptos(config);
});

// Config
const CONFIG = {
  totalTrades: 50,
  tradeAmountAPT: 0.02,
  delayMs: 50, // Minimal delay
};

interface TradeResult {
  action: string;
  latencyMs: number;
  success: boolean;
  txHash?: string;
  endpoint: string;
}

const results: TradeResult[] = [];

async function getAccount(): Promise<Account> {
  const privateKey = process.env.APTOS_PRIVATE_KEY;
  if (!privateKey) {
    console.error('ERROR: Set APTOS_PRIVATE_KEY');
    process.exit(1);
  }
  return Account.fromPrivateKey({ privateKey: new Ed25519PrivateKey(privateKey) });
}

async function getMarketAddress(): Promise<string> {
  if (process.argv[2]?.startsWith('0x')) return process.argv[2];

  const result = await clients[0].view({
    payload: {
      function: `${MODULE}::get_all_markets`,
      functionArguments: [],
    },
  });

  const markets = result[0] as string[];
  if (!markets.length) {
    console.error('No markets');
    process.exit(1);
  }
  return markets[0];
}

async function executeTrade(
  clientIndex: number,
  account: Account,
  marketAddress: string,
  action: 'buy_yes' | 'buy_no'
): Promise<TradeResult> {
  const client = clients[clientIndex % clients.length];
  const endpoint = TESTNET_ENDPOINTS[clientIndex % clients.length];
  const startTime = Date.now();
  const amountUnits = Math.floor(CONFIG.tradeAmountAPT * 100_000_000);

  try {
    const transaction = await client.transaction.build.simple({
      sender: account.accountAddress,
      data: {
        function: `${MODULE}::${action}`,
        functionArguments: [marketAddress, amountUnits, 0],
      },
    });

    const pendingTx = await client.signAndSubmitTransaction({
      signer: account,
      transaction,
    });

    return {
      action,
      latencyMs: Date.now() - startTime,
      success: true,
      txHash: pendingTx.hash,
      endpoint: endpoint.split('//')[1].split('.')[0],
    };
  } catch (error: any) {
    return {
      action,
      latencyMs: Date.now() - startTime,
      success: false,
      endpoint: endpoint.split('//')[1].split('.')[0],
    };
  }
}

async function main() {
  const account = await getAccount();
  const marketAddress = await getMarketAddress();
  const address = account.accountAddress.toString();

  console.log('════════════════════════════════════════════════════════════════');
  console.log('HFT MULTI-RPC - DISTRIBUTED LOAD');
  console.log('════════════════════════════════════════════════════════════════');
  console.log(`\nAccount: ${address.slice(0, 10)}...`);
  console.log(`Market: ${marketAddress.slice(0, 10)}...`);
  console.log(`Endpoints: ${TESTNET_ENDPOINTS.length}`);
  console.log(`Total Trades: ${CONFIG.totalTrades}\n`);

  const startTime = Date.now();
  const actions: Array<'buy_yes' | 'buy_no'> = ['buy_yes', 'buy_no'];

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < CONFIG.totalTrades; i++) {
    const action = actions[i % 2];
    const result = await executeTrade(i, account, marketAddress, action);
    results.push(result);

    if (result.success) {
      successCount++;
      console.log(`✓ [${result.endpoint}] ${result.latencyMs}ms | ${result.txHash?.slice(0, 12)}...`);
    } else {
      failCount++;
      console.log(`✗ [${result.endpoint}] FAILED`);
    }

    await new Promise(r => setTimeout(r, CONFIG.delayMs));
  }

  const totalTime = Date.now() - startTime;

  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('RESULTS');
  console.log('════════════════════════════════════════════════════════════════');
  console.log(`Time: ${(totalTime / 1000).toFixed(2)}s`);
  console.log(`Success: ${successCount}/${CONFIG.totalTrades} (${((successCount/CONFIG.totalTrades)*100).toFixed(0)}%)`);
  console.log(`TPS: ${(successCount / (totalTime / 1000)).toFixed(2)}`);

  const successful = results.filter(r => r.success);
  if (successful.length) {
    const avg = successful.reduce((a, b) => a + b.latencyMs, 0) / successful.length;
    console.log(`Avg Latency: ${avg.toFixed(0)}ms`);
  }

  // By endpoint
  console.log('\nBy Endpoint:');
  for (const endpoint of TESTNET_ENDPOINTS) {
    const name = endpoint.split('//')[1].split('.')[0];
    const endpointResults = results.filter(r => r.endpoint === name);
    const success = endpointResults.filter(r => r.success).length;
    console.log(`  ${name}: ${success}/${endpointResults.length}`);
  }
}

main().catch(console.error);
