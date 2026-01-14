/**
 * Deploy 10 markets to TPS Max contract for benchmarking
 * Uses tps_max_market module (no bookkeeping aggregators)
 */
import { Aptos, AptosConfig, Network, Account, Ed25519PrivateKey } from '@aptos-labs/ts-sdk';

const TPS_MAX_CONTRACT = '0x39bf8a856da24036d9365d85a59e56545b252a533a0c355353480eb589769307';
// Use same USD1 as baseline (.env.tps_optimized) for fair comparison
const USD1_METADATA = '0xff7e7db4e38ce829a087d08d129585154bfed104d880486bc170d1464a504a8b';
const DEPLOYER_KEY = '0xB7398F69705A0F67472D8D6C466A26825AAD39C2CB80DB7A6AEB46EEA0A8483F';
// Baseline deployer key (can mint USD1)
const BASELINE_DEPLOYER_KEY = '0xeadd9d064a33c5cfb4cb98819752ec7ca38688251e13180a39d4f9a54004854b';

// Same markets as baseline for fair comparison
const MARKETS = [
  { name: 'WLFI Charter', outcomes: ['Approved', 'Rejected'] },
  { name: 'Greenland Purchase', outcomes: ['Yes', 'No'] },
  { name: 'Fed Chair 2026', outcomes: ['Powell', 'Waller', 'Bowman', 'Other'] },
  { name: 'Iran Nuclear Deal', outcomes: ['Yes', 'No'] },
  { name: 'China Taiwan', outcomes: ['Invasion', 'Status Quo', 'Peaceful'] },
  { name: 'Russia Ukraine', outcomes: ['Russia Win', 'Ukraine Win', 'Ceasefire', 'Stalemate'] },
  { name: 'Venezuela Crisis', outcomes: ['Maduro Stays', 'Opposition Wins'] },
  { name: 'Fed Rate Jan 2026', outcomes: ['Cut', 'Hold', 'Hike'] },
  { name: 'BTC Q1 2026', outcomes: ['Above 100K', 'Below 100K'] },
  { name: 'BTC 150K', outcomes: ['Yes', 'No'] },
];

async function main() {
  const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));

  const privateKey = new Ed25519PrivateKey(DEPLOYER_KEY);
  const deployer = Account.fromPrivateKey({ privateKey });

  console.log('TPS Max Market Deployment');
  console.log('='.repeat(60));
  console.log(`Contract: ${TPS_MAX_CONTRACT}`);
  console.log(`Deployer: ${deployer.accountAddress.toString()}`);
  console.log(`USD1: ${USD1_METADATA}`);
  console.log();

  // Check deployer USD1 balance
  try {
    const usd1Balance = await aptos.getAccountResource({
      accountAddress: deployer.accountAddress,
      resourceType: `0x1::fungible_asset::FungibleStore`,
    });
    console.log(`USD1 balance check: Has fungible store`);
  } catch {
    console.log('Note: Deployer may need USD1 for market creation');
  }

  // Check APT balance
  const aptBalance = await aptos.getAccountAPTAmount({ accountAddress: deployer.accountAddress });
  console.log(`APT balance: ${(aptBalance / 1e8).toFixed(2)} APT`);

  // Mint USD1 using the baseline deployer (same USD1 contract as baseline)
  const baselinePrivateKey = new Ed25519PrivateKey(BASELINE_DEPLOYER_KEY);
  const baselineDeployer = Account.fromPrivateKey({ privateKey: baselinePrivateKey });

  console.log(`\nMinting USD1 for TPS Max deployer...`);
  console.log(`  USD1 minter: ${baselineDeployer.accountAddress.toString()}`);

  // Mint 10000 USD1 (10000 * 1e8 = 1e12)
  const mintAmount = 10000_00000000; // 10000 USD1

  try {
    // First check if baseline deployer's USD1 contract has a mint function
    const mintTx = await aptos.transaction.build.simple({
      sender: baselineDeployer.accountAddress,
      data: {
        function: `0xda51d5f87be27cac0a1d72fe500da145c61b2356547ac811e0cd822c80f99a3b::usd1::mint`,
        functionArguments: [deployer.accountAddress.toString(), mintAmount],
      },
    });
    const mintPending = await aptos.signAndSubmitTransaction({ signer: baselineDeployer, transaction: mintTx });
    await aptos.waitForTransaction({ transactionHash: mintPending.hash });
    console.log(`  Minted ${mintAmount / 1e8} USD1 to deployer`);
  } catch (e: any) {
    console.log(`  USD1 mint failed: ${e.message?.slice(0, 150)}`);
    console.log(`  Trying to transfer USD1 from baseline deployer...`);

    // Try transferring from baseline deployer instead
    try {
      const transferTx = await aptos.transaction.build.simple({
        sender: baselineDeployer.accountAddress,
        data: {
          function: `0x1::primary_fungible_store::transfer`,
          typeArguments: ['0x1::fungible_asset::Metadata'],
          functionArguments: [USD1_METADATA, deployer.accountAddress.toString(), mintAmount],
        },
      });
      const transferPending = await aptos.signAndSubmitTransaction({ signer: baselineDeployer, transaction: transferTx });
      await aptos.waitForTransaction({ transactionHash: transferPending.hash });
      console.log(`  Transferred ${mintAmount / 1e8} USD1 to deployer`);
    } catch (e2: any) {
      console.log(`  Transfer also failed: ${e2.message?.slice(0, 100)}`);
    }
  }

  // Create markets
  const marketAddresses: string[] = [];

  for (let i = 0; i < MARKETS.length; i++) {
    const market = MARKETS[i];
    console.log(`\nCreating market ${i + 1}/${MARKETS.length}: ${market.name}`);

    const endTime = Math.floor(Date.now() / 1000) + 86400 * 365; // 1 year
    const initialLiquidity = 100_00000000; // 100 USD1

    try {
      const tx = await aptos.transaction.build.simple({
        sender: deployer.accountAddress,
        data: {
          function: `${TPS_MAX_CONTRACT}::tps_max_market::create_multi_market_with_collateral`,
          functionArguments: [
            market.name,
            `TPS Max benchmark market: ${market.name}`,
            'Benchmark',
            market.outcomes,
            endTime,
            initialLiquidity,
            USD1_METADATA,
          ],
        },
      });

      const pending = await aptos.signAndSubmitTransaction({ signer: deployer, transaction: tx });
      const result = await aptos.waitForTransaction({ transactionHash: pending.hash });

      // Extract market address from events
      const events = (result as any).events || [];
      const createEvent = events.find((e: any) => e.type.includes('MultiMarketCreated'));
      const marketAddr = createEvent?.data?.market_address;

      if (marketAddr) {
        marketAddresses.push(marketAddr);
        console.log(`  Created: ${marketAddr}`);
      } else {
        console.log(`  Created (no address in event)`);
      }
    } catch (e: any) {
      console.log(`  Error: ${e.message?.slice(0, 100)}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('TPS Max Markets Created:');
  console.log(marketAddresses.join(','));
  console.log('\nAdd to .env.tps_max:');
  console.log(`TPS_MAX_MARKETS=${marketAddresses.join(',')}`);
}

main().catch(console.error);
