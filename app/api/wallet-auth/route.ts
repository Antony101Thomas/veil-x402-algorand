// app/api/wallet-auth/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

// GET /api/wallet-auth?handle=agent-01 — returns current state, or null if
// this handle has never connected a wallet (State 1).
export async function GET(req: NextRequest) {
  const handle = req.nextUrl.searchParams.get('handle')?.trim()
  if (!handle) {
    return NextResponse.json({ error: 'handle query param is required' }, { status: 400 })
  }

  const { data, error } = await supabaseServer
    .from('wallet_authorizations')
    .select('*')
    .eq('handle', handle)
    .maybeSingle()

  if (error) {
    console.error('[wallet-auth] lookup error:', error)
    return NextResponse.json(
      { error: 'Database error looking up wallet authorization', detail: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ record: data }, { status: 200 })
}

type Body =
  | { action: 'connect'; handle: string; walletAddress: string }
  | { action: 'authorize'; handle: string; walletAddress: string; txId: string }
  | { action: 'revoke'; handle: string; txId: string }

export async function POST(req: NextRequest) {
  let body: Body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (body.action === 'connect') {
    const { data, error } = await supabaseServer
      .from('wallet_authorizations')
      .upsert(
        { handle: body.handle, wallet_address: body.walletAddress },
        { onConflict: 'handle' }
      )
      .select()
      .single()

    if (error) {
      console.error('[wallet-auth] connect error:', error)
      return NextResponse.json(
        { error: 'Database error saving connection', detail: error.message },
        { status: 500 }
      )
    }
    return NextResponse.json({ record: data }, { status: 200 })
  }

  if (body.action === 'authorize') {
    const { data, error } = await supabaseServer
      .from('wallet_authorizations')
      .upsert(
        {
          handle: body.handle,
          wallet_address: body.walletAddress,
          authorized: true,
          authorized_at: new Date().toISOString(),
          auth_tx_id: body.txId,
          revoked_at: null,
          revoke_tx_id: null,
        },
        { onConflict: 'handle' }
      )
      .select()
      .single()

    if (error) {
      console.error('[wallet-auth] authorize error:', error)
      return NextResponse.json(
        { error: 'Database error saving authorization', detail: error.message },
        { status: 500 }
      )
    }
    return NextResponse.json({ record: data }, { status: 200 })
  }

  if (body.action === 'revoke') {
    const { data, error } = await supabaseServer
      .from('wallet_authorizations')
      .update({
        authorized: false,
        revoked_at: new Date().toISOString(),
        revoke_tx_id: body.txId,
      })
      .eq('handle', body.handle)
      .select()
      .single()

    if (error) {
      console.error('[wallet-auth] revoke error:', error)
      return NextResponse.json(
        { error: 'Database error saving revocation', detail: error.message },
        { status: 500 }
      )
    }
    return NextResponse.json({ record: data }, { status: 200 })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
