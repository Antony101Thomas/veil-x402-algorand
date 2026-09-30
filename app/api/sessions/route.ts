import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const { supabaseServer } = await import('@/lib/supabase-server');

    const fetchDb = async (): Promise<any[]> => {
      try {
        const res = await supabaseServer
          .from('capabilities')
          .select('*')
          .order('created_at', { ascending: false });
        return res?.data || [];
      } catch {
        return [];
      }
    };

    const timeoutPromise = new Promise<any[]>((resolve) =>
      setTimeout(() => resolve([]), 2000)
    );

    const sessions = await Promise.race([fetchDb(), timeoutPromise]);
    return NextResponse.json({ sessions });
  } catch {
    return NextResponse.json({ sessions: [] });
  }
}
