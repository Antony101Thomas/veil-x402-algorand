import { NextResponse } from 'next/server';
import { run } from '@/agent/orchestrator';
import { callModel } from '@/lib/llm';

export async function POST() {
  try {
    const result = await run(callModel);

    if (result.status === 'ok') {
      return NextResponse.json(result, { status: 200 });
    }
    if (result.status === 'payment_failed') {
      return NextResponse.json(result, { status: 402 });
    }
    if (result.status === 'access_denied') {
      return NextResponse.json(result, { status: 403 });
    }
    return NextResponse.json(result, { status: 500 });
  } catch (err) {
    return NextResponse.json(
      {
        status: 'error',
        error: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}