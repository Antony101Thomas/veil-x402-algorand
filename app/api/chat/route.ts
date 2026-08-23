import { NextRequest, NextResponse } from 'next/server';
import { chatWithIntent, summarizeData, type ChatMessage } from '@/lib/llm';
import { discover_resource, request_resource_with_payment, obtain_capability, access_with_capability } from '@/agent/orchestrator';

/**
 * POST /api/chat
 *
 * Body: { messages: ChatMessage[] }
 *
 * Flow:
 *  1. Send conversation history to the LLM (Veil-aware system prompt + function-calling).
 *  2a. If LLM answers directly  → return { reply }.
 *  2b. If LLM wants to fetch a resource →
 *        a. Run discover_resource() to get endpoint.
 *        b. Run request_resource_with_payment() → x402 Algorand payment + fetch.
 *        c. Extract the capability from the response using obtain_capability().
 *        d. Verify the capability works using access_with_capability().
 *        e. On 200: ask the LLM to summarize the data → return { reply, resourceFetched, data }.
 *        f. On 402/403/error: return error message in { reply, error }.
 */
export async function POST(req: NextRequest) {
  let messages: ChatMessage[];
  try {
    const body = await req.json();
    messages = body.messages ?? [];
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'messages array is required' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    const intent = await chatWithIntent(messages);

    // ── Direct answer — no resource fetch needed ──────────────────────────
    if (intent.type === 'text') {
      return NextResponse.json({ reply: intent.reply });
    }

    // ── Resource fetch — trigger x402 Algorand payment ────────────────────
    const resource = await discover_resource();

    let paymentResult: Awaited<ReturnType<typeof request_resource_with_payment>>;
    try {
      paymentResult = await request_resource_with_payment(resource);
    } catch (payErr) {
      const errMsg = payErr instanceof Error ? payErr.message : String(payErr);
      return NextResponse.json({
        reply: `I tried to fetch the resource but the payment failed: ${errMsg}. Make sure ALGORAND_PAYER_MNEMONIC is set and the account has USDC on TestNet.`,
        error: errMsg,
      });
    }

    // 402 — payment was attempted but resource still refused
    if (paymentResult.status === 402) {
      return NextResponse.json({
        reply:
          'The resource server returned 402 Payment Required even after the x402 payment attempt. ' +
          'The Algorand wallet may be underfunded or the facilitator rejected the payment. ' +
          'Check the Activity log and TestNet account balance.',
        error: 'payment_failed',
        httpStatus: 402,
      });
    }

    // 403 — capability revoked or not recognized
    if (paymentResult.status === 403) {
      return NextResponse.json({
        reply: 'Access denied (403). The capability may have been revoked or the credential is invalid. An admin can re-issue it from the dashboard.',
        error: 'access_denied',
        httpStatus: 403,
      });
    }

    // Other non-200
    if (paymentResult.status !== 200) {
      return NextResponse.json({
        reply: `The resource server responded with HTTP ${paymentResult.status}. Please try again or check the Activity log.`,
        error: `http_${paymentResult.status}`,
        httpStatus: paymentResult.status,
      });
    }

    // ── Obtain and use capability (prove it works without paying again) ──
    const capInfo = await obtain_capability(paymentResult);
    if (!capInfo) {
       console.warn('Payment succeeded but no capability was returned by the resource server.');
    } else {
       // Access with the new capability
       const accessResult = await access_with_capability(resource, capInfo.credentialId, capInfo.disposablePrivateKeyBase64);
       if (accessResult.status !== 200) {
          console.error(`Capability access failed: ${accessResult.status}`, accessResult.body);
          // If the capability test fails, we still have the original payment data we can summarize, but we should log it.
       } else {
          // Use the data retrieved via the capability!
          paymentResult.body = accessResult.body;
       }
    }

    // 200 — summarize the data with the LLM
    const summary = await summarizeData(paymentResult.body, messages);

    return NextResponse.json({
      reply: summary,
      resourceFetched: resource.resourceId,
      data: paymentResult.body,
      capability: capInfo ? { credentialId: capInfo.credentialId } : undefined
    });

  } catch (err) {
    console.error('[/api/chat] Unhandled error:', err);
    const errMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({
      reply: `An unexpected error occurred: ${errMsg}`,
      error: errMsg,
    }, { status: 500 });
  }
}
