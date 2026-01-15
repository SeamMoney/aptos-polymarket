#!/usr/bin/env npx tsx
/**
 * Benchmark Orchestration Script
 *
 * Automates the full benchmark workflow:
 * 1. Starts the HFT server
 * 2. Waits for all workers to be ready
 * 3. Starts trading for specified duration
 * 4. Stops trading and waits for results to be saved
 * 5. Runs post-run analytics
 *
 * Usage:
 *   source .env.seed && npx tsx scripts/run-benchmark.ts [duration] [mode]
 *
 * Examples:
 *   npx tsx scripts/run-benchmark.ts 60                    # 60 second quantum mode benchmark
 *   npx tsx scripts/run-benchmark.ts 30 turbo              # 30 second turbo mode
 *   npx tsx scripts/run-benchmark.ts 120 quantum --no-analytics  # Skip post-run analytics
 *   ACCOUNT_COUNT=100 npx tsx scripts/run-benchmark.ts 60  # With 100 accounts
 */

import { spawn, ChildProcess } from 'child_process';
import http from 'http';

// Configuration
const DURATION_SECONDS = parseInt(process.argv[2] || '60');
const MODE = process.argv[3] || 'quantum';
const SKIP_ANALYTICS = process.argv.includes('--no-analytics');
const PORT = parseInt(process.env.PORT || '3001');
const STARTUP_TIMEOUT = 120000; // 2 minutes for workers to initialize

// Colors for console output
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';

function log(msg: string, color: string = RESET): void {
  console.log(`${color}${msg}${RESET}`);
}

function httpRequest(
  method: string,
  path: string
): Promise<{ statusCode: number; body: any }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: 'localhost',
        port: PORT,
        path,
        method,
        headers: { 'Content-Type': 'application/json' },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve({
              statusCode: res.statusCode || 500,
              body: JSON.parse(data),
            });
          } catch {
            resolve({ statusCode: res.statusCode || 500, body: data });
          }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

async function waitForServer(): Promise<boolean> {
  const startWait = Date.now();
  log(`\n${CYAN}Waiting for server to be ready (max ${STARTUP_TIMEOUT / 1000}s)...${RESET}`);

  while (Date.now() - startWait < STARTUP_TIMEOUT) {
    try {
      const res = await httpRequest('GET', '/health');
      if (res.statusCode === 200 && res.body.workersReady > 0) {
        const workerCount = res.body.stats?.workerCount || 0;
        const accountCount = res.body.stats?.totalAccounts || 0;
        log(`${GREEN}Server ready: ${workerCount} workers, ${accountCount} accounts${RESET}`);
        return true;
      }
    } catch {
      // Server not ready yet
    }
    await new Promise((r) => setTimeout(r, 1000));
    process.stdout.write('.');
  }

  log(`${RED}Timeout waiting for server${RESET}`);
  return false;
}

async function startTrading(): Promise<{ runId: string; startTime: number } | null> {
  try {
    const res = await httpRequest('POST', '/start');
    if (res.statusCode === 200 && res.body.success) {
      return { runId: res.body.runId, startTime: res.body.startTime };
    }
    log(`${RED}Failed to start: ${JSON.stringify(res.body)}${RESET}`);
    return null;
  } catch (e: any) {
    log(`${RED}Error starting: ${e.message}${RESET}`);
    return null;
  }
}

async function stopTrading(): Promise<any> {
  try {
    const res = await httpRequest('POST', '/stop');
    return res.body;
  } catch (e: any) {
    log(`${RED}Error stopping: ${e.message}${RESET}`);
    return null;
  }
}

async function getStats(): Promise<any> {
  try {
    const res = await httpRequest('GET', '/stats');
    return res.body;
  } catch {
    return null;
  }
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

async function monitorProgress(durationMs: number): Promise<void> {
  const startTime = Date.now();
  const endTime = startTime + durationMs;

  console.log('');
  log(`${BOLD}${CYAN}=`.repeat(70) + RESET);
  log(`${BOLD}   BENCHMARK IN PROGRESS${RESET}`);
  log(`${BOLD}   Duration: ${DURATION_SECONDS}s | Mode: ${MODE}${RESET}`);
  log(`${BOLD}${CYAN}=`.repeat(70) + RESET);
  console.log('');

  while (Date.now() < endTime) {
    const stats = await getStats();
    if (stats) {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      const remaining = Math.round((endTime - Date.now()) / 1000);
      const progress = Math.round((elapsed / DURATION_SECONDS) * 100);

      // Progress bar
      const barWidth = 40;
      const filled = Math.round((progress / 100) * barWidth);
      const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled);

      // Clear line and print stats
      process.stdout.write('\r\x1b[K');
      process.stdout.write(
        `${DIM}[${bar}]${RESET} ` +
        `${CYAN}${elapsed}s/${DURATION_SECONDS}s${RESET} ` +
        `${GREEN}${formatNumber(stats.successfulTrades)}${RESET}/${formatNumber(stats.totalTrades)} ` +
        `${BOLD}${stats.currentTps} TPS${RESET} ` +
        `${YELLOW}${stats.successRate}%${RESET}`
      );
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.log('\n');
}

async function runAnalytics(): Promise<void> {
  log(`${CYAN}Running post-run analytics...${RESET}`);
  console.log('');

  // Run analyze-submitted-txns.ts
  await new Promise<void>((resolve) => {
    const proc = spawn('npx', ['tsx', 'scripts/analyze-submitted-txns.ts'], {
      stdio: 'inherit',
      cwd: process.cwd(),
    });
    proc.on('close', () => resolve());
  });

  console.log('');

  // Run deep-tps-analysis.ts
  await new Promise<void>((resolve) => {
    const proc = spawn('npx', ['tsx', 'scripts/deep-tps-analysis.ts'], {
      stdio: 'inherit',
      cwd: process.cwd(),
    });
    proc.on('close', () => resolve());
  });
}

async function main(): Promise<void> {
  console.log('');
  log(`${BOLD}${CYAN}╔${'═'.repeat(68)}╗${RESET}`);
  log(`${BOLD}${CYAN}║${RESET}${BOLD}   APTOS HFT BENCHMARK ORCHESTRATOR${' '.repeat(33)}${CYAN}║${RESET}`);
  log(`${BOLD}${CYAN}╚${'═'.repeat(68)}╝${RESET}`);
  console.log('');

  // Validate environment
  if (!process.env.SEED_MNEMONIC) {
    log(`${RED}ERROR: SEED_MNEMONIC not set${RESET}`);
    log(`Run: source .env.seed && npx tsx scripts/run-benchmark.ts`);
    process.exit(1);
  }

  if (!process.env.MULTI_MARKETS) {
    log(`${RED}ERROR: MULTI_MARKETS not set${RESET}`);
    log(`Set MULTI_MARKETS environment variable with comma-separated market addresses`);
    process.exit(1);
  }

  const accountCount = process.env.ACCOUNT_COUNT || '500';
  const workerCount = process.env.WORKER_COUNT || '4';
  const rpcMode = process.env.RPC_MODE || 'internal';
  const useOrderless = process.env.USE_ORDERLESS !== 'false';

  log(`${DIM}Configuration:${RESET}`);
  log(`  Duration:    ${DURATION_SECONDS} seconds`);
  log(`  Mode:        ${MODE}`);
  log(`  Accounts:    ${accountCount}`);
  log(`  Workers:     ${workerCount}`);
  log(`  RPC Mode:    ${rpcMode}`);
  log(`  Orderless:   ${useOrderless}`);
  log(`  Analytics:   ${SKIP_ANALYTICS ? 'Disabled' : 'Enabled'}`);
  console.log('');

  // Start the server
  log(`${CYAN}Starting HFT server (mode: ${MODE})...${RESET}`);
  const serverProc: ChildProcess = spawn(
    'npx',
    ['tsx', 'server/hft-piscina-server.ts', MODE],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: process.cwd(),
      env: { ...process.env },
    }
  );

  // Forward server output
  serverProc.stdout?.on('data', (data: Buffer) => {
    const lines = data.toString().split('\n');
    for (const line of lines) {
      if (line.trim()) {
        console.log(`${DIM}[server]${RESET} ${line}`);
      }
    }
  });

  serverProc.stderr?.on('data', (data: Buffer) => {
    const lines = data.toString().split('\n');
    for (const line of lines) {
      if (line.trim()) {
        console.log(`${RED}[server]${RESET} ${line}`);
      }
    }
  });

  // Handle server exit
  let serverExited = false;
  serverProc.on('exit', (code) => {
    serverExited = true;
    if (code !== 0 && code !== null) {
      log(`${RED}Server exited with code ${code}${RESET}`);
    }
  });

  // Wait for server to be ready
  const serverReady = await waitForServer();
  if (!serverReady || serverExited) {
    log(`${RED}Failed to start server${RESET}`);
    serverProc.kill();
    process.exit(1);
  }

  // Start trading
  log(`\n${GREEN}Starting trading...${RESET}`);
  const startResult = await startTrading();
  if (!startResult) {
    log(`${RED}Failed to start trading${RESET}`);
    serverProc.kill();
    process.exit(1);
  }

  log(`${GREEN}Trading started!${RESET}`);
  log(`${DIM}Run ID: ${startResult.runId}${RESET}`);

  // Monitor progress
  await monitorProgress(DURATION_SECONDS * 1000);

  // Stop trading
  log(`${YELLOW}Stopping trading...${RESET}`);
  const stopResult = await stopTrading();

  if (stopResult) {
    console.log('');
    log(`${BOLD}${GREEN}╔${'═'.repeat(68)}╗${RESET}`);
    log(`${BOLD}${GREEN}║${RESET}${BOLD}   BENCHMARK COMPLETE${' '.repeat(47)}${GREEN}║${RESET}`);
    log(`${BOLD}${GREEN}╚${'═'.repeat(68)}╝${RESET}`);
    console.log('');
    log(`  Run ID:           ${stopResult.runId}`);
    log(`  Duration:         ${stopResult.duration}s`);
    log(`  Total Trades:     ${formatNumber(stopResult.stats?.totalTrades || 0)}`);
    log(`  Successful:       ${formatNumber(stopResult.stats?.successfulTrades || 0)}`);
    log(`  Failed:           ${formatNumber(stopResult.stats?.failedTrades || 0)}`);
    log(`  Success Rate:     ${stopResult.stats?.successRate}%`);
    log(`  Peak TPS:         ${stopResult.stats?.peakTps}`);
    console.log('');
  }

  // Wait for results to be saved
  log(`${DIM}Waiting for results to be saved...${RESET}`);
  await new Promise((r) => setTimeout(r, 5000));

  // Kill server
  serverProc.kill();
  await new Promise((r) => setTimeout(r, 1000));

  // Run analytics
  if (!SKIP_ANALYTICS) {
    console.log('');
    log(`${BOLD}${CYAN}${'─'.repeat(70)}${RESET}`);
    log(`${BOLD}   POST-RUN ANALYTICS${RESET}`);
    log(`${BOLD}${CYAN}${'─'.repeat(70)}${RESET}`);
    console.log('');
    await runAnalytics();
  }

  console.log('');
  log(`${GREEN}Benchmark complete!${RESET}`);
  log(`${DIM}Results saved to: /tmp/hft-submitted-txns.json${RESET}`);
  console.log('');

  process.exit(0);
}

// Handle SIGINT (Ctrl+C)
process.on('SIGINT', async () => {
  log(`\n${YELLOW}Interrupted - stopping...${RESET}`);
  try {
    await stopTrading();
  } catch {
    // Ignore errors
  }
  process.exit(0);
});

main().catch((e) => {
  log(`${RED}Fatal error: ${e.message}${RESET}`);
  process.exit(1);
});
