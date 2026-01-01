#!/usr/bin/env npx tsx
/**
 * Volatility Bot - Creates realistic price movements on the market
 *
 * This bot executes random trades in both directions to create
 * natural-looking price volatility for demo purposes.
 */

import { Aptos, AptosConfig, Network, Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";

const CONTRACT_ADDRESS = "0xa2e5e47aab07fed78a3bcf95135ee2dad20c547499c94cb16a3e047859ffa7e1";
const MARKET_ADDRESS = "0xfefd1b67818ee4ef12a7953852c83f0efb411a9b92c518a52ba92555e4abdd96";

// Multiple accounts for trading
const PRIVATE_KEYS = [
  "0x6e2fca34586261b6f22a973c20024b78ddb370d87f7c974315fb97ba56716a7f",
  "0xe61d22b3dc37c537a20d5b301c4d2b409b2f93cd7b2915f3518d49517c2ab6c4",
  "0x4542c2e4a39beee8202eee0cddeceea886687b21b54b8f50c17e729251fdd7f5",
  "0xcf5154af9664bbc2634fddfcce2317ed788b35de7f004ac0e24aefd68a0b10c5",
];

// Outcome names
const OUTCOMES = [
  "J.D. Vance",
  "Marco Rubio",
  "Donald Trump",
  "Ron DeSantis",
  "Tucker Carlson",
  "Other"
];

// Initialize Aptos client
const config = new AptosConfig({
  network: Network.TESTNET,
  clientConfig: { API_KEY: process.env.APTOS_API_KEY || "AG-3JMDT54EN4DCLULDWAUXCYGQ56JJQCYHH" },
});
const aptos = new Aptos(config);

// Create accounts from private keys
function getAccounts(): Account[] {
  return PRIVATE_KEYS.map(pk => {
    const privateKey = new Ed25519PrivateKey(pk);
    return Account.fromPrivateKey({ privateKey });
  });
}

// Get current prices
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

// Buy outcome tokens
async function buyOutcome(account: Account, outcomeIndex: number, amountAPT: number): Promise<boolean> {
  const amountOctas = Math.floor(amountAPT * 100_000_000);

  try {
    const tx = await aptos.transaction.build.simple({
      sender: account.accountAddress,
      data: {
        function: `${CONTRACT_ADDRESS}::multi_outcome_market::buy_outcome`,
        typeArguments: [],
        functionArguments: [MARKET_ADDRESS, outcomeIndex, amountOctas, 0],
      },
    });

    const committedTx = await aptos.signAndSubmitTransaction({
      signer: account,
      transaction: tx,
    });

    await aptos.waitForTransaction({ transactionHash: committedTx.hash });
    return true;
  } catch (e) {
    return false;
  }
}

// Sell outcome tokens
async function sellOutcome(account: Account, outcomeIndex: number, tokensAPT: number): Promise<boolean> {
  const tokensOctas = Math.floor(tokensAPT * 100_000_000);

  try {
    const tx = await aptos.transaction.build.simple({
      sender: account.accountAddress,
      data: {
        function: `${CONTRACT_ADDRESS}::multi_outcome_market::sell_outcome`,
        typeArguments: [],
        functionArguments: [MARKET_ADDRESS, outcomeIndex, tokensOctas, 0],
      },
    });

    const committedTx = await aptos.signAndSubmitTransaction({
      signer: account,
      transaction: tx,
    });

    await aptos.waitForTransaction({ transactionHash: committedTx.hash });
    return true;
  } catch (e) {
    return false;
  }
}

// Random number between min and max
function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

// Pick random element from array
function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
  console.log("🎲 Volatility Bot - Creating realistic market movements\n");

  const accounts = getAccounts();
  console.log(`📍 Using ${accounts.length} trading accounts\n`);

  // Configuration
  const minTradeSize = 0.5;   // Minimum trade size in APT
  const maxTradeSize = 5;     // Maximum trade size in APT
  const minDelay = 2000;      // Minimum delay between trades (ms)
  const maxDelay = 8000;      // Maximum delay between trades (ms)

  let tradeCount = 0;
  let buyCount = 0;
  let sellCount = 0;

  console.log("📊 Starting volatility generation...\n");
  console.log("   Config:");
  console.log(`   - Trade size: ${minTradeSize}-${maxTradeSize} APT`);
  console.log(`   - Delay: ${minDelay/1000}-${maxDelay/1000}s between trades`);
  console.log("\n   Press Ctrl+C to stop\n");
  console.log("─".repeat(60));

  // Continuous trading loop
  while (true) {
    try {
      // Get current prices
      const prices = await getPrices();
      const priceSum = prices.reduce((a, b) => a + b, 0);
      const normalizedPrices = prices.map(p => (p / priceSum) * 100);

      // Pick random account
      const account = randomPick(accounts);
      const accountShort = account.accountAddress.toString().slice(0, 8);

      // Pick random outcome (weighted toward lower-priced outcomes for buys)
      const outcomeIndex = Math.floor(Math.random() * OUTCOMES.length);
      const outcomeName = OUTCOMES[outcomeIndex];
      const currentPrice = normalizedPrices[outcomeIndex];

      // Decide buy or sell (60% buy, 40% sell to maintain some upward pressure)
      const isBuy = Math.random() < 0.6;

      // Random trade size
      const tradeSize = randomBetween(minTradeSize, maxTradeSize);

      const timestamp = new Date().toLocaleTimeString();

      if (isBuy) {
        const success = await buyOutcome(account, outcomeIndex, tradeSize);
        if (success) {
          buyCount++;
          tradeCount++;
          console.log(`${timestamp} | 🟢 BUY  | ${outcomeName.padEnd(16)} | ${tradeSize.toFixed(2)} APT | ${currentPrice.toFixed(1)}% | ${accountShort}...`);
        }
      } else {
        const success = await sellOutcome(account, outcomeIndex, tradeSize);
        if (success) {
          sellCount++;
          tradeCount++;
          console.log(`${timestamp} | 🔴 SELL | ${outcomeName.padEnd(16)} | ${tradeSize.toFixed(2)} APT | ${currentPrice.toFixed(1)}% | ${accountShort}...`);
        }
      }

      // Random delay
      const delay = randomBetween(minDelay, maxDelay);
      await new Promise(r => setTimeout(r, delay));

      // Periodic stats
      if (tradeCount > 0 && tradeCount % 10 === 0) {
        console.log("─".repeat(60));
        console.log(`📈 Stats: ${tradeCount} trades | ${buyCount} buys | ${sellCount} sells`);

        // Show current prices
        const latestPrices = await getPrices();
        const latestSum = latestPrices.reduce((a, b) => a + b, 0);
        console.log("   Current prices:");
        OUTCOMES.forEach((name, i) => {
          const pct = (latestPrices[i] / latestSum) * 100;
          console.log(`   - ${name}: ${pct.toFixed(1)}%`);
        });
        console.log("─".repeat(60));
      }

    } catch (error: any) {
      // Rate limit or other error - wait longer
      if (error.message?.includes('429') || error.message?.includes('rate')) {
        console.log("⏳ Rate limited, waiting 30s...");
        await new Promise(r => setTimeout(r, 30000));
      } else {
        console.log(`⚠️ Error: ${error.message?.slice(0, 50)}`);
        await new Promise(r => setTimeout(r, 5000));
      }
    }
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log("\n\n👋 Volatility bot stopped");
  process.exit(0);
});

main().catch(console.error);
