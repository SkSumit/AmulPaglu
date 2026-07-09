import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, List, Lightbulb, Trophy, Star, Clock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { getTier, TIERS } from '@/types'
import { cn, getDisplayProductName } from '@/lib/utils'
import { Skeleton } from '@/components/ui/Skeleton'
import { BadgesSection, type EarnedBadgeInfo } from '@/components/badges/BadgesSection'
import { ProductImage } from '@/components/products/ProductImage'
import type { Badge } from '@/types'

// ── Types ──────────────────────────────────────────────────
interface DashboardStats {
  totalProducts: number
  triedCount: number
  wantToTryCount: number
  rank: number | null
}

interface RecentActivity {
  id: string
  tried_at: string | null
  notes: string | null
  products: {
    id: string
    name: string
    category: string | null
    rarity_label: string | null
    points: number | null
    image_url: string | null
  } | null
}

// ── SVG Progress Ring — animates from 0 on mount ──────────
function ProgressRing({
  value,
  max,
  size = 140,
  stroke = 10,
}: {
  value: number
  max: number
  size?: number
  stroke?: number
}) {
  const [displayed, setDisplayed] = useState(0)

  useEffect(() => {
    // Animate from 0 to value over 1s
    const start = performance.now()
    const duration = 1000
    function tick(now: number) {
      const t = Math.min((now - start) / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplayed(Math.round(eased * value))
      if (t < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [value])

  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const pct = max > 0 ? Math.min(displayed / max, 1) : 0
  const offset = circ * (1 - pct)

  return (
    <svg width={size} height={size} className="-rotate-90">
      {/* Track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="hsl(var(--muted))"
        strokeWidth={stroke}
      />
      {/* Progress */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#C8102E"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 0.05s linear' }}
      />
    </svg>
  )
}



// ── Rarity pill colors ─────────────────────────────────────
const RARITY_PILL: Record<string, string> = {
  Common: 'bg-gray-100   text-gray-600   dark:bg-gray-800 dark:text-gray-400',
  Uncommon: 'bg-green-100  text-green-700  dark:bg-green-900/40 dark:text-green-400',
  Rare: 'bg-blue-100   text-blue-700   dark:bg-blue-900/40 dark:text-blue-400',
  Epic: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400',
  Legendary: 'bg-amber-100  text-amber-700  dark:bg-amber-900/40 dark:text-amber-400',
}

// ── Main component ─────────────────────────────────────────
export default function Dashboard() {
  const { user, profile, isLoading: authLoading, refreshProfile, ensureSession, isAdmin } = useAuth()

  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [activity, setActivity] = useState<RecentActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [allBadges, setAllBadges] = useState<Badge[]>([])
  const [earnedBadges, setEarnedBadges] = useState<EarnedBadgeInfo[]>([])
  const [badgesLoading, setBadgesLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return          // auth not resolved yet
    if (!user) { setLoading(false); return }  // not logged in
    void loadDashboard()            // load as soon as user is known; profile may still be arriving
  }, [authLoading, user?.id])

  // Load badges separately so they don't block the main stats
  useEffect(() => {
    if (authLoading || !user) return
    void loadBadges()
  }, [authLoading, user?.id])

  // Re-fetch data on visibility change (wake-up fallback)
  useEffect(() => {
    if (authLoading || !user) return
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.warn('Dashboard visible, re-fetching stats/badges...')
        void loadDashboard()
        void loadBadges()
      }
    }
    window.addEventListener('visibilitychange', handleVisibilityChange)
    return () => window.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [authLoading, user?.id])

  async function loadBadges() {
    if (!user) return
    setBadgesLoading(true)
    try {
      await ensureSession()
      const [{ data: allB }, { data: earnedB }] = await Promise.all([
        supabase.from('badges').select('*').order('created_at', { ascending: true }),
        supabase.from('user_badges').select('badge_slug, earned_at').eq('user_id', user.id),
      ])
      setAllBadges((allB ?? []) as Badge[])
      setEarnedBadges((earnedB ?? []).map((e) => ({ badge_slug: e.badge_slug, earned_at: e.earned_at })))
    } catch (err) {
      console.error('Badges load error:', err)
    } finally {
      setBadgesLoading(false)
    }
  }

  async function loadDashboard() {
    if (!user) return
    setLoading(true)
    try {
      await ensureSession()
      // Run all queries in parallel
      const [
        { count: totalProducts },
        { count: triedCount },
        { count: wantCount },
        { data: activityData },
        { data: allTriedPoints },
      ] = await Promise.all([
        // Total approved products
        supabase
          .from('products')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'approved'),

        // User's tried count
        supabase
          .from('user_products')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('status', 'tried'),

        // User's want_to_try count
        supabase
          .from('user_products')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('status', 'want_to_try'),

        // Recent activity — last 5 tried products
        supabase
          .from('user_products')
          .select(`
          id,
          tried_at,
          notes,
          products (
            id, name, category, rarity_label, points, image_url
          )
        `)
          .eq('user_id', user.id)
          .eq('status', 'tried')
          .order('tried_at', { ascending: false })
          .limit(5),

        // All tried products with their current points (for live total)
        supabase
          .from('user_products')
          .select('products(points)')
          .eq('user_id', user.id)
          .eq('status', 'tried'),
      ])

      // Calculate live total points from current product values
      const livePoints = ((allTriedPoints ?? []) as unknown as { products: { points: number | null } | null }[])
        .reduce((sum, row) => sum + (row.products?.points ?? 0), 0)

      // Rank: count users with strictly more points
      const { count: rankCount } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .gt('total_points', livePoints)

      setStats({
        totalProducts: totalProducts ?? 0,
        triedCount: triedCount ?? 0,
        wantToTryCount: wantCount ?? 0,
        rank: rankCount !== null ? rankCount + 1 : null,
      })

      setActivity((activityData as unknown as RecentActivity[]) ?? [])

      // Sync profile total_points if it drifted (e.g. admin changed product points)
      if (livePoints !== (profile?.total_points ?? -1)) {
        await supabase.from('profiles').update({ total_points: livePoints }).eq('id', user.id)
      }
      await refreshProfile()
    } catch (err) {
      console.error('Dashboard load error:', err)
    } finally {
      setLoading(false)
    }
  }

  const points = profile?.total_points ?? 0
  const tier = getTier(points)
  const nextTier = TIERS.find((t) => t.minPoints > points)
  const pct = stats && stats.totalProducts > 0
    ? Math.round((stats.triedCount / stats.totalProducts) * 100)
    : 0

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 page-transition">

      {/* ── Welcome banner ──────────────────────────────────── */}
      <div className="mb-8 flex flex-col gap-1">
        <p className="text-sm text-[hsl(var(--muted-foreground))]">Welcome back,</p>
        <h1 className="font-display text-2xl font-bold text-[hsl(var(--foreground))] sm:text-3xl flex flex-wrap items-center gap-2">
          {profile ? (
            <>
              <span>{profile.username}</span>
              {isAdmin && (
                <span className="rounded-full bg-amul-red/5 border border-amul-red/20 px-2 py-0.5 text-[9px] font-bold tracking-wider text-amul-red uppercase shrink-0">
                  Creator
                </span>
              )}
              {profile.username === 'blah_blah' && (
                <span className="rounded-full bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/30 px-2 py-0.5 text-[9px] font-bold tracking-wider text-blue-600 dark:text-blue-400 uppercase shrink-0">
                  Amul Girl
                </span>
              )}
              <span>{tier.emoji}</span>
            </>
          ) : (
            <span className="inline-block h-7 w-40 animate-pulse rounded-lg bg-[hsl(var(--muted))] align-middle" />
          )}
        </h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          You're a{' '}
          <span className="font-semibold text-amul-red">{tier.label}</span>
          {nextTier && (
            <> — {nextTier.minPoints - points} pts to <span className="font-semibold">{nextTier.emoji} {nextTier.label}</span></>
          )}
        </p>
      </div>

      {/* ── Top grid: progress ring + stats ─────────────────── */}
      <div className="mb-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">

        {/* Progress ring card */}
        <div className="sm:col-span-2 lg:col-span-1 flex flex-col items-center justify-center rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-card">
          {loading ? (
            <Skeleton className="h-36 w-36 rounded-full" />
          ) : (
            <div className="relative flex items-center justify-center">
              <ProgressRing value={stats?.triedCount ?? 0} max={stats?.totalProducts ?? 1} size={140} stroke={12} />
              <div className="absolute flex flex-col items-center">
                <span className="font-display text-2xl font-bold text-[hsl(var(--foreground))]">
                  {pct}%
                </span>
                <span className="text-[10px] text-[hsl(var(--muted-foreground))]">tried</span>
              </div>
            </div>
          )}
          <div className="mt-3 text-center text-xs text-[hsl(var(--muted-foreground))]">
            {loading ? <Skeleton className="h-4 w-28 mx-auto" /> : (
              <>{stats?.triedCount} of {stats?.totalProducts} products</>
            )}
          </div>
        </div>

        {/* Points */}
        <StatCard
          loading={loading}
          icon={<Star className="text-amul-gold" size={20} />}
          label="Total points"
          value={points.toString()}
          sub={`${tier.emoji} ${tier.label}`}
          accent
        />

        {/* Rank */}
        <StatCard
          loading={loading}
          icon={<Trophy className="text-amul-red" size={20} />}
          label="Leaderboard rank"
          value={stats?.rank != null ? `#${stats.rank}` : '—'}
          sub="among all users"
        />

        {/* Want to try */}
        <StatCard
          loading={loading}
          icon={<List className="text-blue-500" size={20} />}
          label="Want to try"
          value={stats?.wantToTryCount?.toString() ?? '—'}
          sub="on your bucket list"
        />
      </div>

      {/* ── Tier progress bar ────────────────────────────────── */}
      {nextTier && (
        <div className="mb-6 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-card">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium text-[hsl(var(--foreground))]">
              {tier.emoji} {tier.label}
            </span>
            <span className="text-[hsl(var(--muted-foreground))]">
              {nextTier.emoji} {nextTier.label} at {nextTier.minPoints} pts
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[hsl(var(--muted))]">
            <div
              className="h-full rounded-full bg-amul-red transition-all duration-700"
              style={{
                width: `${Math.round(
                  ((points - tier.minPoints) / (nextTier.minPoints - tier.minPoints)) * 100
                )}%`,
              }}
            />
          </div>
          <p className="mt-1.5 text-right text-xs text-[hsl(var(--muted-foreground))]">
            {points} / {nextTier.minPoints} pts
          </p>
        </div>
      )}

      {/* ── Bottom: activity + quick actions ────────────────── */}
      <div className="grid gap-5 lg:grid-cols-3">

        {/* Recent activity */}
        <div className="lg:col-span-2 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-card min-w-0">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold text-[hsl(var(--foreground))]">
              <Clock size={16} className="text-[hsl(var(--muted-foreground))]" />
              Recent activity
            </h2>
            <Link to="/my-list" className="text-xs text-amul-red hover:underline">
              View all →
            </Link>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : activity.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="relative mb-2">
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-amul-red/10 to-amul-gold/10">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-amul-red/15 to-amul-gold/15">
                    <span className="text-4xl">🥛</span>
                  </div>
                </div>
                <div className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full bg-amul-gold/20 text-sm animate-bounce">
                  ✨
                </div>
                <div className="absolute -bottom-1 -left-2 flex h-5 w-5 items-center justify-center rounded-full bg-amul-red/15 text-[10px]">
                  🧀
                </div>
              </div>
              <p className="mt-3 text-sm font-semibold text-[hsl(var(--foreground))]">No tries yet!</p>
              <p className="mt-1 max-w-[220px] text-xs text-[hsl(var(--muted-foreground))]">
                Head to Explore and mark your first product as tried.
              </p>
              <Link
                to="/explore"
                className="mt-4 rounded-lg bg-amul-red px-4 py-1.5 text-xs font-semibold text-white hover:bg-amul-red-dark"
              >
                Start Pagluing
              </Link>
            </div>
          ) : (
            <ul className="space-y-3">
              {activity.map((item) => {
                const p = item.products
                const displayName = p?.name ? getDisplayProductName(p.name) : 'Unknown product'
                return (
                  <li key={item.id} className="flex items-center gap-3">
                    {/* Image / placeholder */}
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--muted))] text-lg overflow-hidden">
                      <ProductImage
                        src={p?.image_url}
                        name={p?.name ?? 'Unknown product'}
                        className="h-full w-full object-cover"
                        size="xs"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[hsl(var(--foreground))]">
                        {displayName}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                        {p?.rarity_label && (
                          <span className={cn(
                            'rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                            RARITY_PILL[p.rarity_label] ?? 'bg-gray-100 text-gray-600'
                          )}>
                            {p.rarity_label}
                          </span>
                        )}
                        <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                          {item.tried_at
                            ? new Date(item.tried_at).toLocaleDateString('en-IN', {
                              day: 'numeric', month: 'short', year: 'numeric',
                            })
                            : ''}
                        </span>
                      </div>
                    </div>
                    {p?.points != null && (
                      <span className="shrink-0 text-xs font-bold text-amul-gold">
                        +{p.points}pt{p.points !== 1 ? 's' : ''}
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Quick actions */}
        <div className="flex flex-col gap-4 min-w-0">
          <h2 className="font-semibold text-[hsl(var(--foreground))]">Quick actions</h2>

          {[
            {
              to: '/explore',
              icon: Search,
              label: 'Browse products',
              desc: 'Find new Amul products to try',
              color: 'bg-amul-red/10 text-amul-red',
            },
            {
              to: '/my-list',
              icon: List,
              label: 'My bucket list',
              desc: `${stats?.wantToTryCount ?? 0} products waiting`,
              color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
            },
            {
              to: '/leaderboard',
              icon: Trophy,
              label: 'Leaderboard',
              desc: stats?.rank != null ? `You're #${stats.rank}` : 'See how you rank',
              color: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
            },
            {
              to: '/suggest',
              icon: Lightbulb,
              label: 'Suggest a product',
              desc: 'Found something obscure? Tell us',
              color: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
            },
          ].map(({ to, icon: Icon, label, desc, color }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 shadow-card transition-all hover:shadow-card-lg hover:-translate-y-0.5 min-w-0 w-full"
            >
              <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', color)}>
                <Icon size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[hsl(var(--foreground))]">{label}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Badges section ───────────────────────────────── */}
      <div className="mt-6 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-[hsl(var(--foreground))]">🏅 Your Badges</h2>
          <span className="text-xs text-[hsl(var(--muted-foreground))]">
            {earnedBadges.length} / {allBadges.length} earned
          </span>
        </div>
        <BadgesSection
          allBadges={allBadges}
          earnedList={earnedBadges}
          loading={badgesLoading}
          maxVisible={12}
        />
      </div>
    </div>
  )
}

// ── Stat card ──────────────────────────────────────────────
function StatCard({
  loading,
  icon,
  label,
  value,
  sub,
  accent,
}: {
  loading: boolean
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  accent?: boolean
}) {
  return (
    <div className={cn(
      'rounded-2xl border border-[hsl(var(--border))] p-5 shadow-card',
      accent ? 'bg-amul-red text-white' : 'bg-[hsl(var(--card))]'
    )}>
      <div className={cn(
        'mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg',
        accent ? 'bg-white/20' : 'bg-[hsl(var(--muted))]'
      )}>
        {icon}
      </div>
      <p className={cn('text-xs font-medium mb-1', accent ? 'text-white/70' : 'text-[hsl(var(--muted-foreground))]')}>
        {label}
      </p>
      {loading ? (
        <Skeleton className={cn('h-8 w-20', accent && 'bg-white/20')} />
      ) : (
        <p className={cn('font-display text-2xl font-bold', accent ? 'text-white' : 'text-[hsl(var(--foreground))]')}>
          {value}
        </p>
      )}
      {sub && (
        <p className={cn('mt-1 text-xs', accent ? 'text-white/70' : 'text-[hsl(var(--muted-foreground))]')}>
          {sub}
        </p>
      )}
    </div>
  )
}

