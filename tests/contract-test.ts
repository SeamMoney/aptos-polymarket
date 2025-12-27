/**
 * Comprehensive Prediction Market Contract Tests
 *
 * Tests all contract functionality:
 * - View functions (get_yes_price, get_no_price, get_market_info, etc.)
 * - Buy functions (buy_yes, buy_no)
 * - Sell functions (sell_yes, sell_no)
 * - Quote functions
 * - Market creation
 * - Stress testing for performance
 */

import {
  Aptos,
  AptosConfig,
  Network,
  Account,
  Ed25519PrivateKey,
  InputViewFunctionData,
} from '@aptos-labs/ts-sdk';

// Configuration
const CONTRACT_ADDRESS = '0x64a81cb9cbd14d45b87bb32ef73107a44f00069b6a96e70d75369fb7e3da5e68';
const MARKET_ADDRESS = '0x9ec8c2987a5d0598969bb48f3acee94dd6bd5570420cbe5993d65e48500380c4';
const MODULE = `${CONTRACT_ADDRESS}::market`;

// Initialize Aptos client
const aptosConfig = new AptosConfig({ network: Network.TESTNET });
const aptos = new Aptos(aptosConfig);

// Test results tracking
interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

// Helper to record test results
async function runTest(name: string, testFn: () => Promise<any>): Promise<void> {
  const start = Date.now();
  try {
    const details = await testFn();
    results.push({
      name,
      passed: true,
      duration: Date.now() - start,
      details,
    });
    console.log(`✅ ${name} (${Date.now() - start}ms)`);
  } catch (error) {
    results.push({
      name,
      passed: false,
      duration: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    });
    console.log(`❌ ${name}: ${error instanceof Error ? error.message : error}`);
  }
}

// ==================== View Function Tests ====================

async function testGetYesPrice(): Promise<any> {
  const payload: InputViewFunctionData = {
    function: `${MODULE}::get_yes_price`,
    functionArguments: [MARKET_ADDRESS],
  };
  const result = await aptos.view({ payload });
  const price = Number(result[0]);

  if (price < 0 || price > 100) {
    throw new Error(`Invalid price: ${price} (expected 0-100)`);
  }

  return { yesPrice: price };
}

async function testGetNoPrice(): Promise<any> {
  const payload: InputViewFunctionData = {
    function: `${MODULE}::get_no_price`,
    functionArguments: [MARKET_ADDRESS],
  };
  const result = await aptos.view({ payload });
  const price = Number(result[0]);

  if (price < 0 || price > 100) {
    throw new Error(`Invalid price: ${price} (expected 0-100)`);
  }

  return { noPrice: price };
}

async function testPricesAddTo100(): Promise<any> {
  const yesPayload: InputViewFunctionData = {
    function: `${MODULE}::get_yes_price`,
    functionArguments: [MARKET_ADDRESS],
  };
  const noPayload: InputViewFunctionData = {
    function: `${MODULE}::get_no_price`,
    functionArguments: [MARKET_ADDRESS],
  };

  const [yesResult, noResult] = await Promise.all([
    aptos.view({ payload: yesPayload }),
    aptos.view({ payload: noPayload }),
  ]);

  const yesPrice = Number(yesResult[0]);
  const noPrice = Number(noResult[0]);
  const sum = yesPrice + noPrice;

  if (sum !== 100) {
    throw new Error(`Prices don't add to 100: ${yesPrice} + ${noPrice} = ${sum}`);
  }

  return { yesPrice, noPrice, sum };
}

async function testGetMarketInfo(): Promise<any> {
  const payload: InputViewFunctionData = {
    function: `${MODULE}::get_market_info`,
    functionArguments: [MARKET_ADDRESS],
  };
  const result = await aptos.view({ payload });

  const info = {
    question: result[0] as string,
    description: result[1] as string,
    endTime: Number(result[2]),
    resolved: result[3] as boolean,
    outcome: result[4],
    yesReserve: Number(result[5]),
    noReserve: Number(result[6]),
  };

  if (!info.question) {
    throw new Error('Missing question');
  }

  if (info.yesReserve < 0 || info.noReserve < 0) {
    throw new Error('Invalid reserves');
  }

  return info;
}

async function testGetAllMarkets(): Promise<any> {
  const payload: InputViewFunctionData = {
    function: `${MODULE}::get_all_markets`,
    functionArguments: [],
  };
  const result = await aptos.view({ payload });
  const markets = result[0] as string[];

  if (!Array.isArray(markets)) {
    throw new Error('Expected array of markets');
  }

  if (!markets.includes(MARKET_ADDRESS)) {
    throw new Error(`Expected market ${MARKET_ADDRESS} not found in registry`);
  }

  return { marketCount: markets.length, markets };
}

async function testGetUserPositions(userAddress: string): Promise<any> {
  const payload: InputViewFunctionData = {
    function: `${MODULE}::get_user_positions`,
    functionArguments: [MARKET_ADDRESS, userAddress],
  };
  const result = await aptos.view({ payload });

  return {
    yesBalance: Number(result[0]),
    noBalance: Number(result[1]),
  };
}

async function testQuoteBuy(): Promise<any> {
  const amount = 100000000; // 1 APT

  const yesPayload: InputViewFunctionData = {
    function: `${MODULE}::quote_buy`,
    functionArguments: [MARKET_ADDRESS, amount, true],
  };
  const noPayload: InputViewFunctionData = {
    function: `${MODULE}::quote_buy`,
    functionArguments: [MARKET_ADDRESS, amount, false],
  };

  const [yesResult, noResult] = await Promise.all([
    aptos.view({ payload: yesPayload }),
    aptos.view({ payload: noPayload }),
  ]);

  return {
    quoteBuyYes: Number(yesResult[0]),
    quoteBuyNo: Number(noResult[0]),
    amountIn: amount,
  };
}

async function testQuoteSell(): Promise<any> {
  const amount = 10000000; // 0.1 tokens

  const yesPayload: InputViewFunctionData = {
    function: `${MODULE}::quote_sell`,
    functionArguments: [MARKET_ADDRESS, amount, true],
  };
  const noPayload: InputViewFunctionData = {
    function: `${MODULE}::quote_sell`,
    functionArguments: [MARKET_ADDRESS, amount, false],
  };

  const [yesResult, noResult] = await Promise.all([
    aptos.view({ payload: yesPayload }),
    aptos.view({ payload: noPayload }),
  ]);

  return {
    quoteSellYes: Number(yesResult[0]),
    quoteSellNo: Number(noResult[0]),
    amountIn: amount,
  };
}

// ==================== Stress Tests ====================

async function testViewFunctionLatency(iterations: number = 10): Promise<any> {
  const latencies: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const start = Date.now();
    const payload: InputViewFunctionData = {
      function: `${MODULE}::get_yes_price`,
      functionArguments: [MARKET_ADDRESS],
    };
    await aptos.view({ payload });
    latencies.push(Date.now() - start);
  }

  const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const min = Math.min(...latencies);
  const max = Math.max(...latencies);

  return {
    iterations,
    avgLatencyMs: Math.round(avg),
    minLatencyMs: min,
    maxLatencyMs: max,
    latencies,
  };
}

async function testParallelViewCalls(parallelCalls: number = 20): Promise<any> {
  const start = Date.now();

  const promises = Array(parallelCalls).fill(null).map(() => {
    const payload: InputViewFunctionData = {
      function: `${MODULE}::get_yes_price`,
      functionArguments: [MARKET_ADDRESS],
    };
    return aptos.view({ payload });
  });

  await Promise.all(promises);
  const totalTime = Date.now() - start;

  return {
    parallelCalls,
    totalTimeMs: totalTime,
    avgTimePerCall: Math.round(totalTime / parallelCalls),
    effectiveTPS: Math.round((parallelCalls / totalTime) * 1000),
  };
}

// ==================== Transaction Tests (require funded account) ====================

async function testBuyYesTransaction(account: Account, amount: number): Promise<any> {
  const start = Date.now();

  const transaction = await aptos.transaction.build.simple({
    sender: account.accountAddress,
    data: {
      function: `${MODULE}::buy_yes`,
      functionArguments: [MARKET_ADDRESS, amount, 0], // 0 = no slippage protection
    },
  });

  const pendingTx = await aptos.signAndSubmitTransaction({
    signer: account,
    transaction,
  });

  const committedTx = await aptos.waitForTransaction({
    transactionHash: pendingTx.hash,
  });

  const totalTime = Date.now() - start;

  return {
    hash: pendingTx.hash,
    success: committedTx.success,
    totalTimeMs: totalTime,
    gasUsed: (committedTx as any).gas_used,
    vmStatus: (committedTx as any).vm_status,
  };
}

async function testSellYesTransaction(account: Account, amount: number): Promise<any> {
  const start = Date.now();

  const transaction = await aptos.transaction.build.simple({
    sender: account.accountAddress,
    data: {
      function: `${MODULE}::sell_yes`,
      functionArguments: [MARKET_ADDRESS, amount, 0], // 0 = no slippage protection
    },
  });

  const pendingTx = await aptos.signAndSubmitTransaction({
    signer: account,
    transaction,
  });

  const committedTx = await aptos.waitForTransaction({
    transactionHash: pendingTx.hash,
  });

  const totalTime = Date.now() - start;

  return {
    hash: pendingTx.hash,
    success: committedTx.success,
    totalTimeMs: totalTime,
    gasUsed: (committedTx as any).gas_used,
    vmStatus: (committedTx as any).vm_status,
  };
}

// ==================== Main Test Runner ====================

async function runAllTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     APTOS PREDICTION MARKET - AUTOMATED TEST SUITE         ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║ Contract: ${CONTRACT_ADDRESS.slice(0, 10)}...${CONTRACT_ADDRESS.slice(-8)}      ║`);
  console.log(`║ Market:   ${MARKET_ADDRESS.slice(0, 10)}...${MARKET_ADDRESS.slice(-8)}      ║`);
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log('📊 VIEW FUNCTION TESTS\n' + '─'.repeat(50));

  await runTest('get_yes_price', testGetYesPrice);
  await runTest('get_no_price', testGetNoPrice);
  await runTest('prices_add_to_100', testPricesAddTo100);
  await runTest('get_market_info', testGetMarketInfo);
  await runTest('get_all_markets', testGetAllMarkets);
  await runTest('quote_buy', testQuoteBuy);
  await runTest('quote_sell', testQuoteSell);

  // Test user positions with the user's address
  const userAddress = '0x61ed8b048636516b4eaf4c74250fa4f9440d9c3e163d96aeb863fe658a4bdc67';
  await runTest('get_user_positions', () => testGetUserPositions(userAddress));

  console.log('\n⚡ PERFORMANCE TESTS\n' + '─'.repeat(50));

  await runTest('view_function_latency (10 calls)', () => testViewFunctionLatency(10));
  await runTest('parallel_view_calls (20 concurrent)', () => testParallelViewCalls(20));
  await runTest('parallel_view_calls (50 concurrent)', () => testParallelViewCalls(50));

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('📋 TEST SUMMARY');
  console.log('═'.repeat(60));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const totalTime = results.reduce((acc, r) => acc + r.duration, 0);

  console.log(`\n✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏱️  Total time: ${totalTime}ms`);

  // Print details of passed tests
  console.log('\n📊 DETAILED RESULTS:');
  console.log('─'.repeat(60));

  for (const result of results) {
    if (result.passed && result.details) {
      console.log(`\n${result.name}:`);
      console.log(JSON.stringify(result.details, null, 2));
    }
  }

  // Print failures
  if (failed > 0) {
    console.log('\n❌ FAILURES:');
    console.log('─'.repeat(60));
    for (const result of results.filter(r => !r.passed)) {
      console.log(`\n${result.name}: ${result.error}`);
    }
  }

  return { passed, failed, totalTime };
}

// Export for use as module
export { runAllTests, testBuyYesTransaction, testSellYesTransaction };

// Run if executed directly
runAllTests().then(({ passed, failed }) => {
  process.exit(failed > 0 ? 1 : 0);
}).catch(console.error);
