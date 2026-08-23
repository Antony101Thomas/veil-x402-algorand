import algosdk from 'algosdk';

const ADDRESS = 'BR6NL6ZONMJLIA7D42I3TYOHXFSSXR5NAGRVGPCOYCY7GPJ7HFPQKM3OYY';
const USDC_TESTNET_ASA_ID = 10458941;

async function main() {
  const client = new algosdk.Algodv2('', 'https://testnet-api.algonode.cloud', '');
  const info = await client.accountInformation(ADDRESS).do();

  const match = info.assets?.find(
    (a: any) => a.assetId === BigInt(USDC_TESTNET_ASA_ID) || a.assetId === USDC_TESTNET_ASA_ID
  );

  if (match) {
    console.log('✅ Opted in. Asset holding:', match);
  } else {
    console.log('❌ NOT opted in to asset', USDC_TESTNET_ASA_ID);
  }
}

main().catch((err) => {
  console.error('Check failed:', err);
  process.exit(1);
});