import { useState, type FormEvent } from 'react'
import { Link, useNavigate, Navigate } from 'react-router-dom'
import { Eye, EyeOff, UserPlus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { friendlyError } from '@/lib/errors'
import { cn } from '@/lib/utils'
import logo from '@/assets/logo.png'
import { logger } from '@/lib/logger'

// Username rules: 3–20 chars, letters/numbers/underscores only
const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/

export default function Signup() {
  const { session } = useAuth()
  const navigate = useNavigate()

  const [username, setUsername] = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [showPass, setShowPass] = useState(false)
  const [showConf, setShowConf] = useState(false)
  const [errors, setErrors]     = useState<Record<string, string>>({})
  const [loading, setLoading]   = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  if (session) return <Navigate to="/dashboard" replace />

  function validate() {
    const e: Record<string, string> = {}
    if (!username.trim()) {
      e.username = 'Username is required.'
    } else if (!USERNAME_RE.test(username.trim())) {
      e.username = '3–20 chars, letters, numbers, and underscores only.'
    }
    if (!email.trim()) {
      e.email = 'Email is required.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      e.email = 'Enter a valid email address.'
    }
    if (!password) {
      e.password = 'Password is required.'
    } else if (password.length < 8) {
      e.password = 'Password must be at least 8 characters.'
    }
    if (!confirm) {
      e.confirm = 'Please confirm your password.'
    } else if (password !== confirm) {
      e.confirm = 'Passwords do not match.'
    }
    return e
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setServerError(null)

    const fieldErrors = validate()
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors)
      return
    }
    setErrors({})

    const trimmedUsername = username.trim().toLowerCase()
    const trimmedEmail    = email.trim().toLowerCase()

    setLoading(true)

    // 1. Sign up with Supabase Auth
    const { data, error: authError } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
      options: {
        // Pass username through metadata so the DB trigger can use it
        data: { username: trimmedUsername },
      },
    })

    if (authError) {
      setServerError(friendlyError(authError.message))
      setLoading(false)
      return
    }

    const userId = data.user?.id
    if (!userId) {
      setServerError('Signup succeeded but user ID was missing. Please try signing in.')
      setLoading(false)
      return
    }

    // 2. Create the profile row.
    // Note: there's a tiny window after signUp where the JWT may not be set in the
    // HTTP client yet, so an RLS error (42501) can occur. In that case we navigate
    // anyway — AuthContext's SIGNED_IN handler will call fetchOrCreateProfile and
    // create the profile correctly once the session is established.
    const { error: profileError } = await supabase.from('profiles').upsert(
      { id: userId, username: trimmedUsername },
      { onConflict: 'id' }
    )

    setLoading(false)

    if (profileError) {
      if (profileError.code === '23505') {
        // Unique violation on username — this is a real user error
        setErrors({ username: 'That username is already taken. Try something else!' })
        return
      }
      // Any other error (RLS, network, etc.) — AuthContext will retry via SIGNED_IN
      logger.warn('Profile upsert timing issue during signup (AuthContext will fix):', profileError.message)
    }

    navigate('/dashboard', { replace: true })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[hsl(var(--background))] px-4 py-12">
      <div className="w-full max-w-md animate-slide-up">

        {/* Logo */}
        <div className="mb-8 text-center">
          <Link to="/" className="inline-flex items-center gap-2 font-display font-bold text-amul-red text-2xl">
            <img src={logo} alt="Amul Paglu Logo" className="h-12 w-12 object-contain" />
            <span>Amul Paglu</span>
          </Link>
          <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
            Join the hunt for obscure Amul products
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-8 shadow-card-lg">
          <h1 className="mb-6 font-display text-xl font-semibold text-[hsl(var(--foreground))]">
            Create your account
          </h1>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {/* Username */}
            <Field
              id="username"
              label="Username"
              error={errors.username}
            >
              <input
                id="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="amul_fanatic"
                maxLength={20}
                className={inputCls(!!errors.username)}
              />
            </Field>

            {/* Email */}
            <Field id="email" label="Email" error={errors.email}>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={inputCls(!!errors.email)}
              />
            </Field>

            {/* Password */}
            <Field id="password" label="Password" error={errors.password}>
              <div className="relative">
                <input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  className={cn(inputCls(!!errors.password), 'pr-10')}
                />
                <ToggleEye show={showPass} onToggle={() => setShowPass((v) => !v)} />
              </div>
            </Field>

            {/* Confirm password */}
            <Field id="confirm" label="Confirm password" error={errors.confirm}>
              <div className="relative">
                <input
                  id="confirm"
                  type={showConf ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repeat password"
                  className={cn(inputCls(!!errors.confirm), 'pr-10')}
                />
                <ToggleEye show={showConf} onToggle={() => setShowConf((v) => !v)} />
              </div>
            </Field>

            {/* Server error */}
            {serverError && (
              <p className="rounded-lg bg-red-50 dark:bg-red-950/30 px-3.5 py-2.5 text-sm text-red-600 dark:text-red-400">
                {serverError}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-amul-red px-4 py-2.5 text-sm font-semibold text-white shadow-amul transition-all hover:bg-amul-red-dark active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <UserPlus size={16} />
              )}
              {loading ? 'Creating account…' : 'Create account'}
            </button>

            <p className="text-center text-xs text-[hsl(var(--muted-foreground))]">
              By signing up you agree to explore Amul products responsibly 🧀
            </p>
          </form>
        </div>

        {/* Footer */}
        <p className="mt-5 text-center text-sm text-[hsl(var(--muted-foreground))]">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-amul-red hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}

// ── Small helpers ──────────────────────────────────────────

function inputCls(hasError: boolean) {
  return cn(
    'w-full rounded-xl border bg-[hsl(var(--background))] px-3.5 py-2.5 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] outline-none transition-colors',
    'focus:border-amul-red focus:ring-2 focus:ring-amul-red/20',
    hasError ? 'border-red-400' : 'border-[hsl(var(--border))]'
  )
}

function Field({
  id, label, error, children,
}: {
  id: string
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-[hsl(var(--foreground))]">
        {label}
      </label>
      {children}
      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}
    </div>
  )
}

function ToggleEye({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-label={show ? 'Hide password' : 'Show password'}
      onClick={onToggle}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
    >
      {show ? <EyeOff size={16} /> : <Eye size={16} />}
    </button>
  )
}

