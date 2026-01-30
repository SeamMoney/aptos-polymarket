/**
 * CREATE MARKETS ON CONTRACT B (Second Deployment)
 *
 * Creates the same demo markets on the second contract instance
 * for parallel TPS testing with dual contracts.
 */

import {
  Aptos,
  AptosConfig,
  Network,
  Account,
  Ed25519PrivateKey,
} from '@aptos-labs/ts-sdk';

// Contract B address (second deployment)
const CONTRACT_B_ADDRESS = '0x27d2d721a0afb28a003741fb413bfe97424d38aa3b939f1c9789274517871668';
const CONTRACT_B_DEPLOYER_KEY = '0x4e9a5f4dabc5909e0dd6ca18a4d8cde05b7556fae992a3d43829a4330c044f90';

// Use same USD1 metadata (shared collateral token)
const USD1_METADATA = '0x14b1ec8a5f31554d0cd19c390be83444ed519be2d7108c3e27dcbc4230c01fa3';

const MODULE = `${CONTRACT_B_ADDRESS}::multi_outcome_market`;

// Same markets as contract A
const DEMO_MARKETS = [
  {
    question: "Will WLFI receive OCC banking charter in 2026?",
    description: "World Liberty Financial banking charter approval",
    outcomes: ["Yes", "No", "Withdrawn", "Delayed to 2027"],
    category: "Business",
    daysUntilEnd: 365,
  },
  {
    question: "Will Trump acquire Greenland before 2027?",
    description: "US territorial control over Greenland",
    outcomes: ["Yes", "No", "Partial Agreement", "Negotiations Fail"],
    category: "Politics",
    daysUntilEnd: 365,
  },
  {
    question: "Who will Trump nominate as Fed Chair?",
    description: "Federal Reserve Chair nomination",
    outcomes: ["Kevin Warsh", "Kevin Hassett", "Powell Stays", "Other"],
    category: "Politics",
    daysUntilEnd: 365,
  },
  {
    question: "When will Khamenei no longer be Iran's Supreme Leader?",
    description: "Iran leadership transition timeline",
    outcomes: ["Jan 31", "Mar 31", "Jun 30", "Dec 31"],
    category: "World",
    daysUntilEnd: 365,
  },
  {
    question: "Will China invade Taiwan in 2026?",
    description: "China-Taiwan military conflict",
    outcomes: ["Yes", "No"],
    category: "World",
    daysUntilEnd: 365,
  },
  {
    question: "Russia-Ukraine ceasefire by Q2 2026?",
    description: "Formal ceasefire agreement",
    outcomes: ["Yes", "No", "Partial Ceasefire", "Escalation"],
    category: "World",
    daysUntilEnd: 180,
  },
  {
    question: "Venezuela leadership end of 2026?",
    description: "Venezuela political leadership",
    outcomes: ["Delcy Rodriguez", "Maria Corina Machado", "Military Junta", "Other"],
    category: "World",
    daysUntilEnd: 365,
  },
  {
    question: "Fed rate decision January 2026?",
    description: "FOMC January meeting decision",
    outcomes: ["Cut 25bps", "Cut 50bps", "No Change", "Hike"],
    category: "Business",
    daysUntilEnd: 30,
  },
  {
    question: "Bitcoin price end of Q1 2026?",
    description: "BTC price range at end of Q1",
    outcomes: ["<$90K", "$90K-$100K", "$100K-$120K", ">$120K"],
    category: "Crypto",
    daysUntilEnd: 90,
  },
  {
    question: "Will Bitcoin hit $150K before 2027?",
    description: "Bitcoin reaching $150K milestone",
    outcomes: ["Yes", "No"],
    category: "Crypto",
    daysUntilEnd: 365,
  },
  // Additional markets for more parallelization
  {
    question: "ETH/BTC ratio end of 2026?",
    description: "Ethereum to Bitcoin price ratio",
    outcomes: ["<0.03", "0.03-0.04", "0.04-0.05", ">0.05"],
    category: "Crypto",
    daysUntilEnd: 365,
  },
  {
    question: "Will SOL flip ETH market cap in 2026?",
    description: "Solana vs Ethereum market cap",
    outcomes: ["Yes", "No"],
    category: "Crypto",
    daysUntilEnd: 365,
  },
  {
    question: "US inflation rate Dec 2026?",
    description: "Annual CPI inflation rate",
    outcomes: ["<2%", "2-3%", "3-4%", ">4%"],
    category: "Business",
    daysUntilEnd: 365,
  },
  {
    question: "Will there be a US recession in 2026?",
    description: "Two consecutive quarters of GDP decline",
    outcomes: ["Yes", "No"],
    category: "Business",
    daysUntilEnd: 365,
  },
  {
    question: "S&P 500 end of 2026?",
    description: "S&P 500 index level",
    outcomes: ["<5500", "5500-6000", "6000-6500", ">6500"],
    category: "Business",
    daysUntilEnd: 365,
  },
];

const INITIAL_LIQUIDITY = 1000_00000000; // 1000 USD1

async function main() {
  console.log('='.repeat(70));
  console.log('   CREATE MARKETS ON CONTRACT B');
  console.log('   Second contract instance for parallel TPS');
  console.log('='.repeat(70));
  console.log();

  const aptos = new Aptos(new AptosConfig({
    network: Network.TESTNET,
    fullnode: 'https://fullnode.testnet.aptoslabs.com/v1',
  }));

  const deployer = Account.fromPrivateKey({
    privateKey: new Ed25519PrivateKey(CONTRACT_B_DEPLOYER_KEY),
  });

  console.log(`Contract B: ${CONTRACT_B_ADDRESS}`);
  console.log(`Deployer: ${deployer.accountAddress.toString()}`);
  console.log(`USD1 Metadata: ${USD1_METADATA}`);
  console.log(`Markets to create: ${DEMO_MARKETS.length}`);
  console.log();

  // Check deployer USD1 balance for liquidity
  try {
    const usd1Balance = await aptos.view({
      payload: {
        function: `0xca4d40eae9f07fb28a121862d649203fb4335ece9536ee51790e19f812ff7aea::usd1::balance`,
        functionArguments: [deployer.accountAddress.toString()],
      },
    });
    console.log(`Deployer USD1 balance: ${Number(usd1Balance[0]) / 1e8} USD1`);

    const totalNeeded = DEMO_MARKETS.length * (INITIAL_LIQUIDITY / 1e8);
    console.log(`Total USD1 needed: ${totalNeeded} USD1`);

    if (Number(usd1Balance[0]) < DEMO_MARKETS.length * INITIAL_LIQUIDITY) {
      console.log('\nWARNING: May not have enough USD1 for all markets');
      console.log('Run: npx tsx scripts/mint-usd1-to-deployer.ts first');
    }
  } catch (e) {
    console.log('Could not check USD1 balance');
  }

  console.log();
  console.log('Creating markets...');
  console.log();

  const createdMarkets: string[] = [];

  for (let i = 0; i < DEMO_MARKETS.length; i++) {
    const market = DEMO_MARKETS[i];
    const endTime = Math.floor(Date.now() / 1000) + (market.daysUntilEnd * 24 * 60 * 60);

    console.log(`[${i + 1}/${DEMO_MARKETS.length}] ${market.question.slice(0, 50)}...`);

    try {
      const txn = await aptos.transaction.build.simple({
        sender: deployer.accountAddress,
        data: {
          function: `${MODULE}::create_multi_market_with_collateral`,
          functionArguments: [
            market.question,
            market.description,
            market.category,
            market.outcomes,
            endTime,
            INITIAL_LIQUIDITY,
            USD1_METADATA,
          ],
        },
      });

      const pending = await aptos.signAndSubmitTransaction({
        signer: deployer,
        transaction: txn,
      });

      const result = await aptos.waitForTransaction({ transactionHash: pending.hash });

      // Extract market address from events
      let marketAddr = '';
      if (result.events) {
        for (const event of result.events) {
          if (event.type.includes('MultiMarketCreated')) {
            marketAddr = (event as any).data.market_address;
            break;
          }
        }
      }

      if (marketAddr) {
        createdMarkets.push(marketAddr);
        console.log(`   ✓ Created: ${marketAddr.slice(0, 20)}...`);
      } else {
        console.log(`   ✓ Created (hash: ${pending.hash.slice(0, 16)}...)`);
      }

      // Small delay between creates
      await new Promise(r => setTimeout(r, 500));

    } catch (e: any) {
      console.log(`   ✗ Failed: ${e.message?.slice(0, 50)}`);
    }
  }

  console.log();
  console.log('='.repeat(70));
  console.log('   MARKETS CREATED ON CONTRACT B');
  console.log('='.repeat(70));
  console.log();
  console.log(`Total markets: ${createdMarkets.length}`);
  console.log();
  console.log('Market addresses (for MULTI_MARKETS_B env var):');
  console.log(createdMarkets.join(','));
  console.log();
  console.log('Add to .env or worker config:');
  console.log(`CONTRACT_B_ADDRESS="${CONTRACT_B_ADDRESS}"`);
  console.log(`MULTI_MARKETS_B="${createdMarkets.join(',')}"`);
}

main().catch(console.error);
