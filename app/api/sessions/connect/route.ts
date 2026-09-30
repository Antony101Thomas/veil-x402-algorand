import { NextRequest, NextResponse } from "next/server";
import { withX402, x402ResourceServer } from "@x402/next";
import { ExactAvmScheme } from "@x402/avm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { USDC_TESTNET_ASA_ID } from "@x402/avm";
import { ALGORAND_TESTNET_NETWORK } from "@/lib/constants";
import algosdk from 'algosdk';
import { supabaseServer } from '@/lib/supabase-server';

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
  description: "HyperDeck Cloud PC Session Access",
} as const;

let serverPromise: Promise<x402ResourceServer> | null = null;
function getServer() {
  if (!serverPromise) {
    const server = new x402ResourceServer(facilitatorClient)
      .register(ALGORAND_TESTNET_NETWORK, new ExactAvmScheme());
    serverPromise = server.initialize().then(() => server);
  }
  return serverPromise;
}

const ALGOD_BASE_URL = process.env.ALGOD_TESTNET_URL ?? 'https://testnet-api.algonode.cloud';
const algodClient = new algosdk.Algodv2('', ALGOD_BASE_URL, '');

async function handler(request: NextRequest) {
  let credentialId = "";
  let disposableKeyBase64 = "";
  const { searchParams } = new URL(request.url);
  const rigId = searchParams.get('rig') || 'rig-starter';
  const hours = parseInt(searchParams.get('hours') || '2', 10);

  try {
    const ISSUER_MNEMONIC = process.env.CREATOR_MNEMONIC;
    const CAPABILITY_APP_ID = Number(process.env.VEIL_CAPABILITY_APP_ID || process.env.CAPABILITY_APP_ID || 0);

    if (ISSUER_MNEMONIC && CAPABILITY_APP_ID) {
      const issuerAccount = algosdk.mnemonicToSecretKey(ISSUER_MNEMONIC);
      const disposableAccount = algosdk.generateAccount();
      credentialId = `HD-SESS-${Date.now()}`;
      disposableKeyBase64 = Buffer.from(disposableAccount.sk).toString('base64');

      const suggestedParams = await algodClient.getTransactionParams().do();
      const expiryRound = BigInt(suggestedParams.firstValid) + BigInt(hours * 1000);
      const quota = BigInt(10);

      const fundTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: issuerAccount.addr,
        receiver: disposableAccount.addr,
        amount: 100_000,
        suggestedParams,
      });

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
          (method.args[1].type as algosdk.ABIType).encode(rigId),
          (method.args[2].type as algosdk.ABIType).encode('CONNECT'),
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
        resource_id: rigId,
        action: 'CONNECT',
        quota: Number(quota),
        expiry_round: Number(expiryRound),
        holder_address: disposableAccount.addr,
        revoked: false
      });
    }
  } catch (e) {
    console.error("Session creation failed:", e);
  }

  const response = NextResponse.json({
    status: "connected",
    rigId,
    durationHours: hours,
    connectionUrl: `rdp://hyperdesk.io/session/${credentialId || 'demo'}`,
    streamToken: `tok_${Math.random().toString(36).substring(2, 10)}`,
    expiresInSeconds: hours * 3600,
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
      const { verifyCapabilityAccess } = await import('@/lib/capability-auth');
      try {
        await verifyCapabilityAccess(credId, nonce, signature, 'rig-starter', 'CONNECT');
        return handler(request);
      } catch (capErr: any) {
        return NextResponse.json({ error: capErr.message || 'Forbidden' }, { status: 403 });
      }
    }

    const server = await getServer();
    return withX402(handler, routeConfig, server)(request);
  } catch (err) {
    console.error("x402 session route init failed:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
