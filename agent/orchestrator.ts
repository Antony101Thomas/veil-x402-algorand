import algosdk from 'algosdk';
import { wrapFetchWithPayment } from '@x402/fetch';
import { x402Client } from '@x402/core/client';
import { ExactAvmScheme, toClientAvmSigner, ALGORAND_TESTNET_CAIP2 } from '@x402/avm';

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
  client.register(ALGORAND_TESTNET_CAIP2, new ExactAvmScheme(signer));
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
): Promise<CapabilityRecord | null> {
  if (paymentResponse.status !== 200) return null;

  const credentialId =
    paymentResponse.headers.get('x-veil-credential-id') ??
    (paymentResponse.body as { credentialId?: string } | undefined)?.credentialId;

  if (!credentialId) return null;

  // TODO: call the generated VeilCapability typed client's getCapability()
  // readonly method here once contracts/veil_capability is deployed, e.g.:
  //   const cap = await veilCapabilityClient.getCapability({ credentialId });
  // For now this is a stub the team can fill in once the typed client exists.
  throw new Error('obtain_capability: wire up the VeilCapability typed client here');
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
): Promise<{ status: number; body: unknown }> {
  const res = await fetch(resource.endpoint, {
    headers: { 'x-veil-credential-id': credentialId },
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

    const summary = await summarize_data(paymentResult.body, callModel);

    return { status: 'ok', data: paymentResult.body, summary };
  } catch (err) {
    return { status: 'error', error: err instanceof Error ? err.message : 'Unknown error' };
  }
}