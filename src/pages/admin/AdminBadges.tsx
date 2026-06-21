import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Search, X, CheckSquare, Square } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast, ToastContainer } from '@/components/ui/Toast'
import type { Badge, BadgeInsert, BadgeUpdate } from '@/types'
import type { BadgeConditionJson } from '@/types/database'
import { conditionSummary } from '@/types'
import { cn } from '@/lib/utils'

// ── Condition type options ─────────────────────────────────
const CONDITION_TYPES = [
  { value: 'tried_count',          label: 'Tried N or more products total' },
  { value: 'category_tried_count', label: 'Tried N products in a category' },
  { value: 'category_complete',    label: 'Tried ALL products in a category' },
  { value: 'rarity_tried_count',   label: 'Tried N products with points ≥ X' },
  { value: 'suggestion_approved',  label: 'Had a suggestion approved' },
  { value: 'early_adopter',        label: 'Signed up before a specific date' },
] as const

// ── Empty form state ───────────────────────────────────────
function emptyForm() {
  return {
    icon:           '',
    name:           '',
    description:    '',
    condition_type: 'tried_count' as BadgeConditionJson['type'],
    minimum_count:  '',
    category:       '',
    minimum_points: '',
    before_date:    '',
  }
}

type FormState = ReturnType<typeof emptyForm>

function buildCondition(f: FormState): BadgeConditionJson {
  switch (f.condition_type) {
    case 'tried_count':
      return { type: 'tried_count', minimum_count: Number(f.minimum_count) }
    case 'category_tried_count':
      return { type: 'category_tried_count', category: f.category, minimum_count: Number(f.minimum_count) }
    case 'category_complete':
      return { type: 'category_complete', category: f.category }
    case 'rarity_tried_count':
      return { type: 'rarity_tried_count', minimum_points: Number(f.minimum_points), minimum_count: Number(f.minimum_count) }
    case 'suggestion_approved':
      return { type: 'suggestion_approved' }
    case 'early_adopter':
      return { type: 'early_adopter', before_date: f.before_date }
    default:
      return { type: 'tried_count', minimum_count: 1 }
  }
}

function formFromBadge(b: Badge): FormState {
  const c = b.condition as BadgeConditionJson
  return {
    icon:           b.icon,
    name:           b.name,
    description:    b.description,
    condition_type: c.type as FormState['condition_type'],
    minimum_count:  c.minimum_count?.toString() ?? '',
    category:       c.category ?? '',
    minimum_points: c.minimum_points?.toString() ?? '',
    before_date:    c.before_date ?? '',
  }
}

// ── Main page ──────────────────────────────────────────────
export default function AdminBadges() {
  const { toasts, addToast, dismiss } = useToast()

  const [badges,      setBadges]      = useState<Badge[]>([])
  const [loading,     setLoading]     = useState(true)
  const [search,      setSearch]      = useState('')
  const [modalOpen,   setModalOpen]   = useState(false)
  const [editTarget,  setEditTarget]  = useState<Badge | null>(null)
  const [saving,      setSaving]      = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Badge | null>(null)
  const [deleting,    setDeleting]    = useState(false)
  const [form,        setForm]        = useState<FormState>(emptyForm())
  const [selected,    setSelected]    = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)

  useEffect(() => { void loadBadges() }, [])

  async function loadBadges() {
    setLoading(true)
    const { data, error } = await supabase
      .from('badges')
      .select('*')
      .order('created_at', { ascending: true })
    if (error) addToast(error.message, 'error')
    else setBadges((data ?? []) as Badge[])
    setLoading(false)
  }

  function openAdd() {
    setEditTarget(null)
    setForm(emptyForm())
    setModalOpen(true)
  }

  function openEdit(b: Badge) {
    setEditTarget(b)
    setForm(formFromBadge(b))
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditTarget(null)
  }

  async function handleSave() {
    if (!form.name.trim() || !form.icon.trim() || !form.description.trim()) {
      addToast('Icon, name, and description are required.', 'error')
      return
    }
    setSaving(true)
    const condition = buildCondition(form)

    if (editTarget) {
      const update: BadgeUpdate = {
        icon: form.icon.trim(),
        name: form.name.trim(),
        description: form.description.trim(),
        condition,
      }
      const { error } = await supabase
        .from('badges')
        .update(update)
        .eq('id', editTarget.id)
      if (error) { addToast(error.message, 'error') }
      else {
        addToast('Badge updated!', 'success')
        closeModal()
        void loadBadges()
      }
    } else {
      // Generate slug from name
      const slug = form.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '')
      const insert: BadgeInsert = {
        slug,
        icon: form.icon.trim(),
        name: form.name.trim(),
        description: form.description.trim(),
        condition,
      }
      const { error } = await supabase.from('badges').insert(insert)
      if (error) { addToast(error.message, 'error') }
      else {
        addToast('Badge created!', 'success')
        closeModal()
        void loadBadges()
      }
    }
    setSaving(false)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const { error } = await supabase.from('badges').delete().eq('id', deleteTarget.id)
    if (error) { addToast(error.message, 'error') }
    else {
      addToast('Badge deleted.', 'success')
      setDeleteTarget(null)
      void loadBadges()
    }
    setDeleting(false)
  }

  async function bulkDelete() {
    setBulkDeleting(true)
    const ids = Array.from(selected)
    const { error } = await supabase.from('badges').delete().in('id', ids)
    setBulkDeleting(false)
    setBulkDeleteOpen(false)
    if (error) { addToast(error.message, 'error'); return }
    setBadges((b) => b.filter((x) => !ids.includes(x.id)))
    setSelected(new Set())
    addToast(`${ids.length} badge${ids.length !== 1 ? 's' : ''} deleted.`, 'success')
  }

  function toggleSelect(id: string) {
    setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }

  function toggleSelectAll() {
    const allSelected = filtered.every((b) => selected.has(b.id))
    if (allSelected) {
      setSelected((s) => { const n = new Set(s); filtered.forEach((b) => n.delete(b.id)); return n })
    } else {
      setSelected((s) => { const n = new Set(s); filtered.forEach((b) => n.add(b.id)); return n })
    }
  }

  const filtered = badges.filter((b) =>
    b.name.toLowerCase().includes(search.toLowerCase()) ||
    b.description.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[hsl(var(--foreground))]">Badges</h1>
          <p className="mt-0.5 text-sm text-[hsl(var(--muted-foreground))]">{badges.length} badge{badges.length !== 1 ? 's' : ''} configured</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 rounded-xl bg-amul-red px-4 py-2.5 text-sm font-semibold text-white hover:bg-amul-red-dark transition-colors"
        >
          <Plus size={15} />
          Add Badge
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-5 max-w-sm">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
        <input
          type="search"
          placeholder="Search badges…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] py-2.5 pl-10 pr-4 text-sm outline-none transition-colors focus:border-amul-red focus:ring-2 focus:ring-amul-red/20"
        />
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="mb-3 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 dark:border-red-900/40 dark:bg-red-950/20">
          <span className="text-sm font-semibold text-red-700 dark:text-red-400">{selected.size} selected</span>
          <button
            onClick={() => setBulkDeleteOpen(true)}
            className="ml-auto flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 transition-colors"
          >
            <Trash2 size={12} />
            Delete {selected.size}
          </button>
          <button onClick={() => setSelected(new Set())} className="rounded-lg p-1.5 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-[hsl(var(--muted-foreground))]">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-amul-red border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <span className="text-4xl">🏅</span>
            <p className="mt-3 text-sm text-[hsl(var(--muted-foreground))]">
              {search ? 'No badges match your search.' : 'No badges yet. Add one!'}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40">
              <tr>
                <th className="py-3 pl-4 pr-1 w-8">
                  <button onClick={toggleSelectAll} className="text-[hsl(var(--muted-foreground))] hover:text-amul-red">
                    {filtered.every((b) => selected.has(b.id))
                      ? <CheckSquare size={15} className="text-amul-red" />
                      : <Square size={15} />}
                  </button>
                </th>
                <th className="py-3 px-2 text-left font-semibold text-[hsl(var(--foreground))]">Badge</th>
                <th className="py-3 px-2 text-left font-semibold text-[hsl(var(--foreground))] hidden md:table-cell">Description</th>
                <th className="py-3 px-2 text-left font-semibold text-[hsl(var(--foreground))] hidden lg:table-cell">Condition</th>
                <th className="py-3 pl-2 pr-4 text-right font-semibold text-[hsl(var(--foreground))]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(var(--border))]">
              {filtered.map((b) => (
                <tr key={b.id} className={cn('hover:bg-[hsl(var(--muted))]/20 transition-colors', selected.has(b.id) && 'bg-amul-red/5')}>
                  <td className="py-3 pl-4 pr-1">
                    <button onClick={() => toggleSelect(b.id)} className="text-[hsl(var(--muted-foreground))] hover:text-amul-red">
                      {selected.has(b.id)
                        ? <CheckSquare size={15} className="text-amul-red" />
                        : <Square size={15} />}
                    </button>
                  </td>
                  <td className="py-3 px-2">
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl leading-none">{b.icon}</span>
                      <span className="font-semibold text-[hsl(var(--foreground))]">{b.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-2 text-[hsl(var(--muted-foreground))] max-w-xs truncate hidden md:table-cell">
                    {b.description}
                  </td>
                  <td className="py-3 px-2 hidden lg:table-cell">
                    <span className="rounded-full bg-[hsl(var(--muted))] px-2.5 py-1 text-[11px] font-medium text-[hsl(var(--foreground))]">
                      {conditionSummary(b.condition as BadgeConditionJson)}
                    </span>
                  </td>
                  <td className="py-3 pl-2 pr-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(b)}
                        className="rounded-lg p-1.5 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] transition-colors"
                        aria-label="Edit badge"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(b)}
                        className="rounded-lg p-1.5 text-[hsl(var(--muted-foreground))] hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30 transition-colors"
                        aria-label="Delete badge"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Add / Edit Modal ───────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-[hsl(var(--card))] shadow-2xl overflow-hidden">
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-5 py-4">
              <h2 className="font-display text-lg font-bold text-[hsl(var(--foreground))]">
                {editTarget ? 'Edit Badge' : 'Add Badge'}
              </h2>
              <button onClick={closeModal} className="rounded-lg p-1 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* Form */}
            <div className="space-y-4 px-5 py-4 max-h-[70vh] overflow-y-auto">
              {/* Icon + Name row */}
              <div className="flex gap-3">
                <div className="flex-none">
                  <label className="mb-1.5 block text-xs font-semibold text-[hsl(var(--foreground))]">Icon</label>
                  <input
                    type="text"
                    value={form.icon}
                    onChange={(e) => setForm({ ...form, icon: e.target.value })}
                    placeholder="🎉"
                    className="w-16 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 py-2.5 text-center text-xl outline-none focus:border-amul-red focus:ring-2 focus:ring-amul-red/20"
                  />
                </div>
                <div className="flex-1">
                  <label className="mb-1.5 block text-xs font-semibold text-[hsl(var(--foreground))]">Name *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="First Try"
                    className="w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2.5 text-sm outline-none focus:border-amul-red focus:ring-2 focus:ring-amul-red/20"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[hsl(var(--foreground))]">Description *</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  placeholder="Shown to users on the badge card"
                  className="w-full resize-none rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2.5 text-sm outline-none focus:border-amul-red focus:ring-2 focus:ring-amul-red/20"
                />
              </div>

              {/* Condition type */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[hsl(var(--foreground))]">Condition Type</label>
                <select
                  value={form.condition_type}
                  onChange={(e) => setForm({ ...form, condition_type: e.target.value as FormState['condition_type'] })}
                  className="w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2.5 text-sm outline-none focus:border-amul-red focus:ring-2 focus:ring-amul-red/20"
                >
                  {CONDITION_TYPES.map((ct) => (
                    <option key={ct.value} value={ct.value}>{ct.label}</option>
                  ))}
                </select>
              </div>

              {/* Dynamic condition fields */}
              {(form.condition_type === 'tried_count' || form.condition_type === 'category_tried_count' || form.condition_type === 'rarity_tried_count') && (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[hsl(var(--foreground))]">Minimum Count</label>
                  <input
                    type="number"
                    min={1}
                    value={form.minimum_count}
                    onChange={(e) => setForm({ ...form, minimum_count: e.target.value })}
                    className="w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2.5 text-sm outline-none focus:border-amul-red focus:ring-2 focus:ring-amul-red/20"
                  />
                </div>
              )}

              {(form.condition_type === 'category_tried_count' || form.condition_type === 'category_complete') && (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[hsl(var(--foreground))]">Category</label>
                  <input
                    type="text"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    placeholder="e.g. Cheese"
                    className="w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2.5 text-sm outline-none focus:border-amul-red focus:ring-2 focus:ring-amul-red/20"
                  />
                </div>
              )}

              {form.condition_type === 'rarity_tried_count' && (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[hsl(var(--foreground))]">Minimum Points (1–5)</label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={form.minimum_points}
                    onChange={(e) => setForm({ ...form, minimum_points: e.target.value })}
                    className="w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2.5 text-sm outline-none focus:border-amul-red focus:ring-2 focus:ring-amul-red/20"
                  />
                </div>
              )}

              {form.condition_type === 'early_adopter' && (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[hsl(var(--foreground))]">Before Date</label>
                  <input
                    type="date"
                    value={form.before_date}
                    onChange={(e) => setForm({ ...form, before_date: e.target.value })}
                    className="w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2.5 text-sm outline-none focus:border-amul-red focus:ring-2 focus:ring-amul-red/20"
                  />
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 border-t border-[hsl(var(--border))] px-5 py-4">
              <button
                onClick={closeModal}
                className="rounded-xl border border-[hsl(var(--border))] px-4 py-2 text-sm font-medium text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-amul-red px-4 py-2 text-sm font-semibold text-white hover:bg-amul-red-dark disabled:opacity-50 transition-colors"
              >
                {saving && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                {editTarget ? 'Save changes' : 'Create badge'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ───────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[hsl(var(--card))] p-6 shadow-2xl">
            <div className="mb-1 text-4xl text-center">{deleteTarget.icon}</div>
            <h2 className="mt-3 text-center font-display text-lg font-bold text-[hsl(var(--foreground))]">
              Delete "{deleteTarget.name}"?
            </h2>
            <p className="mt-2 text-center text-sm text-[hsl(var(--muted-foreground))]">
              This will remove the badge from all users who have earned it. This action cannot be undone.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 rounded-xl border border-[hsl(var(--border))] py-2 text-sm font-medium text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className={cn(
                  'flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-sm font-semibold text-white transition-colors',
                  deleting ? 'bg-red-400' : 'bg-red-600 hover:bg-red-700'
                )}
              >
                {deleting && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} dismiss={dismiss} />

      {/* Bulk delete confirm */}
      {bulkDeleteOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setBulkDeleteOpen(false)}
        >
          <div className="mx-4 w-full max-w-sm rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-xl">
            <h3 className="mb-2 font-semibold text-[hsl(var(--foreground))]">Delete {selected.size} badge{selected.size !== 1 ? 's' : ''}?</h3>
            <p className="mb-5 text-sm text-[hsl(var(--muted-foreground))]">
              This will permanently delete the selected badges and remove them from all users. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setBulkDeleteOpen(false)}
                className="flex-1 rounded-xl border border-[hsl(var(--border))] px-4 py-2.5 text-sm font-semibold hover:bg-[hsl(var(--muted))]"
              >
                Cancel
              </button>
              <button
                onClick={() => void bulkDelete()}
                disabled={bulkDeleting}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {bulkDeleting && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
