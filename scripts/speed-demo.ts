#!/usr/bin/env npx tsx
/**
 * SPEED DEMO - Clean Sequential Transaction Demo
 *
 * Sends transactions one at a time, waiting for each to confirm
 * Shows true Aptos latency: ~180ms per transaction = ~5.5 TPS
 *
 * Usage: APTOS_PRIVATE_KEY=0x... APTOS_API_KEY=AG-... npx tsx scripts/speed-demo.ts [count]
 */

import {
  Aptos,
  AptosConfig,
  Network,
  Account,
  Ed25519PrivateKey,
} from '@aptos-labs/ts-sdk';

const CONTRACT_ADDRESS = '0x3f13249e31a1fbdb886741f7945cccc40307311abc08ba188894bd1a050e19b4';
const MODULE = `${CONTRACT_ADDRESS}::market`;
const KNOWN_MARKET = '0x9ec8c2987a5d0598969bb48f3acee94dd6bd5570420cbe5993d65e48500380c4';

// Setup with API key
const API_KEY = process.env.APTOS_API_KEY || '';
const aptos = new Aptos(new AptosConfig({
  network: Network.TESTNET,
  clientConfig: API_KEY ? { API_KEY } : undefined,
}));

async function main() {
  const privateKey = process.env.APTOS_PRIVATE_KEY;
  if (!privateKey) {
    console.error('❌ Set APTOS_PRIVATE_KEY');
    process.exit(1);
  }

  const count = parseInt(process.argv[2] || '30');
  const account = Account.fromPrivateKey({ privateKey: new Ed25519PrivateKey(privateKey) });

  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║        🚀 APTOS SPEED DEMO - REAL TRANSACTIONS                 ║');
  console.log('╠════════════════════════════════════════════════════════════════╣');
  if (API_KEY) {
    console.log('║  🔑 API Key: ENABLED                                           ║');
  } else {
    console.log('║  ⚠️  No API Key (may be rate limited)                           ║');
  }
  console.log(`║  Target: ${count} transactions                                        ║`);
  console.log(`║  Account: ${account.accountAddress.toString().slice(0, 20)}...              ║`);
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');

  const startTime = Date.now();
  const latencies: number[] = [];
  let success = 0;
  let failed = 0;

  console.log('📊 Live Transactions:');
  console.log('────────────────────────────────────────────────────────────────');

  for (let i = 0; i < count; i++) {
    const txStart = Date.now();
    const action = i % 2 === 0 ? 'buy_yes' : 'buy_no';
    const amount = Math.floor((0.01 + Math.random() * 0.02) * 100_000_000);

    try {
      const tx = await aptos.transaction.build.simple({
        sender: account.accountAddress,
        data: {
          function: `${MODULE}::${action}`,
          functionArguments: [KNOWN_MARKET, amount, 0],
        },
      });

      const pending = await aptos.signAndSubmitTransaction({
        signer: account,
        transaction: tx,
      });

      // Wait for confirmation
      await aptos.waitForTransaction({
        transactionHash: pending.hash,
        options: { checkSuccess: true },
      });

      const latency = Date.now() - txStart;
      latencies.push(latency);
      success++;

      const elapsed = (Date.now() - startTime) / 1000;
      const tps = success / elapsed;

      console.log(
        `✓ ${String(i + 1).padStart(3)}/${count} | ` +
        `${latency}ms | ` +
        `TPS: ${tps.toFixed(2)} | ` +
        `${pending.hash.slice(0, 12)}...`
      );
    } catch (e: any) {
      failed++;
      const latency = Date.now() - txStart;
      console.log(
        `✗ ${String(i + 1).padStart(3)}/${count} | ` +
        `${latency}ms | ` +
        `FAILED: ${e.message?.slice(0, 40) || 'Unknown'}`
      );

      // If rate limited, wait a bit
      if (e.status === 429 || e.message?.includes('429')) {
        console.log('   ⏳ Rate limited, waiting 5s...');
        await new Promise(r => setTimeout(r, 5000));
      }
    }
  }

  // Calculate stats
  const totalTime = (Date.now() - startTime) / 1000;
  const avgLatency = latencies.length > 0
    ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
    : 0;
  const minLatency = latencies.length > 0 ? Math.min(...latencies) : 0;
  const maxLatency = latencies.length > 0 ? Math.max(...latencies) : 0;
  const finalTPS = success / totalTime;

  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                      FINAL RESULTS                             ║');
  console.log('╠════════════════════════════════════════════════════════════════╣');
  console.log(`║  Successful:     ${String(success).padStart(4)} / ${count}                                  ║`);
  console.log(`║  Failed:         ${String(failed).padStart(4)}                                        ║`);
  console.log(`║  Success Rate:   ${String(Math.round((success / count) * 100)).padStart(4)}%                                       ║`);
  console.log('╠════════════════════════════════════════════════════════════════╣');
  console.log(`║  Total Time:     ${totalTime.toFixed(1).padStart(6)}s                                    ║`);
  console.log(`║  Average TPS:    ${finalTPS.toFixed(2).padStart(6)}                                      ║`);
  console.log('╠════════════════════════════════════════════════════════════════╣');
  console.log(`║  Avg Latency:    ${String(avgLatency).padStart(6)}ms                                    ║`);
  console.log(`║  Min Latency:    ${String(minLatency).padStart(6)}ms                                    ║`);
  console.log(`║  Max Latency:    ${String(maxLatency).padStart(6)}ms                                    ║`);
  console.log('╠════════════════════════════════════════════════════════════════╣');
  console.log('║                                                                ║');
  console.log(`║  🚀 ${success} real on-chain transactions confirmed!              ║`);
  console.log('║  ⚡ All verifiable on Aptos Explorer                            ║');
  console.log('║                                                                ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');
}

main().catch(console.error);
