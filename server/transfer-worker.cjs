var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server/transfer-worker.ts
var import_worker_threads = require("worker_threads");
var import_ts_sdk2 = require("@aptos-labs/ts-sdk");

// config/seed-accounts.ts
var bip39 = __toESM(require("bip39"), 1);
var import_ts_sdk = require("@aptos-labs/ts-sdk");
var APTOS_COIN_TYPE = 637;
function validateMnemonic2(mnemonic) {
  return bip39.validateMnemonic(mnemonic);
}
function deriveAccount(mnemonic, index) {
  const path2 = `m/44'/${APTOS_COIN_TYPE}'/0'/0/${index}`;
  if (!(0, import_ts_sdk.isValidBIP44Path)(path2)) {
    throw new Error(`Invalid BIP-44 path: ${path2}`);
  }
  const seed = (0, import_ts_sdk.mnemonicToSeed)(mnemonic);
  const { key } = (0, import_ts_sdk.deriveKey)(path2, seed);
  const privateKey = new import_ts_sdk.Ed25519PrivateKey(key);
  return import_ts_sdk.Account.fromPrivateKey({ privateKey });
}
var DERIVATION_PATH_PREFIX = `m/44'/${APTOS_COIN_TYPE}'/0'/0`;

// lib/ralphy-collector.ts
var import_fs = __toESM(require("fs"), 1);
var import_path = __toESM(require("path"), 1);
var import_readline = __toESM(require("readline"), 1);
var RALPHY_DIR = ".ralphy";
var HASHES_DIR = import_path.default.join(RALPHY_DIR, "hashes");
var STATE_DIR = import_path.default.join(RALPHY_DIR, "state");
var ANALYTICS_DIR = import_path.default.join(RALPHY_DIR, "analytics");
var DEFAULT_CONFIG = {
  flushInterval: 100,
  // Flush every 100 records
  flushTimeoutMs: 1e3
  // Or every 1 second
};
var RalphyCollector = class {
  demoId = "";
  workerId;
  hashFile = "";
  writeStream = null;
  buffer = [];
  count = 0;
  flushTimer = null;
  config;
  initialized = false;
  constructor(config2 = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config2 };
    this.workerId = config2.workerId;
  }
  /**
   * Initialize for a new demo run
   */
  async init(demoId) {
    this.demoId = demoId;
    await this.ensureDirectories();
    const filename = this.workerId !== void 0 ? `${demoId}-worker-${this.workerId}.jsonl` : `${demoId}.jsonl`;
    this.hashFile = import_path.default.join(HASHES_DIR, filename);
    this.writeStream = import_fs.default.createWriteStream(this.hashFile, {
      flags: "a",
      encoding: "utf8"
    });
    this.flushTimer = setInterval(() => {
      this.flushBuffer();
    }, this.config.flushTimeoutMs);
    this.initialized = true;
  }
  /**
   * Ensure all Ralphy directories exist
   */
  async ensureDirectories() {
    const dirs = [RALPHY_DIR, HASHES_DIR, STATE_DIR, ANALYTICS_DIR];
    for (const dir of dirs) {
      if (!import_fs.default.existsSync(dir)) {
        import_fs.default.mkdirSync(dir, { recursive: true });
      }
    }
  }
  /**
   * Record a transaction hash (write-through to buffer, periodic flush to disk)
   */
  record(record) {
    if (!this.initialized) {
      throw new Error("Collector not initialized. Call init() first.");
    }
    this.buffer.push(record);
    this.count++;
    if (this.buffer.length >= this.config.flushInterval) {
      this.flushBuffer();
    }
  }
  /**
   * Flush buffer to disk
   */
  flushBuffer() {
    if (this.buffer.length === 0 || !this.writeStream) {
      return;
    }
    const lines = this.buffer.map((r) => JSON.stringify(r)).join("\n") + "\n";
    this.writeStream.write(lines);
    this.buffer = [];
  }
  /**
   * Force flush and close the stream
   */
  async flush() {
    this.flushBuffer();
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.writeStream) {
      await new Promise((resolve, reject) => {
        this.writeStream.end((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      this.writeStream = null;
    }
  }
  /**
   * Get all recorded hashes (async iterator for memory efficiency)
   */
  async *getHashes() {
    this.flushBuffer();
    if (!import_fs.default.existsSync(this.hashFile)) {
      return;
    }
    const fileStream = import_fs.default.createReadStream(this.hashFile, { encoding: "utf8" });
    const rl = import_readline.default.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });
    for await (const line of rl) {
      if (line.trim()) {
        try {
          yield JSON.parse(line);
        } catch {
        }
      }
    }
  }
  /**
   * Get all hashes as an array (loads into memory)
   */
  async getAllHashes() {
    const hashes = [];
    for await (const hash of this.getHashes()) {
      hashes.push(hash);
    }
    return hashes;
  }
  /**
   * Get count without loading all into memory
   */
  async getCount() {
    this.flushBuffer();
    if (!import_fs.default.existsSync(this.hashFile)) {
      return this.count;
    }
    let lineCount = 0;
    const fileStream = import_fs.default.createReadStream(this.hashFile, { encoding: "utf8" });
    const rl = import_readline.default.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });
    for await (const line of rl) {
      if (line.trim()) {
        lineCount++;
      }
    }
    return lineCount;
  }
  /**
   * Get demo ID
   */
  getDemoId() {
    return this.demoId;
  }
  /**
   * Get hash file path
   */
  getHashFile() {
    return this.hashFile;
  }
  /**
   * Check if initialized
   */
  isInitialized() {
    return this.initialized;
  }
};

// server/transfer-worker.ts
var colors = {
  reset: "\x1B[0m",
  dim: "\x1B[2m",
  bold: "\x1B[1m",
  green: "\x1B[32m",
  red: "\x1B[31m",
  yellow: "\x1B[33m",
  blue: "\x1B[34m",
  cyan: "\x1B[36m",
  magenta: "\x1B[35m",
  gray: "\x1B[90m"
};
var BUFFER_SIZE = 5e4;
var transferBuffer = [];
var bufferIndex = 0;
var ralphyCollector = null;
var batchCounter = 0;
var config = import_worker_threads.workerData;
var stats = {
  workerId: config.workerId,
  totalTransfers: 0,
  successfulTransfers: 0,
  failedTransfers: 0,
  currentTps: 0,
  accountCount: config.accountCount,
  activeAccounts: 0
};
var lastTpsCalcTime = Date.now();
var lastTpsCalcTransfers = 0;
var currentDelay = 0;
var consecutiveSuccess = 0;
var MEMPOOL_BACKOFF_MS = 50;
var MAX_DELAY_MS = 500;
var isRunning = false;
var aptos;
var accounts = [];
function shortAddr(addr) {
  return `${addr.slice(0, 6)}..${addr.slice(-4)}`;
}
function formatAmount(octas) {
  const apt = octas / 1e8;
  if (apt >= 1) return `${apt.toFixed(2)} APT`;
  if (apt >= 0.01) return `${apt.toFixed(4)} APT`;
  return `${octas} octas`;
}
function logTransfer(sender, recipient, amount, success, latencyMs, hash) {
  if (!config.verbose) return;
  const timestamp = (/* @__PURE__ */ new Date()).toISOString().slice(11, 23);
  const w = `W${config.workerId}`;
  const arrow = "\u2192";
  const status = success ? `${colors.green}\u2713${colors.reset}` : `${colors.red}\u2717${colors.reset}`;
  const amtStr = config.tokenType === "apt" ? formatAmount(amount) : `${amount / 1e8} USD1`;
  const latency = success ? `${colors.dim}${latencyMs}ms${colors.reset}` : "";
  console.log(
    `${colors.gray}[${timestamp}]${colors.reset} ${colors.cyan}${w}${colors.reset}  ${colors.blue}${shortAddr(sender)}${colors.reset} ${arrow} ${colors.magenta}${shortAddr(recipient)}${colors.reset}  ${amtStr}  ${status} ${latency}`
  );
}
function recordTransfer(record, accountIndex, error) {
  if (transferBuffer.length < BUFFER_SIZE) {
    transferBuffer.push(record);
  } else {
    transferBuffer[bufferIndex] = record;
    bufferIndex = (bufferIndex + 1) % BUFFER_SIZE;
  }
  if (ralphyCollector) {
    const txRecord = {
      hash: record.hash,
      sender: record.sender,
      recipient: record.recipient,
      amount: record.amount,
      submitTime: record.timestamp,
      submitSuccess: record.success,
      workerIndex: config.workerId,
      accountIndex,
      batchId: batchCounter,
      latencyMs: record.latencyMs,
      error
    };
    ralphyCollector.record(txRecord);
  }
}
function getRecordedTransfers() {
  if (transferBuffer.length < BUFFER_SIZE) {
    return [...transferBuffer];
  }
  return [
    ...transferBuffer.slice(bufferIndex),
    ...transferBuffer.slice(0, bufferIndex)
  ];
}
async function initialize() {
  console.log(
    `${colors.cyan}[Worker ${config.workerId}]${colors.reset} Initializing...`
  );
  console.log(
    `${colors.dim}  RPC: ${config.rpcEndpoint}${colors.reset}`
  );
  console.log(
    `${colors.dim}  Accounts: ${config.accountStartIndex} - ${config.accountStartIndex + config.accountCount - 1}${colors.reset}`
  );
  console.log(
    `${colors.dim}  Recipients: ${config.recipientStartIndex} - ${config.recipientStartIndex + config.accountCount - 1}${colors.reset}`
  );
  if (!validateMnemonic2(config.mnemonic)) {
    throw new Error("Invalid mnemonic");
  }
  const networkEnum = config.network === "mainnet" ? import_ts_sdk2.Network.MAINNET : import_ts_sdk2.Network.TESTNET;
  aptos = new import_ts_sdk2.Aptos(new import_ts_sdk2.AptosConfig({
    network: networkEnum,
    fullnode: config.rpcEndpoint
  }));
  console.log(
    `${colors.cyan}[Worker ${config.workerId}]${colors.reset} Deriving ${config.accountCount} account pairs...`
  );
  const startDerive = Date.now();
  for (let i = 0; i < config.accountCount; i++) {
    const senderIndex = config.accountStartIndex + i;
    const recipientIndex = config.recipientStartIndex + i;
    const senderAccount = deriveAccount(config.mnemonic, senderIndex);
    const recipientAccount = deriveAccount(config.mnemonic, recipientIndex);
    accounts.push({
      account: senderAccount,
      recipientAddress: recipientAccount.accountAddress.toString(),
      sequenceNumber: 0n,
      successCount: 0,
      failCount: 0,
      isActive: true,
      lastTxHash: "",
      accountIndex: senderIndex
    });
    if ((i + 1) % 100 === 0) {
      console.log(
        `${colors.dim}  Derived ${i + 1}/${config.accountCount} pairs${colors.reset}`
      );
    }
  }
  console.log(
    `${colors.green}[Worker ${config.workerId}]${colors.reset} Derived ${accounts.length} pairs in ${Date.now() - startDerive}ms`
  );
  if (!config.useOrderless) {
    console.log(
      `${colors.cyan}[Worker ${config.workerId}]${colors.reset} Fetching sequence numbers...`
    );
    const batchSize = 20;
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
  }
  stats.accountCount = accounts.length;
  stats.activeAccounts = accounts.filter((a) => a.isActive).length;
  if (config.demoId) {
    ralphyCollector = new RalphyCollector({
      workerId: config.workerId,
      flushInterval: 100,
      flushTimeoutMs: 1e3
    });
    await ralphyCollector.init(config.demoId);
    console.log(
      `${colors.cyan}[Worker ${config.workerId}]${colors.reset} Ralphy collector initialized: ${ralphyCollector.getHashFile()}`
    );
  }
  const modeStr = config.batchDelayMs === 0 ? `${colors.green}MaxLoad${colors.reset}` : `${config.batchDelayMs}ms delay`;
  console.log(
    `${colors.green}[Worker ${config.workerId}]${colors.reset} Ready with ${accounts.length} accounts (${modeStr}, ${config.workerJitterMs || 5e3}ms jitter)`
  );
}
function buildTransferPayload(recipientAddress, amount) {
  if (config.tokenType === "usd1" && config.usd1Metadata) {
    return {
      function: "0x1::primary_fungible_store::transfer",
      typeArguments: ["0x1::fungible_asset::Metadata"],
      functionArguments: [config.usd1Metadata, recipientAddress, amount]
    };
  }
  return {
    function: "0x1::aptos_account::transfer",
    functionArguments: [recipientAddress, amount]
  };
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
  if (!accState.isActive) return;
  const batchSize = config.batchSize;
  const startTime = Date.now();
  const baseSeq = accState.sequenceNumber;
  const senderAddr = accState.account.accountAddress.toString();
  const buildPromises = [];
  for (let i = 0; i < batchSize; i++) {
    const payload = buildTransferPayload(accState.recipientAddress, config.transferAmount);
    const options = config.useOrderless ? {
      replayProtectionNonce: BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)),
      expireTimestamp: Math.floor(Date.now() / 1e3) + 55
    } : {
      accountSequenceNumber: baseSeq + BigInt(i),
      expireTimestamp: Math.floor(Date.now() / 1e3) + 30
    };
    buildPromises.push(
      aptos.transaction.build.simple({
        sender: accState.account.accountAddress,
        data: payload,
        options: {
          ...options,
          maxGasAmount: 2e3,
          gasUnitPrice: 100
        }
      }).catch(() => null)
    );
  }
  const builtTxs = await Promise.all(buildPromises);
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
      return Promise.resolve({ success: false, error: "Build/sign failed", hash: "" });
    }
    const submitStart = Date.now();
    return aptos.transaction.submit.simple({
      transaction: tx,
      senderAuthenticator: signedTxs[i]
    }).then((result) => ({
      success: true,
      hash: result.hash,
      latencyMs: Date.now() - submitStart
    })).catch((e) => {
      const errMsg = e.message || "Unknown error";
      if (errMsg.includes("mempool_is_full")) {
        mempoolFull = true;
      } else if (errMsg.includes("sequence") || errMsg.includes("invalid_transaction_update")) {
        hasSequenceError = true;
      }
      return { success: false, error: errMsg, hash: "", latencyMs: Date.now() - submitStart };
    });
  });
  const results = await Promise.all(submitPromises);
  for (const result of results) {
    stats.totalTransfers++;
    if (result.success && result.hash) {
      successCount++;
      stats.successfulTransfers++;
      accState.successCount++;
      accState.lastTxHash = result.hash;
      const record = {
        hash: result.hash,
        timestamp: Date.now(),
        sender: senderAddr,
        recipient: accState.recipientAddress,
        amount: config.transferAmount,
        success: true,
        latencyMs: result.latencyMs || 0
      };
      recordTransfer(record, accState.accountIndex);
      logTransfer(
        senderAddr,
        accState.recipientAddress,
        config.transferAmount,
        true,
        result.latencyMs || 0,
        result.hash
      );
    } else {
      failCount++;
      stats.failedTransfers++;
      accState.failCount++;
      const failRecord = {
        hash: result.hash || "",
        timestamp: Date.now(),
        sender: senderAddr,
        recipient: accState.recipientAddress,
        amount: config.transferAmount,
        success: false,
        latencyMs: result.latencyMs || 0
      };
      recordTransfer(failRecord, accState.accountIndex, result.error);
      logTransfer(
        senderAddr,
        accState.recipientAddress,
        config.transferAmount,
        false,
        result.latencyMs || 0
      );
    }
  }
  if (!config.useOrderless) {
    accState.sequenceNumber += BigInt(successCount);
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
  if (hasSequenceError && !config.useOrderless) {
    refreshSequenceNumber(accState).catch(() => {
    });
  }
}
async function reliableTransfer(accState) {
  if (!accState.isActive) return;
  const senderAddr = accState.account.accountAddress.toString();
  const payload = buildTransferPayload(accState.recipientAddress, config.transferAmount);
  const submitStart = Date.now();
  try {
    const txn = await aptos.transaction.build.simple({
      sender: accState.account.accountAddress,
      data: payload,
      options: {
        accountSequenceNumber: accState.sequenceNumber,
        maxGasAmount: 2e3,
        gasUnitPrice: 100,
        expireTimestamp: Math.floor(Date.now() / 1e3) + 30
      }
    });
    const signedTxn = aptos.transaction.sign({ signer: accState.account, transaction: txn });
    const pendingTxn = await aptos.transaction.submit.simple({
      transaction: txn,
      senderAuthenticator: signedTxn
    });
    const result = await aptos.waitForTransaction({
      transactionHash: pendingTxn.hash,
      options: { timeoutSecs: 20 }
    });
    const latencyMs = Date.now() - submitStart;
    if (result.success) {
      stats.totalTransfers++;
      stats.successfulTransfers++;
      accState.successCount++;
      accState.sequenceNumber++;
      accState.lastTxHash = pendingTxn.hash;
      const record = {
        hash: pendingTxn.hash,
        timestamp: Date.now(),
        sender: senderAddr,
        recipient: accState.recipientAddress,
        amount: config.transferAmount,
        success: true,
        latencyMs
      };
      recordTransfer(record, accState.accountIndex);
      logTransfer(senderAddr, accState.recipientAddress, config.transferAmount, true, latencyMs, pendingTxn.hash);
    } else {
      stats.totalTransfers++;
      stats.failedTransfers++;
      accState.failCount++;
      const failRecord = {
        hash: pendingTxn.hash,
        timestamp: Date.now(),
        sender: senderAddr,
        recipient: accState.recipientAddress,
        amount: config.transferAmount,
        success: false,
        latencyMs
      };
      recordTransfer(failRecord, accState.accountIndex, "vm_execution_failed");
      logTransfer(senderAddr, accState.recipientAddress, config.transferAmount, false, latencyMs);
      await refreshSequenceNumber(accState);
    }
  } catch (e) {
    stats.totalTransfers++;
    stats.failedTransfers++;
    accState.failCount++;
    const latencyMs = Date.now() - submitStart;
    const failRecord = {
      hash: "",
      timestamp: Date.now(),
      sender: senderAddr,
      recipient: accState.recipientAddress,
      amount: config.transferAmount,
      success: false,
      latencyMs
    };
    recordTransfer(failRecord, accState.accountIndex, e.message);
    logTransfer(senderAddr, accState.recipientAddress, config.transferAmount, false, latencyMs);
    await refreshSequenceNumber(accState);
  }
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
    const payload = buildTransferPayload(accState.recipientAddress, config.transferAmount);
    const submitStart = Date.now();
    const options = config.useOrderless ? {
      replayProtectionNonce: BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)),
      expireTimestamp: Math.floor(Date.now() / 1e3) + 55
    } : {
      accountSequenceNumber: baseSeq + BigInt(i),
      expireTimestamp: Math.floor(Date.now() / 1e3) + 30
    };
    aptos.transaction.build.simple({
      sender: accState.account.accountAddress,
      data: payload,
      options: {
        ...options,
        maxGasAmount: 2e3,
        gasUnitPrice: 100
      }
    }).then((tx) => {
      const signedTx = aptos.transaction.sign({ signer: accState.account, transaction: tx });
      return aptos.transaction.submit.simple({ transaction: tx, senderAuthenticator: signedTx });
    }).then((result) => {
      stats.totalTransfers++;
      stats.successfulTransfers++;
      accState.successCount++;
      accState.lastTxHash = result.hash;
      const latencyMs = Date.now() - submitStart;
      recordTransfer({
        hash: result.hash,
        timestamp: Date.now(),
        sender: senderAddr,
        recipient: accState.recipientAddress,
        amount: config.transferAmount,
        success: true,
        latencyMs
      }, accState.accountIndex);
      logTransfer(senderAddr, accState.recipientAddress, config.transferAmount, true, latencyMs, result.hash);
    }).catch((e) => {
      stats.totalTransfers++;
      stats.failedTransfers++;
      accState.failCount++;
      const latencyMs = Date.now() - submitStart;
      recordTransfer({
        hash: "",
        timestamp: Date.now(),
        sender: senderAddr,
        recipient: accState.recipientAddress,
        amount: config.transferAmount,
        success: false,
        latencyMs
      }, accState.accountIndex, e.message);
      logTransfer(senderAddr, accState.recipientAddress, config.transferAmount, false, latencyMs);
    });
  }
}
async function accountTransferLoop(accState, accountIndex) {
  const jitterMs = config.workerJitterMs || 5e3;
  const staggerDelay = Math.floor(Math.random() * jitterMs) + accountIndex * 10;
  if (staggerDelay > 0) {
    await new Promise((r) => setTimeout(r, staggerDelay));
  }
  const isMaxLoadMode = config.batchDelayMs === 0;
  while (isRunning && accState.isActive) {
    try {
      batchCounter++;
      if (config.fireAndForgetRatio === 0) {
        await reliableTransfer(accState);
      } else if (Math.random() < config.fireAndForgetRatio) {
        await fireAndForgetBatch(accState);
      } else {
        await executeBatchForAccount(accState);
      }
      if (currentDelay > 0) {
        await new Promise((r) => setTimeout(r, currentDelay));
      }
      if (!isMaxLoadMode && config.batchDelayMs > 0) {
        await new Promise((r) => setTimeout(r, config.batchDelayMs));
      }
      if (isMaxLoadMode) {
        await new Promise((r) => setImmediate(r));
      }
    } catch {
      if (!config.useOrderless) {
        refreshSequenceNumber(accState).catch(() => {
        });
      }
      await new Promise((r) => setTimeout(r, 30));
    }
  }
}
function calculateTps() {
  const now = Date.now();
  const elapsed = (now - lastTpsCalcTime) / 1e3;
  if (elapsed > 0) {
    stats.currentTps = Math.round((stats.totalTransfers - lastTpsCalcTransfers) / elapsed);
  }
  lastTpsCalcTime = now;
  lastTpsCalcTransfers = stats.totalTransfers;
}
function reportStats() {
  calculateTps();
  stats.activeAccounts = accounts.filter((a) => a.isActive).length;
  if (import_worker_threads.parentPort) {
    import_worker_threads.parentPort.postMessage({
      type: "stats",
      data: stats
    });
  }
}
async function startTransfers() {
  if (isRunning) return;
  console.log(
    `${colors.green}[Worker ${config.workerId}]${colors.reset} Starting transfers with ${accounts.length} accounts...`
  );
  isRunning = true;
  stats.totalTransfers = 0;
  stats.successfulTransfers = 0;
  stats.failedTransfers = 0;
  stats.currentTps = 0;
  lastTpsCalcTime = Date.now();
  lastTpsCalcTransfers = 0;
  batchCounter = 0;
  const statsInterval = setInterval(() => {
    if (!isRunning) {
      clearInterval(statsInterval);
      return;
    }
    reportStats();
  }, 1e3);
  const loopPromises = accounts.map((acc, i) => accountTransferLoop(acc, i));
  await Promise.all(loopPromises);
  clearInterval(statsInterval);
  console.log(
    `${colors.yellow}[Worker ${config.workerId}]${colors.reset} Transfers stopped`
  );
}
async function stopTransfers() {
  console.log(
    `${colors.yellow}[Worker ${config.workerId}]${colors.reset} Stopping...`
  );
  isRunning = false;
  accounts.forEach((a) => a.isActive = false);
  if (ralphyCollector) {
    console.log(
      `${colors.cyan}[Worker ${config.workerId}]${colors.reset} Flushing Ralphy collector...`
    );
    await ralphyCollector.flush();
    console.log(
      `${colors.green}[Worker ${config.workerId}]${colors.reset} Ralphy collector flushed to ${ralphyCollector.getHashFile()}`
    );
  }
}
async function main() {
  try {
    await initialize();
    if (import_worker_threads.parentPort) {
      import_worker_threads.parentPort.postMessage({
        type: "ready",
        data: {
          workerId: config.workerId,
          accountCount: accounts.length
        }
      });
      import_worker_threads.parentPort.on("message", async (message) => {
        switch (message.type) {
          case "start":
            startTransfers().catch((e) => {
              console.error(`[Worker ${config.workerId}] Transfer error:`, e);
            });
            break;
          case "stop":
            await stopTransfers();
            break;
          case "stats":
            reportStats();
            break;
          case "getTransfers":
            import_worker_threads.parentPort?.postMessage({
              type: "transfers",
              data: {
                workerId: config.workerId,
                transfers: getRecordedTransfers()
              }
            });
            break;
        }
      });
    }
  } catch (e) {
    console.error(
      `${colors.red}[Worker ${config.workerId}]${colors.reset} Fatal error:`,
      e.message
    );
    if (import_worker_threads.parentPort) {
      import_worker_threads.parentPort.postMessage({
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
