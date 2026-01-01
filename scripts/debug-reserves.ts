import { Aptos, AptosConfig, Network, Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";

const CONTRACT = "0xa2e5e47aab07fed78a3bcf95135ee2dad20c547499c94cb16a3e047859ffa7e1";
const MARKET = "0xfefd1b67818ee4ef12a7953852c83f0efb411a9b92c518a52ba92555e4abdd96";
const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));

const NAMES = ["J.D. Vance", "Marco Rubio", "Donald Trump", "Ron DeSantis", "Tucker Carlson", "Other"];

async function main() {
  // Get market info
  const info = await aptos.view({
    payload: {
      function: `${CONTRACT}::multi_outcome_market::get_multi_market_info`,
      functionArguments: [MARKET]
    }
  });

  console.log("=== MARKET INFO ===");
  console.log("Question:", info[0]);
  console.log("Category:", info[2]);
  console.log("Outcomes:", info[3]);
  console.log("Total Collateral:", Number(info[7]) / 100_000_000, "APT");

  // Get raw prices (these are percentages: base_reserve / (base_reserve + outcome_reserve) * 100)
  const prices = await aptos.view({
    payload: {
      function: `${CONTRACT}::multi_outcome_market::get_all_prices`,
      functionArguments: [MARKET]
    }
  });

  const rawPrices = (prices[0] as string[]).map(p => parseInt(p));
  const sum = rawPrices.reduce((a, b) => a + b, 0);

  console.log("\n=== RAW PRICES (from contract) ===");
  NAMES.forEach((name, i) => {
    console.log(`  ${name}: ${rawPrices[i]}% (raw)`);
  });
  console.log(`  Sum of raw prices: ${sum}%`);

  console.log("\n=== NORMALIZED PRICES (to sum to 100%) ===");
  NAMES.forEach((name, i) => {
    const normalized = (rawPrices[i] / sum) * 100;
    console.log(`  ${name}: ${normalized.toFixed(2)}%`);
  });

  // Understand the reserve relationship
  // price[i] = base / (base + reserve[i]) * 100
  // So: base / (base + reserve[i]) = price[i] / 100
  // base + reserve[i] = base * 100 / price[i]
  // reserve[i] = base * (100 / price[i] - 1) = base * (100 - price[i]) / price[i]

  // We can only get relative values. If we assume base_reserve = 100 units:
  console.log("\n=== RELATIVE RESERVES (base = 100 units) ===");
  const baseUnits = 100;
  NAMES.forEach((name, i) => {
    if (rawPrices[i] > 0) {
      const relativeReserve = baseUnits * (100 - rawPrices[i]) / rawPrices[i];
      console.log(`  ${name}: ${relativeReserve.toFixed(2)} units (relative)`);
    }
  });

  console.log("\n=== ANALYSIS ===");
  console.log("Higher raw price = LOWER outcome reserve (more tokens bought)");
  console.log("Lower raw price = HIGHER outcome reserve (fewer tokens bought)");
  console.log("\nTo move J.D. Vance's normalized price UP:");
  console.log("  Option 1: Buy J.D. Vance (decreases his reserve, increases base)");
  console.log("  Option 2: SELL other outcomes (increases their reserve, decreases base)");
  console.log("\nThe problem: buying ANYONE increases base_reserve, which increases ALL raw prices.");
  console.log("In a 6-outcome market, the effect of increasing base is distributed.");

  // Calculate what happens if we buy 100 APT of JDV
  console.log("\n=== SIMULATION: Buy 100 APT of J.D. Vance ===");

  // Estimate current reserves based on raw prices
  // We need to work backwards from the total collateral
  const totalCollateralOctas = Number(info[7]);
  const totalCollateralAPT = totalCollateralOctas / 100_000_000;

  // The base_reserve is probably close to initial liquidity divided by outcome count
  // Let's estimate: if price = base / (base + reserve), and we know prices...
  // For JDV: 79 = base / (base + jdv_reserve) * 100
  // 0.79 = base / (base + jdv_reserve)
  // 0.79 * (base + jdv_reserve) = base
  // 0.79 * jdv_reserve = base * (1 - 0.79) = 0.21 * base
  // jdv_reserve = 0.21/0.79 * base = 0.266 * base

  // For estimation, let's assume base_reserve ≈ total_collateral / outcome_count initially
  // But it's been modified by trading...

  console.log("Total collateral:", totalCollateralAPT.toFixed(2), "APT");
  console.log("\nNote: Exact reserves not exposed by view function.");
  console.log("The CPMM uses a shared base_reserve for all outcomes.");
  console.log("This means buying ANY outcome inflates all raw prices.");
}

main().catch(console.error);
