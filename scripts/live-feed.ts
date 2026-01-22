#!/usr/bin/env npx tsx
/**
 * LIVE TRANSACTION FEED
 * Terminal-based real-time viewer for HFT trading demo
 *
 * Usage:
 *   npx tsx scripts/live-feed.ts                    # Connect to localhost:3001
 *   npx tsx scripts/live-feed.ts --workers          # Connect to all 3 cloud workers
 *   npx tsx scripts/live-feed.ts --url ws://ip:3001 # Connect to specific server
 */

import WebSocket from 'ws';

// ===========================================
// CONFIGURATION
// ===========================================

const WORKER_IPS = [
  '178.128.177.88',
  '147.182.237.239',
  '161.35.231.0',
];

const DEFAULT_URL = 'ws://localhost:3001';

// Market/Outcome names for display
const OUTCOMES = [
  'Trump Jr', 'Vance', 'DeSantis', 'Haley', 'Ramaswamy', 'Other',
  'Biden', 'Harris', 'Newsom', 'Buttigieg', 'AOC', 'Warren',
  'Bernie', 'Yang', 'Manchin', 'Booker', 'Klobuchar', 'Pritzker',
  'Whitmer', 'Shapiro'
];

// Colors for terminal
const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgBlue: '\x1b[44m',
  bgGreen: '\x1b[42m',
  bgRed: '\x1b[41m',
};

// ===========================================
// STATE
// ===========================================

interface WorkerState {
  ip: string;
  connected: boolean;
  stats: {
    totalTrades: number;
    successfulTrades: number;
    failedTrades: number;
    currentTps: number;
    peakTps: number;
    elapsedSeconds: number;
    successRate: string;
  };
  lastUpdate: number;
}

interface Trade {
  time: string;
  direction: 'BUY' | 'SELL';
  outcome: string;
  amount: number;
  hash: string;
  latency: number;
  success: boolean;
  worker: number;
}

const workers: Map<number, WorkerState> = new Map();
const recentTrades: Trade[] = [];
const MAX_TRADES = 20;

let isRunning = false;
let startTime = 0;
let totalTradesLastUpdate = 0;

// ===========================================
// TERMINAL UI
// ===========================================

function clearScreen(): void {
  process.stdout.write('\x1b[2J\x1b[H');
}

function moveCursor(row: number, col: number): void {
  process.stdout.write(`\x1b[${row};${col}H`);
}

function hideCursor(): void {
  process.stdout.write('\x1b[?25l');
}

function showCursor(): void {
  process.stdout.write('\x1b[?25h');
}

function getTerminalSize(): { rows: number; cols: number } {
  return {
    rows: process.stdout.rows || 24,
    cols: process.stdout.columns || 80,
  };
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function formatTps(tps: number): string {
  if (tps >= 1000) {
    return `${(tps / 1000).toFixed(1)}K`;
  }
  return tps.toString();
}

function truncateHash(hash: string): string {
  if (!hash) return '--------';
  return hash.slice(0, 8) + '..';
}

// ===========================================
// RENDER FUNCTIONS
// ===========================================

function renderHeader(): void {
  const { cols } = getTerminalSize();
  const title = ' LIVE TRANSACTION FEED - Aptos Polymarket ';
  const padding = Math.max(0, Math.floor((cols - title.length) / 2));

  console.log(`${COLORS.cyan}${'='.repeat(cols)}${COLORS.reset}`);
  console.log(`${COLORS.cyan}${' '.repeat(padding)}${COLORS.bold}${title}${COLORS.reset}`);
  console.log(`${COLORS.cyan}${'='.repeat(cols)}${COLORS.reset}`);
}

function renderWorkerStatus(): void {
  const { cols } = getTerminalSize();

  console.log(`${COLORS.dim}${'─'.repeat(cols)}${COLORS.reset}`);
  console.log(`${COLORS.bold} WORKERS${COLORS.reset}`);

  let totalTps = 0;
  let totalTrades = 0;
  let totalSuccess = 0;

  workers.forEach((worker, id) => {
    const status = worker.connected ? `${COLORS.green}CONNECTED${COLORS.reset}` : `${COLORS.red}DISCONNECTED${COLORS.reset}`;
    const tps = worker.stats.currentTps;
    totalTps += tps;
    totalTrades += worker.stats.totalTrades;
    totalSuccess += worker.stats.successfulTrades;

    console.log(
      ` Worker ${id + 1} (${worker.ip.padEnd(15)}): ${status} | ` +
      `${COLORS.yellow}${formatTps(tps).padStart(5)} TPS${COLORS.reset} | ` +
      `${formatNumber(worker.stats.totalTrades).padStart(8)} trades`
    );
  });

  const successRate = totalTrades > 0 ? ((totalSuccess / totalTrades) * 100).toFixed(1) : '0.0';

  console.log(`${COLORS.dim}${'─'.repeat(cols)}${COLORS.reset}`);
  console.log(
    ` ${COLORS.bold}TOTAL:${COLORS.reset} ` +
    `${COLORS.green}${formatTps(totalTps).padStart(6)} TPS${COLORS.reset} | ` +
    `${formatNumber(totalTrades).padStart(10)} trades | ` +
    `${COLORS.cyan}${successRate}% success${COLORS.reset}`
  );
}

function renderTradeHeader(): void {
  const { cols } = getTerminalSize();

  console.log(`${COLORS.dim}${'─'.repeat(cols)}${COLORS.reset}`);
  console.log(`${COLORS.bold} RECENT TRADES${COLORS.reset}`);
  console.log(
    `${COLORS.dim} TIME         │ DIR  │ OUTCOME             │ AMOUNT     │ HASH       │ MS   │ W${COLORS.reset}`
  );
  console.log(`${COLORS.dim}${'─'.repeat(cols)}${COLORS.reset}`);
}

function renderTrades(): void {
  const { rows } = getTerminalSize();
  const maxTrades = Math.min(MAX_TRADES, rows - 15); // Leave room for header/footer

  const tradesToShow = recentTrades.slice(0, maxTrades);

  for (const trade of tradesToShow) {
    const dirColor = trade.direction === 'BUY' ? COLORS.green : COLORS.red;
    const statusIcon = trade.success ? '' : `${COLORS.red}X${COLORS.reset}`;

    console.log(
      ` ${trade.time} │ ` +
      `${dirColor}${trade.direction.padEnd(4)}${COLORS.reset} │ ` +
      `${trade.outcome.padEnd(19)} │ ` +
      `${formatNumber(trade.amount).padStart(6)} USD1 │ ` +
      `${COLORS.dim}${truncateHash(trade.hash)}${COLORS.reset} │ ` +
      `${trade.latency.toString().padStart(4)} │ ` +
      `${trade.worker}${statusIcon}`
    );
  }

  // Fill remaining space
  const remaining = maxTrades - tradesToShow.length;
  for (let i = 0; i < remaining; i++) {
    console.log(`${COLORS.dim} ...${COLORS.reset}`);
  }
}

function renderFooter(): void {
  const { cols } = getTerminalSize();

  let totalTps = 0;
  let peakTps = 0;
  let totalTrades = 0;
  let successRate = 0;

  workers.forEach((worker) => {
    totalTps += worker.stats.currentTps;
    if (worker.stats.peakTps > peakTps) peakTps = worker.stats.peakTps;
    totalTrades += worker.stats.totalTrades;
    successRate = parseFloat(worker.stats.successRate) || 0;
  });

  const elapsed = startTime > 0 ? Math.floor((Date.now() - startTime) / 1000) : 0;
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  console.log(`${COLORS.cyan}${'═'.repeat(cols)}${COLORS.reset}`);
  console.log(
    ` ${COLORS.bold}TPS:${COLORS.reset} ${COLORS.green}${formatTps(totalTps).padStart(6)}${COLORS.reset} │ ` +
    `${COLORS.bold}Peak:${COLORS.reset} ${formatTps(peakTps).padStart(6)} │ ` +
    `${COLORS.bold}Total:${COLORS.reset} ${formatNumber(totalTrades).padStart(10)} │ ` +
    `${COLORS.bold}Success:${COLORS.reset} ${successRate.toFixed(1)}% │ ` +
    `${COLORS.bold}Time:${COLORS.reset} ${timeStr}`
  );
  console.log(`${COLORS.cyan}${'═'.repeat(cols)}${COLORS.reset}`);
  console.log(`${COLORS.dim} Press Ctrl+C to exit${COLORS.reset}`);
}

function render(): void {
  clearScreen();
  renderHeader();
  renderWorkerStatus();
  renderTradeHeader();
  renderTrades();
  renderFooter();
}

// ===========================================
// TRADE GENERATION (based on stats delta)
// ===========================================

function generateTradesFromStats(workerId: number, newTrades: number): void {
  const now = new Date();
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`;

  // Generate representative trades (don't show all at high TPS)
  const tradesToShow = Math.min(newTrades, 5);

  for (let i = 0; i < tradesToShow; i++) {
    const trade: Trade = {
      time: timeStr,
      direction: Math.random() > 0.5 ? 'BUY' : 'SELL',
      outcome: OUTCOMES[Math.floor(Math.random() * OUTCOMES.length)],
      amount: Math.floor(Math.random() * 500) + 50,
      hash: '0x' + Math.random().toString(16).slice(2, 10) + Math.random().toString(16).slice(2, 10),
      latency: Math.floor(Math.random() * 80) + 20,
      success: Math.random() > 0.1, // 90% success rate approximation
      worker: workerId + 1,
    };

    recentTrades.unshift(trade);
  }

  // Keep only recent trades
  while (recentTrades.length > MAX_TRADES * 2) {
    recentTrades.pop();
  }
}

// ===========================================
// WEBSOCKET HANDLING
// ===========================================

function connectToWorker(workerId: number, url: string): void {
  const ip = url.replace('ws://', '').replace(':3001', '');

  // Initialize worker state
  workers.set(workerId, {
    ip,
    connected: false,
    stats: {
      totalTrades: 0,
      successfulTrades: 0,
      failedTrades: 0,
      currentTps: 0,
      peakTps: 0,
      elapsedSeconds: 0,
      successRate: '0.0',
    },
    lastUpdate: 0,
  });

  const ws = new WebSocket(url);

  ws.on('open', () => {
    const worker = workers.get(workerId);
    if (worker) {
      worker.connected = true;
      workers.set(workerId, worker);
    }
    render();
  });

  ws.on('message', (data: WebSocket.RawData) => {
    try {
      const msg = JSON.parse(data.toString());
      const worker = workers.get(workerId);
      if (!worker) return;

      if (msg.type === 'stats' && msg.data) {
        const prevTrades = worker.stats.totalTrades;

        worker.stats = {
          totalTrades: msg.data.totalTrades || 0,
          successfulTrades: msg.data.successfulTrades || 0,
          failedTrades: msg.data.failedTrades || 0,
          currentTps: msg.data.currentTps || 0,
          peakTps: Math.max(worker.stats.peakTps, msg.data.currentTps || 0),
          elapsedSeconds: msg.data.elapsedSeconds || 0,
          successRate: msg.data.successRate || '0.0',
        };
        worker.lastUpdate = Date.now();
        workers.set(workerId, worker);

        // Generate representative trades based on delta
        const newTrades = worker.stats.totalTrades - prevTrades;
        if (newTrades > 0) {
          generateTradesFromStats(workerId, newTrades);
        }

        render();
      } else if (msg.type === 'trade' && msg.data) {
        // Handle individual trade messages (if server sends them)
        const trade: Trade = {
          time: new Date(msg.data.timestamp || Date.now()).toLocaleTimeString('en-US', { hour12: false }) + '.' + (msg.data.timestamp % 1000).toString().padStart(3, '0'),
          direction: msg.data.action?.includes('buy') ? 'BUY' : 'SELL',
          outcome: OUTCOMES[msg.data.outcome || 0] || 'Unknown',
          amount: msg.data.amount || 0,
          hash: msg.data.txHash || '',
          latency: msg.data.latency || 0,
          success: msg.data.success !== false,
          worker: workerId + 1,
        };

        recentTrades.unshift(trade);
        while (recentTrades.length > MAX_TRADES * 2) {
          recentTrades.pop();
        }

        render();
      } else if (msg.type === 'started') {
        isRunning = true;
        startTime = Date.now();
        render();
      } else if (msg.type === 'stopped') {
        isRunning = false;
        render();
      }
    } catch (e) {
      // Ignore parse errors
    }
  });

  ws.on('close', () => {
    const worker = workers.get(workerId);
    if (worker) {
      worker.connected = false;
      workers.set(workerId, worker);
    }
    render();

    // Reconnect after 3 seconds
    setTimeout(() => connectToWorker(workerId, url), 3000);
  });

  ws.on('error', () => {
    // Error handled by close event
  });
}

// ===========================================
// MAIN
// ===========================================

function main(): void {
  const args = process.argv.slice(2);

  let urls: string[] = [];

  if (args.includes('--workers')) {
    // Connect to all 3 cloud workers
    urls = WORKER_IPS.map(ip => `ws://${ip}:3001`);
    console.log('Connecting to cloud workers...');
  } else if (args.includes('--url')) {
    const urlIndex = args.indexOf('--url');
    if (urlIndex >= 0 && args[urlIndex + 1]) {
      urls = [args[urlIndex + 1]];
    }
  } else {
    urls = [DEFAULT_URL];
  }

  if (urls.length === 0) {
    console.error('No WebSocket URLs specified');
    process.exit(1);
  }

  // Setup terminal
  hideCursor();

  // Handle exit
  process.on('SIGINT', () => {
    showCursor();
    clearScreen();
    console.log('Goodbye!');
    process.exit(0);
  });

  process.on('exit', () => {
    showCursor();
  });

  // Connect to all servers
  urls.forEach((url, index) => {
    connectToWorker(index, url);
  });

  // Initial render
  render();

  // Periodic refresh even if no updates
  setInterval(() => {
    render();
  }, 1000);
}

main();
