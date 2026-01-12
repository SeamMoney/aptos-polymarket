/**
 * Check all possible keys to find V3 creator
 */

import { Account, Ed25519PrivateKey } from '@aptos-labs/ts-sdk';

// All keys from config.yaml files
const ALL_KEYS = [
  // contracts/.aptos/config.yaml
  "0x48ee96658dd826f6541f5ee501c5784e6b341f04c52c641823f4b097b61eb79b", // default/deployer
  "0x6e2fca34586261b6f22a973c20024b78ddb370d87f7c974315fb97ba56716a7f", // fresh_deploy
  "0xa093ae401e44fb7469e9edad1327154f249d1306fd792e939d2ae54681ef20ec", // usd1_deploy
  "0xd7cb72edef8545c818ef9c7becc72ee0332bad7e0b2a0a12731d810d2765d611", // v2
  // .aptos/config.yaml
  "0xe5d99c1abaf058403e4c09785fc9418c3cdb34194cdaa68e9bf57a80bf563e0a", // default in root
];

const V3_ADDRESS = "0xa2e5e47aab07fed78a3bcf95135ee2dad20c547499c94cb16a3e047859ffa7e1";

console.log("Looking for key that maps to V3 creator:", V3_ADDRESS);
console.log("");

for (const key of ALL_KEYS) {
  try {
    const cleanKey = key.replace('0x', '').toLowerCase();
    const account = Account.fromPrivateKey({
      privateKey: new Ed25519PrivateKey(cleanKey),
    });
    const addr = account.accountAddress.toString();
    console.log(`${key.slice(0, 20)}... -> ${addr}`);

    if (addr.toLowerCase() === V3_ADDRESS.toLowerCase()) {
      console.log("\n*** FOUND V3 CREATOR! ***");
      console.log("Key:", key);
    }
  } catch (e) {
    console.log(`${key.slice(0, 20)}... -> ERROR`);
  }
}
