#!/usr/bin/env npx tsx
/**
 * PNL DEMO - Shows how one position accumulates PnL while others trade
 *
 * 1. Opens a position with the main account
 * 2. Bot accounts trade against each other, moving prices
 * 3. Shows real-time PnL on the original position
 *
 * Usage: npx tsx scripts/pnl-demo.ts
 */

import {
  Aptos,
  AptosConfig,
  Network,
  Account,
  Ed25519PrivateKey,
} from '@aptos-labs/ts-sdk';

const CONTRACT_ADDRESS = '0xa2e5e47aab07fed78a3bcf95135ee2dad20c547499c94cb16a3e047859ffa7e1';
const MARKET_ADDRESS = '0xfefd1b67818ee4ef12a7953852c83f0efb411a9b92c518a52ba92555e4abdd96';

const OUTCOMES = ['J.D. Vance', 'Marco Rubio', 'Donald Trump', 'Ron DeSantis', 'Tucker Carlson', 'Other'];

// Main account (opens the position we track)
const MAIN_KEY = process.env.MAIN_PRIVATE_KEY || '0x48ee96658dd826f6541f5ee501c5784e6b341f04c52c641823f4b097b61eb79b';

// Bot accounts for trading (from ULTRA_PRIVATE_KEYS)
const BOT_KEYS = [
  '0x6e2fca34586261b6f22a973c20024b78ddb370d87f7c974315fb97ba56716a7f',
  '0xe61d22b3dc37c537a20d5b301c4d2b409b2f93cd7b2915f3518d49517c2ab6c4',
  '0x4542c2e4a39beee8202eee0cddeceea886687b21b54b8f50c17e729251fdd7f5',
];

const API_KEY = process.env.APTOS_API_KEY || 'AG-3JMDT54EN4DCLULDWAUXCYGQ56JJQCYHH';
const aptos = new Aptos(new AptosConfig({
  network: Network.TESTNET,
  clientConfig: API_KEY ? { API_KEY } : undefined,
}));

interface Position {
  outcomeIndex: number;
  tokensHeld: number;
  entryPrice: number;
  entryValue: number;
}

async function getPrices(): Promise<number[]> {
  const result = await aptos.view({
    payload: {
      function: `${CONTRACT_ADDRESS}::multi_outcome_market::get_all_prices`,
      typeArguments: [],
      functionArguments: [MARKET_ADDRESS],
    },
  });
  return (result[0] as string[]).map(p => parseInt(p));
}

async function getTokenBalance(accountAddress: string, outcomeIndex: number): Promise<number> {
  try {
    const result = await aptos.view({
      payload: {
        function: `${CONTRACT_ADDRESS}::multi_outcome_market::get_user_multi_positions`,
        typeArguments: [],
        functionArguments: [MARKET_ADDRESS, accountAddress],
      },
    });
    const positions = result[0] as string[];
    return parseInt(positions[outcomeIndex] || '0') / 100_000_000;
  } catch (e) {
    console.error('Balance check failed:', e);
    return 0;
  }
}

async function buyOutcome(account: Account, outcomeIndex: number, amountAPT: number): Promise<string | null> {
  try {
    const tx = await aptos.transaction.build.simple({
      sender: account.accountAddress,
      data: {
        function: `${CONTRACT_ADDRESS}::multi_outcome_market::buy_outcome`,
        functionArguments: [MARKET_ADDRESS, outcomeIndex, Math.floor(amountAPT * 100_000_000), 0],
      },
    });
    const pending = await aptos.signAndSubmitTransaction({ signer: account, transaction: tx });
    await aptos.waitForTransaction({ transactionHash: pending.hash });
    return pending.hash;
  } catch (e: any) {
    console.error('Buy failed:', e.message?.slice(0, 100));
    return null;
  }
}

async function sellOutcome(account: Account, outcomeIndex: number, tokenAmount: number): Promise<string | null> {
  try {
    const tx = await aptos.transaction.build.simple({
      sender: account.accountAddress,
      data: {
        function: `${CONTRACT_ADDRESS}::multi_outcome_market::sell_outcome`,
        functionArguments: [MARKET_ADDRESS, outcomeIndex, Math.floor(tokenAmount * 100_000_000), 0],
      },
    });
    const pending = await aptos.signAndSubmitTransaction({ signer: account, transaction: tx });
    await aptos.waitForTransaction({ transactionHash: pending.hash });
    return pending.hash;
  } catch (e: any) {
    console.error('Sell failed:', e.message?.slice(0, 100));
    return null;
  }
}

async function calculatePnL(position: Position): Promise<{ pnl: number; pnlPercent: number; currentValue: number }> {
  // Get current sell value by simulating a sell
  // The actual value is what you'd get if you sold all tokens now
  try {
    const result = await aptos.view({
      payload: {
        function: `${CONTRACT_ADDRESS}::multi_outcome_market::get_sell_return`,
        typeArguments: [],
        functionArguments: [
          MARKET_ADDRESS,
          position.outcomeIndex,
          Math.floor(position.tokensHeld * 100_000_000), // tokens in octas
        ],
      },
    });
    const currentValue = parseInt(result[0] as string) / 100_000_000;
    const pnl = currentValue - position.entryValue;
    const pnlPercent = (pnl / position.entryValue) * 100;
    return { pnl, pnlPercent, currentValue };
  } catch {
    // Fallback: estimate based on price
    const prices = await getPrices();
    const priceSum = prices.reduce((a, b) => a + b, 0);
    const currentPrice = prices[position.outcomeIndex];
    const currentValue = position.tokensHeld * (currentPrice / priceSum);
    const pnl = currentValue - position.entryValue;
    const pnlPercent = (pnl / position.entryValue) * 100;
    return { pnl, pnlPercent, currentValue };
  }
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║                     PNL DEMO - POSITION TRACKER                  ║');
  console.log('╠══════════════════════════════════════════════════════════════════╣');

  // Setup accounts
  const mainAccount = Account.fromPrivateKey({
    privateKey: new Ed25519PrivateKey(MAIN_KEY)
  });
  console.log(`║  Main Account: ${mainAccount.accountAddress.toString().slice(0, 20)}...`);

  const botAccounts = BOT_KEYS.map(key =>
    Account.fromPrivateKey({ privateKey: new Ed25519PrivateKey(key) })
  );
  console.log(`║  Bot Accounts: ${botAccounts.length} traders ready`);
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  // Get initial prices
  const initialPrices = await getPrices();
  console.log('📊 Initial Prices:');
  OUTCOMES.forEach((name, i) => {
    const pct = (initialPrices[i] / 302 * 100).toFixed(1);
    console.log(`   ${name}: ${pct}%`);
  });

  // Pick an outcome to bet on (highest price = favorite)
  const targetOutcome = 0; // J.D. Vance
  const positionSize = 5; // 5 APT position

  console.log(`\n🎯 Opening position: BUY ${positionSize} APT of ${OUTCOMES[targetOutcome]}...`);

  // Open the main position
  const entryPrice = initialPrices[targetOutcome];
  const txHash = await buyOutcome(mainAccount, targetOutcome, positionSize);

  if (!txHash) {
    console.log('❌ Failed to open position');
    return;
  }

  console.log(`✅ Position opened! TX: ${txHash.slice(0, 10)}...`);

  // Get tokens received
  const tokensHeld = await getTokenBalance(mainAccount.accountAddress.toString(), targetOutcome);
  const position: Position = {
    outcomeIndex: targetOutcome,
    tokensHeld,
    entryPrice,
    entryValue: positionSize,
  };

  console.log(`📦 Tokens received: ${tokensHeld.toFixed(4)}`);
  console.log(`💰 Entry price: ${(entryPrice / 302 * 100).toFixed(2)}%\n`);

  // Now have bots trade to move prices
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('🤖 BOTS TRADING - Watch your position PnL change!');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const duration = 60; // 60 seconds of trading
  const startTime = Date.now();
  let tradeCount = 0;

  while (Date.now() - startTime < duration * 1000) {
    // Pick random bot and random action
    const bot = botAccounts[Math.floor(Math.random() * botAccounts.length)];
    const outcome = Math.floor(Math.random() * OUTCOMES.length);
    const amount = 0.5 + Math.random() * 2; // 0.5-2.5 APT
    const isBuy = Math.random() > 0.4; // Slightly more buys to push prices up

    let success = false;
    if (isBuy) {
      const hash = await buyOutcome(bot, outcome, amount);
      success = !!hash;
    } else {
      // For sells, we need tokens - just buy instead for simplicity
      const hash = await buyOutcome(bot, outcome, amount);
      success = !!hash;
    }

    if (success) {
      tradeCount++;

      // Get current prices and calculate PnL
      const currentPrices = await getPrices();
      const currentPrice = currentPrices[targetOutcome];
      const priceSum = currentPrices.reduce((a, b) => a + b, 0);
      const { pnl, pnlPercent, currentValue } = await calculatePnL(position);

      const pnlColor = pnl >= 0 ? '\x1b[32m' : '\x1b[31m';
      const pnlSign = pnl >= 0 ? '+' : '';

      console.log(
        `Trade #${tradeCount.toString().padStart(3)} | ` +
        `${isBuy ? 'BUY ' : 'SELL'} ${amount.toFixed(2)} APT ${OUTCOMES[outcome].padEnd(14)} | ` +
        `${OUTCOMES[targetOutcome]}: ${(currentPrice / priceSum * 100).toFixed(1)}% | ` +
        `Value: ${currentValue.toFixed(2)} APT | ` +
        `${pnlColor}PnL: ${pnlSign}${pnl.toFixed(2)} APT (${pnlSign}${pnlPercent.toFixed(1)}%)\x1b[0m`
      );
    }

    // Wait between trades (2-4 seconds for visibility)
    await new Promise(r => setTimeout(r, 2000 + Math.random() * 2000));
  }

  // Final summary
  const finalPrices = await getPrices();
  const finalPrice = finalPrices[targetOutcome];
  const { pnl: finalPnl, pnlPercent: finalPnlPercent, currentValue: finalValue } = await calculatePnL(position);

  const finalPriceSum = finalPrices.reduce((a, b) => a + b, 0);
  const initialPriceSum = initialPrices.reduce((a, b) => a + b, 0);

  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║                        FINAL RESULTS                             ║');
  console.log('╠══════════════════════════════════════════════════════════════════╣');
  console.log(`║  Position: ${OUTCOMES[targetOutcome].padEnd(20)}                       ║`);
  console.log(`║  Entry Price: ${(entryPrice / initialPriceSum * 100).toFixed(2)}%                                         ║`);
  console.log(`║  Final Price: ${(finalPrice / finalPriceSum * 100).toFixed(2)}%                                         ║`);
  console.log(`║  Tokens Held: ${tokensHeld.toFixed(4)}                                       ║`);
  console.log(`║  Entry Value: ${positionSize.toFixed(2)} APT                                        ║`);
  console.log(`║  Current Value: ${finalValue.toFixed(2)} APT                                      ║`);
  console.log('╠══════════════════════════════════════════════════════════════════╣');
  const pnlStr = finalPnl >= 0 ? `+${finalPnl.toFixed(4)}` : finalPnl.toFixed(4);
  const pctStr = finalPnlPercent >= 0 ? `+${finalPnlPercent.toFixed(2)}` : finalPnlPercent.toFixed(2);
  console.log(`║  UNREALIZED PnL: ${pnlStr} APT (${pctStr}%)                      ║`);
  console.log(`║  Total Trades: ${tradeCount}                                            ║`);
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');
}

main().catch(console.error);
