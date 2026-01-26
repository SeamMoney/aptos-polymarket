/**
 * Test what happens when trying to sell outcome tokens you don't own
 * This demonstrates the E_INSUFFICIENT_BALANCE error that causes HFT failures
 *
 * Usage: npx tsx scripts/test-sell-without-tokens.ts
 */
import { readFileSync } from 'fs';
import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';

// Load .env.seed manually
const envContent = readFileSync('.env.seed', 'utf-8');
for (const line of envContent.split('\n')) {
  const match = line.match(/^([A-Z_]+)=["']?(.+?)["']?$/);
  if (match) process.env[match[1]] = match[2];
}
import { deriveAccount } from '../config/seed-accounts';

const CONTRACT = '0xca4d40eae9f07fb28a121862d649203fb4335ece9536ee51790e19f812ff7aea';
const KHAMENEI = '0xcbdddcf6206d2b5956b6c7c6a10d4ac1d6253a2c1c151e8b3af113d8e940f01f';

async function main() {
  const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));

  const mnemonic = process.env.SEED_MNEMONIC;
  if (!mnemonic) {
    console.log('ERROR: SEED_MNEMONIC not set in .env.seed');
    console.log('Usage: source .env.seed && npx tsx scripts/test-sell-without-tokens.ts');
    process.exit(1);
  }

  // Use account index 99
  const account = deriveAccount(mnemonic, 99);

  // First check outcome 1 which might have 0 balance
  console.log('\nWill also test selling outcome 1 (which may have 0 balance)...');
  console.log('=== TESTING SELL WITHOUT TOKENS ===');
  console.log('Account:', account.accountAddress.toString());
  console.log('Testing on Khamenei market');

  // Quote sells for each outcome
  console.log('\nQuoting sell for 0.01 worth of tokens on each outcome:');
  const SMALL_AMOUNT = 1_000_000; // 0.01 USD1 worth

  for (let outcome = 0; outcome < 4; outcome++) {
    try {
      const quote = await aptos.view({
        payload: {
          function: `${CONTRACT}::multi_outcome_market::quote_sell_outcome`,
          functionArguments: [KHAMENEI, outcome, SMALL_AMOUNT.toString()],
        },
      });
      console.log(`  Outcome ${outcome} quote_sell: ${(Number(quote[0]) / 1e8).toFixed(4)} USD1`);
    } catch (e: any) {
      console.log(`  Outcome ${outcome} quote error:`, e.message?.slice(0, 80));
    }
  }

  // Check if account has any outcome tokens by checking positions
  console.log('\nChecking user positions:');
  try {
    const positions = await aptos.view({
      payload: {
        function: `${CONTRACT}::multi_outcome_market::get_user_multi_positions`,
        functionArguments: [KHAMENEI, account.accountAddress.toString()],
      },
    });
    console.log('Positions:', positions[0]);
  } catch (e: any) {
    console.log('Position check error:', e.message?.slice(0, 80));
  }

  // Get positions first to find one with 0 balance
  let positions: string[] = [];
  try {
    const result = await aptos.view({
      payload: {
        function: `${CONTRACT}::multi_outcome_market::get_user_multi_positions`,
        functionArguments: [KHAMENEI, account.accountAddress.toString()],
      },
    });
    positions = result[0] as string[];
  } catch {
    positions = ['0', '0', '0', '0'];
  }

  // Find an outcome with 0 balance
  let zeroBalanceOutcome = -1;
  for (let i = 0; i < positions.length; i++) {
    if (positions[i] === '0') {
      zeroBalanceOutcome = i;
      break;
    }
  }

  if (zeroBalanceOutcome === -1) {
    console.log('\nAll outcomes have tokens, using a fresh account...');
    // Use account 499 which is unlikely to have traded
    const freshAccount = deriveAccount(mnemonic, 499);
    console.log('Fresh account:', freshAccount.accountAddress.toString());

    console.log('\n=== ATTEMPTING SELL ON FRESH ACCOUNT ===');
    try {
      const txn = await aptos.transaction.build.simple({
        sender: freshAccount.accountAddress,
        data: {
          function: `${CONTRACT}::multi_outcome_market::sell_outcome`,
          functionArguments: [KHAMENEI, 0, SMALL_AMOUNT, 0],
        },
      });
      const result = await aptos.signAndSubmitTransaction({
        signer: freshAccount,
        transaction: txn,
      });
      const receipt = await aptos.waitForTransaction({ transactionHash: result.hash, options: { timeoutSecs: 10 } });
      console.log((receipt as any).success ? 'SUCCESS (unexpected)' : 'FAILED: ' + (receipt as any).vm_status);
    } catch (e: any) {
      if (e.message?.includes('0x10006')) {
        console.log('SIMULATION FAILED: INSUFFICIENT_BALANCE (0x10006)');
        console.log('>>> CONFIRMED: Cannot sell tokens you do not own!');
      } else {
        console.log('Error:', e.message?.slice(0, 200));
      }
    }
  } else {
    console.log(`\nOutcome ${zeroBalanceOutcome} has 0 balance, testing sell...`);

    console.log('\n=== ATTEMPTING SELL OUTCOME WITH 0 BALANCE ===');
    try {
      const txn = await aptos.transaction.build.simple({
        sender: account.accountAddress,
        data: {
          function: `${CONTRACT}::multi_outcome_market::sell_outcome`,
          functionArguments: [KHAMENEI, zeroBalanceOutcome, SMALL_AMOUNT, 0],
        },
      });

      const result = await aptos.signAndSubmitTransaction({
        signer: account,
        transaction: txn,
      });

      console.log('Transaction submitted:', result.hash);

      const receipt = await aptos.waitForTransaction({
        transactionHash: result.hash,
        options: { timeoutSecs: 10 }
      });

      if ((receipt as any).success) {
        console.log('UNEXPECTED SUCCESS');
      } else {
        console.log('EXPECTED FAILURE!');
        console.log('VM Status:', (receipt as any).vm_status);
      }
    } catch (e: any) {
      if (e.message?.includes('0x10006') || e.message?.includes('INSUFFICIENT_BALANCE')) {
        console.log('SIMULATION FAILED: INSUFFICIENT_BALANCE');
        console.log('>>> CONFIRMED: Cannot sell tokens you do not own!');
      } else {
        console.log('Transaction error:', e.message?.slice(0, 200));
      }
    }
  }

  console.log('\n=== CONCLUSION ===');
  console.log('The HFT trading-worker.ts has a bug at line 275-284:');
  console.log('  - It randomly decides to sell with 30% probability');
  console.log('  - It sells a DIFFERENT outcome than what was bought');
  console.log('  - Accounts never have tokens for the outcome being sold');
  console.log('  - This causes E_INSUFFICIENT_BALANCE failures');
  console.log('\nFix: Only sell outcomes that the account previously bought');
}

main().catch(console.error);
