// app/api/auth/register/route.ts
//
// POST /api/auth/register
// Creates a new user with email + hashed password.
// Returns 409 if the email is already in use.

import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabaseServer } from '@/lib/supabase-server'

type Role = 'agent' | 'admin'

const SAFE_COLUMNS = 'id, handle, email, role, created_at'

const ADMIN_ALLOWLIST = (process.env.ADMIN_HANDLE_ALLOWLIST ?? '')
  .split(',')
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean)

export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string; role?: Role; handle?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const email = body.email?.trim().toLowerCase()
  const password = body.password
  const handle = body.handle?.trim() || email?.split('@')[0] || ''
  const requestedRole = body.role

  // --- Validation ---
  if (!email || !password) {
    return NextResponse.json(
      { error: 'Email and password are required' },
      { status: 400 }
    )
  }

  // Basic email format check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { error: 'Invalid email format' },
      { status: 400 }
    )
  }

  if (password.length < 6) {
    return NextResponse.json(
      { error: 'Password must be at least 6 characters' },
      { status: 400 }
    )
  }

  if (requestedRole && requestedRole !== 'agent' && requestedRole !== 'admin') {
    return NextResponse.json(
      { error: 'Role must be "agent" or "admin"' },
      { status: 400 }
    )
  }

  // --- Check if email already exists ---
  const { data: existing, error: lookupError } = await supabaseServer
    .from('users')
    .select('id')
    .ilike('email', email)
    .maybeSingle()

  if (lookupError) {
    console.error('[register] lookup error:', lookupError)
    return NextResponse.json(
      { error: 'Database error', detail: lookupError.message },
      { status: 500 }
    )
  }

  if (existing) {
    return NextResponse.json(
      { error: 'An account with this email already exists. Please sign in instead.' },
      { status: 409 }
    )
  }

  // --- Hash password ---
  const passwordHash = await bcrypt.hash(password, 12)

  // --- Determine role ---
  const role: Role =
    requestedRole === 'admin' && ADMIN_ALLOWLIST.includes(handle.toLowerCase())
      ? 'admin'
      : 'agent'

  // --- Insert user ---
  const { data: created, error: insertError } = await supabaseServer
    .from('users')
    .insert({ handle, email, password_hash: passwordHash, role })
    .select(SAFE_COLUMNS)
    .single()

  if (insertError) {
    // Handle race condition on unique constraint
    if (insertError.code === '23505') {
      return NextResponse.json(
        { error: 'An account with this email already exists.' },
        { status: 409 }
      )
    }
    console.error('[register] insert error:', insertError)
    return NextResponse.json(
      { error: 'Could not create account' },
      { status: 500 }
    )
  }

  return NextResponse.json(
    { user: created, note: 'created' },
    { status: 201 }
  )
}
