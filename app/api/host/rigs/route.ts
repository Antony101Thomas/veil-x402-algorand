import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export async function GET() {
  try {
    const { data, error } = await supabaseServer
      .from('host_rigs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) {
      return NextResponse.json({ hostRigs: [] });
    }

    return NextResponse.json({ hostRigs: data });
  } catch (err) {
    return NextResponse.json({ hostRigs: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { hostName, rigName, gpu, cpu, ram, storage, pricePerHour } = body;

    if (!hostName || !rigName || !gpu || !cpu || !pricePerHour) {
      return NextResponse.json({ error: 'Missing required PC specifications' }, { status: 400 });
    }

    const id = `host-${Date.now()}`;

    const newRig = {
      id,
      host_name: hostName,
      rig_name: rigName,
      gpu,
      cpu,
      ram: ram || '16 GB',
      storage: storage || '512 GB',
      price_per_hour: parseFloat(pricePerHour),
      status: 'online',
    };

    const { error } = await supabaseServer.from('host_rigs').insert(newRig);

    if (error) console.warn('Supabase host_rig insert warning:', error);

    return NextResponse.json({ success: true, rig: newRig });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to list PC' }, { status: 500 });
  }
}
