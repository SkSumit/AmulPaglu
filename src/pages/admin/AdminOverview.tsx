import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Package, Users, Lightbulb, CheckCircle2, Clock, XCircle, TrendingUp } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/Skeleton'

interface OverviewStats {
  totalProducts: number
  approvedProducts: number
  pendingProducts: number
  totalUsers: number
  totalTried: number
  pendingSuggestions: number
  approvedSuggestions: number
  rejectedSuggestions: number
}



function StatCard({
  label, value, icon, sub, loading, highlight,
}: {
  label: string; value: number; icon: React.ReactNode
  sub?: string; loading?: boolean; highlight?: boolean
}) {
  return (
    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-card">
      <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[hsl(var(--muted))]">{icon}</div>
      <p className="mb-1 text-xs font-medium text-[hsl(var(--muted-foreground))]">{label}</p>
      {loading
        ? <Skeleton className="h-8 w-20" />
        : <p className={cn('font-display text-2xl font-bold', highlight && value > 0 ? 'text-amber-500' : 'text-[hsl(var(--foreground))]')}>{value}</p>
      }
      {sub && <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{sub}</p>}
    </div>
  )
}

export default function AdminOverview() {
  const [stats,   setStats]   = useState<OverviewStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { void load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [
        { count: totalProducts },
        { count: approvedProducts },
        { count: pendingProducts },
        { count: totalUsers },
        { count: totalTried },
        { count: pendingSuggestions },
        { count: approvedSuggestions },
        { count: rejectedSuggestions },
      ] = await Promise.all([
        supabase.from('products').select('id', { count: 'exact', head: true }),
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('user_products').select('id', { count: 'exact', head: true }).eq('status', 'tried'),
        supabase.from('suggestions').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('suggestions').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
        supabase.from('suggestions').select('id', { count: 'exact', head: true }).eq('status', 'rejected'),
      ])
      setStats({
        totalProducts:       totalProducts       ?? 0,
        approvedProducts:    approvedProducts    ?? 0,
        pendingProducts:     pendingProducts     ?? 0,
        totalUsers:          totalUsers          ?? 0,
        totalTried:          totalTried          ?? 0,
        pendingSuggestions:  pendingSuggestions  ?? 0,
        approvedSuggestions: approvedSuggestions ?? 0,
        rejectedSuggestions: rejectedSuggestions ?? 0,
      })
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 page-transition">
      <div className="mb-6">
        <h1 className="font-display text-xl font-bold text-[hsl(var(--foreground))]">Overview</h1>
        <p className="mt-0.5 text-sm text-[hsl(var(--muted-foreground))]">Platform health at a glance</p>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total products"   value={stats?.totalProducts ?? 0}      icon={<Package   size={18} className="text-amul-red"   />} sub={`${stats?.approvedProducts ?? 0} approved`}   loading={loading} />
        <StatCard label="Pending review"   value={stats?.pendingProducts ?? 0}    icon={<Clock     size={18} className="text-amber-500" />} loading={loading} highlight />
        <StatCard label="Registered users" value={stats?.totalUsers ?? 0}         icon={<Users     size={18} className="text-blue-500"  />} sub={`${stats?.totalTried ?? 0} total tries`} loading={loading} />
        <StatCard label="Open suggestions" value={stats?.pendingSuggestions ?? 0} icon={<Lightbulb size={18} className="text-amul-gold" />} loading={loading} highlight />
      </div>

      <div className="mb-8 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-card">
        <h2 className="mb-4 font-semibold text-[hsl(var(--foreground))]">Suggestions breakdown</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: 'Pending',  v: stats?.pendingSuggestions,  Icon: Clock,        cls: 'text-amber-500 bg-amber-50 dark:bg-amber-950/30' },
            { label: 'Approved', v: stats?.approvedSuggestions, Icon: CheckCircle2, cls: 'text-green-600 bg-green-50 dark:bg-green-950/30'  },
            { label: 'Rejected', v: stats?.rejectedSuggestions, Icon: XCircle,      cls: 'text-red-500   bg-red-50   dark:bg-red-950/30'    },
          ].map(({ label, v, Icon, cls }) => (
            <div key={label} className={cn('flex items-center gap-3 rounded-xl px-4 py-3', cls.split(' ').slice(1).join(' '))}>
              <Icon size={20} className={cls.split(' ')[0]} />
              <div>
                {loading ? <Skeleton className="h-5 w-8" /> : <p className="font-bold text-[hsl(var(--foreground))]">{v ?? 0}</p>}
                <p className="text-xs text-[hsl(var(--muted-foreground))]">{label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { to: '/admin/products',    label: 'Manage Products',    Icon: Package,   desc: 'Add, edit, approve products'     },
          { to: '/admin/suggestions', label: 'Review Suggestions', Icon: Lightbulb, desc: 'User-submitted product ideas'    },
          { to: '/admin/users',       label: 'Manage Users',       Icon: Users,     desc: 'View users, assign admin roles'  },
        ].map(({ to, label, Icon, desc }) => (
          <Link key={to} to={to} className="flex items-center gap-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 shadow-card transition-all hover:shadow-card-lg hover:-translate-y-0.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amul-red/10 text-amul-red"><Icon size={18} /></div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[hsl(var(--foreground))]">{label}</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">{desc}</p>
            </div>
            <TrendingUp size={14} className="ml-auto shrink-0 text-[hsl(var(--muted-foreground))]" />
          </Link>
        ))}
      </div>
    </div>
  )
}
