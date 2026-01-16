/**
 * CREATE DEMO MARKETS WITH USD1 COLLATERAL
 *
 * Creates 10 demo markets for HFT testing using the centralized wallet registry.
 */

import {
  Aptos,
  AptosConfig,
  Network,
  Account,
  Ed25519PrivateKey,
} from '@aptos-labs/ts-sdk';
import { WALLETS, CONTRACTS, cleanKey } from '../config/wallets';

const CONTRACT_ADDRESS = CONTRACTS.address;
const USD1_METADATA = CONTRACTS.usd1Metadata;
const MODULE = `${CONTRACT_ADDRESS}::multi_outcome_market`;

// Polymarket-style markets
const DEMO_MARKETS = [
  // === TRUMP / WLFI MARKETS ===
  {
    question: "Will WLFI receive OCC banking charter in 2026?",
    description: "World Liberty Financial has applied for a national trust bank charter from the Office of the Comptroller of the Currency. Will it be approved in 2026?",
    outcomes: ["Yes", "No", "Withdrawn", "Delayed to 2027"],
    category: "Business",
    daysUntilEnd: 365,
  },
  {
    question: "Will Trump acquire Greenland before 2027?",
    description: "Will the United States successfully acquire or establish significant territorial control over Greenland by the end of 2026?",
    outcomes: ["Yes", "No", "Partial Agreement", "Negotiations Fail"],
    category: "Politics",
    daysUntilEnd: 365,
  },
  {
    question: "Who will Trump nominate as Fed Chair?",
    description: "Who will President Trump nominate to replace Jerome Powell as Federal Reserve Chair?",
    outcomes: ["Kevin Warsh", "Kevin Hassett", "Powell Stays", "Other"],
    category: "Politics",
    daysUntilEnd: 365,
  },

  // === GEOPOLITICS MARKETS ===
  {
    question: "When will Khamenei no longer be Iran's Supreme Leader?",
    description: "Will Ayatollah Ali Khamenei no longer be Supreme Leader of Iran by a certain date in 2026?",
    outcomes: ["Jan 31", "Mar 31", "Jun 30", "Dec 31"],
    category: "World",
    daysUntilEnd: 365,
  },
  {
    question: "Will China invade Taiwan in 2026?",
    description: "Will China launch a military invasion or armed attack on Taiwan during 2026?",
    outcomes: ["Yes", "No"],
    category: "World",
    daysUntilEnd: 365,
  },
  {
    question: "Russia-Ukraine ceasefire by Q2 2026?",
    description: "Will Russia and Ukraine agree to a formal ceasefire by June 30, 2026?",
    outcomes: ["Yes", "No", "Partial Ceasefire", "Escalation"],
    category: "World",
    daysUntilEnd: 180,
  },
  {
    question: "Venezuela leadership end of 2026?",
    description: "Who will be the leader of Venezuela at the end of 2026?",
    outcomes: ["Delcy Rodriguez", "Maria Corina Machado", "Military Junta", "Other"],
    category: "World",
    daysUntilEnd: 365,
  },

  // === CRYPTO / ECONOMIC MARKETS ===
  {
    question: "Fed rate decision January 2026?",
    description: "What will the Federal Reserve decide at the January 27-28, 2026 FOMC meeting?",
    outcomes: ["Cut 25bps", "Cut 50bps", "No Change", "Hike"],
    category: "Business",
    daysUntilEnd: 30,
  },
  {
    question: "Bitcoin price end of Q1 2026?",
    description: "What will be the price of Bitcoin at the end of Q1 2026 (March 31)?",
    outcomes: ["<$90K", "$90K-$100K", "$100K-$120K", ">$120K"],
    category: "Crypto",
    daysUntilEnd: 90,
  },
  {
    question: "Will Bitcoin hit $150K before 2027?",
    description: "Will Bitcoin reach $150,000 USD at any point before January 1, 2027?",
    outcomes: ["Yes", "No"],
    category: "Crypto",
    daysUntilEnd: 365,
  },
];

// Initial liquidity per market (1000 USD1)
const INITIAL_LIQUIDITY = 1000_00000000;

async function main() {
  const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));

  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║           CREATE DEMO MARKETS WITH USD1                      ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  Contract: ${CONTRACT_ADDRESS.slice(0, 20)}...`.padEnd(65) + '║');
  console.log(`║  USD1 Metadata: ${USD1_METADATA.slice(0, 20)}...`.padEnd(65) + '║');
  console.log(`║  Markets to create: ${DEMO_MARKETS.length}`.padEnd(65) + '║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  // Use contract deployer as market creator (can mint USD1)
  const creatorKey = new Ed25519PrivateKey(cleanKey(CONTRACTS.deployerKey));
  const creator = Account.fromPrivateKey({ privateKey: creatorKey });

  console.log(`Creator: ${creator.accountAddress.toString().slice(0, 20)}...`);

  // First, mint USD1 to creator for initial liquidity
  const totalNeeded = INITIAL_LIQUIDITY * DEMO_MARKETS.length;
  console.log(`Minting ${totalNeeded / 100_000_000} USD1 for initial liquidity...`);

  const mintTx = await aptos.transaction.build.simple({
    sender: creator.accountAddress,
    data: {
      function: `${CONTRACT_ADDRESS}::usd1::mint`,
      functionArguments: [creator.accountAddress.toString(), totalNeeded],
    },
  });

  const mintPending = await aptos.signAndSubmitTransaction({
    signer: creator,
    transaction: mintTx,
  });
  await aptos.waitForTransaction({ transactionHash: mintPending.hash });
  console.log('✓ USD1 minted\n');

  // Create markets
  const marketAddresses: string[] = [];

  for (let i = 0; i < DEMO_MARKETS.length; i++) {
    const m = DEMO_MARKETS[i];
    process.stdout.write(`[${i + 1}/${DEMO_MARKETS.length}] ${m.question.slice(0, 40)}... `);

    try {
      // End time based on market's daysUntilEnd
      const endTime = Math.floor(Date.now() / 1000) + (m.daysUntilEnd || 365) * 24 * 60 * 60;

      const createTx = await aptos.transaction.build.simple({
        sender: creator.accountAddress,
        data: {
          function: `${MODULE}::create_multi_market_with_collateral`,
          functionArguments: [
            m.question,
            m.description || `Market for: ${m.question}`,
            m.category,
            m.outcomes,
            endTime,
            INITIAL_LIQUIDITY,
            USD1_METADATA,
          ],
        },
      });

      const pending = await aptos.signAndSubmitTransaction({
        signer: creator,
        transaction: createTx,
      });

      const result = await aptos.waitForTransaction({
        transactionHash: pending.hash,
        options: { checkSuccess: true },
      });

      // Get market address from events
      const events = (result as any).events || [];
      const createEvent = events.find((e: any) =>
        e.type?.includes('MultiMarketCreated')
      );

      if (createEvent) {
        const marketAddr = createEvent.data.market_address;
        marketAddresses.push(marketAddr);
        console.log(`✓ ${marketAddr.slice(0, 16)}...`);
      } else {
        console.log('✓ (no event found)');
      }

      await new Promise(r => setTimeout(r, 500));

    } catch (e: any) {
      console.log(`✗ Error: ${e.message?.slice(0, 40) || e}`);
    }
  }

  // Summary
  console.log('');
  console.log('═'.repeat(60));
  console.log(`Created ${marketAddresses.length}/${DEMO_MARKETS.length} markets`);
  console.log('═'.repeat(60));

  if (marketAddresses.length > 0) {
    console.log('\nMarket addresses (for .env.usd1):');
    console.log(`MULTI_MARKETS="${marketAddresses.join(',')}"`);
    console.log(`\nVITE_MULTI_MARKETS="${marketAddresses.join(',')}"`);
  }
}

main().catch(console.error);
