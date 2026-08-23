import algosdk from 'algosdk';
import { supabaseServer } from './supabase-server';

const ALGOD_BASE_URL = process.env.ALGOD_TESTNET_URL ?? 'https://testnet-api.algonode.cloud';
const algodClient = new algosdk.Algodv2('', ALGOD_BASE_URL, '');

// ID of the deployed VeilCapability contract (needs to be in env or constants)
const CAPABILITY_APP_ID = Number(process.env.CAPABILITY_APP_ID || 0);

export async function verifyCapabilityAccess(
  credentialId: string,
  nonce: string,
  signatureBase64: string,
  requiredResource: string,
  requiredAction: string
) {
  // 1. Verify the nonce is valid and unused
  const { data: nonceRecord, error: nonceError } = await supabaseServer
    .from('nonces')
    .select('*')
    .eq('nonce', nonce)
    .eq('credential_id', credentialId)
    .eq('used', false)
    .maybeSingle();

  if (nonceError || !nonceRecord) {
    throw new Error('Invalid, missing, or already used nonce');
  }

  if (new Date(nonceRecord.expires_at) < new Date()) {
    throw new Error('Nonce expired');
  }

  // Mark nonce as used
  await supabaseServer.from('nonces').update({ used: true }).eq('nonce', nonce);

  // 2. Fetch authoritative capability state from Algorand Box Storage
  // The box key is "cap_" + credentialId
  const boxKey = new Uint8Array(Buffer.from('cap_' + credentialId));
  let boxData: Uint8Array;
  try {
    const boxResponse = await algodClient.getApplicationBoxByName(CAPABILITY_APP_ID, boxKey).do();
    boxData = boxResponse.name; // Algodv2 returns { name: Uint8Array, value: Uint8Array }
    boxData = boxResponse.value;
  } catch (err) {
    throw new Error('Capability not found on-chain');
  }

  // 3. Decode the capability box data
  // Tuple format from contract: resourceId (String), action (String), quota (Uint64), expiryRound (Uint64), holder (Address), revoked (Bool)
  // We'll use algosdk ABIType to decode.
  const tupleType = algosdk.ABIType.from('(string,string,uint64,uint64,address,bool)');
  const decoded = tupleType.decode(boxData) as any[];

  const capResource = decoded[0] as string;
  const capAction = decoded[1] as string;
  const capQuota = Number(decoded[2]);
  const capExpiryRound = Number(decoded[3]);
  const capHolder = decoded[4] as string;
  const capRevoked = decoded[5] as boolean;

  // 4. Verify the signature
  const signatureBytes = Buffer.from(signatureBase64, 'base64');
  // Message format usually matches what the client signed. We assume client signs the raw nonce string.
  const messageBytes = Buffer.from(nonce);
  const isValidSignature = algosdk.verifyBytes(messageBytes, signatureBytes, capHolder);
  
  if (!isValidSignature) {
    throw new Error('Invalid signature for the capability holder');
  }

  // 5. Check Resource and Action scope
  if (capResource !== requiredResource) {
    throw new Error(`Scope mismatch: capability is for ${capResource}, not ${requiredResource}`);
  }
  if (capAction !== requiredAction) {
    throw new Error(`Action mismatch: capability is for ${capAction}, not ${requiredAction}`);
  }

  // 6. Check Expiry
  const status = await algodClient.status().do();
  const currentRound = (status as any).lastRound || (status as any)['last-round'];
  if (currentRound > capExpiryRound) {
    throw new Error(`Capability expired at round ${capExpiryRound} (current: ${currentRound})`);
  }

  // 7. Check Revocation
  if (capRevoked) {
    throw new Error('Capability has been revoked by the provider');
  }

  // 8. Check Quota (cached off-chain for MVP performance, but we can check the on-chain value as the max ceiling)
  const { data: dbCap } = await supabaseServer
    .from('capabilities')
    .select('quota_used')
    .eq('credential_id', credentialId)
    .single();

  const quotaUsed = dbCap?.quota_used || 0;
  if (quotaUsed >= capQuota) {
    throw new Error('Capability quota exhausted');
  }

  // 9. Increment Quota Used in DB
  await supabaseServer
    .from('capabilities')
    .update({ quota_used: quotaUsed + 1 })
    .eq('credential_id', credentialId);

  return { success: true, holder: capHolder };
}
