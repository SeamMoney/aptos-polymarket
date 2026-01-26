/**
 * Slow Trade Test - Makes a trade every 1 second on Khamenei market
 * to verify frontend updates in real-time
 *
 * Usage: SEED_MNEMONIC="..." npx tsx scripts/slow-trade-test.ts
 */
import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';
import { deriveAccount } from '../config/seed-accounts';

const CONTRACT = '0xca4d40eae9f07fb28a121862d649203fb4335ece9536ee51790e19f812ff7aea';
const KHAMENEI_MARKET = '0xcbdddcf6206d2b5956b6c7c6a10d4ac1d6253a2c1c151e8b3af113d8e940f01f';

// Trade amount: 1 USD1 = 100_000_000 units
const TRADE_AMOUNT = 100_000_000n;  // 1 USD1
const INTERVAL_MS = 1000;  // 1 second between trades

async function main() {
  const aptos = new Aptos(new AptosConfig({
    network: Network.TESTNET,
    fullnode: 'https://api.testnet.aptoslabs.com/v1',
  }));

  const mnemonic = process.env.SEED_MNEMONIC;
  if (!mnemonic) {
    console.error('ERROR: SEED_MNEMONIC not set');
    console.log('Usage: SEED_MNEMONIC="your mnemonic" npx tsx scripts/slow-trade-test.ts');
    process.exit(1);
  }

  const account = deriveAccount(mnemonic, 0);
  console.log('=== SLOW TRADE TEST ===');
  console.log('Account:', account.accountAddress.toString());
  console.log('Market: Khamenei Iran');
  console.log('Trade Amount: 1 USD1 per trade');
  console.log('Interval: 1 second');
  console.log('');

  // Check initial USD1 balance
  try {
    const balance = await aptos.view({
      payload: {
        function: `${CONTRACT}::usd1::balance`,
        functionArguments: [account.accountAddress.toString()],
      },
    });
    console.log('USD1 Balance:', Number(balance[0]) / 1e8, 'USD1');
  } catch (e: any) {
    console.log('Balance check error:', e.message);
  }

  // Get initial prices
  try {
    const prices = await aptos.view({
      payload: {
        function: `${CONTRACT}::multi_outcome_market::get_all_prices`,
        functionArguments: [KHAMENEI_MARKET],
      },
    });
    console.log('Initial Prices:', prices[0]);
  } catch (e: any) {
    console.log('Price check error:', e.message);
  }

  console.log('\nStarting trades (Ctrl+C to stop)...');
  console.log('────────────────────────────────────────');

  let tradeCount = 0;
  let successCount = 0;
  let failCount = 0;

  // Trade loop
  const tradeLoop = async () => {
    while (true) {
      tradeCount++;
      const outcomeIdx = tradeCount % 4;  // Rotate through outcomes 0-3
      const isBuy = tradeCount % 2 === 1;  // Alternate buy/sell

      const action = isBuy ? 'buy_outcome' : 'sell_outcome';
      const outcomeNames = ['Past', 'Jan 31', 'Feb 28', 'Mar 31'];

      console.log(`\n[Trade #${tradeCount}] ${isBuy ? 'BUY' : 'SELL'} ${outcomeNames[outcomeIdx]} (outcome ${outcomeIdx})`);

      try {
        const txn = await aptos.transaction.build.simple({
          sender: account.accountAddress,
          data: {
            function: `${CONTRACT}::multi_outcome_market::${action}`,
            functionArguments: [KHAMENEI_MARKET, outcomeIdx, TRADE_AMOUNT, 0n],
          },
        });

        const result = await aptos.signAndSubmitTransaction({
          signer: account,
          transaction: txn,
        });

        // Wait for confirmation
        const receipt = await aptos.waitForTransaction({
          transactionHash: result.hash,
          options: { timeoutSecs: 10 }
        });

        if ((receipt as any).success) {
          successCount++;
          console.log(`  ✓ Success: ${result.hash.slice(0, 16)}...`);

          // Get updated prices
          const prices = await aptos.view({
            payload: {
              function: `${CONTRACT}::multi_outcome_market::get_all_prices`,
              functionArguments: [KHAMENEI_MARKET],
            },
          });
          console.log(`  Prices: ${(prices[0] as string[]).map(p => p + '%').join(', ')}`);
        } else {
          failCount++;
          console.log(`  ✗ Failed: ${(receipt as any).vm_status}`);
        }

      } catch (e: any) {
        failCount++;
        console.log(`  ✗ Error: ${e.message?.slice(0, 100)}`);
      }

      console.log(`  Stats: ${successCount} success, ${failCount} failed`);

      // Wait for next trade
      await new Promise(resolve => setTimeout(resolve, INTERVAL_MS));
    }
  };

  // Handle Ctrl+C
  process.on('SIGINT', () => {
    console.log('\n\n=== SUMMARY ===');
    console.log(`Total trades: ${tradeCount}`);
    console.log(`Successful: ${successCount}`);
    console.log(`Failed: ${failCount}`);
    console.log(`Success rate: ${((successCount / tradeCount) * 100).toFixed(1)}%`);
    process.exit(0);
  });

  await tradeLoop();
}

main().catch(console.error);
