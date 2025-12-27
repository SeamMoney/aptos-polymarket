/**
 * Transaction Tests for Aptos Prediction Market
 *
 * Tests actual blockchain transactions:
 * - Create market
 * - Buy YES/NO tokens
 * - Sell YES/NO tokens
 * - Market resolution
 * - Token redemption
 *
 * Requires: APTOS_PRIVATE_KEY environment variable with a funded testnet account
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

const aptosConfig = new AptosConfig({ network: Network.TESTNET });
const aptos = new Aptos(aptosConfig);

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  txHash?: string;
  gasUsed?: string;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

// Get account from private key
function getAccount(): Account | null {
  const privateKey = process.env.APTOS_PRIVATE_KEY;
  if (!privateKey) {
    console.log('⚠️  No APTOS_PRIVATE_KEY environment variable found');
    console.log('   Set it with: export APTOS_PRIVATE_KEY=0x...');
    return null;
  }

  try {
    const pk = new Ed25519PrivateKey(privateKey);
    return Account.fromPrivateKey({ privateKey: pk });
  } catch (error) {
    console.log('❌ Invalid private key format');
    return null;
  }
}

async function getAccountBalance(address: string): Promise<number> {
  try {
    const resources = await aptos.getAccountResources({ accountAddress: address });
    const aptCoin = resources.find(r => r.type === '0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>');
    if (aptCoin) {
      return Number((aptCoin.data as any).coin.value) / 100_000_000;
    }
    return 0;
  } catch {
    return 0;
  }
}

async function getUserPositions(marketAddr: string, userAddr: string): Promise<{ yes: number; no: number }> {
  const payload: InputViewFunctionData = {
    function: `${MODULE}::get_user_positions`,
    functionArguments: [marketAddr, userAddr],
  };
  const result = await aptos.view({ payload });
  return {
    yes: Number(result[0]) / 100_000_000,
    no: Number(result[1]) / 100_000_000,
  };
}

async function getMarketPrice(marketAddr: string): Promise<{ yes: number; no: number }> {
  const yesPayload: InputViewFunctionData = {
    function: `${MODULE}::get_yes_price`,
    functionArguments: [marketAddr],
  };
  const noPayload: InputViewFunctionData = {
    function: `${MODULE}::get_no_price`,
    functionArguments: [marketAddr],
  };
  const [yesResult, noResult] = await Promise.all([
    aptos.view({ payload: yesPayload }),
    aptos.view({ payload: noPayload }),
  ]);
  return {
    yes: Number(yesResult[0]),
    no: Number(noResult[0]),
  };
}

// ==================== Transaction Tests ====================

async function testBuyNo(account: Account, amount: number): Promise<TestResult> {
  const name = `buy_no (${amount / 100_000_000} APT)`;
  const start = Date.now();

  try {
    // Get positions before
    const positionsBefore = await getUserPositions(MARKET_ADDRESS, account.accountAddress.toString());
    const priceBefore = await getMarketPrice(MARKET_ADDRESS);

    const transaction = await aptos.transaction.build.simple({
      sender: account.accountAddress,
      data: {
        function: `${MODULE}::buy_no`,
        functionArguments: [MARKET_ADDRESS, amount, 0],
      },
    });

    const pendingTx = await aptos.signAndSubmitTransaction({
      signer: account,
      transaction,
    });

    const committedTx = await aptos.waitForTransaction({
      transactionHash: pendingTx.hash,
    });

    // Get positions after
    const positionsAfter = await getUserPositions(MARKET_ADDRESS, account.accountAddress.toString());
    const priceAfter = await getMarketPrice(MARKET_ADDRESS);

    const result: TestResult = {
      name,
      passed: committedTx.success,
      duration: Date.now() - start,
      txHash: pendingTx.hash,
      gasUsed: (committedTx as any).gas_used,
      details: {
        noTokensBefore: positionsBefore.no,
        noTokensAfter: positionsAfter.no,
        noTokensReceived: positionsAfter.no - positionsBefore.no,
        yesPriceBefore: priceBefore.yes,
        yesPriceAfter: priceAfter.yes,
        priceChange: priceAfter.yes - priceBefore.yes,
      },
    };

    console.log(`✅ ${name} (${result.duration}ms)`);
    console.log(`   TX: ${pendingTx.hash.slice(0, 20)}...`);
    console.log(`   NO tokens received: ${result.details.noTokensReceived.toFixed(4)}`);
    console.log(`   YES price change: ${priceBefore.yes}% → ${priceAfter.yes}%`);

    results.push(result);
    return result;
  } catch (error) {
    const result: TestResult = {
      name,
      passed: false,
      duration: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    };
    console.log(`❌ ${name}: ${result.error}`);
    results.push(result);
    return result;
  }
}

async function testSellYes(account: Account, amount: number): Promise<TestResult> {
  const name = `sell_yes (${amount / 100_000_000} YES)`;
  const start = Date.now();

  try {
    // Get positions before
    const positionsBefore = await getUserPositions(MARKET_ADDRESS, account.accountAddress.toString());
    const priceBefore = await getMarketPrice(MARKET_ADDRESS);
    const balanceBefore = await getAccountBalance(account.accountAddress.toString());

    const transaction = await aptos.transaction.build.simple({
      sender: account.accountAddress,
      data: {
        function: `${MODULE}::sell_yes`,
        functionArguments: [MARKET_ADDRESS, amount, 0],
      },
    });

    const pendingTx = await aptos.signAndSubmitTransaction({
      signer: account,
      transaction,
    });

    const committedTx = await aptos.waitForTransaction({
      transactionHash: pendingTx.hash,
    });

    // Get positions after
    const positionsAfter = await getUserPositions(MARKET_ADDRESS, account.accountAddress.toString());
    const priceAfter = await getMarketPrice(MARKET_ADDRESS);
    const balanceAfter = await getAccountBalance(account.accountAddress.toString());

    const result: TestResult = {
      name,
      passed: committedTx.success,
      duration: Date.now() - start,
      txHash: pendingTx.hash,
      gasUsed: (committedTx as any).gas_used,
      details: {
        yesTokensBefore: positionsBefore.yes,
        yesTokensAfter: positionsAfter.yes,
        yesTokensSold: positionsBefore.yes - positionsAfter.yes,
        aptReceived: balanceAfter - balanceBefore,
        yesPriceBefore: priceBefore.yes,
        yesPriceAfter: priceAfter.yes,
        priceChange: priceAfter.yes - priceBefore.yes,
      },
    };

    console.log(`✅ ${name} (${result.duration}ms)`);
    console.log(`   TX: ${pendingTx.hash.slice(0, 20)}...`);
    console.log(`   YES tokens sold: ${result.details.yesTokensSold.toFixed(4)}`);
    console.log(`   APT received: ~${result.details.aptReceived.toFixed(4)}`);
    console.log(`   YES price change: ${priceBefore.yes}% → ${priceAfter.yes}%`);

    results.push(result);
    return result;
  } catch (error) {
    const result: TestResult = {
      name,
      passed: false,
      duration: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    };
    console.log(`❌ ${name}: ${result.error}`);
    results.push(result);
    return result;
  }
}

async function testCreateMarket(account: Account): Promise<TestResult> {
  const name = 'create_market';
  const start = Date.now();

  try {
    const question = `Test market ${Date.now()}`;
    const description = 'Automated test market';
    const endTime = Math.floor(Date.now() / 1000) + 86400 * 30; // 30 days from now
    const initialLiquidity = 50_000_000; // 0.5 APT

    const transaction = await aptos.transaction.build.simple({
      sender: account.accountAddress,
      data: {
        function: `${MODULE}::create_market`,
        functionArguments: [question, description, endTime, initialLiquidity],
      },
    });

    const pendingTx = await aptos.signAndSubmitTransaction({
      signer: account,
      transaction,
    });

    const committedTx = await aptos.waitForTransaction({
      transactionHash: pendingTx.hash,
    });

    // Get the new market address from events
    const events = (committedTx as any).events || [];
    const marketCreatedEvent = events.find((e: any) =>
      e.type.includes('MarketCreated')
    );

    const result: TestResult = {
      name,
      passed: committedTx.success,
      duration: Date.now() - start,
      txHash: pendingTx.hash,
      gasUsed: (committedTx as any).gas_used,
      details: {
        question,
        endTime: new Date(endTime * 1000).toISOString(),
        initialLiquidity: initialLiquidity / 100_000_000,
        marketAddress: marketCreatedEvent?.data?.market_address,
      },
    };

    console.log(`✅ ${name} (${result.duration}ms)`);
    console.log(`   TX: ${pendingTx.hash.slice(0, 20)}...`);
    console.log(`   Question: "${question}"`);
    if (result.details.marketAddress) {
      console.log(`   Market: ${result.details.marketAddress}`);
    }

    results.push(result);
    return result;
  } catch (error) {
    const result: TestResult = {
      name,
      passed: false,
      duration: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    };
    console.log(`❌ ${name}: ${result.error}`);
    results.push(result);
    return result;
  }
}

// ==================== Main Test Runner ====================

async function runTransactionTests() {
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║         APTOS PREDICTION MARKET - TRANSACTION TEST SUITE                   ║');
  console.log('╠════════════════════════════════════════════════════════════════════════════╣');
  console.log('║ Testing actual blockchain transactions on testnet                          ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝\n');

  const account = getAccount();
  if (!account) {
    console.log('\n❌ Cannot run transaction tests without a funded account.');
    console.log('   Export your private key: export APTOS_PRIVATE_KEY=0x...');
    process.exit(1);
  }

  const address = account.accountAddress.toString();
  console.log(`📍 Account: ${address.slice(0, 10)}...${address.slice(-8)}`);

  // Check balance
  const balance = await getAccountBalance(address);
  console.log(`💰 Balance: ${balance.toFixed(4)} APT`);

  if (balance < 0.5) {
    console.log('\n⚠️  Low balance! Need at least 0.5 APT for transaction tests.');
    console.log('   Get testnet APT from: https://aptos.dev/en/network/faucet');
    process.exit(1);
  }

  // Get current positions
  const positions = await getUserPositions(MARKET_ADDRESS, address);
  console.log(`📊 YES tokens: ${positions.yes.toFixed(4)}`);
  console.log(`📊 NO tokens: ${positions.no.toFixed(4)}`);

  // Get current price
  const price = await getMarketPrice(MARKET_ADDRESS);
  console.log(`📈 Market price: YES ${price.yes}% / NO ${price.no}%`);

  console.log('\n' + '═'.repeat(70));
  console.log('🔄 RUNNING TRANSACTION TESTS');
  console.log('═'.repeat(70) + '\n');

  // Test 1: Buy NO to balance the market
  console.log('1️⃣  Testing buy_no...');
  await testBuyNo(account, 100_000_000); // 1 APT

  // Wait a bit between transactions
  await new Promise(r => setTimeout(r, 2000));

  // Test 2: Sell some YES tokens (if we have any)
  if (positions.yes > 0.01) {
    console.log('\n2️⃣  Testing sell_yes...');
    const sellAmount = Math.floor(positions.yes * 0.1 * 100_000_000); // Sell 10%
    await testSellYes(account, sellAmount);
  } else {
    console.log('\n2️⃣  Skipping sell_yes (no YES tokens to sell)');
  }

  // Wait a bit
  await new Promise(r => setTimeout(r, 2000));

  // Test 3: Create a new market
  console.log('\n3️⃣  Testing create_market...');
  await testCreateMarket(account);

  // Summary
  console.log('\n' + '═'.repeat(70));
  console.log('📋 TRANSACTION TEST SUMMARY');
  console.log('═'.repeat(70));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const totalTime = results.reduce((acc, r) => acc + r.duration, 0);
  const totalGas = results.reduce((acc, r) => acc + (Number(r.gasUsed) || 0), 0);

  console.log(`\n✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏱️  Total time: ${totalTime}ms`);
  console.log(`⛽ Total gas: ${totalGas}`);

  // Final positions
  const finalPositions = await getUserPositions(MARKET_ADDRESS, address);
  const finalBalance = await getAccountBalance(address);
  console.log(`\n📊 Final YES tokens: ${finalPositions.yes.toFixed(4)}`);
  console.log(`📊 Final NO tokens: ${finalPositions.no.toFixed(4)}`);
  console.log(`💰 Final balance: ${finalBalance.toFixed(4)} APT`);

  return { passed, failed, totalTime };
}

// Export for module use
export { runTransactionTests, testBuyNo, testSellYes, testCreateMarket };

// Run if executed directly
runTransactionTests().then(({ passed, failed }) => {
  process.exit(failed > 0 ? 1 : 0);
}).catch(console.error);
