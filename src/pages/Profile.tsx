import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Trophy, CheckCircle2, Share2, BookmarkCheck, Star } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { getTier } from '@/types'
import type { Profile, Product, Badge } from '@/types'
import { cn, getDisplayProductName } from '@/lib/utils'
import { BadgesSection, type EarnedBadgeInfo } from '@/components/badges/BadgesSection'
import { ProductImage } from '@/components/products/ProductImage'
import { shareContent, getProfileShareData } from '@/lib/share'
import { useToast, ToastContainer } from '@/components/ui/Toast'
import { Skeleton } from '@/components/ui/Skeleton'
import logo from '@/assets/logo.png'
import { logger } from '@/lib/logger'

interface TriedEntry {
  tried_at: string | null
  product: Product
}

const RARITY_PILL: Record<string, string> = {
  Common: 'bg-gray-100   text-gray-600   dark:bg-gray-800 dark:text-gray-400',
  Uncommon: 'bg-green-100  text-green-700  dark:bg-green-900/40 dark:text-green-400',
  Rare: 'bg-blue-100   text-blue-700   dark:bg-blue-900/40 dark:text-blue-400',
  Epic: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400',
  Legendary: 'bg-amber-100  text-amber-700  dark:bg-amber-900/40 dark:text-amber-400',
}



export default function ProfilePage() {
  const { username } = useParams<{ username: string }>()
  const { user, isLoading: authLoading } = useAuth()
  const { toasts, addToast, dismiss } = useToast()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [tried, setTried] = useState<TriedEntry[]>([])
  const [wantCount, setWantCount] = useState(0)
  const [rank, setRank] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [allBadges, setAllBadges] = useState<Badge[]>([])
  const [earnedBadges, setEarnedBadges] = useState<EarnedBadgeInfo[]>([])
  const [badgesLoading, setBadgesLoading] = useState(true)

  const isOwnProfile = user && profile && user.id === profile.id

  useEffect(() => {
    if (authLoading || !username) return
    void loadProfile()
  }, [authLoading, username])

  async function loadProfile() {
    setLoading(true)
    setNotFound(false)
    try {
      // Fetch profile by username
      const { data: prof, error: profErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username!)
        .single()

      if (profErr || !prof) { setNotFound(true); return }
      setProfile(prof)

      // Parallel: tried products, want count, rank
      const [triedRes, wantRes, rankRes] = await Promise.all([
        supabase
          .from('user_products')
          .select('tried_at, products(*)')
          .eq('user_id', prof.id)
          .eq('status', 'tried')
          .order('tried_at', { ascending: false }),
        supabase
          .from('user_products')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', prof.id)
          .eq('status', 'want_to_try'),
        supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .gt('total_points', prof.total_points),
      ])

      setTried(
        (triedRes.data ?? []).map((r) => ({
          tried_at: r.tried_at,
          product: r.products as unknown as Product,
        }))
      )
      setWantCount(wantRes.count ?? 0)
      setRank((rankRes.count ?? 0) + 1)

      // Load badges in parallel after profile is found
      void (async () => {
        setBadgesLoading(true)
        try {
          const [{ data: allB }, { data: earnedB }] = await Promise.all([
            supabase.from('badges').select('*').order('created_at', { ascending: true }),
            supabase.from('user_badges').select('badge_slug, earned_at').eq('user_id', prof.id),
          ])
          setAllBadges((allB ?? []) as Badge[])
          setEarnedBadges((earnedB ?? []).map((e) => ({ badge_slug: e.badge_slug, earned_at: e.earned_at })))
        } finally {
          setBadgesLoading(false)
        }
      })()
    } catch (err) {
      logger.error('Profile load error:', err)
    } finally {
      setLoading(false)
    }
  }

  if (!loading && notFound) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <img src={logo} alt="Amul Paglu Logo" className="h-20 w-20 object-contain animate-bounce" />
        <p className="font-semibold text-[hsl(var(--foreground))]">User not found</p>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">No one goes by &ldquo;{username}&rdquo; here.</p>
        <Link to="/leaderboard" className="mt-2 rounded-xl bg-amul-red px-4 py-2 text-sm font-semibold text-white hover:bg-amul-red-dark">
          View leaderboard
        </Link>
      </div>
    )
  }

  const tier = getTier(profile?.total_points ?? 0)
  const pts = profile?.total_points ?? 0

  function handleShareProfile() {
    if (!profile) return
    const shareData = getProfileShareData(
      profile.username,
      pts,
      tier.label,
      tried.length
    )
    void shareContent(shareData, addToast)
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 page-transition">

      {/* ── Header card ──────────────────────────────────── */}
      <div className="mb-8 flex flex-col items-center gap-5 rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-8 shadow-card sm:flex-row sm:items-start">
        {/* Avatar */}
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-amul-red/10 text-3xl font-bold text-amul-red">
          {loading
            ? <Skeleton className="h-20 w-20 rounded-full" />
            : profile?.username[0].toUpperCase()}
        </div>

        {/* Info */}
        <div className="flex-1 text-center sm:text-left">
          {loading ? (
            <>
              <Skeleton className="mx-auto h-7 w-40 sm:mx-0" />
              <Skeleton className="mx-auto mt-2 h-4 w-28 sm:mx-0" />
            </>
          ) : (
            <>
              <h1 className="font-display text-2xl font-bold text-[hsl(var(--foreground))] flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <span>{profile?.username}</span>
                {profile?.is_admin && (
                  <span className="rounded-full bg-amul-red/5 border border-amul-red/20 px-2 py-0.5 text-[9px] font-bold tracking-wider text-amul-red uppercase shrink-0">
                    Creator
                  </span>
                )}
                {profile?.username === 'blah_blah' && (
                  <span className="rounded-full bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/30 px-2 py-0.5 text-[9px] font-bold tracking-wider text-blue-600 dark:text-blue-400 uppercase shrink-0">
                    Amul Girl
                  </span>
                )}
                {isOwnProfile && <span className="text-sm font-normal text-[hsl(var(--muted-foreground))] shrink-0">(you)</span>}
                <button
                  onClick={handleShareProfile}
                  className="rounded-lg p-1 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] transition-colors shrink-0 animate-fade-in"
                  title="Share Profile"
                  aria-label="Share profile"
                >
                  <Share2 size={16} />
                </button>
              </h1>
              <div className="mt-1 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <span className="rounded-full bg-amul-red/10 px-2.5 py-1 text-xs font-semibold text-amul-red">
                  {tier.emoji} {tier.label}
                </span>
                {rank && (
                  <span className="flex items-center gap-1 rounded-full bg-[hsl(var(--muted))] px-2.5 py-1 text-xs font-semibold text-[hsl(var(--muted-foreground))]">
                    <Trophy size={11} /> Rank #{rank}
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        {/* Stats row */}
        <div className="flex flex-wrap justify-center gap-3 sm:justify-start w-full sm:w-auto">
          {[
            {
              label: 'Points',
              value: loading ? '…' : pts.toString(),
              icon: <Star size={14} className="text-amber-500 fill-amber-500 shrink-0" />,
              bg: 'bg-amber-500/5 border-amber-500/10 text-amber-700 dark:text-amber-400 dark:bg-amber-500/10',
            },
            {
              label: 'Tried',
              value: loading ? '…' : tried.length.toString(),
              icon: <CheckCircle2 size={14} className="text-green-500 shrink-0" />,
              bg: 'bg-green-500/5 border-green-500/10 text-green-700 dark:text-green-400 dark:bg-green-500/10',
            },
            {
              label: 'Want to try',
              value: loading ? '…' : wantCount.toString(),
              icon: <BookmarkCheck size={14} className="text-blue-500 shrink-0" />,
              bg: 'bg-blue-500/5 border-blue-500/10 text-blue-700 dark:text-blue-400 dark:bg-blue-500/10',
            },
          ].map(({ label, value, icon, bg }) => (
            <div
              key={label}
              className={cn(
                "flex flex-col items-center justify-center min-w-[90px] px-3.5 py-2 rounded-2xl border shadow-sm transition-all hover:scale-[1.03] hover:shadow-md",
                bg
              )}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                {icon}
                <span className="font-display text-lg font-black text-[hsl(var(--foreground))] leading-none">
                  {value}
                </span>
              </div>
              <p className="text-[10px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wider leading-none">
                {label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tried products grid ───────────────────────────── */}
      <h2 className="mb-4 font-display text-lg font-bold text-[hsl(var(--foreground))]">
        <CheckCircle2 size={18} className="mr-1.5 inline text-green-500" />
        Tried products
        {!loading && <span className="ml-2 text-sm font-normal text-[hsl(var(--muted-foreground))]">{tried.length}</span>}
      </h2>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : tried.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[hsl(var(--border))] py-14 text-center">
          <span className="text-4xl">🥛</span>
          <p className="mt-3 text-sm text-[hsl(var(--muted-foreground))]">
            {isOwnProfile ? 'You haven’t tried anything yet.' : `${profile?.username} hasn’t tried anything yet.`}
          </p>
          {isOwnProfile && (
            <Link to="/explore" className="mt-3 rounded-xl bg-amul-red px-4 py-1.5 text-xs font-semibold text-white hover:bg-amul-red-dark">
              Start Pagluing
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tried.map(({ tried_at, product }, i) => {
            const displayName = product?.name ? getDisplayProductName(product.name) : 'Unknown product'
            return (
              <div
                key={i}
                className="flex items-center gap-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 shadow-card min-w-0"
              >
                {/* Image / fallback */}
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[hsl(var(--muted))]">
                  <ProductImage
                    src={product?.image_url}
                    name={product?.name ?? 'Unknown product'}
                    className="h-full w-full object-cover"
                    size="xs"
                  />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[hsl(var(--foreground))]">{displayName}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    {product?.rarity_label && (
                      <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-medium', RARITY_PILL[product.rarity_label] ?? '')}>
                        {product.rarity_label}
                      </span>
                    )}
                    {tried_at && (
                      <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                        {new Date(tried_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                </div>
                {product?.points != null && (
                  <span className="ml-auto shrink-0 text-xs font-bold text-amul-gold">+{product.points}pt</span>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Link to own list */}
      {isOwnProfile && (
        <div className="mt-6 flex justify-center">
          <Link
            to="/my-list"
            className="flex items-center gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-5 py-2.5 text-sm font-medium text-[hsl(var(--foreground))] shadow-card hover:shadow-card-lg hover:-translate-y-0.5 transition-all"
          >
            <BookmarkCheck size={16} className="text-blue-500" />
            View full bucket list
          </Link>
        </div>
      )}

      {/* ── Badges ───────────────────────────────────────── */}
      <div className="mt-8 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-[hsl(var(--foreground))]">
            🏅 Badges
          </h2>
          {!badgesLoading && (
            <span className="text-xs text-[hsl(var(--muted-foreground))]">
              {earnedBadges.length} / {allBadges.length} earned
            </span>
          )}
        </div>
        <BadgesSection
          allBadges={allBadges}
          earnedList={earnedBadges}
          loading={badgesLoading}
          maxVisible={isOwnProfile ? 99 : 8}
        />
      </div>
      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </div>
  )
}
