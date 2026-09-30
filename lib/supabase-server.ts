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
  return new Promise<T | null>((resolve) => {
    try {
      Promise.resolve(queryFn(supabaseServer))
        .then((res) => {
          if (res?.error) {
            console.warn('[supabase] query notice:', res.error.message || res.error)
            resolve(null)
          } else {
            resolve(res?.data ?? null)
          }
        })
        .catch((err) => {
          console.warn('[supabase] catch notice:', err?.message || err)
          resolve(null)
        })
    } catch (err: any) {
      console.warn('[supabase] sync notice:', err?.message || err)
      resolve(null)
    }
  })
}