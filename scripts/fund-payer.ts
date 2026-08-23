import "../lib/load-env";
import algosdk from "algosdk";

async function main() {
  const senderMnemonic = process.env.SENDER_MNEMONIC; // the account holding 20 USDC (AQ3AE4...)
  if (!senderMnemonic) throw new Error("Set SENDER_MNEMONIC to the mnemonic of the funded USDC account.");

 const RECEIVER = "6S23FVFSKHIPOKHB67CKQ4D6BX5GH3DXEZE2SDEZBPAYPNF2S2YMCHL4RM"; // payer account (derived from ALGORAND_AGENT_MNEMONIC in .env.local)// payer account
  const USDC_ASSET_ID = 10458941;
  const AMOUNT = 5_000_000; // 5 USDC, assuming 6 decimals — adjust if needed

  const algod = new algosdk.Algodv2("", "https://testnet-api.algonode.cloud", "");
  const sender = algosdk.mnemonicToSecretKey(senderMnemonic);

  const params = await algod.getTransactionParams().do();

  const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: sender.addr,
    receiver: RECEIVER,
    amount: AMOUNT,
    assetIndex: USDC_ASSET_ID,
    suggestedParams: params,
  });

  const signedTxn = txn.signTxn(sender.sk);
  const { txid } = await algod.sendRawTransaction(signedTxn).do();
  console.log("Submitted, txid:", txid);

  const result = await algosdk.waitForConfirmation(algod, txid, 4);
  console.log("Confirmed in round:", result.confirmedRound);
}

main().catch((err) => {
  console.error("Transfer failed:", err);
  process.exit(1);
});
