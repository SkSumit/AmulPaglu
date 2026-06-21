import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, refreshSession } from '@/lib/supabase'
import type { Profile } from '@/types'

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
  
  // Track last refresh time to avoid excessive refresh calls
  const lastRefreshRef = useRef<number>(0)
  
  // Periodic refresh timer
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

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
        console.error('Error creating profile:', insertErr.message)
        return null
      }
      return created
    }

    console.error('Error fetching profile:', error.message)
    return null
  }

  async function refreshProfile() {
    if (!session?.user) return
    const p = await fetchOrCreateProfile(session.user)
    setProfile(p)
  }

  // ── Ensure session is fresh ────────────────────────────
  // Supabase JS autoRefreshToken handles this internally. 
  // Manual refreshes cause race conditions and invalidate tokens.
  async function ensureSession(): Promise<boolean> {
    return !!session
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

        // Fetch profile only when the user actually changes or on initial load.
        // Skipping on TOKEN_REFRESHED avoids an extra DB round-trip every hour
        // and prevents a brief null-profile flash that breaks page guards.
        const isNewUser = profileLoadedForRef.current !== s.user.id
        if (isNewUser || event === 'SIGNED_IN' || event === 'USER_UPDATED') {
          const p = await fetchOrCreateProfile(s.user)
          if (mounted) {
            setProfile(p)
            profileLoadedForRef.current = s.user.id
          }
        }
      }
    )

    return () => {
      mounted = false
      clearTimeout(timer)
      subscription.unsubscribe()
    }
  }, [])

  async function signOut() {
    try {
      await supabase.auth.signOut()
    } catch (err) {
      console.warn('signOut network error (ignored):', err)
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
