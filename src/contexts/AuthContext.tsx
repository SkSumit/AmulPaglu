import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types'
import { logger } from '@/lib/logger'

// ── Types ──────────────────────────────────────────────────
interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: Profile | null
  isLoading: boolean
  isAdmin: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  ensureSession: () => Promise<boolean>
}

// ── Context ────────────────────────────────────────────────
const AuthContext = createContext<AuthContextValue | null>(null)

// ── Provider ───────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Track which user ID's profile is already loaded — prevents redundant re-fetches
  // on TOKEN_REFRESHED events (fires every ~55 min) from clearing the session
  const profileLoadedForRef = useRef<string | null>(null)

  // Shared active refresh promise to deduplicate concurrent refresh attempts
  const refreshPromiseRef = useRef<Promise<Session | null> | null>(null)

  async function fetchOrCreateProfile(user: User): Promise<Profile | null> {
    // Try to fetch existing profile first
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (!error) return data

    // PGRST116 = 0 rows returned — profile doesn't exist yet, create it
    if (error.code === 'PGRST116') {
      const username =
        (user.user_metadata?.username as string | undefined) ??
        user.email?.split('@')[0] ??
        `user_${user.id.slice(0, 8)}`

      const { data: created, error: insertErr } = await supabase
        .from('profiles')
        .upsert({ id: user.id, username }, { onConflict: 'id' })
        .select('*')
        .single()

      if (insertErr) {
        logger.error('Error creating profile:', insertErr.message)
        return null
      }
      return created
    }

    logger.error('Error fetching profile:', error.message)
    return null
  }

  async function refreshProfile() {
    if (!session?.user) return
    const p = await fetchOrCreateProfile(session.user)
    setProfile(p)
  }

  // A safe, deduplicated wrapper around refreshSession with a 5s timeout
  async function safeRefreshSession(): Promise<Session | null> {
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current
    }

    refreshPromiseRef.current = (async () => {
      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Session refresh timed out after 5000ms')), 5000)
        )
        const refreshPromise = supabase.auth.refreshSession()
        const { data, error } = await Promise.race([refreshPromise, timeoutPromise]) as any
        if (error) throw error
        return data?.session ?? null
      } finally {
        refreshPromiseRef.current = null
      }
    })()

    return refreshPromiseRef.current
  }

  // ── Ensure session is fresh ────────────────────────────
  // Checks token expiry and performs manual token-refresh with a 5s timeout
  // to prevent requests from hanging if connection was sleeping.
  async function ensureSession(): Promise<boolean> {
    if (!session) return false
    const expiresAt = session.expires_at
    if (!expiresAt) return true
    
    const now = Math.floor(Date.now() / 1000)
    // If token has expired or is close to expiring (within 15 seconds), refresh it!
    if (expiresAt - now < 15) {
      try {
        logger.warn('Session close to expiry or expired, executing timeout-protected refresh...')
        const s = await safeRefreshSession()
        if (s) {
          setSession(s)
          return true
        }
        return false
      } catch (err) {
        logger.warn('Session verification/refresh failed:', err)
        await signOut()
        return false
      }
    }
    return true
  }



  useEffect(() => {
    let mounted = true

    // Safety-net: force loading=false after 6 s in case auth never responds
    const timer = setTimeout(() => {
      if (mounted) setIsLoading(false)
    }, 6000)

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, s) => {
        if (!mounted) return
        clearTimeout(timer)

        // ── Explicit sign-out ──────────────────────────────────
        // Only clear session when SIGNED_OUT fires — never on TOKEN_REFRESHED
        // or other events where `s` might transiently be null due to timing.
        if (event === 'SIGNED_OUT') {
          setSession(null)
          setProfile(null)
          profileLoadedForRef.current = null
          setIsLoading(false)
          return
        }

        // ── No session for non-SIGNED_OUT event ────────────────
        // Treat as a spurious event (can happen on free-tier wake-up). Don't
        // clear the session — just unblock loading.
        if (!s) {
          setIsLoading(false)
          return
        }

        setSession(s)
        setIsLoading(false)
      }
    )

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && mounted) {
        try {
          logger.warn('Tab visible, forcing supabase.auth.refreshSession() via safeRefreshSession()...')
          const s = await safeRefreshSession()
          if (s && mounted) {
            setSession(s)
          }
        } catch (err) {
          logger.warn('Tab visibility session refresh failed:', err)
        }
      }
    }

    window.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      mounted = false
      clearTimeout(timer)
      subscription.unsubscribe()
      window.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  // Load user profile asynchronously when the session user changes
  // to avoid deadlocking the Supabase client during auth state changes
  useEffect(() => {
    let mounted = true
    if (!session?.user) {
      setProfile(null)
      profileLoadedForRef.current = null
      return
    }

    const isNewUser = profileLoadedForRef.current !== session.user.id
    if (isNewUser) {
      setIsLoading(true)
      fetchOrCreateProfile(session.user)
        .then((p) => {
          if (mounted) {
            setProfile(p)
            profileLoadedForRef.current = session.user.id
          }
        })
        .catch((err) => {
          logger.error('Error fetching profile in useEffect:', err)
        })
        .finally(() => {
          if (mounted) {
            setIsLoading(false)
          }
        })
    } else {
      setIsLoading(false)
    }

    return () => {
      mounted = false
    }
  }, [session?.user?.id])

  async function signOut() {
    try {
      await supabase.auth.signOut()
    } catch (err) {
      logger.warn('signOut network error (ignored):', err)
    } finally {
      setProfile(null)
      setSession(null)
    }
  }

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    profile,
    isLoading,
    isAdmin: profile?.is_admin === true,
    signOut,
    refreshProfile,
    ensureSession,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// ── Hook ───────────────────────────────────────────────────
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
