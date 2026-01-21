import { Aptos, AptosConfig, Network, Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";

const CONTRACT = "0xa2e5e47aab07fed78a3bcf95135ee2dad20c547499c94cb16a3e047859ffa7e1";
const MARKET = "0xfefd1b67818ee4ef12a7953852c83f0efb411a9b92c518a52ba92555e4abdd96";
const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));
const account = Account.fromPrivateKey({ privateKey: new Ed25519PrivateKey(process.env.APTOS_PRIVATE_KEY!) });

const NAMES = ["J.D. Vance", "Marco Rubio", "Donald Trump", "Ron DeSantis", "Tucker Carlson", "Other"];

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function buy(idx: number, apt: number) {
  console.log(`  Buying ${apt.toFixed(1)} APT of ${NAMES[idx]}...`);
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
  console.log(`  ✅ Done: ${result.hash.slice(0, 16)}...`);
}

async function getPricesNormalized(): Promise<number[]> {
  const r = await aptos.view({ payload: { function: `${CONTRACT}::multi_outcome_market::get_all_prices`, functionArguments: [MARKET] } });
  const raw = (r[0] as string[]).map(p => parseInt(p));
  const sum = raw.reduce((a,b) => a+b, 0);
  return raw.map(p => (p/sum)*100);
}

async function main() {
  console.log("=== CREATING PRICE TIERS ===\n");

  // Strategy: Create distinct tiers by buying different amounts
  // Target: JDV ~30%, Rubio ~20%, Trump ~18%, DeSantis ~14%, Tucker ~10%, Other ~8%

  // Big Rubio buy to make him clear #2
  await buy(1, 50);  // Marco Rubio
  await sleep(2000);

  // Medium Trump buy for #3
  await buy(2, 25);  // Donald Trump
  await sleep(2000);

  // Small DeSantis buy for #4
  await buy(3, 12);  // Ron DeSantis
  await sleep(2000);

  // Tiny Tucker buy for #5
  await buy(4, 5);   // Tucker Carlson
  await sleep(2000);

  // Don't buy Other - keep lowest

  console.log("\n=== FINAL PRICES ===");
  await sleep(1000);
  const prices = await getPricesNormalized();
  console.log("Normalized prices (sum to 100%):");
  NAMES.forEach((n, i) => console.log(`  ${n}: ${prices[i].toFixed(2)}%`));

  // Sort to show ranking
  const ranked = NAMES.map((n, i) => ({ name: n, price: prices[i] }))
    .sort((a, b) => b.price - a.price);
  console.log("\nRanking:");
  ranked.forEach((r, i) => console.log(`  ${i+1}. ${r.name}: ${r.price.toFixed(2)}%`));
}

main().catch(console.error);
