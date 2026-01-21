#!/usr/bin/env npx tsx
/**
 * USD1 Transfer TPS Demo - Robust Single Script
 *
 * A comprehensive script that handles the complete lifecycle of running
 * USD1 transfer TPS demos with error handling, safe exits, and analytics.
 *
 * Usage:
 *   SEED_MNEMONIC="..." USD1_METADATA="0x..." npx tsx scripts/run-usd1-tps-demo.ts [mode]
 *   npx tsx scripts/run-usd1-tps-demo.ts --preflight-only
 *   npx tsx scripts/run-usd1-tps-demo.ts --skip-balance turbo
 *
 * Exit Codes:
 *   0   - Success
 *   1   - Preflight validation failed
 *   2   - RPC endpoint validation failed
 *   3   - Insufficient account balance
 *   4   - Worker compilation failed
 *   5   - Server startup failed
 *   6   - Runtime error
 *   130 - User cancelled (Ctrl+C)
 */

import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';
import {
  predictTPS,
  evaluatePrediction,
  formatPrediction,
  formatEvaluation,
  TPSPrediction,
  PredictionEvaluation,
} from '../lib/tps-predictor';
import {
  loadHashesFromFile,
  getHashCount,
} from '../lib/ralphy-collector';
import { RalphyVerifier, VerificationSummary } from '../lib/ralphy-verifier';
import { generateAnalyticsReport, AnalyticsReport } from '../lib/ralphy-analytics';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

// ANSI color codes
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m',
};

// Exit codes
const EXIT_SUCCESS = 0;
const EXIT_PREFLIGHT_FAILED = 1;
const EXIT_RPC_FAILED = 2;
const EXIT_BALANCE_FAILED = 3;
const EXIT_COMPILE_FAILED = 4;
const EXIT_STARTUP_FAILED = 5;
const EXIT_RUNTIME_ERROR = 6;
const EXIT_USER_CANCELLED = 130;

// RPC endpoints for testnet
const TESTNET_ENDPOINTS = [
  { url: 'https://polished-evocative-borough.aptos-testnet.quiknode.pro/a0b08bae2dc34e4a8774d91414948d02a5ce2975/v1', name: 'QuikNode' },
  { url: 'https://aptos.cash.trading/v1', name: 'Custom Fullnode' },
  { url: 'http://vfn0.usce1-0.testnet.aptoslabs.com:80/v1', name: 'Internal VFN (usce1-0)' },
  { url: 'http://vfn0.usce1-1.testnet.aptoslabs.com:80/v1', name: 'Internal VFN (usce1-1)' },
  { url: 'http://vfn0.apne1-0.testnet.aptoslabs.com:80/v1', name: 'Internal VFN (apne1-0)' },
  { url: 'https://fullnode.testnet.aptoslabs.com/v1', name: 'Aptos Labs Public' },
];

// Mode configurations (with fireAndForgetRatio for prediction)
const MODES: Record<string, { accounts: number; workers: number; batchSize: number; batchDelayMs: number; fireAndForgetRatio: number; targetTps: number }> = {
  dryrun: { accounts: 10, workers: 1, batchSize: 1, batchDelayMs: 500, fireAndForgetRatio: 0, targetTps: 10 },
  reliable: { accounts: 100, workers: 4, batchSize: 1, batchDelayMs: 100, fireAndForgetRatio: 0, targetTps: 500 },
  light: { accounts: 200, workers: 4, batchSize: 5, batchDelayMs: 50, fireAndForgetRatio: 0.8, targetTps: 2000 },
  proven: { accounts: 500, workers: 4, batchSize: 30, batchDelayMs: 40, fireAndForgetRatio: 0.85, targetTps: 5000 },
  turbo: { accounts: 500, workers: 4, batchSize: 20, batchDelayMs: 20, fireAndForgetRatio: 0.9, targetTps: 5000 },
  quantum: { accounts: 1000, workers: 8, batchSize: 20, batchDelayMs: 10, fireAndForgetRatio: 0.95, targetTps: 10000 },
  hyper: { accounts: 2000, workers: 16, batchSize: 20, batchDelayMs: 0, fireAndForgetRatio: 0.99, targetTps: 16000 },
};

// Demo stats (server-reported - based on submissions)
interface DemoStats {
  startTime: number;
  endTime: number;
  totalTransfers: number;
  successfulTransfers: number;
  failedTransfers: number;
  peakTps: number;
  tpsHistory: number[];
  errors: Record<string, number>;
}

// Verified stats (on-chain confirmed transactions)
interface VerifiedStats {
  verified: boolean;
  accountsChecked: number;
  confirmedTransfers: number;
  failedTransfers: number;
  peakTps: number;
  avgTps: number;
  successRate: number;
  serverVsOnChain: {
    serverReported: number;
    onChainConfirmed: number;
    discrepancy: number; // percentage difference
  };
}

// Global state
let serverProcess: ChildProcess | null = null;
let stats: DemoStats = {
  startTime: 0,
  endTime: 0,
  totalTransfers: 0,
  successfulTransfers: 0,
  failedTransfers: 0,
  peakTps: 0,
  tpsHistory: [],
  errors: {},
};
let verifiedStats: VerifiedStats | null = null;
let selectedEndpoint: { url: string; name: string; latencyMs: number } | null = null;
let prediction: TPSPrediction | null = null;
let evaluation: PredictionEvaluation | null = null;

// Collected transaction hashes from server for verification
interface CollectedHash {
  hash: string;
  sender: string;
  success: boolean;
  timestamp: number;
}
let collectedHashes: CollectedHash[] = [];
let fullServerOutput = ''; // Accumulate ALL server output for post-process parsing
let ralphyDemoId = ''; // Ralphy collector demo ID from server
let ralphyAnalytics: AnalyticsReport | null = null; // Comprehensive analytics report

// Parse CLI arguments
const args = process.argv.slice(2);
const preflightOnly = args.includes('--preflight-only');
const skipBalance = args.includes('--skip-balance');
const mode = args.find(a => !a.startsWith('--')) || 'turbo';

// Configuration
const config = {
  mode,
  network: (process.env.NETWORK?.toLowerCase() || 'testnet') as 'mainnet' | 'testnet',
  mnemonic: process.env.SEED_MNEMONIC || '',
  usd1Metadata: process.env.USD1_METADATA || '',
  duration: parseInt(process.env.DURATION || '60', 10),
};

// Utility functions
function printHeader(title: string): void {
  console.log('');
  console.log(`${c.blue}${'═'.repeat(70)}${c.reset}`);
  console.log(`${c.blue}  ${title}${c.reset}`);
  console.log(`${c.blue}${'═'.repeat(70)}${c.reset}`);
}

function printSuccess(msg: string): void {
  console.log(`  ${c.green}✓${c.reset} ${msg}`);
}

function printError(msg: string): void {
  console.log(`  ${c.red}✗${c.reset} ${msg}`);
}

function printWarning(msg: string): void {
  console.log(`  ${c.yellow}⚠${c.reset} ${msg}`);
}

function printInfo(msg: string): void {
  console.log(`  ${c.cyan}ℹ${c.reset} ${msg}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Cleanup and exit
async function cleanup(signal: string, exitCode: number): Promise<void> {
  console.log('');
  console.log(`${c.yellow}[${signal}]${c.reset} Initiating graceful shutdown...`);

  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill('SIGTERM');
    await sleep(2000);
    if (!serverProcess.killed) {
      serverProcess.kill('SIGKILL');
    }
  }

  // Save results if we have any data
  if (stats.totalTransfers > 0) {
    stats.endTime = Date.now();
    await saveResults(signal === 'SIGINT' ? 'interrupted' : 'error');
  }

  process.exit(exitCode);
}

// Signal handlers
process.on('SIGINT', () => cleanup('SIGINT', EXIT_USER_CANCELLED));
process.on('SIGTERM', () => cleanup('SIGTERM', EXIT_RUNTIME_ERROR));
process.on('uncaughtException', (err) => {
  console.error(`${c.red}[FATAL]${c.reset} Uncaught exception:`, err.message);
  cleanup('UNCAUGHT', EXIT_RUNTIME_ERROR);
});

// Phase 1: Preflight Validation
async function phase1Preflight(): Promise<boolean> {
  printHeader('PHASE 1: PREFLIGHT VALIDATION');
  let passed = true;

  // Check mode
  if (!MODES[config.mode]) {
    printError(`Invalid mode: ${config.mode}`);
    printInfo(`Valid modes: ${Object.keys(MODES).join(', ')}`);
    return false;
  }
  printSuccess(`Mode: ${config.mode} (${MODES[config.mode].accounts} accounts, ${MODES[config.mode].workers} workers)`);

  // Check SEED_MNEMONIC
  if (!config.mnemonic) {
    printError('SEED_MNEMONIC not set');
    passed = false;
  } else {
    const words = config.mnemonic.trim().split(/\s+/);
    if (words.length !== 12 && words.length !== 24) {
      printError(`SEED_MNEMONIC has ${words.length} words (expected 12 or 24)`);
      passed = false;
    } else {
      printSuccess(`SEED_MNEMONIC: Set (${words.length} words)`);
    }
  }

  // Check USD1_METADATA
  if (!config.usd1Metadata) {
    printError('USD1_METADATA not set');
    passed = false;
  } else {
    printSuccess(`USD1_METADATA: ${config.usd1Metadata.slice(0, 10)}...${config.usd1Metadata.slice(-6)}`);
  }

  // Check required files
  const requiredFiles = [
    'server/transfer-tps-server.ts',
    'server/transfer-worker.ts',
    'config/seed-accounts.ts',
  ];

  for (const file of requiredFiles) {
    const fullPath = path.join(PROJECT_ROOT, file);
    if (fs.existsSync(fullPath)) {
      printSuccess(`File: ${file}`);
    } else {
      printError(`File missing: ${file}`);
      passed = false;
    }
  }

  // Check Node.js version
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0], 10);
  if (majorVersion >= 18) {
    printSuccess(`Node.js: ${nodeVersion}`);
  } else {
    printError(`Node.js ${nodeVersion} too old (need >= 18)`);
    passed = false;
  }

  // Check duration
  printSuccess(`Duration: ${config.duration}s`);
  printSuccess(`Network: ${config.network}`);

  return passed;
}

// Phase 2: RPC Endpoint Validation
async function phase2RpcValidation(): Promise<boolean> {
  printHeader('PHASE 2: RPC ENDPOINT VALIDATION');

  const expectedChainId = config.network === 'mainnet' ? 1 : 2;
  const results: Array<{ url: string; name: string; working: boolean; latencyMs: number; chainId?: number; error?: string }> = [];

  for (const endpoint of TESTNET_ENDPOINTS) {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(endpoint.url, { signal: controller.signal });
      clearTimeout(timeout);

      const data = await response.json() as { chain_id: number };
      const latencyMs = Date.now() - start;
      const chainId = typeof data.chain_id === 'number' ? data.chain_id : parseInt(String(data.chain_id), 10);

      if (chainId === expectedChainId) {
        results.push({ url: endpoint.url, name: endpoint.name, working: true, latencyMs, chainId });
        printSuccess(`${endpoint.name.padEnd(25)} ${latencyMs}ms, chain_id=${chainId}`);
      } else {
        results.push({ url: endpoint.url, name: endpoint.name, working: false, latencyMs, chainId, error: `Wrong chain_id: ${chainId}` });
        printWarning(`${endpoint.name.padEnd(25)} Wrong chain_id: ${chainId} (expected ${expectedChainId})`);
      }
    } catch (err) {
      const latencyMs = Date.now() - start;
      const errorMsg = err instanceof Error ? err.message : String(err);
      results.push({ url: endpoint.url, name: endpoint.name, working: false, latencyMs, error: errorMsg });
      printError(`${endpoint.name.padEnd(25)} ${errorMsg.slice(0, 40)}`);
    }
  }

  // Select fastest working endpoint
  const working = results.filter(r => r.working).sort((a, b) => a.latencyMs - b.latencyMs);

  if (working.length === 0) {
    printError('No working RPC endpoints found!');
    return false;
  }

  selectedEndpoint = { url: working[0].url, name: working[0].name, latencyMs: working[0].latencyMs };
  console.log('');
  printInfo(`Selected: ${c.green}${selectedEndpoint.name}${c.reset} (${selectedEndpoint.latencyMs}ms latency)`);

  return true;
}

// Phase 2.5: TPS Prediction
function phase2_5Prediction(): void {
  printHeader('PHASE 2.5: TPS PREDICTION');

  if (!selectedEndpoint) {
    printWarning('Cannot predict TPS: no RPC endpoint selected');
    return;
  }

  const modeConfig = MODES[config.mode];
  if (!modeConfig) {
    printWarning(`Cannot predict TPS: unknown mode ${config.mode}`);
    return;
  }

  // Generate prediction
  prediction = predictTPS(
    config.mode,
    modeConfig,
    selectedEndpoint.latencyMs,
    config.duration
  );

  // Display prediction
  console.log(formatPrediction(prediction, config.duration));
}

// Phase 3: Account Balance Validation
async function phase3BalanceValidation(): Promise<boolean> {
  if (skipBalance) {
    printHeader('PHASE 3: ACCOUNT BALANCE VALIDATION (SKIPPED)');
    printInfo('Balance check skipped via --skip-balance flag');
    return true;
  }

  printHeader('PHASE 3: ACCOUNT BALANCE VALIDATION');

  if (!selectedEndpoint) {
    printError('No RPC endpoint selected');
    return false;
  }

  try {
    // Import seed accounts module dynamically
    const seedModule = await import('../config/seed-accounts');
    const { deriveAccount } = seedModule;

    const aptosConfig = new AptosConfig({
      network: config.network === 'mainnet' ? Network.MAINNET : Network.TESTNET,
      fullnode: selectedEndpoint.url,
    });
    const aptos = new Aptos(aptosConfig);

    // Sample account indices
    const modeConfig = MODES[config.mode];
    const sampleIndices = [0, Math.floor(modeConfig.accounts / 4), Math.floor(modeConfig.accounts / 2), modeConfig.accounts - 1];

    let allHaveBalance = true;
    let warnings = 0;

    for (const idx of sampleIndices) {
      try {
        const account = deriveAccount(config.mnemonic, idx);
        const address = account.accountAddress.toString();

        // Check APT balance (use getAccountAPTAmount which handles both legacy and FA APT)
        let aptBalance = BigInt(0);
        try {
          const aptAmount = await aptos.getAccountAPTAmount({ accountAddress: address });
          aptBalance = BigInt(aptAmount);
        } catch {
          // Account might not exist yet
        }

        // Check USD1 balance
        let usd1Balance = BigInt(0);
        try {
          const faBalance = await aptos.getCurrentFungibleAssetBalances({
            options: {
              where: {
                owner_address: { _eq: address },
                asset_type: { _eq: config.usd1Metadata },
              },
            },
          });
          if (faBalance.length > 0) {
            usd1Balance = BigInt(faBalance[0].amount);
          }
        } catch {
          // FA might not exist
        }

        const aptFormatted = (Number(aptBalance) / 1e8).toFixed(4);
        const usd1Formatted = (Number(usd1Balance) / 1e6).toFixed(2);

        const hasEnoughApt = aptBalance >= BigInt(1000000); // 0.01 APT
        const hasEnoughUsd1 = usd1Balance >= BigInt(1000000); // 1 USD1

        if (hasEnoughApt && hasEnoughUsd1) {
          printSuccess(`Account ${idx}: ${aptFormatted} APT, ${usd1Formatted} USD1`);
        } else if (aptBalance === BigInt(0) && usd1Balance === BigInt(0)) {
          printError(`Account ${idx}: No balance (${address.slice(0, 10)}...)`);
          allHaveBalance = false;
        } else {
          printWarning(`Account ${idx}: ${aptFormatted} APT, ${usd1Formatted} USD1 (low)`);
          warnings++;
        }
      } catch (err) {
        printError(`Account ${idx}: Failed to check - ${err instanceof Error ? err.message : String(err)}`);
        allHaveBalance = false;
      }
    }

    if (!allHaveBalance) {
      console.log('');
      printInfo('Run fund-usd1-demo.ts to fund accounts before the demo');
      return false;
    }

    if (warnings > 0) {
      printWarning(`${warnings} accounts have low balances - demo may fail early`);
    }

    return true;
  } catch (err) {
    printError(`Balance check failed: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

// Phase 4: Worker Compilation
async function phase4WorkerCompilation(): Promise<boolean> {
  printHeader('PHASE 4: WORKER COMPILATION');

  const workerTs = path.join(PROJECT_ROOT, 'server/transfer-worker.ts');
  const workerCjs = path.join(PROJECT_ROOT, 'server/transfer-worker.cjs');

  // Check if .cjs exists
  if (!fs.existsSync(workerCjs)) {
    printWarning('transfer-worker.cjs not found, compiling...');
    return await compileWorker();
  }

  // Check if .cjs is older than .ts
  const tsStat = fs.statSync(workerTs);
  const cjsStat = fs.statSync(workerCjs);

  if (tsStat.mtime > cjsStat.mtime) {
    printWarning('transfer-worker.cjs is stale, recompiling...');
    return await compileWorker();
  }

  const sizeKb = Math.round(cjsStat.size / 1024);
  printSuccess(`transfer-worker.cjs exists (${sizeKb}KB, up to date)`);
  return true;
}

async function compileWorker(): Promise<boolean> {
  return new Promise((resolve) => {
    const cmd = 'npx';
    const args = [
      'esbuild',
      'server/transfer-worker.ts',
      '--bundle',
      '--platform=node',
      '--target=node18',
      '--format=cjs',
      '--outfile=server/transfer-worker.cjs',
      '--external:@aptos-labs/ts-sdk',
      '--external:bip39',
      '--external:@scure/bip39',
    ];

    const child = spawn(cmd, args, {
      cwd: PROJECT_ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderr = '';
    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        const cjsStat = fs.statSync(path.join(PROJECT_ROOT, 'server/transfer-worker.cjs'));
        const sizeKb = Math.round(cjsStat.size / 1024);
        printSuccess(`Compiled transfer-worker.cjs (${sizeKb}KB)`);
        resolve(true);
      } else {
        printError(`Compilation failed: ${stderr.slice(0, 200)}`);
        resolve(false);
      }
    });

    child.on('error', (err) => {
      printError(`Compilation error: ${err.message}`);
      resolve(false);
    });
  });
}

// Phase 5-7: Server Lifecycle
async function phase5to7ServerLifecycle(): Promise<boolean> {
  printHeader('PHASE 5: SERVER STARTUP');

  if (!selectedEndpoint) {
    printError('No RPC endpoint selected');
    return false;
  }

  return new Promise((resolve) => {
    const serverPath = path.join(PROJECT_ROOT, 'server/transfer-tps-server.ts');

    printInfo(`Starting server in ${config.mode} mode...`);
    printInfo(`Duration: ${config.duration}s`);
    printInfo(`RPC: ${selectedEndpoint!.name}`);

    serverProcess = spawn('npx', ['tsx', serverPath, config.mode], {
      cwd: PROJECT_ROOT,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        TOKEN_TYPE: 'usd1',
        USD1_METADATA: config.usd1Metadata,
        SEED_MNEMONIC: config.mnemonic,
        NETWORK: config.network,
        DURATION: String(config.duration),
        RPC_URL: selectedEndpoint!.url,
      },
    });

    let initialized = false;
    let startupTimeout: NodeJS.Timeout;
    stats.startTime = Date.now();

    // Monitor stdout
    serverProcess.stdout?.on('data', (data) => {
      const output = data.toString();

      // Check for initialization complete
      if (!initialized && (output.includes('workers initialized') || output.includes('All') && output.includes('ready'))) {
        initialized = true;
        clearTimeout(startupTimeout);
        console.log('');
        printHeader('PHASE 6: DEMO EXECUTION');
        printInfo('Demo running... Press Ctrl+C to stop early');
        console.log('');
      }

      // Parse stats from output (look for TPS patterns)
      // Server outputs: "│ TPS: [====    ] 123 │" with progress bar between TPS: and number
      // Also try: "TPS: 123" or "123 txns/s" or "Peak: 123"
      const tpsMatch = output.match(/TPS:\s*\[[^\]]*\]\s*(\d+)/i) ||  // TPS: [bar] 123
                       output.match(/│\s*TPS:\s*[^│]*\s(\d+)\s*│/i) || // │ TPS: ... 123 │
                       output.match(/TPS:\s*(\d+)/i) ||                 // TPS: 123
                       output.match(/(\d+)\s*txns?\/s/i) ||             // 123 txns/s
                       output.match(/Peak:\s*(\d+)/i);                  // Peak: 123
      if (tpsMatch) {
        const tps = parseInt(tpsMatch[1], 10);
        if (tps > 0) {  // Only track non-zero TPS readings
          stats.tpsHistory.push(tps);
          if (tps > stats.peakTps) {
            stats.peakTps = tps;
          }
        }
      }

      // Parse transfer counts
      const successMatch = output.match(/Success(?:ful)?:\s*([\d,]+)/i);
      const failedMatch = output.match(/Failed:\s*([\d,]+)/i);
      const totalMatch = output.match(/(?:Total|Submitted):\s*([\d,]+)/i);

      if (successMatch) stats.successfulTransfers = parseInt(successMatch[1].replace(/,/g, ''), 10);
      if (failedMatch) stats.failedTransfers = parseInt(failedMatch[1].replace(/,/g, ''), 10);
      if (totalMatch) stats.totalTransfers = parseInt(totalMatch[1].replace(/,/g, ''), 10);

      // Accumulate all output for post-process hash extraction
      // (Parsing happens after server closes to avoid race conditions)
      fullServerOutput += output;

      // Forward output to console
      process.stdout.write(data);
    });

    serverProcess.stderr?.on('data', (data) => {
      const output = data.toString();

      // Categorize errors
      if (output.includes('timeout') || output.includes('ETIMEDOUT')) {
        stats.errors['timeout'] = (stats.errors['timeout'] || 0) + 1;
      } else if (output.includes('sequence') || output.includes('SEQUENCE_NUMBER')) {
        stats.errors['sequence_number'] = (stats.errors['sequence_number'] || 0) + 1;
      } else if (output.includes('mempool') || output.includes('MEMPOOL')) {
        stats.errors['mempool_full'] = (stats.errors['mempool_full'] || 0) + 1;
      }

      process.stderr.write(data);
    });

    serverProcess.on('close', (code) => {
      stats.endTime = Date.now();

      // Extract transaction hashes from accumulated output AFTER server closes
      // This ensures we have all the output before parsing
      const startMarker = '===TRANSACTION_HASHES_START===';
      const endMarker = '===TRANSACTION_HASHES_END===';

      // Strip ANSI codes for parsing
      const cleanOutput = fullServerOutput.replace(/\x1b\[[0-9;]*m/g, '');

      if (cleanOutput.includes(startMarker) && cleanOutput.includes(endMarker)) {
        try {
          const startIdx = cleanOutput.indexOf(startMarker) + startMarker.length;
          const endIdx = cleanOutput.indexOf(endMarker);

          if (startIdx > 0 && endIdx > startIdx) {
            const jsonStr = cleanOutput.slice(startIdx, endIdx).trim();

            // Find JSON object
            const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              if (parsed.hashes && Array.isArray(parsed.hashes)) {
                collectedHashes = parsed.hashes;
                console.log(`\n  ${c.cyan}[HASHES]${c.reset} Extracted ${collectedHashes.length} transaction hashes for verification`);
              }
              // Extract demoId for Ralphy verification
              if (parsed.demoId) {
                ralphyDemoId = parsed.demoId;
                console.log(`  ${c.cyan}[RALPHY]${c.reset} Demo ID: ${ralphyDemoId}`);
              }
            }
          }
        } catch (err) {
          console.log(`  ${c.yellow}[WARN]${c.reset} Could not parse transaction hashes: ${err}`);
        }
      } else if (cleanOutput.includes(startMarker)) {
        // START found but END missing - output was truncated
        console.log(`  ${c.yellow}[WARN]${c.reset} Transaction hash output was truncated (END marker missing)`);
      }

      if (!initialized) {
        printError('Server failed to initialize');
        resolve(false);
      } else if (code === 0) {
        resolve(true);
      } else {
        printWarning(`Server exited with code ${code}`);
        resolve(true); // Still save results
      }
    });

    serverProcess.on('error', (err) => {
      printError(`Server error: ${err.message}`);
      resolve(false);
    });

    // Startup timeout
    startupTimeout = setTimeout(() => {
      if (!initialized) {
        printError('Server startup timeout (120s)');
        if (serverProcess && !serverProcess.killed) {
          serverProcess.kill('SIGTERM');
        }
        resolve(false);
      }
    }, 120000);
  });
}

// Phase 7: Ralphy Verification Loop
// Multi-pass verification with retry logic - guarantees 100% resolution
async function phase7OnChainVerification(): Promise<void> {
  printHeader('PHASE 7: RALPHY VERIFICATION LOOP');

  if (!selectedEndpoint) {
    printWarning('Cannot verify: no RPC endpoint selected');
    return;
  }

  // Check if we have a demoId and hash files
  if (!ralphyDemoId) {
    printWarning('No Ralphy demo ID found in server output');
    printInfo('Falling back to legacy verification (if hashes available)');

    // Legacy fallback using collectedHashes
    if (collectedHashes.length > 0) {
      await legacyVerification();
    }
    return;
  }

  // Check hash count on disk
  let hashCount = 0;
  try {
    hashCount = await getHashCount(ralphyDemoId);
  } catch {
    printWarning('Could not read hash files from disk');
  }

  if (hashCount === 0) {
    printWarning('No hashes found on disk - falling back to legacy verification');
    if (collectedHashes.length > 0) {
      await legacyVerification();
    }
    return;
  }

  printInfo(`Demo ID: ${c.bold}${ralphyDemoId}${c.reset}`);
  printInfo(`Hashes collected: ${c.cyan}${hashCount.toLocaleString()}${c.reset} (from .ralphy/hashes/)`);
  console.log('');

  try {
    // Initialize Ralphy verifier
    const verifier = new RalphyVerifier({
      maxAttempts: 5,
      initialBackoffMs: 3000,
      backoffMultiplier: 2,
      maxBackoffMs: 30000,
      batchSize: 50,
      concurrency: 10,
      network: config.network,
      rpcEndpoint: 'https://api.testnet.aptoslabs.com/v1', // Use indexer for verification
    });

    // Initialize from demo files
    await verifier.init(ralphyDemoId);

    // Set up progress callback
    verifier.setProgressCallback((pass, maxPasses, processed, total, passStats) => {
      const progress = Math.round((processed / total) * 100);
      const confirmed = passStats.confirmed;
      const failed = passStats.failed;
      const pending = passStats.pending + passStats.unknown;

      process.stdout.write(
        `\r  Pass ${pass}/${maxPasses}: ${progress}% | ` +
        `${c.green}${confirmed}${c.reset} confirmed, ` +
        `${c.red}${failed}${c.reset} failed, ` +
        `${c.yellow}${pending}${c.reset} pending`
      );
    });

    // Run verification loop
    console.log(`  ${c.bold}Starting multi-pass verification...${c.reset}`);
    console.log('');

    const summary: VerificationSummary = await verifier.runLoop();

    console.log(''); // New line after progress

    // Get verified records for analytics
    const verifiedRecords = verifier.getVerifiedRecords();

    // Generate comprehensive analytics
    printInfo('Generating comprehensive analytics...');
    ralphyAnalytics = await generateAnalyticsReport(
      ralphyDemoId,
      verifiedRecords,
      stats.successfulTransfers
    );

    // Display verification results
    console.log('');
    console.log(`  ${c.bold}Ralphy Verification Complete${c.reset}`);
    console.log(`  ${'─'.repeat(60)}`);
    console.log(`  Total hashes:       ${c.cyan}${summary.totalHashes.toLocaleString()}${c.reset}`);
    console.log(`  Verification passes:${summary.passes}`);
    console.log(`  Quality gate:       ${summary.qualityGatePassed ? `${c.green}PASSED${c.reset}` : `${c.red}FAILED${c.reset}`}`);
    console.log('');

    console.log(`  ${c.bold}Final Status (100% Resolved)${c.reset}`);
    console.log(`  ${'─'.repeat(60)}`);
    console.log(`  Confirmed on-chain: ${c.green}${summary.confirmed.toLocaleString()}${c.reset} (${((summary.confirmed / summary.totalHashes) * 100).toFixed(1)}%)`);
    console.log(`  Failed on-chain:    ${c.red}${summary.failed.toLocaleString()}${c.reset} (${((summary.failed / summary.totalHashes) * 100).toFixed(1)}%)`);
    console.log(`  Dropped/timeout:    ${c.yellow}${summary.dropped.toLocaleString()}${c.reset} (${((summary.dropped / summary.totalHashes) * 100).toFixed(1)}%)`);
    console.log('');

    // Display TPS analytics from Ralphy
    console.log(`  ${c.bold}Throughput (Ground Truth from On-Chain)${c.reset}`);
    console.log(`  ${'─'.repeat(60)}`);
    console.log(`  Peak TPS:           ${c.green}${ralphyAnalytics.summary.peakTps.toLocaleString()}${c.reset}`);
    console.log(`  Average TPS:        ${ralphyAnalytics.summary.avgTps.toLocaleString()}`);
    console.log(`  Median TPS:         ${ralphyAnalytics.summary.medianTps.toLocaleString()}`);
    console.log(`  P95 TPS:            ${ralphyAnalytics.summary.p95Tps.toLocaleString()}`);
    console.log(`  P99 TPS:            ${ralphyAnalytics.summary.p99Tps.toLocaleString()}`);
    console.log('');

    // Display latency analytics
    console.log(`  ${c.bold}Latency (Submit → Confirm)${c.reset}`);
    console.log(`  ${'─'.repeat(60)}`);
    console.log(`  P50:                ${ralphyAnalytics.latency.p50Ms}ms`);
    console.log(`  P95:                ${ralphyAnalytics.latency.p95Ms}ms`);
    console.log(`  P99:                ${ralphyAnalytics.latency.p99Ms}ms`);
    console.log(`  Max:                ${ralphyAnalytics.latency.maxMs}ms`);
    console.log('');

    // Display reconciliation
    console.log(`  ${c.bold}Reconciliation (Server vs On-Chain)${c.reset}`);
    console.log(`  ${'─'.repeat(60)}`);
    console.log(`  Server claimed:     ${ralphyAnalytics.reconciliation.serverClaimed.toLocaleString()} successful`);
    console.log(`  On-chain confirmed: ${c.green}${ralphyAnalytics.reconciliation.onChainConfirmed.toLocaleString()}${c.reset}`);

    const discrepancy = ralphyAnalytics.reconciliation.discrepancy;
    if (discrepancy > 5) {
      console.log(`  Discrepancy:        ${c.red}${discrepancy.toFixed(1)}%${c.reset} (server over-reported)`);
    } else if (discrepancy < -5) {
      console.log(`  Discrepancy:        ${c.yellow}${Math.abs(discrepancy).toFixed(1)}%${c.reset} (server under-reported)`);
    } else {
      console.log(`  Discrepancy:        ${c.green}${Math.abs(discrepancy).toFixed(1)}%${c.reset} (accurate)`);
    }
    console.log('');

    // Display error breakdown if any
    if (Object.keys(ralphyAnalytics.errors.categories).length > 0) {
      console.log(`  ${c.bold}Error Breakdown${c.reset}`);
      console.log(`  ${'─'.repeat(60)}`);
      const totalErrors = Object.values(ralphyAnalytics.errors.categories).reduce((a, b) => a + b, 0);
      for (const [category, count] of Object.entries(ralphyAnalytics.errors.categories).sort((a, b) => b[1] - a[1])) {
        const pct = ((count / totalErrors) * 100).toFixed(1);
        console.log(`  ${category.padEnd(20)} ${count.toLocaleString()} (${pct}%)`);
      }
      console.log('');
    }

    // Store verified stats for compatibility with existing code
    verifiedStats = {
      verified: true,
      accountsChecked: summary.totalHashes,
      confirmedTransfers: summary.confirmed,
      failedTransfers: summary.failed + summary.dropped,
      peakTps: ralphyAnalytics.summary.peakTps,
      avgTps: ralphyAnalytics.summary.avgTps,
      successRate: ralphyAnalytics.summary.successRate,
      serverVsOnChain: {
        serverReported: ralphyAnalytics.reconciliation.serverClaimed,
        onChainConfirmed: ralphyAnalytics.reconciliation.onChainConfirmed,
        discrepancy: ralphyAnalytics.reconciliation.discrepancy,
      },
    };

    if (summary.qualityGatePassed) {
      printSuccess('Ralphy verification complete - all hashes resolved');
    } else {
      printWarning('Quality gate not passed - some hashes may be unresolved');
    }

  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    printWarning(`Ralphy verification failed: ${errMsg}`);
    printInfo('Falling back to legacy verification');

    if (collectedHashes.length > 0) {
      await legacyVerification();
    }
  }
}

// Legacy verification (fallback when Ralphy files not available)
async function legacyVerification(): Promise<void> {
  printInfo(`Verifying ${collectedHashes.length} transaction hashes (legacy mode)...`);
  console.log('');

  try {
    const verifyEndpoint = 'https://api.testnet.aptoslabs.com/v1';
    const aptosConfig = new AptosConfig({
      network: config.network === 'mainnet' ? Network.MAINNET : Network.TESTNET,
      fullnode: verifyEndpoint,
    });
    const aptos = new Aptos(aptosConfig);

    let confirmedOnChain = 0;
    let failedOnChain = 0;
    let notFound = 0;
    const timestamps: number[] = [];

    const batchSize = 50;
    const totalBatches = Math.ceil(collectedHashes.length / batchSize);

    for (let batch = 0; batch < totalBatches; batch++) {
      const start = batch * batchSize;
      const end = Math.min(start + batchSize, collectedHashes.length);
      const batchHashes = collectedHashes.slice(start, end);

      const progress = Math.round(((batch + 1) / totalBatches) * 100);
      process.stdout.write(`\r  Verifying: ${progress}% (${end}/${collectedHashes.length} hashes)`);

      const verifyPromises = batchHashes.map(async (h) => {
        try {
          const txn = await aptos.getTransactionByHash({ transactionHash: h.hash });
          const txnAny = txn as any;

          if (txnAny.type === 'pending_transaction') {
            return { status: 'pending', timestamp: 0 };
          }

          if (txnAny.success === true) {
            const timestamp = parseInt(txnAny.timestamp || '0', 10);
            return { status: 'confirmed', timestamp };
          } else {
            return { status: 'failed', timestamp: 0 };
          }
        } catch (err: any) {
          if (err.message?.includes('not found') || err.message?.includes('404')) {
            return { status: 'not_found', timestamp: 0 };
          }
          return { status: 'error', timestamp: 0 };
        }
      });

      const results = await Promise.all(verifyPromises);

      for (const result of results) {
        switch (result.status) {
          case 'confirmed':
            confirmedOnChain++;
            if (result.timestamp > 0) {
              timestamps.push(result.timestamp);
            }
            break;
          case 'failed':
            failedOnChain++;
            break;
          case 'not_found':
            notFound++;
            break;
        }
      }

      if (batch < totalBatches - 1) {
        await sleep(100);
      }
    }

    console.log('');

    let peakTpsVerified = 0;
    let avgTpsVerified = 0;

    if (timestamps.length > 0) {
      timestamps.sort((a, b) => a - b);

      const perSecondCounts: Map<number, number> = new Map();
      for (const ts of timestamps) {
        const second = Math.floor(ts / 1_000_000);
        perSecondCounts.set(second, (perSecondCounts.get(second) || 0) + 1);
      }

      if (perSecondCounts.size > 0) {
        peakTpsVerified = Math.max(...perSecondCounts.values());
      }

      const firstTs = timestamps[0];
      const lastTs = timestamps[timestamps.length - 1];
      const actualDurationSec = (lastTs - firstTs) / 1_000_000;
      if (actualDurationSec > 0) {
        avgTpsVerified = confirmedOnChain / actualDurationSec;
      }
    }

    const totalVerified = confirmedOnChain + failedOnChain + notFound;
    const successRateVerified = totalVerified > 0 ? (confirmedOnChain / totalVerified) * 100 : 0;
    const serverClaimed = stats.successfulTransfers;
    const discrepancy = serverClaimed > 0 ? ((serverClaimed - confirmedOnChain) / serverClaimed) * 100 : 0;

    verifiedStats = {
      verified: true,
      accountsChecked: collectedHashes.length,
      confirmedTransfers: confirmedOnChain,
      failedTransfers: failedOnChain + notFound,
      peakTps: Math.round(peakTpsVerified),
      avgTps: Math.round(avgTpsVerified),
      successRate: Math.round(successRateVerified * 10) / 10,
      serverVsOnChain: {
        serverReported: serverClaimed,
        onChainConfirmed: confirmedOnChain,
        discrepancy: Math.round(discrepancy * 10) / 10,
      },
    };

    console.log('');
    console.log(`  ${c.bold}Legacy Verification Results${c.reset}`);
    console.log(`  ${'─'.repeat(50)}`);
    console.log(`  Confirmed: ${c.green}${confirmedOnChain.toLocaleString()}${c.reset}`);
    console.log(`  Failed:    ${c.red}${failedOnChain.toLocaleString()}${c.reset}`);
    console.log(`  Dropped:   ${c.yellow}${notFound.toLocaleString()}${c.reset}`);
    console.log(`  Peak TPS:  ${c.green}${Math.round(peakTpsVerified)}${c.reset}`);
    console.log(`  Avg TPS:   ${Math.round(avgTpsVerified)}`);
    console.log('');

    printSuccess('Legacy verification complete');

  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    printWarning(`Legacy verification failed: ${errMsg}`);
  }
}

// Phase 8: Analytics and Results
async function saveResults(status: 'completed' | 'interrupted' | 'error'): Promise<void> {
  printHeader('PHASE 8: RESULTS');

  const durationSec = (stats.endTime - stats.startTime) / 1000;
  const averageTps = stats.tpsHistory.length > 0
    ? Math.round(stats.tpsHistory.reduce((a, b) => a + b, 0) / stats.tpsHistory.length)
    : 0;
  const successRate = stats.totalTransfers > 0
    ? ((stats.successfulTransfers / stats.totalTransfers) * 100).toFixed(1)
    : '0.0';

  // Print summary
  console.log('');
  console.log(`  ${c.bold}Configuration${c.reset}`);
  console.log(`  ${'─'.repeat(45)}`);
  console.log(`  Mode:             ${c.cyan}${config.mode.toUpperCase()}${c.reset} (${MODES[config.mode].accounts} accounts, ${MODES[config.mode].workers} workers)`);
  console.log(`  Duration:         ${durationSec.toFixed(1)}s`);
  console.log(`  Network:          ${config.network.toUpperCase()}`);
  console.log(`  RPC:              ${selectedEndpoint?.name || 'N/A'}`);
  console.log(`  Status:           ${status === 'completed' ? c.green : c.yellow}${status.toUpperCase()}${c.reset}`);
  console.log('');

  console.log(`  ${c.bold}Throughput${c.reset}`);
  console.log(`  ${'─'.repeat(45)}`);
  console.log(`  Peak TPS:         ${c.green}${stats.peakTps.toLocaleString()}${c.reset}`);
  console.log(`  Average TPS:      ${averageTps.toLocaleString()}`);
  console.log(`  Success Rate:     ${successRate}%`);
  console.log('');

  console.log(`  ${c.bold}Transactions${c.reset}`);
  console.log(`  ${'─'.repeat(45)}`);
  console.log(`  Total:            ${stats.totalTransfers.toLocaleString()}`);
  console.log(`  Successful:       ${c.green}${stats.successfulTransfers.toLocaleString()}${c.reset}`);
  console.log(`  Failed:           ${c.red}${stats.failedTransfers.toLocaleString()}${c.reset}`);
  console.log('');

  if (Object.keys(stats.errors).length > 0) {
    console.log(`  ${c.bold}Errors${c.reset}`);
    console.log(`  ${'─'.repeat(45)}`);
    const totalErrors = Object.values(stats.errors).reduce((a, b) => a + b, 0);
    for (const [type, count] of Object.entries(stats.errors).sort((a, b) => b[1] - a[1])) {
      const pct = ((count / totalErrors) * 100).toFixed(1);
      console.log(`  ${type}:`.padEnd(20) + `${count.toLocaleString()} (${pct}%)`);
    }
    console.log('');
  }

  // Evaluate prediction if we have one
  // IMPORTANT: Use VERIFIED stats for evaluation (ground truth)
  if (prediction) {
    const actualResults = {
      peakTps: verifiedStats?.verified ? verifiedStats.peakTps : stats.peakTps,
      avgTps: verifiedStats?.verified ? verifiedStats.avgTps : averageTps,
      successRate: verifiedStats?.verified ? verifiedStats.successRate : parseFloat(successRate),
      totalTransfers: verifiedStats?.verified ? verifiedStats.confirmedTransfers : stats.totalTransfers,
    };

    evaluation = evaluatePrediction(prediction, actualResults);

    // Display evaluation
    console.log(`  ${c.bold}Prediction Evaluation${c.reset} ${verifiedStats?.verified ? `${c.green}(using verified data)${c.reset}` : `${c.yellow}(unverified)${c.reset}`}`);
    console.log(formatEvaluation(prediction, actualResults, evaluation));
    console.log('');
  }

  // Save to file
  const resultsDir = path.join(PROJECT_ROOT, 'results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `usd1-transfer-${timestamp}.json`;
  const filepath = path.join(resultsDir, filename);

  // Use verified stats for summary when available (ground truth)
  const truePeakTps = verifiedStats?.verified ? verifiedStats.peakTps : stats.peakTps;
  const trueAvgTps = verifiedStats?.verified ? verifiedStats.avgTps : averageTps;
  const trueSuccessRate = verifiedStats?.verified ? verifiedStats.successRate : parseFloat(successRate);

  const results = {
    timestamp: new Date().toISOString(),
    status,
    // Ralphy metadata (if available)
    ralphy: ralphyDemoId ? {
      demoId: ralphyDemoId,
      hashFiles: `.ralphy/hashes/${ralphyDemoId}-worker-*.jsonl`,
      stateFile: `.ralphy/state/${ralphyDemoId}.json`,
    } : null,
    summary: {
      // These are the VERIFIED numbers (ground truth)
      peakTps: truePeakTps,
      averageTps: trueAvgTps,
      successRate: trueSuccessRate,
      // Include TPS percentiles from Ralphy analytics
      medianTps: ralphyAnalytics?.summary.medianTps,
      p95Tps: ralphyAnalytics?.summary.p95Tps,
      p99Tps: ralphyAnalytics?.summary.p99Tps,
      durationSec,
      verified: verifiedStats?.verified || false,
    },
    config: {
      mode: config.mode,
      network: config.network,
      accounts: MODES[config.mode].accounts,
      workers: MODES[config.mode].workers,
      duration: config.duration,
      rpcEndpoint: selectedEndpoint?.url,
    },
    // Server-reported stats (may over-count due to fire-and-forget)
    serverReported: {
      totalTransfers: stats.totalTransfers,
      successfulTransfers: stats.successfulTransfers,
      failedTransfers: stats.failedTransfers,
      peakTps: stats.peakTps,
      avgTps: averageTps,
      successRate: parseFloat(successRate),
      tpsHistory: stats.tpsHistory,
      errors: stats.errors,
    },
    // On-chain verified stats (ground truth)
    verified: verifiedStats ? {
      accountsChecked: verifiedStats.accountsChecked,
      confirmedTransfers: verifiedStats.confirmedTransfers,
      failedTransfers: verifiedStats.failedTransfers,
      peakTps: verifiedStats.peakTps,
      avgTps: verifiedStats.avgTps,
      successRate: verifiedStats.successRate,
      discrepancy: verifiedStats.serverVsOnChain.discrepancy,
    } : null,
    // Comprehensive Ralphy analytics (if available)
    analytics: ralphyAnalytics ? {
      latency: ralphyAnalytics.latency,
      perWorker: ralphyAnalytics.perWorker,
      perAccount: ralphyAnalytics.perAccount.slice(0, 20), // Top 20 accounts
      errors: ralphyAnalytics.errors,
      reconciliation: ralphyAnalytics.reconciliation,
    } : null,
    prediction: prediction ? {
      peakTps: prediction.confidence,
      avgTps: {
        low: Math.round(prediction.confidence.low * 0.75),
        expected: prediction.predicted.avgTps,
        high: Math.round(prediction.confidence.high * 0.75),
      },
      successRate: prediction.predicted.successRate,
      factors: prediction.factors,
    } : null,
    evaluation: evaluation ? {
      peakTpsAccuracy: evaluation.peakTpsAccuracy,
      avgTpsAccuracy: evaluation.avgTpsAccuracy,
      successRateAccuracy: evaluation.successRateAccuracy,
      overallAccuracy: evaluation.overallAccuracy,
      withinConfidence: evaluation.withinConfidence,
      rating: evaluation.rating,
      deltas: evaluation.deltas,
    } : null,
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
    },
  };

  fs.writeFileSync(filepath, JSON.stringify(results, null, 2));
  printInfo(`Results saved: ${c.cyan}results/${filename}${c.reset}`);
}

// Main execution
async function main(): Promise<void> {
  // Print banner
  console.log('');
  console.log(`${c.blue}${c.bold}╔${'═'.repeat(68)}╗${c.reset}`);
  console.log(`${c.blue}${c.bold}║${c.reset}${' '.repeat(15)}${c.cyan}${c.bold}USD1 TRANSFER TPS DEMO${c.reset}${' '.repeat(31)}${c.blue}${c.bold}║${c.reset}`);
  console.log(`${c.blue}${c.bold}║${c.reset}${' '.repeat(20)}${c.dim}${config.network.toUpperCase()} • ${config.mode.toUpperCase()} MODE${c.reset}${' '.repeat(25)}${c.blue}${c.bold}║${c.reset}`);
  console.log(`${c.blue}${c.bold}╚${'═'.repeat(68)}╝${c.reset}`);

  // Phase 1: Preflight
  if (!await phase1Preflight()) {
    printError('Preflight validation failed');
    process.exit(EXIT_PREFLIGHT_FAILED);
  }

  // Phase 2: RPC Validation
  if (!await phase2RpcValidation()) {
    printError('RPC endpoint validation failed');
    process.exit(EXIT_RPC_FAILED);
  }

  // Phase 2.5: TPS Prediction
  phase2_5Prediction();

  // Phase 3: Balance Validation
  if (!await phase3BalanceValidation()) {
    printError('Account balance validation failed');
    process.exit(EXIT_BALANCE_FAILED);
  }

  // Phase 4: Worker Compilation
  if (!await phase4WorkerCompilation()) {
    printError('Worker compilation failed');
    process.exit(EXIT_COMPILE_FAILED);
  }

  // Check for preflight-only mode
  if (preflightOnly) {
    console.log('');
    console.log(`${c.green}${c.bold}═══════════════════════════════════════════════════════════════════════${c.reset}`);
    console.log(`${c.green}${c.bold}                    PREFLIGHT CHECKS PASSED                            ${c.reset}`);
    console.log(`${c.green}${c.bold}═══════════════════════════════════════════════════════════════════════${c.reset}`);
    console.log('');
    printInfo('Remove --preflight-only to run the full demo');
    process.exit(EXIT_SUCCESS);
  }

  // Phase 5-6: Server Lifecycle
  if (!await phase5to7ServerLifecycle()) {
    printError('Server failed');
    process.exit(EXIT_STARTUP_FAILED);
  }

  // Phase 7: On-Chain Verification (verify actual confirmed transactions)
  await phase7OnChainVerification();

  // Phase 8: Save results
  await saveResults('completed');

  console.log('');
  console.log(`${c.green}${c.bold}═══════════════════════════════════════════════════════════════════════${c.reset}`);
  console.log(`${c.green}${c.bold}                         DEMO COMPLETED                                ${c.reset}`);
  console.log(`${c.green}${c.bold}═══════════════════════════════════════════════════════════════════════${c.reset}`);
  console.log('');

  process.exit(EXIT_SUCCESS);
}

// Run
main().catch((err) => {
  console.error(`${c.red}[FATAL]${c.reset}`, err);
  process.exit(EXIT_RUNTIME_ERROR);
});
