import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Bot, Play, RefreshCw, CheckCircle2, XCircle, Clock, Upload, FileSpreadsheet } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast, ToastContainer } from '@/components/ui/Toast'
import type { ScrapeLog } from '@/types'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/Skeleton'



// Robust, zero-dependency CSV parser
function parseCSV(text: string): Record<string, string>[] {
  const lines = []
  let row: string[] = []
  let col = ''
  let inQuotes = false
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const nextChar = text[i + 1]
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        col += '"'
        i++ // skip double quote
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',') {
      if (inQuotes) {
        col += ','
      } else {
        row.push(col.trim())
        col = ''
      }
    } else if (char === '\n' || char === '\r') {
      if (inQuotes) {
        col += char
      } else {
        if (char === '\r' && nextChar === '\n') {
          i++
        }
        row.push(col.trim())
        lines.push(row)
        row = []
        col = ''
      }
    } else {
      col += char
    }
  }
  if (col || row.length > 0) {
    row.push(col.trim())
    lines.push(row)
  }
  
  if (lines.length <= 1) return []
  const headers = lines[0]
  const result: Record<string, string>[] = []
  
  for (let i = 1; i < lines.length; i++) {
    const r = lines[i]
    if (r.length < headers.length) continue
    const obj: Record<string, string> = {}
    headers.forEach((h, idx) => {
      obj[h] = r[idx]
    })
    result.push(obj)
  }
  return result
}

export default function AdminScraper() {
  const { toasts, addToast, dismiss } = useToast()

  const [logs,           setLogs]           = useState<ScrapeLog[]>([])
  const [loading,        setLoading]        = useState(true)
  const [running,        setRunning]        = useState(false)
  const [expandedLogId,  setExpandedLogId]  = useState<string | null>(null)
  const [uploading,      setUploading]      = useState(false)

  // Polling for scrape completion (legacy edge function option)
  const pollTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollingLogRef = useRef<string | null>(null)

  useEffect(() => {
    void loadLogs()
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current)
    }
  }, [])

  async function loadLogs(silent = false) {
    if (!silent) setLoading(true)
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
      if (!silent) setLoading(false)
    }
  }

  // Legacy Trigger Scrape Edge Function Option
  async function triggerScrape() {
    setRunning(true)
    try {
      // 1. Create a log row first so we have an ID to pass to the function
      const { data: log, error: logErr } = await supabase
        .from('scrape_logs')
        .insert({ status: 'running', log_detail: { phase: 'Starting scrape run…' } })
        .select()
        .single()
      if (logErr) throw logErr

      await loadLogs()
      addToast('🤖 Scrape started! Watching for results…', 'success')

      // 2. Start polling BEFORE invoking
      pollingLogRef.current = log.id
      const pollStart = Date.now()

      pollTimerRef.current = setInterval(async () => {
        if (Date.now() - pollStart > 4 * 60 * 1000) {
          clearInterval(pollTimerRef.current!)
          pollTimerRef.current  = null
          pollingLogRef.current = null
          setRunning(false)
          addToast('⏰ Scrape is taking longer than expected. Check logs manually.', 'error')
          return
        }

        await loadLogs(true)

        const { data } = await supabase
          .from('scrape_logs')
          .select('status, products_found, new_products, log_detail')
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

  // Option 1: CSV Upload Handler
  async function handleCsvUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const text = await file.text()
      const parsedRows = parseCSV(text)
      if (parsedRows.length === 0) {
        throw new Error('CSV is empty or could not be parsed. Make sure it has a header row.')
      }

      // Check required headers in parsed columns
      const sampleRow = parsedRows[0]
      if (!('name' in sampleRow) || !('image_url' in sampleRow)) {
        throw new Error('CSV must contain "name" and "image_url" columns.')
      }

      // Fetch all current product image_urls to prevent duplicates
      const { data: existing, error: fetchErr } = await supabase
        .from('products')
        .select('image_url')
      if (fetchErr) throw fetchErr

      const seenImages = new Set<string>(
        (existing ?? []).map((p) => p.image_url).filter(Boolean) as string[]
      )

      // Filter to find only new products
      const newProducts = parsedRows.filter(
        (p) => p.image_url && !seenImages.has(p.image_url.trim())
      )

      // Insert new products as pending status
      const insertPayload = newProducts.map((p) => {
        // Safe points mapping (constraint 1 to 5)
        let points = parseInt(p.points || '1', 10)
        if (isNaN(points) || points < 1 || points > 5) {
          points = 1
        }
        return {
          name:         (p.name ?? '').trim(),
          category:     p.category || 'Other',
          image_url:    p.image_url.trim(),
          source_url:   p.source_url || '',
          status:       'pending',
          availability: p.availability || 'Pan India',
          rarity_label: p.rarity_label || 'Common',
          points,
        }
      })

      if (insertPayload.length > 0) {
        const { error: insertErr } = await supabase
          .from('products')
          .insert(insertPayload)
        if (insertErr) throw insertErr
      }

      // Log the scrape result
      const { error: logErr } = await supabase
        .from('scrape_logs')
        .insert({
          status: 'success',
          products_found: parsedRows.length,
          new_products: insertPayload.length,
          log_detail: {
            source: 'CSV Upload',
            file_name: file.name,
            already_in_db: parsedRows.length - insertPayload.length,
            new_added: insertPayload.length,
            phase: 'Completed via manual CSV import'
          }
        })
      if (logErr) throw logErr

      addToast(
        `✅ CSV Imported! ${insertPayload.length} new products found & added for review. (${parsedRows.length - insertPayload.length} duplicates skipped)`,
        'success'
      )
      
      // Reset input
      e.target.value = ''
      await loadLogs()
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'CSV upload failed', 'error')
    } finally {
      setUploading(false)
    }
  }

  const lastRun = logs[0]

  return (
    <div className="p-6 page-transition">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-bold text-[hsl(var(--foreground))]">Scraper</h1>
          <p className="mt-0.5 text-sm text-[hsl(var(--muted-foreground))]">Import products & monitor scraper runs</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { void loadLogs() }}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm font-medium text-[hsl(var(--foreground))] shadow-card hover:bg-[hsl(var(--muted))] disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={triggerScrape}
            disabled={running}
            className="flex items-center gap-1.5 rounded-xl bg-amul-red/10 border border-amul-red/20 px-4 py-2 text-sm font-semibold text-amul-red hover:bg-amul-red/20 disabled:opacity-60"
          >
            {running
              ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-amul-red border-t-transparent" />
              : <Play size={14} />}
            {running ? 'Crawling…' : 'Trigger API Scrape'}
          </button>
        </div>
      </div>

      {/* CSV Uploader panel */}
      <div className="mb-6 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-card">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex-1">
            <h2 className="flex items-center gap-2 text-base font-semibold text-[hsl(var(--foreground))]">
              <FileSpreadsheet className="text-amul-red h-5 w-5" />
              CSV Product Import
            </h2>
            <p className="mt-1.5 text-xs text-[hsl(var(--muted-foreground))] leading-normal max-w-2xl">
              Upload the CSV file generated by your Chrome console script. The importer parses all products, compares their image URLs to the database, filters out duplicates, and inserts newly found products for admin review.
            </p>
          </div>
          <div>
            <label className={cn(
              "flex items-center gap-2 rounded-xl bg-amul-red px-5 py-3 text-sm font-semibold text-white hover:bg-amul-red-dark cursor-pointer transition-colors shadow-sm select-none",
              uploading && "opacity-50 pointer-events-none"
            )}>
              {uploading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Importing…
                </>
              ) : (
                <>
                  <Upload size={16} />
                  Upload Scrape CSV
                </>
              )}
              <input
                type="file"
                accept=".csv"
                className="hidden"
                disabled={uploading}
                onChange={handleCsvUpload}
              />
            </label>
          </div>
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
            {lastRun.status === 'running' && lastRun.log_detail && typeof lastRun.log_detail === 'object' && (
              <div className="mt-2 text-xs font-semibold text-amber-700 dark:text-amber-400">
                Progress: {(lastRun.log_detail as any).phase || 'Scraping...'}
                {(lastRun.log_detail as any).products_collected !== undefined && (
                  <span className="ml-1">({(lastRun.log_detail as any).products_collected} collected)</span>
                )}
              </div>
            )}
          </div>
          <Bot size={20} className="text-[hsl(var(--muted-foreground))] shrink-0" />
        </div>
      )}

      {/* Logs table */}
      <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-4 py-3">
          <p className="text-sm font-semibold text-[hsl(var(--foreground))]">Run history</p>
          <span className="text-xs text-[hsl(var(--muted-foreground))]">Last 20 runs (click row to inspect logs)</span>
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
            {logs.map((log) => {
              const isExpanded = expandedLogId === log.id
              const detail = log.log_detail as any
              return (
                <div key={log.id} className="transition-colors">
                  <div
                    onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[hsl(var(--muted))]/30 transition-colors"
                  >
                    {log.status === 'success' ? <CheckCircle2 size={16} className="shrink-0 text-green-500" /> :
                     log.status === 'running' ? <Clock size={16} className="shrink-0 text-amber-500 animate-pulse" /> :
                     <XCircle size={16} className="shrink-0 text-red-500" />}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[hsl(var(--foreground))] capitalize">
                        {log.status ?? 'unknown'}
                        {log.status === 'running' && detail?.phase && (
                          <span className="ml-2 text-xs font-normal text-amber-600 dark:text-amber-400 animate-pulse">
                            ({detail.phase})
                          </span>
                        )}
                      </p>
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
                  {isExpanded && log.log_detail && (
                    <div className="bg-[hsl(var(--muted))]/15 px-12 py-3 border-t border-[hsl(var(--border))] text-[11px] font-mono text-[hsl(var(--muted-foreground))] overflow-x-auto">
                      <pre className="whitespace-pre-wrap">{JSON.stringify(log.log_detail, null, 2)}</pre>
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
