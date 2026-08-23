import 'dotenv/config';
import algosdk from 'algosdk';

const USDC_TESTNET_ASA_ID = 10458941;

async function main() {
  const mnemonic = process.env.PAY_TO_MNEMONIC;
  if (!mnemonic) {
    throw new Error('Set PAY_TO_MNEMONIC in .env.local first.');
  }

  const account = algosdk.mnemonicToSecretKey(mnemonic);
  console.log('Resuming setup for:', account.addr.toString());

  const algodClient = new algosdk.Algodv2('', 'https://testnet-api.algonode.cloud', '');

  const info: any = await algodClient.accountInformation(account.addr).do();
  const balance = Number(info.amount) / 1_000_000;
  console.log(`Current balance: ${balance} ALGO`);

  if (balance <= 0) {
    console.log('❌ Not funded yet. Fund it here: https://bank.testnet.algorand.network/');
    console.log('Then rerun this script.');
    return;
  }

  // Check if already opted in, to avoid double-submitting
  const alreadyOptedIn = info.assets?.some(
    (a: any) => a.assetId === BigInt(USDC_TESTNET_ASA_ID) || a.assetId === USDC_TESTNET_ASA_ID
  );

  if (alreadyOptedIn) {
    console.log('✅ Already opted into USDC. Nothing more to do — this account is ready.');
    return;
  }

  console.log('Funded. Opting into USDC (asset', USDC_TESTNET_ASA_ID, ')...');
  const suggestedParams = await algodClient.getTransactionParams().do();
  const optInTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: account.addr,
    receiver: account.addr,
    amount: 0,
    assetIndex: USDC_TESTNET_ASA_ID,
    suggestedParams,
  });
  const signedTxn = optInTxn.signTxn(account.sk);
  const { txid } = await algodClient.sendRawTransaction(signedTxn).do();
  console.log('Opt-in transaction sent. TXID:', txid);

  await algosdk.waitForConfirmation(algodClient, txid, 4);
  console.log('✅ Opt-in confirmed. This account can now receive USDC.');
}

main().catch((err) => {
  console.error('Resume setup failed:', err);
  process.exit(1);
});