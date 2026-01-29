import { Aptos, AptosConfig, Network, Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";

const PRIVATE_KEY = "0x6ceeeb36800665f36af48c88ecd8afdc4d34cfbe3793202b6313f6741866ab50";
const VFN_URL = "http://vfn0.usce1-1.testnet.aptoslabs.com:80/v1";

async function test() {
  console.log("LATENCY BREAKDOWN TEST");
  console.log("Node:", VFN_URL);
  console.log("");

  const config = new AptosConfig({ network: Network.TESTNET, fullnode: VFN_URL });
  const aptos = new Aptos(config);
  const privateKey = new Ed25519PrivateKey(PRIVATE_KEY);
  const account = Account.fromPrivateKey({ privateKey });

  for (let i = 1; i <= 3; i++) {
    console.log("--- Test", i, "---");

    let t0 = Date.now();
    const txn = await aptos.transaction.build.simple({
      sender: account.accountAddress,
      data: { function: "0x1::aptos_account::transfer", functionArguments: [account.accountAddress, 0] },
    });
    const buildTime = Date.now() - t0;

    t0 = Date.now();
    const signedTxn = await aptos.transaction.sign({ signer: account, transaction: txn });
    const signTime = Date.now() - t0;

    t0 = Date.now();
    const submitted = await aptos.transaction.submit.simple({ senderAuthenticator: signedTxn, transaction: txn });
    const submitTime = Date.now() - t0;

    t0 = Date.now();
    await aptos.waitForTransaction({ transactionHash: submitted.hash, options: { timeoutSecs: 30 } });
    const confirmTime = Date.now() - t0;

    console.log("  Build:   ", buildTime, "ms (includes seq# fetch)");
    console.log("  Sign:    ", signTime, "ms (local)");
    console.log("  Submit:  ", submitTime, "ms (network)");
    console.log("  Confirm: ", confirmTime, "ms (block wait + check)");
    console.log("  TOTAL:   ", buildTime + signTime + submitTime + confirmTime, "ms");
    console.log("");

    await new Promise(r => setTimeout(r, 500));
  }
}
test();
