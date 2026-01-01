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
  return { raw, normalized: raw.map(p => (p/sum)*100), sum };
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
}

async function buy(idx: number, apt: number) {
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
}

async function main() {
  console.log("Account:", account.accountAddress.toString());
  let aptBal = await aptos.getAccountAPTAmount({ accountAddress: account.accountAddress }) / 100_000_000;
  console.log("APT Balance:", aptBal.toFixed(2), "APT\n");

  console.log("=== CURRENT STATE ===");
  let { raw, normalized } = await getPrices();
  const balances = await getBalances();
  NAMES.forEach((n, i) => console.log(`  ${n}: ${normalized[i].toFixed(2)}% | ${balances[i].toFixed(2)} tokens`));

  // Step 1: Sell remaining tokens from outcomes 1-5 (not JDV)
  console.log("\n🔄 STEP 1: Selling remaining tokens (except JDV)...");
  for (let i = 1; i < 6; i++) {
    if (balances[i] > 0.1) {
      console.log(`  Selling ${balances[i].toFixed(2)} ${NAMES[i]} tokens...`);
      try {
        await sell(i, balances[i] - 0.01); // Leave tiny amount
        console.log("  ✅ Done");
      } catch (e: any) {
        console.log(`  ❌ Failed`);
      }
    }
  }

  aptBal = await aptos.getAccountAPTAmount({ accountAddress: account.accountAddress }) / 100_000_000;
  console.log(`\nAPT Balance after selling: ${aptBal.toFixed(2)} APT`);

  // Step 2: Strategic buys to create spread
  // Goal: JDV highest, then Rubio, Trump, DeSantis, Tucker, Other
  console.log("\n🔄 STEP 2: Strategic buys to create price spread...\n");

  // Allocate APT: More to middle outcomes to create differentiation
  // JDV already high, so focus on creating a tier below
  const budget = Math.min(aptBal - 5, 60); // Keep 5 APT reserve
  if (budget > 10) {
    const trades = [
      { idx: 1, name: "Marco Rubio", pct: 0.30 },    // Second place
      { idx: 2, name: "Donald Trump", pct: 0.20 },   // Third
      { idx: 3, name: "Ron DeSantis", pct: 0.10 },   // Fourth
      { idx: 4, name: "Tucker Carlson", pct: 0.05 }, // Fifth
      // Don't buy Other - keep lowest
    ];

    for (const trade of trades) {
      const amt = budget * trade.pct;
      if (amt >= 1) {
        console.log(`  Buying ${amt.toFixed(2)} APT of ${trade.name}...`);
        try {
          await buy(trade.idx, amt);
          const newPrices = await getPrices();
          console.log(`     Prices: JDV=${newPrices.normalized[0].toFixed(1)}%, ${trade.name}=${newPrices.normalized[trade.idx].toFixed(1)}%`);
        } catch (e: any) {
          console.log(`  ❌ Failed: ${e.message?.slice(0, 50)}`);
        }
      }
    }
  }

  console.log("\n=== FINAL STATE ===");
  ({ raw, normalized } = await getPrices());
  const finalBalances = await getBalances();
  aptBal = await aptos.getAccountAPTAmount({ accountAddress: account.accountAddress }) / 100_000_000;

  console.log("Prices (normalized to 100%):");
  NAMES.forEach((n, i) => console.log(`  ${n}: ${normalized[i].toFixed(2)}%`));

  console.log("\nRaw prices:");
  NAMES.forEach((n, i) => console.log(`  ${n}: ${raw[i]}%`));

  console.log(`\nAPT Balance: ${aptBal.toFixed(2)} APT`);
  console.log("\nToken holdings:");
  NAMES.forEach((n, i) => console.log(`  ${n}: ${finalBalances[i].toFixed(2)} tokens`));
}

main().catch(console.error);
