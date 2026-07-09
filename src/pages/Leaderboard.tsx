import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Trophy, Medal, Crown } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { getTier } from '@/types'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/Skeleton'
import { CountUp } from '@/components/ui/CountUp'
import { logger } from '@/lib/logger'

interface LeaderEntry {
  id: string
  username: string
  avatar_url: string | null
  total_points: number
  tried_count: number
  is_admin: boolean
}

const PAGE_SIZE = 50



// ── Tier gradient pill ─────────────────────────────────────
function TierPill({ emoji, label, tierLabel }: { emoji: string; label: string; tierLabel: string }) {
  const grad: Record<string, string> = {
    'Lactose Trainee': 'from-gray-400 to-gray-500',
    'Shrikhand Scholar': 'from-green-500 to-green-600',
    'Kulfi Kingpin': 'from-cyan-400 to-cyan-600',
    'Makhan Chor': 'from-amber-400 to-amber-500',
    'Amul Paglu': 'from-amul-red to-amul-gold',
  }
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full bg-gradient-to-r px-2.5 py-0.5 text-[10px] font-bold text-white',
      grad[tierLabel] ?? 'from-gray-400 to-gray-500'
    )}>
      {emoji} {label}
    </span>
  )
}



export default function Leaderboard() {
  const { user, isLoading: authLoading } = useAuth()

  const [entries, setEntries] = useState<LeaderEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [myRank, setMyRank] = useState<number | null>(null)
  const [myEntry, setMyEntry] = useState<LeaderEntry | null>(null)
  const [totalUsers, setTotalUsers] = useState<number | null>(null)

  useEffect(() => {
    if (authLoading) return
    void loadData()
  }, [authLoading])

  async function loadData() {
    setLoading(true)
    try {
      const [{ data, error }, { count: userCount }] = await Promise.all([
        (supabase as any).rpc('get_leaderboard', { max_rows: PAGE_SIZE }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
      ])
      setTotalUsers(userCount ?? null)

      if (error) throw error

      const rows: LeaderEntry[] = (data ?? []).map((e: any) => ({
        id: e.id,
        username: e.username,
        avatar_url: e.avatar_url,
        total_points: e.total_points,
        is_admin: e.is_admin,
        tried_count: Number(e.tried_count ?? 0),
      }))

      setEntries(rows)

      if (user) {
        const rank = rows.findIndex((r) => r.id === user.id)
        if (rank >= 0) {
          setMyRank(rank + 1)
          setMyEntry(rows[rank])
        } else {
          // User is outside top list — fetch their own stats
          const [profileRes, triedRes] = await Promise.all([
            supabase.from('profiles').select('id,username,avatar_url,total_points,is_admin').eq('id', user.id).single(),
            supabase.from('user_products').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'tried'),
          ])
          if (profileRes.data) {
            const myData: LeaderEntry = { ...profileRes.data, tried_count: triedRes.count ?? 0 } as LeaderEntry
            setMyEntry(myData)
            // Compute rank: how many users have more points
            const { count: above } = await supabase
              .from('profiles')
              .select('id', { count: 'exact', head: true })
              .gt('total_points', profileRes.data.total_points)
            setMyRank((above ?? 0) + 1)
          }
        }
      }
    } catch (err) {
      logger.error('Leaderboard load error:', err)
    } finally {
      setLoading(false)
    }
  }

  const MEDAL = [
    { icon: Crown, color: 'text-amul-gold', bg: 'bg-amber-50  dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800' },
    { icon: Medal, color: 'text-slate-400', bg: 'bg-slate-50  dark:bg-slate-800/40', border: 'border-slate-200 dark:border-slate-700' },
    { icon: Trophy, color: 'text-orange-400', bg: 'bg-orange-50 dark:bg-orange-950/30', border: 'border-orange-200 dark:border-orange-800' },
  ]

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 page-transition">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold text-[hsl(var(--foreground))] sm:text-3xl">
          🏆 Leaderboard
        </h1>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
          Top {PAGE_SIZE} Amul Paglus, ranked by points
          {totalUsers !== null && (
            <> &middot; <span className="font-semibold text-[hsl(var(--foreground))]">{totalUsers}</span> registered users total</>
          )}
        </p>
      </div>

      {/* My rank banner */}
      {!loading && myRank && myRank > 3 && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-amul-red/20 bg-amul-red/5 px-4 py-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amul-red text-sm font-bold text-white">
            #{myRank}
          </span>
          <p className="text-sm text-[hsl(var(--foreground))]">
            You're ranked <span className="font-bold text-amul-red">#{myRank}</span> on the leaderboard
          </p>
        </div>
      )}

      {/* Top 3 podium */}
      {!loading && entries.length >= 3 && (
        <div className="mb-8">
          {/* Podium cards — order: 2nd (left), 1st (centre), 3rd (right) */}
          <div className="flex items-end justify-center gap-3">
            {([entries[1], entries[0], entries[2]] as const).map((entry, podiumIdx) => {

              const configs = [
                { h: 'h-28', ring: 'ring-2 ring-amber-400', avatarRing: 'ring-4 ring-amber-400', podiumBg: 'bg-amber-400', labelBg: 'bg-amber-50 dark:bg-amber-950/30', icon: Crown, iconColor: 'text-amber-600', avatarSize: 'h-16 w-16 text-2xl', label: '1st', medalColor: '#FFD700' },
                { h: 'h-20', ring: '', avatarRing: 'ring-4 ring-slate-400', podiumBg: 'bg-slate-400', labelBg: 'bg-slate-50 dark:bg-slate-800/40', icon: Medal, iconColor: 'text-slate-500', avatarSize: 'h-12 w-12 text-xl', label: '2nd', medalColor: '#C0C0C0' },
                { h: 'h-16', ring: '', avatarRing: 'ring-4 ring-orange-400', podiumBg: 'bg-orange-400', labelBg: 'bg-orange-50 dark:bg-orange-950/30', icon: Trophy, iconColor: 'text-orange-500', avatarSize: 'h-12 w-12 text-xl', label: '3rd', medalColor: '#CD7F32' },
              ]
              const cfg = podiumIdx === 1 ? configs[0] : podiumIdx === 0 ? configs[1] : configs[2]
              const MedalIcon = cfg.icon
              const tier = getTier(entry.total_points)
              const isMe = entry.id === user?.id
              return (
                <Link
                  key={entry.id}
                  to={`/profile/${entry.username}`}
                  className="flex flex-col items-center gap-0 min-w-0 flex-1 max-w-[120px]"
                >
                  {/* Avatar floating above podium */}
                  <div className={cn(
                    'flex shrink-0 items-center justify-center rounded-full bg-amul-red/10 font-black text-amul-red shadow-lg',
                    cfg.avatarSize,
                    cfg.avatarRing,
                    isMe && 'ring-amul-red'
                  )}>
                    {entry.username[0].toUpperCase()}
                  </div>
                  {/* Name + tier */}
                  <p className="mt-2 max-w-full truncate px-1 text-center text-xs font-bold text-[hsl(var(--foreground))] flex flex-wrap items-center justify-center gap-1">
                    <span>{isMe ? 'You' : entry.username}</span>
                    {entry.is_admin && (
                      <span className="rounded-full bg-amul-red/5 border border-amul-red/20 px-1 py-0.5 text-[8px] font-bold tracking-wider text-amul-red uppercase shrink-0 scale-90">
                        Creator
                      </span>
                    )}
                    {entry.username === 'blah_blah' && (
                      <span className="rounded-full bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/30 px-1 py-0.5 text-[8px] font-bold tracking-wider text-blue-600 dark:text-blue-400 uppercase shrink-0 scale-90">
                        Amul Girl
                      </span>
                    )}
                  </p>
                  <p className="mb-1 text-center text-[10px] text-[hsl(var(--muted-foreground))]">{tier.emoji} {tier.label}</p>
                  <p className="mb-1 text-center text-sm font-bold text-amul-gold"><CountUp to={entry.total_points} /> pts</p>
                  {/* Podium block */}
                  <div className={cn(
                    'flex w-full items-start justify-center rounded-t-xl pt-2',
                    cfg.h,
                    cfg.podiumBg
                  )}>
                    <MedalIcon size={20} className="text-white drop-shadow" />
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Full table */}
      <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-card overflow-hidden">
        {loading ? (
          <div className="divide-y divide-[hsl(var(--border))]">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="h-6 w-6 rounded-full" />
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-5 w-14" />
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <span className="text-4xl">🥛</span>
            <p className="mt-3 text-sm font-medium text-[hsl(var(--foreground))]">No one here yet!</p>
            <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Be the first to try some products.</p>
          </div>
        ) : (
          <div className="divide-y divide-[hsl(var(--border))]">
            {entries.map((entry, i) => {
              const rank = i + 1
              const tier = getTier(entry.total_points)
              const isMe = entry.id === user?.id
              const medal = rank <= 3 ? MEDAL[rank - 1] : null
              const MedalIcon = medal?.icon
              return (
                <Link
                  key={entry.id}
                  to={`/profile/${entry.username}`}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[hsl(var(--muted))]/50',
                    isMe && 'bg-amul-red/5 hover:bg-amul-red/8'
                  )}
                >
                  {/* Rank */}
                  <div className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                    rank === 1 ? 'bg-amber-100 text-amber-600 dark:bg-amber-950/50' :
                      rank === 2 ? 'bg-slate-100 text-slate-500 dark:bg-slate-800' :
                        rank === 3 ? 'bg-orange-100 text-orange-500 dark:bg-orange-950/50' :
                          'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]'
                  )}>
                    {MedalIcon ? <MedalIcon size={14} className={medal!.color} /> : rank}
                  </div>

                  {/* Avatar */}
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amul-red/10 text-sm font-bold text-amul-red">
                    {entry.username[0].toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-sm font-semibold truncate flex flex-wrap items-center gap-2', isMe && 'text-amul-red')}>
                      <span>{isMe ? `${entry.username} (you)` : entry.username}</span>
                      {entry.is_admin && (
                        <span className="rounded-full bg-amul-red/5 border border-amul-red/20 px-2 py-0.5 text-[9px] font-bold tracking-wider text-amul-red uppercase shrink-0">
                          Creator
                        </span>
                      )}
                      {entry.username === 'blah_blah' && (
                        <span className="rounded-full bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/30 px-2 py-0.5 text-[9px] font-bold tracking-wider text-blue-600 dark:text-blue-400 uppercase shrink-0">
                          Amul Girl
                        </span>
                      )}
                    </p>
                    <div className="mt-0.5 flex items-center gap-2">
                      <TierPill emoji={tier.emoji} label={tier.label} tierLabel={tier.label} />
                      <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{entry.tried_count} tried</span>
                    </div>
                  </div>

                  {/* Points */}
                  <span className="shrink-0 text-sm font-bold text-amul-gold">
                    {entry.total_points} pts
                  </span>
                </Link>
              )
            })}
          </div>
        )}

        {/* Pinned current-user row — shown only when user is outside the visible top list */}
        {!loading && myRank !== null && myRank > entries.length && myEntry && (() => {
          const tier = getTier(myEntry.total_points)
          return (
            <div className="border-t-2 border-amul-red/30 bg-amul-red/5 flex items-center gap-3 px-4 py-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amul-red/20 text-xs font-bold text-amul-red">
                {myRank}
              </div>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amul-red/20 text-sm font-bold text-amul-red">
                {myEntry.username[0].toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-amul-red truncate flex flex-wrap items-center gap-2">
                  <span>{myEntry.username} (you)</span>
                  {myEntry.is_admin && (
                    <span className="rounded-full bg-amul-red/5 border border-amul-red/20 px-2 py-0.5 text-[9px] font-bold tracking-wider text-amul-red uppercase shrink-0">
                      Creator
                    </span>
                  )}
                  {myEntry.username === 'blah_blah' && (
                    <span className="rounded-full bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/30 px-2 py-0.5 text-[9px] font-bold tracking-wider text-blue-600 dark:text-blue-400 uppercase shrink-0">
                      Amul Girl
                    </span>
                  )}
                </p>
                <div className="mt-0.5 flex items-center gap-2">
                  <TierPill emoji={tier.emoji} label={tier.label} tierLabel={tier.label} />
                  <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{myEntry.tried_count} tried</span>
                </div>
              </div>
              <span className="shrink-0 text-sm font-bold text-amul-gold">{myEntry.total_points} pts</span>
            </div>
          )
        })()}
      </div>
    </div>
  )
}
