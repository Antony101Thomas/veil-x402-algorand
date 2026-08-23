// app/api/users/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

type Role = 'agent' | 'admin'
type Mode = 'signin' | 'signup'

export async function POST(req: NextRequest) {
  let body: { handle?: string; role?: Role; mode?: Mode }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const handle = body.handle?.trim()
  const role = body.role
  const mode: Mode = body.mode === 'signup' ? 'signup' : 'signin'

  if (!handle) {
    return NextResponse.json({ error: 'Handle is required' }, { status: 400 })
  }
  if (role !== 'agent' && role !== 'admin') {
    return NextResponse.json(
      { error: 'Role must be "agent" or "admin"' },
      { status: 400 }
    )
  }

  // Always check first: does this handle already exist?
  const lookupStart = Date.now()
  const { data: existing, error: lookupError } = await supabaseServer
    .from('users')
    .select('*')
    .ilike('handle', handle) // case-insensitive match
    .maybeSingle()
  console.log(`[users] lookup took ${Date.now() - lookupStart}ms`)

  if (lookupError) {
    return NextResponse.json(
      { error: 'Database error looking up user' },
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
    // Handle is taken — don't create a duplicate. Log them into the
    // existing account instead, as requested.
    return NextResponse.json(
      { user: existing, note: 'handle_already_existed_logged_in' },
      { status: 200 }
    )
  }

  const { data: created, error: insertError } = await supabaseServer
    .from('users')
    .insert({ handle, role })
    .select()
    .single()

  if (insertError) {
    // Handles the rare race where two requests insert the same handle
    // at once (unique constraint violation).
    if (insertError.code === '23505') {
      const { data: raceWinner } = await supabaseServer
        .from('users')
        .select('*')
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