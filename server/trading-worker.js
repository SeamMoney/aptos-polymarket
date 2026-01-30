// server/trading-worker.ts
import { parentPort, workerData } from "worker_threads";
import http from "http";
import https from "https";
import {
  Aptos,
  AptosConfig,
  Network
} from "@aptos-labs/ts-sdk";

// config/seed-accounts.ts
import * as bip39 from "bip39";
import {
  Account,
  Ed25519PrivateKey,
  deriveKey,
  mnemonicToSeed,
  isValidBIP44Path
} from "@aptos-labs/ts-sdk";
var APTOS_COIN_TYPE = 637;
var cachedSeed = null;
var cachedMnemonic = null;
function getCachedSeed(mnemonic) {
  if (cachedMnemonic === mnemonic && cachedSeed) {
    return cachedSeed;
  }
  console.log("[SEED] Computing mnemonic seed (one-time operation)...");
  const startTime = Date.now();
  cachedSeed = mnemonicToSeed(mnemonic);
  cachedMnemonic = mnemonic;
  console.log(`[SEED] Seed computed in ${Date.now() - startTime}ms`);
  return cachedSeed;
}
function validateMnemonic2(mnemonic) {
  return bip39.validateMnemonic(mnemonic);
}
function deriveAccount(mnemonic, index) {
  const path = `m/44'/${APTOS_COIN_TYPE}'/0'/0/${index}`;
  if (!isValidBIP44Path(path)) {
    throw new Error(`Invalid BIP-44 path: ${path}`);
  }
  const seed = getCachedSeed(mnemonic);
  const { key } = deriveKey(path, seed);
  const privateKey = new Ed25519PrivateKey(key);
  return Account.fromPrivateKey({ privateKey });
}
var DERIVATION_PATH_PREFIX = `m/44'/${APTOS_COIN_TYPE}'/0'/0`;

// server/trading-worker.ts
var WORKER_VERSION = "2026-01-30-v5-seed-cache";
console.log(`[WORKER_VERSION] ${WORKER_VERSION}`);
var httpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 1e3,
  // Max 1000 connections per origin
  maxFreeSockets: 200,
  // Keep more free sockets
  timeout: 15e3,
  // 15s timeout - fail fast, don't block (was 60s)
  scheduling: "fifo"
  // First-in-first-out for fairness
});
var httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 1e3,
  maxFreeSockets: 200,
  timeout: 15e3,
  // 15s timeout - fail fast, don't block (was 60s)
  scheduling: "fifo"
});
http.globalAgent = httpAgent;
https.globalAgent = httpsAgent;
var ACCOUNT_CONCURRENCY = workerData?.accountConcurrency || parseInt(process.env.ACCOUNT_CONCURRENCY || "40");
var TX_BUFFER_SIZE = 1e5;
var txBuffer = [];
var txBufferIndex = 0;
var firstErrorLogged = false;
var config = workerData;
var MULTI_MODULE = `${config.contractAddress}::multi_outcome_market`;
var currentDelay = 0;
var consecutiveSuccess = 0;
var MEMPOOL_BACKOFF_MS = 50;
var MAX_DELAY_MS = 500;
var stats = {
  workerId: config.workerId,
  totalTrades: 0,
  successfulTrades: 0,
  failedTrades: 0,
  currentTps: 0,
  accountCount: config.accountCount,
  activeAccounts: 0
};
var lastTpsCalcTime = Date.now();
var lastTpsCalcTrades = 0;
var marketIndex = 0;
var isRunning = false;
var Semaphore = class {
  permits;
  waiting = [];
  constructor(permits) {
    this.permits = permits;
  }
  async acquire() {
    if (this.permits > 0) {
      this.permits--;
      return;
    }
    return new Promise((resolve) => {
      this.waiting.push(resolve);
    });
  }
  release() {
    if (this.waiting.length > 0) {
      const next = this.waiting.shift();
      next();
    } else {
      this.permits++;
    }
  }
  get available() {
    return this.permits;
  }
};
var accountSemaphore;
function recordTx(hash, market, outcome, isBuy, sender) {
  const record = {
    hash,
    timestamp: Date.now(),
    market,
    outcome,
    isBuy,
    sender
  };
  if (txBuffer.length < TX_BUFFER_SIZE) {
    txBuffer.push(record);
  } else {
    txBuffer[txBufferIndex] = record;
    txBufferIndex = (txBufferIndex + 1) % TX_BUFFER_SIZE;
  }
}
function getRecordedTxs() {
  if (txBuffer.length < TX_BUFFER_SIZE) {
    return [...txBuffer];
  }
  return [
    ...txBuffer.slice(txBufferIndex),
    ...txBuffer.slice(0, txBufferIndex)
  ];
}
var aptos;
var accounts = [];
async function initialize() {
  console.log(`[Worker ${config.workerId}] Initializing...`);
  console.log(`[Worker ${config.workerId}] RPC: ${config.rpcEndpoint}`);
  console.log(`[Worker ${config.workerId}] Accounts: ${config.accountStartIndex} - ${config.accountStartIndex + config.accountCount - 1}`);
  if (!validateMnemonic2(config.mnemonic)) {
    throw new Error("Invalid mnemonic");
  }
  aptos = new Aptos(new AptosConfig({
    network: Network.TESTNET,
    fullnode: config.rpcEndpoint
  }));
  console.log(`[Worker ${config.workerId}] Deriving ${config.accountCount} accounts starting at index ${config.accountStartIndex}...`);
  const startDerive = Date.now();
  for (let i = 0; i < config.accountCount; i++) {
    const globalIndex = config.accountStartIndex + i;
    const account = deriveAccount(config.mnemonic, globalIndex);
    const accState = {
      account,
      sequenceNumber: 0n,
      successCount: 0,
      failCount: 0,
      isActive: true,
      holdings: /* @__PURE__ */ new Map()
      // Initialize empty holdings tracker
    };
    accounts.push(accState);
    if ((i + 1) % 50 === 0) {
      console.log(`[Worker ${config.workerId}] Derived ${i + 1}/${config.accountCount} accounts`);
    }
  }
  console.log(`[Worker ${config.workerId}] Derived ${accounts.length} accounts in ${Date.now() - startDerive}ms`);
  console.log(`[Worker ${config.workerId}] Fetching sequence numbers...`);
  const batchSize = 10;
  for (let i = 0; i < accounts.length; i += batchSize) {
    const batch = accounts.slice(i, i + batchSize);
    await Promise.all(batch.map(async (accState) => {
      try {
        const info = await aptos.account.getAccountInfo({
          accountAddress: accState.account.accountAddress
        });
        accState.sequenceNumber = BigInt(info.sequence_number);
      } catch {
        accState.sequenceNumber = 0n;
      }
    }));
  }
  stats.accountCount = accounts.length;
  stats.activeAccounts = accounts.filter((a) => a.isActive).length;
  console.log(`[Worker ${config.workerId}] Initialized ${accounts.length} accounts`);
}
function getNextMarket() {
  if (config.markets.length === 0) return "";
  const market = config.markets[marketIndex];
  marketIndex = (marketIndex + 1) % config.markets.length;
  return market;
}
function buildPayload(marketAddress, holdings) {
  const amount = BigInt(Math.floor((Math.random() * 0.09 + 0.01) * 1e8));
  const outcomeCount = 4;
  const outcomeIndex = Math.floor(Math.random() * outcomeCount);
  let marketHoldings = holdings.get(marketAddress);
  if (!marketHoldings) {
    marketHoldings = /* @__PURE__ */ new Map();
    holdings.set(marketAddress, marketHoldings);
  }
  const sellableOutcomes = [];
  for (let i = 0; i < outcomeCount; i++) {
    const held = marketHoldings.get(i) || 0;
    if (held > 0) {
      sellableOutcomes.push(i);
    }
  }
  const wantToSell = Math.random() >= 0.7;
  const canSell = sellableOutcomes.length > 0;
  const isBuy = !wantToSell || !canSell;
  if (isBuy) {
    const currentHeld = marketHoldings.get(outcomeIndex) || 0;
    marketHoldings.set(outcomeIndex, currentHeld + 1);
    return {
      payload: {
        function: `${MULTI_MODULE}::buy_outcome`,
        functionArguments: [marketAddress, outcomeIndex, amount, 0n]
      },
      isBuy: true,
      outcomeIndex
    };
  } else {
    const sellOutcome = sellableOutcomes[Math.floor(Math.random() * sellableOutcomes.length)];
    const currentHeld = marketHoldings.get(sellOutcome) || 0;
    marketHoldings.set(sellOutcome, Math.max(0, currentHeld - 1));
    return {
      payload: {
        function: `${MULTI_MODULE}::sell_outcome`,
        functionArguments: [marketAddress, sellOutcome, amount, 0n]
      },
      isBuy: false,
      outcomeIndex: sellOutcome
    };
  }
}
async function refreshSequenceNumber(accState) {
  try {
    const info = await aptos.account.getAccountInfo({
      accountAddress: accState.account.accountAddress
    });
    accState.sequenceNumber = BigInt(info.sequence_number);
  } catch {
  }
}
async function executeBatchForAccount(accState) {
  if (!accState.isActive) return true;
  if (stats.totalTrades === 0 && accState.sequenceNumber < 3n) {
    console.log(`[Worker ${config.workerId}] BATCH_START seq=${accState.sequenceNumber}`);
  }
  const batchSize = config.batchSize;
  const startTime = Date.now();
  const baseSeq = accState.sequenceNumber;
  const payloads = [];
  for (let i = 0; i < batchSize; i++) {
    const market = getNextMarket();
    const info = buildPayload(market, accState.holdings);
    payloads.push({ ...info, market });
  }
  const buildPromises = payloads.map(({ payload }, i) => {
    const options = config.useOrderless ? {
      replayProtectionNonce: BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)),
      expireTimestamp: Math.floor(Date.now() / 1e3) + 120,
      maxGasAmount: 5e4,
      gasUnitPrice: 100
    } : {
      accountSequenceNumber: baseSeq + BigInt(i),
      expireTimestamp: Math.floor(Date.now() / 1e3) + 300,
      // 5 minutes instead of 60 seconds
      maxGasAmount: 5e4,
      gasUnitPrice: 100
    };
    return aptos.transaction.build.simple({
      sender: accState.account.accountAddress,
      data: payload,
      options
    }).catch((e) => {
      if (!firstErrorLogged) {
        firstErrorLogged = true;
        console.log(`[Worker ${config.workerId}] TX_BUILD_ERROR: ${e.message || "Unknown"}`);
      }
      return null;
    });
  });
  if (stats.totalTrades === 0) {
    console.log(`[Worker ${config.workerId}] AWAITING_BUILDS`);
  }
  const builtTxs = await Promise.all(buildPromises);
  if (stats.totalTrades === 0) {
    console.log(`[Worker ${config.workerId}] BUILDS_DONE count=${builtTxs.filter((t) => t !== null).length}`);
  }
  const hasBuildFailure = builtTxs.some((tx) => tx === null);
  const signedTxs = builtTxs.map((tx) => {
    if (!tx) return null;
    try {
      return aptos.transaction.sign({ signer: accState.account, transaction: tx });
    } catch {
      return null;
    }
  });
  let successCount = 0;
  let failCount = 0;
  let mempoolFull = false;
  let hasSequenceError = false;
  const submitPromises = builtTxs.map((tx, i) => {
    if (!tx || !signedTxs[i]) {
      if (!firstErrorLogged) {
        firstErrorLogged = true;
        console.log(`[Worker ${config.workerId}] BUILD_FAILED: tx=${!!tx}, signed=${!!signedTxs[i]}`);
      }
      return Promise.resolve({ success: false, error: "Build/sign failed", hash: "" });
    }
    return aptos.transaction.submit.simple({
      transaction: tx,
      senderAuthenticator: signedTxs[i]
    }).then((result) => ({ success: true, hash: result.hash })).catch((e) => {
      const errMsg = e.message || "Unknown error";
      if (errMsg.includes("mempool_is_full")) {
        mempoolFull = true;
      } else if (errMsg.includes("sequence") || errMsg.includes("invalid_transaction_update")) {
        hasSequenceError = true;
      }
      if (!firstErrorLogged) {
        firstErrorLogged = true;
        console.log(`[Worker ${config.workerId}] FIRST_ERROR: ${errMsg.slice(0, 400)}`);
        parentPort?.postMessage({
          type: "error_log",
          data: { workerId: config.workerId, error: errMsg.slice(0, 400) }
        });
      }
      return { success: false, error: errMsg, hash: "" };
    });
  });
  const results = await Promise.all(submitPromises);
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    stats.totalTrades++;
    if (result.success && result.hash) {
      successCount++;
      stats.successfulTrades++;
      accState.successCount++;
      const payload = payloads[i];
      recordTx(
        result.hash,
        payload.market,
        payload.outcomeIndex,
        payload.isBuy,
        accState.account.accountAddress.toString()
      );
    } else {
      failCount++;
      stats.failedTrades++;
      accState.failCount++;
    }
  }
  if (!config.useOrderless) {
    accState.sequenceNumber += BigInt(batchSize);
  }
  if (mempoolFull) {
    currentDelay = Math.min(
      currentDelay === 0 ? MEMPOOL_BACKOFF_MS : Math.floor(currentDelay * 1.5),
      MAX_DELAY_MS
    );
    consecutiveSuccess = 0;
  } else if (successCount > 0) {
    consecutiveSuccess++;
    if (consecutiveSuccess > 1) {
      currentDelay = Math.floor(currentDelay * 0.5);
    }
  }
  const batchTime = Date.now() - startTime;
  if (stats.totalTrades % 500 === 0) {
    const tps = Math.round(batchSize / (batchTime / 1e3));
    console.log(
      `[Worker ${config.workerId}] ${accState.account.accountAddress.toString().slice(0, 8)} ${successCount}/${batchSize} ${tps} TPS total: ${stats.totalTrades}`
    );
  }
  const needsRefresh = (hasBuildFailure || hasSequenceError) && !config.useOrderless;
  return !needsRefresh;
}
async function fireAndForgetBatch(accState) {
  if (!accState.isActive) return;
  const batchSize = config.batchSize;
  const baseSeq = accState.sequenceNumber;
  const senderAddr = accState.account.accountAddress.toString();
  if (!config.useOrderless) {
    accState.sequenceNumber += BigInt(batchSize);
  }
  for (let i = 0; i < batchSize; i++) {
    const market = getNextMarket();
    const { payload, isBuy, outcomeIndex } = buildPayload(market, accState.holdings);
    const options = config.useOrderless ? {
      replayProtectionNonce: BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)),
      expireTimestamp: Math.floor(Date.now() / 1e3) + 120,
      maxGasAmount: 5e4,
      gasUnitPrice: 100
    } : {
      accountSequenceNumber: baseSeq + BigInt(i),
      expireTimestamp: Math.floor(Date.now() / 1e3) + 300,
      // 5 minutes instead of 60 seconds
      maxGasAmount: 5e4,
      gasUnitPrice: 100
    };
    aptos.transaction.build.simple({
      sender: accState.account.accountAddress,
      data: payload,
      options
    }).then((tx) => {
      const signedTx = aptos.transaction.sign({ signer: accState.account, transaction: tx });
      return aptos.transaction.submit.simple({ transaction: tx, senderAuthenticator: signedTx });
    }).then((result) => {
      stats.totalTrades++;
      stats.successfulTrades++;
      accState.successCount++;
      recordTx(result.hash, market, outcomeIndex, isBuy, senderAddr);
    }).catch(() => {
      stats.totalTrades++;
      stats.failedTrades++;
      accState.failCount++;
    });
  }
}
async function accountTradingLoop(accState, accountIndex) {
  if (accountIndex === 0) {
    console.log(`[Worker ${config.workerId}] LOOP_START account=${accountIndex} isRunning=${isRunning} isActive=${accState.isActive} concurrency=${ACCOUNT_CONCURRENCY}`);
  }
  const staggerDelay = accountIndex % ACCOUNT_CONCURRENCY * 5;
  if (staggerDelay > 0) {
    await new Promise((r) => setTimeout(r, staggerDelay));
  }
  while (isRunning && accState.isActive) {
    try {
      await accountSemaphore.acquire();
      if (accountIndex === 0 && stats.totalTrades === 0) {
        console.log(`[Worker ${config.workerId}] SEMAPHORE_ACQUIRED account=${accountIndex} available=${accountSemaphore.available}`);
      }
      try {
        let batchClean = true;
        if (Math.random() < config.fireAndForgetRatio) {
          await fireAndForgetBatch(accState);
        } else {
          batchClean = await executeBatchForAccount(accState);
        }
        if (!batchClean && !config.useOrderless) {
          await refreshSequenceNumber(accState);
        }
      } finally {
        accountSemaphore.release();
      }
      if (currentDelay > 0) {
        await new Promise((r) => setTimeout(r, currentDelay));
      }
      if (config.batchDelayMs > 0) {
        await new Promise((r) => setTimeout(r, config.batchDelayMs));
      }
    } catch (e) {
      try {
        accountSemaphore.release();
      } catch {
      }
      if (!config.useOrderless) {
        await refreshSequenceNumber(accState);
      }
      await new Promise((r) => setTimeout(r, 30));
    }
  }
}
function calculateTps() {
  const now = Date.now();
  const elapsed = (now - lastTpsCalcTime) / 1e3;
  if (elapsed > 0) {
    stats.currentTps = Math.round((stats.totalTrades - lastTpsCalcTrades) / elapsed);
  }
  lastTpsCalcTime = now;
  lastTpsCalcTrades = stats.totalTrades;
}
function reportStats() {
  calculateTps();
  stats.activeAccounts = accounts.filter((a) => a.isActive).length;
  if (parentPort) {
    parentPort.postMessage({
      type: "stats",
      data: stats
    });
  }
}
async function startTrading() {
  if (isRunning) return;
  console.log(`[Worker ${config.workerId}] Starting trading with ${accounts.length} accounts...`);
  console.log(`[Worker ${config.workerId}] Account concurrency: ${ACCOUNT_CONCURRENCY} (${accounts.length} accounts will cycle through ${ACCOUNT_CONCURRENCY} slots)`);
  isRunning = true;
  accountSemaphore = new Semaphore(ACCOUNT_CONCURRENCY);
  stats.totalTrades = 0;
  stats.successfulTrades = 0;
  stats.failedTrades = 0;
  stats.currentTps = 0;
  lastTpsCalcTime = Date.now();
  lastTpsCalcTrades = 0;
  firstErrorLogged = false;
  const statsInterval = setInterval(() => {
    if (!isRunning) {
      clearInterval(statsInterval);
      return;
    }
    reportStats();
  }, 1e3);
  const loopPromises = accounts.map((acc, i) => accountTradingLoop(acc, i));
  await Promise.all(loopPromises);
  clearInterval(statsInterval);
  console.log(`[Worker ${config.workerId}] Trading stopped`);
}
function stopTrading() {
  console.log(`[Worker ${config.workerId}] Stopping...`);
  isRunning = false;
  accounts.forEach((a) => a.isActive = false);
}
async function main() {
  try {
    await initialize();
    if (parentPort) {
      parentPort.postMessage({
        type: "ready",
        data: {
          workerId: config.workerId,
          accountCount: accounts.length
        }
      });
      parentPort.on("message", async (message) => {
        switch (message.type) {
          case "start":
            startTrading().catch((e) => {
              console.error(`[Worker ${config.workerId}] Trading error:`, e);
            });
            break;
          case "stop":
            stopTrading();
            break;
          case "stats":
            reportStats();
            break;
          case "getTxs":
            parentPort?.postMessage({
              type: "txs",
              data: {
                workerId: config.workerId,
                transactions: getRecordedTxs()
              }
            });
            break;
        }
      });
    }
  } catch (e) {
    console.error(`[Worker ${config.workerId}] Fatal error during initialization:`, e);
    if (parentPort) {
      parentPort.postMessage({
        type: "error",
        data: {
          workerId: config.workerId,
          error: e.message
        }
      });
    }
    process.exit(1);
  }
}
main();
