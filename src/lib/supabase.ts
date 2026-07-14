import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabaseConfig'

// When credentials are absent the app runs in local-only mode and no
// Supabase code path is ever taken (see api.ts).
export const cloudEnabled = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

export const supabase: SupabaseClient = cloudEnabled
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : (null as unknown as SupabaseClient)

let cachedUid: string | null = null

// The signed-in user's id. AuthGate guarantees a session exists before any
// data code runs in cloud mode.
export async function uid(): Promise<string> {
  if (cachedUid) return cachedUid
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session) throw new Error('Not signed in')
  cachedUid = data.session.user.id
  return cachedUid
}

export function clearUidCache(): void {
  cachedUid = null
}

// Throw on Supabase errors so call sites surface failures instead of
// silently proceeding with undefined data.
export function must<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message)
  return result.data as T
}
