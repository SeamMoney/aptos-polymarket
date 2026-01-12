/**
 * COMPREHENSIVE APT AUDIT
 * Find all APT across wallets and markets
 */

import { Aptos, AptosConfig, Network, Account, Ed25519PrivateKey } from '@aptos-labs/ts-sdk';

const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));

// All known wallet keys from the scripts
const ALL_WALLET_KEYS = [
  // From consolidate-funds.ts and recover-apt.ts
  "0x48ee96658dd826f6541f5ee501c5784e6b341f04c52c641823f4b097b61eb79b", // Deployer
  "0x6e2fca34586261b6f22a973c20024b78ddb370d87f7c974315fb97ba56716a7f",
  "0xe61d22b3dc37c537a20d5b301c4d2b409b2f93cd7b2915f3518d49517c2ab6c4",
  "0x4542c2e4a39beee8202eee0cddeceea886687b21b54b8f50c17e729251fdd7f5",
  "0xcf5154af9664bbc2634fddfcce2317ed788b35de7f004ac0e24aefd68a0b10c5",
  "0xb7d1f406e48c2eddffe987f98445dd4a353e8e9d1630d878621ded084bdd77c7",
  "0xa8088ee787b847f6304807a8b09d1afc15409082ee9c8b7eda6919b0ecb86ea8",
  "0xb5305eb83498dcba61242ccc91fac35263d9b44bddaf5e7417adbaceb1cfcb36",
  "0xc27a6a8b6ed3013da99dc924b2f6af17f1448dedce91691f97d9e778c0761655",
  "0xd6402b3493af005ed02b07f6cd7ffdfd37fae6d4d9c88fec6ff38e90f01b21c1",
  "0xd375af1a686835905e15bf82f24fcaeed4b1b5b5fabe22c80e998acb804aa295",
  "0xC5BA2ED0F5C40EE298E844B1140B6BB31C2671B747C8E9DF4B76054C4C5A8761",
  "0x536C886483209657C9B30663B295C7CB007EB57E07931D3E41AF69067897D465",
  "0x3E9CB6207207A266F298B1B13648D707BF886766221C3253F30AF68530A79749",
  "0x4641D0FDD221B48EF4A45C8DC77D6D4F12D6848E01B7686134564A8CAE5BE637",
  "0xFB2AFF37DFED247E9CF407FFA41208A41A78877C1990ADD1F94E00FCE1A5CCAC",
  "0x9E338A7FB43F8280CCD82B2929B66F4ED1B7AA7900C40E06EAD934BC7CDEF315",
  "0x8E7D4B0196840DA3A7BA6EDEF3784E1B961263F06651B130F440F5D974920B1F",
  "0x975CF351CE096E1350C9F9E89ED5CB8D7BEAAEBF7FC235B10F1A0852355EED7A",
  "0xD945B44FCFA961B9E4F8DAA5139CF6B4CE9A1DF4838C75701EDC8A429739C097",
  "0x292A25EDBE90DCB5F682908C1E7185E1CC127FAD74EEA218167115AA5962866C",
  // From recover-funds.ts
  "0xf867c21b74502fa0104d421c294df0df23fd9ae3fc6882a33bb6c71a4fec90d3",
  "0x58045d9ecc12e6fbe3d6e9df215bb4e7f4c81231a09da5ba49afb674b2b58b05",
  "0xb63580da8bd96b068b4c1b1908aa2b9b93464afae0e56fec642c7bccd743c73f",
  "0x875277477fe8ea624ef1d05f5f62b247bfba5eaf02fac1fb256c4fc2c0981765",
  "0x27c178ae51e80be6be562267032c28c12ec6dcd075367361716e110c21183472",
  "0x0daa5cbc98056deab6d77577afcdc99f01a9a60a3b1ad72731049b3e0163bdb3",
  "0xa5cf70d36ca2579d99bd5ac0dbc94ca6eab7553d04db4f804141c441a19c9b1c",
  "0x314c74ce712385f6eb7f7c3eceb3edac35e7a882d20f3f221a12028d905679da",
  "0xca837a1738f1d9874f7988d3ff7f4a1e634bc8747d70f49fa053d0b126f8f5d9",
  "0xa7e23d7901bed3bcaff4061248edb56ce4209010e8fc9024f6d3cb3beed66db5",
  // New USD1 deployer
  "0xa093ae401e44fb7469e9edad1327154f249d1306fd792e939d2ae54681ef20ec",
];

// Known markets
const MARKETS = [
  { name: "V3 Active Market", contract: "0xa2e5e47aab07fed78a3bcf95135ee2dad20c547499c94cb16a3e047859ffa7e1", market: "0xfefd1b67818ee4ef12a7953852c83f0efb411a9b92c518a52ba92555e4abdd96" },
  { name: "Old V1 Market", contract: "0x64a81cb9cbd14d45b87bb32ef73107a44f00069b6a96e70d75369fb7e3da5e68", market: "0x43709b978ab28e43636944edcbad91efcffbf4ec0de026ae0fcf05e0f425f912" },
];

async function main() {
  console.log('='.repeat(70));
  console.log('COMPREHENSIVE APT AUDIT');
  console.log('='.repeat(70));

  let totalWalletAPT = 0;
  let totalTVL = 0;
  const walletBalances: {addr: string, apt: number}[] = [];

  // Check all wallet balances
  console.log('\nWALLET BALANCES:\n');

  for (const key of ALL_WALLET_KEYS) {
    try {
      const cleanKey = key.replace('ed25519-priv-', '').replace('0x', '');
      const account = Account.fromPrivateKey({
        privateKey: new Ed25519PrivateKey(cleanKey),
      });
      const addr = account.accountAddress.toString();

      const balance = await aptos.getAccountAPTAmount({ accountAddress: addr });
      const apt = balance / 1e8;

      if (apt > 0.1) {
        walletBalances.push({ addr, apt });
        totalWalletAPT += apt;
        console.log('  ' + addr.slice(0, 12) + '... : ' + apt.toFixed(2) + ' APT');
      }
    } catch (e) {
      // Skip invalid keys
    }
  }

  // Check market TVLs
  console.log('\nMARKET TVL:\n');

  for (const m of MARKETS) {
    try {
      const info = await aptos.view({
        payload: {
          function: m.contract + '::multi_outcome_market::get_multi_market_info',
          functionArguments: [m.market],
        },
      });
      const tvl = Number(info[7]) / 1e8;
      if (tvl > 0) {
        console.log('  ' + m.name + ': ' + tvl.toFixed(2) + ' APT');
        totalTVL += tvl;
      }
    } catch (e) {
      console.log('  ' + m.name + ': Error or no longer exists');
    }
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log('  Wallets with balance: ' + walletBalances.length);
  console.log('  Total in wallets:     ' + totalWalletAPT.toFixed(2) + ' APT');
  console.log('  Total in market TVL:  ' + totalTVL.toFixed(2) + ' APT');
  console.log('  GRAND TOTAL:          ' + (totalWalletAPT + totalTVL).toFixed(2) + ' APT');
  console.log('='.repeat(70));

  // Output top wallets
  console.log('\nTOP WALLETS (sorted by balance):');
  walletBalances.sort((a, b) => b.apt - a.apt);
  for (const w of walletBalances.slice(0, 10)) {
    console.log('  ' + w.addr.slice(0, 20) + '... : ' + w.apt.toFixed(2) + ' APT');
  }
}

main().catch(console.error);
