import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import algosdk from 'algosdk';

const ALGOD_BASE_URL = process.env.ALGOD_TESTNET_URL ?? 'https://testnet-api.algonode.cloud';
const algodClient = new algosdk.Algodv2('', ALGOD_BASE_URL, '');

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const credentialId = sessionId;
  
  const ISSUER_MNEMONIC = process.env.CREATOR_MNEMONIC;
  const CAPABILITY_APP_ID = Number(process.env.VEIL_CAPABILITY_APP_ID || process.env.CAPABILITY_APP_ID || 0);

  if (!ISSUER_MNEMONIC || !CAPABILITY_APP_ID) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  try {
    const issuerAccount = algosdk.mnemonicToSecretKey(ISSUER_MNEMONIC);
    const suggestedParams = await algodClient.getTransactionParams().do();

    const method = new algosdk.ABIMethod({
      name: 'revokeCapability',
      args: [{ type: 'string', name: 'credentialId' }],
      returns: { type: 'void' }
    });

    const appCallTxn = algosdk.makeApplicationNoOpTxnFromObject({
      sender: issuerAccount.addr,
      appIndex: CAPABILITY_APP_ID,
      appArgs: [
        method.getSelector(),
        (method.args[0].type as algosdk.ABIType).encode(credentialId)
      ],
      suggestedParams,
      boxes: [
        { appIndex: 0, name: new Uint8Array(Buffer.from('cap_' + credentialId)) }
      ]
    });

    const signedTxn = appCallTxn.signTxn(issuerAccount.sk);
    await algodClient.sendRawTransaction(signedTxn).do();
    await algosdk.waitForConfirmation(algodClient, appCallTxn.txID().toString(), 4);

    const { data } = await supabaseServer
      .from('capabilities')
      .update({ revoked: true, revoked_at: new Date().toISOString() })
      .eq('credential_id', credentialId)
      .select()
      .maybeSingle();

    return NextResponse.json({ session: data, success: true }, { status: 200 });
  } catch (err: any) {
    // Fallback DB update if on-chain fails or in dev mode
    await supabaseServer
      .from('capabilities')
      .update({ revoked: true, revoked_at: new Date().toISOString() })
      .eq('credential_id', credentialId);

    return NextResponse.json({ success: true, warning: 'DB revoked' }, { status: 200 });
  }
}
