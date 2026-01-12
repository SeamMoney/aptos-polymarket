/**
 * BURST MODE WITH UI - Broadcasts trades to the HFT server WebSocket
 *
 * This connects to the HFT server running on Worker 1 (via SSH tunnel)
 * and broadcasts trades so they appear in the UI trade stream.
 */

import {
  Aptos,
  AptosConfig,
  Network,
  Account,
  Ed25519PrivateKey,
} from '@aptos-labs/ts-sdk';
import WebSocket from 'ws';

const CONTRACT = '0xa2e5e47aab07fed78a3bcf95135ee2dad20c547499c94cb16a3e047859ffa7e1';
const MARKET = '0xfefd1b67818ee4ef12a7953852c83f0efb411a9b92c518a52ba92555e4abdd96';
const FULLNODE = process.env.FULLNODE_URL || 'https://aptos.cash.trading/v1';
const WS_URL = process.env.WS_URL || 'ws://localhost:3001';  // Via SSH tunnel

const KEYS = [
  '0x6e2fca34586261b6f22a973c20024b78ddb370d87f7c974315fb97ba56716a7f',
  '0xe61d22b3dc37c537a20d5b301c4d2b409b2f93cd7b2915f3518d49517c2ab6c4',
  '0x4542c2e4a39beee8202eee0cddeceea886687b21b54b8f50c17e729251fdd7f5',
  '0xcf5154af9664bbc2634fddfcce2317ed788b35de7f004ac0e24aefd68a0b10c5',
  'ed25519-priv-0xb7d1f406e48c2eddffe987f98445dd4a353e8e9d1630d878621ded084bdd77c7',
  'ed25519-priv-0xa8088ee787b847f6304807a8b09d1afc15409082ee9c8b7eda6919b0ecb86ea8',
  'ed25519-priv-0xb5305eb83498dcba61242ccc91fac35263d9b44bddaf5e7417adbaceb1cfcb36',
  'ed25519-priv-0xc27a6a8b6ed3013da99dc924b2f6af17f1448dedce91691f97d9e778c0761655',
  'ed25519-priv-0xd6402b3493af005ed02b07f6cd7ffdfd37fae6d4d9c88fec6ff38e90f01b21c1',
  'ed25519-priv-0xd375af1a686835905e15bf82f24fcaeed4b1b5b5fabe22c80e998acb804aa295',
  'ed25519-priv-0xC5BA2ED0F5C40EE298E844B1140B6BB31C2671B747C8E9DF4B76054C4C5A8761',
  'ed25519-priv-0x536C886483209657C9B30663B295C7CB007EB57E07931D3E41AF69067897D465',
  'ed25519-priv-0x3E9CB6207207A266F298B1B13648D707BF886766221C3253F30AF68530A79749',
  'ed25519-priv-0x4641D0FDD221B48EF4A45C8DC77D6D4F12D6848E01B7686134564A8CAE5BE637',
  'ed25519-priv-0xFB2AFF37DFED247E9CF407FFA41208A41A78877C1990ADD1F94E00FCE1A5CCAC',
  'ed25519-priv-0x9E338A7FB43F8280CCD82B2929B66F4ED1B7AA7900C40E06EAD934BC7CDEF315',
  'ed25519-priv-0x8E7D4B0196840DA3A7BA6EDEF3784E1B961263F06651B130F440F5D974920B1F',
  'ed25519-priv-0x975CF351CE096E1350C9F9E89ED5CB8D7BEAAEBF7FC235B10F1A0852355EED7A',
  'ed25519-priv-0xD945B44FCFA961B9E4F8DAA5139CF6B4CE9A1DF4838C75701EDC8A429739C097',
  'ed25519-priv-0x292A25EDBE90DCB5F682908C1E7185E1CC127FAD74EEA218167115AA5962866C',
];

const OUTCOME_LABELS = ['J.D. Vance', 'Marco Rubio', 'Donald Trump', 'Ron DeSantis', 'Tucker Carlson', 'Other'];
const BURST_SIZE = 500;
const BURST_INTERVAL_MS = 1000;
const DURATION_SEC = parseInt(process.argv[2]) || 60;

const config = new AptosConfig({ network: Network.TESTNET, fullnode: FULLNODE });
const aptos = new Aptos(config);

function parseKey(k: string): Ed25519PrivateKey {
  return new Ed25519PrivateKey(k.replace('ed25519-priv-', ''));
}

// Stats
let totalTrades = 0;
let successfulTrades = 0;
let peakTps = 0;
let tradeId = 0;

// WebSocket connection to HFT server (for UI broadcast)
let ws: WebSocket | null = null;

function connectWs(): Promise<void> {
  return new Promise((resolve, reject) => {
    ws = new WebSocket(WS_URL);
    ws.on('open', () => {
      console.log('✓ Connected to HFT server WebSocket');
      resolve();
    });
    ws.on('error', (err) => {
      console.log('WebSocket error:', err.message);
      ws = null;
      resolve(); // Continue without WS
    });
    ws.on('close', () => {
      ws = null;
    });
  });
}

function broadcastTrade(txHash: string, isBuy: boolean, outcomeIndex: number, amount: number, latency: number) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;

  const trade = {
    type: 'trade',
    data: {
      id: `burst-${++tradeId}`,
      bot: 'BurstBot',
      action: isBuy ? 'buy_outcome' : 'sell_outcome',
      actionDisplay: isBuy ? 'BUY' : 'SELL',
      outcome: OUTCOME_LABELS[outcomeIndex] || 'Unknown',
      outcomeIndex,
      amount: amount / 100_000_000,
      latency,
      success: true,
      txHash,
      explorerUrl: `https://explorer.aptoslabs.com/txn/${txHash}?network=testnet`,
      timestamp: Date.now(),
    },
    stats: {
      totalTrades,
      successfulTrades,
      currentTps: peakTps,
      peakTps,
    },
  };

  try {
    ws.send(JSON.stringify(trade));
  } catch {
    // Ignore send errors
  }
}

async function fireBurst(accounts: Account[]): Promise<{ success: number; failed: number; tps: number }> {
  const txnsPerAccount = Math.ceil(BURST_SIZE / accounts.length);
  const startTime = Date.now();
  let success = 0;
  let failed = 0;

  // Pre-build all transactions
  const prebuilt: { tx: any; auth: any; outcomeIndex: number; isBuy: boolean; amount: number }[] = [];

  for (const acc of accounts) {
    for (let i = 0; i < txnsPerAccount; i++) {
      const outcomeIndex = Math.floor(Math.random() * 6);
      const isBuy = Math.random() > 0.5;
      const amount = Math.floor(1_000_000 + Math.random() * 50_000_000);

      const tx = await aptos.transaction.build.simple({
        sender: acc.accountAddress,
        data: {
          function: `${CONTRACT}::multi_outcome_market::${isBuy ? 'buy_outcome' : 'sell_outcome'}`,
          functionArguments: [MARKET, outcomeIndex, amount, 0],
        },
        options: {
          replayProtectionNonce: BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)),
          expireTimestamp: Math.floor(Date.now() / 1000) + 60,
        },
      });
      const auth = aptos.transaction.sign({ signer: acc, transaction: tx });
      prebuilt.push({ tx, auth, outcomeIndex, isBuy, amount });
    }
  }

  // Submit ALL simultaneously
  const submitStart = Date.now();
  const promises = prebuilt.map(async ({ tx, auth, outcomeIndex, isBuy, amount }) => {
    try {
      const pending = await aptos.transaction.submit.simple({ transaction: tx, senderAuthenticator: auth });
      success++;
      totalTrades++;
      successfulTrades++;

      // Broadcast every 10th trade to UI (to not overwhelm)
      if (success % 10 === 0) {
        const latency = Date.now() - submitStart;
        broadcastTrade(pending.hash, isBuy, outcomeIndex, amount, latency);
      }

      return true;
    } catch {
      failed++;
      totalTrades++;
      return false;
    }
  });

  await Promise.all(promises);
  const elapsed = Date.now() - startTime;
  const tps = Math.round((success / elapsed) * 1000);

  return { success, failed, tps };
}

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║      🔥 BURST MODE WITH UI BROADCAST 🔥                  ║');
  console.log(`║  Burst: ${BURST_SIZE} txns | Duration: ${DURATION_SEC}s`.padEnd(59) + '║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');

  // Connect to WS
  console.log(`Connecting to ${WS_URL}...`);
  await connectWs();
  console.log('');

  // Load accounts
  console.log('Loading accounts...');
  const accounts = KEYS.map(k => Account.fromPrivateKey({ privateKey: parseKey(k) }));
  console.log(`✓ Loaded ${accounts.length} accounts`);
  console.log('');

  const startTime = Date.now();
  const endTime = startTime + (DURATION_SEC * 1000);
  let burstCount = 0;

  console.log('Starting bursts...');
  console.log('');

  while (Date.now() < endTime) {
    const burstStart = Date.now();
    const { success, failed, tps } = await fireBurst(accounts);
    burstCount++;

    if (tps > peakTps) peakTps = tps;

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const remaining = DURATION_SEC - elapsed;

    process.stdout.write(`\r⚡ Burst #${burstCount} | ${success}/${success + failed} | ${tps} TPS | Peak: ${peakTps} | ${remaining}s left   `);

    // Wait for next interval
    const burstDuration = Date.now() - burstStart;
    const waitTime = Math.max(0, BURST_INTERVAL_MS - burstDuration);
    if (waitTime > 0 && Date.now() < endTime) {
      await new Promise(r => setTimeout(r, waitTime));
    }
  }

  console.log('');
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log(`║  📊 Total: ${totalTrades.toLocaleString()} trades | Peak: ${peakTps} TPS`.padEnd(59) + '║');
  console.log(`║  ✓ Success: ${successfulTrades.toLocaleString()} | Bursts: ${burstCount}`.padEnd(59) + '║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  // Close WS
  if (ws) ws.close();
}

main().catch(console.error);
