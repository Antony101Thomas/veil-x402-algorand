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

  // --- Check built-in demo accounts ---
  if (email === 'demo@hyperdesk.io' && password === 'demo1234') {
    const safeUser = { id: 'demo-agent-id', handle: 'demo-agent', email, role: 'agent' as const }
    const response = NextResponse.json({ user: safeUser, note: 'signed_in' }, { status: 200 })
    response.cookies.set('veil-session', JSON.stringify({ handle: safeUser.handle, role: safeUser.role }), {
      path: '/',
      httpOnly: false,
      sameSite: 'strict',
      maxAge: 86400,
    })
    return response
  }

  if (email === 'admin@hyperdesk.io' && password === 'admin1234') {
    const safeUser = { id: 'demo-admin-id', handle: 'demo-admin', email, role: 'admin' as const }
    const response = NextResponse.json({ user: safeUser, note: 'signed_in' }, { status: 200 })
    response.cookies.set('veil-session', JSON.stringify({ handle: safeUser.handle, role: safeUser.role }), {
      path: '/',
      httpOnly: false,
      sameSite: 'strict',
      maxAge: 86400,
    })
    return response
  }

  // --- Look up user by email in database ---
  try {
    const { data: user, error: lookupError } = await supabaseServer
      .from('users')
      .select('id, handle, email, role, password_hash')
      .ilike('email', email)
      .maybeSingle()

    if (lookupError) {
      console.error('[login] lookup error:', lookupError)
      return NextResponse.json({ error: 'Database connection failed. Use demo accounts to sign in.' }, { status: 500 })
    }

    if (!user) {
      return NextResponse.json(
        { error: 'No account found with this email. Please sign up or use demo@hyperdesk.io / demo1234.' },
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

    const safeUser = {
      id: user.id,
      handle: user.handle,
      email: user.email,
      role: user.role,
    }

    const response = NextResponse.json({ user: safeUser, note: 'signed_in' }, { status: 200 })
    response.cookies.set('veil-session', JSON.stringify({ handle: user.handle, role: user.role }), {
      path: '/',
      httpOnly: false,
      sameSite: 'strict',
      maxAge: 86400,
    })
    return response
  } catch (err: any) {
    console.error('[login] error:', err)
    return NextResponse.json({ error: 'Database offline. Use demo@hyperdesk.io / demo1234' }, { status: 500 })
  }
}
