// app/api/auth/forgot-password/route.ts
//
// POST /api/auth/forgot-password
// Generates a secure reset token, stores it in the DB, and sends a
// password-reset email via SMTP.

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { supabaseServer } from '@/lib/supabase-server'
import { sendPasswordResetEmail } from '@/lib/mailer'

export async function POST(req: NextRequest) {
  let body: { email?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const email = body.email?.trim().toLowerCase()

  if (!email) {
    return NextResponse.json(
      { error: 'Email is required' },
      { status: 400 }
    )
  }

  // Always respond with the same message whether the email exists or not,
  // to avoid leaking account-existence information.
  const successMessage =
    'If an account with that email exists, a password reset link has been sent.'

  // --- Look up user ---
  const { data: user, error: lookupError } = await supabaseServer
    .from('users')
    .select('id, email')
    .ilike('email', email)
    .maybeSingle()

  if (lookupError) {
    console.error('[forgot-password] lookup error:', lookupError)
    // Still return success to avoid leaking info
    return NextResponse.json({ message: successMessage }, { status: 200 })
  }

  if (!user) {
    // Email not found — respond the same way so attackers can't enumerate emails
    return NextResponse.json({ message: successMessage }, { status: 200 })
  }

  // --- Generate reset token ---
  const resetToken = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

  const { error: updateError } = await supabaseServer
    .from('users')
    .update({
      reset_token: resetToken,
      reset_token_expires: expiresAt.toISOString(),
    })
    .eq('id', user.id)

  if (updateError) {
    console.error('[forgot-password] update error:', updateError)
    return NextResponse.json(
      { error: 'Failed to generate reset token' },
      { status: 500 }
    )
  }

  // --- Send email ---
  try {
    await sendPasswordResetEmail(user.email, resetToken)
  } catch (err) {
    console.error('[forgot-password] email send error:', err)
    return NextResponse.json(
      { error: 'Failed to send reset email. Please try again later.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ message: successMessage }, { status: 200 })
}
