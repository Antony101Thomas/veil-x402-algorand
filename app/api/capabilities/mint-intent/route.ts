import { NextRequest, NextResponse } from 'next/server';
import algosdk from 'algosdk';
import { supabaseServer } from '@/lib/supabase-server';

const ALGOD_BASE_URL = process.env.ALGOD_TESTNET_URL ?? 'https://testnet-api.algonode.cloud';
const algodClient = new algosdk.Algodv2('', ALGOD_BASE_URL, '');

const ISSUER_MNEMONIC = process.env.CREATOR_MNEMONIC; // Issuer/Admin account
const PAY_TO_ADDRESS = process.env.PAY_TO;
const CAPABILITY_APP_ID = Number(process.env.VEIL_CAPABILITY_APP_ID || process.env.CAPABILITY_APP_ID || 0);

export async function POST(req: NextRequest) {
  try {
    if (!ISSUER_MNEMONIC || !PAY_TO_ADDRESS || !CAPABILITY_APP_ID) {
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }

    const issuerAccount = algosdk.mnemonicToSecretKey(ISSUER_MNEMONIC);
    const body = await req.json();
    const { resourceId, agentAddress, priceMicroAlgo } = body;

    if (!resourceId || !agentAddress || !priceMicroAlgo) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // 1. Generate Disposable Keypair
    const disposableAccount = algosdk.generateAccount();
    const credentialId = `CRED-${Date.now()}`;

    // 2. Build Atomic Transaction Group
    const suggestedParams = await algodClient.getTransactionParams().do();

    // Txn 1: Payment (Agent -> PAY_TO)
    const txn1 = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender: agentAddress,
      receiver: PAY_TO_ADDRESS,
      amount: priceMicroAlgo,
      suggestedParams,
    });

    // Txn 2: Fund Disposable Account (Issuer -> Disposable)
    // Send 0.1 ALGO to cover basic MBR/fees if needed
    const txn2 = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender: issuerAccount.addr,
      receiver: disposableAccount.addr,
      amount: 100_000, 
      suggestedParams,
    });

    // Txn 3: Create Capability App Call
    // Method signature: createCapability(string,string,string,uint64,uint64,address)void
    const appArgs = [
      new Uint8Array(Buffer.from('createCapability')), // wait, ABI method selector should be used
      // We will construct the ABI method call properly
    ];

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

    const expiryRound = BigInt(suggestedParams.firstValid) + BigInt(10000);
    const quota = BigInt(5); // Default quota for MVP

    const txn3 = algosdk.makeApplicationNoOpTxnFromObject({
      sender: issuerAccount.addr,
      appIndex: CAPABILITY_APP_ID,
      appArgs: [
        method.getSelector(),
        (method.args[0].type as algosdk.ABIType).encode(credentialId),
        (method.args[1].type as algosdk.ABIType).encode(resourceId),
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

    // Group the transactions
    const txns = [txn1, txn2, txn3];
    algosdk.assignGroupID(txns);

    // Sign Txn 2 and Txn 3
    const signedTxn2 = txn2.signTxn(issuerAccount.sk);
    const signedTxn3 = txn3.signTxn(issuerAccount.sk);

    // Write capability intent to DB
    await supabaseServer.from('capabilities').insert({
      credential_id: credentialId,
      resource_id: resourceId,
      action: 'READ',
      quota: Number(quota),
      expiry_round: Number(expiryRound),
      holder_address: disposableAccount.addr,
      revoked: false
    });

    return NextResponse.json({
      credentialId,
      disposablePrivateKey: Buffer.from(disposableAccount.sk).toString('base64'),
      unsignedGroup: [
        Buffer.from(txn1.toByte()).toString('base64'), // Txn 1 (unsigned)
        Buffer.from(signedTxn2).toString('base64'),    // Txn 2 (signed)
        Buffer.from(signedTxn3).toString('base64'),    // Txn 3 (signed)
      ]
    });
  } catch (err: any) {
    console.error('[mint-intent] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
