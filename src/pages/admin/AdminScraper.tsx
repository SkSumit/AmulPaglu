import { useEffect, useRef, useState } from 'react'
import { Bot, Play, RefreshCw, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast, ToastContainer } from '@/components/ui/Toast'
import type { ScrapeLog } from '@/types'
import { cn } from '@/lib/utils'

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-[hsl(var(--muted))]', className)} />
}

export default function AdminScraper() {
  const { toasts, addToast, dismiss } = useToast()

  const [logs,     setLogs]     = useState<ScrapeLog[]>([])
  const [loading,  setLoading]  = useState(true)
  const [running,  setRunning]  = useState(false)

  // Polling for scrape completion
  const pollTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollingLogRef = useRef<string | null>(null)

  useEffect(() => {
    void loadLogs()
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current)
    }
  }, [])

  async function loadLogs() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('scrape_logs')
        .select('*')
        .order('run_at', { ascending: false })
        .limit(20)
      if (error) throw error
      setLogs(data ?? [])
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to load logs', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function triggerScrape() {
    setRunning(true)
    try {
      // 1. Create a log row first so we have an ID to pass to the function
      const { data: log, error: logErr } = await supabase
        .from('scrape_logs')
        .insert({ status: 'running', log_detail: { triggered_by: 'manual' } })
        .select()
        .single()
      if (logErr) throw logErr

      await loadLogs()
      addToast('🤖 Scrape started! Watching for results…', 'success')

      // 2. Start polling BEFORE invoking (handles fast responses too)
      pollingLogRef.current = log.id
      const pollStart = Date.now()

      pollTimerRef.current = setInterval(async () => {
        // Safety timeout: 4 minutes
        if (Date.now() - pollStart > 4 * 60 * 1000) {
          clearInterval(pollTimerRef.current!)
          pollTimerRef.current  = null
          pollingLogRef.current = null
          setRunning(false)
          addToast('⏰ Scrape is taking longer than expected. Check logs manually.', 'error')
          return
        }

        const { data } = await supabase
          .from('scrape_logs')
          .select('status, products_found, new_products')
          .eq('id', log.id)
          .single()

        if (data && data.status !== 'running') {
          clearInterval(pollTimerRef.current!)
          pollTimerRef.current  = null
          pollingLogRef.current = null
          setRunning(false)
          await loadLogs()
          if (data.status === 'success') {
            addToast(
              `✅ Done! ${data.products_found ?? 0} found · ${data.new_products ?? 0} new products added.`,
              'success'
            )
          } else {
            addToast('❌ Scrape failed — check the run log for details.', 'error')
          }
        }
      }, 3_000)

      // 3. Fire the edge function — don't await, let the poll detect completion
      supabase.functions
        .invoke('scrape-products', { body: { logId: log.id } })
        .catch((err: unknown) => {
          // Network-level failure (function never ran)
          if (pollingLogRef.current === log.id) {
            clearInterval(pollTimerRef.current!)
            pollTimerRef.current  = null
            pollingLogRef.current = null
            setRunning(false)
            addToast(
              '❌ Could not reach edge function: ' +
                (err instanceof Error ? err.message : String(err)),
              'error'
            )
          }
        })
    } catch (err) {
      setRunning(false)
      addToast(err instanceof Error ? err.message : 'Trigger failed', 'error')
    }
  }

  const lastRun = logs[0]

  return (
    <div className="p-6 page-transition">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-bold text-[hsl(var(--foreground))]">Scraper</h1>
          <p className="mt-0.5 text-sm text-[hsl(var(--muted-foreground))]">Trigger & monitor product scrape runs</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadLogs}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm font-medium text-[hsl(var(--foreground))] shadow-card hover:bg-[hsl(var(--muted))] disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={triggerScrape}
            disabled={running}
            className="flex items-center gap-1.5 rounded-xl bg-amul-red px-4 py-2 text-sm font-semibold text-white hover:bg-amul-red-dark disabled:opacity-60"
          >
            {running
              ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              : <Play size={14} />}
            {running ? 'Triggering…' : 'Trigger scrape'}
          </button>
        </div>
      </div>

      {/* Last run summary */}
      {lastRun && !loading && (
        <div className={cn(
          'mb-6 flex items-center gap-4 rounded-2xl border px-5 py-4',
          lastRun.status === 'success' ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20' :
          lastRun.status === 'running' ? 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20' :
          'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20'
        )}>
          {lastRun.status === 'success' ? <CheckCircle2 size={20} className="text-green-600 shrink-0" /> :
           lastRun.status === 'running' ? <Clock size={20} className="text-amber-500 shrink-0 animate-pulse" /> :
           <XCircle size={20} className="text-red-500 shrink-0" />}
          <div className="flex-1">
            <p className="text-sm font-semibold text-[hsl(var(--foreground))]">Last run: {lastRun.status}</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              {new Date(lastRun.run_at).toLocaleString('en-IN')}
              {lastRun.products_found != null && ` · ${lastRun.products_found} found`}
              {lastRun.new_products    != null && ` · ${lastRun.new_products} new`}
            </p>
          </div>
          <Bot size={20} className="text-[hsl(var(--muted-foreground))] shrink-0" />
        </div>
      )}

      {/* Logs table */}
      <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-4 py-3">
          <p className="text-sm font-semibold text-[hsl(var(--foreground))]">Run history</p>
          <span className="text-xs text-[hsl(var(--muted-foreground))]">Last 20 runs</span>
        </div>
        {loading ? (
          <div className="divide-y divide-[hsl(var(--border))]">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="h-5 w-5 rounded-full" />
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="ml-auto h-3 w-24" />
              </div>
            ))}
          </div>
        ) : logs.length === 0 ? (
          <p className="py-12 text-center text-sm text-[hsl(var(--muted-foreground))]">No scrape runs yet.</p>
        ) : (
          <div className="divide-y divide-[hsl(var(--border))]">
            {logs.map((log) => (
              <div key={log.id} className="flex items-center gap-3 px-4 py-3">
                {log.status === 'success' ? <CheckCircle2 size={16} className="shrink-0 text-green-500" /> :
                 log.status === 'running' ? <Clock size={16} className="shrink-0 text-amber-500 animate-pulse" /> :
                 <XCircle size={16} className="shrink-0 text-red-500" />}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[hsl(var(--foreground))] capitalize">{log.status ?? 'unknown'}</p>
                  {(log.products_found != null || log.new_products != null) && (
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                      {log.products_found != null && `${log.products_found} found`}
                      {log.new_products   != null && ` · ${log.new_products} new`}
                    </p>
                  )}
                </div>
                <span className="shrink-0 text-[11px] text-[hsl(var(--muted-foreground))]">
                  {new Date(log.run_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="mt-4 text-center text-xs text-[hsl(var(--muted-foreground))]">
        💡 The actual scraper runs as a Supabase Edge Function. Trigger it here or schedule it as a cron job.
      </p>

      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </div>
  )
}
