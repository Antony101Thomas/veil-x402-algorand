import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const url = process.env.SUPABASE_URL || '';
    if (!url || url.includes('bspeqhmyafwhhhqahdbr') || url.includes('placeholder')) {
      return NextResponse.json({ sessions: [] }, { status: 200 });
    }

    const { supabaseServer } = await import('@/lib/supabase-server');
    const { data } = await supabaseServer
      .from('capabilities')
      .select('*')
      .order('created_at', { ascending: false });

    return NextResponse.json({ sessions: data || [] }, { status: 200 });
  } catch {
    return NextResponse.json({ sessions: [] }, { status: 200 });
  }
}
