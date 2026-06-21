import { useEffect, useMemo, useState } from 'react'
import { Search, Star, CheckCircle2, ChevronDown, X } from 'lucide-react'
import confetti from 'canvas-confetti'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useToast, ToastContainer } from '@/components/ui/Toast'
import { ProductCard } from '@/components/products/ProductCard'
import type { Product, UserProductStatus } from '@/types'
import { cn, getDisplayProductName } from '@/lib/utils'
import { checkAndAwardBadges, revokeBadgesIfNeeded } from '@/lib/badges'
import { BadgeUnlockPopup, type UnlockedBadge } from '@/components/badges/BadgeUnlockPopup'

// ── Local types ────────────────────────────────────────────
interface ListEntry {
  userProductId: string
  status: UserProductStatus
  tried_at: string | null
  notes: string | null
  product: Product
}
type SortBy = 'newest' | 'points_desc' | 'name_asc' | 'tried_asc'
type Tab    = 'want_to_try' | 'tried'

const RARITIES      = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary']
const AVAILABILITIES = ['Pan India', 'Regional', 'Seasonal', 'Discontinued']

// ── Component ──────────────────────────────────────────────
export default function MyList() {
  const { user, isLoading: authLoading, refreshProfile, ensureSession } = useAuth()
  const { toasts, addToast, dismiss } = useToast()

  const [entries,       setEntries]       = useState<ListEntry[]>([])
  const [loading,       setLoading]       = useState(true)
  const [loadError,     setLoadError]     = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})
  const [tab,           setTab]           = useState<Tab>('want_to_try')
  const [unlockedBadges, setUnlockedBadges] = useState<UnlockedBadge[]>([])

  // Filters
  const [search,             setSearch]             = useState('')
  const [filterCategory,     setFilterCategory]     = useState('')
  const [filterRarity,       setFilterRarity]       = useState('')
  const [filterAvailability, setFilterAvailability] = useState('')
  const [sortBy,             setSortBy]             = useState<SortBy>('newest')

  // ── Load ──────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return          // wait for auth to fully resolve
    if (user) {
      void loadData()
    } else {
      setLoading(false)
    }
  }, [authLoading, user?.id])

  async function loadData() {
    if (!user) return
    setLoading(true)
    setLoadError(null)
    try {
      // Ensure session is fresh before fetching
      await ensureSession()

      const { data, error } = await supabase
        .from('user_products')
        .select(`
          id, status, tried_at, notes, created_at,
          products (
            id, name, category, description, image_url, points,
            rarity_label, availability, is_discontinued, source_url,
            status, submitted_by, created_at, updated_at
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw new Error(error.message)

      const list: ListEntry[] = (data ?? [])
        .filter((row) => row.products)
        .map((row) => ({
          userProductId: row.id,
          status:        row.status as UserProductStatus,
          tried_at:      row.tried_at,
          notes:         row.notes,
          product:       row.products as unknown as Product,
        }))

      setEntries(list)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load your list'
      setLoadError(msg)
      addToast(msg, 'error')
    } finally {
      setLoading(false)
    }
  }

  // ── Derived stats ─────────────────────────────────────
  const triedEntries    = useMemo(() => entries.filter((e) => e.status === 'tried'), [entries])
  const wantEntries     = useMemo(() => entries.filter((e) => e.status === 'want_to_try'), [entries])
  const totalPtsEarned  = useMemo(
    () => triedEntries.reduce((sum, e) => sum + (e.product.points ?? 0), 0),
    [triedEntries]
  )
  const categories = useMemo(
    () => [...new Set(entries.map((e) => e.product.category).filter(Boolean))] as string[],
    [entries]
  )

  // ── Filtered list for current tab ─────────────────────
  const filtered = useMemo(() => {
    let list = tab === 'tried' ? triedEntries : wantEntries

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((e) => getDisplayProductName(e.product.name).toLowerCase().includes(q))
    }
    if (filterCategory)     list = list.filter((e) => e.product.category     === filterCategory)
    if (filterRarity)       list = list.filter((e) => e.product.rarity_label === filterRarity)
    if (filterAvailability) list = list.filter((e) => e.product.availability === filterAvailability)

    if (sortBy === 'points_desc') list = [...list].sort((a, b) => (b.product.points ?? 0) - (a.product.points ?? 0))
    else if (sortBy === 'name_asc') list = [...list].sort((a, b) => getDisplayProductName(a.product.name).localeCompare(getDisplayProductName(b.product.name)))
    else if (sortBy === 'tried_asc' && tab === 'tried') {
      list = [...list].sort((a, b) =>
        new Date(a.tried_at ?? 0).getTime() - new Date(b.tried_at ?? 0).getTime()
      )
    }
    return list
  }, [entries, tab, search, filterCategory, filterRarity, filterAvailability, sortBy, triedEntries, wantEntries])

  // ── Action: mark as tried ─────────────────────────────
  async function handleMarkAsTried(entry: ListEntry) {
    if (!user) return
    const now = new Date().toISOString()
    // Optimistic
    setEntries((prev) =>
      prev.map((e) =>
        e.userProductId === entry.userProductId
          ? { ...e, status: 'tried', tried_at: now }
          : e
      )
    )
    setActionLoading((m) => ({ ...m, [entry.userProductId]: true }))
    void confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#C8102E', '#FFD700', '#ffffff', '#22c55e'],
    })

    try {
      // Ensure session is fresh before operation
      await ensureSession()

      const { error } = await supabase
        .from('user_products')
        .update({ status: 'tried', tried_at: now })
        .eq('id', entry.userProductId)

      setActionLoading((m) => ({ ...m, [entry.userProductId]: false }))
      if (error) {
        // Revert
        setEntries((prev) =>
          prev.map((e) =>
            e.userProductId === entry.userProductId
              ? { ...e, status: 'want_to_try', tried_at: null }
              : e
          )
        )
        addToast(error.message, 'error')
      } else {
        addToast(`🎉 Tried! +${entry.product.points ?? 0} pts`, 'success')
        await refreshProfile()
        // Check for newly unlocked badges and show popup
        const unlocked = await checkAndAwardBadges(user.id)
        if (unlocked.length > 0) setUnlockedBadges(unlocked)
      }
    } catch (err) {
      // Revert
      setEntries((prev) =>
        prev.map((e) =>
          e.userProductId === entry.userProductId
            ? { ...e, status: 'want_to_try', tried_at: null }
            : e
        )
      )
      setActionLoading((m) => ({ ...m, [entry.userProductId]: false }))
      const msg = err instanceof Error ? err.message : 'Failed to mark as tried'
      addToast(msg, 'error')
    }
  }

  // ── Action: remove from list ──────────────────────────
  async function handleRemoveFromList(entry: ListEntry) {
    if (!user) return
    // Optimistic
    const prev = entries
    setEntries((prev) => prev.filter((e) => e.userProductId !== entry.userProductId))
    setActionLoading((m) => ({ ...m, [entry.userProductId]: true }))

    try {
      // Ensure session is fresh before operation
      await ensureSession()

      const { error } = await supabase
        .from('user_products')
        .delete()
        .eq('id', entry.userProductId)

      setActionLoading((m) => ({ ...m, [entry.userProductId]: false }))
      if (error) {
        // Revert
        setEntries(prev)
        addToast(error.message, 'error')
      } else {
        addToast('Removed from your list', 'success')
        await refreshProfile()
        // Revoke badges that relied on this product (if it was tried)
        if (entry.status === 'tried') void revokeBadgesIfNeeded(user.id)
      }
    } catch (err) {
      // Revert
      setEntries(prev)
      setActionLoading((m) => ({ ...m, [entry.userProductId]: false }))
      const msg = err instanceof Error ? err.message : 'Failed to remove'
      addToast(msg, 'error')
    }
  }

  // ── Render ────────────────────────────────────────────
  return (
    <>
    {unlockedBadges.length > 0 && (
      <BadgeUnlockPopup badges={unlockedBadges} onClose={() => setUnlockedBadges([])} />
    )}
    <div className="mx-auto max-w-7xl overflow-x-hidden px-4 py-8 page-transition">

      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-[hsl(var(--foreground))]">
          My List
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-[hsl(var(--muted-foreground))]">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-green-500" />
            <strong className="text-[hsl(var(--foreground))]">{triedEntries.length}</strong> tried
          </span>
          <span className="flex items-center gap-1.5">
            📚
            <strong className="text-[hsl(var(--foreground))]">{wantEntries.length}</strong> want to try
          </span>
          <span className="flex items-center gap-1.5">
            <Star size={14} className="text-amul-gold" />
            <strong className="text-amul-red">{totalPtsEarned}</strong> pts earned
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-5 flex overflow-hidden rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-1 w-fit">
        {(
          [
            { value: 'want_to_try', label: `Want to Try`, count: wantEntries.length },
            { value: 'tried',       label: `Already Tried`, count: triedEntries.length },
          ] as { value: Tab; label: string; count: number }[]
        ).map(({ value, label, count }) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={cn(
              'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
              tab === value
                ? 'bg-amul-red text-white shadow-sm'
                : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
            )}
          >
            {label}
            <span className={cn(
              'rounded-full px-1.5 py-0.5 text-[10px] font-bold',
              tab === value ? 'bg-white/20 text-white' : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]'
            )}>
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* Search + filters */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
          <input
            type="search"
            placeholder="Search your list…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] py-2.5 pl-10 pr-4 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] outline-none transition-colors focus:border-amul-red focus:ring-2 focus:ring-amul-red/20"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
              <X size={14} />
            </button>
          )}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-0.5 sm:pb-0">
          <MiniSelect value={filterCategory}     onChange={setFilterCategory}     label="Category"     options={categories}  />
          <MiniSelect value={filterRarity}       onChange={setFilterRarity}       label="Rarity"       options={RARITIES}    />
          <MiniSelect value={filterAvailability} onChange={setFilterAvailability} label="Availability" options={AVAILABILITIES} />
          <MiniSelect
            value={sortBy}
            onChange={(v) => setSortBy(v as SortBy)}
            label="Sort"
            options={[
              { value: 'newest',      label: 'Newest'      },
              { value: 'points_desc', label: 'Points ↓'    },
              { value: 'name_asc',    label: 'Name A→Z'    },
              ...(tab === 'tried' ? [{ value: 'tried_asc', label: 'Tried date ↑' }] : []),
            ]}
          />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden">
              <div className="h-36 animate-pulse bg-[hsl(var(--muted))]" />
              <div className="p-4 space-y-2">
                <div className="h-3 w-3/4 animate-pulse rounded bg-[hsl(var(--muted))]" />
                <div className="h-8 mt-4 animate-pulse rounded-xl bg-[hsl(var(--muted))]" />
              </div>
            </div>
          ))}
        </div>
      ) : loadError ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <span className="text-5xl">⚠️</span>
          <p className="mt-4 text-base font-semibold text-[hsl(var(--foreground))]">
            Couldn't load your list
          </p>
          <p className="mt-1 max-w-sm text-sm text-[hsl(var(--muted-foreground))]">{loadError}</p>
          <button
            onClick={() => void loadData()}
            className="mt-5 rounded-xl bg-amul-red px-5 py-2 text-sm font-semibold text-white hover:bg-amul-red-dark"
          >
            Try again
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState tab={tab} hasFilters={!!(search || filterCategory || filterRarity || filterAvailability)} />
      ) : (
        <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((entry) => (
            <ProductCard
              key={entry.userProductId}
              product={entry.product}
              userStatus={entry.status}
              triedAt={entry.tried_at}
              isLoading={actionLoading[entry.userProductId]}
              onAddToList={() => {/* already on list */}}
              onMarkAsTried={() => handleMarkAsTried(entry)}
              onRemoveFromList={() => handleRemoveFromList(entry)}
            />
          ))}
        </div>
      )}

      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </div>
    </>
  )
}

// ── Small helpers ──────────────────────────────────────────
function MiniSelect({
  label, value, onChange, options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: string[] | { value: string; label: string }[]
}) {
  const normalised = options.map((o) =>
    typeof o === 'string' ? { value: o, label: o } : o
  )
  return (
    <div className="relative shrink-0">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] py-2 pl-3 pr-7 text-xs font-medium text-[hsl(var(--foreground))] outline-none transition-colors focus:border-amul-red"
      >
        <option value="">{label}</option>
        {normalised.map(({ value: v, label: l }) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
      <ChevronDown size={12} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
    </div>
  )
}

function EmptyState({ tab, hasFilters }: { tab: Tab; hasFilters: boolean }) {
  if (hasFilters) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <span className="text-4xl">🔍</span>
        <p className="mt-4 font-semibold text-[hsl(var(--foreground))]">No matches</p>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">Try changing your filters.</p>
      </div>
    )
  }
  if (tab === 'want_to_try') {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <span className="text-5xl">📚</span>
        <p className="mt-4 text-base font-semibold text-[hsl(var(--foreground))]">Your bucket list is empty</p>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
          Head to Explore and add products you want to try.
        </p>
        <a
          href="/explore"
          className="mt-5 rounded-xl bg-amul-red px-5 py-2 text-sm font-semibold text-white hover:bg-amul-red-dark"
        >
          Browse products
        </a>
      </div>
    )
  }
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <span className="text-5xl">✅</span>
      <p className="mt-4 text-base font-semibold text-[hsl(var(--foreground))]">Nothing tried yet</p>
      <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
        Mark products as tried from your Want-to-Try list or Explore.
      </p>
    </div>
  )
}

