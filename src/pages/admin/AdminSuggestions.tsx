import { useEffect, useState } from 'react'
import { CheckCircle2, XCircle, Clock, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast, ToastContainer } from '@/components/ui/Toast'
import type { Suggestion } from '@/types'
import { cn, getDisplayProductName } from '@/lib/utils'
import { ProductImage } from '@/components/products/ProductImage'

type Tab = 'pending' | 'approved' | 'rejected'

const TAB_CONFIG: Record<Tab, { label: string; color: string }> = {
  pending:  { label: 'Pending',  color: 'text-amber-500' },
  approved: { label: 'Approved', color: 'text-green-600' },
  rejected: { label: 'Rejected', color: 'text-red-500'   },
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-[hsl(var(--muted))]', className)} />
}

export default function AdminSuggestions() {
  const { toasts, addToast, dismiss } = useToast()

  const [tab,        setTab]        = useState<Tab>('pending')
  const [items,      setItems]      = useState<Record<Tab, Suggestion[]>>({ pending: [], approved: [], rejected: [] })
  const [loading,    setLoading]    = useState(true)
  const [acting,     setActing]     = useState<string | null>(null)
  const [noteMap,    setNoteMap]    = useState<Record<string, string>>({})
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => { void load() }, [])

  async function load() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('suggestions')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      const grouped: Record<Tab, Suggestion[]> = { pending: [], approved: [], rejected: [] }
      for (const s of data ?? []) {
        if (s.status in grouped) grouped[s.status as Tab].push(s)
      }
      setItems(grouped)
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Load failed', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function decide(suggestion: Suggestion, decision: 'approved' | 'rejected') {
    setActing(suggestion.id)
    const note = noteMap[suggestion.id]?.trim() || null
    try {
      if (decision === 'approved') {
        // Create the product from suggestion data
        const { error: prodErr } = await supabase.from('products').insert({
          name:         suggestion.name,
          category:     suggestion.category,
          description:  suggestion.description,
          image_url:    suggestion.image_url,
          source_url:   suggestion.source_url,
          status:       'approved',
          submitted_by: suggestion.submitted_by,
          points:       1,
          rarity_label: 'Common',
        })
        if (prodErr) throw prodErr
      }
      const { error } = await supabase
        .from('suggestions')
        .update({ status: decision, admin_note: note })
        .eq('id', suggestion.id)
      if (error) throw error
      addToast(decision === 'approved' ? '✅ Approved & product created!' : '❌ Rejected.', 'success')
      await load()
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Action failed', 'error')
    } finally {
      setActing(null)
    }
  }

  const current = items[tab]

  return (
    <div className="p-6 page-transition">
      <div className="mb-6">
        <h1 className="font-display text-xl font-bold text-[hsl(var(--foreground))]">Suggestions</h1>
        <p className="mt-0.5 text-sm text-[hsl(var(--muted-foreground))]">Review user-submitted product suggestions</p>
      </div>

      {/* Tabs */}
      <div className="mb-5 flex gap-1 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-1">
        {(Object.keys(TAB_CONFIG) as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-sm font-medium transition-colors',
              tab === t ? 'bg-[hsl(var(--card))] shadow-sm text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))]'
            )}
          >
            {t === 'pending' && <Clock size={13} />}
            {t === 'approved' && <CheckCircle2 size={13} />}
            {t === 'rejected' && <XCircle size={13} />}
            {TAB_CONFIG[t].label}
            <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-bold', tab === t ? 'bg-amul-red/10 text-amul-red' : 'bg-[hsl(var(--border))]')}>
              {items[t].length}
            </span>
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-card overflow-hidden">
        {loading ? (
          <div className="divide-y divide-[hsl(var(--border))]">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="px-4 py-4 space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
            ))}
          </div>
        ) : current.length === 0 ? (
          <p className="py-12 text-center text-sm text-[hsl(var(--muted-foreground))]">No {tab} suggestions.</p>
        ) : (
          <div className="divide-y divide-[hsl(var(--border))]">
            {current.map((s) => {
              const isExpanded = expandedId === s.id
              const displayName = getDisplayProductName(s.name)
              return (
                <div key={s.id} className="px-4 py-4">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-[hsl(var(--foreground))]">{displayName}</p>
                        {s.category && (
                          <span className="rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 text-[10px] text-[hsl(var(--muted-foreground))]">{s.category}</span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[11px] text-[hsl(var(--muted-foreground))]">
                        {new Date(s.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    {/* Expand toggle */}
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : s.id)}
                      className="shrink-0 rounded-lg p-1.5 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"
                    >
                      {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </button>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="mt-3 space-y-2 rounded-xl bg-[hsl(var(--muted))]/50 p-3">
                      {s.description && <p className="text-xs text-[hsl(var(--foreground))]">{s.description}</p>}
                      {s.source_url && (
                        <a href={s.source_url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-amul-red hover:underline">
                          <ExternalLink size={11} /> Source
                        </a>
                      )}
                      <div className="h-24 w-24 rounded-xl overflow-hidden border border-[hsl(var(--border))]">
                        <ProductImage
                          src={s.image_url}
                          name={s.name}
                          className="h-full w-full object-cover"
                          size="sm"
                        />
                      </div>
                      {s.admin_note && (
                        <p className="text-xs italic text-[hsl(var(--muted-foreground))]">Note: {s.admin_note}</p>
                      )}

                      {/* Admin actions (only for pending) */}
                      {tab === 'pending' && (
                        <div className="pt-2 space-y-2">
                          <textarea
                            value={noteMap[s.id] ?? ''}
                            onChange={(e) => setNoteMap((m) => ({ ...m, [s.id]: e.target.value }))}
                            placeholder="Admin note (optional)"
                            rows={2}
                            className="w-full resize-none rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-xs outline-none"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => decide(s, 'approved')}
                              disabled={acting === s.id}
                              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-green-500 px-3 py-2 text-xs font-semibold text-white hover:bg-green-600 disabled:opacity-50"
                            >
                              {acting === s.id
                                ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                : <CheckCircle2 size={13} />}
                              Approve & create product
                            </button>
                            <button
                              onClick={() => decide(s, 'rejected')}
                              disabled={acting === s.id}
                              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400 disabled:opacity-50"
                            >
                              <XCircle size={13} />
                              Reject
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </div>
  )
}
