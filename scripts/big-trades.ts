import { Aptos, AptosConfig, Network, Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";

const CONTRACT = "0xa2e5e47aab07fed78a3bcf95135ee2dad20c547499c94cb16a3e047859ffa7e1";
const MARKET = "0xfefd1b67818ee4ef12a7953852c83f0efb411a9b92c518a52ba92555e4abdd96";
const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));
const account = Account.fromPrivateKey({ privateKey: new Ed25519PrivateKey(process.env.APTOS_PRIVATE_KEY!) });

const NAMES = ["J.D. Vance", "Marco Rubio", "Donald Trump", "Ron DeSantis", "Tucker Carlson", "Other"];

async function getPrices() {
  const r = await aptos.view({ payload: { function: `${CONTRACT}::multi_outcome_market::get_all_prices`, functionArguments: [MARKET] } });
  const raw = (r[0] as string[]).map(p => parseInt(p));
  const sum = raw.reduce((a,b) => a+b, 0);
  return raw.map(p => (p/sum)*100);
}

async function buy(idx: number, apt: number) {
  console.log(`  Buying ${apt} APT of ${NAMES[idx]}...`);
  const tx = await aptos.transaction.build.simple({
    sender: account.accountAddress,
    data: { function: `${CONTRACT}::multi_outcome_market::buy_outcome`, functionArguments: [MARKET, idx, Math.floor(apt * 100_000_000), 0] }
  });
  const signed = await aptos.transaction.sign({ signer: account, transaction: tx });
  const result = await aptos.transaction.submit.simple({ transaction: tx, senderAuthenticator: signed });
  await aptos.waitForTransaction({ transactionHash: result.hash });
  console.log(`  ✅ Done`);
}

async function main() {
  const bal = await aptos.getAccountAPTAmount({ accountAddress: account.accountAddress }) / 100_000_000;
  console.log("Balance:", bal.toFixed(2), "APT\n");

  console.log("Current prices:");
  let prices = await getPrices();
  NAMES.forEach((n, i) => console.log(`  ${n}: ${prices[i].toFixed(1)}%`));

  console.log("\n🔄 Making strategic trades to differentiate prices...\n");

  // Buy LOTS of J.D. Vance to make him clear leader (target ~45-50%)
  await buy(0, 300);  // Big J.D. Vance buy

  // Buy some Rubio to keep him in second (target ~20%)
  await buy(1, 80);

  // Small buys for others to space them out
  await buy(2, 30);   // Trump
  await buy(3, 15);   // DeSantis
  await buy(4, 8);    // Carlson
  // Don't buy Other - keep lowest

  console.log("\n📊 Final prices:");
  prices = await getPrices();
  NAMES.forEach((n, i) => console.log(`  ${n}: ${prices[i].toFixed(1)}%`));

  const newBal = await aptos.getAccountAPTAmount({ accountAddress: account.accountAddress }) / 100_000_000;
  console.log("\nSpent:", (bal - newBal).toFixed(2), "APT");
}

main().catch(console.error);
