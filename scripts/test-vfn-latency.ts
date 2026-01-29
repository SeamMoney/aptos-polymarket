/**
 * Test VFN transaction submission latency
 * Usage: npx tsx scripts/test-vfn-latency.ts
 */

import { Aptos, AptosConfig, Network, Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";

const PRIVATE_KEY = "0x6ceeeb36800665f36af48c88ecd8afdc4d34cfbe3793202b6313f6741866ab50";
const VFN_URL = "http://vfn0.usce1-1.testnet.aptoslabs.com:80/v1";

async function testLatency() {
  console.log("=".repeat(60));
  console.log("VFN TRANSACTION LATENCY TEST");
  console.log("Node:", VFN_URL);
  console.log("=".repeat(60));
  console.log("");

  // Setup
  const config = new AptosConfig({
    network: Network.TESTNET,
    fullnode: VFN_URL,
  });
  const aptos = new Aptos(config);

  const privateKey = new Ed25519PrivateKey(PRIVATE_KEY);
  const account = Account.fromPrivateKey({ privateKey });

  console.log("Account:", account.accountAddress.toString());
  console.log("");

  // Check node health first
  console.log("Checking node health...");
  const healthStart = Date.now();
  try {
    const ledger = await aptos.getLedgerInfo();
    const healthTime = Date.now() - healthStart;
    console.log(`Node OK - Block: ${ledger.block_height}, Latency: ${healthTime}ms`);
  } catch (e: any) {
    console.log(`Node FAILED: ${e.message}`);
    return;
  }
  console.log("");

  // Run transaction tests
  console.log("Running 5 transaction tests...");
  console.log("-".repeat(60));

  const results: number[] = [];

  for (let i = 1; i <= 5; i++) {
    try {
      const start = Date.now();

      // Build transaction (simple APT transfer to self, 0 amount)
      const txn = await aptos.transaction.build.simple({
        sender: account.accountAddress,
        data: {
          function: "0x1::aptos_account::transfer",
          functionArguments: [account.accountAddress, 0],
        },
      });

      // Sign
      const signedTxn = await aptos.transaction.sign({
        signer: account,
        transaction: txn,
      });

      // Submit
      const submitted = await aptos.transaction.submit.simple({
        senderAuthenticator: signedTxn,
        transaction: txn,
      });

      // Wait for confirmation
      const result = await aptos.waitForTransaction({
        transactionHash: submitted.hash,
        options: { timeoutSecs: 30 },
      });

      const elapsed = Date.now() - start;
      results.push(elapsed);

      const status = result.success ? "OK" : "FAIL";
      console.log(`Test ${i}: ${elapsed}ms - ${status} - ${submitted.hash.slice(0, 16)}...`);

    } catch (e: any) {
      console.log(`Test ${i}: FAILED - ${e.message}`);
    }

    // Small delay between tests
    await new Promise(r => setTimeout(r, 500));
  }

  // Summary
  console.log("");
  console.log("=".repeat(60));
  console.log("SUMMARY");
  console.log("=".repeat(60));

  if (results.length > 0) {
    const avg = Math.round(results.reduce((a, b) => a + b, 0) / results.length);
    const min = Math.min(...results);
    const max = Math.max(...results);

    console.log(`Successful: ${results.length}/5`);
    console.log(`Average latency: ${avg}ms`);
    console.log(`Min: ${min}ms, Max: ${max}ms`);
  } else {
    console.log("All transactions failed!");
  }
}

testLatency().catch(console.error);
