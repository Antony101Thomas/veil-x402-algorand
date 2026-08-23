import { NextRequest, NextResponse } from "next/server";
import { withX402, x402ResourceServer } from "@x402/next";
import { ExactAvmScheme } from "@x402/avm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { USDC_TESTNET_ASA_ID } from "@x402/avm";
import { ALGORAND_TESTNET_NETWORK } from "@/lib/constants";

const facilitatorClient = new HTTPFacilitatorClient({
  url: process.env.FACILITATOR_URL || "https://facilitator.goplausible.xyz",
});

const routeConfig = {
  accepts: {
    scheme: "exact",
    network: ALGORAND_TESTNET_NETWORK,
    payTo: process.env.PAY_TO!,
    price: "$0.05",
    extra: { asset: USDC_TESTNET_ASA_ID },
  },
  description: "Premium market data resource for demo purposes.",
} as const;

// memoized so we don't re-initialize on every request in the same runtime
let serverPromise: Promise<x402ResourceServer> | null = null;
function getServer() {
  if (!serverPromise) {
    const server = new x402ResourceServer(facilitatorClient)
      .register(ALGORAND_TESTNET_NETWORK, new ExactAvmScheme());
    serverPromise = server.initialize().then(() => server); // ← the missing call
  }
  return serverPromise;
}

import algosdk from 'algosdk';
import { supabaseServer } from '@/lib/supabase-server';

const ALGOD_BASE_URL = process.env.ALGOD_TESTNET_URL ?? 'https://testnet-api.algonode.cloud';
const algodClient = new algosdk.Algodv2('', ALGOD_BASE_URL, '');

async function handler(request: NextRequest) {
  let credentialId = "";
  let disposableKeyBase64 = "";

  try {
    // Mint capability logic for the MVP
    const ISSUER_MNEMONIC = process.env.CREATOR_MNEMONIC;
    const CAPABILITY_APP_ID = Number(process.env.VEIL_CAPABILITY_APP_ID || process.env.CAPABILITY_APP_ID || 0);

    if (ISSUER_MNEMONIC && CAPABILITY_APP_ID) {
      const issuerAccount = algosdk.mnemonicToSecretKey(ISSUER_MNEMONIC);
      const disposableAccount = algosdk.generateAccount();
      credentialId = `CRED-${Date.now()}`;
      disposableKeyBase64 = Buffer.from(disposableAccount.sk).toString('base64');

      const suggestedParams = await algodClient.getTransactionParams().do();
      const expiryRound = BigInt(suggestedParams.firstValid + 10000);
      const quota = BigInt(5);

      // Txn 1: Fund disposable account
      const fundTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: issuerAccount.addr,
        receiver: disposableAccount.addr,
        amount: 100_000,
        suggestedParams,
      });

      // Txn 2: App Call to createCapability
      const method = new algosdk.ABIMethod({
        name: 'createCapability',
        args: [
          { type: 'string', name: 'credentialId' },
          { type: 'string', name: 'resourceId' },
          { type: 'string', name: 'action' },
          { type: 'uint64', name: 'quota' },
          { type: 'uint64', name: 'expiryRound' },
          { type: 'address', name: 'holder' }
        ],
        returns: { type: 'void' }
      });

      const appCallTxn = algosdk.makeApplicationNoOpTxnFromObject({
        sender: issuerAccount.addr,
        appIndex: CAPABILITY_APP_ID,
        appArgs: [
          method.getSelector(),
          (method.args[0].type as algosdk.ABIType).encode(credentialId),
          (method.args[1].type as algosdk.ABIType).encode('premium-data'),
          (method.args[2].type as algosdk.ABIType).encode('READ'),
          (method.args[3].type as algosdk.ABIType).encode(quota),
          (method.args[4].type as algosdk.ABIType).encode(expiryRound),
          (method.args[5].type as algosdk.ABIType).encode(disposableAccount.addr)
        ],
        suggestedParams,
        boxes: [
          { appIndex: 0, name: new Uint8Array(Buffer.from('cap_' + credentialId)) }
        ]
      });

      algosdk.assignGroupID([fundTxn, appCallTxn]);
      const signedFund = fundTxn.signTxn(issuerAccount.sk);
      const signedAppCall = appCallTxn.signTxn(issuerAccount.sk);

      await algodClient.sendRawTransaction([signedFund, signedAppCall]).do();

      // Mirror to DB
      await supabaseServer.from('capabilities').insert({
        credential_id: credentialId,
        resource_id: 'premium-data',
        action: 'READ',
        quota: Number(quota),
        expiry_round: Number(expiryRound),
        holder_address: disposableAccount.addr,
        revoked: false
      });
    }
  } catch (e) {
    console.error("Capability minting failed:", e);
    // Proceed to return data anyway for resilience if capability generation fails
  }

  const response = NextResponse.json({
    asset: "ALGO",
    price: 0.214,
    change24h: "+4.8%",
    volume: "2.4M",
    marketStatus: "OPEN",
    credentialId,
    disposableKeyBase64
  });

  if (credentialId) {
    response.headers.set('x-veil-credential-id', credentialId);
  }

  return response;
}

export async function GET(request: NextRequest) {
  try {
    const credId = request.headers.get("x-credential-id");
    const nonce = request.headers.get("x-nonce");
    const signature = request.headers.get("x-signature");

    if (credId && nonce && signature) {
      // Import dynamically to avoid circular dependencies if any
      const { verifyCapabilityAccess } = await import('@/lib/capability-auth');
      
      try {
        await verifyCapabilityAccess(credId, nonce, signature, 'premium-data', 'READ');
        return handler(request); // Capability is valid! Return data directly.
      } catch (capErr: any) {
        return NextResponse.json({ error: capErr.message || 'Forbidden' }, { status: 403 });
      }
    }

    // No capability presented, fall back to requiring payment
    const server = await getServer();
    return withX402(handler, routeConfig, server)(request);
  } catch (err) {
    console.error("x402 route init failed:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}