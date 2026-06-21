import { useEffect, useState, type FormEvent } from 'react'
import { Lightbulb, Send, Clock, CheckCircle2, XCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useToast, ToastContainer } from '@/components/ui/Toast'
import type { Suggestion } from '@/types'
import { cn, getDisplayProductName } from '@/lib/utils'

const CATEGORIES = [
  'Dairy', 'Ice Cream', 'Cheese', 'Butter', 'Beverages',
  'Sweets', 'Snacks', 'Bread & Bakery', 'Other',
]

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending:  { label: 'Under review', color: 'bg-amber-100  text-amber-700  dark:bg-amber-900/30 dark:text-amber-400',  icon: Clock        },
  approved: { label: 'Approved',     color: 'bg-green-100  text-green-700  dark:bg-green-900/30 dark:text-green-400',  icon: CheckCircle2 },
  rejected: { label: 'Rejected',     color: 'bg-red-100    text-red-600    dark:bg-red-900/30   dark:text-red-400',    icon: XCircle      },
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-[hsl(var(--muted))]', className)} />
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-[hsl(var(--foreground))]">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}

export default function Suggest() {
  const { user, isLoading: authLoading } = useAuth()
  const { toasts, addToast, dismiss } = useToast()

  // Form state
  const [name,        setName]        = useState('')
  const [category,    setCategory]    = useState('')
  const [description, setDescription] = useState('')
  const [imageUrl,    setImageUrl]    = useState('')
  const [sourceUrl,   setSourceUrl]   = useState('')
  const [errors,      setErrors]      = useState<Record<string, string>>({})
  const [submitting,  setSubmitting]  = useState(false)
  const [submitted,   setSubmitted]   = useState(false)

  // Past suggestions
  const [past,        setPast]        = useState<Suggestion[]>([])
  const [pastLoading, setPastLoading] = useState(true)

  useEffect(() => {
    if (authLoading || !user) return
    void loadPast()
  }, [authLoading, user?.id])

  async function loadPast() {
    setPastLoading(true)
    try {
      const { data } = await supabase
        .from('suggestions')
        .select('*')
        .eq('submitted_by', user!.id)
        .order('created_at', { ascending: false })
      setPast(data ?? [])
    } finally {
      setPastLoading(false)
    }
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = 'Product name is required.'
    else if (name.trim().length < 3) e.name = 'Name must be at least 3 characters.'
    if (imageUrl.trim() && !/^https?:\/\//i.test(imageUrl.trim())) e.imageUrl = 'Must be a valid URL starting with http(s)://'
    if (sourceUrl.trim() && !/^https?:\/\//i.test(sourceUrl.trim())) e.sourceUrl = 'Must be a valid URL starting with http(s)://'
    return e
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const fieldErrors = validate()
    if (Object.keys(fieldErrors).length) { setErrors(fieldErrors); return }
    setErrors({})
    setSubmitting(true)
    try {
      const { error } = await supabase.from('suggestions').insert({
        submitted_by: user!.id,
        name:         name.trim(),
        category:     category || null,
        description:  description.trim() || null,
        image_url:    imageUrl.trim()  || null,
        source_url:   sourceUrl.trim() || null,
        status:       'pending',
      })
      if (error) throw error
      addToast('🎉 Suggestion submitted! We’ll review it soon.', 'success')
      setName(''); setCategory(''); setDescription(''); setImageUrl(''); setSourceUrl('')
      setSubmitted(true)
      void loadPast()
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Submission failed', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const inputCls = (err?: string) => cn(
    'w-full rounded-xl border bg-[hsl(var(--background))] px-3.5 py-2.5 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] outline-none transition-colors',
    err ? 'border-red-400 focus:border-red-400' : 'border-[hsl(var(--border))] focus:border-[hsl(var(--border))]'
  )

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 page-transition">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold text-[hsl(var(--foreground))] sm:text-3xl">
          <Lightbulb size={24} className="mr-2 inline text-amul-gold" />
          Suggest a product
        </h1>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
          Found something obscure at your local dairy? Tell us and we’ll add it to the catalogue.
        </p>
      </div>

      {/* Form */}
      <div className="mb-10 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-card">
        {submitted && (
          <div className="mb-5 flex items-center gap-3 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
            <CheckCircle2 size={16} className="shrink-0" />
            <span>Submitted! Want to suggest another?{' '}
              <button onClick={() => setSubmitted(false)} className="font-semibold underline">
                Add another
              </button>
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Product name *" error={errors.name}>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Amul Masti Lassi 200ml"
              className={inputCls(errors.name)}
            />
          </Field>

          <Field label="Category" error={errors.category}>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={inputCls()}
            >
              <option value="">Select a category (optional)</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>

          <Field label="Description" error={errors.description}>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Anything notable about this product — taste, packaging, where you found it…"
              rows={3}
              className={cn(inputCls(), 'resize-none')}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Image URL" error={errors.imageUrl}>
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://"
                className={inputCls(errors.imageUrl)}
              />
            </Field>
            <Field label="Source / Reference URL" error={errors.sourceUrl}>
              <input
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://amul.com/..."
                className={inputCls(errors.sourceUrl)}
              />
            </Field>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-amul-red px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amul-red-dark disabled:opacity-60"
          >
            {submitting
              ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              : <Send size={15} />}
            {submitting ? 'Submitting…' : 'Submit suggestion'}
          </button>
        </form>
      </div>

      {/* Past suggestions */}
      <h2 className="mb-4 font-display text-lg font-bold text-[hsl(var(--foreground))]">
        Your past suggestions
      </h2>

      {pastLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : past.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[hsl(var(--border))] py-12 text-center">
          <span className="text-4xl">📦</span>
          <p className="mt-3 text-sm text-[hsl(var(--muted-foreground))]">No suggestions yet. Be the first to contribute!</p>
        </div>
      ) : (
        <div className="divide-y divide-[hsl(var(--border))] rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-card overflow-hidden">
          {past.map((s) => {
            const cfg = STATUS_CONFIG[s.status] ?? STATUS_CONFIG.pending
            const StatusIcon = cfg.icon
            return (
              <div key={s.id} className="flex items-start gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[hsl(var(--foreground))]">{getDisplayProductName(s.name)}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2">
                    {s.category && (
                      <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{s.category}</span>
                    )}
                    <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                      {new Date(s.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  {s.admin_note && (
                    <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))] italic">“{s.admin_note}”</p>
                  )}
                </div>
                <span className={cn('flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold', cfg.color)}>
                  <StatusIcon size={10} />
                  {cfg.label}
                </span>
              </div>
            )
          })}
        </div>
      )}

      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </div>
  )
}
