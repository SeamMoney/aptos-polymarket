/**
 * HFT MAINNET - Maximum throughput with Geomi API key
 *
 * Requirements:
 * 1. Deploy contract to mainnet first (scripts/deploy-mainnet.ts)
 * 2. Create a market with liquidity
 * 3. Have APT in your account
 *
 * Usage: APTOS_PRIVATE_KEY=0x... npx tsx scripts/hft-mainnet.ts [market_address]
 */

import {
  Aptos,
  AptosConfig,
  Network,
  Account,
  Ed25519PrivateKey,
} from '@aptos-labs/ts-sdk';

// ⚠️ UPDATE THIS AFTER MAINNET DEPLOYMENT
const CONTRACT_ADDRESS = 'YOUR_MAINNET_CONTRACT_ADDRESS';
const MODULE = `${CONTRACT_ADDRESS}::market`;

// Geomi API key for authenticated mainnet access (higher rate limits)
const GEOMI_API_KEY = 'AG-PBRRDTVTGPEDATI1NHY3UANNUYSKBPJMA';

const aptosConfig = new AptosConfig({
  network: Network.MAINNET,
  clientConfig: {
    HEADERS: {
      'Authorization': `Bearer ${GEOMI_API_KEY}`,
    },
  },
});
const aptos = new Aptos(aptosConfig);

// High-throughput config
const CONFIG = {
  totalTrades: 100,
  tradeAmountAPT: 0.01, // Small trades
  delayMs: 50, // Minimal delay with API key
  botName: process.env.BOT_NAME || 'MainnetBot',
};

interface TradeResult {
  action: string;
  latencyMs: number;
  success: boolean;
  txHash?: string;
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

async function getBalance(address: string): Promise<number> {
  const balance = await aptos.getAccountAPTAmount({ accountAddress: address });
  return balance / 100_000_000;
}

async function getMarketAddress(): Promise<string> {
  if (process.argv[2]?.startsWith('0x')) return process.argv[2];

  console.log('Fetching markets from contract...');
  const result = await aptos.view({
    payload: {
      function: `${MODULE}::get_all_markets`,
      functionArguments: [],
    },
  });

  const markets = result[0] as string[];
  if (!markets.length) {
    console.error('No markets found. Create one first.');
    process.exit(1);
  }
  console.log(`Found ${markets.length} market(s)`);
  return markets[0];
}

async function executeTrade(
  account: Account,
  marketAddress: string,
  action: 'buy_yes' | 'buy_no'
): Promise<TradeResult> {
  const startTime = Date.now();
  const amountUnits = Math.floor(CONFIG.tradeAmountAPT * 100_000_000);

  try {
    const transaction = await aptos.transaction.build.simple({
      sender: account.accountAddress,
      data: {
        function: `${MODULE}::${action}`,
        functionArguments: [marketAddress, amountUnits, 0],
      },
    });

    const pendingTx = await aptos.signAndSubmitTransaction({
      signer: account,
      transaction,
    });

    // Wait for confirmation
    await aptos.waitForTransaction({ transactionHash: pendingTx.hash });

    return {
      action,
      latencyMs: Date.now() - startTime,
      success: true,
      txHash: pendingTx.hash,
    };
  } catch (error: any) {
    return {
      action,
      latencyMs: Date.now() - startTime,
      success: false,
    };
  }
}

async function main() {
  if (CONTRACT_ADDRESS === 'YOUR_MAINNET_CONTRACT_ADDRESS') {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('⚠️  MAINNET CONTRACT NOT DEPLOYED');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('\nTo use mainnet HFT:');
    console.log('1. Get mainnet APT (buy from exchange)');
    console.log('2. Deploy contract: npx tsx scripts/deploy-mainnet.ts');
    console.log('3. Update CONTRACT_ADDRESS in this file');
    console.log('4. Create a market with liquidity');
    console.log('5. Run this script again\n');

    // Demo rate limit test
    console.log('Testing Geomi API rate limit on mainnet...');
    const start = Date.now();
    const promises = [];
    for (let i = 0; i < 50; i++) {
      promises.push(aptos.getLedgerInfo());
    }
    await Promise.all(promises);
    console.log(`✓ 50 concurrent requests in ${Date.now() - start}ms`);
    console.log('\nWith Geomi API key, mainnet has much higher rate limits!');
    return;
  }

  const account = await getAccount();
  const marketAddress = await getMarketAddress();
  const address = account.accountAddress.toString();
  const balance = await getBalance(address);

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('HFT MAINNET - MAXIMUM THROUGHPUT');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`\nAccount: ${address.slice(0, 10)}...${address.slice(-8)}`);
  console.log(`Balance: ${balance.toFixed(4)} APT`);
  console.log(`Market: ${marketAddress.slice(0, 10)}...`);
  console.log(`API Key: Geomi (authenticated)`);
  console.log(`Trades: ${CONFIG.totalTrades}`);
  console.log(`Delay: ${CONFIG.delayMs}ms\n`);

  const startTime = Date.now();
  const actions: Array<'buy_yes' | 'buy_no'> = ['buy_yes', 'buy_no'];
  let successCount = 0;

  for (let i = 0; i < CONFIG.totalTrades; i++) {
    const action = actions[i % 2];
    const result = await executeTrade(account, marketAddress, action);
    results.push(result);

    if (result.success) {
      successCount++;
      process.stdout.write(`\r✓ ${successCount}/${CONFIG.totalTrades} | ${result.latencyMs}ms`);
    } else {
      process.stdout.write(`\r✗ Failed at trade ${i + 1}`);
    }

    await new Promise(r => setTimeout(r, CONFIG.delayMs));
  }

  const totalTime = Date.now() - startTime;

  console.log('\n\n═══════════════════════════════════════════════════════════════');
  console.log('RESULTS');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Time: ${(totalTime / 1000).toFixed(2)}s`);
  console.log(`Success: ${successCount}/${CONFIG.totalTrades}`);
  console.log(`TPS: ${(successCount / (totalTime / 1000)).toFixed(2)}`);

  const successful = results.filter(r => r.success);
  if (successful.length) {
    const avg = successful.reduce((a, b) => a + b.latencyMs, 0) / successful.length;
    console.log(`Avg Latency: ${avg.toFixed(0)}ms`);
    console.log(`Min Latency: ${Math.min(...successful.map(r => r.latencyMs))}ms`);
  }

  console.log('\nSample transactions:');
  results.slice(0, 5).forEach((r, i) => {
    if (r.txHash) {
      console.log(`  ${i + 1}. https://explorer.aptoslabs.com/txn/${r.txHash}?network=mainnet`);
    }
  });
}

main().catch(console.error);
