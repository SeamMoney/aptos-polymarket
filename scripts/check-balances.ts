import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';

async function main() {
  const aptos = new Aptos(new AptosConfig({
    network: Network.TESTNET,
    fullnode: 'https://aptos.cash.trading/v1'
  }));

  const accounts = [
    '0x1bd17a9cb5a55a414de956128e332f7744ef260bbdc49303a08105c986adbda3',
    '0xe1da81e8ff7ccd23c6945675d1ea79ce0382f089824f4dc6b4ed60c0c6f46e87',
    '0x2acdcdacc93b1d4a7a188b19c10b7f5fe0b71dcbe7b0d2108d49bdd50af46ea3',
    '0x8e85363cefcf8308d6342b025f65be682807373791cbababf2c7988f02503dd8',
  ];

  let total = 0;
  console.log('=== CURRENT APT BALANCES ===\n');
  for (const addr of accounts) {
    try {
      const balance = await aptos.getAccountAPTAmount({ accountAddress: addr });
      const apt = balance / 100000000;
      console.log(addr.slice(0,12) + '...: ' + apt.toFixed(2) + ' APT');
      total += apt;
    } catch (e: any) {
      console.log(addr.slice(0,12) + '...: ERROR - ' + e.message);
    }
  }
  console.log('');
  console.log('TOTAL (4 sample accounts): ' + total.toFixed(2) + ' APT');
  console.log('Average per account: ' + (total/4).toFixed(2) + ' APT');
  console.log('');
  console.log('=== COST ANALYSIS ===');
  console.log('Original per account: ~24,842 APT');
  const spent = 24842 - (total/4);
  console.log('Spent per account: ~' + spent.toFixed(2) + ' APT');
  console.log('');
  console.log('=== 30K TPS COST ESTIMATE ===');
  // Each trade costs ~0.001 APT in gas
  // 30K TPS * 60 seconds = 1.8M transactions
  // 1.8M * 0.001 APT = 1,800 APT in gas
  // Plus ~0.01 APT collateral per trade (buying outcome tokens)
  console.log('At 30K TPS for 60 seconds:');
  console.log('  Total transactions: 1,800,000');
  console.log('  Gas cost (~0.001 APT/tx): ~1,800 APT');
  console.log('  Collateral (~0.01 APT/trade): ~18,000 APT');
  console.log('  TOTAL ESTIMATED: ~20,000 APT');
}
main();
