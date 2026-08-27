// app/api/auth/logout/route.ts
//
// POST /api/auth/logout
// Clears the session cookie.

import { NextResponse } from 'next/server'

export async function POST() {
  const response = NextResponse.json(
    { message: 'Logged out' },
    { status: 200 }
  )

  response.cookies.set('veil-session', '', {
    path: '/',
    httpOnly: false,
    sameSite: 'strict',
    maxAge: 0,
  })

  return response
}
