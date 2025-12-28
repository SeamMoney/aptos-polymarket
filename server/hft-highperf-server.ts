/**
 * HFT High-Performance Server - Maximizes TPS by parallel submissions
 *
 * Optimizations:
 * 1. Pre-fetch sequence number, build multiple txns with incremented seq nums
 * 2. Sign all transactions locally (no API)
 * 3. Submit all transactions in parallel (concurrent API calls)
 * 4. Don't wait for confirmation
 *
 * Usage: APTOS_PRIVATE_KEY=0x... npx tsx server/hft-highperf-server.ts
 */

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import {
  Aptos,
  AptosConfig,
  Network,
  Account,
  Ed25519PrivateKey,
  InputGenerateTransactionPayloadData,
  SimpleTransaction,
} from '@aptos-labs/ts-sdk';

const CONTRACT_ADDRESS = '0x64a81cb9cbd14d45b87bb32ef73107a44f00069b6a96e70d75369fb7e3da5e68';
const MODULE = `${CONTRACT_ADDRESS}::market`;
const MULTI_MODULE = `${CONTRACT_ADDRESS}::multi_outcome_market`;

// Use API key if available
const API_KEY = process.env.APTOS_API_KEY || '';
const aptos = new Aptos(new AptosConfig({
  network: Network.TESTNET,
  clientConfig: API_KEY ? { API_KEY } : undefined,
}));

// Config
const PORT = 3001;
const BATCH_SIZE = 10;          // Transactions per batch
const BATCH_DELAY_MS = 500;     // Delay between batches
const SEQUENCE_REFRESH_INTERVAL = 100; // Refresh every N trades

// State
interface TradingState {
  isRunning: boolean;
  account: Account | null;
  marketAddress: string | null;
  isMultiOutcome: boolean;
  outcomeCount: number;
  sequenceNumber: bigint;
  totalTrades: number;
  successfulTrades: number;
  failedTrades: number;
  totalLatency: number;
  botBalance: number;
  lastSequenceRefresh: number;
}

const state: TradingState = {
  isRunning: false,
  account: null,
  marketAddress: null,
  isMultiOutcome: false,
  outcomeCount: 2,
  sequenceNumber: 0n,
  totalTrades: 0,
  successfulTrades: 0,
  failedTrades: 0,
  totalLatency: 0,
  botBalance: 0,
  lastSequenceRefresh: 0,
};

const clients = new Set<WebSocket>();

// Bot config
const BOT_NAMES = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Omega', 'Sigma'];
const BINARY_ACTIONS = ['buy_yes', 'buy_no'] as const;
const MULTI_ACTIONS = ['buy_outcome', 'sell_outcome'] as const;
type BinaryAction = typeof BINARY_ACTIONS[number];
type MultiAction = typeof MULTI_ACTIONS[number];
type Action = BinaryAction | MultiAction;

let tradeIdCounter = 0;

// Broadcast to all clients
function broadcast(data: object) {
  const message = JSON.stringify(data);
  clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });
}

// Get random amount (log-normal distribution)
function getRandomAmount(): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const gaussian = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  const logNormal = Math.exp(-2.3 + 1.2 * gaussian);
  return Math.min(2.0, Math.max(0.01, logNormal));
}

// Get random action based on market type
function getRandomAction(): { action: Action; outcomeIndex?: number } {
  if (state.isMultiOutcome) {
    // For multi-outcome markets, mostly buy (80%) to build positions
    const action = Math.random() < 0.8 ? 'buy_outcome' : 'sell_outcome';
    const outcomeIndex = Math.floor(Math.random() * state.outcomeCount);
    return { action, outcomeIndex };
  }
  // Binary market
  return { action: Math.random() < 0.5 ? 'buy_yes' : 'buy_no' };
}

// Fetch sequence number
async function refreshSequenceNumber(): Promise<void> {
  if (!state.account) return;

  try {
    const accountInfo = await aptos.getAccountInfo({
      accountAddress: state.account.accountAddress,
    });
    state.sequenceNumber = BigInt(accountInfo.sequence_number);
    state.lastSequenceRefresh = state.totalTrades;
    console.log(`🔄 Refreshed sequence number: ${state.sequenceNumber}`);
  } catch (e: any) {
    console.error('Failed to refresh sequence:', e.message?.slice(0, 50));
  }
}

function getStats() {
  const elapsedBatches = Math.max(1, Math.floor(state.totalTrades / BATCH_SIZE));
  return {
    totalTrades: state.totalTrades,
    successfulTrades: state.successfulTrades,
    failedTrades: state.failedTrades,
    successRate: state.totalTrades > 0
      ? Math.round((state.successfulTrades / state.totalTrades) * 100)
      : 0,
    avgLatency: state.successfulTrades > 0
      ? Math.round(state.totalLatency / state.successfulTrades)
      : 0,
    targetTps: BATCH_SIZE / (BATCH_DELAY_MS / 1000),
  };
}

// Build a single transaction with specific sequence number
async function buildTransaction(
  account: Account,
  marketAddress: string,
  action: Action,
  amountUnits: bigint,
  sequenceNumber: bigint,
  outcomeIndex?: number
): Promise<SimpleTransaction> {
  let payload: InputGenerateTransactionPayloadData;

  if (state.isMultiOutcome && outcomeIndex !== undefined) {
    // Multi-outcome market transaction
    payload = {
      function: `${MULTI_MODULE}::${action}`,
      functionArguments: [marketAddress, outcomeIndex, amountUnits, 0n],
    };
  } else {
    // Binary market transaction
    payload = {
      function: `${MODULE}::${action}`,
      functionArguments: [marketAddress, amountUnits, 0n],
    };
  }

  // Build with specific sequence number (avoids fetching from chain)
  const transaction = await aptos.transaction.build.simple({
    sender: account.accountAddress,
    data: payload,
    options: {
      accountSequenceNumber: sequenceNumber,
      expireTimestamp: Math.floor(Date.now() / 1000) + 600,
    },
  });

  return transaction;
}

// Execute a batch of transactions in parallel
async function executeBatch(
  account: Account,
  marketAddress: string,
  batchSize: number
): Promise<void> {
  const startTime = Date.now();
  const baseSeq = state.sequenceNumber;

  // Pre-allocate trade info
  const tradeInfos: { id: string; bot: string; action: Action; amount: number; outcomeIndex?: number }[] = [];
  const buildPromises: Promise<{ tx: SimpleTransaction; index: number } | { error: string; index: number }>[] = [];

  // Build all transactions (uses 1 API call each for now, but we can optimize further)
  for (let i = 0; i < batchSize; i++) {
    const { action, outcomeIndex } = getRandomAction();
    const amount = getRandomAmount();
    const amountUnits = BigInt(Math.floor(amount * 100_000_000));
    const seqNum = baseSeq + BigInt(i);

    tradeIdCounter++;
    const id = `trade-${tradeIdCounter}`;
    const bot = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
    tradeInfos.push({ id, bot, action, amount, outcomeIndex });

    const buildPromise = buildTransaction(account, marketAddress, action, amountUnits, seqNum, outcomeIndex)
      .then(tx => ({ tx, index: i }))
      .catch(e => ({ error: e.message?.slice(0, 50) || 'build failed', index: i }));

    buildPromises.push(buildPromise);
  }

  // Build all transactions in parallel
  const builtTxns = await Promise.all(buildPromises);
  const buildTime = Date.now() - startTime;

  // Sign and submit all successful builds
  const submitPromises: Promise<{ success: boolean; hash?: string; error?: string; index: number }>[] = [];

  for (const result of builtTxns) {
    if ('error' in result) {
      submitPromises.push(Promise.resolve({ success: false, error: result.error, index: result.index }));
      continue;
    }

    const { tx, index } = result;

    // Sign locally (no API call)
    const signedTx = aptos.transaction.sign({ signer: account, transaction: tx });

    // Submit (1 API call, but we do all in parallel)
    const submitPromise = aptos.transaction.submit.simple({
      transaction: tx,
      senderAuthenticator: signedTx,
    })
      .then(pending => ({ success: true, hash: pending.hash, index }))
      .catch(e => ({ success: false, error: e.message?.slice(0, 80), index }));

    submitPromises.push(submitPromise);
  }

  // Wait for all submissions
  const submitResults = await Promise.all(submitPromises);
  const totalTime = Date.now() - startTime;

  // Update sequence number
  state.sequenceNumber += BigInt(batchSize);

  // Process results
  let successCount = 0;
  let sequenceError = false;

  for (const result of submitResults) {
    const info = tradeInfos[result.index];
    state.totalTrades++;

    if (result.success) {
      successCount++;
      state.successfulTrades++;
      state.totalLatency += totalTime / batchSize;

      // Build display string for action
      let actionDisplay = info.action.replace('_', ' ').toUpperCase();
      if (info.outcomeIndex !== undefined) {
        actionDisplay = `${info.action === 'buy_outcome' ? 'BUY' : 'SELL'} #${info.outcomeIndex}`;
      }

      broadcast({
        type: 'trade',
        data: {
          id: info.id,
          bot: info.bot,
          action: info.action,
          actionDisplay,
          outcomeIndex: info.outcomeIndex,
          amount: info.amount,
          latency: Math.round(totalTime / batchSize),
          success: true,
          txHash: result.hash,
          timestamp: Date.now(),
          explorerUrl: `https://explorer.aptoslabs.com/txn/${result.hash}?network=testnet`,
          isMultiOutcome: state.isMultiOutcome,
        },
        stats: getStats(),
      });
    } else {
      state.failedTrades++;

      if (result.error?.toLowerCase().includes('sequence')) {
        sequenceError = true;
      }

      // Build display string for action
      let actionDisplay = info.action.replace('_', ' ').toUpperCase();
      if (info.outcomeIndex !== undefined) {
        actionDisplay = `${info.action === 'buy_outcome' ? 'BUY' : 'SELL'} #${info.outcomeIndex}`;
      }

      broadcast({
        type: 'trade',
        data: {
          id: info.id,
          bot: info.bot,
          action: info.action,
          actionDisplay,
          outcomeIndex: info.outcomeIndex,
          amount: info.amount,
          latency: Math.round(totalTime / batchSize),
          success: false,
          error: result.error,
          timestamp: Date.now(),
          isMultiOutcome: state.isMultiOutcome,
        },
        stats: getStats(),
      });
    }
  }

  // Refresh sequence on errors
  if (sequenceError || successCount < batchSize / 2) {
    console.log('⚠️ Many failures, refreshing sequence number...');
    await refreshSequenceNumber();
  }

  const actualTps = (batchSize / (totalTime / 1000)).toFixed(1);
  console.log(`📦 Batch: ${successCount}/${batchSize} | Build: ${buildTime}ms | Total: ${totalTime}ms | ~${actualTps} TPS`);
}

// Main trading loop
async function tradingLoop() {
  console.log('\n🚀 High-Performance Trading Loop Started');
  console.log(`📦 Batch: ${BATCH_SIZE} | Delay: ${BATCH_DELAY_MS}ms | Target: ~${(BATCH_SIZE / (BATCH_DELAY_MS / 1000)).toFixed(1)} TPS`);

  while (state.isRunning && state.account && state.marketAddress) {
    // Periodic sequence refresh
    if (state.totalTrades - state.lastSequenceRefresh >= SEQUENCE_REFRESH_INTERVAL) {
      await refreshSequenceNumber();
    }

    try {
      await executeBatch(state.account, state.marketAddress, BATCH_SIZE);
    } catch (e: any) {
      console.error('Batch error:', e.message?.slice(0, 50));
      await refreshSequenceNumber();
    }

    await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
  }

  console.log('\n⏹ Trading loop stopped');
}

// Get all binary markets
async function getBinaryMarkets(): Promise<string[]> {
  const result = await aptos.view({
    payload: {
      function: `${MODULE}::get_all_markets`,
      functionArguments: [],
    },
  });
  return result[0] as string[];
}

// Get all multi-outcome markets
async function getMultiOutcomeMarkets(): Promise<string[]> {
  const result = await aptos.view({
    payload: {
      function: `${MULTI_MODULE}::get_all_multi_markets`,
      functionArguments: [],
    },
  });
  return result[0] as string[];
}

// Get multi-outcome market info (returns outcome count)
async function getMultiMarketInfo(marketAddr: string): Promise<{ outcomeCount: number }> {
  const result = await aptos.view({
    payload: {
      function: `${MULTI_MODULE}::get_multi_market_info`,
      functionArguments: [marketAddr],
    },
  });
  // Returns: (question, description, category, outcome_count, end_time, resolved, winning_outcome, total_collateral)
  return { outcomeCount: Number(result[3]) };
}

// Get default market (prefers MULTI_MARKET env var, then falls back to first available)
async function getDefaultMarket(): Promise<{ address: string; isMultiOutcome: boolean; outcomeCount: number }> {
  // Check for explicit multi-outcome market override
  const multiMarketAddr = process.env.MULTI_MARKET;
  if (multiMarketAddr) {
    console.log(`🎯 Using specified multi-outcome market: ${multiMarketAddr.slice(0, 20)}...`);
    const info = await getMultiMarketInfo(multiMarketAddr);
    return { address: multiMarketAddr, isMultiOutcome: true, outcomeCount: info.outcomeCount };
  }

  // Check for explicit binary market override
  const binaryMarketAddr = process.env.BINARY_MARKET;
  if (binaryMarketAddr) {
    console.log(`🎯 Using specified binary market: ${binaryMarketAddr.slice(0, 20)}...`);
    return { address: binaryMarketAddr, isMultiOutcome: false, outcomeCount: 2 };
  }

  // Try multi-outcome markets first (to boost their volume!)
  const multiMarkets = await getMultiOutcomeMarkets();
  if (multiMarkets.length > 0) {
    const addr = multiMarkets[0];
    const info = await getMultiMarketInfo(addr);
    console.log(`🎲 Found multi-outcome market with ${info.outcomeCount} outcomes`);
    return { address: addr, isMultiOutcome: true, outcomeCount: info.outcomeCount };
  }

  // Fall back to binary markets
  const binaryMarkets = await getBinaryMarkets();
  if (binaryMarkets.length > 0) {
    return { address: binaryMarkets[0], isMultiOutcome: false, outcomeCount: 2 };
  }

  throw new Error('No markets found');
}

// Fetch bot balance
async function fetchBotBalance(address: string): Promise<number> {
  try {
    const balance = await aptos.getAccountAPTAmount({ accountAddress: address });
    return balance / 100_000_000;
  } catch {
    return state.botBalance;
  }
}

// Express + WebSocket setup
const app = express();
app.use(cors());
app.use(express.json());

const server = createServer(app);
const wss = new WebSocketServer({ server });

// Auto-start
async function autoStart() {
  if (state.isRunning) return;

  const key = process.env.APTOS_PRIVATE_KEY;
  if (!key) {
    console.log('⚠️ No APTOS_PRIVATE_KEY set');
    return;
  }

  try {
    console.log('🤖 Auto-starting high-performance trading...');
    state.account = Account.fromPrivateKey({ privateKey: new Ed25519PrivateKey(key) });

    // Get market with type detection
    const marketInfo = await getDefaultMarket();
    state.marketAddress = marketInfo.address;
    state.isMultiOutcome = marketInfo.isMultiOutcome;
    state.outcomeCount = marketInfo.outcomeCount;

    await refreshSequenceNumber();
    state.botBalance = await fetchBotBalance(state.account.accountAddress.toString());
    state.isRunning = true;
    state.totalTrades = 0;
    state.successfulTrades = 0;
    state.failedTrades = 0;
    state.totalLatency = 0;

    console.log(`💰 Bot Balance: ${state.botBalance.toFixed(2)} APT`);
    console.log(`📊 Market: ${state.marketAddress.slice(0, 20)}...`);
    console.log(`🎯 Type: ${state.isMultiOutcome ? `Multi-Outcome (${state.outcomeCount} outcomes)` : 'Binary (YES/NO)'}`);
    console.log(`🔢 Starting sequence: ${state.sequenceNumber}`);

    tradingLoop();
    broadcast({ type: 'started', stats: getStats(), isMultiOutcome: state.isMultiOutcome, outcomeCount: state.outcomeCount });
  } catch (e: any) {
    console.error('Auto-start failed:', e.message);
  }
}

wss.on('connection', (ws) => {
  console.log('📱 Client connected');
  clients.add(ws);

  if (clients.size === 1 && !state.isRunning) {
    autoStart();
  }

  ws.send(JSON.stringify({
    type: 'state',
    data: { isRunning: state.isRunning, stats: getStats() },
  }));

  ws.on('close', () => {
    console.log('📱 Client disconnected');
    clients.delete(ws);
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', isRunning: state.isRunning, clients: clients.size });
});

app.post('/stop', (req, res) => {
  state.isRunning = false;
  broadcast({ type: 'stopped' });
  res.json({ success: true });
});

app.get('/stats', (req, res) => {
  res.json(getStats());
});

// Start server
server.listen(PORT, () => {
  console.log('════════════════════════════════════════════════════════════════');
  console.log('HFT HIGH-PERFORMANCE SERVER (Binary + Multi-Outcome)');
  console.log('════════════════════════════════════════════════════════════════');
  console.log(`\n🌐 HTTP:      http://localhost:${PORT}`);
  console.log(`🔌 WebSocket: ws://localhost:${PORT}`);
  console.log('\nOptimizations:');
  console.log('  ✓ Parallel transaction building');
  console.log('  ✓ Parallel transaction submission');
  console.log('  ✓ Manual sequence number management');
  console.log('  ✓ Batch processing');
  console.log('  ✓ Multi-outcome market support');
  console.log('\nMarket Selection:');
  console.log('  MULTI_MARKET=0x...  Force multi-outcome market');
  console.log('  BINARY_MARKET=0x... Force binary market');
  console.log('  (default: auto-detect, prefers multi-outcome)');
  console.log(`\n📦 Batch: ${BATCH_SIZE} txns | 🕐 Delay: ${BATCH_DELAY_MS}ms`);
  console.log(`📈 Target: ~${(BATCH_SIZE / (BATCH_DELAY_MS / 1000)).toFixed(1)} TPS`);
  console.log('\n════════════════════════════════════════════════════════════════\n');
});
