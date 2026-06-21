import { useState } from 'react'
import { CheckCircle2, Plus, BookmarkCheck, Trash2, Star } from 'lucide-react'
import { cn, getDisplayProductName } from '@/lib/utils'
import type { Product, UserProductStatus } from '@/types'
import { ProductImage } from './ProductImage'

// ── Rarity maps ──────────────────────────────────────
const RARITY_PILL: Record<string, string> = {
  Common: 'bg-gray-100   text-gray-600   dark:bg-gray-800   dark:text-gray-400',
  Uncommon: 'bg-green-100  text-green-700  dark:bg-green-900/40  dark:text-green-400',
  Rare: 'bg-blue-100   text-blue-700   dark:bg-blue-900/40   dark:text-blue-400',
  Epic: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400',
  Legendary: 'bg-amber-100  text-amber-700  dark:bg-amber-900/40  dark:text-amber-400',
}

// Left border + glow per rarity (CSS classes defined in index.css)
// const RARITY_CLASSES: Record<string, { border: string; glow: string }> = {
//   Common:    { border: 'rarity-border-common',    glow: 'rarity-glow-common'    },
//   Uncommon:  { border: 'rarity-border-uncommon',  glow: 'rarity-glow-uncommon'  },
//   Rare:      { border: 'rarity-border-rare',      glow: 'rarity-glow-rare'      },
//   Epic:      { border: 'rarity-border-epic',      glow: 'rarity-glow-epic'      },
//   Legendary: { border: 'rarity-border-legendary', glow: 'rarity-glow-legendary' },
// }

// ── Props ──────────────────────────────────────────
export interface ProductCardProps {
  product: Product
  userStatus: UserProductStatus | null
  triedAt?: string | null
  isLoading?: boolean
  loadingAction?: 'add' | 'tried' | 'remove'
  onAddToList: () => void
  onMarkAsTried: () => void
  onRemoveFromList?: () => void
}

// â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function ProductCard({
  product,
  userStatus,
  triedAt,
  isLoading,
  loadingAction,
  onAddToList,
  onMarkAsTried,
  onRemoveFromList,
}: ProductCardProps) {
  const pts = product.points ?? 0
  const rarity = product.rarity_label
  const productName = getDisplayProductName(product.name)
  // const rarityClass  = rarity ? (RARITY_CLASSES[rarity] ?? RARITY_CLASSES.Common) : null
  const isTried = userStatus === 'tried'

  // Scale-pop state for "Add to List" click
  const [justAdded, setJustAdded] = useState(false)

  function handleAdd() {
    setJustAdded(true)
    setTimeout(() => setJustAdded(false), 300)
    onAddToList()
  }

  return (
    <div
      className={cn(
        'group relative flex h-full flex-col rounded-2xl border-l-[4px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-card overflow-hidden',
        'transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-lg',
        // Rarity left border colour
        // rarityClass?.border ?? 'rarity-border-common',
        // Rarity hover glow
        // rarityClass?.glow ?? 'rarity-glow-common',
        // Tried state border override
        isTried && 'border-green-400 dark:border-green-700',
        // Scale pop on add
        justAdded && 'scale-[1.05]',
        // Holographic shine for rare products
        rarity === 'Legendary' && 'card-shine-legendary',
        rarity === 'Epic' && 'card-shine-epic',
      )}
    >
      {/* Status ribbon */}
      {isTried && (
        <div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-full bg-green-500 px-2 py-0.5 text-[10px] font-semibold text-white shadow">
          <CheckCircle2 size={10} /> Tried
        </div>
      )}
      {userStatus === 'want_to_try' && (
        <div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-full bg-blue-500 px-2 py-0.5 text-[10px] font-semibold text-white shadow">
          <BookmarkCheck size={10} /> On list
        </div>
      )}

      {/* Image */}
      <div className="relative h-40 w-full shrink-0 overflow-hidden flex items-center justify-center">
        <ProductImage
          src={product.image_url}
          name={product.name}
          className="h-full w-full object-contain transition-all duration-300 group-hover:scale-105 group-hover:brightness-[1.05]"
          size="md"
          isTried={isTried}
        />
      </div>

      {/* Body */}
      <div className={cn('flex flex-1 flex-col p-4', isTried && 'bg-green-50/30 dark:bg-green-950/10')}>
        {/* Category */}
        {product.category && (
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.05em] text-[hsl(var(--muted-foreground))]">
            {product.category}
          </p>
        )}

        {/* Name */}
        <h3 className="mb-3 text-sm font-semibold leading-snug text-[hsl(var(--foreground))] line-clamp-2">
          {productName}
        </h3>

        {/* Tags */}
        <div className="mb-3 flex flex-wrap gap-1.5">
          {rarity && (
            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.05em]', RARITY_PILL[rarity] ?? 'bg-gray-100 text-gray-600')}>
              {rarity}
            </span>
          )}
          {/* {avail && (
            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', AVAIL_PILL[avail] ?? 'bg-gray-100 text-gray-600')}>
              {avail}
            </span>
          )} */}
          {product.is_discontinued && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              Discontinued
            </span>
          )}
        </div>

        {/* Stars â€” Lucide filled/outlined */}
        <div className="mb-4 flex items-center gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              size={13}
              className={i < pts ? 'text-amul-gold fill-amul-gold' : 'text-[hsl(var(--muted-foreground))] fill-none'}
            />
          ))}
          <span className="ml-1.5 text-[10px] font-bold text-amul-gold dark:amul-gold-glow">
            {pts} pt{pts !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Actions */}
        <div className="mt-auto">
          {isTried ? (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 min-w-0">
                <CheckCircle2 size={14} className="shrink-0" />
                <span className="truncate">
                  {triedAt
                    ? `Tried ${new Date(triedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
                    : 'Tried!'}
                </span>
              </div>
              {onRemoveFromList && (
                <button
                  onClick={onRemoveFromList}
                  disabled={isLoading}
                  aria-label="Remove from list"
                  className="shrink-0 rounded-lg p-1.5 text-[hsl(var(--muted-foreground))] transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30 disabled:opacity-50"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ) : userStatus === 'want_to_try' ? (
            <div className="flex gap-2">
              <button
                onClick={onRemoveFromList}
                disabled={isLoading}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-300 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 disabled:opacity-50"
              >
                {isLoading && loadingAction === 'remove'
                  ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-600 border-t-transparent dark:border-gray-300" />
                  : <Plus size={13} className="rotate-45" />}
                {isLoading && loadingAction === 'remove' ? 'Removingâ€¦' : 'Remove'}
              </button>
              <button
                onClick={onMarkAsTried}
                disabled={isLoading}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-amul-red px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-amul-red-dark disabled:opacity-50"
              >
                {isLoading && loadingAction === 'tried'
                  ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  : <CheckCircle2 size={13} />}
                {isLoading && loadingAction === 'tried' ? 'Savingâ€¦' : 'Tried it!'}
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleAdd}
                disabled={isLoading}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-xs font-semibold text-[hsl(var(--foreground))] transition-all hover:bg-[hsl(var(--muted))] disabled:opacity-50"
              >
                {isLoading && loadingAction === 'add'
                  ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-amul-red border-t-transparent" />
                  : <Plus size={13} />}
                {isLoading && loadingAction === 'add' ? 'Addingâ€¦' : 'Add to List'}
              </button>
              <button
                onClick={onMarkAsTried}
                disabled={isLoading}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-amul-red px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-amul-red-dark disabled:opacity-50"
              >
                {isLoading && loadingAction === 'tried'
                  ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  : <CheckCircle2 size={13} />}
                {isLoading && loadingAction === 'tried' ? 'Savingâ€¦' : 'Tried it!'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

