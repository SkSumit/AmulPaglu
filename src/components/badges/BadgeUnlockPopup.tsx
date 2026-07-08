import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Share2 } from 'lucide-react'
import confetti from 'canvas-confetti'
import { useToast, ToastContainer } from '@/components/ui/Toast'
import { shareContent, getBadgeShareData } from '@/lib/share'

export interface UnlockedBadge {
  icon: string
  name: string
  description?: string
}

interface BadgeUnlockPopupProps {
  badges: UnlockedBadge[]
  onClose: () => void
}

/**
 * Full-screen animated popup shown when one or more badges are unlocked.
 * Cycles through badges one at a time; fires confetti on each badge reveal.
 */
export function BadgeUnlockPopup({ badges, onClose }: BadgeUnlockPopupProps) {
  const [currentIdx, setCurrentIdx] = useState(0)
  const [visible, setVisible] = useState(false)
  const [exiting, setExiting] = useState(false)
  const fired = useRef(false)

  const current = badges[currentIdx]
  const isLast = currentIdx === badges.length - 1

  // Animate-in + fire confetti on each badge
  useEffect(() => {
    fired.current = false
    setVisible(false)
    setExiting(false)
    const t = setTimeout(() => {
      setVisible(true)
      if (!fired.current) {
        fired.current = true
        confetti({
          particleCount: 90,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#C8102E', '#FFD700', '#FFFFFF', '#FF8C00'],
          disableForReducedMotion: true,
        })
      }
    }, 60)
    return () => clearTimeout(t)
  }, [currentIdx])

  const { toasts, addToast, dismiss } = useToast()

  function handleShareBadge() {
    const data = getBadgeShareData(current)
    void shareContent(data, addToast)
  }

  function handleNext() {
    if (exiting) return
    setExiting(true)
    setTimeout(() => {
      if (isLast) {
        onClose()
      } else {
        setCurrentIdx((i) => i + 1)
        setExiting(false)
        setVisible(false)
      }
    }, 300)
  }

  return createPortal(
    <div
      className={[
        'fixed inset-0 z-[200] flex items-center justify-center p-4',
        'bg-black/70 backdrop-blur-md transition-opacity duration-300',
        visible && !exiting ? 'opacity-100' : 'opacity-0',
      ].join(' ')}
      onClick={handleNext}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={[
          'relative w-full max-w-sm rounded-3xl border-2 border-amul-gold/40',
          'bg-[hsl(var(--card))] px-8 py-10 text-center shadow-2xl',
          'transition-all duration-300',
          visible && !exiting
            ? 'scale-100 opacity-100 translate-y-0'
            : 'scale-75 opacity-0 translate-y-10',
        ].join(' ')}
      >
        {/* Close */}
        <button
          onClick={handleNext}
          aria-label="Dismiss"
          className="absolute right-3 top-3 rounded-lg p-1 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
        >
          <X size={15} />
        </button>

        {/* Badge counter dots */}
        {badges.length > 1 && (
          <div className="mb-4 flex justify-center gap-1.5">
            {badges.map((_, i) => (
              <div
                key={i}
                className={[
                  'h-1.5 rounded-full transition-all duration-300',
                  i === currentIdx ? 'w-6 bg-amul-red' : i < currentIdx ? 'w-3 bg-amul-red/40' : 'w-3 bg-[hsl(var(--muted))]',
                ].join(' ')}
              />
            ))}
          </div>
        )}

        {/* Badge icon with glow rings */}
        <div className="relative mx-auto mb-5 flex h-28 w-28 items-center justify-center">
          <div className="absolute inset-0 animate-ping rounded-full bg-amul-gold/15" />
          <div className="absolute inset-0 animate-pulse rounded-full bg-amul-gold/10" />
          <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-amul-gold/40 bg-gradient-to-br from-amber-50 to-white text-5xl shadow-lg dark:from-amber-950/30 dark:to-[hsl(var(--card))]">
            {current.icon}
          </div>
        </div>

        {/* Labels */}
        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-amul-gold">
          Badge Unlocked!
        </p>
        <h2 className="font-display text-2xl font-bold text-[hsl(var(--foreground))]">
          {current.name}
        </h2>
        {current.description && (
          <p className="mx-auto mt-2 max-w-xs text-sm text-[hsl(var(--muted-foreground))]">
            {current.description}
          </p>
        )}

        {/* CTA Actions */}
        <div className="mt-6 flex gap-2.5">
          <button
            onClick={handleShareBadge}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-2.5 text-sm font-semibold text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
          >
            <Share2 size={14} className="text-[hsl(var(--muted-foreground))]" />
            Share
          </button>
          <button
            onClick={handleNext}
            className="flex-1 rounded-xl bg-amul-red px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amul-red-dark"
          >
            {isLast ? 'Awesome! 🎉' : `Next (${currentIdx + 1}/${badges.length})`}
          </button>
        </div>
      </div>
      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </div>,
    document.body
  )
}
