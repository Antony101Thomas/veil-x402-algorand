import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

// Global memory store fallback for dev/demo live state
let memoryRequests: any[] = [
  {
    id: 'req-demo-1',
    session_id: 'HD-SESS-9981',
    rig_id: 'host-rig-01',
    renter_name: 'Gamer_Pro_99',
    host_name: 'Anton (Host)',
    status: 'pending',
    ip_address: '192.168.1.105',
    created_at: new Date().toISOString(),
  },
];

export async function GET(req: NextRequest) {
  try {
    const { data } = await supabaseServer
      .from('connection_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (data && data.length > 0) {
      return NextResponse.json({ requests: data });
    }
    return NextResponse.json({ requests: memoryRequests });
  } catch (err) {
    return NextResponse.json({ requests: memoryRequests });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Action 1: Create a connection request when user pays
    if (body.action === 'create') {
      const { sessionId, rigId, renterName, hostName } = body;
      const newReq = {
        id: `req-${Date.now()}`,
        session_id: sessionId,
        rig_id: rigId,
        renter_name: renterName || 'Guest User',
        host_name: hostName || 'Anton (Host)',
        status: 'pending',
        ip_address: '192.168.1.' + Math.floor(Math.random() * 200 + 10),
        created_at: new Date().toISOString(),
      };
      memoryRequests.unshift(newReq);
      await supabaseServer.from('connection_requests').insert(newReq);
      return NextResponse.json({ success: true, request: newReq });
    }

    // Action 2: Host approves/denies permission
    const { requestId, status } = body;
    if (!requestId || !status) {
      return NextResponse.json({ error: 'Missing requestId or status' }, { status: 400 });
    }

    // Update memory
    const reqItem = memoryRequests.find((r) => r.id === requestId);
    if (reqItem) {
      reqItem.status = status;
    }

    // Update DB
    await supabaseServer
      .from('connection_requests')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', requestId);

    return NextResponse.json({ success: true, status });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Action failed' }, { status: 500 });
  }
}
