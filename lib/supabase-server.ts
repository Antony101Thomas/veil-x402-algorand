// lib/supabase-server.ts

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder'

export const supabaseServer = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
})

export async function safeSupabaseQuery<T>(
  queryFn: (client: typeof supabaseServer) => PromiseLike<{ data: T | null; error: any }>
): Promise<T | null> {
  try {
    const res = await queryFn(supabaseServer)
    if (res?.error) {
      console.warn('[supabase] query notice:', res.error.message || res.error)
      return null
    }
    return res?.data ?? null
  } catch (err: any) {
    console.warn('[supabase] network notice:', err?.message || err)
    return null
  }
}