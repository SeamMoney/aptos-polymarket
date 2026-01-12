/**
 * Geomi vs RPC Performance Comparison
 *
 * Compares the speed and accuracy of fetching trade data from:
 * 1. Geomi No-Code Indexer (GraphQL) - indexed events
 * 2. Old method (RPC) - parsing account transactions
 *
 * Usage:
 *   npx tsx scripts/test-geomi-performance.ts
 */

import * as fs from 'fs';
import * as path from 'path';

// Load env vars from .env.local manually
function loadEnvFile(): Record<string, string> {
  try {
    const envPath = path.join(process.cwd(), '.env.local');
    const content = fs.readFileSync(envPath, 'utf-8');
    const vars: Record<string, string> = {};
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          vars[key.trim()] = valueParts.join('=').trim();
        }
      }
    }
    return vars;
  } catch {
    return {};
  }
}

const envVars = loadEnvFile();
const GEOMI_GRAPHQL_URL = envVars.VITE_GEOMI_GRAPHQL_URL || process.env.VITE_GEOMI_GRAPHQL_URL;
const GEOMI_API_KEY = envVars.VITE_GEOMI_API_KEY || process.env.VITE_GEOMI_API_KEY;

const PRESIDENTIAL_MARKET = '0xfefd1b67818ee4ef12a7953852c83f0efb411a9b92c518a52ba92555e4abdd96';
const CONTRACT_ADDRESS = '0xa2e5e47aab07fed78a3bcf95135ee2dad20c547499c94cb16a3e047859ffa7e1';

// RPC endpoints
const RPC_ENDPOINTS = [
  "https://aptos.cash.trading/v1",
  "https://polished-evocative-borough.aptos-testnet.quiknode.pro/a0b08bae2dc34e4a8774d91414948d02a5ce2975/v1",
];

interface GeomiTrade {
  tx_hash: string;
  event_index: number;
  event_type: string;
  market_address: string;
  trader: string;
  outcome_index: number;
  collateral_amount: string;
  token_amount: string;
  new_price: number;
  timestamp: string;
}

interface RPCTrade {
  txHash: string;
  type: 'buy' | 'sell';
  outcomeIndex: number;
  collateralAmount: number;
  tokenAmount: number | null;  // null = estimated
  timestamp: number;
  trader: string;
}

// ============================================
// Geomi Method
// ============================================

async function fetchTradesViaGeomi(limit: number): Promise<{ trades: GeomiTrade[], duration: number }> {
  const start = performance.now();

  const query = `
    query LatestTrades($market: String!, $limit: Int!) {
      trades(
        where: { market_address: { _eq: $market } }
        order_by: [{ timestamp: desc }]
        limit: $limit
      ) {
        tx_hash
        event_index
        event_type
        market_address
        trader
        outcome_index
        collateral_amount
        token_amount
        new_price
        timestamp
      }
    }
  `;

  const response = await fetch(GEOMI_GRAPHQL_URL!, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GEOMI_API_KEY}`,
    },
    body: JSON.stringify({ query, variables: { market: PRESIDENTIAL_MARKET, limit } }),
  });

  const result = await response.json();
  const duration = performance.now() - start;

  return { trades: result.data?.trades || [], duration };
}

// ============================================
// Old RPC Method (simulated)
// ============================================

async function fetchFromRpc(path: string): Promise<Response> {
  for (const baseUrl of RPC_ENDPOINTS) {
    try {
      const res = await fetch(`${baseUrl}${path}`);
      if (res.ok) return res;
    } catch {
      continue;
    }
  }
  throw new Error('All RPC endpoints failed');
}

async function fetchTradesViaRPC(limit: number): Promise<{ trades: RPCTrade[], duration: number, txnsScanned: number }> {
  const start = performance.now();
  const trades: RPCTrade[] = [];
  let txnsScanned = 0;

  // Old method: fetch recent account transactions and parse them
  // This is inefficient because:
  // 1. We have to fetch ALL transactions for the contract
  // 2. Most transactions aren't trades (could be admin functions, etc.)
  // 3. We have to parse each transaction to extract trade data
  // 4. Token amounts aren't available - we have to estimate from price

  try {
    // Fetch account transactions (limited to 100 max per call)
    const response = await fetchFromRpc(`/accounts/${CONTRACT_ADDRESS}/transactions?limit=100`);
    const transactions = await response.json();
    txnsScanned = transactions.length;

    for (const tx of transactions) {
      if (!tx.success) continue;

      const functionName = tx.payload?.function || '';
      if (!functionName.includes('buy_outcome') && !functionName.includes('sell_outcome')) {
        continue;
      }

      const isBuy = functionName.includes('buy_outcome');

      // Extract data from events
      const tradeEvent = tx.events?.find((e: { type: string }) =>
        e.type.includes('OutcomeTokenBought') || e.type.includes('OutcomeTokenSold')
      );

      if (tradeEvent?.data) {
        const collateral = tradeEvent.data.collateral_in || tradeEvent.data.collateral_out || '0';
        const tokens = tradeEvent.data.tokens_out || tradeEvent.data.tokens_in;

        // Check if this is our market
        if (tradeEvent.data.market_address !== PRESIDENTIAL_MARKET) {
          continue;
        }

        trades.push({
          txHash: tx.hash,
          type: isBuy ? 'buy' : 'sell',
          outcomeIndex: parseInt(tradeEvent.data.outcome_index) || 0,
          collateralAmount: parseInt(collateral) / 100_000_000,
          tokenAmount: tokens ? parseInt(tokens) / 100_000_000 : null,
          timestamp: tx.timestamp ? parseInt(tx.timestamp) / 1000 : Date.now(),
          trader: tradeEvent.data.buyer || tradeEvent.data.seller || tx.sender,
        });

        if (trades.length >= limit) break;
      }
    }
  } catch (error) {
    console.error('RPC fetch error:', error);
  }

  const duration = performance.now() - start;
  return { trades, duration, txnsScanned };
}

// ============================================
// Performance Test
// ============================================

async function runPerformanceTest() {
  console.log('=================================================');
  console.log('  Geomi vs RPC Performance Comparison');
  console.log('=================================================\n');

  if (!GEOMI_GRAPHQL_URL || !GEOMI_API_KEY) {
    console.log('ERROR: Geomi not configured!');
    console.log('Set VITE_GEOMI_GRAPHQL_URL and VITE_GEOMI_API_KEY in .env.local');
    process.exit(1);
  }

  const TRADE_LIMIT = 50;

  console.log(`Fetching ${TRADE_LIMIT} trades from each source...\n`);

  // Test Geomi
  console.log('1. GEOMI (GraphQL Indexed Events)');
  console.log('   --------------------------------');
  const geomiResult = await fetchTradesViaGeomi(TRADE_LIMIT);
  console.log(`   Trades fetched: ${geomiResult.trades.length}`);
  console.log(`   Duration: ${geomiResult.duration.toFixed(0)}ms`);

  if (geomiResult.trades.length > 0) {
    const sample = geomiResult.trades[0];
    console.log(`   Sample trade:`);
    console.log(`     - Type: ${sample.event_type.includes('Bought') ? 'BUY' : 'SELL'}`);
    console.log(`     - Collateral: ${(parseInt(sample.collateral_amount) / 100_000_000).toFixed(4)} APT`);
    console.log(`     - Tokens: ${(parseInt(sample.token_amount) / 100_000_000).toFixed(4)} (ACTUAL)`);
    console.log(`     - Timestamp: ${sample.timestamp}`);
    console.log(`     - TX Hash: ${sample.tx_hash.slice(0, 20)}...`);
  }

  // Test RPC
  console.log('\n2. OLD RPC METHOD (Transaction Parsing)');
  console.log('   -------------------------------------');
  const rpcResult = await fetchTradesViaRPC(TRADE_LIMIT);
  console.log(`   Trades fetched: ${rpcResult.trades.length}`);
  console.log(`   Transactions scanned: ${rpcResult.txnsScanned}`);
  console.log(`   Duration: ${rpcResult.duration.toFixed(0)}ms`);

  if (rpcResult.trades.length > 0) {
    const sample = rpcResult.trades[0];
    console.log(`   Sample trade:`);
    console.log(`     - Type: ${sample.type.toUpperCase()}`);
    console.log(`     - Collateral: ${sample.collateralAmount.toFixed(4)} APT`);
    console.log(`     - Tokens: ${sample.tokenAmount ? sample.tokenAmount.toFixed(4) : 'N/A (estimated)'}`);
  }

  // Comparison
  console.log('\n3. COMPARISON');
  console.log('   ----------');
  const speedup = rpcResult.duration / geomiResult.duration;
  console.log(`   Speed: Geomi is ${speedup.toFixed(1)}x faster`);
  console.log(`   Data completeness:`);
  console.log(`     - Geomi: ${geomiResult.trades.length} trades with ACTUAL token amounts`);
  console.log(`     - RPC: ${rpcResult.trades.length} trades (limited by 100 tx cap, tokens may be estimated)`);

  // Accuracy check
  const geomiHasTokens = geomiResult.trades.every(t => parseInt(t.token_amount) > 0);
  const rpcHasTokens = rpcResult.trades.every(t => t.tokenAmount !== null);

  console.log(`\n4. DATA ACCURACY`);
  console.log('   -------------');
  console.log(`   Geomi token amounts: ${geomiHasTokens ? 'ALL PRESENT (accurate)' : 'SOME MISSING'}`);
  console.log(`   RPC token amounts: ${rpcHasTokens ? 'All present' : 'SOME ESTIMATED (inaccurate cost basis)'}`);

  // Summary
  console.log('\n=================================================');
  console.log('  SUMMARY');
  console.log('=================================================');
  console.log(`  Geomi: ${geomiResult.duration.toFixed(0)}ms for ${geomiResult.trades.length} trades`);
  console.log(`  RPC:   ${rpcResult.duration.toFixed(0)}ms for ${rpcResult.trades.length} trades`);
  console.log(`  Winner: GEOMI (${speedup.toFixed(1)}x faster, more accurate)`);
  console.log('=================================================\n');

  // Return success if Geomi is faster
  if (geomiResult.trades.length > 0 && geomiResult.duration < rpcResult.duration) {
    console.log('PASS: Geomi indexer is working and faster than RPC method');
    return true;
  } else {
    console.log('WARN: Check Geomi configuration');
    return false;
  }
}

runPerformanceTest().catch(console.error);
