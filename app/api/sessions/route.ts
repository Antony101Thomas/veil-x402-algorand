import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export async function GET() {
  try {
    const { data, error } = await supabaseServer
      .from('capabilities')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[sessions] DB lookup notice:', error.message);
      return NextResponse.json({ sessions: [] });
    }

    return NextResponse.json({ sessions: data || [] });
  } catch (err: any) {
    console.warn('[sessions] DB connection notice:', err.message);
    return NextResponse.json({ sessions: [] });
  }
}
