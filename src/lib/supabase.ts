import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { logger } from './logger'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check your .env file.')
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Disable browser Web Locks to prevent deadlocks when tabs sleep
    lock: (async (_name: string, _acquireTimeout: number, fn: () => Promise<any>) => {
      return await fn()
    }) as any,
  },
})

// ── Session refresh helper ─────────────────────────────────
// Refreshes the current session token to keep it valid during inactivity
export async function refreshSession() {
  try {
    const { data: { session }, error } = await supabase.auth.refreshSession()
    if (error) {
      logger.warn('Session refresh failed:', error.message)
      return false
    }
    return !!session
  } catch (err) {
    logger.warn('Session refresh error:', err)
    return false
  }
}
