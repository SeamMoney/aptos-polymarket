/**
 * Ultra HFT Server - Maximum TPS with Multi-Account Parallel Submission
 *
 * Optimizations:
 * 1. Multiple accounts (5 by default) for parallel submission
 * 2. Large batch sizes (50 txns per account)
 * 3. Minimal delays (50ms between batches)
 * 4. Fire-and-forget with async tracking
 * 5. SDK batch API for automatic sequence management
 *
 * Target: 500-1000+ TPS
 *
 * Usage:
 *   ULTRA_PRIVATE_KEYS="key1,key2,key3,key4,key5" APTOS_API_KEY=... npx tsx server/hft-ultra-server.ts
 *
 * Or single account mode:
 *   APTOS_PRIVATE_KEY=0x... APTOS_API_KEY=... npx tsx server/hft-ultra-server.ts
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
} from '@aptos-labs/ts-sdk';

const CONTRACT_ADDRESS = '0x64a81cb9cbd14d45b87bb32ef73107a44f00069b6a96e70d75369fb7e3da5e68';
const MODULE = `${CONTRACT_ADDRESS}::market`;
const MULTI_MODULE = `${CONTRACT_ADDRESS}::multi_outcome_market`;

// Configuration - MAXIMUM TPS MODE
const CONFIG = {
  PORT: parseInt(process.env.HFT_PORT || '3001'),
  BATCH_SIZE: 30,           // Increased from 25 for higher throughput
  BATCH_DELAY_MS: 0,        // NO DELAY - max speed
  SEQUENCE_PIPELINE: 60,    // Increased pipeline
  MAX_PENDING: 120,         // Increased pending
  MEMPOOL_BACKOFF_MS: 80,   // Reduced from 100 for faster recovery
  MAX_DELAY_MS: 150,        // Cap max delay (was unbounded to 300)
  TRADE_SAMPLE_RATE: 0.03,  // 3% sampling (was 10%) to prevent UI freeze at 1k TPS
  STATS_CACHE_TTL_MS: 200,  // Cache stats for 200ms to reduce computation
};

// Adaptive state
let currentDelay = 0;       // Starts at 0, increases on mempool_full
let consecutiveSuccess = 0; // Track successful batches

// Stats caching to reduce computation at high TPS
let cachedStats: object | null = null;
let cachedStatsTime = 0;

// Use API key (required for high TPS)
const API_KEY = process.env.APTOS_API_KEY || '';
if (!API_KEY) {
  console.warn('WARNING: No APTOS_API_KEY set. You will hit rate limits!');
}

const aptos = new Aptos(new AptosConfig({
  network: Network.TESTNET,
  clientConfig: API_KEY ? { API_KEY } : undefined,
}));

// Account state
interface AccountState {
  account: Account;
  sequenceNumber: bigint;
  pendingTxns: number;
  successCount: number;
  failCount: number;
  isActive: boolean;
}

// Global state
interface GlobalState {
  isRunning: boolean;
  accounts: AccountState[];
  marketAddress: string | null;
  isMultiOutcome: boolean;
  outcomeCount: number;
  totalTrades: number;
  successfulTrades: number;
  failedTrades: number;
  startTime: number;
  peakTps: number;
  recentTps: number[];
  // New UI fields
  recentLatencies: number[];
  combinedBalance: number;
  yesPrice: number;
  noPrice: number;
  yesReserve: number;
  noReserve: number;
  totalInvested: number;
  marketQuestion: string;
  // Position tracking
  outcomePositions: number[]; // Token balance for each outcome
  // Multi-outcome market data
  outcomePrices: number[]; // Actual prices for each outcome (0-100)
  outcomeLabels: string[]; // Labels for each outcome
}

const state: GlobalState = {
  isRunning: false,
  accounts: [],
  marketAddress: null,
  isMultiOutcome: false,
  outcomeCount: 2,
  totalTrades: 0,
  successfulTrades: 0,
  failedTrades: 0,
  startTime: 0,
  peakTps: 0,
  recentTps: [],
  // New UI fields
  recentLatencies: [],
  combinedBalance: 0,
  yesPrice: 50,
  noPrice: 50,
  yesReserve: 0,
  noReserve: 0,
  totalInvested: 0,
  marketQuestion: 'Loading market...',
  outcomePositions: [],
  outcomePrices: [],
  outcomeLabels: [],
};

const clients = new Set<WebSocket>();

// Bot names for visualization
const BOT_NAMES = ['Ultra-A', 'Ultra-B', 'Ultra-C', 'Ultra-D', 'Ultra-E', 'Hyper-1', 'Hyper-2', 'Mega-X'];
const ACTIONS = ['buy_yes', 'buy_no', 'buy_outcome'] as const;

let tradeIdCounter = 0;
let lastTpsCalcTime = Date.now();
let lastTpsCalcTrades = 0;

// Broadcast to clients
function broadcast(data: object) {
  const message = JSON.stringify(data);
  clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });
}

// Get random amount - bigger trades to move prices toward election results
function getRandomAmount(): number {
  // Smaller amounts to conserve funds at high TPS
  // 10% chance of medium trade
  if (Math.random() < 0.10) {
    return Math.random() * 0.2 + 0.1; // 0.1 - 0.3 APT
  }
  // 30% chance of small trade
  if (Math.random() < 0.30) {
    return Math.random() * 0.05 + 0.03; // 0.03 - 0.08 APT
  }
  return Math.random() * 0.02 + 0.01; // 0.01 - 0.03 APT (micro trades)
}

// Calculate current TPS
function calculateTps(): number {
  const now = Date.now();
  const elapsed = (now - lastTpsCalcTime) / 1000;
  if (elapsed < 0.5) return state.recentTps[state.recentTps.length - 1] || 0;

  const trades = state.totalTrades - lastTpsCalcTrades;
  const tps = trades / elapsed;

  lastTpsCalcTime = now;
  lastTpsCalcTrades = state.totalTrades;

  state.recentTps.push(tps);
  if (state.recentTps.length > 10) state.recentTps.shift();

  if (tps > state.peakTps) state.peakTps = tps;

  return tps;
}

// Get stats - includes all fields UI expects (with caching for performance)
function getStats() {
  const now = Date.now();

  // Return cached stats if still valid
  if (cachedStats && now - cachedStatsTime < CONFIG.STATS_CACHE_TTL_MS) {
    return cachedStats;
  }

  const tps = calculateTps();
  const avgTps = state.recentTps.length > 0
    ? state.recentTps.reduce((a, b) => a + b, 0) / state.recentTps.length
    : 0;
  const avgLatency = state.recentLatencies.length > 0
    ? Math.round(state.recentLatencies.reduce((a, b) => a + b, 0) / state.recentLatencies.length)
    : 150;

  const stats = {
    totalTrades: state.totalTrades,
    successfulTrades: state.successfulTrades,
    failedTrades: state.failedTrades,
    successRate: state.totalTrades > 0
      ? Math.round((state.successfulTrades / state.totalTrades) * 100)
      : 100,
    currentTps: Math.round(tps),
    avgTps: Math.round(avgTps),
    peakTps: Math.round(state.peakTps),
    avgLatency,
    currentDelay: currentDelay,
    activeAccounts: state.accounts.filter(a => a.isActive).length,
    totalAccounts: state.accounts.length,
  };

  // Cache the result
  cachedStats = stats;
  cachedStatsTime = now;

  return stats;
}

// Get full UI data payload
function getFullUIData() {
  // For multi-outcome, sum all positions; for binary, use first two
  let yesTokens = 0;
  let noTokens = 0;

  if (state.isMultiOutcome && state.outcomePositions.length > 0) {
    // For multi-outcome: show total of all outcome tokens
    // Use first outcome as "YES" equivalent, sum of others as "NO"
    yesTokens = state.outcomePositions[0] || 0;
    noTokens = state.outcomePositions.slice(1).reduce((a, b) => a + b, 0);
  }

  return {
    stats: getStats(),
    market: {
      address: state.marketAddress || '',
      question: state.marketQuestion,
      yesPrice: state.yesPrice,
      noPrice: state.noPrice,
      // Multi-outcome data
      isMultiOutcome: state.isMultiOutcome,
      outcomeCount: state.outcomeCount,
      outcomePrices: state.outcomePrices,
      outcomeLabels: state.outcomeLabels,
    },
    position: {
      yesTokens,  // Actual token balance
      noTokens,   // Actual token balance
      totalInvested: state.totalInvested,
      realizedPnl: 0,
      // Also send individual outcome positions
      outcomePositions: state.outcomePositions,
    },
    botBalance: state.combinedBalance,
    marketReserves: {
      yesReserve: state.yesReserve,
      noReserve: state.noReserve,
      tvl: state.yesReserve + state.noReserve,
    },
  };
}

// Fetch combined balance and market data periodically
async function refreshUIData(): Promise<void> {
  try {
    // Get combined balance of all accounts
    let totalBalance = 0;
    for (const accState of state.accounts) {
      try {
        const balance = await aptos.getAccountAPTAmount({ accountAddress: accState.account.accountAddress });
        totalBalance += balance / 100_000_000;
      } catch (e) {
        // Skip failed balance checks
      }
    }
    state.combinedBalance = totalBalance;

    // Fetch market reserves if we have a market
    if (state.marketAddress) {
      try {
        if (state.isMultiOutcome) {
          const info = await aptos.view({
            payload: {
              function: `${MULTI_MODULE}::get_multi_market_info`,
              functionArguments: [state.marketAddress],
            },
          });
          state.marketQuestion = String(info[0]);
          // info[7] = total_collateral (the TVL / pool reserve)
          const totalCollateral = Number(info[7]) / 100_000_000;
          console.log(`[UI Refresh] Total collateral (TVL): ${totalCollateral.toFixed(2)} APT`);

          state.yesReserve = totalCollateral * 0.5; // Split 50/50 for visualization
          state.noReserve = totalCollateral * 0.5;

          // Fetch REAL prices from contract
          try {
            const pricesResult = await aptos.view({
              payload: {
                function: `${MULTI_MODULE}::get_all_prices`,
                functionArguments: [state.marketAddress],
              },
            });
            const rawPrices = (pricesResult[0] as string[]).map(p => Number(p));
            // Normalize to sum to 100%
            const priceSum = rawPrices.reduce((a, b) => a + b, 0);
            state.outcomePrices = rawPrices.map(p => priceSum > 0 ? (p / priceSum) * 100 : 100 / rawPrices.length);
            console.log(`[UI Refresh] Real prices: ${state.outcomePrices.map(p => p.toFixed(1)).join('%, ')}%`);

            // Also fetch labels if we don't have them
            if (state.outcomeLabels.length === 0) {
              const labelsResult = await aptos.view({
                payload: {
                  function: `${MULTI_MODULE}::get_outcome_labels`,
                  functionArguments: [state.marketAddress],
                },
              });
              state.outcomeLabels = labelsResult[0] as string[];
            }
          } catch (e) {
            console.error('Error fetching prices:', e);
          }

          // Use first outcome price as yesPrice for backwards compatibility
          if (state.outcomePrices.length > 0) {
            state.yesPrice = Math.round(state.outcomePrices[0]);
            state.noPrice = 100 - state.yesPrice;
          }

          // Aggregate positions across ALL trading accounts
          if (state.accounts.length > 0 && state.outcomeCount > 0) {
            try {
              const aggregatedPositions = new Array(state.outcomeCount).fill(0);

              for (const accState of state.accounts.slice(0, 3)) { // Check first 3 accounts
                try {
                  const posResult = await aptos.view({
                    payload: {
                      function: `${MULTI_MODULE}::get_user_multi_positions`,
                      functionArguments: [state.marketAddress, accState.account.accountAddress.toString()],
                    },
                  });
                  const positions = posResult[0] as string[];
                  positions.forEach((p, i) => {
                    aggregatedPositions[i] += Number(p) / 100_000_000;
                  });
                } catch (e) {
                  // Skip account on error
                }
              }

              state.outcomePositions = aggregatedPositions;
              const totalTokens = aggregatedPositions.reduce((a, b) => a + b, 0);
              console.log(`[UI Refresh] Total Positions: ${totalTokens.toFixed(2)} tokens (${aggregatedPositions.map(p => p.toFixed(2)).join(', ')})`);
            } catch (e) {
              // Keep existing positions on error
            }
          }
        } else {
          const info = await aptos.view({
            payload: {
              function: `${MODULE}::get_market_info`,
              functionArguments: [state.marketAddress],
            },
          });
          state.marketQuestion = String(info[0]);
          state.yesReserve = Number(info[2]) / 100_000_000;
          state.noReserve = Number(info[3]) / 100_000_000;
          // Calculate prices from reserves
          const total = state.yesReserve + state.noReserve;
          if (total > 0) {
            state.yesPrice = Math.round((state.noReserve / total) * 100);
            state.noPrice = 100 - state.yesPrice;
          }
        }
      } catch (e) {
        // Keep existing values on error
      }
    }
  } catch (e) {
    console.error('Error refreshing UI data:', e);
  }
}

// Refresh sequence number for an account
async function refreshSequenceNumber(accState: AccountState): Promise<void> {
  try {
    const accountInfo = await aptos.getAccountInfo({
      accountAddress: accState.account.accountAddress,
    });
    accState.sequenceNumber = BigInt(accountInfo.sequence_number);
  } catch (e: any) {
    console.error(`Failed to refresh seq for ${accState.account.accountAddress.toString().slice(0, 10)}: ${e.message?.slice(0, 30)}`);
  }
}

// Simulate realistic election market probabilities
// Strategy: Mint complete sets, then sell underdogs to push their prices DOWN
// and keep/buy frontrunner tokens to push their prices UP
const ELECTION_WEIGHTS = {
  0: { targetProb: 0.45, name: 'Trump' },      // Frontrunner ~45%
  1: { targetProb: 0.25, name: 'Biden' },      // Second ~25%
  2: { targetProb: 0.12, name: 'DeSantis' },   // Underdog ~12%
  3: { targetProb: 0.10, name: 'RFK Jr' },     // Underdog ~10%
  4: { targetProb: 0.08, name: 'Other' },      // Longshot ~8%
};

// Build transaction payload - simulate realistic election trading
function buildPayload(marketAddress: string): { payload: InputGenerateTransactionPayloadData; isBuy: boolean } {
  if (state.isMultiOutcome) {
    const amount = BigInt(Math.floor(getRandomAmount() * 100_000_000));
    const rand = Math.random();

    // 20% chance: Mint complete set (needed to get tokens for selling)
    if (rand < 0.20) {
      return {
        payload: {
          function: `${MULTI_MODULE}::mint_complete_set`,
          functionArguments: [marketAddress, amount],
        },
        isBuy: true, // Counts as buy for stats
      };
    }

    // 45% chance: Sell non-Trump tokens (Biden and underdogs)
    // This creates differentiation - Trump stays high, others go lower
    if (rand < 0.65) {
      // Weight: Biden 20%, DeSantis 30%, RFK Jr 25%, Other 25%
      const sellRand = Math.random();
      let sellIndex: number;
      if (sellRand < 0.20) {
        sellIndex = 1; // Biden (sell some to separate from Trump)
      } else if (sellRand < 0.50) {
        sellIndex = 2; // DeSantis
      } else if (sellRand < 0.75) {
        sellIndex = 3; // RFK Jr
      } else {
        sellIndex = 4; // Other
      }
      return {
        payload: {
          function: `${MULTI_MODULE}::sell_outcome`,
          functionArguments: [marketAddress, sellIndex, amount, 0n],
        },
        isBuy: false,
      };
    }

    // 35% chance: Buy Trump only (keep price highest)
    return {
      payload: {
        function: `${MULTI_MODULE}::buy_outcome`,
        functionArguments: [marketAddress, 0, amount, 0n], // Only Trump
      },
      isBuy: true,
    };
  } else {
    const amount = BigInt(Math.floor(getRandomAmount() * 100_000_000));
    if (isBuy) {
      const action = Math.random() < 0.5 ? 'buy_yes' : 'buy_no';
      return {
        payload: {
          function: `${MODULE}::${action}`,
          functionArguments: [marketAddress, amount, 0n],
        },
        isBuy: true,
      };
    } else {
      const action = Math.random() < 0.5 ? 'sell_yes' : 'sell_no';
      return {
        payload: {
          function: `${MODULE}::${action}`,
          functionArguments: [marketAddress, amount, 0n],
        },
        isBuy: false,
      };
    }
  }
}

// Execute batch for single account (fire-and-forget style)
async function executeBatchForAccount(accState: AccountState): Promise<void> {
  if (!state.marketAddress || !accState.isActive) return;

  const batchSize = Math.min(CONFIG.BATCH_SIZE, CONFIG.MAX_PENDING - accState.pendingTxns);
  if (batchSize <= 0) return;

  const startTime = Date.now();
  const baseSeq = accState.sequenceNumber;

  // Build all payloads with buy/sell info
  const payloadsWithInfo: { payload: InputGenerateTransactionPayloadData; isBuy: boolean }[] = [];
  for (let i = 0; i < batchSize; i++) {
    payloadsWithInfo.push(buildPayload(state.marketAddress));
  }

  // Build and submit all transactions in parallel
  const promises = payloadsWithInfo.map(async ({ payload, isBuy }, i) => {
    const seqNum = baseSeq + BigInt(i);
    try {
      const tx = await aptos.transaction.build.simple({
        sender: accState.account.accountAddress,
        data: payload,
        options: {
          accountSequenceNumber: seqNum,
          expireTimestamp: Math.floor(Date.now() / 1000) + 60, // Short expiry
        },
      });

      const signedTx = aptos.transaction.sign({
        signer: accState.account,
        transaction: tx,
      });

      const pending = await aptos.transaction.submit.simple({
        transaction: tx,
        senderAuthenticator: signedTx,
      });

      return { success: true, hash: pending.hash, isBuy };
    } catch (e: any) {
      const errMsg = e.message || 'Unknown error';
      // Only log errors for the first tx in batch to reduce noise
      // Don't log "insufficient balance" for sells (expected when no tokens)
      if (i === 0 && !errMsg.includes('INSUFFICIENT_BALANCE')) {
        console.error(`  [ERROR] ${errMsg.slice(0, 60)}`);
        if (e.data?.error_code) console.error(`  [CODE] ${e.data.error_code}`);
      }
      return { success: false, error: errMsg, isBuy };
    }
  });

  // Wait for results before updating sequence (reliable mode)
  const results = await Promise.all(promises);
  const batchTime = Date.now() - startTime;

  // Process results
  let successCount = 0;
  let failCount = 0;
  let sequenceError = false;

  for (const result of results) {
    state.totalTrades++;

    if (result.success) {
      successCount++;
      state.successfulTrades++;
      accState.successCount++;

      // Track latency - use actual batch time (not divided by batch size)
      // This is submission latency, not finality latency (which is ~470ms on Aptos)
      const submissionLatency = batchTime;
      // Estimate finality latency: submission + ~400ms block time
      const estimatedFinality = submissionLatency + 400;
      state.recentLatencies.push(estimatedFinality);
      if (state.recentLatencies.length > 100) state.recentLatencies.shift();

      // Broadcast trade (sampled to reduce overhead)
      if (Math.random() < CONFIG.TRADE_SAMPLE_RATE) { // 3% sampling to prevent UI freeze at 1k TPS
        tradeIdCounter++;
        const tradeAmount = getRandomAmount();
        if (result.isBuy) {
          state.totalInvested += tradeAmount;
        } else {
          state.totalInvested -= tradeAmount * 0.95; // Account for slippage on sells
        }

        // Determine action display based on buy/sell
        let action: string;
        let actionDisplay: string;
        if (state.isMultiOutcome) {
          action = result.isBuy ? 'buy_outcome' : 'sell_outcome';
          actionDisplay = result.isBuy ? 'BUY OUTCOME' : 'SELL OUTCOME';
        } else {
          action = result.isBuy ? 'buy_yes' : 'sell_yes';
          actionDisplay = result.isBuy ? 'BUY YES' : 'SELL YES';
        }

        const uiData = getFullUIData();
        broadcast({
          type: 'trade',
          data: {
            id: `ultra-${tradeIdCounter}`,
            bot: BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)],
            action,
            actionDisplay,
            amount: tradeAmount,
            latency: estimatedFinality, // Use realistic finality estimate
            success: true,
            txHash: result.hash,
            explorerUrl: `https://explorer.aptoslabs.com/txn/${result.hash}?network=testnet`,
            timestamp: Date.now(),
          },
          ...uiData,
        });
      }
    } else {
      failCount++;
      state.failedTrades++;
      accState.failCount++;

      if (result.error?.toLowerCase().includes('sequence')) {
        sequenceError = true;
      }
    }
  }

  // Update sequence number based on successes
  accState.sequenceNumber += BigInt(successCount);

  // Categorize errors properly to avoid wasteful sequence refreshes
  let mempoolFull = false;
  let hasSequenceError = false;
  let hasVmError = false;

  for (const result of results) {
    if (!result.success && result.error) {
      const err = result.error.toLowerCase();
      if (err.includes('mempool_is_full')) {
        mempoolFull = true;
      } else if (err.includes('sequence') || err.includes('invalid_transaction_update')) {
        hasSequenceError = true;
      } else if (err.includes('vm_error') || err.includes('insufficient')) {
        hasVmError = true;
      }
    }
  }

  // Adaptive delay: back off on mempool_full, speed up on any success
  if (mempoolFull) {
    currentDelay = Math.min(currentDelay + CONFIG.MEMPOOL_BACKOFF_MS, CONFIG.MAX_DELAY_MS);
    consecutiveSuccess = 0;
  } else if (successCount > 0) {
    // Decrease delay when we have ANY successes (not just perfect batches)
    consecutiveSuccess++;
    if (consecutiveSuccess > 2) { // Was 3, now recover faster
      currentDelay = Math.max(currentDelay - 30, 0); // Was 20, now recover faster
    }
  }

  // Only refresh sequence on actual sequence errors (NOT on mempool_is_full)
  if (hasSequenceError) {
    await refreshSequenceNumber(accState);
  } else if (hasVmError && failCount > batchSize / 2) {
    // Check balance if >50% of batch failed with VM errors
    await checkAndPauseIfLowBalance(accState);
  }

  const tps = (batchSize / (batchTime / 1000)).toFixed(0);
  const accAddr = accState.account.accountAddress.toString().slice(0, 8);
  console.log(`[${accAddr}] Batch: ${successCount}/${batchSize} | ${batchTime}ms | ~${tps} TPS${currentDelay > 0 ? ` | delay:${currentDelay}ms` : ''}`);
}

// Check balance and pause if too low
async function checkAndPauseIfLowBalance(accState: AccountState): Promise<boolean> {
  try {
    const balance = await aptos.getAccountAPTAmount({ accountAddress: accState.account.accountAddress });
    const balanceAPT = balance / 100_000_000;
    if (balanceAPT < 0.5) {
      console.warn(`[${accState.account.accountAddress.toString().slice(0, 8)}] LOW BALANCE: ${balanceAPT.toFixed(2)} APT - pausing`);
      accState.isActive = false;
      return true;
    }
  } catch (e) {
    // Ignore balance check errors
  }
  return false;
}

// Fire-and-forget batch - don't wait for all results
async function fireAndForgetBatch(accState: AccountState): Promise<void> {
  if (!state.marketAddress || !accState.isActive) return;

  const batchSize = CONFIG.BATCH_SIZE;
  const startTime = Date.now();
  const baseSeq = accState.sequenceNumber;

  // Pre-increment sequence number immediately (speculative execution)
  accState.sequenceNumber += BigInt(batchSize);

  // Build and submit without waiting
  for (let i = 0; i < batchSize; i++) {
    const { payload, isBuy } = buildPayload(state.marketAddress);
    const seqNum = baseSeq + BigInt(i);

    // Fire off without waiting
    aptos.transaction.build.simple({
      sender: accState.account.accountAddress,
      data: payload,
      options: { accountSequenceNumber: seqNum, expireTimestamp: Math.floor(Date.now() / 1000) + 30 },
    }).then(tx => {
      const signedTx = aptos.transaction.sign({ signer: accState.account, transaction: tx });
      return aptos.transaction.submit.simple({ transaction: tx, senderAuthenticator: signedTx });
    }).then(pending => {
      state.totalTrades++;
      state.successfulTrades++;
      accState.successCount++;

      // Broadcast sample
      if (Math.random() < 0.05) {
        tradeIdCounter++;
        const tradeAmount = getRandomAmount();
        broadcast({
          type: 'trade',
          data: {
            id: `ultra-${tradeIdCounter}`,
            bot: BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)],
            action: isBuy ? 'buy_outcome' : 'sell_outcome',
            actionDisplay: isBuy ? 'BUY OUTCOME' : 'SELL OUTCOME',
            amount: tradeAmount,
            latency: Date.now() - startTime + 400,
            success: true,
            txHash: pending.hash,
            explorerUrl: `https://explorer.aptoslabs.com/txn/${pending.hash}?network=testnet`,
            timestamp: Date.now(),
          },
          ...getFullUIData(),
        });
      }
    }).catch(() => {
      state.totalTrades++;
      state.failedTrades++;
      accState.failCount++;
    });
  }

  const elapsed = Date.now() - startTime;
  const accAddr = accState.account.accountAddress.toString().slice(0, 8);
  console.log(`[${accAddr}] Fired: ${batchSize} txns in ${elapsed}ms`);
}

// Main trading loop for single account
async function accountTradingLoop(accState: AccountState, accountIndex: number): Promise<void> {
  console.log(`[Account ${accountIndex + 1}] Trading loop started`);
  let batchCount = 0;

  while (state.isRunning && accState.isActive) {
    try {
      // Execute batch at max speed
      await executeBatchForAccount(accState);
      batchCount++;

      // Apply adaptive delay (only when mempool is congested)
      if (currentDelay > 0) {
        await new Promise(r => setTimeout(r, currentDelay));
      }

      // Check balance less frequently for speed
      if (batchCount % 50 === 0) {
        await checkAndPauseIfLowBalance(accState);
      }
    } catch (e: any) {
      console.error(`[Account ${accountIndex + 1}] Error: ${e.message?.slice(0, 50)}`);
      await refreshSequenceNumber(accState);
      // Brief pause on error
      await new Promise(r => setTimeout(r, 50));
    }
  }

  console.log(`[Account ${accountIndex + 1}] Trading loop stopped`);
}

// Get market info
async function getMarketInfo(): Promise<{ address: string; isMultiOutcome: boolean; outcomeCount: number }> {
  // Try multi-outcome first
  try {
    const result = await aptos.view({
      payload: {
        function: `${MULTI_MODULE}::get_all_multi_markets`,
        functionArguments: [],
      },
    });
    const markets = result[0] as string[];
    if (markets.length > 0) {
      const infoResult = await aptos.view({
        payload: {
          function: `${MULTI_MODULE}::get_multi_market_info`,
          functionArguments: [markets[0]],
        },
      });
      return {
        address: markets[0],
        isMultiOutcome: true,
        outcomeCount: Number(infoResult[3]),
      };
    }
  } catch (e) {
    // Continue to binary markets
  }

  // Fall back to binary markets
  const result = await aptos.view({
    payload: {
      function: `${MODULE}::get_all_markets`,
      functionArguments: [],
    },
  });
  const markets = result[0] as string[];
  if (markets.length === 0) throw new Error('No markets found');

  return { address: markets[0], isMultiOutcome: false, outcomeCount: 2 };
}

// Helper to parse keys with optional ed25519-priv- prefix
function parsePrivateKey(key: string): Ed25519PrivateKey {
  const cleanKey = key.startsWith('ed25519-priv-') ? key.slice(13) : key;
  return new Ed25519PrivateKey(cleanKey);
}

// Initialize accounts
function initializeAccounts(): Account[] {
  const accounts: Account[] = [];

  // Check for multi-account mode
  const ultraKeys = process.env.ULTRA_PRIVATE_KEYS;
  if (ultraKeys) {
    const keys = ultraKeys.split(',').map(k => k.trim());
    for (const key of keys) {
      try {
        accounts.push(Account.fromPrivateKey({ privateKey: parsePrivateKey(key) }));
      } catch (e) {
        console.error(`Invalid key: ${key.slice(0, 10)}...`);
      }
    }
  }

  // Fall back to single account
  if (accounts.length === 0) {
    const singleKey = process.env.APTOS_PRIVATE_KEY;
    if (singleKey) {
      accounts.push(Account.fromPrivateKey({ privateKey: parsePrivateKey(singleKey) }));
    }
  }

  return accounts;
}

// Start trading
async function startTrading(): Promise<void> {
  if (state.isRunning) return;

  const accounts = initializeAccounts();
  if (accounts.length === 0) {
    console.error('No accounts configured. Set ULTRA_PRIVATE_KEYS or APTOS_PRIVATE_KEY');
    return;
  }

  console.log(`\nInitializing ${accounts.length} account(s)...`);

  // Get market info
  const marketInfo = await getMarketInfo();
  state.marketAddress = marketInfo.address;
  state.isMultiOutcome = marketInfo.isMultiOutcome;
  state.outcomeCount = marketInfo.outcomeCount;

  console.log(`Market: ${state.marketAddress.slice(0, 20)}...`);
  console.log(`Type: ${state.isMultiOutcome ? `Multi-Outcome (${state.outcomeCount})` : 'Binary'}`);

  // Initialize account states
  state.accounts = [];
  for (const account of accounts) {
    const accState: AccountState = {
      account,
      sequenceNumber: 0n,
      pendingTxns: 0,
      successCount: 0,
      failCount: 0,
      isActive: true,
    };

    await refreshSequenceNumber(accState);

    // Check balance
    try {
      const balance = await aptos.getAccountAPTAmount({ accountAddress: account.accountAddress });
      const balanceAPT = balance / 100_000_000;
      console.log(`  ${account.accountAddress.toString().slice(0, 12)}... | ${balanceAPT.toFixed(2)} APT | Seq: ${accState.sequenceNumber}`);

      if (balanceAPT < 1) {
        console.warn(`    WARNING: Low balance, skipping this account`);
        accState.isActive = false;
      }
    } catch (e) {
      console.error(`  Failed to check balance`);
      accState.isActive = false;
    }

    state.accounts.push(accState);
  }

  const activeAccounts = state.accounts.filter(a => a.isActive);
  if (activeAccounts.length === 0) {
    console.error('No active accounts with sufficient balance');
    return;
  }

  // Reset stats
  state.totalTrades = 0;
  state.successfulTrades = 0;
  state.failedTrades = 0;
  state.startTime = Date.now();
  state.peakTps = 0;
  state.recentTps = [];
  state.recentLatencies = [];
  state.totalInvested = 0;
  lastTpsCalcTime = Date.now();
  lastTpsCalcTrades = 0;

  // Initial UI data fetch
  await refreshUIData();

  state.isRunning = true;

  console.log(`\nStarting ${activeAccounts.length} parallel trading loops...`);
  console.log(`Batch: ${CONFIG.BATCH_SIZE} | Delay: ${CONFIG.BATCH_DELAY_MS}ms`);
  console.log(`Target: ~${(CONFIG.BATCH_SIZE * activeAccounts.length / (CONFIG.BATCH_DELAY_MS / 1000)).toFixed(0)} TPS\n`);

  // Start periodic UI data refresh (every 10 seconds)
  const uiRefreshInterval = setInterval(async () => {
    if (!state.isRunning) {
      clearInterval(uiRefreshInterval);
      return;
    }
    await refreshUIData();
    // Broadcast updated state to all clients
    broadcast({ type: 'state', data: { isRunning: state.isRunning, ...getFullUIData() } });
  }, 10000);

  // Start all trading loops in parallel
  for (let i = 0; i < state.accounts.length; i++) {
    if (state.accounts[i].isActive) {
      accountTradingLoop(state.accounts[i], i);
    }
  }

  broadcast({ type: 'started', ...getFullUIData() });
}

// Express + WebSocket setup
const app = express();
app.use(cors());
app.use(express.json());

const server = createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('Client connected');
  clients.add(ws);

  if (clients.size === 1 && !state.isRunning) {
    startTrading();
  }

  // Send full UI data on connection
  ws.send(JSON.stringify({
    type: 'state',
    data: { isRunning: state.isRunning, ...getFullUIData() },
  }));

  ws.on('close', () => {
    console.log('Client disconnected');
    clients.delete(ws);
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', isRunning: state.isRunning, stats: getStats() });
});

app.post('/stop', (req, res) => {
  state.isRunning = false;
  state.accounts.forEach(a => a.isActive = false);
  broadcast({ type: 'stopped' });
  res.json({ success: true });
});

app.post('/start', async (req, res) => {
  if (state.isRunning) {
    return res.json({ success: true, message: 'Already running' });
  }
  if (!state.marketAddress) {
    return res.status(400).json({ success: false, error: 'No market address set' });
  }
  // Reset adaptive delay on restart
  currentDelay = 0;
  consecutiveSuccess = 0;

  // Restart trading - reactivate accounts and restart loops
  state.isRunning = true;
  state.accounts.forEach(a => a.isActive = true);

  // Restart trading loops for all accounts
  for (let i = 0; i < state.accounts.length; i++) {
    if (state.accounts[i].isActive) {
      accountTradingLoop(state.accounts[i], i);
    }
  }

  broadcast({ type: 'started', accounts: state.accounts.length });
  res.json({ success: true, message: 'Trading restarted' });
});

app.get('/stats', (req, res) => {
  res.json(getStats());
});

// Start server
server.listen(CONFIG.PORT, () => {
  console.log('='.repeat(70));
  console.log('ULTRA HFT SERVER - Maximum TPS Mode');
  console.log('='.repeat(70));
  console.log(`\nHTTP:      http://localhost:${CONFIG.PORT}`);
  console.log(`WebSocket: ws://localhost:${CONFIG.PORT}`);
  console.log('\nFeatures:');
  console.log('  - Multi-account parallel submission');
  console.log('  - Large batch sizes (50 txns/batch)');
  console.log('  - Aggressive timing (50ms delay)');
  console.log('  - Fire-and-forget with async tracking');
  console.log('  - Supports binary + multi-outcome markets');
  console.log('\nConfiguration:');
  console.log(`  BATCH_SIZE: ${CONFIG.BATCH_SIZE}`);
  console.log(`  BATCH_DELAY: ${CONFIG.BATCH_DELAY_MS}ms`);
  console.log(`  MAX_PENDING: ${CONFIG.MAX_PENDING}`);
  console.log('\n' + '='.repeat(70) + '\n');
});
