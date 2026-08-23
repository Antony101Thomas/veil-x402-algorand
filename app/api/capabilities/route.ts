// app/api/capabilities/route.ts

import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

export async function GET() {
  const { data, error } = await supabaseServer
    .from('capabilities')
    .select(
      `
      credential_id,
      resource_id,
      action,
      quota,
      quota_used,
      expiry_at,
      revoked,
      revoked_at,
      created_at,
      agents ( agent_id, name, status )
    `
    )
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[capabilities] fetch error:', error)
    return NextResponse.json(
      { error: 'Database error fetching capabilities', detail: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ capabilities: data }, { status: 200 })
}
