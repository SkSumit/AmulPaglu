import { useState } from 'react'
import { X, Lock, Share2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Badge } from '@/types'
import { useToast, ToastContainer } from '@/components/ui/Toast'
import { shareContent, getBadgeShareData } from '@/lib/share'

// ── Badge Card ─────────────────────────────────────────────
interface BadgeCardProps {
  badge: Badge
  earned: boolean
  earnedAt?: string | null
  onClick: () => void
}

function BadgeCard({ badge, earned, onClick }: BadgeCardProps) {
  const isPagluest = badge.slug === 'amul_pagluest'
  return (
    <button
      onClick={onClick}
      title={badge.name}
      className={cn(
        'relative flex flex-col items-center gap-1.5 rounded-2xl border p-2 sm:p-3 text-center transition-all hover:scale-105 hover:shadow-md focus:outline-none',
        earned
          ? isPagluest
            ? 'badge-pagluest'
            : 'border-amul-red/20 bg-amul-red/5 dark:bg-amul-red/10 badge-shine'
          : 'border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30 opacity-50 grayscale'
      )}
    >
      <span className="text-3xl leading-none">{badge.icon}</span>
      <span className={cn('text-[11px] font-semibold leading-tight', earned ? 'text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))]')}>
        {badge.name}
      </span>
      {!earned && (
        <Lock size={10} className="absolute right-1.5 top-1.5 text-[hsl(var(--muted-foreground))]" />
      )}
    </button>
  )
}

// ── Badge Detail Modal ─────────────────────────────────────
interface BadgeModalProps {
  badge: Badge
  earned: boolean
  earnedAt?: string | null
  onClose: () => void
}

function BadgeModal({ badge, earned, earnedAt, onClose }: BadgeModalProps) {
  const { toasts, addToast, dismiss } = useToast()

  function handleShareBadge() {
    const data = getBadgeShareData(badge)
    void shareContent(data, addToast)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-[hsl(var(--card))] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
        >
          <X size={15} />
        </button>

        <div className={cn('flex flex-col items-center text-center', !earned && 'opacity-60 grayscale')}>
          <div className={cn(
            'flex h-20 w-20 items-center justify-center rounded-2xl text-5xl transition-all',
            earned
              ? badge.slug === 'amul_pagluest'
                ? 'bg-gradient-to-br from-amber-400/20 to-yellow-500/30 border border-amber-400/50 shadow-[0_0_20px_rgba(245,158,11,0.4)] animate-bounce-gentle'
                : 'bg-amul-red/10'
              : 'bg-[hsl(var(--muted))]'
          )}>
            {badge.icon}
          </div>

          {!earned && (
            <div className="mt-3 flex items-center gap-1.5 rounded-full bg-[hsl(var(--muted))] px-3 py-1 text-xs font-semibold text-[hsl(var(--muted-foreground))]">
              <Lock size={11} /> Locked
            </div>
          )}
          {earned && (
            <div className={cn(
              'mt-3 flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold',
              badge.slug === 'amul_pagluest'
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300/30 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
            )}>
              ✓ {badge.slug === 'amul_pagluest' ? 'Ultimate Title Earned' : 'Earned'}{earnedAt ? ` · ${new Date(earnedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
            </div>
          )}
        </div>

        <h2 className="mt-4 text-center font-display text-xl font-bold text-[hsl(var(--foreground))]">
          {badge.name}
        </h2>
        <p className="mt-2 text-center text-sm text-[hsl(var(--muted-foreground))]">
          {badge.description}
        </p>
        {!earned ? (
          <p className="mt-3 rounded-xl bg-[hsl(var(--muted))]/50 px-3 py-2 text-center text-xs text-[hsl(var(--muted-foreground))]">
            Keep exploring to unlock this badge!
          </p>
        ) : (
          <button
            onClick={handleShareBadge}
            className="mt-5 w-full flex items-center justify-center gap-2 rounded-xl bg-amul-red px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-amul-red-dark"
          >
            <Share2 size={13} />
            Share Achievement
          </button>
        )}
      </div>
      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </div>
  )
}

// ── Main Badges Section ────────────────────────────────────
export interface EarnedBadgeInfo {
  badge_slug: string
  earned_at: string
}

interface BadgesSectionProps {
  allBadges: Badge[]
  earnedList: EarnedBadgeInfo[]
  loading?: boolean
  /** Compact mode: max rows before showing "Show more" */
  maxVisible?: number
}

export function BadgesSection({ allBadges, earnedList, loading, maxVisible = 99 }: BadgesSectionProps) {
  const [selected, setSelected] = useState<Badge | null>(null)
  const [showAll, setShowAll]   = useState(false)

  if (loading) {
    return (
      <div className="grid grid-cols-3 min-[380px]:grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl bg-[hsl(var(--muted))]" />
        ))}
      </div>
    )
  }

  if (allBadges.length === 0) {
    return (
      <p className="text-center text-sm text-[hsl(var(--muted-foreground))]">No badges configured yet.</p>
    )
  }

  const earnedMap = new Map(earnedList.map((e) => [e.badge_slug, e.earned_at]))
  const earnedBadges   = allBadges.filter((b) => earnedMap.has(b.slug))
  const unearnedBadges = allBadges.filter((b) => !earnedMap.has(b.slug))
  const sorted         = [...earnedBadges, ...unearnedBadges]
  const visible        = showAll ? sorted : sorted.slice(0, maxVisible)
  const hiddenCount    = sorted.length - maxVisible

  const selectedEarnedAt = selected ? earnedMap.get(selected.slug) ?? null : null
  const isEarned = selected ? earnedMap.has(selected.slug) : false

  return (
    <>
      <div className="grid grid-cols-3 min-[380px]:grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
        {visible.map((badge) => (
          <BadgeCard
            key={badge.slug}
            badge={badge}
            earned={earnedMap.has(badge.slug)}
            earnedAt={earnedMap.get(badge.slug)}
            onClick={() => setSelected(badge)}
          />
        ))}
      </div>

      {!showAll && hiddenCount > 0 && (
        <button
          onClick={() => setShowAll(true)}
          className="mt-3 w-full rounded-xl border border-[hsl(var(--border))] py-2 text-xs font-medium text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
        >
          Show {hiddenCount} more locked badge{hiddenCount !== 1 ? 's' : ''} →
        </button>
      )}

      {selected && (
        <BadgeModal
          badge={selected}
          earned={isEarned}
          earnedAt={selectedEarnedAt}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  )
}
