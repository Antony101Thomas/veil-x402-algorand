import OpenAI from 'openai';

/**
 * LLM integration for the Veil agent.
 *
 * Uses groq/compound via Groq's OpenAI-compatible API.
 * groq/compound has a tight input-token budget so ALL prompts are compact.
 *
 * Known quirks of groq/compound that this file works around:
 *  - It leaks chain-of-thought ("Reasoning and extraction", "Two-sentence summary"
 *    headers) into completions. stripReasoning() removes this before returning.
 *  - Short contextual replies ("yes", "ok") 413 when sent with a long system
 *    prompt. The classifier skips the system prompt entirely.
 *  - Context-less one-word replies ("yes") need prior conversation context to
 *    classify correctly, so we pass the last assistant + user turn to the
 *    classifier.
 */

function getBaseUrl() {
  const key = process.env.XAI_API_KEY || '';
  if (key.startsWith('sk-or-')) return 'https://openrouter.ai/api/v1';
  if (key.startsWith('gsk_')) return 'https://api.groq.com/openai/v1';
  return 'https://api.x.ai/v1';
}

function getModel() {
  const key = process.env.XAI_API_KEY || '';
  if (key.startsWith('sk-or-')) return process.env.XAI_MODEL || 'openrouter/free'; // Reliable auto-routing free model
  if (key.startsWith('gsk_')) return 'groq/compound'; // User's Groq model
  return process.env.XAI_MODEL || 'grok-3-mini';
}

let client: OpenAI | null = null;

export function getClient(): OpenAI {
  if (!process.env.XAI_API_KEY) {
    throw new Error('XAI_API_KEY not set — add it to .env.local');
  }
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.XAI_API_KEY,
      baseURL: getBaseUrl(),
    });
  }
  return client;
}

// ---------------------------------------------------------------------------
// Reasoning stripper
// groq/compound often outputs internal reasoning before the actual answer.
// This strips everything up to (and including) the last summary/answer header.
// ---------------------------------------------------------------------------

function stripReasoning(raw: string): string {
  // Markers that precede the real answer
  const markerPatterns = [
    /\*\*Two[\u2011-]sentence summary\*\*\s*/i,
    /\*\*Summary\*\*\s*/i,
    /\*\*Final answer\*\*\s*/i,
    /\*\*Answer\*\*\s*/i,
    /\*\*Plain[\s\u2011-]language summary\*\*\s*/i,
  ];

  let result = raw;
  for (const pattern of markerPatterns) {
    const match = result.match(pattern);
    if (match && match.index !== undefined) {
      const afterMarker = result.slice(match.index + match[0].length).trim();
      // Only take the slice if it's non-empty and shorter than the full text
      if (afterMarker.length > 0 && afterMarker.length < result.length) {
        result = afterMarker;
      }
    }
  }

  // Also strip any remaining markdown bold headers at the start of lines
  // e.g. "**Reasoning and extraction**\n..."
  result = result.replace(/^\*\*[^*]+\*\*\s*\n+/gm, '').trim();

  return result;
}

// ---------------------------------------------------------------------------
// Prompts — kept short for groq/compound's input-token budget
// ---------------------------------------------------------------------------

/** Classifier: returns "FETCH" or "ANSWER". No system prompt (avoids 413). */
function buildClassifyPrompt(context: string, lastMsg: string): string {
  return (
    'Classify this message as FETCH or ANSWER. ' +
    'FETCH = user is specifically asking for Veil premium data, ALGO prices, or crypto market data. ' +
    'ANSWER = everything else (general questions, flights, other stocks, Veil platform info, greetings).\n' +
    (context ? `Context: ${context}\n` : '') +
    `Message: "${lastMsg}"\n` +
    'Reply with ONE word only: FETCH or ANSWER.'
  );
}

/** Veil-aware conversational answer prompt. */
function buildAnswerPrompt(lastMsg: string): string {
  return (
    'You are the AI agent for Veil, an economic capability layer. ' +
    'Veil converts x402 payments on Algorand TestNet into scoped, expiring, revocable on-chain capabilities. ' +
    'You ONLY have access to one premium API: ALGO market data. ' +
    'If the user asks for other data (like flights, stocks, weather), politely decline and offer the ALGO market data instead. ' +
    'Dashboard sections: Active Capabilities, Payments, Resources, Activity. ' +
    'Give a concise, plain-language answer. Do not show reasoning steps or headers.\n\n' +
    `User: ${lastMsg}\nAgent:`
  );
}

/** Data summary prompt — no headers, just the answer. */
function buildSummaryPrompt(dataStr: string): string {
  return (
    'Summarize this market data in exactly 2 plain sentences. ' +
    'Do NOT include any headers, bullet points, or reasoning. Just write the 2 sentences directly.\n\n' +
    `Data: ${dataStr}\nSummary:`
  );
}

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
 * Step 1: classify the last user message (with 1-turn context) → FETCH or ANSWER.
 * Step 2a: ANSWER → generate a Veil-aware reply, strip any reasoning preamble.
 * Step 2b: FETCH  → return { type: 'fetch' } — caller handles the x402 payment.
 */
export async function chatWithIntent(
  messages: ChatMessage[],
): Promise<ChatIntentResult> {
  const groq = getClient();
  const model = getModel();

  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';

  // Build a short context string from the last assistant message (if any),
  // so "yes" / "ok" / "go ahead" are resolved correctly.
  const lastAssistantMsg = [...messages].reverse().find((m) => m.role === 'assistant')?.content ?? '';
  const contextHint = lastAssistantMsg
    ? lastAssistantMsg.slice(0, 120).replace(/\n/g, ' ')
    : '';

  // Step 1 — classify (no system prompt to avoid 413)
  const classify = await groq.chat.completions.create({
    model,
    messages: [
      { role: 'user', content: buildClassifyPrompt(contextHint, lastUserMsg) },
    ],
    max_tokens: 5,
  });

  const intentRaw = classify.choices[0]?.message?.content?.trim().toUpperCase() ?? '';

  // groq/compound may ignore max_tokens and output reasoning first (e.g., "...therefore the answer is FETCH").
  // We check which keyword appears last in the response.
  const fetchIdx = intentRaw.lastIndexOf('FETCH');
  const answerIdx = intentRaw.lastIndexOf('ANSWER');

  if (fetchIdx > -1 && fetchIdx > answerIdx) {
    return { type: 'fetch', resourceId: 'premium-data' };
  }

  // Step 2 — generate answer
  const answer = await groq.chat.completions.create({
    model,
    messages: [
      { role: 'user', content: buildAnswerPrompt(lastUserMsg) },
    ],
    max_tokens: 200,
  });

  const raw = answer.choices[0]?.message?.content?.trim() ?? '';
  if (!raw) throw new Error('Model returned an empty response');

  return { type: 'text', reply: stripReasoning(raw) };
}

// ---------------------------------------------------------------------------
// summarizeData
// ---------------------------------------------------------------------------

export async function summarizeData(
  data: unknown,
  _messages: ChatMessage[],
): Promise<string> {
  const groq = getClient();
  const model = getModel();

  const dataStr = JSON.stringify(data);
  const response = await groq.chat.completions.create({
    model,
    messages: [
      { role: 'user', content: buildSummaryPrompt(dataStr) },
    ],
    max_tokens: 120,
  });

  const raw = response.choices[0]?.message?.content?.trim();
  if (!raw) throw new Error('Model returned an empty summary');
  return stripReasoning(raw);
}

// ---------------------------------------------------------------------------
// callModel — backward-compat shim for agent/orchestrator.ts
// ---------------------------------------------------------------------------

export async function callModel(prompt: string): Promise<string> {
  const groq = getClient();
  const model = getModel();

  const completion = await groq.chat.completions.create({
    model,
    messages: [
      {
        role: 'user',
        content:
          'Summarize this market data in 1-2 plain sentences. No headers or reasoning.\n\n' +
          prompt +
          '\nSummary:',
      },
    ],
    max_tokens: 120,
  });

  const raw = completion.choices[0]?.message?.content?.trim();
  if (!raw) throw new Error('Model returned an empty response');
  return stripReasoning(raw);
}