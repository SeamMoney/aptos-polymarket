/**
 * Create a new prediction market with liquidity
 *
 * Usage: APTOS_PRIVATE_KEY=0x... npx tsx scripts/create-market.ts
 *
 * Or export your key first:
 *   export APTOS_PRIVATE_KEY=0x...
 *   npx tsx scripts/create-market.ts
 */

import {
  Aptos,
  AptosConfig,
  Network,
  Account,
  Ed25519PrivateKey,
} from '@aptos-labs/ts-sdk';

const CONTRACT_ADDRESS = '0x64a81cb9cbd14d45b87bb32ef73107a44f00069b6a96e70d75369fb7e3da5e68';
const MODULE = `${CONTRACT_ADDRESS}::market`;

const aptosConfig = new AptosConfig({ network: Network.TESTNET });
const aptos = new Aptos(aptosConfig);

// Market configuration
const MARKET_CONFIG = {
  question: 'Will Polymarket migrate to Aptos by Q2 2025?',
  description: 'Resolution: Official announcement from Polymarket team',
  endTime: Math.floor(Date.now() / 1000) + 86400 * 180, // 6 months from now
  liquidityAPT: 10, // 10 APT initial liquidity
};

async function getAccount(): Promise<Account> {
  const privateKey = process.env.APTOS_PRIVATE_KEY;
  if (!privateKey) {
    console.error('ERROR: Set APTOS_PRIVATE_KEY environment variable');
    console.error('Example: APTOS_PRIVATE_KEY=0x... npx tsx scripts/create-market.ts');
    process.exit(1);
  }

  const pk = new Ed25519PrivateKey(privateKey);
  return Account.fromPrivateKey({ privateKey: pk });
}

async function getBalance(address: string): Promise<number> {
  try {
    // Check APT as Fungible Asset (V2) - APT metadata is at 0xa
    const result = await aptos.view({
      payload: {
        function: '0x1::primary_fungible_store::balance',
        typeArguments: ['0x1::fungible_asset::Metadata'],
        functionArguments: [address, '0xa'],
      },
    });
    return Number(result[0]) / 100_000_000;
  } catch {
    // Fallback to legacy CoinStore check
    try {
      const resources = await aptos.getAccountResources({ accountAddress: address });
      const aptCoin = resources.find(r => r.type === '0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>');
      if (aptCoin) {
        return Number((aptCoin.data as any).coin.value) / 100_000_000;
      }
    } catch {}
    return 0;
  }
}

async function createMarket(account: Account) {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('CREATE PREDICTION MARKET');
  console.log('═══════════════════════════════════════════════════════════════');

  const address = account.accountAddress.toString();
  console.log(`\nAccount: ${address.slice(0, 10)}...${address.slice(-8)}`);

  const balance = await getBalance(address);
  console.log(`Balance: ${balance.toFixed(4)} APT`);

  const requiredBalance = MARKET_CONFIG.liquidityAPT + 0.1; // Extra for gas
  if (balance < requiredBalance) {
    console.error(`\nERROR: Need at least ${requiredBalance} APT, have ${balance.toFixed(4)}`);
    console.error('Fund your account at: https://aptos.dev/en/network/faucet');
    process.exit(1);
  }

  console.log('\nMarket Configuration:');
  console.log(`  Question: "${MARKET_CONFIG.question}"`);
  console.log(`  Description: "${MARKET_CONFIG.description}"`);
  console.log(`  End Time: ${new Date(MARKET_CONFIG.endTime * 1000).toISOString()}`);
  console.log(`  Initial Liquidity: ${MARKET_CONFIG.liquidityAPT} APT`);

  console.log('\nCreating market...');

  const liquidityUnits = MARKET_CONFIG.liquidityAPT * 100_000_000;

  const transaction = await aptos.transaction.build.simple({
    sender: account.accountAddress,
    data: {
      function: `${MODULE}::create_market`,
      functionArguments: [
        MARKET_CONFIG.question,
        MARKET_CONFIG.description,
        MARKET_CONFIG.endTime,
        liquidityUnits,
      ],
    },
  });

  const pendingTx = await aptos.signAndSubmitTransaction({
    signer: account,
    transaction,
  });

  console.log(`TX submitted: ${pendingTx.hash}`);
  console.log('Waiting for confirmation...');

  const committedTx = await aptos.waitForTransaction({
    transactionHash: pendingTx.hash,
  });

  if (!committedTx.success) {
    console.error('ERROR: Transaction failed');
    console.error((committedTx as any).vm_status);
    process.exit(1);
  }

  // Find market address from events
  const events = (committedTx as any).events || [];
  const createEvent = events.find((e: any) => e.type.includes('MarketCreated'));
  const marketAddress = createEvent?.data?.market_address;

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('SUCCESS!');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`\nMarket Address: ${marketAddress || 'Check explorer'}`);
  console.log(`TX Hash: ${pendingTx.hash}`);
  console.log(`Explorer: https://explorer.aptoslabs.com/txn/${pendingTx.hash}?network=testnet`);

  // Verify market
  if (marketAddress) {
    const priceResult = await aptos.view({
      payload: {
        function: `${MODULE}::get_yes_price`,
        functionArguments: [marketAddress],
      },
    });
    console.log(`\nInitial YES Price: ${priceResult[0]}% (should be 50%)`);
  }

  return marketAddress;
}

// Run
createMarket(await getAccount()).catch(console.error);
