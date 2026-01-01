import { Aptos, AptosConfig, Network, Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";

const CONTRACT = "0xa2e5e47aab07fed78a3bcf95135ee2dad20c547499c94cb16a3e047859ffa7e1";
const MARKET = "0xfefd1b67818ee4ef12a7953852c83f0efb411a9b92c518a52ba92555e4abdd96";
const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));
const account = Account.fromPrivateKey({ privateKey: new Ed25519PrivateKey(process.env.APTOS_PRIVATE_KEY!) });

const NAMES = ["J.D. Vance", "Marco Rubio", "Donald Trump", "Ron DeSantis", "Tucker Carlson", "Other"];

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
  return result.hash;
}

async function main() {
  const bal = await aptos.getAccountAPTAmount({ accountAddress: account.accountAddress }) / 100_000_000;
  console.log("Balance:", bal.toFixed(2), "APT\n");

  // Use most of balance on Rubio to push him way up
  const rubioAmount = Math.min(bal - 5, 30); // Keep 5 APT reserve
  if (rubioAmount > 5) {
    console.log(`Buying ${rubioAmount.toFixed(0)} APT of Marco Rubio to push him to clear #2...`);
    const hash = await buy(1, rubioAmount);
    console.log("✅ Done:", hash.slice(0, 20));
  }

  // Check final state
  console.log("\nFinal prices:");
  const r = await aptos.view({ payload: { function: `${CONTRACT}::multi_outcome_market::get_all_prices`, functionArguments: [MARKET] } });
  const raw = (r[0] as string[]).map(p => parseInt(p));
  const sum = raw.reduce((a,b) => a+b, 0);
  NAMES.forEach((n, i) => console.log(`  ${n}: ${(raw[i]/sum*100).toFixed(1)}%`));

  const newBal = await aptos.getAccountAPTAmount({ accountAddress: account.accountAddress }) / 100_000_000;
  console.log("\nRemaining:", newBal.toFixed(2), "APT");
}

main().catch(console.error);
