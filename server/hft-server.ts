/**
 * HFT Server v2 - Real on-chain transactions with reliability improvements
 *
 * Features:
 * - WebSocket heartbeat for connection health
 * - Log-normal distribution for truly random amounts
 * - Adaptive throttling for faster trading
 * - Market info display
 * - Position and PNL tracking
 *
 * Usage: APTOS_PRIVATE_KEY=0x... npx tsx server/hft-server.ts
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

const CONTRACT_ADDRESS = '0x64a81cb9cbd14d45b87bb32ef73107a44f00069b6a96e70d75369fb7e3da5e68';
const MODULE = `${CONTRACT_ADDRESS}::market`;

// Use API key to bypass rate limits
const API_KEY = process.env.APTOS_API_KEY || '';
const aptos = new Aptos(new AptosConfig({
  network: Network.TESTNET,
  clientConfig: API_KEY ? { API_KEY } : undefined,
}));

// Config
const PORT = 3001;
// Sustain ~0.5 TPS to stay well under 40k compute units / 5 min rate limit
// Each trade uses ~3-5 API calls (build tx, sign, submit, check balance, etc.)
const BASE_DELAY_MS = 1500;   // ~0.6 TPS base rate (safer for no API key)
const MAX_DELAY_MS = 3000;    // Slow down more when hitting limits
const HEARTBEAT_INTERVAL = 15000; // 15 second heartbeat

// Unique ID counter
let tradeIdCounter = 0;

// Bot configuration
const BOT_NAMES = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Omega', 'Sigma'];
const ACTIONS = ['buy_yes', 'buy_no', 'sell_yes', 'sell_no'] as const;
type Action = typeof ACTIONS[number];

interface TradeResult {
  id: string;
  bot: string;
  action: Action;
  actionDisplay: string;
  amount: number;
  latency: number;
  success: boolean;
  txHash?: string;
  error?: string;
  timestamp: number;
  explorerUrl?: string;
}

interface MarketInfo {
  address: string;
  question: string;
  yesPrice: number;
  noPrice: number;
}

interface Position {
  yesTokens: number;
  noTokens: number;
  totalInvested: number;
  realizedPnl: number;
}

interface ClientData {
  isAlive: boolean;
}

interface TradingState {
  isRunning: boolean;
  account: Account | null;
  marketAddress: string | null;
  marketInfo: MarketInfo | null;
  position: Position;
  totalTrades: number;
  successfulTrades: number;
  failedTrades: number;
  totalLatency: number;
  currentDelay: number;
  consecutiveFailures: number;
  consecutiveRateLimits: number;
  // Visibility
  botBalance: number;
  marketReserves: { yesReserve: number; noReserve: number; tvl: number };
}

const state: TradingState = {
  isRunning: false,
  account: null,
  marketAddress: null,
  marketInfo: null,
  position: { yesTokens: 0, noTokens: 0, totalInvested: 0, realizedPnl: 0 },
  totalTrades: 0,
  successfulTrades: 0,
  failedTrades: 0,
  totalLatency: 0,
  currentDelay: BASE_DELAY_MS,
  consecutiveFailures: 0,
  consecutiveRateLimits: 0,
  botBalance: 0,
  marketReserves: { yesReserve: 0, noReserve: 0, tvl: 0 },
};

// Connected WebSocket clients with health tracking
const clients = new Map<WebSocket, ClientData>();

// Box-Muller transform for Gaussian random numbers
function gaussianRandom(): number {
  const u1 = Math.random();
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// Log-normal distribution for truly random, varied amounts
function getRandomAmount(): number {
  const mu = -2.3;   // Center around ~0.10 APT
  const sigma = 1.5; // High variance for variety
  const logNormal = Math.exp(mu + sigma * gaussianRandom());

  // Clamp to 0.005 - 3.0 APT
  const amount = Math.min(3.0, Math.max(0.005, logNormal));

  // Random precision (2-4 decimal places)
  const precision = 2 + Math.floor(Math.random() * 3);
  return parseFloat(amount.toFixed(precision));
}

// Get random action with realistic distribution
function getRandomAction(): Action {
  const rand = Math.random();
  if (rand < 0.30) return 'buy_yes';
  if (rand < 0.55) return 'buy_no';
  if (rand < 0.77) return 'sell_yes';
  return 'sell_no';
}

// Format action for display
function formatAction(action: Action): string {
  return action.replace('_', ' ').toUpperCase();
}

// Safe broadcast to all connected clients
function broadcast(data: object) {
  const message = JSON.stringify(data);
  const deadClients: WebSocket[] = [];

  clients.forEach((clientData, ws) => {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      } else {
        deadClients.push(ws);
      }
    } catch (e) {
      console.error('Broadcast error:', e);
      deadClients.push(ws);
    }
  });

  // Clean up dead clients
  deadClients.forEach(ws => {
    clients.delete(ws);
    console.log('🔌 Removed dead client');
  });
}

// Update position based on trade
function updatePosition(action: Action, amount: number, success: boolean) {
  if (!success) return;

  const currentPrice = state.marketInfo?.yesPrice || 50;

  if (action === 'buy_yes') {
    // Estimate tokens received based on price
    const tokensReceived = amount / (currentPrice / 100);
    state.position.yesTokens += tokensReceived;
    state.position.totalInvested += amount;
  } else if (action === 'buy_no') {
    const tokensReceived = amount / ((100 - currentPrice) / 100);
    state.position.noTokens += tokensReceived;
    state.position.totalInvested += amount;
  } else if (action === 'sell_yes' && state.position.yesTokens > 0) {
    // Calculate PNL from sale
    const totalTokens = state.position.yesTokens + state.position.noTokens;
    const avgCost = totalTokens > 0 ? state.position.totalInvested / totalTokens : 0;
    const tokensToSell = Math.min(state.position.yesTokens, amount / (currentPrice / 100));
    const costBasis = tokensToSell * avgCost;
    const saleValue = tokensToSell * (currentPrice / 100);
    state.position.realizedPnl += (saleValue - costBasis);
    state.position.yesTokens -= tokensToSell;
  } else if (action === 'sell_no' && state.position.noTokens > 0) {
    const noPrice = 100 - currentPrice;
    const totalTokens = state.position.yesTokens + state.position.noTokens;
    const avgCost = totalTokens > 0 ? state.position.totalInvested / totalTokens : 0;
    const tokensToSell = Math.min(state.position.noTokens, amount / (noPrice / 100));
    const costBasis = tokensToSell * avgCost;
    const saleValue = tokensToSell * (noPrice / 100);
    state.position.realizedPnl += (saleValue - costBasis);
    state.position.noTokens -= tokensToSell;
  }
}

// Update market prices based on trade action
function updateMarketPrices(action: Action) {
  if (!state.marketInfo) return;

  let delta = (Math.random() * 2 + 0.5); // 0.5-2.5 price movement

  if (action === 'buy_yes') {
    state.marketInfo.yesPrice = Math.min(95, state.marketInfo.yesPrice + delta);
  } else if (action === 'buy_no') {
    state.marketInfo.yesPrice = Math.max(5, state.marketInfo.yesPrice - delta);
  } else if (action === 'sell_yes') {
    state.marketInfo.yesPrice = Math.max(5, state.marketInfo.yesPrice - delta * 0.7);
  } else if (action === 'sell_no') {
    state.marketInfo.yesPrice = Math.min(95, state.marketInfo.yesPrice + delta * 0.7);
  }

  state.marketInfo.yesPrice = Math.round(state.marketInfo.yesPrice * 10) / 10;
  state.marketInfo.noPrice = Math.round((100 - state.marketInfo.yesPrice) * 10) / 10;
}

// Execute a single trade
async function executeTrade(
  account: Account,
  marketAddress: string,
  action: Action,
  amountAPT: number,
  botName: string
): Promise<TradeResult> {
  const startTime = Date.now();
  const amountUnits = Math.floor(amountAPT * 100_000_000);
  tradeIdCounter++;
  const id = `trade-${tradeIdCounter}-${Date.now()}`;

  try {
    // Map sells to opposite buys for contract (contract only has buy_yes/buy_no)
    let contractAction = action;
    if (action === 'sell_yes') contractAction = 'buy_no';
    if (action === 'sell_no') contractAction = 'buy_yes';

    const transaction = await aptos.transaction.build.simple({
      sender: account.accountAddress,
      data: {
        function: `${MODULE}::${contractAction}`,
        functionArguments: [marketAddress, amountUnits, 0],
      },
    });

    const pendingTx = await aptos.signAndSubmitTransaction({
      signer: account,
      transaction,
    });

    const latency = Date.now() - startTime;

    return {
      id,
      bot: botName,
      action,
      actionDisplay: formatAction(action),
      amount: amountAPT,
      latency,
      success: true,
      txHash: pendingTx.hash,
      timestamp: Date.now(),
      explorerUrl: `https://explorer.aptoslabs.com/txn/${pendingTx.hash}?network=testnet`,
    };
  } catch (error: any) {
    const latency = Date.now() - startTime;
    const errorMsg = error.message || 'Unknown error';

    // Detect different error types
    const isRateLimited = errorMsg.includes('429') ||
      errorMsg.includes('Too Many Requests') ||
      errorMsg.includes('rate limit');

    const isInsufficientFunds = errorMsg.includes('INSUFFICIENT') ||
      errorMsg.includes('insufficient') ||
      errorMsg.includes('balance') ||
      errorMsg.includes('not enough') ||
      errorMsg.includes('EINSUFFICIENT');

    let errorType = errorMsg.slice(0, 100);
    if (isRateLimited) errorType = 'RATE_LIMITED';
    if (isInsufficientFunds) errorType = 'INSUFFICIENT_FUNDS';

    return {
      id,
      bot: botName,
      action,
      actionDisplay: formatAction(action),
      amount: amountAPT,
      latency,
      success: false,
      error: errorType,
      timestamp: Date.now(),
    };
  }
}

// Minimum balance to keep trading (covers gas + small trades)
const MIN_BALANCE_APT = 0.5;

// Main trading loop with adaptive throttling
async function tradingLoop() {
  console.log('\n🚀 Trading loop started');
  console.log(`📊 Market: ${state.marketInfo?.question || 'Unknown'}`);
  console.log(`📍 Address: ${state.marketAddress?.slice(0, 20)}...`);

  let consecutiveInsufficientFunds = 0;

  while (state.isRunning && state.account && state.marketAddress) {
    // Check balance every 20 trades or after failures
    if (state.totalTrades % 20 === 0 || consecutiveInsufficientFunds > 0) {
      const newBalance = await fetchBotBalance(state.account.accountAddress.toString());

      // Only update if we got a valid balance (not rate limited)
      if (newBalance >= 0) {
        state.botBalance = newBalance;

        if (state.botBalance < MIN_BALANCE_APT) {
          console.log(`\n⚠️ LOW BALANCE: ${state.botBalance.toFixed(4)} APT - pausing trading`);
          broadcast({
            type: 'low_balance',
            message: `Bot balance too low: ${state.botBalance.toFixed(4)} APT. Add funds to continue.`,
            botBalance: state.botBalance,
          });
          state.isRunning = false;
          break;
        }
      }
    }

    const botName = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
    const action = getRandomAction();
    // Limit trade size based on available balance
    let amount = getRandomAmount();
    if (state.botBalance > 0 && state.botBalance < 5) {
      // When low on funds, cap trade size
      amount = Math.min(amount, state.botBalance * 0.1);
    }

    const result = await executeTrade(
      state.account,
      state.marketAddress,
      action,
      amount,
      botName
    );

    state.totalTrades++;

    // Adaptive throttling - recover slowly, penalize failures harder
    if (result.success) {
      state.successfulTrades++;
      state.totalLatency += result.latency;
      state.consecutiveFailures = 0;
      state.consecutiveRateLimits = 0;
      // Quick recovery on success - speed up by 50ms
      state.currentDelay = Math.max(BASE_DELAY_MS, state.currentDelay - 50);

      // Update position and prices
      updatePosition(action, amount, true);
      updateMarketPrices(action);
    } else {
      state.failedTrades++;
      state.consecutiveFailures++;

      // Handle different failure types
      if (result.error === 'RATE_LIMITED') {
        state.consecutiveRateLimits++;
        consecutiveInsufficientFunds = 0;
        state.currentDelay = MAX_DELAY_MS;
        console.log(`⚠️ Rate limited (${state.consecutiveRateLimits}x) - slowing to ${MAX_DELAY_MS}ms`);
      } else if (result.error === 'INSUFFICIENT_FUNDS') {
        consecutiveInsufficientFunds++;
        state.consecutiveRateLimits = 0;
        console.log(`💸 Insufficient funds (${consecutiveInsufficientFunds}x)`);

        // After 3 consecutive insufficient funds errors, force balance check
        if (consecutiveInsufficientFunds >= 3) {
          state.botBalance = await fetchBotBalance(state.account!.accountAddress.toString());
          if (state.botBalance < MIN_BALANCE_APT) {
            console.log(`\n⚠️ LOW BALANCE CONFIRMED: ${state.botBalance.toFixed(4)} APT - stopping`);
            broadcast({
              type: 'low_balance',
              message: `Bot balance too low: ${state.botBalance.toFixed(4)} APT. Add funds to continue.`,
              botBalance: state.botBalance,
            });
            state.isRunning = false;
            break;
          }
        }
      } else {
        state.consecutiveRateLimits = 0;
        consecutiveInsufficientFunds = 0;
        state.currentDelay = Math.min(MAX_DELAY_MS, state.currentDelay + 100);
      }
    }

    // Update visibility stats every 10 trades
    if (state.totalTrades % 10 === 0 && state.account && state.marketAddress) {
      state.botBalance = await fetchBotBalance(state.account.accountAddress.toString());
      state.marketReserves = await fetchMarketReserves(state.marketAddress);
    }

    // Broadcast result to all clients
    broadcast({
      type: 'trade',
      data: result,
      stats: {
        totalTrades: state.totalTrades,
        successfulTrades: state.successfulTrades,
        failedTrades: state.failedTrades,
        successRate: state.totalTrades > 0
          ? Math.round((state.successfulTrades / state.totalTrades) * 100)
          : 0,
        avgLatency: state.successfulTrades > 0
          ? Math.round(state.totalLatency / state.successfulTrades)
          : 0,
        currentDelay: state.currentDelay,
      },
      market: state.marketInfo,
      position: state.position,
      botBalance: state.botBalance,
      marketReserves: state.marketReserves,
    });

    // Log to console
    if (result.success) {
      console.log(`✓ ${result.bot.padEnd(7)} | ${result.actionDisplay.padEnd(8)} | ${result.amount.toFixed(4).padStart(8)} APT | ${result.latency}ms | ${result.txHash?.slice(0, 14)}...`);
    } else {
      console.log(`✗ ${result.bot.padEnd(7)} | ${result.actionDisplay.padEnd(8)} | FAILED (delay: ${state.currentDelay}ms)`);
    }

    // Wait with adaptive delay
    await new Promise(resolve => setTimeout(resolve, state.currentDelay));
  }

  console.log('\n⏹ Trading loop stopped');
}

// Fetch market info
async function fetchMarketInfo(marketAddress: string): Promise<MarketInfo> {
  try {
    const result = await aptos.view({
      payload: {
        function: `${MODULE}::get_market_info`,
        functionArguments: [marketAddress],
      },
    });

    const [question, , , , , yesReserve, noReserve] = result as [string, string, number, boolean, boolean | null, string, string];

    // Calculate initial prices
    const yesRes = parseInt(yesReserve);
    const noRes = parseInt(noReserve);
    const total = yesRes + noRes;
    const yesPrice = total > 0 ? Math.round((noRes / total) * 100) : 50;

    return {
      address: marketAddress,
      question: question || 'Prediction Market',
      yesPrice,
      noPrice: 100 - yesPrice,
    };
  } catch (e) {
    console.log('Could not fetch market info, using defaults');
    return {
      address: marketAddress,
      question: 'Will this prediction come true?',
      yesPrice: 50,
      noPrice: 50,
    };
  }
}

// Initialize account from private key
async function initAccount(privateKey: string): Promise<Account> {
  return Account.fromPrivateKey({ privateKey: new Ed25519PrivateKey(privateKey) });
}

// Fetch bot's APT balance
async function fetchBotBalance(address: string): Promise<number> {
  try {
    const balance = await aptos.getAccountAPTAmount({ accountAddress: address });
    return balance / 100_000_000;
  } catch (e: any) {
    // If rate limited, return -1 to indicate unknown (don't report as 0)
    if (e.message?.includes('429') || e.message?.includes('rate limit')) {
      console.log('⚠️ Rate limited when checking balance');
      return state.botBalance > 0 ? state.botBalance : -1; // Keep last known balance
    }
    return 0;
  }
}

// Fetch market reserves (TVL)
async function fetchMarketReserves(marketAddress: string): Promise<{ yesReserve: number; noReserve: number; tvl: number }> {
  try {
    const result = await aptos.view({
      payload: {
        function: `${MODULE}::get_market_info`,
        functionArguments: [marketAddress],
      },
    });
    const yesReserve = Number(result[5]) / 100_000_000;
    const noReserve = Number(result[6]) / 100_000_000;
    return { yesReserve, noReserve, tvl: yesReserve + noReserve };
  } catch {
    return { yesReserve: 0, noReserve: 0, tvl: 0 };
  }
}

// Get default market address
async function getDefaultMarket(): Promise<string> {
  const result = await aptos.view({
    payload: {
      function: `${MODULE}::get_all_markets`,
      functionArguments: [],
    },
  });
  const markets = result[0] as string[];
  if (!markets.length) throw new Error('No markets found');
  return markets[0];
}

// Express + WebSocket server setup
const app = express();
app.use(cors());
app.use(express.json());

const server = createServer(app);
const wss = new WebSocketServer({ server });

// Heartbeat to detect dead connections
const heartbeat = setInterval(() => {
  clients.forEach((clientData, ws) => {
    if (!clientData.isAlive) {
      console.log('🔌 Terminating unresponsive client');
      ws.terminate();
      clients.delete(ws);
      return;
    }
    clientData.isAlive = false;
    ws.ping();
  });
}, HEARTBEAT_INTERVAL);

wss.on('close', () => {
  clearInterval(heartbeat);
});

// Auto-start trading (called when first client connects)
async function autoStartTrading() {
  if (state.isRunning) return;

  const key = process.env.APTOS_PRIVATE_KEY;
  if (!key) {
    console.log('⚠️ No APTOS_PRIVATE_KEY set, cannot auto-start');
    return;
  }

  try {
    console.log('🤖 Auto-starting trading...');
    state.account = await initAccount(key);
    state.marketAddress = await getDefaultMarket();
    state.marketInfo = await fetchMarketInfo(state.marketAddress);
    state.isRunning = true;
    state.totalTrades = 0;
    state.successfulTrades = 0;
    state.failedTrades = 0;
    state.totalLatency = 0;
    state.currentDelay = BASE_DELAY_MS;
    state.consecutiveFailures = 0;
    state.consecutiveRateLimits = 0;
    state.position = { yesTokens: 0, noTokens: 0, totalInvested: 0, realizedPnl: 0 };
    state.botBalance = await fetchBotBalance(state.account.accountAddress.toString());
    state.marketReserves = await fetchMarketReserves(state.marketAddress);

    console.log(`💰 Bot Balance: ${state.botBalance.toFixed(2)} APT`);
    console.log(`📊 Market TVL: ${state.marketReserves.tvl.toFixed(4)} APT`);

    tradingLoop();
    broadcast({ type: 'started', market: state.marketInfo, botBalance: state.botBalance, marketReserves: state.marketReserves });
  } catch (e: any) {
    console.error('Auto-start failed:', e.message);
  }
}

// WebSocket connection handler
wss.on('connection', (ws) => {
  console.log('📱 Client connected');

  const clientData: ClientData = { isAlive: true };
  clients.set(ws, clientData);

  // Auto-start on first client connection
  if (clients.size === 1 && !state.isRunning) {
    autoStartTrading();
  }

  // Handle pong response
  ws.on('pong', () => {
    clientData.isAlive = true;
  });

  // Send current state
  ws.send(JSON.stringify({
    type: 'state',
    data: {
      isRunning: state.isRunning,
      stats: {
        totalTrades: state.totalTrades,
        successfulTrades: state.successfulTrades,
        failedTrades: state.failedTrades,
        successRate: state.totalTrades > 0
          ? Math.round((state.successfulTrades / state.totalTrades) * 100)
          : 0,
        avgLatency: state.successfulTrades > 0
          ? Math.round(state.totalLatency / state.successfulTrades)
          : 0,
        currentDelay: state.currentDelay,
      },
      market: state.marketInfo,
      position: state.position,
      botBalance: state.botBalance,
      marketReserves: state.marketReserves,
    },
  }));

  ws.on('close', () => {
    console.log('📱 Client disconnected');
    clients.delete(ws);
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err.message);
    clients.delete(ws);
  });
});

// REST endpoints
app.get('/health', (req, res) => {
  res.json({ status: 'ok', isRunning: state.isRunning, clients: clients.size });
});

app.post('/start', async (req, res) => {
  try {
    if (state.isRunning) {
      return res.status(400).json({ error: 'Already running' });
    }

    const { privateKey, marketAddress } = req.body;

    // Use env var if not provided
    const key = privateKey || process.env.APTOS_PRIVATE_KEY;
    if (!key) {
      return res.status(400).json({ error: 'No private key provided' });
    }

    // Check if we're rate limited before starting
    try {
      await aptos.getLedgerInfo();
    } catch (e: any) {
      if (e.message?.includes('429') || e.message?.includes('Too Many Requests') || e.message?.includes('rate limit')) {
        console.log('⚠️ Rate limited! Waiting 60 seconds before starting...');
        broadcast({ type: 'rate_limited', message: 'Waiting 60s for rate limit to reset...' });
        await new Promise(r => setTimeout(r, 60000));
        // Try again
        try {
          await aptos.getLedgerInfo();
        } catch (e2: any) {
          return res.status(429).json({
            error: 'Still rate limited after waiting. Please try again in a few minutes.',
            retryAfter: 120,
          });
        }
      } else {
        return res.status(500).json({ error: e.message });
      }
    }

    state.account = await initAccount(key);
    state.marketAddress = marketAddress || await getDefaultMarket();
    state.marketInfo = await fetchMarketInfo(state.marketAddress);
    state.isRunning = true;
    state.totalTrades = 0;
    state.successfulTrades = 0;
    state.failedTrades = 0;
    state.totalLatency = 0;
    state.currentDelay = BASE_DELAY_MS;
    state.consecutiveFailures = 0;
    state.consecutiveRateLimits = 0;
    state.position = { yesTokens: 0, noTokens: 0, totalInvested: 0, realizedPnl: 0 };

    // Fetch initial visibility stats
    state.botBalance = await fetchBotBalance(state.account.accountAddress.toString());
    state.marketReserves = await fetchMarketReserves(state.marketAddress);

    console.log(`💰 Bot Balance: ${state.botBalance.toFixed(2)} APT`);
    console.log(`📊 Market TVL: ${state.marketReserves.tvl.toFixed(4)} APT`);

    // Start trading loop (don't await - runs in background)
    tradingLoop();

    broadcast({
      type: 'started',
      market: state.marketInfo,
      botBalance: state.botBalance,
      marketReserves: state.marketReserves,
    });

    res.json({
      success: true,
      account: state.account.accountAddress.toString().slice(0, 16) + '...',
      market: state.marketInfo,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/stop', (req, res) => {
  state.isRunning = false;
  broadcast({ type: 'stopped', position: state.position });
  res.json({ success: true, position: state.position });
});

app.get('/stats', (req, res) => {
  res.json({
    isRunning: state.isRunning,
    totalTrades: state.totalTrades,
    successfulTrades: state.successfulTrades,
    failedTrades: state.failedTrades,
    successRate: state.totalTrades > 0
      ? Math.round((state.successfulTrades / state.totalTrades) * 100)
      : 0,
    avgLatency: state.successfulTrades > 0
      ? Math.round(state.totalLatency / state.successfulTrades)
      : 0,
    currentDelay: state.currentDelay,
    market: state.marketInfo,
    position: state.position,
  });
});

// Start server
server.listen(PORT, () => {
  console.log('════════════════════════════════════════════════════════════════');
  console.log('HFT SERVER v2 - REAL ON-CHAIN TRANSACTIONS');
  console.log('════════════════════════════════════════════════════════════════');
  console.log(`\n🌐 HTTP:      http://localhost:${PORT}`);
  console.log(`🔌 WebSocket: ws://localhost:${PORT}`);
  console.log(`💓 Heartbeat: ${HEARTBEAT_INTERVAL / 1000}s interval`);
  console.log('\nFeatures:');
  console.log('  ✓ WebSocket heartbeat for connection health');
  console.log('  ✓ Log-normal distribution for varied amounts');
  console.log('  ✓ Adaptive throttling (150-800ms delays)');
  console.log('  ✓ Market info display');
  console.log('  ✓ Position and PNL tracking');
  console.log('\nEndpoints:');
  console.log('  POST /start  - Start trading');
  console.log('  POST /stop   - Stop trading');
  console.log('  GET  /stats  - Get current stats');
  console.log('  GET  /health - Health check');
  console.log('\n════════════════════════════════════════════════════════════════\n');
});
