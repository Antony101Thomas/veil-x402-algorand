import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const { supabaseServer } = await import('@/lib/supabase-server');
    const res = await supabaseServer
      .from('capabilities')
      .select('*')
      .order('created_at', { ascending: false });

    if (res.data) {
      return NextResponse.json({ sessions: res.data });
    }
    return NextResponse.json({ sessions: [] });
  } catch (err: any) {
    console.warn('[sessions] DB notice:', err?.message || err);
    return NextResponse.json({ sessions: [] }, { status: 200 });
  }
}
