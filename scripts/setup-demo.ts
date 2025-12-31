/**
 * Setup Demo: Create market + Fund bot wallets
 *
 * Usage: APTOS_PRIVATE_KEY=0x... npx tsx scripts/setup-demo.ts
 */

import {
  Aptos,
  AptosConfig,
  Network,
  Account,
  Ed25519PrivateKey,
} from '@aptos-labs/ts-sdk';

const CONTRACT_ADDRESS = '0x3f13249e31a1fbdb886741f7945cccc40307311abc08ba188894bd1a050e19b4';
const MODULE = `${CONTRACT_ADDRESS}::multi_outcome_market`;

// Bot wallet keys to fund
const BOT_WALLET_KEYS = [
  "0x6e2fca34586261b6f22a973c20024b78ddb370d87f7c974315fb97ba56716a7f",
  "0xe61d22b3dc37c537a20d5b301c4d2b409b2f93cd7b2915f3518d49517c2ab6c4",
  "0x4542c2e4a39beee8202eee0cddeceea886687b21b54b8f50c17e729251fdd7f5",
  "0xcf5154af9664bbc2634fddfcce2317ed788b35de7f004ac0e24aefd68a0b10c5",
  "ed25519-priv-0xb7d1f406e48c2eddffe987f98445dd4a353e8e9d1630d878621ded084bdd77c7",
  "ed25519-priv-0xa8088ee787b847f6304807a8b09d1afc15409082ee9c8b7eda6919b0ecb86ea8",
  "ed25519-priv-0xb5305eb83498dcba61242ccc91fac35263d9b44bddaf5e7417adbaceb1cfcb36",
  "ed25519-priv-0xc27a6a8b6ed3013da99dc924b2f6af17f1448dedce91691f97d9e778c0761655",
  "ed25519-priv-0xd6402b3493af005ed02b07f6cd7ffdfd37fae6d4d9c88fec6ff38e90f01b21c1",
  "ed25519-priv-0xd375af1a686835905e15bf82f24fcaeed4b1b5b5fabe22c80e998acb804aa295",
];

// Configuration
const MARKET_LIQUIDITY = 500_000_000_000; // 5,000 APT
const FUNDING_PER_WALLET = 400_000_000_000; // 4,000 APT

async function createMarket(aptos: Aptos, account: Account): Promise<string | null> {
  console.log('\n' + '='.repeat(60));
  console.log('STEP 1: CREATING MARKET');
  console.log('='.repeat(60));

  const question = 'Who will be the Republican Presidential Nominee in 2028?';
  const description = 'Predict the Republican nominee for the 2028 US Presidential Election. Based on real Polymarket odds.';
  const category = 'Politics';
  const outcomes = [
    'J.D. Vance',
    'Marco Rubio',
    'Donald Trump',
    'Ron DeSantis',
    'Tucker Carlson',
    'Other'
  ];
  // End time: Nov 7, 2028
  const endTime = Math.floor(new Date('2028-11-07T00:00:00Z').getTime() / 1000);

  console.log('\nMarket Details:');
  console.log('  Question:', question);
  console.log('  Outcomes:', outcomes.join(', '));
  console.log('  End Date: Nov 7, 2028');
  console.log('  Initial Liquidity:', MARKET_LIQUIDITY / 1e8, 'APT');

  try {
    const transaction = await aptos.transaction.build.simple({
      sender: account.accountAddress,
      data: {
        function: `${MODULE}::create_multi_market`,
        functionArguments: [
          question,
          description,
          category,
          outcomes,
          endTime,
          MARKET_LIQUIDITY,
        ],
      },
    });

    const pendingTx = await aptos.signAndSubmitTransaction({
      signer: account,
      transaction,
    });

    console.log('\nTransaction:', pendingTx.hash);
    console.log('Explorer:', `https://explorer.aptoslabs.com/txn/${pendingTx.hash}?network=testnet`);

    const result = await aptos.waitForTransaction({
      transactionHash: pendingTx.hash,
    });

    if (result.success) {
      console.log('\n✓ Market created successfully!');

      // Get the new market address
      const markets = await aptos.view({
        payload: {
          function: `${MODULE}::get_all_multi_markets`,
          functionArguments: [],
        },
      });

      const marketList = markets[0] as string[];
      const newMarket = marketList[marketList.length - 1]; // Last created market
      console.log('\nNew Market Address:', newMarket);
      return newMarket;
    } else {
      console.log('\n✗ Market creation failed:', result.vm_status);
      return null;
    }
  } catch (error: any) {
    console.error('\n✗ Error creating market:', error.message);
    return null;
  }
}

async function fundBotWallets(aptos: Aptos, funder: Account): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('STEP 2: FUNDING BOT WALLETS');
  console.log('='.repeat(60));
  console.log(`\nFunding ${BOT_WALLET_KEYS.length} wallets with ${FUNDING_PER_WALLET / 1e8} APT each`);
  console.log(`Total: ${(FUNDING_PER_WALLET * BOT_WALLET_KEYS.length) / 1e8} APT`);

  let successCount = 0;

  for (let i = 0; i < BOT_WALLET_KEYS.length; i++) {
    const key = BOT_WALLET_KEYS[i];

    try {
      const recipient = Account.fromPrivateKey({
        privateKey: new Ed25519PrivateKey(key),
      });

      console.log(`\n[${i + 1}/${BOT_WALLET_KEYS.length}] ${recipient.accountAddress.toString().slice(0, 12)}...`);

      // Check current balance
      let currentBalance = 0;
      try {
        currentBalance = await aptos.getAccountAPTAmount({ accountAddress: recipient.accountAddress });
      } catch {}

      if (currentBalance >= FUNDING_PER_WALLET * 0.9) {
        console.log(`  Already has ${(currentBalance / 1e8).toFixed(2)} APT, skipping`);
        successCount++;
        continue;
      }

      const amountToSend = FUNDING_PER_WALLET - currentBalance;

      const tx = await aptos.transferCoinTransaction({
        sender: funder.accountAddress,
        recipient: recipient.accountAddress,
        amount: amountToSend,
      });

      const pendingTx = await aptos.signAndSubmitTransaction({
        signer: funder,
        transaction: tx,
      });

      await aptos.waitForTransaction({ transactionHash: pendingTx.hash });
      console.log(`  ✓ Sent ${(amountToSend / 1e8).toFixed(2)} APT`);
      successCount++;

      // Small delay to avoid rate limits
      await new Promise(r => setTimeout(r, 300));
    } catch (error: any) {
      console.log(`  ✗ Error: ${error.message.slice(0, 50)}`);
    }
  }

  console.log(`\n✓ Funded ${successCount}/${BOT_WALLET_KEYS.length} wallets`);
}

async function main() {
  const privateKey = process.env.APTOS_PRIVATE_KEY;
  if (!privateKey) {
    console.error('Set APTOS_PRIVATE_KEY env var (deployer key with 45,871 APT)');
    process.exit(1);
  }

  const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));
  const account = Account.fromPrivateKey({
    privateKey: new Ed25519PrivateKey(privateKey),
  });

  console.log('='.repeat(60));
  console.log('HFT DEMO SETUP');
  console.log('='.repeat(60));
  console.log('\nDeployer:', account.accountAddress.toString());

  // Check balance
  const balance = await aptos.getAccountAPTAmount({
    accountAddress: account.accountAddress,
  });
  console.log('Balance:', (balance / 1e8).toFixed(2), 'APT');

  const requiredBalance = MARKET_LIQUIDITY + (FUNDING_PER_WALLET * BOT_WALLET_KEYS.length);
  console.log('Required:', (requiredBalance / 1e8).toFixed(2), 'APT');

  if (balance < requiredBalance) {
    console.error('\n✗ Insufficient balance!');
    console.error(`  Have: ${(balance / 1e8).toFixed(2)} APT`);
    console.error(`  Need: ${(requiredBalance / 1e8).toFixed(2)} APT`);
    process.exit(1);
  }

  // Step 1: Create market
  const marketAddress = await createMarket(aptos, account);
  if (!marketAddress) {
    console.error('\nFailed to create market. Exiting.');
    process.exit(1);
  }

  // Step 2: Fund bot wallets
  await fundBotWallets(aptos, account);

  // Final summary
  console.log('\n' + '='.repeat(60));
  console.log('SETUP COMPLETE');
  console.log('='.repeat(60));

  const finalBalance = await aptos.getAccountAPTAmount({
    accountAddress: account.accountAddress,
  });

  console.log('\nNew Market Address:');
  console.log(`  ${marketAddress}`);
  console.log('\nDeployer remaining balance:', (finalBalance / 1e8).toFixed(2), 'APT');

  console.log('\n--- NEXT STEPS ---');
  console.log('1. Update DEFAULT_MARKET in server/hft-ultra-server.ts:');
  console.log(`   const DEFAULT_MARKET = '${marketAddress}';`);
  console.log('\n2. Start frontend:');
  console.log('   npm run dev');
  console.log('\n3. Start HFT server:');
  console.log('   ULTRA_PRIVATE_KEYS="..." APTOS_API_KEY=... npx tsx server/hft-ultra-server.ts');

  // Output the keys for easy copy-paste
  console.log('\n--- BOT WALLET KEYS (for ULTRA_PRIVATE_KEYS) ---');
  console.log(BOT_WALLET_KEYS.join(','));
}

main().catch(console.error);
