import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const { credentialId } = await req.json()

    if (!credentialId) {
      return NextResponse.json({ error: 'credentialId is required' }, { status: 400 })
    }

    // Check if the credential actually exists in our DB mirror
    const { data: cap, error: capError } = await supabaseServer
      .from('capabilities')
      .select('credential_id')
      .eq('credential_id', credentialId)
      .maybeSingle()

    if (capError || !cap) {
      return NextResponse.json({ error: 'Invalid or unknown credential ID' }, { status: 404 })
    }

    // Generate a fresh 32-byte hex nonce
    const nonce = crypto.randomBytes(32).toString('hex')
    
    // Set expiry to 5 minutes from now
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()

    const { error: insertError } = await supabaseServer
      .from('nonces')
      .insert({
        nonce,
        credential_id: credentialId,
        expires_at: expiresAt,
        used: false,
      })

    if (insertError) {
      console.error('[nonce] insert error:', insertError)
      return NextResponse.json({ error: 'Database error generating nonce' }, { status: 500 })
    }

    return NextResponse.json({ nonce, expiresAt }, { status: 200 })
  } catch (err) {
    console.error('[nonce] error:', err)
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
