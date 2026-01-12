/**
 * Add Republican 2028 Nominee Market
 */
import {
  Aptos,
  AptosConfig,
  Network,
  Account,
  Ed25519PrivateKey,
} from '@aptos-labs/ts-sdk';
import { CONTRACTS, WALLETS, cleanKey } from '../config/wallets';

const CONTRACT_ADDRESS = CONTRACTS.address;
const USD1_METADATA = CONTRACTS.usd1Metadata;
const MODULE = `${CONTRACT_ADDRESS}::multi_outcome_market`;

// The missing market from Polymarket
const MARKET = {
  question: "Who will be the Republican Presidential Nominee in 2028?",
  description: "Who will win the Republican nomination for President of the United States in 2028?",
  outcomes: ["J.D. Vance", "Marco Rubio", "Ron DeSantis", "Other"],
  category: "Politics",
  daysUntilEnd: 1095, // ~3 years
};

const INITIAL_LIQUIDITY = 1000_00000000; // 1000 USD1

async function main() {
  const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));

  const creatorKey = new Ed25519PrivateKey(cleanKey(WALLETS.usd1Deployer.key));
  const creator = Account.fromPrivateKey({ privateKey: creatorKey });

  console.log("Creating Republican 2028 Nominee market...");
  console.log(`Creator: ${creator.accountAddress.toString()}`);

  // First mint USD1 for liquidity
  const mintTx = await aptos.transaction.build.simple({
    sender: creator.accountAddress,
    data: {
      function: `${CONTRACT_ADDRESS}::usd1::mint`,
      functionArguments: [creator.accountAddress.toString(), INITIAL_LIQUIDITY],
    },
  });

  const mintPending = await aptos.signAndSubmitTransaction({
    signer: creator,
    transaction: mintTx,
  });
  await aptos.waitForTransaction({ transactionHash: mintPending.hash });
  console.log('✓ USD1 minted for liquidity');

  // Create the market
  const endTime = Math.floor(Date.now() / 1000) + MARKET.daysUntilEnd * 24 * 60 * 60;

  const createTx = await aptos.transaction.build.simple({
    sender: creator.accountAddress,
    data: {
      function: `${MODULE}::create_multi_market_with_collateral`,
      functionArguments: [
        MARKET.question,
        MARKET.description,
        MARKET.category,
        MARKET.outcomes,
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
  const createEvent = events.find((e: any) => e.type?.includes('MultiMarketCreated'));

  if (createEvent) {
    const marketAddr = createEvent.data.market_address;
    console.log(`✓ Market created: ${marketAddr}`);
    console.log(`\nAdd this to the beginning of MULTI_MARKETS:`);
    console.log(marketAddr);
  } else {
    console.log('✓ Market created (no event found)');
    console.log(`Tx: ${pending.hash}`);
  }
}

main().catch(console.error);
