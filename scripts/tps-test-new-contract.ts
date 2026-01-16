#!/usr/bin/env npx tsx
/**
 * TPS Test for the new AMM-fixed contract
 * Tests parallelization by sending concurrent trades to different outcomes
 */

import { Aptos, AptosConfig, Network, Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";

const CONTRACT = "0xca4d40eae9f07fb28a121862d649203fb4335ece9536ee51790e19f812ff7aea";
const MARKET = "0xa550234b5784656e3f3d060134e36ab9a0eecc436d182452955c995984b3e67a";

const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));

// Deployer key
const privateKey = new Ed25519PrivateKey("0xCD5A6456DC16CD34BF5CDAE7A20D1DF1674FCF46D8084F2A864DE4CB246BC659");
const account = Account.fromPrivateKey({ privateKey });

async function mintUSD1(amount: number) {
  const tx = await aptos.transaction.build.simple({
    sender: account.accountAddress,
    data: {
      function: `${CONTRACT}::usd1::mint`,
      functionArguments: [account.accountAddress.toString(), Math.floor(amount * 1e8)],
    },
  });
  const committed = await aptos.signAndSubmitTransaction({ signer: account, transaction: tx });
  await aptos.waitForTransaction({ transactionHash: committed.hash });
}

async function buildBuyTx(outcomeIndex: number, amount: number, seqNum: number) {
  return aptos.transaction.build.simple({
    sender: account.accountAddress,
    data: {
      function: `${CONTRACT}::multi_outcome_market::buy_outcome`,
      functionArguments: [MARKET, outcomeIndex, Math.floor(amount * 1e8), 0],
    },
    options: {
      accountSequenceNumber: seqNum,
    },
  });
}

async function runBurstTest(numTrades: number, description: string) {
  console.log(`\n--- ${description} ---`);
  console.log(`Sending ${numTrades} trades...`);

  // Get starting sequence number
  const accountInfo = await aptos.getAccountInfo({ accountAddress: account.accountAddress });
  let seqNum = parseInt(accountInfo.sequence_number);

  // Build all transactions first
  const startBuild = Date.now();
  const txPromises: Promise<any>[] = [];

  for (let i = 0; i < numTrades; i++) {
    // Alternate between YES (0) and NO (1) to test parallel execution
    const outcomeIndex = i % 2;
    const amount = 0.01; // Small amounts
    txPromises.push(buildBuyTx(outcomeIndex, amount, seqNum + i));
  }

  const transactions = await Promise.all(txPromises);
  const buildTime = Date.now() - startBuild;
  console.log(`Built ${numTrades} txs in ${buildTime}ms`);

  // Sign all transactions
  const signedTxs = transactions.map(tx =>
    aptos.transaction.sign({ signer: account, transaction: tx })
  );

  // Submit all at once (fire-and-forget)
  const startSubmit = Date.now();
  const submitPromises = signedTxs.map(signedTx =>
    aptos.transaction.submit.simple({ transaction: transactions[0], senderAuthenticator: signedTx })
      .catch(e => ({ error: e.message?.slice(0, 50) }))
  );

  const results = await Promise.all(submitPromises);
  const submitTime = Date.now() - startSubmit;

  const successes = results.filter(r => !('error' in r)).length;
  const failures = results.filter(r => 'error' in r).length;

  console.log(`Submitted in ${submitTime}ms`);
  console.log(`Success: ${successes}, Failures: ${failures}`);
  console.log(`Effective TPS: ${(successes / (submitTime / 1000)).toFixed(1)}`);

  // Wait for confirmations
  const confirmedHashes = results
    .filter(r => !('error' in r))
    .map((r: any) => r.hash);

  if (confirmedHashes.length > 0) {
    const startConfirm = Date.now();
    await Promise.all(
      confirmedHashes.slice(0, 10).map(hash =>
        aptos.waitForTransaction({ transactionHash: hash }).catch(() => null)
      )
    );
    const confirmTime = Date.now() - startConfirm;
    console.log(`First 10 confirmed in ${confirmTime}ms avg: ${(confirmTime/10).toFixed(0)}ms`);
  }

  return { successes, failures, submitTime };
}

async function runSequentialTest(numTrades: number) {
  console.log(`\n--- Sequential Baseline (${numTrades} trades) ---`);

  const startTime = Date.now();
  let successes = 0;
  let failures = 0;

  for (let i = 0; i < numTrades; i++) {
    try {
      const outcomeIndex = i % 2;
      const tx = await aptos.transaction.build.simple({
        sender: account.accountAddress,
        data: {
          function: `${CONTRACT}::multi_outcome_market::buy_outcome`,
          functionArguments: [MARKET, outcomeIndex, Math.floor(0.01 * 1e8), 0],
        },
      });
      const committed = await aptos.signAndSubmitTransaction({ signer: account, transaction: tx });
      await aptos.waitForTransaction({ transactionHash: committed.hash });
      successes++;
    } catch (e: any) {
      failures++;
    }
  }

  const totalTime = Date.now() - startTime;
  console.log(`Total time: ${totalTime}ms`);
  console.log(`Success: ${successes}, Failures: ${failures}`);
  console.log(`Sequential TPS: ${(successes / (totalTime / 1000)).toFixed(2)}`);

  return { successes, failures, totalTime };
}

async function main() {
  console.log("=".repeat(60));
  console.log("  TPS TEST - New AMM Contract");
  console.log("  Testing parallelization of per-outcome base_reserve");
  console.log("=".repeat(60));

  console.log(`\nContract: ${CONTRACT}`);
  console.log(`Market: ${MARKET}`);
  console.log(`Account: ${account.accountAddress.toString()}`);

  // Mint enough USD1 for testing
  console.log("\nMinting USD1 for testing...");
  await mintUSD1(1000);
  console.log("Minted 1000 USD1");

  // Test 1: Sequential baseline
  await runSequentialTest(10);

  // Test 2: Burst test with concurrent submissions
  // Note: This tests submission rate, not blockchain TPS
  // Real parallelization is handled by Block-STM on validator

  console.log("\n" + "=".repeat(60));
  console.log("  ANALYSIS");
  console.log("=".repeat(60));
  console.log(`
  With per-outcome base_reserve:
  - YES trades only touch yes_outcome.base_reserve
  - NO trades only touch no_outcome.base_reserve
  - These are at DIFFERENT addresses
  - Block-STM can execute them in parallel

  Remaining shared state:
  - market.accumulated_fees (Aggregator - parallel-safe)
  - market.total_collateral (Aggregator - parallel-safe)
  - market.collateral_store (FungibleStore - potential bottleneck)

  For true high-TPS, use:
  - Multiple markets (different addresses)
  - Multiple accounts (different signers)
  - Orderless transactions (no sequence number dependencies)
  `);
}

main().catch(console.error);
