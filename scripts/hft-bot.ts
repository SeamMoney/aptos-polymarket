/**
 * HFT Bot - Real on-chain high-frequency trading on Aptos
 *
 * Demonstrates Aptos speed with rapid buy/sell transactions
 *
 * Usage: APTOS_PRIVATE_KEY=0x... npx tsx scripts/hft-bot.ts [market_address]
 */

import {
  Aptos,
  AptosConfig,
  Network,
  Account,
  Ed25519PrivateKey,
  CommittedTransactionResponse,
} from '@aptos-labs/ts-sdk';

const CONTRACT_ADDRESS = '0x3f13249e31a1fbdb886741f7945cccc40307311abc08ba188894bd1a050e19b4';
const MODULE = `${CONTRACT_ADDRESS}::market`;

const aptosConfig = new AptosConfig({ network: Network.TESTNET });
const aptos = new Aptos(aptosConfig);

// Bot configuration
const CONFIG = {
  tradesPerSecond: 1, // How many trades per second (1 for sequential reliability)
  tradeDurationSeconds: 20, // Total runtime
  tradeAmountAPT: 0.1, // Amount per trade
  botName: process.env.BOT_NAME || 'AlphaBot',
  waitForConfirmation: true, // Wait for each tx before next
};

interface TradeResult {
  bot: string;
  action: 'BUY_YES' | 'BUY_NO' | 'SELL_YES' | 'SELL_NO';
  amount: number;
  latencyMs: number;
  success: boolean;
  txHash?: string;
  gasUsed?: number;
  timestamp: number;
}

class HFTBot {
  private account: Account;
  private marketAddress: string;
  private results: TradeResult[] = [];
  private running = false;

  constructor(account: Account, marketAddress: string) {
    this.account = account;
    this.marketAddress = marketAddress;
  }

  async getPrice(): Promise<{ yes: number; no: number }> {
    const result = await aptos.view({
      payload: {
        function: `${MODULE}::get_yes_price`,
        functionArguments: [this.marketAddress],
      },
    });
    const yesPrice = Number(result[0]);
    return { yes: yesPrice, no: 100 - yesPrice };
  }

  async getPositions(): Promise<{ yes: number; no: number }> {
    try {
      const result = await aptos.view({
        payload: {
          function: `${MODULE}::get_user_positions`,
          functionArguments: [this.marketAddress, this.account.accountAddress.toString()],
        },
      });
      return {
        yes: Number(result[0]) / 100_000_000,
        no: Number(result[1]) / 100_000_000,
      };
    } catch {
      return { yes: 0, no: 0 };
    }
  }

  async getBalance(): Promise<number> {
    try {
      // Check APT as Fungible Asset (V2) - APT metadata is at 0xa
      const result = await aptos.view({
        payload: {
          function: '0x1::primary_fungible_store::balance',
          typeArguments: ['0x1::fungible_asset::Metadata'],
          functionArguments: [this.account.accountAddress.toString(), '0xa'],
        },
      });
      return Number(result[0]) / 100_000_000;
    } catch {
      // Fallback to legacy CoinStore check
      try {
        const resources = await aptos.getAccountResources({
          accountAddress: this.account.accountAddress
        });
        const aptCoin = resources.find(
          r => r.type === '0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>'
        );
        if (aptCoin) {
          return Number((aptCoin.data as any).coin.value) / 100_000_000;
        }
      } catch {}
      return 0;
    }
  }

  async executeTrade(action: 'BUY_YES' | 'BUY_NO' | 'SELL_YES' | 'SELL_NO'): Promise<TradeResult> {
    const startTime = Date.now();
    const amountUnits = Math.floor(CONFIG.tradeAmountAPT * 100_000_000);

    let funcName: string;
    switch (action) {
      case 'BUY_YES': funcName = 'buy_yes'; break;
      case 'BUY_NO': funcName = 'buy_no'; break;
      case 'SELL_YES': funcName = 'sell_yes'; break;
      case 'SELL_NO': funcName = 'sell_no'; break;
    }

    try {
      const transaction = await aptos.transaction.build.simple({
        sender: this.account.accountAddress,
        data: {
          function: `${MODULE}::${funcName}`,
          functionArguments: [this.marketAddress, amountUnits, 0], // 0 = no slippage protection for speed
        },
      });

      const pendingTx = await aptos.signAndSubmitTransaction({
        signer: this.account,
        transaction,
      });

      const committedTx = await aptos.waitForTransaction({
        transactionHash: pendingTx.hash,
      }) as CommittedTransactionResponse;

      const endTime = Date.now();
      const latencyMs = endTime - startTime;

      const result: TradeResult = {
        bot: CONFIG.botName,
        action,
        amount: CONFIG.tradeAmountAPT,
        latencyMs,
        success: committedTx.success,
        txHash: pendingTx.hash,
        gasUsed: Number(committedTx.gas_used),
        timestamp: endTime,
      };

      this.results.push(result);
      return result;
    } catch (error) {
      const endTime = Date.now();
      const result: TradeResult = {
        bot: CONFIG.botName,
        action,
        amount: CONFIG.tradeAmountAPT,
        latencyMs: endTime - startTime,
        success: false,
        timestamp: endTime,
      };
      this.results.push(result);
      return result;
    }
  }

  async run(): Promise<void> {
    this.running = true;
    const address = this.account.accountAddress.toString();

    console.log('════════════════════════════════════════════════════════════════');
    console.log('HFT BOT - REAL ON-CHAIN TRADING');
    console.log('════════════════════════════════════════════════════════════════');
    console.log(`\nBot Name: ${CONFIG.botName}`);
    console.log(`Account: ${address.slice(0, 10)}...${address.slice(-8)}`);
    console.log(`Market: ${this.marketAddress.slice(0, 10)}...${this.marketAddress.slice(-8)}`);

    const balance = await this.getBalance();
    console.log(`Balance: ${balance.toFixed(4)} APT`);

    const price = await this.getPrice();
    console.log(`Current Price: YES ${price.yes}% / NO ${price.no}%`);

    const requiredBalance = CONFIG.tradeAmountAPT * CONFIG.tradesPerSecond * CONFIG.tradeDurationSeconds + 1;
    if (balance < requiredBalance) {
      console.error(`\nWARNING: Low balance. Recommended: ${requiredBalance.toFixed(2)} APT`);
    }

    console.log(`\nConfiguration:`);
    console.log(`  Trades/sec: ${CONFIG.tradesPerSecond}`);
    console.log(`  Duration: ${CONFIG.tradeDurationSeconds}s`);
    console.log(`  Amount/trade: ${CONFIG.tradeAmountAPT} APT`);

    console.log('\n════════════════════════════════════════════════════════════════');
    console.log('LIVE TRADES');
    console.log('════════════════════════════════════════════════════════════════\n');

    const intervalMs = 1000 / CONFIG.tradesPerSecond;
    const totalTrades = CONFIG.tradesPerSecond * CONFIG.tradeDurationSeconds;
    let tradeCount = 0;

    // Alternate between buy/sell to maintain positions
    const actions: Array<'BUY_YES' | 'BUY_NO' | 'SELL_YES' | 'SELL_NO'> = [
      'BUY_YES', 'BUY_NO', 'SELL_YES', 'SELL_NO'
    ];

    const startTime = Date.now();

    while (this.running && tradeCount < totalTrades) {
      const action = actions[tradeCount % actions.length];
      const result = await this.executeTrade(action);

      const statusIcon = result.success ? '✓' : '✗';
      const statusColor = result.success ? '\x1b[32m' : '\x1b[31m';
      const resetColor = '\x1b[0m';

      console.log(
        `${statusColor}${statusIcon}${resetColor} ` +
        `[${result.latencyMs.toString().padStart(4)}ms] ` +
        `${result.action.padEnd(8)} ` +
        `${result.amount} APT ` +
        `${result.txHash ? `TX: ${result.txHash.slice(0, 10)}...` : 'FAILED'}`
      );

      tradeCount++;

      // Wait for next trade interval
      const elapsed = Date.now() - startTime;
      const expectedTime = tradeCount * intervalMs;
      const delay = Math.max(0, expectedTime - elapsed);
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    this.printStats();
  }

  stop(): void {
    this.running = false;
  }

  printStats(): void {
    console.log('\n════════════════════════════════════════════════════════════════');
    console.log('PERFORMANCE STATS');
    console.log('════════════════════════════════════════════════════════════════\n');

    const successful = this.results.filter(r => r.success);
    const failed = this.results.filter(r => !r.success);

    const latencies = successful.map(r => r.latencyMs);
    const avgLatency = latencies.length > 0
      ? latencies.reduce((a, b) => a + b, 0) / latencies.length
      : 0;
    const minLatency = latencies.length > 0 ? Math.min(...latencies) : 0;
    const maxLatency = latencies.length > 0 ? Math.max(...latencies) : 0;

    // Calculate TPS
    const duration = (this.results[this.results.length - 1]?.timestamp || 0) -
                    (this.results[0]?.timestamp || 0);
    const tps = duration > 0 ? (successful.length / (duration / 1000)) : 0;

    // Gas stats
    const gasUsed = successful.map(r => r.gasUsed || 0);
    const avgGas = gasUsed.length > 0
      ? gasUsed.reduce((a, b) => a + b, 0) / gasUsed.length
      : 0;

    console.log(`Total Trades: ${this.results.length}`);
    console.log(`  Successful: ${successful.length}`);
    console.log(`  Failed: ${failed.length}`);
    console.log(`  Success Rate: ${((successful.length / this.results.length) * 100).toFixed(1)}%`);
    console.log('');
    console.log(`Latency (successful trades):`);
    console.log(`  Average: ${avgLatency.toFixed(0)}ms`);
    console.log(`  Min: ${minLatency}ms`);
    console.log(`  Max: ${maxLatency}ms`);
    console.log('');
    console.log(`Throughput: ${tps.toFixed(2)} TPS`);
    console.log(`Average Gas: ${avgGas.toFixed(0)} units`);

    console.log('\n════════════════════════════════════════════════════════════════');
    console.log('COMPARISON: Aptos vs Polygon');
    console.log('════════════════════════════════════════════════════════════════');
    console.log(`Aptos Avg Latency:    ${avgLatency.toFixed(0)}ms`);
    console.log(`Polygon Avg Latency:  2000-5000ms (variable)`);
    console.log('');
    console.log(`Aptos Success Rate:   ${((successful.length / this.results.length) * 100).toFixed(1)}%`);
    console.log(`Polygon Dec 2024:     Multiple outages`);
    console.log('════════════════════════════════════════════════════════════════\n');

    // Output JSON for visualization
    console.log('Trade data (JSON):');
    console.log(JSON.stringify(this.results.slice(0, 10), null, 2));
  }
}

async function getAccount(): Promise<Account> {
  const privateKey = process.env.APTOS_PRIVATE_KEY;
  if (!privateKey) {
    console.error('ERROR: Set APTOS_PRIVATE_KEY environment variable');
    console.error('Example: APTOS_PRIVATE_KEY=0x... npx tsx scripts/hft-bot.ts [market_address]');
    process.exit(1);
  }

  const pk = new Ed25519PrivateKey(privateKey);
  return Account.fromPrivateKey({ privateKey: pk });
}

async function getMarketAddress(): Promise<string> {
  // Use CLI argument if provided
  if (process.argv[2] && process.argv[2].startsWith('0x')) {
    return process.argv[2];
  }

  // Otherwise fetch the first market from the contract
  console.log('No market address provided, fetching from contract...');
  const result = await aptos.view({
    payload: {
      function: `${MODULE}::get_all_markets`,
      functionArguments: [],
    },
  });

  const markets = result[0] as string[];
  if (markets.length === 0) {
    console.error('ERROR: No markets found. Create a market first.');
    process.exit(1);
  }

  console.log(`Found ${markets.length} market(s). Using: ${markets[0]}`);
  return markets[0];
}

// Main
async function main() {
  const account = await getAccount();
  const marketAddress = await getMarketAddress();

  const bot = new HFTBot(account, marketAddress);

  // Handle Ctrl+C gracefully
  process.on('SIGINT', () => {
    console.log('\n\nStopping bot...');
    bot.stop();
  });

  await bot.run();
}

main().catch(console.error);
