/**
 * Paint the chart with a series of trades
 *
 * This script executes trades in a pattern that will create visible
 * movements on the price chart to test the chart replay system.
 */

import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';
import { deriveAccount } from '../config/seed-accounts';

const CONTRACT = '0xca4d40eae9f07fb28a121862d649203fb4335ece9536ee51790e19f812ff7aea';

// Get market from CLI arg or use first market
const MARKETS = (process.env.VITE_MULTI_MARKETS || '').split(',').filter(Boolean);
const MARKET = process.argv[2] || MARKETS[0] || '0xaf561030c7ebb22b1d8b99b727c27caab1f6944ce39c141fd2b6b0cfbf614a9e';

const aptos = new Aptos(new AptosConfig({
  network: Network.TESTNET,
  fullnode: 'https://aptos.cash.trading/v1',
}));

interface TradeAction {
  type: 'buy' | 'sell';
  outcome: number;
  amount: number; // in USD1
  delay: number;  // ms to wait after trade
}

// Pattern to paint the chart - spam buys to pump Mar 31 (outcome 1)
const TRADE_PATTERN: TradeAction[] = [
  { type: 'buy', outcome: 1, amount: 20, delay: 500 },
  { type: 'buy', outcome: 1, amount: 20, delay: 500 },
  { type: 'buy', outcome: 1, amount: 20, delay: 500 },
  { type: 'buy', outcome: 1, amount: 20, delay: 500 },
  { type: 'buy', outcome: 1, amount: 20, delay: 500 },
  { type: 'buy', outcome: 1, amount: 20, delay: 500 },
  { type: 'buy', outcome: 1, amount: 20, delay: 500 },
  { type: 'buy', outcome: 1, amount: 20, delay: 500 },
  { type: 'buy', outcome: 1, amount: 20, delay: 500 },
  { type: 'buy', outcome: 1, amount: 20, delay: 500 },
];

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getOutcomeBalance(address: string, market: string, outcomeIndex: number): Promise<number> {
  try {
    const result = await aptos.view({
      payload: {
        function: `${CONTRACT}::multi_outcome_market::get_user_multi_positions`,
        functionArguments: [market, address],
      },
    });
    const balances = result[0] as string[];
    return parseInt(balances[outcomeIndex] || '0') / 1e8;
  } catch {
    return 0;
  }
}

async function getPrices(market: string): Promise<number[]> {
  const result = await aptos.view({
    payload: {
      function: `${CONTRACT}::multi_outcome_market::get_all_prices`,
      functionArguments: [market],
    },
  });
  const rawPrices = (result[0] as string[]).map(p => parseInt(p));
  const sum = rawPrices.reduce((a, b) => a + b, 0);
  return rawPrices.map(p => sum > 0 ? (p / sum) * 100 : 25);
}

async function executeTrade(
  account: ReturnType<typeof deriveAccount>,
  market: string,
  action: TradeAction
): Promise<boolean> {
  const amountOctas = BigInt(Math.floor(action.amount * 1e8));

  const fnName = action.type === 'buy' ? 'buy_outcome' : 'sell_outcome';

  try {
    const tx = await aptos.transaction.build.simple({
      sender: account.accountAddress,
      data: {
        function: `${CONTRACT}::multi_outcome_market::${fnName}`,
        functionArguments: [market, action.outcome, amountOctas, 0n],
      },
    });

    const signed = aptos.transaction.sign({ signer: account, transaction: tx });
    const result = await aptos.transaction.submit.simple({ transaction: tx, senderAuthenticator: signed });

    const receipt = await aptos.waitForTransaction({ transactionHash: result.hash });
    return receipt.success;
  } catch (e: any) {
    console.error(`  Error: ${e.message?.slice(0, 100)}`);
    return false;
  }
}

async function main() {
  console.log('🎨 Chart Painter - Creating visible price movements\n');
  console.log(`Market: ${MARKET}`);

  const mnemonic = process.env.SEED_MNEMONIC;
  if (!mnemonic) {
    console.error('ERROR: Set SEED_MNEMONIC env var');
    process.exit(1);
  }

  const accountIndex = parseInt(process.argv[3] || '1'); // Default to account 1 which has more USD1
  const account = deriveAccount(mnemonic, accountIndex);
  console.log(`Account: ${account.accountAddress.toString()}`);

  // Check USD1 balance
  const balanceResult = await aptos.view({
    payload: {
      function: `${CONTRACT}::usd1::balance`,
      functionArguments: [account.accountAddress.toString()],
    },
  });
  const usd1Balance = Number(balanceResult[0]) / 1e8;
  console.log(`USD1 Balance: ${usd1Balance.toFixed(2)}`);

  // Get initial prices
  const initialPrices = await getPrices(MARKET);
  console.log(`\nInitial prices: ${initialPrices.map(p => p.toFixed(1) + '%').join(', ')}`);

  console.log(`\n📊 Executing ${TRADE_PATTERN.length} trades to paint the chart...\n`);

  let successCount = 0;

  for (let i = 0; i < TRADE_PATTERN.length; i++) {
    const action = TRADE_PATTERN[i];

    // For sells, check if we have enough tokens
    if (action.type === 'sell') {
      const balance = await getOutcomeBalance(
        account.accountAddress.toString(),
        MARKET,
        action.outcome
      );
      if (balance < action.amount) {
        console.log(`[${i + 1}/${TRADE_PATTERN.length}] SKIP sell outcome ${action.outcome} - only ${balance.toFixed(2)} tokens`);
        await sleep(action.delay);
        continue;
      }
    }

    process.stdout.write(`[${i + 1}/${TRADE_PATTERN.length}] ${action.type.toUpperCase()} ${action.amount} USD1 of outcome ${action.outcome}... `);

    const success = await executeTrade(account, MARKET, action);

    if (success) {
      const prices = await getPrices(MARKET);
      console.log(`✓ Prices: ${prices.map(p => p.toFixed(1) + '%').join(', ')}`);
      successCount++;
    } else {
      console.log('✗ Failed');
    }

    // Wait before next trade
    if (i < TRADE_PATTERN.length - 1) {
      await sleep(action.delay);
    }
  }

  // Final summary
  console.log(`\n✅ Completed: ${successCount}/${TRADE_PATTERN.length} trades successful`);

  const finalPrices = await getPrices(MARKET);
  console.log(`\nFinal prices: ${finalPrices.map(p => p.toFixed(1) + '%').join(', ')}`);
  console.log(`\n🔄 Refresh the chart page to see the painted price history!`);
}

main().catch(console.error);
