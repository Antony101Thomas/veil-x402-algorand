// app/api/auth/reset-password/route.ts
//
// POST /api/auth/reset-password
// Validates the reset token, hashes the new password, and updates the user.

import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabaseServer } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  let body: { token?: string; password?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const token = body.token?.trim()
  const password = body.password

  if (!token || !password) {
    return NextResponse.json(
      { error: 'Token and new password are required' },
      { status: 400 }
    )
  }

  if (password.length < 6) {
    return NextResponse.json(
      { error: 'Password must be at least 6 characters' },
      { status: 400 }
    )
  }

  // --- Look up user by reset token ---
  const { data: user, error: lookupError } = await supabaseServer
    .from('users')
    .select('id, reset_token_expires')
    .eq('reset_token', token)
    .maybeSingle()

  if (lookupError) {
    console.error('[reset-password] lookup error:', lookupError)
    return NextResponse.json(
      { error: 'Database error' },
      { status: 500 }
    )
  }

  if (!user) {
    return NextResponse.json(
      { error: 'Invalid or expired reset token. Please request a new one.' },
      { status: 400 }
    )
  }

  // --- Check expiry ---
  const expiresAt = new Date(user.reset_token_expires)
  if (expiresAt < new Date()) {
    return NextResponse.json(
      { error: 'This reset link has expired. Please request a new one.' },
      { status: 400 }
    )
  }

  // --- Hash new password and update ---
  const passwordHash = await bcrypt.hash(password, 12)

  const { error: updateError } = await supabaseServer
    .from('users')
    .update({
      password_hash: passwordHash,
      reset_token: null,
      reset_token_expires: null,
    })
    .eq('id', user.id)

  if (updateError) {
    console.error('[reset-password] update error:', updateError)
    return NextResponse.json(
      { error: 'Failed to update password' },
      { status: 500 }
    )
  }

  return NextResponse.json(
    { message: 'Password updated successfully. You can now sign in.' },
    { status: 200 }
  )
}
