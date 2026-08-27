// app/api/auth/login/route.ts
//
// POST /api/auth/login
// Authenticates a user with email + password, sets a session cookie.

import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabaseServer } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const email = body.email?.trim().toLowerCase()
  const password = body.password

  if (!email || !password) {
    return NextResponse.json(
      { error: 'Email and password are required' },
      { status: 400 }
    )
  }

  // --- Look up user by email ---
  const { data: user, error: lookupError } = await supabaseServer
    .from('users')
    .select('id, handle, email, role, password_hash')
    .ilike('email', email)
    .maybeSingle()

  if (lookupError) {
    console.error('[login] lookup error:', lookupError)
    return NextResponse.json(
      { error: 'Database error' },
      { status: 500 }
    )
  }

  if (!user) {
    return NextResponse.json(
      { error: 'No account found with this email. Please sign up first.' },
      { status: 404 }
    )
  }

  // --- Verify password ---
  const isValid = await bcrypt.compare(password, user.password_hash)
  if (!isValid) {
    return NextResponse.json(
      { error: 'Incorrect password. Please try again.' },
      { status: 401 }
    )
  }

  // --- Build response (never leak the hash) ---
  const safeUser = {
    id: user.id,
    handle: user.handle,
    email: user.email,
    role: user.role,
  }

  // Set session cookie
  const sessionValue = JSON.stringify({
    handle: user.handle,
    role: user.role,
  })

  const response = NextResponse.json(
    { user: safeUser, note: 'signed_in' },
    { status: 200 }
  )

  response.cookies.set('veil-session', sessionValue, {
    path: '/',
    httpOnly: false, // client-side session.ts reads it
    sameSite: 'strict',
    maxAge: 86400, // 24 hours
  })

  return response
}
