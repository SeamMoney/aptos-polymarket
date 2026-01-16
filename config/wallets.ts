/**
 * CENTRALIZED WALLET REGISTRY
 *
 * Single source of truth for all wallet keys and contract addresses.
 * Import this in scripts instead of hardcoding keys everywhere.
 */

// ==================== WALLET KEYS ====================

export const WALLETS = {
  // Master deployer - original contract owner, fund consolidation target
  deployer: {
    key: "0x48ee96658dd826f6541f5ee501c5784e6b341f04c52c641823f4b097b61eb79b",
    role: "deployer" as const,
    description: "Original deployer, APT consolidation target",
  },

  // USD1 v2 deployer - deployed the contract with admin drainers
  usd1Deployer: {
    key: "0xba4df2d482e616c52fae0bfb177fdfd9099e80d827ffa36933955480cc79b461",
    role: "usd1_deployer" as const,
    description: "USD1 v2 contract deployer, admin for drainer functions",
  },

  // HFT trading accounts (20 total, split across 3 workers)
  hftAccounts: [
    // Worker 1: accounts 1-7 (UI connected master)
    { key: "0x6e2fca34586261b6f22a973c20024b78ddb370d87f7c974315fb97ba56716a7f", worker: 1 },
    { key: "0xe61d22b3dc37c537a20d5b301c4d2b409b2f93cd7b2915f3518d49517c2ab6c4", worker: 1 },
    { key: "0x4542c2e4a39beee8202eee0cddeceea886687b21b54b8f50c17e729251fdd7f5", worker: 1 },
    { key: "0xcf5154af9664bbc2634fddfcce2317ed788b35de7f004ac0e24aefd68a0b10c5", worker: 1 },
    { key: "0xb7d1f406e48c2eddffe987f98445dd4a353e8e9d1630d878621ded084bdd77c7", worker: 1 },
    { key: "0xa8088ee787b847f6304807a8b09d1afc15409082ee9c8b7eda6919b0ecb86ea8", worker: 1 },
    { key: "0xb5305eb83498dcba61242ccc91fac35263d9b44bddaf5e7417adbaceb1cfcb36", worker: 1 },

    // Worker 2: accounts 8-14
    { key: "0xc27a6a8b6ed3013da99dc924b2f6af17f1448dedce91691f97d9e778c0761655", worker: 2 },
    { key: "0xd6402b3493af005ed02b07f6cd7ffdfd37fae6d4d9c88fec6ff38e90f01b21c1", worker: 2 },
    { key: "0xd375af1a686835905e15bf82f24fcaeed4b1b5b5fabe22c80e998acb804aa295", worker: 2 },
    { key: "0xC5BA2ED0F5C40EE298E844B1140B6BB31C2671B747C8E9DF4B76054C4C5A8761", worker: 2 },
    { key: "0x536C886483209657C9B30663B295C7CB007EB57E07931D3E41AF69067897D465", worker: 2 },
    { key: "0x3E9CB6207207A266F298B1B13648D707BF886766221C3253F30AF68530A79749", worker: 2 },
    { key: "0x4641D0FDD221B48EF4A45C8DC77D6D4F12D6848E01B7686134564A8CAE5BE637", worker: 2 },

    // Worker 3: accounts 15-20
    { key: "0xFB2AFF37DFED247E9CF407FFA41208A41A78877C1990ADD1F94E00FCE1A5CCAC", worker: 3 },
    { key: "0x9E338A7FB43F8280CCD82B2929B66F4ED1B7AA7900C40E06EAD934BC7CDEF315", worker: 3 },
    { key: "0x8E7D4B0196840DA3A7BA6EDEF3784E1B961263F06651B130F440F5D974920B1F", worker: 3 },
    { key: "0x975CF351CE096E1350C9F9E89ED5CB8D7BEAAEBF7FC235B10F1A0852355EED7A", worker: 3 },
    { key: "0xD945B44FCFA961B9E4F8DAA5139CF6B4CE9A1DF4838C75701EDC8A429739C097", worker: 3 },
    { key: "0x292A25EDBE90DCB5F682908C1E7185E1CC127FAD74EEA218167115AA5962866C", worker: 3 },
  ],
};

// ==================== CONTRACT ADDRESSES ====================

export const CONTRACTS = {
  // AMM-fixed contract with per-outcome base_reserve (deployed Jan 14, 2026)
  // This fixes: price convergence to 50/50, improves parallelization
  address: "0xca4d40eae9f07fb28a121862d649203fb4335ece9536ee51790e19f812ff7aea",

  // USD1 stablecoin metadata (from new contract)
  usd1Metadata: "0x14b1ec8a5f31554d0cd19c390be83444ed519be2d7108c3e27dcbc4230c01fa3",

  // Deployer key for this contract (can mint USD1)
  deployerKey: "0xCD5A6456DC16CD34BF5CDAE7A20D1DF1674FCF46D8084F2A864DE4CB246BC659",

  // Markets on the new contract (10 Polymarket-style markets + 1 test market)
  markets: [
    "0xaf561030c7ebb22b1d8b99b727c27caab1f6944ce39c141fd2b6b0cfbf614a9e", // 1. WLFI Banking Charter
    "0xa4ee321c4c642e7b5a3e27b9820f2be4c17a1add79f8129122289fca2c3ca7c3", // 2. Trump Greenland
    "0xf85c7010d966bc6c3417e52a9b4d86b5f36117e51b43bf5c7a92f0468bac5497", // 3. Fed Chair Nomination
    "0xcbdddcf6206d2b5956b6c7c6a10d4ac1d6253a2c1c151e8b3af113d8e940f01f", // 4. Khamenei Iran
    "0xe128c8f16a0f07f48c69a38ac75868a2d5fdd9fbf3299958e9b1e2994a0b9f57", // 5. China Taiwan
    "0xf60c218d500eb76c66a4a7fb6c6e5664847d5e9496016000fc953b5a89f6eb",   // 6. Russia-Ukraine
    "0x287968f6d26efbd291960455ce14e3723a48d32b3dc0a8c545d4603fe842e30f", // 7. Venezuela
    "0xa594c8df003cd232043b34beefe020af744f378ec367a7f65b89e306e06baacb", // 8. Fed Rate Jan 2026
    "0x310ccec449c57bf8972feab19c5cb8ba5004e2934e4fa1bd565fdbd1a44f4008", // 9. Bitcoin Q1 2026
    "0x8172b2cf4ba365d72fca8b899a54d3c9e2539d63bd2283aca55c0d032fc793f6", // 10. Bitcoin $150K
    "0xa550234b5784656e3f3d060134e36ab9a0eecc436d182452955c995984b3e67a", // 11. Test market: BTC $100K
    "0x9dc3b78821f64119671d7918b824b3b3c4b0e2124643ebe6b1e587efe9591202", // 12. Insurrection Act 2026
    "0xf508498afdecb2a2f6b40912efb1611b9fe9725e9c35521be5ff2bba3c187efa", // 13. Midterm Elections Nov 2026
    "0x289aabd338cf7a2bc48512927775b5e1218b15bd83c3c740c3ec43faccef5b21", // 14. Trump Third Term 2026
    "0x8c4f0da1238adb4486d2a62ff08c85af331e022c1446445059059918d4361cd3", // 15. Republican 2028 Nominee (Vance, Rubio, Trump, DeSantis, Carlson, Other)
  ],

  // Legacy: USD1 v2 contract (Jan 11, 2026) - prices converge to 50/50
  legacyUsd1V2: {
    address: "0xbdea15f5b0f5449ae8f3a6ae95a5e090bdeeec91be1fcac8375b2f5f37f1c134",
    usd1Metadata: "0x4e977d5ee91d77d680972a44b38b9c7a2c5694439169eeae060a48324e5c4597",
    markets: [
      "0x3e690f317df664c413e12b15eaa6e5565606fbd46628464f84f93e0674a3c052", // 1. Republican 2028
      "0xf3256638cad294e47c8cc6bb1a6a0fdd85b29ef427b3118028c34b9f061aa50d", // 2. WLFI charter
      "0x192f7cfc0c8151deec37c6280c17b55f7557a04b580b486d6076cc11955ddde3", // 3. Greenland
      "0x9e4583c0af174a119b5316ae84988f4fd988259de35ef95447b371744a355762", // 4. Fed Chair
      "0xd82731a9a2259ccfef2fd13db13720c7cc927c5b7879aa160aecc618c4d4654f", // 5. Iran Binary (Yes/No)
      "0x77a65b92664f992ccbd8a17d73a5f2fc933523ce64a1c475d1db1c0fc2acf42a", // 6. China Taiwan
      "0xa84ba7b7364a40031e29d355d7a5f48fd54f922c8eed0ed0009c5d660a6da339", // 7. Russia Ukraine
      "0x8187c1b3b7ca06dbcbac36fe280e0b5343b744c5a299a43263f9162738d4d792", // 8. Venezuela
      "0x551f153ff61f94311a22592550b0ede4b3b57338af161bd9472f21e15da23b4b", // 9. Fed Jan 2026
      "0x742e3c66cb6570351ceb7cf1b2df87e726c708b786109a8cdae93b0c3c7b5a04", // 10. BTC Q1 2026
      "0x35df09c98f8668c06f6777e98e3a0405fe894c271f06ba2fed0b322e2a5c2f16", // 11. BTC $150K
      "0xd3227afa81dce5fa0e8f86f61dc7f3215ee799a0d2e6a112a988e5ac732bf719", // 12. Iran Date
    ],
  },

  // Legacy contracts (APT-based, TVL locked)
  legacy: {
    v3: {
      address: "0xa2e5e47aab07fed78a3bcf95135ee2dad20c547499c94cb16a3e047859ffa7e1",
      market: "0xfefd1b67818ee4ef12a7953852c83f0efb411a9b92c518a52ba92555e4abdd96",
      tvlLocked: 19774, // APT locked, cannot recover
    },
    v1: {
      address: "0x64a81cb9cbd14d45b87bb32ef73107a44f00069b6a96e70d75369fb7e3da5e68",
      market: "0x43709b978ab28e43636944edcbad91efcffbf4ec0de026ae0fcf05e0f425f912",
      tvlLocked: 14735, // APT locked, no emergency_withdraw
    },
  },
};

// ==================== HELPER FUNCTIONS ====================

/**
 * Get all HFT account keys as a flat array
 */
export function getAllHftKeys(): string[] {
  return WALLETS.hftAccounts.map(a => a.key);
}

/**
 * Get HFT account keys for a specific worker
 */
export function getWorkerKeys(worker: 1 | 2 | 3): string[] {
  return WALLETS.hftAccounts.filter(a => a.worker === worker).map(a => a.key);
}

/**
 * Get keys as comma-separated string (for env vars)
 */
export function getKeysAsEnvString(keys: string[]): string {
  return keys.join(',');
}

/**
 * Clean a private key (remove ed25519-priv- prefix if present)
 */
export function cleanKey(key: string): string {
  return key.replace('ed25519-priv-', '').replace('0x', '').toLowerCase();
}

// ==================== INFRASTRUCTURE ====================

// Primary fullnode URL - use this everywhere instead of raw IP
export const FULLNODE_URL = "https://aptos.cash.trading/v1";

export const WORKERS = {
  worker1: { ip: "178.128.177.88", accounts: getWorkerKeys(1), isMaster: true },
  worker2: { ip: "147.182.237.239", accounts: getWorkerKeys(2), isMaster: false },
  worker3: { ip: "161.35.231.0", accounts: getWorkerKeys(3), isMaster: false },
  fullnode: { host: "aptos.cash.trading", ip: "164.92.117.18" },
};
