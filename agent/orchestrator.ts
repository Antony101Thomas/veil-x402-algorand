import algosdk from 'algosdk';
import { wrapFetchWithPayment } from '@x402/fetch';
import { x402Client } from '@x402/core/client';
import { ExactAvmScheme, toClientAvmSigner, ALGORAND_TESTNET_CAIP2 } from '@x402/avm';
import { ALGORAND_TESTNET_NETWORK } from "@/lib/constants";

/**
 * NovaDeck Agent Orchestrator
 *
 * Tool-using autonomous workflow for NovaDeck Cloud PC sessions.
 * The LLM only decides WHICH rig to request and how to summarize the result.
 * It never touches payment logic, the wallet, or session validation directly.
 *
 * Tools:
 *  1. discover_rig()          — pick a rig by use-case
 *  2. request_session_with_payment() — x402 pay + session establish
 *  3. obtain_session_credential()    — extract credential from payment response
 *  4. access_with_session()          — prove credential ownership, get connection
 *  5. summarize_session()            — LLM summarizes session info for user
 */

// --- Types ---

interface RigInfo {
  rigId: string;
  endpoint: string;
  pricePerHour: number;
  durationHours: number;
  description: string;
}

interface SessionCredential {
  credentialId: string;
  disposablePrivateKeyBase64: string;
}

interface AgentResult {
  status: 'ok' | 'payment_failed' | 'access_denied' | 'error';
  data?: unknown;
  summary?: string;
  credential?: SessionCredential;
  error?: string;
}

// --- Config ---

const RESOURCE_SERVER_BASE = process.env.VEIL_RESOURCE_SERVER_URL ?? 'http://localhost:3000';
const AGENT_MNEMONIC = process.env.ALGORAND_PAYER_MNEMONIC;

function getPaymentClient() {
  if (!AGENT_MNEMONIC) throw new Error('ALGORAND_PAYER_MNEMONIC not set');
  const account = algosdk.mnemonicToSecretKey(AGENT_MNEMONIC);
  const privateKeyBase64 = Buffer.from(account.sk).toString('base64');
  const signer = toClientAvmSigner(privateKeyBase64);

  const client = new x402Client();
  client.register(ALGORAND_TESTNET_NETWORK, new ExactAvmScheme(signer));

  // Diagnostic hooks
  client.onBeforePaymentCreation(async (ctx: any) => {
    console.log('[x402] attempting payment for:', JSON.stringify(ctx.selectedRequirements ?? ctx, null, 2));
  });
  client.onPaymentCreationFailure(async (ctx: any) => {
    console.log('[x402] payment creation FAILED:', JSON.stringify(ctx, null, 2));
  });

  return client;
}

// --- Tool 1: discover_rig ---

/**
 * Discovers an available rig matching the requested use-case.
 * For the MVP this returns the beast rig by default.
 */
export async function discover_rig(
  useCase: 'gaming' | 'editing' | 'ai' | 'rendering' = 'gaming',
  durationHours: number = 2
): Promise<RigInfo> {
  const rigMap: Record<string, string> = {
    gaming: 'rig-beast',
    editing: 'rig-pro',
    ai: 'rig-pro',
    rendering: 'rig-beast',
  };

  const rigId = rigMap[useCase] ?? 'rig-starter';

  return {
    rigId,
    endpoint: `${RESOURCE_SERVER_BASE}/api/sessions/connect?rig=${rigId}&hours=${durationHours}`,
    pricePerHour: { 'rig-starter': 0.50, 'rig-pro': 1.50, 'rig-beast': 3.00 }[rigId] ?? 0.50,
    durationHours,
    description: `NovaDeck cloud PC session — ${rigId} for ${durationHours} hour(s).`,
  };
}

// --- Tool 2: request_session_with_payment ---

/**
 * Requests a NovaDeck session. If it comes back 402, the x402 client
 * automatically constructs and signs the payment on Algorand, retries,
 * and returns the final response.
 */
export async function request_session_with_payment(
  rig: { endpoint: string; [key: string]: any },
): Promise<{ status: number; body: unknown; headers: Headers }> {
  const client = getPaymentClient();
  const fetchWithPayment = wrapFetchWithPayment(fetch, client);

  const res = await fetchWithPayment(rig.endpoint);
  const text = await res.text();
  let body: unknown = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = text;
  }

  return { status: res.status, body, headers: res.headers };
}

// --- Tool 3: obtain_session_credential ---

/**
 * Extracts the session credential from the payment response.
 */
export async function obtain_session_credential(
  paymentResponse: { status: number; body: unknown; headers: Headers },
): Promise<SessionCredential | null> {
  if (paymentResponse.status !== 200) return null;

  const body = paymentResponse.body as any;
  const credentialId =
    paymentResponse.headers.get('x-veil-credential-id') ??
    body?.credentialId;

  const disposablePrivateKeyBase64 = body?.disposableKeyBase64;

  if (!credentialId || !disposablePrivateKeyBase64) return null;

  return { credentialId, disposablePrivateKeyBase64 };
}

// --- Tool 4: access_with_session ---

/**
 * Re-accesses the session using the stored credential + nonce/signature,
 * proving ownership without paying again.
 */
export async function access_with_session(
  rig: { endpoint: string; [key: string]: any },
  credentialId: string,
  disposablePrivateKeyBase64: string
): Promise<{ status: number; body: unknown }> {
  // 1. Request a nonce
  const nonceRes = await fetch(`${RESOURCE_SERVER_BASE}/api/auth/nonce`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credentialId }),
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

  // 3. Request the session endpoint with the signed nonce
  const res = await fetch(rig.endpoint, {
    headers: {
      'x-credential-id': credentialId,
      'x-nonce': nonce,
      'x-signature': signatureBase64,
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

// --- Tool 5: summarize_session ---

/**
 * Hands the session data to the LLM for a concise user-facing summary.
 */
export async function summarize_session(
  data: unknown,
  callModel: (prompt: string) => Promise<string>
): Promise<string> {
  const prompt = `Summarize this NovaDeck cloud PC session info for a user in 1-2 sentences:\n\n${JSON.stringify(data, null, 2)}`;
  return callModel(prompt);
}

// --- Orchestration entrypoint ---

/**
 * Full end-to-end NovaDeck session acquisition.
 * The LLM is only invoked inside summarize_session.
 */
export async function run(
  callModel: (prompt: string) => Promise<string>,
  options: { useCase?: 'gaming' | 'editing' | 'ai' | 'rendering'; durationHours?: number } = {}
): Promise<AgentResult> {
  try {
    const rig = await discover_rig(options.useCase ?? 'gaming', options.durationHours ?? 2);
    const paymentResult = await request_session_with_payment(rig);

    if (paymentResult.status === 402) {
      return { status: 'payment_failed', error: 'Payment was attempted but session still returned 402.' };
    }
    if (paymentResult.status === 403) {
      return { status: 'access_denied', error: 'Session credential revoked or invalid.' };
    }
    if (paymentResult.status !== 200) {
      return { status: 'error', error: `Unexpected status ${paymentResult.status}` };
    }

    // Obtain session credential
    const credential = await obtain_session_credential(paymentResult);
    if (!credential) {
      return { status: 'error', error: 'Failed to obtain session credential from payment response.' };
    }

    // Prove ownership via nonce/signature
    const accessResult = await access_with_session(
      rig,
      credential.credentialId,
      credential.disposablePrivateKeyBase64
    );

    if (accessResult.status !== 200) {
      return {
        status: 'error',
        error: `Session access failed with status ${accessResult.status}. ${JSON.stringify(accessResult.body)}`,
      };
    }

    const summary = await summarize_session(accessResult.body, callModel);

    return { status: 'ok', data: accessResult.body, summary, credential };
  } catch (err) {
    return { status: 'error', error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

// --- Backward compatibility aliases ---
export const discover_resource = async () => {
  const rig = await discover_rig('gaming', 2);
  return {
    resourceId: rig.rigId,
    endpoint: rig.endpoint,
    price: `${rig.pricePerHour} USDC`,
    description: rig.description,
  };
};

export const request_resource_with_payment = request_session_with_payment;
export const obtain_capability = obtain_session_credential;
export const access_with_capability = access_with_session;