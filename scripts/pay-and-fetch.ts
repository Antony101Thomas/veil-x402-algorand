import algosdk from "algosdk";
import { wrapFetchWithPayment } from "@x402/fetch";
import { x402Client } from "@x402/core/client";
import { ExactAvmScheme, toClientAvmSigner, ALGORAND_TESTNET_CAIP2 } from "@x402/avm";

async function main() {
  const mnemonic = process.env.ALGORAND_PAYER_MNEMONIC;
  if (!mnemonic) throw new Error("Set ALGORAND_PAYER_MNEMONIC first.");

  const account = algosdk.mnemonicToSecretKey(mnemonic);
  const privateKeyBase64 = Buffer.from(account.sk).toString("base64");
  const signer = toClientAvmSigner(privateKeyBase64);

  const client = new x402Client();
  client.register(ALGORAND_TESTNET_CAIP2, new ExactAvmScheme(signer));

  const fetchWithPayment = wrapFetchWithPayment(fetch, client);

  console.log("Requesting resource with automatic payment handling...");
  const res = await fetchWithPayment("http://localhost:3000/api/premium-data");

  console.log("Status:", res.status);
  console.log("All headers:");
  for (const [key, value] of res.headers.entries()) {
    console.log(`  ${key}: ${value}`);
  }
  const text = await res.text();
  console.log("Raw body:", text);
}

main().catch((err) => {
  console.error("Client failed:", err);
  process.exit(1);
});
