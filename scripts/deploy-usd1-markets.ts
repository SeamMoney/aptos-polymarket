/**
 * Deploy Demo Markets with USD1 Collateral
 *
 * This script deploys prediction markets using USD1 stablecoin as collateral
 * instead of APT. USD1 avoids global state contention that limits TPS.
 *
 * Prerequisites:
 * 1. Contracts must be deployed (aptos move publish)
 * 2. USD1 must be initialized (call usd1::initialize once)
 * 3. Deployer must have USD1 balance for initial liquidity
 *
 * Usage:
 *   APTOS_PRIVATE_KEY=0x... npx tsx scripts/deploy-usd1-markets.ts
 *
 * Or to just initialize USD1:
 *   APTOS_PRIVATE_KEY=0x... npx tsx scripts/deploy-usd1-markets.ts --init-usd1
 */

import {
  Aptos,
  AptosConfig,
  Network,
  Account,
  Ed25519PrivateKey,
} from '@aptos-labs/ts-sdk';

// Contract address (update after fresh deployment)
const DEFAULT_CONTRACT = process.env.CONTRACT_ADDRESS || '0xa2e5e47aab07fed78a3bcf95135ee2dad20c547499c94cb16a3e047859ffa7e1';
const MODULE = `${DEFAULT_CONTRACT}::multi_outcome_market` as const;
const USD1_MODULE = `${DEFAULT_CONTRACT}::usd1` as const;

// Market definitions - same as before but using USD1
const DEMO_MARKETS = [
  // === Trump / WLFI (3 markets) ===
  {
    question: 'Will WLFI receive OCC banking charter in 2026?',
    description: 'World Liberty Financial has applied for a national trust bank charter from the Office of the Comptroller of the Currency. Will it be approved in 2026?',
    category: 'Business',
    outcomes: ['Yes', 'No', 'Withdrawn', 'Delayed to 2027'],
    daysUntilEnd: 365,
    initialLiquidity: 50_000_000, // 0.5 USD1 (8 decimals)
  },
  {
    question: 'Will Trump acquire Greenland before 2027?',
    description: 'Will the United States successfully acquire or establish significant territorial control over Greenland by the end of 2026?',
    category: 'Politics',
    outcomes: ['Yes', 'No', 'Partial Agreement', 'Negotiations Fail'],
    daysUntilEnd: 365,
    initialLiquidity: 50_000_000,
  },
  {
    question: 'Who will Trump nominate as Fed Chair?',
    description: 'Who will President Trump nominate to replace Jerome Powell as Federal Reserve Chair?',
    category: 'Politics',
    outcomes: ['Kevin Warsh', 'Kevin Hassett', 'Powell Stays', 'Other'],
    daysUntilEnd: 365,
    initialLiquidity: 50_000_000,
  },

  // === Geopolitics (4 markets) ===
  {
    question: 'Khamenei out as Iran Supreme Leader by June 2026?',
    description: 'Will Ayatollah Ali Khamenei no longer be Supreme Leader of Iran by June 30, 2026?',
    category: 'World',
    outcomes: ['Yes', 'No'],
    daysUntilEnd: 180,
    initialLiquidity: 50_000_000,
  },
  {
    question: 'Will China invade Taiwan in 2026?',
    description: 'Will China launch a military invasion or armed attack on Taiwan during 2026?',
    category: 'World',
    outcomes: ['Yes', 'No'],
    daysUntilEnd: 365,
    initialLiquidity: 50_000_000,
  },
  {
    question: 'Russia-Ukraine ceasefire by Q2 2026?',
    description: 'Will Russia and Ukraine agree to a formal ceasefire by June 30, 2026?',
    category: 'World',
    outcomes: ['Yes', 'No', 'Partial Ceasefire', 'Escalation'],
    daysUntilEnd: 180,
    initialLiquidity: 50_000_000,
  },
  {
    question: 'Venezuela leadership end of 2026?',
    description: 'Who will be the leader of Venezuela at the end of 2026?',
    category: 'World',
    outcomes: ['Delcy Rodriguez', 'Maria Corina Machado', 'Military Junta', 'Other'],
    daysUntilEnd: 365,
    initialLiquidity: 50_000_000,
  },

  // === Crypto / Economic (3 markets) ===
  {
    question: 'Fed rate decision January 2026?',
    description: 'What will the Federal Reserve decide at the January 27-28, 2026 FOMC meeting?',
    category: 'Business',
    outcomes: ['Cut 25bps', 'Cut 50bps', 'No Change', 'Hike'],
    daysUntilEnd: 30,
    initialLiquidity: 50_000_000,
  },
  {
    question: 'Bitcoin price end of Q1 2026?',
    description: 'What will be the price of Bitcoin at the end of Q1 2026 (March 31)?',
    category: 'Crypto',
    outcomes: ['<$90K', '$90K-$100K', '$100K-$120K', '>$120K'],
    daysUntilEnd: 90,
    initialLiquidity: 50_000_000,
  },
  {
    question: 'Will Bitcoin hit $150K before 2027?',
    description: 'Will Bitcoin reach $150,000 USD at any point before January 1, 2027?',
    category: 'Crypto',
    outcomes: ['Yes', 'No'],
    daysUntilEnd: 365,
    initialLiquidity: 50_000_000,
  },
];

// Deployer key
const DEPLOYER_KEY = process.env.APTOS_PRIVATE_KEY || '0x48ee96658dd826f6541f5ee501c5784e6b341f04c52c641823f4b097b61eb79b';

async function main() {
  const initUsd1Only = process.argv.includes('--init-usd1');
  const skipUsd1Init = process.argv.includes('--skip-usd1-init');

  const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));
  const account = Account.fromPrivateKey({
    privateKey: new Ed25519PrivateKey(DEPLOYER_KEY.replace('ed25519-priv-', '')),
  });

  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║        USD1 MARKET DEPLOYMENT - HIGH TPS DEMO                ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  Account: ${account.accountAddress.toString().slice(0, 20)}...`.padEnd(65) + '║');
  console.log(`║  Contract: ${DEFAULT_CONTRACT.slice(0, 20)}...`.padEnd(65) + '║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  // Step 1: Check if USD1 is initialized
  let usd1Metadata: string;
  try {
    const metadataResult = await aptos.view({
      payload: {
        function: `${USD1_MODULE}::get_metadata_address`,
        functionArguments: [],
      },
    });
    usd1Metadata = metadataResult[0] as string;
    console.log(`✓ USD1 already initialized: ${usd1Metadata.slice(0, 20)}...`);
  } catch (e) {
    console.log('USD1 not initialized. Initializing now...');

    try {
      const initTx = await aptos.transaction.build.simple({
        sender: account.accountAddress,
        data: {
          function: `${USD1_MODULE}::initialize`,
          functionArguments: [],
        },
      });

      const pendingTx = await aptos.signAndSubmitTransaction({
        signer: account,
        transaction: initTx,
      });

      await aptos.waitForTransaction({ transactionHash: pendingTx.hash });

      const metadataResult = await aptos.view({
        payload: {
          function: `${USD1_MODULE}::get_metadata_address`,
          functionArguments: [],
        },
      });
      usd1Metadata = metadataResult[0] as string;
      console.log(`✓ USD1 initialized: ${usd1Metadata}`);
      console.log(`  Explorer: https://explorer.aptoslabs.com/txn/${pendingTx.hash}?network=testnet`);
    } catch (initError: any) {
      console.error(`✗ Failed to initialize USD1: ${initError.message}`);
      process.exit(1);
    }
  }

  if (initUsd1Only) {
    console.log('\n--init-usd1 flag set. Stopping after USD1 initialization.');
    console.log(`\nUSD1 Metadata Address: ${usd1Metadata}`);
    process.exit(0);
  }

  // Step 2: Initialize market registry if needed
  if (!skipUsd1Init) {
    try {
      const countResult = await aptos.view({
        payload: {
          function: `${MODULE}::get_market_count`,
          functionArguments: [],
        },
      });
      console.log(`✓ Market registry initialized (${countResult[0]} markets)`);
    } catch (e) {
      console.log('Market registry not initialized. Initializing now...');

      try {
        const initTx = await aptos.transaction.build.simple({
          sender: account.accountAddress,
          data: {
            function: `${MODULE}::initialize`,
            functionArguments: [],
          },
        });

        const pendingTx = await aptos.signAndSubmitTransaction({
          signer: account,
          transaction: initTx,
        });

        await aptos.waitForTransaction({ transactionHash: pendingTx.hash });
        console.log(`✓ Market registry initialized`);
      } catch (initError: any) {
        console.error(`✗ Failed to initialize registry: ${initError.message}`);
        process.exit(1);
      }
    }
  }

  // Step 3: Mint USD1 for initial liquidity
  const totalLiquidity = DEMO_MARKETS.reduce((sum, m) => sum + m.initialLiquidity, 0);
  const mintAmount = totalLiquidity * 2; // Mint 2x to have buffer

  console.log(`\nMinting ${(mintAmount / 100_000_000).toFixed(2)} USD1 for market liquidity...`);

  try {
    const mintTx = await aptos.transaction.build.simple({
      sender: account.accountAddress,
      data: {
        function: `${USD1_MODULE}::mint_to_self`,
        functionArguments: [mintAmount],
      },
    });

    const pendingTx = await aptos.signAndSubmitTransaction({
      signer: account,
      transaction: mintTx,
    });

    await aptos.waitForTransaction({ transactionHash: pendingTx.hash });

    // Check balance
    const balanceResult = await aptos.view({
      payload: {
        function: `${USD1_MODULE}::balance`,
        functionArguments: [account.accountAddress.toString()],
      },
    });
    console.log(`✓ USD1 Balance: ${(Number(balanceResult[0]) / 100_000_000).toFixed(2)} USD1`);
  } catch (mintError: any) {
    console.error(`✗ Failed to mint USD1: ${mintError.message}`);
  }

  // Step 4: Deploy markets
  console.log('');
  console.log('Deploying markets with USD1 collateral...');
  console.log('');

  const deployedMarkets: { question: string; address: string; txHash: string }[] = [];
  const failedMarkets: { question: string; error: string }[] = [];

  for (let i = 0; i < DEMO_MARKETS.length; i++) {
    const market = DEMO_MARKETS[i];
    const endTime = Math.floor(Date.now() / 1000) + (86400 * market.daysUntilEnd);

    console.log(`[${i + 1}/${DEMO_MARKETS.length}] Creating: ${market.question.slice(0, 50)}...`);

    try {
      const transaction = await aptos.transaction.build.simple({
        sender: account.accountAddress,
        data: {
          function: `${MODULE}::create_multi_market_with_collateral`,
          functionArguments: [
            market.question,
            market.description,
            market.category,
            market.outcomes,
            endTime,
            market.initialLiquidity,
            usd1Metadata, // Use USD1 as collateral
          ],
        },
      });

      const pendingTx = await aptos.signAndSubmitTransaction({
        signer: account,
        transaction,
      });

      // Wait for confirmation
      const result = await aptos.waitForTransaction({
        transactionHash: pendingTx.hash,
      });

      if (result.success) {
        // Parse market address from events
        const events = (result as any).events || [];
        const createEvent = events.find((e: any) =>
          e.type.includes('MultiMarketCreated')
        );

        let newMarketAddress = 'unknown';
        if (createEvent && createEvent.data) {
          newMarketAddress = createEvent.data.market_address;
        }

        deployedMarkets.push({
          question: market.question,
          address: newMarketAddress,
          txHash: pendingTx.hash,
        });

        console.log(`   ✓ SUCCESS - ${newMarketAddress.slice(0, 20)}...`);
      } else {
        failedMarkets.push({ question: market.question, error: 'Transaction failed' });
        console.log(`   ✗ FAILED`);
      }

      // Small delay between deployments
      await new Promise(r => setTimeout(r, 1000));

    } catch (error: any) {
      failedMarkets.push({ question: market.question, error: error.message });
      console.log(`   ✗ ERROR: ${error.message.slice(0, 50)}...`);
    }
  }

  // Summary
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║                    DEPLOYMENT SUMMARY                        ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  Deployed: ${deployedMarkets.length}/${DEMO_MARKETS.length} markets`.padEnd(65) + '║');
  console.log(`║  Failed: ${failedMarkets.length} markets`.padEnd(65) + '║');
  console.log(`║  Collateral: USD1`.padEnd(65) + '║');
  console.log(`║  USD1 Metadata: ${usd1Metadata.slice(0, 20)}...`.padEnd(65) + '║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  if (deployedMarkets.length > 0) {
    console.log('Deployed Market Addresses (for MULTI_MARKETS env):');
    console.log('─'.repeat(66));
    const addresses = deployedMarkets.map(m => m.address).join(',');
    console.log(addresses);
    console.log('');
    console.log('Individual Markets:');
    deployedMarkets.forEach((m, i) => {
      console.log(`  ${i + 1}. ${m.question.slice(0, 45)}...`);
      console.log(`     Address: ${m.address}`);
      console.log(`     Explorer: https://explorer.aptoslabs.com/txn/${m.txHash}?network=testnet`);
    });
  }

  if (failedMarkets.length > 0) {
    console.log('');
    console.log('Failed Markets:');
    failedMarkets.forEach((m, i) => {
      console.log(`  ${i + 1}. ${m.question}`);
      console.log(`     Error: ${m.error}`);
    });
  }

  // Output env vars for easy copy-paste
  if (deployedMarkets.length > 0) {
    console.log('');
    console.log('═'.repeat(66));
    console.log('Copy these to your .env or worker config:');
    console.log('═'.repeat(66));
    console.log(`CONTRACT_ADDRESS="${DEFAULT_CONTRACT}"`);
    console.log(`USD1_METADATA="${usd1Metadata}"`);
    console.log(`MULTI_MARKETS="${deployedMarkets.map(m => m.address).join(',')}"`);
  }
}

main().catch(console.error);
