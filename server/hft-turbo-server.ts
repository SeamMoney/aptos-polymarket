/**
 * HFT TURBO SERVER - Maximum Speed Demo
 *
 * Features:
 * - Parallel transaction batches (5-10 txns at once)
 * - Minimal delays (50ms between batches)
 * - Real-time TPS counter
 * - Visual burst mode
 *
 * Usage: APTOS_PRIVATE_KEY=0x... npx tsx server/hft-turbo-server.ts
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
} from '@aptos-labs/ts-sdk';

const CONTRACT_ADDRESS = '0x3f13249e31a1fbdb886741f7945cccc40307311abc08ba188894bd1a050e19b4';
const MODULE = `${CONTRACT_ADDRESS}::market`;

// Use API key to bypass rate limits
const API_KEY = process.env.APTOS_API_KEY || '';
const aptos = new Aptos(new AptosConfig({
  network: Network.TESTNET,
  clientConfig: API_KEY ? { API_KEY } : undefined,
}));

// Sequence number tracking for parallel transactions
let currentSeqNum: bigint = BigInt(0);

// TURBO CONFIG - MAXIMUM SPEED
const PORT = 3002;
const BATCH_SIZE = 5;        // Send 5 txns in parallel
const BATCH_DELAY_MS = 100;  // 100ms between batches = potential 50 TPS
const TPS_WINDOW_MS = 5000;  // Calculate TPS over 5 second window

const BOT_NAMES = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Omega', 'Sigma', 'Theta', 'Kappa'];

interface TradeResult {
  id: string;
  bot: string;
  action: string;
  amount: number;
  latency: number;
  success: boolean;
  txHash?: string;
  timestamp: number;
}

interface TurboState {
  isRunning: boolean;
  account: Account | null;
  marketAddress: string | null;
  question: string;

  // Real-time metrics
  totalTxns: number;
  successfulTxns: number;
  failedTxns: number;
  recentTxns: { timestamp: number; success: boolean }[];
  currentTPS: number;
  peakTPS: number;
  avgLatency: number;
  totalLatency: number;

  // Mode
  mode: 'normal' | 'turbo' | 'burst';
  batchSize: number;
  batchDelay: number;
}

const state: TurboState = {
  isRunning: false,
  account: null,
  marketAddress: null,
  question: '',
  totalTxns: 0,
  successfulTxns: 0,
  failedTxns: 0,
  recentTxns: [],
  currentTPS: 0,
  peakTPS: 0,
  avgLatency: 0,
  totalLatency: 0,
  mode: 'turbo',
  batchSize: BATCH_SIZE,
  batchDelay: BATCH_DELAY_MS,
};

const clients = new Set<WebSocket>();

function broadcast(data: object) {
  const msg = JSON.stringify(data);
  clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  });
}

// Calculate real-time TPS
function calculateTPS() {
  const now = Date.now();
  const windowStart = now - TPS_WINDOW_MS;

  // Filter to recent successful txns
  state.recentTxns = state.recentTxns.filter(t => t.timestamp > windowStart);
  const successCount = state.recentTxns.filter(t => t.success).length;

  state.currentTPS = (successCount / TPS_WINDOW_MS) * 1000;
  if (state.currentTPS > state.peakTPS) {
    state.peakTPS = state.currentTPS;
  }
}

// Execute single transaction with explicit sequence number
async function executeTrade(
  account: Account,
  marketAddress: string,
  botName: string,
  tradeId: number,
  seqNum: bigint
): Promise<TradeResult> {
  const startTime = Date.now();
  const action = Math.random() > 0.5 ? 'buy_yes' : 'buy_no';
  const amount = 0.01 + Math.random() * 0.05; // Small amounts for speed
  const amountUnits = Math.floor(amount * 100_000_000);

  try {
    const tx = await aptos.transaction.build.simple({
      sender: account.accountAddress,
      data: {
        function: `${MODULE}::${action}`,
        functionArguments: [marketAddress, amountUnits, 0],
      },
      options: {
        accountSequenceNumber: seqNum,
      },
    });

    const pending = await aptos.signAndSubmitTransaction({
      signer: account,
      transaction: tx,
    });

    const latency = Date.now() - startTime;

    return {
      id: `turbo-${tradeId}`,
      bot: botName,
      action: action.replace('_', ' ').toUpperCase(),
      amount,
      latency,
      success: true,
      txHash: pending.hash,
      timestamp: Date.now(),
    };
  } catch (error: any) {
    return {
      id: `turbo-${tradeId}`,
      bot: botName,
      action: action.replace('_', ' ').toUpperCase(),
      amount,
      latency: Date.now() - startTime,
      success: false,
      timestamp: Date.now(),
    };
  }
}

// TURBO trading loop - parallel batches with explicit sequence numbers
async function turboLoop() {
  console.log('\n🔥🔥🔥 TURBO MODE ACTIVATED 🔥🔥🔥');
  console.log(`Batch size: ${state.batchSize} | Delay: ${state.batchDelay}ms`);

  // Fetch current sequence number
  try {
    const accountInfo = await aptos.getAccountInfo({ accountAddress: state.account!.accountAddress });
    currentSeqNum = BigInt(accountInfo.sequence_number);
    console.log(`📊 Starting sequence number: ${currentSeqNum}`);
  } catch (e) {
    console.error('Failed to get sequence number:', e);
    return;
  }

  let tradeCounter = 0;

  while (state.isRunning && state.account && state.marketAddress) {
    const batchStart = Date.now();

    // Create batch of parallel trades with explicit sequence numbers
    const batchPromises = Array.from({ length: state.batchSize }, (_, i) => {
      const botName = BOT_NAMES[(tradeCounter + i) % BOT_NAMES.length];
      const seqNum = currentSeqNum + BigInt(i);
      return executeTrade(state.account!, state.marketAddress!, botName, tradeCounter + i, seqNum);
    });

    // Increment sequence number for next batch
    currentSeqNum += BigInt(state.batchSize);

    // Execute all in parallel
    const results = await Promise.all(batchPromises);
    tradeCounter += state.batchSize;

    // Process results
    let batchLatency = 0;
    for (const result of results) {
      state.totalTxns++;
      state.recentTxns.push({ timestamp: result.timestamp, success: result.success });

      if (result.success) {
        state.successfulTxns++;
        state.totalLatency += result.latency;
        batchLatency += result.latency;
      } else {
        state.failedTxns++;
      }
    }

    // Calculate metrics
    calculateTPS();
    state.avgLatency = state.successfulTxns > 0
      ? Math.round(state.totalLatency / state.successfulTxns)
      : 0;

    const batchSuccesses = results.filter(r => r.success).length;
    const batchTime = Date.now() - batchStart;

    // Broadcast batch results
    broadcast({
      type: 'batch',
      trades: results,
      stats: {
        totalTxns: state.totalTxns,
        successfulTxns: state.successfulTxns,
        failedTxns: state.failedTxns,
        successRate: Math.round((state.successfulTxns / state.totalTxns) * 100),
        currentTPS: state.currentTPS.toFixed(1),
        peakTPS: state.peakTPS.toFixed(1),
        avgLatency: state.avgLatency,
        batchSize: state.batchSize,
        mode: state.mode,
      },
    });

    // Console output
    const tpsDisplay = state.currentTPS.toFixed(1).padStart(5);
    const peakDisplay = state.peakTPS.toFixed(1);
    console.log(
      `⚡ Batch ${Math.floor(tradeCounter / state.batchSize)} | ` +
      `${batchSuccesses}/${state.batchSize} OK | ` +
      `${batchTime}ms | ` +
      `TPS: ${tpsDisplay} (peak: ${peakDisplay})`
    );

    // Minimal delay between batches
    await new Promise(r => setTimeout(r, state.batchDelay));
  }

  console.log('\n⏹ Turbo mode stopped');
  console.log(`Final: ${state.successfulTxns}/${state.totalTxns} txns | Peak TPS: ${state.peakTPS.toFixed(1)}`);
}

// Get market
async function getMarket(): Promise<{ address: string; question: string }> {
  const result = await aptos.view({
    payload: { function: `${MODULE}::get_all_markets`, functionArguments: [] },
  });
  const markets = result[0] as string[];
  if (!markets.length) throw new Error('No markets');

  const info = await aptos.view({
    payload: { function: `${MODULE}::get_market_info`, functionArguments: [markets[0]] },
  });

  return { address: markets[0], question: info[0] as string };
}

// Express + WebSocket
const app = express();
app.use(cors());
app.use(express.json());

const server = createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('📱 Client connected');
  clients.add(ws);

  ws.send(JSON.stringify({
    type: 'state',
    data: {
      isRunning: state.isRunning,
      mode: state.mode,
      stats: {
        totalTxns: state.totalTxns,
        successfulTxns: state.successfulTxns,
        currentTPS: state.currentTPS.toFixed(1),
        peakTPS: state.peakTPS.toFixed(1),
        avgLatency: state.avgLatency,
      },
    },
  }));

  ws.on('message', async (msg) => {
    try {
      const data = JSON.parse(msg.toString());

      if (data.type === 'setMode') {
        state.mode = data.mode;
        if (data.mode === 'turbo') {
          state.batchSize = 5;
          state.batchDelay = 100;
        } else if (data.mode === 'burst') {
          state.batchSize = 10;
          state.batchDelay = 50;
        } else {
          state.batchSize = 1;
          state.batchDelay = 500;
        }
        broadcast({ type: 'modeChanged', mode: state.mode, batchSize: state.batchSize });
      }
    } catch (e) {}
  });

  ws.on('close', () => {
    clients.delete(ws);
  });
});

app.post('/start', async (req, res) => {
  if (state.isRunning) return res.status(400).json({ error: 'Already running' });

  const key = process.env.APTOS_PRIVATE_KEY;
  if (!key) return res.status(400).json({ error: 'No APTOS_PRIVATE_KEY' });

  try {
    state.account = Account.fromPrivateKey({ privateKey: new Ed25519PrivateKey(key) });
    const market = await getMarket();
    state.marketAddress = market.address;
    state.question = market.question;

    // Reset stats
    state.totalTxns = 0;
    state.successfulTxns = 0;
    state.failedTxns = 0;
    state.recentTxns = [];
    state.currentTPS = 0;
    state.peakTPS = 0;
    state.avgLatency = 0;
    state.totalLatency = 0;

    state.isRunning = true;
    turboLoop();

    broadcast({ type: 'started', market: state.question });
    res.json({ success: true, market: state.question });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/stop', (req, res) => {
  state.isRunning = false;
  broadcast({
    type: 'stopped',
    finalStats: {
      totalTxns: state.totalTxns,
      successfulTxns: state.successfulTxns,
      peakTPS: state.peakTPS.toFixed(1),
    }
  });
  res.json({ success: true });
});

app.post('/mode/:mode', (req, res) => {
  const mode = req.params.mode as 'normal' | 'turbo' | 'burst';
  state.mode = mode;

  if (mode === 'turbo') {
    state.batchSize = 5;
    state.batchDelay = 100;
  } else if (mode === 'burst') {
    state.batchSize = 10;
    state.batchDelay = 50;
  } else {
    state.batchSize = 1;
    state.batchDelay = 500;
  }

  broadcast({ type: 'modeChanged', mode, batchSize: state.batchSize });
  res.json({ mode, batchSize: state.batchSize });
});

app.get('/stats', (req, res) => {
  res.json({
    isRunning: state.isRunning,
    mode: state.mode,
    totalTxns: state.totalTxns,
    successfulTxns: state.successfulTxns,
    successRate: state.totalTxns > 0 ? Math.round((state.successfulTxns / state.totalTxns) * 100) : 0,
    currentTPS: state.currentTPS.toFixed(1),
    peakTPS: state.peakTPS.toFixed(1),
    avgLatency: state.avgLatency,
  });
});

server.listen(PORT, () => {
  console.log('');
  console.log('🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥');
  console.log('   HFT TURBO SERVER - MAXIMUM SPEED DEMO');
  console.log('🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥');
  console.log(`\n🌐 HTTP:      http://localhost:${PORT}`);
  console.log(`🔌 WebSocket: ws://localhost:${PORT}`);
  console.log('\nModes:');
  console.log('  POST /mode/normal - 1 txn/500ms (~2 TPS)');
  console.log('  POST /mode/turbo  - 5 txns/100ms (~10+ TPS) [DEFAULT]');
  console.log('  POST /mode/burst  - 10 txns/50ms (~20+ TPS)');
  console.log('\nEndpoints:');
  console.log('  POST /start  - Start turbo trading');
  console.log('  POST /stop   - Stop');
  console.log('  GET  /stats  - Current stats');
  console.log('');
});
