// app/api/users/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

type Role = 'agent' | 'admin'
type Mode = 'signin' | 'signup'

// Only these columns are ever safe to return to a browser.
// NEVER select('*') on this table — it also contains encrypted_password,
// confirmation_token, recovery_token, reauthentication_token, etc.
const SAFE_USER_COLUMNS = 'user_id, handle, role, created_at, last_seen_at'

// For the hackathon demo: only handles on this allowlist may sign up as
// admin. Everyone else who requests role "admin" is silently downgraded
// to "agent". Replace this with real auth (e.g. a Supabase Auth session
// + a server-side admin check) before this ever goes past a demo.
const ADMIN_ALLOWLIST = (process.env.ADMIN_HANDLE_ALLOWLIST ?? '')
  .split(',')
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean)

export async function POST(req: NextRequest) {
  let body: { handle?: string; role?: Role; mode?: Mode }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const handle = body.handle?.trim()
  const requestedRole = body.role
  const mode: Mode = body.mode === 'signup' ? 'signup' : 'signin'

  if (!handle) {
    return NextResponse.json({ error: 'Handle is required' }, { status: 400 })
  }
  if (requestedRole !== 'agent' && requestedRole !== 'admin') {
    return NextResponse.json(
      { error: 'Role must be "agent" or "admin"' },
      { status: 400 }
    )
  }

  // Don't trust the client's requested role for admin. Only allowlisted
  // handles can actually become admin; everyone else gets "agent"
  // regardless of what they sent.
  const role: Role =
    requestedRole === 'admin' && ADMIN_ALLOWLIST.includes(handle.toLowerCase())
      ? 'admin'
      : 'agent'

  const lookupStart = Date.now()
  const { data: existing, error: lookupError } = await supabaseServer
    .from('users')
    .select(SAFE_USER_COLUMNS)
    .ilike('handle', handle)
    .maybeSingle()
  console.log(`[users] lookup took ${Date.now() - lookupStart}ms`)

  if (lookupError) {
    console.error('[users] lookup error:', lookupError)
    return NextResponse.json(
      { error: 'Database error looking up user', detail: lookupError.message },
      { status: 500 }
    )
  }

  // ---- SIGN IN ----
  if (mode === 'signin') {
    if (!existing) {
      return NextResponse.json(
        { error: `No account found for "${handle}". Try signing up instead.` },
        { status: 404 }
      )
    }
    return NextResponse.json({ user: existing, note: 'signed_in' }, { status: 200 })
  }

  // ---- SIGN UP ----
  if (existing) {
    return NextResponse.json(
      { user: existing, note: 'handle_already_existed_logged_in' },
      { status: 200 }
    )
  }

  const { data: created, error: insertError } = await supabaseServer
    .from('users')
    .insert({ handle, role })
    .select(SAFE_USER_COLUMNS)
    .single()

  if (insertError) {
    if (insertError.code === '23505') {
      const { data: raceWinner } = await supabaseServer
        .from('users')
        .select(SAFE_USER_COLUMNS)
        .ilike('handle', handle)
        .maybeSingle()
      if (raceWinner) {
        return NextResponse.json(
          { user: raceWinner, note: 'handle_already_existed_logged_in' },
          { status: 200 }
        )
      }
    }
    return NextResponse.json({ error: 'Could not create user' }, { status: 500 })
  }

  return NextResponse.json({ user: created, note: 'created' }, { status: 201 })
}

// GET /api/users — list users for the admin dashboard.
// Safe columns only, same as above.
export async function GET() {
  const { data, error } = await supabaseServer
    .from('users')
    .select(SAFE_USER_COLUMNS)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Database error fetching users' }, { status: 500 })
  }

  return NextResponse.json({ users: data }, { status: 200 })
}