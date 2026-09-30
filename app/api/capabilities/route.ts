import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const { supabaseServer } = await import('@/lib/supabase-server');

    const fetchDb = async (): Promise<any[]> => {
      try {
        const res = await supabaseServer
          .from('capabilities')
          .select(
            `
            credential_id,
            resource_id,
            action,
            quota,
            expiry_round,
            revoked,
            created_at
          `
          )
          .order('created_at', { ascending: false });
        return res?.data || [];
      } catch {
        return [];
      }
    };

    const timeoutPromise = new Promise<any[]>((resolve) =>
      setTimeout(() => resolve([]), 2000)
    );

    const capabilities = await Promise.race([fetchDb(), timeoutPromise]);
    return NextResponse.json({ capabilities }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ capabilities: [] }, { status: 200 });
  }
}
