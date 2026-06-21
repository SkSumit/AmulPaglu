import { Link, NavLink, useNavigate } from 'react-router-dom'
import { Sun, Moon, Menu, X, LogOut, User, Settings } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { getTier } from '@/types'
import { cn } from '@/lib/utils'

const NAV_LINKS = [
  { to: '/explore',     label: 'Explore'     },
  { to: '/my-list',     label: 'My List'     },
  { to: '/leaderboard', label: 'Leaderboard' },
  { to: '/suggest',     label: 'Suggest'     },
]

export function Navbar() {
  const { user, profile, isAdmin, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const tier = profile ? getTier(profile.total_points) : null

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]/95 backdrop-blur supports-[backdrop-filter]:bg-[hsl(var(--background))]/80">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">

        {/* Logo */}
        <Link
          to={user ? '/dashboard' : '/'}
          className="flex items-center gap-2 font-display font-bold text-amul-red text-xl"
        >
          <span className="text-2xl">🐄</span>
          <span className="hidden sm:inline">Amul Paglu</span>
        </Link>

        {/* Desktop nav */}
        {user && (
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    'relative px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-amul-red/10 text-amul-red after:absolute after:bottom-0 after:inset-x-1.5 after:h-0.5 after:rounded-full after:bg-amul-red'
                      : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]'
                  )
                }
              >
                {label}
              </NavLink>
            ))}
            {isAdmin && (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  cn(
                    'relative px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-amul-red/10 text-amul-red after:absolute after:bottom-0 after:inset-x-1.5 after:h-0.5 after:rounded-full after:bg-amul-red'
                      : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]'
                  )
                }
              >
                Admin
              </NavLink>
            )}
          </nav>
        )}

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] transition-colors"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {user ? (
            <>
              {/* User menu (desktop) */}
              <div className="relative hidden md:block">
                <button
                  onClick={() => setUserMenuOpen((v) => !v)}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[hsl(var(--muted))] transition-colors"
                >
                  <div className="h-7 w-7 rounded-full bg-amul-red/20 flex items-center justify-center text-amul-red font-semibold text-xs">
                    {profile?.username?.[0]?.toUpperCase() ?? <User size={14} />}
                  </div>
                  <span className="text-sm font-medium">{profile?.username}</span>
                  {tier && <span className="text-base">{tier.emoji}</span>}
                </button>

                {userMenuOpen && (
                  <>
                    {/* Backdrop */}
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setUserMenuOpen(false)}
                    />
                    <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--popover))] p-1 shadow-card-lg">
                      <Link
                        to={`/profile/${profile?.username ?? user?.id}`}
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-[hsl(var(--muted))] transition-colors"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <User size={15} /> Profile
                      </Link>
                      {isAdmin && (
                        <Link
                          to="/admin"
                          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-[hsl(var(--muted))] transition-colors"
                          onClick={() => setUserMenuOpen(false)}
                        >
                          <Settings size={15} /> Admin Console
                        </Link>
                      )}
                      <hr className="my-1 border-[hsl(var(--border))]" />
                      <button
                        onClick={handleSignOut}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                      >
                        <LogOut size={15} /> Sign out
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Mobile hamburger */}
              <button
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="Toggle menu"
                className="rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] md:hidden"
              >
                {menuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
              >
                Log in
              </Link>
              <Link
                to="/signup"
                className="rounded-lg bg-amul-red px-3 py-1.5 text-sm font-medium text-white hover:bg-amul-red-dark transition-colors"
              >
                Sign up
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Mobile nav drawer */}
      {menuOpen && user && (
        <div className="border-t border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 pb-4 pt-2 md:hidden">
          <nav className="flex flex-col gap-1">
            {NAV_LINKS.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-amul-red/10 text-amul-red'
                      : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]'
                  )
                }
              >
                {label}
              </NavLink>
            ))}
            {isAdmin && (
              <NavLink
                to="/admin"
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-amul-red/10 text-amul-red'
                      : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]'
                  )
                }
              >
                Admin
              </NavLink>
            )}
            <hr className="my-2 border-[hsl(var(--border))]" />
            <Link
              to={`/profile/${profile?.username ?? user?.id}`}
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-[hsl(var(--muted))]"
            >
              <User size={15} /> Profile
            </Link>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors text-left"
            >
              <LogOut size={15} /> Sign out
            </button>
          </nav>
        </div>
      )}
    </header>
  )
}
