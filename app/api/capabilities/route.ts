import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const url = process.env.SUPABASE_URL || '';
    if (!url || url.includes('bspeqhmyafwhhhqahdbr') || url.includes('placeholder')) {
      return NextResponse.json({ capabilities: [] }, { status: 200 });
    }

    const { supabaseServer } = await import('@/lib/supabase-server');
    const { data } = await supabaseServer
      .from('capabilities')
      .select('credential_id, resource_id, action, quota, expiry_round, revoked, created_at')
      .order('created_at', { ascending: false });

    return NextResponse.json({ capabilities: data || [] }, { status: 200 });
  } catch {
    return NextResponse.json({ capabilities: [] }, { status: 200 });
  }
}
