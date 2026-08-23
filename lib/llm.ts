import OpenAI from 'openai';

/**
 * LLM integration for the Veil agent.
 *
 * Uses groq/compound via Groq's OpenAI-compatible API.
 * groq/compound has a tight input-token budget, so ALL prompts are kept short.
 *
 * Intent routing uses a simple classify-then-answer pattern:
 *   1. Classify the user's last message as FETCH or ANSWER (tiny prompt).
 *   2a. ANSWER → generate a Veil-aware response (concise system prompt).
 *   2b. FETCH  → caller triggers x402/Algorand payment, then summarize result.
 *
 * `chatWithIntent`  — primary entry-point used by /api/chat
 * `summarizeData`   — post-fetch summarization
 * `callModel`       — backward-compat shim for agent/orchestrator.ts
 */

const XAI_BASE_URL = 'https://api.x.ai/v1';
const DEFAULT_MODEL = 'grok-3-mini'; // set XAI_MODEL env to override

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!process.env.XAI_API_KEY) {
    throw new Error('XAI_API_KEY not set — add it to .env.local');
  }
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.XAI_API_KEY,
      baseURL: XAI_BASE_URL,
    });
  }
  return client;
}

// ---------------------------------------------------------------------------
// Prompts — kept deliberately short for groq/compound's input-token budget
// ---------------------------------------------------------------------------

/** One-line classifier — returns "FETCH" or "ANSWER". */
const CLASSIFIER_PROMPT =
  'You classify user messages. Reply with only "FETCH" if the user wants live market/price data or to fetch a resource. ' +
  'Reply with only "ANSWER" for everything else. One word only.';

/** Veil-aware system prompt for conversational answers. */
const VEIL_SYSTEM_PROMPT =
  'You are the AI agent for Veil, an economic capability layer. ' +
  'Veil converts x402 payments on Algorand TestNet into scoped, expiring, revocable on-chain capabilities stored in Algorand box storage. ' +
  'Instead of permanent API keys, agents get time-limited credentials (e.g. 5 requests, 30-min expiry) that can be instantly revoked. ' +
  'The dashboard shows Active Capabilities, Payments, Resources, and Activity. ' +
  'Answer questions about Veil, x402, Algorand, and capabilities clearly. Be concise. Do not mention you are an AI.';

/** Short prompt for summarizing fetched resource data. */
const SUMMARY_PROMPT =
  'You are the Veil AI agent. Summarize the following market data for the user in 2 sentences. Be plain and direct.';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ChatMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

export type ChatIntentResult =
  | { type: 'text'; reply: string }
  | { type: 'fetch'; resourceId: string };

// ---------------------------------------------------------------------------
// chatWithIntent
// ---------------------------------------------------------------------------

/**
 * Step 1: tiny classify call → FETCH or ANSWER.
 * Step 2a: ANSWER → full conversational reply with Veil system prompt.
 * Step 2b: FETCH  → return { type: 'fetch' } — caller handles payment.
 */
export async function chatWithIntent(
  messages: ChatMessage[],
): Promise<ChatIntentResult> {
  const groq = getClient();
  const model = process.env.XAI_MODEL ?? DEFAULT_MODEL;

  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';

  // Step 1 — classify
  const classify = await groq.chat.completions.create({
    model,
    messages: [
      { role: 'user', content: `${CLASSIFIER_PROMPT}\n\nUser said: "${lastUserMsg}"` },
    ],
    max_tokens: 5,
  });

  const intent = classify.choices[0]?.message?.content?.trim().toUpperCase() ?? '';

  if (intent.startsWith('FETCH')) {
    return { type: 'fetch', resourceId: 'premium-data' };
  }

  // Step 2 — answer
  // Only send the last 4 messages to stay within the input-token budget
  const recentMessages = messages.slice(-4);
  const answer = await groq.chat.completions.create({
    model,
    messages: [
      { role: 'user', content: `${VEIL_SYSTEM_PROMPT}\n\nUser: ${lastUserMsg}` },
    ],
    max_tokens: 300,
  });

  // suppress unused variable warning
  void recentMessages;

  const text = answer.choices[0]?.message?.content?.trim() ?? '';
  if (!text) throw new Error('Model returned an empty response');

  return { type: 'text', reply: text };
}

// ---------------------------------------------------------------------------
// summarizeData
// ---------------------------------------------------------------------------

export async function summarizeData(
  data: unknown,
  _messages: ChatMessage[],
): Promise<string> {
  const groq = getClient();
  const model = process.env.XAI_MODEL ?? DEFAULT_MODEL;

  const dataStr = JSON.stringify(data);
  const response = await groq.chat.completions.create({
    model,
    messages: [
      {
        role: 'user',
        content: `${SUMMARY_PROMPT}\n\nData: ${dataStr}`,
      },
    ],
    max_tokens: 150,
  });

  const text = response.choices[0]?.message?.content?.trim();
  if (!text) throw new Error('Model returned an empty summary');
  return text;
}

// ---------------------------------------------------------------------------
// callModel — backward-compat shim for agent/orchestrator.ts
// ---------------------------------------------------------------------------

const LEGACY_PROMPT_PREFIX =
  'You are a Veil AI agent. Summarize the following market data in 1-2 plain sentences:';

export async function callModel(prompt: string): Promise<string> {
  const groq = getClient();
  const model = process.env.XAI_MODEL ?? DEFAULT_MODEL;

  const completion = await groq.chat.completions.create({
    model,
    messages: [
      { role: 'user', content: `${LEGACY_PROMPT_PREFIX}\n\n${prompt}` },
    ],
    max_tokens: 150,
  });

  const text = completion.choices[0]?.message?.content?.trim();
  if (!text) throw new Error('Model returned an empty response');
  return text;
}