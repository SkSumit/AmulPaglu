import { useEffect, useMemo, useState } from 'react'
import { Search, SlidersHorizontal, X, ChevronDown } from 'lucide-react'
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
type UPEntry = { id: string; status: UserProductStatus; tried_at: string | null }
type UPMap   = Record<string, UPEntry>
type SortBy  = 'newest' | 'points_desc' | 'name_asc'
type StatusFilter = 'all' | 'not_added' | 'want_to_try' | 'tried'

const RARITIES     = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary']
const PAGE_SIZE = 24

// ── Component ──────────────────────────────────────────────
export default function Explore() {
  const { user, isLoading: authLoading, refreshProfile, ensureSession } = useAuth()
  const { toasts, addToast, dismiss } = useToast()

  // Data
  const [products,       setProducts]       = useState<Product[]>([])
  const [userProductMap, setUserProductMap] = useState<UPMap>({})
  const [loading,        setLoading]        = useState(true)
  const [loadError,      setLoadError]      = useState<string | null>(null)
  const [actionLoading,  setActionLoading]  = useState<Record<string, 'add' | 'tried' | 'remove'>>({})
  const [displayCount,   setDisplayCount]   = useState(PAGE_SIZE)
  const [unlockedBadges, setUnlockedBadges] = useState<UnlockedBadge[]>([])

  // Filters
  const [search,              setSearch]              = useState('')
  const [filterCategory,      setFilterCategory]      = useState('')
  const [filterRarity,        setFilterRarity]        = useState('')
  const [filterStatus,        setFilterStatus]        = useState<StatusFilter>('all')
  const [sortBy,              setSortBy]              = useState<SortBy>('newest')
  const [filtersOpen,         setFiltersOpen]         = useState(false)

  // ── Load data ──────────────────────────────────────────
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
        console.warn('Explore visible, re-fetching products...')
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

      const [
        { data: prods, error: prodErr },
        { data: ups,   error: upErr   },
      ] = await Promise.all([
        supabase
          .from('products')
          .select('*')
          .eq('status', 'approved')
          .order('created_at', { ascending: false }),
        supabase
          .from('user_products')
          .select('id, product_id, status, tried_at')
          .eq('user_id', user.id),
      ])

      if (prodErr) throw new Error(prodErr.message)
      if (upErr)   throw new Error(upErr.message)

      setProducts(prods ?? [])
      const map: UPMap = {}
      for (const up of ups ?? []) {
        map[up.product_id] = {
          id:       up.id,
          status:   up.status as UserProductStatus,
          tried_at: up.tried_at,
        }
      }
      setUserProductMap(map)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load products'
      setLoadError(msg)
      addToast(msg, 'error')
    } finally {
      setLoading(false)
    }
  }

  // ── Derived categories from data ──────────────────────
  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category).filter(Boolean))] as string[],
    [products]
  )

  // ── Filtered + sorted list ────────────────────────────
  const filtered = useMemo(() => {
    let list = [...products]

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((p) => getDisplayProductName(p.name).toLowerCase().includes(q))
    }
    if (filterCategory)     list = list.filter((p) => p.category     === filterCategory)
    if (filterRarity)       list = list.filter((p) => p.rarity_label === filterRarity)
    if (filterStatus !== 'all') {
      list = list.filter((p) => {
        const up = userProductMap[p.id]
        if (filterStatus === 'not_added')    return !up
        if (filterStatus === 'want_to_try')  return up?.status === 'want_to_try'
        if (filterStatus === 'tried')        return up?.status === 'tried'
        return true
      })
    }
    if (sortBy === 'points_desc') list.sort((a, b) => (b.points ?? 0) - (a.points ?? 0))
    else if (sortBy === 'name_asc') list.sort((a, b) => getDisplayProductName(a.name).localeCompare(getDisplayProductName(b.name)))

    return list
  }, [products, userProductMap, search, filterCategory, filterRarity, filterStatus, sortBy])

  const displayed = filtered.slice(0, displayCount)
  const activeFilterCount = [filterCategory, filterRarity]
    .filter(Boolean).length + (filterStatus !== 'all' ? 1 : 0)

  function clearFilters() {
    setSearch('')
    setFilterCategory('')
    setFilterRarity('')
    setFilterStatus('all')
    setSortBy('newest')
  }

  // ── Action: add to list ───────────────────────────────
  async function handleAddToList(product: Product) {
    if (!user) return
    const prev = userProductMap[product.id]
    // Optimistic
    setUserProductMap((m) => ({ ...m, [product.id]: { id: 'temp', status: 'want_to_try', tried_at: null } }))
    setActionLoading((m) => ({ ...m, [product.id]: 'add' as const }))

    try {
      // Ensure session is fresh before operation
      await ensureSession()

      const { data, error } = await supabase
        .from('user_products')
        .upsert({ user_id: user.id, product_id: product.id, status: 'want_to_try' }, { onConflict: 'user_id,product_id' })
        .select('id')
        .single()

      setActionLoading((m) => { const { [product.id]: _, ...rest } = m; return rest })
      if (error) {
        // Revert
        setUserProductMap((m) => {
          const n = { ...m }
          if (prev) n[product.id] = prev; else delete n[product.id]
          return n
        })
        addToast(error.message, 'error')
      } else {
        setUserProductMap((m) => ({ ...m, [product.id]: { id: data.id, status: 'want_to_try', tried_at: null } }))
        addToast('Added to your list! 📚', 'success')
        if (prev?.status === 'tried') void revokeBadgesIfNeeded(user.id)
      }
    } catch (err) {
      // Revert
      setUserProductMap((m) => {
        const n = { ...m }
        if (prev) n[product.id] = prev; else delete n[product.id]
        return n
      })
      setActionLoading((m) => { const { [product.id]: _, ...rest } = m; return rest })
      const msg = err instanceof Error ? err.message : 'Failed to add to list'
      addToast(msg, 'error')
    }
  }

  // ── Action: mark as tried ─────────────────────────────
  async function handleMarkAsTried(product: Product) {
    if (!user) return
    const prev = userProductMap[product.id]
    const now  = new Date().toISOString()
    // Optimistic
    setUserProductMap((m) => ({
      ...m,
      [product.id]: { id: prev?.id ?? 'temp', status: 'tried', tried_at: now },
    }))
    setActionLoading((m) => ({ ...m, [product.id]: 'tried' as const }))
    // Confetti burst (optimistic — feels instant)
    void confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#C8102E', '#FFD700', '#ffffff', '#22c55e'],
    })

    try {
      // Ensure session is fresh before operation
      await ensureSession()

      const { data, error } = await supabase
        .from('user_products')
        .upsert(
          { user_id: user.id, product_id: product.id, status: 'tried', tried_at: now },
          { onConflict: 'user_id,product_id' }
        )
        .select('id')
        .single()

      setActionLoading((m) => { const { [product.id]: _, ...rest } = m; return rest })
      if (error) {
        setUserProductMap((m) => {
          const n = { ...m }
          if (prev) n[product.id] = prev; else delete n[product.id]
          return n
        })
        addToast(error.message, 'error')
      } else {
        setUserProductMap((m) => ({
          ...m,
          [product.id]: { id: data.id, status: 'tried', tried_at: now },
        }))
        addToast(`🎉 Nice! +${product.points ?? 0} pts earned!`, 'success')
        await refreshProfile()
        // Check for newly unlocked badges and show popup
        const unlocked = await checkAndAwardBadges(user.id)
        if (unlocked.length > 0) setUnlockedBadges(unlocked)
      }
    } catch (err) {
      // Revert
      setUserProductMap((m) => {
        const n = { ...m }
        if (prev) n[product.id] = prev; else delete n[product.id]
        return n
      })
      setActionLoading((m) => { const { [product.id]: _, ...rest } = m; return rest })
      const msg = err instanceof Error ? err.message : 'Failed to mark as tried'
      addToast(msg, 'error')
    }
  }

  // ── Action: remove from list ──────────────────────────
  async function handleRemoveFromList(product: Product) {
    if (!user) return
    const prev = userProductMap[product.id]
    if (!prev) return
    // Optimistic
    setUserProductMap((m) => { const n = { ...m }; delete n[product.id]; return n })
    setActionLoading((m) => ({ ...m, [product.id]: 'remove' as const }))

    try {
      // Ensure session is fresh before operation
      await ensureSession()

      const { error } = await supabase
        .from('user_products')
        .delete()
        .eq('user_id', user.id)
        .eq('product_id', product.id)

      setActionLoading((m) => { const { [product.id]: _, ...rest } = m; return rest })
      if (error) {
        setUserProductMap((m) => ({ ...m, [product.id]: prev }))
        addToast(error.message, 'error')
      } else {
        addToast('Removed from your list', 'success')
        await refreshProfile()
        // Revoke badges that no longer apply (e.g. tried count dropped)
        if (prev.status === 'tried') void revokeBadgesIfNeeded(user.id)
      }
    } catch (err) {
      // Revert
      setUserProductMap((m) => ({ ...m, [product.id]: prev }))
      setActionLoading((m) => { const { [product.id]: _, ...rest } = m; return rest })
      const msg = err instanceof Error ? err.message : 'Failed to remove from list'
      addToast(msg, 'error')
    }
  }

  // ── Render ────────────────────────────────────────────
  return (    <>
    {unlockedBadges.length > 0 && (
      <BadgeUnlockPopup badges={unlockedBadges} onClose={() => setUnlockedBadges([])} />
    )}    <div className="mx-auto max-w-7xl overflow-x-hidden px-4 py-8 page-transition">

      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[hsl(var(--foreground))]">
            Browse Products
          </h1>
          {!loading && (
            <p className="mt-0.5 text-sm text-[hsl(var(--muted-foreground))]">
              Showing {displayed.length} of {filtered.length}
              {filtered.length !== products.length && ` (${products.length} total)`}
            </p>
          )}
        </div>
        <button
          onClick={() => setFiltersOpen((v) => !v)}
          className={cn(
            'flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors',
            filtersOpen || activeFilterCount > 0
              ? 'border-amul-red bg-amul-red/5 text-amul-red'
              : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]'
          )}
        >
          <SlidersHorizontal size={15} />
          Filters
          {activeFilterCount > 0 && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amul-red text-[10px] font-bold text-white">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
        <input
          type="search"
          placeholder="Search products…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setDisplayCount(PAGE_SIZE) }}
          className="w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] py-2.5 pl-10 pr-4 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] outline-none transition-colors focus:border-[hsl(var(--border))] focus:ring-2 focus:ring-[hsl(var(--border))]/40"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Filter panel */}
      {filtersOpen && (
        <div className="mb-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 shadow-card animate-slide-up">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SelectFilter
              label="Category"
              value={filterCategory}
              onChange={(v) => { setFilterCategory(v); setDisplayCount(PAGE_SIZE) }}
              options={categories}
            />
            <SelectFilter
              label="Rarity"
              value={filterRarity}
              onChange={(v) => { setFilterRarity(v); setDisplayCount(PAGE_SIZE) }}
              options={RARITIES}
            />
            <SelectFilter
              label="Sort by"
              value={sortBy}
              onChange={(v) => setSortBy(v as SortBy)}
              options={[
                { value: 'newest',      label: 'Newest first'    },
                { value: 'points_desc', label: 'Points: high → low' },
                { value: 'name_asc',    label: 'Name: A → Z'    },
              ]}
            />
          </div>

          {/* Status tabs */}
          <div className="mt-4 flex flex-wrap gap-2">
            {(
              [
                { value: 'all',         label: 'All'          },
                { value: 'not_added',   label: 'Not added'    },
                { value: 'want_to_try', label: 'Want to try'  },
                { value: 'tried',       label: 'Already tried' },
              ] as { value: StatusFilter; label: string }[]
            ).map(({ value, label }) => (
              <button
                key={value}
                onClick={() => { setFilterStatus(value); setDisplayCount(PAGE_SIZE) }}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                  filterStatus === value
                    ? 'bg-amul-red text-white'
                    : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Clear */}
          {activeFilterCount > 0 && (
            <button
              onClick={clearFilters}
              className="mt-3 text-xs text-amul-red hover:underline"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden">
              <div className="h-36 animate-pulse bg-[hsl(var(--muted))]" />
              <div className="p-4 space-y-2">
                <div className="h-3 w-3/4 animate-pulse rounded bg-[hsl(var(--muted))]" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-[hsl(var(--muted))]" />
                <div className="h-8 animate-pulse rounded-xl bg-[hsl(var(--muted))]" />
              </div>
            </div>
          ))}
        </div>
      ) : loadError ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <span className="text-5xl">⚠️</span>
          <p className="mt-4 text-base font-semibold text-[hsl(var(--foreground))]">
            Couldn't load products
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
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="relative mb-2">
            <div className="flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-amul-red/10 to-amber-100/50 dark:to-amber-900/20">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-amul-red/15 to-amber-200/50 dark:to-amber-900/30">
                <Search size={32} className="text-amul-red/50" />
              </div>
            </div>
            <div className="absolute -right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-[hsl(var(--muted))] text-xs font-bold text-[hsl(var(--muted-foreground))]">
              ?
            </div>
          </div>
          <p className="mt-4 text-base font-semibold text-[hsl(var(--foreground))]">
            No products found
          </p>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            Try adjusting your search or filters.
          </p>
          {activeFilterCount > 0 && (
            <button
              onClick={clearFilters}
              className="mt-4 rounded-lg bg-amul-red px-4 py-1.5 text-xs font-semibold text-white hover:bg-amul-red-dark"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {displayed.map((product) => {
              const up = userProductMap[product.id]
              return (
                <ProductCard
                  key={product.id}
                  product={product}
                  userStatus={up?.status ?? null}
                  triedAt={up?.tried_at}
                  isLoading={!!actionLoading[product.id]}
                  loadingAction={actionLoading[product.id]}
                  onAddToList={() => handleAddToList(product)}
                  onMarkAsTried={() => handleMarkAsTried(product)}
                  onRemoveFromList={up ? () => handleRemoveFromList(product) : undefined}
                />
              )
            })}
          </div>

          {/* Load more */}
          {displayCount < filtered.length && (
            <div className="mt-10 flex justify-center">
              <button
                onClick={() => setDisplayCount((n) => n + PAGE_SIZE)}
                className="flex items-center gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-6 py-2.5 text-sm font-medium text-[hsl(var(--foreground))] shadow-card transition-all hover:shadow-card-lg hover:bg-[hsl(var(--muted))]"
              >
                Show more
                <span className="rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 text-xs text-[hsl(var(--muted-foreground))]">
                  {Math.min(PAGE_SIZE, filtered.length - displayCount)} more
                </span>
              </button>
            </div>
          )}
        </>
      )}

      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </div>
    </>
  )
}

// ── Small helpers ──────────────────────────────────────────
function SelectFilter({
  label,
  value,
  onChange,
  options,
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
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3.5 py-2 pr-8 text-sm text-[hsl(var(--foreground))] outline-none transition-colors focus:border-[hsl(var(--border))] focus:ring-2 focus:ring-[hsl(var(--border))]/40"
      >
        <option value="">{label}: All</option>
        {normalised.map(({ value: v, label: l }) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
    </div>
  )
}

