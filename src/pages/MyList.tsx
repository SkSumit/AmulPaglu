import { useEffect, useMemo, useState } from 'react'
import { Search, CheckCircle2, ChevronDown, X, LayoutGrid, List, Trash2, Calendar, Award } from 'lucide-react'
import confetti from 'canvas-confetti'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useToast, ToastContainer } from '@/components/ui/Toast'
import { ProductCard } from '@/components/products/ProductCard'
import type { UserProductStatus, ProductWithSubmitter } from '@/types'
import { cn, getDisplayProductName } from '@/lib/utils'
import { checkAndAwardBadges, revokeBadgesIfNeeded } from '@/lib/badges'
import { BadgeUnlockPopup, type UnlockedBadge } from '@/components/badges/BadgeUnlockPopup'

// ── Local types ────────────────────────────────────────────
interface ListEntry {
  userProductId: string
  status: UserProductStatus
  tried_at: string | null
  notes: string | null
  product: ProductWithSubmitter
}
type SortBy = 'newest' | 'points_desc' | 'name_asc' | 'tried_asc'
type Tab    = 'want_to_try' | 'tried'

const RARITIES      = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary']

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
  const [catalogCount,  setCatalogCount]  = useState(0)
  const [viewMode,      setViewMode]      = useState<'grid' | 'list'>('grid')

  // Filters
  const [search,             setSearch]             = useState('')
  const [filterCategory,     setFilterCategory]     = useState('')
  const [filterRarity,       setFilterRarity]       = useState('')
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

  // Re-fetch data on visibility change (wake-up fallback)
  useEffect(() => {
    if (authLoading || !user) return
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.warn('MyList visible, re-fetching list...')
        void loadData()
      }
    }
    window.addEventListener('visibilitychange', handleVisibilityChange)
    return () => window.removeEventListener('visibilitychange', handleVisibilityChange)
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
            status, submitted_by, created_at, updated_at, tried_count,
            profiles:submitted_by(username)
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
          product:       row.products as unknown as ProductWithSubmitter,
        }))

      setEntries(list)

      // Fetch total approved products in catalog for progress calculations
      const { count } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'approved')
      if (count) setCatalogCount(count)
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

    if (sortBy === 'points_desc') list = [...list].sort((a, b) => (b.product.points ?? 0) - (a.product.points ?? 0))
    else if (sortBy === 'name_asc') list = [...list].sort((a, b) => getDisplayProductName(a.product.name).localeCompare(getDisplayProductName(b.product.name)))
    else if (sortBy === 'tried_asc' && tab === 'tried') {
      list = [...list].sort((a, b) =>
        new Date(a.tried_at ?? 0).getTime() - new Date(b.tried_at ?? 0).getTime()
      )
    }
    return list
  }, [entries, tab, search, filterCategory, filterRarity, sortBy, triedEntries, wantEntries])

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
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-[hsl(var(--foreground))]">
          Tasting Diary
        </h1>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
          Track your personal Amul dairy adventures, wishlist products, and log tasting stats.
        </p>
      </div>

      {/* Premium Dashboard Header */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3 animate-fade-in">
        {/* Card 1: Conquests */}
        <div className="relative overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-gradient-to-br from-green-50/20 to-white/10 p-5 shadow-card dark:from-green-950/10 dark:to-transparent backdrop-blur-sm">
          <div className="absolute right-4 top-4 text-3xl opacity-30 select-none">🏆</div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Dairy Conquests</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-[hsl(var(--foreground))]">{triedEntries.length}</span>
            <span className="text-xs text-[hsl(var(--muted-foreground))]">tried</span>
          </div>
          {/* Progress bar */}
          <div className="mt-4">
            <div className="flex justify-between text-[10px] font-medium text-[hsl(var(--muted-foreground))] mb-1">
              <span>Catalog Completion</span>
              <span>{catalogCount > 0 ? Math.round((triedEntries.length / catalogCount) * 100) : 0}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[hsl(var(--muted))]">
              <div 
                className="h-full bg-green-500 rounded-full transition-all duration-500" 
                style={{ width: `${catalogCount > 0 ? Math.min(100, (triedEntries.length / catalogCount) * 100) : 0}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card 2: Wishlist */}
        <div className="relative overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-gradient-to-br from-blue-50/20 to-white/10 p-5 shadow-card dark:from-blue-950/10 dark:to-transparent backdrop-blur-sm">
          <div className="absolute right-4 top-4 text-3xl opacity-30 select-none">📚</div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Wishlist</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-[hsl(var(--foreground))]">{wantEntries.length}</span>
            <span className="text-xs text-[hsl(var(--muted-foreground))]">bookmarked</span>
          </div>
          <p className="mt-4 text-[10px] text-[hsl(var(--muted-foreground))] leading-relaxed">
            Items you want to try. Click "Tried it!" to move them to your conquests list.
          </p>
        </div>

        {/* Card 3: Score */}
        <div className="relative overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-gradient-to-br from-amber-50/20 to-white/10 p-5 shadow-card dark:from-amber-950/10 dark:to-transparent backdrop-blur-sm">
          <div className="absolute right-4 top-4 text-3xl opacity-35 select-none animate-pulse">⭐</div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Amul Score</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-amul-gold dark:amul-gold-glow">{totalPtsEarned}</span>
            <span className="text-xs text-[hsl(var(--muted-foreground))]">points earned</span>
          </div>
          <p className="mt-4 text-[10px] font-bold text-amul-red uppercase tracking-wider">
            {totalPtsEarned >= 150 ? '👑 Amul Emperor' : totalPtsEarned >= 101 ? '🏆 Dairy Master' : totalPtsEarned >= 50 ? '🎩 Connoisseur' : '🌱 Growing Calf'}
          </p>
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

          {/* Grid/List toggle buttons */}
          <div className="flex rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-0.5 shrink-0">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'rounded-lg p-1.5 transition-colors',
                viewMode === 'grid'
                  ? 'bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]'
                  : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
              )}
              title="Grid view"
            >
              <LayoutGrid size={15} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'rounded-lg p-1.5 transition-colors',
                viewMode === 'list'
                  ? 'bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]'
                  : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
              )}
              title="List view"
            >
              <List size={15} />
            </button>
          </div>
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
        <EmptyState tab={tab} hasFilters={!!(search || filterCategory || filterRarity)} />
      ) : viewMode === 'grid' ? (
        <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 animate-fade-in">
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
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] animate-fade-in">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))/30] text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                  <th className="px-5 py-3.5">Product</th>
                  <th className="px-5 py-3.5">Category</th>
                  <th className="px-5 py-3.5">Score</th>
                  {tab === 'tried' && <th className="px-5 py-3.5">Tried Date</th>}
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(var(--border))]">
                {filtered.map((entry) => {
                  const pts = entry.product.points ?? 0
                  const rarity = entry.product.rarity_label
                  return (
                    <tr key={entry.userProductId} className="hover:bg-[hsl(var(--muted))/10] transition-colors">
                      <td className="whitespace-nowrap px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-[hsl(var(--border))] bg-white flex items-center justify-center p-1">
                            <img 
                              src={entry.product.image_url ?? undefined} 
                              alt={entry.product.name} 
                              className="h-full w-full object-contain"
                              onError={(e) => { e.currentTarget.src = '/logo.png' }}
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-[hsl(var(--foreground))] truncate max-w-[240px]">
                              {getDisplayProductName(entry.product.name)}
                            </p>
                            {rarity && (
                              <span className="mt-0.5 inline-block text-[9px] font-bold uppercase tracking-wider text-amul-gold">
                                {rarity}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-[hsl(var(--muted-foreground))] font-medium">
                        {entry.product.category || 'Uncategorized'}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4">
                        <div className="flex items-center gap-1 text-amul-gold">
                          <Award size={14} />
                          <span className="font-bold text-xs">{pts} pt{pts !== 1 ? 's' : ''}</span>
                        </div>
                      </td>
                      {tab === 'tried' && (
                        <td className="whitespace-nowrap px-5 py-4 text-[hsl(var(--muted-foreground))] text-xs font-medium">
                          <div className="flex items-center gap-1.5">
                            <Calendar size={13} />
                            <span>
                              {entry.tried_at
                                ? new Date(entry.tried_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                                : 'Tried'}
                            </span>
                          </div>
                        </td>
                      )}
                      <td className="whitespace-nowrap px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {tab === 'want_to_try' && (
                            <button
                              onClick={() => handleMarkAsTried(entry)}
                              disabled={actionLoading[entry.userProductId]}
                              className="inline-flex items-center gap-1 rounded-xl bg-amul-red px-3 py-1.5 text-xs font-semibold text-white hover:bg-amul-red-dark disabled:opacity-50"
                            >
                              {actionLoading[entry.userProductId] ? (
                                <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                              ) : (
                                <CheckCircle2 size={12} />
                              )}
                              Tried it!
                            </button>
                          )}
                          <button
                            onClick={() => handleRemoveFromList(entry)}
                            disabled={actionLoading[entry.userProductId]}
                            className="rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30 transition-colors disabled:opacity-50"
                            aria-label="Remove from list"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
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
      <div className="flex flex-col items-center justify-center py-24 text-center rounded-2xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--card))]/30 p-8 animate-fade-in">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[hsl(var(--muted))] text-2xl">
          🔍
        </div>
        <p className="mt-4 text-base font-semibold text-[hsl(var(--foreground))]">No matching products</p>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))] max-w-xs mx-auto">
          We couldn't find anything matching your filters. Try clearing search or resetting tags!
        </p>
      </div>
    )
  }
  if (tab === 'want_to_try') {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center rounded-2xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--card))]/30 p-8 animate-fade-in">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950/20 text-3xl">
          📚
        </div>
        <p className="mt-4 text-base font-bold text-[hsl(var(--foreground))]">Your wishlist is empty</p>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))] max-w-sm mx-auto">
          Browse the catalog, pick delicious dairy items, and save them here so you never forget to try them!
        </p>
        <a
          href="/explore"
          className="mt-6 rounded-xl bg-amul-red px-6 py-2.5 text-xs font-semibold text-white shadow hover:bg-amul-red-dark transition-colors"
        >
          Browse Amul Catalog
        </a>
      </div>
    )
  }
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center rounded-2xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--card))]/30 p-8 animate-fade-in">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-50 dark:bg-green-950/20 text-3xl">
        🥛
      </div>
      <p className="mt-4 text-base font-bold text-[hsl(var(--foreground))]">Start your tasting journey!</p>
      <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))] max-w-sm mx-auto">
        You haven't logged any tried products yet. Go to Explore and mark products as tried to log points and unlock achievements!
      </p>
      <a
        href="/explore"
        className="mt-6 rounded-xl bg-amul-red px-6 py-2.5 text-xs font-semibold text-white shadow hover:bg-amul-red-dark transition-colors"
      >
        Explore Products
      </a>
    </div>
  )
}

