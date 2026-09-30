// lib/supabase-server.ts
//
// Lazy, resilient Supabase server client.

import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _supabaseServer: SupabaseClient | null = null

export function getSupabaseServer(): SupabaseClient | null {
  if (_supabaseServer) return _supabaseServer
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseServiceKey) return null
  try {
    _supabaseServer = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
    return _supabaseServer
  } catch {
    return null
  }
}

export const supabaseServer = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabaseServer()
    if (!client) {
      // Dummy chainable fallback if client not initialized
      return () => ({
        select: () => ({ order: () => Promise.resolve({ data: null, error: null }), eq: () => Promise.resolve({ data: null, error: null }), maybeSingle: () => Promise.resolve({ data: null, error: null }), single: () => Promise.resolve({ data: null, error: null }) }),
        insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }),
        update: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
        ilike: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) })
      })
    }
    const val = (client as any)[prop]
    return typeof val === 'function' ? val.bind(client) : val
  }
})

export async function safeSupabaseQuery<T>(
  queryFn: (client: SupabaseClient) => PromiseLike<{ data: T | null; error: any }>
): Promise<T | null> {
  return new Promise<T | null>((resolve) => {
    try {
      const client = getSupabaseServer()
      if (!client) return resolve(null)
      Promise.resolve(queryFn(client))
        .then((res) => {
          if (res?.error) {
            resolve(null)
          } else {
            resolve(res?.data ?? null)
          }
        })
        .catch(() => resolve(null))
    } catch {
      resolve(null)
    }
  })
}