/**
 * Test Indexing Bot
 *
 * A slow bot that trades on each of the 12 markets to verify:
 * 1. Geomi indexes all events correctly
 * 2. Trade streams show on correct market pages
 * 3. All event fields are captured properly
 *
 * Usage:
 *   source .env.usd1
 *   npx tsx scripts/test-indexing-bot.ts
 *
 * Options:
 *   --delay=5000     Delay between trades in ms (default: 5000)
 *   --rounds=2       Number of rounds through all markets (default: 2)
 *   --amount=20      Trade amount in USD1 (default: 20)
 */

import {
  Aptos,
  AptosConfig,
  Network,
  Account,
  Ed25519PrivateKey,
} from '@aptos-labs/ts-sdk';

// Contract address
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || '0xbdea15f5b0f5449ae8f3a6ae95a5e090bdeeec91be1fcac8375b2f5f37f1c134';
const MODULE = `${CONTRACT_ADDRESS}::multi_outcome_market` as const;

// Market names for logging (matches deploy order)
const MARKET_NAMES = [
  'Republican 2028 Nominee',
  'WLFI Banking Charter',
  'Trump Greenland',
  'Fed Chair Nominee',
  'Iran Khamenei Binary',
  'China Taiwan',
  'Russia Ukraine Ceasefire',
  'Venezuela Leadership',
  'Fed Jan 2026',
  'BTC Q1 2026',
  'BTC $150K',
  'Iran Khamenei Date',
];

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    delay: 5000,
    rounds: 2,
    amount: 20,
  };

  for (const arg of args) {
    if (arg.startsWith('--delay=')) {
      config.delay = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--rounds=')) {
      config.rounds = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--amount=')) {
      config.amount = parseInt(arg.split('=')[1], 10);
    }
  }

  return config;
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getMarketInfo(aptos: Aptos, marketAddress: string) {
  try {
    const result = await aptos.view({
      payload: {
        function: `${MODULE}::get_multi_market_info`,
        functionArguments: [marketAddress],
      },
    });
    // Returns: (question, description, category, outcome_count, end_time, resolved, winning_outcome, total_collateral)
    return {
      outcomeCount: Number(result[3]),
      question: result[0] as string,
    };
  } catch (error) {
    console.error(`Failed to get market info for ${marketAddress}:`, error);
    return { outcomeCount: 4, question: 'Unknown' };
  }
}

async function buyOutcome(
  aptos: Aptos,
  account: Account,
  marketAddress: string,
  outcomeIndex: number,
  amount: number
): Promise<{ success: boolean; hash?: string; error?: string }> {
  try {
    // Amount in USD1 units (8 decimals)
    const amountUnits = BigInt(Math.floor(amount * 100_000_000));
    // min_tokens_out = 1 (minimal slippage protection for testing)
    const minTokensOut = BigInt(1);

    const txn = await aptos.transaction.build.simple({
      sender: account.accountAddress,
      data: {
        function: `${MODULE}::buy_outcome`,
        functionArguments: [marketAddress, outcomeIndex, amountUnits, minTokensOut],
      },
    });

    const signedTxn = aptos.transaction.sign({
      signer: account,
      transaction: txn,
    });

    const pendingTxn = await aptos.transaction.submit.simple({
      senderAuthenticator: signedTxn,
      transaction: txn,
    });

    const result = await aptos.waitForTransaction({
      transactionHash: pendingTxn.hash,
    });

    return {
      success: result.success,
      hash: pendingTxn.hash,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || String(error),
    };
  }
}

async function sellOutcome(
  aptos: Aptos,
  account: Account,
  marketAddress: string,
  outcomeIndex: number,
  tokenAmount: number
): Promise<{ success: boolean; hash?: string; error?: string }> {
  try {
    // Token amount in units (8 decimals)
    const amountUnits = BigInt(Math.floor(tokenAmount * 100_000_000));
    // min_collateral_out = 1 (minimal slippage protection for testing)
    const minCollateralOut = BigInt(1);

    const txn = await aptos.transaction.build.simple({
      sender: account.accountAddress,
      data: {
        function: `${MODULE}::sell_outcome`,
        functionArguments: [marketAddress, outcomeIndex, amountUnits, minCollateralOut],
      },
    });

    const signedTxn = aptos.transaction.sign({
      signer: account,
      transaction: txn,
    });

    const pendingTxn = await aptos.transaction.submit.simple({
      senderAuthenticator: signedTxn,
      transaction: txn,
    });

    const result = await aptos.waitForTransaction({
      transactionHash: pendingTxn.hash,
    });

    return {
      success: result.success,
      hash: pendingTxn.hash,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || String(error),
    };
  }
}

async function main() {
  const config = parseArgs();

  console.log('\n=== Test Indexing Bot ===');
  console.log(`Delay: ${config.delay}ms between trades`);
  console.log(`Rounds: ${config.rounds} rounds through all markets`);
  console.log(`Amount: ${config.amount} USD1 per trade`);
  console.log('');

  // Load private key
  const privateKey = process.env.APTOS_PRIVATE_KEY;
  if (!privateKey) {
    console.error('ERROR: APTOS_PRIVATE_KEY not set');
    console.error('Run: source .env.usd1');
    process.exit(1);
  }

  // Load market addresses
  const marketsEnv = process.env.MULTI_MARKETS;
  if (!marketsEnv) {
    console.error('ERROR: MULTI_MARKETS not set');
    console.error('Run: source .env.usd1');
    process.exit(1);
  }

  const marketAddresses = marketsEnv.split(',').map(m => m.trim());
  console.log(`Found ${marketAddresses.length} markets\n`);

  // Initialize Aptos client
  const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));

  // Initialize account
  const keyHex = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey;
  const account = Account.fromPrivateKey({
    privateKey: new Ed25519PrivateKey(keyHex),
  });
  console.log(`Trading account: ${account.accountAddress.toString()}`);

  // Get account balance
  try {
    const balance = await aptos.getAccountAPTAmount({ accountAddress: account.accountAddress });
    console.log(`APT Balance: ${(balance / 100_000_000).toFixed(4)} APT`);
  } catch {
    console.log('Could not fetch APT balance');
  }

  console.log('\n--- Starting Test Trades ---\n');

  let totalTrades = 0;
  let successfulTrades = 0;
  let failedTrades = 0;
  const results: Array<{
    round: number;
    market: string;
    marketAddress: string;
    action: string;
    outcome: number;
    amount: number;
    success: boolean;
    hash?: string;
    error?: string;
    timestamp: string;
  }> = [];

  for (let round = 1; round <= config.rounds; round++) {
    console.log(`\n=== Round ${round}/${config.rounds} ===\n`);

    for (let i = 0; i < marketAddresses.length; i++) {
      const marketAddress = marketAddresses[i];
      const marketName = MARKET_NAMES[i] || `Market ${i + 1}`;

      // Get market info to know outcome count
      const marketInfo = await getMarketInfo(aptos, marketAddress);
      const outcomeIndex = (totalTrades % marketInfo.outcomeCount);
      const action = round % 2 === 1 ? 'BUY' : 'SELL'; // Alternate buy/sell per round

      console.log(`[${new Date().toISOString()}] ${marketName}`);
      console.log(`  Market: ${marketAddress.slice(0, 10)}...${marketAddress.slice(-6)}`);
      console.log(`  Action: ${action} outcome ${outcomeIndex}`);
      console.log(`  Amount: ${config.amount} USD1`);

      let result;
      if (action === 'BUY') {
        result = await buyOutcome(aptos, account, marketAddress, outcomeIndex, config.amount);
      } else {
        // For sell, use smaller amount (we may not have many tokens)
        result = await sellOutcome(aptos, account, marketAddress, outcomeIndex, config.amount * 0.5);
      }

      totalTrades++;
      if (result.success) {
        successfulTrades++;
        console.log(`  ✅ Success: ${result.hash}`);
        console.log(`  Explorer: https://explorer.aptoslabs.com/txn/${result.hash}?network=testnet`);
      } else {
        failedTrades++;
        console.log(`  ❌ Failed: ${result.error}`);
      }

      results.push({
        round,
        market: marketName,
        marketAddress,
        action,
        outcome: outcomeIndex,
        amount: config.amount,
        success: result.success,
        hash: result.hash,
        error: result.error,
        timestamp: new Date().toISOString(),
      });

      // Wait before next trade
      if (i < marketAddresses.length - 1 || round < config.rounds) {
        console.log(`  Waiting ${config.delay / 1000}s before next trade...\n`);
        await sleep(config.delay);
      }
    }
  }

  // Summary
  console.log('\n\n=== Summary ===');
  console.log(`Total trades: ${totalTrades}`);
  console.log(`Successful: ${successfulTrades} (${((successfulTrades / totalTrades) * 100).toFixed(1)}%)`);
  console.log(`Failed: ${failedTrades}`);

  // Market breakdown
  console.log('\n=== Trades by Market ===');
  const byMarket = new Map<string, { success: number; fail: number; hashes: string[] }>();
  for (const r of results) {
    const key = r.market;
    if (!byMarket.has(key)) {
      byMarket.set(key, { success: 0, fail: 0, hashes: [] });
    }
    const m = byMarket.get(key)!;
    if (r.success) {
      m.success++;
      if (r.hash) m.hashes.push(r.hash);
    } else {
      m.fail++;
    }
  }

  for (const [market, stats] of byMarket.entries()) {
    console.log(`\n${market}:`);
    console.log(`  Success: ${stats.success}, Failed: ${stats.fail}`);
    if (stats.hashes.length > 0) {
      console.log(`  Tx Hashes: ${stats.hashes.join(', ')}`);
    }
  }

  // Output for Geomi verification
  console.log('\n\n=== Verify in Geomi ===');
  console.log('Run this GraphQL query to check indexing:');
  console.log(`
query {
  trades(limit: ${totalTrades}, order_by: {timestamp: desc}) {
    tx_hash
    market_address
    trader
    outcome_index
    collateral_amount
    token_amount
    new_price
    event_type
    timestamp
  }
}
  `);

  console.log('\n=== Test Complete ===\n');
}

main().catch(console.error);
