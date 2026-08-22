// lib/supabase-server.ts
//
// Server-only Supabase client. Uses the SERVICE ROLE key so API routes can
// read/write the users table directly. NEVER import this file in client
// components — the service role key must stay server-side only.

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars'
  )
}

export const supabaseServer = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
})