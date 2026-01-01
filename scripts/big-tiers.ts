import { Aptos, AptosConfig, Network, Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";

const CONTRACT = "0xa2e5e47aab07fed78a3bcf95135ee2dad20c547499c94cb16a3e047859ffa7e1";
const MARKET = "0xfefd1b67818ee4ef12a7953852c83f0efb411a9b92c518a52ba92555e4abdd96";
const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));
const account = Account.fromPrivateKey({ privateKey: new Ed25519PrivateKey(process.env.APTOS_PRIVATE_KEY!) });

const NAMES = ["J.D. Vance", "Marco Rubio", "Donald Trump", "Ron DeSantis", "Tucker Carlson", "Other"];

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function buy(idx: number, apt: number) {
  console.log(`  Buying ${apt.toFixed(0)} APT of ${NAMES[idx]}...`);
  try {
    const tx = await aptos.transaction.build.simple({
      sender: account.accountAddress,
      data: {
        function: `${CONTRACT}::multi_outcome_market::buy_outcome`,
        functionArguments: [MARKET, idx, Math.floor(apt * 100_000_000), 0]
      }
    });
    const signed = await aptos.transaction.sign({ signer: account, transaction: tx });
    const result = await aptos.transaction.submit.simple({ transaction: tx, senderAuthenticator: signed });
    await aptos.waitForTransaction({ transactionHash: result.hash });
    console.log(`  ✅ Done`);
  } catch (e: any) {
    console.log(`  ❌ Failed: ${e.message?.slice(0, 60)}`);
  }
}

async function getRawPrices(): Promise<number[]> {
  const r = await aptos.view({ payload: { function: `${CONTRACT}::multi_outcome_market::get_all_prices`, functionArguments: [MARKET] } });
  return (r[0] as string[]).map(p => parseInt(p));
}

async function main() {
  const bal = await aptos.getAccountAPTAmount({ accountAddress: account.accountAddress }) / 100_000_000;
  console.log("Balance:", bal.toFixed(2), "APT\n");

  console.log("=== RAW PRICES BEFORE ===");
  let raw = await getRawPrices();
  let sum = raw.reduce((a,b) => a+b, 0);
  NAMES.forEach((n, i) => console.log(`  ${n}: ${raw[i]}% raw, ${(raw[i]/sum*100).toFixed(1)}% normalized`));

  console.log("\n=== BIG TRADES TO CREATE TIERS ===\n");

  // Use most of remaining balance for big differentiation
  // Goal: push Rubio to ~80% raw (clear #2), Trump to ~75%, DeSantis ~70%, Tucker ~68%
  // Currently: JDV=92, others=61-65

  // Need very large trades since base_reserve is ~7000 APT
  await buy(1, 100);  // Marco Rubio - push to ~70-75%
  await sleep(1500);

  await buy(2, 40);   // Donald Trump
  await sleep(1500);

  // Check mid-state
  console.log("\n--- Mid check ---");
  raw = await getRawPrices();
  sum = raw.reduce((a,b) => a+b, 0);
  console.log(`JDV: ${raw[0]}% | Rubio: ${raw[1]}% | Trump: ${raw[2]}%`);
  console.log(`Normalized: JDV ${(raw[0]/sum*100).toFixed(1)}%, Rubio ${(raw[1]/sum*100).toFixed(1)}%, Trump ${(raw[2]/sum*100).toFixed(1)}%`);
  await sleep(1000);

  // Continue with smaller amounts
  await buy(3, 15);   // Ron DeSantis
  await sleep(1500);

  await buy(4, 5);    // Tucker Carlson
  await sleep(1500);

  console.log("\n=== FINAL RAW PRICES ===");
  raw = await getRawPrices();
  sum = raw.reduce((a,b) => a+b, 0);
  NAMES.forEach((n, i) => console.log(`  ${n}: ${raw[i]}% raw, ${(raw[i]/sum*100).toFixed(1)}% normalized`));

  // Show ranking
  const ranked = NAMES.map((n, i) => ({ name: n, raw: raw[i], norm: (raw[i]/sum*100) }))
    .sort((a, b) => b.norm - a.norm);
  console.log("\n=== RANKING ===");
  ranked.forEach((r, i) => console.log(`  ${i+1}. ${r.name}: ${r.norm.toFixed(1)}%`));

  const newBal = await aptos.getAccountAPTAmount({ accountAddress: account.accountAddress }) / 100_000_000;
  console.log(`\nSpent: ${(bal - newBal).toFixed(2)} APT | Remaining: ${newBal.toFixed(2)} APT`);
}

main().catch(console.error);
