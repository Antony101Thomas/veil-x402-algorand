import { NextResponse } from 'next/server';
import { safeSupabaseQuery } from '@/lib/supabase-server';

export async function GET() {
  const data = await safeSupabaseQuery((db) =>
    db.from('capabilities').select('*').order('created_at', { ascending: false })
  );

  return NextResponse.json({ sessions: data || [] }, { status: 200 });
}
