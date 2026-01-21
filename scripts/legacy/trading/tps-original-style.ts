/**
 * TPS TEST - Original December 28 Style
 *
 * Uses sequence numbers with high pipelining (50+) like the original
 * that achieved 1K+ TPS on Grafana.
 *
 * Key differences from current approach:
 * - Sequence numbers (not orderless)
 * - High pipeline depth (50 vs 10)
 * - Aggressive batch submission
 */

import {
  Aptos,
  AptosConfig,
  Network,
  Account,
  Ed25519PrivateKey,
} from '@aptos-labs/ts-sdk';

const CONTRACT_ADDRESS = '0xa2e5e47aab07fed78a3bcf95135ee2dad20c547499c94cb16a3e047859ffa7e1';
const MULTI_MODULE = `${CONTRACT_ADDRESS}::multi_outcome_market`;
const MARKET_ADDRESS = '0xfefd1b67818ee4ef12a7953852c83f0efb411a9b92c518a52ba92555e4abdd96';

const ALL_PRIVATE_KEYS = [
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

// ORIGINAL CONFIG from Dec 28 that achieved 1K+ TPS
const BATCH_SIZE = 25;          // Per account per wave
const SEQUENCE_PIPELINE = 50;   // High pipeline depth
const WAVE_DELAY_MS = 0;        // No delay!
const DURATION_SEC = parseInt(process.argv[2]) || 20;

const FULLNODE_URL = process.env.FULLNODE_URL || 'https://aptos.cash.trading/v1';

const aptos = new Aptos(new AptosConfig({
  network: Network.TESTNET,
  fullnode: FULLNODE_URL,
}));

function parsePrivateKey(keyStr: string): Ed25519PrivateKey {
  const cleanKey = keyStr.replace('ed25519-priv-', '');
  return new Ed25519PrivateKey(cleanKey);
}

interface AccountState {
  account: Account;
  sequenceNumber: bigint;
  pendingCount: number;
}

// Stats
let totalSubmitted = 0;
let totalSuccess = 0;
let totalFailed = 0;
let waveCount = 0;
let peakTps = 0;

async function submitTxnWithSeq(accState: AccountState, seqOffset: number): Promise<boolean> {
  try {
    const outcomeIndex = Math.floor(Math.random() * 6);
    const isBuy = Math.random() > 0.5;
    const amount = Math.floor(1_000_000 + Math.random() * 10_000_000);

    const payload = isBuy
      ? { function: `${MULTI_MODULE}::buy_outcome` as const, functionArguments: [MARKET_ADDRESS, outcomeIndex, amount, 0] }
      : { function: `${MULTI_MODULE}::sell_outcome` as const, functionArguments: [MARKET_ADDRESS, outcomeIndex, amount, 0] };

    const seqNum = accState.sequenceNumber + BigInt(seqOffset);

    const transaction = await aptos.transaction.build.simple({
      sender: accState.account.accountAddress,
      data: payload,
      options: {
        accountSequenceNumber: seqNum,  // USE SEQUENCE NUMBERS!
      },
    });

    const authenticator = aptos.transaction.sign({ signer: accState.account, transaction });
    await aptos.transaction.submit.simple({ transaction, senderAuthenticator: authenticator });
    return true;
  } catch {
    return false;
  }
}

async function fireWave(accountStates: AccountState[]): Promise<{ success: number; failed: number; timeMs: number }> {
  const startTime = Date.now();
  const promises: Promise<boolean>[] = [];

  // Each account fires BATCH_SIZE transactions with pipelined sequence numbers
  for (const accState of accountStates) {
    for (let i = 0; i < BATCH_SIZE; i++) {
      promises.push(submitTxnWithSeq(accState, i));
    }
  }

  const results = await Promise.all(promises);
  const success = results.filter(r => r).length;
  const failed = results.filter(r => !r).length;

  // Update sequence numbers for successful txns (approximately)
  for (const accState of accountStates) {
    accState.sequenceNumber += BigInt(BATCH_SIZE);
  }

  return { success, failed, timeMs: Date.now() - startTime };
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║   🔥 ORIGINAL DEC 28 STYLE - SEQUENCE PIPELINING 🔥      ║');
  console.log(`║   Accounts: 20 | BatchSize: ${BATCH_SIZE} | Pipeline: ${SEQUENCE_PIPELINE}`.padEnd(59) + '║');
  console.log(`║   Duration: ${DURATION_SEC}s | Target: 1000+ TPS`.padEnd(59) + '║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  // Load accounts and get sequence numbers
  console.log('Loading accounts and fetching sequence numbers...');
  const accountStates: AccountState[] = [];

  for (const keyStr of ALL_PRIVATE_KEYS) {
    try {
      const privateKey = parsePrivateKey(keyStr);
      const account = Account.fromPrivateKey({ privateKey });

      // Get current sequence number
      const info = await aptos.getAccountInfo({ accountAddress: account.accountAddress });
      const seqNum = BigInt(info.sequence_number);

      accountStates.push({
        account,
        sequenceNumber: seqNum,
        pendingCount: 0,
      });
    } catch (e) {
      // Skip invalid accounts
    }
  }
  console.log(`✓ Loaded ${accountStates.length} accounts\n`);

  const startTime = Date.now();
  const endTime = startTime + (DURATION_SEC * 1000);

  console.log('🔥 Starting aggressive burst with sequence pipelining...\n');

  while (Date.now() < endTime) {
    const waveStart = Date.now();
    const { success, failed, timeMs } = await fireWave(accountStates);

    totalSubmitted += success + failed;
    totalSuccess += success;
    totalFailed += failed;
    waveCount++;

    const instantTps = timeMs > 0 ? Math.round((success / timeMs) * 1000) : 0;
    if (instantTps > peakTps) peakTps = instantTps;

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const remaining = DURATION_SEC - elapsed;
    const avgTps = Math.round(totalSuccess / Math.max(1, (Date.now() - startTime) / 1000));

    process.stdout.write(`\r⚡ Wave #${waveCount} | ${success}/${success + failed} | ${instantTps} TPS | Avg: ${avgTps} TPS | ${remaining}s    `);

    // Small delay to prevent overwhelming
    if (WAVE_DELAY_MS > 0) {
      await new Promise(r => setTimeout(r, WAVE_DELAY_MS));
    }
  }

  const totalTime = (Date.now() - startTime) / 1000;
  const avgTps = Math.round(totalSuccess / totalTime);
  const successRate = totalSubmitted > 0 ? ((totalSuccess / totalSubmitted) * 100).toFixed(1) : '0';

  console.log('\n\n╔══════════════════════════════════════════════════════════╗');
  console.log('║                    📊 RESULTS                            ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║  Total Submitted: ${totalSubmitted.toLocaleString().padStart(8)}`.padEnd(59) + '║');
  console.log(`║  Success Rate:    ${successRate}%`.padEnd(59) + '║');
  console.log(`║  Waves:           ${waveCount}`.padEnd(59) + '║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║  Average TPS:     ${avgTps.toString().padStart(5)} txns/sec`.padEnd(59) + '║');
  console.log(`║  Peak TPS:        ${peakTps.toString().padStart(5)} txns/sec`.padEnd(59) + '║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');
}

main().catch(console.error);
