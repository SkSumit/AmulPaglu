import { useEffect, useState, type FormEvent } from 'react'
import { Plus, Pencil, Trash2, CheckCircle2, XCircle, Search, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast, ToastContainer } from '@/components/ui/Toast'
import type { Product } from '@/types'
import { cn, getDisplayProductName } from '@/lib/utils'
import { ProductImage } from '@/components/products/ProductImage'

const RARITIES     = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary']
const AVAILABILITIES = ['Pan India', 'Regional', 'Seasonal', 'Discontinued']
const CATEGORIES   = ['Dairy', 'Ice Cream', 'Cheese', 'Butter', 'Beverages', 'Sweets', 'Snacks', 'Bread & Bakery', 'Other']
const RARITY_POINTS: Record<string, number> = { Common: 1, Uncommon: 2, Rare: 3, Epic: 4, Legendary: 5 }

type StatusFilter = 'all' | 'approved' | 'pending' | 'rejected'

const STATUS_PILL: Record<string, string> = {
  approved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  pending:  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  rejected: 'bg-red-100   text-red-600   dark:bg-red-900/30   dark:text-red-400',
}

interface ProductForm {
  name: string; category: string; description: string
  image_url: string; source_url: string; rarity_label: string
  availability: string; points: string; status: string; is_discontinued: boolean
}

const EMPTY_FORM: ProductForm = {
  name: '', category: '', description: '', image_url: '', source_url: '',
  rarity_label: 'Common', availability: 'Pan India', points: '1',
  status: 'approved', is_discontinued: false,
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-[hsl(var(--muted))]', className)} />
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-[hsl(var(--foreground))]">{label}</label>
      {children}
      {error && <p className="mt-1 text-[10px] text-red-500">{error}</p>}
    </div>
  )
}

export default function AdminProducts() {
  const { toasts, addToast, dismiss } = useToast()

  const [products,  setProducts]  = useState<Product[]>([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [statusF,   setStatusF]   = useState<StatusFilter>('all')

  // Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [editing,   setEditing]   = useState<Product | null>(null)
  const [form,      setForm]      = useState<ProductForm>(EMPTY_FORM)
  const [errors,    setErrors]    = useState<Record<string, string>>({})
  const [saving,    setSaving]    = useState(false)
  const [deleting,  setDeleting]  = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkEditOpen, setBulkEditOpen] = useState(false)
  const [bulkForm, setBulkForm] = useState({
    status: '',
    rarity_label: '',
    availability: '',
    points: '',
    is_discontinued: '',
  })

  useEffect(() => { void load() }, [])

  useEffect(() => {
    setSelectedIds((prev) => {
      const productIds = new Set(products.map((p) => p.id))
      return new Set(Array.from(prev).filter((id) => productIds.has(id)))
    })
  }, [products])

  async function load() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('products').select('*').order('created_at', { ascending: false })
      if (error) throw error
      setProducts(data ?? [])
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Load failed', 'error')
    } finally {
      setLoading(false)
    }
  }

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setErrors({})
    setModalOpen(true)
  }

  function openEdit(p: Product) {
    setEditing(p)
    setForm({
      name:            p.name,
      category:        p.category        ?? '',
      description:     p.description     ?? '',
      image_url:       p.image_url       ?? '',
      source_url:      p.source_url      ?? '',
      rarity_label:    p.rarity_label    ?? 'Common',
      availability:    p.availability    ?? 'Pan India',
      points:          String(p.points   ?? 1),
      status:          p.status,
      is_discontinued: p.is_discontinued,
    })
    setErrors({})
    setModalOpen(true)
  }

  function validate(): Record<string, string> {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Required'
    if (form.image_url && !/^https?:\/\//i.test(form.image_url)) e.image_url = 'Must start with http(s)://'
    if (form.source_url && !/^https?:\/\//i.test(form.source_url)) e.source_url = 'Must start with http(s)://'
    const pts = Number(form.points)
    if (isNaN(pts) || pts < 1 || pts > 5) e.points = '1–5'
    return e
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setSaving(true)
    const payload = {
      name:            form.name.trim(),
      category:        form.category     || null,
      description:     form.description.trim() || null,
      image_url:       form.image_url.trim()   || null,
      source_url:      form.source_url.trim()  || null,
      rarity_label:    form.rarity_label,
      availability:    form.availability,
      points:          Number(form.points),
      status:          form.status,
      is_discontinued: form.is_discontinued,
    }
    try {
      if (editing) {
        const { error } = await supabase.from('products').update(payload).eq('id', editing.id)
        if (error) throw error
        addToast('Product updated.', 'success')
      } else {
        const { error } = await supabase.from('products').insert(payload)
        if (error) throw error
        addToast('Product created.', 'success')
      }
      setModalOpen(false)
      await load()
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(p: Product) {
    if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return
    setDeleting(p.id)
    const { error } = await supabase.from('products').delete().eq('id', p.id)
    setDeleting(null)
    if (error) { addToast(error.message, 'error'); return }
    addToast('Product deleted.', 'success')
    setProducts((prev) => prev.filter((x) => x.id !== p.id))
  }

  async function quickStatus(p: Product, status: string) {
    const { error } = await supabase.from('products').update({ status }).eq('id', p.id)
    if (error) { addToast(error.message, 'error'); return }
    setProducts((prev) => prev.map((x) => x.id === p.id ? { ...x, status } : x))
    addToast(`Marked as ${status}.`, 'success')
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function bulkApproveSelected() {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    setBulkBusy(true)
    const { error } = await supabase.from('products').update({ status: 'approved' }).in('id', ids)
    setBulkBusy(false)
    if (error) { addToast(error.message, 'error'); return }
    setProducts((prev) => prev.map((p) => (selectedIds.has(p.id) ? { ...p, status: 'approved' } : p)))
    addToast(`Approved ${ids.length} product${ids.length === 1 ? '' : 's'}.`, 'success')
    setSelectedIds(new Set())
  }

  async function bulkDeleteSelected() {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    if (!confirm(`Delete ${ids.length} selected product${ids.length === 1 ? '' : 's'}? This cannot be undone.`)) return
    setBulkBusy(true)
    const { error } = await supabase.from('products').delete().in('id', ids)
    setBulkBusy(false)
    if (error) { addToast(error.message, 'error'); return }
    setProducts((prev) => prev.filter((p) => !selectedIds.has(p.id)))
    addToast(`Deleted ${ids.length} product${ids.length === 1 ? '' : 's'}.`, 'success')
    setSelectedIds(new Set())
  }

  async function bulkEditSelected() {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return

    const payload: Partial<Product> = {}
    if (bulkForm.status) payload.status = bulkForm.status as Product['status']
    if (bulkForm.rarity_label) payload.rarity_label = bulkForm.rarity_label
    if (bulkForm.availability) payload.availability = bulkForm.availability
    if (bulkForm.points) {
      const pts = Number(bulkForm.points)
      if (!Number.isFinite(pts) || pts < 1 || pts > 5) {
        addToast('Bulk points must be between 1 and 5.', 'error')
        return
      }
      payload.points = pts
    }
    if (bulkForm.is_discontinued === 'true') payload.is_discontinued = true
    if (bulkForm.is_discontinued === 'false') payload.is_discontinued = false

    if (Object.keys(payload).length === 0) {
      addToast('Choose at least one field to edit in bulk.', 'error')
      return
    }

    setBulkBusy(true)
    const { error } = await supabase.from('products').update(payload).in('id', ids)
    setBulkBusy(false)
    if (error) { addToast(error.message, 'error'); return }

    setProducts((prev) => prev.map((p) => (selectedIds.has(p.id) ? { ...p, ...payload } : p)))
    addToast(`Updated ${ids.length} product${ids.length === 1 ? '' : 's'}.`, 'success')
    setBulkEditOpen(false)
    setBulkForm({ status: '', rarity_label: '', availability: '', points: '', is_discontinued: '' })
    setSelectedIds(new Set())
  }

  const filtered = products.filter((p) => {
    if (statusF !== 'all' && p.status !== statusF) return false
    if (search && !getDisplayProductName(p.name).toLowerCase().includes(search.toLowerCase())) return false
    return true
  })
  const allFilteredSelected = filtered.length > 0 && filtered.every((p) => selectedIds.has(p.id))

  const inputCls = (err?: string) => cn(
    'w-full rounded-lg border bg-[hsl(var(--background))] px-3 py-2 text-sm outline-none',
    err ? 'border-red-400' : 'border-[hsl(var(--border))]'
  )

  return (
    <div className="flex h-full flex-col overflow-hidden p-6 page-transition">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-bold text-[hsl(var(--foreground))]">Products</h1>
          <p className="mt-0.5 text-sm text-[hsl(var(--muted-foreground))]">{products.length} products in DB</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-xl bg-amul-red px-4 py-2 text-sm font-semibold text-white hover:bg-amul-red-dark"
        >
          <Plus size={15} /> Add product
        </button>
      </div>

      {/* Filters */}
      <div className="mb-4 flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
          <input
            type="search"
            placeholder="Search products…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] py-2 pl-9 pr-4 text-sm outline-none"
          />
        </div>
        {(['all', 'approved', 'pending', 'rejected'] as StatusFilter[]).map((s) => (
          <button
            key={s}
            onClick={() => setStatusF(s)}
            className={cn(
              'rounded-xl border px-3 py-2 text-xs font-medium transition-colors capitalize',
              statusF === s
                ? 'border-amul-red bg-amul-red/10 text-amul-red'
                : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]'
            )}
          >
            {s === 'all' ? 'All' : s}
          </button>
        ))}
      </div>

      {/* Bulk actions */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="inline-flex items-center gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-xs font-medium text-[hsl(var(--foreground))]">
          <input
            type="checkbox"
            checked={allFilteredSelected}
            onChange={(e) => {
              setSelectedIds((prev) => {
                const next = new Set(prev)
                if (e.target.checked) filtered.forEach((p) => next.add(p.id))
                else filtered.forEach((p) => next.delete(p.id))
                return next
              })
            }}
            className="h-4 w-4 rounded"
          />
          Select all shown
        </label>

        {selectedIds.size > 0 && (
          <>
            <span className="rounded-lg bg-[hsl(var(--muted))] px-2.5 py-1 text-xs font-semibold text-[hsl(var(--foreground))]">
              {selectedIds.size} selected
            </span>
            <button
              onClick={bulkApproveSelected}
              disabled={bulkBusy}
              className="rounded-xl bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-60"
            >
              Approve selected
            </button>
            <button
              onClick={() => setBulkEditOpen(true)}
              disabled={bulkBusy}
              className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-xs font-semibold text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] disabled:opacity-60"
            >
              Edit selected
            </button>
            <button
              onClick={bulkDeleteSelected}
              disabled={bulkBusy}
              className="rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
            >
              Delete selected
            </button>
          </>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-card overflow-hidden">
        {loading ? (
          <div className="h-full overflow-y-auto divide-y divide-[hsl(var(--border))]">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
                <div className="flex-1 space-y-1.5"><Skeleton className="h-3.5 w-40" /><Skeleton className="h-3 w-24" /></div>
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-7 w-7 rounded-lg" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-full items-center justify-center py-12 text-center text-sm text-[hsl(var(--muted-foreground))]">No products found.</div>
        ) : (
          <div className="h-full overflow-y-auto overflow-x-hidden divide-y divide-[hsl(var(--border))]">
            {filtered.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[hsl(var(--muted))]/40 transition-colors">
                <input
                  type="checkbox"
                  checked={selectedIds.has(p.id)}
                  onChange={() => toggleSelected(p.id)}
                  className="h-4 w-4 shrink-0 rounded"
                />
                {/* Image */}
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[hsl(var(--muted))]">
                  <ProductImage
                    src={p.image_url}
                    name={p.name}
                    className="h-full w-full object-contain"
                    size="xs"
                  />
                </div>
                {/* Info */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[hsl(var(--foreground))]">{getDisplayProductName(p.name)}</p>
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                    {p.category ?? '—'} · {p.rarity_label ?? '—'} · {p.points ?? 0}pt
                  </p>
                </div>
                {/* Status pill */}
                <span className={cn('shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold capitalize', STATUS_PILL[p.status] ?? STATUS_PILL.pending)}>
                  {p.status}
                </span>
                {/* Quick approve/reject for pending */}
                {p.status === 'pending' && (
                  <div className="flex shrink-0 gap-1">
                    <button onClick={() => quickStatus(p, 'approved')} title="Approve"
                      className="rounded-lg p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30">
                      <CheckCircle2 size={15} />
                    </button>
                    <button onClick={() => quickStatus(p, 'rejected')} title="Reject"
                      className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30">
                      <XCircle size={15} />
                    </button>
                  </div>
                )}
                {/* Edit / Delete */}
                <div className="flex shrink-0 gap-1">
                  <button onClick={() => openEdit(p)} className="rounded-lg p-1.5 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => handleDelete(p)} disabled={deleting === p.id}
                    className="rounded-lg p-1.5 text-[hsl(var(--muted-foreground))] hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30 disabled:opacity-40">
                    {deleting === p.id
                      ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent block" />
                      : <Trash2 size={14} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bulk Edit Modal */}
      {bulkEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setBulkEditOpen(false)} />
          <div className="relative z-10 w-full max-w-md rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-card-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-[hsl(var(--foreground))]">Bulk edit products</h2>
              <button onClick={() => setBulkEditOpen(false)} className="rounded-lg p-1.5 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]">
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-3">
              <Field label="Status">
                <select value={bulkForm.status} onChange={(e) => setBulkForm((f) => ({ ...f, status: e.target.value }))} className={inputCls()}>
                  <option value="">Keep unchanged</option>
                  <option value="approved">Approved</option>
                  <option value="pending">Pending</option>
                  <option value="rejected">Rejected</option>
                </select>
              </Field>
              <Field label="Rarity">
                <select value={bulkForm.rarity_label} onChange={(e) => setBulkForm((f) => ({ ...f, rarity_label: e.target.value }))} className={inputCls()}>
                  <option value="">Keep unchanged</option>
                  {RARITIES.map((r) => <option key={r}>{r}</option>)}
                </select>
              </Field>
              <Field label="Availability">
                <select value={bulkForm.availability} onChange={(e) => setBulkForm((f) => ({ ...f, availability: e.target.value }))} className={inputCls()}>
                  <option value="">Keep unchanged</option>
                  {AVAILABILITIES.map((a) => <option key={a}>{a}</option>)}
                </select>
              </Field>
              <Field label="Points (1–5)">
                <input type="number" min={1} max={5} value={bulkForm.points}
                  onChange={(e) => setBulkForm((f) => ({ ...f, points: e.target.value }))}
                  placeholder="Keep unchanged" className={inputCls()} />
              </Field>
              <Field label="Discontinued">
                <select value={bulkForm.is_discontinued} onChange={(e) => setBulkForm((f) => ({ ...f, is_discontinued: e.target.value }))} className={inputCls()}>
                  <option value="">Keep unchanged</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </Field>
            </div>

            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setBulkEditOpen(false)}
                className="flex-1 rounded-xl border border-[hsl(var(--border))] px-4 py-2.5 text-sm font-medium text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]">
                Cancel
              </button>
              <button type="button" onClick={bulkEditSelected} disabled={bulkBusy}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amul-red px-4 py-2.5 text-sm font-semibold text-white hover:bg-amul-red-dark disabled:opacity-60">
                {bulkBusy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : null}
                Apply to selected
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
          <div className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-card-lg">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-[hsl(var(--foreground))]">
                {editing ? 'Edit product' : 'Add product'}
              </h2>
              <button onClick={() => setModalOpen(false)} className="rounded-lg p-1.5 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <Field label="Name *" error={errors.name}>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Amul Masti Spiced Buttermilk" className={inputCls(errors.name)} />
              </Field>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Category">
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputCls()}>
                    <option value="">Select…</option>
                    {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Rarity">
                  <select value={form.rarity_label}
                    onChange={(e) => setForm({ ...form, rarity_label: e.target.value, points: String(RARITY_POINTS[e.target.value] ?? 1) })}
                    className={inputCls()}>
                    {RARITIES.map((r) => <option key={r}>{r}</option>)}
                  </select>
                </Field>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Availability">
                  <select value={form.availability} onChange={(e) => setForm({ ...form, availability: e.target.value })} className={inputCls()}>
                    {AVAILABILITIES.map((a) => <option key={a}>{a}</option>)}
                  </select>
                </Field>
                <Field label="Points (1–5)" error={errors.points}>
                  <input type="number" min={1} max={5} value={form.points}
                    onChange={(e) => setForm({ ...form, points: e.target.value })} className={inputCls(errors.points)} />
                </Field>
              </div>

              <Field label="Description">
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Optional description…" rows={2} className={cn(inputCls(), 'resize-none')} />
              </Field>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Image URL" error={errors.image_url}>
                  <input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                    placeholder="https://" className={inputCls(errors.image_url)} />
                </Field>
                <Field label="Source URL" error={errors.source_url}>
                  <input value={form.source_url} onChange={(e) => setForm({ ...form, source_url: e.target.value })}
                    placeholder="https://" className={inputCls(errors.source_url)} />
                </Field>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Status">
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={inputCls()}>
                    <option value="approved">Approved</option>
                    <option value="pending">Pending</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </Field>
                <div className="flex items-center gap-2 pt-6">
                  <input type="checkbox" id="discontinued" checked={form.is_discontinued}
                    onChange={(e) => setForm({ ...form, is_discontinued: e.target.checked })}
                    className="h-4 w-4 rounded" />
                  <label htmlFor="discontinued" className="text-sm text-[hsl(var(--foreground))]">Discontinued</label>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setModalOpen(false)}
                  className="flex-1 rounded-xl border border-[hsl(var(--border))] px-4 py-2.5 text-sm font-medium text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amul-red px-4 py-2.5 text-sm font-semibold text-white hover:bg-amul-red-dark disabled:opacity-60">
                  {saving ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : null}
                  {saving ? 'Saving…' : editing ? 'Save changes' : 'Create product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </div>
  )
}
