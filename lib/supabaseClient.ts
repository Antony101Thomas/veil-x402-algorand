// lib/supabaseClient.ts
//
// Browser-safe Supabase client. Uses the PUBLISHABLE (anon) key so client
// components can call auth methods (signUp, signInWithPassword,
// resetPasswordForEmail, etc.) directly. This key is designed to be
// exposed in the browser — do NOT put the secret/service role key here.

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY env vars'
  )
}

export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey)
