/**
 * Fund 10 additional accounts for 10k+ TPS
 */

import { Aptos, AptosConfig, Network, Account, Ed25519PrivateKey } from '@aptos-labs/ts-sdk';

const DEPLOYER_KEY = "0x48ee96658dd826f6541f5ee501c5784e6b341f04c52c641823f4b097b61eb79b";

// 10 NEW accounts for more parallelism
const NEW_KEYS = [
  "ed25519-priv-0xC5BA2ED0F5C40EE298E844B1140B6BB31C2671B747C8E9DF4B76054C4C5A8761",
  "ed25519-priv-0x536C886483209657C9B30663B295C7CB007EB57E07931D3E41AF69067897D465",
  "ed25519-priv-0x3E9CB6207207A266F298B1B13648D707BF886766221C3253F30AF68530A79749",
  "ed25519-priv-0x4641D0FDD221B48EF4A45C8DC77D6D4F12D6848E01B7686134564A8CAE5BE637",
  "ed25519-priv-0xFB2AFF37DFED247E9CF407FFA41208A41A78877C1990ADD1F94E00FCE1A5CCAC",
  "ed25519-priv-0x9E338A7FB43F8280CCD82B2929B66F4ED1B7AA7900C40E06EAD934BC7CDEF315",
  "ed25519-priv-0x8E7D4B0196840DA3A7BA6EDEF3784E1B961263F06651B130F440F5D974920B1F",
  "ed25519-priv-0x975CF351CE096E1350C9F9E89ED5CB8D7BEAAEBF7FC235B10F1A0852355EED7A",
  "ed25519-priv-0xD945B44FCFA961B9E4F8DAA5139CF6B4CE9A1DF4838C75701EDC8A429739C097",
  "ed25519-priv-0x292A25EDBE90DCB5F682908C1E7185E1CC127FAD74EEA218167115AA5962866C",
];

const AMOUNT_PER_WALLET = 80_00_000_000; // 80 APT each (enough for micro-trades)

async function main() {
  const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));

  const deployer = Account.fromPrivateKey({
    privateKey: new Ed25519PrivateKey(DEPLOYER_KEY),
  });

  console.log('Funding 10 new accounts for 10k TPS...');
  console.log(`Deployer: ${deployer.accountAddress.toString()}`);

  const balance = await aptos.getAccountAPTAmount({ accountAddress: deployer.accountAddress });
  console.log(`Balance: ${(balance / 1e8).toFixed(2)} APT`);

  let funded = 0;

  for (let i = 0; i < NEW_KEYS.length; i++) {
    try {
      const recipient = Account.fromPrivateKey({
        privateKey: new Ed25519PrivateKey(NEW_KEYS[i]),
      });

      console.log(`[${i + 1}/10] ${recipient.accountAddress.toString().slice(0, 12)}...`);

      const tx = await aptos.transferCoinTransaction({
        sender: deployer.accountAddress,
        recipient: recipient.accountAddress,
        amount: AMOUNT_PER_WALLET,
      });

      const pendingTx = await aptos.signAndSubmitTransaction({
        signer: deployer,
        transaction: tx,
      });

      await aptos.waitForTransaction({ transactionHash: pendingTx.hash });
      console.log(`  ✓ Sent 80 APT`);
      funded++;

      await new Promise(r => setTimeout(r, 300));
    } catch (e: any) {
      console.log(`  ✗ Error: ${e.message.slice(0, 50)}`);
    }
  }

  console.log(`\n✓ Funded ${funded}/10 new accounts`);

  // Print combined keys for ULTRA_PRIVATE_KEYS
  console.log('\n--- ALL 20 KEYS FOR ULTRA_PRIVATE_KEYS ---');
  const allKeys = [
    "0x6e2fca34586261b6f22a973c20024b78ddb370d87f7c974315fb97ba56716a7f",
    "0xe61d22b3dc37c537a20d5b301c4d2b409b2f93cd7b2915f3518d49517c2ab6c4",
    "0x4542c2e4a39beee8202eee0cddeceea886687b21b54b8f50c17e729251fdd7f5",
    "0xcf5154af9664bbc2634fddfcce2317ed788b35de7f004ac0e24aefd68a0b10c5",
    "ed25519-priv-0xb7d1f406e48c2eddffe987f98445dd4a353e8e9d1630d878621ded084bdd77c7",
    "ed25519-priv-0xa8088ee787b847f6304807a8b09d1afc15409082ee9c8b7eda6919b0ecb86ea8",
    "ed25519-priv-0xb5305eb83498dcba61242ccc91fac35263d9b44bddaf5e7417adbaceb1cfcb36",
    "ed25519-priv-0xc27a6a8b6ed3013da99dc924b2f6af17f1448dedce91691f97d9e778c0761655",
    "ed25519-priv-0xd6402b3493af005ed02b07f6cd7ffdfd37fae6d4d9c88fec6ff38e90f01b21c1",
    "ed25519-priv-0xd375af1a686835905e15bf82f24fcaeed4b1b5b5fabe22c80e998acb804aa295",
    ...NEW_KEYS,
  ];
  console.log(allKeys.join(','));
}

main().catch(console.error);
