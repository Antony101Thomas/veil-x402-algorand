import "../lib/load-env";
import algosdk from "algosdk";

async function main() {
  const mnemonic = process.env.ALGORAND_PAYER_MNEMONIC;
  if (!mnemonic) {
    throw new Error("Set ALGORAND_PAYER_MNEMONIC in your environment first.");
  }

  const account = algosdk.mnemonicToSecretKey(mnemonic);
  console.log("Opting in address:", account.addr);

  const algodClient = new algosdk.Algodv2(
    "",
    "https://testnet-api.algonode.cloud",
    ""
  );

  const USDC_TESTNET_ASA_ID = 10458941;

  const suggestedParams = await algodClient.getTransactionParams().do();

  const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: account.addr,
    receiver: account.addr,
    amount: 0,
    assetIndex: USDC_TESTNET_ASA_ID,
    suggestedParams,
  });

  const signedTxn = txn.signTxn(account.sk);
  const { txid } = await algodClient.sendRawTransaction(signedTxn).do();

  console.log("Opt-in transaction sent. TXID:", txid);

  await algosdk.waitForConfirmation(algodClient, txid, 4);
  console.log("Opt-in confirmed!");
}

main().catch((err) => {
  console.error("Opt-in failed:", err);
  process.exit(1);
});
