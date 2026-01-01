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
  return { raw, normalized: raw.map(p => (p/sum)*100) };
}

async function getBalances() {
  const r = await aptos.view({
    payload: {
      function: `${CONTRACT}::multi_outcome_market::get_user_multi_positions`,
      functionArguments: [MARKET, account.accountAddress.toString()]
    }
  });
  return (r[0] as string[]).map(b => Number(b) / 100_000_000);
}

async function sell(idx: number, tokens: number) {
  console.log(`  Selling ${tokens.toFixed(2)} tokens of ${NAMES[idx]}...`);
  const tx = await aptos.transaction.build.simple({
    sender: account.accountAddress,
    data: {
      function: `${CONTRACT}::multi_outcome_market::sell_outcome`,
      functionArguments: [MARKET, idx, Math.floor(tokens * 100_000_000), 0]
    }
  });
  const signed = await aptos.transaction.sign({ signer: account, transaction: tx });
  const result = await aptos.transaction.submit.simple({ transaction: tx, senderAuthenticator: signed });
  await aptos.waitForTransaction({ transactionHash: result.hash });
  console.log(`  ✅ Sold`);
}

async function main() {
  console.log("Account:", account.accountAddress.toString());

  const aptBal = await aptos.getAccountAPTAmount({ accountAddress: account.accountAddress }) / 100_000_000;
  console.log("APT Balance:", aptBal.toFixed(2), "APT\n");

  console.log("=== CURRENT TOKEN BALANCES ===");
  const balances = await getBalances();
  NAMES.forEach((n, i) => console.log(`  ${n}: ${balances[i].toFixed(2)} tokens`));

  console.log("\n=== CURRENT PRICES ===");
  let { raw, normalized } = await getPrices();
  NAMES.forEach((n, i) => console.log(`  ${n}: ${normalized[i].toFixed(2)}% (raw: ${raw[i]}%)`));

  // Sell OTHER outcomes (not J.D. Vance) to decrease base_reserve
  // This will lower OTHER raw prices and increase JDV's relative share
  console.log("\n🔄 Selling OTHER outcomes to push J.D. Vance higher...\n");

  for (let i = 1; i < 6; i++) {
    if (balances[i] > 1) {
      const toSell = balances[i] * 0.8; // Sell 80% of holdings
      try {
        await sell(i, toSell);
        const newPrices = await getPrices();
        console.log(`     J.D. Vance now: ${newPrices.normalized[0].toFixed(2)}%`);
      } catch (e: any) {
        console.log(`  ❌ Failed: ${e.message?.slice(0, 50)}`);
      }
    } else {
      console.log(`  Skipping ${NAMES[i]} - balance too low (${balances[i].toFixed(2)})`);
    }
  }

  console.log("\n=== FINAL PRICES ===");
  ({ raw, normalized } = await getPrices());
  NAMES.forEach((n, i) => console.log(`  ${n}: ${normalized[i].toFixed(2)}% (raw: ${raw[i]}%)`));
}

main().catch(console.error);
