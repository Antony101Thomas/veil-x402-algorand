import algosdk from 'algosdk';
import { wrapFetchWithPayment } from '@x402/fetch';
import { x402Client } from '@x402/core/client';
import { ExactAvmScheme, toClientAvmSigner, ALGORAND_TESTNET_CAIP2 } from '@x402/avm';
import { ALGORAND_TESTNET_NETWORK } from "@/lib/constants";

/**
 * Veil Agent Orchestrator
 *
 * This is the controlled tool layer the blueprint describes in section 6:
 * the LLM only decides WHICH resource to fetch and how to summarize the
 * result. It never touches payment logic, the wallet, or capability
 * validation directly — those are fixed, deterministic tools it calls.
 *
 * Wire these six functions up as LLM tool definitions (function-calling
 * schema) in whatever SDK you're using for the model. The LLM's job is just
 * to call run() with a goal; run() drives the fixed sequence.
 */

// --- Types -------------------------------------------------------------

interface ResourceInfo {
  resourceId: string;
  endpoint: string;
  price: string; // display string, e.g. "0.05 USDC"
  description: string;
}

interface CapabilityRecord {
  credentialId: string;
  resourceId: string;
  action: string;
  quota: number;
  expiryRound: number;
  holder: string;
  revoked: boolean;
}

interface AgentResult {
  status: 'ok' | 'payment_failed' | 'access_denied' | 'error';
  data?: unknown;
  summary?: string;
  capability?: CapabilityRecord;
  error?: string;
}

// --- Fixed config (one resource, one payer, per the hackathon MVP scope) ---

const RESOURCE_SERVER_BASE = process.env.VEIL_RESOURCE_SERVER_URL ?? 'http://localhost:3000';
const AGENT_MNEMONIC = process.env.ALGORAND_PAYER_MNEMONIC;

function getPaymentClient() {
  if (!AGENT_MNEMONIC) throw new Error('ALGORAND_PAYER_MNEMONIC not set');
  const account = algosdk.mnemonicToSecretKey(AGENT_MNEMONIC);
  const privateKeyBase64 = Buffer.from(account.sk).toString('base64');
  const signer = toClientAvmSigner(privateKeyBase64);

  const client = new x402Client();
  client.register(ALGORAND_TESTNET_NETWORK, new ExactAvmScheme(signer));

  // --- temporary diagnostic hooks ---
  client.onBeforePaymentCreation(async (ctx: any) => {
    console.log('[x402] attempting payment for:', JSON.stringify(ctx.selectedRequirements ?? ctx, null, 2));
  });
  client.onPaymentCreationFailure(async (ctx: any) => {
    console.log('[x402] payment creation FAILED:', JSON.stringify(ctx, null, 2));
  });
  // --- end diagnostic hooks ---

  return client;
}

// --- Tool 1: discover_resource -----------------------------------------

/**
 * Finds the demo resource and its price. For the MVP this is a single
 * hardcoded resource per the blueprint's "constrain the agent to one known
 * resource" guidance — swap for a GET /api/resources call once that route
 * exists.
 */
export async function discover_resource(): Promise<ResourceInfo> {
  return {
    resourceId: 'premium-data',
    endpoint: `${RESOURCE_SERVER_BASE}/api/premium-data`,
    price: '0.05 USDC',
    description: 'Premium market data resource for demo purposes.',
  };
}

// --- Tool 2 + 3: request_resource + pay_x402 (combined) ----------------

/**
 * Requests the protected resource. If it comes back 402, the x402 client
 * automatically constructs and signs the payment, retries, and returns the
 * final response. This wraps request_resource + pay_x402 into one call
 * because @x402/fetch's wrapFetchWithPayment already handles the 402 →
 * pay → retry sequence internally — see the debugging session where we
 * traced this exact code path.
 */
export async function request_resource_with_payment(
  resource: ResourceInfo,
): Promise<{ status: number; body: unknown; headers: Headers }> {
  const client = getPaymentClient();
  const fetchWithPayment = wrapFetchWithPayment(fetch, client);

  const res = await fetchWithPayment(resource.endpoint);
  const text = await res.text();
  let body: unknown = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = text;
  }

  return { status: res.status, body, headers: res.headers };
}

// --- Tool 4: obtain_capability -------------------------------------------

/**
 * After a successful payment, the resource server should have already
 * created the on-chain capability (via VeilCapability.createCapability) and
 * returned its credentialId in the response headers or body. This tool just
 * reads that back for the dashboard / agent's own record-keeping — it does
 * NOT issue the capability itself (only the admin/server account can call
 * createCapability on-chain).
 *
 * Adjust the header/body field names once Person 3's resource server
 * settles on where it puts the credential id in the 200 response.
 */
export async function obtain_capability(
  paymentResponse: { status: number; body: unknown; headers: Headers },
): Promise<{ credentialId: string; disposablePrivateKeyBase64: string } | null> {
  if (paymentResponse.status !== 200) return null;

  const body = paymentResponse.body as any;
  const credentialId =
    paymentResponse.headers.get('x-veil-credential-id') ??
    body?.credentialId;
    
  const disposablePrivateKeyBase64 = body?.disposableKeyBase64;

  if (!credentialId || !disposablePrivateKeyBase64) return null;

  return { credentialId, disposablePrivateKeyBase64 };
}

// --- Tool 5: access_with_capability --------------------------------------

/**
 * Retries the protected resource using an already-issued capability rather
 * than paying again — this is the path exercised after the first payment,
 * within the quota window, before expiry/revocation.
 */
export async function access_with_capability(
  resource: ResourceInfo,
  credentialId: string,
  disposablePrivateKeyBase64: string
): Promise<{ status: number; body: unknown }> {
  // 1. Request a nonce
  const nonceRes = await fetch(`${RESOURCE_SERVER_BASE}/api/auth/nonce`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credentialId })
  });

  if (!nonceRes.ok) {
    return { status: nonceRes.status, body: { error: 'Failed to obtain nonce' } };
  }

  const { nonce } = await nonceRes.json();

  // 2. Sign the nonce with the disposable key
  const privateKeyBytes = Buffer.from(disposablePrivateKeyBase64, 'base64');
  const messageBytes = Buffer.from(nonce);
  const signatureBytes = algosdk.signBytes(messageBytes, privateKeyBytes);
  const signatureBase64 = Buffer.from(signatureBytes).toString('base64');

  // 3. Request the resource with the signed nonce
  const res = await fetch(resource.endpoint, {
    headers: { 
      'x-credential-id': credentialId,
      'x-nonce': nonce,
      'x-signature': signatureBase64
    },
  });
  
  const text = await res.text();
  let body: unknown = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

// --- Tool 6: summarize_data ----------------------------------------------

/**
 * Hands the returned data to the LLM for summarization. This is the ONE
 * place the LLM's reasoning actually touches the flow beyond picking the
 * resource — keep the prompt narrow and deterministic for demo reliability.
 */
export async function summarize_data(data: unknown, callModel: (prompt: string) => Promise<string>): Promise<string> {
  const prompt = `Summarize this market data for a user in 1-2 sentences:\n\n${JSON.stringify(data, null, 2)}`;
  return callModel(prompt);
}

// --- Orchestration entrypoint ---------------------------------------------

/**
 * The full end-to-end run the demo script calls. Deterministic sequence;
 * the LLM is only invoked inside summarize_data.
 */
export async function run(callModel: (prompt: string) => Promise<string>): Promise<AgentResult> {
  try {
    const resource = await discover_resource();
    const paymentResult = await request_resource_with_payment(resource);

    if (paymentResult.status === 402) {
      return { status: 'payment_failed', error: 'Payment was attempted but resource still returned 402.' };
    }
    if (paymentResult.status === 403) {
      return { status: 'access_denied', error: 'Capability revoked or invalid.' };
    }
    if (paymentResult.status !== 200) {
      return { status: 'error', error: `Unexpected status ${paymentResult.status}` };
    }

    // 1. Obtain capability
    const capInfo = await obtain_capability(paymentResult);
    if (!capInfo) {
      return { status: 'error', error: 'Failed to obtain capability from payment response.' };
    }

    // 2. Access with capability (proving it works without paying again!)
    const accessResult = await access_with_capability(resource, capInfo.credentialId, capInfo.disposablePrivateKeyBase64);
    
    if (accessResult.status !== 200) {
      return { status: 'error', error: `Capability access failed with status ${accessResult.status}. ${JSON.stringify(accessResult.body)}` };
    }

    const summary = await summarize_data(accessResult.body, callModel);

    return { status: 'ok', data: accessResult.body, summary };
  } catch (err) {
    return { status: 'error', error: err instanceof Error ? err.message : 'Unknown error' };
  }
}