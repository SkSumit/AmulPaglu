import { useEffect, useState } from 'react'
import {
  Shield, ShieldOff, Search, Trophy, Trash2, X, ChevronDown, CheckSquare, Square,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useToast, ToastContainer } from '@/components/ui/Toast'
import { getTier } from '@/types'
import type { Profile } from '@/types'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/Skeleton'



type FilterAdmin = 'all' | 'admins' | 'non-admins'

// ── User detail modal ─────────────────────────────────────
function UserDetailModal({
  user,
  onClose,
  onToggleAdmin,
  onDelete,
  isMe,
  toggling,
  deleting,
}: {
  user: Profile
  onClose: () => void
  onToggleAdmin: (u: Profile) => void
  onDelete: (u: Profile) => void
  isMe: boolean
  toggling: string | null
  deleting: string | null
}) {
  const tier = getTier(user.total_points)
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-t-3xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-xl sm:rounded-2xl">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amul-red/10 text-xl font-bold text-amul-red">
              {user.username[0].toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-[hsl(var(--foreground))]">{user.username}</p>
              {user.full_name && (
                <p className="text-sm text-[hsl(var(--muted-foreground))]">{user.full_name}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"
          >
            <X size={16} />
          </button>
        </div>
        <div className="mb-5 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40 p-3 text-center">
            <p className="text-2xl font-bold text-amul-gold">{user.total_points}</p>
            <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">Total points</p>
          </div>
          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40 p-3 text-center">
            <p className="text-2xl">{tier.emoji}</p>
            <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">{tier.label}</p>
          </div>
        </div>
        <div className="mb-5 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-[hsl(var(--muted-foreground))]">User ID</span>
            <span className="font-mono text-xs truncate max-w-[60%]">{user.id}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[hsl(var(--muted-foreground))]">Joined</span>
            <span>{new Date(user.created_at).toLocaleDateString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[hsl(var(--muted-foreground))]">Admin</span>
            <span className={cn('font-semibold', user.is_admin ? 'text-amul-red' : '')}>
              {user.is_admin ? 'Yes' : 'No'}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => onToggleAdmin(user)}
            disabled={!!toggling || isMe}
            className={cn(
              'flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-40',
              user.is_admin
                ? 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950/30 dark:text-red-400'
                : 'bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] hover:bg-amul-red/10 hover:text-amul-red'
            )}
          >
            {toggling === user.id
              ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              : user.is_admin ? <ShieldOff size={14} /> : <Shield size={14} />}
            {user.is_admin ? 'Revoke admin' : 'Make admin'}
          </button>
          {!isMe && (
            <button
              onClick={() => onDelete(user)}
              disabled={!!deleting}
              className="flex items-center justify-center gap-2 rounded-xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-100 disabled:opacity-40 dark:bg-red-950/30 dark:text-red-400"
            >
              {deleting === user.id
                ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                : <Trash2 size={14} />}
              Delete user
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function ConfirmDeleteModal({
  count,
  onConfirm,
  onCancel,
  deleting,
}: {
  count: number
  onConfirm: () => void
  onCancel: () => void
  deleting: boolean
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="mx-4 w-full max-w-sm rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-xl">
        <h3 className="mb-2 font-semibold text-[hsl(var(--foreground))]">Delete {count} user{count !== 1 ? 's' : ''}?</h3>
        <p className="mb-5 text-sm text-[hsl(var(--muted-foreground))]">
          This will permanently delete {count === 1 ? 'this user' : `these ${count} users`} and all their data. This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl border border-[hsl(var(--border))] px-4 py-2.5 text-sm font-semibold hover:bg-[hsl(var(--muted))]"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            {deleting && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminUsers() {
  const { user: me } = useAuth()
  const { toasts, addToast, dismiss } = useToast()

  const [users,     setUsers]     = useState<Profile[]>([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [filterAdmin, setFilterAdmin] = useState<FilterAdmin>('all')
  const [toggling,  setToggling]  = useState<string | null>(null)
  const [deleting,  setDeleting]  = useState<string | null>(null)
  const [selected,  setSelected]  = useState<Set<string>>(new Set())
  const [detailUser, setDetailUser] = useState<Profile | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)

  useEffect(() => { void load() }, [])

  async function load() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('total_points', { ascending: false })
      if (error) throw error
      setUsers(data ?? [])
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to load users', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function toggleAdmin(profile: Profile) {
    if (profile.id === me?.id) { addToast('Cannot change your own admin status.', 'error'); return }
    setToggling(profile.id)
    const newVal = !profile.is_admin
    const { error } = await supabase.from('profiles').update({ is_admin: newVal }).eq('id', profile.id)
    setToggling(null)
    if (error) { addToast(error.message, 'error'); return }
    setUsers((u) => u.map((p) => p.id === profile.id ? { ...p, is_admin: newVal } : p))
    addToast(`${profile.username} is ${newVal ? 'now' : 'no longer'} an admin.`, 'success')
  }

  async function deleteUser(profile: Profile) {
    setDeleting(profile.id)
    const { error } = await (supabase as any).rpc('admin_delete_user', { target_id: profile.id })
    setDeleting(null)
    if (error) { addToast(error.message, 'error'); return }
    setUsers((u) => u.filter((p) => p.id !== profile.id))
    addToast(`${profile.username} deleted.`, 'success')
  }

  async function bulkDelete() {
    setBulkDeleting(true)
    const ids = Array.from(selected).filter((id) => id !== me?.id)
    if (ids.length === 0) { setBulkDeleting(false); return }
    const results = await Promise.allSettled(
      ids.map((id) => (supabase as any).rpc('admin_delete_user', { target_id: id }))
    )
    const failed = results.filter((r) => r.status === 'rejected' || (r.status === 'fulfilled' && r.value.error))
    setBulkDeleting(false)
    setBulkDeleteOpen(false)
    if (failed.length > 0) {
      addToast(`${failed.length} user(s) could not be deleted.`, 'error')
    }
    const successCount = ids.length - failed.length
    if (successCount > 0) {
      setUsers((u) => u.filter((p) => !ids.includes(p.id) || failed.some((f) => f.status === 'fulfilled' && 'value' in f)))
      addToast(`${successCount} user${successCount !== 1 ? 's' : ''} deleted.`, 'success')
    }
    setSelected(new Set())
    await load()
  }

  function toggleSelect(id: string) {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    const eligibleIds = filtered.filter((u) => u.id !== me?.id).map((u) => u.id)
    const allSelected = eligibleIds.every((id) => selected.has(id))
    if (allSelected) {
      setSelected((s) => { const next = new Set(s); eligibleIds.forEach((id) => next.delete(id)); return next })
    } else {
      setSelected((s) => { const next = new Set(s); eligibleIds.forEach((id) => next.add(id)); return next })
    }
  }

  const filtered = users.filter((u) => {
    const matchSearch = u.username.toLowerCase().includes(search.toLowerCase())
    const matchAdmin = filterAdmin === 'all' ? true : filterAdmin === 'admins' ? u.is_admin : !u.is_admin
    return matchSearch && matchAdmin
  })

  const eligibleIds = filtered.filter((u) => u.id !== me?.id).map((u) => u.id)
  const allSelectedOnPage = eligibleIds.length > 0 && eligibleIds.every((id) => selected.has(id))
  const selectionCount = Array.from(selected).filter((id) => id !== me?.id).length

  return (
    <div className="p-6 page-transition">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-bold text-[hsl(var(--foreground))]">Users</h1>
          <p className="mt-0.5 text-sm text-[hsl(var(--muted-foreground))]">{users.length} registered users</p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
          <input
            type="search"
            placeholder="Search by username…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] py-2.5 pl-10 pr-4 text-sm outline-none focus:border-amul-red"
          />
        </div>
        <div className="relative">
          <select
            value={filterAdmin}
            onChange={(e) => setFilterAdmin(e.target.value as FilterAdmin)}
            className="appearance-none rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] py-2.5 pl-4 pr-9 text-sm outline-none focus:border-amul-red"
          >
            <option value="all">All users</option>
            <option value="admins">Admins only</option>
            <option value="non-admins">Non-admins</option>
          </select>
          <ChevronDown size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
        </div>
      </div>

      {selectionCount > 0 && (
        <div className="mb-3 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 dark:border-red-900/40 dark:bg-red-950/20">
          <span className="text-sm font-semibold text-red-700 dark:text-red-400">{selectionCount} selected</span>
          <button
            onClick={() => setBulkDeleteOpen(true)}
            className="ml-auto flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 transition-colors"
          >
            <Trash2 size={12} />
            Delete {selectionCount}
          </button>
          <button onClick={() => setSelected(new Set())} className="rounded-lg p-1.5 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-card overflow-hidden">
        {loading ? (
          <div className="divide-y divide-[hsl(var(--border))]">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="h-5 w-5 rounded" />
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-7 w-20 rounded-lg" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-[hsl(var(--muted-foreground))]">No users found.</p>
        ) : (
          <>
            <div className="flex items-center gap-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30 px-4 py-2">
              <button
                onClick={toggleSelectAll}
                className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                aria-label={allSelectedOnPage ? 'Deselect all' : 'Select all'}
              >
                {allSelectedOnPage
                  ? <CheckSquare size={16} className="text-amul-red" />
                  : <Square size={16} />}
              </button>
              <span className="text-xs text-[hsl(var(--muted-foreground))]">
                {allSelectedOnPage ? 'Deselect all' : `Select all (${eligibleIds.length})`}
              </span>
            </div>
            <div className="divide-y divide-[hsl(var(--border))]">
              {filtered.map((u, i) => {
                const tier = getTier(u.total_points)
                const isMe = u.id === me?.id
                const isSelected = selected.has(u.id)
                return (
                  <div
                    key={u.id}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 transition-colors',
                      (isMe || isSelected) && 'bg-amul-red/5'
                    )}
                  >
                    <button
                      onClick={(e) => { e.stopPropagation(); if (!isMe) toggleSelect(u.id) }}
                      disabled={isMe}
                      className="shrink-0 disabled:opacity-30 text-[hsl(var(--muted-foreground))] hover:text-amul-red"
                    >
                      {isSelected
                        ? <CheckSquare size={15} className="text-amul-red" />
                        : <Square size={15} />}
                    </button>
                    <span className="w-6 shrink-0 text-center text-xs font-bold text-[hsl(var(--muted-foreground))]">{i + 1}</span>
                    <button
                      onClick={() => setDetailUser(u)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amul-red/10 text-sm font-bold text-amul-red">
                        {u.username[0].toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-semibold text-[hsl(var(--foreground))] truncate">{u.username}</p>
                          {u.is_admin && (
                            <span className="rounded-full bg-amul-red/10 px-1.5 py-0.5 text-[10px] font-semibold text-amul-red">Admin</span>
                          )}
                          {isMe && (
                            <span className="rounded-full bg-[hsl(var(--muted))] px-1.5 py-0.5 text-[10px] text-[hsl(var(--muted-foreground))]">you</span>
                          )}
                        </div>
                        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                          {tier.emoji} {tier.label} &middot; <Trophy size={9} className="inline" /> {u.total_points} pts
                        </p>
                      </div>
                    </button>
                    <button
                      onClick={() => void toggleAdmin(u)}
                      disabled={!!toggling || isMe}
                      className={cn(
                        'flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40',
                        u.is_admin
                          ? 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950/30 dark:text-red-400'
                          : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:bg-amul-red/10 hover:text-amul-red'
                      )}
                    >
                      {toggling === u.id
                        ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        : u.is_admin ? <ShieldOff size={13} /> : <Shield size={13} />}
                      <span className="hidden sm:inline">{u.is_admin ? 'Revoke' : 'Make admin'}</span>
                    </button>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {detailUser && (
        <UserDetailModal
          user={detailUser}
          onClose={() => setDetailUser(null)}
          onToggleAdmin={(u) => { void toggleAdmin(u) }}
          onDelete={(u) => { setDetailUser(null); void deleteUser(u) }}
          isMe={detailUser.id === me?.id}
          toggling={toggling}
          deleting={deleting}
        />
      )}

      {bulkDeleteOpen && (
        <ConfirmDeleteModal
          count={selectionCount}
          onConfirm={() => void bulkDelete()}
          onCancel={() => setBulkDeleteOpen(false)}
          deleting={bulkDeleting}
        />
      )}

      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </div>
  )
}
