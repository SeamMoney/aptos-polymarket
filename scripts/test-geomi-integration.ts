/**
 * Test script for Geomi No-Code Indexer integration
 *
 * Verifies that the Geomi GraphQL client can:
 * 1. Connect to the Geomi API
 * 2. Fetch trades for the presidential market
 * 3. Fetch trades for a specific user
 * 4. Verify token amounts are present (not estimated)
 *
 * Usage:
 *   npx tsx scripts/test-geomi-integration.ts
 */

import * as fs from 'fs';
import * as path from 'path';

// Load env vars from .env.local manually
function loadEnvFile() {
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
// New processor with correct primary key (tx_hash + event_index)
const GEOMI_GRAPHQL_URL = envVars.VITE_GEOMI_GRAPHQL_URL || process.env.VITE_GEOMI_GRAPHQL_URL || 'https://api.testnet.aptoslabs.com/nocode/v1/api/cmk83k7ov0003s6017cgn7stm/v1/graphql';
const GEOMI_API_KEY = envVars.VITE_GEOMI_API_KEY || process.env.VITE_GEOMI_API_KEY || 'aptoslabs_9XPRa9Cn5Ym_LS3sjbgqKdh59PBWxoTQyBwszzPT964g8';

const PRESIDENTIAL_MARKET = '0xfefd1b67818ee4ef12a7953852c83f0efb411a9b92c518a52ba92555e4abdd96';
const CONTRACT_ADDRESS = '0xa2e5e47aab07fed78a3bcf95135ee2dad20c547499c94cb16a3e047859ffa7e1';

interface GeomiTrade {
  sequence_number: string;
  event_index: number;
  event_type: string;
  market_address: string;
  trader: string;
  outcome_index: number;
  collateral_amount: string;
  token_amount: string;
  new_price: number;
}

async function queryGeomi<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  if (!GEOMI_GRAPHQL_URL || !GEOMI_API_KEY) {
    throw new Error('Geomi not configured. Set VITE_GEOMI_GRAPHQL_URL and VITE_GEOMI_API_KEY in .env.local');
  }

  const response = await fetch(GEOMI_GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GEOMI_API_KEY}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Geomi request failed (${response.status}): ${text.slice(0, 200)}`);
  }

  const result = await response.json();

  if (result.errors?.length) {
    throw new Error(`Geomi GraphQL error: ${result.errors[0].message}`);
  }

  return result.data;
}

async function testHealthCheck() {
  console.log('\n1. Testing Geomi health check...');

  try {
    const result = await queryGeomi<{ __typename: string }>('query { __typename }');
    console.log('   ✓ Geomi API is reachable');
    return true;
  } catch (error) {
    console.log(`   ✗ Health check failed: ${error}`);
    return false;
  }
}

async function testFetchLatestTrades() {
  console.log('\n2. Testing fetch latest trades for presidential market...');

  const query = `
    query LatestTrades($market: String!, $limit: Int!) {
      trades(
        where: { market_address: { _eq: $market } }
        order_by: [{ sequence_number: desc }, { event_index: desc }]
        limit: $limit
      ) {
        sequence_number
        event_index
        event_type
        market_address
        trader
        outcome_index
        collateral_amount
        token_amount
        new_price
      }
    }
  `;

  try {
    const result = await queryGeomi<{ trades: GeomiTrade[] }>(query, {
      market: PRESIDENTIAL_MARKET,
      limit: 10,
    });

    console.log(`   ✓ Fetched ${result.trades.length} trades`);

    if (result.trades.length > 0) {
      const trade = result.trades[0];
      console.log('\n   Sample trade:');
      console.log(`   - Event type: ${trade.event_type}`);
      console.log(`   - Outcome index: ${trade.outcome_index}`);
      console.log(`   - Collateral: ${parseInt(trade.collateral_amount) / 100_000_000} APT`);
      console.log(`   - Tokens: ${parseInt(trade.token_amount) / 100_000_000} (ACTUAL from event)`);
      console.log(`   - Price after: ${trade.new_price}%`);
      console.log(`   - Trader: ${trade.trader.slice(0, 10)}...`);

      // Verify token_amount is present
      if (trade.token_amount && parseInt(trade.token_amount) > 0) {
        console.log('\n   ✓ Token amounts are present - cost basis will be ACCURATE');
      } else {
        console.log('\n   ⚠ Token amounts missing - check Geomi processor config');
      }
    }

    return result.trades;
  } catch (error) {
    console.log(`   ✗ Failed to fetch trades: ${error}`);
    return [];
  }
}

async function testFetchAllTrades() {
  console.log('\n3. Testing fetch all trades (across all markets)...');

  const query = `
    query AllTrades($limit: Int!) {
      trades(
        order_by: [{ sequence_number: desc }, { event_index: desc }]
        limit: $limit
      ) {
        sequence_number
        event_index
        event_type
        market_address
        trader
        outcome_index
        collateral_amount
        token_amount
        new_price
      }
    }
  `;

  try {
    const result = await queryGeomi<{ trades: GeomiTrade[] }>(query, { limit: 50 });
    console.log(`   ✓ Fetched ${result.trades.length} trades across all markets`);

    // Count unique markets
    const uniqueMarkets = new Set(result.trades.map(t => t.market_address));
    console.log(`   - Unique markets: ${uniqueMarkets.size}`);

    // Count buy vs sell
    const buys = result.trades.filter(t => t.event_type.includes('OutcomeTokenBought')).length;
    const sells = result.trades.filter(t => t.event_type.includes('OutcomeTokenSold')).length;
    console.log(`   - Buys: ${buys}, Sells: ${sells}`);

    return result.trades;
  } catch (error) {
    console.log(`   ✗ Failed to fetch all trades: ${error}`);
    return [];
  }
}

async function testFetchUserTrades(userAddress?: string) {
  const testUser = userAddress || '0x0'; // Replace with a known user address

  console.log(`\n4. Testing fetch trades for user: ${testUser.slice(0, 10)}...`);

  const query = `
    query UserTrades($user: String!, $limit: Int!) {
      trades(
        where: { trader: { _eq: $user } }
        order_by: [{ sequence_number: desc }, { event_index: desc }]
        limit: $limit
      ) {
        sequence_number
        event_index
        event_type
        market_address
        trader
        outcome_index
        collateral_amount
        token_amount
        new_price
      }
    }
  `;

  try {
    const result = await queryGeomi<{ trades: GeomiTrade[] }>(query, {
      user: testUser,
      limit: 20,
    });

    console.log(`   ✓ Fetched ${result.trades.length} trades for user`);

    if (result.trades.length > 0) {
      // Calculate total spent/received
      let totalBought = 0;
      let totalSold = 0;
      let totalTokensBought = 0;

      for (const trade of result.trades) {
        const collateral = parseInt(trade.collateral_amount) / 100_000_000;
        const tokens = parseInt(trade.token_amount) / 100_000_000;

        if (trade.event_type.includes('OutcomeTokenBought')) {
          totalBought += collateral;
          totalTokensBought += tokens;
        } else {
          totalSold += collateral;
        }
      }

      console.log(`   - Total APT spent: ${totalBought.toFixed(4)}`);
      console.log(`   - Total APT received: ${totalSold.toFixed(4)}`);
      console.log(`   - Total tokens bought: ${totalTokensBought.toFixed(4)}`);
    }

    return result.trades;
  } catch (error) {
    console.log(`   ✗ Failed to fetch user trades: ${error}`);
    return [];
  }
}

async function main() {
  console.log('===========================================');
  console.log('  Geomi No-Code Indexer Integration Test');
  console.log('===========================================');

  console.log('\nConfiguration:');
  console.log(`  GraphQL URL: ${GEOMI_GRAPHQL_URL || '(not set)'}`);
  console.log(`  API Key: ${GEOMI_API_KEY ? '****' + GEOMI_API_KEY.slice(-4) : '(not set)'}`);
  console.log(`  Presidential Market: ${PRESIDENTIAL_MARKET}`);

  if (!GEOMI_GRAPHQL_URL || !GEOMI_API_KEY) {
    console.log('\n⚠ Geomi is not configured!');
    console.log('  Add the following to your .env.local file:');
    console.log('  VITE_GEOMI_GRAPHQL_URL=https://api.testnet.aptoslabs.com/nocode/v1/api/cmk7j8epf0325s6013p5c5qxh/v1/graphql');
    console.log('  VITE_GEOMI_API_KEY=your-processor-api-key');
    process.exit(1);
  }

  const healthOk = await testHealthCheck();
  if (!healthOk) {
    console.log('\n❌ Cannot connect to Geomi. Check your API key and URL.');
    process.exit(1);
  }

  await testFetchLatestTrades();
  await testFetchAllTrades();

  // If a user address is provided as command line arg, test user trades
  const userArg = process.argv[2];
  if (userArg) {
    await testFetchUserTrades(userArg);
  }

  console.log('\n===========================================');
  console.log('  Integration Test Complete');
  console.log('===========================================');
  console.log('\nNext steps:');
  console.log('1. Start the app: npm run dev');
  console.log('2. Navigate to a market page');
  console.log('3. Check browser console for "[Portfolio] Using Geomi" message');
  console.log('4. Verify trade history shows actual token amounts');
}

main().catch(console.error);
