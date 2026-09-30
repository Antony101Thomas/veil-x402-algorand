import { NextResponse } from 'next/server';
import { safeSupabaseQuery } from '@/lib/supabase-server';

export async function GET() {
  const data = await safeSupabaseQuery((db) =>
    db
      .from('capabilities')
      .select('credential_id, resource_id, action, quota, expiry_round, revoked, created_at')
      .order('created_at', { ascending: false })
  );

  return NextResponse.json({ capabilities: data || [] }, { status: 200 });
}
