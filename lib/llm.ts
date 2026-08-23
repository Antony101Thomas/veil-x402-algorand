import OpenAI from 'openai';

/**
 * The one place the agent's LLM reasoning actually runs (see
 * agent/orchestrator.ts § summarize_data). Kept deliberately narrow: this
 * function only ever summarizes data handed to it, never decides whether
 * or how much to pay, and never touches the wallet or capability logic.
 *
 * Uses Grok via xAI's API. xAI's endpoint is OpenAI-SDK-compatible, so we
 * reuse the `openai` package here but point it at xAI's base URL and auth
 * with XAI_API_KEY rather than an OpenAI key — there is no OpenAI account
 * involved anywhere in this flow.
 */

const XAI_BASE_URL = 'https://api.groq.com/openai/v1';

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

const SYSTEM_PROMPT =
  'You are the summarization step of a demo AI agent called Veil. You will ' +
  'be given JSON data the agent just paid to access. Summarize it for the ' +
  'user in 1-2 plain sentences. Only describe what is in the data — do not ' +
  'speculate, add advice, or mention that you are an AI.';

export async function callModel(prompt: string): Promise<string> {
  const xai = getClient();

  const completion = await xai.chat.completions.create({
    // grok-4.6 is xAI's current flagship/default model. Override with
    // XAI_MODEL if the team wants a cheaper/faster variant for the demo.
    model: process.env.XAI_MODEL ?? 'groq/compound',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    max_tokens: 200,
  });

  const text = completion.choices[0]?.message?.content?.trim();
  if (!text) {
    throw new Error('Model returned an empty response');
  }
  return text;
}