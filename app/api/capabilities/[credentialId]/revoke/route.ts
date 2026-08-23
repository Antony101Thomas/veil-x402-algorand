// app/api/capabilities/[credentialId]/revoke/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ credentialId: string }> }
) {
  const { credentialId } = await params

  const { data, error } = await supabaseServer
    .from('capabilities')
    .update({ revoked: true, revoked_at: new Date().toISOString() })
    .eq('credential_id', credentialId)
    .select()
    .maybeSingle()

  if (error) {
    console.error('[capabilities/revoke] error:', error)
    return NextResponse.json(
      { error: 'Database error revoking capability', detail: error.message },
      { status: 500 }
    )
  }

  if (!data) {
    return NextResponse.json({ error: 'Capability not found' }, { status: 404 })
  }

  return NextResponse.json({ capability: data }, { status: 200 })
}
